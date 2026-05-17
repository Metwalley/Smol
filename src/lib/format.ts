export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes < 0) return "—";
  if (bytes < 1_000) return `~${bytes} B`;
  if (bytes < 1_000_000) return `~${(bytes / 1_000).toFixed(1)} KB`;
  if (bytes < 100_000_000) return `~${(bytes / 1_000_000).toFixed(1)} MB`;
  return `~${Math.round(bytes / 1_000_000)} MB`;
}

export function formatBytesExact(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
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
