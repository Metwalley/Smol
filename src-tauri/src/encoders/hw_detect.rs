use serde::Serialize;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Cached result of the startup hardware-encoder probe.
#[derive(Clone, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HwEncoders {
    pub nvenc: bool,
    pub qsv: bool,
    pub amf: bool,
}

/// Tauri managed-state wrapper so commands can read the cached probe.
pub struct HwEncodersState(pub HwEncoders);

/// Run once at app startup (blocking — before the event loop starts).
/// Silently returns all-false when FFmpeg binary is not present.
pub fn probe_hw_encoders() -> HwEncoders {
    HwEncoders {
        nvenc: probe_encoder("h264_nvenc"),
        qsv: probe_encoder("h264_qsv"),
        amf: probe_encoder("h264_amf"),
    }
}

fn probe_encoder(codec: &str) -> bool {
    let ffmpeg = crate::encoders::ffmpeg_sidecar_path();
    if !ffmpeg.exists() {
        return false;
    }
    let mut cmd = std::process::Command::new(&ffmpeg);
    cmd.args([
        "-f", "lavfi", "-i", "nullsrc", "-t", "0.1",
        "-c:v", codec, "-f", "null", "-",
    ]);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    matches!(cmd.output(), Ok(o) if o.status.success())
}
