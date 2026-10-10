import io
import hashlib
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from scripts.catalog.category_frame_storage import FrameStorage, render_frame

class S3:
    def put_object(self, **kwargs): self.data=kwargs['Body']
    def delete_object(self, **kwargs): self.deleted=kwargs['Key']
    def get_object(self, **kwargs): return {'Body':io.BytesIO(self.data)}

class FrameStorageTest(unittest.TestCase):
    def test_real_pixels_and_verified_upload(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'source.png'
            im=Image.new('RGB',(1200,1600),'blue')
            im.paste('red',(300,400,900,1200));im.save(path)
            crop={'crop':{'x':.25,'y':.25,'w':.5,'h':.5}}
            data=render_frame(path,crop)
            with Image.open(io.BytesIO(data)) as framed:
                self.assertEqual(framed.size,(900,1200))
                self.assertGreater(framed.getpixel((450,600))[0],240)
            client=S3()
            with patch.dict(os.environ,{'S3_BUCKET':'test','STORAGE_PUBLIC_BASE_URL':'https://media.example.com','S3_SERVE_THROUGH_API':'false'}):
                assets=FrameStorage(client).store({'source_url':'https://brand.example/a.jpg','stored_url':'old'}, {'columns':{'crop_json':json.dumps(crop),'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest()}},path)
            self.assertIn('catalog/framed/',assets['stored_url'])
            self.assertEqual(json.loads(assets['assets_json'])['previousStoredUrl'],'old')

    def test_failed_verification_cannot_produce_db_patch(self):
        class Broken(S3):
            def get_object(self, **kwargs): return {'Body':io.BytesIO(b'corrupt')}
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'source.png';Image.new('RGB',(120,160)).save(path)
            with patch.dict(os.environ,{'S3_BUCKET':'test','STORAGE_PUBLIC_BASE_URL':'https://media.example.com','S3_SERVE_THROUGH_API':'false'}):
                with self.assertRaisesRegex(ValueError,'VERIFICATION_FAILED'):
                    FrameStorage(Broken()).store({'source_url':'original'}, {'columns':{'crop_json':json.dumps({'crop':{'x':0,'y':0,'w':.5,'h':.5}}),'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest()}},path)

    def test_compensation_preserves_referenced_asset(self):
        client=S3()
        with patch.dict(os.environ,{'S3_BUCKET':'test','STORAGE_PUBLIC_BASE_URL':'https://media.example.com','S3_SERVE_THROUGH_API':'false'}):
            storage=FrameStorage(client)
            assets={'owned_key':'catalog/framed/owned/a.jpg','stored_url':'https://media.example.com/a.jpg'}
            storage.discard_unreferenced(assets,lambda url:True)
            self.assertFalse(hasattr(client,'deleted'))
            storage.discard_unreferenced(assets,lambda url:False)
            self.assertEqual(client.deleted,assets['owned_key'])

    def test_unknown_commit_status_does_not_delete(self):
        client=S3()
        with patch.dict(os.environ,{'S3_BUCKET':'test','STORAGE_PUBLIC_BASE_URL':'https://media.example.com','S3_SERVE_THROUGH_API':'false'}):
            storage=FrameStorage(client)
            def unavailable(url): raise RuntimeError('database unavailable')
            with self.assertRaises(RuntimeError): storage.discard_unreferenced({'owned_key':'owned','stored_url':'url'},unavailable)
            self.assertFalse(hasattr(client,'deleted'))

    def test_changed_source_never_uploads(self):
        from unittest.mock import Mock
        client=Mock()
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'source.png';Image.new('RGB',(120,160)).save(path)
            with patch.dict(os.environ,{'S3_BUCKET':'test','STORAGE_PUBLIC_BASE_URL':'https://media.example.com','S3_SERVE_THROUGH_API':'false'}):
                with self.assertRaisesRegex(ValueError,'SOURCE_CHANGED'):
                    FrameStorage(client).store({'source_url':'original'},{'columns':{'source_sha256':'0'*64}},path)
                client.put_object.assert_not_called()
