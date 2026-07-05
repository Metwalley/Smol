use std::path::Path;
use tokio::io::{AsyncReadExt, BufReader};
use tokio::process::Command as TokioCommand;

use crate::encoders::gs_sidecar_path;
use crate::error::AppError;
use crate::jobs::progress::ProgressEvent;
use crate::commands::compress_video::CompressResult;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

// ── Preset → -dPDFSETTINGS ────────────────────────────────────────────────────

/// Returns the GS pdfwrite PDFSETTINGS value for a preset, or None for lossless
/// (which uses /prepress + explicit no-downsampling flags instead).
fn pdf_settings(preset: &str) -> Option<&'static str> {
    match preset {
        "less"     => Some("/printer"),  // ~20-30 % — print-quality images
        "extreme"  => Some("/screen"),   // ~80-90 % — screen-resolution images
        "lossless" => None,              // handled separately: no image resampling
        _          => Some("/ebook"),    // "recommended" default: ~50-70 %
    }
}

// ── compress_pdf ──────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn compress_pdf(
    job_id: String,
    input_path: String,
    output_path: String,
    preset: String,
    // duration_sec is unused for PDFs; accepted so JS can call with the same
    // signature as compressVideo / compressAudio / compressImage.
    duration_sec: Option<f64>,
    on_progress: tauri::ipc::Channel<ProgressEvent>,
) -> Result<CompressResult, AppError> {
    let _ = duration_sec;

    let gs = gs_sidecar_path();
    if !gs.exists() {
        return Err(AppError::Other(format!(
            "Ghostscript binary not found at {} — run scripts/fetch-ghostscript.mjs",
            gs.display()
        )));
    }

    if input_path == output_path {
        return Err(AppError::Other(
            "Output path is the same as the input — change the filename pattern".into(),
        ));
    }

    // Ensure the output directory exists (handles 'subfolder' and 'custom' modes)
    if let Some(parent) = Path::new(&output_path).parent() {
        std::fs::create_dir_all(parent)?;
    }

    let input_bytes = std::fs::metadata(&input_path)?.len();

    // Temp file must end in .pdf so GS can detect the output container format.
    // Pattern mirrors compress_video: insert ".part" before the extension.
    let temp_path = {
        let p = Path::new(&output_path);
        let parent = p.parent().unwrap_or(Path::new("."));
        let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("output");
        parent.join(format!("{stem}.part.pdf"))
              .to_string_lossy()
              .into_owned()
    };

    // ── Build GS arg list ─────────────────────────────────────────────────────

    let mut args: Vec<String> = vec![
        "-dBATCH".into(),
        "-dNOPAUSE".into(),
        "-dQUIET".into(),
        "-sDEVICE=pdfwrite".into(),
        "-dCompatibilityLevel=1.4".into(),
    ];

    match pdf_settings(&preset) {
        Some(setting) => {
            args.push(format!("-dPDFSETTINGS={setting}"));
        }
        None => {
            // lossless: /prepress quality level + explicitly disable all downsampling
            args.push("-dPDFSETTINGS=/prepress".into());
            args.push("-dColorConversionStrategy=/LeaveColorUnchanged".into());
            args.push("-dDownsampleColorImages=false".into());
            args.push("-dDownsampleGrayImages=false".into());
            args.push("-dDownsampleMonoImages=false".into());
        }
    }

    args.push(format!("-sOutputFile={temp_path}"));
    args.push(input_path.clone());

    // ── Spawn Ghostscript ─────────────────────────────────────────────────────

    let mut cmd = TokioCommand::new(&gs);
    cmd.args(&args)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped());

    // Windows: suppress the black CMD console window
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd
        .spawn()
        .map_err(|e| AppError::Other(format!("Failed to spawn Ghostscript: {e}")))?;

    // Drain stderr in a background task so the pipe buffer never fills and
    // deadlocks the process.  Keep the last 512 bytes for error reporting.
    let stderr = child.stderr.take().expect("stderr is piped");
    let stderr_task = tokio::spawn(async move {
        let mut buf = Vec::new();
        let mut reader = BufReader::new(stderr);
        let _ = reader.read_to_end(&mut buf).await;
        if buf.len() > 512 {
            let start = buf.len() - 512;
            buf = buf[start..].to_vec();
        }
        String::from_utf8_lossy(&buf).trim().to_string()
    });

    // Wait for GS to finish
    let status = child
        .wait()
        .await
        .map_err(|e| AppError::Other(format!("Ghostscript process error: {e}")))?;

    let stderr_output = stderr_task.await.unwrap_or_default();

    if !status.success() {
        let _ = std::fs::remove_file(&temp_path);
        let msg = if stderr_output.is_empty() {
            "PDF compression failed or was cancelled".into()
        } else {
            let last = stderr_output.lines().last().unwrap_or(&stderr_output);
            format!("Ghostscript: {last}")
        };
        return Err(AppError::Other(msg));
    }

    // ── Output-larger-than-input guard ────────────────────────────────────────

    let output_bytes = std::fs::metadata(&temp_path)
        .map(|m| m.len())
        .unwrap_or(0);

    if output_bytes >= input_bytes {
        // Compressed file is not smaller — discard it and keep the original
        let _ = std::fs::remove_file(&temp_path);
        let _ = on_progress.send(ProgressEvent {
            job_id: job_id.clone(),
            fraction: 1.0,
            fps: None,
            speed: None,
            eta_sec: None,
            current_bytes: Some(input_bytes),
        });
        return Ok(CompressResult {
            output_path: input_path,
            output_bytes: input_bytes,
            output_larger: true,
        });
    }

    // ── Commit: rename .part.pdf → final output ───────────────────────────────

    if Path::new(&output_path).exists() {
        std::fs::remove_file(&output_path)?;
    }
    let mut retries = 5;
    loop {
        match std::fs::rename(&temp_path, &output_path) {
            Ok(_) => break,
            Err(e) if e.raw_os_error() == Some(32) && retries > 0 => {
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                retries -= 1;
            }
            Err(e) => return Err(AppError::Other(format!("Failed to move output file: {e}"))),
        }
    }

    // Emit 100% so the UI state machine and progress bar reach completion
    let _ = on_progress.send(ProgressEvent {
        job_id: job_id.clone(),
        fraction: 1.0,
        fps: None,
        speed: None,
        eta_sec: None,
        current_bytes: Some(output_bytes),
    });

    Ok(CompressResult {
        output_path,
        output_bytes,
        output_larger: false,
    })
}
