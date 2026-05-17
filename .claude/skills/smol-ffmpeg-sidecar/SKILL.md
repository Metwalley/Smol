---
name: smol-ffmpeg-sidecar
description: Use this skill when you are about to compress video or audio, use FFmpeg, wire progress events, select an encoder, or set up the sidecar. Covers the ffmpeg-sidecar Rust crate, progress parsing, and hardware-encoder probing.
---

# Smol FFmpeg Sidecar

## Setup

Use the `ffmpeg-sidecar` Rust crate (not a custom download script) for all FFmpeg
operations. The binaries live at `src-tauri/binaries/` (gitignored) and are fetched by
`scripts/fetch-ffmpeg.mjs` (SHA-pinned, gyan.dev release-essentials build).

Sidecar binary names must follow Tauri's triple-suffix convention:
- `ffmpeg-x86_64-pc-windows-msvc.exe`
- `ffprobe-x86_64-pc-windows-msvc.exe`

Register in `tauri.conf.json`:
```json
{
  "bundle": {
    "externalBin": [
      "binaries/ffmpeg",
      "binaries/ffprobe"
    ]
  }
}
```

---

## Progress parsing via Channel

```rust
// src-tauri/src/jobs/progress.rs
use tauri::ipc::Channel;
use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub job_id: String,
    pub fraction: f32,
    pub fps: Option<f32>,
    pub speed: Option<String>,
    pub eta_sec: Option<u32>,
    pub current_bytes: Option<u64>,
}
```

FFmpeg is called with `-progress pipe:1` which emits key=value pairs on stdout.
Parse the `out_time_ms` field and divide by the total duration from probe:

```rust
// key lines emitted by -progress pipe:1:
// out_time_ms=12345000
// fps=29.97
// speed=2.4x
// progress=continue  (or "end" on completion)

fn parse_progress_line(line: &str, total_ms: f64) -> Option<f32> {
    if let Some(val) = line.strip_prefix("out_time_ms=") {
        let ms: f64 = val.trim().parse().ok()?;
        Some((ms / total_ms).clamp(0.0, 1.0) as f32)
    } else {
        None
    }
}
```

---

## Windows: suppress console window

```rust
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
const CREATE_NO_WINDOW: u32 = 0x08000000;

let mut cmd = ffmpeg_sidecar::command::FfmpegCommand::new();
#[cfg(target_os = "windows")]
cmd.creation_flags(CREATE_NO_WINDOW);
```

---

## Hardware-encoder probing (src-tauri/src/encoders/hw_detect.rs)

Probe once at app startup and cache the result.

```rust
use serde::Serialize;

#[derive(Clone, Serialize)]
pub struct HwEncoders {
    pub nvenc: bool,
    pub qsv: bool,
    pub amf: bool,
}

pub fn probe_hw_encoders() -> HwEncoders {
    HwEncoders {
        nvenc: probe_encoder("h264_nvenc"),
        qsv:   probe_encoder("h264_qsv"),
        amf:   probe_encoder("h264_amf"),
    }
}

fn probe_encoder(codec: &str) -> bool {
    // Run: ffmpeg -f lavfi -i nullsrc -t 0.1 -c:v <codec> -f null - 2>&1
    // Returns true if exit code == 0
    let status = ffmpeg_sidecar::command::FfmpegCommand::new()
        .args(["-f", "lavfi", "-i", "nullsrc", "-t", "0.1",
               "-c:v", codec, "-f", "null", "-"])
        .output();
    matches!(status, Ok(o) if o.status.success())
}
```

---

## Preset → FFmpeg args mapping

| Preset | H.264 sw | H.264 NVENC | Notes |
|---|---|---|---|
| Less Compression | `-crf 18 -preset slow` | `-cq 18 -preset p7` | |
| Recommended | `-crf 23 -preset medium` | `-cq 23 -preset p5` | default |
| Extreme Compression | `-crf 30 -preset medium` | `-cq 30 -preset p4` | |
| Lossless | hidden for video in v1.0 | — | HR-11 |

Full command templates (H.264 sw):
```
ffmpeg -y -i INPUT -c:v libx264 -preset medium -crf 23 \
       -c:a aac -b:a 128k -movflags +faststart \
       -progress pipe:1 OUTPUT
```

---

## Output-larger-than-input guard

After compression, compare file sizes:

```rust
if output_bytes >= input_bytes {
    std::fs::remove_file(&output_path)?;
    // copy original to output_path
    std::fs::copy(&input_path, &output_path)?;
    channel.send(ProgressEvent { fraction: 1.0, ..., output_larger: true })?;
}
```

---

## Cancel

Store the child process handle in a `Arc<Mutex<Option<Child>>>`. On `cancel_job`:

```rust
if let Some(child) = handle.lock().unwrap().as_mut() {
    let _ = child.kill();
}
// delete temp output file
```
