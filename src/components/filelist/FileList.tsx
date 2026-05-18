import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAllJobIds, useJobsStore } from "@/store/jobs";
import type { FileKind } from "@/types";
import { TypeFilterChips } from "./TypeFilterChips";
import { JobRow } from "./JobRow";

export function FileList() {
  const jobIds = useAllJobIds();
  const jobs   = useJobsStore((s) => s.jobs); // Pattern B: direct state ref
  const [activeFilter, setActiveFilter] = useState<FileKind | "all">("all");

  // Counts per kind for filter chips
  const counts: Record<FileKind | "all", number> = {
    all: jobIds.length,
    video: 0, audio: 0, image: 0, pdf: 0,
  };
  for (const id of jobIds) {
    const kind = jobs[id]?.kind;
    if (kind) counts[kind]++;
  }

  const visibleIds =
    activeFilter === "all"
      ? jobIds
      : jobIds.filter((id) => jobs[id]?.kind === activeFilter);

  if (jobIds.length === 0) return null;

  return (
    // flex-col flex-1 min-h-0 — required by smol-flex-scroll-fix skill
    <div className="flex flex-col flex-1 min-h-0 mx-3 mb-3">
      {/* Filter chips — fixed height, never scrolls */}
      <TypeFilterChips counts={counts} active={activeFilter} onSelect={setActiveFilter} />

      {/* Scrollable job list via shadcn ScrollArea */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-1 py-1 pr-2">
          <AnimatePresence initial={false}>
            {visibleIds.map((id) => (
              // layout prop: smoothly animates height change when row collapses to DoneCard
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                layout
              >
                <JobRow jobId={id} />
              </motion.div>
            ))}
          </AnimatePresence>

          {visibleIds.length === 0 && (
            <p className="text-center text-zinc-600 text-sm py-8">
              No {activeFilter} files in queue
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
