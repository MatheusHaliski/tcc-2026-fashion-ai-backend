import copy
import hashlib
import io
import json
from pathlib import Path
import tempfile
import sqlite3
import unittest
from unittest.mock import Mock, patch

import numpy as np
from PIL import Image, ImageDraw
from scripts.catalog.photo_set import PhotoMasks, PHOTO_SET_VERSION, process_photo, clean_target_mask
from scripts.catalog.photo_preflight import inspect_source, PREFLIGHT_VERSION
from scripts.catalog.process_photo_sets import build_set
from scripts.catalog.ingest_image_dataset import GarmentSanitizer, ProductImage, ImageFailure
from scripts.catalog.quarantine_unsafe_products import eligible, report_for, validate_report, change


def fixture(height=300, *, size=(800,1000), top=350, category='upper_piece', subcategory='shirt', **kwargs):
    image=Image.new('RGB',size,'white');target=Image.new('L',size)
    box=(250,top,550,top+height-1)
    ImageDraw.Draw(image).rectangle(box,fill='blue');ImageDraw.Draw(target).rectangle(box,fill=255)
    masks=PhotoMasks(target,Image.new('L',size),confidence=.99,verified=True,target_category=category,
        target_subcategory=subcategory,human_present=False,source='reviewed-fixture',measurement_verified=True,
        isolation_verified=True,complete=True,occluded=False)
    for key,value in kwargs.items():setattr(masks,key,value)
    return image,masks


def image_row(height=249, image_id='image-1'):
    image,masks=fixture(height);photo=process_photo(image,'upper_piece','shirt',masks=masks)
    state=dict(version=PHOTO_SET_VERSION,sourceUrl='https://brand.example/'+image_id,sourceSha256='a'*64,
               category='upper_piece',subcategory='shirt',color='blue',status=photo.status,reason=photo.reason,metrics=photo.metrics)
    return dict(id=image_id,version=4,image_url=state['sourceUrl'],source_sha256='a'*64,assets_json={'photoSet':state})


def product(images=None):
    return dict(id='product-1',version=7,category='upper_piece',subcategory='shirt',color='blue',
                ingestion_status='VALIDATED',metadata_json={'other':'preserved'},images=images or [image_row()])


