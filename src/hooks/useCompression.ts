import { Channel } from "@tauri-apps/api/core";
import { useJobsStore } from "@/store/jobs";
import { useSettingsStore } from "@/store/settings";
import { compressVideo } from "@/lib/tauri";
import type { VideoProgressEvent } from "@/lib/tauri";
import { buildOutputPath } from "@/lib/outputPath";

/**
 * Start compression for every "ready" video job in the queue.
 *
 * Fires all jobs concurrently.  Each job gets its own Channel so progress
 * events are routed atomically to the correct job row.
 *
 * This is a plain async function (not a React hook) because it only uses
 * getState() — no React state or lifecycle involved.
 */
export async function startSqueeze(): Promise<void> {
  const { jobs, jobIds } = useJobsStore.getState();
  const { preset, outputMode, filenamePattern, customOutputDir } =
    useSettingsStore.getState();

  // Only video jobs that are ready
  const readyVideoIds = jobIds.filter(
    (id) => jobs[id]?.kind === "video" && jobs[id]?.status === "ready",
  );

  if (readyVideoIds.length === 0) return;

  // Transition all to "encoding" before spawning so the UI reacts immediately
  for (const id of readyVideoIds) {
    useJobsStore.getState().transitionStatus(id, "encoding");
  }

  await Promise.allSettled(
    readyVideoIds.map(async (jobId) => {
      const job = useJobsStore.getState().jobs[jobId];
      if (!job) return;

      const outputPath = buildOutputPath(
        job.inputPath,
        outputMode,
        filenamePattern,
        customOutputDir,
      );

      // Each job gets its own channel — events contain jobId so routing is unambiguous
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
        const result = await compressVideo(
          jobId,
          job.inputPath,
          outputPath,
          preset,
          job.probe?.durationSec ?? null,
          channel,
        );

        // result.outputLarger: compressed ≥ original — original was kept
        useJobsStore.getState().setJobOutput(
          jobId,
          result.outputPath,
          result.outputBytes,
        );
      } catch (err) {
        // Tauri commands reject with the serialised AppError object:
        // { kind: "Other", message: "…" } — extract `.message` when present.
        let msg: string;
        if (err instanceof Error) {
          msg = err.message;
        } else if (
          err !== null &&
          typeof err === "object" &&
          "message" in err &&
          typeof (err as Record<string, unknown>).message === "string"
        ) {
          msg = (err as Record<string, unknown>).message as string;
        } else {
          msg = String(err);
        }
        useJobsStore.getState().setJobError(jobId, msg);
      }
    }),
  );
}
