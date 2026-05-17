# Smol v1.0 — Build Plan for the Doer

> Repo: <https://github.com/Metwalley/Smol> · License: AGPL-3.0 · Target: Windows 11 x64 desktop, opens to Linux + macOS once stable.
>
> Audience: the AI agent that will write the code. Read top-to-bottom *before* writing a single line. Anything that contradicts this document gets a rejection on review.

---

## PART A — Skill files Smol needs (answer to the first question)

### What I learned from the latest research

- **AGENTS.md** is now the cross-tool open standard (Linux Foundation–stewarded, 60k+ repos, used by Codex / Cursor / Copilot / Gemini CLI / Aider / Claude Code / Devin). Live in repo root. No frontmatter required. Format is just markdown. One paper measured **−28.6 % runtime and −16.6 % tokens across 124 PRs** with a good AGENTS.md ([source](https://www.morphllm.com/agents-md-guide)). This is the *primary* file.
- **`.claude/skills/<skill-name>/SKILL.md`** is Claude's progressive-disclosure layer on top of that. Only the YAML frontmatter (`name` + `description`) is preloaded; the body of `SKILL.md` loads only when triggered, and any `references/` / `scripts/` / `examples/` subfolders load even later, on demand. So we can stash heavy detail here without paying for it on every turn ([Anthropic docs](https://docs.anthropic.com/en/docs/claude-code/skills), [authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)).
- **`CLAUDE.md`** still works for Claude specifically but is being superseded by AGENTS.md. We will make `CLAUDE.md` a symlink to `AGENTS.md` so we satisfy both.
- Skill descriptions must be *slightly pushy* with explicit trigger phrases ("Use this when you are about to configure the main window…", "Use this when adding any file-system access…"). Skills underfire more often than they overfire.
- Skill bodies stay **lean** (under ~1500 words). Long detail goes into `references/`.

### The skill files Smol needs

I picked 10. Each one prevents at least one specific class of bug we've already paid for, OR captures a non-obvious project decision the agent would otherwise reinvent (badly). Listed in dependency order:

| # | Path | Triggers on | Prevents / encodes |
|---|---|---|---|
| 1 | `AGENTS.md` (root) | Always loaded at session start | Project overview, hard rules, layout, build/test commands, the prevention checklist itself in one paragraph |
| 2 | `.claude/skills/smol-window-and-chrome/SKILL.md` | "configure window", "tauri.conf.json", "titlebar", "drag drop", "transparent" | Option C extended titlebar pattern; bans `transparent: true` + `decorations: false`; sets `dragDropEnabled: false` + HTML5 events; conditional rounded corners on `isMaximized`; the entire window section of `tauri.conf.json` |
| 3 | `.claude/skills/smol-zustand-patterns/SKILL.md` | "zustand", "store", "selector", "useStore" | Atomic selectors only; `useShallow` for arrays/objects when needed; actions via `getState()`, never inside selectors; no object-returning selectors |
| 4 | `.claude/skills/smol-rust-fs-bridge/SKILL.md` | "fs.stat", "fs.exists", "fs.metadata", "read file", "@tauri-apps/plugin-fs", "user path" | Never use JS `@tauri-apps/plugin-fs` for paths outside the sandbox; always expose a Rust `#[tauri::command]` and call it via `invoke()`. Lists the canonical Rust commands we use |
| 5 | `.claude/skills/smol-flex-scroll-fix/SKILL.md` | "scroll", "overflow", "max-h", "FileList", "queue" | The `min-h-0` chain pattern — every flex parent in the chain needs `min-h-0`, otherwise nothing scrolls |
| 6 | `.claude/skills/smol-ffmpeg-sidecar/SKILL.md` | "ffmpeg", "compress video", "compress audio", "progress", "encoder", "sidecar" | Use the `ffmpeg-sidecar` Rust crate, not a custom download script. How to wire progress events via `tauri::ipc::Channel`. `-progress pipe:1` parsing. Windows `CREATE_NO_WINDOW` flag. NVENC / QSV / AMF hardware-encoder probing |
| 7 | `.claude/skills/smol-image-compression-rust/SKILL.md` | "compress image", "jpeg", "png", "webp", "avif", "mozjpeg", "oxipng" | Native Rust crates only (`mozjpeg-rs`, `oxipng`, `image-webp`, `ravif`). No sidecar. Per-format quality maps. Strip-metadata flag wiring |
| 8 | `.claude/skills/smol-ghostscript-pdf-sidecar/SKILL.md` | "compress pdf", "ghostscript", "gs", "pdfwrite" | Bundling `gs.exe` (~50 MB) as a Tauri sidecar. The four presets (`/screen`, `/ebook`, `/printer`, `/prepress`). AGPL attribution requirements |
| 9 | `.claude/skills/smol-ui-two-tier-model/SKILL.md` | "advanced options", "settings", "casual", "expert mode" | The Casual / Advanced split rule. Exact list of what stays Casual vs what is gated behind the gear. Anti-pattern: a third tier |
| 10 | `.claude/skills/smol-build-and-release/SKILL.md` | "build installer", "nsis", "github actions", "release", "tauri-action" | GitHub Actions workflow producing `Smol_x64-setup.exe` attached to each release. Tag triggers. Versioning. Code-signing notes |
| 11 | `.claude/skills/smol-licensing-and-attribution/SKILL.md` | "license", "AGPL", "third-party", "NOTICE", "attribution" | What AGPL requires us to ship (source-availability blurb, NOTICE file). How to aggregate FFmpeg's LGPL/GPL, Ghostscript's AGPL, shadcn's MIT, etc. into one `THIRD_PARTY_NOTICES.md` |
| 12 | `.claude/skills/smol-output-size-estimation/SKILL.md` | "estimate", "estimated size", "predicted size", "~MB", "savings" | How to estimate output size per file *before* encoding, per kind (video, audio, image, PDF). Heuristic formulas. When estimates lie (e.g. already-compressed source). Display rules: `~` prefix, fall back to “—” when unknown, never show false precision |

That's 11 skills + `AGENTS.md` + 1 licensing skill = **13 files total**. Anything more is bloat; anything less and we lose a known-painful failure mode.

Phase 0 of the build plan below creates all 12 of these *before* any feature code is written. That way every skill is in context from turn one of the actual implementation.

---

## PART B — The build plan

### 1. Hard rules (these are non-negotiable)

| # | Rule | Why |
|---|---|---|
| HR-1 | **Tauri 2 + React 19 + TS 5 + Vite 6 + Tailwind 4 + shadcn/ui + Zustand + Framer Motion**. No alternates. | Locked stack matches the references that already work |
| HR-2 | **License: AGPL-3.0**, repo public, `LICENSE` file generated by GitHub when the repo was created stays as-is | User decision, validated |
| HR-3 | **Windows 11 x64 only for v1.0**. Cross-platform configs may exist but only `nsis` target is bundled | Ship fast; Linux/macOS later by flipping a flag in CI |
| HR-4 | **Window chrome = Option C** (extended client area, system-drawn controls). NEVER `transparent: true` + `decorations: false` together. | 5 of 6 previous bugs originated from that combo |
| HR-5 | **`dragDropEnabled: false`** in `tauri.conf.json` windows config. Use HTML5 `onDrop` + `(file as any).path`. | Documented Tauri/webview limitation ([tauri#13171](https://github.com/tauri-apps/tauri/issues/13171)) |
| HR-6 | **No JS `@tauri-apps/plugin-fs` calls on user-chosen paths.** Every filesystem op on user data lives in a `#[tauri::command]` in Rust. | Plugin sandbox blocks user paths; this was bug #3 last time |
| HR-7 | **Zustand selectors are atomic.** One field per selector. Actions come from `useStore.getState()` outside React or are themselves atomic selectors. **Never return a new object from a selector.** | Bug #1 — infinite re-render loop |
| HR-8 | **Two-tier UI.** Casual surface is the default; everything else is behind a gear icon. No third tier. | UX decision |
| HR-9 | **Sidecars are versioned and SHA-pinned.** FFmpeg via the `ffmpeg-sidecar` Rust crate (or pinned download in `scripts/`), Ghostscript via a pinned downloader. Never rely on system-installed binaries. | Reproducibility |
| HR-10 | **AGENTS.md + the 11 skill files are committed in Phase 0 *before* any feature code.** | Every later phase must benefit from those prevention nodes |
| HR-11 | **Casual mode never shows codec names, CRF values, bitrate numbers, or hardware-encoder toggles.** Just the four descriptive preset cards + predicted size. The presets are **Less Compression / Recommended / Extreme Compression / Lossless** — each shown with a subtitle ("High quality, larger file" etc.) and **Recommended is the default**. Style inspired by iLovePDF and img2go. | UX clarity — "Low/Medium/High" is ambiguous about which axis is which |
| HR-12 | **GitHub Actions produces every Windows installer.** Local `tauri build` is for dev only. Releases are tag-triggered (`v*.*.*`). | Reproducibility, free Windows runners, no "works on my machine" |
| HR-13 | **Single unified queue, NOT one tab per file kind.** Drop any mix of video/audio/image/PDF into one drop zone; each row in the queue shows its kind badge; an optional filter row above the list lets the user narrow by kind (`All · 12 Videos · 4 Images · …`). Per-kind settings live in the Advanced drawer as Tabs (Video / Audio / Image / PDF), not in the main view. | UX — "drop anything, click Squeeze" is the magic; 4 top tabs would fragment the app into 4 mini-apps and lose the casual feel |
| HR-14 | **Target File Size is an Advanced-only feature.** When set, it overrides the chosen preset on a per-job basis and Smol picks the right CRF/quality via 2-pass FFmpeg for video, binary-search for image/audio. Casual users never see this control. | UX — img2go has it, it’s genuinely useful ("make this ≤ 8 MB so Discord lets me upload it"), but it complicates the casual surface |
| HR-15 | **Estimated output size is shown per preset card AND per queue row.** Each of the four compression-level cards displays a per-job size estimate ("~1.5 MB") that updates live as the user toggles between presets and as new files are added. The queue also shows a running total banner ("Estimated total: 240 MB → ~56 MB · saves ~184 MB"). Estimates use heuristic formulas (skill #12), always prefixed with `~`, and fall back to “—” when the source format is unknown. **Style inspired by Adobe Acrobat’s PDF compressor.** | UX — lets the user choose confidently *before* running, instead of "compress, see the size, redo at a different preset" cycles | |

### 2. Repository layout

```
Smol/
├── AGENTS.md                         # cross-tool agent contract (root, always loaded)
├── CLAUDE.md                         # symlink → AGENTS.md
├── README.md                         # human-facing
├── LICENSE                           # AGPL-3.0 (already created by GitHub)
├── THIRD_PARTY_NOTICES.md            # FFmpeg, Ghostscript, shadcn, etc.
├── .gitignore                        # Node + Rust + Tauri additions
├── .github/
│   └── workflows/
│       └── release.yml               # tauri-action build on tag push
├── .claude/
│   └── skills/
│       ├── smol-window-and-chrome/SKILL.md
│       ├── smol-zustand-patterns/SKILL.md
│       ├── smol-rust-fs-bridge/SKILL.md
│       ├── smol-flex-scroll-fix/SKILL.md
│       ├── smol-ffmpeg-sidecar/SKILL.md
│       ├── smol-image-compression-rust/SKILL.md
│       ├── smol-ghostscript-pdf-sidecar/SKILL.md
│       ├── smol-ui-two-tier-model/SKILL.md
│       ├── smol-build-and-release/SKILL.md
│       └── smol-licensing-and-attribution/SKILL.md
├── package.json
├── pnpm-lock.yaml
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── index.html
├── public/
│   └── logo.svg
├── src/                              # React + TS frontend
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles/
│   │   └── globals.css
│   ├── components/
│   │   ├── titlebar/                 # Custom content inside extended client area
│   │   ├── dropzone/
│   │   ├── filelist/
│   │   ├── settings/                 # Casual + Advanced (Advanced hidden)
│   │   ├── progress/
│   │   ├── results/
│   │   └── ui/                       # shadcn primitives go here
│   ├── store/
│   │   ├── jobs.ts                   # Zustand: queue, status per job
│   │   ├── settings.ts               # Zustand: persisted user settings
│   │   └── ui.ts                     # Zustand: ephemeral (isMaximized, etc.)
│   ├── lib/
│   │   ├── tauri.ts                  # typed wrappers around invoke()
│   │   ├── format.ts                 # bytes, duration, percent
│   │   └── kinds.ts                  # file → kind (video/audio/image/pdf)
│   ├── hooks/
│   │   ├── useDragDrop.ts            # HTML5 drag-drop with file.path
│   │   ├── useMaximized.ts           # subscribes to window state for rounded-corner toggle
│   │   └── useJobProgress.ts         # Tauri channel → store
│   └── types/
│       └── index.ts                  # File kinds, job states, settings shapes
├── scripts/
│   ├── fetch-ffmpeg.mjs              # gyan.dev release-essentials, SHA-pinned
│   └── fetch-ghostscript.mjs         # Artifex, SHA-pinned
└── src-tauri/
    ├── tauri.conf.json
    ├── Cargo.toml
    ├── build.rs
    ├── icons/                        # png+ico sizes; generated by tauri icon
    ├── binaries/                     # sidecar exes land here (gitignored)
    │   ├── ffmpeg-x86_64-pc-windows-msvc.exe
    │   ├── ffprobe-x86_64-pc-windows-msvc.exe
    │   └── gs-x86_64-pc-windows-msvc.exe
    ├── capabilities/
    │   └── default.json
    └── src/
        ├── main.rs
        ├── lib.rs
        ├── commands/
        │   ├── fs.rs                 # get_path_info, ensure_dir, etc.
        │   ├── probe.rs              # probe_media (uses ffprobe sidecar)
        │   ├── thumbnail.rs          # generate_thumbnail
        │   ├── compress_video.rs
        │   ├── compress_audio.rs
        │   ├── compress_image.rs
        │   └── compress_pdf.rs
        ├── jobs/
        │   ├── mod.rs                # job runner + cancellation
        │   └── progress.rs           # parses ffmpeg/gs progress, emits Channel events
        ├── encoders/
        │   ├── hw_detect.rs          # NVENC/QSV/AMF probe
        │   └── ffmpeg_args.rs        # per-codec arg builders
        └── error.rs                  # thiserror, never panics across IPC
```

### 3. The prevention checklist (read before every phase)

Six bugs the previous build paid for. Each one is solved *structurally* (so it cannot be reintroduced), not by patching after the fact:

1. **Zustand infinite re-render** → solved by HR-7. Skill #3 has the eslint rule we will install (`eslint-plugin-react-hooks` + custom rule banning object-returning selectors).
2. **sonner Toaster crash from missing ThemeProvider** → hardcode `theme="dark"` on `<Toaster>`. Never depend on `next-themes`. Spelled out in skill #2.
3. **`fs.stat` not allowed on user paths** → HR-6. Skill #4 gives the Rust command set we expose; the JS fs plugin is never imported.
4. **FileList doesn't scroll** → skill #5. Every flex parent in the chain has `min-h-0`. We add a Tailwind-based lint pattern in Phase 0.
5. **Rounded corners visible when maximized** → `useMaximized()` hook subscribes once to the Tauri window event and toggles the `rounded-xl` class. Spelled out in skill #2.
6. **Drag-drop "🚫" cursor** → HR-5, skill #2 + skill #6. `dragDropEnabled: false`, HTML5 `onDrop`, `(file as any).path`. There is no other way; the Tauri team has said so on the issue tracker.

### 3a. UI layout at a glance

```
+--------------------------------------------------------------+
| [Smol logo]              (system min / max / close controls) |  <- extended client area, Option C
+--------------------------------------------------------------+
|                                                              |
|   Drop your files here   or click to choose      ⚙ Advanced  |  <- main drop zone, gear icon top-right
|                                                              |
+--------------------------------------------------------------+
|  Estimated total: 263 MB → ~58 MB · saves ~205 MB (78%)      |  <- HR-15 banner, hides when queue empty
+--------------------------------------------------------------+
|  All (12)  Videos (5)  Audio (2)  Images (4)  PDFs (1)       |  <- type-filter chip row (HR-13)
+--------------------------------------------------------------+
|  [thumb] meeting-rec.mp4   240MB  09:23  ~32 MB  [video]  ×  |
|  [thumb] voice-memo.m4a     12MB  02:11   ~3 MB  [audio]  ×  |  <- single unified queue
|  [thumb] header.png        2.1MB  3000x   ~410 KB [image] ×  |  <- per-row estimate, HR-15
|  [thumb] receipt.pdf       8.4MB    7p   ~1.2 MB  [pdf]   ×  |
|  …                                                            |
+--------------------------------------------------------------+
|  Compression level:                                          |
|  ○ Less Comp.    ◉ Recommended    ○ Extreme    ○ Lossless  |
|    ~84 MB         ~58 MB             ~22 MB         —       |  <- per-card estimate for whole queue
|  Output: ◉ Same folder  ○ smol/ subfolder  ○ Choose folder  |
|                                          [ Squeeze ]         |
+--------------------------------------------------------------+
```

The Advanced drawer slides in from the right when the ⚙ gear is clicked. Inside the drawer: 4 inner tabs (Video / Audio / Image / PDF) + a Global section at top with Target File Size and Parallel-job count.

Reject the alternative "4 floating tabs across the top" pattern: it forces the user to declare what kind of file they're working with *before* they drop, which contradicts the "drop anything, click Squeeze" promise.

### 4. Build order — 13 phases, each with a definition of done

> Hard rule: do not start phase N+1 until every DoD item on phase N is checked. Each DoD item is testable.

#### Phase 0 — Repo scaffold + skill files + AGENTS.md
- [ ] `pnpm create tauri-app@latest` with React + TS template; collapse into the repo
- [ ] Install: `tailwindcss`, `@tailwindcss/vite`, `shadcn` CLI, `zustand`, `framer-motion`, `sonner`, `lucide-react`, `clsx`, `tailwind-merge`
- [ ] Cargo deps: `ffmpeg-sidecar`, `thiserror`, `serde`, `serde_json`, `tokio` (rt-multi-thread), `uuid`
- [ ] `.gitignore` updated with: `src-tauri/target/`, `src-tauri/binaries/`, `dist/`, `node_modules/`, `.DS_Store`, `*.log`
- [ ] Write all 11 skill files + AGENTS.md exactly per Part A of this doc
- [ ] Symlink `CLAUDE.md` → `AGENTS.md` (Windows: use `mklink`)
- [ ] First commit lands the scaffold + skill files only, no feature code yet
- **DoD**: `pnpm tauri dev` opens an empty window. `pnpm lint` and `pnpm tsc --noEmit` both clean. Repo on GitHub shows the AGENTS.md preview at the top.

#### Phase 1 — Window + chrome + dark surface (the "looks-right empty shell")
- [ ] `tauri.conf.json` windows config matches skill #2 exactly: `decorations: true`, `transparent: false`, `dragDropEnabled: false`, `minWidth: 880`, `minHeight: 560`, `width: 1100`, `height: 720`, `theme: "Dark"`, `title: "Smol"`
- [ ] App renders one continuous dark surface; system controls (Min/Max/Close) overlap the top-right of the content cleanly
- [ ] `useMaximized()` hook drives a `rounded-xl` class on the root container — rounded when restored, square when maximized
- [ ] Dark Tailwind theme + shadcn tokens installed; sonner Toaster mounted with `theme="dark"` hardcoded
- **DoD**: window opens, drags from any non-control point, maximizes cleanly (no half-rounded artifacts), minimize/close work, no React warnings in devtools.

#### Phase 2 — Drag-drop + file picker + kind detection
- [ ] HTML5 onDrop handler reads `e.dataTransfer.files`, pulls `(file as any).path` for each entry
- [ ] "Open files…" button using Tauri's `@tauri-apps/plugin-dialog`
- [ ] Rust command `get_path_info(path) -> { exists, size, is_dir }` (skill #4)
- [ ] Rust command `list_dir_videos_audio_images_pdfs(path) -> Vec<PathInfo>` for dropping folders
- [ ] Frontend `lib/kinds.ts` maps extension → `'video' | 'audio' | 'image' | 'pdf' | 'unsupported'`
- [ ] Drop zone shows live cursor feedback (no 🚫)
- **DoD**: dragging any video, audio, image, PDF, or folder onto the window enqueues entries in a Zustand store. Dragging an unsupported type rejects with a toast and no crash.

#### Phase 3 — File list UI + media probe + thumbnails
- [ ] FileList component with the `min-h-0` chain (skill #5). Visually verify scroll works at 20+ entries
- [ ] **Type-filter chip row** above the list: `All (n) · Videos (n) · Audio (n) · Images (n) · PDFs (n)`. Clicking a chip filters the list; `All` is selected by default. Counts hide when zero. This is HR-13 made visible.
- [ ] **Per-row estimated output size** (right of duration, before the kind badge): `~1.5 MB`. Recomputed on every preset change. Skill #12 provides the per-kind formulas.
- [ ] **Queue total banner** above the chip row when at least one file is queued: `Estimated total: 240 MB → ~56 MB · saves ~184 MB (77%)`. Banner hides when the queue is empty.
- [ ] Rust command `probe_media(path)` using `ffprobe` sidecar — returns duration, dimensions, codec, bitrate
- [ ] Rust command `generate_thumbnail(path, output_dir) -> Result<ThumbnailKind, AppError>` per kind, with a strict fallback chain:
  - **Video** — `ffmpeg -ss 10% -i INPUT -vframes 1 -vf "scale=256:-1" OUT.jpg`. If a 4K source picks a black frame, retry at 25 %.
  - **Image** — Rust `image` crate, decode → resize to fit 256 × 256, re-encode as JPEG q80. (Source format stays whatever; thumbnail is JPEG so the React `<img>` always renders.)
  - **Audio** — fallback chain, in order:
    1. **Embedded cover art** via the `lofty-rs` crate (MIT, reads ID3/Vorbis/M4A picture frames). Most music + podcasts have this.
    2. **Generated waveform** via FFmpeg: `ffmpeg -i INPUT -filter_complex "showwavespic=s=256x128:colors=#7AB7FF" OUT.png`. Looks real, not generic.
    3. **Kind icon** (static SVG) — for files that defeat both above (super-short voice memos, corrupted tags).
  - **PDF** — render the first page via Ghostscript: `gswin64c -sDEVICE=png16m -dFirstPage=1 -dLastPage=1 -r36 -o OUT.png INPUT.pdf`. r=36 keeps it tiny (~256 px wide for letter-size). Use the bundled `gs.exe` we already have.
  - **All kinds** — if the relevant command exits non-zero or the output file is < 1 KB, fall back to the kind's static SVG icon. No errors propagate to the queue UI.
- [ ] Thumbnails are cached at `app_data_dir/thumbs/<sha256-of-(path+mtime)>.png` so re-dropping the same file is instant. Cache eviction = LRU at 500 entries.
- [ ] Each row: thumbnail, filename, size, duration/dimensions, **kind badge (video/audio/image/PDF)**, remove × button
- **DoD**: drop 30 mixed files (mix of video + audio + image + PDF). All probe + thumbnail. Filter chips show correct counts and filter the list instantly. List scrolls smoothly. No layout jitter.

#### Phase 4 — Zustand job store + state machine
- [ ] `jobs.ts` store: jobs as a map keyed by uuid; states = `queued | probing | thumbnailing | ready | encoding | done | failed | cancelled`
- [ ] Each job has `progress` (0–100), `speed` (e.g. "2.4×"), `eta` (seconds), `inputBytes`, `outputBytes`
- [ ] Selectors are atomic: `useJob(id)`, `useAllJobIds()`, `useJobStatus(id)`, etc.
- [ ] Actions live outside React on `useJobsStore.getState()` (skill #3)
- **DoD**: adding/removing/reordering jobs causes only the affected row to re-render, verified with React DevTools profiler.

#### Phase 5 — Two-tier Settings UI (Casual default, Advanced hidden)
- [ ] **Casual** (default visible) — four compression-level cards, picked via radio. Style inspired by iLovePDF + img2go + Adobe Acrobat:
  | Card | Subtitle | Live estimate (per-job) | Default? |
  |---|---|---|---|
  | **Less Compression** | High quality, larger file | `~1.7 MB` | |
  | **Recommended** | Good quality, good compression | `~1.5 MB` | ⭐ default, badged |
  | **Extreme Compression** | Smaller file, lower quality | `~803 KB` | |
  | **Lossless** | No quality loss, modest compression | `~2.1 MB` (only enabled for image + audio + PDF — not video) | |
- [ ] Per HR-15: each card’s estimate updates live when the queue changes or another preset is hovered. When the queue contains multiple files of mixed kinds, the card shows the **summed estimate across the entire queue**, not the first file.
- [ ] Below the cards: Output mode (Same folder as source / Subfolder `smol/` / Choose folder), filename pattern (default `{name}_smol{ext}`), Start button
- [ ] **Advanced** (gear icon → right-side drawer with 4 inner tabs: Video / Audio / Image / PDF):
  - Video: codec (H.264 / H.265 / AV1), CRF slider, resolution scale (Original / 4K / 1080p / 720p / 480p / Custom), fps cap, hardware-encoder selector (Auto / NVENC / QSV / AMF / None), audio bitrate, FastStart, strip-metadata
  - Audio: codec (MP3 / AAC / Opus / FLAC / WAV), bitrate, sample rate
  - Image: output format (Keep / JPEG / PNG / WebP / AVIF), quality per format, resize (Fit / Exact / off), strip-metadata
  - PDF: preset (`/screen` / `/ebook` / `/printer` / `/prepress`), explicit DPI override, downsample threshold
  - Global (top of drawer): **Target File Size** (optional, MB or %), Parallel-job count (default 4)
- [ ] Settings persisted via `@tauri-apps/plugin-store` (the *store* plugin, which is fine — not the *fs* plugin)
- [ ] **Hide rule**: Advanced drawer is closed by default, opens with a Framer Motion slide from the right. No advanced controls leak into the main view.
- **DoD**: a casual user can compress with three clicks (drop → pick card → Start). An advanced user finds every per-kind knob in the drawer.

#### Phase 6 — Video compression (the biggest single feature)
- [ ] Rust hardware-encoder probe at app startup: try `h264_nvenc`, `h264_qsv`, `h264_amf` once on app boot; cache result (skill #6)
- [ ] FFmpeg arg builder maps the four compression presets → CRF + ffmpeg `-preset` + encoder. Suggested H.264 mapping: **Less Compression** = CRF 18 / `slow`, **Recommended** = CRF 23 / `medium`, **Extreme Compression** = CRF 30 / `medium`. (**Lossless** is hidden for video in v1.0 — see HR-11.)
- [ ] `compress_video(job_id, input, output, settings)` Rust command spawns `ffmpeg-sidecar` with `-progress pipe:1` and a `tauri::ipc::Channel<ProgressEvent>` callback
- [ ] Progress event: `{ jobId, fraction, fps, speed, etaSec, currentBytes }`
- [ ] Windows-specific: pass `CREATE_NO_WINDOW` flag so no console pops up
- [ ] Cancel sends SIGINT (kill on Windows) and unwinds the temp file
- [ ] If output > input, keep original and emit `OutputLargerEvent` (skill #6)
- **DoD**: a 600 MB 4K screen recording → ~30 MB H.264 with no visible quality loss, hardware-encoded if available, in under real-time, with live progress + ETA + speed.

#### Phase 7 — Audio compression
- [ ] Reuse FFmpeg sidecar. Codecs: MP3 (libmp3lame), AAC, Opus, FLAC, WAV
- [ ] Casual quality maps to bitrate per codec
- [ ] Same `Channel<ProgressEvent>` plumbing
- **DoD**: a 50 MB WAV → ~5 MB 192 kbps MP3.

#### Phase 8 — Image compression (native Rust, no sidecar)
- [ ] `mozjpeg` crate for JPEG, `oxipng` for PNG, `image-webp` for WebP, `ravif` for AVIF
- [ ] Casual quality maps per-format: JPEG q (50/65/80/95), PNG opt level (4/6), WebP q, AVIF q+speed
- [ ] Strip-metadata flag wired from Advanced
- [ ] Parallel job runner respects the Advanced "parallel-job count" setting; default 4
- **DoD**: a 3000×2000 PNG → smaller PNG with no visible change; same image as WebP at quality 80 → ~80 % smaller.

#### Phase 9 — PDF compression (Ghostscript sidecar)
- [ ] `scripts/fetch-ghostscript.mjs` downloads Artifex `gswin64c.exe` for x64 Windows, pinned by SHA
- [ ] `gs.exe` registered as Tauri sidecar (`-x86_64-pc-windows-msvc.exe` suffix)
- [ ] Casual preset → `-dPDFSETTINGS` mapping: **Less Compression** = `/printer`, **Recommended** = `/ebook`, **Extreme Compression** = `/screen`, **Lossless** = pass-through linearize via `qpdf` (no image recompression)
- [ ] Advanced: explicit DPI override (`-dColorImageResolution`, `-dGrayImageResolution`, `-dMonoImageResolution`)
- [ ] Progress: Ghostscript doesn't emit clean progress; we parse the `%%[ Page: N ]%%` lines from stderr and divide by `probe_pdf_page_count` (we ran ffprobe equivalent at intake — actually we use `gs -dNODISPLAY -c '...numpages...'` or read trailer via a tiny Rust crate like `lopdf`)
- [ ] AGPL notice appended to THIRD_PARTY_NOTICES.md (skill #11)
- **DoD**: a 50 MB scanned PDF → ~5 MB at `/ebook` with readable text and acceptable image quality.

#### Phase 10 — Results screen + success animation + savings count-up
- [ ] When a job finishes: row collapses into a one-line "Done" card with `78 MB → 9 MB · saved 88 %`
- [ ] Framer Motion: count-up animation on saved bytes (1 s, ease-out)
- [ ] Animated checkmark draws in (200 ms)
- [ ] No confetti
- [ ] Bulk batch completion: a banner at the top of the queue summing total savings with "Open output folder" button
- **DoD**: looks intentional and grown-up, not cartoony. Demo screenshot worthy.

#### Phase 11 — Icons + branding
- [ ] Logo: a stylized "S" being squeezed inward — provided separately or generated with a vector tool, monochrome on dark
- [ ] Run `pnpm tauri icon path/to/logo.png` to generate every ico/png size
- [ ] Window icon + taskbar icon both populate
- **DoD**: app shows the Smol logo in titlebar, taskbar, and Alt+Tab.

#### Phase 12 — NSIS installer + GitHub Actions release pipeline
- [ ] `tauri.conf.json` bundle.targets = `["nsis"]`; `bundle.windows.nsis.template` left default
- [ ] Custom installer artwork (banner + sidebar)
- [ ] `.github/workflows/release.yml` from skill #10: triggered on `v*.*.*` tag, runs on `windows-latest`, uses `tauri-apps/tauri-action@v0`, attaches `Smol_x.y.z_x64-setup.exe` to the GitHub Release
- [ ] Tag a `v0.1.0` release; verify a clean Windows 11 VM can double-click the installer
- **DoD**: <https://github.com/Metwalley/Smol/releases/latest> has a working `.exe`. Installing it on a fresh Windows 11 gives you Smol in the Start menu. SmartScreen warning is the only friction (expected without code signing).

#### Phase 13 — Testing checklist (run all before declaring v1.0)
- [ ] Smoke: app launches, window draggable, all 4 controls work
- [ ] Drag-drop: from Explorer onto window — cursor shows accept, drop works
- [ ] Drag-drop: large batch (50 files) doesn't freeze UI
- [ ] Video compress: 600 MB MP4 → smaller MP4 with NVENC (if available) and software fallback
- [ ] Audio compress: WAV → MP3
- [ ] Image compress: PNG → smaller PNG; PNG → WebP
- [ ] PDF compress: scanned 50 MB PDF → smaller PDF
- [ ] Cancel mid-job: kills FFmpeg/GS, cleans temp file, marks job cancelled
- [ ] Output-larger-than-input: keeps original
- [ ] Output name collision: appends `_2`, `_3`
- [ ] Settings persist across app restart
- [ ] Casual user path: drop → quality → Start — three interactions, nothing else visible
- [ ] Advanced drawer opens, all knobs work, closes back cleanly
- [ ] Maximize: rounded corners disappear; restore: they come back
- [ ] No console warnings in production build
- [ ] Installer install + uninstall cleanly on a fresh Windows 11 VM

### 5. Data model

```ts
// src/types/index.ts (informative; the Doer chooses idiomatic Rust mirrors)
type FileKind = "video" | "audio" | "image" | "pdf";

type JobStatus =
  | "queued" | "probing" | "thumbnailing" | "ready"
  | "encoding" | "done" | "failed" | "cancelled";

interface MediaProbe {
  durationSec?: number;
  width?: number;
  height?: number;
  fps?: number;
  videoCodec?: string;
  audioCodec?: string;
  pageCount?: number;       // PDF
  bitrateKbps?: number;
  containerFormat?: string;
}

interface Job {
  id: string;
  inputPath: string;
  outputPath?: string;
  kind: FileKind;
  status: JobStatus;
  progress: number;          // 0..1
  speed?: string;            // "2.4×"
  etaSec?: number;
  inputBytes: number;
  outputBytes?: number;
  probe?: MediaProbe;
  thumbnailPath?: string;
  errorMessage?: string;
}

type CompressionPreset = "less" | "recommended" | "extreme" | "lossless";

interface TargetFileSize {
  mode: "absolute" | "percent";
  value: number;                 // MB if absolute, % if percent
}

interface Settings {
  preset: CompressionPreset;            // default "recommended"
  targetFileSize?: TargetFileSize;      // optional, Advanced-only, overrides preset
  outputMode: "same-folder" | "subfolder" | "custom";
  customOutputDir?: string;
  filenamePattern: string;              // default "{name}_smol{ext}"
  parallelJobs: number;                 // default 4
  // Advanced — per-kind overrides
  advanced: {
    video?: { codec?: "h264"|"h265"|"av1"; crf?: number; scale?: number; fps?: number; hwEncoder?: "auto"|"nvenc"|"qsv"|"amf"|"none"; audioKbps?: number; faststart?: boolean; stripMetadata?: boolean; };
    audio?: { codec?: "mp3"|"aac"|"opus"|"flac"|"wav"; kbps?: number; sampleRate?: number; };
    image?: { format?: "keep"|"jpeg"|"png"|"webp"|"avif"; quality?: number; resize?: { mode: "fit"|"exact"|"off"; w?: number; h?: number }; stripMetadata?: boolean; };
    pdf?:   { preset?: "screen"|"ebook"|"printer"|"prepress"; dpi?: number; downsampleThreshold?: number; };
  };
}
```

### 6. IPC commands the Doer will implement

```rust
// src-tauri/src/commands/*.rs — signatures only
#[tauri::command] fn get_path_info(path: String) -> Result<PathInfo>;
#[tauri::command] fn list_supported_in_dir(path: String) -> Result<Vec<PathInfo>>;
#[tauri::command] fn probe_media(path: String) -> Result<MediaProbe>;
#[tauri::command] fn generate_thumbnail(path: String, out_dir: String) -> Result<String>;
#[tauri::command] fn detect_hw_encoders() -> Result<HwEncoders>;

#[tauri::command] fn compress_video(job_id: String, input: String, output: String, settings: VideoSettings, on_event: Channel<ProgressEvent>) -> Result<()>;
#[tauri::command] fn compress_audio(job_id: String, input: String, output: String, settings: AudioSettings, on_event: Channel<ProgressEvent>) -> Result<()>;
#[tauri::command] fn compress_image(job_id: String, input: String, output: String, settings: ImageSettings, on_event: Channel<ProgressEvent>) -> Result<()>;
#[tauri::command] fn compress_pdf(job_id: String, input: String, output: String, settings: PdfSettings, on_event: Channel<ProgressEvent>) -> Result<()>;

#[tauri::command] fn cancel_job(job_id: String) -> Result<()>;
#[tauri::command] fn reveal_in_explorer(path: String) -> Result<()>;
```

### 7. FFmpeg command templates (canonical, not exhaustive)

```text
# H.264 software, CRF
ffmpeg -y -i INPUT -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -movflags +faststart -progress pipe:1 OUTPUT

# H.264 NVENC
ffmpeg -y -hwaccel cuda -i INPUT -c:v h264_nvenc -preset p5 -cq 23 -c:a aac -b:a 128k -movflags +faststart -progress pipe:1 OUTPUT

# H.265 (HEVC) NVENC
ffmpeg -y -hwaccel cuda -i INPUT -c:v hevc_nvenc -preset p5 -cq 26 -c:a aac -b:a 128k -tag:v hvc1 -progress pipe:1 OUTPUT

# AV1 SVT
ffmpeg -y -i INPUT -c:v libsvtav1 -crf 30 -preset 6 -c:a libopus -b:a 96k -progress pipe:1 OUTPUT

# Resolution scale (1080p, keep AR)
-vf "scale=-2:1080"

# Audio: MP3
ffmpeg -y -i INPUT -c:a libmp3lame -b:a 192k -progress pipe:1 OUTPUT

# Audio: Opus
ffmpeg -y -i INPUT -c:a libopus -b:a 96k -progress pipe:1 OUTPUT
```

### 8. Risks + mitigations

| Risk | Mitigation |
|---|---|
| Drag-drop regression on a future Tauri version | Pin Tauri exact minor; integration test in CI that simulates drop |
| FFmpeg or Ghostscript download breaks (URL change) | Pin SHA; fall back script that errors loudly in CI |
| Code-signing not done → SmartScreen warning | Acceptable for v1.0; document in README; revisit after enough installs |
| AGPL anxiety from contributors | Document policy clearly in CONTRIBUTING.md |
| Installer size > 200 MB (Ghostscript adds ~50 MB) | Acceptable; FFmpeg + GS + WebView bootstrap is the floor. Aim ≤ 180 MB |
| Bundled Ghostscript breaks AGPL boundary | Treat GS as a separately-licensed sidecar binary; user runs it as a process, not as a linked lib. Standard pattern (every PDF compressor does this) |

### 9. Definition of done for v1.0

- All 13 phase DoDs checked.
- All 16 testing-checklist items pass on a fresh Windows 11 VM.
- A user can install Smol, drop a 600 MB screen recording, click Start, get a ~30 MB MP4 in their Downloads folder — without ever opening Advanced.
- Repo has 1 release, 1 `.exe` asset, AGENTS.md visible, 10 skill files committed, AGPL-3.0 license attached.

---

## PART C — Operating rules for the Doer

These are short rules that the Doer should treat as eslint-level invariants:

1. **Read AGENTS.md and the 10 skill files first.** Every phase invokes ≥ 1 skill. Do not improvise around them.
2. **One commit per phase**, with phase number in the message: `feat(p3): file list + media probe + thumbnails`.
3. **Open a PR per phase**. Each PR description includes the DoD checklist with boxes ticked. Reviewer (the human) merges.
4. **No silent stack changes.** Want to use Bun instead of pnpm? Open an issue, get approval, then change.
5. **No TODO comments.** Either do it now or open a tracking issue.
6. **No `console.log` in committed code.** Use the `log` Rust crate + a tiny `lib/log.ts` wrapper.
7. **Every Rust command returns `Result<T, AppError>`.** No `unwrap()`, no `expect()` in command bodies.
8. **Every React component file ≤ 200 lines.** Split otherwise.
9. **No mocking core flows.** If FFmpeg integration isn't ready yet, the UI just shows "queued" — do not fake progress.
10. **Stop at end of each phase and report.** Reviewer signs off before moving on.

---

End of plan. Send corrections to the reviewer before any commits.
