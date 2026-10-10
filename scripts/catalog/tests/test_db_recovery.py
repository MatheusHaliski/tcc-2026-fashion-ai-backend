"""Queda de conexão durante consulta/COMMIT, recuperação idempotente e interrupção do lote."""
import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import db
import import_products
import seed_catalog
from deduplicate import find_existing
from ingest import Ingestor
from normalize_product import Normalizer, normalize_product
from test_ingest import Cursor, Database


class UnstableCursor(Cursor):
    def execute(self, sql, params=()):
        if self.conn.drop_on and self.conn.drop_on in sql:
            self.conn.drop_on = None
            self.conn.disconnect()
            raise db.pymysql.err.OperationalError(2013, "Conexão interrompida no teste")
        super().execute(sql, params)


class UnstableDatabase(Database):
    def __init__(self):
        super().__init__()
        self.open = True
        self.drop_on = None
        self.drop_commit = None
        self.unavailable = False
        self.pings = 0

    def disconnect(self, committed=False):
        if not committed:
            super().rollback()  # transação aberta é descartada pelo servidor ao fechar a sessão
        self.open = False

    def cursor(self):
        if not self.open:
            raise db.pymysql.err.InterfaceError(0, "")
        return UnstableCursor(self)

    def rollback(self):
        if not self.open:
            raise db.pymysql.err.InterfaceError(0, "")
        super().rollback()

    def commit(self):
        fault = self.drop_commit
        self.drop_commit = None
        if fault == "before":
            self.disconnect()
            raise db.pymysql.err.OperationalError(2013, "COMMIT não recebido")
        super().commit()
        if fault == "after":
            self.disconnect(committed=True)
            raise db.pymysql.err.OperationalError(2013, "Resposta do COMMIT perdida")

    def connect(self):
        self.pings += 1
        if self.unavailable:
            raise db.pymysql.err.OperationalError(2003, "Servidor indisponível")
        self.open = True


@unittest.skipIf(db.pymysql is None, "instale scripts/catalog/requirements.txt para testar desconexões MySQL")
class RecoveryTest(unittest.TestCase):
    def setUp(self):
        self.conn = UnstableDatabase()
        self.addCleanup(self.conn.close)
        self.sleep = patch("db.time.sleep").start()
        self.addCleanup(patch.stopall)
        self.raw = {"brand": "Nike", "subcategory": "t_shirt", "product_name": "Camiseta teste",
                    "sku": "RECONNECT-1", "model_name": "Reconnect", "color": "white",
                    "images": [{"url": "https://nike.com/photo.jpg"}]}
        self.ing = Ingestor(self.conn, skip_existing=True)

    def test_rollback_does_not_mask_original_disconnect(self):
        with self.assertRaises(db.pymysql.err.OperationalError) as caught:
            with db.transaction(self.conn, False):
                self.conn.disconnect()
                raise db.pymysql.err.OperationalError(2006, "Conexão perdida")
        self.assertEqual(caught.exception.args[0], 2006)

    def test_disconnect_mid_product_retries_whole_transaction_without_phantoms(self):
        self.conn.drop_on = "INSERT INTO catalog_images"
        self.assertEqual(self.ing.ingest(self.raw), "CREATE")
        self.assertEqual(self.conn.pings, 1)
        for table in ("brands", "catalog_products", "catalog_images"):
            self.assertEqual(len(self.conn.rows(table)), 1)
        self.assertEqual(self.ing.report.created, 1)
        self.assertEqual(self.ing.report.total_read, 1)
        self.assertEqual(self.ing.report.errors, 0)
        self.assertEqual(self.ing.ingest(self.raw), "SKIP")

    def test_late_disconnect_after_many_products_recovers_and_continues(self):
        for i in range(25):
            raw = {**self.raw, "sku": f"LATE-{i}", "model_name": f"Late {i}"}
            if i == 20:
                self.conn.drop_on = "INSERT INTO catalog_images"
            self.assertEqual(self.ing.ingest(raw), "CREATE")
        self.assertEqual(len(self.conn.rows("catalog_products")), 25)
        self.assertEqual(self.ing.report.created, 25)
        self.assertEqual(self.ing.report.errors, 0)
        self.assertEqual(self.conn.pings, 1)

    def test_commit_failure_does_not_duplicate_report_counters_or_dry_run_seen(self):
        self.conn.drop_commit = "before"
        self.assertEqual(self.ing.ingest(self.raw), "CREATE")
        self.assertEqual(self.ing.report.created, 1)
        self.assertEqual(self.ing.report.total_read, 1)
        self.assertEqual(len(self.conn.rows("catalog_products")), 1)
        dry = Ingestor(self.conn, dry_run=True)
        self.conn.drop_on = "INSERT INTO catalog_images"
        raw = {**self.raw, "sku": "DRY-NEW", "model_name": "Dry"}
        self.assertEqual(dry.ingest(raw), "CREATE")
        self.assertEqual(dry.ingest(raw), "DUPLICATE")
        self.assertEqual(dry.report.created, 1)
        self.assertEqual(len(self.conn.rows("catalog_products")), 1)

    def test_lost_commit_ack_reloads_existing_product_and_counts_only_final_outcome(self):
        self.conn.drop_commit = "after"
        self.assertEqual(self.ing.ingest(self.raw), "SKIP")
        self.assertEqual(len(self.conn.rows("catalog_products")), 1)
        self.assertEqual(self.ing.report.created, 0)
        self.assertEqual(self.ing.report.skipped, 1)
        self.assertEqual(self.ing.report.total_read, 1)

    def test_retry_restores_variant_identifiers_mutated_during_first_attempt(self):
        self.ing.ingest(self.raw)
        self.conn.drop_commit = "before"
        raw = {**self.raw, "sku": "BLACK-VARIANT", "color": "black", "color_name": "Preto"}
        self.assertEqual(self.ing.ingest(raw), "UPDATE")
        self.assertEqual(len(self.conn.rows("catalog_products")), 1)
        self.assertEqual(self.conn.rows("catalog_products")[0]["color"], "white")
        self.assertEqual(self.conn.rows("catalog_variants")[0]["sku"], "BLACK-VARIANT")
        self.assertEqual(self.ing.report.updated, 1)

    def test_report_reconnects_and_lost_commit_ack_does_not_create_second_run(self):
        self.ing.ingest(self.raw)
        self.conn.drop_commit = "after"
        self.ing.record_run("INCREMENTAL", "test.jsonl", db.now())
        self.assertEqual(len(self.conn.rows("catalog_ingestion_runs")), 1)
        self.conn.disconnect()
        self.ing.record_run("INCREMENTAL", "test-again.jsonl", db.now())
        self.assertEqual(len(self.conn.rows("catalog_ingestion_runs")), 2)

    def test_data_errors_are_not_retried_or_counted_as_created(self):
        self.conn.fail_on = "INSERT INTO catalog_images"
        self.assertEqual(self.ing.ingest(self.raw), "ERROR")
        self.assertEqual(self.conn.pings, 0)
        self.sleep.assert_not_called()
        self.assertFalse(self.ing.seen)
        self.assertEqual(self.ing.report.created, 0)

    def test_permanent_outage_stops_cli_before_remaining_lines_and_prints_report(self):
        self.conn.drop_on = "SELECT"
        self.conn.unavailable = True
        output = io.StringIO()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "products.jsonl"
            path.write_text((json.dumps(self.raw) + "\n") * 500)
            with patch.object(import_products, "connect", return_value=self.conn), contextlib.redirect_stdout(output):
                self.assertEqual(import_products.main([str(path), "--skip-existing"]), 1)
        self.assertIn("Lote interrompido", output.getvalue())
        self.assertIn("total_read        1", output.getvalue())
        self.assertEqual(self.conn.pings, 3)
        self.assertEqual(self.sleep.call_count, 3)

    def test_seed_brand_retries_without_double_counting_and_without_partial_children(self):
        self.conn.drop_on = "INSERT INTO catalog_sources"
        counts = seed_catalog.seed_brands(self.ing, [{"name": "Nike", "sources": [
            {"domain": "nike.com", "source_type": "OFFICIAL_BRAND"}]}], {"nike": ["Nike teste"]})
        self.assertEqual(counts, {"brands": {"CREATE": 1}, "aliases": {"CREATE": 1}, "sources": {"CREATE": 1}})
        self.assertEqual(len(self.conn.rows("brand_aliases")), 1)


