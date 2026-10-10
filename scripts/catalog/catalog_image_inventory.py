"""Inventário de fotos do acervo, sem downloads ou gravações no banco.

Snapshots são evidência das URLs coletadas, não do estado atual em produção. O
leitor MySQL usa os mesmos parâmetros de ``db.connect`` e uma transação somente
de leitura: paginação por chave, um JOIN por página e repetição integral após
desconexão. O inventário é materializado antes de entregar registros, para não
manter a conexão aberta enquanto o chamador baixa/processa imagens.

``image_url``/``source_url`` preservam a foto original; ``provenance_url`` é a
página de origem (catalog_images.source_url) e ``current_url`` é a URL exibida
para aquela imagem. IDs de snapshot são sintéticos e nunca servem para UPDATE.
"""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Callable, Iterable, Iterator, Mapping

try:  # módulo importado pelo pacote ou pelos CLIs de scripts/catalog
    from . import db
    from .import_products import read_items
    from .normalize_product import Normalizer
except ImportError:
    import db
    from import_products import read_items
    from normalize_product import Normalizer

CURRENT_VERSION = "CATALOG_IMAGE_PIPELINE_V4"
VISIBLE_STATUSES = ("VALIDATED", "PERSISTABLE", "REFERENCE_ONLY")
GARMENT_CATEGORIES = {"upper_piece", "lower_piece", "full_body_piece"}
OTHER_CATEGORIES = {"shoes_piece", "accessory_piece"}


def _value(record: Mapping, snake: str, camel: str | None = None, default=None):
    value = record.get(snake)
    return record.get(camel, default) if value is None and camel else (default if value is None else value)


def _url(value) -> str | None:
    return value.strip() or None if isinstance(value, str) else None


def _json_object(value) -> dict | None:
    if isinstance(value, dict):
        return value
    if isinstance(value, (str, bytes, bytearray)):
        try:
            decoded = json.loads(value)
            return decoded if isinstance(decoded, dict) else None
        except (ValueError, UnicodeError):
            pass
    return None


def _metadata(record: Mapping, name: str) -> dict | None:
    return _json_object(_value(record, name + "_json", name))


def _valid_crop(crop: Mapping) -> bool:
    rect = crop.get("crop")
    if not isinstance(rect, dict):
        return False
    values = [rect.get(k) for k in ("x", "y", "w", "h")]
    if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in values):
        return False
    x, y, w, h = values
    # NRect arredonda quatro casas; tolerância apenas para a soma arredondada.
    return x >= 0 and y >= 0 and w > 0 and h > 0 and x + w <= 1.0001 and y + h <= 1.0001


def _frame_width_ok(frame: Mapping) -> bool:
    """50% do quadro do editor; ou menos, só quando o próprio quadro registra que foi reduzido para caber na foto
    (foto mais larga que alta demais, modo forçado) — senão a mesma foto seria reenquadrada e reenviada a cada execução."""
    width = frame.get("widthPercent")
    if isinstance(width, bool) or not isinstance(width, (int, float)) or not math.isfinite(width):
        return False
    if width == 50:
        return True
    return 0 < width < 50 and "FRAME_REDUCED_TO_FIT_IMAGE" in (frame.get("observations") or [])


def is_standardized(record: Mapping, current_version: str = CURRENT_VERSION) -> bool:
    """Verifica metadados comprovados, sem inferir aprovação a partir da URL.

    Roupa deve ter recorte de tecido que preenche o quadro, conforme V4. Uma
    aprovação manual sem essa evidência não torna a foto padronizada. Calçados
    e acessórios conservam seu enquadramento semântico próprio. Imagens
    alternativas também podem estar padronizadas; canônica é uma escolha de
    exibição, não uma condição de qualidade de todas as fotos.
    """
    if not _url(_value(record, "image_url", "source_url")):
        return False
    if _value(record, "processing_status", "processingStatus") != "APPROVED":
        return False
    if _value(record, "pipeline_version", "pipelineVersion") == "CATALOG_FRAME_34_50_V1":
        crop = _metadata(record, "crop") or {}
        frame = crop.get("editorFrame") or {}
        return (_value(record, "review_status", "reviewStatus") != "REJECTED"
                and bool(record.get("stored_url"))
                and (_metadata(record, "assets") or {}).get("card") == record.get("stored_url")
                and (_metadata(record, "assets") or {}).get("framingVersion") == "CATALOG_FRAME_34_50_V1"
                and len(str((_metadata(record, "assets") or {}).get("sha256") or "")) == 64
                and _valid_crop(crop) and crop.get("aspect") == "3:4"
                and frame.get("version") == "CATALOG_FRAME_34_50_V1"
                and _frame_width_ok(frame) and frame.get("requiresReview") is False
                and crop.get("ruleCompliant") is True)
    if _value(record, "pipeline_version", "pipelineVersion") != current_version:
        return False
    if _value(record, "review_status", "reviewStatus") == "REJECTED":
        return False
    category = str(record.get("category") or "").lower()
    if category not in GARMENT_CATEGORIES | OTHER_CATEGORIES:
        return False
    crop = _metadata(record, "crop")
    if crop is None or not _valid_crop(crop) or crop.get("ruleCompliant") is False:
        return False
    if crop.get("aspect") != ("2:1" if category == "lower_piece" else "4:5"):
        return False
    metrics = _metadata(record, "metrics")
    if metrics is None:
        return False
    debug = _json_object(metrics.get("debug")) or {}
    compliance = _json_object(debug.get("ruleCompliance")) or {}
    if compliance.get("ok") is False:
        return False
    if category in GARMENT_CATEGORIES:
        return (compliance.get("foregroundOnly") is True
                and compliance.get("mode") == "GARMENT_COVER"
                and compliance.get("pipelineVersion") == "GARMENT_COVER_V1")
    return True


