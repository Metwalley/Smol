---
name: smol-flex-scroll-fix
description: Use this skill when you are about to implement a scrollable list, add overflow-auto/overflow-y-auto, use max-h, or build the FileList or queue component. Prevents bug #4 (list refuses to scroll).
---

# Smol Flex Scroll Fix

## The problem

In a flex column layout, `overflow-y-auto` on an inner element does nothing unless
**every flex ancestor in the chain** has `min-h-0`. Tailwind's default flex items have
`min-height: auto` which prevents shrinking below the natural content height, so the
scroll container never gets a bounded height and never scrolls.

---

## The fix: `min-h-0` chain

```
<div class="flex flex-col h-screen">           ← root: explicit height
  <div class="shrink-0 h-10">Titlebar</div>    ← fixed-height header
  <div class="flex flex-col flex-1 min-h-0">   ← ★ min-h-0 here
    <div class="shrink-0">Drop zone</div>
    <div class="shrink-0">Preset cards</div>
    <div class="flex flex-col flex-1 min-h-0"> ← ★ and here
      <div class="shrink-0">Filter chips</div>
      <div class="overflow-y-auto flex-1 min-h-0"> ← ★ and here = scrollable!
        <!-- job rows -->
      </div>
    </div>
  </div>
</div>
```

**Rule**: for every `flex flex-col` container that you want to scroll an inner element,
add `min-h-0` to the container AND to the scrollable element itself.

---

## FileList component skeleton

```tsx
// src/components/filelist/FileList.tsx
export function FileList() {
  const jobIds = useAllJobIds();

  return (
    // This wrapper must be flex-col flex-1 min-h-0 in its parent
    <div className="flex flex-col flex-1 min-h-0">
      <FilterChips />
      <div className="overflow-y-auto flex-1 min-h-0 space-y-1 px-2 py-1">
        {jobIds.map((id) => (
          <JobRow key={id} jobId={id} />
        ))}
      </div>
    </div>
  );
}
```

---

## Quick diagnostic checklist

If the list still won't scroll:

1. Open DevTools → select the scroll container → check computed `height`. If it says
   `height: auto` or matches the full content height, a parent is missing `min-h-0`.
2. Walk up the DOM. Every `display: flex; flex-direction: column` ancestor needs
   `min-height: 0px`.
3. The outermost container must have an explicit height (`h-screen`, `h-full` with a
   bounded parent, or a fixed pixel value). `h-full` on the root div does NOT work unless
   `<html>` and `<body>` also have `height: 100%` / `h-full`.

---

## Tailwind v4 note

Tailwind 4 uses `@layer` instead of `tailwind.config.js`. The `min-h-0` utility is
still available as `min-h-0`. No change needed from v3.
