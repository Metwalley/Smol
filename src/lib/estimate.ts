import type { FileKind, MediaProbe, CompressionPreset } from "@/types";

// Resolution-based video bitrate defaults when ffprobe gives no bitrate
function defaultVideoBitrateKbps(width?: number, height?: number): number {
  if (!width || !height) return 2500;
  const px = width * height;
  if (px >= 3840 * 2160) return 8000; // 4K
  if (px >= 1920 * 1080) return 2500; // 1080p
  if (px >= 1280 * 720) return 1200;  // 720p
  return 600;                          // SD
}

// CRF encodes at a fixed quality level — output bitrate is bounded below by content
// complexity, not just the source bitrate. These floors represent the minimum
// realistic output kbps for a given resolution and CRF preset. Without them,
// the ratio formula wildly under-estimates already-compressed sources (e.g. a
// 3100 kbps 1080p file at Extreme would "estimate" 465 kbps, but CRF 35 cannot
// get that low without destroying the picture). Values calibrated for x264/NVENC.
function cqFloorKbps(
  width: number | undefined,
  height: number | undefined,
  preset: CompressionPreset,
): number {
  const px = (width ?? 0) * (height ?? 0);
  if (preset === "extreme") {
    if (px >= 3840 * 2160) return 2500; // 4K  CRF 35
    if (px >= 1920 * 1080) return 1100; // 1080p CRF 35
    if (px >= 1280 * 720)  return  550; // 720p  CRF 35
    return 275;                          // SD    CRF 35
  }
  if (preset === "recommended") {
    if (px >= 3840 * 2160) return 5000; // 4K  CRF 23
    if (px >= 1920 * 1080) return 2000; // 1080p CRF 23
    if (px >= 1280 * 720)  return 1000; // 720p  CRF 23
    return 500;                          // SD    CRF 23
  }
  if (preset === "less") {
    if (px >= 3840 * 2160) return 9000; // 4K  CRF 18
    if (px >= 1920 * 1080) return 3500; // 1080p CRF 18
    if (px >= 1280 * 720)  return 1800; // 720p  CRF 18
    return 900;                          // SD    CRF 18
  }
  return 0;
}

function estimateVideo(
  sizeBytes: number,
  probe: MediaProbe | undefined,
  preset: CompressionPreset,
): number | undefined {
  if (preset === "lossless") return undefined;
  const ratios: Record<string, number> = { less: 0.70, recommended: 0.35, extreme: 0.15 };
  const ratio = ratios[preset] ?? 0.35;
  const dur = probe?.durationSec;
  const kbps = probe?.bitrateKbps ?? defaultVideoBitrateKbps(probe?.width, probe?.height);
  if (!dur) return Math.round(sizeBytes * ratio);
  // Use the higher of (ratio × source) and the CRF floor — prevents over-optimistic
  // estimates when the source is already compressed near the CRF quality ceiling.
  const floor = cqFloorKbps(probe?.width, probe?.height, preset);
  const targetKbps = Math.max(kbps * ratio, floor);
  // Cap at source size: we never estimate a larger output than the input.
  return Math.min(Math.round(dur * targetKbps * 1000 / 8), sizeBytes);
}

function estimateAudio(
  sizeBytes: number,
  probe: MediaProbe | undefined,
  preset: CompressionPreset,
): number | undefined {
  if (preset === "lossless") return sizeBytes;
  // Must match build_audio_args() bitrates in ffmpeg_args.rs exactly.
  const targetKbps: Record<string, number> = { less: 320, recommended: 192, extreme: 96 };
  const kbps = targetKbps[preset] ?? 192;
  const dur = probe?.durationSec;
  if (!dur) return undefined;
  return Math.min(Math.round(dur * kbps * 1000 / 8), sizeBytes);
}

function estimateImage(sizeBytes: number, preset: CompressionPreset): number | undefined {
  const ratios: Record<string, number> = { less: 0.65, recommended: 0.45, extreme: 0.20, lossless: 0.85 };
  return Math.round(sizeBytes * (ratios[preset] ?? 0.45));
}

function estimatePdf(sizeBytes: number, preset: CompressionPreset): number | undefined {
  if (sizeBytes < 500_000) return undefined; // too small — estimate unreliable
  const ratios: Record<string, number> = { less: 0.70, recommended: 0.35, extreme: 0.15, lossless: 0.92 };
  return Math.round(sizeBytes * (ratios[preset] ?? 0.35));
}

/**
 * Estimate the output file size in bytes.
 * Returns undefined when the formula cannot produce a meaningful estimate
 * (e.g. lossless video, audio with unknown duration, PDF < 500 KB).
 * Always prefix displayed values with `~` — these are rough heuristics (HR-15).
 */
export function estimateOutputBytes(
  params: { kind: FileKind; sizeBytes: number; probe?: MediaProbe },
  preset: CompressionPreset = "recommended",
): number | undefined {
  const { kind, sizeBytes, probe } = params;
  switch (kind) {
    case "video": return estimateVideo(sizeBytes, probe, preset);
    case "audio": return estimateAudio(sizeBytes, probe, preset);
    case "image": return estimateImage(sizeBytes, preset);
    case "pdf":   return estimatePdf(sizeBytes, preset);
    default:      return undefined;
  }
}

/**
 * Compute the total estimated output size for all jobs in the queue for a given preset.
 * Returns undefined if any job's estimate is undefined (all must be known for a total).
 */
export function getPresetEstimate(
  jobs: Record<string, { kind: FileKind; inputBytes: number; probe?: MediaProbe }>,
  preset: CompressionPreset,
): number | undefined {
  let total = 0;
  for (const job of Object.values(jobs)) {
    const est = estimateOutputBytes(
      { kind: job.kind, sizeBytes: job.inputBytes, probe: job.probe },
      preset,
    );
    if (est === undefined) return undefined;
    total += est;
  }
  return total;
}
