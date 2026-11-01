"""Catalogue batch end to end against a local stand-in for the GPU API: the HTTP flow (submit, poll, download,
delete), the complete/occluded/cut classification, the report and the projection. No GPU and no MySQL."""
import io
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import numpy as np
import pytest
from PIL import Image

from services.garment_gpu.scripts import catalog_batch, catalog_report, catalog_source
from services.garment_gpu.scripts.catalog_classify import classify
from services.garment_gpu.tests.support import ORANGE, png

SKIN = (224, 172, 140)


def photo(*, person=True, arm_in_front=False, cut=False):
    """Synthetic catalogue photo: garment, optional model and optional crop by the frame."""
    img = np.full((360, 240, 3), 235, np.uint8)
    top = 0 if cut else 60
    img[top:240, 60:180] = ORANGE
    if person:
        img[20:60, 100:140] = SKIN          # cabeça
        img[90:300, 30:58] = SKIN           # braço ao lado da peça
    if arm_in_front:
        img[150:230, 95:145] = SKIN         # antebraço sobre a peça
    return Image.fromarray(img)


def garment_mask(image):
    return (np.abs(np.asarray(image).astype(int) - np.array(ORANGE)).sum(-1) < 40)


class FakeGpu(BaseHTTPRequestHandler):
    """Mimics /v1/garments: one job, then segmented (cut-out) and mask."""

    jobs: dict = {}

    def log_message(self, *a):
        pass

    def _send(self, code, body, content_type="application/json"):
        payload = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        assert self.headers.get("X-API-Key") == "k" * 64
        body = self.rfile.read(int(self.headers["Content-Length"]))
        start = body.index(b"\r\n\r\n", body.index(b'name="image"')) + 4
        raw = body[start:body.index(b"\r\n--", start)]
        with Image.open(io.BytesIO(raw)) as image:
            rgb = image.convert("RGB")
        mask = garment_mask(rgb)
        cutout = rgb.convert("RGBA")
        cutout.putalpha(Image.fromarray((mask * 255).astype(np.uint8)))
        job_id = f"{len(self.jobs):032x}"
        FakeGpu.jobs[job_id] = {"mask": png(Image.fromarray((mask * 255).astype(np.uint8))), "segmented": png(cutout)}
        self._send(202, {"job_id": job_id, "status": "queued"})

    def do_GET(self):
        job_id = self.path.split("/v1/jobs/")[1].split("/")[0].split("?")[0]
        if "/image" in self.path:
            variant = "mask" if "variant=mask" in self.path else "segmented"
            return self._send(200, self.jobs[job_id][variant], "image/png")
        self._send(200, {"job_id": job_id, "status": "completed",
                         "segmentation": {"mask_score": 0.98, "detection_label": "t-shirt"}})

    def do_DELETE(self):
        self._send(204, b"")


@pytest.fixture
def gpu_url():
    server = HTTPServer(("127.0.0.1", 0), FakeGpu)
    FakeGpu.jobs = {}
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()


@pytest.mark.parametrize("kwargs,expected", [
    ({"person": False}, "COMPLETE_PRODUCT"),
    ({}, "COMPLETE_ON_MODEL"),
    ({"arm_in_front": True}, "OCCLUDED"),
    ({"cut": True}, "CUT"),
])
def test_classifica_peca_completa_ocluida_e_cortada(kwargs, expected):
    image = photo(**kwargs)
    assert classify(np.asarray(image), garment_mask(image), "upper_piece")["class"] == expected


def test_mascara_vazia_e_sem_pessoa_nao_viram_oclusao():
    image = photo(person=False)
    assert classify(np.asarray(image), np.zeros((360, 240), bool))["class"] == "NO_GARMENT"
    assert classify(np.asarray(image), garment_mask(image), "upper_piece")["metrics"]["person"] is False


