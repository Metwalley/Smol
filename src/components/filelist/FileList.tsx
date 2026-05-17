import { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytesExact } from "@/lib/format";
import { kindBadgeColor, kindLabel } from "@/lib/kinds";
import {
  useAllJobIds,
  useJob,
  useJobsStore,
} from "@/store/jobs";
import type { QueuedFile } from "@/store/jobs";
import type { FileKind } from "@/types";
import { TypeFilterChips } from "./TypeFilterChips";

// ─── Per-row metadata helpers ─────────────────────────────────────────────────

function probeLabel(job: QueuedFile): string | null {
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

function Thumbnail({ job }: { job: QueuedFile }) {
  const thumbPath = job.thumbnailPath;
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
        // Kind-based placeholder — shown while thumbnail is loading or unavailable
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
  const removeJob = useJobsStore((s) => s.removeJob);

  if (!job) return null;

  const meta = probeLabel(job);
  const estimateLabel =
    job.estimateBytes !== undefined
      ? `~${formatBytesExact(job.estimateBytes)}`
      : "—";

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-900/50 hover:bg-zinc-900 transition-colors group">
      <Thumbnail job={job} />

      {/* File info */}
      <div className="flex flex-col flex-1 min-w-0 gap-0.5">
        <span className="text-sm font-medium text-zinc-100 truncate">{job.name}</span>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>{formatBytesExact(job.sizeBytes)}</span>
          {meta && (
            <>
              <span className="text-zinc-700">·</span>
              <span>{meta}</span>
            </>
          )}
        </div>
      </div>

      {/* Estimated output size */}
      <span className="text-xs text-indigo-400 font-medium shrink-0 w-14 text-right">
        {estimateLabel}
      </span>

      {/* Kind badge */}
      <span
        className={cn(
          "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0",
          kindBadgeColor(job.kind)
        )}
      >
        {kindLabel(job.kind)}
      </span>

      {/* Remove button */}
      <button
        onClick={() => removeJob(jobId)}
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
  const jobs = useJobsStore((s) => s.jobs);
  const [activeFilter, setActiveFilter] = useState<FileKind | "all">("all");

  // Counts per kind for filter chips
  const counts: Record<FileKind | "all", number> = {
    all: jobIds.length,
    video: 0,
    audio: 0,
    image: 0,
    pdf: 0,
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
    // flex-col flex-1 min-h-0 — required so the overflow-y-auto below actually scrolls (skill: smol-flex-scroll-fix)
    <div className="flex flex-col flex-1 min-h-0 mx-3 mb-3">
      {/* Filter chips — fixed height, never scrolls */}
      <TypeFilterChips
        counts={counts}
        active={activeFilter}
        onSelect={setActiveFilter}
      />

      {/* Scrollable job list */}
      <div className="overflow-y-auto flex-1 min-h-0 space-y-1">
        {visibleIds.map((id) => (
          <JobRow key={id} jobId={id} />
        ))}
        {visibleIds.length === 0 && (
          <p className="text-center text-zinc-600 text-sm py-8">
            No {activeFilter} files in queue
          </p>
        )}
      </div>
    </div>
  );
}
