export type FileKind = "video" | "audio" | "image" | "pdf";

export type JobStatus =
  | "queued"
  | "probing"
  | "thumbnailing"
  | "ready"
  | "encoding"
  | "done"
  | "failed"
  | "cancelled";

export interface MediaProbe {
  durationSec?: number;
  width?: number;
  height?: number;
  fps?: number;
  videoCodec?: string;
  audioCodec?: string;
  pageCount?: number;
  bitrateKbps?: number;
  containerFormat?: string;
}

export interface Job {
  id: string;
  inputPath: string;
  outputPath?: string;
  kind: FileKind;
  status: JobStatus;
  progress: number;
  speed?: string;
  etaSec?: number;
  inputBytes: number;
  outputBytes?: number;
  probe?: MediaProbe;
  thumbnailPath?: string;
  errorMessage?: string;
}

export type CompressionPreset = "less" | "recommended" | "extreme" | "lossless";

export interface TargetFileSize {
  mode: "absolute" | "percent";
  value: number;
}

export interface Settings {
  preset: CompressionPreset;
  targetFileSize?: TargetFileSize;
  outputMode: "same-folder" | "subfolder" | "custom";
  customOutputDir?: string;
  filenamePattern: string;
  parallelJobs: number;
  advanced: {
    video?: {
      codec?: "h264" | "h265" | "av1";
      crf?: number;
      scale?: number;
      fps?: number;
      hwEncoder?: "auto" | "nvenc" | "qsv" | "amf" | "none";
      audioKbps?: number;
      faststart?: boolean;
      stripMetadata?: boolean;
    };
    audio?: {
      codec?: "mp3" | "aac" | "opus" | "flac" | "wav";
      kbps?: number;
      sampleRate?: number;
    };
    image?: {
      format?: "keep" | "jpeg" | "png" | "webp" | "avif";
      quality?: number;
      resize?: { mode: "fit" | "exact" | "off"; w?: number; h?: number };
      stripMetadata?: boolean;
    };
    pdf?: {
      preset?: "screen" | "ebook" | "printer" | "prepress";
      dpi?: number;
      downsampleThreshold?: number;
    };
  };
}
