import type { FileKind } from "@/types";

const VIDEO_EXT = new Set(["mp4", "mov", "mkv", "avi", "webm", "m4v", "flv", "wmv", "ts"]);
const AUDIO_EXT = new Set(["mp3", "aac", "flac", "wav", "ogg", "m4a", "opus", "wma"]);
const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif", "bmp", "tiff", "tif"]);
const PDF_EXT = new Set(["pdf"]);

export function getFileKind(filename: string): FileKind | "unsupported" {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (VIDEO_EXT.has(ext)) return "video";
  if (AUDIO_EXT.has(ext)) return "audio";
  if (IMAGE_EXT.has(ext)) return "image";
  if (PDF_EXT.has(ext)) return "pdf";
  return "unsupported";
}

export function kindLabel(kind: FileKind): string {
  const labels: Record<FileKind, string> = {
    video: "Video",
    audio: "Audio",
    image: "Image",
    pdf: "PDF",
  };
  return labels[kind];
}
