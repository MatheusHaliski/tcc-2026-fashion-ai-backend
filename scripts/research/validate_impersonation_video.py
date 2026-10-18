#!/usr/bin/env python3
"""Validate an existing local clip, never generate or certify a person's identity.

Temporal checks use decoded luma frames to reject stills and quantify the loop
seam. Identity/garment fidelity require separate authorized reference evaluation.
"""
import argparse
from fractions import Fraction
import hashlib
import json
import math
from pathlib import Path
import subprocess


def inspect_video(path, runner=subprocess.run):
    path = Path(path).resolve(strict=True)
    if not path.is_file() or path.stat().st_size > 100_000_000:
        raise ValueError("INVALID_VIDEO_FILE")
    probe = runner(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)],
                   check=True, capture_output=True, timeout=30)
    metadata = json.loads(probe.stdout)
    streams = [s for s in metadata.get("streams", []) if s.get("codec_type") == "video"]
    if len(streams) != 1: raise ValueError("EXPECTED_ONE_VIDEO_STREAM")
    stream = streams[0]
    duration = float(stream.get("duration") or metadata.get("format", {}).get("duration", 0))
    fps = float(Fraction(stream.get("avg_frame_rate", "0/1")))
    if not math.isfinite(duration) or not 4.8 <= duration <= 5.2: raise ValueError("DURATION_OUTSIDE_FIVE_SECOND_TARGET")
    if not 23.9 <= fps <= 24.1: raise ValueError("EXPECTED_24_FPS")
    if not 16 <= int(stream.get("width", 0)) <= 2160 or not 16 <= int(stream.get("height", 0)) <= 3840:
        raise ValueError("UNSUPPORTED_RESOLUTION")
    if stream.get("codec_name") not in ("h264", "vp8", "vp9", "av1"):
        raise ValueError("UNSUPPORTED_CODEC")
    if any(s.get("codec_type") == "audio" for s in metadata.get("streams", [])):
        raise ValueError("AUDIO_NOT_ALLOWED")
    # Bounded decoding. Small luma frames suffice for coarse motion/seam diagnostics.
    decoded = runner(["ffmpeg", "-v", "error", "-i", str(path), "-t", "5.3", "-vf", "scale=32:48,fps=24", "-pix_fmt", "gray", "-f", "rawvideo", "-"],
                     check=True, capture_output=True, timeout=60).stdout
    size = 32 * 48
    if len(decoded) % size: raise ValueError("INCOMPLETE_DECODE")
    frames = [decoded[i:i+size] for i in range(0, len(decoded), size)]
    if not 115 <= len(frames) <= 125: raise ValueError("UNEXPECTED_FRAME_COUNT")
    def difference(a, b): return sum(abs(x-y) for x, y in zip(a, b)) / size / 255
    motion = [difference(a, b) for a, b in zip(frames, frames[1:])]
    seam = difference(frames[-1], frames[0])
    mean = sum(motion) / len(motion)
    warnings = []
    if mean < .0001: warnings.append("STATIC_OR_NEAR_STATIC_CLIP")
    if seam > max(.02, mean * 3): warnings.append("LOOP_SEAM_REQUIRES_REVIEW")
    return dict(status="MEDIA_REVIEW_REQUIRED" if warnings else "MEDIA_CHECKS_PASSED",
                durationSeconds=duration, fps=fps, frameCount=len(frames),
                width=stream["width"], height=stream["height"], codec=stream["codec_name"],
                sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                meanFrameDifference=mean, loopSeamDifference=seam, warnings=warnings,
                identityVerified=False, garmentCorrespondenceVerified=False,
                anatomicalFitCertified=False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = inspect_video(args.video)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(report["status"])
    if report["warnings"]: raise SystemExit(2)


if __name__ == "__main__": main()
