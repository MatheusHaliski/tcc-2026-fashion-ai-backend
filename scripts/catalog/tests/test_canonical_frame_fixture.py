"""Characterization of canonical_full_frame with a tiny generated GLB (no bundled asset library).

Runs only through the public entry points (render_asset_png, canonical_candidate, render_lot)
so the same assertions hold before and after the GLB decoder moved to canonical_glb.
"""

import hashlib
import io
import json
import struct
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

import numpy as np
from PIL import Image

from scripts.catalog import canonical_full_frame as cff
from scripts.catalog.tests.glb_fixture import (glb_bytes, quad_document, quad_glb, tree_hashes,
                                               write_asset_root, write_photo_set)

# sha256 of the decoded RGBA pixels rendered from quad_glb() before the extraction.
QUAD_PIXELS_SHA256 = "7a1316744fd06090e4f7d793c3903651e06b5f482bb967d6070dcaee684480fe"


class CanonicalFrameFixtureTest(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.fabric = self.root / "fabric.png"
        Image.new("RGB", (32, 32), (82, 149, 118)).save(self.fabric, format="PNG")

    def render(self, glb: bytes, **kwargs):
        asset = self.root / "asset.glb"
        asset.write_bytes(glb)
        options = {"category": "upper_piece", "subcategory": "t_shirt", **kwargs}
        return cff.render_asset_png(asset, self.fabric, **options)

    def assert_render_error(self, glb: bytes, code: str, **kwargs):
        with self.assertRaises(cff.CanonicalFrameError) as caught:
            self.render(glb, **kwargs)
        self.assertEqual(str(caught.exception), code)

    def test_quad_renders_900x1200_transparent_review_png(self):
        png, meta = self.render(quad_glb())
        with Image.open(io.BytesIO(png)) as image:
            self.assertEqual((image.size, image.mode), ((900, 1200), "RGBA"))
            pixels = np.asarray(image)
        self.assertEqual(pixels[0, 0, 3], 0)
        self.assertEqual(int((pixels[..., 3] > 0).sum()), 467856)
        self.assertEqual(tuple(pixels[600, 450]), (77, 141, 112, 255))  # base colour x shade .95 (front normal)
        self.assertEqual(hashlib.sha256(pixels.tobytes()).hexdigest(), QUAD_PIXELS_SHA256)
        self.assertEqual(meta["renderedTriangles"], 2)
        self.assertEqual((meta["status"], meta["reason"]), ("REVIEW", "CANONICAL_TEMPLATE_UNVERIFIED"))
        self.assertEqual(meta["framing"], {"x": -0.5, "y": -0.5, "width": 1.0, "height": 1.0, "scale": 684.0,
                                           "yawDegrees": 0.0, "pitchDegrees": 0.0})
        self.assertEqual(self.render(quad_glb())[0], png)

    def test_container_errors(self):
        good = quad_glb()
        self.assert_render_error(good[:20], "INVALID_CANONICAL_GLB")
        self.assert_render_error(good.replace(b"glTF", b"gltf", 1), "INVALID_CANONICAL_GLB")
        self.assert_render_error(glb_bytes(*quad_document(), version=1), "INVALID_CANONICAL_GLB")
        self.assert_render_error(good[:-4], "INVALID_CANONICAL_GLB")
        self.assert_render_error(glb_bytes(*quad_document(), length_delta=4) + b"\0" * 4, "INVALID_CANONICAL_GLB_CHUNK")
        misaligned = good[:12] + struct.pack("<I", struct.unpack_from("<I", good, 12)[0] - 1) + good[16:]
        self.assert_render_error(misaligned, "INVALID_CANONICAL_GLB_CHUNK")
        self.assert_render_error(glb_bytes(quad_document()[0], b"", include_bin=False), "INVALID_CANONICAL_GLB_CHUNK")

    def test_semantic_and_topology_errors(self):
        self.assert_render_error(quad_glb(subcategory="shirt"), "CANONICAL_GEOMETRY_ID_MISMATCH")
        self.assert_render_error(quad_glb(approval="APPROVED"), "CANONICAL_GEOMETRY_APPROVAL_UNEXPECTED")
        self.assert_render_error(quad_glb(mode=1), "UNSUPPORTED_CANONICAL_TOPOLOGY")
        self.assert_render_error(quad_glb(indices=np.array([0, 1, 9, 0, 2, 3], dtype="<u2")), "INVALID_CANONICAL_TOPOLOGY")
        self.assert_render_error(quad_glb(sparse=True), "UNSUPPORTED_CANONICAL_ACCESSOR")
        nan = np.array([[np.nan, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], dtype="<f4")
        self.assert_render_error(quad_glb(positions=nan), "NONFINITE_CANONICAL_GEOMETRY")
        document, binary = quad_document()
        document["accessors"][0]["count"] = 400
        self.assert_render_error(glb_bytes(document, binary), "INVALID_CANONICAL_ACCESSOR_BOUNDS")
        document, binary = quad_document()
        document["meshes"] = []
        self.assert_render_error(glb_bytes(document, binary), "CANONICAL_GEOMETRY_EMPTY")

    def test_lot_is_idempotent_and_never_touches_photo_set(self):
        assets = self.root / "library"
        write_asset_root(assets, quad_glb())
        lot = self.root / "lot"
        folder = lot / "photo-sets" / "abc"
        write_photo_set(folder)
        before = tree_hashes(folder)
        with redirect_stdout(io.StringIO()) as out:
            self.assertEqual(cff.render_lot(lot, assets), {"REVIEW": 1})
            self.assertEqual(cff.render_lot(lot, assets), {"ALREADY_RENDERED": 1})
        self.assertIn("[abc] REVIEW: CANONICAL_TEMPLATE_UNVERIFIED", out.getvalue())
        self.assertEqual(tree_hashes(folder), before)
        preview = lot / "canonical-preview" / "abc"
        self.assertEqual(sorted(p.name for p in preview.iterdir()), ["canonical_render.json", "whole_canonical.png"])
        report = json.loads((preview / "canonical_render.json").read_text(encoding="utf-8"))
        self.assertEqual(report["renderSha256"], hashlib.sha256((preview / "whole_canonical.png").read_bytes()).hexdigest())
        self.assertEqual(report["templateSha256"], hashlib.sha256(quad_glb()).hexdigest())

    def test_lot_reports_checksum_and_decoder_failures(self):
        lot = self.root / "lot"
        write_photo_set(lot / "photo-sets" / "abc")
        assets = self.root / "library"
        write_asset_root(assets, quad_glb(), sha="0" * 64)
        with redirect_stdout(io.StringIO()):
            self.assertEqual(cff.render_lot(lot, assets), {"FAILED": 1})
        write_asset_root(assets, quad_glb(mode=1))
        with redirect_stdout(io.StringIO()) as out:
            self.assertEqual(cff.render_lot(lot, assets), {"FAILED": 1})
        self.assertIn("UNSUPPORTED_CANONICAL_TOPOLOGY", out.getvalue())


if __name__ == "__main__":
    unittest.main()
