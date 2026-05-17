export function Titlebar() {
  return (
    <div
      data-tauri-drag-region
      className="flex items-center h-10 px-4 select-none shrink-0"
    >
      <img src="/logo.svg" className="h-5 w-5 mr-2" alt="Smol" />
      <span className="text-sm font-semibold text-zinc-200">Smol</span>
      {/* System Min/Max/Close controls are drawn by Windows at the right edge.
          Leave ~138 px of space — do not place interactive elements there. */}
    </div>
  );
}
