"""Etapa C do lote: envia cada peça pronta ao bucket, num prefixo novo do lote — nada existente é sobrescrito — no
mesmo formato dos lotes da Meshy (``catalog/model3d/<lote>/<subcategoria>/<id>/``: ``modelo-web.glb`` e
``tarefa.json``, mais o manifesto de encaixe, a ficha e as imagens da pintura), e monta a ``selecao.csv`` que o
``scripts/catalog/meshy_lote_download.py`` lê. Não toca no banco: a ligação ao produto é o ``import_meshy_glbs.py``
(``--generator garment-blender-1 --origin local``), rodado onde o banco é alcançável.

    python3 -m catalogo.publicar --pasta ~/catalogo-3d --lote motor-blender-2026-11-25 --seguir
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import time
from pathlib import Path

GENERATOR = "garment-blender-1"
EXTRA = ("ficha.json", "corrida.jpg")   # a foto do produto fica no endereço da tarefa (imagem_produto)


def client():
    import boto3
    from botocore.config import Config
    style = "path" if os.getenv("S3_PATH_STYLE", "").lower() == "true" else "virtual"
    return boto3.client("s3", endpoint_url=os.getenv("S3_ENDPOINT") or None,
                        region_name=os.getenv("S3_REGION") or "us-east-1",
                        aws_access_key_id=os.environ["S3_ACCESS_KEY_ID"],
                        aws_secret_access_key=os.environ["S3_SECRET_ACCESS_KEY"], config=Config(s3={"addressing_style": style}))


def task(spec: dict) -> dict:
    """``tarefa.json`` do lote: o que o download e a importação leem (marca, produto, url_oficial) e a origem."""
    o = spec.get("origem", {})
    return {"marca": spec["marca"], "produto": spec["produto"], "url_oficial": spec.get("url_oficial", ""),
            "subcategoria": spec["subcategoria"], "gerador": GENERATOR, "tamanho": spec["tamanho"],
            "padrao": o.get("padrao"), "desenhos": len(spec.get("estampas", [])), "sku": o.get("sku"),
            "imagem_produto": o.get("imagem"), "gerado_em": time.strftime("%Y-%m-%d")}


def files_of(folder: Path) -> dict[str, Path]:
    out = {"modelo-web.glb": folder / "M" / "modelo.glb", "modelo.fit.json": folder / "M" / "modelo.fit.json"}
    out |= {name: folder / name for name in EXTRA if (folder / name).is_file()}
    out |= {p.name: p for p in sorted(folder.glob("estampa-*.png"))}
    if (folder / "M" / "previa-frente.png").is_file():
        out["previa-frente.png"] = folder / "M" / "previa-frente.png"
    return out


def publish(s3, bucket: str, prefix: str, folder: Path) -> list[str]:
    spec = json.loads((folder / "ficha.json").read_text(encoding="utf-8"))
    base = f"{prefix}/{spec['subcategoria']}/{folder.name}"
    keys = []
    for name, path in files_of(folder).items():
        s3.upload_file(str(path), bucket, f"{base}/{name}")
        keys.append(f"{base}/{name}")
    s3.put_object(Bucket=bucket, Key=f"{base}/tarefa.json", ContentType="application/json",
                  Body=json.dumps(task(spec), ensure_ascii=False, indent=1).encode("utf-8"))
    keys.append(f"{base}/tarefa.json")
    return keys


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--pasta", type=Path, required=True)
    ap.add_argument("--lote", required=True, help="nome do lote no bucket, ex. motor-blender-2026-11-25")
    ap.add_argument("--bucket", default=os.getenv("S3_BUCKET"))
    ap.add_argument("--seguir", action="store_true", help="continua enviando enquanto o lote é montado")
    args = ap.parse_args(argv)
    prefix = f"catalog/model3d/{args.lote}"
    s3 = client()
    if s3.list_objects_v2(Bucket=args.bucket, Prefix=prefix + "/", MaxKeys=1).get("KeyCount") and \
            not (args.pasta / "publicado.csv").exists():
        raise SystemExit(f"o prefixo {prefix} já tem arquivos que não são deste lote: escolha outro --lote")
    selection = args.pasta / "selecao.csv"
    new_file = not selection.exists()
    with selection.open("a", newline="", encoding="utf-8") as handle, \
            (args.pasta / "publicado.csv").open("a", encoding="utf-8") as done_log:
        writer = csv.writer(handle)
        if new_file:
            writer.writerow(["prefixo", "subcategoria", "tarefa"])
        sent = 0
        while True:
            ready = [d for d in sorted(args.pasta.iterdir()) if (d / "M" / "modelo.glb").is_file()
                     and (d / "M" / "modelo.fit.json").is_file() and not (d / "publicado.txt").exists()]
            for folder in ready:
                keys = publish(s3, args.bucket, prefix, folder)
                spec = json.loads((folder / "ficha.json").read_text(encoding="utf-8"))
                writer.writerow([prefix, spec["subcategoria"], folder.name]); handle.flush()
                (folder / "publicado.txt").write_text("\n".join(keys), encoding="utf-8")
                done_log.write(f"{folder.name}\n"); done_log.flush()
                sent += 1
                if sent % 100 == 0:   # a seleção também vai ao bucket de tempos em tempos: o contêiner pode cair
                    s3.upload_file(str(selection), args.bucket, f"{prefix}/selecao.csv")
            building = not (args.pasta / "fim-construcao").exists()
            if not args.seguir or (not ready and not building):
                break
            time.sleep(30)
    s3.upload_file(str(selection), args.bucket, f"{prefix}/selecao.csv")
    print(json.dumps({"lote": prefix, "publicadas": sum(1 for _ in open(args.pasta / "publicado.csv"))}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
