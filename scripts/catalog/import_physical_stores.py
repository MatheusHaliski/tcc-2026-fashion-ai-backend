"""Importa endereços físicos e seus mapas a partir de um CSV revisado de fontes oficiais."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import unicodedata
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlsplit

import db

SEED_BRANDS = Path(__file__).resolve().parents[2] / "data/catalog/brands.json"
MAP_TYPES = {"SHOPPING", "OUTLET", "SHOPPING_STREET"}
FIELDS = {"brand_slug": 160, "name": 160, "address": 512, "city": 120, "region": 120, "country": 2, "source_url": 1024}
UPSERT_STORE = """
    INSERT INTO physical_stores (
        id, brand_id, map_id, name, address, city, region, country, source_url, source_key,
        verified_at, image_url, floor_label, map_x, map_y
    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(6),%s,%s,%s,%s) AS input
    ON DUPLICATE KEY UPDATE name=input.name, address=input.address, city=input.city, region=input.region,
        country=input.country, source_url=input.source_url, verified_at=input.verified_at,
        map_id=COALESCE(input.map_id,physical_stores.map_id), image_url=COALESCE(input.image_url,physical_stores.image_url),
        floor_label=COALESCE(input.floor_label,physical_stores.floor_label),
        map_x=COALESCE(input.map_x,physical_stores.map_x), map_y=COALESCE(input.map_y,physical_stores.map_y)
"""


def https_host(value):
    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.query or parsed.fragment:
        raise ValueError("Informe uma URL HTTPS oficial sem credenciais, consulta ou fragmento.")
    return parsed.hostname.lower()


def normalized(value):
    return unicodedata.normalize("NFKC", value).casefold().strip()


def slug(value):
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")[:160]


def validated(row):
    info = {k: (v or "").strip() for k, v in row.items()}
    for key, length in FIELDS.items():
        if not info.get(key) or len(info[key]) > length:
            raise ValueError(f"Campo obrigatório inválido: {key}")
    if not re.fullmatch(r"[A-Z]{2}", info["country"]):
        raise ValueError("O país deve ter duas letras maiúsculas.")
    https_host(info["source_url"])
    for key in ("image_url", "map_image_url"):
        if info.get(key):
            https_host(info[key])
    if info.get("map_name") and (info.get("map_kind") not in MAP_TYPES or len(info["map_name"]) > 160):
        raise ValueError("Nome ou tipo de mapa inválido.")
    x, y = (Decimal(info[key]) if info.get(key) else None for key in ("map_x", "map_y"))
    if x is not None or y is not None:
        if not info.get("map_name") or any(v is None or not v.is_finite() or not 0 <= v <= 1 for v in (x, y)):
            raise ValueError("Os dois pinos precisam estar dentro do mapa.")
    info["coordinates"] = (x, y)
    return info


def brand(cursor, row):
    cursor.execute("SELECT id, website FROM brands WHERE slug = %s", (row["brand_slug"],))
    item = cursor.fetchone()
    if item is None:
        raise ValueError("Marca do catálogo não encontrada.")
    cursor.execute("SELECT domain FROM catalog_sources WHERE brand_id = %s AND active = TRUE", (item["id"],))
    domains = {r["domain"].lower().removeprefix("www.") for r in cursor.fetchall()}
    website = urlsplit(item["website"] or "").hostname
    if website:
        domains.add(website.lower().removeprefix("www."))
    for seeded in json.loads(SEED_BRANDS.read_text(encoding="utf-8")):
        if slug(seeded["name"]) == row["brand_slug"] and urlsplit(seeded["website"]).hostname == website:
            domains.update(source["domain"].lower().removeprefix("www.") for source in seeded.get("sources", []))
    host = https_host(row["source_url"]).removeprefix("www.")
    if not any(host == domain or host.endswith("." + domain) for domain in domains):
        raise ValueError("Fonte ausente entre os domínios oficiais da marca.")
    return item["id"]


def map_id(cursor, row):
    if not row.get("map_name"):
        return None
    key = slug("-".join(row[k] for k in ("country", "region", "city", "map_kind", "map_name")))
    cursor.execute("""
        INSERT INTO marketplace_maps (id, slug, name, kind, city, region, country, image_url)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s) AS input
        ON DUPLICATE KEY UPDATE image_url=COALESCE(input.image_url,marketplace_maps.image_url)
        """, (db.new_id(), key, row["map_name"], row["map_kind"], row["city"], row["region"], row["country"],
              row.get("map_image_url") or None))
    cursor.execute("SELECT id FROM marketplace_maps WHERE slug = %s", (key,))
    return cursor.fetchone()["id"]


def save(cursor, row):
    brand_id = brand(cursor, row)
    key = hashlib.sha256(normalized(row.get("source_id") or row["source_url"]).encode()).hexdigest()
    cursor.execute(UPSERT_STORE, (db.new_id(), brand_id, map_id(cursor, row), row["name"], row["address"],
                                 row["city"], row["region"], row["country"], row["source_url"], key,
                                 row.get("image_url") or None, row.get("floor_label") or None, *row["coordinates"]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_file", type=Path)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check-only", action="store_true", help="valida o arquivo sem conexão")
    mode.add_argument("--apply", action="store_true", help="grava o lote em uma transação")
    args = parser.parse_args()
    with args.csv_file.open(encoding="utf-8-sig", newline="") as file:
        rows = [validated(row) for row in csv.DictReader(file)]
    if not args.check_only:
        with db.connect() as conn, db.transaction(conn, dry_run=not args.apply), conn.cursor() as cursor:
            for row in rows:
                save(cursor, row)
    print(f"{len(rows)} lojas {('gravadas' if args.apply else 'validadas em ensaio')}")


if __name__ == "__main__":
    main()
