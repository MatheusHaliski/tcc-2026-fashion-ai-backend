"""Atomic level-A updates, human decisions, optimistic guards and recovery.

SQLite executes the real parameterized UPDATEs; the adapter removes only the
MySQL row-lock suffix. Faults simulate a disconnected session/COMMIT response.
"""
import copy
import hashlib
import json
import sqlite3
import sys
import unittest
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import db
from catalog_image_updates import apply_product


def image(image_id="a", **changes):
    url = f"https://example.com/original/{image_id}.jpg"
    return {"id": image_id, "product_id": "product-1", "image_url": url,
            "image_url_hash": hashlib.sha256(url.encode()).hexdigest(), "image_type": "FRONT",
            "source_url": "https://example.com/product/shirt", "version": 4,
            "is_primary": True, "is_canonical": False, "usage_status": "PERSISTED",
            "processing_status": "PENDING", "review_status": "NONE",
            "pipeline_version": "CATALOG_IMAGE_PIPELINE_V3", "quality_score": None,
            "phash": None, "view_role": None, "attempts": 2,
            "stored_url": f"https://storage.example.com/old/{image_id}.webp",
            "assets_json": json.dumps({"master": f"https://storage.example.com/old/{image_id}.webp"}),
            "crop_json": json.dumps({"aspect": "4:5", "crop": {"x": 0, "y": 0, "w": 1, "h": 1}}),
            "metrics_json": json.dumps({"detailView": False}), "processed_at": None,
            "created_at": "2026-10-01T10:00:00.000000", "updated_at": "2026-10-01T10:00:00.000000",
            **changes}


def analysis(status="APPROVED", **changes):
    return {"ok": True, "columns": {"mime": "image/jpeg", "width": 1200, "height": 1600,
            "source_sha256": "a" * 64, "phash": "0123456789abcdef", "processing_status": status,
            "pipeline_version": "CATALOG_IMAGE_PIPELINE_V4", "quality_score": "0.9000", "gate_reasons": None,
            "crop_json": {"aspect": "4:5", "crop": {"x": .2, "y": .25, "w": .4, "h": .5}},
            "metrics_json": {"detailView": False, "debug": {"ruleCompliance": {"foregroundOnly": True}}},
            **changes}}


class Cursor:
    def __init__(self, conn):
        self.conn = conn
        self.cur = conn.sql.cursor()
        self.rowcount = -1

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.cur.close()

    def execute(self, sql, params=()):
        self.conn.statements.append((sql, params))
        if sql.startswith("UPDATE"):
            self.conn.update_count += 1
            if self.conn.fail_update == self.conn.update_count:
                self.conn.fail_update = None
                raise RuntimeError("simulated second-image write failure")
            if self.conn.drop_update == self.conn.update_count:
                self.conn.drop_update = None
                self.conn.disconnect()
                raise db.pymysql.err.OperationalError(2013, "session dropped")
            if self.conn.zero_update == self.conn.update_count:
                self.rowcount = 0
                return
        params = tuple(value.isoformat(timespec="microseconds") if isinstance(value, datetime)
                       else str(value) if isinstance(value, Decimal) else value for value in params)
        self.cur.execute(sql.replace("%s", "?").removesuffix(" FOR UPDATE"), params)
        self.rowcount = self.cur.rowcount

    def fetchall(self):
        return [dict(row) for row in self.cur.fetchall()]

    def fetchone(self):
        row = self.cur.fetchone()
        return dict(row) if row is not None else None


