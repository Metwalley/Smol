import { usePdfAdvanced, useSettingsStore } from "@/store/settings";

export function PdfAdvancedSettings() {
  const settings = usePdfAdvanced();

  return (
    <div className="space-y-6">
      {/* Preset */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">Compression preset</label>
        <select
          value={settings?.preset ?? "ebook"}
          onChange={(e) => useSettingsStore.getState().patchPdfAdvanced({ preset: e.target.value as "screen" | "ebook" | "printer" | "prepress" })}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="screen">/screen (72 dpi, low quality)</option>
          <option value="ebook">/ebook (150 dpi, good quality)</option>
          <option value="printer">/printer (300 dpi, high quality)</option>
          <option value="prepress">/prepress (300 dpi, color preserving)</option>
        </select>
      </div>

      {/* DPI override */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">DPI override</label>
        <input
          type="number"
          value={settings?.dpi ?? ""}
          onChange={(e) => useSettingsStore.getState().patchPdfAdvanced({ dpi: e.target.value ? parseInt(e.target.value) : undefined })}
          placeholder="Auto"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Downsample threshold */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">Downsample threshold (dpi)</label>
        <input
          type="number"
          value={settings?.downsampleThreshold ?? ""}
          onChange={(e) => useSettingsStore.getState().patchPdfAdvanced({ downsampleThreshold: e.target.value ? parseInt(e.target.value) : undefined })}
          placeholder="Auto"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
        />
        <p className="text-xs text-zinc-500 mt-1">Images above this DPI will be downsampled</p>
      </div>
    </div>
  );
}
