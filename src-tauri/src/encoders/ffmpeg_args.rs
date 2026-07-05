use crate::encoders::hw_detect::HwEncoders;

// ─── Audio arg builder ────────────────────────────────────────────────────────

/// Determine the output file extension for an audio compression job.
///
/// | Preset      | Input ext            | Output ext |
/// |-------------|----------------------|------------|
/// | lossless    | wav / aiff / aif     | flac       |
/// | lossless    | flac / mp3 / m4a … | same as in |
/// | lossy       | wav / flac / wma …  | mp3        |
/// | lossy       | mp3                  | mp3        |
/// | lossy       | m4a / aac            | m4a        |
/// | lossy       | ogg                  | ogg        |
/// | lossy       | opus                 | opus       |
pub fn audio_output_ext(preset: &str, input_ext: &str) -> &'static str {
    if preset == "lossless" {
        return match input_ext {
            "wav" | "aiff" | "aif" => "flac",
            "flac"                  => "flac",
            "m4a" | "aac"          => "m4a",
            "ogg"                   => "ogg",
            "opus"                  => "opus",
            _                       => "mp3", // mp3, wma, unknown → copy into mp3
        };
    }
    // Lossy presets: uncompressed / wma → mp3; everything else keeps format
    match input_ext {
        "wav" | "flac" | "aiff" | "aif" | "wma" => "mp3",
        "mp3"                                     => "mp3",
        "m4a" | "aac"                             => "m4a",
        "ogg"                                      => "ogg",
        "opus"                                     => "opus",
        _                                          => "mp3",
    }
}

/// Build the full FFmpeg argument list for an audio transcode job.
///
/// `output` should be the `.part` temp file (caller computes this from the
/// corrected output path).  `-vn` strips embedded cover-art video streams.
///
/// | Preset      | Codec / mode                      | Bitrate |
/// |-------------|-----------------------------------|---------|
/// | less        | libmp3lame / aac / libvorbis …    | 320k    |
/// | recommended | libmp3lame / aac / libvorbis …    | 192k    |
/// | extreme     | libmp3lame / aac / libvorbis …    | 96k     |
/// | lossless    | flac (PCM sources) / copy (rest)  | —       |
pub fn build_audio_args(preset: &str, input_ext: &str, input: &str, output: &str) -> Vec<String> {
    let mut args: Vec<String> = vec![
        "-y".into(),
        "-i".into(), input.into(),
        "-vn".into(), // strip any embedded video/cover-art stream
    ];

    match preset {
        "lossless" => match input_ext {
            "wav" | "aiff" | "aif" => {
                // PCM → FLAC: lossless compression
                args.extend(["-c:a".into(), "flac".into()]);
            }
            _ => {
                // Already lossy or lossless-compressed: remux without re-encoding
                args.extend(["-c:a".into(), "copy".into()]);
            }
        },
        _ => {
            let bitrate = match preset {
                "less"    => "320k",
                "extreme" => "96k",
                _         => "192k", // "recommended" and any unknown preset
            };
            let codec = match input_ext {
                "m4a" | "aac" => "aac",
                "ogg"          => "libvorbis",
                "opus"         => "libopus",
                _              => "libmp3lame",
            };
            args.extend([
                "-c:a".into(), codec.into(),
                "-b:a".into(), bitrate.into(),
            ]);
        }
    }

    // Progress reporting key=value on stdout; suppress extra stderr noise
    args.extend([
        "-progress".into(), "pipe:1".into(),
        "-nostats".into(),
        output.into(),
    ]);

    args
}

/// Map user-facing preset names to FFmpeg quality knobs.
///
/// | Preset      | libx264 CRF | x264 preset | NVENC CQ | NVENC preset |
/// |-------------|-------------|-------------|----------|--------------|
/// | less        | 18          | slow        | 18       | p7           |
/// | recommended | 23          | medium      | 23       | p5           |
/// | extreme     | 35          | fast        | 35       | p4           |
///
/// "lossless" is disabled for video in Casual mode (HR-11); if somehow
/// reached, falls through to the recommended settings.
struct PresetParams {
    crf_sw: u32,
    preset_sw: &'static str,
    cq_hw: u32,
    preset_nvenc: &'static str,
}

