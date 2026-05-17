import { open } from "@tauri-apps/plugin-dialog";
import { v4 as uuidv4 } from "uuid";
import { Upload } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { fileKindFromPath } from "@/lib/kinds";
import { getPathInfo } from "@/lib/tauri";
import { useJobsStore } from "@/store/jobs";
import type { QueuedFile } from "@/store/jobs";
import { EmptyState } from "./EmptyState";

const VIDEO_EXTS = ["mp4", "mov", "mkv", "webm", "avi", "m4v", "wmv", "flv"];
const AUDIO_EXTS = ["mp3", "m4a", "aac", "wav", "flac", "ogg", "opus", "wma"];
const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "heic", "heif", "avif", "bmp", "tiff"];
const PDF_EXTS   = ["pdf"];
const ALL_EXTS   = [...VIDEO_EXTS, ...AUDIO_EXTS, ...IMAGE_EXTS, ...PDF_EXTS];

interface DropzoneProps {
  isDraggingOver: boolean;
}

export function Dropzone({ isDraggingOver }: DropzoneProps) {
  const jobCount = useJobsStore((s) => s.jobIds.length);

  async function handleOpenDialog() {
    const selected = await open({
      multiple: true,
      filters: [
        { name: "All supported", extensions: ALL_EXTS },
        { name: "Video",         extensions: VIDEO_EXTS },
        { name: "Audio",         extensions: AUDIO_EXTS },
        { name: "Images",        extensions: IMAGE_EXTS },
        { name: "PDF",           extensions: PDF_EXTS   },
      ],
    });

    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];

    const toAdd: Omit<
      QueuedFile,
      "addedAt" | "probe" | "thumbnailPath" | "estimateBytes" | "pipelineError"
    >[] = [];

    for (const path of paths) {
      const info = await getPathInfo(path);
      if (!info.exists) continue;
      const kind = fileKindFromPath(info.name);
      if (kind === "unsupported") continue;
      toAdd.push({ id: uuidv4(), path: info.path, name: info.name, kind, sizeBytes: info.size });
    }
    if (toAdd.length > 0) {
      useJobsStore.getState().addPaths(toAdd);
    }
  }

  // Outer motion.div: flex-1 when empty (fills container), h-12 when compact.
  // The `layout` prop makes Framer Motion animate the height change (~200 ms easeOut).
  return (
    <motion.div
      layout
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "overflow-hidden",
        jobCount === 0
          ? "flex flex-col flex-1 m-3"
          : "shrink-0 h-12 mx-3 mt-3"
      )}
    >
      <AnimatePresence initial={false} mode="wait">
        {jobCount === 0 ? (
          // ── Empty state ────────────────────────────────────────────────────
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col flex-1"
          >
            {/* whileHover: spring scale on the dashed panel (empty state only) */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={cn(
                "flex flex-col flex-1 items-center justify-center gap-4 min-h-[260px]",
                "rounded-xl border-2 border-dashed transition-colors",
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
            </motion.div>
          </motion.div>
        ) : (
          // ── Compact ~48 px toolbar ─────────────────────────────────────────
          <motion.div
            key="compact"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "flex items-center justify-between h-full px-3 rounded-xl border-2 transition-colors",
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
