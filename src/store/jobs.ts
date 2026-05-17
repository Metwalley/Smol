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
}

interface JobsState {
  jobs: Record<string, QueuedFile>;
  jobIds: string[];
  addPaths: (files: Omit<QueuedFile, "addedAt" | "probe" | "thumbnailPath" | "estimateBytes">[]) => void;
  updateJob: (id: string, updates: Partial<Pick<QueuedFile, "probe" | "thumbnailPath" | "estimateBytes">>) => void;
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
  } catch {
    // probe failure is non-fatal; row still shows in list with no metadata
  }

  // 2. Generate thumbnail (probe result supplies duration_sec for video seek)
  try {
    const thumbPath = await generateThumbnail(path, kind, probe?.durationSec ?? null);
    useJobsStore.getState().updateJob(jobId, { thumbnailPath: thumbPath });
  } catch {
    // thumbnail failure is non-fatal; row shows kind-badge placeholder
  }
}

// ─── Atomic selectors (HR-7) — one field per selector ─────────────────────────

export const useAllJobIds    = () => useJobsStore(useShallow((s) => s.jobIds));
export const useJob          = (id: string) => useJobsStore((s) => s.jobs[id]);
export const useJobCount     = () => useJobsStore((s) => s.jobIds.length);
export const useJobProbe     = (id: string) => useJobsStore((s) => s.jobs[id]?.probe);
export const useJobThumbnail = (id: string) => useJobsStore((s) => s.jobs[id]?.thumbnailPath);
export const useJobEstimate  = (id: string) => useJobsStore((s) => s.jobs[id]?.estimateBytes);
