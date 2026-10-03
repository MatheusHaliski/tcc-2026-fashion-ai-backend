"""Deduplicação: identificador forte primeiro (gtin › ean › upc › sku › código › URL canônica), depois a dedup_key
(marca+modelo+variante / marca+título+cor). Nunca só o nome textual."""
from __future__ import annotations

from normalize_product import Product

STRONG = (("gtin", "gtin"), ("ean", "ean"), ("upc", "upc"), ("sku", "sku"), ("product_code", "product_code"),
          ("canonical_url", "canonical_url"))


def find_existing(cur, p: Product, dedup_key: str):
    """(linha existente, motivo) ou (None, None)."""
    for attr, column in STRONG:
        value = getattr(p, attr)
        if value:
            cur.execute(f"SELECT * FROM catalog_products WHERE {column} = %s LIMIT 1", (value,))
            row = cur.fetchone()
            if row:
                return row, f"{column}={value}"
    for attr, column in (("gtin", "gtin"), ("sku", "sku"), ("product_code", "variant_code")):
        value = getattr(p, attr)
        if value:
            cur.execute(f"SELECT p.* FROM catalog_variants v JOIN catalog_products p ON p.id = v.product_id WHERE v.{column} = %s LIMIT 1", (value,))
            row = cur.fetchone()
            if row:
                return row, f"variante {column}={value}"
    cur.execute("SELECT * FROM catalog_products WHERE dedup_key = %s", (dedup_key,))
    row = cur.fetchone()
    if row:
        return row, f"dedup_key={dedup_key}"
    return None, None


def find_same_model(cur, brand_id: str, p: Product):
    """Mesmo modelo (marca + subcategoria + modelo) com outra cor = VARIANTE do produto, não produto novo."""
    if not p.model_name:
        return None
    cur.execute("SELECT * FROM catalog_products WHERE brand_id = %s AND subcategory = %s AND LOWER(model_name) = LOWER(%s) "
                "ORDER BY created_at LIMIT 1", (brand_id, p.subcategory, p.model_name))
    return cur.fetchone()
