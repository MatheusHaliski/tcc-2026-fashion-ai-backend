import json
import unittest
from scripts.catalog.category_frame import POLICY, VERSION, apply_frame


def product_frame(fit="COVER", align="TOP", crop=None, ok=True, reason=None, scope="FRAME", coverage=1.0, inside=1.0,
                  compliance_ok=True, target="neckline_top", observations=()):
    """Quadro como o CatalogImageBatchCli devolve (ProductRuleFrame.Result.toMap)."""
    return {"version": "PRODUCT_RULE_FRAME_V1", "ok": ok, "reason": reason,
            "crop": crop if crop is not None else ({"x": .375, "y": .3, "w": .25, "h": .25} if ok else None), "aspect": "3:4",
            "rule": {"fit": fit, "align": align, "view": "FRONT", "focusTopHalf": fit == "COVER"},
            "ruleSource": {"registry": "catalog/semantic-regions.json", "registryVersion": "2.1.0", "pieceType": "UPPER_PIECE",
                           "subcategory": "t_shirt", "origin": "pieceType"},
            "target": target, "focus": {"name": "collar_chest", "x": .5, "y": .35}, "product": {"x": .2, "y": .2, "w": .6, "h": .7},
            "model": False, "skinExcluded": 0.0, "garmentCoverage": coverage if scope else 0.0, "coverageScope": scope,
            "objectInside": inside, "padding": 0.0, "background": "#f0f0f0", "truncated": [], "sideView": None,
            "compliance": {"ok": compliance_ok, "focusInTopHalf": compliance_ok}, "cropWidthPx": 300, "observations": list(observations)}


def filled_frame(crop=None, coverage=1.0, ok=True, reason=None, target="collar", source="ESTIMATED_COLLAR"):
    return {"version": "FABRIC_FRAME_34_V2", "ok": ok, "reason": reason,
            "crop": crop or {"x": .375, "y": .3, "w": .25, "h": .25},
            "fabricCoverage": coverage, "target": target,
            "anchor": {"x": .5, "y": .35, "source": source}}


class CategoryFrameTest(unittest.TestCase):
    def response(self, frame=None):
        return {"columns": {"width": 1200, "height": 1600, "processing_status": "APPROVED",
                            "crop_json": json.dumps({"rule": {"fit": "CONTAIN"}, "padding": .1})},
                "fabricFrame": frame if frame is not None else filled_frame()}

    def test_pixel_aspect_and_filled_policy_preserve_input(self):
        original = self.response()
        result = apply_frame(original, "upper_piece", subcategory="t_shirt")
        crop = json.loads(result["columns"]["crop_json"])
        r = crop["crop"]
        self.assertAlmostEqual(r["w"] * 1200 / (r["h"] * 1600), .75)
        editor = crop["editorFrame"]
        self.assertEqual((editor["version"], editor["policy"], editor["fit"], editor["align"]),
                         (VERSION, POLICY, "COVER", "FOCUS"))
        self.assertEqual(editor["padding"], 0)
        self.assertNotIn("rule", crop)
        self.assertNotIn("padding", crop)
        self.assertIn("rule", json.loads(original["columns"]["crop_json"]))

    def test_category_focus_is_recorded_and_estimations_are_explicit(self):
        for category, target in (("upper_piece", "collar"), ("lower_piece", "fly"),
                                 ("accessory_piece", "center"), ("shoes_piece", "logo")):
            with self.subTest(category=category):
                result = apply_frame(self.response(filled_frame(target=target, source="ESTIMATED_" + target.upper())), category)
                editor = json.loads(result["columns"]["crop_json"])["editorFrame"]
                self.assertEqual(editor["target"], target)
                self.assertIn("FOCUS_ESTIMATED", editor["observations"])
        result = apply_frame(self.response(filled_frame(source="PIPELINE_LANDMARK")), "upper_piece")
        self.assertNotIn("FOCUS_ESTIMATED", json.loads(result["columns"]["crop_json"])["editorFrame"]["observations"])

    def test_force_never_permits_background_padding_or_invalid_crop(self):
        for force in (False, True):
            for value, reason in ((filled_frame(coverage=.99), "COVERAGE_BELOW_100"),
                                  (filled_frame(coverage=True), "COVERAGE_BELOW_100"),
                                  (filled_frame(ok=False, reason="NO_FABRIC_REGION"), "NO_FABRIC_REGION"),
                                  (filled_frame(crop={"x": .9, "y": .3, "w": .25, "h": .25}), "INVALID_CROP"),
                                  (filled_frame(crop={"x": .3, "y": -.1, "w": .25, "h": .25}), "INVALID_CROP"),
                                  (filled_frame(crop={"x": .3, "y": .3, "w": .5, "h": .25}), "ASPECT_NOT_3_4")):
                with self.subTest(force=force, reason=reason), self.assertRaisesRegex(ValueError, reason):
                    apply_frame(self.response(value), "shoes_piece", force=force)

    def test_missing_analysis_unknown_category_and_dimensions_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "NO_FILLED_FRAME"):
            apply_frame({"columns": {}}, "upper_piece")
        with self.assertRaisesRegex(ValueError, "UNSUPPORTED"):
            apply_frame(self.response(), "unknown", force=True)
        with self.assertRaisesRegex(ValueError, "INVALID_DIMENSIONS"):
            response = self.response(); response["columns"]["width"] = 0
            apply_frame(response, "upper_piece")
        with self.assertRaisesRegex(ValueError, "JAVA_IMAGE_TOO_SMALL"):
            apply_frame(self.response(), "upper_piece", fallback="IMAGE_TOO_SMALL", force=True)


if __name__ == "__main__":
    unittest.main()
