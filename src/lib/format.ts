// Binary (base-2) unit constants — matches Windows Explorer display
const KiB = 1_024;
const MiB = 1_024 * 1_024;
const GiB = 1_024 * 1_024 * 1_024;

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes < 0) return "—";
  if (bytes < KiB) return `~${bytes} B`;
  if (bytes < MiB) return `~${(bytes / KiB).toFixed(1)} KB`;
  if (bytes < 100 * MiB) return `~${(bytes / MiB).toFixed(1)} MB`;
  return `~${Math.round(bytes / MiB)} MB`;
}

export function formatBytesExact(bytes: number): string {
  if (bytes < KiB) return `${bytes} B`;
  if (bytes < MiB) return `${(bytes / KiB).toFixed(1)} KB`;
  if (bytes < GiB) return `${(bytes / MiB).toFixed(1)} MB`;
  return `${(bytes / GiB).toFixed(2)} GB`;
}

export function formatDuration(seconds: number | undefined): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatDimensions(width?: number, height?: number): string {
  if (!width || !height) return "";
  return `${width}×${height}`;
}

export function formatSavingsPct(inputBytes: number, outputBytes: number): string {
  const pct = Math.round(((inputBytes - outputBytes) / inputBytes) * 100);
  return `${pct}%`;
}

/**
 * Truncates a long filename to `max` characters using middle-truncation,
 * preserving the start and end (which contain the extension).
 * e.g. middleTruncate("my_awesome_gopro_footage.mp4", 24) → "my_awesome_go…tage.mp4"
 */
export function middleTruncate(name: string, max: number): string {
  if (name.length <= max) return name;
  const half = Math.floor((max - 1) / 2);
  return name.slice(0, half) + "…" + name.slice(name.length - half);
}

/**
 * Returns the immediate parent directory name from a file path.
 * Works for both Windows (\) and Unix (/) separators.
 * e.g. "C:\Users\John\Vacation\IMG_0001.jpg" → "Vacation"
 */
export function parentDirName(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  // parts[-2] = parent dir, parts[-1] = filename
  return parts.length >= 2 ? (parts[parts.length - 2] ?? "") : "";
}

/** Format seconds remaining as a compact ETA string, e.g. "1m 23s". */
export function formatEta(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

/**
 * Returns a short human-readable metadata label for a job's probe result.
 * Videos/audio → duration; images → dimensions; PDFs → page count.
 */
export function probeLabel(probe: import("@/types").MediaProbe | undefined, kind: import("@/types").FileKind): string | null {
  if (!probe) return null;
  switch (kind) {
    case "video":
    case "audio": {
      if (!probe.durationSec) return null;
      const s = Math.round(probe.durationSec);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      return h > 0
        ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
        : `${m}:${String(sec).padStart(2, "0")}`;
    }
    case "image":
      if (probe.width && probe.height) return `${probe.width}×${probe.height}`;
      return null;
    case "pdf":
      if (probe.pageCount) return `${probe.pageCount} page${probe.pageCount !== 1 ? "s" : ""}`;
      return null;
    default:
      return null;
  }
}
