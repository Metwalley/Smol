import { useAudioAdvanced, useSettingsStore } from "@/store/settings";

export function AudioAdvancedSettings() {
  const settings = useAudioAdvanced();

  return (
    <div className="space-y-6">
      {/* Codec */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">Codec</label>
        <select
          value={settings?.codec ?? "aac"}
          onChange={(e) => useSettingsStore.getState().patchAudioAdvanced({ codec: e.target.value as "mp3" | "aac" | "opus" | "flac" | "wav" })}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="aac">AAC</option>
          <option value="mp3">MP3</option>
          <option value="opus">Opus</option>
          <option value="flac">FLAC (lossless)</option>
          <option value="wav">WAV (uncompressed)</option>
        </select>
      </div>

      {/* Bitrate */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">Bitrate (kbps)</label>
        <input
          type="number"
          value={settings?.kbps ?? 128}
          onChange={(e) => useSettingsStore.getState().patchAudioAdvanced({ kbps: parseInt(e.target.value) })}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Sample rate */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">Sample rate (Hz)</label>
        <select
          value={settings?.sampleRate ?? ""}
          onChange={(e) => useSettingsStore.getState().patchAudioAdvanced({ sampleRate: e.target.value ? parseInt(e.target.value) : undefined })}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="">Auto</option>
          <option value="48000">48000</option>
          <option value="44100">44100</option>
          <option value="22050">22050</option>
        </select>
      </div>
    </div>
  );
}
