use serde::Serialize;
use std::path::Path;
use crate::error::AppError;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathInfo {
    pub exists: bool,
    pub is_dir: bool,
    pub size: u64,
    pub name: String,
    pub extension: Option<String>,
    /// Full absolute path, echoed back for convenience
    pub path: String,
}

/// Extension sets — keep in sync with src/lib/kinds.ts
///
/// video:  mp4 mov mkv webm avi m4v wmv flv
/// audio:  mp3 m4a aac wav flac ogg opus wma
/// image:  jpg jpeg png webp heic heif avif bmp tiff
/// pdf:    pdf
const SUPPORTED_EXT: &[&str] = &[
    // video
    "mp4", "mov", "mkv", "webm", "avi", "m4v", "wmv", "flv",
    // audio
    "mp3", "m4a", "aac", "wav", "flac", "ogg", "opus", "wma",
    // image
    "jpg", "jpeg", "png", "webp", "heic", "heif", "avif", "bmp", "tiff",
    // pdf
    "pdf",
];

/// Return metadata for a single path. Never errors on "not found" — instead
/// returns PathInfo { exists: false, ... } so callers can distinguish gracefully.
#[tauri::command]
pub fn get_path_info(path: String) -> Result<PathInfo, AppError> {
    let p = Path::new(&path);
    if !p.exists() {
        return Ok(PathInfo {
            exists: false,
            is_dir: false,
            size: 0,
            name: p.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string(),
            extension: None,
            path,
        });
    }
    let meta = std::fs::metadata(p)?;
    Ok(PathInfo {
        exists: true,
        is_dir: meta.is_dir(),
        size: meta.len(),
        name: p.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string(),
        extension: p.extension().and_then(|e| e.to_str()).map(|s| s.to_lowercase()),
        path,
    })
}

/// Open Windows Explorer with the given file selected (highlight it in its folder).
#[tauri::command]
pub fn reveal_in_explorer(path: String) -> Result<(), AppError> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| AppError::Io(e.to_string()))?;
    }
    Ok(())
}

/// Walk a directory one level deep and return all supported files.
/// Subdirectories are not recursed — a top-level folder drop gives the
/// immediate children only. This is intentional: recursive drops on large
/// folder trees would stall the UI. Document in future Phase 2+ changelog
/// if deeper traversal is ever requested.
#[tauri::command]
pub fn list_dir_supported(path: String) -> Result<Vec<PathInfo>, AppError> {
    let dir_path = Path::new(&path);
    if !dir_path.exists() {
        return Err(AppError::PathDoesNotExist(path));
    }
    let entries = std::fs::read_dir(dir_path)?;
    let mut results: Vec<PathInfo> = Vec::new();
    for entry in entries.flatten() {
        let p = entry.path();
        if !p.is_file() {
            continue;
        }
        let Some(ext) = p.extension().and_then(|e| e.to_str()) else {
            continue;
        };
        if !SUPPORTED_EXT.contains(&ext.to_lowercase().as_str()) {
            continue;
        }
        let meta = std::fs::metadata(&p)?;
        results.push(PathInfo {
            exists: true,
            is_dir: false,
            size: meta.len(),
            name: p.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string(),
            extension: Some(ext.to_lowercase()),
            path: p.to_string_lossy().to_string(),
        });
    }
    Ok(results)
}

#[tauri::command]
pub fn write_clipboard_image(bytes: Vec<u8>) -> Result<PathInfo, AppError> {
    use std::io::Write;
    let temp_dir = std::env::temp_dir();
    let filename = format!("smol_paste_{}.png", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis());
    let filepath = temp_dir.join(filename);
    
    let mut file = std::fs::File::create(&filepath)?;
    file.write_all(&bytes)?;
    
    get_path_info(filepath.to_string_lossy().to_string())
}
