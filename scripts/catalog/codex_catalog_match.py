"""Liga cada linha do manifesto do Codex a um produto do catálogo (catalog_products.id), só lendo o banco.

O arquivo do Codex usa ids próprios (20 hex, gerados a partir do .jsonl da marca), não o UUID do catálogo. A ligação,
em ordem de confiança, para no primeiro que der um único produto:

1. ``product_id`` do manifesto já é um UUID que existe no catálogo;
2. URL oficial do produto (``official_product_url``, sem query string, barra final nem diferença de maiúsculas);
3. marca + nome do produto normalizados (sem acento, pontuação e espaços repetidos).

Dois produtos no mesmo critério = ambíguo: a linha fica ``SEM_PRODUTO`` com o motivo, nunca é adivinhada.
"""
from __future__ import annotations

import re
import unicodedata
from urllib.parse import urlsplit

UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
BY_ID = """SELECT p.id, p.product_name, p.category, p.subcategory, p.official_product_url, b.name AS brand
  FROM catalog_products p LEFT JOIN brands b ON b.id = p.brand_id WHERE p.id IN %(ids)s"""
BY_BRAND = """SELECT p.id, p.product_name, p.category, p.subcategory, p.official_product_url, b.name AS brand
  FROM catalog_products p JOIN brands b ON b.id = p.brand_id WHERE LOWER(b.name) IN %(brands)s"""


def url_key(url: str | None) -> str | None:
    if not url or not url.strip():
        return None
    parts = urlsplit(url.strip().lower())
    host = parts.netloc[4:] if parts.netloc.startswith("www.") else parts.netloc
    return f"{host}{parts.path.rstrip('/')}" if host else None


def name_key(brand: str | None, name: str | None) -> str | None:
    if not brand or not name:
        return None
    folded = "".join(c for c in unicodedata.normalize("NFKD", f"{brand} {name}") if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", folded.lower()).strip() or None   # pontuação vira espaço, nunca cola palavras


def _query(conn, sql: str, params: dict) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return list(cur.fetchall())


def _index(products: list[dict], key) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for p in products:
        k = key(p)
        if k:
            out.setdefault(k, []).append(p)
    return out


def resolve(conn, rows: list[dict]) -> dict[int, tuple[dict | None, str]]:
    """Por índice da linha: (produto, critério). Sem produto, o critério diz por quê (``NAO_ACHADO``/``AMBIGUO_*``)."""
    ids = tuple(sorted({r["product_id"] for r in rows if UUID.match(r.get("product_id") or "")}))
    by_id = {str(p["id"]): p for p in _query(conn, BY_ID, {"ids": ids})} if ids else {}
    brands = tuple(sorted({(r.get("brand") or "").strip().lower() for r in rows if (r.get("brand") or "").strip()}))
    pool = _query(conn, BY_BRAND, {"brands": brands}) if brands else []
    by_url = _index(pool, lambda p: url_key(p.get("official_product_url")))
    by_name = _index(pool, lambda p: name_key(p.get("brand"), p.get("product_name")))
    out: dict[int, tuple[dict | None, str]] = {}
    for i, r in enumerate(rows):
        if r.get("product_id") in by_id:
            out[i] = (by_id[r["product_id"]], "ID")
            continue
        out[i] = (None, "NAO_ACHADO")
        for label, index, key in (("URL", by_url, url_key(r.get("official_product_url"))),
                                  ("MARCA_NOME", by_name, name_key(r.get("brand"), r.get("name")))):
            hits = index.get(key, []) if key else []
            if len(hits) == 1:
                out[i] = (hits[0], label)
                break
            if len(hits) > 1:
                out[i] = (None, f"AMBIGUO_{label}")
                break
    return out
