"""Núcleo do FashionAI Catalog Ingestion Pipeline: upsert idempotente de marca, apelidos, fontes oficiais, produto,
variantes, imagens e apelidos de produto. Mesmas regras do CatalogIngestService (Java)."""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field

<<<<<<< HEAD
import time

from db import is_connection_lost, new_id, now, transaction
=======
from db import DatabaseUnavailable, new_id, now, run_transaction
>>>>>>> origin/main
from deduplicate import find_existing, find_same_model
from image_metadata import image_type, url_hash, usage_status
from normalize_product import Normalizer, Product, ValidationError, key, normalize_product, slug
from source_persistence import normalize_domain
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
<<<<<<< HEAD
    def __init__(self, conn, dry_run=False, create_brands=True, overwrite=False, reconnect=None, retries=4):
=======
    def __init__(self, conn, dry_run=False, create_brands=True, overwrite=False, skip_existing=False):
        if skip_existing and overwrite:
            raise ValueError("skip_existing e overwrite não podem ser usados juntos")
>>>>>>> origin/main
        self.conn = conn
        # queda de conexão no meio do lote: reconecta e repete o item (a transação por produto garante que nada ficou
        # pela metade); sem isso, todo item depois da queda virava ERROR e o lote "terminava" sem inserir o resto
        self.reconnect = reconnect
        self.retries = retries
        self.dry_run = dry_run
        self.create_brands = create_brands
        # merge seguro: produto existente só ganha campos que estavam vazios; --overwrite = curadoria explícita
        self.overwrite = overwrite
        # Importação rápida: mantém registros existentes, mas admite novos filhos (imagens/variantes/apelidos).
        self.skip_existing = skip_existing
        self._brands = {}
        self._sources = {}
        self._brand_aliases = {}
        # identificadores já vistos nesta execução (o --dry-run desfaz cada item, então a memória detecta
        # duplicatas dentro do próprio lote)
        self.seen: dict[str, str] = {}
        self._pending_seen: dict[str, str] = {}
        self.n = Normalizer()
        self.report = Report()

    def clear_caches(self):
        """Descarta leituras e escritas locais após rollback, inclusive no dry-run do seed."""
        self._brands.clear()
        self._sources.clear()
        self._brand_aliases.clear()

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

    # ───────────────────────── produtos
    def search_text(self, cur, brand: dict, p: Product) -> str:
        bid = brand["id"]
        if self.skip_existing and bid in self._brand_aliases:
            aliases = self._brand_aliases[bid]
        else:
            cur.execute("SELECT alias FROM brand_aliases WHERE brand_id = %s ORDER BY created_at", (bid,))
            aliases = [r["alias"] for r in cur.fetchall()]
            if self.skip_existing:
                self._brand_aliases[bid] = aliases
        parts = [brand["name"], *aliases, p.product_name, p.model_name, p.color_name, p.color,
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
<<<<<<< HEAD
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
=======
        counters = self.report.as_dict()
        details = len(self.report.error_details)
        attempts = 0

        def restore():
            self.clear_caches()
            self._pending_seen.clear()
            for field, value in counters.items():
                setattr(self.report, field, value)
            del self.report.error_details[details:]

        def write():
            # _upsert adapta identificadores de variantes: cada tentativa usa o produto original.
            nonlocal p, attempts
            if attempts:
                p = normalize_product(raw, self.n)
            attempts += 1
            self._pending_seen.clear()
            with self.conn.cursor() as cur:
                return self._upsert(cur, p)

        try:
            outcome = run_transaction(self.conn, write, self.dry_run, label=label or p.product_name, on_failure=restore)
        except DatabaseUnavailable as e:
            self._error(str(e))
            raise
        except ValidationError as e:
            return self._error(f"{label} {e}")
        except Exception as e:  # erro de banco: registra e segue o lote
            return self._error(f"{label} {type(e).__name__}: {e}")
        finally:
            if self.dry_run:
                self.clear_caches()
        for identifier, name in self._pending_seen.items():
            self.seen.setdefault(identifier, name)
        self._pending_seen.clear()
>>>>>>> origin/main
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
            self._pending_seen.setdefault(i, p.product_name)
        if existing is None and earlier is not None and self.dry_run:
            self.report.duplicates_found += 1
            self.report.skipped += 1
            log.info("[DUP] %s %s repete um item anterior do lote (%s)", brand["name"], p.product_name, earlier)
            return "DUPLICATE"
        if existing is not None and self.skip_existing:
            # Não monta cols/search_text nem atualiza o produto. Uma nova cor do mesmo modelo,
            # uma foto nova ou um apelido novo ainda precisam ser inseridos.
            sub_changes = (self._aliases(cur, existing["id"], p)
                           + self._variants(cur, existing["id"], p)
                           + self._images(cur, existing["id"], p, sources))
            outcome = "UPDATE" if sub_changes else "SKIP"
            counter = "updated" if sub_changes else "skipped"
            setattr(self.report, counter, getattr(self.report, counter) + 1)
            if why and not why.startswith("dedup_key"):
                self.report.duplicates_found += 1
            (log.info if sub_changes else log.debug)("[%s] %s %s", outcome, brand["name"], p.product_name)
            return outcome
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

    # ───────────────────────── auditoria da execução
    def record_run(self, kind: str, source: str, started):
        if self.dry_run:
            return
        ts = now()
        run_id = new_id()

        def write():
            with self.conn.cursor() as cur:
                # COMMIT com resposta perdida não pode gerar dois relatórios da mesma execução.
                cur.execute("SELECT id FROM catalog_ingestion_runs WHERE id = %s", (run_id,))
                if cur.fetchone():
                    return
                r = self.report
                cur.execute("INSERT INTO catalog_ingestion_runs (id, kind, source, dry_run, total_read, created_count, updated_count, skipped_count, "
                        "duplicates_count, error_count, report_json, started_at, finished_at, version, created_at, updated_at) "
                        "VALUES (%s,%s,%s,FALSE,%s,%s,%s,%s,%s,%s,%s,%s,%s,0,%s,%s)",
                        (run_id, kind, source[:255], r.total_read, r.created, r.updated, r.skipped, r.duplicates_found, r.errors,
                         json.dumps({"errors": r.error_details[:200]}), started, ts, ts, ts))
        run_transaction(self.conn, write, label="relatório da execução", on_failure=self.clear_caches)


def setup_logging(verbose: bool):
    """INFO mostra [CREATE]/[UPDATE]/[DUP]/[ERROR]; --verbose acrescenta [SKIP] e as decisões de deduplicação."""
    logging.basicConfig(level=logging.DEBUG if verbose else logging.INFO, format="%(message)s")
