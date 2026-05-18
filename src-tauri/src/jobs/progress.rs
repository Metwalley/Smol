use serde::Serialize;

/// Streamed over the Tauri IPC Channel during video encoding.
/// One event is emitted per FFmpeg `-progress pipe:1` block.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub job_id: String,
    /// 0.0 – 1.0 based on out_time_us / total_duration
    pub fraction: f32,
    pub fps: Option<f32>,
    /// e.g. "2.4x"
    pub speed: Option<String>,
    /// Estimated seconds remaining
    pub eta_sec: Option<u32>,
    /// Bytes written so far (total_size from FFmpeg)
    pub current_bytes: Option<u64>,
}
