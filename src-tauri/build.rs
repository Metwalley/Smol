fn main() {
    let target = std::env::var("TARGET").unwrap_or_default();

    // Expose the target triple as TARGET_TRIPLE so the crate can construct
    // the Tauri sidecar filename at compile time (env!("TARGET_TRIPLE")).
    println!("cargo:rustc-env=TARGET_TRIPLE={target}");

    // Copy FFmpeg and FFprobe sidecar binaries from src-tauri/binaries/ into
    // the Cargo build-output directory (target/debug/ or target/release/) so
    // they sit next to the host executable at runtime.
    //
    // Tauri handles this automatically for production bundles, but does NOT
    // copy them during `cargo check` / `tauri dev`, so we do it here.
    copy_sidecar("ffmpeg", &target);
    copy_sidecar("ffprobe", &target);
    copy_sidecar("gs", &target);
    // gsdll64.dll must sit next to gs-*.exe at runtime (gswin64c.exe loads it dynamically)
    copy_resource("gsdll64.dll");

    tauri_build::build()
}

/// Copy a Tauri sidecar binary (with target-triple suffix) from binaries/ to
/// the Cargo output directory so it is available at runtime during `tauri dev`.
fn copy_sidecar(name: &str, target: &str) {
    let manifest = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let out_dir  = std::env::var("OUT_DIR").unwrap();

    // OUT_DIR is  …/target/<profile>/build/<pkg-hash>/out
    // Three parents up gives us  …/target/<profile>/
    let profile_dir = std::path::Path::new(&out_dir)
        .parent().unwrap() // …/<pkg-hash>/
        .parent().unwrap() // …/build/
        .parent().unwrap(); // …/<profile>/

    let bin_name = if target.contains("windows") {
        format!("{name}-{target}.exe")
    } else {
        format!("{name}-{target}")
    };

    let src = std::path::Path::new(&manifest).join("binaries").join(&bin_name);
    let dst = profile_dir.join(&bin_name);

    // Rebuild trigger: re-run this script if the source binary changes
    println!("cargo:rerun-if-changed=binaries/{bin_name}");

    if src.exists() {
        std::fs::copy(&src, &dst).ok();
    }
}

/// Copy a plain resource file (exact filename, no triple suffix) from binaries/
/// to the Cargo output directory.  Used for DLLs that sidecars depend on.
fn copy_resource(name: &str) {
    let manifest = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let out_dir  = std::env::var("OUT_DIR").unwrap();

    let profile_dir = std::path::Path::new(&out_dir)
        .parent().unwrap()
        .parent().unwrap()
        .parent().unwrap();

    let src = std::path::Path::new(&manifest).join("binaries").join(name);
    let dst = profile_dir.join(name);

    println!("cargo:rerun-if-changed=binaries/{name}");

    if src.exists() {
        std::fs::copy(&src, &dst).ok();
    }
}
