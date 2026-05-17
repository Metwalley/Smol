import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { FileKind, MediaProbe } from "@/types";
import { probeMedia, generateThumbnail } from "@/lib/tauri";
import { estimateOutputBytes } from "@/lib/estimate";

// Phase 2 minimal job shape. Phase 4 will expand this to the full
// state machine (queued | probing | thumbnailing | ready | encoding | done | failed | cancelled).
export interface QueuedFile {
  id: string;
  path: string;
  name: string;
  kind: FileKind;
  sizeBytes: number;
  addedAt: number;
  // Phase 3 additions — all optional; populated asynchronously after addPaths
  probe?: MediaProbe;
  thumbnailPath?: string | null;
  estimateBytes?: number;
  // Phase 3.5: set when probe_media returns Err; row renders as "Failed" with tooltip
  pipelineError?: string;
}

interface JobsState {
  jobs: Record<string, QueuedFile>;
  jobIds: string[];
  addPaths: (
    files: Omit<QueuedFile, "addedAt" | "probe" | "thumbnailPath" | "estimateBytes" | "pipelineError">[]
  ) => void;
  updateJob: (
    id: string,
    updates: Partial<Pick<QueuedFile, "probe" | "thumbnailPath" | "estimateBytes" | "pipelineError">>
  ) => void;
  removeJob: (id: string) => void;
  clear: () => void;
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: {},
  jobIds: [],

  addPaths: (files) => {
    const now = Date.now();
    const newJobs = { ...get().jobs };
    const newIds = [...get().jobIds];
    for (const f of files) {
      newJobs[f.id] = { ...f, addedAt: now };
      newIds.push(f.id);
    }
    set({ jobs: newJobs, jobIds: newIds });
    // Fire-and-forget probe + thumbnail pipeline — one async task per file
    for (const f of files) {
      void kickOffPipeline(f.id, f.path, f.kind, f.sizeBytes);
    }
  },

  updateJob: (id, updates) =>
    set((s) =>
      s.jobs[id]
        ? { jobs: { ...s.jobs, [id]: { ...s.jobs[id], ...updates } } }
        : s
    ),

  removeJob: (id) =>
    set((s) => {
      const { [id]: _dropped, ...rest } = s.jobs;
      return { jobs: rest, jobIds: s.jobIds.filter((x) => x !== id) };
    }),

  clear: () => set({ jobs: {}, jobIds: [] }),
}));

// ─── Probe + thumbnail pipeline ───────────────────────────────────────────────

async function kickOffPipeline(
  jobId: string,
  path: string,
  kind: FileKind,
  sizeBytes: number,
) {
  // 1. Probe first so thumbnail can use duration for seek position
  let probe: MediaProbe | undefined;
  try {
    probe = await probeMedia(path);
    const estimateBytes = estimateOutputBytes({ kind, sizeBytes, probe }, "recommended") ?? undefined;
    useJobsStore.getState().updateJob(jobId, { probe, estimateBytes });
  } catch (err) {
    // Probe failed — mark row as failed with error message
    const msg = err instanceof Error ? err.message : String(err);
    useJobsStore.getState().updateJob(jobId, { pipelineError: msg });
    // Fall through: still try thumbnail even without probe metadata
  }

  // 2. Generate thumbnail (probe result supplies duration_sec for video seek)
  try {
    const thumbPath = await generateThumbnail(path, kind, probe?.durationSec ?? null);
    useJobsStore.getState().updateJob(jobId, { thumbnailPath: thumbPath });
  } catch {
    // Thumbnail failure is non-fatal; row shows kind-badge placeholder
    useJobsStore.getState().updateJob(jobId, { thumbnailPath: null });
  }
}

// ─── Atomic selectors (HR-7) — one field per selector ─────────────────────────
//
// RULE: every selector must return a primitive (number/string/boolean/undefined)
// OR a reference that is already stored in state (s.jobs[id], s.jobIds, …).
// Never return a newly-constructed object/array/tuple — that creates a new
// reference on every call and triggers the infinite-re-render loop (bug #1).

// Per-job
export const useAllJobIds    = () => useJobsStore(useShallow((s) => s.jobIds));
export const useJob          = (id: string) => useJobsStore((s) => s.jobs[id]);
export const useJobCount     = () => useJobsStore((s) => s.jobIds.length);
export const useJobProbe     = (id: string) => useJobsStore((s) => s.jobs[id]?.probe);
export const useJobThumbnail = (id: string) => useJobsStore((s) => s.jobs[id]?.thumbnailPath);
export const useJobEstimate  = (id: string) => useJobsStore((s) => s.jobs[id]?.estimateBytes);

// Queue-level aggregates — Pattern C: loop inside selector, return a primitive.
// Safe because numbers compare by value; no new reference is ever produced.
export const useTotalInputBytes = () =>
  useJobsStore((s) => {
    let t = 0;
    for (const id of s.jobIds) t += s.jobs[id]?.sizeBytes ?? 0;
    return t;
  });

// true only when every job in the queue has a resolved estimate (no undefined)
export const useAllEstimatesReady = () =>
  useJobsStore(
    (s) =>
      s.jobIds.length > 0 &&
      s.jobIds.every((id) => s.jobs[id]?.estimateBytes !== undefined)
  );

export const useTotalEstimatedBytes = () =>
  useJobsStore((s) => {
    let t = 0;
    for (const id of s.jobIds) t += s.jobs[id]?.estimateBytes ?? 0;
    return t;
  });
