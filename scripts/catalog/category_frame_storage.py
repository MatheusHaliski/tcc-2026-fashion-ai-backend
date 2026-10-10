"""Render real framed assets; verify S3 bytes before permitting a DB reference."""
import hashlib
import io
import json
import math
import os
import uuid
import threading
from urllib.parse import quote, urlsplit

try:
    from .category_frame import VERSION as FRAME_VERSION
except ImportError:
    from category_frame import VERSION as FRAME_VERSION


def render_frame_info(path, crop, width=900):
    """JPEG 3:4 of the frame plus what happened to the pixels (source crop size, upscale factor)."""
    from PIL import Image, ImageOps
    rect = crop['crop']
    with Image.open(path) as original:
        if original.width * original.height > 40_000_000:
            raise ValueError('IMAGE_TOO_LARGE')
        image = ImageOps.exif_transpose(original).convert('RGB')
        # para dentro: a janela é só de tecido; arredondar para fora poderia trazer 1 px de fundo da borda
        x0, y0 = math.ceil(rect['x']*image.width - 1e-6), math.ceil(rect['y']*image.height - 1e-6)
        x1, y1 = math.floor((rect['x']+rect['w'])*image.width + 1e-6), math.floor((rect['y']+rect['h'])*image.height + 1e-6)
        x0, y0, x1, y1 = max(0, x0), max(0, y0), min(image.width, x1), min(image.height, y1)
        if x1 <= x0 or y1 <= y0:
            raise ValueError('INVALID_FRAME')
        # 3:4 exato encolhendo o lado maior (centrado), para a ampliação não esticar a peça
        w, h = x1 - x0, y1 - y0
        if w * 4 > h * 3:
            nw = h * 3 // 4; x0 += (w - nw) // 2; x1 = x0 + nw
        elif w * 4 < h * 3:
            nh = w * 4 // 3; y0 += (h - nh) // 2; y1 = y0 + nh
        box = (x0, y0, x1, y1)
        if box[2] <= box[0] or box[3] <= box[1]:
            raise ValueError('INVALID_FRAME')
        source_w, source_h = box[2] - box[0], box[3] - box[1]
        framed = image.crop(box).resize((width, width*4//3), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        framed.save(output, format='JPEG', quality=95)
        upscale = round(width / source_w, 3)
        info = {'sourceWidth': image.width, 'sourceHeight': image.height, 'sourceCropWidth': source_w,
                'sourceCropHeight': source_h, 'outputWidth': width, 'outputHeight': width*4//3,
                'upscaleFactor': upscale, 'qualityNote': 'UPSCALED_REDUCED_QUALITY' if upscale > 1 else None}
        return output.getvalue(), info


def render_frame(path, crop, width=900):
    return render_frame_info(path, crop, width)[0]


def previous_assets(record):
    """assets_json anterior como objeto: o inventário do banco já o entrega decodificado (dict); um snapshot pode trazer
    o texto JSON. Qualquer outra coisa (vazio, inválido) não é metadado recuperável e fica None."""
    value = record.get('assets_json')
    if value is None:
        value = record.get('assets')
    if isinstance(value, (bytes, bytearray)):
        value = value.decode('utf-8', 'replace')
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError:
            return None
    return dict(value) if isinstance(value, dict) else None


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

    def store(self, record, response, path, *, decision=None):
        """Upload the framed JPEG and return the DB patch. ``decision`` (forced batch) is recorded in assets_json."""
        expected = response['columns'].get('source_sha256')
        if not expected or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError('SOURCE_CHANGED_SINCE_ANALYSIS')
        crop = json.loads(response['columns']['crop_json'])
        data, info = render_frame_info(path, crop)
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
        assets = {'card':url, 'master':url, 'framingVersion':FRAME_VERSION, 'sha256':digest,
                  'width':900, 'height':1200, 'previousStoredUrl':record.get('stored_url'),
                  'previousAssets':previous_assets(record),
                  'originalUrl':record['source_url'], 'render':info, 'editorFrame':crop.get('editorFrame')}
        if decision is not None:
            assets['persistenceDecision'] = decision
        return {'owned_key':key, 'stored_url':url, 'assets_json':json.dumps(assets, ensure_ascii=False), 'render_info':info}

    def discard_unreferenced(self, assets, is_referenced):
        # A fresh DB lookup is mandatory even when COMMIT raised: it may have succeeded.
        if not is_referenced(assets['stored_url']):
            self.client.delete_object(Bucket=self.bucket, Key=assets['owned_key'])
        with self._lock:
            self._pending.pop(assets['owned_key'], None)

    def pending_assets(self):
        with self._lock:
            return list(self._pending.values())
