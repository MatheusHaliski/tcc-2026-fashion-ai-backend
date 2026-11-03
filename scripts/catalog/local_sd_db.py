"""Banco do lote local (SQLAlchemy: MySQL ou PostgreSQL): tabela e colunas, conexão pelo ambiente, fotos pendentes e
gravação condicional do resultado."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

from local_sd_base import IDENT, emit

# ───────────────────────── banco (SQLAlchemy: MySQL ou PostgreSQL)

@dataclass
class TableSpec:
    table: str = "catalog_images"
    id_column: str = "id"
    url_column: str = "image_url"
    out_column: str = "processed_image_url"

    def __post_init__(self):
        for name in (self.table, self.id_column, self.url_column, self.out_column):
            if not IDENT.match(name):
                raise SystemExit(f"identificador SQL inválido: {name!r}")

    @property
    def catalog(self) -> bool:
        return self.table == "catalog_images"


def engine_from_env(echo: bool = False):
    """DATABASE_URL/FAI_DATABASE_URL ou as MYSQL_* do backend. A URL nunca é impressa com senha."""
    from sqlalchemy import create_engine
    from sqlalchemy.engine import URL
    url = os.getenv("FAI_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not url:
        password = os.getenv("MYSQL_PASSWORD")
        if not password:
            raise SystemExit("defina DATABASE_URL (ex.: mysql+pymysql://user:senha@host:3306/fashionai) ou as MYSQL_* do backend")
        url = URL.create("mysql+pymysql", username=os.getenv("MYSQL_USER", "fashionai"), password=password,
                         host=os.getenv("MYSQL_HOST", "localhost"), port=int(os.getenv("MYSQL_PORT", "3306")),
                         database=os.getenv("MYSQL_DATABASE", "fashionai"), query={"charset": "utf8mb4"})
    return create_engine(url, pool_pre_ping=True, echo=echo)


def describe(engine) -> str:
    return engine.url.render_as_string(hide_password=True)


def ensure_column(engine, spec: TableSpec):
    """Cria a coluna de saída se faltar (o lote antigo fazia o mesmo). MySQL via information_schema; PostgreSQL com IF NOT EXISTS."""
    from sqlalchemy import text
    with engine.begin() as conn:
        if engine.dialect.name == "postgresql":
            conn.execute(text(f"ALTER TABLE {spec.table} ADD COLUMN IF NOT EXISTS {spec.out_column} TEXT"))
            return
        exists = conn.execute(text("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() "
                                   "AND TABLE_NAME = :t AND COLUMN_NAME = :c"), {"t": spec.table, "c": spec.out_column}).scalar()
        if not exists:
            conn.execute(text(f"ALTER TABLE {spec.table} ADD COLUMN {spec.out_column} TEXT NULL"))
            emit("column_added", table=spec.table, column=spec.out_column)


def pending_sql(spec: TableSpec, product_id: Optional[str] = None) -> str:
    """Fotos ainda sem packshot. Em catalog_images, junta produto e marca (categoria para o segmentador, nome do arquivo)
    e pula fotos recusadas; a canônica vem primeiro. Em outra tabela, lê as colunas que houver."""
    where = f"({spec.out_column} IS NULL OR {spec.out_column} = '')"
    if spec.catalog:
        sql = (f"SELECT i.{spec.id_column} AS id, i.{spec.url_column} AS image_url, i.product_id AS product_id, "
               f"p.category AS category, p.subcategory AS subcategory, p.product_name AS product_name, b.name AS brand "
               f"FROM catalog_images i JOIN catalog_products p ON p.id = i.product_id LEFT JOIN brands b ON b.id = p.brand_id "
               f"WHERE (i.{spec.out_column} IS NULL OR i.{spec.out_column} = '') AND i.usage_status <> 'REJECTED' "
               f"AND i.review_status <> 'REJECTED' AND p.ingestion_status <> 'REJECTED'")
        if product_id:
            sql += " AND i.product_id = :product_id"
        return sql + " ORDER BY i.is_canonical DESC, i.is_primary DESC, i.updated_at DESC LIMIT :limit"
    sql = f"SELECT * FROM {spec.table} WHERE {where}"
    if product_id:
        sql += f" AND {spec.id_column} = :product_id"
    return sql + f" ORDER BY {spec.id_column} LIMIT :limit"


def normalize_row(raw: dict, spec: TableSpec) -> dict:
    """Linha de qualquer tabela no formato que o lote usa (id, image_url, product_id, brand, category, subcategory)."""
    row = {k.lower(): v for k, v in raw.items()}
    brand = row.get("brand")
    if isinstance(brand, dict):
        brand = brand.get("name")
    return {"id": row.get("id", row.get(spec.id_column.lower())), "image_url": row.get("image_url", row.get(spec.url_column.lower(), row.get("url"))),
            "product_id": row.get("product_id", row.get("id")), "brand": brand or row.get("brand_name") or "FashionAI",
            "category": row.get("category"), "subcategory": row.get("subcategory"), "product_name": row.get("product_name") or row.get("name"),
            "color": row.get("color")}


def fetch_pending(engine, spec: TableSpec, limit: int, product_id: Optional[str] = None) -> list[dict]:
    from sqlalchemy import text
    with engine.connect() as conn:
        rows = conn.execute(text(pending_sql(spec, product_id)), {"limit": limit, "product_id": product_id}).mappings().all()
    return [normalize_row(dict(r), spec) for r in rows]


def store_result(engine, spec: TableSpec, row_id, value: str) -> bool:
    """UPDATE só se a coluna ainda estiver vazia (outra execução pode ter gravado antes)."""
    from sqlalchemy import text
    with engine.begin() as conn:
        result = conn.execute(text(f"UPDATE {spec.table} SET {spec.out_column} = :v WHERE {spec.id_column} = :id "
                                   f"AND ({spec.out_column} IS NULL OR {spec.out_column} = '')"), {"v": value, "id": row_id})
        return result.rowcount == 1
