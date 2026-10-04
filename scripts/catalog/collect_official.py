#!/usr/bin/env python3
"""RF47 · Coleta nomes/dados de produtos dos sites OFICIAIS das marcas e grava um JSONL por marca, pronto para importar.

    python scripts/catalog/collect_official.py --brands nike,adidas --max-per-brand 3000
    python scripts/catalog/collect_official.py --max-per-brand 2000 --min-interval 2      # todas as marcas cadastradas
    python scripts/catalog/import_products.py data/catalog/collected/nike.jsonl --dry-run

Fontes: só os domínios OFFICIAL_BRAND / OFFICIAL_STORE / AUTHORIZED_RETAILER de data/catalog/brands.json (RN47.04).
Cada domínio: robots.txt (bloqueio e Crawl-delay respeitados) → sitemaps → páginas de produto → JSON-LD/OpenGraph.
403/429 encerra o domínio. Não baixa imagens (só a URL, REFERENCE_ONLY). Não acessa o banco: a importação é um passo
separado (import_products.py), com dry-run e dedup.

Retomada: as URLs já visitadas ficam em <out>/.state/<marca>.visited; rodar de novo continua de onde parou e não
repete produto (o JSONL é acrescentado, nunca reescrito). --fresh apaga o estado e o JSONL da marca antes de começar.

Rede: urllib com o proxy do ambiente (HTTPS_PROXY/HTTP_PROXY), timeout e novas tentativas em erro 5xx/timeout.
Logs não mostram credenciais nem cabeçalhos — só domínio, contagens e motivos de descarte.

Opcional por marca em brands.json: "collector": {"product_patterns": ["/p/"], "sitemap_patterns": ["product"]}.
"""
from __future__ import annotations

import argparse
import json
import socket
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from normalize_product import Normalizer, ValidationError, domain, normalize_product, slug  # noqa: E402
from providers.official_sitemap import (DEFAULT_UA, PRODUCT_HINTS, Politeness, Site, collect)  # noqa: E402
from validate_source import same_site  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
BRANDS = ROOT / "data/catalog/brands.json"
OUT = ROOT / "data/catalog/collected"
ALLOWED_SOURCES = ("OFFICIAL_BRAND", "OFFICIAL_STORE", "AUTHORIZED_RETAILER")
MAX_BODY = 25 * 1024 * 1024


def make_fetch(user_agent: str, timeout: float = 20, retries: int = 2, sleep=time.sleep):
    """fetch(url) -> (status, corpo, content-type). Redirecionamento para fora do domínio pedido vira status 0."""
    def fetch(url: str) -> tuple[int, bytes, str]:
        req = urllib.request.Request(url, headers={"User-Agent": user_agent, "Accept-Encoding": "identity",
                                                   "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5"})
        for attempt in range(retries + 1):
            try:
                with urllib.request.urlopen(req, timeout=timeout) as r:
                    asked = domain(url) or ""
                    final = domain(r.geturl()) or ""
                    if final and not (same_site(final, asked) or same_site(asked, final) or same_site(final, asked.removeprefix("www."))):
                        return 0, b"", ""
                    return r.status, r.read(MAX_BODY), r.headers.get("Content-Type", "")
            except urllib.error.HTTPError as e:
                if e.code >= 500 and attempt < retries:
                    sleep(2 ** (attempt + 1))
                    continue
                return e.code, b"", ""
            except (urllib.error.URLError, socket.timeout, TimeoutError, ConnectionError):
                if attempt < retries:
                    sleep(2 ** (attempt + 1))
                    continue
                return 0, b"", ""
        return 0, b"", ""
    return fetch


def official_sources(brands: list[dict], only: set[str] | None) -> list[tuple[dict, dict]]:
    out = []
    for b in brands:
        if only and slug(b["name"]) not in only and b["name"].lower() not in only:
            continue
        for s in b.get("sources", []):
            if s.get("source_type") in ALLOWED_SOURCES and s.get("domain"):
                out.append((b, s))
    return out


def load_lines(path: Path) -> set[str]:
    return set(path.read_text(encoding="utf-8").split()) if path.exists() else set()


