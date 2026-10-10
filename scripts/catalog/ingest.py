"""Núcleo do FashionAI Catalog Ingestion Pipeline: upsert idempotente de marca, apelidos, fontes oficiais, produto,
variantes, imagens e apelidos de produto. Mesmas regras do CatalogIngestService (Java)."""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field

import time

from db import is_connection_lost, new_id, now, transaction
from deduplicate import find_existing, find_same_model
from image_metadata import image_type, url_hash, usage_status
from normalize_product import Normalizer, Product, ValidationError, key, normalize_product, slug
from validate_source import SOURCE_TYPES, blocked, classify

log = logging.getLogger("catalog")
AUDIT = ("version", "created_at", "updated_at")



def same_value(column: str, current, new) -> bool:
    """design_json volta do MySQL reformatado (ordem e espaços): compara o JSON, não o texto — rodar de novo não regrava."""
    if column == "design_json" and current is not None:
        try:
            return json.loads(current) == json.loads(new)
        except (TypeError, ValueError):
            return False
    return current == new

@dataclass
class Report:
    total_read: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    duplicates_found: int = 0
    errors: int = 0
    error_details: list = field(default_factory=list)

    def as_dict(self):
        return {"total_read": self.total_read, "created": self.created, "updated": self.updated, "skipped": self.skipped,
                "duplicates_found": self.duplicates_found, "errors": self.errors}

    def print(self, title="Relatório"):
        print(f"\n{title}")
        for k, v in self.as_dict().items():
            print(f"  {k:<17} {v}")
        for e in self.error_details[:50]:
            print(f"  · {e}")


