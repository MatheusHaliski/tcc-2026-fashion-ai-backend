"""Núcleo do FashionAI Catalog Ingestion Pipeline: upsert idempotente de marca, apelidos, fontes oficiais, produto,
variantes, imagens e apelidos de produto. Mesmas regras do CatalogIngestService (Java)."""
from __future__ import annotations

import json
import logging

from db import DatabaseUnavailable, new_id, now, run_transaction
from deduplicate import find_existing, find_same_model
from image_metadata import image_type, url_hash, usage_status  # noqa: F401
from normalize_product import Normalizer, Product, ValidationError, key, normalize_product, slug  # noqa: F401
from source_persistence import normalize_domain  # noqa: F401
from validate_source import SOURCE_TYPES, blocked, classify

# Fachada: o Ingestor (produto, transação e auditoria) fica aqui; marcas e fontes, filhos do produto e o relatório
# em ingest_*.py. Os nomes de antes continuam importáveis deste módulo (import_products, seed_catalog, sync_collected…).
from ingest_brands import BrandSourceUpserts
from ingest_children import ProductChildrenUpserts
from ingest_report import Report, same_value, setup_logging  # noqa: F401

log = logging.getLogger("catalog")
AUDIT = ("version", "created_at", "updated_at")


class Ingestor(BrandSourceUpserts, ProductChildrenUpserts):
    def __init__(self, conn, dry_run=False, create_brands=True, overwrite=False, skip_existing=False):
        if skip_existing and overwrite:
            raise ValueError("skip_existing e overwrite não podem ser usados juntos")
        self.conn = conn
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
