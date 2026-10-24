#!/usr/bin/env python3
"""Idempotent background worker for ALL catalog image rows; original photos remain unchanged.

python -m scripts.catalog.process_photo_sets --apply --watch
Without --apply, processes previews/audit locally but never writes DB or storage.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import io
import logging
import tempfile
import time
from pathlib import Path
from urllib.parse import quote
from PIL import Image
try:
    from . import db
    from .catalog_image_inventory import _SELECT
    from .process_catalog_images import ImageDownloader
    from .photo_set import process_photo, PHOTO_SET_VERSION
    from .semantic_photo_provider import AutomaticClothProvider, AUTOMATIC_POLICY_VERSION
    from .default_assets import default_asset_url
    from .source_persistence import source_decision
except ImportError:
    import db
    from catalog_image_inventory import _SELECT
    from process_catalog_images import ImageDownloader
    from photo_set import process_photo, PHOTO_SET_VERSION
    from semantic_photo_provider import AutomaticClothProvider, AUTOMATIC_POLICY_VERSION
    from default_assets import default_asset_url
    from source_persistence import source_decision
LOG=logging.getLogger('fashionai.photo_sets')
PHOTO_SELECT=(_SELECT.replace('p.version AS product_version',
    'COALESCE(v.color,p.color) AS color, v.id AS matched_variant_id, p.version AS product_version')
    .replace('i.id AS image_id','i.id AS id')
    .replace('LEFT JOIN catalog_images i ON i.product_id = p.id',
             'LEFT JOIN catalog_images i ON i.product_id = p.id\nLEFT JOIN catalog_variants v ON v.id=i.variant_id AND v.product_id=p.id'))

def invalid_variant(record):
    return record.get('variant_id') is not None and record.get('matched_variant_id') != record['variant_id']

def obj(value):
    if isinstance(value,dict):return value
    try:return json.loads(value) if value else {}
    except (ValueError,TypeError):return {}

def current(record,now=None,*,require_automatic_policy=False):
    s=obj(record.get('assets_json')).get('photoSet',{})
    if invalid_variant(record):return False
    match=(s.get('version')==PHOTO_SET_VERSION and s.get('sourceUrl')==record.get('image_url') and s.get('sourceSha256')==record.get('source_sha256')
       and s.get('category')==record.get('category') and s.get('subcategory')==record.get('subcategory') and s.get('color')==record.get('color')
       and s.get('variantId')==record.get('variant_id')
       and (s.get('imageId') is None or s.get('imageId')==record.get('id')))
    if require_automatic_policy and s.get('isolationPolicyVersion') != AUTOMATIC_POLICY_VERSION:
        return False
    return match and (s.get('status') in ('READY','DEFAULT','REVIEW','INELIGIBLE') or s.get('retryAt',0)>(now or time.time()))

def build_set(record,downloader,provider,storage=None):
    result={'version':PHOTO_SET_VERSION,'isolationPolicyVersion':AUTOMATIC_POLICY_VERSION,'sourceUrl':record['image_url'],'sourceSha256':record.get('source_sha256'),
      'imageId':record.get('id'),'variantId':record.get('variant_id'),
      'category':record['category'],'subcategory':record['subcategory'],'color':record.get('color'),
      'defaultAssetUrl':default_asset_url(record['category'],record['subcategory'],record.get('color')),'generatedAt':time.time(),
      'metrics':{'sourceGarmentHeightFraction':None,'sourceQuality':None}}
    if invalid_variant(record):return {**result,'status':'REVIEW','reason':'IMAGE_VARIANT_CONTEXT_INVALID'}
    sources=record.get('persistence_sources_json') or record.get('persistence_sources') or []
    if isinstance(sources,str):sources=json.loads(sources)
    rights=source_decision(sources,record['image_url'],record.get('source_domain'))
    if rights['state']!='AUTHORIZED':return {**result,'status':'DEFAULT','reason':'SOURCE_REFERENCE_ONLY','rights':rights['state']}
    path=downloader.get(record['image_url'],allowed_domains=rights['domains']);data=path.read_bytes();result['sourceSha256']=hashlib.sha256(data).hexdigest()
    path.unlink(missing_ok=True)
    source_provider=provider.for_source(result['sourceSha256'],record['image_url']) if hasattr(provider,'for_source') else provider
    with Image.open(io.BytesIO(data)) as image:
        photo=process_photo(image,record['category'],record['subcategory'],provider=source_provider)
    result.update(status=photo.status,reason=photo.reason,metrics=photo.metrics)
    if photo.reason in ('SEGMENTATION_UNAVAILABLE','PARSER_LOCAL_WEIGHTS_MISSING'):
        result.update(status='RETRY',retryAt=time.time()+300)
    if photo.status=='READY' and storage is not None:
        for kind,payload in (('whole',photo.whole),('fabric',photo.fabric)):
            key=f"catalog/photo-sets/{PHOTO_SET_VERSION}/{hashlib.sha256(payload).hexdigest()}.png"
            storage.client.put_object(Bucket=storage.bucket,Key=key,Body=payload,ContentType='image/png')
            body=storage.client.get_object(Bucket=storage.bucket,Key=key)['Body']
            try:verified=body.read(len(payload)+1)
            finally:body.close()
            if hashlib.sha256(verified).digest()!=hashlib.sha256(payload).digest():raise ValueError('UPLOAD_VERIFICATION_FAILED')
            result[kind+'Url']=storage.base+'/'+quote(key,safe='/')
    return result

def commit_set(conn,record,result):
    """CAS over image version AND product context; never overwrite concurrent admin corrections."""
    with conn.cursor() as cursor:
        cursor.execute('SELECT domain,active,allows_image_persistence FROM catalog_sources WHERE brand_id=(SELECT brand_id FROM catalog_products WHERE id=%s) FOR SHARE',(record['product_id'],))
        rights=source_decision(cursor.fetchall(),record['image_url'],record.get('source_domain'))
        if result['status']=='READY' and rights['state']!='AUTHORIZED':return False
        cursor.execute("""UPDATE catalog_images i JOIN catalog_products p ON p.id=i.product_id
          LEFT JOIN catalog_variants v ON v.id=i.variant_id AND v.product_id=p.id
          SET i.assets_json=JSON_SET(COALESCE(i.assets_json,JSON_OBJECT()),'$.photoSet',CAST(%s AS JSON)),
              i.source_sha256=%s,i.review_status=CASE WHEN %s='REVIEW' AND i.review_status<>'REJECTED' THEN 'PENDING' ELSE i.review_status END,
              i.version=i.version+1,i.updated_at=UTC_TIMESTAMP(6)
          WHERE i.id=%s AND i.version=%s AND i.image_url=%s AND p.category=%s AND p.subcategory <=> %s
            AND i.variant_id <=> %s AND (i.variant_id IS NULL OR v.id IS NOT NULL)
            AND COALESCE(v.color,p.color) <=> %s""",
          (json.dumps(result,ensure_ascii=False),result.get('sourceSha256'),result['status'],record['id'],record['version'],record['image_url'],record['category'],record['subcategory'],record.get('variant_id'),record.get('color')))
        return cursor.rowcount==1

def run_pass(conn,downloader,provider,storage,audit,*,apply=False,batch_size=100,limit=None,force=False):
    last='';total=0
    while limit is None or total<limit:
        with conn.cursor() as cursor:
            cursor.execute(PHOTO_SELECT+" WHERE p.ingestion_status IN ('VALIDATED','PERSISTABLE','REFERENCE_ONLY') AND i.id>%s AND COALESCE(i.review_status,'PENDING')<>'REJECTED' ORDER BY i.id LIMIT %s",(last,batch_size));records=cursor.fetchall()
        conn.rollback() # do not hold a read transaction while running models or network I/O
        if not records:break
        for record in records:
            last=record['id']
            if not force and current(record,require_automatic_policy=True):continue
            if limit is not None and total>=limit:break
            try:
                result=build_set(record,downloader,provider,storage)
            except Exception:
                result={'version':PHOTO_SET_VERSION,'isolationPolicyVersion':AUTOMATIC_POLICY_VERSION,'status':'RETRY','reason':'DOWNLOAD_OR_STORAGE_FAILED','retryAt':time.time()+300,
                  'sourceUrl':record['image_url'],'sourceSha256':record.get('source_sha256'),'category':record['category'],
                  'imageId':record.get('id'),'variantId':record.get('variant_id'),
                  'subcategory':record['subcategory'],'color':record.get('color'),'defaultAssetUrl':default_asset_url(record['category'],record['subcategory'],record.get('color'))}
            saved=False
            if apply:
                try:
                    saved=db.run_transaction(conn,lambda:commit_set(conn,record,result))
                except Exception:
                    LOG.error(json.dumps({'event':'PHOTO_SET_DATABASE_WRITE_FAILED'}));raise
            summary={k:result.get(k) for k in ('version','status','reason','sourceSha256','category','subcategory','metrics')};summary.update(imageId=record['id'],productId=record['product_id'],saved=saved,
                reviewRequired=result.get('status')=='REVIEW')
            audit.write(json.dumps(summary)+'\n');audit.flush();LOG.info(json.dumps(summary));total+=1
    return total

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--apply',action='store_true');p.add_argument('--watch',action='store_true');p.add_argument('--force',action='store_true');p.add_argument('--limit',type=int);p.add_argument('--interval',type=int,default=60);p.add_argument('--audit',type=Path,default=Path('photo-sets-audit.jsonl'));p.add_argument('--reviewed-masks',type=Path);p.add_argument('--parser-weights',type=Path);a=p.parse_args()
    if a.limit is not None and a.limit<1:p.error('--limit deve ser positivo')
    logging.basicConfig(level=logging.INFO,format='%(message)s')
    storage=None
    if a.apply:
        try:from .category_frame_storage import FrameStorage
        except ImportError:from category_frame_storage import FrameStorage
        storage=FrameStorage()
    if a.reviewed_masks:
        try:from .reviewed_photo_masks import ReviewedMaskProvider
        except ImportError:from reviewed_photo_masks import ReviewedMaskProvider
        provider=ReviewedMaskProvider(a.reviewed_masks)
    else:provider=AutomaticClothProvider(weights=a.parser_weights)
    a.audit.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp,a.audit.open('a') as audit:
        downloader=ImageDownloader(Path(tmp));conn=db.connect()
        try:
            while True:
                run_pass(conn,downloader,provider,storage,audit,apply=a.apply,limit=a.limit,force=a.force)
                if not a.watch:break
                time.sleep(max(10,a.interval));downloader=ImageDownloader(Path(tmp))
        finally:conn.close()
if __name__=='__main__':main()
