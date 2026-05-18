import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { FileKind, Job, JobStatus, MediaProbe } from "@/types";
import { probeMedia, generateThumbnail } from "@/lib/tauri";
import { estimateOutputBytes } from "@/lib/estimate";

// ── Public type for the addFiles payload ──────────────────────────────────────
// Contains only what the caller knows at drop time; the rest is initialised by
// the store.
export type NewJobInput = Pick<Job, "id" | "inputPath" | "name" | "kind" | "inputBytes">;

// ── Store state & actions ────────────────────────────────────────────────────

interface JobsState {
  jobs: Record<string, Job>;
  jobIds: string[];

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  /** Enqueue new files with status='queued' and kick off the probe pipeline. */
  addFiles: (files: NewJobInput[]) => void;
  removeJob: (id: string) => void;
  clear: () => void;

  // ── Pipeline state transitions (called via getState() — never as hooks) ───
  /** Advance a job to a new status without touching any other field. */
  transitionStatus: (id: string, status: JobStatus) => void;
  /** Store the probe result and the derived output-size estimate. */
  updateJobProbe: (id: string, probe: MediaProbe, estimateBytes: number | undefined) => void;
  /** Store the thumbnail path once the thumbnail command completes. */
  updateJobThumbnail: (id: string, thumbnailPath: string | null) => void;
  /** Mark a job as failed and record the error message. */
  setJobError: (id: string, message: string) => void;
  // ── Phase 6: compression progress ────────────────────────────────────────
  /** Update live encoding progress — called from the Channel onmessage handler. */
  updateJobProgress: (
    id: string,
    patch: { progress: number; speed?: string; etaSec?: number; outputBytes?: number },
  ) => void;
  /** Mark a job as done and record its final output path + size. */
  setJobOutput: (id: string, outputPath: string, outputBytes?: number) => void;
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: {},
  jobIds: [],

  addFiles: (files) => {
    const now = Date.now();
    const newJobs = { ...get().jobs };
    const newIds  = [...get().jobIds];
    for (const f of files) {
      newJobs[f.id] = { ...f, addedAt: now, status: "queued", progress: 0 };
      newIds.push(f.id);
    }
    set({ jobs: newJobs, jobIds: newIds });
    // Fire-and-forget: one async pipeline task per file (HR-6 compliant)
    for (const f of files) {
      void kickOffPipeline(f.id, f.inputPath, f.kind, f.inputBytes);
    }
  },

  removeJob: (id) =>
    set((s) => {
      const { [id]: _dropped, ...rest } = s.jobs;
      return { jobs: rest, jobIds: s.jobIds.filter((x) => x !== id) };
    }),

  clear: () => set({ jobs: {}, jobIds: [] }),

  transitionStatus: (id, status) =>
    set((s) =>
      s.jobs[id]
        ? { jobs: { ...s.jobs, [id]: { ...s.jobs[id], status } } }
        : s
    ),

  updateJobProbe: (id, probe, estimateBytes) =>
    set((s) =>
      s.jobs[id]
        ? { jobs: { ...s.jobs, [id]: { ...s.jobs[id], probe, estimateBytes } } }
        : s
    ),

  updateJobThumbnail: (id, thumbnailPath) =>
    set((s) =>
      s.jobs[id]
        ? { jobs: { ...s.jobs, [id]: { ...s.jobs[id], thumbnailPath } } }
        : s
    ),

  setJobError: (id, message) =>
    set((s) =>
      s.jobs[id]
        ? { jobs: { ...s.jobs, [id]: { ...s.jobs[id], status: "failed", errorMessage: message } } }
        : s
    ),

  updateJobProgress: (id, patch) =>
    set((s) =>
      s.jobs[id]
        ? {
            jobs: {
              ...s.jobs,
              [id]: {
                ...s.jobs[id],
                progress: patch.progress,
                speed: patch.speed,
                etaSec: patch.etaSec,
                outputBytes: patch.outputBytes,
              },
            },
          }
        : s
    ),

  setJobOutput: (id, outputPath, outputBytes) =>
    set((s) =>
      s.jobs[id]
        ? {
            jobs: {
              ...s.jobs,
              [id]: {
                ...s.jobs[id],
                status: "done",
                outputPath,
                outputBytes: outputBytes ?? s.jobs[id].outputBytes,
                progress: 100,
              },
            },
          }
        : s
    ),
}));

// ── Probe + thumbnail pipeline ────────────────────────────────────────────────
//
// State transitions:
//   queued → probing → thumbnailing → ready
//   queued → probing → failed           (probe error; thumbnail still attempted)
//
// All store mutations use getState() so this function can safely live outside
// React (no hook rules apply).

