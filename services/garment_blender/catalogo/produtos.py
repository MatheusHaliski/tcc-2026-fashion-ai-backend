"""Os produtos do catálogo de expansão (``data/catalog/expansion/products/*.jsonl``) que viram peça de cima 3D."""
from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from . import texto
from .ficha import BASES

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "data/catalog/expansion/products"


def read_all(source: Path = SOURCE) -> list[dict]:
    out = []
    for f in sorted(source.glob("*.jsonl")):
        with f.open(encoding="utf-8") as handle:
            out.extend(json.loads(line) for line in handle if line.strip())
    return out


def tops(products: list[dict]) -> list[dict]:
    return [p for p in products if p.get("subcategory") in BASES]


def ident(p: dict) -> str:
    """Nome estável da pasta do produto: marca + hash do endereço oficial (ou de marca, nome e sku)."""
    key = p.get("official_product_url") or f"{p.get('brand')}|{p.get('product_name')}|{p.get('sku')}"
    brand = re.sub(r"[^a-z0-9]+", "-", texto.plain(p.get("brand"))).strip("-")[:24] or "marca"
    return f"{brand}-{hashlib.sha1(key.encode('utf-8')).hexdigest()[:10]}"


def shard(name: str, parts: int) -> int:
    """Em qual das ``parts`` partes do lote o produto cai (estável: pelo hash do nome da pasta)."""
    return int(hashlib.sha1(name.encode("utf-8")).hexdigest()[:8], 16) % max(1, parts)


def image_urls(p: dict, limit: int = 3) -> list[str]:
    seen, out = set(), []
    for img in p.get("images") or []:
        url = str((img.get("url") if isinstance(img, dict) else img) or "").strip()
        if url.startswith("http") and url not in seen:
            seen.add(url)
            out.append(url)
    return out[:limit]


def brand_prior(products: list[dict], share: float = 0.8) -> dict[str, str]:
    """Sexo de cada marca quando quase todos os produtos dela (com sexo dito) são de um só (marca feminina, masculina)."""
    votes: dict[str, Counter] = defaultdict(Counter)
    for p in products:
        g = (p.get("gender") or "").upper()
        if g not in ("FEMININO", "MASCULINO"):
            g = texto.sex_of(texto.plain(f"{p.get('product_name')} {p.get('official_product_url')}")) or ""
        if g:
            votes[(p.get("brand") or "").strip().lower()][g] += 1
    out = {}
    for brand, c in votes.items():
        top, n = c.most_common(1)[0]
        if n >= 5 and n / sum(c.values()) >= share:
            out[brand] = top
    return out
