import { X, RotateCcw, Settings2 } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CompressionPreset, JobOverrides } from "@/types";
import { cn } from "@/lib/utils";
import { formatBytesExact, middleTruncate, parentDirName, formatEta, probeLabel } from "@/lib/format";
import { kindBadgeColor, kindLabel } from "@/lib/kinds";
import { useJob, useJobsStore } from "@/store/jobs";
import { usePreset } from "@/store/settings";
import { estimateOutputBytes } from "@/lib/estimate";
import { cancelJob } from "@/lib/tauri";
import { DoneCard } from "./DoneCard";
import { Thumbnail } from "./Thumbnail";

// ── Job row ───────────────────────────────────────────────────────────────────

export function JobRow({ jobId }: { jobId: string }) {
  const job    = useJob(jobId);
  const preset = usePreset();
  const [expanded, setExpanded] = useState(false);

  if (!job) return null;

  // Done → collapse to compact DoneCard (layout animation handled by parent)
  if (job.status === "done") return <DoneCard job={job} />;

  const isFailed   = job.status === "failed";
  const isEncoding = job.status === "encoding";
  const isProbing  = job.status === "probing" || job.status === "thumbnailing";
  const meta       = probeLabel(job.probe, job.kind);
  const dirName    = parentDirName(job.inputPath);
  const displayName = middleTruncate(job.name, 50);

  const effectivePreset = job.overrides?.preset || preset;
  const estimateBytes = estimateOutputBytes(
    { kind: job.kind, sizeBytes: job.inputBytes, probe: job.probe },
    effectivePreset,
  );
  
  let estimateLabel = "—";
  if (job.kind === "video" && job.overrides?.targetFileSize) {
    estimateLabel = `~${job.overrides.targetFileSize} MB`;
  } else if (estimateBytes !== undefined) {
    estimateLabel = `~${formatBytesExact(estimateBytes)}`;
  } else if (job.kind === "pdf") {
    estimateLabel = "";
  }
  const codecBadge =
    job.kind === "video" && job.probe?.videoCodec
      ? job.probe.videoCodec.toUpperCase()
      : null;

  // ── Failed state ────────────────────────────────────────────────────────────
  if (isFailed) {
    return (
      <div 
        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-900/30 border border-zinc-800/50 opacity-70 group"
        onMouseEnter={() => useJobsStore.getState().setHoveredJob(jobId)}
        onMouseLeave={() => useJobsStore.getState().setHoveredJob(null)}
      >
        <Thumbnail job={job} />
        <div className="flex flex-col flex-1 min-w-0 gap-0.5">
          <span className="text-sm font-medium text-zinc-500 truncate" title={job.name}>
            {displayName}
          </span>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono text-zinc-600">{formatBytesExact(job.inputBytes)}</span>
            <span className="text-zinc-700">·</span>
            <span className="text-red-500 font-medium">Failed</span>
          </div>
          {job.errorMessage && (
            <span className="text-[10px] text-zinc-500 truncate max-w-xs" title={job.errorMessage}>
              {job.errorMessage}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => useJobsStore.getState().retryJob(jobId)}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300"
            aria-label="Retry"
            title="Retry"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => useJobsStore.getState().removeJob(jobId)}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300"
            aria-label="Remove file"
            title="Remove file"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // ── Normal / encoding state ─────────────────────────────────────────────────
  return (
    <div 
      className="flex flex-col rounded-lg bg-zinc-900/50 hover:bg-zinc-900 transition-colors group overflow-hidden"
      onMouseEnter={() => useJobsStore.getState().setHoveredJob(jobId)}
      onMouseLeave={() => useJobsStore.getState().setHoveredJob(null)}
    >
      <div className="relative flex items-start gap-3 px-3 py-2">
        <Thumbnail job={job} />

      <div className="flex flex-col flex-1 min-w-0 gap-0.5">
        <span className="text-sm font-medium text-zinc-100 truncate" title={job.name}>
          {displayName}
        </span>

        <div className="flex items-center gap-1.5 flex-wrap text-xs text-zinc-500">
          {dirName && (
            <>
              <span className="text-[10px] text-zinc-600">{dirName}</span>
              <span className="text-zinc-700">·</span>
            </>
          )}
          <span className="font-mono">{formatBytesExact(job.inputBytes)}</span>
          {meta && (
            <>
              <span className="text-zinc-700">·</span>
              <span className="font-mono">{meta}</span>
            </>
          )}
          {codecBadge && (
            <span className="font-mono text-[10px] border border-zinc-700 text-zinc-500 px-1 py-0.5 rounded uppercase tracking-wide leading-none">
              {codecBadge}
            </span>
          )}
        </div>

        {/* Progress bar — encoding only */}
        {isEncoding && (
          <div className="mt-1 flex flex-col gap-0.5">
            <div className="h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
              {(job.kind === "image" || job.kind === "pdf") ? (
                <div className="h-full w-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 bg-[length:200%_100%] animate-[pulse_1.5s_ease-in-out_infinite]" />
              ) : (
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-[width] duration-300"
                  style={{ width: `${job.progress ?? 0}%` }}
                />
              )}
            </div>
            {!(job.kind === "image" || job.kind === "pdf") && (
              <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono tabular-nums">
                <span>{job.progress ?? 0}%</span>
                {job.speed && <span>{job.speed}</span>}
                {job.etaSec !== undefined && job.etaSec > 0 && (
                  <span>ETA {formatEta(job.etaSec)}</span>
                )}
              </div>
            )}
            {(job.kind === "image" || job.kind === "pdf") && (
              <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                <span className="animate-pulse">Compressing…</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Estimated output size or Probing label */}
      {estimateLabel && (
        <span className={cn(
          "font-mono text-xs font-medium whitespace-nowrap tabular-nums shrink-0 self-start mt-0.5",
          isProbing ? "text-zinc-500 animate-pulse italic" : "text-indigo-400"
        )}>
          {isProbing ? "Analyzing…" : estimateLabel}
        </span>
      )}

      {/* Kind badge */}
      <span
        className={cn(
          "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 w-[4.5rem] inline-flex items-center justify-center self-start mt-0.5",
          kindBadgeColor(job.kind),
        )}
      >
        {kindLabel(job.kind)}
      </span>

      {/* Remove / cancel button */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity self-start mt-0.5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300"
          aria-label="Settings"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={async () => {
            if (isEncoding) await cancelJob(jobId).catch(() => {});
            useJobsStore.getState().removeJob(jobId);
          }}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300"
          aria-label={isEncoding ? "Cancel compression" : "Remove file"}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 pb-2 flex flex-col"
          >
            <div className="pt-2 border-t border-zinc-800/50">
              <JobRowSettings jobId={jobId} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function JobRowSettings({ jobId }: { jobId: string }) {
  const job = useJob(jobId);
  if (!job) return null;

  const overrides = job.overrides || {};
  const update = (patch: Partial<JobOverrides>) => useJobsStore.getState().updateJobOverrides(jobId, patch);

  if (job.kind === "video") {
    return (
      <div className="flex items-center gap-4 text-xs text-zinc-300">
        <label className="flex items-center gap-2 cursor-pointer">
          Target Size:
          <select 
            value={overrides.targetFileSize || ""} 
            onChange={e => update({ targetFileSize: e.target.value ? parseInt(e.target.value) : undefined })}
            className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer hover:border-zinc-700"
          >
            <option value="">None</option>
            <option value="8">8MB (Discord)</option>
            <option value="25">25MB (Discord)</option>
            <option value="50">50MB (Discord)</option>
            <option value="512">512MB (Twitter)</option>
          </select>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          Codec:
          <select 
            value={overrides.codec || ""} 
            onChange={e => update({ codec: e.target.value || undefined })}
            className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer hover:border-zinc-700"
          >
            <option value="">Default</option>
            <option value="h264">H.264</option>
            <option value="h265">H.265 / HEVC</option>
            <option value="av1">AV1</option>
          </select>
        </label>
      </div>
    );
  }

  if (job.kind === "image") {
    return (
      <div className="flex items-center gap-4 text-xs text-zinc-300">
        <label className="flex items-center gap-2 cursor-pointer group">
          <div className="relative flex items-center">
            <input 
              type="checkbox" 
              checked={overrides.resize !== false} 
              onChange={e => update({ resize: e.target.checked })} 
              className="peer appearance-none w-4 h-4 rounded-[4px] border border-zinc-700 bg-zinc-950 checked:bg-indigo-500 checked:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all cursor-pointer"
            />
            <svg className="absolute w-3 h-3 text-white left-0.5 top-0.5 pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 14 14" fill="none">
              <path d="M3 8L6 11L11 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="group-hover:text-zinc-100 transition-colors">Allow Resize</span>
        </label>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 text-xs text-zinc-300">
      <label className="flex items-center gap-2 cursor-pointer">
        Preset Override:
        <select 
          value={overrides.preset || ""} 
          onChange={e => update({ preset: (e.target.value as CompressionPreset) || undefined })}
          className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer hover:border-zinc-700"
        >
          <option value="">Use Global Preset</option>
          <option value="less">Less Compression</option>
          <option value="recommended">Recommended</option>
          <option value="extreme">Extreme Compression</option>
        </select>
      </label>
    </div>
  );
}
