#!/usr/bin/env python3
"""Async FashionAI clothing dataset ingestion. Originals never overwritten; unsafe files are rejected.

python -m scripts.catalog.ingest_image_dataset --input products.json --output work/dataset
Logs are JSON on stderr. metadata_clean.json is the authoritative completed-run manifest.
"""
from __future__ import annotations
import argparse
import asyncio
import hashlib
import io
import ipaddress
import json
import logging
import os
import re
import socket
import tempfile
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urljoin, urlsplit
import aiohttp
import numpy as np
from aiohttp.abc import AbstractResolver
from PIL import Image, ImageOps, UnidentifiedImageError
from scipy.fft import dctn
try:
    from .photo_set import LocalClothProvider, clean_target_mask
    from .semantic_photo_provider import AutomaticClothProvider
    from .photo_preflight import inspect_source
except ImportError:
    from photo_set import LocalClothProvider, clean_target_mask
    from semantic_photo_provider import AutomaticClothProvider
    from photo_preflight import inspect_source
LOGGER=logging.getLogger('fashionai.images')
MAX_BYTES=10*1024*1024
MAX_PIXELS=40_000_000
VERSION='FAI_ML_DATASET_512_V2'

class ImageFailure(Exception):
    def __init__(self, reason, *, status='REJECTED', metrics=None):
        super().__init__(reason);self.status=status;self.metrics=metrics

def emit(event,**values):
    LOGGER.info(json.dumps({'event':event,**values},ensure_ascii=False))

def safe_url(url):
    try:
        p=urlsplit(url)
        if p.scheme not in ('https','http') or not p.hostname or p.username is not None or p.password is not None or p.port not in (None,80,443) or '\\' in url or any(c.isspace() for c in url):raise ValueError()
        ip=ipaddress.ip_address(p.hostname) if re.fullmatch(r'[0-9a-fA-F:.]+',p.hostname) else None
        if ip is not None and not ip.is_global:raise ValueError()
        return url
    except (ValueError,TypeError):raise ImageFailure('INVALID_PUBLIC_IMAGE_URL') from None

class PublicResolver(AbstractResolver):
    """Validate DNS at connection time, including redirects; never connect to private/metadata addresses."""
    async def resolve(self,host,port=0,family=socket.AF_INET):
        rows=await asyncio.get_running_loop().getaddrinfo(host,port,family=family,type=socket.SOCK_STREAM)
        if not rows or any(not ipaddress.ip_address(r[4][0]).is_global for r in rows):raise OSError('PUBLIC_DNS_REQUIRED')
        return [dict(hostname=host,host=r[4][0],port=port,family=r[0],proto=r[2],flags=socket.AI_NUMERICHOST) for r in rows]
    async def close(self):pass

@dataclass(frozen=True)
class ProductImage:
    product_id:str
    brand:str
    category:str
    subcategory:str
    url:str
    index:int=0

class AsyncDownloader:
    def __init__(self,session,retries=2):self.session=session;self.retries=retries
    async def _request(self,method,url):
        original=safe_url(url)
        for attempt in range(self.retries+1):
            try:
                current=original
                for _ in range(5):
                    async with self.session.request(method,current,allow_redirects=False) as response:
                        if response.status in (301,302,303,307,308):
                            following=safe_url(urljoin(current,response.headers.get('Location','')))
                            if current.startswith('https:') and not following.startswith('https:'):raise ImageFailure('INSECURE_REDIRECT')
                            current=following;continue
                        if method=='HEAD' and response.status in (405,501):return None
                        if response.status in (408,429,500,502,503,504):raise ImageFailure('RETRYABLE_HTTP_'+str(response.status))
                        if response.status!=200:raise ImageFailure('HTTP_'+str(response.status))
                        if response.content_length and response.content_length>MAX_BYTES:raise ImageFailure('IMAGE_TOO_LARGE')
                        if method=='HEAD':return b''
                        data=bytearray()
                        async for chunk in response.content.iter_chunked(64*1024):
                            data.extend(chunk)
                            if len(data)>MAX_BYTES:raise ImageFailure('IMAGE_TOO_LARGE')
                        return bytes(data)
                raise ImageFailure('TOO_MANY_REDIRECTS')
            except (aiohttp.ClientError,asyncio.TimeoutError,OSError,ImageFailure) as error:
                retry=not isinstance(error,ImageFailure) or str(error).startswith('RETRYABLE_HTTP_')
                if not retry or attempt==self.retries:
                    raise ImageFailure(str(error) if isinstance(error,ImageFailure) else 'IMAGE_DOWNLOAD_FAILED') from None
                emit('download_retry',attempt=attempt+1,source_sha256=hashlib.sha256(original.encode()).hexdigest())
                await asyncio.sleep(min(2**attempt,4))
    async def get(self,url):
        await self._request('HEAD',url)
        return await self._request('GET',url)

