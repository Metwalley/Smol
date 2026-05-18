import { convertFileSrc } from "@tauri-apps/api/core";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytesExact, middleTruncate, parentDirName, formatEta, probeLabel } from "@/lib/format";
import { kindBadgeColor, kindLabel } from "@/lib/kinds";
import { useJob, useJobsStore } from "@/store/jobs";
import { usePreset } from "@/store/settings";
import { estimateOutputBytes } from "@/lib/estimate";
import { cancelJob } from "@/lib/tauri";
import { DoneCard } from "./DoneCard";
import type { Job } from "@/types";

// ── Thumbnail ─────────────────────────────────────────────────────────────────

export function Thumbnail({ job }: { job: Job }) {
  const thumbPath = job.thumbnailPath;
  if (thumbPath === undefined) {
    return (
      <div className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden bg-zinc-800">
        <div className="w-full h-full bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 animate-pulse" />
      </div>
    );
  }
  const src = thumbPath ? convertFileSrc(thumbPath) : null;
  return (
    <div className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden bg-zinc-800 flex items-center justify-center">
      {src ? (
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded", kindBadgeColor(job.kind))}>
          {kindLabel(job.kind).toUpperCase().slice(0, 3)}
        </span>
      )}
    </div>
  );
}

// ── Job row ───────────────────────────────────────────────────────────────────

export function JobRow({ jobId }: { jobId: string }) {
  const job    = useJob(jobId);
  const preset = usePreset();

  if (!job) return null;

  // Done → collapse to compact DoneCard (layout animation handled by parent)
  if (job.status === "done") return <DoneCard job={job} />;

  const isFailed   = job.status === "failed";
  const isEncoding = job.status === "encoding";
  const meta       = probeLabel(job.probe, job.kind);
  const dirName    = parentDirName(job.inputPath);
  const displayName = middleTruncate(job.name, 50);

  const estimateBytes = estimateOutputBytes(
    { kind: job.kind, sizeBytes: job.inputBytes, probe: job.probe },
    preset,
  );
  const estimateLabel = estimateBytes !== undefined
    ? `~${formatBytesExact(estimateBytes)}`
    : "—";
  const codecBadge =
    job.kind === "video" && job.probe?.videoCodec
      ? job.probe.videoCodec.toUpperCase()
      : null;

  // ── Failed state ────────────────────────────────────────────────────────────
  if (isFailed) {
    return (
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-900/30 border border-zinc-800/50 opacity-70 group">
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
        <button
          onClick={() => useJobsStore.getState().removeJob(jobId)}
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300"
          aria-label="Remove file"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // ── Normal / encoding state ─────────────────────────────────────────────────
  return (
    <div className="relative flex items-start gap-3 px-3 py-2 rounded-lg bg-zinc-900/50 hover:bg-zinc-900 transition-colors group">
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
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-[width] duration-300"
                style={{ width: `${job.progress ?? 0}%` }}
              />
            </div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono tabular-nums">
              <span>{job.progress ?? 0}%</span>
              {job.speed && <span>{job.speed}</span>}
              {job.etaSec !== undefined && job.etaSec > 0 && (
                <span>ETA {formatEta(job.etaSec)}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Estimated output size */}
      <span className="font-mono text-xs font-medium whitespace-nowrap tabular-nums text-indigo-400 shrink-0 self-start mt-0.5">
        {estimateLabel}
      </span>

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
      <button
        onClick={async () => {
          if (isEncoding) await cancelJob(jobId).catch(() => {});
          useJobsStore.getState().removeJob(jobId);
        }}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 self-start"
        aria-label={isEncoding ? "Cancel compression" : "Remove file"}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
