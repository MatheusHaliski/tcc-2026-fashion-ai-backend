"""Gravação de um .glb gerado (Meshy, Hunyuan3D…: glb_source.py) como modelo 3D de vitrine do produto
(catalog_product_models_3d, V97).

Uma transação por produto. Ordem: envia as versões ao bucket (com releitura e conferência do SHA, como o FrameStorage),
aposenta o PUBLISHED anterior, insere o novo e completa as peças do guarda-roupa que vieram desse produto e ainda não têm
modelo 3D (``wardrobe_items.model3d_url`` vazio: o mesmo campo de vitrine do RF16). Falhou no meio: rollback e as
chaves enviadas são apagadas, sem .glb órfão no bucket.

Nota ``BOM`` entra PUBLISHED (aparece no app); ``REVISAR`` entra DRAFT e espera uma pessoa publicar.
"""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone

try:
    from .glb_source import MESHY_CODEX, GlbSource
except ImportError:   # rodado como script: scripts/catalog no sys.path
    from glb_source import MESHY_CODEX, GlbSource

VERSION = "MESHY_GLB_V2"
ACTOR = "import_meshy_glbs"
RETIRE = """UPDATE catalog_product_models_3d SET status = 'RETIRED', updated_at = %(now)s, last_modified_by = %(actor)s,
  version = version + 1 WHERE catalog_product_id = %(product_id)s AND status = 'PUBLISHED'"""
INSERT = """INSERT INTO catalog_product_models_3d (id, catalog_product_id, status, source, generator, sha256,
  renditions_json, metrics_json, review_notes, published_at, published_by, created_at, updated_at, created_by,
  last_modified_by, version) VALUES (%(id)s, %(product_id)s, %(status)s, 'GENERATED', %(generator)s, %(sha)s,
  %(renditions)s, %(metrics)s, %(notes)s, %(published_at)s, %(published_by)s, %(now)s, %(now)s, %(actor)s, %(actor)s, 0)"""
BACKFILL = """UPDATE wardrobe_items SET model3d_url = %(url)s, model3d_status = 'COMPLETED', model3d_generated_at = %(now)s
  WHERE catalog_product_id = %(product_id)s AND (model3d_url IS NULL OR model3d_url = '')"""
PIECES = """SELECT catalog_product_id, COUNT(*) AS n FROM wardrobe_items WHERE catalog_product_id IN %(ids)s
  AND (model3d_url IS NULL OR model3d_url = '') GROUP BY catalog_product_id"""


def pieces_without_model(conn, product_ids: list[str]) -> dict[str, int]:
    """Quantas peças de guarda-roupa de cada produto receberiam o modelo (só contagem: nada de dado pessoal)."""
    if not product_ids:
        return {}
    with conn.cursor() as cur:
        cur.execute(PIECES, {"ids": tuple(sorted(product_ids))})
        return {str(r["catalog_product_id"]): int(r["n"]) for r in cur.fetchall()}


def store(storage, data: bytes) -> str:
    """Envia e relê; devolve a chave (servida por /media/). Conteúdo divergente é apagado e vira erro."""
    sha = hashlib.sha256(data).hexdigest()
    key = f"catalog/model3d/{uuid.uuid4().hex}/{sha}.glb"
    client, bucket = storage.client, storage.bucket
    client.put_object(Bucket=bucket, Key=key, Body=data, ContentType="model/gltf-binary", IfNoneMatch="*")
    body = client.get_object(Bucket=bucket, Key=key)["Body"]
    try:
        verified = body.read(len(data) + 1)
    finally:
        body.close()
    if hashlib.sha256(verified).hexdigest() != sha:
        client.delete_object(Bucket=bucket, Key=key)
        raise ValueError("GLB_UPLOAD_VERIFICATION_FAILED")
    return key


def apply_one(conn, storage, item: dict, source: GlbSource = MESHY_CODEX) -> dict:
    """Grava o produto do item; devolve {status, url, pieces}. ``item['renditions']``: perfil → (bytes, receita)."""
    keys: list[str] = []
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    q, publish = item["quality"], item["grade"] == "BOM"
    try:
        renditions = {}
        for profile, (data, recipe) in item["renditions"].items():
            key = store(storage, data)
            keys.append(key)
            renditions[profile] = {"key": key, "bytes": len(data), "triangles": q.get("triangles"),
                                   "sha256": hashlib.sha256(data).hexdigest(), "recipe": recipe}
        imported = {"version": VERSION, "origin": source.origin, "generator": source.family, "sha256": item["sha"],
                    "meshyTaskId": item["row"].get("meshy_task_id") or None,
                    "codexProductId": item["row"].get("codex_product_id") or None,
                    "codexReview": item["row"].get("codex_quality") or None, "match": item["match"],
                    "importedAt": now.isoformat(timespec="seconds") + "Z"}
        params = {"id": str(uuid.uuid4()), "product_id": item["product_id"], "now": now, "actor": ACTOR,
                  "status": "PUBLISHED" if publish else "DRAFT", "generator": source.generator,
                  "sha": item["sha"], "renditions": json.dumps(renditions), "notes": source.notes,
                  "metrics": json.dumps({"import": imported, "quality": q}, ensure_ascii=False),
                  "published_at": now if publish else None, "published_by": ACTOR if publish else None}
        url, pieces = "/media/" + renditions["WEB"]["key"], 0
        with conn.cursor() as cur:
            if publish:
                cur.execute(RETIRE, params)
            cur.execute(INSERT, params)
            if publish:
                cur.execute(BACKFILL, {"url": url, "now": now, "product_id": item["product_id"]})
                pieces = cur.rowcount
        conn.commit()
        return {"status": params["status"], "url": url, "pieces": pieces}
    except Exception:
        # conexão morta também recusa o rollback: a limpeza do bucket acontece de qualquer jeito (nada de .glb órfão)
        try:
            conn.rollback()
        except Exception:   # noqa: BLE001 - o erro que importa é o original
            pass
        for key in keys:
            try:
                storage.client.delete_object(Bucket=storage.bucket, Key=key)
            except Exception:   # noqa: BLE001 - segue apagando as outras
                pass
        raise
