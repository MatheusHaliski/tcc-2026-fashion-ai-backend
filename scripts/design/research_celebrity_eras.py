#!/usr/bin/env python3
"""Research editorial references. Save source metadata, never copy unlicensed photos/GIFs."""
import argparse,concurrent.futures,json,time,unicodedata,urllib.request,urllib.parse,xml.etree.ElementTree as ET
from pathlib import Path
ARTISTS=[('Taylor Swift','Lover Midnights','US'),('Beyoncé','Renaissance Cowboy Carter','US'),('Lady Gaga','Chromatica Born This Way','US'),('Anitta','Funk Generation','BR'),('Rosalía','Motomami','ES'),('The Weeknd','After Hours Dawn FM','CA'),('Dua Lipa','Future Nostalgia Radical Optimism','UK'),('BTS','Map of the Soul','KR'),('BLACKPINK','Born Pink','KR'),('Shakira','Las Mujeres Ya No Lloran','CO'),('Bad Bunny','Debí Tirar Más Fotos','PR'),('Ludmilla','Numanice','BR'),('Ivete Sangalo','turnê','BR')]
def lookup(row):
 name,era,country=row;q=f'{name} {era} official album visual identity tour editorial stage art'
 url='https://www.bing.com/search?format=rss&q='+urllib.parse.quote(q)
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'FashionAI-Editorial-Research/1.0'})
  with urllib.request.urlopen(req,timeout=12) as r:root=ET.fromstring(r.read(1_000_000))
  refs=[]
  for it in root.findall('./channel/item')[:5]:
   link=it.findtext('link','');title=it.findtext('title','')
   normalized=unicodedata.normalize('NFKD',title+' '+it.findtext('description','')).encode('ascii','ignore').decode().lower()
   artist_tokens=unicodedata.normalize('NFKD',name).encode('ascii','ignore').decode().lower().split()
   if link.startswith('https://') and all(token in normalized for token in artist_tokens):refs.append({'title':title,'url':link,'license':'UNVERIFIED','use':'REFERENCE_ONLY'})
  return {'artist':name,'eras':era,'country':country,'references':refs,'error':None}
 except Exception as e:return {'artist':name,'eras':era,'country':country,'references':[],'error':type(e).__name__}
def main():
 p=argparse.ArgumentParser();p.add_argument('--output',default='docs/design/era-research.json');a=p.parse_args();started=time.monotonic()
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:results=list(pool.map(lookup,ARTISTS))
 report={'scope':'Editorial research only; no endorsement or asset reuse rights implied','artists':results,'seconds':round(time.monotonic()-started,2),'sources':sum(len(r['references']) for r in results),'errors':sum(bool(r['error']) for r in results)}
 out=Path(a.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['sources','errors','seconds']}))
if __name__=='__main__':main()
