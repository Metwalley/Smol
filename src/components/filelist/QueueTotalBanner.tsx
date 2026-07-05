import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FolderOpen, CheckCheck, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  useJobCount,
  useTotalInputBytes,
  useAllJobIds,
  useJobs,
  useAllJobsDone,
  useTotalOutputBytes,
  useDoneJobCount,
  useFirstOutputPath,
} from "@/store/jobs";
import { usePreset } from "@/store/settings";
import { formatBytes, formatBytesExact } from "@/lib/format";
import { estimateOutputBytes } from "@/lib/estimate";
import { revealInExplorer } from "@/lib/tauri";

/**
 * HR-7 clean: every selector returns a primitive or a direct state ref.
 *
 * Two states:
 *   1. "Estimating" — shows total input → estimated output and % savings
 *   2. "Batch complete" — fires when all active jobs are done; shows actual
 *      total savings and an "Open output folder" button.
 */
export function QueueTotalBanner() {
  const jobCount        = useJobCount();
  const totalInput      = useTotalInputBytes();
  const preset          = usePreset();
  const jobIds          = useAllJobIds();
  const jobs            = useJobs();
  const allDone         = useAllJobsDone();
  const totalOutput     = useTotalOutputBytes();
  const doneCount       = useDoneJobCount();
  const firstOutputPath = useFirstOutputPath();

  const [isExpanded, setIsExpanded] = useState(false);

  if (jobCount === 0) return null;

  // ── Batch Complete banner ───────────────────────────────────────────────────
  if (allDone) {
    const totalSaved   = Math.max(0, totalInput - totalOutput);
    const savedLabel   = formatBytesExact(totalSaved);
    const fileWord     = doneCount === 1 ? "file" : "files";
    const failedCount  = jobIds.filter(id => jobs[id]?.status === "failed").length;

    const copySummary = () => {
      let text = `Smol Compression Summary:\n`;
      text += `Total Input: ${formatBytesExact(totalInput)}\n`;
      text += `Total Output: ${formatBytesExact(totalOutput)}\n`;
      text += `Saved: ${savedLabel}\n`;
      text += `Files Processed: ${doneCount} | Failed: ${failedCount}\n\n`;
      for (const id of jobIds) {
        const j = jobs[id];
        if (j?.status === "done" && j.outputBytes) {
          text += `- ${j.name}: ${formatBytesExact(j.inputBytes)} -> ${formatBytesExact(j.outputBytes)}\n`;
        }
      }
      navigator.clipboard.writeText(text).catch(() => {});
      toast.success("Summary copied to clipboard");
    };

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="batch-complete"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex flex-col mx-3 mb-2 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-xs shrink-0 overflow-hidden"
        >
          {/* Header Row */}
          <div 
            className="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-emerald-900/20 transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <CheckCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="font-semibold text-emerald-300">All done!</span>
            <span className="text-zinc-500">·</span>
            <span className="text-zinc-300">
              Saved{" "}
              <span className="font-mono font-semibold text-emerald-400">
                {savedLabel}
              </span>{" "}
              across{" "}
              <span className="font-semibold text-zinc-200">{doneCount}</span>{" "}
              {fileWord}.
            </span>
            {failedCount > 0 && (
              <>
                <span className="text-zinc-500">·</span>
                <span className="text-red-400 font-medium">{failedCount} failed</span>
              </>
            )}

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); copySummary(); }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-emerald-800/40 text-emerald-400 hover:text-emerald-200 transition-colors shrink-0 font-medium"
                title="Copy text summary"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              {firstOutputPath && (
                <button
                  onClick={(e) => { e.stopPropagation(); revealInExplorer(firstOutputPath).catch(() => {}); }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-800/40 hover:bg-emerald-700/50 text-emerald-300 hover:text-emerald-100 transition-colors shrink-0 font-medium"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Open output
                </button>
              )}
              {isExpanded ? <ChevronUp className="h-4 w-4 text-emerald-500" /> : <ChevronDown className="h-4 w-4 text-emerald-500" />}
            </div>
          </div>

          {/* Expanded Breakdown */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-t border-emerald-900/30"
              >
                <div className="px-4 py-3 max-h-48 overflow-y-auto space-y-1.5">
                  {jobIds.map(id => {
                    const j = jobs[id];
                    if (!j || (j.status !== "done" && j.status !== "failed")) return null;
                    return (
                      <div key={id} className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400 truncate max-w-[200px]" title={j.name}>{j.name}</span>
                        {j.status === "failed" ? (
                          <span className="text-red-400 font-medium">Failed</span>
                        ) : (
                          <div className="flex items-center gap-1 font-mono">
                            <span className="text-zinc-500">{formatBytesExact(j.inputBytes)}</span>
                            <span className="text-zinc-700">→</span>
                            <span className="text-emerald-400">{formatBytesExact(j.outputBytes ?? j.inputBytes)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Estimating banner (default) ─────────────────────────────────────────────
  let totalEstimated = 0;
  let allReady = true;
  for (const id of jobIds) {
    const job = jobs[id];
    if (!job) continue;
    if (job.status === "failed" || job.status === "cancelled") continue;
    const est = estimateOutputBytes(
      { kind: job.kind, sizeBytes: job.inputBytes, probe: job.probe },
      preset,
    );
    if (est === undefined) { allReady = false; break; }
    totalEstimated += est;
  }

  const saved    = allReady ? totalInput - totalEstimated : undefined;
  const savedPct =
    saved !== undefined && totalInput > 0
      ? Math.round((saved / totalInput) * 100)
      : undefined;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="estimating"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex items-center gap-2 px-4 py-2 mx-3 mb-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 shrink-0"
      >
        <span className="font-medium text-zinc-300">Estimated total</span>
        <span className="text-zinc-600">·</span>
        <span className="font-mono">{formatBytesExact(totalInput)}</span>
        {allReady && (
          <>
            <span className="text-zinc-600">→</span>
            <span className="font-mono text-indigo-400 font-medium">
              {formatBytes(totalEstimated)}
            </span>
            {savedPct !== undefined && savedPct > 0 && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-emerald-400">saves ~{savedPct}%</span>
              </>
            )}
          </>
        )}
        {!allReady && (
          <span className="text-zinc-600 italic">estimating…</span>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
