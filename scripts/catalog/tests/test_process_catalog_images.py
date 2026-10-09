import io
import json
import os
import tempfile
import threading
import unittest
from concurrent.futures import wait as futures_wait
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch

from scripts.catalog.process_catalog_images import (
    AnalysisCheckpoint, DownloadFailure, ImageDownloader, audit_record, configure_railway_environment,
    analyze_records, main, public_image_url, update_committed,
)


class ProcessCatalogImagesTests(unittest.TestCase):
    def test_inventory_progress_is_visible_on_stderr_without_credentials_or_urls(self):
        secret = "dummy-progress-password"
        image_url = "https://images.example/private-photo.jpg?private-token=dummy-token"
        record = {"source_scope": "SNAPSHOT_LOCAL", "product_id": "p", "image_id": "i",
                  "source_url": image_url}
        stdout, stderr = io.StringIO(), io.StringIO()
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {
            "MYSQL_PASSWORD": secret,
            "MYSQL_PUBLIC_URL": "mysql://fai_app:dummy-url-password@proxy.example:42234/fashionai",
        }), patch("catalog_image_inventory.load_snapshot", return_value=iter([record])), \
                patch("catalog_image_workbook.write_workbook"), \
                redirect_stdout(stdout), redirect_stderr(stderr):
            result = main(["--snapshot", "placeholder.jsonl", "--output", str(Path(directory) / "report.xlsx")])
        self.assertEqual(result, 0)
        self.assertEqual(json.loads(stdout.getvalue())["images"], 1)
        self.assertIn("Lendo o inventário local", stderr.getvalue())
        self.assertIn("Inventário carregado: 1 peças, 1 imagens, 1 registros", stderr.getvalue())
        self.assertIn("Exportando a planilha", stderr.getvalue())
        self.assertIn("Execução concluída", stderr.getvalue())
        for sensitive in (secret, image_url, "dummy-token", "dummy-url-password", "proxy.example"):
            self.assertNotIn(sensitive, stderr.getvalue())

    def test_analysis_reports_completed_jobs_and_restores_order_after_out_of_order_completion(self):
        release_first = threading.Event()
        records = [{"image_id": "first", "source_url": "https://images.example/first.jpg"},
                   {"image_id": "second", "source_url": "https://images.example/second.jpg"}]

        def analyze(record, *args, **kwargs):
            if record["image_id"] == "first":
                if not release_first.wait(2):
                    raise AssertionError("The first job was not released after the second completed")
                return {**record, "analysis": {"columns": {}}}
            return {**record, "error": "IMAGE_DOWNLOAD_UNAVAILABLE"}

        def wait_after_second_completes(*args, **kwargs):
            done, pending = futures_wait(*args, **kwargs)
            if any(future.result()["image_id"] == "second" for future in done):
                release_first.set()
            return done, pending

        stderr = io.StringIO()
        with patch("scripts.catalog.process_catalog_images.audit_record", side_effect=analyze), \
                patch("scripts.catalog.process_catalog_images.wait", side_effect=wait_after_second_completes), \
                patch("scripts.catalog.process_catalog_images.PROGRESS_INTERVAL", 0), redirect_stderr(stderr):
            results = analyze_records(records, None, None, None, workers=2)
        self.assertEqual([row["image_id"] for row in results], ["first", "second"])
        self.assertIn("1/2", stderr.getvalue())
        self.assertIn("2/2", stderr.getvalue())
        self.assertIn("Análises concluídas: 1; falhas: 1", stderr.getvalue())
        self.assertNotIn("https://", stderr.getvalue())

    def test_analysis_prints_a_heartbeat_while_waiting_for_a_job(self):
        wait_count = 0

        def waiting_once(*args, **kwargs):
            nonlocal wait_count
            wait_count += 1
            if wait_count == 1:
                return set(), set(args[0])
            return futures_wait(*args, **kwargs)

        stderr = io.StringIO()
        with patch("scripts.catalog.process_catalog_images.audit_record", return_value={"analysis": {}}), \
                patch("scripts.catalog.process_catalog_images.wait", side_effect=waiting_once), \
                patch("scripts.catalog.process_catalog_images.time.monotonic", side_effect=[0, 5, 10, 10]), \
                redirect_stderr(stderr):
            analyze_records([{"image_id": "i"}], None, None, None, workers=1)
        self.assertIn("0/1. Análises concluídas: 0; falhas: 0", stderr.getvalue())
        self.assertIn("1/1", stderr.getvalue())

    def test_railway_names_use_public_proxy_and_app_user_without_root_password(self):
        import os
        with patch.dict(os.environ, {"MYSQLHOST": "mysql.railway.internal", "MYSQLPORT": "3306",
                                   "MYSQLDATABASE": "fashionai", "MYSQLUSER": "root",
                                   "MYSQL_PUBLIC_URL": "mysql://root:dummy-root@proxy.example:42234/fashionai",
                                   "MYSQL_ROOT_PASSWORD": "dummy-root", "MYSQL_APP_PASSWORD": "dummy-app"}, clear=True):
            configure_railway_environment()
            self.assertEqual(os.environ["MYSQL_HOST"], "proxy.example")
            self.assertEqual(os.environ["MYSQL_PORT"], "42234")
            self.assertEqual(os.environ["MYSQL_DATABASE"], "fashionai")
            self.assertEqual(os.environ["MYSQL_USER"], "fai_app")
            self.assertEqual(os.environ["MYSQL_PASSWORD"], "dummy-app")
            self.assertEqual(os.environ["MYSQL_SSL_MODE"], "REQUIRED")
        with patch.dict(os.environ, {"MYSQL_ROOT_PASSWORD": "dummy-root", "MYSQLUSER": "root"}, clear=True):
            configure_railway_environment()
            self.assertNotIn("MYSQL_PASSWORD", os.environ)

    def test_bare_public_endpoint_uses_proxy_without_treating_port_as_database(self):
        import os
        with patch.dict(os.environ, {"MYSQL_PUBLIC_URL": " proxy.example:42234 ",
                                   "MYSQLHOST": "mysql.railway.internal", "MYSQLPORT": "3306",
                                   "MYSQL_APP_PASSWORD": "dummy-app"}, clear=True):
            configure_railway_environment()
            self.assertEqual(os.environ["MYSQL_HOST"], "proxy.example")
            self.assertEqual(os.environ["MYSQL_PORT"], "42234")
            self.assertNotIn("MYSQL_DATABASE", os.environ)
            self.assertEqual(os.environ["MYSQL_USER"], "fai_app")
            self.assertEqual(os.environ["MYSQL_PASSWORD"], "dummy-app")
            self.assertEqual(os.environ["MYSQL_SSL_MODE"], "REQUIRED")
            self.assertEqual(os.environ["MYSQL_PUBLIC_URL"], " proxy.example:42234 ")

    def test_scheme_relative_public_endpoint_preserves_native_database(self):
        import os
        with patch.dict(os.environ, {"MYSQL_PUBLIC_URL": "//proxy.example:42234",
                                   "MYSQLDATABASE": "fashionai"}, clear=True):
            configure_railway_environment()
            self.assertEqual(os.environ["MYSQL_HOST"], "proxy.example")
            self.assertEqual(os.environ["MYSQL_PORT"], "42234")
            self.assertEqual(os.environ["MYSQL_DATABASE"], "fashionai")

    def test_public_endpoint_never_overrides_explicit_mysql_configuration(self):
        import os
        explicit = {"MYSQL_HOST": "explicit.example", "MYSQL_PORT": "43306",
                    "MYSQL_DATABASE": "explicit_database", "MYSQL_USER": "explicit_app",
                    "MYSQL_PASSWORD": "dummy-explicit", "MYSQL_SSL_MODE": "VERIFY_IDENTITY"}
        for endpoint in ("proxy.example:42234", "//proxy.example:42234",
                         "mysql://root:dummy-root@proxy.example:42234/url_database"):
            with self.subTest(endpoint=endpoint), patch.dict(os.environ, {
                **explicit, "MYSQL_PUBLIC_URL": endpoint, "MYSQLDATABASE": "native_database",
                "MYSQL_APP_PASSWORD": "dummy-app", "MYSQLUSER": "root",
            }, clear=True):
                configure_railway_environment()
                for name, value in explicit.items():
                    self.assertEqual(os.environ[name], value)

    def test_embedded_public_url_credentials_are_not_adopted(self):
        import os
        with patch.dict(os.environ, {
            "MYSQL_PUBLIC_URL": "mysql://root:dummy-root@proxy.example:42234/fashionai",
            "MYSQL_ROOT_PASSWORD": "dummy-root", "MYSQLUSER": "root",
        }, clear=True):
            configure_railway_environment()
            self.assertEqual(os.environ["MYSQL_HOST"], "proxy.example")
            self.assertEqual(os.environ["MYSQL_PORT"], "42234")
            self.assertEqual(os.environ["MYSQL_DATABASE"], "fashionai")
            self.assertNotIn("MYSQL_USER", os.environ)
            self.assertNotIn("MYSQL_PASSWORD", os.environ)

    def test_committed_ranking_only_change_preserves_image_provenance_and_processed_url(self):
        row = {"image_id": "a", "source_url": "https://cdn.example/original.jpg", "image_url": "https://cdn.example/original.jpg"}
        after = {"id": "a", "source_url": "https://brand.example/product", "image_url": row["source_url"],
                 "is_canonical": True, "assets_json": json.dumps({"card": "https://api.example/card.jpg"}),
                 "crop_json": None, "metrics_json": None, "processing_status": "APPROVED"}
        update_committed(row, {"after": after})
        self.assertEqual(row["source_url"], "https://cdn.example/original.jpg")
        self.assertEqual(row["current_url"], "https://api.example/card.jpg")
        self.assertNotIn("analysis", row)

    def test_https_public_sources_only_and_redirect_validation_reuses_same_rule(self):
        with patch("scripts.catalog.process_catalog_images.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("8.8.8.8", 443))]):
            self.assertEqual(public_image_url("https://cdn.brand.example/photo.jpg"), "https://cdn.brand.example/photo.jpg")
            for url in ("http://cdn.brand.example/photo.jpg", "https://user:secret@cdn.brand.example/photo.jpg", "file:///tmp/photo.jpg", "https://cdn.brand.example:8080/a.jpg"):
                with self.assertRaises(DownloadFailure):
                    public_image_url(url)
        with patch("scripts.catalog.process_catalog_images.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("127.0.0.1", 443))]):
            with self.assertRaisesRegex(DownloadFailure, "NON_PUBLIC"):
                public_image_url("https://local.example/photo.jpg")

    def test_proxy_block_avoids_thousands_of_repeated_network_attempts(self):
        with tempfile.TemporaryDirectory() as directory:
            downloader = ImageDownloader(Path(directory))
            downloader.proxy_blocked = True
            with patch("scripts.catalog.process_catalog_images.public_image_url") as validate:
                with self.assertRaisesRegex(DownloadFailure, "NETWORK_PROXY_BLOCKED"):
                    downloader.get("https://cdn.example/a.jpg")
                validate.assert_not_called()

    def test_checkpoint_distinguishes_piece_context_and_observed_source_revision(self):
        record = {"source_url": "https://cdn.example/a.jpg", "category": "upper_piece", "subcategory": "blazer", "image_type": "PACKSHOT", "version": 1}
        with tempfile.TemporaryDirectory() as directory:
            checkpoint = AnalysisCheckpoint(Path(directory) / "state.sqlite")
            try:
                checkpoint.put(record, "V4", {"columns": {"processing_status": "APPROVED"}})
                self.assertIsNotNone(checkpoint.get(record, "V4"))
                self.assertIsNone(checkpoint.get(record, "V3"))
                self.assertIsNone(checkpoint.get({**record, "category": "lower_piece"}, "V4"))
                self.assertIsNone(checkpoint.get({**record, "version": 2}, "V4"))
            finally:
                checkpoint.close()

    def test_snapshot_without_metadata_is_unknown_not_a_claim_of_failure_or_success(self):
        record = {"source_scope": "SNAPSHOT_LOCAL", "source_url": "https://cdn.example/a.jpg", "image_id": "a"}
        result = audit_record(record, None, None, None, apply=False)
        self.assertIsNone(result["standardized_before"])
        self.assertIsNone(result["standardized_after"])
        missing = audit_record({**record, "source_url": None}, None, None, None, apply=False)
        self.assertFalse(missing["standardized_before"])
        self.assertIn("sem imagem", missing["status_note"])

    def test_failed_download_does_not_change_analysis_or_claim_applied(self):
        class Downloader:
            def get(self, url):
                raise DownloadFailure("NETWORK_PROXY_BLOCKED")

        class Analyzer:
            ready = {"pipelineVersion": "CATALOG_IMAGE_PIPELINE_V4"}

        class Checkpoint:
            def get(self, record, version):
                return None

        record = {"source_scope": "SNAPSHOT_LOCAL", "source_url": "https://cdn.example/a.jpg", "image_id": "a"}
        result = audit_record(record, Downloader(), Analyzer(), Checkpoint(), apply=True)
        self.assertIsNone(result["standardized_after"])
        self.assertNotIn("analysis", result)
        self.assertEqual(result["error"], "NETWORK_PROXY_BLOCKED")


if __name__ == "__main__":
    unittest.main()
