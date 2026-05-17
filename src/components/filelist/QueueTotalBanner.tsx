import {
  useJobCount,
  useTotalInputBytes,
  useAllEstimatesReady,
  useTotalEstimatedBytes,
} from "@/store/jobs";
import { formatBytes } from "@/lib/format";

/**
 * HR-7 clean: every selector returns a primitive.
 * No Object.values / array construction inside any useJobsStore call.
 */
export function QueueTotalBanner() {
  const jobCount       = useJobCount();            // number
  const totalInput     = useTotalInputBytes();     // number
  const allReady       = useAllEstimatesReady();   // boolean
  const totalEstimated = useTotalEstimatedBytes(); // number (0 until ready)

  if (jobCount === 0) return null;

  const saved    = allReady ? totalInput - totalEstimated : undefined;
  const savedPct =
    saved !== undefined && totalInput > 0
      ? Math.round((saved / totalInput) * 100)
      : undefined;

  return (
    <div className="flex items-center gap-2 px-4 py-2 mx-3 mb-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 shrink-0">
      <span className="font-medium text-zinc-300">Estimated total</span>
      <span className="text-zinc-600">·</span>
      <span className="font-mono">{formatBytes(totalInput)}</span>
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
    </div>
  );
}
