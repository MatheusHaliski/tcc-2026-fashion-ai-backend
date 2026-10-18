#!/usr/bin/env python3
"""Lote da Peça inteira (Total frame): para cada foto canônica aprovada do catálogo, recorta a peça sem pessoa,
centraliza em 900×1200 e grava em ``catalog_images.whole_url`` / ``whole_json`` (V75).

Por padrão é um ensaio (nada é enviado nem gravado): baixa, recorta e salva as prévias em ``--out-dir`` com um JSONL
de auditoria. ``--apply`` envia ao armazenamento e grava no banco — só com autorização explícita, em produção.

    python scripts/catalog/process_whole_frames.py --limit 20 --out-dir /tmp/whole-preview
    python scripts/catalog/process_whole_frames.py --apply --limit 500

O segmentador roda localmente (rembg; ``pip install -r scripts/catalog/requirements-whole.txt``): foto com pessoa
nunca vai para serviço externo. A caixa da peça e o sinal de modelo vêm da análise do Tecido (``metrics_json.debug``).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import uuid
from pathlib import Path
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).resolve().parent))

from PIL import Image  # noqa: E402

from whole_frame import WHOLE_FRAME_VERSION, GarmentSegmenter, render_whole  # noqa: E402

SELECT = """
SELECT i.id, i.product_id, i.image_url, i.source_sha256, i.metrics_json, i.crop_json, i.whole_pipeline_version,
       p.category, p.subcategory
  FROM catalog_images i JOIN catalog_products p ON p.id = i.product_id
 WHERE i.is_canonical = 1 AND i.processing_status = 'APPROVED' AND i.usage_status <> 'REJECTED'
   AND (%(force)s OR i.whole_pipeline_version IS NULL OR i.whole_pipeline_version <> %(version)s)
   {product}
 ORDER BY i.updated_at DESC
 LIMIT %(limit)s
"""

UPDATE = """
UPDATE catalog_images SET whole_url = %(url)s, whole_json = %(json)s, whole_status = %(status)s,
       whole_pipeline_version = %(version)s, version = version + 1
 WHERE id = %(id)s AND (source_sha256 <=> %(sha)s)
