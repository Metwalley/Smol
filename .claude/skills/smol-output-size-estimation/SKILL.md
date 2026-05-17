---
name: smol-output-size-estimation
description: Use this skill when you are about to show estimated output sizes, compute predicted file sizes, display ~MB values, or wire the estimation to preset cards or queue rows.
---

# Smol Output Size Estimation

## Display rules (HR-15)

- Always prefix with `~` (e.g. `~1.5 MB`, not `1.5 MB`)
- Fall back to `—` when the formula cannot produce a meaningful estimate
- Never show false precision (round to 1 decimal place for < 100 MB, 0 for ≥ 100 MB)
- Lossless estimate for video = `—` (we don't support lossless video in v1.0)
- Update estimates live as the user switches presets or adds/removes files

---

## Per-kind heuristic formulas

These are rough heuristics, not exact predictions. Label them as estimates accordingly.

### Video

Formula: `estimated_bytes = duration_sec * target_kbps * 1000 / 8`

Preset → target_kbps (H.264):
| Preset | kbps |
|---|---|
| Less Compression | `source_kbps * 0.7` |
| Recommended | `source_kbps * 0.35` |
| Extreme Compression | `source_kbps * 0.15` |
| Lossless | — (not supported) |

If `source_kbps` is unknown from probe, use resolution-based defaults:
- 4K: 8000 kbps, 1080p: 2500 kbps, 720p: 1200 kbps, SD: 600 kbps

### Audio

Formula: `estimated_bytes = duration_sec * target_kbps * 1000 / 8`

Preset → bitrate:
| Preset | kbps |
|---|---|
| Less Compression | 192 |
| Recommended | 128 |
| Extreme Compression | 64 |
| Lossless | source_bytes (no reduction, lossless is FLAC) |

Cap: never estimate above source file size.

### Image

Ratio-based:
| Preset | Ratio of source bytes |
|---|---|
| Less Compression | 0.65 |
| Recommended | 0.45 |
| Extreme Compression | 0.20 |
| Lossless (PNG) | 0.85 |

These ratios are calibrated for typical camera/screenshot images (PNG/JPEG/WebP source).
For already-compressed JPEGs at quality > 90, actual savings will be smaller — this is
acceptable inaccuracy; the `~` prefix communicates uncertainty.

### PDF

Ratio-based:
| Preset (pdfwrite) | Ratio |
|---|---|
| Less Compression (/printer) | 0.70 |
| Recommended (/ebook) | 0.35 |
| Extreme Compression (/screen) | 0.15 |
| Lossless (linearize) | 0.92 |

For PDFs that are already highly compressed (e.g. pure-text or digital PDFs), actual
output may be similar to or larger than input. Fall back to `—` if source size < 500 KB.

---

## TypeScript estimation functions

```ts
// src/lib/estimateSize.ts
import type { Job, CompressionPreset } from "@/types";

export function estimateOutputBytes(job: Job, preset: CompressionPreset): number | null {
  const { kind, inputBytes, probe } = job;

  if (!inputBytes) return null;

  switch (kind) {
    case "video": return estimateVideo(inputBytes, probe?.durationSec, probe?.bitrateKbps, preset);
    case "audio": return estimateAudio(inputBytes, probe?.durationSec, preset);
    case "image": return estimateImage(inputBytes, preset);
    case "pdf":   return estimatePdf(inputBytes, preset);
    default:      return null;
  }
}

function estimateVideo(bytes: number, durSec?: number, kbps?: number, preset: CompressionPreset = "recommended"): number | null {
  if (preset === "lossless") return null;
  const ratios = { less: 0.70, recommended: 0.35, extreme: 0.15 };
  const ratio = ratios[preset] ?? 0.35;
  if (!durSec || !kbps) return Math.round(bytes * ratio);
  const targetKbps = kbps * ratio;
  return Math.round(durSec * targetKbps * 1000 / 8);
}

function estimateAudio(bytes: number, durSec?: number, preset: CompressionPreset = "recommended"): number | null {
  if (preset === "lossless") return bytes;
  const targetKbps = { less: 192, recommended: 128, extreme: 64 }[preset] ?? 128;
  if (!durSec) return null;
  const est = Math.round(durSec * targetKbps * 1000 / 8);
  return Math.min(est, bytes);
}

function estimateImage(bytes: number, preset: CompressionPreset = "recommended"): number | null {
  const ratios = { less: 0.65, recommended: 0.45, extreme: 0.20, lossless: 0.85 };
  return Math.round(bytes * (ratios[preset] ?? 0.45));
}

function estimatePdf(bytes: number, preset: CompressionPreset = "recommended"): number | null {
  if (bytes < 500_000) return null; // already small — estimate unreliable
  const ratios = { less: 0.70, recommended: 0.35, extreme: 0.15, lossless: 0.92 };
  return Math.round(bytes * (ratios[preset] ?? 0.35));
}
```

---

## Formatting

```ts
// src/lib/format.ts
export function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes < 0) return "—";
  if (bytes < 1_000) return `~${bytes} B`;
  if (bytes < 1_000_000) return `~${(bytes / 1_000).toFixed(1)} KB`;
  if (bytes < 100_000_000) return `~${(bytes / 1_000_000).toFixed(1)} MB`;
  return `~${Math.round(bytes / 1_000_000)} MB`;
}

export function formatSavings(inputBytes: number, estimatedBytes: number | null): string {
  if (!estimatedBytes) return "";
  const saved = inputBytes - estimatedBytes;
  const pct = Math.round((saved / inputBytes) * 100);
  return `saves ~${pct}%`;
}
```

---

## Queue total banner

```ts
export function computeQueueTotals(jobs: Job[], preset: CompressionPreset) {
  const totalInput = jobs.reduce((s, j) => s + j.inputBytes, 0);
  const estimates = jobs.map((j) => estimateOutputBytes(j, preset));
  const allKnown = estimates.every((e) => e !== null);
  const totalEstimated = allKnown ? estimates.reduce((s, e) => s + (e ?? 0), 0) : null;
  return { totalInput, totalEstimated };
}
```

Banner text: `Estimated total: 240 MB → ~56 MB · saves ~77%`
Hide the banner when the queue is empty.
