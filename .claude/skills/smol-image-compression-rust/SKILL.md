---
name: smol-image-compression-rust
description: Use this skill when you are about to compress images, handle JPEG, PNG, WebP, or AVIF output, use mozjpeg, oxipng, or any image codec. Native Rust only — no sidecar.
---

# Smol Image Compression (Native Rust)

## Crates

All image compression runs in native Rust. No FFmpeg, no sidecar.

Add to `Cargo.toml`:
```toml
mozjpeg = "0.10"
oxipng = { version = "9", default-features = false, features = ["filemap"] }
image = { version = "0.25", default-features = false, features = ["jpeg","png","webp"] }
webp = "0.3"
ravif = "0.11"
rgb = "0.8"
```

---

## Per-format quality maps

### Preset → quality

| Preset | JPEG q | PNG opt | WebP q | AVIF q / speed |
|---|---|---|---|---|
| Less Compression | 85 | 2 | 85 | 60 / 8 |
| Recommended | 75 | 4 | 75 | 50 / 6 |
| Extreme Compression | 55 | 6 | 55 | 35 / 4 |
| Lossless | 95 (lossless for PNG/WebP/AVIF) | 0 | lossless | lossless / 8 |

---

## JPEG (mozjpeg)

```rust
use mozjpeg::{Compress, ColorSpace, ScanMode};

pub fn compress_jpeg(input_bytes: &[u8], quality: u8, strip_metadata: bool) -> Result<Vec<u8>, AppError> {
    let img = image::load_from_memory(input_bytes)?.to_rgb8();
    let (w, h) = img.dimensions();

    let mut comp = Compress::new(ColorSpace::JCS_RGB);
    comp.set_size(w as usize, h as usize);
    comp.set_quality(quality as f32);
    comp.set_scan_optimization_mode(ScanMode::AllComponentsTogether);
    let mut comp = comp.start_compress(Vec::new())?;
    comp.write_scanlines(&img)?;
    let data = comp.finish()?;
    Ok(data)
}
```

---

## PNG (oxipng)

```rust
use oxipng::{optimize_from_memory, Options, InFile, OutFile};

pub fn compress_png(input_bytes: &[u8], opt_level: u8) -> Result<Vec<u8>, AppError> {
    let mut opts = Options::from_preset(opt_level);
    opts.strip = oxipng::StripChunks::Safe; // strip metadata by default
    optimize_from_memory(input_bytes, &opts).map_err(|e| AppError::ImageEncode(e.to_string()))
}
```

---

## WebP

```rust
use webp::Encoder;

pub fn compress_webp(input_bytes: &[u8], quality: f32, lossless: bool) -> Result<Vec<u8>, AppError> {
    let img = image::load_from_memory(input_bytes)?.to_rgba8();
    let encoder = Encoder::from_rgba(&img, img.width(), img.height());
    let output = if lossless {
        encoder.encode_lossless()
    } else {
        encoder.encode(quality)
    };
    Ok(output.to_vec())
}
```

---

## AVIF (ravif)

```rust
use ravif::{Encoder as AvifEncoder, Img};
use rgb::RGBA8;

pub fn compress_avif(input_bytes: &[u8], quality: f32, speed: u8) -> Result<Vec<u8>, AppError> {
    let img = image::load_from_memory(input_bytes)?.to_rgba8();
    let (w, h) = img.dimensions();
    let pixels: Vec<RGBA8> = img.pixels().map(|p| RGBA8::new(p[0], p[1], p[2], p[3])).collect();
    let result = AvifEncoder::new()
        .with_quality(quality)
        .with_speed(speed)
        .encode_rgba(Img::new(pixels.as_slice(), w as usize, h as usize))?;
    Ok(result.avif_file)
}
```

---

## Dispatch by extension

```rust
pub fn compress_image_file(input: &str, output: &str, settings: &ImageSettings) -> Result<u64, AppError> {
    let input_bytes = std::fs::read(input)?;
    let ext = Path::new(output).extension().and_then(|e| e.to_str()).unwrap_or("jpg").to_lowercase();
    let out_bytes = match ext.as_str() {
        "jpg" | "jpeg" => compress_jpeg(&input_bytes, settings.jpeg_quality, settings.strip_metadata)?,
        "png"          => compress_png(&input_bytes, settings.png_opt_level)?,
        "webp"         => compress_webp(&input_bytes, settings.webp_quality as f32, settings.lossless)?,
        "avif"         => compress_avif(&input_bytes, settings.avif_quality as f32, settings.avif_speed)?,
        _              => return Err(AppError::UnsupportedFormat(ext)),
    };
    std::fs::write(output, &out_bytes)?;
    Ok(out_bytes.len() as u64)
}
```

---

## Thumbnail generation (image crate)

```rust
use image::imageops::FilterType;

pub fn make_image_thumbnail(input: &str, out: &str) -> Result<(), AppError> {
    let img = image::open(input)?;
    let thumb = img.thumbnail(256, 256);
    thumb.save_with_format(out, image::ImageFormat::Jpeg)?;
    Ok(())
}
```