def _normalize_record(row: Mapping, *, origin: str, source_scope: str) -> dict:
    record = dict(row)
    url = _url(_value(row, "image_url", "url"))
    record.update(origin=origin, source_scope=source_scope, image_url=url, source_url=url,
                  original_image_url=url, has_image_bool=url is not None)
    for name in ("crop", "metrics", "assets"):
        record[name] = record[name + "_json"] = _metadata(row, name)
    for snake, camel in (("processing_status", "processingStatus"), ("pipeline_version", "pipelineVersion"),
                         ("review_status", "reviewStatus"), ("quality_score", "qualityScore")):
        record[snake] = _value(row, snake, camel)
    for field in ("is_primary", "is_canonical"):
        record[field] = bool(record.get(field))
    # Igual ao card: somente a canônica usa os assets processados. Nenhuma URL
    # alternativa é apresentada como a foto que o frontend já estaria usando.
    assets = record["assets"]
    record["current_url"] = (_url(assets.get("card")) or _url(record.get("stored_url"))
                             if record["is_canonical"] and assets is not None else url)
    known = origin == "DATABASE" or bool(record.get("processing_status") or record.get("pipeline_version"))
    standardized = is_standardized(record) if known or url is None else None
    record["standardized_before"] = record["standardized_after"] = standardized
    if url is None:
        note = "Sem foto cadastrada para a peça."
    elif not known:
        note = "Estado não verificado no banco; o snapshot contém somente a URL coletada."
    elif standardized:
        note = "Metadados aprovados pelo pipeline atual e enquadramento válido."
    else:
        note = "Padronização atual não comprovada: verificar versão, aprovação e enquadramento."
    record["status_note"] = note
    return record


def load_snapshot(paths: Iterable[str | Path]) -> Iterator[dict]:
    """Lê JSON, JSONL/gzip ou CSV sem descartar peças que ainda não têm foto."""
    normalizer = Normalizer()
    for filename in paths:
        path = Path(filename)
        for label, product in read_items(path):
            subcategory = normalizer.subcategory(product.get("subcategory"))
            if subcategory:
                subcategory, _, _ = normalizer.resolve(subcategory)
            category = normalizer.sub_category.get(subcategory) or normalizer.category(product.get("category"))
            name = product.get("product_name") or product.get("productName") or product.get("name") or ""
            brand = product.get("brand") or ""
            if isinstance(brand, dict):
                brand = brand.get("name") or ""
            # Não depende da posição da linha nem do arquivo de entrada.
            identity = json.dumps([brand, name, subcategory, product.get("official_product_url"),
                                   product.get("sku"), product.get("product_code")], ensure_ascii=False)
            product_id = "snapshot:" + hashlib.sha256(identity.encode("utf-8")).hexdigest()
            base = {"product_id": product_id, "product_name": name, "brand": brand,
                    "category": category, "subcategory": subcategory or product.get("subcategory"),
                    "official_product_url": product.get("official_product_url"),
                    "ingestion_status": product.get("ingestion_status"), "source_status": product.get("source_status"),
                    "snapshot_path": str(path), "snapshot_row": label, "product_version": None}
            images = product.get("images") or []
            if isinstance(images, str):  # CSV pode conter a lista JSON.
                images = json.loads(images)
            if not images and product.get("primary_image_url"):
                images = [{"url": product["primary_image_url"]}]
            if not isinstance(images, list):
                raise ValueError(f"{label}: images deve ser uma lista")
            for index, image in enumerate(images or [{}]):
                image = {"url": image} if isinstance(image, str) else image
                if not isinstance(image, dict):
                    raise ValueError(f"{label}: imagem inválida")
                url = _url(_value(image, "image_url", "url"))
                image_hash = hashlib.sha256(url.encode("utf-8")).hexdigest() if url else None
                row = {**base, **image, "image_url": url, "image_url_hash": image_hash,
                       "image_id": f"{product_id}:{image_hash}" if image_hash else None,
                       "image_type": image.get("image_type") or image.get("type") or "PACKSHOT",
                       "is_primary": image.get("is_primary", index == 0 and bool(url)),
                       "provenance_url": product.get("official_product_url"), "version": None}
                yield _normalize_record(row, origin="SNAPSHOT", source_scope=f"snapshot:{path.name}")