class Ingestor:
    def __init__(self, conn, dry_run=False, create_brands=True, overwrite=False, reconnect=None, retries=4):
        self.conn = conn
        # queda de conexão no meio do lote: reconecta e repete o item (a transação por produto garante que nada ficou
        # pela metade); sem isso, todo item depois da queda virava ERROR e o lote "terminava" sem inserir o resto
        self.reconnect = reconnect
        self.retries = retries
        self.dry_run = dry_run
        self.create_brands = create_brands
        # merge seguro: produto existente só ganha campos que estavam vazios; --overwrite = curadoria explícita
        self.overwrite = overwrite
        # identificadores já vistos nesta execução (o --dry-run desfaz cada item, então a memória detecta
        # duplicatas dentro do próprio lote)
        self.seen: dict[str, str] = {}
        self.n = Normalizer()
        self.report = Report()

    # ───────────────────────── marcas
    def brand_by_name(self, cur, name: str):
        s = self.n.brand_slug(name)
        cur.execute("SELECT * FROM brands WHERE slug = %s", (s,))
        row = cur.fetchone()
        if row:
            return row
        cur.execute("SELECT b.* FROM brand_aliases a JOIN brands b ON b.id = a.brand_id WHERE a.alias_norm = %s", (key(name),))
        return cur.fetchone()

    def upsert_brand(self, cur, b: dict) -> tuple[dict, str]:
        row = self.brand_by_name(cur, b["name"])
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
        return cur.fetchone(), "CREATE"

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
        return "CREATE"

    def upsert_source(self, cur, brand_id: str, src: dict) -> str:
        if src.get("source_type") not in SOURCE_TYPES:
            raise ValidationError(f"tipo de fonte inválido: {src.get('source_type')}")
        d = src["domain"].lower().removeprefix("www.")
        cur.execute("SELECT * FROM catalog_sources WHERE brand_id = %s AND domain = %s", (brand_id, d))
        row = cur.fetchone()
        ts = now()
        allows = bool(src.get("allows_image_persistence", False))
        if row:
            if row["source_type"] != src["source_type"] or bool(row["allows_image_persistence"]) != allows or row.get("country") != src.get("country"):
                cur.execute("UPDATE catalog_sources SET source_type=%s, allows_image_persistence=%s, country=%s, active=TRUE, updated_at=%s, version=version+1 WHERE id=%s",
                            (src["source_type"], allows, src.get("country"), ts, row["id"]))
                return "UPDATE"
            return "SKIP"
        cur.execute("INSERT INTO catalog_sources (id, brand_id, domain, source_type, country, allows_image_persistence, active, notes, version, created_at, updated_at) "
                    "VALUES (%s,%s,%s,%s,%s,%s,TRUE,%s,0,%s,%s)",
                    (new_id(), brand_id, d, src["source_type"], src.get("country"), allows, src.get("notes"), ts, ts))
        return "CREATE"

    def official_sources(self, cur, brand_id: str):
        cur.execute("SELECT domain, source_type, allows_image_persistence FROM catalog_sources WHERE brand_id = %s AND active = TRUE", (brand_id,))
        return cur.fetchall()

    # ───────────────────────── produtos
    def search_text(self, cur, brand: dict, p: Product) -> str:
        cur.execute("SELECT alias FROM brand_aliases WHERE brand_id = %s ORDER BY created_at", (brand["id"],))
        parts = [brand["name"], *[r["alias"] for r in cur.fetchall()], p.product_name, p.model_name, p.color_name, p.color,
                 p.collection, p.description, p.product_code, p.sku, p.gtin, p.subcategory.replace("_", " "), *p.aliases,
                 *[v.get("color_name") or v.get("color") or "" for v in p.variants]]
        seen, out = set(), []
        for part in parts:
            if part and part not in seen:
                seen.add(part)
                out.append(part)
        return key(" ".join(out))

    def ingest(self, raw: dict, label: str = "") -> str:
        """Um item = uma transação. Devolve CREATE / UPDATE / SKIP / DUPLICATE / ERROR (e loga)."""
        self.report.total_read += 1
        try:
            p = normalize_product(raw, self.n)
        except ValidationError as e:
            return self._error(f"{label} {e}")
        attempt = 0
        while True:
            try:
                with transaction(self.conn, self.dry_run):
                    with self.conn.cursor() as cur:
                        outcome = self._upsert(cur, p)
                break
            except ValidationError as e:
                return self._error(f"{label} {e}")
            except Exception as e:  # erro de banco: registra e segue o lote
                if self.reconnect is not None and is_connection_lost(e) and attempt < self.retries:
                    attempt += 1
                    wait = min(60, 5 * 2 ** (attempt - 1))
                    log.warning("[REDE] conexão perdida em %s (%s); reconectando em %ss (tentativa %s de %s)",
                                label, type(e).__name__, wait, attempt, self.retries)
                    time.sleep(wait)
                    try:
                        self.conn.close()
                    except Exception:
                        pass
                    try:
                        self.conn = self.reconnect()
                    except Exception as e2:
                        log.warning("[REDE] reconexão falhou: %s", type(e2).__name__)
                    continue
                return self._error(f"{label} {type(e).__name__}: {e}")
        for w in p.warnings:
            log.warning("[WARN] %s %s: %s", p.brand, p.product_name, w)
        return outcome

    def _error(self, msg: str) -> str:
        self.report.errors += 1
        self.report.error_details.append(msg.strip())
        log.error("[ERROR] %s", msg.strip())
        return "ERROR"

    def _upsert(self, cur, p: Product) -> str:
        brand = self.brand_by_name(cur, p.brand)
        if not brand:
            if not self.create_brands:
                raise ValidationError(f"marca desconhecida: {p.brand}")
            brand, _ = self.upsert_brand(cur, {"name": p.brand})
        if p.official_product_url and blocked(p.official_product_url):
            raise ValidationError(f"fonte não permitida (não oficial): {p.official_product_url}")
        sources = self.official_sources(cur, brand["id"])
        if p.official_product_url:
            st, _ = classify(p.official_product_url, sources)
            if st:
                p.source_type = st
            elif p.source_type in ("OFFICIAL_BRAND", "OFFICIAL_STORE"):
                raise ValidationError(f"{p.source_domain} não é domínio oficial cadastrado de {brand['name']}")
        if p.source_type not in SOURCE_TYPES:
            raise ValidationError(f"tipo de fonte inválido: {p.source_type}")
        dedup = self.n.dedup_key(brand["slug"], p)
        existing, why = find_existing(cur, p, dedup)
        if existing is None:
            same = find_same_model(cur, brand["id"], p)
            if same is not None:
                existing, why = same, f"modelo {p.model_name} (nova variante {p.color_name or p.color})"
                if not p.variants and (p.color_name or p.color):
                    p.variants = [{"color": p.color, "color_name": p.color_name, "code": p.product_code, "sku": p.sku, "gtin": p.gtin}]
                # a cor/código desta linha pertencem à variante; o produto mantém os dados da primeira cor
                p.color = p.color_name = p.product_code = p.sku = p.gtin = p.ean = p.upc = None
        if existing is not None and why and why.startswith("variante"):
            p.gtin = p.sku = p.product_code = None   # o identificador é da variante, não do produto
        ids = [f"{a}:{getattr(p, a)}" for a in ("gtin", "ean", "upc", "sku", "product_code", "canonical_url") if getattr(p, a)] + [dedup]
        earlier = next((self.seen[i] for i in ids if i in self.seen), None)
        for i in ids:
            self.seen.setdefault(i, p.product_name)
        if existing is None and earlier is not None and self.dry_run:
            self.report.duplicates_found += 1
            self.report.skipped += 1
            log.info("[DUP] %s %s repete um item anterior do lote (%s)", brand["name"], p.product_name, earlier)
            return "DUPLICATE"
        ts = now()
        cols = dict(brand_id=brand["id"], category=p.category, subcategory=p.subcategory, product_name=p.product_name,
                    model_name=p.model_name, product_code=p.product_code, sku=p.sku, gtin=p.gtin, ean=p.ean, upc=p.upc,
                    color=p.color, color_name=p.color_name, material=p.material, collection=p.collection, gender=p.gender,
                    description=p.description, design_json=json.dumps(p.design, ensure_ascii=False) if p.design else None,
                    official_product_url=p.official_product_url, canonical_url=p.canonical_url, source_type=p.source_type,
                    source_domain=p.source_domain, search_text=self.search_text(cur, brand, p))
        if existing:
            title_differs = existing["product_name"] != p.product_name
            if (existing["dedup_key"] != dedup or title_differs) and earlier is not None or (why and not why.startswith("dedup_key")):
                self.report.duplicates_found += 1
                log.info("[DUP] %s %s já existe como \"%s\" (%s)", brand["name"], p.product_name, existing["product_name"], why)
            if self.overwrite:
                changed = {k: v for k, v in cols.items() if v is not None and not same_value(k, existing.get(k), v)}
            else:
                changed = {k: v for k, v in cols.items() if v is not None and existing.get(k) is None}
            pid = existing["id"]
            if changed:
                sets = ", ".join(f"{k} = %s" for k in changed)
                status = "VALIDATED" if existing["ingestion_status"] == "DISCOVERED" else existing["ingestion_status"]
                cur.execute(f"UPDATE catalog_products SET {sets}, ingestion_status = %s, source_status = 'ACTIVE', "
                            f"last_verified_at = %s, updated_at = %s, version = version + 1 WHERE id = %s",
                            (*changed.values(), status, ts, ts, pid))
                outcome = "UPDATE"
            else:
                outcome = "SKIP"
        else:
            pid = new_id()
            cols.update(id=pid, source_status="ACTIVE", ingestion_status="VALIDATED", dedup_key=dedup, first_seen_at=ts,
                        last_verified_at=ts, owners_count=0, version=0, created_at=ts, updated_at=ts,
                        metadata_json=json.dumps({"importedBy": "scripts/catalog", "normalization": self.n.version}))
            names = ", ".join(cols)
            cur.execute(f"INSERT INTO catalog_products ({names}) VALUES ({', '.join(['%s'] * len(cols))})", tuple(cols.values()))
            outcome = "CREATE"
        sub_changes = self._aliases(cur, pid, p) + self._variants(cur, pid, p) + self._images(cur, pid, p, sources)
        if outcome == "SKIP" and sub_changes:
            outcome = "UPDATE"
        getattr_map = {"CREATE": "created", "UPDATE": "updated", "SKIP": "skipped"}
        setattr(self.report, getattr_map[outcome], getattr(self.report, getattr_map[outcome]) + 1)
        (log.debug if outcome == "SKIP" else log.info)("[%s] %s %s%s", outcome, brand["name"], p.product_name,
                                                        f" ({p.color_name})" if p.color_name else "")
        return outcome

    def _aliases(self, cur, pid, p) -> int:
        n = 0
        for alias in p.aliases:
            k = key(alias)
            cur.execute("SELECT 1 FROM catalog_product_aliases WHERE product_id = %s AND alias_norm = %s", (pid, k))
            if k and not cur.fetchone():
                ts = now()
                cur.execute("INSERT INTO catalog_product_aliases (id, product_id, alias, alias_norm, version, created_at, updated_at) VALUES (%s,%s,%s,%s,0,%s,%s)",
                            (new_id(), pid, str(alias).strip(), k, ts, ts))
                n += 1
        return n

    def _variants(self, cur, pid, p) -> int:
        n = 0
        for v in p.variants:
            vk = key(v.get("code") or v.get("sku") or v.get("gtin") or v.get("color_name") or v.get("color")).replace(" ", "-")
            if not vk:
                continue
            color = self.n.color(v.get("color") or v.get("color_name"))
            cur.execute("SELECT * FROM catalog_variants WHERE product_id = %s AND variant_key = %s", (pid, vk))
            row = cur.fetchone()
            ts = now()
            vals = (color, v.get("color_name"), v.get("code"), v.get("sku"), v.get("gtin"))
            if row:
                if (row["color"], row["color_name"], row["variant_code"], row["sku"], row["gtin"]) != vals:
                    cur.execute("UPDATE catalog_variants SET color=%s, color_name=%s, variant_code=%s, sku=%s, gtin=%s, updated_at=%s, version=version+1 WHERE id=%s",
                                (*vals, ts, row["id"]))
                    n += 1
                continue
            cur.execute("INSERT INTO catalog_variants (id, product_id, variant_key, color, color_name, variant_code, sku, gtin, version, created_at, updated_at) "
                        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,0,%s,%s)", (new_id(), pid, vk, *vals, ts, ts))
            n += 1
        return n

    def _images(self, cur, pid, p, sources) -> int:
        n = 0
        cur.execute("SELECT COUNT(*) AS c FROM catalog_images WHERE product_id = %s AND is_primary = TRUE", (pid,))
        has_primary = cur.fetchone()["c"] > 0
        for img in p.images:
            url = (img or {}).get("url")
            if not url or not url.startswith("https://") or blocked(url):
                log.warning("[SKIP] imagem sem origem permitida: %s", url)
                continue
            st, allows = classify(url, sources)
            h = url_hash(url)
            cur.execute("SELECT id FROM catalog_images WHERE product_id = %s AND image_url_hash = %s", (pid, h))
            if cur.fetchone():
                cur.execute("UPDATE catalog_images SET last_verified_at = %s WHERE product_id = %s AND image_url_hash = %s", (now(), pid, h))
                continue
            ts = now()
            cur.execute("INSERT INTO catalog_images (id, product_id, image_url, image_url_hash, image_type, source_url, source_domain, source_type, "
                        "is_primary, usage_status, retrieved_at, last_verified_at, version, created_at, updated_at) "
                        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,0,%s,%s)",
                        (new_id(), pid, url, h, image_type(img.get("type")), p.official_product_url, url.split("/")[2],
                         st or p.source_type, not has_primary, usage_status(allows), ts, ts, ts, ts))
            has_primary = True
            n += 1
        return n

    # ───────────────────────── auditoria da execução
    def record_run(self, kind: str, source: str, started):
        if self.dry_run:
            return
        ts = now()
        with self.conn.cursor() as cur:
            r = self.report
            cur.execute("INSERT INTO catalog_ingestion_runs (id, kind, source, dry_run, total_read, created_count, updated_count, skipped_count, "
                        "duplicates_count, error_count, report_json, started_at, finished_at, version, created_at, updated_at) "
                        "VALUES (%s,%s,%s,FALSE,%s,%s,%s,%s,%s,%s,%s,%s,%s,0,%s,%s)",
                        (new_id(), kind, source[:255], r.total_read, r.created, r.updated, r.skipped, r.duplicates_found, r.errors,
                         json.dumps({"errors": r.error_details[:200]}), started, ts, ts, ts))
        self.conn.commit()


def setup_logging(verbose: bool):
    """INFO mostra [CREATE]/[UPDATE]/[DUP]/[ERROR]; --verbose acrescenta [SKIP] e as decisões de deduplicação."""
    logging.basicConfig(level=logging.DEBUG if verbose else logging.INFO, format="%(message)s")
