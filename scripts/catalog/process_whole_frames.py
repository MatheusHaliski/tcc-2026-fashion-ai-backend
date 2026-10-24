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
from photo_set import clean_target_mask, MAX_INPUT_PIXELS, MAX_ANALYSIS_SIDE  # noqa: E402
from semantic_photo_provider import AutomaticClothProvider  # noqa: E402
from photo_preflight import inspect_source  # noqa: E402
from PIL import ImageOps

SELECT = """
SELECT i.id, i.version AS image_version, i.product_id, i.variant_id, i.image_url, i.source_sha256, i.metrics_json, i.crop_json, i.whole_pipeline_version,
       p.category, p.subcategory, v.id AS matched_variant_id, COALESCE(v.color, p.color) AS color
  FROM catalog_images i JOIN catalog_products p ON p.id = i.product_id
  LEFT JOIN catalog_variants v ON v.id = i.variant_id AND v.product_id = p.id
 WHERE i.is_canonical = 1 AND i.processing_status = 'APPROVED' AND i.usage_status <> 'REJECTED'
   AND (%(force)s OR i.whole_pipeline_version IS NULL OR i.whole_pipeline_version <> %(version)s
        OR (i.variant_id IS NOT NULL AND v.id IS NULL)
        OR NOT (JSON_EXTRACT(i.whole_json, '$.imageId') <=> CAST(COALESCE(JSON_QUOTE(i.id), 'null') AS JSON))
        OR NOT (JSON_EXTRACT(i.whole_json, '$.variantId') <=> CAST(COALESCE(JSON_QUOTE(i.variant_id), 'null') AS JSON))
        OR NOT (JSON_EXTRACT(i.whole_json, '$.color') <=> CAST(COALESCE(JSON_QUOTE(COALESCE(v.color, p.color)), 'null') AS JSON))
        OR NOT (JSON_EXTRACT(i.whole_json, '$.category') <=> CAST(COALESCE(JSON_QUOTE(p.category), 'null') AS JSON))
        OR NOT (JSON_EXTRACT(i.whole_json, '$.subcategory') <=> CAST(COALESCE(JSON_QUOTE(p.subcategory), 'null') AS JSON)))
   {product}
 ORDER BY i.updated_at DESC
 LIMIT %(limit)s
"""

