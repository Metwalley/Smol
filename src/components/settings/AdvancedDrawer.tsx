import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useUiStore } from "@/store/ui";
import { useTargetFileSize, useParallelJobs, useSettingsStore } from "@/store/settings";
import { VideoAdvancedSettings } from "./advanced/VideoAdvancedSettings";
import { AudioAdvancedSettings } from "./advanced/AudioAdvancedSettings";
import { ImageAdvancedSettings } from "./advanced/ImageAdvancedSettings";
import { PdfAdvancedSettings } from "./advanced/PdfAdvancedSettings";

const TABS = [
  { id: "video" as const, label: "Video" },
  { id: "audio" as const, label: "Audio" },
  { id: "image" as const, label: "Image" },
  { id: "pdf" as const, label: "PDF" },
];

export function AdvancedDrawer() {
  const isOpen = useUiStore((s) => s.isAdvancedOpen);
  const [activeTab, setActiveTab] = useState<"video" | "audio" | "image" | "pdf">("video");

  const targetFileSize = useTargetFileSize();
  const parallelJobs = useParallelJobs();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => useUiStore.getState().setAdvancedOpen(false)}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-[384px] bg-zinc-900 shadow-2xl z-50 flex flex-col border-l border-zinc-800"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-100">Advanced Settings</h2>
              <button
                onClick={() => useUiStore.getState().setAdvancedOpen(false)}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-800">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex-1 py-3 text-sm font-medium transition-colors
                    ${activeTab === tab.id
                      ? "text-indigo-400 border-b-2 border-indigo-500"
                      : "text-zinc-400 hover:text-zinc-200"
                    }
                  `}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Global settings */}
              <div className="mb-6 pb-6 border-b border-zinc-800">
                <h3 className="text-sm font-medium text-zinc-300 mb-4">Global</h3>

                {/* Parallel jobs */}
                <div className="mb-4">
                  <label className="block text-sm text-zinc-400 mb-2">Parallel jobs</label>
                  <input
                    type="number"
                    min="1"
                    max="16"
                    value={parallelJobs}
                    onChange={(e) => useSettingsStore.getState().patch({ parallelJobs: parseInt(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Target file size */}
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Target file size (optional)</label>
                  <div className="flex gap-2">
                    <select
                      value={targetFileSize?.mode ?? "absolute"}
                      onChange={(e) =>
                        useSettingsStore.getState().patch({
                          targetFileSize: {
                            mode: e.target.value as "absolute" | "percent",
                            value: targetFileSize?.value ?? 0,
                          },
                        })
                      }
                      className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="absolute">MB</option>
                      <option value="percent">%</option>
                    </select>
                    <input
                      type="number"
                      value={targetFileSize?.value ?? ""}
                      onChange={(e) =>
                        useSettingsStore.getState().patch({
                          targetFileSize: {
                            mode: (targetFileSize?.mode ?? "absolute") as "absolute" | "percent",
                            value: parseFloat(e.target.value),
                          },
                        })
                      }
                      placeholder="None"
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Tab content */}
              {activeTab === "video" && <VideoAdvancedSettings />}
              {activeTab === "audio" && <AudioAdvancedSettings />}
              {activeTab === "image" && <ImageAdvancedSettings />}
              {activeTab === "pdf" && <PdfAdvancedSettings />}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
