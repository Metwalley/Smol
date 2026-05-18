import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Settings } from "@/types";

const DEFAULT_ADVANCED = {
  video: {
    codec: "h264" as const,
    crf: 23,
    targetResolution: "original" as const,
    fps: undefined,
    hwEncoder: "auto" as const,
    audioKbps: 128,
    faststart: true,
    stripMetadata: false,
  },
  audio: {
    codec: "aac" as const,
    kbps: 128,
    sampleRate: undefined,
  },
  image: {
    format: "keep" as const,
    quality: 85,
    resize: { mode: "off" as const },
    stripMetadata: false,
  },
  pdf: {
    preset: "ebook" as const,
    dpi: undefined,
    downsampleThreshold: undefined,
  },
} as const;

const DEFAULT_SETTINGS: Settings = {
  preset: "recommended",
  outputMode: "same-folder",
  filenamePattern: "{name}_smol{ext}",
  parallelJobs: 4,
  advanced: DEFAULT_ADVANCED,
};

type SettingsStore = Settings & {
  patch: (updates: Partial<Settings>) => void;
  patchVideoAdvanced: (updates: Partial<Settings["advanced"]["video"]>) => void;
  patchAudioAdvanced: (updates: Partial<Settings["advanced"]["audio"]>) => void;
  patchImageAdvanced: (updates: Partial<Settings["advanced"]["image"]>) => void;
  patchPdfAdvanced: (updates: Partial<Settings["advanced"]["pdf"]>) => void;
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      patch: (updates) => set(updates),
      patchVideoAdvanced: (updates) =>
        set((s) => ({
          advanced: { ...s.advanced, video: { ...s.advanced.video, ...updates } },
        })),
      patchAudioAdvanced: (updates) =>
        set((s) => ({
          advanced: { ...s.advanced, audio: { ...s.advanced.audio, ...updates } },
        })),
      patchImageAdvanced: (updates) =>
        set((s) => ({
          advanced: { ...s.advanced, image: { ...s.advanced.image, ...updates } },
        })),
      patchPdfAdvanced: (updates) =>
        set((s) => ({
          advanced: { ...s.advanced, pdf: { ...s.advanced.pdf, ...updates } },
        })),
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
export const useTargetFileSize = () => useSettingsStore((s) => s.targetFileSize);
export const useCustomOutputDir = () => useSettingsStore((s) => s.customOutputDir);

// Advanced settings selectors (atomic - return direct state refs)
export const useVideoAdvanced = () => useSettingsStore((s) => s.advanced.video);
export const useAudioAdvanced = () => useSettingsStore((s) => s.advanced.audio);
export const useImageAdvanced = () => useSettingsStore((s) => s.advanced.image);
export const usePdfAdvanced = () => useSettingsStore((s) => s.advanced.pdf);
