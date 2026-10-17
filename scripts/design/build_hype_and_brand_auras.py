#!/usr/bin/env python3
"""Publish 20 AURA Hype presets (4 palettes x 5 hype categories) and 20 brand+color AURA Metamorfose presets.
Everything is procedural and original: Hype motifs are generated per hype mode; brand presets float a typographic
wordmark (no trademarked artwork is downloaded) over a color-matched field. Output: silent looping MP4 + WebP poster
in public/aura/fashion-curated plus catalog.json entries (families HYPE and METAMORPHOSE).
Requires: Pillow, numpy, imageio-ffmpeg (or ffmpeg on PATH).
"""
import json,math,shutil,subprocess
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFilter,ImageFont
ROOT=Path(__file__).resolve().parents[2];FOLDER=ROOT/'public/aura/fashion-curated'
W,H,FPS,SECONDS=432,648,12,6;FRAMES=FPS*SECONDS
HYPE_MODES=[('scanner','Scanner'),('xray','Raio-X'),('dots','Pontos'),('stars','Estrelas'),('metrics','Métricas')]
HYPE_PALETTES=[('ciano','Ciano','#65eddf','#1b4b66'),('violeta','Violeta','#b69bff','#2a1b5c'),('ouro','Ouro','#f5d38b','#5a3b12'),('verde','Verde','#91e6b8','#0f4a33')]
BRANDS=[('nike','Nike',[('preto','Preto','#f5f5f5','#0b0b0b'),('laranja','Laranja','#ffffff','#f4511e'),('branco','Branco','#111111','#f2f2f2'),('volt','Volt','#111111','#d7ff1f')]),
 ('adidas','Adidas',[('preto','Preto','#ffffff','#0d0d0d'),('branco','Branco','#111111','#f4f4f4'),('azul','Azul','#ffffff','#1e4fd8'),('vermelho','Vermelho','#ffffff','#d62828')]),
 ('asics','Asics',[('azul','Azul','#ffffff','#14327a'),('preto','Preto','#ffffff','#0e0e0e'),('verde','Verde','#ffffff','#0f7a4a')]),
 ('puma','Puma',[('preto','Preto','#ffffff','#0b0b0b'),('vermelho','Vermelho','#ffffff','#e4002b'),('branco','Branco','#111111','#f3f3f3')]),
 ('zara','Zara',[('preto','Preto','#ffffff','#101010'),('branco','Branco','#101010','#f6f3ee'),('bege','Bege','#101010','#d8c3a5')]),
 ('new-balance','New Balance',[('cinza','Cinza','#ffffff','#7c7f86'),('azul','Azul','#ffffff','#1d2f6f'),('branco','Branco','#1d2f6f','#f4f4f4')])]
def rgb(h):return tuple(int(h[i:i+2],16) for i in (1,3,5))
def font(size):
 for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf','/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'):
  if Path(p).exists():return ImageFont.truetype(p,size)
 return ImageFont.load_default()
def gradient(top,bottom):
 t=np.linspace(0,1,H)[:,None,None];a=np.array(rgb(top),float);b=np.array(rgb(bottom),float)
 return np.broadcast_to((a*(1-t)+b*t),(H,W,3)).astype(np.uint8)
def hype_frame(mode,accent,base,f):
 phase=f/FRAMES;image=Image.fromarray(gradient(base,'#050508')).convert('RGBA');layer=Image.new('RGBA',(W,H));d=ImageDraw.Draw(layer);c=rgb(accent)
 if mode=='scanner':
  y=int((0.5+0.5*math.sin(2*math.pi*phase))*(H-40))+20
  for k in range(30):d.rectangle((0,y-k*2,W,y-k*2+1),fill=c+(max(0,200-k*7),))
  for x in range(0,W,36):d.line((x,0,x,H),fill=c+(26,))
 elif mode=='xray':
  for k in range(6):
   r=((phase+k/6)%1)*430;d.ellipse((W/2-r,H/2-r*1.3,W/2+r,H/2+r*1.3),outline=c+(int(220*(1-r/430)),),width=3)
 elif mode=='dots':
  for gx in range(10):
   for gy in range(15):
    s=0.5+0.5*math.sin(2*math.pi*(phase-(gx+gy)/25));r=2+6*s;x=24+gx*42;y=24+gy*43;d.ellipse((x-r,y-r,x+r,y+r),fill=c+(int(60+170*s),))
 elif mode=='stars':
  for k in range(45):
   x=(k*137)%W;y=(k*263)%H;s=0.5+0.5*math.sin(2*math.pi*(phase*(1+k%2)+k/45));r=2+9*s
   d.line((x-r,y,x+r,y),fill=c+(int(80+170*s),),width=2);d.line((x,y-r,x,y+r),fill=c+(int(80+170*s),),width=2)
 else:
  for k in range(12):
   h=60+int(300*(0.5+0.5*math.sin(2*math.pi*(phase+k/12))));x=24+k*33;d.rectangle((x,H-30-h,x+20,H-30),fill=c+(170,))
 return np.asarray(Image.alpha_composite(image,layer.filter(ImageFilter.GaussianBlur(.6))).convert('RGB'))
