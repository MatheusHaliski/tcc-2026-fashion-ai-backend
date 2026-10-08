#!/usr/bin/env python3
"""RF47 · Bootstrap do catálogo global a partir de data/catalog (marcas, apelidos, fontes oficiais e produtos).

    python scripts/catalog/seed_catalog.py [--dry-run] [--verbose] [--only nike,adidas]

Idempotente: rodar 1 ou 10 vezes dá o mesmo banco (find-or-create por slug, alias_norm, (marca, domínio) e
dedup_key/identificadores fortes). Popula também o Explorador › Buscar marcas & lojas (marcas com produtos)."""
from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common_cli import banner, parser  # noqa: E402
from db import connect, now, transaction  # noqa: E402
from ingest import Ingestor, setup_logging  # noqa: E402

DATA = Path(__file__).resolve().parents[2] / "data" / "catalog"
log = logging.getLogger("catalog")


def main(argv=None) -> int:
    ap = parser("Bootstrap idempotente do catálogo FashionAI")
    ap.add_argument("--only", help="slugs das marcas a semear, separados por vírgula")
    ap.add_argument("--data", default=str(DATA), help="pasta com brands.json, aliases.json e products/*.json")
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--overwrite", action="store_true", help="reaplica os dados do seed sobre campos já preenchidos")
    mode.add_argument("--skip-existing", action="store_true", help="pula registros existentes e insere somente marcas, fontes, produtos e filhos novos")
    args = ap.parse_args(argv)
    setup_logging(args.verbose)
    data = Path(args.data)
    only = {s.strip() for s in args.only.split(",")} if args.only else None
    banner("Seed do catálogo", args.dry_run)
    started = now()
    conn = connect()
    ing = Ingestor(conn, dry_run=args.dry_run, overwrite=args.overwrite, skip_existing=args.skip_existing)
    brands = json.loads((data / "brands.json").read_text(encoding="utf-8"))
    aliases = json.loads((data / "aliases.json").read_text(encoding="utf-8"))
    counts = {"brands": {}, "aliases": {}, "sources": {}}
    for b in brands:
        slug = ing.n.brand_slug(b["name"])
        if only and slug not in only:
            continue
        try:
            with transaction(conn, args.dry_run):
                with conn.cursor() as cur:
                    row, out = ing.upsert_brand(cur, b)
                    counts["brands"][out] = counts["brands"].get(out, 0) + 1
                    (log.debug if out == "SKIP" else log.info)("[%s] marca %s", out, b["name"])
                    for a in aliases.get(slug, []):
                        r = ing.upsert_brand_alias(cur, row["id"], a)
                        counts["aliases"][r] = counts["aliases"].get(r, 0) + 1
                    for src in b.get("sources", []):
                        r = ing.upsert_source(cur, row["id"], src)
                        counts["sources"][r] = counts["sources"].get(r, 0) + 1
                        (log.debug if r == "SKIP" else log.info)("[%s] fonte oficial %s → %s", r, b["name"], src["domain"])
        except Exception as e:
            ing.clear_caches()
            ing.report.errors += 1
            ing.report.error_details.append(f"marca {b['name']}: {e}")
            log.error("[ERROR] marca %s: %s", b["name"], e)
        finally:
            if args.dry_run:
                ing.clear_caches()
    for f in sorted((data / "products").glob("*.json")):
        if only and f.stem not in only:
            continue
        items = json.loads(f.read_text(encoding="utf-8"))
        for i, raw in enumerate(items, 1):
            ing.ingest(raw, label=f"{f.name}#{i}")
    ing.record_run("BOOTSTRAP", f"seed:{data}", started)
    print(f"\nMarcas {counts['brands']} · apelidos {counts['aliases']} · fontes {counts['sources']}")
    ing.report.print("Produtos")
    conn.close()
    return 1 if ing.report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
