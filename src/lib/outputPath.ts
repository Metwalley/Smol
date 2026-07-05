/**
 * Compute the output file path from a job's input path and the current
 * output-mode / filename-pattern settings.
 *
 * Works on Windows paths (backslash) and POSIX paths (forward slash).
 */
export function buildOutputPath(
  inputPath: string,
  outputMode: "same-folder" | "subfolder" | "custom",
  filenamePattern: string,
  customOutputDir?: string,
  targetFormat?: string,
): string {
  // Detect path separator (Windows-first since that's the only v1.0 target)
  const sep = inputPath.includes("\\") ? "\\" : "/";
  const lastSep = Math.max(inputPath.lastIndexOf("\\"), inputPath.lastIndexOf("/"));

  const dir = inputPath.slice(0, lastSep);
  const filename = inputPath.slice(lastSep + 1);

  const dotIdx = filename.lastIndexOf(".");
  const name = dotIdx >= 0 ? filename.slice(0, dotIdx) : filename;
  const ext = dotIdx >= 0 ? filename.slice(dotIdx) : ""; // e.g. ".mp4"

  // Determine output extension based on target format
  let outExt = ext;
  if (targetFormat && targetFormat !== "keep") {
    outExt = `.${targetFormat}`;
  }

  const outFilename = filenamePattern
    .replace("{name}", name)
    .replace("{ext}", outExt);

  let outDir: string;
  switch (outputMode) {
    case "subfolder":
      outDir = `${dir}${sep}smol`;
      break;
    case "custom":
      outDir = customOutputDir ?? dir;
      break;
    case "same-folder":
    default:
      outDir = dir;
  }

  return `${outDir}${sep}${outFilename}`;
}
