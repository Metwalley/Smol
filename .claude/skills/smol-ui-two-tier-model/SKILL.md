---
name: smol-ui-two-tier-model
description: Use this skill when you are about to add any settings, advanced options, or new controls to the UI. Enforces the Casual / Advanced split (HR-8, HR-11, HR-13, HR-14).
---

# Smol Two-Tier UI Model

## The rule (HR-8)

There are exactly two tiers. No third tier.

| Tier | Where | What lives here |
|---|---|---|
| **Casual** | Main view (always visible) | Drop zone, 4 preset cards, output mode, filename pattern, queue list, filter chips, Squeeze button |
| **Advanced** | Right-side drawer (gear icon) | Per-kind codec knobs, CRF, resolution, HW encoder, bitrate, strip-metadata, Target File Size, parallel jobs |

---

## What is NEVER shown in Casual mode (HR-11)

- Codec names (H.264, HEVC, AV1, libopus, ...)
- CRF values
- Bitrate numbers
- Hardware-encoder toggles (NVENC, QSV, AMF)
- Target File Size control

---

## The four preset cards

```tsx
const PRESETS = [
  {
    id: "less",
    label: "Less Compression",
    subtitle: "High quality, larger file",
  },
  {
    id: "recommended",
    label: "Recommended",
    subtitle: "Good quality, good compression",
    default: true,
  },
  {
    id: "extreme",
    label: "Extreme Compression",
    subtitle: "Smaller file, lower quality",
  },
  {
    id: "lossless",
    label: "Lossless",
    subtitle: "No quality loss, modest compression",
    // Note: disabled for video (show as greyed + tooltip "Not available for video")
  },
] as const;
```

Style inspiration: iLovePDF, img2go, Adobe Acrobat PDF compressor.
Each card shows the estimated output size for the whole queue below the subtitle.

---

## Advanced drawer

Slides in from the right on gear-icon click. Uses Framer Motion:

```tsx
<AnimatePresence>
  {isOpen && (
    <motion.div
      key="advanced-drawer"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed right-0 top-0 h-full w-96 bg-zinc-900 shadow-2xl z-50 flex flex-col"
    >
      <DrawerHeader onClose={() => setAdvancedOpen(false)} />
      <Tabs defaultValue="video" className="flex-1 min-h-0 flex flex-col">
        <TabsList>
          <TabsTrigger value="video">Video</TabsTrigger>
          <TabsTrigger value="audio">Audio</TabsTrigger>
          <TabsTrigger value="image">Image</TabsTrigger>
          <TabsTrigger value="pdf">PDF</TabsTrigger>
        </TabsList>
        <TabsContent value="video" className="flex-1 overflow-y-auto min-h-0">
          <VideoAdvancedSettings />
        </TabsContent>
        {/* ... */}
      </Tabs>
    </motion.div>
  )}
</AnimatePresence>
```

---

## Single unified queue (HR-13)

Do NOT create top-level tabs like "Videos | Audio | Images | PDFs".
Instead: one drop zone, one queue list. The filter chips (`All · Videos · Audio · Images · PDFs`) narrow the view but do not separate the data.

```tsx
// src/components/filelist/FilterChips.tsx
const filters = ["all", "video", "audio", "image", "pdf"] as const;

export function FilterChips() {
  const activeFilter = useUiStore((s) => s.activeKindFilter);
  const counts = useKindCounts(); // computed from jobs store

  return (
    <div className="flex gap-2 px-2 py-1 shrink-0">
      {filters.map((f) => {
        const count = f === "all" ? counts.total : counts[f];
        if (f !== "all" && count === 0) return null;
        return (
          <button
            key={f}
            onClick={() => useUiStore.getState().setKindFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
              ${activeFilter === f ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"}`}
          >
            {f === "all" ? `All (${count})` : `${capitalize(f)}s (${count})`}
          </button>
        );
      })}
    </div>
  );
}
```

---

## Anti-patterns to reject

1. A "third tier" (e.g. per-row expand arrow that reveals codec settings inline).
2. Codec names appearing in Casual mode, even as greyed-out hints.
3. Making the Advanced drawer full-screen or a modal — it must be a side drawer.
4. Separate queue tabs per kind at the top level.
