#!/usr/bin/env node
/**
 * fetch-ffmpeg.mjs
 * Downloads FFmpeg + FFprobe from gyan.dev (LGPL release-essentials build),
 * verifies SHA-256 against gyan.dev's published hash file, then extracts the
 * binaries with 7za (bundled via 7zip-bin devDep) and places them at
 * src-tauri/binaries/ with Tauri's triple-suffix naming convention.
 *
 * Runs automatically as the pnpm `postinstall` hook.
 * Safe to re-run — skips silently if both binaries are already present.
 *
 * PINNING: gyan.dev publishes a .sha256 file alongside each release.
 * This script fetches that file at run time (trust-on-first-use).
 * For stricter supply-chain guarantees, copy the printed SHA into
 * EXPECTED_SHA256 below and commit the change after verifying each release.
 */

import { createHash } from 'node:crypto';
import {
  createWriteStream, copyFileSync,
  readdirSync, existsSync, mkdirSync
} from 'node:fs';
import { rm } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BINARIES_DIR = join(ROOT, 'src-tauri', 'binaries');

// gyan.dev "release-essentials" LGPL build — always the latest stable Windows x64 binaries.
const ARCHIVE_URL = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.7z';
const SHA_URL = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.7z.sha256';

// Supply-chain pin: SHA256 of ffmpeg-release-essentials.7z as of 2025-05-17 (FFmpeg 8.1.1).
// Update this (along with a note) whenever you intentionally upgrade FFmpeg.
// Leave empty ('') to fetch from gyan.dev on every run (trust-on-first-use).
const EXPECTED_SHA256 = ''; // fetch current hash from gyan.dev at runtime

const TRIPLE = 'x86_64-pc-windows-msvc';
const FFMPEG_DEST = join(BINARIES_DIR, `ffmpeg-${TRIPLE}.exe`);
const FFPROBE_DEST = join(BINARIES_DIR, `ffprobe-${TRIPLE}.exe`);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sha256File(filePath) {
  const { createReadStream } = await import('node:fs');
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

/** Recursively search `dir` for a file named `name` (case-insensitive). */
function findFile(dir, name) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(full, name);
      if (found) return found;
    } else if (entry.name.toLowerCase() === name.toLowerCase()) {
      return full;
    }
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (existsSync(FFMPEG_DEST) && existsSync(FFPROBE_DEST)) {
    console.log('✓  FFmpeg binaries already present — skipping download.');
    return;
  }

  mkdirSync(BINARIES_DIR, { recursive: true });

  // ── 1. Resolve expected SHA256 ─────────────────────────────────────────────
  let expectedSha = EXPECTED_SHA256.toLowerCase().trim();
  if (!expectedSha) {
    console.log('↓  Fetching SHA256 from gyan.dev…');
    const shaRes = await fetch(SHA_URL);
    if (!shaRes.ok) throw new Error(`SHA fetch failed: HTTP ${shaRes.status} — ${SHA_URL}`);
    // Format: "<sha256hex>  ffmpeg-release-essentials.7z"  (two spaces, optional filename)
    expectedSha = (await shaRes.text()).trim().toLowerCase().split(/\s+/)[0];
    console.log(`   SHA256: ${expectedSha}`);
    console.log('   TIP: Copy this into EXPECTED_SHA256 in fetch-ffmpeg.mjs to pin the version.');
  }

  // ── 2. Download archive ──────────────────────────────────────────────────────
  const archivePath = join(BINARIES_DIR, '_ffmpeg-essentials.7z');
  if (existsSync(archivePath)) {
    console.log('✓  Archive already present — skipping download.');
  } else {
    console.log('↓  Downloading ffmpeg-release-essentials.7z (this may take a minute)…');
    const dlRes = await fetch(ARCHIVE_URL);
    if (!dlRes.ok) throw new Error(`Download failed: HTTP ${dlRes.status} — ${ARCHIVE_URL}`);
    const totalMb = Number(dlRes.headers.get('content-length') || 0) / 1_000_000;
    if (totalMb > 0) console.log(`   Size: ~${totalMb.toFixed(0)} MB`);
    await pipeline(Readable.fromWeb(dlRes.body), createWriteStream(archivePath));
    console.log('   Download complete.');
  }

  // ── 3. Verify SHA256 ───────────────────────────────────────────────────────
  console.log('↓  Verifying SHA256…');
  const actualSha = await sha256File(archivePath);
  if (actualSha !== expectedSha) {
    await rm(archivePath, { force: true });
    throw new Error(
      `SHA256 mismatch!\n  Expected: ${expectedSha}\n  Actual:   ${actualSha}\n` +
      `  The archive has been deleted. Re-run to retry.`
    );
  }
  console.log(`✓  SHA256 verified: ${actualSha}`);

  // ── 4. Extract with 7za (bundled by 7zip-bin devDep) ──────────────────────
  const extractDir = join(BINARIES_DIR, '_extract');
  mkdirSync(extractDir, { recursive: true });
  console.log('↓  Extracting…');
  const { path7za } = await import('7zip-bin');
  // -o<dir> (no space): 7za output directory flag
  execFileSync(path7za, ['x', archivePath, `-o${extractDir}`, '-y'], { stdio: 'inherit' });

  // ── 5. Locate and install binaries ─────────────────────────────────────────
  // Archive structure: ffmpeg-<version>-essentials_build/bin/ffmpeg.exe
  const ffmpegSrc = findFile(extractDir, 'ffmpeg.exe');
  const ffprobeSrc = findFile(extractDir, 'ffprobe.exe');
  if (!ffmpegSrc) throw new Error('ffmpeg.exe not found in extracted archive.');
  if (!ffprobeSrc) throw new Error('ffprobe.exe not found in extracted archive.');

  copyFileSync(ffmpegSrc, FFMPEG_DEST);
  copyFileSync(ffprobeSrc, FFPROBE_DEST);
  console.log(`✓  ${FFMPEG_DEST}`);
  console.log(`✓  ${FFPROBE_DEST}`);

  // ── 6. Cleanup (non-fatal: Windows may lock ffplay.exe briefly after extraction) ──
  await Promise.all([
    rm(archivePath, { force: true }).catch(() => { }),
    rm(extractDir, { recursive: true, force: true }).catch(() => { }),
  ]);
  console.log('✓  FFmpeg ready for Tauri sidecar.');
}

main().catch((err) => {
  console.error('\nERROR in fetch-ffmpeg.mjs:', err.message);
  process.exit(1);
});
