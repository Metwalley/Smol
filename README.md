# Smol

A fast, native Windows desktop app for compressing video, audio, image, and PDF files.
Drop any mix of files onto the app — Smol handles the rest.

![Smol screenshot](public/logo.png)

---

## Download

**[Download Smol v1.0.0 for Windows](https://github.com/Metwalley/Smol/releases/latest)**

Grab `Smol_1.0.0_x64-setup.exe` from the Releases page and run it.

**System requirements:** Windows 10 or Windows 11, 64-bit

> First launch may trigger a Windows SmartScreen warning. Click "More info" then "Run anyway".
> This is expected for unsigned software. Smol does not connect to the internet.

---

## What it does

Drop any combination of video, audio, image, and PDF files onto Smol. Choose a compression
preset, pick an output folder, and hit Squeeze. Smol compresses everything in the queue and
shows you exactly how much space you saved.

### Supported formats

| Type  | Input formats                          | Output   |
|-------|----------------------------------------|----------|
| Video | MP4, MKV, MOV, AVI, WebM              | MP4      |
| Audio | MP3, M4A, AAC, OGG, Opus, FLAC, WAV  | Same format |
| Image | JPEG, PNG, WebP, AVIF                  | Same format |
| PDF   | PDF                                    | PDF      |

### Presets

| Preset             | Video (H.264) | Audio    | Use when                            |
|--------------------|---------------|----------|-------------------------------------|
| Less Compression   | CRF 18        | 320 kbps | You want maximum quality            |
| Recommended        | CRF 23        | 192 kbps | Good balance of quality and size    |
| Extreme Compression| CRF 35        | 96 kbps  | Size matters more than quality      |
| Lossless           | —             | FLAC / copy | No quality loss, modest savings  |

Video compression uses hardware acceleration automatically when available (NVIDIA NVENC,
Intel Quick Sync, AMD AMF), with software x264 as the fallback.

---

## Building from source

**Prerequisites:** Rust stable, Node.js 22+, pnpm 9+

```bash
git clone https://github.com/Metwalley/Smol
cd Smol
pnpm install
node scripts/fetch-ffmpeg.mjs
node scripts/fetch-ghostscript.mjs
pnpm tauri dev
```

`fetch-ffmpeg.mjs` and `fetch-ghostscript.mjs` download versioned, SHA-256-verified sidecar
binaries into `src-tauri/binaries/`. The app will not start without them.

### Useful commands

```bash
pnpm dev              # Vite only (no Tauri window)
pnpm tauri dev        # Full dev build with live reload
pnpm tsc --noEmit     # TypeScript type-check
cargo check           # Rust type-check (run from src-tauri/)
cargo clippy          # Rust lint
```

### Releasing

Production installers are built by GitHub Actions on every `v*.*.*` tag push.
Local `pnpm tauri build` is for development smoke-testing only.

To cut a release, bump the version in `package.json`, `src-tauri/Cargo.toml`, and
`src-tauri/tauri.conf.json`, then push a tag:

```bash
git tag v1.0.0
git push origin master --tags
```

GitHub Actions builds the NSIS installer and attaches it to the release automatically.

---

## Tech stack

| Layer          | Choice                              |
|----------------|-------------------------------------|
| Desktop shell  | Tauri 2                             |
| UI             | React 19 + TypeScript 5             |
| Bundler        | Vite 7                              |
| Styling        | Tailwind 4 + shadcn/ui              |
| State          | Zustand 5                           |
| Animation      | Framer Motion                       |
| Video / Audio  | FFmpeg (sidecar, LGPL-2.1+)        |
| PDF            | Ghostscript (sidecar, AGPL-3.0)    |
| Image          | mozjpeg, oxipng, image-rs (native Rust) |

---

## License

Smol is licensed under the [GNU Affero General Public License v3.0](LICENSE).

This software bundles third-party components under their own licenses.
See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for full attribution and license text.
