"""Render real framed assets; verify S3 bytes before permitting a DB reference."""
import hashlib
import io
import json
import os
import uuid
import threading
from urllib.parse import quote, urlsplit


def render_frame(path, crop, width=900):
    from PIL import Image, ImageOps
    rect = crop['crop']
    with Image.open(path) as original:
        if original.width * original.height > 40_000_000:
            raise ValueError('IMAGE_TOO_LARGE')
        image = ImageOps.exif_transpose(original).convert('RGB')
        box = tuple(round(v) for v in (rect['x']*image.width, rect['y']*image.height,
                    (rect['x']+rect['w'])*image.width, (rect['y']+rect['h'])*image.height))
        if box[2] <= box[0] or box[3] <= box[1]:
            raise ValueError('INVALID_FRAME')
        framed = image.crop(box).resize((width, width*4//3), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        framed.save(output, format='JPEG', quality=95)
        return output.getvalue()


class FrameStorage:
    def __init__(self, client=None):
        self._pending = {}
        self._lock = threading.Lock()
        self.bucket = os.environ['S3_BUCKET']
        base = os.getenv('STORAGE_PUBLIC_BASE_URL', '').rstrip('/')
        if os.getenv('S3_SERVE_THROUGH_API', '').lower() == 'true':
            base = os.getenv('APP_BASE_URL', '').rstrip('/') + '/media'
        if not base or urlsplit(base).scheme != 'https' or not urlsplit(base).hostname:
            raise ValueError('Configure STORAGE_PUBLIC_BASE_URL ou APP_BASE_URL com S3_SERVE_THROUGH_API=true')
        self.base = base
        if client is None:
            import boto3
            from botocore.config import Config
            client = boto3.client('s3', endpoint_url=os.getenv('S3_ENDPOINT') or None,
                region_name=os.getenv('S3_REGION', 'us-east-1'),
                aws_access_key_id=os.environ['S3_ACCESS_KEY_ID'],
                aws_secret_access_key=os.environ['S3_SECRET_ACCESS_KEY'],
                config=Config(s3={'addressing_style': 'path' if os.getenv('S3_PATH_STYLE','').lower()=='true' else 'virtual'},
                              connect_timeout=15, read_timeout=30, retries={'max_attempts':3}))
        self.client = client

    def store(self, record, response, path):
        expected = response['columns'].get('source_sha256')
        if not expected or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError('SOURCE_CHANGED_SINCE_ANALYSIS')
        data = render_frame(path, json.loads(response['columns']['crop_json']))
        digest = hashlib.sha256(data).hexdigest()
        key = 'catalog/framed/' + uuid.uuid4().hex + '/' + digest + '.jpg'
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType='image/jpeg', IfNoneMatch='*')
        with self._lock:
            self._pending[key] = {'owned_key':key, 'stored_url':self.base + '/' + quote(key, safe='/')}
        try:
            body = self.client.get_object(Bucket=self.bucket, Key=key)['Body']
            try:
                verified = body.read(len(data)+1)
            finally:
                body.close()
            if hashlib.sha256(verified).hexdigest() != digest:
                raise ValueError('FRAME_UPLOAD_VERIFICATION_FAILED')
        except Exception:
            self.client.delete_object(Bucket=self.bucket, Key=key)
            with self._lock:
                self._pending.pop(key, None)
            raise
        url = self.base + '/' + quote(key, safe='/')
        return {'owned_key':key, 'stored_url':url, 'assets_json':json.dumps({'card':url, 'master':url,
                'framingVersion':'CATALOG_FRAME_34_50_V1', 'sha256':digest, 'width':900, 'height':1200,
                'previousStoredUrl':record.get('stored_url'), 'originalUrl':record['source_url']})}

    def discard_unreferenced(self, assets, is_referenced):
        # A fresh DB lookup is mandatory even when COMMIT raised: it may have succeeded.
        if not is_referenced(assets['stored_url']):
            self.client.delete_object(Bucket=self.bucket, Key=assets['owned_key'])
        with self._lock:
            self._pending.pop(assets['owned_key'], None)

    def pending_assets(self):
        with self._lock:
            return list(self._pending.values())
