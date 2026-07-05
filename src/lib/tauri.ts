import { invoke, Channel } from "@tauri-apps/api/core";
import type { MediaProbe } from "@/types";

// ── Phase 6: video compression types ─────────────────────────────────────────

/** Streamed progress event from the compress_video Rust command. */
export interface VideoProgressEvent {
  jobId: string;
  fraction: number;
  fps?: number;
  /** e.g. "2.4x" */
  speed?: string;
  etaSec?: number;
  currentBytes?: number;
}

/** Final result returned by compress_video after FFmpeg exits. */
export interface CompressResult {
  outputPath: string;
  outputBytes: number;
  /** True when compressed size ≥ original; original was kept, outputPath === inputPath. */
  outputLarger: boolean;
}

// Mirrors PathInfo in src-tauri/src/fs_bridge.rs
export interface PathInfo {
  exists: boolean;
  isDir: boolean;
  size: number;
  name: string;
  extension: string | null;
  path: string;
}

/** Get metadata for a single path (file or directory). Never rejects on not-found. */
export const getPathInfo = (path: string) =>
  invoke<PathInfo>("get_path_info", { path });

/** Walk a directory one level deep and return supported files only. */
export const listDirSupported = (path: string) =>
  invoke<PathInfo[]>("list_dir_supported", { path });

/** Probe a media file and return stream/format metadata. Returns empty object on failure. */
export const probeMedia = (path: string) =>
  invoke<MediaProbe>("probe_media", { path });

/** Write an array of bytes to a temporary image file and return its PathInfo. */
export const writeClipboardImage = (bytes: number[]) =>
  invoke<PathInfo>("write_clipboard_image", { bytes });

/**
 * Generate (or return cached) a thumbnail for a media file.
 * Returns a filesystem path string, or null when no thumbnail is available
 * (PDF in Phase 3, audio with no cover art and failed waveform, any error).
 * duration_sec is used for video seek position — pass from probe result.
 */
export const generateThumbnail = (
  path: string,
  kind: string,
  duration_sec: number | null,
) => invoke<string | null>("generate_thumbnail", { path, kind, duration_sec });

// ── Phase 6: compression commands ────────────────────────────────────────────

/**
 * Compress a single video file.
 * Progress events are streamed via the `onProgress` channel.
 * Returns a CompressResult when FFmpeg exits (success or output-larger skip).
 * Throws (rejects) on FFmpeg failure or cancellation.
 */
export const compressVideo = (
  jobId: string,
  inputPath: string,
  outputPath: string,
  preset: string,
  durationSec: number | null,
  onProgress: Channel<VideoProgressEvent>,
  targetFileSize: number | null,
) =>
  invoke<CompressResult>("compress_video", {
    jobId,
    inputPath,
    outputPath,
    preset,
    targetFileSize,
    durationSec,
    onProgress,
  });

/** Kill a running FFmpeg process and clean up the partial output file. */
export const cancelJob = (jobId: string) =>
  invoke<void>("cancel_job", { jobId });

/**
 * Compress a single image file (JPEG/PNG/WebP natively in Rust).
 * Identical channel/result contract as compressVideo/compressAudio.
 * The Rust side may change the output extension (e.g. BMP → jpg);
 * the returned CompressResult.outputPath reflects the actual file written.
 * Unsupported formats (AVIF, HEIC, GIF) are returned with outputLarger: true.
 */
export const compressImage = (
  jobId: string,
  inputPath: string,
  outputPath: string,
  preset: string,
  durationSec: number | null,
  onProgress: Channel<VideoProgressEvent>,
) =>
  invoke<CompressResult>("compress_image", {
    jobId,
    inputPath,
    outputPath,
    preset,
    durationSec,
    onProgress,
  });

/**
 * Compress a single audio file.
 * Identical channel/result contract as compressVideo.
 * The Rust side may change the output extension (e.g. WAV → mp3);
 * the returned CompressResult.outputPath reflects the actual file written.
 */
export const compressAudio = (
  jobId: string,
  inputPath: string,
  outputPath: string,
  preset: string,
  durationSec: number | null,
  onProgress: Channel<VideoProgressEvent>,
) =>
  invoke<CompressResult>("compress_audio", {
    jobId,
    inputPath,
    outputPath,
    preset,
    durationSec,
    onProgress,
  });

/**
 * Compress a single PDF file via the Ghostscript sidecar.
 * Identical channel/result contract as compressVideo/compressAudio/compressImage.
 * Emits a single 100% ProgressEvent when Ghostscript exits.
 * If the compressed file is not smaller than the original, the original is kept
 * and CompressResult.outputLarger will be true.
 */
export const compressPdf = (
  jobId: string,
  inputPath: string,
  outputPath: string,
  preset: string,
  durationSec: number | null,
  onProgress: Channel<VideoProgressEvent>,
) =>
  invoke<CompressResult>("compress_pdf", {
    jobId,
    inputPath,
    outputPath,
    preset,
    durationSec,
    onProgress,
  });

/** Open Windows Explorer with the given file highlighted in its parent folder. */
export const revealInExplorer = (path: string) =>
  invoke<void>("reveal_in_explorer", { path });
