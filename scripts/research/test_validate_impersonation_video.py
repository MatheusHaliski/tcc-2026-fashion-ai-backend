import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from validate_impersonation_video import inspect_video

class VideoValidationTest(unittest.TestCase):
    def test_static_clip_is_never_claimed_as_identity_verified(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "clip.mp4"
            path.write_bytes(b"test")
            def run(command, **kwargs):
                data = json.dumps({"streams":[{"codec_type":"video","codec_name":"h264","width":432,"height":648,"duration":"5","avg_frame_rate":"24/1"}]}).encode() if command[0] == "ffprobe" else bytes([80]) * (32*48*120)
                return subprocess.CompletedProcess(command, 0, stdout=data)
            result = inspect_video(path, runner=run)
            self.assertIn("STATIC_OR_NEAR_STATIC_CLIP", result["warnings"])
            self.assertFalse(result["identityVerified"])
            self.assertFalse(result["garmentCorrespondenceVerified"])
    def test_wrong_duration_is_rejected_before_decoding(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "clip.mp4"; path.write_bytes(b"test")
            def run(command, **kwargs):
                return subprocess.CompletedProcess(command, 0, stdout=json.dumps({"streams":[{"codec_type":"video","duration":"8","avg_frame_rate":"24/1"}]}).encode())
            with self.assertRaisesRegex(ValueError, "DURATION_OUTSIDE"):
                inspect_video(path, runner=run)

if __name__ == "__main__": unittest.main()
