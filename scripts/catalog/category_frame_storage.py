"""Render real framed assets; verify S3 bytes before permitting a DB reference.

Also reads back what each framed write preserved (``previousStoredUrl``/``previousAssets``/``originalUrl``) to restore a
legacy framed image (V1/V2) that the V3 rule refuses to its pre-frame state — no S3 object is created or deleted for that.
"""
import hashlib
import io
import json
import math
import os
import uuid
import threading
from urllib.parse import quote, urlsplit

try:
    from .category_frame import VERSION as FRAME_VERSION, framed_url, legacy_framed
except ImportError:
    from category_frame import VERSION as FRAME_VERSION, framed_url, legacy_framed


def _hex_color(value):
    """'#rrggbb' → (r, g, b); qualquer outra coisa → None."""
    if isinstance(value, str) and len(value) == 7 and value.startswith('#'):
        try:
            return tuple(int(value[i:i + 2], 16) for i in (1, 3, 5))
        except ValueError:
            return None
    return None


def _median_color(pixels):
    if not pixels:
        return None
    return tuple(sorted(p[i] for p in pixels)[len(pixels) // 2] for i in range(3))


def _edge_colors(image):
    """Mediana de uma faixa de 2% em cada borda da foto (fundo de estúdio pode ter degradê: cada lado com a sua cor)."""
    w, h = image.size
    band = max(1, round(min(w, h) * 0.02))
    small = image if w * h <= 640_000 else image.resize((max(1, w // 4), max(1, h // 4)))
    sw, sh = small.size
    sb = max(1, round(band * sw / w))
    px = small.load()
    strips = {'top': [(x, y) for y in range(sb) for x in range(sw)],
              'bottom': [(x, y) for y in range(sh - sb, sh) for x in range(sw)],
              'left': [(x, y) for x in range(sb) for y in range(sh)],
              'right': [(x, y) for x in range(sw - sb, sw) for y in range(sh)]}
    return {side: _median_color([px[x, y] for x, y in coords]) for side, coords in strips.items()}


def render_frame_info(path, crop, width=900):
    """JPEG 3:4 do quadro e o que aconteceu com os pixels (tamanho do recorte na origem, ampliação, fundo completado).

    Quadro de cobertura (COVER, parte de cima/baixo) e versões antigas: arredonda PARA DENTRO e encolhe o lado maior até o
    3:4 exato — a peça preenche o quadro e nenhum pixel de fora entra pela borda. Objeto inteiro (WIDTH/CONTAIN: calçado,
    bolsa, joias…) ou quadro da regra que passa da foto (relógio pelo mostrador): arredonda PARA FORA e completa até o 3:4
    exato; o que passa da foto vira a cor do fundo de estúdio de cada lado (como o smartPadding do card) — o objeto nunca é
    cortado.
    """
    from PIL import Image, ImageOps
    rect = crop['crop']
    frame = crop.get('editorFrame') if isinstance(crop.get('editorFrame'), dict) else {}
    fit = (frame.get('rule') or {}).get('fit') if isinstance(frame.get('rule'), dict) else None
    outside = rect['x'] < -1e-9 or rect['y'] < -1e-9 or rect['x'] + rect['w'] > 1 + 1e-9 or rect['y'] + rect['h'] > 1 + 1e-9
    whole = fit in ('WIDTH', 'CONTAIN') or (fit is not None and outside)
    with Image.open(path) as original:
        if original.width * original.height > 40_000_000:
            raise ValueError('IMAGE_TOO_LARGE')
        image = ImageOps.exif_transpose(original)
        background = _hex_color(frame.get('background')) or _hex_color(crop.get('background'))
        if image.mode in ('RGBA', 'LA') or (image.mode == 'P' and 'transparency' in image.info):
            # PNG recortado pela marca: o transparente vira o fundo (sem isso, o "nada" da foto sairia preto no JPEG)
            rgba = image.convert('RGBA')
            flat = Image.new('RGB', rgba.size, background or (255, 255, 255))
            flat.paste(rgba, mask=rgba.split()[3])
            image = flat
        else:
            image = image.convert('RGB')
        W, H = image.size
        padded, sides = 0, []
        if whole:
            x0, y0 = math.floor(rect['x'] * W + 1e-6), math.floor(rect['y'] * H + 1e-6)
            x1, y1 = math.ceil((rect['x'] + rect['w']) * W - 1e-6), math.ceil((rect['y'] + rect['h']) * H - 1e-6)
            if x1 <= x0 or y1 <= y0:
                raise ValueError('INVALID_FRAME')
            # 3:4 exato crescendo (centrado) até um múltiplo de 3 × 4: nada do objeto sai
            unit = max(math.ceil((x1 - x0) / 3), math.ceil((y1 - y0) / 4))
            x0 -= (unit * 3 - (x1 - x0)) // 2
            y0 -= (unit * 4 - (y1 - y0)) // 2
            x1, y1 = x0 + unit * 3, y0 + unit * 4
            source_w, source_h = x1 - x0, y1 - y0
            edges = _edge_colors(image)
            fill = background or _median_color([c for c in edges.values() if c]) or (255, 255, 255)
            canvas = Image.new('RGB', (source_w, source_h), fill)
            # cada lado que passa da foto recebe a cor do fundo daquela borda
            for side, box in (('top', (0, 0, source_w, max(0, -y0))), ('bottom', (0, max(0, H - y0), source_w, source_h)),
                              ('left', (0, 0, max(0, -x0), source_h)), ('right', (max(0, W - x0), 0, source_w, source_h))):
                if box[2] > box[0] and box[3] > box[1]:
                    sides.append(side)
                    canvas.paste(edges.get(side) or fill, box)
            inner = (max(0, x0), max(0, y0), min(W, x1), min(H, y1))
            if inner[2] <= inner[0] or inner[3] <= inner[1]:
                raise ValueError('INVALID_FRAME')
            canvas.paste(image.crop(inner), (inner[0] - x0, inner[1] - y0))
            padded = source_w * source_h - (inner[2] - inner[0]) * (inner[3] - inner[1])
            framed = canvas.resize((width, width * 4 // 3), Image.Resampling.LANCZOS)
        else:
            # para dentro: a janela é só da peça; arredondar para fora poderia trazer 1 px de fundo da borda
            x0, y0 = math.ceil(rect['x']*W - 1e-6), math.ceil(rect['y']*H - 1e-6)
            x1, y1 = math.floor((rect['x']+rect['w'])*W + 1e-6), math.floor((rect['y']+rect['h'])*H + 1e-6)
            x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
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
        info = {'sourceWidth': W, 'sourceHeight': H, 'sourceCropWidth': source_w,
                'sourceCropHeight': source_h, 'outputWidth': width, 'outputHeight': width*4//3,
                'upscaleFactor': upscale, 'qualityNote': 'UPSCALED_REDUCED_QUALITY' if upscale > 1 else None}
        if whole:
            info.update(rounding='OUTWARD', paddedSides=sides, paddingShare=round(padded / (source_w * source_h), 4))
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


def _assets_object(value):
    """``previousAssets`` como o lote gravou: objeto (V2/V3), texto JSON (V1 sobre snapshot) ou None/ausente."""
    if isinstance(value, (bytes, bytearray)):
        value = value.decode('utf-8', 'replace')
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError:
            return None
    return dict(value) if isinstance(value, dict) else None


def pre_frame_state(record, max_levels=8):
    """Referência ativa da imagem antes do primeiro quadro do lote, pelo que cada gravação preservou em assets_json.

    Todo quadro gravado guarda o que estava ativo antes dele (``previousStoredUrl``, ``previousAssets``) e a foto da marca
    (``originalUrl``). Um quadro feito por cima de outro (V2 sobre V1) aponta para o anterior: a cadeia é seguida até uma
    referência que não é do lote. Cadeia incompleta (quadro antigo sem ``previousStoredUrl``) volta à foto original da marca
    (``stored_url`` NULL, sem assets: o card usa ``image_url``) — nunca a outro quadro. Assets anteriores que apontem para um
    quadro do lote também não voltam.
    """
    url, assets = record.get('stored_url'), previous_assets(record)
    original = (assets or {}).get('originalUrl')
    levels, complete = 0, True
    while framed_url(url):
        if not isinstance(assets, dict) or 'previousStoredUrl' not in assets or levels >= max_levels:
            url, assets, complete = None, None, False
            break
        url, assets = assets.get('previousStoredUrl'), _assets_object(assets.get('previousAssets'))
        levels += 1
    if url is not None and not isinstance(url, str):
        url, assets, complete = None, None, False
    if assets is not None and any(framed_url(v) for v in assets.values()):
        assets = None
    return {'stored_url': url or None, 'assets': assets or None,
            'restoredTo': 'PREVIOUS_STORED_URL' if url else 'ORIGINAL_URL', 'levels': levels, 'chainComplete': complete,
            'originalUrl': original}


def revert_plan(record, reason, *, product_frame_version=None):
    """Plano para desfazer o quadro antigo (V1/V2) de uma foto que a V3 recusou; None se a imagem não mostra um quadro antigo.

    O plano só diz para onde a referência ativa volta; a gravação passa pelo mesmo caminho guardado e auditado do lote
    (catalog_image_updates.apply_product). O JPEG antigo continua no S3 (nada é apagado)."""
    if not legacy_framed(record):
        return None
    return {'reason': str(reason)[:200], 'revertedFrom': record.get('pipeline_version'), 'framedUrl': record.get('stored_url'),
            'productFrameVersion': product_frame_version, **pre_frame_state(record)}


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