class Database:
    def __init__(self, rows):
        self.sql = sqlite3.connect(":memory:")
        self.sql.row_factory = sqlite3.Row
        self.sql.execute("CREATE TABLE catalog_products (id TEXT PRIMARY KEY, version INTEGER, category TEXT, subcategory TEXT)")
        self.sql.execute("INSERT INTO catalog_products VALUES ('product-1', 7, 'upper_piece', 't_shirt')")
        columns = {key for row in rows for key in row} | set(analysis()["columns"])
        integers = {"version", "is_primary", "is_canonical", "attempts", "width", "height"}
        definitions = ["id TEXT PRIMARY KEY"]
        definitions.extend(f"`{name}` {'INTEGER' if name in integers else 'TEXT'}" for name in sorted(columns - {"id"}))
        self.sql.execute(f"CREATE TABLE catalog_images ({', '.join(definitions)})")
        for row in rows:
            names = list(row)
            placeholders = ",".join("?" for _ in names)
            self.sql.execute(f"INSERT INTO catalog_images ({','.join(names)}) VALUES ({placeholders})", tuple(row.values()))
        self.sql.commit()
        self.statements = []
        self.update_count = 0
        self.fail_update = self.zero_update = self.drop_update = None
        self.drop_commit = None
        self.open = True
        self.commits = self.rollbacks = self.reconnections = 0

    def cursor(self):
        if not self.open:
            raise db.pymysql.err.InterfaceError(0, "")
        return Cursor(self)

    def rows(self):
        return [dict(row) for row in self.sql.execute("SELECT * FROM catalog_images ORDER BY id")]

    def records(self):
        product = dict(self.sql.execute("SELECT * FROM catalog_products WHERE id='product-1'").fetchone())
        return [{**row, "image_id": row["id"], "category": product["category"], "subcategory": product["subcategory"],
                 "product_version": product["version"],
                 "original_image_url": row["image_url"], "source_url": row["image_url"],
                 "provenance_url": row["source_url"]} for row in self.rows()]

    def disconnect(self):
        self.sql.rollback()
        self.open = False

    def commit(self):
        fault, self.drop_commit = self.drop_commit, None
        if fault == "before":
            self.disconnect()
            raise db.pymysql.err.OperationalError(2013, "COMMIT not received")
        self.sql.commit()
        self.commits += 1
        if fault == "after":
            self.open = False
            raise db.pymysql.err.OperationalError(2013, "COMMIT response lost")

    def rollback(self):
        if not self.open:
            raise db.pymysql.err.InterfaceError(0, "")
        self.sql.rollback()
        self.rollbacks += 1

    def connect(self):
        self.open = True
        self.reconnections += 1

    def close(self):
        self.open = False


class Ranker:
    def __init__(self, conn, roles=None):
        self.conn, self.roles = conn, roles
        self.calls = []

    def rank(self, category, candidates):
        # No SQL lock/transaction is acquired while a JVM request runs.
        if self.conn.statements:
            raise AssertionError("ranker ran after SQL transaction started")
        self.calls.append((category, copy.deepcopy(candidates)))
        canonical = False
        roles = []
        for candidate in candidates:
            cid = candidate["id"]
            if self.roles is not None:
                role = self.roles[cid]
            elif candidate["outcome"] == "REJECTED":
                role = "REJECTED"
            elif candidate["detailView"] or candidate["imageType"] == "DETAIL":
                role = "DETAIL"
            elif candidate["outcome"] == "NEEDS_REPROCESSING":
                role = "REVIEW"
            else:
                role = "ALTERNATE" if canonical else "CANONICAL"
                canonical = True
            roles.append({"id": cid, "role": role, "score": .9})
        return {"ok": True, "roles": roles}


