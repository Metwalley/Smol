import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { Job } from "@/types";

interface JobsState {
  jobs: Record<string, Job>;
  jobIds: string[];
  addJob: (job: Job) => void;
  updateJob: (id: string, patch: Partial<Job>) => void;
  removeJob: (id: string) => void;
  clearAll: () => void;
}

export const useJobsStore = create<JobsState>((set) => ({
  jobs: {},
  jobIds: [],
  addJob: (job) =>
    set((s) => ({
      jobs: { ...s.jobs, [job.id]: job },
      jobIds: [...s.jobIds, job.id],
    })),
  updateJob: (id, patch) =>
    set((s) => ({ jobs: { ...s.jobs, [id]: { ...s.jobs[id], ...patch } } })),
  removeJob: (id) =>
    set((s) => {
      const { [id]: _removed, ...rest } = s.jobs;
      return { jobs: rest, jobIds: s.jobIds.filter((x) => x !== id) };
    }),
  clearAll: () => set({ jobs: {}, jobIds: [] }),
}));

// Atomic selectors — one field each (HR-7)
export const useJob = (id: string) => useJobsStore((s) => s.jobs[id]);
export const useAllJobIds = () => useJobsStore(useShallow((s) => s.jobIds));
export const useJobStatus = (id: string) => useJobsStore((s) => s.jobs[id]?.status);
export const useJobProgress = (id: string) => useJobsStore((s) => s.jobs[id]?.progress ?? 0);
export const useJobCount = () => useJobsStore((s) => s.jobIds.length);
