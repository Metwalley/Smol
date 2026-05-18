import { motion, AnimatePresence } from "framer-motion";
import { FolderOpen, CheckCheck } from "lucide-react";
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

  if (jobCount === 0) return null;

  // ── Batch Complete banner ───────────────────────────────────────────────────
  if (allDone) {
    const totalSaved   = Math.max(0, totalInput - totalOutput);
    const savedLabel   = formatBytesExact(totalSaved);
    const fileWord     = doneCount === 1 ? "file" : "files";

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="batch-complete"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex items-center gap-2 px-4 py-2 mx-3 mb-2 rounded-lg bg-emerald-950/50 border border-emerald-800/40 text-xs shrink-0"
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

          {firstOutputPath && (
            <button
              onClick={() => revealInExplorer(firstOutputPath).catch(() => {})}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-800/40 hover:bg-emerald-700/50 text-emerald-300 hover:text-emerald-100 transition-colors shrink-0 font-medium"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Open output folder
            </button>
          )}
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
        <span className="font-mono">{formatBytes(totalInput)}</span>
        {allReady && (
          <>
            <span className="text-zinc-600">→</span>
            <span className="font-mono text-indigo-400 font-medium">
              ~{formatBytes(totalEstimated)}
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