def test_lote_completo_gera_recortes_auditoria_e_relatorio(gpu_url, tmp_path, monkeypatch):
    products = [{"id": f"p{i}", "product_name": f"Peça {i}", "category": "upper_piece", "subcategory": "t_shirt",
                 "color": "laranja", "image_url": f"https://cdn.example/{i}.jpg"} for i in range(4)]
    images = [photo(person=False), photo(), photo(arm_in_front=True), photo(cut=True)]
    monkeypatch.setattr(catalog_source, "connect", lambda: None)
    monkeypatch.setattr(catalog_source, "fetch_products", lambda conn, limit, offset, category, sample=True: products[:limit])
    monkeypatch.setattr(catalog_source, "count_products", lambda conn: 14321)
    monkeypatch.setattr(catalog_source, "download",
                        lambda url, **kw: png(images[int(url.rsplit("/", 1)[1].split(".")[0])]))
    monkeypatch.setenv("FAI_API_URL", gpu_url)
    monkeypatch.setenv("FAI_API_KEY", "k" * 64)

    code = catalog_batch.main(["--limit", "4", "--concurrency", "2", "--out", str(tmp_path), "--workers", "3"])

    assert code == 0
    rows = [json.loads(line) for line in (tmp_path / "audit.jsonl").read_text().splitlines()]
    assert sorted(r["class"] for r in rows) == ["COMPLETE_ON_MODEL", "COMPLETE_PRODUCT", "CUT", "OCCLUDED"]
    assert all(r["gpu_seconds"] is not None and r["segmentation"]["mask_score"] == 0.98 for r in rows)
    assert len(list((tmp_path / "cutouts").glob("*.png"))) == 4
    assert len(list((tmp_path / "thumbs").glob("*.jpg"))) == 8
    summary = json.loads((tmp_path / "summary.json").read_text())
    assert summary["reconstruction_share"] == 0.5 and summary["projected_reconstructions"] == 7160
    assert summary["projected_segment_hours"] > 0
    page = (tmp_path / "index.html").read_text()
    assert "Piloto de enquadramento" in page and "50%" in page and "Peça 0" in page


def test_falha_de_download_nao_derruba_o_lote(gpu_url, tmp_path, monkeypatch):
    monkeypatch.setattr(catalog_source, "connect", lambda: None)
    monkeypatch.setattr(catalog_source, "fetch_products", lambda *a, **k: [
        {"id": "ok", "product_name": "ok", "category": "upper_piece", "image_url": "https://cdn.example/0.jpg"},
        {"id": "bad", "product_name": "bad", "category": "upper_piece", "image_url": "https://cdn.example/x.jpg"}])
    monkeypatch.setattr(catalog_source, "count_products", lambda conn: 10)
    monkeypatch.setattr(catalog_source, "download",
                        lambda url, **kw: png(photo(person=False)) if url.endswith("0.jpg") else (_ for _ in ()).throw(ValueError("HTTP 404")))
    monkeypatch.setenv("FAI_API_URL", gpu_url)
    monkeypatch.setenv("FAI_API_KEY", "k" * 64)

    assert catalog_batch.main(["--limit", "2", "--out", str(tmp_path), "--no-cutouts"]) == 0
    rows = [json.loads(line) for line in (tmp_path / "audit.jsonl").read_text().splitlines()]
    failed = next(r for r in rows if r["class"] == "FAILED")
    assert "HTTP 404" in failed["reason"] and not list((tmp_path / "cutouts").glob("*.png"))
    assert json.loads((tmp_path / "summary.json").read_text())["counts"]["FAILED"] == 1


def test_download_recusa_url_privada_ou_nao_http():
    for url in ("http://localhost/x.jpg", "http://10.0.0.5/x.jpg", "file:///etc/passwd", "ftp://host/x.jpg", ""):
        with pytest.raises(ValueError):
            catalog_source.download(url)


def test_projecao_usa_media_real_e_preco_da_gpu():
    rows = [{"class": "COMPLETE_PRODUCT", "gpu_seconds": 2.0}, {"class": "OCCLUDED", "gpu_seconds": 2.0}]
    summary = catalog_report.summarize(rows, 3600, gpu_hour_usd=0.70, workers=1)
    assert summary["mean_gpu_seconds"] == 2.0 and summary["projected_segment_hours"] == 2.0
    assert summary["projected_segment_usd"] == 1.4 and summary["projected_reconstructions"] == 1800
