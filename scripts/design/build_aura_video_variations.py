#!/usr/bin/env python3
"""Create 40 distinct silent MP4 recipes per COMMON/ELECTRO/SPLASH (120 total).
Uses original project textures plus procedural light/ink motifs, not third-party videos.
Each variation changes composition, palette and periodic motion. Not 120 AI-generated scenes.
"""
import hashlib,json,math,random,subprocess
from pathlib import Path
from PIL import Image,ImageDraw,ImageEnhance,ImageFilter,ImageOps
ROOT=Path(__file__).resolve().parents[2];FOLDER=ROOT/'public/aura/fashion-curated'
PALETTES=[('ivory','Marfim couture','#d0b08f','#f1e9dc'),('chrome','Cromo editorial','#a9aecb','#edf1ef'),('rose','Rosé têxtil','#be859e','#f2d5cc'),('violet','Violeta prismático','#8b6eb5','#d3c9ed'),('mint','Mint holográfico','#6aada5','#d6e8dd')]
MOTIFS={'COMMON':['Cetim','Cromo líquido','Organza','Malha','Plissado','Vidro','Seda','Trama'], 'ELECTRO':['Fibras','Órbitas','Circuitos','Arcos','Pulso','Traços','Rede','Horizonte'], 'SPLASH':['Tinta','Pigmento','Névoa','Aquarela','Vórtice','Gotas','Mármore','Ondas']}
def compose(source,family,motif,palette,seed):
 rng=random.Random(seed);image=Image.open(source).convert('RGB').resize((432,648));gray=ImageOps.grayscale(image)
 tinted=ImageOps.colorize(gray,palette[2],palette[3]);image=Image.blend(image,tinted,.42)
 layer=Image.new('RGBA',image.size);draw=ImageDraw.Draw(layer)
 if family=='ELECTRO':
  for n in range(18):
   side=-35 if n%2==0 else 467;cy=rng.randrange(20,628);radius=70+motif*11+n*3
   if motif%3==0:draw.arc((side-radius,cy-radius,side+radius,cy+radius),10,320,fill=palette[3]+'99',width=1+n%2)
   elif motif%3==1:draw.line([(side,cy),(45 if side<0 else 387,cy+30),(80 if side<0 else 352,cy+70)],fill=palette[3]+'88',width=1)
   else:draw.line([(side,cy),(rng.randrange(5,100) if side<0 else rng.randrange(332,427),cy+90)],fill=palette[3]+'aa',width=1)
 elif family=='SPLASH':
  for n in range(26):
   x=rng.randrange(-80,85) if n%2==0 else rng.randrange(350,510);y=rng.randrange(-30,680);r=rng.randrange(8,60)+motif*3
   draw.ellipse((x-r,y-r,x+r,y+r),fill=palette[2]+'36')
  layer=layer.filter(ImageFilter.GaussianBlur(3+motif%3))
 else:
  for n in range(9):
   y=20+n*70;draw.arc((-120-motif*5,y-90,150,y+160),240,50,fill=palette[3]+'55',width=1+n%2)
 image=Image.alpha_composite(image.convert('RGBA'),layer).convert('RGB');return image

def main():
 catalog=json.loads((FOLDER/'catalog.json').read_text());entries={p['id']:p for p in catalog['presets']};outputs=[]
 for family in MOTIFS:
  bases=[p for p in catalog['presets'] if p['family']==family and p.get('license')=='ORIGINAL']
  if not bases:raise SystemExit('Missing original bases '+family)
  for i,motif in enumerate(MOTIFS[family]):
   for j,palette in enumerate(PALETTES):
    id=f'{family.lower()}-{i+1:02d}-{palette[0]}';poster=FOLDER/f'{id}.webp';video=FOLDER/f'{id}.mp4'
    image=compose(FOLDER/f"{bases[i%len(bases)]['id']}.webp",family,i,palette,i*31+j)
    image.save(poster,quality=86)
    phase=i*math.pi/8;amplitude=.01+j*.003
    if not video.exists():
     z=f'1.025+{amplitude}*cos(2*PI*on/144+{phase})';x=f'iw/2-iw/zoom/2+{i%3}*sin(2*PI*on/144)';y=f'ih/2-ih/zoom/2+{j%3}*cos(2*PI*on/144)'
     temp=video.with_suffix('.tmp.mp4')
     subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-loop','1','-i',str(poster),'-vf',f"zoompan=z='{z}':x='{x}':y='{y}':d=144:s=432x648:fps=24",'-t','6','-an','-c:v','libx264','-preset','veryfast','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart',str(temp)],check=True,timeout=60);temp.replace(video)
    entries[id]=dict(id=id,name=f'{motif} · {palette[1]}',family=family,image=f'/aura/fashion-curated/{id}.webp',video=f'/aura/fashion-curated/{id}.mp4',palette=[palette[2],palette[3]],source='Composição original + motivo procedural FashionAI',license='ORIGINAL',durationSeconds=6)
    outputs.append(dict(id=id,family=family,sha256=hashlib.sha256(video.read_bytes()).hexdigest()))
   print(f'{family}: {(i+1)*5}/40',flush=True)
 if len({x['sha256'] for x in outputs})!=120:raise SystemExit('Duplicate videos detected')
 catalog['presets']=list(entries.values());catalog['version']+=1;temp=FOLDER/'catalog.json.tmp';temp.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n');temp.replace(FOLDER/'catalog.json')
 target=ROOT/'docs/design/aura-video-generation-report.json';target.write_text(json.dumps({'generated':120,'perFamily':40,'durationSeconds':6,'resolution':'432x648','fps':24,'videos':outputs},indent=2)+'\n');print('120 distinct MP4s published to local manifest',flush=True)
if __name__=='__main__':main()
