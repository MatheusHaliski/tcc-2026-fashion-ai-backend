#!/usr/bin/env python3
"""Research technological treatments of actual garment photos, not background or game cards.
Outputs reference metadata only; never imports third-party artwork into the app.
"""
import argparse,concurrent.futures,json,time,xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request,urlopen
QUERIES=[
 'fashion garment photograph holographic edge contour overlay augmented reality',
 'fashion clothing photo digital scan wireframe segmentation visual effect',
 'garment image relighting metallic fabric highlight shader fashion',
 'fashion augmented reality clothing material texture visual effect photo',
 'fashion editorial photography chromatic light projection clothing',
 'garment segmentation alpha mask computer vision photo background preservation',
]
def search(query):
 url='https://www.bing.com/search?'+urlencode({'q':query,'format':'rss'})
 with urlopen(Request(url,headers={'User-Agent':'FashionAI-Hype-Photo-Research/1.0'}),timeout=8) as r:body=r.read(2_000_000)
 return [{'query':query,'title':n.findtext('title'),'url':n.findtext('link'),'description':n.findtext('description')} for n in ET.fromstring(body).findall('./channel/item')]
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,default=Path('work/hype-photo-research.json'));args=p.parse_args()
 references=[];errors=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  futures={pool.submit(search,q):q for q in QUERIES}
  for future in concurrent.futures.as_completed(futures):
   try:references.extend(future.result())
   except Exception as e:errors.append({'query':futures[future],'error':type(e).__name__})
 excluded=('football','fifa','pokemon','trading card','sports card','esports')
 accepted=[];seen=set()
 for r in references:
  text=(r['title']+' '+(r['description'] or '')).lower()
  if r['url'] in seen or any(w in text for w in excluded):continue
  if not any(w in text for w in ('fashion','garment','clothing','fabric','segmentation')):continue
  if not any(w in text for w in ('holograph','wireframe','augmented','segmentation','relighting','shader','projection','neural render','light effect','digital scan')):continue
  seen.add(r['url']);accepted.append(r)
 out={'scope':'AURA Hype: photo treatment and global score, not decorative MP4 presets','directions':['segmentation-aware contour light','fabric-preserving relighting','scan line clipped to garment mask','holographic tint with preserved texture','live global-score overlay inside photo'],'references':accepted,'errors':errors,'license':'reference research only; incorporation rights not evaluated'}
 args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'references':len(accepted),'errors':len(errors),'output':str(args.output)}))
if __name__=='__main__':main()
