import { useState, useCallback } from "react";
import type { DragEvent } from "react";
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

  const onDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy"; // prevents 🚫 cursor
    setIsDraggingOver(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      setIsDraggingOver(false);
      const files = Array.from(e.dataTransfer.files);
      // (file as any).path — non-standard but present in WebView2/Chromium (see tauri#13171)
      const paths = files
        .map((f) => (f as File & { path?: string }).path)
        .filter((p): p is string => typeof p === "string" && p.length > 0);
      if (paths.length > 0) {
        void enqueuePaths(paths);
      }
    },
    [enqueuePaths]
  );

  return { isDraggingOver, onDragOver, onDragLeave, onDrop, enqueuePaths };
}
