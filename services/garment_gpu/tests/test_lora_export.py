import json

import numpy as np
from PIL import Image

from services.garment_gpu.scripts.export_lora_dataset import eligible, export
from services.garment_gpu.storage import MemoryStore
from services.garment_gpu.tests.support import person_photo, png


def seed_job(store, job_id, review, verdict):
    photo = person_photo()
    mask = np.zeros((photo.height, photo.width), np.uint8)
    mask[60:240, 50:190] = 255
    keys = {"input": f"jobs/{job_id}/input.png", "mask": f"jobs/{job_id}/mask.png",
            "reconstructed": f"jobs/{job_id}/reconstructed.png"}
    store.put(keys["input"], png(photo), "image/png")
    store.put(keys["mask"], png(Image.fromarray(mask)), "image/png")
    store.put(keys["reconstructed"], png(Image.new("RGB", (64, 96), (255, 255, 255))), "image/png")
    meta = {"job_id": job_id, "category": "upper_piece", "artifacts": keys, "review": {"status": review, "by": "curadoria"},
            "quality": {"verdict": verdict, "score": 0.8}, "reconstruction": {"prompt": f"prompt {job_id}"}}
    store.put(f"jobs/{job_id}/metadata.json", json.dumps(meta).encode(), "application/json")
    return meta


def test_so_reconstrucoes_aprovadas_por_pessoa_e_qa_entram_no_dataset(tmp_path):
    store = MemoryStore()
    seed_job(store, "a" * 32, "approved", "pass")
    seed_job(store, "b" * 32, "approved", "warn")
    seed_job(store, "c" * 32, "pending", "pass")
    seed_job(store, "d" * 32, "rejected", "pass")
    assert export(store, tmp_path) == 1
    rows = [json.loads(line) for line in (tmp_path / "manifest.jsonl").read_text().splitlines()]
    assert rows[0]["id"] == "a" * 32 and rows[0]["reviewed_by"] == "curadoria"
    assert (tmp_path / "control_1" / f"{'a' * 32}.png").exists() and (tmp_path / "control_2" / f"{'a' * 32}.png").exists()
    assert (tmp_path / "target" / f"{'a' * 32}.txt").read_text() == f"prompt {'a' * 32}"
    assert export(store, tmp_path / "warn", include_warn=True) == 2
    assert not eligible({"review": {"status": "approved"}, "quality": {"verdict": "pass"}, "artifacts": {}}, False)
