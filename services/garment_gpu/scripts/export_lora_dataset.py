"""Exports human-approved reconstructions as an image-edit training set for a garment LoRA (Phase 3).

Each sample = control images (segmented cut-out on white + original photo) → target (approved catalogue image) + the
prompt actually used. Only jobs with review.status == approved AND QA verdict pass are exported (QA warn with
--include-warn). The folder layout (control_1/, control_2/, target/, *.txt captions, manifest.jsonl) is accepted, with
small path mapping, by the common Qwen-Image-Edit LoRA trainers (e.g. DiffSynth-Studio, ostris ai-toolkit).

    python -m services.garment_gpu.scripts.export_lora_dataset --out work/lora-dataset [--include-warn] [--limit 500]

Train only on images whose rights you hold (your photos or brand material licensed for training)."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from services.garment_gpu import config
from services.garment_gpu.image_ops import make_catalog_png, open_png
from services.garment_gpu.storage import S3Store


def eligible(meta: dict, include_warn: bool) -> bool:
    verdicts = {"pass", "warn"} if include_warn else {"pass"}
    return (meta.get("review", {}).get("status") == "approved"
            and meta.get("quality", {}).get("verdict") in verdicts
            and "reconstructed" in meta.get("artifacts", {}))


def export(store, out: Path, include_warn: bool = False, limit: int = 0) -> int:
    for sub in ("control_1", "control_2", "target"):
        (out / sub).mkdir(parents=True, exist_ok=True)
    count = 0
    with (out / "manifest.jsonl").open("w", encoding="utf-8") as manifest:
        for key in store.list_prefix("jobs/"):
            if not key.endswith("/metadata.json"):
                continue
            meta = json.loads(store.get(key))
            if not eligible(meta, include_warn):
                continue
            job_id, artifacts = meta["job_id"], meta["artifacts"]
            original = open_png(store.get(artifacts["input"])).convert("RGB")
            mask = (np.asarray(open_png(store.get(artifacts["mask"])).convert("L")) > 127).astype(np.uint8)
            (out / "control_1" / f"{job_id}.png").write_bytes(make_catalog_png(original, mask, "white"))
            original.save(out / "control_2" / f"{job_id}.png")
            (out / "target" / f"{job_id}.png").write_bytes(store.get(artifacts["reconstructed"]))
            prompt = meta.get("reconstruction", {}).get("prompt", "")
            (out / "target" / f"{job_id}.txt").write_text(prompt, encoding="utf-8")
            manifest.write(json.dumps({"id": job_id, "category": meta.get("category"), "prompt": prompt,
                                       "control": [f"control_1/{job_id}.png", f"control_2/{job_id}.png"],
                                       "target": f"target/{job_id}.png", "qa": meta.get("quality", {}).get("score"),
                                       "reviewed_by": meta.get("review", {}).get("by")}, ensure_ascii=False) + "\n")
            count += 1
            if limit and count >= limit:
                break
    return count


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--include-warn", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args(argv)
    total = export(S3Store(config.load()), args.out, args.include_warn, args.limit)
    print(json.dumps({"exported": total, "out": str(args.out)}))
    return 0 if total else 1


if __name__ == "__main__":
    raise SystemExit(main())
