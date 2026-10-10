#!/usr/bin/env python3
"""Read-only schema/source audit. Outputs IDs/counts/hostnames, never full URLs."""
import argparse
import collections
import json
import sys
from pathlib import Path
from urllib.parse import urlsplit
from db import connect
from source_persistence import source_decision


def audit(conn):
    report = {}
    with conn.cursor() as cursor:
        cursor.execute('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY')
        cursor.execute("SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('brands','catalog_sources','catalog_products','catalog_images') ORDER BY TABLE_NAME,ORDINAL_POSITION")
        schema = cursor.fetchall()
        report['schema'] = schema
        available = {(r['TABLE_NAME'],r['COLUMN_NAME']) for r in schema}
        required = {'catalog_sources':('id','brand_id','domain','active','allows_image_persistence'),
                    'catalog_products':('id','brand_id'),
                    'catalog_images':('id','product_id','image_url','source_domain','source_url','stored_url','assets_json')}
        missing = [(t,c) for t,columns in required.items() for c in columns if (t,c) not in available]
        if missing:
            report['schema_missing'] = missing
            return report
        cursor.execute('SELECT id,brand_id,domain,active,allows_image_persistence FROM catalog_sources')
        sources = cursor.fetchall()
        report['sources_total'] = len(sources)
        report['sources_active'] = sum(bool(s['active']) for s in sources)
        report['sources_inactive'] = len(sources)-report['sources_active']
        report['sources_permission_true'] = sum(s['allows_image_persistence'] == 1 for s in sources)
        report['sources_false_or_unconfirmed'] = len(sources)-report['sources_permission_true']
        report['sources_by_brand'] = dict(collections.Counter(s['brand_id'] for s in sources))
        by_brand = collections.defaultdict(list)
        for source in sources: by_brand[source['brand_id']].append(source)
        cursor.execute('SELECT id,brand_id FROM catalog_products')
        products = {p['id']:p['brand_id'] for p in cursor.fetchall()}
        report['products_without_sources'] = sum(not by_brand[b] for b in products.values())
        cursor.execute('SELECT id,product_id,image_url,source_domain,source_url,stored_url,assets_json FROM catalog_images')
        reasons, states, hosts = collections.Counter(),collections.Counter(),collections.Counter()
        review = []
        count = no_provenance = mismatch = stored = 0
        for image in cursor.fetchall():
            count += 1
            decision = source_decision(by_brand[products.get(image['product_id'])],image['image_url'],image['source_domain'])
            states[decision['state']] += 1;reasons[decision['reason']] += 1
            hosts[decision['host'] or 'INVALID'] += 1
            no_provenance += not bool(image['source_url'] or image['source_domain'])
            mismatch += bool(decision['host'] and decision['provenance'] and decision['host'] != decision['provenance'])
            stored += bool(image['stored_url'])
            if decision['state'] != 'AUTHORIZED':
                review.append(dict(image_id=image['id'],product_id=image['product_id'],host=decision['host'],state=decision['state'],reason=decision['reason']))
        report.update(images_total=count, states=dict(states), reasons=dict(reasons), hosts=dict(hosts),
                      images_without_provenance=no_provenance, provenance_host_divergences=mismatch,
                      images_stored_url=stored, review_queue=review,
                      limitation='Legacy false flags have no explicit denial evidence; classified UNKNOWN. S3 orphan listing not performed.')
    return report


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',required=True,type=Path)
    args=parser.parse_args()
    conn=connect()
    try:
        report=audit(conn)
    finally:
        conn.rollback();conn.close()
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2,default=str),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k not in ('review_queue','schema','hosts','sources_by_brand')},ensure_ascii=False))
    return 2 if report.get('schema_missing') else 0

if __name__=='__main__':
    try:
        raise SystemExit(main())
    except Exception as error:
        print('AUDIT_FAILED:'+type(error).__name__, file=sys.stderr)
        raise SystemExit(2)
