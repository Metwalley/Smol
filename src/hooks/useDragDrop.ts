import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { fileKindFromPath } from "@/lib/kinds";
import { getPathInfo, listDirSupported } from "@/lib/tauri";
import { useJobsStore } from "@/store/jobs";
import type { NewJobInput } from "@/store/jobs";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

export function useDragDrop() {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const enqueuePaths = useCallback(async (rawPaths: string[]) => {
    const toAdd: NewJobInput[] = [];
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
            inputPath: child.path,
            name: child.name,
            kind: fileKindFromPath(child.name) as import("@/types").FileKind,
            inputBytes: child.size,
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
        inputPath: info.path,
        name: info.name,
        kind,
        inputBytes: info.size,
      });
    }

    if (unsupportedExts.size > 0) {
      const list = Array.from(unsupportedExts).join(", ");
      toast.error(
        `Unsupported file type: ${list} — Smol handles video, audio, image, and PDF`
      );
    }

    if (toAdd.length > 0) {
      useJobsStore.getState().addFiles(toAdd);
    }
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let mounted = true;
    const setup = async () => {
      const win = getCurrentWebviewWindow();
      const u = await win.onDragDropEvent((event) => {
        if (event.payload.type === "over" || event.payload.type === "enter") {
          setIsDraggingOver(true);
        } else if (event.payload.type === "leave") {
          setIsDraggingOver(false);
        } else if (event.payload.type === "drop") {
          setIsDraggingOver(false);
          const rawPaths = event.payload.paths;
          if (rawPaths && rawPaths.length > 0) {
            void enqueuePaths(rawPaths);
          }
        }
      });
      if (!mounted) {
        u();
      } else {
        unlisten = u;
      }
    };
    void setup();
    return () => {
      mounted = false;
      if (unlisten) unlisten();
    };
  }, [enqueuePaths]);

  // We expose onDragOver/Leave to the full-window container just to prevent default
  // browser behaviors if needed, though Tauri usually handles it natively now.
  const onDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
  }, []);

  return { isDraggingOver, onDragOver, onDragLeave, onDrop, enqueuePaths };
}
