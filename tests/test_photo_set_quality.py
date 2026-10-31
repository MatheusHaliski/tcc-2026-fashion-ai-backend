"""Policy and local migration must prevent unsafe historical READY imports."""

import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "catalog"))

from photo_set_quality import apply_quality_gate, assess_ready_candidate  # noqa: E402
from audit_photo_set_lot import harden_set_path, audit_lot  # noqa: E402


def ready_payload():
    return {"status": "READY", "reason": None, "files": {"whole": "whole.png", "fabric": "fabric.png"},
            "metrics": {"preflight": {"status": "PASS"}, "cleanup": {"cleanupMode": "STRICT"},
                        "fashnOpen": {"personDetected": False, "attestations": {
                            "complete": True, "occluded": False, "measurement_verified": True}},
                        "whole": {"width": 900, "height": 1200, "ghostPixels": 0}}}


class PhotoSetQualityTests(unittest.TestCase):
    def test_strict_flat_lay_stays_ready(self):
        self.assertEqual(assess_ready_candidate(ready_payload()).status, "READY")

    def test_human_photograph_is_not_certified_complete(self):
        sample = ready_payload()
        sample["metrics"]["fashnOpen"]["personDetected"] = True
        gate = apply_quality_gate(sample)
        self.assertEqual(gate["status"], "REVIEW")
        self.assertEqual(gate["reason"], "HUMAN_SOURCE_REVIEW_REQUIRED")
        self.assertEqual(sample["status"], "READY")

    def test_lenient_or_ghost_repair_requires_review(self):
        sample = ready_payload()
        sample["metrics"]["cleanup"]["cleanupMode"] = "LENIENT_OPENING"
        sample["metrics"]["whole"]["ghostPixels"] = 150
        self.assertIn("LENIENT_CLEANUP_REVIEW_REQUIRED", assess_ready_candidate(sample).reasons)
        self.assertIn("GHOST_REGION_REVIEW_REQUIRED", assess_ready_candidate(sample).reasons)

    def test_legacy_missing_evidence_is_not_ready(self):
        self.assertEqual(assess_ready_candidate({"status": "READY", "metrics": {}}).status, "REVIEW")

    def test_existing_not_ready_is_unchanged(self):
        self.assertEqual(assess_ready_candidate({"status": "REVIEW", "reason": "OCCLUSION"}).status, "REVIEW")

    def test_hardening_is_opt_in_preserves_backup_and_all_other_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp) / "photo-sets" / "test-id"
            directory.mkdir(parents=True)
            path = directory / "set.json"
            record = ready_payload()
            record["metrics"]["fashnOpen"]["personDetected"] = True
            original = json.dumps(record).encode()
            path.write_bytes(original)
            (directory / "whole.png").write_bytes(b"original-photo-not-modified")
            self.assertEqual(harden_set_path(path)["status"], "NEEDS_REVIEW")
            self.assertEqual(path.read_bytes(), original)
            verdict = harden_set_path(path, apply_local=True)
            self.assertEqual(verdict["status"], "DOWNGRADED_TO_REVIEW")
            edited = json.loads(path.read_text())
            self.assertEqual(edited["status"], "REVIEW")
            self.assertNotIn("files", edited)
            self.assertEqual(edited["reviewPreviewFiles"], record["files"])
            self.assertEqual((directory / "set.before-postflight-v1.json").read_bytes(), original)
            self.assertEqual((directory / "whole.png").read_bytes(), b"original-photo-not-modified")
            self.assertEqual(audit_lot(Path(tmp)), {"UNCHANGED_NOT_READY": 1})

    def test_repeated_forced_gpu_result_preserves_both_ready_versions(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "photo-sets" / "test-id"
            folder.mkdir(parents=True)
            path = folder / "set.json"
            first = ready_payload()
            first["metrics"]["fashnOpen"]["personDetected"] = True
            first["generatedAt"] = 100
            first_bytes = json.dumps(first).encode()
            path.write_bytes(first_bytes)
            initial = harden_set_path(path, apply_local=True)
            self.assertEqual(initial["status"], "DOWNGRADED_TO_REVIEW")

            # Simulates GPU write_photo_set replacing set.json after --force.
            second = ready_payload()
            second["metrics"]["fashnOpen"]["personDetected"] = True
            second["generatedAt"] = 200
            second_bytes = json.dumps(second).encode()
            path.write_bytes(second_bytes)
            repeated = harden_set_path(path, apply_local=True)
            self.assertEqual(repeated["status"], "DOWNGRADED_TO_REVIEW")
            self.assertNotEqual(initial["backup"], repeated["backup"])
            self.assertEqual((folder / initial["backup"]).read_bytes(), first_bytes)
            self.assertEqual((folder / repeated["backup"]).read_bytes(), second_bytes)
            self.assertEqual(json.loads(path.read_text())["status"], "REVIEW")

            # A third identical response reuses the matching, immutable backup.
            path.write_bytes(second_bytes)
            again = harden_set_path(path, apply_local=True)
            self.assertEqual(again["backup"], repeated["backup"])
            self.assertEqual((folder / repeated["backup"]).read_bytes(), second_bytes)


if __name__ == "__main__":
    unittest.main()
