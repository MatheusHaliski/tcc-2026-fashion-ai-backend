#!/usr/bin/env python3
"""Audita a prontidão do catálogo para o provador 3D, sem baixar imagens ou editar o banco.

Classifica evidências confirmadas (sem foto, pipeline falhou, tipologia contraditória)
e riscos (foto crua que exige segmentação no navegador, Whole Frame ausente).
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from catalog_image_inventory import load_database

VISIBLE = {"VALIDATED", "PERSISTABLE", "REFERENCE_ONLY"}
GARMENTS = {"upper_piece", "lower_piece", "full_body_piece", "shoes_piece"}

TYPE_WORDS = {
    "shorts": ("short", "shorts"),
    "bermuda_shorts": ("bermuda",),
    "jeans": ("jean", "jeans", "calca jeans", "calça jeans"),
    "skirt": ("saia", "skirt"),
    "dress": ("vestido", "dress"),
    "jumpsuit": ("macacao", "macacão", "jumpsuit", "overall"),
    "t_shirt": ("camiseta", "t-shirt", "tshirt"),
    "shirt": ("camisa", "shirt"),
    "hoodie": ("hoodie", "moletom com capuz"),
    "boots": ("bota", "boot"),
    "sandals": ("sandalia", "sandália", "sandal"),
}


def normalized(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).strip()


def expected_subcategory(name: str) -> str | None:
    text = normalized(name)
    # Os termos mais específicos precisam ganhar de "jeans" em "bermuda jeans".
    for subcategory in ("bermuda_shorts", "shorts", "skirt", "dress", "jumpsuit",
                        "t_shirt", "hoodie", "shirt", "boots", "sandals", "jeans"):
        if any(normalized(word) in text for word in TYPE_WORDS[subcategory]):
            return subcategory
    return None


def compatible(expected: str, actual: str | None) -> bool:
    actual = normalized(actual).replace(" ", "_")
    families = {
        "shorts": {"shorts", "denim_shorts"},
        "bermuda_shorts": {"bermuda_shorts", "shorts", "denim_shorts"},
        "shirt": {"shirt", "polo_shirt"},
    }
    return actual in families.get(expected, {expected})


def audit_product(product: dict) -> list[dict]:
    issues: list[dict] = []
    images = product["images"]
    usable = [image for image in images if image.get("image_url")]
    primary = next((image for image in usable if image.get("is_canonical")), None)
    primary = primary or next((image for image in usable if image.get("is_primary")), None)
    primary = primary or (usable[0] if usable else None)

    if not primary:
        issues.append({"code": "NO_IMAGE", "severity": "error", "dimension": "not_rendered"})
        return issues

    status = primary.get("processing_status")
    if status in {"FAILED", "REJECTED"}:
        issues.append({"code": "IMAGE_PIPELINE_FAILED", "severity": "error", "dimension": "not_rendered",
                       "detail": status})
    elif status != "APPROVED":
        issues.append({"code": "IMAGE_NEEDS_REPROCESSING", "severity": "warning", "dimension": "slow",
                       "detail": status or "UNKNOWN"})

    category = product.get("category")
    if category in GARMENTS and not primary.get("whole_url"):
        issues.append({"code": "WHOLE_FRAME_MISSING", "severity": "warning", "dimension": "slow",
                       "detail": "A peça depende de recorte/segmentação no navegador."})
    if primary.get("whole_status") == "FAILED":
        issues.append({"code": "WHOLE_FRAME_FAILED", "severity": "error", "dimension": "not_rendered"})

    crop = primary.get("crop") or {}
    if crop.get("ruleCompliant") is False:
        issues.append({"code": "FRAME_NON_COMPLIANT", "severity": "warning", "dimension": "appearance"})

    expected = expected_subcategory(product.get("product_name") or "")
    if expected and not compatible(expected, product.get("subcategory")):
        issues.append({"code": "TYPE_MISMATCH", "severity": "error", "dimension": "type",
                       "detail": f"nome indica {expected}; cadastro usa {product.get('subcategory')}"})
    return issues


def build_report(records: list[dict]) -> dict:
    products: dict[str, dict] = {}
    for row in records:
        if row.get("ingestion_status") not in VISIBLE:
            continue
        product = products.setdefault(row["product_id"], {
            "product_id": row["product_id"], "brand": row.get("brand") or "Sem marca",
            "product_name": row.get("product_name"), "category": row.get("category"),
            "subcategory": row.get("subcategory"), "color": row.get("color"),
            "color_name": row.get("color_name"), "official_product_url": row.get("official_product_url"),
            "images": [],
        })
        if row.get("image_id"):
            product["images"].append(row)

    by_brand: dict[str, dict] = defaultdict(lambda: {"products": 0, "affected": 0, "issues": Counter(), "samples": []})
    confirmed_products = []
    risk_products = 0
    for product in products.values():
        issues = audit_product(product)
        brand = by_brand[product["brand"]]
        brand["products"] += 1
        if not issues:
            continue
        brand["affected"] += 1
        brand["issues"].update(issue["code"] for issue in issues)
        finding = {key: product.get(key) for key in ("product_id", "product_name", "category", "subcategory", "official_product_url")}
        finding["issues"] = issues
        if any(issue["severity"] == "error" for issue in issues):
            confirmed_products.append(finding | {"brand": product["brand"]})
        else:
            risk_products += 1
        if len(brand["samples"]) < 8:
            brand["samples"].append(finding)

    brands = []
    for name in sorted(by_brand):
        brand = by_brand[name]
        brands.append({"brand": name, "products": brand["products"], "affected": brand["affected"],
                       "affected_pct": round(brand["affected"] * 100 / brand["products"], 1),
                       "issues": dict(brand["issues"].most_common()), "samples": brand["samples"]})
    return {"summary": {"brands": len(brands), "products": len(products),
                        "confirmed_products": len(confirmed_products), "risk_products": risk_products},
            "brands": brands, "confirmed_products": confirmed_products}


def markdown(report: dict) -> str:
    summary = report["summary"]
    lines = ["# Auditoria do catálogo no provador 3D", "",
             f"- Marcas: **{summary['brands']}**", f"- Produtos: **{summary['products']}**",
             f"- Produtos com erro confirmado: **{summary['confirmed_products']}**",
             f"- Produtos somente com risco de lentidão/aparência: **{summary['risk_products']}**", "",
             "| Marca | Produtos | Com sinais | % | Principais sinais |", "|---|---:|---:|---:|---|"]
    for brand in report["brands"]:
        signals = ", ".join(f"{code}: {count}" for code, count in list(brand["issues"].items())[:4]) or "nenhum"
        lines.append(f"| {brand['brand']} | {brand['products']} | {brand['affected']} | {brand['affected_pct']}% | {signals} |")
    lines.extend(["", "## Legenda", "",
                  "- `NO_IMAGE`, `IMAGE_PIPELINE_FAILED`, `WHOLE_FRAME_FAILED`: forte risco de não renderizar.",
                  "- `IMAGE_NEEDS_REPROCESSING`, `WHOLE_FRAME_MISSING`: recorte em runtime; pode demorar ou falhar.",
                  "- `TYPE_MISMATCH`: o nome indica outro molde, como bermuda cadastrada como jeans/calça.",
                  "- `FRAME_NON_COMPLIANT`: risco de fundo, enquadramento ou textura incorretos."])
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("data/catalog/audit/tryon-rendering.json"))
    parser.add_argument("--markdown", type=Path, default=Path("data/catalog/audit/tryon-rendering.md"))
    args = parser.parse_args()
    report = build_report(list(load_database()))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    args.markdown.write_text(markdown(report), encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False))


if __name__ == "__main__":
    main()