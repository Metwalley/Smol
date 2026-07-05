import { useOutputMode, useFilenamePattern, useCustomOutputDir, useSettingsStore } from "@/store/settings";
import { useIsSqueezing, useReadyCompressableCount, useEncodingJobCount } from "@/store/jobs";
import { startSqueeze } from "@/hooks/useCompression";
import { Zap, Loader2 } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";

type OutputMode = "same-folder" | "subfolder" | "custom";

export function OutputControls() {
  const outputMode      = useOutputMode();
  const customOutputDir = useCustomOutputDir();
  const filenamePattern = useFilenamePattern();
  const isSqueezing     = useIsSqueezing();
  const readyCompressableCount = useReadyCompressableCount();
  const encodingJobCount = useEncodingJobCount();

  // Button is active when there are any ready video/audio/image jobs and we're not already compressing
  const canSqueeze = readyCompressableCount > 0 && !isSqueezing;

  const modes = [
    { id: "same-folder" as const, label: "Same folder" },
    { id: "subfolder" as const, label: "Subfolder 'smol/'" },
    {
      id: "custom" as const,
      label: customOutputDir
        ? `Folder: ${customOutputDir.split(/[\\/]/).pop()}`
        : "Choose folder...",
    },
  ];


  async function handleModeChange(mode: OutputMode) {
    if (mode === "custom") {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        useSettingsStore.getState().patch({ outputMode: mode, customOutputDir: selected });
      } else {
        // If cancelled, revert to previous mode if no custom dir is set yet
        if (!useSettingsStore.getState().customOutputDir) {
          useSettingsStore.getState().patch({ outputMode: "same-folder" });
        } else {
          // just force re-render if they cancelled but already had a custom dir
          useSettingsStore.getState().patch({ outputMode: "custom" });
        }
      }
    } else {
      useSettingsStore.getState().patch({ outputMode: mode });
    }
  }

  return (
    <div className="flex items-center gap-2">


      {/* Image Format dropdown removed — Smol only compresses, it does not convert */}

      {/* Output mode — compact select dropdown */}
      <select
        value={outputMode}
        onChange={(e) => handleModeChange(e.target.value as OutputMode)}
        className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 cursor-pointer shrink-0 max-w-[140px] truncate"
      >
        {modes.map((mode) => (
          <option key={mode.id} value={mode.id}>
            {mode.label}
          </option>
        ))}
      </select>

      {/* Filename pattern */}
      <input
        type="text"
        value={filenamePattern}
        onChange={(e) =>
          useSettingsStore.getState().patch({ filenamePattern: e.target.value })
        }
        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
        placeholder="{name}_smol{ext}"
      />

      {/* Squeeze button — right side, normal-sized, no w-full */}
      <button
        disabled={!canSqueeze}
        onClick={() => { void startSqueeze(); }}
        className={`
          px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-1.5 transition-all shrink-0
          ${!canSqueeze
            ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
            : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
          }
        `}
      >
        {isSqueezing
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Zap className="h-4 w-4" />
        }
        {isSqueezing ? `Squeezing ${encodingJobCount}/${readyCompressableCount + encodingJobCount}…` : "Squeeze"}
      </button>
    </div>
  );
}
