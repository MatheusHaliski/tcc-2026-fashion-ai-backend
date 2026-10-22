#!/usr/bin/env python3
"""Remove confirmed, wholly unusable products from public catalog search by reversible logical exclusion.

Audit:   python -m scripts.catalog.quarantine_unsafe_products --report work/quarantine.json
Apply:   python -m scripts.catalog.quarantine_unsafe_products --report work/quarantine.json --apply
Restore: python -m scripts.catalog.quarantine_unsafe_products --report work/quarantine.json --restore
No physical DELETE, no removal of wardrobe items. Network/model/storage errors are never deletion criteria.
"""
import argparse
import json
from pathlib import Path
from datetime import datetime,timezone
try:
    from . import db
    from .process_photo_sets import obj,current
except ImportError:
    import db
    from process_photo_sets import obj,current
VISIBLE={'VALIDATED','PERSISTABLE','REFERENCE_ONLY'}
CONFIRMED_UNSAFE={'NO_SAFE_FABRIC_RECTANGLE','AMBIGUOUS_TARGET_COMPONENTS','TARGET_MASK_TOO_SMALL','EXCESSIVE_MASK_REMOVAL','TARGET_MASK_EMPTY_AFTER_CLEANUP','TARGET_MASK_EMPTY'}

def eligible(product,images):
    if product.get('ingestion_status') not in VISIBLE or not images:return False
    for image in images:
        record={**image,'category':product['category'],'subcategory':product['subcategory'],'color':product.get('color')}
        state=obj(image.get('assets_json')).get('photoSet',{})
        if not current(record) or state.get('status')!='DEFAULT' or state.get('reason') not in CONFIRMED_UNSAFE:return False
    return True

def audit(conn):
    candidates=[];last=''
    while True:
        with conn.cursor() as cur:
            cur.execute("SELECT id,category,subcategory,color,ingestion_status,version FROM catalog_products WHERE id>%s AND ingestion_status IN ('VALIDATED','PERSISTABLE','REFERENCE_ONLY') ORDER BY id LIMIT 200",(last,));products=cur.fetchall()
        if not products:break
        for p in products:
            last=p['id']
            with conn.cursor() as cur:
                cur.execute('SELECT id,image_url,source_sha256,assets_json,version FROM catalog_images WHERE product_id=%s ORDER BY id',(p['id'],));images=cur.fetchall()
            if eligible(p,images):candidates.append({'productId':p['id'],'previousStatus':p['ingestion_status'],'version':p['version'],'images':[{'id':i['id'],'version':i['version'],'sourceSha256':i.get('source_sha256')} for i in images]})
        conn.rollback()
    return {'version':'CATALOG_UNSAFE_QUARANTINE_V1','createdAt':datetime.now(timezone.utc).isoformat(),'products':candidates}

def change(conn,entry,restore=False):
    with conn.cursor() as cur:
        cur.execute('SELECT id,category,subcategory,color,ingestion_status,version FROM catalog_products WHERE id=%s FOR UPDATE',(entry['productId'],));p=cur.fetchone()
        if not p:return 'SKIPPED_MISSING'
        expected=entry['version']+(1 if restore else 0)
        if p['version']!=expected:return 'SKIPPED_CONCURRENT_CHANGE'
        cur.execute('SELECT id,image_url,source_sha256,assets_json,version FROM catalog_images WHERE product_id=%s ORDER BY id FOR UPDATE',(p['id'],));images=cur.fetchall()
        identity=[{'id':i['id'],'version':i['version'],'sourceSha256':i.get('source_sha256')} for i in images]
        if identity!=entry['images']:return 'SKIPPED_IMAGES_CHANGED'
        if restore:
            if p['ingestion_status']!='REJECTED' or entry['previousStatus'] not in VISIBLE:return 'SKIPPED_STATUS_CHANGED'
            status=entry['previousStatus']
        else:
            if not eligible(p,images):return 'SKIPPED_NOT_CONFIRMED_UNSAFE'
            status='REJECTED'
        cur.execute('UPDATE catalog_products SET ingestion_status=%s,version=version+1,updated_at=UTC_TIMESTAMP(6) WHERE id=%s AND version=%s',(status,p['id'],expected))
        return ('RESTORED' if restore else 'QUARANTINED') if cur.rowcount==1 else 'SKIPPED_CONCURRENT_CHANGE'

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--report',type=Path,required=True);action=p.add_mutually_exclusive_group();action.add_argument('--apply',action='store_true');action.add_argument('--restore',action='store_true');a=p.parse_args();conn=db.connect()
    try:
        if not a.apply and not a.restore:
            report=audit(conn);a.report.parent.mkdir(parents=True,exist_ok=True);a.report.write_text(json.dumps(report,indent=2));print(json.dumps({'mode':'AUDIT_ONLY','candidates':len(report['products']),'report':str(a.report)}));return
        report=json.loads(a.report.read_text())
        if report.get('version')!='CATALOG_UNSAFE_QUARANTINE_V1':raise ValueError('INVALID_AUDIT_REPORT')
        results=[]
        for entry in report['products']:
            status=db.run_transaction(conn,lambda:change(conn,entry,a.restore));results.append({'productId':entry['productId'],'status':status})
        a.report.with_suffix('.results.json').write_text(json.dumps(results,indent=2));print(json.dumps({'processed':len(results),'changed':sum(r['status'] in ('RESTORED','QUARANTINED') for r in results)}))
    finally:conn.close()
if __name__=='__main__':main()
