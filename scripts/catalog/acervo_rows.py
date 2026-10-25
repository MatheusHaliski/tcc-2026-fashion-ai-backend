#!/usr/bin/env python3
"""Lista de fotos do acervo para o process_local_sd.py (--input) e para o lote em GPU (packshot_gpu_vm.py --rows).

    python scripts/catalog/acervo_rows.py data/catalog/acervo/*.jsonl.gz --out rows.json
    python scripts/catalog/acervo_rows.py data/catalog/acervo/acervo-oficial-2026-10-24*.jsonl.gz --brands amaro,hering --max-per-brand 50 --out amostra.json

Uma linha por peça (a primeira foto; --all-images traz todas): id = URL oficial do produto, product_id = sku, brand,
category (pela taxonomia de normalization.json), subcategory, image_url. Peça sem foto fica de fora; URL repetida entre
arquivos entra uma vez. As linhas saem intercaladas por host da imagem — um CDN por vez, sem rajada no mesmo servidor, e
o disjuntor de um host (429) não para o lote inteiro.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Iterable, Optional
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parent))

from import_products import read_items  # noqa: E402
from normalize_product import Normalizer, slug  # noqa: E402


def rows_from(paths: Iterable[Path], normalizer: Normalizer, brands: Optional[set[str]] = None, max_per_brand: Optional[int] = None,
              all_images: bool = False) -> list[dict]:
    wanted = {slug(b) for b in brands} if brands else None
    seen: set[str] = set()
    per_brand: dict[str, int] = defaultdict(int)
    out = []
    for path in paths:
        for _, item in read_items(Path(path)):
            url = (item.get("official_product_url") or "").strip()
            brand = (item.get("brand") or "").strip()
            images = [i.get("url") if isinstance(i, dict) else i for i in (item.get("images") or [])]
            images = [u for u in images if isinstance(u, str) and u.startswith(("http://", "https://"))]
            if not url or not brand or not images or url in seen or (wanted and slug(brand) not in wanted):
                continue
            if max_per_brand and per_brand[brand] >= max_per_brand:
                continue
            seen.add(url)
            per_brand[brand] += 1
            subcategory = item.get("subcategory")
            category = normalizer.sub_category.get(subcategory or "")
            for index, image in enumerate(images if all_images else images[:1]):
                out.append({"id": url if index == 0 else f"{url}#img{index}", "product_id": item.get("sku") or url, "brand": brand,
                            "category": category, "subcategory": subcategory, "image_url": image})
    return out


def interleave_by_host(rows: list[dict]) -> list[dict]:
    """Um host de imagem por vez, do mais numeroso ao menos: nenhum CDN recebe pedidos seguidos."""
    queues: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        queues[urlsplit(row["image_url"]).netloc].append(row)
    ordered = sorted(queues.values(), key=len, reverse=True)
    out = []
    while any(ordered):
        for queue in ordered:
            if queue:
                out.append(queue.pop(0))
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0], formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    ap.add_argument("files", nargs="+", type=Path, help="acervos .jsonl.gz (data/catalog/acervo/*.jsonl.gz)")
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--brands", help="slugs separados por vírgula (padrão: todas)")
    ap.add_argument("--max-per-brand", type=int)
    ap.add_argument("--all-images", action="store_true", help="todas as fotos da peça, não só a primeira")
    ap.add_argument("--no-interleave", action="store_true", help="mantém a ordem dos arquivos")
    args = ap.parse_args(argv)
    rows = rows_from(args.files, Normalizer(), {b.strip() for b in args.brands.split(",") if b.strip()} if args.brands else None,
                     args.max_per_brand, args.all_images)
    if not args.no_interleave:
        rows = interleave_by_host(rows)
    args.out.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    brands = defaultdict(int)
    for r in rows:
        brands[r["brand"]] += 1
    hosts = len({urlsplit(r["image_url"]).netloc for r in rows})
    print(f"{len(rows)} fotos de {len(brands)} marcas em {hosts} hosts → {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
