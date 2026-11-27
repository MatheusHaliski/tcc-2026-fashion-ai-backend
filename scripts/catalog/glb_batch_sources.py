"""Qual imagem de cada produto entra na geração 3D, da melhor para a pior. Nenhuma fonte é obrigatória.

1. ``FLAT_LAY``: flat lay aprovado (``flat_lay_status = 'APPROVED'``), frente e, se houver, costas;
2. ``WHOLE``: a Peça inteira já recortada sem pessoa (``whole_status = 'RENDERED'``), só frente;
3. ``FOTO``: a foto do produto (canônica aprovada › principal › mais recente, nunca ``usage_status = 'REJECTED'``).
   A pessoa é tirada na GPU, antes da forma, pelo recorte FASHN (parser humano + BiRefNet: hunyuan_glb_cutout.py).

Só URLs https entram (as do bucket servidas por /media/ e as oficiais da loja).
"""
from __future__ import annotations

SOURCES = ("FLAT_LAY", "WHOLE", "FOTO")
IMAGES = """SELECT i.product_id, i.flat_lay_url, i.flat_lay_back_url, i.flat_lay_status, i.whole_url, i.whole_status,
  i.stored_url, i.image_url, i.is_canonical, i.processing_status, i.is_primary, i.updated_at, p.category, p.subcategory
  FROM catalog_images i JOIN catalog_products p ON p.id = i.product_id
  WHERE i.usage_status <> 'REJECTED' AND i.product_id IN %(ids)s"""
WITHOUT_MODEL = """SELECT p.id FROM catalog_products p WHERE NOT EXISTS (SELECT 1 FROM catalog_product_models_3d m
  WHERE m.catalog_product_id = p.id AND m.status = 'PUBLISHED')"""


def https(url) -> str:
    url = (url or "").strip()
    return url if url.startswith("https://") else ""


def _flat_lay(row: dict):
    if row["flat_lay_status"] != "APPROVED" or not https(row["flat_lay_url"]):
        return None
    rank = (bool(row["is_primary"]), bool(https(row["flat_lay_back_url"])), str(row["updated_at"] or ""))
    return rank, https(row["flat_lay_url"]), https(row["flat_lay_back_url"])


def _whole(row: dict):
    if row["whole_status"] != "RENDERED" or not https(row["whole_url"]):
        return None
    return (bool(row["is_canonical"]), bool(row["is_primary"]), str(row["updated_at"] or "")), https(row["whole_url"]), ""


def _photo(row: dict):
    url = https(row["stored_url"]) or https(row["image_url"])
    if not url:
        return None
    canonical = bool(row["is_canonical"]) and row["processing_status"] == "APPROVED"
    return (canonical, bool(row["is_primary"]), bool(https(row["stored_url"])), str(row["updated_at"] or "")), url, ""


PICKERS = {"FLAT_LAY": _flat_lay, "WHOLE": _whole, "FOTO": _photo}


def choose(rows: list[dict], allowed=SOURCES) -> dict[str, dict]:
    """product_id → {fonte, front_url, back_url, category, subcategory}: a melhor fonte permitida de cada produto."""
    best: dict[str, tuple] = {}
    for row in rows:
        pid = str(row["product_id"]).lower()
        for level, source in enumerate(s for s in SOURCES if s in allowed):
            picked = PICKERS[source](row)
            if picked is None:
                continue
            key = (-level, picked[0])
            if pid not in best or key > best[pid][0]:
                best[pid] = (key, source, picked[1], picked[2], row)
            break
    return {pid: {"fonte": source, "front_url": front, "back_url": back, "category": row.get("category") or "",
                  "subcategory": row.get("subcategory") or ""}
            for pid, (_, source, front, back, row) in best.items()}
