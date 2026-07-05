import { open } from "@tauri-apps/plugin-dialog";
import { v4 as uuidv4 } from "uuid";
import { Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { fileKindFromPath } from "@/lib/kinds";
import { getPathInfo } from "@/lib/tauri";
import { useJobsStore } from "@/store/jobs";
import type { NewJobInput } from "@/store/jobs";
import { EmptyState } from "./EmptyState";

const VIDEO_EXTS = ["mp4", "mov", "mkv", "webm", "avi", "m4v", "wmv", "flv"];
const AUDIO_EXTS = ["mp3", "m4a", "aac", "wav", "flac", "ogg", "opus", "wma"];
const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "heic", "heif", "avif", "bmp", "tiff"];
const PDF_EXTS   = ["pdf"];
const ALL_EXTS   = [...VIDEO_EXTS, ...AUDIO_EXTS, ...IMAGE_EXTS, ...PDF_EXTS];

interface DropzoneProps {
  isDraggingOver: boolean;
  hasFiles: boolean;
}

export function Dropzone({ isDraggingOver, hasFiles }: DropzoneProps) {

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

    const toAdd: NewJobInput[] = [];

    for (const path of paths) {
      const info = await getPathInfo(path);
      if (!info.exists) continue;
      const kind = fileKindFromPath(info.name);
      if (kind === "unsupported") continue;
      toAdd.push({ id: uuidv4(), inputPath: info.path, name: info.name, kind, inputBytes: info.size });
    }
    if (toAdd.length > 0) {
      useJobsStore.getState().addFiles(toAdd);
    }
  }

  function handleClearAll() {
    const currentState = useJobsStore.getState();
    const prevJobs = { ...currentState.jobs };
    const prevJobIds = [...currentState.jobIds];
    const count = prevJobIds.length;
    
    currentState.clear();
    
    toast(`Cleared ${count} files`, {
      action: {
        label: "Undo",
        onClick: () => {
          useJobsStore.setState({ jobs: prevJobs, jobIds: prevJobIds });
        },
      },
      duration: 4000,
    });
  }

  // Outer motion.div: flex-1 when empty (fills container), h-12 when compact.
  // The `layout` prop makes Framer Motion animate the height change (~200 ms easeOut).
  return (
    <motion.div
      layout
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "overflow-hidden",
        !hasFiles
          ? "flex flex-col flex-1 m-3"
          : "shrink-0 h-12 mx-3 mt-3"
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {!hasFiles ? (
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
                  ? "border-indigo-500 bg-indigo-950/30 shadow-lg shadow-indigo-500/20"
                  : "border-zinc-700 hover:border-zinc-500"
              )}
            >
              <motion.div
                animate={{ scale: isDraggingOver ? 1.2 : 1, y: isDraggingOver ? -5 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="text-zinc-600 mb-2"
              >
                <Upload className="h-10 w-10 opacity-50" />
              </motion.div>
              <EmptyState isDraggingOver={isDraggingOver} />
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
                ? "border-indigo-500 bg-indigo-950/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                : "border-transparent bg-zinc-900/50"
            )}
          >
            <span className="text-zinc-500 text-xs transition-colors flex items-center gap-2">
              <motion.div animate={{ y: isDraggingOver ? -2 : 0, opacity: isDraggingOver ? 1 : 0.5 }}>
                <Upload className="h-4 w-4" />
              </motion.div>
              {isDraggingOver ? <span className="text-indigo-400">Release to add…</span> : "Drop files anywhere to add"}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 text-xs transition-colors"
                title="Clear all files from queue"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear all
              </button>
              <button
                onClick={handleOpenDialog}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                Add more…
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
