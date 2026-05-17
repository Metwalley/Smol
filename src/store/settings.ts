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

type SettingsStore = Settings & { patch: (updates: Partial<Settings>) => void };

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      patch: (updates) => set(updates),
    }),
    {
      name: "smol-settings",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Atomic selectors (HR-7)
export const usePreset = () => useSettingsStore((s) => s.preset);
export const useOutputMode = () => useSettingsStore((s) => s.outputMode);
export const useFilenamePattern = () => useSettingsStore((s) => s.filenamePattern);
export const useParallelJobs = () => useSettingsStore((s) => s.parallelJobs);
