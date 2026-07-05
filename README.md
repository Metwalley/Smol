<div align="center">
  <img src="public/logo.png" width="100" alt="Smol logo" />
  <h1>Smol</h1>
  <p><strong>The file compressor that stays out of your way.</strong><br/>Drop any mix of videos, audio, images, and PDFs. Hit Squeeze. Done.</p>

  <p>
    <a href="https://github.com/Metwalley/Smol/actions/workflows/release.yml">
      <img src="https://img.shields.io/github/actions/workflow/status/Metwalley/Smol/release.yml?style=flat-square&logo=github&label=Windows%20Build" alt="Windows Build Status">
    </a>
    <a href="https://github.com/Metwalley/Smol/releases/latest">
      <img src="https://img.shields.io/github/v/release/Metwalley/Smol?style=flat-square&color=5865F2" alt="Latest Release">
    </a>
    <a href="https://github.com/Metwalley/Smol/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/Metwalley/Smol?style=flat-square" alt="License">
    </a>
  </p>

  <br/>

  <a href="https://github.com/Metwalley/Smol/releases/latest/download/Smol_1.0.0_x64-setup.exe">
    <img src="https://img.shields.io/badge/⬇ Download for Windows-0078D4?style=for-the-badge&logo=windows&logoColor=white" alt="Download for Windows" />
  </a>
  <br/>
  <sub>Windows 10 / 11 · 64-bit · 70 MB</sub>

  <br/><br/>

  <img src="Marketing-Assets/hero_showcase.png" alt="Smol — hero screenshot" width="90%" />
</div>

---

## Why Smol?

Most compression tools make you juggle separate apps for video, audio, images, and PDFs. Smol handles all four in a single drag-and-drop queue. Everything runs **100% locally** — your files never leave your machine.

| | |
|---|---|
| **No uploads, ever** | All compression runs locally using FFmpeg, Ghostscript, and native Rust libraries. Your files stay yours. |
| **No codec knowledge required** | Pick from four plain-English presets. Smol maps them to the right encoder settings automatically. |
| **Hardware-accelerated video** | Automatically uses your NVIDIA, Intel, or AMD GPU for video encoding — no manual setup needed. |
| **One queue, every format** | MP4, MKV, MOV, MP3, FLAC, JPEG, PNG, WebP, AVIF, and PDF — all in one drop zone. |

---

## Features

### Unified Drop Zone
Drop any mix of file types at once. Smol detects each format and routes it to the correct engine automatically. Filter by kind using the chips above the queue — or just squeeze everything at once.

### Per-File Precision
Set a specific target size on individual files right inside the queue row — e.g. exactly 8 MB for a Discord upload — without changing the global preset for the rest of the batch.

### Four Plain-English Presets
**Less Compression** · **Recommended** · **Extreme Compression** · **Lossless**. No CRF values, no bitrate sliders, no jargon. Recommended is the default and hits the best quality-to-size balance for almost every file.

### "Already Optimal" Detection
If compressing a file would make it *larger*, Smol stops and marks it as **Already optimal** rather than wasting your time with a bloated output.

### Instant Retry
Failed job? Hit the retry button directly on the queue row. No need to re-add the file or re-run the whole queue.

### Before / After Preview
A visual slider lets you compare the original and compressed output side by side, with exact file sizes displayed under each label.

---

## See it in action

<div align="center">
  <img src="Marketing-Assets/per_file_settings.png" alt="Per-file target size settings" width="80%" />
  <br/><sub>Set a precise target size per file — perfect for Discord, email, or social media limits.</sub>
</div>

<br/>

<div align="center">
  <img src="Marketing-Assets/done_state_savings.png" alt="Compression results showing savings" width="80%" />
  <br/><sub>See exactly how much space you saved, file by file, the moment compression finishes.</sub>
</div>

<br/>

<div align="center">
  <img src="Marketing-Assets/image_comparison_slider.png" alt="Before/After comparison slider" width="80%" />
  <br/><sub>The built-in before/after slider lets you visually validate quality before keeping the output.</sub>
</div>

---

## Building from source

**Prerequisites:** Rust stable · Node.js 22+ · pnpm 9+

```bash
git clone https://github.com/Metwalley/Smol
cd Smol
pnpm install
node scripts/fetch-ffmpeg.mjs
node scripts/fetch-ghostscript.mjs
pnpm tauri dev
```

> **Note:** Smol uses pinned FFmpeg and Ghostscript sidecar binaries. Run the two fetch scripts before `pnpm tauri dev` — the app will not start without them.

---

## License

Smol is free and open source software, licensed under the **[GNU Affero General Public License v3.0](LICENSE)**.
