import type { FileKind } from "@/types";

// Authoritative extension sets — keep in sync with SUPPORTED_EXT in src-tauri/src/fs_bridge.rs
const VIDEO_EXT = new Set(["mp4", "mov", "mkv", "webm", "avi", "m4v", "wmv", "flv"]);
const AUDIO_EXT = new Set(["mp3", "m4a", "aac", "wav", "flac", "ogg", "opus", "wma"]);
const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "avif", "bmp", "tiff"]);
const PDF_EXT   = new Set(["pdf"]);

export function fileKindFromPath(path: string): FileKind | "unsupported" {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (VIDEO_EXT.has(ext)) return "video";
  if (AUDIO_EXT.has(ext)) return "audio";
  if (IMAGE_EXT.has(ext)) return "image";
  if (PDF_EXT.has(ext))   return "pdf";
  return "unsupported";
}

// Keep old name as alias so nothing breaks across phases
export const getFileKind = fileKindFromPath;

export function kindLabel(kind: FileKind): string {
  const labels: Record<FileKind, string> = {
    video: "Video",
    audio: "Audio",
    image: "Image",
    pdf:   "PDF",
  };
  return labels[kind];
}

export function kindBadgeColor(kind: FileKind): string {
  const colors: Record<FileKind, string> = {
    video: "bg-violet-700 text-violet-100",
    audio: "bg-blue-700 text-blue-100",
    image: "bg-emerald-700 text-emerald-100",
    pdf:   "bg-orange-700 text-orange-100",
  };
  return colors[kind];
}
