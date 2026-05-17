---
name: smol-rust-fs-bridge
description: Use this skill when you are about to call fs.stat, fs.exists, fs.metadata, read a file, use @tauri-apps/plugin-fs, or access any user-chosen path from JS. Prevents bug #3 (sandbox blocks user paths).
---

# Smol Rust FS Bridge

## The rule (HR-6)

**Never import `@tauri-apps/plugin-fs` and call it on user-chosen paths.**

The Tauri fs plugin operates inside a sandbox. Paths like `C:\Users\...\Downloads\video.mp4`
that the user drags onto the window are NOT in the sandbox. Every such call silently
fails or throws `path not allowed`.

The only correct pattern: expose a `#[tauri::command]` in Rust and call it via `invoke()`.

---

## Canonical Rust commands (src-tauri/src/commands/fs.rs)

```rust
use serde::{Deserialize, Serialize};
use std::path::Path;
use crate::error::AppError;

#[derive(Serialize)]
pub struct PathInfo {
    pub exists: bool,
    pub is_dir: bool,
    pub size_bytes: u64,
    pub name: String,
    pub extension: Option<String>,
}

#[tauri::command]
pub fn get_path_info(path: String) -> Result<PathInfo, AppError> {
    let p = Path::new(&path);
    if !p.exists() {
        return Ok(PathInfo { exists: false, is_dir: false, size_bytes: 0,
            name: p.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string(),
            extension: None });
    }
    let meta = std::fs::metadata(p).map_err(AppError::Io)?;
    Ok(PathInfo {
        exists: true,
        is_dir: meta.is_dir(),
        size_bytes: meta.len(),
        name: p.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string(),
        extension: p.extension().and_then(|e| e.to_str()).map(|s| s.to_lowercase()),
    })
}

#[tauri::command]
pub fn list_supported_in_dir(path: String) -> Result<Vec<PathInfo>, AppError> {
    const SUPPORTED_EXT: &[&str] = &[
        "mp4","mov","mkv","avi","webm","m4v","flv",        // video
        "mp3","aac","flac","wav","ogg","m4a","opus","wma", // audio
        "jpg","jpeg","png","gif","webp","avif","bmp","tiff","tif", // image
        "pdf",                                              // pdf
    ];
    let dir = std::fs::read_dir(&path).map_err(AppError::Io)?;
    let mut results = Vec::new();
    for entry in dir.flatten() {
        let p = entry.path();
        if p.is_file() {
            if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                if SUPPORTED_EXT.contains(&ext.to_lowercase().as_str()) {
                    let meta = std::fs::metadata(&p).map_err(AppError::Io)?;
                    results.push(PathInfo {
                        exists: true,
                        is_dir: false,
                        size_bytes: meta.len(),
                        name: p.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string(),
                        extension: Some(ext.to_lowercase()),
                    });
                }
            }
        }
    }
    Ok(results)
}

#[tauri::command]
pub fn ensure_output_path(input_path: String, pattern: String, output_mode: String, custom_dir: Option<String>) -> Result<String, AppError> {
    let input = Path::new(&input_path);
    let stem = input.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
    let ext = input.extension().and_then(|e| e.to_str()).unwrap_or("");
    let filename = pattern
        .replace("{name}", stem)
        .replace("{ext}", &format!(".{ext}"));

    let dir = match output_mode.as_str() {
        "subfolder" => input.parent().map(|p| p.join("smol")).unwrap_or_default(),
        "custom" => std::path::PathBuf::from(custom_dir.unwrap_or_default()),
        _ => input.parent().map(|p| p.to_path_buf()).unwrap_or_default(),
    };
    std::fs::create_dir_all(&dir).map_err(AppError::Io)?;

    // collision avoidance: append _2, _3, ...
    let mut candidate = dir.join(&filename);
    let mut counter = 2u32;
    while candidate.exists() {
        let new_name = pattern
            .replace("{name}", &format!("{stem}_{counter}"))
            .replace("{ext}", &format!(".{ext}"));
        candidate = dir.join(new_name);
        counter += 1;
    }
    Ok(candidate.to_string_lossy().to_string())
}

#[tauri::command]
pub fn reveal_in_explorer(path: String) -> Result<(), AppError> {
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .args(["/select,", &path])
        .spawn()
        .map_err(AppError::Io)?;
    Ok(())
}
```

---

## TypeScript typed wrappers (src/lib/tauri.ts)

```ts
import { invoke } from "@tauri-apps/api/core";

export interface PathInfo {
  exists: boolean;
  isDir: boolean;
  sizeBytes: number;
  name: string;
  extension: string | null;
}

export const getPathInfo = (path: string) =>
  invoke<PathInfo>("get_path_info", { path });

export const listSupportedInDir = (path: string) =>
  invoke<PathInfo[]>("list_supported_in_dir", { path });

export const ensureOutputPath = (
  inputPath: string,
  pattern: string,
  outputMode: string,
  customDir?: string
) => invoke<string>("ensure_output_path", { inputPath, pattern, outputMode, customDir });

export const revealInExplorer = (path: string) =>
  invoke<void>("reveal_in_explorer", { path });
```

---

## Register all commands in lib.rs

```rust
.invoke_handler(tauri::generate_handler![
    commands::fs::get_path_info,
    commands::fs::list_supported_in_dir,
    commands::fs::ensure_output_path,
    commands::fs::reveal_in_explorer,
    // ... other commands
])
```