UPDATE = """
UPDATE catalog_images i JOIN catalog_products p ON p.id = i.product_id
  LEFT JOIN catalog_variants v ON v.id = i.variant_id AND v.product_id = p.id
   SET i.whole_url = %(url)s, i.whole_json = %(json)s, i.whole_status = %(status)s,
       i.whole_pipeline_version = %(version)s, i.source_sha256 = %(source_sha)s, i.version = i.version + 1
 WHERE i.id = %(id)s AND i.version = %(image_version)s AND i.image_url = %(source_url)s
   AND (i.source_sha256 <=> %(sha)s) AND p.category = %(category)s AND p.subcategory <=> %(subcategory)s
   AND i.variant_id <=> %(variant_id)s AND COALESCE(v.color, p.color) <=> %(color)s
   AND (i.variant_id IS NULL OR v.id IS NOT NULL)
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


def process(record, downloader, segmenter, *, out_dir: Path | None = None, storage=None, provider=None) -> dict:
    """Uma foto: baixa, recorta, renderiza; com ``storage`` envia e devolve o patch do banco."""
    variant_id = record.get("variant_id")
    if variant_id is not None and str(record.get("matched_variant_id")) != str(variant_id):
        return {"id": record["id"], "productId": record.get("product_id"), "variantId": variant_id,
                "status": "REVIEW", "reason": "VARIANT_CONTEXT_UNRESOLVED",
                "metrics": {"sourceGarmentHeightFraction": None}}
    signals = analysis_of(record)
    path = downloader.get(record["image_url"])
    data = path.read_bytes()
    sha = hashlib.sha256(data).hexdigest()
    if record.get("source_sha256") and record["source_sha256"] != sha:
        return {"id": record["id"], "status": "SKIPPED", "reason": "SOURCE_CHANGED_SINCE_ANALYSIS"}
    with Image.open(path) as image:
        if image.width*image.height>MAX_INPUT_PIXELS:
            return {"id":record["id"],"status":"REVIEW","reason":"IMAGE_TOO_LARGE","sourceSha256":sha}
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.load()
        original_size=image.size
        image.thumbnail((MAX_ANALYSIS_SIDE,MAX_ANALYSIS_SIDE),Image.Resampling.LANCZOS)
        source_provider=provider or AutomaticClothProvider(segmenter=segmenter)
        if hasattr(source_provider,'for_source'):source_provider=source_provider.for_source(sha,record['image_url'])
        try:
            masks = source_provider.masks(image, record.get("category"), record.get("subcategory"))
            preflight = inspect_source(image, masks, record.get("category"), record.get("subcategory"), original_size=original_size)
        except (ImportError, OSError, ValueError, RuntimeError) as error:
            reason = str(error) if isinstance(error, ValueError) and str(error).isupper() and len(str(error)) < 90 else 'SEGMENTATION_UNAVAILABLE'
            return {"id":record["id"],"productId":record.get("product_id"),
                    "status":"RETRY" if reason in {'SEGMENTATION_UNAVAILABLE', 'PARSER_LOCAL_WEIGHTS_MISSING'} else 'REVIEW',"reason":reason,
                    "sourceSha256":sha,"metrics":{"sourceGarmentHeightFraction":None}}
        if signals["truncated"] or preflight.status != "PASS":
            return {"id":record["id"],"productId":record.get("product_id"),
                    "status":"REVIEW" if signals["truncated"] else preflight.status,
                    "reason":"GARMENT_COMPLETENESS_UNCERTAIN" if signals["truncated"] else preflight.reason,
                    "sourceSha256":sha,"metrics":{"preflight":preflight.metrics}}
        try:
            mask, cleanup = clean_target_mask(masks.target, masks.forbidden, record.get("category"), record.get("subcategory"))
        except ValueError as error:
            return {"id":record["id"],"productId":record.get("product_id"),"status":"REVIEW", "reason":str(error),
                    "sourceSha256":sha,"metrics":{"preflight":preflight.metrics}}
        result = render_whole(image, mask, preflight=preflight)
    info = {**result.info, "model": signals["model"], "sourceSha256": sha, "sourceUrl": record["image_url"],
            "imageId": record["id"], "variantId": variant_id, "color": record.get("color"),
            "category":record.get("category"),"subcategory":record.get("subcategory"),"cleanup":cleanup}
    row = {"id": record["id"], "productId": record.get("product_id"), "status": "RENDERED", "info": info}
    if out_dir is not None:
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / f"{record['id']}.jpg").write_bytes(result.data)
    if storage is not None:
        url = storage.put(result.data)
        info["sha256"] = hashlib.sha256(result.data).hexdigest()
        row.update(status="STORED", url=url,
                   patch={"id": record["id"], "sha": record.get("source_sha256"), "source_sha": sha,
                          "image_version": record["image_version"], "source_url": record["image_url"],
                          "variant_id": variant_id, "color": record.get("color"),
                          "category": record.get("category"), "subcategory": record.get("subcategory"), "url": url, "status": "DONE",
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
    parser.add_argument("--reviewed-masks",type=Path)
    parser.add_argument("--parser-weights",type=Path)
    args = parser.parse_args(argv)

    import tempfile

    import db
    from process_catalog_images import DownloadFailure, ImageDownloader

    storage = None
    if args.apply:
        from category_frame_storage import FrameStorage
        storage = WholeStorage(FrameStorage())
    segmenter = GarmentSegmenter()
    provider=AutomaticClothProvider(weights=args.parser_weights)
    if args.reviewed_masks:
        from reviewed_photo_masks import ReviewedMaskProvider
        provider=ReviewedMaskProvider(args.reviewed_masks)
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
                row = process(record, downloader, segmenter, out_dir=args.out_dir, storage=storage,provider=provider)
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
                        cur.execute(UPDATE, {"id": record["id"], "sha": record.get("source_sha256"), "source_sha": record.get("source_sha256"),
                                             "image_version": record["image_version"], "source_url": record["image_url"],
                                             "variant_id": record.get("variant_id"), "color": record.get("color"),
                                             "category": record.get("category"), "subcategory": record.get("subcategory"), "url": None,
                                             "json": json.dumps({"reason": str(error), "imageId": record["id"],
                                                                 "variantId": record.get("variant_id"), "color": record.get("color"),
                                                                 "category": record.get("category"), "subcategory": record.get("subcategory")}), "status": "FAILED",
                                             "version": WHOLE_FRAME_VERSION})
                    conn.commit()
            audit.write(json.dumps(row, ensure_ascii=False, default=str) + "\n")
    print(f"prontas: {done} · falhas: {failed} · auditoria: {args.audit}")
    return 0 if not failed or done else 1


if __name__ == "__main__":
    raise SystemExit(main())
