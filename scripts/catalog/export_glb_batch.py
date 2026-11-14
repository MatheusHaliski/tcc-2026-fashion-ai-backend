#!/usr/bin/env python3
"""Etapa 3, geração: monta o lote de produtos que ainda precisam de .glb e as vistas do flat lay aprovado.

Entrada: ``faltam.txt`` (flat lay aprovado sem modelo BOM) e o ``relatorio.csv`` do import_meshy_glbs.py (os de situação
``GERAR_DE_NOVO``). Para cada produto, lê em ``catalog_images`` o flat lay com ``flat_lay_status = 'APPROVED'`` (frente e,
se houver, costas); com mais de uma imagem aprovada, fica a principal, depois a que tem costas, depois a mais recente.

Só lê o banco. Grava ``lote.csv`` (product_id, front_url, back_url, category, subcategory, motivo) e ``sem_flat_lay.txt``.
Nenhum dado pessoal: só ids e URLs públicas do catálogo (/media/).

    python scripts/catalog/export_glb_batch.py --faltam ~/glb-analise/faltam.txt \
        --relatorio ~/glb-analise/relatorio.csv --out-dir ~/glb-hunyuan
"""
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

FLAT_LAYS = """SELECT i.product_id, i.flat_lay_url, i.flat_lay_back_url, i.is_primary, i.updated_at, p.category,
  p.subcategory FROM catalog_images i JOIN catalog_products p ON p.id = i.product_id
  WHERE i.flat_lay_status = 'APPROVED' AND i.product_id IN %(ids)s"""
COLUMNS = ["product_id", "front_url", "back_url", "category", "subcategory", "motivo"]


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


def https(url: str | None) -> str:
    url = (url or "").strip()
    return url if url.startswith("https://") else ""


def best(rows: list[dict]) -> dict[str, dict]:
    """Uma imagem por produto: principal › com costas › mais recente. Sem frente https, a linha não serve."""
    chosen: dict[str, dict] = {}
    rank = lambda r: (bool(r["is_primary"]), bool(https(r["flat_lay_back_url"])), str(r["updated_at"] or ""))  # noqa: E731
    for row in rows:
        pid = str(row["product_id"]).lower()
        if not https(row["flat_lay_url"]):
            continue
        if pid not in chosen or rank(row) > rank(chosen[pid]):
            chosen[pid] = row
    return chosen


def build(conn, targets: dict[str, str]) -> tuple[list[dict], list[str]]:
    rows = []
    if targets:
        with conn.cursor() as cur:
            cur.execute(FLAT_LAYS, {"ids": tuple(sorted(targets))})
            rows = list(cur.fetchall())
    chosen = best(rows)
    lot = [{"product_id": pid, "front_url": https(r["flat_lay_url"]), "back_url": https(r["flat_lay_back_url"]),
            "category": r.get("category") or "", "subcategory": r.get("subcategory") or "", "motivo": targets[pid]}
           for pid, r in sorted(chosen.items())]
    return lot, sorted(set(targets) - set(chosen))


def _real_connect():
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import db
    return db.connect(), db.describe_target()


def main(argv=None, connect=_real_connect) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--faltam", type=Path, required=True, help="faltam.txt do import_meshy_glbs.py")
    parser.add_argument("--relatorio", type=Path, help="relatorio.csv (entram os GERAR_DE_NOVO)")
    parser.add_argument("--out-dir", type=Path, default=Path("."), help="onde gravar lote.csv e sem_flat_lay.txt")
    args = parser.parse_args(argv)
    targets = wanted(read_ids(args.faltam), regenerate_ids(args.relatorio) if args.relatorio else [])
    conn, target = connect()
    try:
        lot, without = build(conn, targets)
    finally:
        conn.close()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    with (args.out_dir / "lote.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(lot)
    (args.out_dir / "sem_flat_lay.txt").write_text("".join(f"{p}\n" for p in without), encoding="utf-8")
    reasons = {m: sum(r["motivo"] == m for r in lot) for m in ("FALTA", "GERAR_DE_NOVO")}
    print(f"lote de geração · só leitura · {target}")
    split = f"{reasons['FALTA']} FALTA + {reasons['GERAR_DE_NOVO']} GERAR_DE_NOVO no lote"
    print(f"  {len(targets):5d}  produtos pedidos ({split})")
    print(f"  {len(lot):5d}  no lote.csv ({sum(bool(r['back_url']) for r in lot)} com costas)")
    print(f"  {len(without):5d}  sem flat lay aprovado com URL https (sem_flat_lay.txt)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
