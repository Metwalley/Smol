import { useJobsStore } from "@/store/jobs";
import { formatBytes } from "@/lib/format";

export function QueueTotalBanner() {
  const jobs = useJobsStore((s) => Object.values(s.jobs));

  if (jobs.length === 0) return null;

  const totalInput = jobs.reduce((s, j) => s + j.sizeBytes, 0);
  const estimates = jobs.map((j) => j.estimateBytes);
  const allKnown = estimates.length > 0 && estimates.every((e) => e !== undefined);
  const totalEstimated = allKnown
    ? estimates.reduce((s, e) => s + (e ?? 0), 0)
    : undefined;

  const saved = totalEstimated !== undefined ? totalInput - totalEstimated : undefined;
  const savedPct =
    saved !== undefined && totalInput > 0
      ? Math.round((saved / totalInput) * 100)
      : undefined;

  return (
    <div className="flex items-center gap-2 px-4 py-2 mx-3 mb-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 shrink-0">
      <span className="font-medium text-zinc-300">Estimated total</span>
      <span className="text-zinc-600">·</span>
      <span>{formatBytes(totalInput)}</span>
      {totalEstimated !== undefined && (
        <>
          <span className="text-zinc-600">→</span>
          <span className="text-indigo-400 font-medium">{formatBytes(totalEstimated)}</span>
          {savedPct !== undefined && savedPct > 0 && (
            <>
              <span className="text-zinc-600">·</span>
              <span className="text-emerald-400">saves ~{savedPct}%</span>
            </>
          )}
        </>
      )}
      {totalEstimated === undefined && (
        <span className="text-zinc-600 italic">estimating…</span>
      )}
    </div>
  );
}
