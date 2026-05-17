import { invoke } from "@tauri-apps/api/core";
import type { MediaProbe } from "@/types";

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
