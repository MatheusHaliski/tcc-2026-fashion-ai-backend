"""Deduplicação: identificador forte primeiro (gtin › ean › upc › sku › código › URL canônica), depois a dedup_key
(marca+modelo+variante / marca+título+cor). Nunca só o nome textual."""
from __future__ import annotations

from normalize_product import Product

STRONG = (("gtin", "gtin"), ("ean", "ean"), ("upc", "upc"), ("sku", "sku"), ("product_code", "product_code"),
          ("canonical_url", "canonical_url"))


def find_existing(cur, p: Product, dedup_key: str):
    """Uma viagem ao MySQL, preservando a prioridade dos identificadores (cada ramo usa seu índice)."""
    branches, params = [], []

    def add(query, value, reason):
        branches.append(query)
        params.extend((len(branches), reason, value))

    for attr, column in STRONG:
        value = getattr(p, attr)
        if value:
            add(f"SELECT p.*, %s AS match_priority, %s AS match_reason FROM catalog_products p WHERE p.{column} = %s",
                value, f"{column}={value}")
    for attr, column in (("gtin", "gtin"), ("sku", "sku"), ("product_code", "variant_code")):
        value = getattr(p, attr)
        if value:
            add(f"SELECT p.*, %s AS match_priority, %s AS match_reason FROM catalog_variants v "
                f"JOIN catalog_products p ON p.id = v.product_id WHERE v.{column} = %s",
                value, f"variante {column}={value}")
    add("SELECT p.*, %s AS match_priority, %s AS match_reason FROM catalog_products p WHERE p.dedup_key = %s",
        dedup_key, f"dedup_key={dedup_key}")
    cur.execute(" UNION ALL ".join(branches) + " ORDER BY match_priority LIMIT 1", tuple(params))
    row = cur.fetchone()
    if row:
        reason = row.pop("match_reason")
        row.pop("match_priority")
        return row, reason
    return None, None


def find_same_model(cur, brand_id: str, p: Product):
    """Mesmo modelo (marca + subcategoria + modelo) com outra cor = VARIANTE do produto, não produto novo."""
    if not p.model_name:
        return None
    cur.execute("SELECT * FROM catalog_products WHERE brand_id = %s AND subcategory = %s AND LOWER(model_name) = LOWER(%s) "
                "ORDER BY created_at LIMIT 1", (brand_id, p.subcategory, p.model_name))
    return cur.fetchone()
