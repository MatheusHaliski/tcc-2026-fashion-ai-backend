#!/usr/bin/env python3
"""RF47 · Ingestão incremental de produtos por JSON (lista de objetos), JSONL (um por linha) ou CSV.

    python scripts/catalog/import_products.py ./data/catalog/products/nike.json [--dry-run] [--verbose]
    python scripts/catalog/import_products.py ./lote.csv --batch-size 200 [--no-create-brands]
    python scripts/catalog/import_products.py ./lote.json --start-at 1201   # retoma depois de uma queda

CSV: brand,category,subcategory,product_name,model_name,product_code,sku,gtin,ean,upc,color,color_name,collection,
material,gender,official_product_url,primary_image_url,source_domain,source_type[,aliases separados por |].
Valida linha a linha: um erro não aborta o lote; tudo vai para o relatório (total_read, created, updated, skipped,
duplicates_found, errors). Lê em streaming e confirma por item (transação por produto)."""
from __future__ import annotations

import csv
import gzip
import json
import sys
from pathlib import Path
from typing import Iterator

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common_cli import banner, parser  # noqa: E402
from db import DatabaseUnavailable, connect, now  # noqa: E402
from ingest import Ingestor, setup_logging  # noqa: E402


def read_items(path: Path) -> Iterator[tuple[str, dict]]:
    if path.suffix.lower() == ".csv":
        with path.open(newline="", encoding="utf-8-sig") as fh:
            for i, row in enumerate(csv.DictReader(fh), 2):
                yield f"{path.name}:{i}", {k.strip(): (v.strip() if isinstance(v, str) else v) for k, v in row.items() if k}
    elif path.suffix.lower() == ".jsonl" or path.name.lower().endswith(".jsonl.gz"):
        opener = gzip.open if path.name.lower().endswith(".gz") else open
        with opener(path, "rt", encoding="utf-8") as fh:          # saída do collect_official.py: um produto por linha
            for i, line in enumerate(fh, 1):
                if line.strip():
                    yield f"{path.name}:{i}", json.loads(line)
    else:
        data = json.loads(path.read_text(encoding="utf-8"))
        items = data if isinstance(data, list) else data.get("products", [])
        for i, raw in enumerate(items, 1):
            yield f"{path.name}#{i}", raw


def main(argv=None) -> int:
    ap = parser("Importa produtos (JSON/CSV) no catálogo FashionAI")
    ap.add_argument("files", nargs="+", help="arquivos .json, .jsonl, .jsonl.gz ou .csv")
    ap.add_argument("--batch-size", type=int, default=100, help="itens entre linhas de progresso")
    ap.add_argument("--no-create-brands", action="store_true", help="recusa itens de marcas que ainda não existem")
    ap.add_argument("--start-at", type=int, default=1, metavar="N",
                    help="retoma do item N de cada arquivo (os anteriores já entraram; rodar tudo de novo também é seguro, só demora mais)")
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--overwrite", action="store_true", help="curadoria: sobrescreve campos já preenchidos (padrão: só preenche vazios)")
    mode.add_argument("--skip-existing", action="store_true", help="pula registros existentes; insere somente produtos, imagens, variantes e apelidos novos")
    args = ap.parse_args(argv)
    if args.batch_size < 1:
        ap.error("--batch-size deve ser maior que zero")
    setup_logging(args.verbose)
    banner("Importação de produtos", args.dry_run)
    started = now()
    conn = connect()
    ing = Ingestor(conn, dry_run=args.dry_run, create_brands=not args.no_create_brands,
                   overwrite=args.overwrite, skip_existing=args.skip_existing)
    try:
        for f in args.files:
            path = Path(f)
            if not path.exists():
                print(f"[ERROR] arquivo não encontrado: {f}")
                ing.report.errors += 1
                continue
            for n, (label, raw) in enumerate(read_items(path), 1):
                if n < args.start_at:
                    continue
                ing.ingest(raw, label=label)
                if n % args.batch_size == 0:
                    print(f"… {n} itens de {path.name} processados", flush=True)
        try:
            ing.record_run("INCREMENTAL", ",".join(args.files), started)
        except DatabaseUnavailable as e:
            ing._error(str(e))
    except DatabaseUnavailable:
        print("[ERROR] Lote interrompido; relatório exibido abaixo, sem gravação no banco indisponível.")
    finally:
        ing.report.print()
        if getattr(conn, "open", True):
            conn.close()
    return 1 if ing.report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
