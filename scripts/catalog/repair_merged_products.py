#!/usr/bin/env python3
"""RF47 · Reparo: produtos que a URL canônica antiga juntou num só (ex.: as 248 peças da Gap viraram 1).

Até a regra nova, a URL canônica descartava a query inteira, e a Gap só identifica cada peça por ?pid=
(gap.com/browse/product.do?pid=…). As linhas com a mesma URL base caíam no mesmo produto, que acumulava as fotos de
todas as peças. A regra nova (IDENTITY_PARAMS em normalize_product.py e CatalogNormalizer.java) mantém o pid, mas os
bancos que já importaram o acervo continuam com o produto agrupado. Este script:

  1. encontra produtos visíveis cuja URL canônica não tem identificador e cujas fotos vieram de 2+ páginas de produto
     diferentes pela regra nova (cada foto guarda em source_url a página da linha que a trouxe);
  2. com --apply, esconde esses produtos (ingestion_status = REJECTED; nada é apagado, peças do guarda-roupa que
     apontam para eles continuam válidas);
  3. com --reimport ARQUIVO, importa de novo só as linhas desses produtos (--skip-existing), que agora viram uma peça
     cada, com a própria foto.

    python scripts/catalog/repair_merged_products.py                                   # só relata (nada é gravado)
    python scripts/catalog/repair_merged_products.py --reimport data/catalog/acervo/acervo-oficial-2026-10-05.jsonl.gz --dry-run
    python scripts/catalog/repair_merged_products.py --apply --reimport data/catalog/acervo/acervo-oficial-2026-10-05.jsonl.gz

Sem --apply nada é gravado. Rodar de novo depois do reparo não encontra mais nada (idempotente).
"""
from __future__ import annotations

import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common_cli import banner, parser  # noqa: E402
from db import connect, now  # noqa: E402
from ingest import Ingestor, setup_logging  # noqa: E402
from normalize_product import canonical_url  # noqa: E402

VISIBLE = ("VALIDATED", "PERSISTABLE", "REFERENCE_ONLY")
CHUNK = 500


def base(url: str) -> str:
    return url.split("?", 1)[0]


def find_merged(products: list[dict], images: list[dict]) -> list[dict]:
    """Produtos agrupados: URL canônica sem identificador e fotos de 2+ páginas que a regra nova separa.

    products: [{id, canonical_url, ...}] · images: [{product_id, source_url}] → [{**produto, pieces, photos}],
    em que pieces são as URLs canônicas (regra nova) das páginas que o produto juntou."""
    by_product: dict[str, list[dict]] = defaultdict(list)
    for img in images:
        by_product[img["product_id"]].append(img)
    merged = []
    for p in products:
        current = p.get("canonical_url")
        if not current or "?" in current:
            continue
        imgs = by_product.get(p["id"], [])
        pieces = {canonical_url(i.get("source_url")) for i in imgs if i.get("source_url")}
        pieces = sorted(u for u in pieces if u and "?" in u and base(u) == current)
        if len(pieces) >= 2:
            merged.append({**p, "pieces": pieces, "photos": len(imgs)})
    return merged


def load_candidates(cur) -> list[dict]:
    """Produtos visíveis, com URL canônica sem identificador e fotos de mais de uma página."""
    marks = ",".join(["%s"] * len(VISIBLE))
    cur.execute("SELECT p.id, p.brand_id, b.name AS brand, p.product_name, p.canonical_url, COUNT(DISTINCT i.source_url) AS pages "
                "FROM catalog_products p JOIN catalog_images i ON i.product_id = p.id LEFT JOIN brands b ON b.id = p.brand_id "
                f"WHERE p.ingestion_status IN ({marks}) AND p.canonical_url IS NOT NULL AND INSTR(p.canonical_url, '?') = 0 "
                "GROUP BY p.id, p.brand_id, b.name, p.product_name, p.canonical_url HAVING COUNT(DISTINCT i.source_url) > 1", VISIBLE)
    products = cur.fetchall()
    images: list[dict] = []
    ids = [p["id"] for p in products]
    for k in range(0, len(ids), CHUNK):
        part = ids[k:k + CHUNK]
        cur.execute(f"SELECT product_id, source_url FROM catalog_images WHERE product_id IN ({','.join(['%s'] * len(part))})", part)
        images.extend(cur.fetchall())
    return find_merged(products, images)


