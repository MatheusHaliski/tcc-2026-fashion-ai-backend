#!/usr/bin/env python3
"""Fetch actual image/GIF compositions discovered by image search; inspect media and build a visual reference gallery.
Original downloads stay in --cache. Exported thumbnails and metadata are reference material, not product assets.
"""
import argparse, concurrent.futures, hashlib, html, io, json, urllib.request
from pathlib import Path
from PIL import Image, ImageOps

def families(item):
 text=(item['title']+' '+item['image_url']).lower()
 if item['group'].startswith('score'):return ['Hype score','FLAIR cartas']
 if any(x in text for x in ['ink','water-background']):return ['Splash']
 if any(x in text for x in ['neon','streak','particle','lighting','red-loop']):return ['Electro','Hype score']
 if any(x in text for x in ['silk','satin','fabric']):return ['AURA comum','ATELIER']
 if any(x in text for x in ['ribbon','podium']):return ['ATELIER','AURA comum']
 return ['Metamorfose','AURA comum']

def collect(item,cache,output):
 record={**item,'families':families(item)}
 if 'armadaboost.com' in item['source_url']:return {**record,'status':'EXCLUDED_BOOST_SERVICE'}
 key=hashlib.sha256(item['image_url'].encode()).hexdigest()[:16]
 try:
  req=urllib.request.Request(item['image_url'],headers={'User-Agent':'FashionAI-VisualReferenceResearch/1.0','Accept':'image/*'})
  with urllib.request.urlopen(req,timeout=18) as response:
   body=response.read(12_000_001)
   if len(body)>12_000_000:return {**record,'status':'TOO_LARGE'}
   record['http_status']=response.status
  image=Image.open(io.BytesIO(body))
  record.update(status='VERIFIED_MEDIA',format=image.format,width=image.width,height=image.height,frames=getattr(image,'n_frames',1),bytes=len(body))
  extension={ 'GIF':'gif','JPEG':'jpg','PNG':'png','WEBP':'webp' }.get(image.format,'img')
  (cache/(key+'.'+extension)).write_bytes(body)
  image.seek(0);preview=ImageOps.contain(image.convert('RGB'),(600,600));preview.save(output/'thumbnails'/(key+'.jpg'),quality=87)
  record['thumbnail']='thumbnails/'+key+'.jpg'
 except Exception as error:
  record['status']=type(error).__name__
  if getattr(error,'code',None):record['http_status']=error.code
 return record

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--sources',type=Path,default=Path('docs/design/referencias-aura/compositions-sources.json'));parser.add_argument('--output',type=Path,default=Path('docs/design/composicoes-aura'));parser.add_argument('--cache',type=Path,default=Path('work/aura-compositions'));args=parser.parse_args()
 args.cache.mkdir(parents=True,exist_ok=True);(args.output/'thumbnails').mkdir(parents=True,exist_ok=True)
 unique={r['image_url']:r for r in json.loads(args.sources.read_text())}
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:records=list(pool.map(lambda r:collect(r,args.cache,args.output),unique.values()))
 (args.output/'media.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
 sections=[]
 for theme in ['Metamorfose','ATELIER','Hype score','Electro','AURA comum','Splash','FLAIR cartas']:
  cards=[]
  for record in records:
   if theme not in record['families'] or record['status']!='VERIFIED_MEDIA':continue
   gif=record['format']=='GIF' and record['frames']>1
   media=f'<img src="{record["thumbnail"]}" alt="{html.escape(record["title"],quote=True)}" loading="lazy">'
   if gif:media=f'<figure data-animation="{html.escape(record["image_url"],quote=True)}" data-poster="{record["thumbnail"]}">{media}<button type="button" aria-pressed="false">Reproduzir GIF</button></figure>'
   cards.append(f'<article>{media}<p class="tag">{record["format"]} · {record["width"]}×{record["height"]}'+(f' · {record["frames"]} quadros' if gif else '')+f'</p><h3>{html.escape(record["title"])}</h3><a href="{html.escape(record["source_url"],quote=True)}" target="_blank" rel="noopener noreferrer">Abrir fonte</a> · <a href="{html.escape(record["image_url"],quote=True)}" target="_blank" rel="noopener noreferrer">Abrir mídia</a></article>')
  sections.append(f'<section><h2>{theme}</h2><div class="grid">'+''.join(cards)+'</div></section>')
 markup='''<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>FashionAI · composições visuais e GIFs</title><style>body{margin:0;background:#121018;color:#f3eff6;font:15px/1.5 system-ui}main{max-width:1400px;margin:auto;padding:32px}h1{font-size:clamp(32px,5vw,60px);line-height:1.1}h2{margin-top:48px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}article{background:#211c2b;border:1px solid #40334e;border-radius:18px;padding:16px}img{width:100%;height:240px;object-fit:contain;background:#09070d;border-radius:10px}h3{font-size:15px}a{color:#e1c5ff}.tag{font-size:12px;color:#c7b4d4}figure{margin:0}button{border:1px solid #c8a3e5;background:#382546;color:white;border-radius:20px;padding:7px 12px;cursor:pointer}</style><main><p>FASHIONAI / REFERÊNCIAS DE COMPOSIÇÃO</p><h1>Imagem, matéria e movimento.</h1><p>Imagens e GIFs encontrados por busca visual e verificados por Python. Animações começam pausadas. Referências externas; licenças para incorporação no app ainda não verificadas. Miniaturas de vídeos continuam identificadas como imagens, não como GIFs.</p>'''+''.join(sections)+'''</main><script>document.querySelectorAll('figure button').forEach(button=>button.addEventListener('click',()=>{const figure=button.closest('figure'),play=button.getAttribute('aria-pressed')!=='true';figure.querySelector('img').src=play?figure.dataset.animation:figure.dataset.poster;button.setAttribute('aria-pressed',String(play));button.textContent=play?'Pausar GIF':'Reproduzir GIF';}));</script></html>'''
 (args.output/'index.html').write_text(markup)
 summary={'candidates':len(records),'verified':sum(r['status']=='VERIFIED_MEDIA' for r in records),'animated_gifs':sum(r.get('format')=='GIF' and r.get('frames',1)>1 for r in records),'failed':[{'title':r['title'],'status':r['status']} for r in records if r['status']!='VERIFIED_MEDIA']}
 (args.output/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary,ensure_ascii=False))
if __name__=='__main__':main()
