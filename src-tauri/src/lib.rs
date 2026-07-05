mod commands;
mod encoders;
mod error;
mod fs_bridge;
mod jobs;
mod probe;
mod thumbs;

use commands::compress_video::{compress_video, cancel_job, ActiveJobPids};
use commands::compress_audio::compress_audio;
use commands::compress_image::compress_image;
use commands::compress_pdf::compress_pdf;
use encoders::hw_detect::{probe_hw_encoders, HwEncodersState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Probe for hardware encoders once at startup (blocking, fast)
    let hw = probe_hw_encoders();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(HwEncodersState(hw))
        .manage(ActiveJobPids::default())
        .invoke_handler(tauri::generate_handler![
            fs_bridge::get_path_info,
            fs_bridge::list_dir_supported,
            fs_bridge::reveal_in_explorer,
            fs_bridge::write_clipboard_image,
            probe::probe_media,
            thumbs::generate_thumbnail,
            compress_video,
            compress_audio,
            compress_image,
            compress_pdf,
            cancel_job,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
