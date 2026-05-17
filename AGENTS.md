# Smol — Agent Contract

> Read this file **before writing any code**. Every rule here is non-negotiable.
> Repo: https://github.com/Metwalley/Smol · License: AGPL-3.0

---

## 1. Stack (locked — no alternates)

| Layer | Choice |
|---|---|
| Desktop shell | Tauri 2 |
| UI framework | React 19 + TypeScript 5 |
| Bundler | Vite 6 |
| Styling | Tailwind 4 + shadcn/ui (Radix primitives) |
| State | Zustand 5 |
| Animation | Framer Motion |
| Toast | Sonner (hardcode `theme="dark"` — never use next-themes) |
| Icons | Lucide React |
| Package manager | pnpm |
| Rust edition | 2021, Rust stable |

---

## 2. Hard rules (HR-1 … HR-15)

1. **HR-1** Stack is fixed. No alternates without an approved issue.
2. **HR-2** License: AGPL-3.0. `LICENSE` file stays as-is.
3. **HR-3** Windows 11 x64 only for v1.0. Only `nsis` bundle target.
4. **HR-4** Window chrome = **Option C** (extended client area, system-drawn controls). NEVER `transparent: true` + `decorations: false` together.
5. **HR-5** `dragDropEnabled: false` in `tauri.conf.json`. Use HTML5 `onDrop` + `(file as any).path`. No other way.
6. **HR-6** No JS `@tauri-apps/plugin-fs` calls on user-chosen paths. Every filesystem op on user data is a `#[tauri::command]` in Rust.
7. **HR-7** Zustand selectors are **atomic** (one field per selector). Actions come from `useStore.getState()`. Never return a new object from a selector.
8. **HR-8** Two-tier UI only: Casual surface (default) + Advanced drawer. No third tier.
9. **HR-9** Sidecars are versioned and SHA-pinned. Never rely on system-installed binaries.
10. **HR-10** AGENTS.md + the 11 skill files are committed in Phase 0, before any feature code.
11. **HR-11** Casual mode never shows codec names, CRF values, bitrate numbers, or hardware-encoder toggles. Presets: **Less Compression / Recommended / Extreme Compression / Lossless**. Recommended is the default.
12. **HR-12** GitHub Actions produces every Windows installer. Local `tauri build` is dev only. Releases are tag-triggered (`v*.*.*`).
13. **HR-13** Single unified queue. Drop any mix of video/audio/image/PDF into one drop zone. Filter chips above the list let the user narrow by kind. No top-level tabs per file kind.
14. **HR-14** Target File Size is Advanced-only. Never visible in Casual mode.
15. **HR-15** Estimated output size shown per preset card AND per queue row. Always prefixed with `~`. Fall back to `—` when unknown.

---

## 3. Six bugs — structural fixes

| # | Bug | Fix |
|---|---|---|
| 1 | Zustand infinite re-render | HR-7 + skill `smol-zustand-patterns` |
| 2 | Sonner crash (missing ThemeProvider) | Hardcode `theme="dark"` on `<Toaster>` |
| 3 | `fs.stat` blocked on user paths | HR-6 + skill `smol-rust-fs-bridge` |
| 4 | FileList doesn't scroll | `min-h-0` on every flex parent — skill `smol-flex-scroll-fix` |
| 5 | Rounded corners visible when maximized | `useMaximized()` toggles `rounded-xl` — skill `smol-window-and-chrome` |
| 6 | Drag-drop 🚫 cursor | HR-5 + `dragDropEnabled: false` + HTML5 `onDrop` |

---

## 4. Repository layout

