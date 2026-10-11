#!/usr/bin/env python3
"""RF47/RF49 · Monta um arquivo do acervo (data/catalog/acervo/*.jsonl.gz) a partir do que o coletor gravou.

    python scripts/catalog/build_acervo.py --out data/catalog/acervo/acervo-oficial-2026-10-11.jsonl.gz \
        --brands hering,renner data/catalog/collected/*.jsonl          # só as marcas pedidas
    python scripts/catalog/build_acervo.py --out novo.jsonl.gz --dry-run data/catalog/collected/*.jsonl

Cada linha passa pelas regras atuais de tipo (as mesmas do recheck_collected.py) e pelo normalize_product: o que não
entraria na importação não entra no arquivo. A descrição vira texto puro (algumas lojas publicam HTML). Peças já
presentes nos outros arquivos de data/catalog/acervo/ (mesma URL canônica) ou repetidas na coleta ficam de fora, para
que cada arquivo traga só peças novas. A importação continua sendo o import_products.py / import_railway.sh.
"""
from __future__ import annotations

import argparse
import gzip
import io
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from import_products import read_items  # noqa: E402
from normalize_product import Normalizer, ValidationError, canonical_url, normalize_product, plain_text  # noqa: E402
from recheck_collected import recheck  # noqa: E402

ACERVO = Path(__file__).resolve().parents[2] / "data/catalog/acervo"


def known_urls(paths) -> set[str]:
    urls = set()
    for path in paths:
        for _, item in read_items(path):
            url = canonical_url(item.get("official_product_url"))
            if url:
                urls.add(url)
    return urls


def build(files, n: Normalizer, skip_urls: set[str], brands: set[str] | None = None, verbose: bool = False):
    """Devolve (linhas por marca, contadores por marca). Marca = slug do nome da marca na linha."""
    rows, counts = defaultdict(list), defaultdict(Counter)
    skip_urls = {canonical_url(u) or u for u in skip_urls}
    seen = set(skip_urls)
    for path in files:
        for _, item in read_items(Path(path)):
            brand = n.brand_slug(item.get("brand"))
            if brands and brand not in brands:
                continue
            outcome, item = recheck(item, n)
            if item is None:
                counts[brand][outcome] += 1
                continue
            if item.get("description"):
                item["description"] = plain_text(str(item["description"]))[:2000] or None
                if not item["description"]:
                    del item["description"]
            try:
                normalize_product(item, n)
            except ValidationError as e:
                counts[brand]["invalida"] += 1
                if verbose:
                    print(f"  invalida  {item.get('official_product_url')}: {e}")
                continue
            url = canonical_url(item.get("official_product_url"))
            if url in seen:
                counts[brand]["repetida" if url not in skip_urls else "ja_no_acervo"] += 1
                continue
            seen.add(url)
            counts[brand]["ok"] += 1
            counts[brand]["com_foto"] += 1 if item.get("images") else 0
            rows[brand].append(item)
    return rows, counts


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Monta um arquivo do acervo a partir dos JSONL coletados")
    ap.add_argument("files", nargs="+", help="JSONL do coletor (data/catalog/collected/*.jsonl)")
    ap.add_argument("--out", required=True, help="arquivo .jsonl.gz de saída")
    ap.add_argument("--brands", help="slugs separados por vírgula (padrão: todas as dos arquivos)")
    ap.add_argument("--dry-run", action="store_true", help="só mostra o relatório")
    ap.add_argument("--verbose", action="store_true", help="mostra cada linha recusada pelo normalize_product")
    args = ap.parse_args(argv)
    out = Path(args.out)
    if not out.name.endswith(".jsonl.gz"):
        ap.error("--out precisa terminar em .jsonl.gz (é o que o import_railway.sh lê)")
    n = Normalizer()
    others = [p for p in sorted(ACERVO.glob("*.jsonl.gz")) if p.resolve() != out.resolve()]
    brands = {b.strip() for b in args.brands.split(",") if b.strip()} if args.brands else None
    rows, counts = build(args.files, n, known_urls(others), brands, args.verbose)
    total = Counter()
    for brand in sorted(counts):
        c = counts[brand]
        total.update(c)
        print(f"{brand:<20} " + " · ".join(f"{k} {v}" for k, v in sorted(c.items()) if v))
    print(f"Total: {total['ok']} peças de {sum(1 for b in rows if rows[b])} marcas · {total['com_foto']} com foto"
          + ("  [DRY-RUN]" if args.dry_run else f" → {out}"))
    if not args.dry_run:
        out.parent.mkdir(parents=True, exist_ok=True)
        tmp = out.with_name(out.name + ".tmp")
        with tmp.open("wb") as raw, gzip.GzipFile(filename="", mode="wb", fileobj=raw, compresslevel=9, mtime=0) as gz, \
                io.TextIOWrapper(gz, encoding="utf-8") as fh:          # mtime=0: mesmo conteúdo, mesmo arquivo (diff limpo no git)
            for brand in sorted(rows):
                for item in rows[brand]:
                    fh.write(json.dumps(item, ensure_ascii=False) + "\n")
        tmp.replace(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
