import { useState, useCallback, useEffect } from "react";
import type { DragEvent } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { fileKindFromPath } from "@/lib/kinds";
import { getPathInfo, listDirSupported } from "@/lib/tauri";
import { useJobsStore } from "@/store/jobs";
import type { QueuedFile } from "@/store/jobs";

export function useDragDrop() {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const enqueuePaths = useCallback(async (rawPaths: string[]) => {
    const toAdd: Omit<QueuedFile, "addedAt">[] = [];
    const unsupportedExts = new Set<string>();

    for (const path of rawPaths) {
      const info = await getPathInfo(path);
      if (!info.exists) continue;

      if (info.isDir) {
        // Expand folder one level deep via Rust (HR-6)
        const children = await listDirSupported(path);
        for (const child of children) {
          toAdd.push({
            id: uuidv4(),
            path: child.path,
            name: child.name,
            kind: fileKindFromPath(child.name) as import("@/types").FileKind,
            sizeBytes: child.size,
          });
        }
        continue;
      }

      const kind = fileKindFromPath(info.name);
      if (kind === "unsupported") {
        const ext = info.extension ?? info.name.split(".").pop() ?? "unknown";
        unsupportedExts.add(`.${ext}`);
        continue;
      }

      toAdd.push({
        id: uuidv4(),
        path: info.path,
        name: info.name,
        kind,
        sizeBytes: info.size,
      });
    }

    if (unsupportedExts.size > 0) {
      const list = Array.from(unsupportedExts).join(", ");
      toast.error(
        `Unsupported file type: ${list} — Smol handles video, audio, image, and PDF`
      );
    }

    if (toAdd.length > 0) {
      useJobsStore.getState().addPaths(toAdd);
    }
  }, []);

  // Tauri v2 native drag-drop provides absolute filesystem paths.
  // Requires dragDropEnabled: true in tauri.conf.json.
  // HTML5 ondrop is intentionally NOT used — (file as any).path is unavailable in WebView2.
  //
  // Strict Mode double-mount fix: onDragDropEvent() is async (returns Promise<UnlistenFn>).
  // In Strict Mode, React runs cleanup BEFORE the Promise resolves, so `unlisten` would
  // still be undefined at cleanup time — leaving the first listener permanently attached.
  // The `cancelled` flag detects this: if cleanup already ran, we call fn() immediately
  // upon resolution to unregister the listener that otherwise would have leaked.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void getCurrentWebviewWindow()
      .onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type === "enter") {
          setIsDraggingOver(true);
        } else if (payload.type === "drop") {
          setIsDraggingOver(false);
          if (payload.paths.length > 0) {
            void enqueuePaths(payload.paths);
          }
        } else if (payload.type === "leave") {
          setIsDraggingOver(false);
        }
      })
      .then((fn) => {
        if (cancelled) {
          fn(); // cleanup already ran — unregister immediately
        } else {
          unlisten = fn;
        }
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [enqueuePaths]); // enqueuePaths is stable (useCallback []) — effect runs once

  // Prevent browser default drop behaviour (file navigation / open).
  // These React handlers are kept so App.tsx need not change.
  const onDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
  }, []);

  // No-op: actual file paths arrive via Tauri's onDragDropEvent above.
  const onDrop = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
  }, []);

  return { isDraggingOver, onDragOver, onDragLeave, onDrop, enqueuePaths };
}
