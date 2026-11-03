"""Linha de comando do lote de imagens do catálogo (process_catalog_images.py): opções e combinações recusadas."""
from __future__ import annotations

import argparse
from pathlib import Path


def build_parser(description):
    ap = argparse.ArgumentParser(description=description)
    source = ap.add_mutually_exclusive_group(required=True)
    source.add_argument("--snapshot", nargs="+", type=Path, help="JSONL/JSONL.GZ: estado local, não produção")
    source.add_argument("--database", action="store_true", help="Inventário atual do MySQL via MYSQL_*")
    ap.add_argument("--category-frame", action="store_true",
                    help="catalog/semantic-regions.json: regra de enquadramento do produto do card; quadro 3:4 preenchido "
                         "100%% pela peça, sem fundo nem pessoas: gola, zíper, centro do acessório e logo do calçado; "
                         "sem região válida a foto não é reenquadrada (requer --apply)")
    ap.add_argument("--force-category-frame", action="store_true",
                    help="Decisão do responsável: enquadra e persiste todas as fotos sem exigir autorização da fonte nem identificação "
                         "visual confirmada; focos estimados ficam no relatório. Sem quadro preenchido pela peça a "
                         "foto não é gravada (requer --database --apply --category-frame)")
    ap.add_argument("--apply", action="store_true", help="Aplicar pipeline; com --database persiste os metadados")
    ap.add_argument("--output", required=True, type=Path, help="Planilha .xlsx")
    ap.add_argument("--checkpoint", type=Path, help="SQLite de análises para retomada")
    ap.add_argument("--java-classpath")
    ap.add_argument("--java")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--java-threads", type=int, default=2)
    ap.add_argument("--authorized-only", action="store_true", help="Selecionar produtos com ao menos uma imagem autorizada; preservar inventário completo por produto")
    ap.add_argument("--limit", type=int, help="Limitar imagens apenas para amostra explicitamente identificada")
    ap.add_argument("--timeout", type=float, default=25)
    return ap


def parse_args(ap, argv):
    args = ap.parse_args(argv)
    if args.authorized_only and not args.database:
        ap.error("--authorized-only requer --database")
    if args.category_frame and not args.database:
        ap.error("--category-frame requer --database: snapshots não autorizam uploads")
    if args.category_frame and not args.apply:
        ap.error("--category-frame requer --apply")
    if args.force_category_frame and not (args.database and args.apply and args.category_frame):
        ap.error("--force-category-frame requer --database --apply --category-frame")
    if args.output.suffix.lower() != ".xlsx":
        ap.error("--output deve terminar em .xlsx")
    if args.workers < 1 or args.workers > 16 or args.java_threads < 1 or args.java_threads > 16:
        ap.error("Concorrência deve ficar entre 1 e 16")
    if args.limit is not None and args.limit < 1:
        ap.error("--limit deve ser positivo")
    return args
