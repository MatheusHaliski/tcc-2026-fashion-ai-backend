"""Dados estruturados que a marca publica para buscadores: JSON-LD schema.org Product/ProductGroup e, na falta,
OpenGraph (og:type=product) — nada de HTML livre."""
from __future__ import annotations

import html
import json
import re
from typing import Iterator, Optional

# ───────────────────────── dados estruturados da página

# atributos com ou sem aspas: lojas com HTML minificado escrevem <script type=application/ld+json> e
# <meta property=og:type content=product> (ex.: Baw Clothing), que antes passavam como "sem dados estruturados"
_LD = re.compile(r'<script[^>]+type=["\']?application/ld\+json["\']?[^>]*>(.*?)</script>', re.S | re.I)
_META_TAG = re.compile(r"<meta\b[^>]*>", re.I)
_ATTR = re.compile(r"""([a-zA-Z_:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))""")


def _metas(text: str) -> dict:
    """property/name → content de cada <meta>, com ou sem aspas (o último vence, como antes)."""
    out = {}
    for tag in _META_TAG.findall(text):
        attrs = {}
        for m in _ATTR.finditer(tag):
            attrs[m.group(1).lower()] = next(g for g in (m.group(2), m.group(3), m.group(4)) if g is not None)
        key = (attrs.get("property") or attrs.get("name") or "").lower()
        if key and "content" in attrs:
            out[key] = attrs["content"]
    return out


def _walk(node) -> Iterator[dict]:
    if isinstance(node, dict):
        yield node
        for v in node.values():
            yield from _walk(v)
    elif isinstance(node, list):
        for v in node:
            yield from _walk(v)


def _types(n: dict) -> set:
    t = n.get("@type")
    return set(t if isinstance(t, list) else [t]) if t else set()


def _text(v) -> Optional[str]:
    if v is None:
        return None
    if isinstance(v, dict):
        v = v.get("name") or v.get("@value")
    if isinstance(v, list):
        v = v[0] if v else None
    s = html.unescape(str(v)).strip() if v is not None else ""
    return re.sub(r"\s+", " ", s) or None


def _images(v) -> list[str]:
    out = []
    for item in v if isinstance(v, list) else [v]:
        if isinstance(item, dict):
            item = item.get("url") or item.get("contentUrl")
        if isinstance(item, str):
            item = item.strip()
            if item.startswith("//"):
                item = "https:" + item
            if item.startswith("http://"):                      # CDNs de loja servem https (o acervo só guarda https)
                item = "https://" + item[len("http://"):]
            if item.startswith("https://"):
                out.append(item)
    return out


def _ld_json(block: str):
    """JSON-LD como a página publicou; só se não for JSON válido, tenta com as entidades HTML convertidas. Converter
    antes quebrava o JSON: um "&quot;" dentro de uma avaliação (VTEX: Hering, Renner…) virava aspas soltas e o produto
    inteiro era descartado como "sem dados estruturados"."""
    raw = block.strip()
    for candidate in (raw, html.unescape(raw)):
        try:
            return json.loads(candidate)
        except ValueError:
            continue
    return None


def structured_product(page: bytes) -> Optional[dict]:
    """Product/ProductGroup do JSON-LD da página; sem JSON-LD de produto, o OpenGraph (og:type=product).
    O og:image vem junto: é a imagem que a própria página declara, usada quando o JSON-LD não traz foto."""
    text = page.decode("utf-8", "replace")
    meta = _metas(text)
    og_image = html.unescape(meta.get("og:image") or "") or None
    for block in _LD.findall(text):
        data = _ld_json(block)
        if data is None:
            continue
        nodes = list(_walk(data))
        group = next((n for n in nodes if "ProductGroup" in _types(n)), None)
        prod = group or next((n for n in nodes if "Product" in _types(n)), None)
        if prod:
            variants = [n for n in (prod.get("hasVariant") or []) if isinstance(n, dict)] if group else []
            return {"kind": "jsonld", "node": prod, "variants": variants, "og_image": og_image}
    og_type = meta.get("og:type", "").lower().removeprefix("og:")
    if og_type.startswith("product") or meta.get("product:retailer_item_id"):
        return {"kind": "og", "node": {"name": meta.get("og:title"), "description": meta.get("og:description"),
                                         "image": meta.get("og:image"), "sku": meta.get("product:retailer_item_id"),
                                         "color": meta.get("product:color")}, "variants": [], "og_image": og_image}
    return None
