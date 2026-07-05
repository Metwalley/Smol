use serde::{Deserialize, Serialize};
use std::path::Path;
use crate::error::AppError;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Mirrors the MediaProbe interface in src/types/index.ts.
/// Field names are snake_case; serde renames them to camelCase for the frontend.
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct MediaProbe {
    pub duration_sec: Option<f64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub fps: Option<f32>,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub page_count: Option<u32>,
    pub bitrate_kbps: Option<u32>,
    pub container_format: Option<String>,
}

// ─── ffprobe helpers ──────────────────────────────────────────────────────────

fn run_ffprobe(path: &str) -> Option<serde_json::Value> {
    let ffprobe = ffmpeg_sidecar::ffprobe::ffprobe_path();
    if !ffprobe.exists() {
        return None;
    }
    let mut cmd = std::process::Command::new(&ffprobe);
    cmd.args(["-v", "error", "-show_streams", "-show_format", "-of", "json", path]);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    let output = cmd.output().ok()?;
    if !output.status.success() {
        return None;
    }
    serde_json::from_slice(&output.stdout).ok()
}

fn parse_fps(s: &str) -> Option<f32> {
    if s == "0/0" || s.is_empty() {
        return None;
    }
    let parts: Vec<&str> = s.split('/').collect();
    if parts.len() == 2 {
        let num: f32 = parts[0].parse().ok()?;
        let den: f32 = parts[1].parse().ok()?;
        if den == 0.0 {
            return None;
        }
        Some(num / den)
    } else {
        s.parse().ok()
    }
}

fn parse_ffprobe_json(json: serde_json::Value) -> MediaProbe {
    let mut probe = MediaProbe::default();

    if let Some(fmt) = json.get("format") {
        if let Some(dur) = fmt.get("duration").and_then(|d| d.as_str()) {
            probe.duration_sec = dur.parse().ok();
        }
        if let Some(br) = fmt.get("bit_rate").and_then(|b| b.as_str()) {
            probe.bitrate_kbps = br.parse::<u64>().ok().map(|b| (b / 1000) as u32);
        }
        if let Some(fmt_name) = fmt.get("format_name").and_then(|f| f.as_str()) {
            probe.container_format = Some(fmt_name.split(',').next().unwrap_or(fmt_name).to_string());
        }
    }

    if let Some(streams) = json.get("streams").and_then(|s| s.as_array()) {
        for stream in streams {
            match stream.get("codec_type").and_then(|c| c.as_str()).unwrap_or("") {
                "video" => {
                    if probe.video_codec.is_none() {
                        probe.video_codec = stream
                            .get("codec_name")
                            .and_then(|c| c.as_str())
                            .map(|s| s.to_string());
                        probe.width = stream.get("width").and_then(|w| w.as_u64()).map(|w| w as u32);
                        probe.height = stream.get("height").and_then(|h| h.as_u64()).map(|h| h as u32);
                        if let Some(fr) = stream.get("avg_frame_rate").and_then(|f| f.as_str()) {
                            probe.fps = parse_fps(fr);
                        }
                        // prefer stream bitrate when format bitrate is missing
                        if probe.bitrate_kbps.is_none() {
                            if let Some(br) = stream.get("bit_rate").and_then(|b| b.as_str()) {
                                probe.bitrate_kbps = br.parse::<u64>().ok().map(|b| (b / 1000) as u32);
                            }
                        }
                    }
                }
                "audio" if probe.audio_codec.is_none() => {
                    probe.audio_codec = stream
                        .get("codec_name")
                        .and_then(|c| c.as_str())
                        .map(|s| s.to_string());
                    // for audio-only files, get duration/bitrate from stream when format has none
                    if probe.duration_sec.is_none() {
                        if let Some(dur) = stream.get("duration").and_then(|d| d.as_str()) {
                            probe.duration_sec = dur.parse().ok();
                        }
                    }
                    if probe.bitrate_kbps.is_none() {
                        if let Some(br) = stream.get("bit_rate").and_then(|b| b.as_str()) {
                            probe.bitrate_kbps = br.parse::<u64>().ok().map(|b| (b / 1000) as u32);
                        }
                    }
                }
                _ => {}
            }
        }
    }

    probe
}

// ─── PDF page count ───────────────────────────────────────────────────────────

fn count_pdf_pages(path: &str) -> Option<u32> {
    let doc = lopdf::Document::load(path).ok()?;
    Some(doc.get_pages().len() as u32)
}

// ─── Command ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn probe_media(path: String) -> Result<MediaProbe, AppError> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(AppError::PathDoesNotExist(path));
    }

    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if ext == "pdf" {
        return Ok(MediaProbe {
            page_count: count_pdf_pages(&path),
            ..Default::default()
        });
    }

    let json = run_ffprobe(&path).ok_or_else(|| {
        AppError::Other("Could not read media file — corrupt, empty, or unrecognized format".to_string())
    })?;
    Ok(parse_ffprobe_json(json))
}
