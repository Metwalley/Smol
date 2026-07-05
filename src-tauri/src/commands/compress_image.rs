use std::path::Path;
use tokio::task;

use crate::error::AppError;
use crate::jobs::progress::ProgressEvent;
use crate::commands::compress_video::CompressResult;

// ── Quality tables ─────────────────────────────────────────────────────────────

struct ImagePreset {
    jpeg_quality:  u8,    // mozjpeg 0-100
    png_opt_level: u8,    // oxipng preset 0-6
    webp_quality:  f32,   // webp 0-100
    lossless:      bool,
}

fn image_preset(preset: &str) -> ImagePreset {
    match preset {
        "less"     => ImagePreset { jpeg_quality: 85, png_opt_level: 2, webp_quality: 85.0, lossless: false },
        "extreme"  => ImagePreset { jpeg_quality: 55, png_opt_level: 6, webp_quality: 55.0, lossless: false },
        "lossless" => ImagePreset { jpeg_quality: 95, png_opt_level: 0, webp_quality: 100.0, lossless: true },
        _          => ImagePreset { jpeg_quality: 75, png_opt_level: 4, webp_quality: 75.0,  lossless: false },
    }
}

// ── Output extension ──────────────────────────────────────────────────────────

/// Returns the output extension for a supported format, or None if unsupported.
/// Unsupported formats are returned to the caller unchanged (output_larger: true).
fn image_output_ext(input_ext: &str) -> Option<&'static str> {
    match input_ext {
        "jpg" | "jpeg" => Some("jpg"),
        "png"           => Some("png"),
        "webp"          => Some("webp"),
        "bmp" | "tiff"  => Some("jpg"), // transcode to JPEG (no native BMP/TIFF encoder needed)
        _               => None,         // avif, heic, heif, gif: pass-through
    }
}

// ── Per-format encoders (synchronous, CPU-bound) ──────────────────────────────

fn encode_jpeg(input_bytes: &[u8], quality: u8) -> Result<Vec<u8>, AppError> {
    let img = image::load_from_memory(input_bytes)
        .map_err(|e| AppError::Other(format!("Image decode: {e}")))?
        .to_rgb8();
    let (w, h) = (img.width(), img.height());

    let mut comp = mozjpeg::Compress::new(mozjpeg::ColorSpace::JCS_RGB);
    comp.set_size(w as usize, h as usize);
    comp.set_quality(quality as f32);

    let mut started = comp
        .start_compress(Vec::new())
        .map_err(|e| AppError::Other(format!("JPEG init: {e}")))?;
    started
        .write_scanlines(img.as_raw())
        .map_err(|e| AppError::Other(format!("JPEG scanlines: {e}")))?;
    started
        .finish()
        .map_err(|e| AppError::Other(format!("JPEG finish: {e}")))
}

fn encode_png(input_bytes: &[u8], opt_level: u8) -> Result<Vec<u8>, AppError> {
    let opts = oxipng::Options::from_preset(opt_level);
    oxipng::optimize_from_memory(input_bytes, &opts)
        .map_err(|e| AppError::Other(format!("PNG optimize: {e}")))
}

fn encode_webp(input_bytes: &[u8], quality: f32, lossless: bool) -> Result<Vec<u8>, AppError> {
    let img = image::load_from_memory(input_bytes)
        .map_err(|e| AppError::Other(format!("Image decode: {e}")))?
        .to_rgba8();
    let encoder = webp::Encoder::from_rgba(img.as_raw(), img.width(), img.height());
    let output = if lossless {
        encoder.encode_lossless()
    } else {
        encoder.encode(quality)
    };
    Ok(output.to_vec())
}

