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
from db import DatabaseUnavailable, connect, now, run_transaction  # noqa: E402
from ingest import Ingestor, setup_logging  # noqa: E402

DATA = Path(__file__).resolve().parents[2] / "data" / "catalog"
log = logging.getLogger("catalog")


def seed_brands(ing, brands, aliases, only=None, counts=None):
    if counts is None:
        counts = {"brands": {}, "aliases": {}, "sources": {}}
    for b in brands:
        brand_slug = ing.n.brand_slug(b["name"])
        if only and brand_slug not in only:
            continue
        details = len(ing.report.error_details)

        def restore():
            ing.clear_caches()
            del ing.report.error_details[details:]

        def write():
            part = {"brands": {}, "aliases": {}, "sources": {}}
            with ing.conn.cursor() as cur:
                row, out = ing.upsert_brand(cur, b)
                part["brands"][out] = 1
                for a in aliases.get(brand_slug, []):
                    r = ing.upsert_brand_alias(cur, row["id"], a)
                    part["aliases"][r] = part["aliases"].get(r, 0) + 1
                for src in b.get("sources", []):
                    r = ing.upsert_source(cur, row["id"], src)
                    part["sources"][r] = part["sources"].get(r, 0) + 1
            return part

        try:
            part = run_transaction(ing.conn, write, ing.dry_run, label=f"marca {b['name']}", on_failure=restore)
            for kind, outcomes in part.items():
                for outcome, amount in outcomes.items():
                    counts[kind][outcome] = counts[kind].get(outcome, 0) + amount
            (log.debug if "SKIP" in part["brands"] else log.info)("[%s] marca %s", next(iter(part["brands"])), b["name"])
        except DatabaseUnavailable as e:
            ing._error(str(e))
            raise
        except Exception as e:
            ing._error(f"marca {b['name']}: {type(e).__name__}: {e}")
        finally:
            if ing.dry_run:
                ing.clear_caches()
    return counts


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
    try:
        seed_brands(ing, brands, aliases, only, counts)
        for f in sorted((data / "products").glob("*.json")):
            if only and f.stem not in only:
                continue
            items = json.loads(f.read_text(encoding="utf-8"))
            for i, raw in enumerate(items, 1):
                ing.ingest(raw, label=f"{f.name}#{i}")
        try:
            ing.record_run("BOOTSTRAP", f"seed:{data}", started)
        except DatabaseUnavailable as e:
            ing._error(str(e))
    except DatabaseUnavailable:
        print("[ERROR] Seed interrompido; relatório exibido abaixo, sem gravação no banco indisponível.")
    finally:
        print(f"\nMarcas {counts['brands']} · apelidos {counts['aliases']} · fontes {counts['sources']}")
        ing.report.print("Produtos")
        if getattr(conn, "open", True):
            conn.close()
    return 1 if ing.report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
