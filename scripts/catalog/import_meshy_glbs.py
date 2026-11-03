#!/usr/bin/env python3
"""Etapa 3, lote do Codex: reaproveita os .glb que o Codex já gerou na Meshy e deixa para a geração só o que falta.

Entrada: o manifesto produto × .glb (codex_glb_index.py export) e a pasta com os arquivos extraídos do pacote. Para cada
linha: identifica a peça no catálogo (id, nome, categoria, marca), mede a qualidade do .glb (glb_quality.py) e decide:

- ``BOM``/``REVISAR``: entra como asset 3D do produto (garment_assets_3d, status DRAFT, origem GENERATED, sem esqueleto:
  aparece no visualizador da peça, nunca veste o avatar; a revisão humana continua no GarmentAssetService);
- ``RUIM``, sem produto ou já importado: não entra.

Saídas: ``relatorio.csv`` (peça, arquivo, nota, métricas, situação) e ``faltam.txt`` (produtos com flat lay aprovado
sem modelo 3D bom: a entrada da geração da etapa 3). Por padrão é um ensaio, com o banco só lido. ``--apply`` envia ao
armazenamento do app e grava, e só roda com autorização explícita.

    python scripts/catalog/import_meshy_glbs.py --manifest manifesto.csv --root ~/glb-analise --out-dir ~/glb-analise
    python scripts/catalog/import_meshy_glbs.py --manifest manifesto.csv --root ~/glb-analise --apply
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

try:
    from .glb_quality import inspect, rendition_profile
except ImportError:   # rodado como script: scripts/catalog no sys.path
    from glb_quality import inspect, rendition_profile

VERSION = "MESHY_GLB_V1"
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
PRODUCTS = """SELECT p.id, p.product_name, p.category, p.subcategory, b.name AS brand
  FROM catalog_products p LEFT JOIN brands b ON b.id = p.brand_id WHERE p.id IN %(ids)s"""
EXISTING = """SELECT catalog_product_id, JSON_UNQUOTE(JSON_EXTRACT(metrics_json, '$.import.sha256')) AS sha, status
  FROM garment_assets_3d WHERE catalog_product_id IS NOT NULL AND status <> 'RETIRED'"""
APPROVED_FLAT_LAYS = "SELECT DISTINCT product_id FROM catalog_images WHERE flat_lay_status = 'APPROVED'"
INSERT = """INSERT INTO garment_assets_3d (id, catalog_product_id, status, rig_standard, source, logo_authorization,
  metrics_json, renditions_json, review_notes, created_at, updated_at, created_by, last_modified_by, version)
  VALUES (%(id)s, %(product_id)s, 'DRAFT', 'NONE', 'GENERATED', 'PENDING', %(metrics)s, %(renditions)s, %(notes)s,
  %(now)s, %(now)s, 'import_meshy_glbs', 'import_meshy_glbs', 0)"""
NOTES = "Meshy (lote do Codex) sem esqueleto: visualizador da peça, não veste o avatar. Revisar cor, estampa e logo."
REPORT = ["arquivo", "product_id", "nome", "categoria", "subcategoria", "marca", "nota", "triangulos", "vertices",
          "texturas", "maior_textura", "mb", "problemas", "situacao"]
RANK = {"BOM": 0, "REVISAR": 1, "RUIM": 2}


def read_manifest(path: Path) -> list[dict]:
    with path.open(encoding="utf-8", newline="") as handle:
        return [{**r, "product_id": (r.get("product_id") or "").strip().lower()} for r in csv.DictReader(handle)]


def locate(root: Path, glb: str) -> Path | None:
    """Arquivo do manifesto dentro da pasta extraída: caminho relativo ou, se o Codex gravou outro, pelo nome."""
    name = glb.split("?")[0].rstrip("/").split("/")[-1]
    direct = (root / glb.lstrip("/")).resolve()
    if direct.is_file() and root.resolve() in direct.parents:
        return direct
    hits = sorted(root.rglob(name)) if name.lower().endswith(".glb") else []
    return hits[0] if len(hits) == 1 else None   # nome repetido em duas pastas: ambíguo, não adivinha


def query(conn, sql: str, params: dict | None = None) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return list(cur.fetchall())


def assess(rows: list[dict], root: Path, conn) -> list[dict]:
    """Uma linha do relatório por arquivo do manifesto, com a situação de cada um."""
    ids = tuple(sorted({r["product_id"] for r in rows if UUID.match(r["product_id"])}))
    products = {str(p["id"]): p for p in query(conn, PRODUCTS, {"ids": ids})} if ids else {}
    existing = {(str(e["catalog_product_id"]), e["sha"]) for e in query(conn, EXISTING)}
    out = []
    for r in rows:
        path = locate(root, r.get("glb", ""))
        data = path.read_bytes() if path else b""
        q = inspect(data) if path else {"grade": "RUIM", "issues": ["FILE_NOT_FOUND"], "bytes": 0}
        sha = hashlib.sha256(data).hexdigest() if path else None
        product = products.get(r["product_id"])
        if product is None:
            status = "SEM_PRODUTO"
        elif (r["product_id"], sha) in existing:
            status = "JA_IMPORTADO"
        elif q["grade"] == "RUIM" or rendition_profile(q["bytes"]) is None:
            status = "GERAR_DE_NOVO"
        else:
            status = "IMPORTAR"
        out.append({"row": r, "path": path, "sha": sha, "quality": q, "product": product or {}, "status": status})
    keep_best(out)
    return out


def keep_best(items: list[dict]) -> None:
    """Dois .glb do mesmo produto: entra o de melhor nota (empate: o mais leve); o outro fica como DUPLICADO."""
    best: dict[str, dict] = {}
    for item in (i for i in items if i["status"] == "IMPORTAR"):
        key = (RANK[item["quality"]["grade"]], item["quality"]["bytes"])
        current = best.get(item["row"]["product_id"])
        if current is None or key < (RANK[current["quality"]["grade"]], current["quality"]["bytes"]):
            if current:
                current["status"] = "DUPLICADO"
            best[item["row"]["product_id"]] = item
        else:
            item["status"] = "DUPLICADO"


def report_row(item: dict, root: Path) -> list:
    q, p = item["quality"], item["product"]
    name = str(item["path"].relative_to(root)) if item["path"] else item["row"].get("glb", "")
    return [name, item["row"]["product_id"], p.get("product_name", "?"), p.get("category", ""), p.get("subcategory", ""),
            p.get("brand", ""), q["grade"], q.get("triangles", ""), q.get("vertices", ""), q.get("textures", ""),
            q.get("max_texture", ""), round(q["bytes"] / 1e6, 2), " ".join(q["issues"]), item["status"]]


def missing(conn, items: list[dict]) -> list[str]:
    """Flat lay aprovado (saída da etapa 2) sem modelo 3D bom, nem já gravado nem entrando agora."""
    covered = {str(e["catalog_product_id"]) for e in query(conn, EXISTING)}
    covered |= {i["row"]["product_id"] for i in items if i["status"] in ("IMPORTAR", "JA_IMPORTADO")}
    return sorted(str(r["product_id"]) for r in query(conn, APPROVED_FLAT_LAYS) if str(r["product_id"]) not in covered)


def store(storage, data: bytes, sha: str) -> str:
    """Envia e relê o .glb (mesma verificação do FrameStorage); devolve a chave servida por /media/."""
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


def apply_one(conn, storage, item: dict) -> None:
    data, q = item["path"].read_bytes(), item["quality"]
    key = store(storage, data, item["sha"])
    imported = {"version": VERSION, "origin": "codex", "generator": "meshy", "sha256": item["sha"],
                "meshyTaskId": item["row"].get("meshy_task_id") or None, "file": item["path"].name,
                "importedAt": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    rendition = {"key": key, "bytes": len(data), "triangles": q["triangles"], "sha256": item["sha"]}
    try:
        with conn.cursor() as cur:
            cur.execute(INSERT, {"id": str(uuid.uuid4()), "product_id": item["row"]["product_id"],
                                 "metrics": json.dumps({"import": imported, "quality": q}, ensure_ascii=False),
                                 "renditions": json.dumps({rendition_profile(len(data)): rendition}),
                                 "notes": NOTES, "now": datetime.now(timezone.utc).replace(tzinfo=None)})
        conn.commit()
    except Exception:
        conn.rollback()
        storage.client.delete_object(Bucket=storage.bucket, Key=key)   # nada de .glb órfão no bucket
        raise


def _real_connect():
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import db
    return db.connect(), db.describe_target()


def _real_storage():
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from category_frame_storage import FrameStorage
    return FrameStorage()


def main(argv=None, connect=_real_connect, make_storage=_real_storage) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--manifest", type=Path, required=True, help="product_id,glb[,meshy_task_id]")
    parser.add_argument("--root", type=Path, required=True, help="pasta com os .glb extraídos do pacote")
    parser.add_argument("--out-dir", type=Path, default=Path("."), help="onde gravar relatorio.csv e faltam.txt")
    parser.add_argument("--apply", action="store_true", help="envia e grava no banco (produção: só com autorização)")
    args = parser.parse_args(argv)
    conn, target = connect()
    items = assess(read_manifest(args.manifest), args.root, conn)
    storage = make_storage() if args.apply else None
    for item in (i for i in items if i["status"] == "IMPORTAR" and storage is not None):
        try:
            apply_one(conn, storage, item)
            item["status"] = "IMPORTADO"
        except Exception as exc:   # um arquivo com problema não para o lote
            item["status"] = f"FALHOU {type(exc).__name__}"
    args.out_dir.mkdir(parents=True, exist_ok=True)
    with (args.out_dir / "relatorio.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(REPORT)
        writer.writerows(report_row(i, args.root) for i in items)
    todo = missing(conn, items)
    (args.out_dir / "faltam.txt").write_text("".join(f"{p}\n" for p in todo), encoding="utf-8")
    counts: dict[str, int] = {}
    for item in items:
        counts[item["status"]] = counts.get(item["status"], 0) + 1
    mode = "GRAVANDO" if args.apply else "ensaio (nada é gravado)"
    print(f"glb do Codex: {len(items)} arquivos · {mode} · {target}")
    for key, count in sorted(counts.items()):
        print(f"  {count:5d}  {key}")
    print(f"  {len(todo):5d}  ainda sem modelo 3D (faltam.txt → geração da etapa 3)")
    return 1 if any(i["status"].startswith("FALHOU") for i in items) else 0


if __name__ == "__main__":
    raise SystemExit(main())
