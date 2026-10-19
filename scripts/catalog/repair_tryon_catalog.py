#!/usr/bin/env python3
"""Planeja e executa reparos seguros do catálogo para o provador 3D.

O padrão é somente leitura. ``--apply-taxonomy`` aplica apenas incompatibilidades
de nome/tipo de alta confiança usando concorrência otimista. ``--run-images`` e
``--run-whole`` reutilizam os processadores existentes com checkpoint e lotes.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import db
from audit_tryon_rendering import VISIBLE, audit_product
from catalog_image_inventory import load_database
from normalize_product import Normalizer

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PLAN = ROOT / "data/catalog/audit/tryon-repair-plan.json"


def collect_products(records: list[dict]) -> list[dict]:
    products: dict[str, dict] = {}
    for row in records:
        if row.get("ingestion_status") not in VISIBLE:
            continue
        product = products.setdefault(row["product_id"], {
            "product_id": row["product_id"], "product_name": row.get("product_name"),
            "brand": row.get("brand") or "Sem marca", "category": row.get("category"),
            "subcategory": row.get("subcategory"), "version": row.get("product_version"), "images": [],
        })
        if row.get("image_id"):
            product["images"].append(row)
    return list(products.values())


AUTO_TAXONOMY_RULES = (
    (re.compile(r"\bbermuda\b|\b(?:denim|jeans?|cargo|chino)\s+(?:walk)?shorts?\b|\bshorts?\s+(?:jeans?|denim|cargo|chino)\b"),
     {"jeans", "casual_pants", "cargo_pants", "chino_pants"}, "shorts"),
)


def taxonomy_patch(product: dict, normalizer: Normalizer) -> dict | None:
    name = " ".join(re.sub(r"[^a-z0-9]+", " ", (product.get("product_name") or "").lower()).split())
    actual = product.get("subcategory")
    expected = next((target for pattern, sources, target in AUTO_TAXONOMY_RULES
                     if actual in sources and pattern.search(name)), None)
    if not expected:
        return None
    normalized = normalizer.subcategory(expected)
    if not normalized:
        return None
    subcategory, _, _ = normalizer.resolve(normalized)
    category = normalizer.sub_category.get(subcategory)
    if not category:
        return None
    return {
        "product_id": product["product_id"], "brand": product["brand"],
        "product_name": product["product_name"], "old_category": product["category"],
        "old_subcategory": product["subcategory"], "new_category": category,
        "new_subcategory": subcategory, "version": product["version"],
    }


def build_plan(records: list[dict]) -> dict:
    normalizer = Normalizer()
    products = collect_products(records)
    taxonomy = [patch for product in products if (patch := taxonomy_patch(product, normalizer))]
    issue_counts = Counter(issue["code"] for product in products for issue in audit_product(product))
    return {
        "summary": {"products": len(products), "taxonomy_updates": len(taxonomy),
                    "image_pipeline_candidates": issue_counts["IMAGE_PIPELINE_FAILED"] + issue_counts["IMAGE_NEEDS_REPROCESSING"],
                    "whole_frame_candidates": issue_counts["WHOLE_FRAME_MISSING"] + issue_counts["WHOLE_FRAME_FAILED"],
                    "manual_source_required": issue_counts["NO_IMAGE"]},
        "taxonomy_updates": taxonomy,
    }


UPDATE_TAXONOMY = """
UPDATE catalog_products
   SET category=%s, subcategory=%s, version=version+1, updated_at=CURRENT_TIMESTAMP(6)
 WHERE id=%s AND version=%s AND category=%s AND subcategory=%s
"""


def apply_taxonomy(conn, updates: list[dict]) -> dict:
    changed = skipped = 0
    for update in updates:
        def operation():
            with conn.cursor() as cursor:
                cursor.execute(UPDATE_TAXONOMY, (
                    update["new_category"], update["new_subcategory"], update["product_id"],
                    update["version"], update["old_category"], update["old_subcategory"],
                ))
                return cursor.rowcount

        rowcount = db.run_transaction(conn, operation, label=f"taxonomia {update['product_id']}")
        changed += rowcount == 1
        skipped += rowcount != 1
    return {"changed": changed, "skipped": skipped}


def run_pipeline(command: list[str]) -> None:
    subprocess.run(command, cwd=ROOT, check=True)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--plan", type=Path, default=DEFAULT_PLAN)
    parser.add_argument("--apply-taxonomy", action="store_true")
    parser.add_argument("--run-images", action="store_true")
    parser.add_argument("--run-whole", action="store_true")
    parser.add_argument("--limit", type=int, default=500)
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args(argv)

    plan = build_plan(list(load_database()))
    args.plan.parent.mkdir(parents=True, exist_ok=True)
    args.plan.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    result = {"plan": str(args.plan), **plan["summary"]}

    if args.apply_taxonomy:
        conn = db.connect()
        try:
            result["taxonomy_result"] = apply_taxonomy(conn, plan["taxonomy_updates"])
        finally:
            conn.close()
    if args.run_images:
        run_pipeline([sys.executable, "scripts/catalog/process_catalog_images.py", "--database", "--apply",
                      "--category-frame", "--authorized-only", "--limit", str(args.limit),
                      "--workers", str(args.workers), "--checkpoint", "data/catalog/audit/image-pipeline.sqlite",
                      "--output", "data/catalog/audit/image-pipeline.xlsx"])
    if args.run_whole:
        run_pipeline([sys.executable, "scripts/catalog/process_whole_frames.py", "--apply", "--limit", str(args.limit),
                      "--audit", "data/catalog/audit/whole-frames.jsonl"])
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())