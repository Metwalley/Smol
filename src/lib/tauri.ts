import { invoke } from "@tauri-apps/api/core";

export interface PathInfo {
  exists: boolean;
  isDir: boolean;
  sizeBytes: number;
  name: string;
  extension: string | null;
}

export const getPathInfo = (path: string) =>
  invoke<PathInfo>("get_path_info", { path });

export const listSupportedInDir = (path: string) =>
  invoke<PathInfo[]>("list_supported_in_dir", { path });

export const ensureOutputPath = (
  inputPath: string,
  pattern: string,
  outputMode: string,
  customDir?: string
) => invoke<string>("ensure_output_path", { inputPath, pattern, outputMode, customDir });

export const revealInExplorer = (path: string) =>
  invoke<void>("reveal_in_explorer", { path });
