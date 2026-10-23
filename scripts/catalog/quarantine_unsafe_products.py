#!/usr/bin/env python3
"""Audit and reversibly exclude products whose EVERY source candidate is proven below 25% height.

Audit (read only): --report work/quarantine.json
Offline audit:    --snapshot reviewed-snapshot.json --report work/quarantine.json
Apply report:     --report work/quarantine.json --apply
Restore report:   --report work/quarantine.json --restore
Network/model/occlusion/empty-mask failures and any valid or unmeasured alternate
prevent exclusion. No DELETE, and wardrobe records are never modified.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import re
from pathlib import Path
from datetime import datetime, timezone
try:
    from . import db
    from .process_photo_sets import obj, current
    from .photo_set import PHOTO_SET_VERSION
    from .photo_preflight import PREFLIGHT_VERSION, MIN_SOURCE_HEIGHT
except ImportError:
    import db
    from process_photo_sets import obj, current
    from photo_set import PHOTO_SET_VERSION
    from photo_preflight import PREFLIGHT_VERSION, MIN_SOURCE_HEIGHT

VERSION = 'CATALOG_UNSAFE_QUARANTINE_V2'
VISIBLE = {'VALIDATED', 'PERSISTABLE', 'REFERENCE_ONLY'}
REASON = 'SOURCE_GARMENT_BELOW_MIN_HEIGHT'
PRODUCT_SELECT = 'SELECT id,category,subcategory,color,ingestion_status,metadata_json,version FROM catalog_products'
IMAGE_SELECT = 'SELECT id,image_url,source_sha256,assets_json,version FROM catalog_images WHERE product_id=%s ORDER BY id'


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


def confirmed_small(product, image):
    record = {**image, 'category': product['category'], 'subcategory': product['subcategory'], 'color': product.get('color')}
    state = obj(image.get('assets_json')).get('photoSet', {})
    preflight = obj(state.get('metrics')).get('preflight', {})
    fraction = preflight.get('sourceGarmentHeightFraction')
    sha = image.get('source_sha256')
    return (current(record) and state.get('version') == PHOTO_SET_VERSION
            and state.get('status') == 'INELIGIBLE' and state.get('reason') == REASON
            and isinstance(sha, str) and re.fullmatch('[0-9a-f]{64}', sha) is not None
            and preflight.get('version') == PREFLIGHT_VERSION
            and preflight.get('status') == 'INELIGIBLE' and preflight.get('reason') == REASON
            and preflight.get('measurementReliable') is True
            and preflight.get('isolationVerified') is True and preflight.get('humanAssessmentComplete') is True
            and preflight.get('complete') is True and preflight.get('occluded') is False
            and not isinstance(fraction, bool) and isinstance(fraction, (int, float))
            and math.isfinite(fraction) and 0 < fraction < MIN_SOURCE_HEIGHT)


def eligible(product, images):
    return product.get('ingestion_status') in VISIBLE and bool(images) and all(confirmed_small(product, image) for image in images)


def image_identity(image):
    state = obj(image.get('assets_json')).get('photoSet', {})
    return {'id': image['id'], 'version': image['version'], 'sourceUrl': image['image_url'],
            'sourceSha256': image.get('source_sha256'), 'evidenceSha256': digest(state)}


def entry_for(product, images):
    if not eligible(product, images):
        return None
    entry = {'productId': product['id'], 'previousStatus': product['ingestion_status'], 'version': product['version'],
             'category': product['category'], 'subcategory': product['subcategory'], 'color': product.get('color'),
             'previousEligibility': obj(product.get('metadata_json')).get('catalogPhotoEligibility'),
             'reason': REASON, 'images': [image_identity(image) for image in images],
             'evidence': [{'imageId': image['id'], **obj(image.get('assets_json'))['photoSet']['metrics']['preflight']} for image in images]}
    entry['evidenceSha256'] = digest(entry)
    return entry


def report_for(products, *, origin):
    entries = []
    for product in products:
        entry = entry_for(product, product.get('images', []))
        if entry is not None:
            entries.append(entry)
    report = {'version': VERSION, 'algorithmVersion': PREFLIGHT_VERSION, 'photoSetVersion': PHOTO_SET_VERSION,
              'createdAt': datetime.now(timezone.utc).isoformat(), 'origin': origin,
              'scannedProducts': len(products), 'products': entries}
    report['reportSha256'] = digest(report)
    return report


def audit(conn):
    products = []; last = ''
    with conn.cursor() as cur:
        cur.execute('SET TRANSACTION READ ONLY')
        cur.execute('START TRANSACTION WITH CONSISTENT SNAPSHOT')
    try:
        while True:
            with conn.cursor() as cur:
                cur.execute(PRODUCT_SELECT + " WHERE id>%s AND ingestion_status IN ('VALIDATED','PERSISTABLE','REFERENCE_ONLY') ORDER BY id LIMIT 200", (last,))
                batch = cur.fetchall()
            if not batch:
                break
            for product in batch:
                last = product['id']
                with conn.cursor() as cur:
                    cur.execute(IMAGE_SELECT, (product['id'],))
                    product['images'] = cur.fetchall()
                products.append(product)
        return report_for(products, origin='DATABASE_READ_ONLY')
    finally:
        conn.rollback()


def validate_report(report):
    if (report.get('version') != VERSION or report.get('algorithmVersion') != PREFLIGHT_VERSION
            or report.get('photoSetVersion') != PHOTO_SET_VERSION
            or report.get('reportSha256') != digest({k: v for k, v in report.items() if k != 'reportSha256'})):
        raise ValueError('INVALID_OR_MODIFIED_AUDIT_REPORT')
    for entry in report['products']:
        if entry.get('evidenceSha256') != digest({k: v for k, v in entry.items() if k != 'evidenceSha256'}):
            raise ValueError('INVALID_PRODUCT_EVIDENCE_HASH')


def change(conn, entry, restore=False, *, report_sha256):
    with conn.cursor() as cur:
        cur.execute(PRODUCT_SELECT + ' WHERE id=%s FOR UPDATE', (entry['productId'],))
        product = cur.fetchone()
        if not product:
            return 'SKIPPED_MISSING'
        expected = entry['version'] + (1 if restore else 0)
        if product['version'] != expected:
            return 'SKIPPED_CONCURRENT_CHANGE'
        cur.execute(IMAGE_SELECT + ' FOR UPDATE', (product['id'],))
        images = cur.fetchall()
        if [image_identity(image) for image in images] != entry['images']:
            return 'SKIPPED_IMAGES_CHANGED'
        marker = obj(product.get('metadata_json')).get('catalogPhotoEligibility', {})
        if restore:
            if (product['ingestion_status'] != 'REJECTED' or entry['previousStatus'] not in VISIBLE
                    or marker.get('reportSha256') != report_sha256 or marker.get('evidenceSha256') != entry['evidenceSha256']):
                return 'SKIPPED_STATUS_CHANGED'
            status = entry['previousStatus']; evidence = entry.get('previousEligibility')
        else:
            actual = entry_for(product, images)
            if actual is None or actual['evidenceSha256'] != entry['evidenceSha256']:
                return 'SKIPPED_NOT_CONFIRMED_UNSAFE'
            status = 'REJECTED'
            evidence = {'version': VERSION, 'algorithmVersion': PREFLIGHT_VERSION, 'state': 'INELIGIBLE',
                        'reason': REASON, 'reportSha256': report_sha256, 'evidenceSha256': entry['evidenceSha256']}
        cur.execute("""UPDATE catalog_products SET ingestion_status=%s,
          metadata_json=JSON_SET(COALESCE(metadata_json,JSON_OBJECT()),'$.catalogPhotoEligibility',CAST(%s AS JSON)),
          version=version+1,updated_at=UTC_TIMESTAMP(6) WHERE id=%s AND version=%s""",
                    (status, json.dumps(evidence), product['id'], expected))
        return ('RESTORED' if restore else 'QUARANTINED') if cur.rowcount == 1 else 'SKIPPED_CONCURRENT_CHANGE'


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path, required=True)
    parser.add_argument('--snapshot', type=Path, help='offline reviewed JSON; never usable as a database apply report')
    action = parser.add_mutually_exclusive_group()
    action.add_argument('--apply', action='store_true'); action.add_argument('--restore', action='store_true')
    args = parser.parse_args(argv)
    if args.snapshot and (args.apply or args.restore):
        parser.error('--snapshot is audit only')
    if not args.apply and not args.restore:
        if args.snapshot:
            raw = args.snapshot.read_bytes()
            report = report_for(json.loads(raw)['products'], origin='OFFLINE_SNAPSHOT:' + hashlib.sha256(raw).hexdigest())
        else:
            conn = db.connect()
            try:
                report = audit(conn)
            finally:
                conn.close()
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False))
        print(json.dumps({'mode': 'AUDIT_ONLY', 'candidates': len(report['products']), 'scannedProducts': report['scannedProducts'],
                          'report': str(args.report), 'reportSha256': report['reportSha256']}))
        return
    report = json.loads(args.report.read_text()); validate_report(report)
    if report.get('origin') != 'DATABASE_READ_ONLY':
        raise ValueError('DATABASE_AUDIT_REQUIRED_FOR_APPLY')
    conn = db.connect(); results = []
    try:
        for entry in report['products']:
            status = db.run_transaction(conn, lambda: change(conn, entry, args.restore, report_sha256=report['reportSha256']))
            results.append({'productId': entry['productId'], 'status': status})
    finally:
        conn.close()
    result = {'reportSha256': report['reportSha256'], 'results': results}
    args.report.with_suffix('.results.json').write_text(json.dumps(result, indent=2))
    print(json.dumps({'processed': len(results), 'changed': sum(row['status'] in ('RESTORED', 'QUARANTINED') for row in results)}))

if __name__ == '__main__':
    main()