class LookupTest(unittest.TestCase):
    def setUp(self):
        self.conn = Database()
        self.addCleanup(self.conn.close)
        self.raw = {"brand": "Nike", "subcategory": "t_shirt", "product_name": "A", "sku": "SKU-A"}
        self.ing = Ingestor(self.conn)
        self.assertEqual(self.ing.ingest(self.raw), "CREATE")

    def test_one_query_for_many_missing_identifiers(self):
        product = normalize_product({**self.raw, "sku": "NONE", "gtin": "1234567890123", "ean": "1234567890123",
                                     "upc": "123456789012", "product_code": "NONE"}, Normalizer())
        self.conn.statements.clear()
        with self.conn.cursor() as cur:
            self.assertEqual(find_existing(cur, product, "NONE"), (None, None))
        self.assertEqual(len(self.conn.statements), 1)

    def test_strong_identifier_priority_over_variant_and_dedup_is_preserved(self):
        self.ing.ingest({**self.raw, "product_name": "B", "sku": "SKU-B", "gtin": "1234567890123"})
        a = self.conn.rows("catalog_products")[0]
        product = normalize_product({**self.raw, "gtin": "1234567890123"}, Normalizer())
        with self.conn.cursor() as cur:
            row, reason = find_existing(cur, product, a["dedup_key"])
        self.assertEqual(row["product_name"], "B")
        self.assertEqual(reason, "gtin=1234567890123")
        self.assertNotIn("match_priority", row)

    def test_variant_identifier_precedes_fallback_dedup(self):
        self.ing.ingest({**self.raw, "variants": [{"code": "V", "sku": "VARIANT-1", "color": "black"}]})
        self.ing.ingest({**self.raw, "product_name": "B", "sku": "SKU-B"})
        b = self.conn.rows("catalog_products")[1]
        with self.conn.cursor() as cur:
            row, reason = find_existing(cur, normalize_product({**self.raw, "sku": "VARIANT-1"}, Normalizer()), b["dedup_key"])
        self.assertEqual(row["product_name"], "A")
        self.assertEqual(reason, "variante sku=VARIANT-1")
