"""Inventário fiel, aprovação conservadora e leitura consistente após desconexão."""
import copy
import gzip
import hashlib
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import db
from catalog_image_inventory import CURRENT_VERSION, is_standardized, load_database, load_snapshot


def approved(category="upper_piece", **changes):
    return {"image_url": "https://example.com/shirt.jpg", "category": category,
            "processing_status": "APPROVED", "pipeline_version": CURRENT_VERSION,
            "review_status": "NONE", "is_canonical": False,
            "crop_json": {"aspect": "2:1" if category == "lower_piece" else "4:5",
                          "crop": {"x": .2, "y": .25, "w": .4, "h": .5}},
            "metrics_json": {"debug": {"ruleCompliance": {
                "foregroundOnly": True, "mode": "GARMENT_COVER",
                "pipelineVersion": "GARMENT_COVER_V1", "ok": True}}}, **changes}


class StandardizationTest(unittest.TestCase):
    def test_approved_current_garment_crop_does_not_require_canonical_or_persisted_copy(self):
        for category in ("upper_piece", "lower_piece", "full_body_piece"):
            with self.subTest(category=category):
                record = approved(category, usage_status="REFERENCE_ONLY")
                record["crop_json"] = json.dumps(record["crop_json"])
                record["metrics_json"] = json.dumps(record["metrics_json"])
                self.assertTrue(is_standardized(record))

    def test_manual_approval_or_version_does_not_prove_full_fabric_framing(self):
        for key, value in (("foregroundOnly", False), ("foregroundOnly", "true"),
                           ("mode", "SEMANTIC_CROP"), ("pipelineVersion", "GARMENT_COVER_V0"), ("ok", False)):
            with self.subTest(key=key, value=value):
                record = approved(review_status="APPROVED")
                record["metrics_json"]["debug"]["ruleCompliance"][key] = value
                self.assertFalse(is_standardized(record))
        for field, value in (("processing_status", "NEEDS_REPROCESSING"),
                             ("pipeline_version", "CATALOG_IMAGE_PIPELINE_V3"),
                             ("review_status", "REJECTED"), ("image_url", None)):
            with self.subTest(field=field):
                self.assertFalse(is_standardized(approved(**{field: value})))

    def test_missing_malformed_and_outside_frame_metadata_are_not_standardized(self):
        for crop in (None, "broken json", [], {"aspect": "4:5"},
                     {"aspect": "4:5", "crop": {"x": .8, "y": 0, "w": .4, "h": .5}},
                     {"aspect": "4:5", "crop": {"x": 0, "y": 0, "w": 0, "h": .5}},
                     {"aspect": "4:5", "crop": {"x": 0, "y": 0, "w": True, "h": .5}},
                     {"aspect": "4:5", "crop": {"x": float("nan"), "y": 0, "w": .4, "h": .5}}):
            with self.subTest(crop=crop):
                self.assertFalse(is_standardized(approved(crop_json=crop)))
        self.assertFalse(is_standardized(approved("lower_piece", crop_json=approved()["crop_json"])))
        self.assertFalse(is_standardized(approved("shoes_piece", metrics_json="not JSON")))

    def test_shoes_and_accessories_use_semantic_framing_without_fabric_cover_requirement(self):
        for category in ("shoes_piece", "accessory_piece"):
            with self.subTest(category=category):
                record = approved(category, metrics_json={"debug": {"ruleCompliance": {"ok": True}}})
                self.assertTrue(is_standardized(record))
                record["metrics_json"]["debug"]["ruleCompliance"]["ok"] = False
                self.assertFalse(is_standardized(record))
        self.assertFalse(is_standardized(approved("unknown_piece")))