// ── compress_image ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn compress_image(
    job_id: String,
    input_path: String,
    output_path: String,
    preset: String,
    // duration_sec is unused for images; accepted so the JS dispatcher can call
    // compressImage with the same signature as compressVideo/compressAudio.
    duration_sec: Option<f64>,
    on_progress: tauri::ipc::Channel<ProgressEvent>,
) -> Result<CompressResult, AppError> {
    let _ = duration_sec; // intentionally unused

    let input_ext = Path::new(&input_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let effective_ext = input_ext.clone();

    // Unsupported format: return original unchanged
    let Some(out_ext) = image_output_ext(&effective_ext) else {
        let input_bytes = std::fs::metadata(&input_path)?.len();
        return Ok(CompressResult {
            output_path: input_path,
            output_bytes: input_bytes,
            output_larger: true,
        });
    };

    // Override output extension if the format changes (e.g. BMP → jpg)
    let output_path = {
        let p = Path::new(&output_path);
        let cur_ext = p.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        if cur_ext != out_ext {
            let parent = p.parent().unwrap_or(Path::new("."));
            let stem   = p.file_stem().and_then(|s| s.to_str()).unwrap_or("output");
            parent.join(format!("{stem}.{out_ext}"))
                  .to_string_lossy()
                  .into_owned()
        } else {
            output_path
        }
    };

    // Ensure output directory exists (handles 'subfolder' and 'custom' modes)
    if let Some(parent) = Path::new(&output_path).parent() {
        std::fs::create_dir_all(parent)?;
    }

    let input_bytes_raw = std::fs::read(&input_path)?;
    let input_size = input_bytes_raw.len() as u64;

    // Clone what the blocking closure needs (avoids capturing String references)
    let preset_c    = preset.clone();
    let effective_ext_c = effective_ext.clone();

    // Run CPU-bound encoding on a blocking thread so the async runtime stays free
    let compressed = task::spawn_blocking(move || -> Result<Vec<u8>, AppError> {
        let p = image_preset(&preset_c);
        match effective_ext_c.as_str() {
            "jpg" | "jpeg" | "bmp" | "tiff" => encode_jpeg(&input_bytes_raw, p.jpeg_quality),
            "png"                             => encode_png(&input_bytes_raw, p.png_opt_level),
            "webp"                            => encode_webp(&input_bytes_raw, p.webp_quality, p.lossless),
            _                                 => unreachable!("filtered by image_output_ext above"),
        }
    })
    .await
    .map_err(|e| AppError::Other(format!("Task panic: {e}")))?;

    let compressed = compressed?;
    let output_size = compressed.len() as u64;

    // Output-larger-than-input guard: keep the original when compression fails to shrink
    if output_size >= input_size {
        return Ok(CompressResult {
            output_path: input_path,
            output_bytes: input_size,
            output_larger: true,
        });
    }

    // Write via .part temp file then atomic rename (same pattern as audio/video)
    let temp_path = {
        let p = Path::new(&output_path);
        let parent = p.parent().unwrap_or(Path::new("."));
        let stem   = p.file_stem().and_then(|s| s.to_str()).unwrap_or("output");
        let ext    = p.extension().and_then(|e| e.to_str())
                      .map(|e| format!(".{e}")).unwrap_or_default();
        parent.join(format!("{stem}.part{ext}"))
              .to_string_lossy()
              .into_owned()
    };

    std::fs::write(&temp_path, &compressed)?;

    if Path::new(&output_path).exists() {
        std::fs::remove_file(&output_path)?;
    }
    let mut retries = 5;
    loop {
        match std::fs::rename(&temp_path, &output_path) {
            Ok(_) => break,
            Err(e) if e.raw_os_error() == Some(32) && retries > 0 => {
                // Since this is in an async fn but not blocking the tokio thread entirely at this point,
                // wait... wait, this is just async fn, we can use tokio::time::sleep
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                retries -= 1;
            }
            Err(e) => return Err(AppError::Other(format!("Failed to move output file: {e}"))),
        }
    }

    // Emit 100% progress so the channel handler fires and any UI bound to it updates
    let _ = on_progress.send(ProgressEvent {
        job_id: job_id.clone(),
        fraction: 1.0,
        fps: None,
        speed: None,
        eta_sec: None,
        current_bytes: Some(output_size),
    });

    Ok(CompressResult {
        output_path,
        output_bytes: output_size,
        output_larger: false,
    })
}