class GarmentSanitizer:
    """Semantic rembg U2-Net classes exclude other clothing and people; no generative reconstruction."""
    def __init__(self,provider=None):self.provider=provider or AutomaticClothProvider()
    def sanitize(self,data,item):
        try:
            with Image.open(io.BytesIO(data)) as raw:
                if raw.format not in ('JPEG','PNG','WEBP'):raise ImageFailure('UNSUPPORTED_IMAGE_FORMAT')
                if raw.width*raw.height>MAX_PIXELS:raise ImageFailure('IMAGE_TOO_LARGE')
                if min(raw.size)<300:raise ImageFailure('BELOW_MINIMUM_300X300')
                image=ImageOps.exif_transpose(raw).convert('RGB');image.load()
        except (UnidentifiedImageError,OSError,Image.DecompressionBombError):raise ImageFailure('CORRUPT_IMAGE') from None
        original=image.size
        image.thumbnail((2048,2048),Image.Resampling.LANCZOS)
        provider=self.provider.for_source(hashlib.sha256(data).hexdigest(),item.url) if hasattr(self.provider,'for_source') else self.provider
        masks=provider.masks(image,item.category,item.subcategory)
        preflight=inspect_source(image,masks,item.category,item.subcategory,original_size=original)
        if preflight.status!='PASS':raise ImageFailure(preflight.reason,status=preflight.status,metrics={'preflight':preflight.metrics})
        mask,metrics=clean_target_mask(masks.target,masks.forbidden,item.category,item.subcategory)
        metrics['preflight']=preflight.metrics
        piece=image.convert('RGBA');piece.putalpha(mask);piece=piece.crop(mask.getbbox());piece.thumbnail((480,480),Image.Resampling.LANCZOS)
        result=Image.new('RGBA',(512,512),'#FFFFFF');result.alpha_composite(piece,((512-piece.width)//2,(512-piece.height)//2));result=result.convert('RGB')
        return result,original,metrics

def perceptual_hash(image):
    gray=np.asarray(image.convert('L').resize((32,32),Image.Resampling.LANCZOS),dtype=float)
    low=dctn(gray,norm='ortho')[:8,:8].ravel();bits=low>np.median(low[1:]);bits[0]=False
    return sum(int(bit)<<i for i,bit in enumerate(bits))

def material_color(image):
    a=np.asarray(image.convert('RGB'),dtype=float);mask=a.min(2)<240
    return np.median(a[mask],axis=0) if mask.any() else np.array([255,255,255])

def slug(value):return re.sub(r'[^a-zA-Z0-9_-]+','_',str(value)).strip('_')[:70] or 'unknown'

def atomic_write(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent,prefix='.pending-',delete=False) as file:
        temporary=Path(file.name)
        try:file.write(data);file.flush();os.fsync(file.fileno())
        except BaseException:temporary.unlink(missing_ok=True);raise
    temporary.replace(path)

class ImageDatasetPipeline:
    def __init__(self,output,*,concurrency=4,sanitizer=None,downloader=None,phash_distance=4):
        self.output=Path(output);self.concurrency=max(1,min(concurrency,12));self.sanitizer=sanitizer or GarmentSanitizer();self.downloader=downloader;self.distance=phash_distance
        self.model_lock=asyncio.Lock()
    async def _process(self,item,downloader):
        base=dict(product_id=item.product_id,brand=item.brand,category=item.category,subcategory=item.subcategory,image_index=item.index,source_url_sha256=hashlib.sha256(item.url.encode()).hexdigest())
        try:
            data=await downloader.get(item.url)
            # One shared local model session: downloads stay parallel while inference is bounded.
            async with self.model_lock:image,original,metrics=await asyncio.to_thread(self.sanitizer.sanitize,data,item)
            return base, image, dict(original_width=original[0],original_height=original[1],source_sha256=hashlib.sha256(data).hexdigest(),metrics=metrics)
        except asyncio.CancelledError:raise
        except Exception as error:
            code='SEGMENTATION_DEPENDENCY_MISSING' if isinstance(error,ImportError) else str(error) if isinstance(error,(ImageFailure,ValueError)) and re.fullmatch('[A-Z0-9_]{1,100}',str(error)) else 'PROCESSING_FAILED'
            emit('image_rejected',product_id=item.product_id,reason=code)
            return base,None,dict(status=error.status if isinstance(error,ImageFailure) else 'REVIEW',reason=code,
                                 metrics=error.metrics if isinstance(error,ImageFailure) else None)
    async def run(self,items):
        self.output.mkdir(parents=True,exist_ok=True);rows=[];seen=[];filenames=set()
        timeout=aiohttp.ClientTimeout(total=30,connect=8,sock_read=10)
        async with aiohttp.ClientSession(timeout=timeout,connector=aiohttp.TCPConnector(resolver=PublicResolver(),limit=self.concurrency,ttl_dns_cache=0),headers={'User-Agent':'FashionAI-Dataset/1.0'},trust_env=False) as session:
            downloader=self.downloader or AsyncDownloader(session)
            # Bounded batches, deterministic input-order duplicate ownership, no task per million-row catalog.
            for offset in range(0,len(items),self.concurrency):
                results=await asyncio.gather(*(self._process(i,downloader) for i in items[offset:offset+self.concurrency]))
                for base,image,info in results:
                    if image is None:row={**base,**info,'image_path':None}
                    else:
                        phash=perceptual_hash(image);color=material_color(image);group=(base['brand'].casefold(),base['category'],base['subcategory'])
                        duplicate=next((r for g,h,c,r in seen if g==group and (phash^h).bit_count()<=self.distance and float(np.linalg.norm(color-c))<18),None)
                        if duplicate:row={**base,**info,'status':'DUPLICATE','duplicate_of':duplicate['product_id'],'image_path':duplicate['image_path'],'phash':f'{phash:016x}'}
                        else:
                            stem='_'.join(slug(base[k]) for k in ('brand','category','product_id'));suffix='' if not base['image_index'] else '_'+str(base['image_index']+1)
                            name=stem+suffix+'.png'
                            if name in filenames:name=stem+'_'+base['source_url_sha256'][:12]+suffix+'.png'
                            filenames.add(name);path=Path('images')/name;out=io.BytesIO();image.save(out,'PNG',optimize=True);atomic_write(self.output/path,out.getvalue())
                            row={**base,**info,'status':'VALID','image_path':path.as_posix(),'width':512,'height':512,'phash':f'{phash:016x}','clean_sha256':hashlib.sha256(out.getvalue()).hexdigest()};seen.append((group,phash,color,row))
                    rows.append(row);emit('image_completed',product_id=row['product_id'],status=row['status'],completed=len(rows),total=len(items))
                atomic_write(self.output/'metadata_clean.json',json.dumps({'version':VERSION,'images':rows,'complete':len(rows)==len(items)},indent=2,ensure_ascii=False).encode())
        if not items:atomic_write(self.output/'metadata_clean.json',json.dumps({'version':VERSION,'images':[],'complete':True}).encode())
        return rows

def parse_products(raw):
    rows=raw.get('products',[]) if isinstance(raw,dict) else raw
    if not isinstance(rows,list):raise ValueError('INPUT_MUST_BE_PRODUCT_LIST')
    items=[]
    for index,row in enumerate(rows):
        if not isinstance(row,dict):raise ValueError('INVALID_PRODUCT_AT_'+str(index))
        identity=str(row.get('product_id') or row.get('id') or '').strip();category=str(row.get('category') or '').strip();brand=row.get('brand') or 'FashionAI'
        if isinstance(brand,dict):brand=brand.get('name') or 'FashionAI'
        if not identity or not category:raise ValueError('PRODUCT_ID_AND_CATEGORY_REQUIRED_AT_'+str(index))
        urls=row.get('image_urls') or [row.get('image_url') or row.get('url')]
        if not isinstance(urls,list) or any(not isinstance(u,str) for u in urls):raise ValueError('IMAGE_URLS_REQUIRED_AT_'+str(index))
        items.extend(ProductImage(identity,str(brand),category,str(row.get('subcategory') or ''),url,i) for i,url in enumerate(urls))
    return items

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--input',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--concurrency',type=int,default=4);parser.add_argument('--reviewed-masks',type=Path);parser.add_argument('--parser-weights',type=Path);args=parser.parse_args()
    logging.basicConfig(level=logging.INFO,format='%(message)s')
    items=parse_products(json.loads(args.input.read_text()));emit('pipeline_started',images=len(items),version=VERSION)
    sanitizer=GarmentSanitizer(AutomaticClothProvider(weights=args.parser_weights))
    if args.reviewed_masks:
        try:from .reviewed_photo_masks import ReviewedMaskProvider
        except ImportError:from reviewed_photo_masks import ReviewedMaskProvider
        sanitizer=GarmentSanitizer(ReviewedMaskProvider(args.reviewed_masks))
    rows=asyncio.run(ImageDatasetPipeline(args.output,concurrency=args.concurrency,sanitizer=sanitizer).run(items));emit('pipeline_finished',valid=sum(r['status']=='VALID' for r in rows),rejected=sum(r['status']=='REJECTED' for r in rows),duplicates=sum(r['status']=='DUPLICATE' for r in rows))
    return 0 if not rows or any(r['status']=='VALID' for r in rows) else 2
if __name__=='__main__':raise SystemExit(main())
