import unittest

from repair_tryon_catalog import apply_taxonomy, build_plan


class Cursor:
    def __init__(self, conn):
        self.conn = conn
        self.rowcount = 0

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def execute(self, sql, params):
        self.conn.params.append(params)
        self.rowcount = self.conn.rowcounts.pop(0)


class Connection:
    def __init__(self, rowcounts):
        self.rowcounts = list(rowcounts)
        self.params = []
        self.commits = self.rollbacks = 0

    def cursor(self):
        return Cursor(self)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def row(product_id, name, subcategory, version=1):
    return {"product_id": product_id, "product_name": name, "brand": "Levi's",
            "category": "lower_piece", "subcategory": subcategory, "product_version": version,
            "ingestion_status": "REFERENCE_ONLY", "image_id": product_id + "-image",
            "image_url": "https://example.com/image.jpg", "processing_status": "APPROVED",
            "whole_url": "https://example.com/whole.jpg", "crop": {"ruleCompliant": True}}


class RepairTryOnCatalogTest(unittest.TestCase):
    def test_builds_high_confidence_taxonomy_plan(self):
        plan = build_plan([row("p1", "Bermuda Jeans Levi's", "jeans")])
        self.assertEqual(1, plan["summary"]["taxonomy_updates"])
        self.assertEqual("shorts", plan["taxonomy_updates"][0]["new_subcategory"])

    def test_ignores_compatible_taxonomy(self):
        plan = build_plan([row("p1", "Bermuda Jeans Levi's", "shorts")])
        self.assertEqual([], plan["taxonomy_updates"])

    def test_does_not_confuse_short_sleeve_with_shorts(self):
        plan = build_plan([row("p1", "Heavyweight Short Sleeve T-Shirt", "t_shirt")])
        self.assertEqual([], plan["taxonomy_updates"])

    def test_does_not_confuse_bootcut_with_boots(self):
        plan = build_plan([row("p1", "Calça Jeans High Rise Bootcut", "jeans")])
        self.assertEqual([], plan["taxonomy_updates"])

    def test_applies_with_optimistic_guard_and_counts_stale_rows(self):
        conn = Connection([1, 0])
        updates = [
            {"product_id": "p1", "new_category": "lower_piece", "new_subcategory": "shorts",
             "version": 3, "old_category": "lower_piece", "old_subcategory": "jeans"},
            {"product_id": "p2", "new_category": "lower_piece", "new_subcategory": "shorts",
             "version": 4, "old_category": "lower_piece", "old_subcategory": "jeans"},
        ]
        result = apply_taxonomy(conn, updates)
        self.assertEqual({"changed": 1, "skipped": 1}, result)
        self.assertEqual(2, conn.commits)


if __name__ == "__main__":
    unittest.main()