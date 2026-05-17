import { invoke } from "@tauri-apps/api/core";

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
