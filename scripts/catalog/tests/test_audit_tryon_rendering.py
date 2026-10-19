import unittest
import sys
from pathlib import Path

# Match the standalone CLI import path used by the other catalog tests.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from audit_tryon_rendering import audit_product, build_report


class TryOnRenderingAuditTest(unittest.TestCase):
    def test_flags_bermuda_registered_as_full_length_jeans(self):
        product = {"product_name": "Bermuda Jeans Levi's XX", "category": "lower_piece", "subcategory": "jeans",
                   "color": "denim", "color_name": None, "images": [{"image_url": "https://example/a.jpg",
                   "processing_status": "NEEDS_REPROCESSING", "whole_url": None, "crop": {"ruleCompliant": False}}]}
        issues = audit_product(product)
        self.assertIn("TYPE_MISMATCH", {issue["code"] for issue in issues})
        self.assertIn("WHOLE_FRAME_MISSING", {issue["code"] for issue in issues})

    def test_builds_one_row_for_every_brand(self):
        rows = [{"product_id": "p1", "brand": "Levi's", "product_name": "Shorts Jeans", "category": "lower_piece",
                 "subcategory": "shorts", "color": "denim", "color_name": None, "official_product_url": None,
                 "ingestion_status": "REFERENCE_ONLY", "image_id": None}]
        report = build_report(rows)
        self.assertEqual(1, report["summary"]["brands"])
        self.assertEqual(1, report["summary"]["confirmed_products"])
        self.assertEqual("Levi's", report["brands"][0]["brand"])
        self.assertEqual({"NO_IMAGE": 1}, report["brands"][0]["issues"])


if __name__ == "__main__":
    unittest.main()