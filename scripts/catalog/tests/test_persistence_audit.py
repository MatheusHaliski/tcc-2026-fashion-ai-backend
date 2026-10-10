import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts.catalog.process_catalog_images import select_records, safe_audit, main

class ControlledAuditTest(unittest.TestCase):
    def test_sample_preserves_complete_product_inventory(self):
        rows=[{'product_id':'a','image_id':str(i),'allows_image_persistence':True} for i in range(3)]
        rows.append({'product_id':'b','image_id':'b','allows_image_persistence':False})
        selected=select_records(rows,limit=1,authorized_only=True,database=True)
        self.assertEqual(selected,rows[:3])

    def test_signed_url_is_not_written_to_audit_log(self):
        original='https://user:password@cdn.example/a.jpg?signature=secret#token'
        rendered=json.dumps(safe_audit({'image_url':original,'assets_json':json.dumps({'card':original})}))
        for secret in ('password','signature','secret','token'):self.assertNotIn(secret,rendered)
        self.assertIn('url_sha256',rendered)

    def test_read_only_mode_does_not_analyze_upload_or_update(self):
        row={'product_id':'a','image_id':'a','source_url':'https://brand.example/a.jpg','category':'upper_piece'}
        with tempfile.TemporaryDirectory() as directory:
            output=Path(directory)/'audit.xlsx'
            with patch('catalog_image_inventory.load_database',return_value=iter([row])), \
                 patch('catalog_image_workbook.write_workbook'), \
                 patch('scripts.catalog.process_catalog_images.CatalogImageAnalyzer',create=True) as analyzer, \
                 patch('scripts.catalog.process_catalog_images.ImageDownloader') as downloader, \
                 patch('scripts.catalog.category_frame_storage.FrameStorage') as storage, \
                 patch('scripts.catalog.catalog_image_updates.apply_product') as update, \
                 contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(main(['--database','--output',str(output)]),0)
                analyzer.assert_not_called();downloader.assert_not_called();storage.assert_not_called();update.assert_not_called()
                self.assertFalse(json.loads(output.with_suffix('.summary.json').read_text())['applied_to_database'])

class PersistedEvidenceTest(unittest.TestCase):
    def test_framing_metadata_without_asset_is_not_standardized(self):
        from scripts.catalog.catalog_image_inventory import is_standardized
        crop={'aspect':'3:4','crop':{'x':.25,'y':.25,'w':.5,'h':.5},'ruleCompliant':True,
              'editorFrame':{'version':'CATALOG_FRAME_34_FABRIC_V2','policy':'FABRIC_ONLY_100','fabricCoverage':1.0,'requiresReview':False}}
        row={'source_url':'https://brand.example/a.jpg','processing_status':'APPROVED',
             'pipeline_version':'CATALOG_FRAME_34_FABRIC_V2','crop_json':crop}
        self.assertFalse(is_standardized(row))
        row.update(stored_url='https://media.example/a.jpg',assets_json={'card':'https://media.example/a.jpg',
                   'framingVersion':'CATALOG_FRAME_34_FABRIC_V2','sha256':'a'*64})
        self.assertTrue(is_standardized(row))


class SchemaAuditTest(unittest.TestCase):
    def test_read_only_audit_distinguishes_unknown_from_configured_authorization(self):
        import sys
        sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
        from audit_catalog_persistence import audit
        schema=[]
        for table,columns in {'catalog_sources':['id','brand_id','domain','active','allows_image_persistence'],
                              'catalog_products':['id','brand_id'],
                              'catalog_images':['id','product_id','image_url','source_domain','source_url','stored_url','assets_json']}.items():
            schema.extend({'TABLE_NAME':table,'COLUMN_NAME':c,'COLUMN_TYPE':'test'} for c in columns)
        class Cursor:
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def execute(self,sql):
                self.sql=sql
                self.statements.append(sql)
                assert sql.startswith(('START TRANSACTION','SELECT'))
            def fetchall(self):
                if 'information_schema' in self.sql:return schema
                if 'FROM catalog_sources' in self.sql:return [{'id':'s','brand_id':'b','domain':'brand.example','active':1,'allows_image_persistence':0}]
                if 'FROM catalog_products' in self.sql:return [{'id':'p','brand_id':'b'}]
                return [{'id':'i','product_id':'p','image_url':'https://brand.example/a?signature=secret','source_domain':'brand.example','source_url':None,'stored_url':None,'assets_json':None}]
        cur=Cursor();cur.statements=[]
        class Conn:
            def cursor(self):return cur
        report=audit(Conn())
        self.assertEqual(report['states'],{'UNKNOWN':1})
        self.assertEqual(report['reasons'],{'SOURCE_RIGHTS_UNCONFIRMED':1})
        self.assertNotIn('signature',json.dumps(report))
        self.assertTrue(cur.statements[0].endswith('READ ONLY'))
