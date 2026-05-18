fn main() {
    // Expose the target triple as TARGET_TRIPLE so the crate can construct
    // the Tauri sidecar filename at compile time (env!("TARGET_TRIPLE")).
    let target = std::env::var("TARGET").unwrap_or_default();
    println!("cargo:rustc-env=TARGET_TRIPLE={target}");

    tauri_build::build()
}
