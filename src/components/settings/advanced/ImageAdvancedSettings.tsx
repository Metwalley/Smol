import { useImageAdvanced, useSettingsStore } from "@/store/settings";

export function ImageAdvancedSettings() {
  const settings = useImageAdvanced();

  return (
    <div className="space-y-6">
      {/* Output format */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">Output format</label>
        <select
          value={settings?.format ?? "keep"}
          onChange={(e) => useSettingsStore.getState().patchImageAdvanced({ format: e.target.value as "keep" | "jpeg" | "png" | "webp" | "avif" })}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="keep">Keep original</option>
          <option value="jpeg">JPEG</option>
          <option value="png">PNG</option>
          <option value="webp">WebP</option>
          <option value="avif">AVIF</option>
        </select>
      </div>

      {/* Quality */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Quality: {settings?.quality ?? 85}
        </label>
        <input
          type="range"
          min="1"
          max="100"
          value={settings?.quality ?? 85}
          onChange={(e) => useSettingsStore.getState().patchImageAdvanced({ quality: parseInt(e.target.value) })}
          className="w-full accent-indigo-500"
        />
        <div className="flex justify-between text-xs text-zinc-500 mt-1">
          <span>1 (worst)</span>
          <span>100 (best)</span>
        </div>
      </div>

      {/* Resize mode */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">Resize</label>
        <select
          value={settings?.resize?.mode ?? "off"}
          onChange={(e) => useSettingsStore.getState().patchImageAdvanced({ resize: { mode: e.target.value as "fit" | "exact" | "off" } })}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="off">Off</option>
          <option value="fit">Fit within dimensions</option>
          <option value="exact">Exact dimensions</option>
        </select>
      </div>

      {/* Strip metadata */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="strip-metadata"
          checked={settings?.stripMetadata ?? false}
          onChange={(e) => useSettingsStore.getState().patchImageAdvanced({ stripMetadata: e.target.checked })}
          className="accent-indigo-500"
        />
        <label htmlFor="strip-metadata" className="text-sm text-zinc-300">Strip metadata</label>
      </div>
    </div>
  );
}
