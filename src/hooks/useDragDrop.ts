import type { DragEvent } from "react";

interface UseDragDropOptions {
  onFiles: (paths: string[]) => void;
}

export function useDragDrop({ onFiles }: UseDragDropOptions) {
  function onDragOver(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function onDragLeave(e: DragEvent<HTMLElement>) {
    e.preventDefault();
  }

  function onDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const paths = files
      .map((f) => (f as File & { path?: string }).path)
      .filter((p): p is string => typeof p === "string" && p.length > 0);
    if (paths.length > 0) {
      onFiles(paths);
    }
  }

  return { onDragOver, onDragLeave, onDrop };
}
