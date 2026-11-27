"""Arquivo FAI_GLB_ARCHIVE_V1 do Codex: cada .glb gravado em pedaços dentro do SQLite, remontado e conferido aqui.

Formato (o que o pacote ``fashionai-mysql-mac`` trouxe):

- ``glb_files`` (file_id, product_id, size_label, sha256, byte_length, metadata_json): um .glb por produto e tamanho
  (``base`` = o que a Meshy devolveu; ``P``/``M``/``G``/``GG`` = a mesma malha escalada, "relative visual scaling only");
- ``glb_file_parts`` (file_id, ordinal, blob_sha256) → ``glb_blobs`` (sha256, byte_length, content): os pedaços;
- ``glb_products`` (metadata_json: id, brand, name, category, subcategory, official_product_url…): a peça de origem;
- ``glb_quality_reviews`` (review_json: quality_status, garment_only_visual_gate, quality_note): a revisão do Codex.

Só o ``base`` vira modelo do catálogo: as variantes de tamanho são o mesmo modelo escalado sem medida real da marca.
Cada pedaço e o arquivo remontado têm o SHA-256 conferido; divergência para o lote (nada de .glb corrompido).
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
import sqlite3
from pathlib import Path

SCHEMA = "FAI_GLB_ARCHIVE_V1"
BASE = "base"
SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
MANIFEST = ["product_id", "glb", "meshy_task_id", "codex_product_id", "official_product_url", "brand", "name",
            "category", "subcategory", "codex_quality", "codex_gate", "codex_note"]


def is_archive(conn: sqlite3.Connection) -> bool:
    names = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    return {"glb_files", "glb_file_parts", "glb_blobs", "glb_products"} <= names


def assemble(conn: sqlite3.Connection, file_id: str, sha256: str, length: int) -> bytes:
    """Bytes do .glb a partir dos pedaços, na ordem; cada pedaço e o todo conferidos pelo SHA-256 e pelo tamanho."""
    parts = []
    sql = """SELECT p.blob_sha256, b.content FROM glb_file_parts p JOIN glb_blobs b ON b.sha256 = p.blob_sha256
             WHERE p.file_id = ? ORDER BY p.ordinal"""
    for blob_sha, content in conn.execute(sql, (file_id,)):
        if hashlib.sha256(content).hexdigest() != blob_sha:
            raise ValueError(f"BLOB_SHA_MISMATCH {file_id}")
        parts.append(bytes(content))
    data = b"".join(parts)
    if len(data) != length or hashlib.sha256(data).hexdigest() != sha256:
        raise ValueError(f"GLB_SHA_MISMATCH {file_id}")
    if data[:4] != b"glTF":
        raise ValueError(f"NOT_GLB {file_id}")
    return data


def _json_by_product(conn: sqlite3.Connection, table: str, column: str) -> dict[str, dict]:
    names = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if table not in names:
        return {}
    return {pid: json.loads(value) for pid, value in conn.execute(f"SELECT product_id, {column} FROM {table}")}


def export_archive(conn: sqlite3.Connection, out: Path) -> int:
    """Grava ``<out>/glb/<codex_id>.glb`` (só o base) e ``<out>/manifesto.csv`` apontando para eles.

    ``product_id`` sai vazio: o id do Codex não é o UUID do catálogo, e quem liga os dois é o import_meshy_glbs.py
    (pela URL oficial e, na falta dela, pela marca + nome), que precisa do banco.
    """
    products = _json_by_product(conn, "glb_products", "metadata_json")
    reviews = _json_by_product(conn, "glb_quality_reviews", "review_json")
    folder = out / "glb"
    folder.mkdir(parents=True, exist_ok=True)
    rows = conn.execute("SELECT file_id, product_id, sha256, byte_length, metadata_json FROM glb_files "
                        "WHERE size_label = ? ORDER BY product_id", (BASE,))
    count = 0
    with (out / "manifesto.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(MANIFEST)
        for file_id, codex_id, sha, length, meta in rows:
            if not SAFE_ID.match(codex_id):
                raise ValueError(f"id de produto inválido no arquivo: {codex_id!r}")
            target = folder / f"{codex_id}.glb"
            target.write_bytes(assemble(conn, file_id, sha, length))
            product, review = products.get(codex_id, {}), reviews.get(codex_id, {})
            writer.writerow(["", f"glb/{target.name}", json.loads(meta).get("task_id", ""), codex_id,
                             product.get("official_product_url", ""), product.get("brand", ""),
                             product.get("name", ""), product.get("category", ""), product.get("subcategory", ""),
                             review.get("quality_status", ""), review.get("garment_only_visual_gate", ""),
                             review.get("quality_note") or ""])
            count += 1
    return count
