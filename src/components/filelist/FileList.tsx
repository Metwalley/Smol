import { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatBytesExact, middleTruncate, parentDirName } from "@/lib/format";
import { kindBadgeColor, kindLabel } from "@/lib/kinds";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAllJobIds, useJob, useJobsStore } from "@/store/jobs";
import type { Job } from "@/types";
import type { FileKind } from "@/types";
import { TypeFilterChips } from "./TypeFilterChips";

// ─── Per-row metadata helpers ─────────────────────────────────────────────────

function probeLabel(job: Job): string | null {
  const p = job.probe;
  if (!p) return null;
  switch (job.kind) {
    case "video":
    case "audio": {
      if (!p.durationSec) return null;
      const s = Math.round(p.durationSec);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      return h > 0
        ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
        : `${m}:${String(sec).padStart(2, "0")}`;
    }
    case "image":
      if (p.width && p.height) return `${p.width}×${p.height}`;
      return null;
    case "pdf":
      if (p.pageCount) return `${p.pageCount} page${p.pageCount !== 1 ? "s" : ""}`;
      return null;
    default:
      return null;
  }
}

// ─── Thumbnail ────────────────────────────────────────────────────────────────

function Thumbnail({ job }: { job: Job }) {
  const thumbPath = job.thumbnailPath;

  // undefined = still probing/thumbnailing → animate-pulse shimmer
  if (thumbPath === undefined) {
    return (
      <div className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden bg-zinc-800">
        <div className="w-full h-full bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 animate-pulse" />
      </div>
    );
  }

  // string = actual thumbnail path (served via asset:// protocol)
  const src = thumbPath ? convertFileSrc(thumbPath) : null;
  return (
    <div className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden bg-zinc-800 flex items-center justify-center">
      {src ? (
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        // null = no thumbnail available → kind badge placeholder
        <span
          className={cn(
            "text-xs font-bold px-1.5 py-0.5 rounded",
            kindBadgeColor(job.kind)
          )}
        >
          {kindLabel(job.kind).toUpperCase().slice(0, 3)}
        </span>
      )}
    </div>
  );
}

// ─── Single job row ───────────────────────────────────────────────────────────

function JobRow({ jobId }: { jobId: string }) {
  const job = useJob(jobId);

  if (!job) return null;

  // Status-based display logic
  const isFailed     = job.status === "failed";
  const isReady      = job.status === "ready" || job.status === "encoding" ||
                       job.status === "done";
  const meta         = probeLabel(job);
  const dirName      = parentDirName(job.inputPath);
  const displayName  = middleTruncate(job.name, 50);

  // Estimate: shown when ready (or done); "—" otherwise
  const estimateLabel =
    isReady && job.estimateBytes !== undefined
      ? `~${formatBytesExact(job.estimateBytes)}`
      : "—";

  // Codec badge: video rows only, after probe
  const codecBadge =
    job.kind === "video" && job.probe?.videoCodec
      ? job.probe.videoCodec.toUpperCase()
      : null;

  if (isFailed) {
    // ── Failed state: muted background, red "Failed" label, tooltip with error ──
    return (
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-900/30 border border-zinc-800/50 opacity-70 group">
        <Thumbnail job={job} />

        <div className="flex flex-col flex-1 min-w-0 gap-0.5">
          <span
            className="text-sm font-medium text-zinc-500 truncate"
            title={job.name}
          >
            {displayName}
          </span>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono text-zinc-600">
              {formatBytesExact(job.inputBytes)}
            </span>
            <span className="text-zinc-700">·</span>
            <span
              className="text-red-500 font-medium"
              title={job.errorMessage}
            >
              Failed
            </span>
          </div>
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

  // ── Normal state ──────────────────────────────────────────────────────────
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-900/50 hover:bg-zinc-900 transition-colors group">
      <Thumbnail job={job} />

      {/* File info: name + metadata row */}
      <div className="flex flex-col flex-1 min-w-0 gap-0.5">
        <span
          className="text-sm font-medium text-zinc-100 truncate"
          title={job.name}
        >
          {displayName}
        </span>

        <div className="flex items-center gap-1.5 flex-wrap text-xs text-zinc-500">
          {/* Parent directory hint */}
          {dirName && (
            <>
              <span className="text-[10px] text-zinc-600">{dirName}</span>
              <span className="text-zinc-700">·</span>
            </>
          )}
          {/* File size — font-mono for numeric alignment */}
          <span className="font-mono">{formatBytesExact(job.inputBytes)}</span>

          {/* Probe metadata: duration / dimensions / pages — font-mono */}
          {meta && (
            <>
              <span className="text-zinc-700">·</span>
              <span className="font-mono">{meta}</span>
            </>
          )}

          {/* Codec badge — video rows with probed codec only */}
          {codecBadge && (
            <span className="font-mono text-[10px] border border-zinc-700 text-zinc-500 px-1 py-0.5 rounded uppercase tracking-wide leading-none">
              {codecBadge}
            </span>
          )}
        </div>
      </div>

      {/* Estimated output size — font-mono + tabular-nums for numeric alignment; whitespace-nowrap prevents "KB" wrapping */}
      <span className="font-mono text-xs text-indigo-400 font-medium shrink-0 text-right whitespace-nowrap tabular-nums">
        {estimateLabel}
      </span>

      {/* Kind badge — fixed width so PDF/IMAGE/VIDEO/AUDIO all consume the same horizontal space */}
      <span
        className={cn(
          "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 w-[4.5rem] inline-flex items-center justify-center",
          kindBadgeColor(job.kind)
        )}
      >
        {kindLabel(job.kind)}
      </span>

      {/* Remove button — visible on hover */}
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

// ─── FileList ─────────────────────────────────────────────────────────────────

export function FileList() {
  const jobIds = useAllJobIds();
  const jobs   = useJobsStore((s) => s.jobs); // Pattern B: direct state ref; needed for counts/filter
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

  // Apply filter
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

      {/* Scrollable job list via shadcn ScrollArea (thin dark scrollbar) */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-1 py-1 pr-2">
          <AnimatePresence initial={false}>
            {visibleIds.map((id) => (
              // Row entry: fade + slide up; exit: fade left
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
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
