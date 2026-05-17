---
name: smol-zustand-patterns
description: Use this skill when you are about to write a Zustand store, selector, or useStore call. Prevents the infinite re-render loop (bug #1).
---

# Smol Zustand Patterns

## The one rule that prevents bug #1

**Selectors must be atomic (one field per selector). Never return a new object or array
from a selector.**

```ts
// WRONG — creates a new object on every render → infinite re-render loop
const { preset, outputMode } = useSettingsStore((s) => ({
  preset: s.preset,
  outputMode: s.outputMode,
}));

// CORRECT — two atomic selectors
const preset = useSettingsStore((s) => s.preset);
const outputMode = useSettingsStore((s) => s.outputMode);
```

For arrays that are structurally stable, use `useShallow`:

```ts
import { useShallow } from "zustand/react/shallow";

const jobIds = useJobsStore(useShallow((s) => s.jobIds));
```

---

## Store shapes

### jobs.ts

```ts
import { create } from "zustand";
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
      const { [id]: _, ...rest } = s.jobs;
      return { jobs: rest, jobIds: s.jobIds.filter((x) => x !== id) };
    }),
  clearAll: () => set({ jobs: {}, jobIds: [] }),
}));
```

### Atomic selectors for jobs

```ts
export const useJob = (id: string) => useJobsStore((s) => s.jobs[id]);
export const useAllJobIds = () => useJobsStore(useShallow((s) => s.jobIds));
export const useJobStatus = (id: string) => useJobsStore((s) => s.jobs[id]?.status);
export const useJobProgress = (id: string) => useJobsStore((s) => s.jobs[id]?.progress ?? 0);
```

---

## Actions outside React

Call actions from Rust event handlers or utility functions using `getState()`:

```ts
// src/lib/tauri.ts or inside a Tauri event listener
import { useJobsStore } from "@/store/jobs";

function handleProgressEvent(event: ProgressEvent) {
  useJobsStore.getState().updateJob(event.jobId, {
    progress: event.fraction,
    speed: event.speed,
    etaSec: event.etaSec,
  });
}
```

Never call `useJobsStore` (the hook) outside of a React component or custom hook.

---

## settings.ts — persisted store

```ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Settings } from "@/types";

const DEFAULT_SETTINGS: Settings = {
  preset: "recommended",
  outputMode: "same-folder",
  filenamePattern: "{name}_smol{ext}",
  parallelJobs: 4,
  advanced: {},
};

export const useSettingsStore = create<Settings & { set: (patch: Partial<Settings>) => void }>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
    }),
    { name: "smol-settings", storage: createJSONStorage(() => localStorage) }
  )
);
```

---

## ui.ts — ephemeral state

```ts
import { create } from "zustand";

interface UiState {
  isAdvancedOpen: boolean;
  activeKindFilter: "all" | "video" | "audio" | "image" | "pdf";
  setAdvancedOpen: (v: boolean) => void;
  setKindFilter: (v: UiState["activeKindFilter"]) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isAdvancedOpen: false,
  activeKindFilter: "all",
  setAdvancedOpen: (v) => set({ isAdvancedOpen: v }),
  setKindFilter: (v) => set({ activeKindFilter: v }),
}));
```
