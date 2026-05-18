pub mod ffmpeg_args;
pub mod hw_detect;

/// Returns the directory that the host executable lives in.
fn exe_dir() -> std::path::PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_default()
}

/// Returns the path to the FFmpeg sidecar binary that Tauri places next to
/// the host executable.  Tauri names sidecars with the target triple:
///   `ffmpeg-x86_64-pc-windows-msvc.exe`  (Windows)
///   `ffmpeg-x86_64-unknown-linux-gnu`    (Linux)
///
/// `ffmpeg_sidecar::paths::ffmpeg_path()` returns just `ffmpeg[.exe]` and
/// therefore misses this binary — this helper is the correct replacement.
pub fn ffmpeg_sidecar_path() -> std::path::PathBuf {
    // TARGET_TRIPLE is injected by build.rs via cargo:rustc-env,
    // e.g. "x86_64-pc-windows-msvc"
    let triple = env!("TARGET_TRIPLE");
    let dir = exe_dir();
    // tauri dev: build.rs copies ffmpeg-{triple}.exe next to the binary.
    // production NSIS build: Tauri strips the triple suffix on install → ffmpeg.exe.
    let dev_path = dir.join(if cfg!(windows) {
        format!("ffmpeg-{triple}.exe")
    } else {
        format!("ffmpeg-{triple}")
    });
    if dev_path.exists() {
        dev_path
    } else {
        dir.join(if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" })
    }
}

/// Returns the path to the Ghostscript sidecar binary.
/// tauri dev  → `gs-x86_64-pc-windows-msvc.exe`  (triple suffix, copied by build.rs)
/// production → `gs.exe`                           (triple suffix stripped by NSIS)
pub fn gs_sidecar_path() -> std::path::PathBuf {
    let triple = env!("TARGET_TRIPLE");
    let dir = exe_dir();
    let dev_path = dir.join(if cfg!(windows) {
        format!("gs-{triple}.exe")
    } else {
        format!("gs-{triple}")
    });
    if dev_path.exists() {
        dev_path
    } else {
        dir.join(if cfg!(windows) { "gs.exe" } else { "gs" })
    }
}
