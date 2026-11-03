"""Filhos do produto na importação do catálogo: apelidos, variantes e imagens, inseridos sem duplicar. Mixin do
Ingestor: usa `self.n` e `self.skip_existing`."""
from __future__ import annotations

import logging

from db import new_id, now
from image_metadata import image_type, url_hash, usage_status
from normalize_product import key
from validate_source import blocked, classify

log = logging.getLogger("catalog")


class ProductChildrenUpserts:
    # ───────────────────────── filhos do produto
    def _aliases(self, cur, pid, p) -> int:
        if not p.aliases:
            return 0
        cur.execute("SELECT alias_norm FROM catalog_product_aliases WHERE product_id = %s", (pid,))
        existing = {r["alias_norm"] for r in cur.fetchall()}
        n = 0
        for alias in p.aliases:
            k = key(alias)
            if k and k not in existing:
                ts = now()
                cur.execute("INSERT INTO catalog_product_aliases (id, product_id, alias, alias_norm, version, created_at, updated_at) VALUES (%s,%s,%s,%s,0,%s,%s)",
                            (new_id(), pid, str(alias).strip(), k, ts, ts))
                existing.add(k)
                n += 1
        return n

    def _variants(self, cur, pid, p) -> int:
        if not p.variants:
            return 0
        cur.execute("SELECT * FROM catalog_variants WHERE product_id = %s", (pid,))
        existing = {r["variant_key"]: r for r in cur.fetchall()}
        n = 0
        for v in p.variants:
            vk = key(v.get("code") or v.get("sku") or v.get("gtin") or v.get("color_name") or v.get("color")).replace(" ", "-")
            if not vk:
                continue
            color = self.n.color(v.get("color") or v.get("color_name"))
            row = existing.get(vk)
            ts = now()
            vals = (color, v.get("color_name"), v.get("code"), v.get("sku"), v.get("gtin"))
            if row:
                if self.skip_existing:
                    continue
                if (row["color"], row["color_name"], row["variant_code"], row["sku"], row["gtin"]) != vals:
                    cur.execute("UPDATE catalog_variants SET color=%s, color_name=%s, variant_code=%s, sku=%s, gtin=%s, updated_at=%s, version=version+1 WHERE id=%s",
                                (*vals, ts, row["id"]))
                    existing[vk] = {**row, **dict(zip(("color", "color_name", "variant_code", "sku", "gtin"), vals))}
                    n += 1
                continue
            vid = new_id()
            cur.execute("INSERT INTO catalog_variants (id, product_id, variant_key, color, color_name, variant_code, sku, gtin, version, created_at, updated_at) "
                        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,0,%s,%s)", (vid, pid, vk, *vals, ts, ts))
            existing[vk] = dict(id=vid, color=color, color_name=v.get("color_name"), variant_code=v.get("code"), sku=v.get("sku"), gtin=v.get("gtin"))
            n += 1
        return n

    def _images(self, cur, pid, p, sources) -> int:
        if not p.images:
            return 0
        n = 0
        cur.execute("SELECT image_url_hash, is_primary FROM catalog_images WHERE product_id = %s", (pid,))
        rows = cur.fetchall()
        existing = {r["image_url_hash"] for r in rows}
        has_primary = any(r["is_primary"] for r in rows)
        for img in p.images:
            url = (img or {}).get("url")
            if not url or not url.startswith("https://") or blocked(url):
                log.warning("[SKIP] imagem sem origem permitida: %s", url)
                continue
            h = url_hash(url)
            if h in existing:
                if not self.skip_existing:
                    cur.execute("UPDATE catalog_images SET last_verified_at = %s WHERE product_id = %s AND image_url_hash = %s", (now(), pid, h))
                continue
            st, allows = classify(url, sources)
            ts = now()
            cur.execute("INSERT INTO catalog_images (id, product_id, image_url, image_url_hash, image_type, source_url, source_domain, source_type, "
                        "is_primary, usage_status, retrieved_at, last_verified_at, version, created_at, updated_at) "
                        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,0,%s,%s)",
                        (new_id(), pid, url, h, image_type(img.get("type")), p.official_product_url, url.split("/")[2],
                         st or p.source_type, not has_primary, usage_status(allows), ts, ts, ts, ts))
            has_primary = True
            existing.add(h)
            n += 1
        return n
