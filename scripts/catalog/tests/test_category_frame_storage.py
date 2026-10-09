import io
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
                assets=FrameStorage(client).store({'source_url':'https://brand.example/a.jpg','stored_url':'old'}, {'columns':{'crop_json':json.dumps(crop)}},path)
            self.assertIn('catalog/framed/',assets['stored_url'])
            self.assertEqual(json.loads(assets['assets_json'])['previousStoredUrl'],'old')

    def test_failed_verification_cannot_produce_db_patch(self):
        class Broken(S3):
            def get_object(self, **kwargs): return {'Body':io.BytesIO(b'corrupt')}
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'source.png';Image.new('RGB',(120,160)).save(path)
            with patch.dict(os.environ,{'S3_BUCKET':'test','STORAGE_PUBLIC_BASE_URL':'https://media.example.com','S3_SERVE_THROUGH_API':'false'}):
                with self.assertRaisesRegex(ValueError,'VERIFICATION_FAILED'):
                    FrameStorage(Broken()).store({'source_url':'original'}, {'columns':{'crop_json':json.dumps({'crop':{'x':0,'y':0,'w':.5,'h':.5}})}},path)
