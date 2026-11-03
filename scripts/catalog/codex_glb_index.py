#!/usr/bin/env python3
"""Lê o SQLite local que o Codex deixou no pacote da Meshy e monta o manifesto produto × .glb do import_meshy_glbs.py.

Abre o arquivo SÓ PARA LEITURA (``mode=ro``) e nunca imprime valores de linhas no ``schema``: só tabelas, colunas,
quantidades e quais colunas parecem ligar um produto a um modelo 3D. O ``export`` grava só as colunas pedidas.

    python scripts/catalog/codex_glb_index.py schema ~/glb-analise/codex.sqlite
    python scripts/catalog/codex_glb_index.py export ~/glb-analise/codex.sqlite --table meshy_jobs \\
        --product-col product_id --glb-col glb_path [--task-col task_id] --out ~/glb-analise/manifesto.csv
    python scripts/catalog/codex_glb_index.py archive ~/glb-analise/generated-glbs.sqlite3 --out ~/glb-analise

``archive`` é o formato FAI_GLB_ARCHIVE_V1 (o .glb em pedaços dentro do SQLite, veja codex_glb_archive.py): remonta
cada .glb base, confere o SHA-256 e grava ``<out>/glb/<id>.glb`` e ``<out>/manifesto.csv`` apontando para eles.
"""
from __future__ import annotations

import argparse
import csv
import re
import sqlite3
import sys
from pathlib import Path

try:
    from .codex_glb_archive import export_archive, is_archive
except ImportError:   # rodado como script: scripts/catalog no sys.path
    from codex_glb_archive import export_archive, is_archive

PRODUCT = re.compile(r"(catalog_)?product(_id)?$|^piece_id$|^item_id$|^produto", re.I)
GLB = re.compile(r"glb|model(3d)?_?(url|path|key|file)|mesh_?(url|path)|asset_?(url|path|key)", re.I)
TASK = re.compile(r"meshy|task_?id|job_?id", re.I)
NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def open_ro(path: Path) -> sqlite3.Connection:
    if not path.is_file():
        raise SystemExit(f"arquivo não encontrado: {path}")
    return sqlite3.connect(f"file:{path.resolve()}?mode=ro", uri=True)


def quoted(name: str) -> str:
    if not NAME.match(name):
        raise SystemExit(f"nome inválido: {name!r}")
    return f'"{name}"'


def schema(conn: sqlite3.Connection) -> list[dict]:
    """Tabelas com colunas, linhas e o papel provável de cada coluna (produto, glb, tarefa da Meshy)."""
    tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
    out = []
    for table in tables:
        if not NAME.match(table):
            continue
        columns = [r[1] for r in conn.execute(f"PRAGMA table_info({quoted(table)})")]
        roles = {c: role for c in columns for role, rx in (("produto", PRODUCT), ("glb", GLB), ("meshy", TASK)) if rx.search(c)}
        rows = conn.execute(f"SELECT COUNT(*) FROM {quoted(table)}").fetchone()[0]
        out.append({"table": table, "rows": rows, "columns": columns, "roles": roles})
    return out


def candidates(tables: list[dict]) -> list[dict]:
    """Tabelas que têm, ao mesmo tempo, uma coluna de produto e uma de glb: as que dão o manifesto."""
    return [t for t in tables if {"produto", "glb"} <= set(t["roles"].values())]


def export(conn: sqlite3.Connection, table: str, product_col: str, glb_col: str, task_col: str | None, out: Path) -> int:
    cols = [quoted(product_col), quoted(glb_col)] + ([quoted(task_col)] if task_col else [])
    sql = f"SELECT {', '.join(cols)} FROM {quoted(table)} WHERE {quoted(glb_col)} IS NOT NULL AND {quoted(glb_col)} <> ''"
    count = 0
    with out.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["product_id", "glb", "meshy_task_id"])
        for row in conn.execute(sql):
            writer.writerow([str(row[0]).strip().lower(), str(row[1]).strip(), str(row[2]) if task_col and row[2] else ""])
            count += 1
    return count


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="cmd", required=True)
    show = sub.add_parser("schema", help="tabelas, colunas e quantidades (sem valores)")
    show.add_argument("db", type=Path)
    dump = sub.add_parser("export", help="grava o manifesto product_id,glb,meshy_task_id")
    dump.add_argument("db", type=Path)
    dump.add_argument("--table", required=True)
    dump.add_argument("--product-col", required=True)
    dump.add_argument("--glb-col", required=True)
    dump.add_argument("--task-col")
    dump.add_argument("--out", type=Path, default=Path("manifesto.csv"))
    archive = sub.add_parser("archive", help="remonta os .glb do arquivo FAI_GLB_ARCHIVE_V1 e grava o manifesto")
    archive.add_argument("db", type=Path)
    archive.add_argument("--out", type=Path, default=Path("."))
    args = parser.parse_args(argv)
    conn = open_ro(args.db)
    try:
        if args.cmd == "schema":
            tables = schema(conn)
            for t in tables:
                marks = ", ".join(f"{c}={r}" for c, r in t["roles"].items())
                print(f"{t['table']}: {t['rows']} linhas · {len(t['columns'])} colunas" + (f" · {marks}" if marks else ""))
            found = candidates(tables)
            print("\nmanifesto provável: " + (", ".join(t["table"] for t in found) if found else "nenhuma tabela liga produto a glb"))
            if is_archive(conn):
                print("formato FAI_GLB_ARCHIVE_V1 (.glb em pedaços): use o subcomando archive")
            return 0
        if args.cmd == "archive":
            if not is_archive(conn):
                raise SystemExit("o SQLite não está no formato FAI_GLB_ARCHIVE_V1")
            count = export_archive(conn, args.out)
            print(f"{count} .glb base → {args.out / 'glb'} · manifesto → {args.out / 'manifesto.csv'}")
            return 0 if count else 1
        count = export(conn, args.table, args.product_col, args.glb_col, args.task_col, args.out)
        print(f"{count} linhas → {args.out}")
        return 0 if count else 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
