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
  const targetKbps = kbps * ratio;
  return Math.round(dur * targetKbps * 1000 / 8);
}

function estimateAudio(
  sizeBytes: number,
  probe: MediaProbe | undefined,
  preset: CompressionPreset,
): number | undefined {
  if (preset === "lossless") return sizeBytes;
  const targetKbps: Record<string, number> = { less: 192, recommended: 128, extreme: 64 };
  const kbps = targetKbps[preset] ?? 128;
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
