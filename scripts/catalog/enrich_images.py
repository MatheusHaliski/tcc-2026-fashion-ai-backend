#!/usr/bin/env python3
"""RF47 · Completa as fotos dos produtos coletados que ficaram sem imagem (antes de importar).

    python scripts/catalog/enrich_images.py                      # todas as marcas de data/catalog/collected
    python scripts/catalog/enrich_images.py --brands nike,levis --workers 8

Revisita só a página oficial de cada produto sem foto (official_product_url), com as mesmas regras do coletor:
robots.txt e Crawl-delay respeitados, uma requisição por vez por site, 403/429 encerra o domínio. A foto vem do
JSON-LD da página (produto → variantes de cor → og:image) e só de hosts aceitos (domínio oficial, CDN da marca ou
servidor de imagens da plataforma da loja); entra como referência (URL), nunca copiada. Cada JSONL é reescrito por
inteiro (via arquivo temporário). Não rode com o coletor gravando na mesma pasta.
"""
from __future__ import annotations

import argparse
import json
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from collect_official import make_fetch  # noqa: E402
from normalize_product import domain  # noqa: E402
from providers.official_sitemap import (DEFAULT_UA, Politeness, Site, StopDomain, product_images,  # noqa: E402
                                        structured_product)

OUT = Path(__file__).resolve().parents[2] / "data/catalog/collected"


def enrich_file(path: Path, fetch, args, log) -> tuple[int, int]:
    rows = [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]
    missing = [r for r in rows if not r.get("images") and r.get("official_product_url")]
    if not missing:
        return 0, 0
    polite = Politeness(min_interval=args.min_interval)
    sites: dict[str, Site] = {}
    stopped: set[str] = set()
    found = 0
    for r in missing:
        url = r["official_product_url"]
        host = (domain(url) or "").removeprefix("www.")
        if host in stopped:
            continue
        try:
            site = sites.get(host)
            if site is None:
                site = sites[host] = Site(host, fetch, polite, args.user_agent)
                site.load_robots()
            if not site.allowed(url):
                continue
            status, body, ctype = site.get(url)
        except StopDomain as e:
            stopped.add(host)
            log(f"  [{path.stem}] PAROU: {e}")
            continue
        if status != 200 or "html" not in (ctype or "text/html"):
            continue
        page = structured_product(body)
        imgs = product_images(page, host) if page else []
        if imgs:
            r["images"] = [{"url": u, "type": "PACKSHOT"} for u in imgs[:4]]
            found += 1
    if found and not args.dry_run:
        tmp = path.with_suffix(".jsonl.tmp")
        tmp.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
        tmp.replace(path)
    log(f"  [{path.stem}] {found} de {len(missing)} produtos sem foto ganharam foto")
    return len(missing), found


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Completa as fotos dos produtos coletados sem imagem")
    ap.add_argument("--dir", default=str(OUT))
    ap.add_argument("--brands", help="slugs separados por vírgula (nome do arquivo .jsonl)")
    ap.add_argument("--workers", type=int, default=12)
    ap.add_argument("--min-interval", type=float, default=1.5)
    ap.add_argument("--timeout", type=float, default=20)
    ap.add_argument("--user-agent", default=DEFAULT_UA)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)
    only = {b.strip() for b in args.brands.split(",")} if args.brands else None
    files = [p for p in sorted(Path(args.dir).glob("*.jsonl")) if not only or p.stem in only]
    fetch = make_fetch(args.user_agent, timeout=args.timeout)
    lock = threading.Lock()
    log = lambda m: (lock.acquire(), print(m, flush=True), lock.release())
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        results = list(pool.map(lambda p: enrich_file(p, fetch, args, log), files))
    missing, found = sum(r[0] for r in results), sum(r[1] for r in results)
    print(f"Resumo: {found} de {missing} produtos sem foto ganharam foto" + ("  [DRY-RUN: nada gravado]" if args.dry_run else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