class SnapshotTest(unittest.TestCase):
    def test_gzip_keeps_each_photo_and_empty_product_without_claiming_database_state(self):
        raw = [{"brand": "Levi's", "product_name": "Calça jeans", "subcategory": "jeans",
                "official_product_url": "https://example.com/jeans",
                "images": [{"url": "https://example.com/front.jpg", "type": "FRONT"},
                           {"url": "https://example.com/back.jpg", "type": "BACK"}]},
               {"brand": "Nike", "product_name": "Tênis sem foto", "subcategory": "casual_sneakers"}]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "acervo.jsonl.gz"
            with gzip.open(path, "wt", encoding="utf-8") as stream:
                for product in raw:
                    stream.write(json.dumps(product, ensure_ascii=False) + "\n")
            rows = list(load_snapshot([path]))
            repeated = list(load_snapshot([path]))
        self.assertEqual(len(rows), 3)
        self.assertEqual([row["category"] for row in rows], ["lower_piece", "lower_piece", "shoes_piece"])
        self.assertEqual([row["image_type"] for row in rows[:2]], ["FRONT", "BACK"])
        self.assertEqual([row["standardized_before"] for row in rows], [None, None, False])
        self.assertEqual([row["is_primary"] for row in rows], [True, False, False])
        self.assertEqual(rows[0]["provenance_url"], raw[0]["official_product_url"])
        self.assertEqual(rows[0]["image_url_hash"], hashlib.sha256(rows[0]["image_url"].encode()).hexdigest())
        self.assertEqual([row["image_id"] for row in rows], [row["image_id"] for row in repeated])
        self.assertIsNone(rows[2]["image_id"])
        self.assertFalse(rows[2]["has_image_bool"])
        self.assertIn("Sem foto", rows[2]["status_note"])
        self.assertIn("não verificado", rows[0]["status_note"])

    def test_shared_url_in_distinct_products_is_not_lost_and_legacy_category_is_normalized(self):
        raw = [{"brand": "Nike", "product_name": "Bermuda A", "subcategory": "bermuda_shorts",
                "images": ["https://example.com/shared.jpg"]},
               {"brand": "Nike", "product_name": "Bermuda B", "subcategory": "shorts",
                "images": ["https://example.com/shared.jpg"]}]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "products.json"
            path.write_text(json.dumps(raw), encoding="utf-8")
            rows = list(load_snapshot([path]))
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["subcategory"], "shorts")
        self.assertEqual(rows[0]["category"], "lower_piece")
        self.assertEqual(rows[0]["image_url_hash"], rows[1]["image_url_hash"])
        self.assertNotEqual(rows[0]["image_id"], rows[1]["image_id"])


class InterfaceError(Exception):
    pass


class OperationalError(Exception):
    pass


class Cursor:
    def __init__(self, conn):
        self.conn = conn
        self.page = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def execute(self, sql, params=()):
        self.conn.statements.append((sql, params))
        if sql.startswith("START TRANSACTION"):
            self.conn.read_pages = 0
            return
        if not sql.lstrip().startswith("SELECT"):
            return
        self.conn.read_pages += 1
        if self.conn.disconnect_page == self.conn.read_pages:
            if not self.conn.permanent:
                self.conn.disconnect_page = None
            self.conn.open = False
            raise OperationalError(2013, "test socket lost")
        rows = sorted(self.conn.rows, key=lambda row: (row["product_id"], row["image_id"] or ""))
        if "p.ingestion_status IN" in sql:
            rows = [row for row in rows if row.get("ingestion_status") in params[:3]]
        if "COALESCE(i.id" in sql:
            product, _, image = params[-4:-1]
            rows = [row for row in rows if (row["product_id"], row["image_id"] or "") > (product, image)]
        self.page = copy.deepcopy(rows[:params[-1]])

    def fetchall(self):
        return self.page


class Database:
    def __init__(self, rows):
        self.rows = rows
        self.open = True
        self.closed = False
        self.statements = []
        self.rollbacks = self.commits = self.reconnections = self.read_pages = 0
        self.disconnect_page = None
        self.permanent = False
        self.reconnected_rows = None

    def cursor(self):
        return Cursor(self)

    def rollback(self):
        if not self.open:
            raise InterfaceError(0, "")
        self.rollbacks += 1

    def commit(self):
        self.commits += 1

    def connect(self):
        self.open = True
        self.reconnections += 1
        if self.reconnected_rows is not None:
            self.rows = self.reconnected_rows

    def close(self):
        self.open = False
        self.closed = True


def image_row(product, image, **changes):
    return {**approved(), "product_id": product, "image_id": image, "product_name": product,
            "brand": "Test brand", "ingestion_status": "VALIDATED", "version": 7,
            "image_url_hash": "urlhash", **changes}


