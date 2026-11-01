"""Phase 1 on the Mac (catalog_local): classification, Phase 2 list, resume; and the batch restricted to that list."""
import json

import numpy as np
import pytest

from services.garment_gpu import config
from services.garment_gpu.scripts import catalog_batch, catalog_local, catalog_source
from services.garment_gpu.segmentation import SegmentationError
from services.garment_gpu.tests.support import png
from services.garment_gpu.tests.test_catalog_batch import garment_mask, gpu_url, photo  # noqa: F401 (fixture)


class MaskEngine:
    """Stands in for Grounding DINO + SAM: the orange garment is the mask; product 'x' has nothing to detect."""

    def __init__(self):
        self.calls = 0

    def run(self, image, category):
        self.calls += 1
        mask = garment_mask(image)
        if not mask.any():
            raise SegmentationError("NO_GARMENT_DETECTED", "nada")
        return mask.astype(np.uint8), {"mask_score": 0.97, "detection_label": "t-shirt"}


@pytest.fixture
def catalogue(monkeypatch):
    images = {"p0": photo(person=False), "p1": photo(), "p2": photo(arm_in_front=True), "p3": photo(cut=True)}
    blank = photo(person=False)
    blank.paste((235, 235, 235), (0, 0, *blank.size))
    images["x"] = blank
    products = [{"id": pid, "product_name": pid, "category": "upper_piece", "image_url": f"https://cdn.example/{pid}.png"}
                for pid in images]
    monkeypatch.setattr(catalog_source, "connect", lambda: None)
    monkeypatch.setattr(catalog_source, "count_products", lambda conn: 14321)
    monkeypatch.setattr(catalog_source, "fetch_products", lambda conn, limit, offset, category, sample=True: products[:limit])
    monkeypatch.setattr(catalog_source, "download", lambda url, **kw: png(images[url.rsplit("/", 1)[1][:-4]]))
    engine = MaskEngine()
    monkeypatch.setattr(catalog_local, "load_engine", lambda settings: engine)
    return engine


def test_fase1_local_gera_lista_da_fase2_e_retoma_sem_refazer(catalogue, tmp_path):
    assert catalog_local.main(["--device", "cpu", "--out", str(tmp_path)]) == 0
    rows = {r["id"]: r for r in map(json.loads, (tmp_path / "audit.jsonl").read_text().splitlines())}
    assert {pid: r["class"] for pid, r in rows.items()} == {
        "p0": "COMPLETE_PRODUCT", "p1": "COMPLETE_ON_MODEL", "p2": "OCCLUDED", "p3": "CUT", "x": "REJECTED"}
    assert (tmp_path / catalog_local.PHASE2_LIST).read_text().split() == ["p1", "p2", "p3"]
    assert len(list((tmp_path / "cutouts").glob("*.png"))) == 4
    summary = json.loads((tmp_path / "summary.json").read_text())
    assert summary["phase2_products"] == 3 and summary["reconstruction_share"] == 0.6
    calls = catalogue.calls

    assert catalog_local.main(["--device", "cpu", "--out", str(tmp_path)]) == 0   # retomada: nada a refazer
    assert catalogue.calls == calls
    assert (tmp_path / catalog_local.PHASE2_LIST).read_text().split() == ["p1", "p2", "p3"]


def test_mps_so_para_a_fase1():
    assert config.load({"FAI_DEVICE": "mps"}).device == "mps"
    for env in ({"FAI_DEVICE": "mps", "RECON_QUANTIZE": "nf4"}, {"FAI_DEVICE": "mps", "RECON_OFFLOAD": "model"},
                {"FAI_DEVICE": "tpu"}):
        with pytest.raises(ValueError):
            config.load(env)


def test_busca_por_ids_mantem_a_ordem_da_lista():
    class Cursor:
        def __init__(self, log):
            self.log = log

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def execute(self, sql, params):
            self.log.append((sql, params))
            self.rows = [{"id": pid} for pid in sorted(params["ids"])]

        def fetchall(self):
            return self.rows

    class Conn:
        log: list = []

        def cursor(self):
            return Cursor(self.log)

    rows = catalog_source.fetch_by_ids(Conn(), ["c", "a", "b"], chunk=2)
    assert [r["id"] for r in rows] == ["c", "a", "b"]
    assert len(Conn.log) == 2 and "p.id IN %(ids)s" in Conn.log[0][0] and Conn.log[0][1]["ids"] == ("c", "a")


def test_lote_da_gpu_so_com_a_lista_da_fase2(gpu_url, tmp_path, monkeypatch):  # noqa: F811
    images = {"p1": photo(), "p3": photo(cut=True)}
    seen = []

    def by_ids(conn, ids):
        seen.extend(ids)
        return [{"id": pid, "product_name": pid, "category": "upper_piece", "image_url": f"https://cdn.example/{pid}.png"}
                for pid in ids]

    monkeypatch.setattr(catalog_source, "connect", lambda: None)
    monkeypatch.setattr(catalog_source, "count_products", lambda conn: 14321)
    monkeypatch.setattr(catalog_source, "fetch_by_ids", by_ids)
    monkeypatch.setattr(catalog_source, "fetch_products", lambda *a, **k: pytest.fail("não deve varrer o catálogo"))
    monkeypatch.setattr(catalog_source, "download", lambda url, **kw: png(images[url.rsplit("/", 1)[1][:-4]]))
    monkeypatch.setenv("FAI_API_URL", gpu_url)
    monkeypatch.setenv("FAI_API_KEY", "k" * 64)
    ids = tmp_path / "phase2_ids.txt"
    ids.write_text("p1\np3\n\n")

    assert catalog_batch.main(["--ids-file", str(ids), "--limit", "5", "--out", str(tmp_path / "out")]) == 0
    assert seen == ["p1", "p3"]
    rows = (tmp_path / "out" / "audit.jsonl").read_text().splitlines()
    assert len(rows) == 2
