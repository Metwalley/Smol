import { Channel } from "@tauri-apps/api/core";
import { useJobsStore } from "@/store/jobs";
import { useSettingsStore } from "@/store/settings";
import { compressAudio, compressImage, compressPdf, compressVideo } from "@/lib/tauri";
import type { VideoProgressEvent } from "@/lib/tauri";
import { buildOutputPath } from "@/lib/outputPath";

/**
 * Extract a human-readable string from whatever Tauri throws on command failure.
 *
 * Tauri rejects with a serialised AppError object: { kind: "Other", message: "…" }
 * rather than a JS Error instance, so we probe for `.message` first.
 */
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (
    err !== null &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as Record<string, unknown>).message === "string"
  ) {
    return (err as Record<string, unknown>).message as string;
  }
  return String(err);
}

/**
 * Start compression for every "ready" video or audio job in the queue.
 *
 * All eligible jobs are fired concurrently.  Each gets its own Channel so
 * progress events are routed atomically to the correct row — no extra UI code
 * needed for audio because it reuses the identical state machine.
 *
 * Audio note: the Rust command may change the output file extension
 * (e.g. WAV → mp3).  CompressResult.outputPath always reflects the actual
 * file written on disk, so the store is always consistent.
 */
export async function startSqueeze(): Promise<void> {
  const { jobs, jobIds } = useJobsStore.getState();
  const { preset, outputMode, filenamePattern, customOutputDir } =
    useSettingsStore.getState();

  // Collect ready video + audio + image + pdf jobs
  const readyIds = jobIds.filter(
    (id) =>
      (jobs[id]?.kind === "video" ||
        jobs[id]?.kind === "audio" ||
        jobs[id]?.kind === "image" ||
        jobs[id]?.kind === "pdf") &&
      jobs[id]?.status === "ready",
  );

  if (readyIds.length === 0) return;

  // Transition all to "encoding" before spawning so the UI reacts immediately
  for (const id of readyIds) {
    useJobsStore.getState().transitionStatus(id, "encoding");
  }

  const parallelLimit = useSettingsStore.getState().parallelJobs || 4;
  const executing = new Set<Promise<void>>();

  for (const jobId of readyIds) {
    const p = (async () => {
      const job = useJobsStore.getState().jobs[jobId];
      if (!job) return;

      const outputPath = buildOutputPath(
        job.inputPath,
        outputMode,
        filenamePattern,
        customOutputDir,
      );

      // Each job gets its own channel — events carry jobId so routing is exact
      const channel = new Channel<VideoProgressEvent>();
      channel.onmessage = (ev) => {
        useJobsStore.getState().updateJobProgress(jobId, {
          progress: Math.round(ev.fraction * 100),
          speed: ev.speed,
          etaSec: ev.etaSec,
          outputBytes: ev.currentBytes,
        });
      };

      try {
        let result;
        if (job.kind === "image") {
          result = await compressImage(
            jobId,
            job.inputPath,
            outputPath,
            preset,
            job.probe?.durationSec ?? null,
            channel,
          );
        } else {
          const compressFn =
            job.kind === "audio" ? compressAudio :
            job.kind === "pdf"   ? compressPdf   :
            compressVideo;
            
          const targetFileSize = job.kind === "video" 
            ? (useSettingsStore.getState().targetFileSize?.value ?? null)
            : null;

          result = await (compressFn as unknown as CallableFunction)(
            jobId,
            job.inputPath,
            outputPath,
            preset,
            job.probe?.durationSec ?? null,
            channel,
            targetFileSize
          );
        }

        // result.outputLarger: compressed ≥ original — original was kept
        useJobsStore.getState().setJobOutput(
          jobId,
          result.outputPath,
          result.outputBytes,
        );
      } catch (err) {
        useJobsStore.getState().setJobError(jobId, extractErrorMessage(err));
      }
    })().finally(() => executing.delete(p));

    executing.add(p);
    if (executing.size >= parallelLimit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}