async function kickOffPipeline(
  jobId: string,
  inputPath: string,
  kind: FileKind,
  inputBytes: number,
) {
  const store = () => useJobsStore.getState();

  // 1. Probe ──────────────────────────────────────────────────────────────────
  store().transitionStatus(jobId, "probing");

  let probe: MediaProbe | undefined;
  let probeOk = false;

  try {
    probe = await probeMedia(inputPath);
    const estimateBytes =
      estimateOutputBytes({ kind, sizeBytes: inputBytes, probe }, "recommended") ?? undefined;
    store().updateJobProbe(jobId, probe, estimateBytes);
    store().transitionStatus(jobId, "thumbnailing");
    probeOk = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    store().setJobError(jobId, msg);
    // Fall through — still attempt thumbnail for visual richness in the failed row
  }

  // 2. Thumbnail (non-fatal; attempted even when probe failed) ─────────────────
  try {
    const thumbPath = await generateThumbnail(inputPath, kind, probe?.durationSec ?? null);
    store().updateJobThumbnail(jobId, thumbPath);
  } catch {
    store().updateJobThumbnail(jobId, null);
  }

  // 3. Finalise status ─────────────────────────────────────────────────────────
  // Only advance to 'ready' when probe succeeded; failed jobs stay 'failed'.
  if (probeOk) {
    store().transitionStatus(jobId, "ready");
  }
}

// ── Atomic selectors (HR-7) ──────────────────────────────────────────────────
//
// RULE: every selector must return a primitive (number / string / boolean /
// undefined) OR a direct state reference already stored in state (s.jobs[id],
// s.jobIds, …).  Never construct a new object / array inside a selector.
// Violation triggers the infinite re-render loop (bug #1).

// ── Per-job identity selectors ────────────────────────────────────────────────
// useAllJobIds: Pattern A — stable array ref via useShallow
export const useAllJobIds    = () => useJobsStore(useShallow((s) => s.jobIds));
// useJob: Pattern B — direct state reference; re-renders only when that job changes
export const useJob          = (id: string) => useJobsStore((s) => s.jobs[id]);
export const useJobCount     = () => useJobsStore((s) => s.jobIds.length);
// useJobs: direct state reference to the jobs record (HR-7 compliant - returns stored object)
export const useJobs         = () => useJobsStore((s) => s.jobs);

// ── Per-job field selectors (all primitives or direct state refs) ─────────────
export const useJobStatus    = (id: string) => useJobsStore((s) => s.jobs[id]?.status);
export const useJobProgress  = (id: string) => useJobsStore((s) => s.jobs[id]?.progress ?? 0);
export const useJobSpeed     = (id: string) => useJobsStore((s) => s.jobs[id]?.speed);
export const useJobEta       = (id: string) => useJobsStore((s) => s.jobs[id]?.etaSec);
export const useJobProbe     = (id: string) => useJobsStore((s) => s.jobs[id]?.probe);
export const useJobThumbnail = (id: string) => useJobsStore((s) => s.jobs[id]?.thumbnailPath);
export const useJobEstimate  = (id: string) => useJobsStore((s) => s.jobs[id]?.estimateBytes);
export const useJobOutputBytes = (id: string) => useJobsStore((s) => s.jobs[id]?.outputBytes);
export const useJobError     = (id: string) => useJobsStore((s) => s.jobs[id]?.errorMessage);

// ── Queue-level aggregates (Pattern C: loop inside selector; returns primitive) ─

export const useTotalInputBytes = () =>
  useJobsStore((s) => {
    let t = 0;
    for (const id of s.jobIds) t += s.jobs[id]?.inputBytes ?? 0;
    return t;
  });

/**
 * True once every active (non-failed / non-cancelled) job has a resolved
 * estimateBytes.  Used by QueueTotalBanner to decide when to show the
 * "→ ~X MB" summary line.
 */
export const useAllEstimatesReady = () =>
  useJobsStore((s) => {
    if (s.jobIds.length === 0) return false;
    return s.jobIds.every((id) => {
      const job = s.jobs[id];
      if (!job) return false;
      // failed / cancelled jobs never receive an estimate — exclude from check
      if (job.status === "failed" || job.status === "cancelled") return true;
      return job.estimateBytes !== undefined;
    });
  });

export const useTotalEstimatedBytes = () =>
  useJobsStore((s) => {
    let t = 0;
    for (const id of s.jobIds) t += s.jobs[id]?.estimateBytes ?? 0;
    return t;
  });

/**
 * Returns true if any job in the queue has kind === "video".
 * Used to disable the Lossless preset (HR-11).
 */
export const useHasAnyVideo = () =>
  useJobsStore((s) => s.jobIds.some((id) => s.jobs[id]?.kind === "video"));

// ── Phase 6 selectors (HR-7 compliant — return primitives) ───────────────────

/** True while at least one video job has status === "encoding". */
export const useIsSqueezing = () =>
  useJobsStore((s) => s.jobIds.some((id) => s.jobs[id]?.status === "encoding"));

/** Count of video jobs that are ready to compress. Drives the Squeeze button. */
export const useReadyVideoCount = () =>
  useJobsStore((s) =>
    s.jobIds.reduce((n, id) => {
      const j = s.jobs[id];
      return n + (j?.kind === "video" && j?.status === "ready" ? 1 : 0);
    }, 0),
  );

/**
 * Count of all jobs (video + audio + image) that are ready to compress.
 * Drives the Squeeze button — replaces the video-only useReadyVideoCount.
 */
export const useReadyCompressableCount = () =>
  useJobsStore((s) =>
    s.jobIds.reduce((n, id) => {
      const j = s.jobs[id];
      const compressable = j?.kind === "video" || j?.kind === "audio" || j?.kind === "image" || j?.kind === "pdf";
      return n + (compressable && j?.status === "ready" ? 1 : 0);
    }, 0),
  );
