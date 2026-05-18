use crate::encoders::hw_detect::HwEncoders;

/// Map user-facing preset names to FFmpeg quality knobs.
///
/// | Preset      | libx264 CRF | x264 preset | NVENC CQ | NVENC preset |
/// |-------------|-------------|-------------|----------|--------------|
/// | less        | 18          | slow        | 18       | p7           |
/// | recommended | 23          | medium      | 23       | p5           |
/// | extreme     | 30          | fast        | 30       | p4           |
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
            crf_sw: 30,
            preset_sw: "fast",
            cq_hw: 30,
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
) -> Vec<String> {
    let p = preset_params(preset);
    let mut args: Vec<String> = vec![
        "-y".into(),
        "-i".into(), input.into(),
    ];

    // Video codec — prefer hardware, fall back to software
    if hw.nvenc {
        args.extend([
            "-c:v".into(), "h264_nvenc".into(),
            "-cq".into(),  p.cq_hw.to_string(),
            "-preset".into(), p.preset_nvenc.into(),
        ]);
    } else if hw.qsv {
        args.extend([
            "-c:v".into(), "h264_qsv".into(),
            "-global_quality".into(), p.cq_hw.to_string(),
            "-preset".into(), "medium".into(),
        ]);
    } else if hw.amf {
        args.extend([
            "-c:v".into(), "h264_amf".into(),
            "-rc".into(), "cqp".into(),
            "-qp_p".into(), p.cq_hw.to_string(),
            "-qp_i".into(), p.cq_hw.to_string(),
            "-quality".into(), "quality".into(),
        ]);
    } else {
        args.extend([
            "-c:v".into(), "libx264".into(),
            "-crf".into(),    p.crf_sw.to_string(),
            "-preset".into(), p.preset_sw.into(),
        ]);
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
