#!/usr/bin/env node
/**
 * fetch-ffmpeg.mjs
 * Downloads the FFmpeg + FFprobe binaries from gyan.dev (LGPL release-essentials build)
 * and places them in src-tauri/binaries/ with the Tauri triple-suffix naming convention.
 *
 * Run: node scripts/fetch-ffmpeg.mjs
 *
 * Pin the version and SHA256 hashes below before each release.
 * Verify the SHA at: https://www.gyan.dev/ffmpeg/builds/
 */

import { createHash } from "crypto";
import { createWriteStream, existsSync, mkdirSync, chmodSync } from "fs";
import { pipeline } from "stream/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BINARIES_DIR = join(__dirname, "..", "src-tauri", "binaries");

// ── Pin these before each release ──────────────────────────────────────────
const FFMPEG_VERSION = "7.1-essentials_build";
const FFMPEG_URL = `https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.7z`;
// TODO: Set real SHA256 after pinning version
const FFMPEG_SHA256 = "REPLACE_WITH_ACTUAL_SHA256";
// ───────────────────────────────────────────────────────────────────────────

const TRIPLE = "x86_64-pc-windows-msvc";
const FFMPEG_DEST  = join(BINARIES_DIR, `ffmpeg-${TRIPLE}.exe`);
const FFPROBE_DEST = join(BINARIES_DIR, `ffprobe-${TRIPLE}.exe`);

if (!existsSync(BINARIES_DIR)) {
  mkdirSync(BINARIES_DIR, { recursive: true });
}

if (existsSync(FFMPEG_DEST) && existsSync(FFPROBE_DEST)) {
  console.log("FFmpeg binaries already present, skipping download.");
  process.exit(0);
}

console.log(`Downloading FFmpeg ${FFMPEG_VERSION} from gyan.dev…`);
console.log("NOTE: Update FFMPEG_SHA256 in this script before release.");
console.log("For now, extract ffmpeg.exe and ffprobe.exe from the 7z archive manually");
console.log(`and place them at:\n  ${FFMPEG_DEST}\n  ${FFPROBE_DEST}`);
process.exit(0);
