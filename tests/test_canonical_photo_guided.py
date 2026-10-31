"""Regression tests for opt-in source-guided previews, independent of Vertex."""

import hashlib
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "scripts" / "catalog"
sys.path.insert(0, str(CATALOG))

from canonical_photo_guided import (CanonicalFrameError, isolate_studio_reference,
                                    frame_reference, run_lot)  # noqa: E402

ASSETS = Path(os.getenv("FAI_CANONICAL_ASSET_ROOT", str(ROOT / "fai_canonical_assets" / "build")))


class PhotoGuidedTest(unittest.TestCase):
    def setUp(self):
        if not (ASSETS / "manifest.json").is_file():
            self.skipTest("canonical GLB assets not available")
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.lot = self.root / "lote"
        self.source = self.lot / "photo-sets" / "sample-id"
        self.source.mkdir(parents=True)
        Image.new("RGBA", (900, 1200), (0, 0, 0, 0)).save(self.source / "whole.png")
        Image.new("RGB", (128, 128), (58, 119, 85)).save(self.source / "fabric.png")
        self.record = {"status": "READY", "category": "upper_piece", "subcategory": "t_shirt",
                       "files": {"whole": "whole.png", "fabric": "fabric.png"}}
        (self.source / "set.json").write_text(json.dumps(self.record), encoding="utf-8")
        reference = Image.new("RGB", (320, 400), "white")
        d = ImageDraw.Draw(reference)
        d.polygon(((100, 80), (65, 95), (25, 180), (85, 205), (120, 170), (120, 340),
                   (235, 340), (235, 170), (275, 205), (300, 180), (260, 95), (220, 80)), fill=(58, 119, 85))
        d.rectangle((135, 175, 195, 205), fill=(235, 188, 35))
        reference.save(self.root / "reference.png")
        self.mapfile = self.root / "references.json"
        self.pair = {"sample-id": {"file": "reference.png", "view": "BACK", "confirmedSameProduct": True}}
        self.mapfile.write_text(json.dumps(self.pair), encoding="utf-8")
        self.input_hashes = {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                             for p in self.source.iterdir()}

    def test_studio_reference_preserves_real_details(self):
        with Image.open(self.root / "reference.png") as source:
            isolated, metadata = isolate_studio_reference(source)
        self.assertEqual(metadata["method"], "LIGHT_BACKGROUND_CONTRAST")
        self.assertEqual(isolated.getpixel((0, 0))[3], 0)
        framed = frame_reference(isolated)
        self.assertEqual(framed.size, (900, 1200))
        pixels = np.asarray(framed)
        yellow = (pixels[..., 0] > 200) & (pixels[..., 1] > 140) & (pixels[..., 2] < 80)
        self.assertGreater(int(np.count_nonzero(yellow & (pixels[..., 3] > 180))), 100)

    def test_rejects_unobservable_white_on_white(self):
        with self.assertRaisesRegex(CanonicalFrameError, "REFERENCE_GARMENT_NOT_ISOLATED"):
            isolate_studio_reference(Image.new("RGB", (300, 300), "white"))

    def test_guided_output_is_separate_review_and_idempotent(self):
        self.assertEqual(run_lot(self.lot, ASSETS, self.mapfile), {"REVIEW": 1})
        dest = self.lot / "guided-preview" / self.source.name
        frame = dest / "whole_reference_frame.png"
        projected = dest / "whole_canonical_projected.png"
        self.assertTrue(frame.is_file())
        self.assertTrue(projected.is_file())
        meta = json.loads((dest / "guided_report.json").read_text())
        self.assertEqual(meta["status"], "REVIEW")
        self.assertEqual(meta["referenceView"], "BACK")
        self.assertFalse(meta["viewGeometryVerified"])
        self.assertGreater(meta["projectedCoverage"], .15)
        self.assertEqual(self.input_hashes,
                         {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                          for p in self.source.iterdir()})
        self.assertEqual(run_lot(self.lot, ASSETS, self.mapfile), {"ALREADY_RENDERED": 1})

    def test_nonready_photo_set_does_not_get_promoted(self):
        self.record["status"] = "REVIEW"
        (self.source / "set.json").write_text(json.dumps(self.record), encoding="utf-8")
        self.assertEqual(run_lot(self.lot, ASSETS, self.mapfile), {"REVIEW": 1})
        report = json.loads((self.lot / "guided-preview" / self.source.name / "guided_report.json").read_text())
        self.assertEqual(report["photoSetStatus"], "REVIEW")
        self.assertEqual(report["status"], "REVIEW")

    def test_unconfirmed_pair_is_not_processed(self):
        self.pair["sample-id"]["confirmedSameProduct"] = False
        self.mapfile.write_text(json.dumps(self.pair), encoding="utf-8")
        self.assertEqual(run_lot(self.lot, ASSETS, self.mapfile),
                         {"SKIPPED_REFERENCE_PAIR_NOT_CONFIRMED": 1})
        self.assertFalse((self.lot / "guided-preview").exists())


if __name__ == "__main__":
    unittest.main()
