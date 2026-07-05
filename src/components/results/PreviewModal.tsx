import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { formatBytesExact } from "@/lib/format";
import type { Job } from "@/types";

export function PreviewModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const [sliderPos, setSliderPos] = useState(50);

  const origUrl = convertFileSrc(job.inputPath);
  const outUrl = job.outputPath ? convertFileSrc(job.outputPath) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/80">
      <div className="relative w-full max-w-5xl bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 shadow-2xl flex flex-col h-[80vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <h2 className="text-lg font-semibold text-zinc-100">Before & After Preview</h2>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 relative bg-black select-none overflow-hidden" 
             onMouseMove={e => {
               const rect = e.currentTarget.getBoundingClientRect();
               setSliderPos(((e.clientX - rect.left) / rect.width) * 100);
             }}
             onTouchMove={e => {
               const rect = e.currentTarget.getBoundingClientRect();
               setSliderPos(((e.touches[0].clientX - rect.left) / rect.width) * 100);
             }}>
          {/* Before Image */}
          <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
            <img src={origUrl} className="max-w-full max-h-full object-contain pointer-events-none" alt="Before" />
          </div>
          
          {/* After Image */}
          {outUrl ? (
            <div 
              className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden" 
              style={{ clipPath: `polygon(${sliderPos}% 0, 100% 0, 100% 100%, ${sliderPos}% 100%)` }}
            >
              <img src={outUrl} className="max-w-full max-h-full object-contain pointer-events-none" alt="After" />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2 text-zinc-400">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-sm">Compressing preview...</span>
              </div>
            </div>
          )}

          {/* Slider line */}
          {outUrl && (
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] cursor-ew-resize z-10"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
                <div className="w-4 h-4 flex items-center justify-between">
                  <div className="w-0.5 h-3 bg-zinc-800 rounded" />
                  <div className="w-0.5 h-3 bg-zinc-800 rounded" />
                </div>
              </div>
            </div>
          )}

          {/* Labels */}
          <div className="absolute bottom-4 left-4 flex flex-col gap-1 items-start pointer-events-none">
            <div className="px-3 py-1 bg-black/60 text-white text-xs font-semibold rounded-md backdrop-blur-md">
              Before
            </div>
            <div className="px-2 py-1 bg-black/60 text-zinc-300 text-[10px] font-mono rounded backdrop-blur-md">
              {formatBytesExact(job.inputBytes)}
            </div>
          </div>
          {outUrl && (
            <div className="absolute bottom-4 right-4 flex flex-col gap-1 items-end pointer-events-none">
              <div className="px-3 py-1 bg-black/60 text-white text-xs font-semibold rounded-md backdrop-blur-md">
                After
              </div>
              <div className="px-2 py-1 bg-black/60 text-emerald-300 text-[10px] font-mono rounded backdrop-blur-md">
                {job.outputBytes ? formatBytesExact(job.outputBytes) : "Unknown size"}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
