import { useEffect } from "react";
import { useJobsStore } from "@/store/jobs";
import { startSqueeze } from "@/hooks/useCompression";
import { open } from "@tauri-apps/plugin-dialog";
import { getPathInfo } from "@/lib/tauri";
import { fileKindFromPath } from "@/lib/kinds";
import { v4 as uuidv4 } from "uuid";
import type { NewJobInput } from "@/store/jobs";

const VIDEO_EXTS = ["mp4", "mkv", "avi", "mov", "webm", "flv", "m4v"];
const AUDIO_EXTS = ["mp3", "wav", "m4a", "flac", "aac", "ogg"];
const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "heic", "heif", "avif", "bmp", "tiff"];
const PDF_EXTS   = ["pdf"];
const ALL_EXTS   = [...VIDEO_EXTS, ...AUDIO_EXTS, ...IMAGE_EXTS, ...PDF_EXTS];

export function useShortcuts() {
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Escape -> close drawer
      if (e.key === "Escape") {
        import("@/store/ui").then(m => m.useUiStore.getState().setAdvancedOpen(false));
        return;
      }

      // Delete -> remove hovered job
      if (e.key === "Delete") {
        const hovered = useJobsStore.getState().hoveredJobId;
        if (hovered) {
          useJobsStore.getState().removeJob(hovered);
        }
        return;
      }

      // Ctrl + Enter -> Squeeze
      if (e.ctrlKey && e.key === "Enter") {
        const { jobs, jobIds } = useJobsStore.getState();
        const readyIds = jobIds.filter(
          (id) =>
            (jobs[id]?.kind === "video" ||
              jobs[id]?.kind === "audio" ||
              jobs[id]?.kind === "image" ||
              jobs[id]?.kind === "pdf") &&
            jobs[id]?.status === "ready",
        );
        const isSqueezing = jobIds.some(id => jobs[id]?.status === "encoding");
        
        if (readyIds.length > 0 && !isSqueezing) {
          void startSqueeze();
        }
        return;
      }

      // Ctrl + O -> Open files
      if (e.ctrlKey && e.key === "o") {
        e.preventDefault();
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
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
