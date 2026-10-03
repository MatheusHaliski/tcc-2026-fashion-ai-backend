#!/usr/bin/env python3
"""RF47 · Recalcula o texto indexado (search_text, FULLTEXT ngram) de todos os produtos — depois de mudar apelidos de
marca/produto ou a normalização. Idempotente; --dry-run só conta o que mudaria."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common_cli import banner, parser  # noqa: E402
from db import connect, now  # noqa: E402
from ingest import Ingestor, setup_logging  # noqa: E402
from normalize_product import Product  # noqa: E402


def main(argv=None) -> int:
    args = parser("Reconstrói o índice de busca do catálogo").parse_args(argv)
    setup_logging(args.verbose)
    banner("Índice de busca", args.dry_run)
    conn = connect()
    ing = Ingestor(conn, dry_run=args.dry_run)
    changed = 0
    with conn.cursor() as cur:
        cur.execute("SELECT p.*, b.name AS brand_name FROM catalog_products p JOIN brands b ON b.id = p.brand_id")
        rows = cur.fetchall()
        for r in rows:
            cur.execute("SELECT alias FROM catalog_product_aliases WHERE product_id = %s", (r["id"],))
            aliases = [a["alias"] for a in cur.fetchall()]
            cur.execute("SELECT color, color_name FROM catalog_variants WHERE product_id = %s", (r["id"],))
            variants = cur.fetchall()
            p = Product(brand=r["brand_name"], category=r["category"], subcategory=r["subcategory"], product_name=r["product_name"],
                        model_name=r["model_name"], product_code=r["product_code"], sku=r["sku"], gtin=r["gtin"],
                        color=r["color"], color_name=r["color_name"], collection=r["collection"], aliases=aliases, variants=variants)
            text = ing.search_text(cur, {"id": r["brand_id"], "name": r["brand_name"]}, p)
            if text != r["search_text"]:
                changed += 1
                ing.report.updated += 1
                if not args.dry_run:
                    cur.execute("UPDATE catalog_products SET search_text = %s, updated_at = %s WHERE id = %s", (text, now(), r["id"]))
    if args.dry_run:
        conn.rollback()
    else:
        conn.commit()
    print(f"{len(rows)} produtos lidos · {changed} textos {'a atualizar' if args.dry_run else 'atualizados'}")
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
