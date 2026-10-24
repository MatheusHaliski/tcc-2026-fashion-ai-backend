#!/usr/bin/env python3
"""Discover public-domain abstract compositions and publish eligible local AURA models.
No credentials needed. Never imports non-free references, SVG, logos or sports cards.
Schedule externally; --apply publishes atomic catalog updates on this filesystem.
"""
import argparse
import hashlib
import html
import io
import json
import re
import time
from pathlib import Path
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen
from PIL import Image, ImageStat
ROOT = Path(__file__).resolve().parents[2]
FAMILIES = {
 'COMMON': ('abstract silk texture', ['#d8c4ac','#f0e5d4']),
 'ELECTRO': ('abstract light trails', ['#78dbe5','#bd9bdc']),
 'SPLASH': ('abstract ink fluid', ['#ac8dcc','#e4b8bb']),
 'HYPE': ('abstract metallic light texture', ['#7ee0dd','#a5bada']),
 'METAMORPHOSE': ('abstract iridescent texture', ['#bfa2df','#8bd9df']),
}
REJECT = re.compile(r'\b(?:logo|flag|coat.of.arms|football|soccer|pokemon|portrait|person|diagram|map|screenshot|advert|text|poster|banner)\b', re.I)
ALLOW = re.compile(r'abstract|texture|silk|satin|iridescen|light trail|ink|fluid|metallic', re.I)
MAX_BYTES = 8_000_000

def get(url, deadline, binary=False):
    if urlparse(url).scheme != 'https' or urlparse(url).hostname not in ('commons.wikimedia.org','upload.wikimedia.org'):
        raise ValueError('unapproved source')
    remaining = deadline-time.monotonic()
    if remaining <= 0: raise TimeoutError('time budget exhausted')
    req = Request(url, headers={'User-Agent':'FashionAI-Aura-Curation/1.0 (public-domain abstract artwork research)'})
    with urlopen(req, timeout=min(10,remaining)) as response:
        body = response.read(MAX_BYTES+1)
    if len(body) > MAX_BYTES: raise ValueError('oversized asset')
    return body if binary else json.loads(body)

def eligible(page):
    title = page.get('title','')
    info = (page.get('imageinfo') or [{}])[0]
    meta = info.get('extmetadata',{})
    license = html.unescape(meta.get('LicenseShortName',{}).get('value','')).lower()
    if license not in ('cc0','cc0 1.0','public domain','pd'): return False
    if REJECT.search(title) or not ALLOW.search(title): return False
    return info.get('mime') in ('image/jpeg','image/png','image/webp')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--per-family',type=int,default=2)
    parser.add_argument('--max-seconds',type=int,default=120)
    parser.add_argument('--output',type=Path,default=ROOT/'public/aura/fashion-curated')
    args=parser.parse_args()
    if not 1 <= args.per_family <= 6 or not 10 <= args.max_seconds <= 180: parser.error('per-family 1..6; max-seconds 10..180')
    deadline=time.monotonic()+args.max_seconds
    directory=args.output
    old=json.loads((directory/'catalog.json').read_text()) if (directory/'catalog.json').exists() else {'version':1,'presets':[]}
    existing={p['id'] for p in old['presets']}; additions=[]; errors=[]
    for family,(query,palette) in FAMILIES.items():
        if time.monotonic() >= deadline: break
        params=dict(action='query',format='json',generator='search',gsrsearch=query,gsrnamespace=6,gsrlimit=12,prop='imageinfo',iiprop='url|mime|extmetadata',iiurlwidth=900)
        try:
            pages=get('https://commons.wikimedia.org/w/api.php?'+urlencode(params),deadline).get('query',{}).get('pages',{})
            count=0
            for page in pages.values():
                if count >= args.per_family or time.monotonic() >= deadline: break
                if not eligible(page): continue
                info=page['imageinfo'][0]
                id=family.lower()+'-'+hashlib.sha256(info['url'].encode()).hexdigest()[:16]
                if id in existing: continue
                try:
                    raw=get(info.get('thumburl',info['url']),deadline,True)
                    with Image.open(io.BytesIO(raw)) as im:
                        if im.width<350 or im.height<350 or not 0.5 <= im.width/im.height <= 2: continue
                        im=im.convert('RGB'); im.thumbnail((900,1200))
                        # Flat single-color files are not useful fashion compositions.
                        if max(ImageStat.Stat(im).stddev)<8: continue
                        if args.apply:
                            directory.mkdir(parents=True,exist_ok=True)
                            im.save(directory/f'{id}.webp',format='WEBP',quality=86)
                    additions.append(dict(id=id,name=page['title'].removeprefix('File:')[:160],family=family,image=f'/aura/fashion-curated/{id}.webp',palette=palette,source=info.get('descriptionurl','Wikimedia Commons'),license=info['extmetadata']['LicenseShortName']['value'],curation='abstract keywords + raster dimensions + public-domain license; no semantic vision review'))
                    existing.add(id); count+=1
                except Exception as e: errors.append({'family':family,'reason':str(e)})
        except Exception as e: errors.append({'family':family,'reason':str(e)})
    if args.apply and additions:
        old['presets'].extend(additions);old['version']=old.get('version',1)+1
        temp=directory/'catalog.json.tmp';temp.write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n');temp.replace(directory/'catalog.json')
    result={'applied':args.apply,'added':len(additions),'families':list(FAMILIES),'candidates':additions,'errors':errors}
    print(json.dumps(result,ensure_ascii=False,indent=2))
    return 1 if errors and not additions else 0
if __name__=='__main__': raise SystemExit(main())
