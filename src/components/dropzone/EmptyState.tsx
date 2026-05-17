// Phase 2 will replace this with the full drag-drop zone.
// For now it holds the empty-state placeholder so App.tsx stays clean.
export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <p className="text-zinc-400 text-base font-medium">Drop files here to compress them</p>
      <p className="text-zinc-600 text-sm">Video · Audio · Image · PDF</p>
    </div>
  );
}