def wardrobe_refs(cur, ids: list[str]) -> int | None:
    """Peças do guarda-roupa que apontam para os produtos agrupados (continuam válidas; só informamos)."""
    if not ids:
        return 0
    try:
        cur.execute(f"SELECT COUNT(*) AS n FROM wardrobe_items WHERE catalog_product_id IN ({','.join(['%s'] * len(ids))})", ids)
        return int(cur.fetchone()["n"])
    except Exception:  # banco sem a tabela (testes, catálogo isolado)
        return None


def hide(cur, ids: list[str]) -> int:
    if not ids:
        return 0
    marks = ",".join(["%s"] * len(ids))
    cur.execute(f"UPDATE catalog_products SET ingestion_status = 'REJECTED', updated_at = %s WHERE id IN ({marks}) "
                f"AND ingestion_status IN ({','.join(['%s'] * len(VISIBLE))})", (now(), *ids, *VISIBLE))
    count = getattr(cur, "rowcount", -1)
    return len(ids) if count is None or count < 0 else count


def rows_to_reimport(files: list[str], merged: list[dict]):
    """Linhas dos arquivos cuja página (regra nova) é uma das peças que os produtos agrupados juntaram."""
    from import_products import read_items  # noqa: E402 - só quando há reimportação
    wanted = {u for m in merged for u in m["pieces"]}
    for f in files:
        for label, raw in read_items(Path(f)):
            url = canonical_url(raw.get("official_product_url") or raw.get("product_url") or raw.get("url"))
            if url in wanted:
                yield label, raw


def repair(conn, apply: bool = False, reimport: list[str] | None = None, out=print) -> dict:
    with conn.cursor() as cur:
        merged = load_candidates(cur)
        refs = wardrobe_refs(cur, [m["id"] for m in merged])
    out(f"{len(merged)} produto(s) agrupado(s) pela URL antiga" + (f" · {refs} peça(s) de guarda-roupa apontam para eles (continuam válidas)" if refs else ""))
    for m in merged:
        out(f"  [AGRUPADO] {m.get('brand') or m.get('brand_id')} · {m.get('product_name')} · {m['canonical_url']} · "
            f"{len(m['pieces'])} peças · {m['photos']} fotos")
    hidden = 0
    if apply and merged:
        with conn.cursor() as cur:
            hidden = hide(cur, [m["id"] for m in merged])
        conn.commit()
        out(f"{hidden} produto(s) agrupado(s) escondido(s) (REJECTED)")
    report = None
    if reimport and merged:
        ing = Ingestor(conn, dry_run=not apply, skip_existing=True)
        for label, raw in rows_to_reimport(reimport, merged):
            ing.ingest(raw, label=label)
        report = ing.report
        out(f"reimportação{'' if apply else ' (simulada)'}: {report.created} criada(s), {report.updated} atualizada(s), "
            f"{report.skipped} sem mudança, {report.errors} erro(s)")
    elif merged and not reimport:
        out("Próximo passo: rode de novo com --reimport <arquivo do acervo> para criar uma peça por página.")
    return {"merged": merged, "hidden": hidden, "report": report}


def main(argv=None) -> int:
    ap = parser("Desfaz produtos agrupados pela URL canônica antiga (ex.: Gap ?pid=)")
    ap.add_argument("--apply", action="store_true", help="grava: esconde os agrupados e importa as linhas de --reimport")
    ap.add_argument("--reimport", nargs="+", metavar="ARQUIVO", help="arquivos do acervo (.json, .jsonl, .jsonl.gz, .csv) com as linhas originais")
    args = ap.parse_args(argv)
    apply = args.apply and not args.dry_run
    setup_logging(args.verbose)
    banner("Reparo de produtos agrupados", not apply)
    conn = connect()
    try:
        result = repair(conn, apply=apply, reimport=args.reimport)
    finally:
        conn.close()
    return 1 if result["report"] is not None and result["report"].errors else 0


if __name__ == "__main__":
    sys.exit(main())