```
Smol/
├── AGENTS.md                         # this file
├── CLAUDE.md                         # symlink → AGENTS.md
├── README.md
├── LICENSE                           # AGPL-3.0
├── THIRD_PARTY_NOTICES.md
├── .gitignore
├── .github/workflows/release.yml
├── .claude/skills/                   # 11 progressive-disclosure skill files
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── index.html
├── public/logo.svg
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles/globals.css
│   ├── components/
│   │   ├── titlebar/
│   │   ├── dropzone/
│   │   ├── filelist/
│   │   ├── settings/
│   │   ├── progress/
│   │   ├── results/
│   │   └── ui/                       # shadcn primitives
│   ├── store/
│   │   ├── jobs.ts
│   │   ├── settings.ts
│   │   └── ui.ts
│   ├── lib/
│   │   ├── tauri.ts
│   │   ├── format.ts
│   │   └── kinds.ts
│   ├── hooks/
│   │   ├── useDragDrop.ts
│   │   ├── useMaximized.ts
│   │   └── useJobProgress.ts
│   └── types/index.ts
├── scripts/
│   ├── fetch-ffmpeg.mjs
│   └── fetch-ghostscript.mjs
└── src-tauri/
    ├── tauri.conf.json
    ├── Cargo.toml
    ├── src/
    │   ├── main.rs
    │   ├── lib.rs
    │   ├── commands/
    │   │   ├── fs.rs
    │   │   ├── probe.rs
    │   │   ├── thumbnail.rs
    │   │   ├── compress_video.rs
    │   │   ├── compress_audio.rs
    │   │   ├── compress_image.rs
    │   │   └── compress_pdf.rs
    │   ├── jobs/
    │   │   ├── mod.rs
    │   │   └── progress.rs
    │   ├── encoders/
    │   │   ├── hw_detect.rs
    │   │   └── ffmpeg_args.rs
    │   └── error.rs
    └── binaries/                     # gitignored sidecar exes
```

---

## 5. Build & dev commands

```bash
pnpm install              # install JS deps
pnpm dev                  # Vite only
pnpm tauri dev            # full Tauri dev (opens window)
pnpm build                # Vite production build
pnpm tauri build          # Tauri production build (dev only — CI does releases)
pnpm lint                 # ESLint
pnpm tsc --noEmit         # type-check
cargo check               # Rust type-check (run from src-tauri/)
cargo clippy              # Rust lint
```

---

## 6. Operating rules for every agent turn

1. Read AGENTS.md and the relevant skill file(s) before writing code.
2. One commit per phase; phase number in message: `feat(p3): file list + media probe`.
3. Every Rust command returns `Result<T, AppError>`. No `unwrap()` or `expect()` in command bodies.
4. Every React component file ≤ 200 lines. Split otherwise.
5. No `console.log` in committed code. Use the `log` Rust crate + `src/lib/log.ts` wrapper.
6. No silent stack changes. No TODO comments.
7. Stop at end of each phase and report. Do not start phase N+1 without sign-off.

---

## 7. Skill index

| Skill | Trigger phrases |
|---|---|
| `smol-window-and-chrome` | configure window, tauri.conf.json, titlebar, drag drop, transparent |
| `smol-zustand-patterns` | zustand, store, selector, useStore |
| `smol-rust-fs-bridge` | fs.stat, fs.exists, read file, @tauri-apps/plugin-fs, user path |
| `smol-flex-scroll-fix` | scroll, overflow, max-h, FileList, queue |
| `smol-ffmpeg-sidecar` | ffmpeg, compress video, compress audio, progress, encoder, sidecar |
| `smol-image-compression-rust` | compress image, jpeg, png, webp, avif, mozjpeg, oxipng |
| `smol-ghostscript-pdf-sidecar` | compress pdf, ghostscript, gs, pdfwrite |
| `smol-ui-two-tier-model` | advanced options, settings, casual, expert mode |
| `smol-build-and-release` | build installer, nsis, github actions, release, tauri-action |
| `smol-licensing-and-attribution` | license, AGPL, third-party, NOTICE, attribution |
| `smol-output-size-estimation` | estimate, estimated size, predicted size, ~MB, savings |
