import { useVideoAdvanced, useSettingsStore } from "@/store/settings";

export function VideoAdvancedSettings() {
  const settings = useVideoAdvanced();

  return (
    <div className="space-y-6">
      {/* Codec */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">Codec</label>
        <select
          value={settings?.codec ?? "h264"}
          onChange={(e) => useSettingsStore.getState().patchVideoAdvanced({ codec: e.target.value as "h264" | "h265" | "av1" })}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="h264">H.264</option>
          <option value="h265">H.265 (HEVC)</option>
          <option value="av1">AV1</option>
        </select>
      </div>

      {/* CRF */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          CRF (Quality): {settings?.crf ?? 23}
        </label>
        <input
          type="range"
          min="0"
          max="51"
          value={settings?.crf ?? 23}
          onChange={(e) => useSettingsStore.getState().patchVideoAdvanced({ crf: parseInt(e.target.value) })}
          className="w-full accent-indigo-500"
        />
        <div className="flex justify-between text-xs text-zinc-500 mt-1">
          <span>0 (lossless)</span>
          <span>51 (worst)</span>
        </div>
      </div>

      {/* Resolution scale */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">Resolution</label>
        <select
          value={settings?.targetResolution ?? "original"}
          onChange={(e) => useSettingsStore.getState().patchVideoAdvanced({ targetResolution: e.target.value as "original" | "4k" | "1080p" | "720p" | "480p" | "custom" })}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="original">Original</option>
          <option value="4k">4K (2160p)</option>
          <option value="1080p">1080p</option>
          <option value="720p">720p</option>
          <option value="480p">480p</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {/* FPS cap */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">FPS cap</label>
        <input
          type="number"
          value={settings?.fps ?? ""}
          onChange={(e) => useSettingsStore.getState().patchVideoAdvanced({ fps: e.target.value ? parseInt(e.target.value) : undefined })}
          placeholder="No cap"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Hardware encoder */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">Hardware encoder</label>
        <select
          value={settings?.hwEncoder ?? "auto"}
          onChange={(e) => useSettingsStore.getState().patchVideoAdvanced({ hwEncoder: e.target.value as "auto" | "nvenc" | "qsv" | "amf" | "none" })}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="auto">Auto</option>
          <option value="nvenc">NVENC (NVIDIA)</option>
          <option value="qsv">QSV (Intel)</option>
          <option value="amf">AMF (AMD)</option>
          <option value="none">None (software only)</option>
        </select>
      </div>

      {/* Audio bitrate */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">Audio bitrate (kbps)</label>
        <input
          type="number"
          value={settings?.audioKbps ?? 128}
          onChange={(e) => useSettingsStore.getState().patchVideoAdvanced({ audioKbps: parseInt(e.target.value) })}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* FastStart */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="faststart"
          checked={settings?.faststart ?? true}
          onChange={(e) => useSettingsStore.getState().patchVideoAdvanced({ faststart: e.target.checked })}
          className="accent-indigo-500"
        />
        <label htmlFor="faststart" className="text-sm text-zinc-300">FastStart (web playback)</label>
      </div>

      {/* Strip metadata */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="strip-metadata"
          checked={settings?.stripMetadata ?? false}
          onChange={(e) => useSettingsStore.getState().patchVideoAdvanced({ stripMetadata: e.target.checked })}
          className="accent-indigo-500"
        />
        <label htmlFor="strip-metadata" className="text-sm text-zinc-300">Strip metadata</label>
      </div>
    </div>
  );
}
