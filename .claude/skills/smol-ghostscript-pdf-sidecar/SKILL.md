---
name: smol-ghostscript-pdf-sidecar
description: Use this skill when you are about to compress PDFs, use Ghostscript, call gs or gswin64c, or use the pdfwrite device.
---

# Smol Ghostscript PDF Sidecar

## Overview

Ghostscript is bundled as a Tauri sidecar (`gs-x86_64-pc-windows-msvc.exe`). It is
fetched by `scripts/fetch-ghostscript.mjs` from the Artifex download page, SHA-pinned.
This is ~50 MB and is intentional — we do not require users to install Ghostscript.

---

## Fetch script pattern (scripts/fetch-ghostscript.mjs)

```js
import { createHash } from "crypto";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import fetch from "node-fetch";

const GS_URL = "https://github.com/ArtifexSoftware/ghostpdl-downloads/releases/download/gs10030/gs10030w64.exe";
const GS_SHA256 = "REPLACE_WITH_ACTUAL_SHA256";
const DEST = "src-tauri/binaries/gs-x86_64-pc-windows-msvc.exe";

// download, verify SHA, chmod +x
```

---

## tauri.conf.json sidecar registration

```json
{
  "bundle": {
    "externalBin": [
      "binaries/ffmpeg",
      "binaries/ffprobe",
      "binaries/gs"
    ]
  }
}
```

---

## Compression command templates

### Preset → pdfwrite settings

| Casual Preset | -dPDFSETTINGS | Typical reduction |
|---|---|---|
| Less Compression | /printer | ~20–30 % |
| Recommended | /ebook | ~50–70 % |
| Extreme Compression | /screen | ~80–90 % |
| Lossless | (linearize via qpdf — no image recompression) | 5–10 % |

```
gs -dBATCH -dNOPAUSE -dQUIET \
   -sDEVICE=pdfwrite \
   -dPDFSETTINGS=/ebook \
   -sOutputFile=OUTPUT.pdf \
   INPUT.pdf
```

Advanced DPI override adds:
```
-dColorImageResolution=150 -dGrayImageResolution=150 -dMonoImageResolution=150
```

---

## Progress parsing

Ghostscript doesn't emit clean progress. Parse `%%[ Page: N ]%%` lines from stderr:

```rust
pub fn parse_gs_progress(line: &str) -> Option<u32> {
    // Matches: "%%[ Page: 3 ]%%"
    let stripped = line.trim();
    if stripped.starts_with("%%[ Page:") && stripped.ends_with("]%%") {
        let inner = stripped.trim_start_matches("%%[ Page:").trim_end_matches("]%%").trim();
        inner.parse().ok()
    } else {
        None
    }
}

// fraction = current_page as f32 / total_pages as f32
```

Get total page count before running compression:

```rust
pub fn get_pdf_page_count(path: &str) -> Result<u32, AppError> {
    // gs -dNODISPLAY -dNOPAUSE -c "(INPUT.pdf) (r) file runpdfbegin pdfpagecount = quit"
    let output = std::process::Command::new(&gs_binary_path())
        .args(["-dNODISPLAY", "-dNOPAUSE", "-dQUIET", "-c",
               &format!("({path}) (r) file runpdfbegin pdfpagecount = quit")])
        .output()
        .map_err(AppError::Io)?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout.trim().parse::<u32>().map_err(|_| AppError::PdfPageCount)
}
```

---

## AGPL attribution requirement

Ghostscript is AGPL-3.0. We bundle it as a separately-executed sidecar process (not
linked), which is the standard pattern for PDF tools. Add to `THIRD_PARTY_NOTICES.md`:

```
## Ghostscript
License: AGPL-3.0
Source: https://www.ghostscript.com/
Ghostscript is used as an external sidecar process for PDF compression.
Smol does not link against Ghostscript. The Ghostscript source code is
available at the URL above. Users who receive Smol receive access to
Ghostscript's source under AGPL-3.0.
```

---

## Windows: suppress console window

Same pattern as FFmpeg sidecar:

```rust
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
const CREATE_NO_WINDOW: u32 = 0x08000000;

let mut cmd = std::process::Command::new(&gs_path);
#[cfg(target_os = "windows")]
cmd.creation_flags(CREATE_NO_WINDOW);
```
