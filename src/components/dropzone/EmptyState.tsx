export function EmptyState({ isDraggingOver }: { isDraggingOver: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <p className="text-zinc-400 text-base font-medium transition-colors">
        {isDraggingOver ? <span className="text-indigo-400">Release to add</span> : "Drop files here to compress them"}
      </p>
      <p className="text-zinc-600 text-sm">Video · Audio · Image · PDF</p>
    </div>
  );
}
