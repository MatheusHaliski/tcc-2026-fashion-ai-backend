"""Recorte de fotos do catálogo (photoSet) na mesma T4 da FASHN.

É o engine fashn-open do lote (parser humano + BiRefNet + LaMa), pelo MESMO código de scripts/catalog/process_local_sd.py
(GhostPipeline.process com --photo-set): a única diferença é que a foto chega pronta no pedido — o cliente baixa a imagem
com as regras do coletor (intervalo por host, disjuntor em 429) e manda os bytes. A resposta é o set.json do photoSet e os
PNGs whole/fabric, exatamente o que `process_photo_sets.py --from-lot` importa. Nada é gravado em banco ou bucket aqui.
"""
import base64
import gc
import json
import os
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlsplit
from .models import AlignmentError

DEFAULT_WEIGHTS_DIR='/opt/fashionai/weights/fashn-open'
DEFAULT_CODE_DIR='/app/scripts/catalog'
MAX_SOURCE_BYTES=6_000_000
CATEGORIES=frozenset({'upper_piece','lower_piece','full_body_piece'})
MAGIC={b'\x89PNG\r\n\x1a\n':'image/png',b'\xff\xd8\xff':'image/jpeg',b'RIFF':'image/webp'}


def sniff(data):
    """Tipo pelo cabeçalho (não pelo que o cliente diz): só PNG, JPEG e WebP entram."""
    for magic,kind in MAGIC.items():
        if data.startswith(magic) and (kind!='image/webp' or data[8:12]==b'WEBP'):return kind
    raise AlignmentError('INVALID_SOURCE_IMAGE')


def source_bytes(encoded):
    try:data=base64.b64decode(encoded,validate=True)
    except Exception as exc:raise AlignmentError('INVALID_SOURCE_IMAGE') from exc
    if not data or len(data)>MAX_SOURCE_BYTES:raise AlignmentError('SOURCE_IMAGE_TOO_LARGE')
    return data,sniff(data)


def lot_modules(code_dir):
    """Os módulos do lote (process_local_sd, fashn_open) da cópia de scripts/catalog que vai na imagem."""
    code=str(Path(code_dir).resolve())
    if code not in sys.path:sys.path.insert(0,code)
    import fashn_open
    import process_local_sd
    return process_local_sd,fashn_open


class PhotoSetRuntime:
    tasks=('garment_photo_set',)

    def __init__(self,weights_dir=DEFAULT_WEIGHTS_DIR,code_dir=DEFAULT_CODE_DIR,device='cuda',modules=None):
        self.weights=Path(weights_dir)
        self.lot,fashn_open=modules or lot_modules(code_dir)
        problems=fashn_open.verify(self.weights)
        if problems:raise AlignmentError('PHOTOSET_WEIGHTS_INVALID')
        import torch
        if device=='cuda' and not torch.cuda.is_available():raise AlignmentError('REAL_CUDA_DEVICE_REQUIRED')
        self.torch=torch;self.device=device
        self.provider=fashn_open.FashnOpenProvider(self.weights,device)
        self.filler=fashn_open.LamaInpainter(self.weights,device)
        self.ready=True

    def unload(self):
        """Sai da GPU (a prova de roupa ou o retrato pediram a T4)."""
        self.provider=self.filler=None;self.ready=False
        gc.collect()
        if self.torch.cuda.is_available():self.torch.cuda.empty_cache()

    def predict(self,instance):
        data,kind=source_bytes(instance.get('source_image') or '')
        category=instance.get('catalog_category')
        if category not in CATEGORIES:raise AlignmentError('PHOTOSET_CATEGORY_NOT_SUPPORTED')
        url=instance.get('source_url') or ''
        if urlsplit(url).scheme not in ('http','https'):raise AlignmentError('SOURCE_URL_REQUIRED')
        row={'id':instance.get('image_id') or url,'product_id':instance.get('product_id'),'image_url':url,
             'category':category,'subcategory':instance.get('subcategory'),'color':instance.get('color'),'brand':None}
        peak=None
        if self.torch.cuda.is_available():self.torch.cuda.reset_peak_memory_stats()
        with tempfile.TemporaryDirectory(prefix='photoset-') as tmp:
            options=self.lot.Options(out_dir=Path(tmp),dry_run=True,engine='fashn-open',weights=self.weights,device=self.device,photo_set=True)
            # a foto já veio no pedido: o "download" do lote devolve esses bytes para a URL de origem e nada mais
            pipeline=self.lot.GhostPipeline(None,options,fetch=lambda _url:(200,data,kind),open_provider=self.provider,filler=self.filler)
            result=pipeline.process(row)
            if self.torch.cuda.is_available():peak=int(self.torch.cuda.max_memory_allocated())
            produced=result.get('photoSet') or {}
            folder=Path(produced['dir']) if produced.get('dir') else None
            photo_set=json.loads((folder/'set.json').read_text(encoding='utf-8')) if folder and (folder/'set.json').is_file() else None
            files={}
            for name,filename in ((photo_set or {}).get('files') or {}).items():
                path=(folder/filename).resolve()
                if not path.is_relative_to(folder.resolve()) or not path.is_file():raise AlignmentError('PHOTOSET_FILE_MISSING')
                files[name]=base64.b64encode(path.read_bytes()).decode()
        reason=result.get('reason')
        if result.get('status')=='FAILED' and reason in ('RuntimeError','MemoryError'):reason='PHOTOSET_GPU_FAILED'
        return {'status':result.get('status'),'reason':reason,'photoSet':photo_set,'files':files,
                'diagnostics':{'engine':'FASHN_OPEN_PHOTO_SET','device':'cuda:0' if self.device=='cuda' else self.device,
                               'peakCudaBytes':peak,'seconds':result.get('seconds')}}


def photoset_runtime_factory():
    weights=os.getenv('VTON_PHOTOSET_WEIGHTS',DEFAULT_WEIGHTS_DIR);code=os.getenv('VTON_PHOTOSET_CODE',DEFAULT_CODE_DIR)
    return lambda:PhotoSetRuntime(weights,code)