try:
    from .source_persistence import source_decision
except ImportError:
    from source_persistence import source_decision

_SELECT = f"""
SELECT p.id AS product_id, p.product_name, p.category, p.subcategory,
       p.version AS product_version, p.official_product_url, p.ingestion_status,
       p.source_status, b.name AS brand, b.slug AS brand_slug,
       i.id AS image_id, i.variant_id, i.image_url, i.image_url_hash, i.image_type,
       i.source_url AS provenance_url, i.source_domain, i.source_type,
       i.is_primary, i.usage_status, i.stored_url, i.width, i.height, i.mime,
       i.source_sha256, i.phash, i.processing_status, i.pipeline_version,
       i.quality_score, i.gate_reasons, i.view_role, i.is_canonical, i.review_status,
       i.crop_json, i.metrics_json, i.assets_json, i.attempts, i.processed_at,
       i.created_at, i.updated_at, i.version,
       COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT('id',s.id,'domain',s.domain,
                 'active',s.active,'allows_image_persistence',s.allows_image_persistence))
                 FROM catalog_sources s WHERE s.brand_id=p.brand_id), JSON_ARRAY()) AS persistence_sources_json
FROM catalog_products p
JOIN brands b ON b.id = p.brand_id
LEFT JOIN catalog_images i ON i.product_id = p.id
"""


def load_database(connect_fn: Callable = db.connect, *, batch_size: int = 500,
                  search_visible_only: bool = True, retries: int = 3) -> Iterator[dict]:
    """Inventário consistente das imagens de todos os produtos elegíveis à busca.

    Não usa a API de busca (limitada a 48 resultados), OFFSET, consultas por
    imagem ou escrita de estado. Recomeça a leitura inteira se o socket cair:
    uma nova conexão não pode continuar o snapshot anterior. Entrega registros
    somente depois de liberar a conexão, inclusive em caso de erro no consumo.
    """
    if batch_size < 1:
        raise ValueError("batch_size deve ser maior que zero")
    if retries < 0:
        raise ValueError("retries não pode ser negativo")
    conn = connect_fn()

    def read_snapshot():
        rows = []
        last_product = last_image = None
        with conn.cursor() as cur:
            cur.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
            cur.execute("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY")
            while True:
                conditions, params = [], []
                if search_visible_only:
                    conditions.append("p.ingestion_status IN (%s,%s,%s)")
                    params.extend(VISIBLE_STATUSES)
                if last_product is not None:
                    conditions.append("(p.id > %s OR (p.id = %s AND COALESCE(i.id, '') > %s))")
                    params.extend((last_product, last_product, last_image))
                where = " WHERE " + " AND ".join(conditions) if conditions else ""
                cur.execute(_SELECT + where + " ORDER BY p.id, i.id LIMIT %s", (*params, batch_size))
                page = cur.fetchall()
                if not page:
                    break
                rows.extend(page)
                last_product, last_image = page[-1]["product_id"], page[-1]["image_id"] or ""
                if len(page) < batch_size:
                    break
        return rows

    try:
        # ROLLBACK encerra a transação READ ONLY; nunca há COMMIT de mutações.
        rows = db.run_transaction(conn, read_snapshot, dry_run=True,
                                  label="inventário de imagens (somente leitura)", retries=retries)
    finally:
        conn.close()
    for row in rows:
        sources = row.pop('persistence_sources_json', [])
        if isinstance(sources, str):
            sources = json.loads(sources)
        row['persistence_sources'] = sources
        decision = source_decision(sources, row.get('image_url'), row.get('source_domain'))
        row['persistence_decision'] = decision
        row['allows_image_persistence'] = decision['state'] == 'AUTHORIZED'
        yield _normalize_record(row, origin="DATABASE", source_scope="database:catalog_images")
