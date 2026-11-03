"""Recupera a foto de origem dos resultados de lotes antigos do catalog_batch, gravados antes de a auditoria registrar
``image_id`` (os 83 primeiros aprovados, 03/11/2026): refazê-los no RunPod gastaria GPU paga à toa.

O lote escolhe a foto de cada produto por uma regra fixa (``catalog_source.SELECT``: a principal, senão a mais antiga
não rejeitada). Aplicada hoje, ela devolve a mesma linha de ``catalog_images`` desde que nenhuma foto do produto tenha
mudado depois do lote. Se alguma mudou (nova foto, rejeição, troca de URL), o produto é recusado com
``SOURCE_CHANGED_SINCE_BATCH``. O banco grava ``updated_at`` em UTC; o início do lote é a criação do ``audit.jsonl``."""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

LAST_CHANGE = """
SELECT product_id, MAX(updated_at) AS changed FROM catalog_images WHERE product_id IN %(ids)s GROUP BY product_id
"""


def batch_started(lot: Path) -> datetime:
    """Início do lote em UTC sem fuso (como o DATETIME do banco): criação do audit.jsonl no macOS, senão a última
    escrita (mais permissiva: um lote que durou horas aceita mudança feita durante ele)."""
    info = (lot / "audit.jsonl").stat()
    started = getattr(info, "st_birthtime", info.st_mtime)
    return datetime.fromtimestamp(started, timezone.utc).replace(tzinfo=None)


def selection_sql() -> str:
    """A mesma consulta do lote, restrita a uma lista de produtos (services/garment_gpu/scripts/catalog_source.py)."""
    root = str(Path(__file__).resolve().parents[2])
    if root not in sys.path:
        sys.path.insert(0, root)
    from services.garment_gpu.scripts.catalog_source import SELECT

    return SELECT.format(category="AND p.id IN %(ids)s", order="id")


def recover(conn, rows: dict[str, dict], ids: list[str], sql: str | None = None) -> dict[str, str]:
    """Preenche a identidade da foto nos resultados aprovados que não a têm; devolve {produto: motivo} dos recusados.
    Só lê o banco."""
    missing = [pid for pid in ids if pid in rows and not rows[pid].get("image_id")]
    if not missing:
        return {}
    with conn.cursor() as cur:
        cur.execute(sql or selection_sql(), {"ids": tuple(missing), "limit": len(missing), "offset": 0})
        chosen = {r["id"]: r for r in cur.fetchall()}
        cur.execute(LAST_CHANGE, {"ids": tuple(missing)})
        changed = {r["product_id"]: r["changed"] for r in cur.fetchall()}
    refused: dict[str, str] = {}
    for pid in missing:
        row, pick, last = rows[pid], chosen.get(pid), changed.get(pid)
        if pick is None or last is None:
            refused[pid] = "IMAGE_NOT_FOUND"
        elif last > batch_started(row["lot"]):
            refused[pid] = "SOURCE_CHANGED_SINCE_BATCH"
        else:
            row.update(image_id=pick["image_id"], image_version=pick["image_version"], original_url=pick["original_url"],
                       source_sha256=pick["source_sha256"], photo_url=pick["image_url"], source_recovered=True)
    return refused
