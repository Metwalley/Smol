import { Check, Zap } from "lucide-react";
import { usePreset, useSettingsStore } from "@/store/settings";
import { useJobs, useJobCount } from "@/store/jobs";
import { getPresetEstimate } from "@/lib/estimate";
import { formatBytes } from "@/lib/format";

const PRESETS = [
  {
    id: "less" as const,
    label: "Less Compression",
    subtitle: "High quality, larger file",
  },
  {
    id: "recommended" as const,
    label: "Recommended",
    subtitle: "Good quality, good compression",
    default: true,
  },
  {
    id: "extreme" as const,
    label: "Extreme Compression",
    subtitle: "Smaller file, lower quality",
  },
  {
    id: "lossless" as const,
    label: "Lossless",
    subtitle: "No quality loss, modest compression",
  },
];

function PresetCard({
  preset,
  isSelected,
  estimate,
  isDisabled,
  onClick,
}: {
  preset: (typeof PRESETS)[number];
  isSelected: boolean;
  estimate: string;
  isDisabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`
        relative flex-1 min-w-[140px] p-4 rounded-xl border-2 transition-all text-left
        ${isSelected
          ? "border-indigo-500 bg-indigo-950/30 shadow-lg shadow-indigo-500/10"
          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900"
        }
        ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      {isSelected && (
        <div className="absolute top-2 right-2">
          <div className="bg-indigo-500 rounded-full p-1">
            <Check className="h-3 w-3 text-white" />
          </div>
        </div>
      )}
      {preset.default && !isSelected && (
        <div className="absolute top-2 right-2">
          <Zap className="h-3.5 w-3.5 text-indigo-400" />
        </div>
      )}
      <div className="font-semibold text-zinc-100 text-sm mb-1">{preset.label}</div>
      <div className="text-xs text-zinc-400 mb-2">{preset.subtitle}</div>
      <div className="font-mono text-xs text-indigo-400 font-medium">
        {estimate}
      </div>
    </button>
  );
}

export function PresetCards() {
  const currentPreset = usePreset();
  const setPreset = useSettingsStore((s) => s.patch);
  const jobs = useJobs();
  const jobCount = useJobCount();

  // Compute estimates for all presets
  const estimates = PRESETS.map((p) => {
    const estBytes = jobCount > 0 ? getPresetEstimate(jobs, p.id) : undefined;
    return estBytes !== undefined ? formatBytes(estBytes) : "—";
  });

  // Disable lossless if any video in queue (HR-11)
  const hasVideo = Object.values(jobs).some((j) => j.kind === "video");

  return (
    <div className="flex gap-3 mb-4">
      {PRESETS.map((preset, idx) => (
        <PresetCard
          key={preset.id}
          preset={preset}
          isSelected={currentPreset === preset.id}
          estimate={estimates[idx]}
          isDisabled={preset.id === "lossless" && hasVideo}
          onClick={() => setPreset({ preset: preset.id })}
        />
      ))}
    </div>
  );
}
