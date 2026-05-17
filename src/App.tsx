import { Toaster } from "sonner";
import { useMaximized } from "@/hooks/useMaximized";

export default function App() {
  const maximized = useMaximized();

  return (
    <div
      className={`flex flex-col h-screen bg-zinc-950 text-zinc-100 select-none ${
        maximized ? "" : "rounded-xl overflow-hidden"
      }`}
    >
      {/* Titlebar — Phase 1 will flesh this out */}
      <div
        data-tauri-drag-region
        className="flex items-center h-10 px-4 shrink-0 border-b border-zinc-800"
      >
        <span className="text-sm font-semibold text-zinc-200">Smol</span>
      </div>

      {/* Main content — phases 2+ will fill this */}
      <div className="flex flex-col flex-1 min-h-0 items-center justify-center">
        <p className="text-zinc-500 text-sm">Drop files here to compress them.</p>
      </div>

      <Toaster theme="dark" position="bottom-right" />
    </div>
  );
}
