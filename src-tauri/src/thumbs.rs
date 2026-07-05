use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use tauri::Manager;
use crate::error::AppError;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const MAX_CACHE_ENTRIES: usize = 500;
const EVICT_COUNT: usize = 100;
const THUMB_SIZE: u32 = 256;
const LUMINANCE_THRESHOLD: f32 = 0.05;

// ─── Cache helpers ────────────────────────────────────────────────────────────

fn cache_key(path: &str, mtime: SystemTime) -> String {
    let mtime_secs = mtime
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let input = format!("{}{}", path, mtime_secs);
    let hash = Sha256::digest(input.as_bytes());
    hash.iter().map(|b| format!("{:02x}", b)).collect()
}

fn evict_if_needed(thumbs_dir: &Path) {
    let Ok(entries) = std::fs::read_dir(thumbs_dir) else { return };
    let mut files: Vec<(SystemTime, PathBuf)> = entries
        .flatten()
        .filter(|e| {
            e.path()
                .extension()
                .is_some_and(|x| x == "png" || x == "jpg")
        })
        .filter_map(|e| {
            let mtime = e.metadata().ok()?.modified().ok()?;
            Some((mtime, e.path()))
        })
        .collect();

    if files.len() <= MAX_CACHE_ENTRIES {
        return;
    }
    files.sort_by_key(|(t, _)| *t);
    for (_, path) in files.iter().take(EVICT_COUNT) {
        let _ = std::fs::remove_file(path);
    }
}

// ─── Video thumbnail ──────────────────────────────────────────────────────────

fn frame_luminance(path: &Path) -> f32 {
    let Ok(img) = image::open(path) else { return 1.0 };
    let rgb = img.to_rgb8();
    let count = rgb.width() * rgb.height();
    if count == 0 {
        return 1.0;
    }
    let sum: f32 = rgb
        .pixels()
        .map(|p| {
            let r = p[0] as f32 / 255.0;
            let g = p[1] as f32 / 255.0;
            let b = p[2] as f32 / 255.0;
            0.2126 * r + 0.7152 * g + 0.0722 * b
        })
        .sum();
    sum / count as f32
}

fn extract_video_frame(ffmpeg: &Path, input: &str, out: &Path, seek_sec: f64) -> bool {
    let mut cmd = std::process::Command::new(ffmpeg);
    cmd.args([
        "-ss",
        &seek_sec.to_string(),
        "-i",
        input,
        "-vframes",
        "1",
        "-vf",
        &format!("scale={}:-1", THUMB_SIZE),
        "-y",
        out.to_str().unwrap_or(""),
    ]);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.output().map(|o| o.status.success()).unwrap_or(false)
}

fn generate_video_thumb(ffmpeg: &Path, path: &str, out: &Path, duration_sec: Option<f64>) -> bool {
    let dur = duration_sec.unwrap_or(60.0).max(1.0);
    for &frac in &[0.10_f64, 0.25] {
        let seek = (dur * frac).max(0.5);
        if extract_video_frame(ffmpeg, path, out, seek) && frame_luminance(out) >= LUMINANCE_THRESHOLD {
            return true;
        }
    }
    false
}

// ─── Audio thumbnail ──────────────────────────────────────────────────────────

fn extract_audio_cover(path: &str, out: &Path) -> bool {
    use lofty::prelude::*;
    use lofty::probe::Probe;

    let Ok(probe) = Probe::open(path) else { return false };
    let Ok(tagged) = probe.read() else { return false };

    for tag in tagged.tags() {
        for pic in tag.pictures() {
            let data = pic.data();
            if data.is_empty() {
                continue;
            }
            if let Ok(img) = image::load_from_memory(data) {
                let thumb = img.resize(THUMB_SIZE, THUMB_SIZE, image::imageops::FilterType::Lanczos3);
                return thumb.save(out).is_ok();
            }
        }
    }
    false
}

fn generate_waveform(ffmpeg: &Path, path: &str, out: &Path) -> bool {
    let mut cmd = std::process::Command::new(ffmpeg);
    cmd.args([
        "-i",
        path,
        "-filter_complex",
        "showwavespic=s=256x128:colors=#7AB7FF",
        "-frames:v",
        "1",
        "-y",
        out.to_str().unwrap_or(""),
    ]);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.output().map(|o| o.status.success()).unwrap_or(false)
}

// ─── Image thumbnail ──────────────────────────────────────────────────────────

fn generate_image_thumb(path: &str, out: &Path) -> bool {
    let Ok(img) = image::open(path) else { return false };
    let thumb = img.resize(THUMB_SIZE, THUMB_SIZE, image::imageops::FilterType::Lanczos3);
    thumb.save(out).is_ok()
}

// ─── Command ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn generate_thumbnail(
    app: tauri::AppHandle,
    path: String,
    kind: String,
    duration_sec: Option<f64>,
) -> Result<Option<String>, AppError> {
    // TODO(phase 9): replace with gs.exe first-page render
    if kind == "pdf" {
        return Ok(None);
    }

    let src = Path::new(&path);
    if !src.exists() {
        return Ok(None);
    }

    let mtime = src.metadata()?.modified().unwrap_or(SystemTime::UNIX_EPOCH);
    let key = cache_key(&path, mtime);

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Other(e.to_string()))?;
    let thumbs_dir = app_data_dir.join("thumbs");
    std::fs::create_dir_all(&thumbs_dir)?;

    let out_path = thumbs_dir.join(format!("{}.png", key));

    // Cache hit — serve immediately
    if out_path.exists() {
        return Ok(Some(out_path.to_string_lossy().into_owned()));
    }

    let ffmpeg = ffmpeg_sidecar::paths::ffmpeg_path();

    let success = match kind.as_str() {
        "image" => generate_image_thumb(&path, &out_path),
        "video" => generate_video_thumb(&ffmpeg, &path, &out_path, duration_sec),
        "audio" => {
            extract_audio_cover(&path, &out_path)
                || generate_waveform(&ffmpeg, &path, &out_path)
        }
        _ => false,
    };

    if success {
        evict_if_needed(&thumbs_dir);
        Ok(Some(out_path.to_string_lossy().into_owned()))
    } else {
        Ok(None)
    }
}