class PreflightTests(unittest.TestCase):
    def test_actual_source_height_below_exact_and_above_25_percent_before_cleanup_or_render(self):
        for height,status in [(249,'INELIGIBLE'),(250,'READY'),(700,'READY')]:
            image,masks=fixture(height,top=100)
            with patch('scripts.catalog.photo_set.clean_target_mask',wraps=clean_target_mask) as cleanup,patch('scripts.catalog.photo_set._render_whole') as render:
                if status=='READY':
                    render.return_value=(b'png',{})
                result=process_photo(image,'upper_piece','shirt',masks=masks)
                self.assertEqual(status,result.status)
                self.assertEqual(height/1000,result.metrics['sourceGarmentHeightFraction'])
                self.assertEqual(height,result.metrics['preflight']['sourceGarmentHeightPixels'])
                if height<250:cleanup.assert_not_called();render.assert_not_called();self.assertIsNone(result.whole)
                else:cleanup.assert_called_once();render.assert_called_once()

    def test_unknown_failed_human_occlusion_category_and_truncation_are_review_never_delete(self):
        cases=[dict(measurement_verified=False),dict(isolation_verified=False),dict(forbidden=None),dict(complete=None),
               dict(occluded=True),dict(occluded=None),dict(verified=False),dict(confidence=float('nan')),dict(target_category='lower_piece')]
        for values in cases:
            image,masks=fixture(200,**values)
            result=process_photo(image,'upper_piece','shirt',masks=masks)
            self.assertEqual('REVIEW',result.status,values);self.assertIsNone(result.whole)
            self.assertNotEqual('SOURCE_GARMENT_BELOW_MIN_HEIGHT',result.reason)
        image,masks=fixture(300,top=0)
        self.assertEqual('GARMENT_COMPLETENESS_UNCERTAIN',process_photo(image,'upper_piece','shirt',masks=masks).reason)
        image,masks=fixture(300);masks.target=Image.new('L',image.size)
        result=process_photo(image,'upper_piece','shirt',masks=masks)
        self.assertIsNone(result.metrics['preflight']['sourceGarmentHeightFraction'])
        self.assertIsNone(result.metrics['sourceGarmentHeightFraction'])

    def test_analysis_resizing_preserves_real_source_fraction_and_pixel_height(self):
        image,masks=fixture(250)
        result=inspect_source(image,masks,'upper_piece','shirt',original_size=(3200,4000))
        self.assertEqual('PASS',result.status);self.assertEqual(1000,result.metrics['sourceGarmentHeightPixels'])
        self.assertEqual(.25,result.metrics['sourceGarmentHeightFraction'])

    def test_uniform_fit_centered_half_largest_normalized_edge_without_stretching(self):
        image,masks=fixture(600,top=150)
        result=process_photo(image,'upper_piece','shirt',masks=masks)
        box=result.metrics['whole']['box'];source=result.metrics['whole']['sourceBox']
        self.assertAlmostEqual(.5,max(box['w'],box['h']),places=3)
        self.assertAlmostEqual(.5,box['x']+box['w']/2,delta=1/900);self.assertAlmostEqual(.5,box['y']+box['h']/2,delta=1/1200)
        self.assertAlmostEqual(source['w']/source['h'],box['w']*900/(box['h']*1200),places=2)
        out=np.asarray(Image.open(io.BytesIO(result.whole)))
        self.assertTrue((out[0]==255).all())

    def test_semantic_exclusion_preserves_real_marks_and_rejects_unknown_exterior_lines(self):
        image,masks=fixture(400,top=200)
        draw=ImageDraw.Draw(image);draw.rectangle((0,0,200,900),fill='pink');draw.rectangle((580,200,700,600),fill='green')
        draw.line((350,250,450,450),fill='yellow',width=8)
        target=ImageDraw.Draw(masks.target);target.line((550,300,730,300),fill=255,width=1)
        self.assertEqual('REVIEW',process_photo(image,'upper_piece','shirt',masks=masks).status)
        forbidden=ImageDraw.Draw(masks.forbidden);forbidden.line((552,300,730,300),fill=255,width=3)
        result=process_photo(image,'upper_piece','shirt',masks=masks)
        self.assertEqual('READY',result.status)
        out=np.asarray(Image.open(io.BytesIO(result.whole)))
        self.assertFalse(((out[:,:,0]>200)&(out[:,:,1]<100)&(out[:,:,2]>100)).any())
        self.assertFalse(((out[:,:,1]>90)&(out[:,:,0]<50)&(out[:,:,2]<50)).any())
        self.assertTrue(((out[:,:,0]>220)&(out[:,:,1]>220)&(out[:,:,2]<50)).any())

    def test_set_accepts_semantically_selected_parts_but_category_does_not_accept_extra_garments(self):
        image,masks=fixture(300,category='full_body_piece',subcategory='matching_set')
        ImageDraw.Draw(masks.target).rectangle((250,700,550,850),fill=255)
        self.assertEqual('READY',process_photo(image,'full_body_piece','matching_set',masks=masks).status)
        masks.target_category='upper_piece';masks.target_subcategory='shirt'
        self.assertEqual('AMBIGUOUS_TARGET_COMPONENTS',process_photo(image,'upper_piece','shirt',masks=masks).reason)

    def test_dataset_preflight_happens_before_cleanup_and_output(self):
        image,masks=fixture(249);data=io.BytesIO();image.save(data,'PNG')
        provider=Mock();provider.masks.return_value=masks
        with patch('scripts.catalog.ingest_image_dataset.clean_target_mask') as cleanup:
            with self.assertRaises(ImageFailure) as error:
                GarmentSanitizer(provider).sanitize(data.getvalue(),ProductImage('p','Brand','upper_piece','shirt','https://b.example/a'))
            self.assertEqual('INELIGIBLE',error.exception.status);cleanup.assert_not_called()

    def test_worker_never_uploads_ineligible_and_audits_source_hash(self):
        image,masks=fixture(249);provider=Mock();provider.masks.return_value=masks
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'image.png';image.save(path)
            expected=hashlib.sha256(path.read_bytes()).hexdigest();downloader=Mock();downloader.get.return_value=path;storage=Mock()
            record=dict(image_url='https://brand.example/a',source_sha256=None,category='upper_piece',subcategory='shirt',color='blue',source_domain='brand.example',
                        persistence_sources=[dict(domain='brand.example',active=True,allows_image_persistence=True)])
            result=build_set(record,downloader,provider,storage)
            self.assertEqual('INELIGIBLE',result['status']);self.assertEqual(expected,result['sourceSha256']);storage.client.put_object.assert_not_called()


class SqlCursor:
    def __init__(self,db):self.cursor=db.sql.cursor();self.rowcount=0
    def __enter__(self):return self
    def __exit__(self,*args):self.cursor.close()
    def execute(self,sql,params=()):
        sql=sql.removesuffix(' FOR UPDATE').replace('%s','?').replace('CAST(? AS JSON)','json(?)').replace('UTC_TIMESTAMP(6)','CURRENT_TIMESTAMP')
        self.cursor.execute(sql,params);self.rowcount=self.cursor.rowcount
    def fetchone(self):
        row=self.cursor.fetchone();return dict(row) if row else None
    def fetchall(self):return [dict(row) for row in self.cursor.fetchall()]


