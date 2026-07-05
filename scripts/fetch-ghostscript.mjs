#!/usr/bin/env node
/**
 * fetch-ghostscript.mjs
 * Provides gswin64c.exe and gsdll64.dll for the Ghostscript Tauri sidecar.
 *
 * Strategy (in order):
 *   1. Skip if real binaries are already in src-tauri/binaries/.
 *   2. Copy from an existing system-wide Ghostscript installation if found.
 *   3. Download the NSIS installer and run it silently via PowerShell
 *      Start-Process -Wait (handles UAC elevation correctly), then copy
 *      from the newly installed location.
 *
 * Run: node scripts/fetch-ghostscript.mjs
 * AGPL-3.0: See THIRD_PARTY_NOTICES.md for Ghostscript attribution.
 */

import { existsSync, statSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { createWriteStream }                                           from 'node:fs';
import { rm }                                                          from 'node:fs/promises';
import { pipeline }                                                    from 'node:stream/promises';
import { Readable }                                                    from 'node:stream';
import { join, dirname }                                               from 'node:path';
import { fileURLToPath }                                               from 'node:url';
import { spawnSync }                                                   from 'node:child_process';

const __dirname    = dirname(fileURLToPath(import.meta.url));
const ROOT         = join(__dirname, '..');
const BINARIES_DIR = join(ROOT, 'src-tauri', 'binaries');

const GS_VERSION       = '10.03.0';
const GS_INSTALLER_URL =
  'https://github.com/ArtifexSoftware/ghostpdl-downloads/releases/download/gs10030/gs10030w64.exe';

const TRIPLE      = 'x86_64-pc-windows-msvc';
const GS_EXE_DEST = join(BINARIES_DIR, `gs-${TRIPLE}.exe`);
const GS_DLL_DEST = join(BINARIES_DIR, 'gsdll64.dll');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** True if a file exists with a plausible size (i.e. not a zero-byte placeholder). */
function isRealBinary(p) {
  return existsSync(p) && statSync(p).size > 10_000;
}

/**
 * Scan the standard Program Files locations for a Ghostscript installation.
 * Returns { exe, dll } paths or null if not found.
 */
function findInstalledGS() {
  const pfRoots = [
    process.env['ProgramFiles'],
    process.env['ProgramFiles(x86)'],
    'C:\\Program Files',
    'C:\\Program Files (x86)',
  ].filter(Boolean);

  for (const pf of pfRoots) {
    const gsRoot = join(pf, 'gs');
    if (!existsSync(gsRoot)) continue;

    // Sort version folders descending so we pick the newest
    let versionDirs;
    try { versionDirs = readdirSync(gsRoot); } catch { continue; }
    versionDirs = versionDirs
      .filter((d) => existsSync(join(gsRoot, d, 'bin', 'gswin64c.exe')))
      .sort()
      .reverse();

    if (versionDirs.length > 0) {
      const binDir = join(gsRoot, versionDirs[0], 'bin');
      return {
        exe: join(binDir, 'gswin64c.exe'),
        dll: join(binDir, 'gsdll64.dll'),
      };
    }
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(BINARIES_DIR, { recursive: true });

  // ── Step 1: Already have real binaries? ──────────────────────────────────
  if (isRealBinary(GS_EXE_DEST) && isRealBinary(GS_DLL_DEST)) {
    console.log(`✓  Ghostscript ${GS_VERSION} binaries already present — skipping.`);
    return;
  }

  // ── Step 2: Already installed on this machine? ────────────────────────────
  console.log('Looking for an existing Ghostscript installation…');
  let gs = findInstalledGS();
  if (gs) {
    console.log(`   Found: ${gs.exe}`);
    copyFileSync(gs.exe, GS_EXE_DEST);
    if (existsSync(gs.dll)) copyFileSync(gs.dll, GS_DLL_DEST);
    console.log(`✓  Copied to ${BINARIES_DIR}`);
    console.log('   Restart pnpm tauri dev to pick up the new binaries.');
    return;
  }
  console.log('   None found.');

  // ── Step 3: Download the installer ───────────────────────────────────────
  const installerPath = join(BINARIES_DIR, '_gs-installer.exe');
  console.log(`\n↓  Downloading Ghostscript ${GS_VERSION} installer (~65 MB)…`);
  console.log(`   ${GS_INSTALLER_URL}`);

  const res = await fetch(GS_INSTALLER_URL);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);

  const totalMb = Number(res.headers.get('content-length') || 0) / 1_000_000;
  if (totalMb > 0) console.log(`   Size: ~${totalMb.toFixed(0)} MB`);

  await pipeline(Readable.fromWeb(res.body), createWriteStream(installerPath));
  console.log('   Download complete.');

  // ── Step 4: Run installer silently ───────────────────────────────────────
  // CI runners (GitHub Actions) already run as Administrator — invoke the
  // NSIS installer directly. On a user machine, UAC elevation is required, so
  // fall back to PowerShell Start-Process -Verb RunAs which triggers the prompt.
  const isCI = Boolean(process.env.CI);
  console.log(`\n↓  Running silent installer${isCI ? ' (CI mode, no UAC)' : ' (approve UAC if prompted)'}…`);

  let result;
  if (isCI) {
    // Direct invocation — works because CI runner is already elevated.
    result = spawnSync(installerPath, ['/S'], { stdio: 'inherit', timeout: 300_000 });
  } else {
    // PowerShell Start-Process with -Wait properly tracks the elevated child
    // process that NSIS forks (plain spawnSync loses the handle after UAC).
    const escapedPath = installerPath.replace(/'/g, "''"); // PS single-quote escape
    const psCmd = `Start-Process -FilePath '${escapedPath}' -ArgumentList '/S' -Wait -Verb RunAs`;
    result = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-Command', psCmd],
      { stdio: 'inherit', timeout: 300_000 },
    );
  }

  if (result.status !== 0) {
    throw new Error(
      `Installer exited with code ${result.status ?? 'unknown'}. ` +
      (isCI ? 'Check runner permissions.' : 'If UAC was cancelled, re-run and approve the elevation prompt.'),
    );
  }
  console.log('   Installation complete.');

  // ── Step 5: Find and copy the installed binaries ──────────────────────────
  // Give the installer a moment to finish writing registry entries / files
  await new Promise((r) => setTimeout(r, 2_000));

  gs = findInstalledGS();
  if (!gs) {
    throw new Error(
      `Ghostscript not found in Program Files after installation.\n` +
      `Please install manually from:\n  ${GS_INSTALLER_URL}\n` +
      `then copy gswin64c.exe → ${GS_EXE_DEST}\n` +
      `and      gsdll64.dll  → ${GS_DLL_DEST}`,
    );
  }

  copyFileSync(gs.exe, GS_EXE_DEST);
  if (existsSync(gs.dll)) copyFileSync(gs.dll, GS_DLL_DEST);
  console.log(`✓  ${GS_EXE_DEST}`);
  console.log(`✓  ${GS_DLL_DEST}`);

  // ── Step 6: Cleanup installer ─────────────────────────────────────────────
  await rm(installerPath, { force: true }).catch(() => {});

  console.log(`\n✓  Ghostscript ${GS_VERSION} ready.`);
  console.log('   Run: pnpm tauri dev (restart if already running).');
}

main().catch((err) => {
  console.error('\nERROR in fetch-ghostscript.mjs:', err.message);
  process.exit(1);
});
