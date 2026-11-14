"""runpod_hunyuan_runner (sem GPU: pipelines falsas): forma (frente + costas) e textura em etapas separadas, manifesto
no formato do import_meshy_glbs.py, falhas sem parar o lote, retomada sem refazer etapa e download só de imagem https."""
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


class Shape:
    def __init__(self, fail=()):
        self.calls, self.fail = [], set(fail)

    def generate(self, views, work):
        self.calls.append({k: v.name for k, v in views.items()})
        if any(f in str(work) for f in self.fail):
            raise RuntimeError("CUDA out of memory\n tentou 30 GB")
        work.mkdir(parents=True, exist_ok=True)
        (work / "front_rgba.png").write_bytes(b"png")
        (work / "white.obj").write_bytes(b"o mesh")
        return work / "white.obj"


class Paint:
    def __init__(self, empty=()):
        self.calls, self.empty = [], set(empty)

    def generate(self, work):
        self.calls.append(work.name)
        (work / "textured.glb").write_bytes(b"" if work.name in self.empty else b"glTF-fake")
        return work / "textured.glb"


def fake_fetch(url, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(url.encode())
    return dest


def ticking():
    t = iter(range(0, 1000, 5))
    return lambda: next(t)


def test_two_stages_write_manifest_record_failures_and_resume(tmp_path):
    lot = runner.read_lot(write_lot(tmp_path / "lote.csv", [
        {"product_id": A, "front_url": URL + "a.jpg", "back_url": URL + "a-back.jpg"},
        {"product_id": B, "front_url": URL + "b.jpg", "back_url": ""},
        {"product_id": C, "front_url": "/media/relativo.jpg", "back_url": ""},     # fora: sem https
    ]))
    out, shape = tmp_path / "out", Shape(fail=[B])
    assert [r["product_id"] for r in lot] == [A, B]
    assert runner.run("shape", lot, out, shape, fetch=fake_fetch, clock=ticking()) == {
        "feitos": 1, "falhas": 1, "pendentes": 2}
    assert shape.calls == [{"front": f"{A}-front", "back": f"{A}-back"}, {"front": f"{B}-front"}]
    failure = next(csv.DictReader((out / "falhas.csv").open(encoding="utf-8")))
    assert failure == {"product_id": B, "etapa": "shape", "erro": "RuntimeError: CUDA out of memory tentou 30 GB"}
    paint = Paint()
    assert runner.run("paint", lot, out, paint, fetch=fake_fetch, clock=ticking())["feitos"] == 1
    assert paint.calls == [A]                                                   # B ainda não tem forma
    manifest = list(csv.DictReader((out / "manifesto.csv").open(encoding="utf-8")))
    assert manifest == [{"product_id": A, "glb": f"glb/{A}.glb", "generator": "hunyuan3d-2mv+2.1", "segundos": "10.0",
                         "vistas": "frente+costas"}]
    assert (out / "glb" / f"{A}.glb").read_bytes() == b"glTF-fake"
    again = Shape()
    assert runner.run("shape", lot, out, again, fetch=fake_fetch, clock=ticking())["feitos"] == 1
    assert again.calls == [{"front": f"{B}-front"}]                              # A não volta
    assert runner.run("paint", lot, out, Paint(), fetch=fake_fetch, clock=ticking())["feitos"] == 1
    rows = list(csv.DictReader((out / "manifesto.csv").open(encoding="utf-8")))
    assert [(r["product_id"], r["vistas"]) for r in rows] == [(A, "frente+costas"), (B, "frente")]


def test_empty_glb_is_a_failure_and_limit_caps_the_stage(tmp_path):
    lot = [{"product_id": p, "front_url": URL + "x.jpg", "back_url": ""} for p in (A, B, C)]
    runner.run("shape", lot, tmp_path, Shape(), fetch=fake_fetch, clock=ticking(), limit=2)
    assert runner.pending("paint", lot, tmp_path) == lot[:2]
    counts = runner.run("paint", lot, tmp_path, Paint(empty=[A]), fetch=fake_fetch, clock=ticking())
    assert counts == {"feitos": 1, "falhas": 1, "pendentes": 2} and not (tmp_path / "glb" / f"{A}.glb").exists()


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


def test_main_loads_the_stage_backend_once_and_fails_when_any_product_fails(tmp_path, monkeypatch):
    write_lot(tmp_path / "lote.csv", [{"product_id": A, "front_url": URL + "a.jpg", "back_url": ""}])
    monkeypatch.setattr(runner, "download", fake_fetch)
    made = []
    code = runner.main(["--stage", "shape", "--lot", str(tmp_path / "lote.csv"), "--out", str(tmp_path / "o")],
                       make_backend=lambda stage, repo, seed: made.append((stage, repo, seed)) or Shape(fail=[A]))
    assert code == 1 and made == [("shape", runner.REPOS["shape"], 1234)]
