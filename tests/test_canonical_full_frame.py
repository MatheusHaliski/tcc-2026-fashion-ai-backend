"""CPU-only regression tests for opt-in canonical full frame sidecars."""

import hashlib
import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "scripts" / "catalog"
sys.path.insert(0, str(CATALOG))

from canonical_full_frame import (canonical_candidate, load_manifest, render_lot, render_asset_png)  # noqa: E402
from whole_frame import render_canonical_whole_preview  # noqa: E402


ASSETS = Path(os.getenv("FAI_CANONICAL_ASSET_ROOT", str(ROOT / "fai_canonical_assets" / "build")))


def write_png(path: Path, color, size=(256, 256), mode="RGB"):
    image = Image.new(mode, size, color)
    image.save(path, format="PNG")


class CanonicalFrameTest(unittest.TestCase):
    def setUp(self):
        if not (ASSETS / "manifest.json").exists():
            self.skipTest("canonical asset bundle not present")
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.lot = self.root / "lote"
        self.source = self.lot / "photo-sets" / "test-image-hash"
        self.source.mkdir(parents=True)
        write_png(self.source / "whole.png", (0, 0, 0, 0), (900, 1200), "RGBA")
        write_png(self.source / "fabric.png", (82, 149, 118))
        self.record = {"status": "READY", "imageId": "some-id", "sourceSha256": "source-sha",
                       "category": "upper_piece", "subcategory": "t_shirt",
                       "files": {"whole": "whole.png", "fabric": "fabric.png"}}
        (self.source / "set.json").write_text(json.dumps(self.record), encoding="utf-8")
        self.hashes = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in self.source.iterdir()}

    def test_glb_renders_transparent_png_with_source_color(self):
        png, meta = render_asset_png(ASSETS / "assets" / "upper_piece" / "t_shirt.glb",
                                     self.source / "fabric.png", category="upper_piece", subcategory="t_shirt")
        with Image.open(io.BytesIO(png)) as img:
            self.assertEqual(img.size, (900, 1200))
            self.assertEqual(img.mode, "RGBA")
            self.assertEqual(img.getpixel((0, 0))[3], 0)
            self.assertGreater(img.getchannel("A").getbbox()[2] - img.getchannel("A").getbbox()[0], 100)
        self.assertEqual(meta["status"], "REVIEW")
        self.assertFalse(meta["logosVerified"])

    def test_lot_writes_only_separate_preview(self):
        result = render_lot(self.lot, ASSETS)
        self.assertEqual(result, {"REVIEW": 1})
        output = self.lot / "canonical-preview" / self.source.name
        self.assertTrue((output / "whole_canonical.png").is_file())
        self.assertTrue((output / "canonical_render.json").is_file())
        self.assertEqual(render_lot(self.lot, ASSETS), {"ALREADY_RENDERED": 1})
        self.assertEqual(self.hashes, {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in self.source.iterdir()})

    def test_stale_preview_is_never_silently_reused(self):
        self.assertEqual(render_lot(self.lot, ASSETS), {"REVIEW": 1})
        write_png(self.source / "fabric.png", (165, 88, 101))
        self.assertEqual(render_lot(self.lot, ASSETS), {"STALE_CANONICAL_PREVIEW_REQUIRES_FORCE": 1})
        self.assertEqual(render_lot(self.lot, ASSETS, force=True), {"REVIEW": 1})

    def test_nonready_source_is_skipped_and_wrapper_requires_ready(self):
        self.record["status"] = "REVIEW"
        (self.source / "set.json").write_text(json.dumps(self.record), encoding="utf-8")
        self.assertEqual(render_lot(self.lot, ASSETS), {"SKIPPED_NOT_READY": 1})
        with self.assertRaisesRegex(ValueError, "REQUIRES_READY_SOURCE"):
            render_canonical_whole_preview(ASSETS / "assets" / "upper_piece" / "t_shirt.glb",
                                           self.source / "fabric.png", category="upper_piece", subcategory="t_shirt",
                                           photo_set_status="REVIEW")

    def test_legacy_template_is_not_automatically_rendered(self):
        registry = load_manifest(ASSETS)
        for key, value in registry.items():
            if value["status"] == "LEGACY":
                self.record["category"], self.record["subcategory"] = key
                break
        (self.source / "set.json").write_text(json.dumps(self.record), encoding="utf-8")
        result = canonical_candidate(self.source / "set.json", ASSETS,
                                     self.root / "output", registry)
        self.assertEqual(result["status"], "SKIPPED_TEMPLATE_UNAVAILABLE")


if __name__ == "__main__":
    unittest.main()
