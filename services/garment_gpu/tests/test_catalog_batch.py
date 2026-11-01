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
from services.garment_gpu.analysis import classify
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
    """Mimics /v1/garments: one job, then segmented (cut-out) and mask; worn photos (skin) also get the Phase 2
    back view, announced in the job's `images` like the real API does."""

    jobs: dict = {}
    broken_back = False

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
        FakeGpu.jobs[job_id] = {"mask": png(Image.fromarray((mask * 255).astype(np.uint8))), "final": png(cutout)}
        if (np.asarray(rgb) == SKIN).all(-1).any():
            FakeGpu.jobs[job_id]["reconstructed_back"] = png(Image.new("RGB", (60, 90), (10, 20, 200)))
        self._send(202, {"job_id": job_id, "status": "queued"})

    def do_GET(self):
        job_id = self.path.split("/v1/jobs/")[1].split("/")[0].split("?")[0]
        job = self.jobs[job_id]
        if "/image" in self.path:
            variant = self.path.split("variant=")[1]
            if variant == "reconstructed_back" and self.broken_back:
                return self._send(410, {"detail": {"code": "EXPIRED", "message": "Imagem expirada"}})
            return self._send(200, job[variant], "image/png")
        body = {"job_id": job_id, "status": "completed", "images": {name: "/..." for name in job},
                "segmentation": {"mask_score": 0.98, "detection_label": "t-shirt"}}
        if "reconstructed_back" in job:
            body["reconstruction"] = {"back": {"inferred": True, "quality": {"verdict": "warn"}}}
        self._send(200, body)

    def do_DELETE(self):
        self._send(204, b"")


@pytest.fixture
def gpu_url():
    server = HTTPServer(("127.0.0.1", 0), FakeGpu)
    FakeGpu.jobs = {}
    FakeGpu.broken_back = False
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
    assert len(list((tmp_path / "thumbs").glob("*.jpg"))) == 8 + 3   # + costas das 3 fotos com pessoa
    summary = json.loads((tmp_path / "summary.json").read_text())
    # vestida, ocluída e cortada vão para a Fase 2 (critério do #429): 3 de 4
    assert summary["reconstruction_share"] == 0.75 and summary["projected_reconstructions"] == 10741
    assert summary["projected_segment_hours"] > 0
    page = (tmp_path / "index.html").read_text()
    assert "Piloto de enquadramento" in page and "75%" in page and "Peça 0" in page


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


def test_projecao_usa_vazao_medida_e_nao_a_latencia():
    # 2 fotos em 2 s de relógio = 3600 fotos/h, embora cada uma leve 10 s (fila com várias em voo)
    rows = [{"class": "COMPLETE_PRODUCT", "gpu_seconds": 10.0}, {"class": "OCCLUDED", "gpu_seconds": 10.0}]
    summary = catalog_report.summarize(rows, 3600, gpu_hour_usd=0.70, workers=1, elapsed=2.0)
    assert summary["photos_per_hour"] == 3600 and summary["mean_gpu_seconds"] == 10.0
    assert summary["projected_segment_hours"] == 1.0 and summary["projected_segment_usd"] == 0.7
    assert summary["projected_reconstructions"] == 1800
    assert catalog_report.summarize(rows, 3600, 0.70, workers=3, elapsed=2.0)["projected_segment_hours"] == 0.3
    assert catalog_report.summarize(rows, 3600, 0.70, workers=1)["photos_per_hour"] is None


def test_miniaturas_apontam_para_a_subpasta_thumbs(tmp_path):
    (tmp_path / "thumbs").mkdir()
    name = catalog_batch.thumbnail(png(photo()), tmp_path / "thumbs" / "x.jpg")
    assert name == "thumbs/x.jpg" and (tmp_path / name).exists()


def test_erro_da_api_mostra_o_codigo_e_nao_so_o_status():
    class Response:
        status_code = 422

        @staticmethod
        def json():
            return {"detail": {"code": "INVALID_IMAGE", "message": "Envie JPG, PNG ou WEBP"}}

    assert catalog_batch.api_error(Response()) == "INVALID_IMAGE: Envie JPG, PNG ou WEBP"

    class Plain(Response):
        status_code = 503

        @staticmethod
        def json():
            raise ValueError("sem corpo")

    assert catalog_batch.api_error(Plain()) == "HTTP 503"


def test_download_codifica_url_com_acento(monkeypatch):
    seen = {}

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        @staticmethod
        def read(n):
            return b"x" * 10

    def opener(request, timeout=None):
        seen["url"] = request.full_url
        return FakeResponse()

    catalog_source.download("https://cdn.example/catálogo/peça ©.jpg", opener=opener)
    assert seen["url"] == "https://cdn.example/cat%C3%A1logo/pe%C3%A7a%20%C2%A9.jpg"
    assert seen["url"].isascii()


def _encoded(image, fmt, **kw):
    buf = io.BytesIO()
    image.save(buf, fmt, **kw)
    return buf.getvalue()


