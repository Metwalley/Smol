import { cn } from "@/lib/utils";
import type { FileKind } from "@/types";

interface Chip {
  label: string;
  value: FileKind | "all";
}

const CHIPS: Chip[] = [
  { label: "All",    value: "all"   },
  { label: "Videos", value: "video" },
  { label: "Audio",  value: "audio" },
  { label: "Images", value: "image" },
  { label: "PDFs",   value: "pdf"   },
];

interface Props {
  counts: Record<FileKind | "all", number>;
  active: FileKind | "all";
  onSelect: (v: FileKind | "all") => void;
}

export function TypeFilterChips({ counts, active, onSelect }: Props) {
  const visible = CHIPS.filter((c) => c.value === "all" || counts[c.value] > 0);

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 shrink-0 flex-wrap">
      {visible.map((chip) => (
        <button
          key={chip.value}
          onClick={() => onSelect(chip.value)}
          className={cn(
            "flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors",
            active === chip.value
              ? "bg-indigo-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          )}
        >
          {chip.label}
          <span
            className={cn(
              "text-[10px] font-semibold",
              active === chip.value ? "text-indigo-200" : "text-zinc-500"
            )}
          >
            {counts[chip.value]}
          </span>
        </button>
      ))}
    </div>
  );
}