"""


def _json(value):
    if not value:
        return {}
    return value if isinstance(value, dict) else json.loads(value)


def analysis_of(record) -> dict:
    """Sinais da análise do Tecido: foto com modelo e lados cortados."""
    debug = _json(record.get("metrics_json")).get("debug") or {}
    product = debug.get("productFrame") or {}
    human = debug.get("sourceHumanEvidence")
    model = bool(product.get("model")) or (isinstance(human, (int, float)) and human >= 0.0015)
    truncated = debug.get("truncated") if isinstance(debug.get("truncated"), list) else []
    return {"model": model, "truncated": truncated}


def process(record, downloader, segmenter, *, out_dir: Path | None = None, storage=None) -> dict:
    """Uma foto: baixa, recorta, renderiza; com ``storage`` envia e devolve o patch do banco."""
    signals = analysis_of(record)
    path = downloader.get(record["image_url"])
    data = path.read_bytes()
    sha = hashlib.sha256(data).hexdigest()
    if record.get("source_sha256") and record["source_sha256"] != sha:
        return {"id": record["id"], "status": "SKIPPED", "reason": "SOURCE_CHANGED_SINCE_ANALYSIS"}
    with Image.open(path) as image:
        image.load()
        mask = segmenter.mask(image, category=record.get("category"), subcategory=record.get("subcategory"),
                              model=signals["model"])
        result = render_whole(image, mask, signals["truncated"])
    info = {**result.info, "model": signals["model"], "sourceSha256": sha, "sourceUrl": record["image_url"]}
    row = {"id": record["id"], "productId": record.get("product_id"), "status": "RENDERED", "info": info}
    if out_dir is not None:
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / f"{record['id']}.jpg").write_bytes(result.data)
    if storage is not None:
        url = storage.put(result.data)
        info["sha256"] = hashlib.sha256(result.data).hexdigest()
        row.update(status="STORED", url=url,
                   patch={"id": record["id"], "sha": record.get("source_sha256"), "url": url, "status": "DONE",
                          "version": WHOLE_FRAME_VERSION, "json": json.dumps(info, ensure_ascii=False)})
    return row


class WholeStorage:
    """Envia o JPEG da Peça inteira (mesmo armazenamento e verificação do Tecido, prefixo ``catalog/whole/``)."""

    def __init__(self, frame_storage):
        self.inner = frame_storage

    def put(self, data: bytes) -> str:
        digest = hashlib.sha256(data).hexdigest()
        key = "catalog/whole/" + uuid.uuid4().hex + "/" + digest + ".jpg"
        client, bucket = self.inner.client, self.inner.bucket
        client.put_object(Bucket=bucket, Key=key, Body=data, ContentType="image/jpeg", IfNoneMatch="*")
        body = client.get_object(Bucket=bucket, Key=key)["Body"]
        try:
            verified = body.read(len(data) + 1)
        finally:
            body.close()
        if hashlib.sha256(verified).hexdigest() != digest:
            client.delete_object(Bucket=bucket, Key=key)
            raise ValueError("WHOLE_UPLOAD_VERIFICATION_FAILED")
        return self.inner.base + "/" + quote(key, safe="/")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--apply", action="store_true", help="envia e grava no banco (produção: só com autorização)")
    parser.add_argument("--force", action="store_true", help="refaz mesmo as fotos já na versão atual")
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--product-id", help="só um produto")
    parser.add_argument("--out-dir", type=Path, help="salva as prévias JPEG aqui (ensaio)")
    parser.add_argument("--audit", type=Path, default=Path("whole-frames-audit.jsonl"))
    args = parser.parse_args(argv)

    import tempfile

    import db
    from process_catalog_images import DownloadFailure, ImageDownloader

    storage = None
    if args.apply:
        from category_frame_storage import FrameStorage
        storage = WholeStorage(FrameStorage())
    segmenter = GarmentSegmenter()
    conn = db.connect()
    sql = SELECT.format(product="AND i.product_id = %(product)s" if args.product_id else "")
    with conn.cursor() as cur:
        cur.execute(sql, {"force": 1 if args.force else 0, "version": WHOLE_FRAME_VERSION, "limit": args.limit,
                          "product": args.product_id})
        records = cur.fetchall()
    print(f"Peça inteira: {len(records)} fotos · {'GRAVANDO' if args.apply else 'ensaio (nada é gravado)'} · {db.describe_target()}")
    done = failed = 0
    with tempfile.TemporaryDirectory() as tmp, args.audit.open("a", encoding="utf-8") as audit:
        downloader = ImageDownloader(Path(tmp))
        for record in records:
            try:
                row = process(record, downloader, segmenter, out_dir=args.out_dir, storage=storage)
                if row.get("patch"):
                    with conn.cursor() as cur:
                        cur.execute(UPDATE, row["patch"])
                        if cur.rowcount != 1:
                            row.update(status="SKIPPED", reason="ROW_CHANGED")
                    conn.commit()
                    row.pop("patch", None)
                done += row["status"] in ("RENDERED", "STORED")
            except (DownloadFailure, ValueError, OSError) as error:
                failed += 1
                row = {"id": record["id"], "status": "FAILED", "reason": str(error)}
                if args.apply and str(error).startswith("WHOLE_"):
                    with conn.cursor() as cur:
                        cur.execute(UPDATE, {"id": record["id"], "sha": record.get("source_sha256"), "url": None,
                                             "json": json.dumps({"reason": str(error)}), "status": "FAILED",
                                             "version": WHOLE_FRAME_VERSION})
                    conn.commit()
            audit.write(json.dumps(row, ensure_ascii=False, default=str) + "\n")
    print(f"prontas: {done} · falhas: {failed} · auditoria: {args.audit}")
    return 0 if not failed or done else 1


if __name__ == "__main__":
    raise SystemExit(main())
