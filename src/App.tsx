import { LayoutGroup, motion, AnimatePresence } from "framer-motion";
import { Toaster } from "sonner";
import { Titlebar } from "@/components/titlebar/Titlebar";
import { Dropzone } from "@/components/dropzone/Dropzone";
import { FileList } from "@/components/filelist/FileList";
import { QueueTotalBanner } from "@/components/filelist/QueueTotalBanner";
import { PresetCards } from "@/components/settings/PresetCards";
import { OutputControls } from "@/components/settings/OutputControls";
import { AdvancedDrawer } from "@/components/settings/AdvancedDrawer";
import { useMaximized } from "@/hooks/useMaximized";
import { useDragDrop } from "@/hooks/useDragDrop";
import { useJobsStore } from "@/store/jobs";

export default function App() {
  const maximized  = useMaximized();
  const { isDraggingOver, onDragOver, onDragLeave, onDrop } = useDragDrop();
  const jobCount   = useJobsStore((s) => s.jobIds.length);

  return (
    <div
      className={`flex flex-col h-screen bg-zinc-950 text-zinc-100 ${
        maximized ? "" : "rounded-xl overflow-hidden"
      }`}
    >
      <Titlebar />

      {/* Drag handlers cover the entire content area so drops work over FileList too */}
      <LayoutGroup>
        <div
          className="flex flex-col flex-1 min-h-0"
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {/* Dropzone: flex-1 when empty, shrinks to h-12 toolbar when populated.
              Uses motion.div layout internally for the animated height collapse. */}
          <Dropzone isDraggingOver={isDraggingOver} />

          {/* FileList: flex-1 min-h-0, appears/disappears with AnimatePresence.
              Uses layout prop so Framer Motion coordinates with the Dropzone resize. */}
          <AnimatePresence>
            {jobCount > 0 && (
              <motion.div
                key="filelist"
                layout
                className="flex flex-col flex-1 min-h-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <FileList />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Banner: shrink-0, hidden when queue empty */}
          <QueueTotalBanner />

          {/* Preset cards and output controls: shown when queue has files */}
          <AnimatePresence>
            {jobCount > 0 && (
              <motion.div
                key="settings"
                layout
                className="px-3 pb-3 shrink-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <PresetCards />
                <OutputControls />
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
