#!/usr/bin/env python3
"""RF47 · Manutenção: revalida páginas e fotos oficiais (HEAD) e atualiza source_status / last_verified_at.
ACTIVE (2xx/3xx) · UNAVAILABLE (5xx, timeout) · SOURCE_REMOVED (404/410) · NEEDS_REVALIDATION (outros 4xx).
Também remove candidatos DISCOVERED que ninguém escolheu em --discovered-days (padrão 30).

    python scripts/catalog/revalidate_catalog.py [--limit 200] [--dry-run] [--offline]"""
from __future__ import annotations

import sys
import urllib.request
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common_cli import banner, parser  # noqa: E402
from db import connect, now  # noqa: E402
from ingest import setup_logging  # noqa: E402


def check(url: str, timeout=8) -> str:
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "FashionAI-CatalogBot/1.0 (+catalog revalidation)"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return "ACTIVE" if resp.status < 400 else "NEEDS_REVALIDATION"
    except urllib.error.HTTPError as e:
        if e.code in (404, 410):
            return "SOURCE_REMOVED"
        return "UNAVAILABLE" if e.code >= 500 else "NEEDS_REVALIDATION"
    except Exception:
        return "UNAVAILABLE"


def main(argv=None) -> int:
    ap = parser("Revalida fontes externas do catálogo")
    ap.add_argument("--limit", type=int, default=200)
    ap.add_argument("--discovered-days", type=int, default=30)
    ap.add_argument("--offline", action="store_true", help="não acessa a rede: só limpa DISCOVERED antigos")
    args = ap.parse_args(argv)
    setup_logging(args.verbose)
    banner("Revalidação do catálogo", args.dry_run)
    conn = connect()
    stats = {}
    with conn.cursor() as cur:
        if not args.offline:
            cur.execute("SELECT id, official_product_url FROM catalog_products WHERE official_product_url IS NOT NULL "
                        "ORDER BY last_verified_at IS NOT NULL, last_verified_at LIMIT %s", (args.limit,))
            for r in cur.fetchall():
                status = check(r["official_product_url"])
                stats[status] = stats.get(status, 0) + 1
                print(f"[{status}] {r['official_product_url']}")
                cur.execute("UPDATE catalog_products SET source_status = %s, last_verified_at = %s WHERE id = %s", (status, now(), r["id"]))
        cutoff = now() - timedelta(days=args.discovered_days)
        cur.execute("DELETE FROM catalog_products WHERE ingestion_status = 'DISCOVERED' AND owners_count = 0 AND created_at < %s", (cutoff,))
        print(f"{cur.rowcount} candidatos DISCOVERED antigos removidos")
    conn.rollback() if args.dry_run else conn.commit()
    print(stats)
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