class SqlDatabase:
    def __init__(self,p):
        self.sql=sqlite3.connect(':memory:');self.sql.row_factory=sqlite3.Row
        self.sql.execute('CREATE TABLE catalog_products(id TEXT,category TEXT,subcategory TEXT,color TEXT,ingestion_status TEXT,metadata_json TEXT,version INTEGER,updated_at TEXT)')
        self.sql.execute('CREATE TABLE catalog_images(id TEXT,product_id TEXT,image_url TEXT,source_sha256 TEXT,assets_json TEXT,version INTEGER)')
        self.sql.execute('INSERT INTO catalog_products VALUES(?,?,?,?,?,?,?,NULL)',tuple(json.dumps(p[k]) if isinstance(p[k],dict) else p[k] for k in ['id','category','subcategory','color','ingestion_status','metadata_json','version']))
        for row in p['images']:self.insert_image(row,p['id'])
    def insert_image(self,row,product_id='product-1'):
        self.sql.execute('INSERT INTO catalog_images VALUES(?,?,?,?,?,?)',(row['id'],product_id,row['image_url'],row['source_sha256'],json.dumps(row['assets_json']),row['version']))
    def cursor(self):return SqlCursor(self)
    def product(self):return dict(self.sql.execute('SELECT * FROM catalog_products').fetchone())


class QuarantineTests(unittest.TestCase):
    def test_only_all_confirmed_small_candidates_qualify_and_report_is_hash_verified(self):
        p=product();self.assertTrue(eligible(p,p['images']))
        for alternate in [image_row(250,'valid'),{**image_row(),'assets_json':None},image_row(700,'valid')]:
            self.assertFalse(eligible(p,p['images']+[alternate]))
        for path,value in [('status','REVIEW'),('reason','TARGET_MASK_EMPTY')]:
            altered=copy.deepcopy(p['images'][0]);altered['assets_json']['photoSet'][path]=value
            self.assertFalse(eligible(p,[altered]))
        unknown=copy.deepcopy(p['images'][0]);unknown['assets_json']['photoSet']['metrics']['preflight']['humanAssessmentComplete']=False
        self.assertFalse(eligible(p,[unknown]))
        stale={**p['images'][0],'source_sha256':'b'*64};self.assertFalse(eligible(p,[stale]))
        report=report_for([p],origin='FIXTURE');validate_report(report)
        report['products'][0]['images'][0]['sourceSha256']='b'*64
        with self.assertRaisesRegex(ValueError,'INVALID_OR_MODIFIED'):validate_report(report)

    def test_apply_and_restore_execute_real_updates_preserve_metadata_and_reject_replay(self):
        p=product();report=report_for([p],origin='DATABASE_READ_ONLY');db=SqlDatabase(p);entry=report['products'][0]
        self.assertEqual('QUARANTINED',change(db,entry,report_sha256=report['reportSha256']))
        actual=db.product();self.assertEqual('REJECTED',actual['ingestion_status']);metadata=json.loads(actual['metadata_json'])
        self.assertEqual('preserved',metadata['other']);self.assertEqual(report['reportSha256'],metadata['catalogPhotoEligibility']['reportSha256'])
        self.assertEqual('SKIPPED_CONCURRENT_CHANGE',change(db,entry,report_sha256=report['reportSha256']))
        self.assertEqual('RESTORED',change(db,entry,True,report_sha256=report['reportSha256']))
        actual=db.product();self.assertEqual('VALIDATED',actual['ingestion_status']);self.assertIsNone(json.loads(actual['metadata_json'])['catalogPhotoEligibility'])
        self.assertEqual('SKIPPED_CONCURRENT_CHANGE',change(db,entry,True,report_sha256=report['reportSha256']))

    def test_new_valid_alternative_or_changed_source_after_audit_prevents_apply(self):
        p=product();report=report_for([p],origin='DATABASE_READ_ONLY');entry=report['products'][0]
        db=SqlDatabase(p);db.insert_image(image_row(500,'valid-alternative'))
        self.assertEqual('SKIPPED_IMAGES_CHANGED',change(db,entry,report_sha256=report['reportSha256']));self.assertEqual('VALIDATED',db.product()['ingestion_status'])
        db=SqlDatabase(p);db.sql.execute("UPDATE catalog_images SET image_url='https://brand.example/edited'")
        self.assertEqual('SKIPPED_IMAGES_CHANGED',change(db,entry,report_sha256=report['reportSha256']))


if __name__=='__main__':unittest.main()
