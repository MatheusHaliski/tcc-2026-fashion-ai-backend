"""Runs the REAL segmentation engine (Grounding DINO + SAM 2.1 weights) on one photo, without Redis/S3.

Validates the weights and the transformers API before a GPU is rented — on CPU it takes seconds per photo:
    FAI_DEVICE=cpu python -m services.garment_gpu.scripts.smoke_segment foto.jpg --category upper_piece --out work/smoke
On the GPU server (inside the worker container) leave FAI_DEVICE=cuda."""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from services.garment_gpu import config
from services.garment_gpu.image_ops import decode_upload, make_catalog_png, make_cutout_png, mask_png
from services.garment_gpu.segmentation import SegmentEngine, SegmentationError


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("image", type=Path, nargs="+")
    parser.add_argument("--category", default="upper_piece")
    parser.add_argument("--out", type=Path, default=Path("work/garment-smoke"))
    args = parser.parse_args(argv)
    settings = config.load()
    t0 = time.perf_counter()
    engine = SegmentEngine(settings)
    print(json.dumps({"event": "models_loaded", "seconds": round(time.perf_counter() - t0, 1), **engine.models}))
    args.out.mkdir(parents=True, exist_ok=True)
    failures = 0
    for path in args.image:
        image = decode_upload(path.read_bytes(), settings.max_pixels)
        t1 = time.perf_counter()
        try:
            mask, metrics = engine.run(image, args.category)
        except SegmentationError as exc:
            failures += 1
            print(json.dumps({"image": path.name, "error": exc.code, "message": str(exc)}, ensure_ascii=False))
            continue
        stem = args.out / path.stem
        stem.with_name(f"{path.stem}-mask.png").write_bytes(mask_png(mask))
        stem.with_name(f"{path.stem}-catalog.png").write_bytes(make_catalog_png(image, mask, "white"))
        stem.with_name(f"{path.stem}-cutout.png").write_bytes(make_cutout_png(image, mask))
        print(json.dumps({"image": path.name, "seconds": round(time.perf_counter() - t1, 2), **metrics}, ensure_ascii=False))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