def run(args, fetch=None, brands=None, log=print) -> dict:
    n = Normalizer()
    brands = brands if brands is not None else json.loads(BRANDS.read_text(encoding="utf-8"))
    only = {x.strip().lower() for x in args.brands.split(",")} if args.brands else None
    sources = official_sources(brands, only)
    if not sources:
        log("[ERROR] nenhuma fonte oficial encontrada para as marcas pedidas")
        return {"brands": 0, "accepted": 0}
    out_dir = Path(args.out)
    state_dir = out_dir / ".state"
    if not args.dry_run:
        state_dir.mkdir(parents=True, exist_ok=True)
    fetch = fetch or make_fetch(args.user_agent, timeout=args.timeout)
    polite = Politeness(min_interval=args.min_interval)
    total = {"brands": 0, "domains": 0, "pages": 0, "accepted": 0, "invalid": 0, "stopped": []}
    per_brand: dict[str, int] = {}
    for brand, src in sources:
        bslug = slug(brand["name"])
        remaining = args.max_per_brand - per_brand.get(bslug, 0)
        if remaining <= 0:
            continue
        jsonl, visited_file = out_dir / f"{bslug}.jsonl", state_dir / f"{bslug}.visited"
        if args.fresh and not args.dry_run:
            for f in (jsonl, visited_file):
                f.unlink(missing_ok=True)
        visited = load_lines(visited_file)
        seen_urls = {json.loads(l).get("official_product_url") for l in jsonl.read_text(encoding="utf-8").splitlines() if l.strip()} \
            if jsonl.exists() else set()
        before = set(visited)
        cfg = brand.get("collector") or {}
        warnings: list[str] = []
        written = 0
        fh = None                                                 # aberto só no 1º produto (sem arquivo vazio)

        def on_item(item: dict):
            nonlocal written
            try:
                normalize_product(item, n)                        # o que vai para o JSONL já passa na importação
            except ValidationError as e:
                warnings.append(f"{item.get('official_product_url')}: {e}")
                total["invalid"] += 1
                return
            if item.get("official_product_url") in seen_urls:
                return
            seen_urls.add(item.get("official_product_url"))
            nonlocal fh
            written += 1
            if not args.dry_run:
                if fh is None:
                    fh = jsonl.open("a", encoding="utf-8")
                fh.write(json.dumps(item, ensure_ascii=False) + "\n")
                fh.flush()
            if args.verbose:
                log(f"  + {item['product_name']} ({item['subcategory']})")

        log(f"→ {brand['name']} · {src['domain']} ({src['source_type']}) · até {remaining} produtos")
        site = Site(src["domain"], fetch, polite, args.user_agent)
        try:
            rep = collect(site, brand["name"], src["source_type"], n, remaining,
                          product_patterns=tuple(cfg.get("product_patterns") or PRODUCT_HINTS),
                          sitemap_patterns=tuple(cfg.get("sitemap_patterns") or ()), visited=visited,
                          warnings=warnings, on_item=on_item)
        finally:
            if fh:
                fh.close()
            if not args.dry_run:
                new = visited - before
                if new:
                    with visited_file.open("a", encoding="utf-8") as vf:
                        vf.write("\n".join(sorted(new)) + "\n")
        per_brand[bslug] = per_brand.get(bslug, 0) + written
        total["domains"] += 1
        total["pages"] += rep["pages"]
        total["accepted"] += written
        if rep["stopped"]:
            total["stopped"].append(rep["stopped"])
        log(f"  {rep['pages']} páginas · {written} produtos novos · {rep['skipped']} descartadas · "
            f"{rep['blocked_by_robots']} bloqueadas pelo robots.txt · {site.requests} requisições"
            + (f" · PAROU: {rep['stopped']}" if rep["stopped"] else ""))
        for w in warnings[: (len(warnings) if args.verbose else 5)]:
            log(f"  [WARN] {w}")
        if not args.verbose and len(warnings) > 5:
            log(f"  [WARN] … mais {len(warnings) - 5} avisos (use --verbose)")
    total["brands"] = len(per_brand)
    log(f"Resumo: {total['brands']} marcas · {total['domains']} domínios · {total['pages']} páginas · "
        f"{total['accepted']} produtos novos · {total['invalid']} inválidos · {len(total['stopped'])} domínios pararam"
        + ("  [DRY-RUN: nada gravado]" if args.dry_run else f" · saída em {out_dir}"))
    return total


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description="Coleta produtos dos sites oficiais das marcas (sitemaps + JSON-LD) em JSONL")
    ap.add_argument("--brands", help="marcas separadas por vírgula (nome ou slug); padrão: todas de brands.json")
    ap.add_argument("--max-per-brand", type=int, default=2000, help="produtos novos por marca nesta execução")
    ap.add_argument("--min-interval", type=float, default=1.5, help="segundos mínimos entre requisições no mesmo domínio")
    ap.add_argument("--timeout", type=float, default=20, help="timeout de cada requisição (s)")
    ap.add_argument("--user-agent", default=DEFAULT_UA, help="User-Agent identificável (o robots.txt é lido para ele)")
    ap.add_argument("--out", default=str(OUT), help="pasta de saída (um <marca>.jsonl por marca)")
    ap.add_argument("--fresh", action="store_true", help="apaga o JSONL e o estado da marca antes de coletar")
    ap.add_argument("--dry-run", action="store_true", help="coleta e valida, mas não grava arquivos")
    ap.add_argument("--verbose", action="store_true", help="lista cada produto aceito e todos os avisos")
    return ap


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    total = run(args)
    return 0 if total.get("accepted", 0) or total.get("domains") else 1


if __name__ == "__main__":
    sys.exit(main())
