#!/usr/bin/env python3
"""Confere a importação de modelos 3D de vitrine, só lendo: bucket ``catalog/model3d/`` × ``catalog_product_models_3d``.

Mostra o bucket em uso, quantos objetos há no prefixo e o total em MB, as linhas por status e por gerador, e cruza as
chaves de ``renditions_json`` com os objetos: ``orfaos.txt`` (objeto sem linha no banco: candidato a apagar, só depois de
confirmação) e ``sem_objeto.txt`` (linha apontando para chave que não existe: modelo quebrado no app). Nada é gravado
no banco nem no bucket.

    python scripts/catalog/audit_model3d_import.py --out-dir ~/glb-analise/auditoria
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PREFIX = "catalog/model3d/"
ROWS = "SELECT status, generator, renditions_json FROM catalog_product_models_3d"


def referenced_keys(renditions_json: str | None) -> set[str]:
    out: set[str] = set()
    for rendition in (json.loads(renditions_json) if renditions_json else {}).values():
        key = rendition.get("key") if isinstance(rendition, dict) else None
        if key and key.startswith(PREFIX):
            out.add(key)
    return out


def compare(objects: dict[str, int], rows: list[dict]) -> dict:
    status: dict[str, int] = {}
    generators: dict[str, int] = {}
    referenced: set[str] = set()
    for row in rows:
        status[row["status"]] = status.get(row["status"], 0) + 1
        generators[row["generator"] or "?"] = generators.get(row["generator"] or "?", 0) + 1
        if row["status"] != "RETIRED":
            referenced |= referenced_keys(row["renditions_json"])
        else:   # aposentado ainda é dono das suas chaves: não é órfão
            referenced |= {k for k in referenced_keys(row["renditions_json"]) if k in objects}
    return {"objects": len(objects), "mb": round(sum(objects.values()) / 1e6, 1), "status": status,
            "generators": generators, "orphans": sorted(set(objects) - referenced),
            "dangling": sorted(k for k in referenced if k not in objects)}


def list_objects(client, bucket: str) -> dict[str, int]:
    out: dict[str, int] = {}
    for page in client.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=PREFIX):
        out.update({o["Key"]: o["Size"] for o in page.get("Contents", [])})
    return out


def _real_sources():
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import db
    from category_frame_storage import FrameStorage
    storage = FrameStorage()
    return db.connect(), db.describe_target(), storage.client, storage.bucket


def main(argv=None, sources=_real_sources) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out-dir", type=Path, default=Path("."), help="onde gravar orfaos.txt e sem_objeto.txt")
    args = parser.parse_args(argv)
    conn, target, client, bucket = sources()
    try:
        with conn.cursor() as cur:
            cur.execute(ROWS)
            rows = list(cur.fetchall())
    finally:
        conn.close()
    result = compare(list_objects(client, bucket), rows)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    (args.out_dir / "orfaos.txt").write_text("".join(f"{k}\n" for k in result["orphans"]), encoding="utf-8")
    (args.out_dir / "sem_objeto.txt").write_text("".join(f"{k}\n" for k in result["dangling"]), encoding="utf-8")
    print(f"modelos 3D de vitrine · só leitura · bucket {bucket} · {target}")
    print(f"  {result['objects']:5d}  objetos em {PREFIX} ({result['mb']} MB)")
    for name, count in sorted(result["status"].items()):
        print(f"  {count:5d}  linhas {name}")
    for name, count in sorted(result["generators"].items()):
        print(f"  {count:5d}  gerador {name}")
    print(f"  {len(result['orphans']):5d}  objetos sem linha no banco (orfaos.txt: nada é apagado)")
    print(f"  {len(result['dangling']):5d}  chaves no banco sem objeto no bucket (sem_objeto.txt)")
    return 1 if result["dangling"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
