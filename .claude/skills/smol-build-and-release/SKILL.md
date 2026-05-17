---
name: smol-build-and-release
description: Use this skill when you are about to set up the build, write the GitHub Actions release workflow, configure NSIS, or cut a release tag.
---

# Smol Build & Release

## Principle (HR-12)

Local `pnpm tauri build` is for dev smoke-testing only.
Every installer that ships comes from GitHub Actions on a `v*.*.*` tag push.

---

## tauri.conf.json bundle section

```json
{
  "bundle": {
    "active": true,
    "targets": ["nsis"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "externalBin": [
      "binaries/ffmpeg",
      "binaries/ffprobe",
      "binaries/gs"
    ],
    "windows": {
      "nsis": {
        "installMode": "perMachine"
      }
    }
  }
}
```

---

## GitHub Actions workflow (.github/workflows/release.yml)

```yaml
name: Release

on:
  push:
    tags:
      - "v*.*.*"

jobs:
  build-windows:
    runs-on: windows-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: x86_64-pc-windows-msvc

      - name: Install JS deps
        run: pnpm install

      - name: Fetch sidecars
        run: |
          node scripts/fetch-ffmpeg.mjs
          node scripts/fetch-ghostscript.mjs

      - name: Build & publish
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: "Smol ${{ github.ref_name }}"
          releaseBody: "See CHANGELOG for details."
          releaseDraft: false
          prerelease: false
```

The `tauri-action` step:
1. Runs `pnpm tauri build`
2. Finds the produced `.exe` installer in `src-tauri/target/release/bundle/nsis/`
3. Attaches it to the GitHub Release

---

## Versioning

Version lives in **three places** (keep them in sync):
1. `package.json` → `"version": "0.1.0"`
2. `src-tauri/Cargo.toml` → `version = "0.1.0"`
3. `src-tauri/tauri.conf.json` → `"version": "0.1.0"`

Tag format: `v0.1.0` (semver, v-prefix).

To cut a release:
```bash
# bump all three version fields, commit, then:
git tag v0.1.0
git push origin v0.1.0
```

---

## Code signing (v1.0 note)

No code signing in v1.0. Users will see the Windows SmartScreen warning on first run.
This is expected and documented in the README. Revisit after gaining enough installs
to qualify for Microsoft's reputation-based bypass.

---

## Installer output filename

Tauri NSIS produces: `Smol_0.1.0_x64-setup.exe`
This is attached automatically to the GitHub Release by tauri-action.
