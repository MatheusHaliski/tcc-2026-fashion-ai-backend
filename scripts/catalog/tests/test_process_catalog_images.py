import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.catalog.process_catalog_images import (
    AnalysisCheckpoint, DownloadFailure, ImageDownloader, audit_record, configure_railway_environment,
    public_image_url, update_committed,
)


class ProcessCatalogImagesTests(unittest.TestCase):
    def test_railway_names_use_public_proxy_and_app_user_without_root_password(self):
        import os
        with patch.dict(os.environ, {"MYSQLHOST": "mysql.railway.internal", "MYSQLPORT": "3306",
                                   "MYSQLDATABASE": "fashionai", "MYSQLUSER": "root",
                                   "MYSQL_PUBLIC_URL": "mysql://root:dummy-root@proxy.example:42234/fashionai",
                                   "MYSQL_ROOT_PASSWORD": "dummy-root", "MYSQL_APP_PASSWORD": "dummy-app"}, clear=True):
            configure_railway_environment()
            self.assertEqual(os.environ["MYSQL_HOST"], "proxy.example")
            self.assertEqual(os.environ["MYSQL_PORT"], "42234")
            self.assertEqual(os.environ["MYSQL_USER"], "fai_app")
            self.assertEqual(os.environ["MYSQL_PASSWORD"], "dummy-app")
            self.assertEqual(os.environ["MYSQL_SSL_MODE"], "REQUIRED")
        with patch.dict(os.environ, {"MYSQL_ROOT_PASSWORD": "dummy-root", "MYSQLUSER": "root"}, clear=True):
            configure_railway_environment()
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
