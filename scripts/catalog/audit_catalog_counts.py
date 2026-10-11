#!/usr/bin/env python3
"""Compare registered brands with brands having visible products; read-only, no credentials printed."""
import argparse
import json
from pathlib import Path
from db import connect


def audit(conn):
    with conn.cursor() as cur:
        cur.execute('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY')
        cur.execute('SELECT DATABASE() AS database_name')
        report = dict(cur.fetchone())
        cur.execute('SELECT COUNT(*) AS registered_brands FROM brands')
        report.update(cur.fetchone())
        cur.execute('SELECT ingestion_status AS status, COUNT(*) AS products, COUNT(DISTINCT brand_id) AS brands FROM catalog_products GROUP BY ingestion_status')
        report['by_status'] = cur.fetchall()
        cur.execute("SELECT COUNT(*) AS available_products, COUNT(DISTINCT brand_id) AS brands_with_available_products FROM catalog_products WHERE ingestion_status IN ('VALIDATED','PERSISTABLE','REFERENCE_ONLY')")
        report.update(cur.fetchone())
        cur.execute("SELECT b.name, COUNT(p.id) AS available_products FROM brands b LEFT JOIN catalog_products p ON p.brand_id=b.id AND p.ingestion_status IN ('VALIDATED','PERSISTABLE','REFERENCE_ONLY') GROUP BY b.id,b.name ORDER BY b.name")
        report['by_brand'] = cur.fetchall()
    conn.rollback()
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    conn = connect()
    try:
        report = audit(conn)
    finally:
        conn.close()
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k != 'by_brand'}, ensure_ascii=False))


if __name__ == '__main__':
    main()
