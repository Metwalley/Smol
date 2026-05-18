import { Settings } from "lucide-react";
import { useUiStore } from "@/store/ui";

export function Titlebar() {
  const isAdvancedOpen = useUiStore((s) => s.isAdvancedOpen);
  const setAdvancedOpen = useUiStore((s) => s.setAdvancedOpen);

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-10 px-4 select-none shrink-0"
    >
      <div className="flex items-center">
        <img src="/logo.svg" className="h-5 w-5 mr-2" alt="Smol" />
        <span className="text-sm font-semibold text-zinc-200">Smol</span>
      </div>
      {/* System Min/Max/Close controls are drawn by Windows at the right edge.
          Leave ~138 px of space — do not place interactive elements there. */}
      <button
        onClick={() => setAdvancedOpen(!isAdvancedOpen)}
        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
        aria-label="Advanced settings"
      >
        <Settings className="h-4 w-4" />
      </button>
    </div>
  );
}
