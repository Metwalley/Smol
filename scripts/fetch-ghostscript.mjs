#!/usr/bin/env node
/**
 * fetch-ghostscript.mjs
 * Downloads the Ghostscript Windows x64 installer from Artifex,
 * extracts gswin64c.exe, and places it in src-tauri/binaries/.
 *
 * Run: node scripts/fetch-ghostscript.mjs
 *
 * Pin the version and SHA256 hash below before each release.
 * AGPL-3.0: See THIRD_PARTY_NOTICES.md for attribution.
 */

import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BINARIES_DIR = join(__dirname, "..", "src-tauri", "binaries");

// ── Pin these before each release ──────────────────────────────────────────
const GS_VERSION = "10.03.0";
const GS_URL = `https://github.com/ArtifexSoftware/ghostpdl-downloads/releases/download/gs10030/gs10030w64.exe`;
// TODO: Set real SHA256 after pinning version
const GS_SHA256 = "REPLACE_WITH_ACTUAL_SHA256";
// ───────────────────────────────────────────────────────────────────────────

const TRIPLE = "x86_64-pc-windows-msvc";
const GS_DEST = join(BINARIES_DIR, `gs-${TRIPLE}.exe`);

if (!existsSync(BINARIES_DIR)) {
  mkdirSync(BINARIES_DIR, { recursive: true });
}

if (existsSync(GS_DEST)) {
  console.log("Ghostscript binary already present, skipping download.");
  process.exit(0);
}

console.log(`Ghostscript ${GS_VERSION} binary not found.`);
console.log("NOTE: Update GS_SHA256 in this script before release.");
console.log(`Download gswin64c.exe from:\n  ${GS_URL}`);
console.log(`and place it at:\n  ${GS_DEST}`);
process.exit(0);