class DatabaseInventoryTest(unittest.TestCase):
    def setUp(self):
        # Exercita db.run_transaction mesmo sem dependência MySQL instalada;
        # o protocolo reproduz os códigos de desconexão do driver, sem rede.
        driver = types.SimpleNamespace(err=types.SimpleNamespace(
            InterfaceError=InterfaceError, OperationalError=OperationalError))
        self.driver = patch.object(db, "pymysql", driver).start()
        self.sleep = patch.object(db.time, "sleep").start()
        self.addCleanup(patch.stopall)

    def test_keyset_reads_all_images_and_empty_products_with_original_url_guards(self):
        rows = [image_row("p1", "i1", is_canonical=True, assets_json='{"card":"https://cdn.example.com/card.jpg"}'),
                image_row("p1", "i2", image_url="https://example.com/back.jpg"),
                image_row("p2", None, image_url=None),
                image_row("p3", "i3", ingestion_status="DISCOVERED")]
        conn = Database(rows)
        inventory = load_database(lambda: conn, batch_size=1)
        first = next(inventory)
        self.assertTrue(conn.closed, "nenhuma conexão fica aberta durante o processamento das fotos")
        records = [first, *inventory]
        self.assertEqual([(row["product_id"], row["image_id"]) for row in records],
                         [("p1", "i1"), ("p1", "i2"), ("p2", None)])
        self.assertEqual(first["image_url"], "https://example.com/shirt.jpg")
        self.assertEqual(first["source_url"], first["image_url"])
        self.assertEqual(first["current_url"], "https://cdn.example.com/card.jpg")
        self.assertEqual(first["version"], 7)
        self.assertEqual(first["image_url_hash"], "urlhash")
        self.assertTrue(first["standardized_before"])
        self.assertFalse(records[-1]["standardized_before"])
        self.assertEqual(conn.commits, 0)
        self.assertEqual(conn.rollbacks, 1)
        statements = " ".join(sql.upper() for sql, _ in conn.statements)
        self.assertIn("READ ONLY", statements)
        self.assertIn("REPEATABLE READ", statements)
        self.assertNotIn("OFFSET", statements)
        for mutation in ("INSERT ", "UPDATE ", "DELETE "):
            self.assertNotIn(mutation, statements)

    def test_optional_all_products_scope_includes_discovered_without_n_plus_one_queries(self):
        conn = Database([image_row("p1", "i1"), image_row("p2", "i2", ingestion_status="DISCOVERED")])
        self.assertEqual(len(list(load_database(lambda: conn, search_visible_only=False))), 2)
        self.assertEqual(sum(sql.lstrip().startswith("SELECT") for sql, _ in conn.statements), 1)

    def test_transport_failure_restarts_entire_snapshot_before_emitting_any_record(self):
        original = [image_row("p1", "i1", product_name="before"), image_row("p2", "i2")]
        conn = Database(original)
        conn.disconnect_page = 2
        conn.reconnected_rows = [image_row("p1", "i1", product_name="after"), image_row("p2", "i2")]
        with self.assertLogs("catalog", level="WARNING"):
            records = list(load_database(lambda: conn, batch_size=1))
        self.assertEqual([row["product_name"] for row in records], ["after", "p2"])
        self.assertEqual(len(records), 2)
        self.assertEqual(conn.reconnections, 1)
        self.assertTrue(conn.closed)
        self.assertEqual(conn.commits, 0)

    def test_permanent_outage_never_returns_partial_inventory_and_closes_connection(self):
        conn = Database([image_row("p1", "i1"), image_row("p2", "i2")])
        conn.disconnect_page, conn.permanent = 2, True
        seen = []
        with self.assertLogs("catalog", level="WARNING"), self.assertRaises(db.DatabaseUnavailable):
            seen.extend(load_database(lambda: conn, batch_size=1, retries=1))
        self.assertEqual(seen, [])
        self.assertTrue(conn.closed)
        self.assertEqual(conn.reconnections, 1)

    def test_invalid_batch_size_does_not_open_a_connection(self):
        def unexpected_connect():
            self.fail("não deveria conectar")
        with self.assertRaises(ValueError):
            list(load_database(unexpected_connect, batch_size=0))


if __name__ == "__main__":
    unittest.main()
