"""runpod_hunyuan_runner (sem GPU: gerador falso): lê o lote, gera um .glb por produto, grava o manifesto no formato do
import_meshy_glbs.py, registra falhas sem parar o lote, retoma pulando o que já foi gerado e só baixa imagem https."""
import csv
import io
import sys
from pathlib import Path

import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from scripts.catalog import runpod_hunyuan_runner as runner  # noqa: E402

A, B, C = (f"{n}" * 8 + "-1111-4111-8111-" + f"{n}" * 12 for n in "abc")
URL = "https://app.example/media/catalog/flatlay/"


def write_lot(path, rows):
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["product_id", "front_url", "back_url", "category", "motivo"])
        writer.writeheader()
        writer.writerows({"category": "upper_piece", "motivo": "FALTA", **r} for r in rows)
    return path


class Backend:
    def __init__(self, fail=()):
        self.calls, self.fail = [], set(fail)

    def generate(self, front, back, work):
        self.calls.append((front.name, back.name if back else None))
        if any(f in str(work) for f in self.fail):
            raise RuntimeError("CUDA out of memory\n tentou 30 GB")
        work.mkdir(parents=True, exist_ok=True)
        (work / "textured.glb").write_bytes(b"glTF-fake")
        return work / "textured.glb"


def fake_fetch(url, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(url.encode())
    return dest


def ticking():
    t = iter(range(0, 1000, 5))
    return lambda: next(t)


def test_batch_writes_manifest_records_failures_and_resumes(tmp_path):
    lot = runner.read_lot(write_lot(tmp_path / "lote.csv", [
        {"product_id": A, "front_url": URL + "a.jpg", "back_url": URL + "a-back.jpg"},
        {"product_id": B, "front_url": URL + "b.jpg", "back_url": ""},
        {"product_id": C, "front_url": "/media/relativo.jpg", "back_url": ""},     # fora: sem https
    ]))
    out, backend = tmp_path / "out", Backend(fail=[B])
    assert [r["product_id"] for r in lot] == [A, B]
    assert runner.run(lot, out, backend, fetch=fake_fetch, clock=ticking()) == {"gerados": 1, "pulados": 0, "falhas": 1}
    assert backend.calls == [(f"{A}-front", f"{A}-back"), (f"{B}-front", None)]
    manifest = list(csv.DictReader((out / "manifesto.csv").open(encoding="utf-8")))
    assert manifest == [{"product_id": A, "glb": f"glb/{A}.glb", "generator": "hunyuan3d-2.1", "segundos": "5",
                         "vistas": "frente"}]
    assert (out / "glb" / f"{A}.glb").read_bytes() == b"glTF-fake"
    failure = next(csv.DictReader((out / "falhas.csv").open(encoding="utf-8")))
    assert failure == {"product_id": B, "erro": "RuntimeError: CUDA out of memory tentou 30 GB"}
    again = Backend()
    assert runner.run(lot, out, again, fetch=fake_fetch, clock=ticking()) == {"gerados": 1, "pulados": 1, "falhas": 0}
    assert again.calls == [(f"{B}-front", None)]


def test_limit_runs_only_the_first_pending(tmp_path):
    lot = [{"product_id": p, "front_url": URL + "x.jpg", "back_url": ""} for p in (A, B, C)]
    backend = Backend()
    runner.run(lot, tmp_path, backend, fetch=fake_fetch, clock=ticking(), limit=2)
    assert len(backend.calls) == 2


class Response(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def png():
    buffer = io.BytesIO()
    Image.new("RGB", (4, 4), "white").save(buffer, "PNG")
    return buffer.getvalue()


def test_download_accepts_only_https_images_within_size(tmp_path, monkeypatch):
    seen = []
    opener = lambda request, timeout: seen.append(request.full_url) or Response(png())   # noqa: E731
    assert runner.download(URL + "a.png", tmp_path / "a", opener=opener).read_bytes() == png()
    with pytest.raises(ValueError, match="URL_NAO_HTTPS"):
        runner.download("http://app.example/a.png", tmp_path / "b", opener=opener)
    with pytest.raises(Exception):
        runner.download(URL + "c.png", tmp_path / "c", opener=lambda r, timeout: Response(b"<html>"))
    monkeypatch.setattr(runner, "MAX_IMAGE_BYTES", 10)
    with pytest.raises(ValueError, match="IMAGEM_GRANDE_DEMAIS"):
        runner.download(URL + "d.png", tmp_path / "d", opener=opener)
    assert seen == [URL + "a.png", URL + "d.png"] and not (tmp_path / "c").exists()


def test_main_loads_backend_once_and_fails_when_any_product_fails(tmp_path, monkeypatch):
    write_lot(tmp_path / "lote.csv", [{"product_id": A, "front_url": URL + "a.jpg", "back_url": ""}])
    monkeypatch.setattr(runner, "download", fake_fetch)
    made = []
    code = runner.main(["--lot", str(tmp_path / "lote.csv"), "--out", str(tmp_path / "o")],
                       make_backend=lambda repo, seed: made.append(seed) or Backend(fail=[A]))
    assert code == 1 and made == [1234]
