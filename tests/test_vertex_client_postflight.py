"""The Cloud Shell client must reject unsafe READY from an *old* deployed GPU."""

import importlib.util
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ClientPostflightTest(unittest.TestCase):
    def test_resume_rechecks_product_context_and_ready_files(self):
        fake = types.ModuleType("deploy_fashn_vertex")
        fake.NAME = "fashionai-fashn-gpu"
        fake.PROJECT = "test-project-123"
        fake.REGION = "us-central1"
        fake.CloudHTTPError = type("CloudHTTPError", (Exception,), {})
        fake.photo_set_folder = lambda root, image_id: Path(root) / "photo-sets" / image_id
        prior = sys.modules.get("deploy_fashn_vertex")
        sys.modules["deploy_fashn_vertex"] = fake
        try:
            spec = importlib.util.spec_from_file_location("local_vertex_for_resume_test",
                                                          ROOT / "scripts" / "cloud" / "photo_sets_vertex.py")
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            row = {"id": "some-uuid", "product_id": "product-one",
                   "image_url": "https://example.invalid/same.png",
                   "category": "upper_piece", "subcategory": "hoodie", "color": "pink"}
            result = {"imageId": row["id"], "productId": row["product_id"],
                      "sourceUrl": row["image_url"], "category": row["category"],
                      "subcategory": row["subcategory"], "color": row["color"],
                      "status": "READY", "files": {"whole": "whole.png", "fabric": "fabric.png"}}
            with tempfile.TemporaryDirectory() as tmp:
                folder = Path(tmp) / "photo-sets" / row["id"]
                folder.mkdir(parents=True)
                (folder / "set.json").write_text(json.dumps(result))
                self.assertFalse(mod.already_done(tmp, row))
                (folder / "whole.png").write_bytes(b"whole")
                (folder / "fabric.png").write_bytes(b"fabric")
                self.assertTrue(mod.already_done(tmp, row))
                self.assertFalse(mod.already_done(tmp, {**row, "subcategory": "sweatshirt"}))
                self.assertFalse(mod.already_done(tmp, {**row, "product_id": "product-two"}))
                result["status"] = "REVIEW"
                result.pop("files")
                (folder / "set.json").write_text(json.dumps(result))
                self.assertTrue(mod.already_done(tmp, row))
                (folder / "set.json").write_text('[]')
                self.assertFalse(mod.already_done(tmp, row))
        finally:
            if prior is None:
                sys.modules.pop("deploy_fashn_vertex", None)
            else:
                sys.modules["deploy_fashn_vertex"] = prior

    def test_legacy_gpu_ready_is_downgraded_with_source_backup(self):
        fake = types.ModuleType("deploy_fashn_vertex")
        fake.NAME = "fashionai-fashn-gpu"
        fake.PROJECT = "test-project-123"
        fake.REGION = "us-central1"
        fake.CloudHTTPError = type("CloudHTTPError", (Exception,), {})

        def writer(prediction, root, image_id, _url):
            path = Path(root) / "photo-sets" / image_id
            path.mkdir(parents=True)
            (path / "set.json").write_text(json.dumps(prediction["photoSet"]))
            (path / "whole.png").write_bytes(b"preserve-me")
            return path

        fake.write_photo_set = writer
        fake.short_reason = str
        prior = sys.modules.get("deploy_fashn_vertex")
        sys.modules["deploy_fashn_vertex"] = fake
        try:
            spec = importlib.util.spec_from_file_location("local_vertex_for_test",
                                                          ROOT / "scripts" / "cloud" / "photo_sets_vertex.py")
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            photo = {"status": "READY", "sourceUrl": "https://example.invalid/garment.png",
                     "files": {"whole": "whole.png", "fabric": "fabric.png"},
                     "metrics": {"preflight": {"status": "PASS"}, "cleanup": {"cleanupMode": "STRICT"},
                                 "fashnOpen": {"personDetected": True, "attestations": {
                                     "complete": True, "occluded": False, "measurement_verified": True}},
                                 "whole": {"width": 900, "height": 1200, "ghostPixels": 12}}}
            mod.predict = lambda *_args, **_kwargs: {"status": "RENDERED", "photoSet": photo}
            row = {"id": "some-uuid", "image_url": photo["sourceUrl"],
                   "category": "upper_piece", "subcategory": "t_shirt"}
            with tempfile.TemporaryDirectory() as tmp:
                result = mod.process_row(row, b"image-bytes", None, "endpoint", "host", Path(tmp))
                folder = Path(tmp) / "photo-sets" / row["id"]
                self.assertEqual(result["status"], "REVIEW")
                self.assertEqual(json.loads((folder / "set.json").read_text())["reason"],
                                 "HUMAN_SOURCE_REVIEW_REQUIRED")
                self.assertEqual(json.loads((folder / "set.before-postflight-v1.json").read_text())["status"],
                                 "READY")
                self.assertEqual((folder / "whole.png").read_bytes(), b"preserve-me")
        finally:
            if prior is None:
                sys.modules.pop("deploy_fashn_vertex", None)
            else:
                sys.modules["deploy_fashn_vertex"] = prior


if __name__ == "__main__":
    unittest.main()
