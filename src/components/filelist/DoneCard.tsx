import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FolderSearch, X, Eye } from "lucide-react";
import { formatBytesExact, middleTruncate, parentDirName } from "@/lib/format";
import { revealInExplorer } from "@/lib/tauri";
import { useJobsStore } from "@/store/jobs";
import { PreviewModal } from "./../results/PreviewModal";
import { Thumbnail } from "./Thumbnail";
import type { Job } from "@/types";

// ── Animated SVG checkmark ────────────────────────────────────────────────────
// Circle outline draws in, then the tick draws in 150 ms later.

function AnimatedCheckmark() {
  return (
    <motion.svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      className="text-emerald-400 shrink-0"
      aria-hidden="true"
    >
      <motion.circle
        cx="9"
        cy="9"
        r="7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
      <motion.path
        d="M5.5 9.5L7.5 11.5L12.5 6.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.25, delay: 0.15, ease: "easeOut" }}
      />
    </motion.svg>
  );
}

// ── Count-up hook ─────────────────────────────────────────────────────────────
// Animates an integer from 0 → target over `duration` ms with cubic ease-out.

function useCountUp(target: number, duration = 900): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) { return; }
    const startTime = performance.now();
    let rafId: number;
    const step = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
      setCount(Math.round(eased * target));
      if (t < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);
  return count;
}

// ── Done card ─────────────────────────────────────────────────────────────────

export function DoneCard({ job }: { job: Job }) {
  const outputLarger =
    job.outputBytes === undefined || job.outputBytes >= job.inputBytes;

  const savedPct =
    outputLarger || job.outputBytes === undefined
      ? 0
      : Math.round(((job.inputBytes - job.outputBytes) / job.inputBytes) * 100);

  const animPct = useCountUp(savedPct);
  const displayName = middleTruncate(job.name, 48);
  const dir = parentDirName(job.inputPath);
  const [showPreview, setShowPreview] = useState(false);

  return (
    <>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-900/30 border border-emerald-900/25 group"
      onMouseEnter={() => useJobsStore.getState().setHoveredJob(job.id)}
      onMouseLeave={() => useJobsStore.getState().setHoveredJob(null)}
    >
      {/* Thumbnail — slightly smaller than active rows to match compact height */}
      <Thumbnail job={job} size="sm" />
      <AnimatedCheckmark />

      {/* Name + parent directory */}
      <div className="flex flex-col flex-1 min-w-0">
        <span
          className="text-sm font-medium text-zinc-400 truncate"
          title={job.name}
        >
          {displayName}
        </span>
        {dir && (
          <span className="text-[10px] text-zinc-600 truncate">{dir}</span>
        )}
      </div>

      {/* Savings info: input → output · saved X% */}
      {!outputLarger && job.outputBytes !== undefined ? (
        <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs tabular-nums">
          <span className="text-zinc-500">
            {formatBytesExact(job.inputBytes)}
          </span>
          <span className="text-zinc-700">→</span>
          <span className="text-emerald-400 font-medium">
            {formatBytesExact(job.outputBytes)}
          </span>
          <span className="text-zinc-700">·</span>
          <span className="text-emerald-300 font-semibold">
            saved {animPct}%
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs tabular-nums">
          <span className="text-zinc-500">
            {formatBytesExact(job.inputBytes)}
          </span>
          {outputLarger && (
            <>
              <span className="text-zinc-700">·</span>
              <span className="text-amber-400/80 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded">
                Already optimal
              </span>
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {/* Preview image */}
        {job.kind === "image" && job.outputPath && !outputLarger && (
          <button
            onClick={() => setShowPreview(true)}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300"
            title="Preview Before/After"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        )}
        
        {/* Reveal in Explorer — visible on row hover */}
        {job.outputPath && (
          <button
            onClick={() => revealInExplorer(job.outputPath!).catch(() => {})}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300"
            aria-label="Reveal in Explorer"
            title="Reveal in Explorer"
          >
            <FolderSearch className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={() => useJobsStore.getState().removeJob(job.id)}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300"
          aria-label="Remove file"
          title="Remove file"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
    {showPreview && <PreviewModal job={job} onClose={() => setShowPreview(false)} />}
    </>
  );
}
