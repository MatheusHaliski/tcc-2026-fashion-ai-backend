"""FAI-owned illustration variants; never presented as an actual brand photograph."""
from __future__ import annotations
import argparse
import hashlib
import io
import json
from pathlib import Path
from urllib.parse import urlencode
import numpy as np
from PIL import Image
try:
    from .photo_set import _fabric_box
except ImportError:
    from photo_set import _fabric_box
ROOT = Path(__file__).resolve().parents[2]
MANIFEST = json.loads((ROOT/'lib/assets/default-garments.json').read_text())

def color_of(color=None):
    value = MANIFEST['colors'].get(color, color or '#8c8a87')
    import re
    return value.lower() if isinstance(value,str) and re.fullmatch(r'#[0-9a-fA-F]{6}',value) else '#8c8a87'

def default_asset_url(category, subcategory=None, color=None, framing='WHOLE'):
    return '/api/catalog/default-asset?'+urlencode(dict(category=category or '',subcategory=subcategory or '',color=color_of(color),framing=framing,v=MANIFEST['version']))

def source_of(category,subcategory=None):
    sub=MANIFEST['subcategories'].get(subcategory,{})
    return sub['url'] if sub.get('category')==category else MANIFEST['categories'].get(category,MANIFEST['generic'])

def recolor(image,color):
    a=np.array(image.convert('RGBA')); rgb=a[:,:,:3].astype(float);r,g,b=rgb[:,:,0],rgb[:,:,1],rgb[:,:,2]
    mask=(a[:,:,3]>240)&~((r>g*1.13)&(r>b*1.2))&((b>r*1.08)|((rgb.max(2)-rgb.min(2)<32)&(rgb.max(2)<244)))
    lum=rgb@np.array([.2126,.7152,.0722]);mid=float(np.median(lum[mask])) if mask.any() else 128
    f=np.clip(lum/max(1,mid),.18,1.8)[:,:,None];target=np.array([int(color_of(color)[i:i+2],16) for i in (1,3,5)])
    values=np.where(f<=1,target*f,target+(255-target)*(f-1)*.45)
    a[:,:,:3][mask]=np.rint(values[mask]).clip(0,255).astype(np.uint8)
    return Image.fromarray(a),Image.fromarray((mask*255).astype(np.uint8))

def render_default(image,color,framing='WHOLE'):
    image,mask=recolor(image,color)
    if framing=='FABRIC':
        box=_fabric_box(mask)
        return image.crop(box).convert('RGB').resize((480,640),Image.Resampling.LANCZOS) if box else Image.new('RGB',(480,640),color_of(color))
    box=image.getbbox();piece=image.crop(box) if box else image
    piece.thumbnail((365,474),Image.Resampling.LANCZOS)
    out=Image.new('RGBA',(480,640),'#f4f5f7');out.alpha_composite(piece,((480-piece.width)//2,(640-piece.height)//2))
    return out.convert('RGB')

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);p.add_argument('--subcategory');p.add_argument('--all',action='store_true');p.add_argument('--color',action='append');a=p.parse_args()
    if not a.all and not a.subcategory:p.error('Use --subcategory ou --all')
    rows=MANIFEST['subcategories'] if a.all else {a.subcategory:MANIFEST['subcategories'][a.subcategory]};a.output.mkdir(parents=True,exist_ok=True)
    metadata=[]
    for sub,row in rows.items():
        if not row['url'].endswith(('.webp','.png')):continue
        with Image.open(ROOT/'public'/row['url'].lstrip('/')) as im:
            for color in a.color or MANIFEST['colors']:
                for framing in ('WHOLE','FABRIC'):
                    data=io.BytesIO();render_default(im,color,framing).save(data,'PNG');name=f'{sub}_{color_of(color)[1:]}_{framing.lower()}.png';(a.output/name).write_bytes(data.getvalue())
                    metadata.append(dict(subcategory=sub,color=color_of(color),framing=framing,path=name,sha256=hashlib.sha256(data.getvalue()).hexdigest(),illustration=True))
    (a.output/'manifest.json').write_text(json.dumps(metadata,indent=2))
if __name__=='__main__':main()
