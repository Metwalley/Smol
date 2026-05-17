mod error;
mod fs_bridge;
mod probe;
mod thumbs;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            fs_bridge::get_path_info,
            fs_bridge::list_dir_supported,
            probe::probe_media,
            thumbs::generate_thumbnail,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