class ImageUpdatesTest(unittest.TestCase):
    def database(self, *rows):
        conn = Database(list(rows or [image()]))
        self.addCleanup(conn.sql.close)
        return conn

    def test_level_a_metadata_keeps_original_and_provenance_clears_old_stored_crop(self):
        conn = self.database()
        before = conn.rows()[0]
        records = conn.records()
        untouched = copy.deepcopy(records)
        response = analysis(image_url="https://evil.example/replace.jpg", version=100,
                            stored_url="https://evil.example/master.jpg", unknown_column="ignored")
        result = apply_product(conn, records, {"a": response}, Ranker(conn))
        row = conn.rows()[0]
        self.assertEqual(result["changed_ids"], ["a"])
        self.assertEqual(row["image_url"], before["image_url"])
        self.assertEqual(row["source_url"], before["source_url"])
        self.assertEqual(row["image_url_hash"], before["image_url_hash"])
        self.assertEqual(row["version"], 5)
        self.assertEqual(row["attempts"], before["attempts"])
        self.assertIsNone(row["stored_url"])
        self.assertIsNone(row["assets_json"])
        self.assertEqual(row["usage_status"], "REFERENCE_ONLY")
        self.assertEqual(row["pipeline_version"], "CATALOG_IMAGE_PIPELINE_V4")
        self.assertEqual(json.loads(row["crop_json"]), response["columns"]["crop_json"])
        self.assertEqual(row["view_role"], "CANONICAL")
        self.assertTrue(row["is_canonical"])
        self.assertIsNotNone(row["processed_at"])
        self.assertEqual(result["changes"][0]["before"], before)
        self.assertEqual(result["changes"][0]["after"]["stored_url"], None)
        self.assertEqual(records, untouched)
        self.assertEqual(conn.commits, 1)
        self.assertFalse(any(sql.startswith(("INSERT", "DELETE")) for sql, _ in conn.statements))

    def test_original_image_url_wins_over_effective_storage_url_in_snapshot_and_sql_guard(self):
        conn = self.database()
        original = conn.rows()[0]["image_url"]
        records = conn.records()
        records[0]["image_url"] = records[0]["current_url"] = "https://storage.example.com/current/master.webp"
        result = apply_product(conn, records, {"a": analysis()}, Ranker(conn))
        self.assertEqual(result["changed_ids"], ["a"])
        update_params = next(params for sql, params in conn.statements if sql.startswith("UPDATE"))
        self.assertEqual(update_params[-1], original)
        self.assertNotIn(records[0]["current_url"], update_params)
        self.assertEqual(conn.rows()[0]["image_url"], original)

    def test_human_approved_canonical_and_rejected_image_are_completely_preserved(self):
        conn = self.database(image("a", processing_status="APPROVED", review_status="APPROVED", is_canonical=True, view_role="CANONICAL"),
                             image("b"), image("c", processing_status="REJECTED", review_status="REJECTED", view_role="REJECTED"))
        before = conn.rows()
        ranking = Ranker(conn, {"a": "ALTERNATE", "b": "CANONICAL", "c": "REJECTED"})
        result = apply_product(conn, conn.records(), {cid: analysis() for cid in ("a", "b", "c")}, ranking)
        after = conn.rows()
        self.assertEqual(after[0], before[0])
        self.assertEqual(after[2], before[2])
        self.assertFalse(after[1]["is_canonical"])
        self.assertEqual(after[1]["view_role"], "ALTERNATE")
        self.assertEqual(result["changed_ids"], ["b"])
        self.assertEqual(result["skip_reasons"], {"a": "HUMAN_REVIEW", "c": "HUMAN_REVIEW"})
        self.assertEqual([candidate["id"] for candidate in ranking.calls[0][1]], ["b"])

    def test_protected_best_noncanonical_does_not_remove_all_writable_canonical_choices(self):
        for protected in ({"review_status": "APPROVED"}, {"usage_status": "REJECTED"}):
            with self.subTest(protected=protected):
                conn = self.database(image("a", processing_status="APPROVED", quality_score="0.9900", **protected),
                                     image("b", processing_status="APPROVED", is_canonical=True, view_role="CANONICAL", quality_score="0.5000"),
                                     image("c"))
                before = conn.rows()[0]
                ranking = Ranker(conn, {"b": "ALTERNATE", "c": "CANONICAL"})
                apply_product(conn, conn.records(), {"c": analysis()}, ranking)
                after = conn.rows()
                self.assertEqual(after[0], before)
                self.assertEqual([candidate["id"] for candidate in ranking.calls[0][1]], ["b", "c"])
                self.assertEqual([row["id"] for row in after if row["is_canonical"]], ["c"])

    def test_fixed_human_canonical_clears_conflicting_automatic_canonical_only(self):
        conn = self.database(image("a", processing_status="APPROVED", review_status="APPROVED", is_canonical=True, view_role="CANONICAL"),
                             image("b", processing_status="APPROVED", is_canonical=True, view_role="CANONICAL"), image("c"))
        before = conn.rows()[0]
        apply_product(conn, conn.records(), {"c": analysis()}, Ranker(conn))
        after = conn.rows()
        self.assertEqual(after[0], before)
        self.assertEqual([row["id"] for row in after if row["is_canonical"]], ["a"])
        self.assertEqual([row["view_role"] for row in after[1:]], ["ALTERNATE", "ALTERNATE"])

    def test_active_worker_and_rejected_usage_are_never_changed(self):
        conn = self.database(image("a", processing_status="DOWNLOADING"), image("b", usage_status="REJECTED"))
        before = conn.rows()
        ranking = Ranker(conn)
        result = apply_product(conn, conn.records(), {"a": analysis(), "b": analysis()}, ranking)
        self.assertEqual(conn.rows(), before)
        self.assertEqual(result["skip_reasons"], {"a": "WORKER_ACTIVE", "b": "USAGE_REJECTED"})
        self.assertFalse(ranking.calls)
        self.assertFalse(conn.statements)

    def test_only_needs_reprocessing_enters_pending_review(self):
        for status in ("APPROVED", "NEEDS_REPROCESSING", "REJECTED"):
            with self.subTest(status=status):
                conn = self.database(image(review_status="PENDING"))
                apply_product(conn, conn.records(), {"a": analysis(status)}, Ranker(conn))
                self.assertEqual(conn.rows()[0]["review_status"], "PENDING" if status == "NEEDS_REPROCESSING" else "NONE")

    def test_new_canonical_demotes_previous_automatic_canonical_in_same_transaction(self):
        conn = self.database(image("a", processing_status="APPROVED", is_canonical=True, view_role="CANONICAL", quality_score="0.5000"), image("b"))
        result = apply_product(conn, conn.records(), {"b": analysis()}, Ranker(conn, {"a": "ALTERNATE", "b": "CANONICAL"}))
        rows = conn.rows()
        self.assertEqual(set(result["changed_ids"]), {"a", "b"})
        self.assertEqual([row["is_canonical"] for row in rows], [False, True])
        self.assertEqual(rows[0]["stored_url"], "https://storage.example.com/old/a.webp")
        self.assertIsNone(rows[0]["processed_at"])
        self.assertEqual([row["version"] for row in rows], [5, 5])
        self.assertEqual(conn.commits, 1)

    def test_version_url_hash_source_and_review_changes_skip_entire_product(self):
        changes = (("version", 9), ("image_url", "https://example.com/replaced.jpg"),
                   ("image_url_hash", "b" * 64), ("review_status", "APPROVED"),
                   ("processing_status", "DOWNLOADING"), ("source_url", "https://example.com/other-product"))
        for column, value in changes:
            with self.subTest(column=column):
                conn = self.database(image("a"), image("b"))
                records = conn.records()
                conn.sql.execute(f"UPDATE catalog_images SET {column}=? WHERE id='a'", (value,))
                conn.sql.commit()
                before = conn.rows()
                result = apply_product(conn, records, {"a": analysis(), "b": analysis()}, Ranker(conn))
                self.assertEqual(conn.rows(), before)
                self.assertFalse(result["changed_ids"])
                self.assertEqual(set(result["skipped_ids"]), {"a", "b"})
                self.assertTrue(all(reason == "PRODUCT_CHANGED" for reason in result["skip_reasons"].values()))
                self.assertFalse(any(sql.startswith("UPDATE") for sql, _ in conn.statements))

    def test_new_or_removed_product_image_invalidates_cached_ranking(self):
        for removed in (False, True):
            with self.subTest(removed=removed):
                conn = self.database(image("a"), image("b"))
                records = conn.records()
                if removed:
                    conn.sql.execute("DELETE FROM catalog_images WHERE id='b'")
                else:
                    conn.sql.execute("INSERT INTO catalog_images SELECT 'c'," + ",".join(row[1] for row in conn.sql.execute("PRAGMA table_info(catalog_images)") if row[1] != "id") + " FROM catalog_images WHERE id='b'")
                conn.sql.commit()
                before = conn.rows()
                result = apply_product(conn, records, {"a": analysis()}, Ranker(conn))
                self.assertFalse(result["changed_ids"])
                self.assertEqual(conn.rows(), before)

    def test_product_category_subcategory_or_version_change_skips_all_image_updates(self):
        for column, value in (("category", "lower_piece"), ("subcategory", "jeans"), ("version", 8)):
            with self.subTest(column=column):
                conn = self.database(image("a"), image("b"))
                records = conn.records()
                conn.sql.execute(f"UPDATE catalog_products SET {column}=?", (value,))
                conn.sql.commit()
                before = conn.rows()
                result = apply_product(conn, records, {"a": analysis(), "b": analysis()}, Ranker(conn))
                self.assertEqual(conn.rows(), before)
                self.assertEqual(result["skip_reasons"], {"a": "PRODUCT_CHANGED", "b": "PRODUCT_CHANGED"})
                self.assertFalse(any(sql.startswith("UPDATE") for sql, _ in conn.statements))

    def test_product_deleted_after_analysis_never_changes_images(self):
        conn = self.database()
        records = conn.records()
        conn.sql.execute("DELETE FROM catalog_products")
        conn.sql.commit()
        before = conn.rows()
        result = apply_product(conn, records, {"a": analysis()}, Ranker(conn))
        self.assertEqual(conn.rows(), before)
        self.assertEqual(result["skip_reasons"], {"a": "PRODUCT_CHANGED"})

    def test_missing_product_version_and_inconsistent_context_fail_before_rank_or_sql(self):
        conn = self.database(image("a"), image("b"))
        records = conn.records()
        missing = copy.deepcopy(records)
        missing[0].pop("product_version")
        mismatch = copy.deepcopy(records)
        mismatch[1]["category"] = "lower_piece"
        ranking = Ranker(conn)
        for rows in (missing, mismatch):
            with self.assertRaises(ValueError):
                apply_product(conn, rows, {"a": analysis()}, ranking)
        self.assertFalse(ranking.calls)
        self.assertFalse(conn.statements)

    def test_second_image_failure_rolls_back_metadata_and_canonical_changes(self):
        conn = self.database(image("a"), image("b"))
        before = conn.rows()
        conn.fail_update = 2
        with self.assertRaisesRegex(RuntimeError, "second-image"):
            apply_product(conn, conn.records(), {"a": analysis(), "b": analysis()}, Ranker(conn))
        self.assertEqual(conn.rows(), before)
        self.assertEqual(conn.rollbacks, 1)
        self.assertEqual(conn.commits, 0)

    def test_zero_affected_rows_rolls_back_whole_product(self):
        conn = self.database(image("a"), image("b"))
        before = conn.rows()
        conn.zero_update = 2
        with self.assertRaisesRegex(RuntimeError, "optimistic guard"):
            apply_product(conn, conn.records(), {"a": analysis(), "b": analysis()}, Ranker(conn))
        self.assertEqual(conn.rows(), before)

    def test_failed_analysis_keeps_original_but_other_valid_image_is_applied(self):
        conn = self.database(image("a"), image("b"))
        before = conn.rows()[0]
        result = apply_product(conn, conn.records(), {"a": {"ok": False}, "b": analysis()}, Ranker(conn))
        self.assertEqual(conn.rows()[0], before)
        self.assertEqual(result["changed_ids"], ["b"])
        self.assertEqual(result["skip_reasons"], {"a": "ANALYSIS_FAILED"})

    def test_invalid_ranker_inventory_never_starts_sql(self):
        for roles in ([{"id": "outside", "role": "CANONICAL"}], [],
                      [{"id": "a", "role": "CANONICAL"}, {"id": "a", "role": "ALTERNATE"}]):
            with self.subTest(roles=roles):
                conn = self.database()
                with self.assertRaises(ValueError):
                    apply_product(conn, conn.records(), {"a": analysis()}, lambda *_: {"ok": True, "roles": roles})
                self.assertFalse(conn.statements)

    def test_wrong_product_duplicate_image_and_unknown_analysis_fail_before_sql(self):
        conn = self.database(image("a"), image("b"))
        records = conn.records()
        malformed = ([records[0], records[0]], [records[0], {**records[1], "product_id": "other-product"}])
        for rows in malformed:
            with self.assertRaises(ValueError):
                apply_product(conn, rows, {"a": analysis()}, Ranker(conn))
        with self.assertRaisesRegex(ValueError, "outside"):
            apply_product(conn, records, {"unknown": analysis()}, Ranker(conn))
        self.assertFalse(conn.statements)

    def test_parameterized_original_url_cannot_execute_sql(self):
        conn = self.database(image(image_url="https://example.com/a.jpg'; DELETE FROM catalog_images; --"))
        original = conn.rows()[0]["image_url"]
        apply_product(conn, conn.records(), {"a": analysis()}, Ranker(conn))
        self.assertEqual(len(conn.rows()), 1)
        self.assertEqual(conn.rows()[0]["image_url"], original)
        update_sql = next(sql for sql, _ in conn.statements if sql.startswith("UPDATE"))
        self.assertNotIn(original, update_sql)

    def test_null_and_empty_inputs_do_not_connect_or_rank(self):
        conn = self.database()
        ranking = Ranker(conn)
        self.assertEqual(apply_product(conn, [], {}, ranking)["changed_ids"], [])
        self.assertFalse(conn.statements)
        self.assertFalse(ranking.calls)

    @unittest.skipIf(db.pymysql is None, "PyMySQL required to simulate transport errors")
    def test_disconnect_mid_product_retries_sql_without_repeating_analysis_or_rank(self):
        conn = self.database(image("a"), image("b"))
        conn.drop_update = 2
        ranking = Ranker(conn)
        with patch("db.time.sleep"):
            result = apply_product(conn, conn.records(), {"a": analysis(), "b": analysis()}, ranking)
        self.assertEqual(set(result["changed_ids"]), {"a", "b"})
        self.assertEqual([row["version"] for row in conn.rows()], [5, 5])
        self.assertEqual(conn.reconnections, 1)
        self.assertEqual(len(ranking.calls), 1)

    @unittest.skipIf(db.pymysql is None, "PyMySQL required to simulate transport errors")
    def test_commit_before_or_after_disconnect_never_duplicates_versions_or_audit(self):
        for fault in ("before", "after"):
            with self.subTest(fault=fault):
                conn = self.database(image("a"), image("b"))
                conn.drop_commit = fault
                ranking = Ranker(conn)
                with patch("db.time.sleep"):
                    result = apply_product(conn, conn.records(), {"a": analysis(), "b": analysis()}, ranking)
                self.assertEqual(len(result["changes"]), 2)
                self.assertEqual([row["version"] for row in conn.rows()], [5, 5])
                self.assertEqual(conn.reconnections, 1)
                self.assertEqual(len(ranking.calls), 1)
                self.assertEqual(result.get("recovered_commit", False), fault == "after")


if __name__ == "__main__":
    unittest.main()
