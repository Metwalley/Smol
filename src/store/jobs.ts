import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { FileKind } from "@/types";

// Phase 2 minimal job shape. Phase 4 will expand this to the full
// state machine (queued | probing | thumbnailing | ready | encoding | done | failed | cancelled).
export interface QueuedFile {
  id: string;
  path: string;
  name: string;
  kind: FileKind;
  sizeBytes: number;
  addedAt: number;
}

interface JobsState {
  jobs: Record<string, QueuedFile>;
  jobIds: string[];
  addPaths: (files: Omit<QueuedFile, "addedAt">[]) => void;
  removeJob: (id: string) => void;
  clear: () => void;
}

export const useJobsStore = create<JobsState>((set) => ({
  jobs: {},
  jobIds: [],
  addPaths: (files) =>
    set((s) => {
      const now = Date.now();
      const newJobs = { ...s.jobs };
      const newIds = [...s.jobIds];
      for (const f of files) {
        newJobs[f.id] = { ...f, addedAt: now };
        newIds.push(f.id);
      }
      return { jobs: newJobs, jobIds: newIds };
    }),
  removeJob: (id) =>
    set((s) => {
      const { [id]: _dropped, ...rest } = s.jobs;
      return { jobs: rest, jobIds: s.jobIds.filter((x) => x !== id) };
    }),
  clear: () => set({ jobs: {}, jobIds: [] }),
}));

// Atomic selectors — one field each (HR-7)
export const useAllJobIds   = () => useJobsStore(useShallow((s) => s.jobIds));
export const useJob         = (id: string) => useJobsStore((s) => s.jobs[id]);
export const useJobCount    = () => useJobsStore((s) => s.jobIds.length);