def brand_frame(name,ink,paper,f):
 phase=f/FRAMES;base=Image.fromarray(gradient(paper,tuple_hex(shade(rgb(paper),.62)))).convert('RGBA');d=ImageDraw.Draw(base)
 for k in range(3):
  r=140+k*70+int(14*math.sin(2*math.pi*(phase+k/3)));d.ellipse((W/2-r,H/2-r,W/2+r,H/2+r),outline=rgb(ink)+(36,),width=2)
 size=64 if len(name)<8 else 46;ft=font(size);box=d.textbbox((0,0),name,font=ft);tw,th=box[2]-box[0],box[3]-box[1]
 bob=10*math.sin(2*math.pi*phase);sway=6*math.sin(4*math.pi*phase)
 shadow=Image.new('RGBA',(W,H));sd=ImageDraw.Draw(shadow);sd.text(((W-tw)/2+sway+4,(H-th)/2+bob+14),name,font=ft,fill=(0,0,0,90));shadow=shadow.filter(ImageFilter.GaussianBlur(6))
 base=Image.alpha_composite(base,shadow);ImageDraw.Draw(base).text(((W-tw)/2+sway,(H-th)/2+bob),name,font=ft,fill=rgb(ink)+(255,))
 return np.asarray(base.convert('RGB'))
def shade(c,k):return tuple(int(v*k) for v in c)
def tuple_hex(c):return '#%02x%02x%02x'%c
def ffmpeg_exe():
 try:
  import imageio_ffmpeg;return imageio_ffmpeg.get_ffmpeg_exe()
 except ImportError:return shutil.which('ffmpeg') or 'ffmpeg'
def publish(id,render):
 video=FOLDER/f'{id}.mp4';temp=video.with_suffix('.tmp.mp4')
 proc=subprocess.Popen([ffmpeg_exe(),'-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','veryfast','-crf','27','-pix_fmt','yuv420p','-movflags','+faststart',str(temp)],stdin=subprocess.PIPE)
 for f in range(FRAMES):
  frame=render(f)
  if f==FRAMES//4:Image.fromarray(frame).save(FOLDER/f'{id}.webp',quality=86)
  proc.stdin.write(frame.tobytes())
 proc.stdin.close()
 if proc.wait():raise SystemExit('ffmpeg failed for '+id)
 temp.replace(video)
def entry(id,name,family,palette,source):
 return dict(id=id,name=name,family=family,palette=palette,image=f'/aura/fashion-curated/{id}.webp',video=f'/aura/fashion-curated/{id}.mp4',source=source,license='ORIGINAL',durationSeconds=SECONDS)
def main():
 catalog=json.loads((FOLDER/'catalog.json').read_text());entries={p['id']:p for p in catalog['presets']}
 for mode,label in HYPE_MODES:
  for slug,pname,accent,base in HYPE_PALETTES:
   id=f'hype-{mode}-{slug}';publish(id,lambda f,m=mode,a=accent,b=base:hype_frame(m,a,b,f))
   entries[id]=entry(id,f'{label} · {pname}','HYPE',[accent,base],'Composição procedural FashionAI por categoria de Hype')
 for bslug,bname,colors in BRANDS:
  for cslug,cname,ink,paper in colors:
   id=f'brand-{bslug}-{cslug}';publish(id,lambda f,n=bname,i=ink,p=paper:brand_frame(n,i,p,f))
   entries[id]=entry(id,f'{bname} · {cname}','METAMORPHOSE',[paper,ink],'Logotipo tipográfico flutuante FashionAI (sem arte de marca registrada)')
 catalog['presets']=list(entries.values());catalog['version']+=1
 tmp=FOLDER/'catalog.json.tmp';tmp.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n');tmp.replace(FOLDER/'catalog.json')
if __name__=='__main__':main()
