"""Lote de photoSets fora do banco: exportação das linhas, importação com CAS e upload conferido — banco e storage falsos."""
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import process_photo_sets as pps  # noqa: E402


class FakeCursor:
    def __init__(self, conn):
        self.conn, self.rows = conn, []

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql, params=()):
        self.conn.queries.append((sql, params))
        if "WHERE i.id=%s" in sql:
            self.rows = [r for r in self.conn.records if r["id"] == params[0]]
        else:
            last, limit = params
            self.rows = [r for r in self.conn.records if r["id"] > last][:limit]

    def fetchall(self):
        return list(self.rows)

    def fetchone(self):
        return self.rows[0] if self.rows else None


class FakeConn:
    def __init__(self, records):
        self.records, self.queries = records, []

    def cursor(self):
        return FakeCursor(self)

    def rollback(self):
        pass


class FakeStorage:
    """put/get em memória; `tamper` devolve bytes diferentes na leitura de volta."""

    def __init__(self, tamper=False):
        self.bucket, self.base, self.objects, self.client, self.tamper = "b", "https://media.example", {}, self, tamper

    def put_object(self, Bucket, Key, Body, ContentType):
        self.objects[Key] = Body

    def get_object(self, Bucket, Key):
        data = self.objects[Key] + (b"!" if self.tamper else b"")

        class Body:
            def read(self, n=-1):
                return data[:n] if n and n > 0 else data

            def close(self):
                pass
        return {"Body": Body()}


def record(i, **over):
    base = {"id": f"img-{i}", "product_id": f"p-{i}", "brand": "Hering", "category": "upper_piece", "subcategory": "t_shirt", "color": "blue",
            "image_url": f"https://hering.com.br/{i}.jpg", "version": 3, "source_sha256": None, "assets_json": None, "source_domain": "hering.com.br"}
    base.update(over)
    return base


def ready_set(rec):
    return json.dumps({"photoSet": {"version": pps.PHOTO_SET_VERSION, "sourceUrl": rec["image_url"], "sourceSha256": None, "category": rec["category"],
                                    "subcategory": rec["subcategory"], "color": rec["color"], "status": "READY"}})


class ExportRowsTest(unittest.TestCase):
    def test_exporta_so_fotos_sem_photo_set_atual(self):
        r2 = record(2); r2["assets_json"] = ready_set(r2)
        conn = FakeConn([record(1), r2, record(3)])
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "rows.json"
            self.assertEqual(pps.export_rows(conn, out, batch_size=2), 2)
            rows = json.loads(out.read_text(encoding="utf-8"))
            self.assertEqual([r["id"] for r in rows], ["img-1", "img-3"])
            self.assertEqual(rows[0], {"id": "img-1", "product_id": "p-1", "brand": "Hering", "category": "upper_piece", "subcategory": "t_shirt",
                                       "color": "blue", "image_url": "https://hering.com.br/1.jpg"})
            self.assertEqual(pps.export_rows(conn, out, force=True), 3)
            self.assertEqual(pps.export_rows(conn, out, limit=1), 1)


def write_set(lot, folder, result, images=True):
    d = Path(lot) / "photo-sets" / folder
    d.mkdir(parents=True)
    (d / "set.json").write_text(json.dumps(result), encoding="utf-8")
    if images:
        (d / "whole.png").write_bytes(b"WHOLE-" + folder.encode()); (d / "fabric.png").write_bytes(b"FABRIC-" + folder.encode())


class ImportLotTest(unittest.TestCase):
    def lot(self, tmp):
        base = {"version": pps.PHOTO_SET_VERSION, "category": "upper_piece", "subcategory": "t_shirt", "color": None, "metrics": {"preflight": {"status": "PASS"}}}
        write_set(tmp, "a", {**base, "imageId": "img-1", "productId": "p-1", "sourceUrl": "https://hering.com.br/1.jpg", "status": "READY",
                             "files": {"whole": "whole.png", "fabric": "fabric.png"}})
        write_set(tmp, "b", {**base, "imageId": "img-2", "productId": "p-2", "sourceUrl": "https://hering.com.br/2.jpg", "status": "REVIEW", "reason": "GARMENT_OCCLUSION_UNCERTAIN"}, images=False)
        write_set(tmp, "c", {**base, "imageId": "img-3", "productId": "p-3", "sourceUrl": "https://hering.com.br/OLD.jpg", "status": "READY"})
        write_set(tmp, "d", {**base, "imageId": "img-9", "productId": "p-9", "sourceUrl": "https://hering.com.br/9.jpg", "status": "READY"})

    def test_ensaio_conta_sem_gravar_e_apply_sobe_e_grava_com_cas(self):
        commits = []
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(pps, "commit_set", side_effect=lambda conn, rec, res: commits.append((rec["id"], dict(res))) or True), \
                mock.patch.object(pps.db, "run_transaction", side_effect=lambda conn, op: op()):
            self.lot(tmp)
            conn = FakeConn([record(1), record(2), record(3)])
            storage = FakeStorage()
            import io
            audit = io.StringIO()
            counts = pps.import_lot(conn, tmp, storage, audit, apply=False)
            self.assertEqual(counts, {"READY": 1, "REVIEW": 1, "stale": 1, "missing": 1}); self.assertEqual(commits, []); self.assertEqual(storage.objects, {})
            counts = pps.import_lot(conn, tmp, storage, audit, apply=True)
            self.assertEqual(counts, {"saved": 2, "stale": 1, "missing": 1})
            self.assertEqual([c[0] for c in commits], ["img-1", "img-2"])
            ready = commits[0][1]
            self.assertEqual(ready["color"], "blue", "a cor vem do banco na hora do commit")
            self.assertNotIn("imageId", ready); self.assertNotIn("files", ready)
            self.assertEqual(ready["wholeUrl"], "https://media.example/catalog/photo-sets/CATALOG_PHOTO_SET_V2/" + hashlib.sha256(b"WHOLE-a").hexdigest() + ".png")
            self.assertTrue(ready["fabricUrl"].endswith(hashlib.sha256(b"FABRIC-a").hexdigest() + ".png"))
            self.assertEqual(len(storage.objects), 2)
            self.assertNotIn("wholeUrl", commits[1][1], "REVIEW não sobe imagem")
            lines = [json.loads(l) for l in audit.getvalue().splitlines()]
            self.assertEqual([(l["imageId"], l["saved"]) for l in lines][-2:], [("img-1", True), ("img-2", True)])

    def test_upload_confere_a_leitura_de_volta(self):
        self.assertTrue(pps.upload(FakeStorage(), b"png").startswith("https://media.example/catalog/photo-sets/"))
        with self.assertRaisesRegex(ValueError, "UPLOAD_VERIFICATION_FAILED"):
            pps.upload(FakeStorage(tamper=True), b"png")


if __name__ == "__main__":
    unittest.main()
