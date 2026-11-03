"""Batch safety for the paid Phase 2 run: the Phase 2 list goes in mode=reconstruct (a downed worker is a visible
failure, not a silent Phase 1 cut-out), every product to redo lands in retry_ids.txt, the audit survives an
interrupted batch and a wrong FAI_API_URL stops the batch before the first product."""
import json
import socket
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from services.garment_gpu.scripts import catalog_batch, catalog_report, catalog_source
from services.garment_gpu.tests.support import png
from services.garment_gpu.tests.test_catalog_batch import FakeGpu, gpu_url, photo  # noqa: F401 (fixture)

PRODUCTS = [{"id": "produto", "product_name": "Blusa", "category": "upper_piece", "image_url": "https://cdn.example/0.jpg"},
            {"id": "vestida", "product_name": "Camisa", "category": "upper_piece", "image_url": "https://cdn.example/1.jpg"}]


@pytest.fixture
def catalogue(gpu_url, monkeypatch, tmp_path):
    images = [photo(person=False), photo()]
    monkeypatch.setattr(catalog_source, "connect", lambda: None)
    monkeypatch.setattr(catalog_source, "fetch_products", lambda *a, **k: PRODUCTS)
    monkeypatch.setattr(catalog_source, "fetch_by_ids", lambda conn, ids: [p for p in PRODUCTS if p["id"] in ids])
    monkeypatch.setattr(catalog_source, "count_products", lambda conn: 2)
    monkeypatch.setattr(catalog_source, "download",
                        lambda url, **kw: png(images[int(url.rsplit("/", 1)[1].split(".")[0])]))
    monkeypatch.setenv("FAI_API_URL", gpu_url)
    monkeypatch.setenv("FAI_API_KEY", "k" * 64)
    ids = tmp_path / "phase2_ids.txt"
    ids.write_text("produto\nvestida\n")
    return {"ids": str(ids), "out": tmp_path / "out"}


def audit(out):
    return {r["id"]: r for r in map(json.loads, (out / "audit.jsonl").read_text().splitlines())}


def test_lista_da_fase_2_vai_em_modo_reconstruct_e_auto_explicito_continua_valendo(catalogue):
    assert catalog_batch.main(["--ids-file", catalogue["ids"], "--out", str(catalogue["out"])]) == 0
    assert FakeGpu.modes == ["reconstruct", "reconstruct"]
    assert all(r["output"] == "generative_reconstruction_requires_review" for r in audit(catalogue["out"]).values())
    FakeGpu.modes.clear()
    catalog_batch.main(["--ids-file", catalogue["ids"], "--mode", "auto", "--out", str(catalogue["out"] / "b")])
    assert FakeGpu.modes == ["auto", "auto"]


def test_worker_da_fase_2_fora_do_ar_vira_falha_visivel_e_lista_para_refazer(catalogue, capsys):
    FakeGpu.reconstruct_alive = False
    assert catalog_batch.main(["--ids-file", catalogue["ids"], "--out", str(catalogue["out"])]) == 1
    rows = audit(catalogue["out"])
    assert all(r["class"] == "FAILED" and "RECONSTRUCT_UNAVAILABLE" in r["reason"] for r in rows.values())
    assert (catalogue["out"] / "retry_ids.txt").read_text().split() == ["produto", "vestida"]
    assert json.loads((catalogue["out"] / "summary.json").read_text())["retry"] == 2
    assert "2 produto(s) para refazer" in capsys.readouterr().out
    assert "para refazer: 2" in (catalogue["out"] / "index.html").read_text()


def test_no_modo_auto_o_recorte_sem_fase_2_tambem_vai_para_refazer(catalogue):
    FakeGpu.reconstruct_alive = False
    assert catalog_batch.main(["--limit", "2", "--concurrency", "1", "--out", str(catalogue["out"])]) == 0
    rows = audit(catalogue["out"])
    assert rows["vestida"]["output"] == "needs_reconstruction_unavailable" and rows["produto"]["output"] == "flat_product"
    assert (catalogue["out"] / "retry_ids.txt").read_text() == "vestida\n"   # foto de produto não precisa da Fase 2


def test_lote_sem_nada_para_refazer_deixa_a_lista_vazia(catalogue):
    catalog_batch.main(["--ids-file", catalogue["ids"], "--out", str(catalogue["out"])])
    assert (catalogue["out"] / "retry_ids.txt").read_text() == ""


def test_auditoria_sobrevive_a_um_lote_interrompido(catalogue, monkeypatch):
    def crash(*a, **k):
        raise KeyboardInterrupt

    monkeypatch.setattr(catalog_report, "write_report", crash)
    with pytest.raises(KeyboardInterrupt):
        catalog_batch.main(["--ids-file", catalogue["ids"], "--out", str(catalogue["out"])])
    assert set(audit(catalogue["out"])) == {"produto", "vestida"}   # antes ficava vazia até o fim do lote


def closed_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class NotOurApi(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):   # como o proxy do RunPod com a porta não exposta: 404 sem corpo
        self.send_response(404)
        self.send_header("Content-Length", "0")
        self.end_headers()


def test_url_errada_para_o_lote_antes_do_primeiro_produto(catalogue, monkeypatch):
    monkeypatch.setattr(catalog_source, "connect", lambda: pytest.fail("não deve nem abrir o banco"))
    monkeypatch.setenv("FAI_API_URL", f"http://127.0.0.1:{closed_port()}")
    with pytest.raises(SystemExit, match="API não respondeu"):
        catalog_batch.main(["--limit", "2", "--out", str(catalogue["out"])])
    server = HTTPServer(("127.0.0.1", 0), NotOurApi)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    monkeypatch.setenv("FAI_API_URL", f"http://127.0.0.1:{server.server_port}")
    try:
        with pytest.raises(SystemExit, match="HTTP 404.*não é a API do FashionAI"):
            catalog_batch.main(["--limit", "2", "--out", str(catalogue["out"])])
    finally:
        server.shutdown()


def test_auditoria_registra_a_linha_de_catalog_images_de_cada_resultado(catalogue, monkeypatch):
    rows = [{**p, "image_id": f"img-{p['id']}", "image_version": 3, "original_url": f"https://loja.example/{p['id']}.jpg",
             "source_sha256": "a" * 64} for p in PRODUCTS]
    monkeypatch.setattr(catalog_source, "fetch_by_ids", lambda conn, ids: [r for r in rows if r["id"] in ids])
    monkeypatch.setattr(catalog_source, "download", lambda url, **kw: (_ for _ in ()).throw(OSError("404"))
                        if "1.jpg" in url else png(photo()))
    catalog_batch.main(["--ids-file", catalogue["ids"], "--out", str(catalogue["out"])])
    got = audit(catalogue["out"])
    assert got["produto"]["image_id"] == "img-produto" and got["produto"]["image_version"] == 3
    assert got["produto"]["original_url"] == "https://loja.example/produto.jpg"
    assert got["produto"]["photo_url"] == "https://cdn.example/0.jpg" and got["produto"]["source_sha256"] == "a" * 64
    assert got["vestida"]["class"] == "FAILED" and got["vestida"]["image_id"] == "img-vestida"   # falha também


def test_consulta_do_catalogo_devolve_a_identidade_da_imagem():
    for column in ("i.id AS image_id", "i.version AS image_version", "i.image_url AS original_url", "i.source_sha256"):
        assert column in catalog_source.SELECT
    assert catalog_source.image_ref({"image_url": "u"}) == {"image_id": None, "image_version": None,
                                                            "original_url": None, "source_sha256": None, "photo_url": "u"}
