// Phase 2 bare list — proves drops work.
// Phase 3 replaces this with the full FileList (thumbnails, kind badges, remove buttons).
import { useAllJobIds, useJob } from "@/store/jobs";
import { formatBytesExact } from "@/lib/format";
import { kindLabel } from "@/lib/kinds";

function BareJobRow({ jobId }: { jobId: string }) {
  const job = useJob(jobId);
  if (!job) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 border-b border-zinc-800 last:border-0">
      <span className="flex-1 truncate font-medium">{job.name}</span>
      <span className="text-zinc-500 shrink-0">{formatBytesExact(job.inputBytes)}</span>
      <span className="text-zinc-500 shrink-0 uppercase text-xs tracking-wide">{kindLabel(job.kind)}</span>
    </div>
  );
}

export function BareJobList() {
  const jobIds = useAllJobIds();
  if (jobIds.length === 0) return null;

  return (
    <div className="flex flex-col overflow-y-auto flex-1 min-h-0 mx-3 mb-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
      {jobIds.map((id) => (
        <BareJobRow key={id} jobId={id} />
      ))}
    </div>
  );
}
