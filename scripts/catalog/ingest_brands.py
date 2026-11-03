"""Upsert de marca, apelidos de marca e fontes oficiais da importação do catálogo (mesmas regras do
CatalogIngestService). Mixin do Ingestor: usa `self.n`, `self.report`, `self.skip_existing`, `self.create_brands` e os
caches `_brands`, `_sources` e `_brand_aliases`."""
from __future__ import annotations

from db import new_id, now
from normalize_product import ValidationError, key, slug
from source_persistence import normalize_domain
from validate_source import SOURCE_TYPES


class BrandSourceUpserts:
    # ───────────────────────── marcas
    def brand_by_name(self, cur, name: str):
        s = self.n.brand_slug(name)
        cache_key = (s, key(name))
        if self.skip_existing and cache_key in self._brands:
            return self._brands[cache_key]
        cur.execute("SELECT * FROM brands WHERE slug = %s", (s,))
        row = cur.fetchone()
        if not row:
            cur.execute("SELECT b.* FROM brand_aliases a JOIN brands b ON b.id = a.brand_id WHERE a.alias_norm = %s", (key(name),))
            row = cur.fetchone()
        if row and self.skip_existing:
            self._brands[cache_key] = row
        return row

    def upsert_brand(self, cur, b: dict) -> tuple[dict, str]:
        row = self.brand_by_name(cur, b["name"])
        if row and self.skip_existing:
            return row, "SKIP"
        ts = now()
        if row:
            changes = {k: b[k] for k in ("website", "country", "logo_url") if b.get(k) and row.get(k) != b.get(k)}
            if changes:
                sets = ", ".join(f"{k} = %s" for k in changes)
                cur.execute(f"UPDATE brands SET {sets}, updated_at = %s, version = version + 1 WHERE id = %s",
                            (*changes.values(), ts, row["id"]))
                return {**row, **changes}, "UPDATE"
            return row, "SKIP"
        if not self.create_brands:
            raise ValidationError(f"marca desconhecida: {b['name']}")
        bid = new_id()
        cur.execute("INSERT INTO brands (id, name, slug, logo_url, website, source, country, version, created_at, updated_at) "
                    "VALUES (%s,%s,%s,%s,%s,'SEEDED',%s,0,%s,%s)",
                    (bid, b["name"], self.n.brand_slug(b["name"]) if self.n.brand_slug(b["name"]) else slug(b["name"]),
                     b.get("logo_url"), b.get("website"), b.get("country"), ts, ts))
        cur.execute("SELECT * FROM brands WHERE id = %s", (bid,))
        row = cur.fetchone()
        if self.skip_existing:
            self._brands[(self.n.brand_slug(b["name"]), key(b["name"]))] = row
        return row, "CREATE"

    def upsert_brand_alias(self, cur, brand_id: str, alias: str) -> str:
        k = key(alias)
        if not k:
            return "SKIP"
        cur.execute("SELECT brand_id FROM brand_aliases WHERE alias_norm = %s", (k,))
        row = cur.fetchone()
        if row:
            if row["brand_id"] != brand_id:
                self.report.error_details.append(f"apelido '{alias}' já pertence a outra marca")
            return "SKIP"
        ts = now()
        cur.execute("INSERT INTO brand_aliases (id, brand_id, alias, alias_norm, version, created_at, updated_at) VALUES (%s,%s,%s,%s,0,%s,%s)",
                    (new_id(), brand_id, alias.strip(), k, ts, ts))
        self._brand_aliases.pop(brand_id, None)
        return "CREATE"

    def upsert_source(self, cur, brand_id: str, src: dict) -> str:
        if src.get("source_type") not in SOURCE_TYPES:
            raise ValidationError(f"tipo de fonte inválido: {src.get('source_type')}")
        d = normalize_domain(src["domain"])
        if not d:
            raise ValidationError("domínio da fonte inválido")
        if "allows_image_persistence" in src and not isinstance(src["allows_image_persistence"], bool):
            raise ValidationError("allows_image_persistence deve ser booleano explícito")
        cur.execute("SELECT * FROM catalog_sources WHERE brand_id = %s AND domain = %s", (brand_id, d))
        row = cur.fetchone()
        if row and self.skip_existing:
            return "SKIP"
        ts = now()
        allows = src.get("allows_image_persistence", bool(row["allows_image_persistence"]) if row else False)
        if row:
            if row["source_type"] != src["source_type"] or bool(row["allows_image_persistence"]) != allows or row.get("country") != src.get("country"):
                cur.execute("UPDATE catalog_sources SET source_type=%s, allows_image_persistence=%s, country=%s, updated_at=%s, version=version+1 WHERE id=%s",
                            (src["source_type"], allows, src.get("country"), ts, row["id"]))
                self._sources.pop(brand_id, None)
                return "UPDATE"
            return "SKIP"
        cur.execute("INSERT INTO catalog_sources (id, brand_id, domain, source_type, country, allows_image_persistence, active, notes, version, created_at, updated_at) "
                    "VALUES (%s,%s,%s,%s,%s,%s,TRUE,%s,0,%s,%s)",
                    (new_id(), brand_id, d, src["source_type"], src.get("country"), allows, src.get("notes"), ts, ts))
        self._sources.pop(brand_id, None)
        return "CREATE"

    def official_sources(self, cur, brand_id: str):
        if self.skip_existing and brand_id in self._sources:
            return self._sources[brand_id]
        cur.execute("SELECT domain, source_type, allows_image_persistence FROM catalog_sources WHERE brand_id = %s AND active = TRUE", (brand_id,))
        rows = cur.fetchall()
        if self.skip_existing:
            self._sources[brand_id] = rows
        return rows
