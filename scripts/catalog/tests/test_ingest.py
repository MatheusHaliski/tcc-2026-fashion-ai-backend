"""Regressões da importação: banco SQLite em memória, adaptando somente os placeholders MySQL."""
import sqlite3
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingest import Ingestor
import import_products
import seed_catalog


class Cursor:
    def __init__(self, conn):
        self.conn = conn
        self.cur = conn.db.cursor()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.cur.close()

    def execute(self, sql, params=()):
        self.conn.statements.append(sql)
        if self.conn.fail_on and self.conn.fail_on in sql:
            raise RuntimeError("falha de gravação simulada")
        params = tuple(v.isoformat() if isinstance(v, datetime) else v for v in params)
        self.cur.execute(sql.replace("%s", "?"), params)

    def fetchone(self):
        row = self.cur.fetchone()
        return dict(row) if row is not None else None

    def fetchall(self):
        return [dict(row) for row in self.cur.fetchall()]


class Database:
    def __init__(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.statements = []
        self.fail_on = None
        tables = {
            "brands": "name, slug, logo_url, website, source, country",
            "brand_aliases": "brand_id, alias, alias_norm",
            "catalog_sources": "brand_id, domain, source_type, country, allows_image_persistence INTEGER, active INTEGER, notes",
            "catalog_products": "brand_id, category, subcategory, product_name, model_name, product_code, sku, gtin, ean, upc, color, color_name, material, collection, gender, description, design_json, official_product_url, canonical_url, source_type, source_domain, search_text, source_status, ingestion_status, dedup_key, first_seen_at, last_verified_at, owners_count INTEGER, metadata_json",
            "catalog_product_aliases": "product_id, alias, alias_norm",
            "catalog_variants": "product_id, variant_key, color, color_name, variant_code, sku, gtin",
            "catalog_images": "product_id, image_url, image_url_hash, image_type, source_url, source_domain, source_type, is_primary INTEGER, usage_status, retrieved_at, last_verified_at",
            "catalog_ingestion_runs": "kind, source, dry_run INTEGER, total_read INTEGER, created_count INTEGER, updated_count INTEGER, skipped_count INTEGER, duplicates_count INTEGER, error_count INTEGER, report_json, started_at, finished_at",
        }
        for table, columns in tables.items():
            self.db.execute(f"CREATE TABLE {table} (id TEXT PRIMARY KEY, {columns}, version INTEGER, created_at, updated_at)")
        for table, columns in (("brands", "slug"), ("brand_aliases", "alias_norm"),
                               ("catalog_sources", "brand_id, domain"), ("catalog_products", "dedup_key"),
                               ("catalog_product_aliases", "product_id, alias_norm"),
                               ("catalog_variants", "product_id, variant_key"),
                               ("catalog_images", "product_id, image_url_hash")):
            self.db.execute(f"CREATE UNIQUE INDEX uq_{table} ON {table} ({columns})")

    def cursor(self):
        return Cursor(self)

    def commit(self):
        self.db.commit()

    def rollback(self):
        self.db.rollback()

    def close(self):
        self.db.close()

    def rows(self, table):
        return [dict(row) for row in self.db.execute(f"SELECT * FROM {table}")]


class SkipExistingTest(unittest.TestCase):
    def setUp(self):
        self.conn = Database()
        self.addCleanup(self.conn.close)
        self.raw = {
            "brand": "Nike", "subcategory": "t_shirt", "product_name": "Camiseta",
            "sku": "TEST-1", "model_name": "Modelo teste", "color": "white",
            "images": [{"url": f"https://www.nike.com/image-{i}.jpg"} for i in range(8)],
            "aliases": ["Camisa teste"],
            "variants": [{"code": "WHITE", "color": "white", "color_name": "Branco"}],
        }
        self.normal = Ingestor(self.conn)
        self.assertEqual(self.normal.ingest(self.raw), "CREATE")
        self.ing = Ingestor(self.conn, skip_existing=True)
        self.conn.statements.clear()

    def test_existing_records_are_unchanged_and_images_need_one_select(self):
        tables = ("brands", "catalog_products", "catalog_images", "catalog_variants", "catalog_product_aliases")
        before = {table: self.conn.rows(table) for table in tables}
        changed = {**self.raw, "description": "Não preencher", "product_name": "Não sobrescrever",
                   "variants": [{"code": "WHITE", "color": "black", "color_name": "Preto"}]}
        self.assertEqual(self.ing.ingest(changed), "SKIP")
        self.assertEqual(before, {table: self.conn.rows(table) for table in tables})
        self.assertFalse(any(sql.startswith(("UPDATE", "INSERT")) for sql in self.conn.statements))
        self.assertEqual(sum("FROM catalog_images" in sql for sql in self.conn.statements), 1)
        self.assertEqual(self.ing.report.skipped, 1)

    def test_new_children_are_inserted_even_for_existing_product(self):
        before = self.conn.rows("catalog_products")
        raw = {**self.raw, "aliases": ["Novo apelido", "Novo apelido"],
               "images": [*self.raw["images"], {"url": "https://www.nike.com/new.jpg"},
                          {"url": "https://www.nike.com/new.jpg"}],
               "variants": [*self.raw["variants"], {"code": "BLACK", "color": "black"},
                            {"code": "BLACK", "color": "black"}]}
        self.assertEqual(self.ing.ingest(raw), "UPDATE")
        self.assertEqual(before, self.conn.rows("catalog_products"))
        self.assertEqual(len(self.conn.rows("catalog_images")), 9)
        self.assertEqual(sum(row["is_primary"] for row in self.conn.rows("catalog_images")), 1)
        self.assertEqual(len(self.conn.rows("catalog_product_aliases")), 2)
        self.assertEqual(len(self.conn.rows("catalog_variants")), 2)
        self.assertEqual(self.ing.ingest(raw), "SKIP")

    def test_new_model_color_is_a_variant_not_another_product(self):
        raw = {**self.raw, "sku": "NEW-COLOR", "color": "black", "color_name": "Preto", "variants": []}
        self.assertEqual(self.ing.ingest(raw), "UPDATE")
        self.assertEqual(len(self.conn.rows("catalog_products")), 1)
        self.assertEqual(len(self.conn.rows("catalog_variants")), 2)
        self.assertEqual(self.ing.ingest(raw), "SKIP")

    def test_new_product_is_created_and_reimport_is_skipped(self):
        raw = {**self.raw, "sku": "NEW-PRODUCT", "model_name": "Outro modelo"}
        self.assertEqual(self.ing.ingest(raw), "CREATE")
        self.assertEqual(len(self.conn.rows("catalog_products")), 2)
        self.assertEqual(self.ing.ingest(raw), "SKIP")

    def test_skip_brand_and_source_but_create_new_alias_and_source(self):
        with self.conn.cursor() as cur:
            brand, outcome = self.ing.upsert_brand(cur, {"name": "Nike", "website": "https://nike.com"})
            self.assertEqual(outcome, "SKIP")
            self.assertIsNone(brand["website"])
            self.assertEqual(self.ing.upsert_brand_alias(cur, brand["id"], "Marca teste"), "CREATE")
            self.assertEqual(self.ing.upsert_brand_alias(cur, brand["id"], "Marca teste"), "SKIP")
            src = {"domain": "nike.com", "source_type": "OFFICIAL_BRAND"}
            self.assertEqual(self.ing.upsert_source(cur, brand["id"], src), "CREATE")
            self.assertEqual(self.ing.upsert_source(cur, brand["id"], {**src, "allows_image_persistence": True}), "SKIP")
        self.conn.commit()
        self.assertFalse(self.conn.rows("catalog_sources")[0]["allows_image_persistence"])

    def test_brand_sources_are_cached_and_new_source_invalidates_cache(self):
        self.assertEqual(self.ing.ingest(self.raw), "SKIP")
        self.conn.statements.clear()
        self.assertEqual(self.ing.ingest(self.raw), "SKIP")
        self.assertFalse(any("FROM brands" in sql or "FROM catalog_sources" in sql for sql in self.conn.statements))
        bid = self.conn.rows("brands")[0]["id"]
        with self.conn.cursor() as cur:
            self.ing.upsert_source(cur, bid, {"domain": "nike.com", "source_type": "OFFICIAL_BRAND"})
            self.assertEqual(len(self.ing.official_sources(cur, bid)), 1)
        self.conn.commit()

    def test_new_brand_alias_invalidates_search_cache(self):
        bid = self.conn.rows("brands")[0]["id"]
        self.assertEqual(self.ing.ingest({**self.raw, "sku": "TWO", "model_name": "Two"}), "CREATE")
        with self.conn.cursor() as cur:
            self.ing.upsert_brand_alias(cur, bid, "Apelido novo da marca")
        self.conn.commit()
        self.assertEqual(self.ing.ingest({**self.raw, "sku": "THREE", "model_name": "Three"}), "CREATE")
        self.assertIn("apelido novo da marca", self.conn.rows("catalog_products")[-1]["search_text"])

    def test_no_create_brands_still_rejects_unknown_brand(self):
        ing = Ingestor(self.conn, create_brands=False, skip_existing=True)
        self.assertEqual(ing.ingest({**self.raw, "brand": "Marca desconhecida"}), "ERROR")
        self.assertEqual(len(self.conn.rows("brands")), 1)

    def test_disallowed_source_is_rejected_even_if_product_exists(self):
        self.assertEqual(self.ing.ingest({**self.raw, "official_product_url": "https://pinterest.com/pin/1"}), "ERROR")

    def test_dry_run_rolls_back_new_brand_children_and_caches(self):
        ing = Ingestor(self.conn, skip_existing=True, dry_run=True)
        tables = ("brands", "catalog_products", "catalog_images", "catalog_variants")
        before = {table: self.conn.rows(table) for table in tables}
        raw = {**self.raw, "brand": "Nova marca", "sku": "NEW-DRY", "model_name": "New"}
        self.assertEqual(ing.ingest(raw), "CREATE")
        self.assertEqual(before, {table: self.conn.rows(table) for table in tables})
        self.assertEqual(ing._brands, {})
        self.assertEqual(ing._sources, {})
        self.assertEqual(ing.ingest(raw), "DUPLICATE")
        self.assertEqual(before, {table: self.conn.rows(table) for table in tables})

    def test_failed_transaction_does_not_leave_phantom_brand_in_cache(self):
        self.conn.fail_on = "INSERT INTO catalog_images"
        raw = {**self.raw, "brand": "Nova marca", "sku": "NEW-RETRY", "model_name": "New"}
        self.assertEqual(self.ing.ingest(raw), "ERROR")
        self.assertEqual(len(self.conn.rows("brands")), 1)
        self.assertEqual(self.ing._brands, {})
        self.conn.fail_on = None
        self.assertEqual(self.ing.ingest(raw), "CREATE")
        self.assertEqual(len(self.conn.rows("brands")), 2)

    def test_default_merge_and_overwrite_remain_available(self):
        self.assertEqual(self.normal.ingest({**self.raw, "description": "Novo texto"}), "UPDATE")
        self.assertEqual(self.conn.rows("catalog_products")[0]["description"], "Novo texto")
        ing = Ingestor(self.conn, overwrite=True)
        self.assertEqual(ing.ingest({**self.raw, "product_name": "Título corrigido"}), "UPDATE")
        self.assertEqual(self.conn.rows("catalog_products")[0]["product_name"], "Título corrigido")

    def test_existing_image_keeps_default_verification_behavior(self):
        self.assertEqual(self.normal.ingest(self.raw), "SKIP")
        self.assertEqual(sum(sql.startswith("UPDATE catalog_images") for sql in self.conn.statements), 8)

    def test_empty_children_do_not_query_child_tables(self):
        self.assertEqual(self.ing.ingest({**self.raw, "images": [], "variants": [], "aliases": []}), "SKIP")
        self.assertFalse(any("FROM catalog_images" in sql or "FROM catalog_product_aliases" in sql
                             or "WHERE product_id" in sql for sql in self.conn.statements))

    def test_conflicting_modes_are_rejected_before_connect(self):
        with self.assertRaises(ValueError):
            Ingestor(self.conn, skip_existing=True, overwrite=True)
        for module, args in ((import_products, ["x.json", "--skip-existing", "--overwrite"]),
                             (seed_catalog, ["--skip-existing", "--overwrite"])):
            with patch.object(module, "connect") as connect, self.assertRaises(SystemExit) as exc:
                module.main(args)
            self.assertEqual(exc.exception.code, 2)
            connect.assert_not_called()


if __name__ == "__main__":
    unittest.main()
