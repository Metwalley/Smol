use std::path::Path;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::Command as TokioCommand;

use crate::encoders::ffmpeg_args::{audio_output_ext, build_audio_args};
use crate::encoders::ffmpeg_sidecar_path;
use crate::error::AppError;
use crate::jobs::progress::ProgressEvent;

// Shared managed state lives in compress_video so cancel_job can kill any PID
use crate::commands::compress_video::{ActiveJobPids, CompressResult};

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

// ─── compress_audio ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn compress_audio(
    job_id: String,
    input_path: String,
    output_path: String,
    preset: String,
    duration_sec: Option<f64>,
    on_progress: tauri::ipc::Channel<ProgressEvent>,
    active_jobs: tauri::State<'_, ActiveJobPids>,
) -> Result<CompressResult, AppError> {
    let ffmpeg = ffmpeg_sidecar_path();
    if !ffmpeg.exists() {
        return Err(AppError::Other(format!(
            "FFmpeg binary not found at {} — run scripts/fetch-ffmpeg.mjs",
            ffmpeg.display()
        )));
    }

    if input_path == output_path {
        return Err(AppError::Other(
            "Output path is the same as the input — change the filename pattern".into(),
        ));
    }

    // Determine actual output extension (may differ from input, e.g. WAV → mp3)
    let input_ext = Path::new(&input_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let out_ext = audio_output_ext(&preset, &input_ext);

    // Override extension in output_path when the container format changes
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

    // Temp path: insert ".part" before the extension so FFmpeg auto-detects
    // the container format (avoids "Invalid argument" from a bare .part extension)
    let temp_path = {
        let p = Path::new(&output_path);
        let parent = p.parent().unwrap_or(Path::new("."));
        let stem   = p.file_stem().and_then(|s| s.to_str()).unwrap_or("output");
        let ext    = p.extension().and_then(|e| e.to_str())
                      .map(|e| format!(".{e}"))
                      .unwrap_or_default();
        parent.join(format!("{stem}.part{ext}"))
              .to_string_lossy()
              .into_owned()
    };

    let input_bytes = std::fs::metadata(&input_path)?.len();
    let args = build_audio_args(&preset, &input_ext, &input_path, &temp_path);

    let mut cmd = TokioCommand::new(&ffmpeg);
    cmd.args(&args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    // Windows: suppress console window flash
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd
        .spawn()
        .map_err(|e| AppError::Other(format!("Failed to spawn FFmpeg: {e}")))?;

    // Register PID so cancel_job can kill this process
    let pid = child.id().unwrap_or(0);
    if let Ok(mut jobs) = active_jobs.0.lock() {
        jobs.insert(job_id.clone(), pid);
    }

    // Drain stderr in background so the pipe buffer never deadlocks
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

    // ── Stream progress from stdout (-progress pipe:1) ────────────────────────
    let stdout = child.stdout.take().expect("stdout is piped");
    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();

    let mut out_time_us: f64    = 0.0;
    let mut out_time_ms_raw: f64 = 0.0;
    let mut speed: Option<String>   = None;
    let mut current_bytes: Option<u64> = None;

    while let Ok(Some(line)) = lines.next_line().await {
        let Some(eq) = line.find('=') else { continue };
        let key = &line[..eq];
        let val = line[eq + 1..].trim();

        match key {
            "out_time_us"  => { out_time_us = val.parse().unwrap_or(out_time_us); }
            "out_time_ms"  => { out_time_ms_raw = val.parse().unwrap_or(out_time_ms_raw); }
            "speed" => {
                let s = val.trim_end_matches('x');
                if s != "N/A" && s != "0" && !s.is_empty() {
                    speed = Some(format!("{s}x"));
                }
            }
            "total_size"   => { current_bytes = val.parse().ok().filter(|&b: &u64| b > 0); }
            "progress" => {
                // End of one -progress block → emit event
                let elapsed_us = if out_time_us > 0.0 { out_time_us } else { out_time_ms_raw * 1_000.0 };
                let fraction = duration_sec
                    .filter(|&d| d > 0.0)
                    .map(|d| (elapsed_us / (d * 1_000_000.0)).clamp(0.0, 1.0) as f32)
                    .unwrap_or(0.0);
                let eta_sec = speed
                    .as_deref()
                    .and_then(|s| s.trim_end_matches('x').parse::<f64>().ok())
                    .filter(|&sv| sv > 0.0)
                    .and_then(|sv| {
                        duration_sec.map(|d| (((1.0 - fraction as f64) * d) / sv).max(0.0) as u32)
                    });
                let _ = on_progress.send(ProgressEvent {
                    job_id: job_id.clone(),
                    fraction,
                    fps: None, // audio has no fps
                    speed: speed.clone(),
                    eta_sec,
                    current_bytes,
                });
            }
            _ => {}
        }
    }

    // ── Wait for process exit ─────────────────────────────────────────────────
    let status = child
        .wait()
        .await
        .map_err(|e| AppError::Other(format!("FFmpeg process error: {e}")))?;

    let stderr_output = stderr_task.await.unwrap_or_default();
    if let Ok(mut jobs) = active_jobs.0.lock() {
        jobs.remove(&job_id);
    }

    if !status.success() {
        let _ = std::fs::remove_file(&temp_path);
        let msg = if stderr_output.is_empty() {
            "Compression failed or was cancelled".into()
        } else {
            let last = stderr_output.lines().last().unwrap_or(&stderr_output);
            format!("FFmpeg: {last}")
        };
        return Err(AppError::Other(msg));
    }

    // ── Output-larger-than-input guard ────────────────────────────────────────
    let output_bytes = std::fs::metadata(&temp_path).map(|m| m.len()).unwrap_or(0);

    if output_bytes >= input_bytes {
        let _ = std::fs::remove_file(&temp_path);
        return Ok(CompressResult {
            output_path: input_path,
            output_bytes: input_bytes,
            output_larger: true,
        });
    }

    // ── Commit: rename .part → final output ───────────────────────────────────
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

    Ok(CompressResult {
        output_path,
        output_bytes,
        output_larger: false,
    })
}