fn preset_params(preset: &str) -> PresetParams {
    match preset {
        "less" => PresetParams {
            crf_sw: 18,
            preset_sw: "slow",
            cq_hw: 18,
            preset_nvenc: "p7",
        },
        "extreme" => PresetParams {
            crf_sw: 35,
            preset_sw: "fast",
            cq_hw: 35,
            preset_nvenc: "p4",
        },
        _ => PresetParams {
            // "recommended" (default) and "lossless" fallback
            crf_sw: 23,
            preset_sw: "medium",
            cq_hw: 23,
            preset_nvenc: "p5",
        },
    }
}

/// Build the full FFmpeg argument list for a video transcode job.
///
/// Selection order: NVENC → QSV → AMF → libx264 (software fallback).
/// The output path should be the `.part` temp file, not the final destination.
pub fn build_video_args(
    preset: &str,
    hw: &HwEncoders,
    input: &str,
    output: &str,
    faststart: bool,
    target_size_mb: Option<u32>,
    duration_sec: Option<f64>,
) -> Vec<String> {
    let p = preset_params(preset);
    let mut args: Vec<String> = vec![
        "-y".into(),
        "-i".into(), input.into(),
    ];

    // If target size is set, we use bitrate encoding instead of CRF/CQ
    let mut use_bitrate = false;
    let mut target_bitrate_k = 0;
    
    if let (Some(mb), Some(dur)) = (target_size_mb, duration_sec) {
        if dur > 0.0 {
            // formula: Target Bitrate (kbps) = (Target Size MB * 8192 / duration_sec) - Audio Bitrate (128)
            let video_bitrate = (mb as f64 * 8192.0 / dur) - 128.0;
            if video_bitrate > 50.0 {
                target_bitrate_k = video_bitrate as u32;
                use_bitrate = true;
            }
        }
    }

    // Video codec — prefer hardware, fall back to software
    if hw.nvenc {
        args.extend(["-c:v".into(), "h264_nvenc".into()]);
        if use_bitrate {
            args.extend(["-b:v".into(), format!("{}k", target_bitrate_k), "-maxrate".into(), format!("{}k", target_bitrate_k), "-bufsize".into(), format!("{}k", target_bitrate_k * 2)]);
        } else {
            args.extend(["-cq".into(),  p.cq_hw.to_string()]);
        }
        args.extend(["-preset".into(), p.preset_nvenc.into()]);
    } else if hw.qsv {
        args.extend(["-c:v".into(), "h264_qsv".into()]);
        if use_bitrate {
            args.extend(["-b:v".into(), format!("{}k", target_bitrate_k), "-maxrate".into(), format!("{}k", target_bitrate_k), "-bufsize".into(), format!("{}k", target_bitrate_k * 2)]);
        } else {
            args.extend(["-global_quality".into(), p.cq_hw.to_string()]);
        }
        args.extend(["-preset".into(), "medium".into()]);
    } else if hw.amf {
        args.extend(["-c:v".into(), "h264_amf".into()]);
        if use_bitrate {
            args.extend(["-b:v".into(), format!("{}k", target_bitrate_k), "-maxrate".into(), format!("{}k", target_bitrate_k), "-bufsize".into(), format!("{}k", target_bitrate_k * 2)]);
        } else {
            args.extend([
                "-rc".into(), "cqp".into(),
                "-qp_p".into(), p.cq_hw.to_string(),
                "-qp_i".into(), p.cq_hw.to_string(),
                "-quality".into(), "quality".into(),
            ]);
        }
    } else {
        args.extend(["-c:v".into(), "libx264".into()]);
        if use_bitrate {
            args.extend(["-b:v".into(), format!("{}k", target_bitrate_k), "-maxrate".into(), format!("{}k", target_bitrate_k * 2), "-bufsize".into(), format!("{}k", target_bitrate_k * 2)]);
        } else {
            args.extend(["-crf".into(), p.crf_sw.to_string()]);
        }
        args.extend(["-preset".into(), p.preset_sw.into()]);
    }

    // Audio: always re-encode to AAC 128 kbps for broad compatibility
    args.extend([
        "-c:a".into(), "aac".into(),
        "-b:a".into(), "128k".into(),
    ]);

    // +faststart: move moov atom to the front for web streaming
    if faststart {
        args.extend(["-movflags".into(), "+faststart".into()]);
    }

    // Progress reporting: key=value pairs on stdout, no extra stderr stats
    args.extend([
        "-progress".into(), "pipe:1".into(),
        "-nostats".into(),
        output.into(),
    ]);

    args
}
