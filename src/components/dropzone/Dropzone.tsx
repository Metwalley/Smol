import { open } from "@tauri-apps/plugin-dialog";
import { v4 as uuidv4 } from "uuid";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { fileKindFromPath } from "@/lib/kinds";
import { getPathInfo } from "@/lib/tauri";
import { useJobsStore } from "@/store/jobs";
import type { QueuedFile } from "@/store/jobs";
import { useDragDrop } from "@/hooks/useDragDrop";
import { EmptyState } from "./EmptyState";
import { FileList } from "@/components/filelist/FileList";

const VIDEO_EXTS  = ["mp4", "mov", "mkv", "webm", "avi", "m4v", "wmv", "flv"];
const AUDIO_EXTS  = ["mp3", "m4a", "aac", "wav", "flac", "ogg", "opus", "wma"];
const IMAGE_EXTS  = ["jpg", "jpeg", "png", "webp", "heic", "heif", "avif", "bmp", "tiff"];
const PDF_EXTS    = ["pdf"];
const ALL_EXTS    = [...VIDEO_EXTS, ...AUDIO_EXTS, ...IMAGE_EXTS, ...PDF_EXTS];

export function Dropzone() {
  const { isDraggingOver, onDragOver, onDragLeave, onDrop } = useDragDrop();
  const jobCount = useJobsStore((s) => s.jobIds.length);

  async function handleOpenDialog() {
    const selected = await open({
      multiple: true,
      filters: [
        { name: "All supported", extensions: ALL_EXTS },
        { name: "Video",  extensions: VIDEO_EXTS  },
        { name: "Audio",  extensions: AUDIO_EXTS  },
        { name: "Images", extensions: IMAGE_EXTS  },
        { name: "PDF",    extensions: PDF_EXTS    },
      ],
    });

    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];

    const toAdd: Omit<QueuedFile, "addedAt" | "probe" | "thumbnailPath" | "estimateBytes">[] = [];
    for (const path of paths) {
      const info = await getPathInfo(path);
      if (!info.exists) continue;
      const kind = fileKindFromPath(info.name);
      if (kind === "unsupported") continue;
      toAdd.push({
        id: uuidv4(),
        path: info.path,
        name: info.name,
        kind,
        sizeBytes: info.size,
      });
    }
    if (toAdd.length > 0) {
      useJobsStore.getState().addPaths(toAdd);
    }
  }

  return (
    // The whole content area is the drag surface (skill: smol-flex-scroll-fix)
    <div
      className="flex flex-col flex-1 min-h-0"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {jobCount === 0 ? (
        // Empty state: visual dashed-border drop target
        <div
          className={cn(
            "flex flex-col flex-1 items-center justify-center gap-4 m-3 rounded-xl border-2 border-dashed transition-colors",
            isDraggingOver
              ? "border-indigo-500 bg-indigo-950/30"
              : "border-zinc-700 hover:border-zinc-500"
          )}
        >
          <EmptyState />
          <button
            onClick={handleOpenDialog}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
          >
            <Upload className="h-4 w-4" />
            Open files…
          </button>
        </div>
      ) : (
        // Non-empty: compact top bar + FileList (takes remaining flex space)
        <>
          <div
            className={cn(
              "flex items-center justify-between mx-3 mt-3 px-3 py-2 rounded-lg border-2 transition-colors shrink-0",
              isDraggingOver
                ? "border-indigo-500 bg-indigo-950/30"
                : "border-transparent bg-zinc-900/50"
            )}
          >
            <span className="text-zinc-500 text-xs">
              {isDraggingOver ? "Drop to add…" : "Drop files anywhere to add"}
            </span>
            <button
              onClick={handleOpenDialog}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              Add more…
            </button>
          </div>

          {/* FileList fills remaining space; has own min-h-0 chain internally */}
          <FileList />
        </>
      )}
    </div>
  );
}
