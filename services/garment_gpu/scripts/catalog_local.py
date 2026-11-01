"""Phase 1 of the whole catalogue on THIS machine (Mac with Apple Silicon: FAI_DEVICE=mps), without API, Redis or
Docker. Writes the cut-out, the classification and the list of products that still need Phase 2 (phase2_ids.txt),
so the rented GPU only processes those (`catalog_batch --ids-file phase2_ids.txt`).

READ-ONLY on the catalogue database. Resumable: rerun with the same --out and it skips what is already done.

    cd ~/fashionai && set -a; source ~/fai-catalog.env; set +a
    PYTORCH_ENABLE_MPS_FALLBACK=1 ~/.venv-fai/bin/python -m services.garment_gpu.scripts.catalog_local \\
        --out ~/catalog-fase1
"""
from __future__ import annotations

import argparse
import json
import os
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

from services.garment_gpu import config
from services.garment_gpu.analysis import classify
from services.garment_gpu.image_ops import decode_upload, make_catalog_png
from services.garment_gpu.scripts import catalog_report, catalog_source
from services.garment_gpu.scripts.catalog_batch import thumbnail
from services.garment_gpu.segmentation import SegmentationError

PHASE2_LIST = "phase2_ids.txt"


def load_engine(settings):
    from services.garment_gpu.segmentation import SegmentEngine

    return SegmentEngine(settings)


def fetch(product: dict) -> bytes:
    return catalog_source.prepare_upload(catalog_source.download(product["image_url"]))


def prefetched(products: list[dict], workers: int):
    """Downloads a few photos ahead while the GPU works, without holding the whole catalogue in memory."""
    with ThreadPoolExecutor(max_workers=workers) as pool:
        window: deque = deque()
        for product in products:
            window.append((product, pool.submit(fetch, product)))
            if len(window) > workers * 2:
                yield window.popleft()
        while window:
            yield window.popleft()


def process(product: dict, download, engine, settings, out: Path, keep_full: bool) -> dict:
    row = {"id": product["id"], "name": product.get("product_name"), "category": product.get("category"),
           "class": "FAILED", "metrics": {}}
    try:
        raw = download.result()
        category = catalog_source.CATEGORY_MAP.get(product.get("category"), "auto")
        image = decode_upload(raw, settings.max_pixels).convert("RGB")
        started = time.perf_counter()
        mask, metrics = engine.run(image, category)
        row.update(classify(np.asarray(image), mask, category), gpu_seconds=round(time.perf_counter() - started, 3),
                   segmentation={k: v for k, v in metrics.items()
                                 if k in {"mask_score", "detection_score", "detection_label", "mask_inside_box"}})
        final = make_catalog_png(image, mask, "white")
        if keep_full:
            (out / "cutouts" / f"{product['id']}.png").write_bytes(final)
        row["thumb_in"] = thumbnail(raw, out / "thumbs" / f"{product['id']}-in.jpg")
        row["thumb_out"] = thumbnail(final, out / "thumbs" / f"{product['id']}-out.jpg")
    except SegmentationError as exc:   # deterministic refusal: not retried on resume, goes to human review
        row.update({"class": "REJECTED", "reason": f"{exc.code}: {str(exc)[:120]}"})
    except Exception as exc:  # download or decoding: the batch must not stop
        row["reason"] = f"{type(exc).__name__}: {str(exc)[:120]}"
    return row


def read_audit(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write_outputs(out: Path, rows: list[dict], catalogue_size: int, elapsed: float) -> dict:
    """Last attempt of each product wins (a FAILED row can be retried on a later run)."""
    latest = {row["id"]: row for row in rows}
    rows = list(latest.values())
    phase2 = [row["id"] for row in rows if row.get("needs_reconstruction")]
    (out / PHASE2_LIST).write_text("".join(f"{pid}\n" for pid in phase2), encoding="utf-8")
    summary = catalog_report.summarize(rows, catalogue_size, gpu_hour_usd=0.0, workers=1, elapsed=elapsed)
    summary["phase2_products"] = len(phase2)
    catalog_report.write_report(out, rows, summary)
    return summary


def run(args) -> dict:
    out = args.out
    for sub in ("thumbs", "cutouts"):
        (out / sub).mkdir(parents=True, exist_ok=True)
    settings = config.load({**os.environ, "FAI_DEVICE": args.device})
    conn = catalog_source.connect()
    try:
        catalogue_size = catalog_source.count_products(conn)
        products = catalog_source.fetch_products(conn, args.limit or catalogue_size, args.offset, args.category,
                                                 sample=not args.sequential)
    finally:
        if conn is not None:
            conn.close()
    audit_path = out / "audit.jsonl"
    done = {row["id"] for row in read_audit(audit_path) if row["class"] != "FAILED"}
    pending = [p for p in products if p["id"] not in done]
    print(f"catálogo: {catalogue_size} produtos · neste intervalo: {len(products)} · já feitos: "
          f"{len(products) - len(pending)} · a processar: {len(pending)} · dispositivo: {settings.device}", flush=True)
    engine = load_engine(settings)
    started = time.perf_counter()
    with audit_path.open("a", encoding="utf-8") as audit:
        for count, (product, download) in enumerate(prefetched(pending, args.prefetch), 1):
            row = process(product, download, engine, settings, out, not args.no_cutouts)
            audit.write(json.dumps(row, ensure_ascii=False, default=str) + "\n")
            audit.flush()
            if count % 50 == 0 or count == len(pending):
                rate = count / (time.perf_counter() - started) * 3600
                print(f"  {count}/{len(pending)} · {rate:.0f} fotos/h", flush=True)
    summary = write_outputs(out, read_audit(audit_path), catalogue_size, time.perf_counter() - started)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"lista para a Fase 2: {out / PHASE2_LIST} ({summary['phase2_products']} produtos)")
    return summary


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--limit", type=int, default=0, help="produtos neste intervalo (0 = catálogo inteiro)")
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--category", help="só uma categoria (upper_piece, lower_piece, ...)")
    parser.add_argument("--sequential", action="store_true", help="ordem por id em vez de amostra determinística")
    parser.add_argument("--device", default="mps", choices=("mps", "cpu", "cuda"))
    parser.add_argument("--prefetch", type=int, default=4, help="downloads em paralelo à frente da GPU")
    parser.add_argument("--no-cutouts", action="store_true", help="não guarda os PNGs grandes, só as miniaturas")
    parser.add_argument("--out", type=Path, default=Path("work/catalog-phase1"))
    summary = run(parser.parse_args(argv))
    return 0 if summary["total"] and summary["counts"].get("FAILED", 0) < summary["total"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
