#!/usr/bin/env python3
"""Baixa do bucket um lote aprovado da Meshy e monta o manifesto do ``import_meshy_glbs.py``.

A seleção é um CSV (``prefixo, subcategoria, tarefa``): uma linha por modelo que entra, nada fora dela é baixado.
Para cada linha vêm só ``modelo-web.glb`` e ``tarefa.json``, gravados em ``<pasta>/<subcategoria>/<tarefa>/``; pastas
"recusado" nunca entram. O manifesto (``product_id, glb, brand, name, official_product_url, codex_product_id,
codex_quality``) sai de ``marca``, ``produto`` e ``url_oficial`` do ``tarefa.json``; ``codex_product_id`` é o id da tarefa
e ``product_id``/``codex_quality`` ficam vazios (a ligação ao produto é feita no ensaio, pela URL ou marca + nome).

    python scripts/catalog/meshy_lote_download.py --selecao docs/provador/meshy/importacao-2026-11-23/selecao.csv \
        --pasta ~/glb-meshy-2026-11-23

Depois: ``python scripts/catalog/import_meshy_glbs.py --manifest <pasta>/manifesto.csv --root <pasta> --out-dir <saida>``
(ensaio) e, com autorização, o mesmo comando com ``--apply``. Lê o bucket pelas variáveis S3_* do backend; não grava nele.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from pathlib import Path

FILES = ("modelo-web.glb", "tarefa.json")
OPTIONAL = ("modelo-web.fit.json",)   # manifesto de encaixe do provador, quando o lote tem (motor Blender: modelo.fit.json)
BUCKET_NAME = {"modelo-web.fit.json": "modelo.fit.json"}
MANIFEST = ["product_id", "glb", "brand", "name", "official_product_url", "codex_product_id", "codex_quality"]


def read_selection(path: Path) -> list[dict]:
    with path.open(encoding="utf-8", newline="") as handle:
        rows = [{k: (v or "").strip() for k, v in r.items()} for r in csv.DictReader(handle)]
    bad = [r for r in rows if not (r.get("prefixo") and r.get("subcategoria") and r.get("tarefa"))
           or "recusado" in f"{r.get('prefixo')}/{r.get('subcategoria')}/{r.get('tarefa')}".lower()]
    if bad:
        sys.exit(f"seleção inválida ({len(bad)} linha(s) sem prefixo/subcategoria/tarefa ou em pasta recusada)")
    keys = [(r["subcategoria"], r["tarefa"]) for r in rows]
    if len(set(keys)) != len(keys):
        sys.exit("seleção com subcategoria/tarefa repetida")
    return rows


def s3_client():
    import boto3
    from botocore.config import Config
    style = "path" if os.getenv("S3_PATH_STYLE", "").lower() == "true" else "virtual"
    return boto3.client("s3", endpoint_url=os.getenv("S3_ENDPOINT") or None,
                        region_name=os.getenv("S3_REGION", "us-east-1"),
                        aws_access_key_id=os.environ["S3_ACCESS_KEY_ID"],
                        aws_secret_access_key=os.environ["S3_SECRET_ACCESS_KEY"],
                        config=Config(s3={"addressing_style": style}, connect_timeout=15, read_timeout=60,
                                      retries={"max_attempts": 3}))


def download(client, bucket: str, row: dict, folder: Path) -> Path:
    """Baixa os dois arquivos da tarefa; devolve a pasta <subcategoria>/<tarefa>. Já baixado: não baixa de novo."""
    target = folder / row["subcategoria"] / row["tarefa"]
    target.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        out = target / name
        if out.is_file() and out.stat().st_size > 0:
            continue
        key = f"{row['prefixo'].rstrip('/')}/{row['subcategoria']}/{row['tarefa']}/{name}"
        client.download_file(bucket, key, str(out))
    for name in OPTIONAL:
        out = target / name
        if out.is_file() and out.stat().st_size > 0:
            continue
        key = f"{row['prefixo'].rstrip('/')}/{row['subcategoria']}/{row['tarefa']}/{BUCKET_NAME.get(name, name)}"
        try:
            client.download_file(bucket, key, str(out))
        except Exception:   # lote sem manifesto (Meshy): o provador mede o .glb
            out.unlink(missing_ok=True)
    return target


def manifest_row(folder: Path, task_dir: Path, row: dict) -> dict:
    task = json.loads((task_dir / "tarefa.json").read_text(encoding="utf-8"))
    if task.get("id") not in (None, row["tarefa"]) or task.get("subcategoria") not in (None, row["subcategoria"]):
        raise ValueError(f"tarefa.json de {task_dir.relative_to(folder)} não bate com a seleção")
    return {"product_id": "", "glb": str((task_dir / "modelo-web.glb").relative_to(folder)).replace(os.sep, "/"),
            "brand": task.get("marca", ""), "name": task.get("produto", ""),
            "official_product_url": task.get("url_oficial", ""), "codex_product_id": row["tarefa"],
            "codex_quality": ""}


def write_manifest(path: Path, rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=MANIFEST)
        writer.writeheader()
        writer.writerows(rows)


def main(argv=None, client_factory=s3_client) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--selecao", type=Path, required=True, help="CSV prefixo, subcategoria, tarefa")
    parser.add_argument("--pasta", type=Path, required=True, help="onde gravar <subcategoria>/<tarefa>/ e manifesto.csv")
    parser.add_argument("--bucket", default=os.getenv("S3_BUCKET"), help="padrão: S3_BUCKET")
    args = parser.parse_args(argv)
    if not args.bucket:
        sys.exit("defina S3_BUCKET (ou --bucket)")
    rows = read_selection(args.selecao)
    client = client_factory()
    manifest = []
    for row in rows:
        task_dir = download(client, args.bucket, row, args.pasta)
        manifest.append(manifest_row(args.pasta, task_dir, row))
        print(f"  {row['subcategoria']}/{row['tarefa']}")
    write_manifest(args.pasta / "manifesto.csv", manifest)
    print(f"{len(manifest)} modelos em {args.pasta} · manifesto: {args.pasta / 'manifesto.csv'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
