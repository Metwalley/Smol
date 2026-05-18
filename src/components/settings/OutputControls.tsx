import { useOutputMode, useFilenamePattern, useSettingsStore } from "@/store/settings";
import { useJobCount } from "@/store/jobs";
import { Zap } from "lucide-react";

type OutputMode = "same-folder" | "subfolder" | "custom";

const OUTPUT_MODES: { id: OutputMode; label: string }[] = [
  { id: "same-folder", label: "Same folder" },
  { id: "subfolder",   label: "Subfolder 'smol/'" },
  { id: "custom",      label: "Choose folder" },
];

export function OutputControls() {
  const outputMode     = useOutputMode();
  const filenamePattern = useFilenamePattern();
  const jobCount       = useJobCount();

  return (
    <div className="flex items-center gap-2">
      {/* Output mode — compact select dropdown */}
      <select
        value={outputMode}
        onChange={(e) =>
          useSettingsStore.getState().patch({ outputMode: e.target.value as OutputMode })
        }
        className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 cursor-pointer shrink-0"
      >
        {OUTPUT_MODES.map((mode) => (
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
        disabled={jobCount === 0}
        className={`
          px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-1.5 transition-all shrink-0
          ${jobCount === 0
            ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
            : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
          }
        `}
      >
        <Zap className="h-4 w-4" />
        Squeeze
      </button>
    </div>
  );
}
