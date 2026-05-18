import { useOutputMode, useFilenamePattern, useSettingsStore } from "@/store/settings";
import { useJobCount } from "@/store/jobs";
import { Zap } from "lucide-react";

const OUTPUT_MODES = [
  { id: "same-folder" as const, label: "Same folder as source" },
  { id: "subfolder" as const, label: "Subfolder 'smol/'" },
  { id: "custom" as const, label: "Choose folder" },
];

export function OutputControls() {
  const outputMode = useOutputMode();
  const filenamePattern = useFilenamePattern();
  const jobCount = useJobCount();

  return (
    <div className="flex flex-col gap-4">
      {/* Output mode */}
      <div className="flex gap-2">
        {OUTPUT_MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => useSettingsStore.getState().patch({ outputMode: mode.id })}
            className={`
              px-3 py-2 rounded-lg text-sm font-medium transition-all
              ${outputMode === mode.id
                ? "bg-indigo-600 text-white"
                : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }
            `}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Filename pattern */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-zinc-400 whitespace-nowrap">Filename pattern</label>
        <input
          type="text"
          value={filenamePattern}
          onChange={(e) => useSettingsStore.getState().patch({ filenamePattern: e.target.value })}
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
          placeholder="{name}_smol{ext}"
        />
      </div>

      {/* Squeeze button */}
      <button
        disabled={jobCount === 0}
        className={`
          w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all
          ${jobCount === 0
            ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
            : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
          }
        `}
      >
        <Zap className="h-5 w-5" />
        Squeeze
      </button>
    </div>
  );
}
