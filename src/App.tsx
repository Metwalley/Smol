import { LayoutGroup, motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import { Titlebar } from "@/components/titlebar/Titlebar";
import { Dropzone } from "@/components/dropzone/Dropzone";
import { FileList } from "@/components/filelist/FileList";
import { QueueTotalBanner } from "@/components/filelist/QueueTotalBanner";
import { PresetCards } from "@/components/settings/PresetCards";
import { startSqueeze } from "@/hooks/useCompression";
import { OutputControls } from "@/components/settings/OutputControls";
import { AdvancedDrawer } from "@/components/settings/AdvancedDrawer";
import { useMaximized } from "@/hooks/useMaximized";
import { useDragDrop } from "@/hooks/useDragDrop";
import { useShortcuts } from "@/hooks/useShortcuts";
import { useJobsStore } from "@/store/jobs";

export default function App() {
  const maximized  = useMaximized();
  useShortcuts();
  const { isDraggingOver, onDragOver, onDragLeave, onDrop } = useDragDrop();
  const jobCount   = useJobsStore((s) => s.jobIds.length);

  // Lag the "has files" signal by one animation cycle (250ms).
  // Without this, Dropzone switches from compact→empty at the exact moment
  // Clear All fires, causing the empty state to race against the exiting
  // file list, filter chips, and preset cards — creating the flash in the middle.
  const [laggedHasFiles, setLaggedHasFiles] = useState(jobCount > 0);
  const lagTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (jobCount > 0) {
      if (lagTimer.current) clearTimeout(lagTimer.current);
      setLaggedHasFiles(true);
    } else {
      lagTimer.current = setTimeout(() => setLaggedHasFiles(false), 250);
    }
    return () => { if (lagTimer.current) clearTimeout(lagTimer.current); };
  }, [jobCount]);

  useEffect(() => {
    const handleAutoSqueeze = () => {
      void startSqueeze();
    };
    window.addEventListener("smol-auto-squeeze", handleAutoSqueeze);
    return () => window.removeEventListener("smol-auto-squeeze", handleAutoSqueeze);
  }, []);

  return (
    <div
      className={`flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden ${
        maximized ? "" : "rounded-xl"
      }`}
    >
      <Titlebar />

      {/* Drag handlers cover the entire content area so drops work over FileList too */}
      <LayoutGroup>
        <div
          className="flex flex-col flex-1 min-h-0 relative"
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {/* Dropzone: flex-1 when empty, shrinks to h-12 toolbar when populated.
              Uses motion.div layout internally for the animated height collapse. */}
          <Dropzone isDraggingOver={isDraggingOver} hasFiles={laggedHasFiles} />

          {/* Main content block wrapped in AnimatePresence mode="popLayout" */}
          <AnimatePresence mode="popLayout">
            {jobCount > 0 && (
              <motion.div
                key="content"
                layout
                className="flex flex-col flex-1 min-h-0 w-full"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20, pointerEvents: "none" }}
                transition={{ duration: 0.2 }}
              >
                <FileList />
                
                <QueueTotalBanner />
                
                <div className="px-3 pb-3 shrink-0">
                  <PresetCards />
                  <OutputControls />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </LayoutGroup>

      {/* Advanced drawer */}
      <AdvancedDrawer />

      {/* Hardcode theme="dark" — never rely on system theme detection (bug #2) */}
      <Toaster theme="dark" position="bottom-right" closeButton />
    </div>
  );
}
