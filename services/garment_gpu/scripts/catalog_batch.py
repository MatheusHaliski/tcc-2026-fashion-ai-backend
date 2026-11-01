"""Catalogue batch on our own GPU: for each product, send its photo to the private API, keep the full-frame cut-out
and classify whether the garment is already complete or needs generative reconstruction (Phase 2).

READ-ONLY on the catalogue database: it never writes to MySQL. Results go to --out (PNGs, audit JSONL and an HTML
report). The pilot measures the real reconstruction share, which is what drives the A100 cost.

    FAI_API_URL=https://... FAI_API_KEY=... MYSQL_HOST=... MYSQL_PASSWORD=... \\
      python -m services.garment_gpu.scripts.catalog_batch --limit 200 --out work/catalog-pilot
"""
from __future__ import annotations

import argparse
import io
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image

from services.garment_gpu.scripts import catalog_report, catalog_source
from services.garment_gpu.analysis import classify

THUMB = (320, 420)


def api_error(response) -> str:
    """The API's own error code/message; the bare HTTP status does not say what the photo did wrong."""
    try:
        detail = response.json().get("detail")
    except ValueError:
        detail = None
    if isinstance(detail, dict):
        return f"{detail.get('code', response.status_code)}: {detail.get('message', '')}".strip(": ")
    return f"HTTP {response.status_code}"


class GpuClient:
    """Submits a photo, polls the job and downloads the cut-out and its mask."""

    def __init__(self, base_url: str, api_key: str, timeout: int = 300, poll: float = 2.0):
        self.base, self.key, self.timeout, self.poll = base_url.rstrip("/"), api_key, timeout, poll

    def _session(self):
        import requests

        session = requests.Session()
        session.headers["X-API-Key"] = self.key
        return session

    def segment(self, image: bytes, category: str, session=None, mode: str = "auto") -> dict:
        session = session or self._session()
        started = time.perf_counter()
        res = session.post(f"{self.base}/v1/garments", timeout=60,
                           files={"image": ("photo.jpg", image, "image/jpeg")},
                           data={"category": category, "mode": mode, "framing": "catalog",
                                 "background": "white"})
        if res.status_code >= 400:
            raise RuntimeError(api_error(res))
        job_id = res.json()["job_id"]
        deadline = time.perf_counter() + self.timeout
        while time.perf_counter() < deadline:
            time.sleep(self.poll)
            body = session.get(f"{self.base}/v1/jobs/{job_id}", timeout=30)
            body.raise_for_status()
            job = body.json()
            if job["status"] == "completed":
                images = {name: session.get(f"{self.base}/v1/jobs/{job_id}/image", params={"variant": name},
                                            timeout=60).content for name in ("final", "mask")}
                session.delete(f"{self.base}/v1/jobs/{job_id}", timeout=30)
                return {"job": job, **images, "seconds": round(time.perf_counter() - started, 2)}
            if job["status"] == "failed":
                session.delete(f"{self.base}/v1/jobs/{job_id}", timeout=30)
                error = job.get("error") or {}
                raise RuntimeError(f"{error.get('code', 'FALHOU')}: {error.get('message', '')}".strip(": "))
        session.delete(f"{self.base}/v1/jobs/{job_id}", timeout=30)
        raise RuntimeError("PRAZO_ESGOTADO")


def thumbnail(data: bytes, path: Path, background=(240, 240, 240)) -> str:
    with Image.open(io.BytesIO(data)) as image:
        image = image.convert("RGBA")
        canvas = Image.new("RGBA", image.size, (*background, 255))
        canvas.alpha_composite(image)
        canvas = canvas.convert("RGB")
        canvas.thumbnail(THUMB, Image.Resampling.LANCZOS)
        canvas.save(path, "JPEG", quality=82)
    return f"{path.parent.name}/{path.name}"   # o relatório fica um nível acima de thumbs/


