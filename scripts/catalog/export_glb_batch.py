#!/usr/bin/env python3
"""Etapa 3, geração: monta o lote de produtos que ainda precisam de .glb e a melhor imagem de cada um.

Quem entra: ``--catalogo`` (todo produto sem modelo 3D PUBLISHED) ou ``--faltam`` (faltam.txt do import_meshy_glbs.py),
mais, com ``--relatorio``, os de situação ``GERAR_DE_NOVO``. Qual imagem: a melhor fonte de glb_batch_sources.py
(flat lay aprovado › Peça inteira › foto do produto, sem a pessoa recortada na GPU); ``--fontes`` restringe.

Só lê o banco. Grava ``lote.csv`` (product_id, fonte, front_url, back_url, category, subcategory, motivo) e
``sem_imagem.txt``. Nenhum dado pessoal: só ids e URLs públicas do catálogo.

    python scripts/catalog/export_glb_batch.py --catalogo --out-dir ~/glb-hunyuan
    python scripts/catalog/export_glb_batch.py --faltam ~/glb-analise/faltam.txt \
        --relatorio ~/glb-analise/relatorio.csv --out-dir ~/glb-hunyuan
"""
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

try:
    from .glb_batch_sources import IMAGES, SOURCES, WITHOUT_MODEL, choose
except ImportError:   # rodado como script: scripts/catalog no sys.path
    from glb_batch_sources import IMAGES, SOURCES, WITHOUT_MODEL, choose

COLUMNS = ["product_id", "fonte", "front_url", "back_url", "category", "subcategory", "motivo"]
CHUNK = 500


def read_ids(path: Path) -> list[str]:
    return [line.strip().lower() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def regenerate_ids(path: Path) -> list[str]:
    """product_id das linhas GERAR_DE_NOVO do relatório (quarentena do Codex, nota RUIM, sem versão WEB)."""
    with path.open(encoding="utf-8", newline="") as handle:
        rows = csv.DictReader(handle)
        return [r["product_id"].strip().lower() for r in rows if r["situacao"] == "GERAR_DE_NOVO" and r["product_id"]]


def wanted(missing: list[str], regenerate: list[str]) -> dict[str, str]:
    """product_id → motivo, sem repetir; quem está nas duas listas fica como GERAR_DE_NOVO."""
    out = {pid: "FALTA" for pid in missing}
    out.update({pid: "GERAR_DE_NOVO" for pid in regenerate})
    return out


def query(conn, sql: str, params: dict | None = None) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return list(cur.fetchall())


def catalog_targets(conn) -> dict[str, str]:
    return {str(r["id"]).lower(): "SEM_MODELO" for r in query(conn, WITHOUT_MODEL)}


def build(conn, targets: dict[str, str], allowed=SOURCES) -> tuple[list[dict], list[str]]:
    ids, rows = sorted(targets), []
    for start in range(0, len(ids), CHUNK):   # catálogo inteiro: IN em blocos, para não estourar o pacote do MySQL
        rows += query(conn, IMAGES, {"ids": tuple(ids[start:start + CHUNK])})
    chosen = choose(rows, allowed)
    lot = [{"product_id": pid, **chosen[pid], "motivo": targets[pid]} for pid in sorted(chosen)]
    return lot, sorted(set(targets) - set(chosen))


def _real_connect():
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import db
    return db.connect(), db.describe_target()


def main(argv=None, connect=_real_connect) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    who = parser.add_mutually_exclusive_group(required=True)
    who.add_argument("--catalogo", action="store_true", help="todo produto sem modelo 3D PUBLISHED")
    who.add_argument("--faltam", type=Path, help="faltam.txt do import_meshy_glbs.py")
    parser.add_argument("--relatorio", type=Path, help="relatorio.csv (entram também os GERAR_DE_NOVO)")
    parser.add_argument("--fontes", default=",".join(SOURCES), help=f"fontes aceitas, em ordem fixa ({','.join(SOURCES)})")
    parser.add_argument("--out-dir", type=Path, default=Path("."), help="onde gravar lote.csv e sem_imagem.txt")
    args = parser.parse_args(argv)
    allowed = {s.strip().upper() for s in args.fontes.split(",") if s.strip()}
    if not allowed or allowed - set(SOURCES):
        parser.error(f"--fontes aceita só {', '.join(SOURCES)}")
    conn, target = connect()
    try:
        targets = catalog_targets(conn) if args.catalogo else wanted(read_ids(args.faltam), [])
        if args.relatorio:
            targets.update(wanted([], regenerate_ids(args.relatorio)))
        lot, without = build(conn, targets, allowed)
    finally:
        conn.close()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    with (args.out_dir / "lote.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(lot)
    (args.out_dir / "sem_imagem.txt").write_text("".join(f"{p}\n" for p in without), encoding="utf-8")
    print(f"lote de geração · só leitura · {target}")
    print(f"  {len(targets):5d}  produtos pedidos")
    for source in SOURCES:
        print(f"  {sum(r['fonte'] == source for r in lot):5d}  fonte {source}")
    print(f"  {sum(bool(r['back_url']) for r in lot):5d}  com costas (só flat lay)")
    print(f"  {len(without):5d}  sem nenhuma imagem https utilizável (sem_imagem.txt)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
