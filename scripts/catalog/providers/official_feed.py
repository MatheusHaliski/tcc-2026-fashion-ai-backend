"""Provedor de feed oficial (JSON) publicado pela marca ou por parceiro autorizado.

    python scripts/catalog/providers/official_feed.py https://parceiro.exemplo/feed.json --brand Nike --domain nike.com > lote.json
    python scripts/catalog/import_products.py lote.json --dry-run

Recusa feeds fora do domínio declarado e itens com URLs de outros domínios; não baixa imagens (só referencia)."""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from normalize_product import domain  # noqa: E402
from validate_source import same_site  # noqa: E402


def fetch(url: str, brand: str, official: str) -> list[dict]:
    if not same_site(domain(url), official):
        raise SystemExit(f"feed fora do domínio oficial {official}: {url}")
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "FashionAI-Catalog/1.0"}), timeout=20) as r:
        data = json.loads(r.read().decode("utf-8"))
    out = []
    for item in data if isinstance(data, list) else data.get("products", []):
        item = {**item, "brand": item.get("brand") or brand, "source_type": item.get("source_type") or "PARTNER_API"}
        urls = [item.get("official_product_url")] + [i.get("url") for i in item.get("images", [])]
        if all(u is None or same_site(domain(u), official) or official.split(".")[0] in (domain(u) or "") for u in urls):
            out.append(item)
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--brand", required=True)
    ap.add_argument("--domain", required=True)
    a = ap.parse_args()
    json.dump(fetch(a.url, a.brand, a.domain), sys.stdout, ensure_ascii=False, indent=1)