def process(product: dict, gpu: GpuClient, out: Path, session=None, keep_full: bool = True, mode: str = "auto") -> dict:
    row = {"id": product["id"], "name": product.get("product_name"), "category": product.get("category"),
           "class": "FAILED", "metrics": {}}
    try:
        raw = catalog_source.download(product["image_url"])
        category = catalog_source.CATEGORY_MAP.get(product.get("category"), "auto")
        result = gpu.segment(raw, category, session=session, mode=mode)
        verdict = result["job"].get("analysis")
        if not verdict:  # mode=segment: the server does not route, classify here from the mask
            with Image.open(io.BytesIO(raw)) as photo, Image.open(io.BytesIO(result["mask"])) as mask_image:
                verdict = classify(np.asarray(photo.convert("RGB")), np.asarray(mask_image.convert("L")) > 127, category)
        row.update(verdict, gpu_seconds=result["seconds"],
                   output=result["job"].get("output"), quality=(result["job"].get("quality") or {}).get("verdict"),
                   segmentation={k: v for k, v in (result["job"].get("segmentation") or {}).items()
                                 if k in {"mask_score", "detection_score", "detection_label", "mask_inside_box"}})
        if keep_full:
            (out / "cutouts" / f"{product['id']}.png").write_bytes(result["final"])
        row["thumb_in"] = thumbnail(raw, out / "thumbs" / f"{product['id']}-in.jpg")
        row["thumb_out"] = thumbnail(result["final"], out / "thumbs" / f"{product['id']}-out.jpg")
    except Exception as exc:  # download, API or decoding: the batch must not stop
        row["reason"] = f"{type(exc).__name__}: {str(exc)[:120]}"
    return row


def run(args) -> dict:
    out = args.out
    for sub in ("thumbs", "cutouts"):
        (out / sub).mkdir(parents=True, exist_ok=True)
    gpu = GpuClient(os.environ["FAI_API_URL"], os.environ["FAI_API_KEY"], timeout=args.job_timeout)
    conn = catalog_source.connect()
    try:
        products = catalog_source.fetch_products(conn, args.limit, args.offset, args.category, sample=not args.sequential)
        catalogue_size = catalog_source.count_products(conn)
    finally:
        if conn is not None:
            conn.close()
    print(f"catálogo: {catalogue_size} produtos em {catalog_source.describe_target()} · lote: {len(products)} · "
          f"GPU: {os.environ['FAI_API_URL']} · {args.concurrency} em paralelo")
    rows: list[dict] = []
    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool, (out / "audit.jsonl").open("a", encoding="utf-8") as audit:
        sessions = [gpu._session() for _ in range(args.concurrency)]
        futures = [pool.submit(process, product, gpu, out, sessions[i % len(sessions)], not args.no_cutouts, args.mode)
                   for i, product in enumerate(products)]
        for done, future in enumerate(futures, 1):
            row = future.result()
            rows.append(row)
            audit.write(json.dumps(row, ensure_ascii=False, default=str) + "\n")
            if done % 10 == 0 or done == len(futures):
                print(f"  {done}/{len(futures)}")
    summary = catalog_report.summarize(rows, catalogue_size, args.gpu_hour_usd, args.workers,
                                       elapsed=time.perf_counter() - started)
    report = catalog_report.write_report(out, rows, summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"relatório: {report}")
    return summary


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--limit", type=int, default=200, help="produtos neste lote")
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--category", help="só uma categoria (upper_piece, lower_piece, ...)")
    parser.add_argument("--sequential", action="store_true", help="ordem por id em vez de amostra determinística")
    parser.add_argument("--concurrency", type=int, default=3, help="fotos em paralelo (a GPU tem fila própria)")
    parser.add_argument("--mode", choices=("auto", "segment"), default="auto",
                        help="auto: o servidor manda à Fase 2 o que não for peça esticada; segment: só Fase 1")
    parser.add_argument("--job-timeout", type=int, default=1800, help="reconstrução na Fase 2 pode levar minutos na fila")
    parser.add_argument("--no-cutouts", action="store_true", help="não guarda os PNGs grandes, só as miniaturas")
    parser.add_argument("--gpu-hour-usd", type=float, default=0.70, help="preço/hora da GPU para a projeção de custo")
    parser.add_argument("--workers", type=int, default=1, help="workers de segmentação na projeção")
    parser.add_argument("--out", type=Path, default=Path("work/catalog-pilot"))
    args = parser.parse_args(argv)
    for name in ("FAI_API_URL", "FAI_API_KEY"):
        if not os.environ.get(name):
            raise SystemExit(f"{name} não definida")
    summary = run(args)
    return 0 if summary["total"] and summary["counts"].get("FAILED", 0) < summary["total"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
