import { convertFileSrc } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import { kindBadgeColor, kindLabel } from "@/lib/kinds";
import type { Job } from "@/types";

interface ThumbnailProps {
  job: Job;
  /** "md" = 64×64 px (active rows); "sm" = 40×40 px (done cards). Default: "md" */
  size?: "sm" | "md";
}

export function Thumbnail({ job, size = "md" }: ThumbnailProps) {
  const sizeClass = size === "sm" ? "w-10 h-10" : "w-16 h-16";
  const thumbPath = job.thumbnailPath;

  if (thumbPath === undefined) {
    return (
      <div className={cn("flex-shrink-0 rounded-md overflow-hidden bg-zinc-800", sizeClass)}>
        <div className="w-full h-full bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 animate-pulse" />
      </div>
    );
  }

  const src = thumbPath ? convertFileSrc(thumbPath) : null;
  return (
    <div className={cn("flex-shrink-0 rounded-md overflow-hidden bg-zinc-800 flex items-center justify-center", sizeClass)}>
      {src ? (
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded", kindBadgeColor(job.kind))}>
          {kindLabel(job.kind).toUpperCase().slice(0, 3)}
        </span>
      )}
    </div>
  );
}
