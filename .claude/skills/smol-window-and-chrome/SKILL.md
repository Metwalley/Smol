---
name: smol-window-and-chrome
description: Use this skill when you are about to configure the main window, edit tauri.conf.json, touch the titlebar, work with drag-drop, or deal with transparent/decorations settings.
---

# Smol Window & Chrome (Option C)

## The pattern: extended client area, system-drawn controls

Smol uses **Option C**: `decorations: true`, `transparent: false`. The OS draws the
min/max/close buttons at the top-right. We extend the client area so our React content
sits underneath those controls. This is the only combination that works reliably on
Windows 11 without the 5-bug history of `transparent: true` + `decorations: false`.

### NEVER do this

```json
{ "decorations": false, "transparent": true }
```

That combination caused 5 of 6 previous bugs (invisible resize handles, white flash on
launch, broken DWM compositing, wrong hit-testing, subpixel rendering artifacts).

---

## Canonical tauri.conf.json windows section

```json
{
  "title": "Smol",
  "width": 1100,
  "height": 720,
  "minWidth": 880,
  "minHeight": 560,
  "decorations": true,
  "transparent": false,
  "dragDropEnabled": false,
  "theme": "Dark"
}
```

`dragDropEnabled: false` is **mandatory** — see HR-5 and the drag-drop section below.

---

## Drag-drop: HTML5 only, never Tauri's built-in

```tsx
// src/hooks/useDragDrop.ts
function onDrop(e: React.DragEvent<HTMLDivElement>) {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files);
  const paths = files.map((f) => (f as any).path).filter(Boolean);
  // pass paths to Rust command get_path_info / list_supported_in_dir
}

function onDragOver(e: React.DragEvent<HTMLDivElement>) {
  e.preventDefault();          // prevents the 🚫 cursor
  e.dataTransfer.dropEffect = "copy";
}
```

Why `(file as any).path`? The Chromium/Electron/WebView2 `File` object exposes the
OS path in `.path` (non-standard). Tauri's own drag-drop fires on the Rust side but is
blocked when `dragDropEnabled: false`; we intentionally disable it so the HTML5 events
work. See tauri#13171.

---

## Rounded corners: toggle on maximize

Windows 11 rounds the window corners in restored state and removes them when maximized.
We match this with a CSS class toggle:

```tsx
// src/hooks/useMaximized.ts
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";

export function useMaximized() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    win.isMaximized().then(setMaximized);
    const unlisten = win.onResized(async () => {
      setMaximized(await win.isMaximized());
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  return maximized;
}
```

```tsx
// src/App.tsx
const maximized = useMaximized();
return (
  <div className={`flex flex-col h-screen bg-zinc-950 text-zinc-100 ${maximized ? "" : "rounded-xl overflow-hidden"}`}>
    ...
  </div>
);
```

---

## Titlebar region

The system controls overlap the top-right corner. Give them room:

```tsx
// src/components/titlebar/Titlebar.tsx
export function Titlebar() {
  return (
    <div
      data-tauri-drag-region
      className="flex items-center h-10 px-4 select-none shrink-0"
    >
      <img src="/logo.svg" className="h-5 w-5 mr-2" alt="Smol" />
      <span className="text-sm font-semibold text-zinc-200">Smol</span>
      {/* system controls are drawn by OS at the right edge — leave ~138px of space */}
    </div>
  );
}
```

`data-tauri-drag-region` makes the element a drag handle without custom JS.

---

## Sonner Toaster: always hardcode theme

```tsx
import { Toaster } from "sonner";

// In App.tsx root — never use next-themes or a ThemeProvider for this
<Toaster theme="dark" position="bottom-right" />
```

Passing `theme={undefined}` or relying on a context causes a crash in Tauri's webview
because `next-themes` reads `document.documentElement.classList` which is not populated
in the same tick as mount.
