import io
import tempfile
import unittest
from pathlib import Path
from research_impersonation_video import fetch_source, write_report

class Response(io.BytesIO):
    def geturl(self): return "https://huggingface.co/example"

class ResearchTest(unittest.TestCase):
    def test_records_declared_license_without_inventing_benchmarks(self):
        result = fetch_source(("model", "https://huggingface.co/example", "IMAGE_TO_VIDEO"), opener=lambda *a, **k: Response(b"---\nlicense: apache-2.0\n---\nGPU memory: example only"))
        self.assertEqual(result["license_declared"], "apache-2.0")
        self.assertFalse(result["gpu_benchmark_executed"])
        self.assertIsNone(result["vram_measured_gb"])
        with tempfile.TemporaryDirectory() as directory:
            write_report(Path(directory), [result])
            self.assertIn("FETCHED", (Path(directory) / "sources.json").read_text())
    def test_network_failure_never_becomes_validated_source(self):
        def fail(*args, **kwargs): raise OSError("offline")
        self.assertEqual(fetch_source(("x", "https://example.com", "VIDEO"), opener=fail)["status"], "ERROR")

if __name__ == "__main__": unittest.main()