def test_prepara_foto_grande_ou_em_formato_recusado_pela_api():
    small = _encoded(Image.new("RGB", (40, 30), ORANGE), "JPEG")
    assert catalog_source.prepare_upload(small) is small            # já dentro do contrato: intocada

    big = _encoded(Image.new("RGB", (400, 300), ORANGE), "JPEG")
    with Image.open(io.BytesIO(catalog_source.prepare_upload(big, max_pixels=30_000))) as out:
        assert out.format == "JPEG" and out.width * out.height <= 30_000
        assert abs(out.width / out.height - 4 / 3) < 0.02            # sem distorcer

    gif = _encoded(Image.new("P", (40, 30)), "GIF", transparency=0)
    with Image.open(io.BytesIO(catalog_source.prepare_upload(gif))) as out:
        assert out.format == "PNG" and out.mode == "RGBA"            # transparência preservada

    with pytest.raises(ValueError, match="FORMATO_NAO_SUPORTADO"):
        catalog_source.prepare_upload(b"<html>not an image</html>")


def test_prepara_foto_girada_pelo_exif_sem_distorcer():
    exif = Image.Exif()
    exif[0x0112] = 6                                                  # câmera de pé: girar 90°
    rotated = _encoded(Image.new("RGB", (400, 300), ORANGE), "JPEG", exif=exif)
    with Image.open(io.BytesIO(catalog_source.prepare_upload(rotated, max_pixels=30_000))) as out:
        assert out.width < out.height and abs(out.height / out.width - 4 / 3) < 0.02


def test_prepara_foto_pesada_cabe_no_limite_de_bytes_da_api():
    noise = Image.fromarray(np.random.default_rng(0).integers(0, 256, (300, 300, 4), dtype=np.uint8), "RGBA")
    tiff = _encoded(noise, "TIFF")
    out = catalog_source.prepare_upload(tiff, max_bytes=60_000)
    assert len(out) <= 60_000
    with Image.open(io.BytesIO(out)) as image:
        assert image.format == "PNG" and image.width == image.height     # menor, mas sem distorcer
    big_jpeg = _encoded(Image.fromarray(np.asarray(noise)[..., :3]), "JPEG", quality=100)
    assert len(catalog_source.prepare_upload(big_jpeg, max_bytes=len(big_jpeg) - 1)) < len(big_jpeg)


def lote_de_duas(gpu_url, monkeypatch):
    products = [{"id": "produto", "product_name": "Blusa", "category": "upper_piece", "image_url": "https://cdn.example/0.jpg"},
                {"id": "vestida", "product_name": "Camisa", "category": "upper_piece", "image_url": "https://cdn.example/1.jpg"}]
    images = [photo(person=False), photo()]
    monkeypatch.setattr(catalog_source, "connect", lambda: None)
    monkeypatch.setattr(catalog_source, "fetch_products", lambda *a, **k: products)
    monkeypatch.setattr(catalog_source, "count_products", lambda conn: 2)
    monkeypatch.setattr(catalog_source, "download",
                        lambda url, **kw: png(images[int(url.rsplit("/", 1)[1].split(".")[0])]))
    monkeypatch.setenv("FAI_API_URL", gpu_url)
    monkeypatch.setenv("FAI_API_KEY", "k" * 64)


def test_costas_da_fase_2_sao_baixadas_antes_de_apagar_o_job(gpu_url, tmp_path, monkeypatch):
    lote_de_duas(gpu_url, monkeypatch)

    assert catalog_batch.main(["--limit", "2", "--concurrency", "1", "--out", str(tmp_path)]) == 0

    rows = {r["id"]: r for r in map(json.loads, (tmp_path / "audit.jsonl").read_text().splitlines())}
    assert [p.name for p in (tmp_path / "backs").glob("*.png")] == ["vestida.png"]
    with Image.open(tmp_path / "backs" / "vestida.png") as back:
        assert back.getpixel((5, 5))[:3] == (10, 20, 200)
    assert rows["vestida"]["thumb_back"] == "thumbs/vestida-back.jpg" and rows["vestida"]["back_quality"] == "warn"
    assert "thumb_back" not in rows["produto"]   # foto de produto termina na Fase 1: não há costas
    assert json.loads((tmp_path / "summary.json").read_text())["backs_saved"] == 1
    page = (tmp_path / "index.html").read_text()
    assert "thumbs/vestida-back.jpg" in page and "costas: warn" in page and "costas guardadas: 1" in page


def test_sem_cutouts_guarda_so_a_miniatura_das_costas(gpu_url, tmp_path, monkeypatch):
    lote_de_duas(gpu_url, monkeypatch)
    catalog_batch.main(["--limit", "2", "--no-cutouts", "--out", str(tmp_path)])
    assert not list((tmp_path / "backs").glob("*.png")) and (tmp_path / "thumbs" / "vestida-back.jpg").exists()


def test_erro_ao_baixar_as_costas_nao_vira_png_falso(gpu_url, tmp_path, monkeypatch):
    lote_de_duas(gpu_url, monkeypatch)
    FakeGpu.broken_back = True
    catalog_batch.main(["--limit", "2", "--concurrency", "1", "--out", str(tmp_path)])
    rows = {r["id"]: r for r in map(json.loads, (tmp_path / "audit.jsonl").read_text().splitlines())}
    assert rows["vestida"]["class"] == "FAILED" and "EXPIRED" in rows["vestida"]["reason"]
    assert rows["produto"]["class"] == "COMPLETE_PRODUCT" and not list((tmp_path / "backs").glob("*"))
