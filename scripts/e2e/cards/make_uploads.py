# Gera "uploads" simulados: a peça (PNG com transparência) fotografada sobre fundos diferentes, com escala, posição,
# rotação, tamanho e compressão variados — o que muda de uma foto de celular para outra.
import random, sys, colorsys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
import os
R=os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')) + '/'
OUT=sys.argv[1]
os.makedirs(OUT, exist_ok=True)
random.seed(7)
def recolor(im, hue_to):
    a=np.array(im.convert('RGBA')).astype(np.float32)/255
    rgb=a[...,:3]; mx=rgb.max(-1); mn=rgb.min(-1); d=mx-mn
    h=np.zeros_like(mx); m=d>1e-6
    r,g,b=rgb[...,0],rgb[...,1],rgb[...,2]
    i=m&(mx==r); h[i]=((g-b)[i]/d[i])%6
    i=m&(mx==g); h[i]=((b-r)[i]/d[i])+2
    i=m&(mx==b); h[i]=((r-g)[i]/d[i])+4
    h=h/6
    blue=(h>0.52)&(h<0.72)&(d>0.25)   # só o azul do tecido (listras verdes, laranja e o selo ficam)
    s=np.where(mx>0,d/np.maximum(mx,1e-6),0)
    out=rgb.copy()
    hh=np.full_like(h,hue_to)
    # HSV -> RGB
    c=mx*s; x=c*(1-np.abs((hh*6)%2-1)); z=np.zeros_like(c)
    k=(hh*6).astype(int)%6
    rr=np.select([k==0,k==1,k==2,k==3,k==4,k==5],[c,x,z,z,x,c]); gg=np.select([k==0,k==1,k==2,k==3,k==4,k==5],[x,c,c,x,z,z]); bb=np.select([k==0,k==1,k==2,k==3,k==4,k==5],[z,z,x,c,c,x])
    mm=mx-c
    new=np.stack([rr+mm,gg+mm,bb+mm],-1)
    out[blue]=new[blue]
    a[...,:3]=out
    return Image.fromarray((a*255).clip(0,255).astype(np.uint8),'RGBA')
def print_text(im, lines, box, color=(244,239,230)):
    d=ImageDraw.Draw(im); x0,y0,x1,y1=box
    size=int((y1-y0)/len(lines)*0.8)
    try: f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',size)
    except Exception: f=ImageFont.load_default()
    y=y0
    for ln in lines:
        w=d.textlength(ln,font=f); d.text(((x0+x1)/2-w/2,y),ln,font=f,fill=color); y+=int((y1-y0)/len(lines))
    return im
BGS=[((226,221,211),'parede bege'),((196,198,201),'concreto cinza'),((240,240,236),'lençol branco'),((180,160,132),'madeira clara'),((214,226,235),'parede azul-clara'),((205,190,176),'tecido areia')]
def photo(garment, name, W, H, scale, dx, dy, rot, bg, q):
    col,_=bg
    base=Image.new('RGB',(W,H),col)
    arr=np.array(base).astype(np.int16)
    yy,xx=np.mgrid[0:H,0:W]
    grad=((xx/W-0.5)*14+(yy/H-0.5)*18).astype(np.int16)[...,None]   # luz de janela
    noise=np.random.default_rng(len(name)).normal(0,3.2,(H,W,1)).astype(np.int16)
    base=Image.fromarray(np.clip(arr+grad+noise,0,255).astype(np.uint8))
    g=garment.rotate(rot,expand=True,resample=Image.BICUBIC)
    k=scale*min(W/g.width,H/g.height); g=g.resize((int(g.width*k),int(g.height*k)),Image.LANCZOS)
    # sombra leve embaixo da peça (foto em cima da cama/mesa)
    sh=Image.new('RGBA',g.size,(0,0,0,0)); sh.putalpha(g.getchannel('A').point(lambda v:int(v*0.18))); sh=sh.filter(ImageFilter.GaussianBlur(8))
    x=int((W-g.width)/2+dx*W); y=int((H-g.height)/2+dy*H)
    base.paste(sh,(x+6,y+10),sh); base.paste(g,(x,y),g)
    base.save(f'{OUT}/{name}.jpg',quality=q)
tee_ref=Image.open(R+'public/assets_pecas/01_Parte_superior/01_camiseta_referencia.png').convert('RGBA')
red=recolor(tee_ref,0.985)
w,h=red.size
red=print_text(red,['THE','BEST','PLAN'],(int(w*0.36),int(h*0.52),int(w*0.64),int(h*0.78)))
red.save(f'{OUT}/_camiseta_vermelha_the_best_plan.png')
tees=[('camiseta_azul_selo',tee_ref),('camiseta_listrada_FAI',Image.open(R+'public/assets_pecas/06_Variacao_inicial/camiseta_letras_FAI.png').convert('RGBA')),
      ('camiseta_polo',Image.open(R+'public/assets_pecas/01_Parte_superior/06_polo_shirt_camisa_polo.png').convert('RGBA')),
      ('camiseta_vermelha_the_best_plan',red),('camiseta_verde',recolor(tee_ref,0.30))]
pants=[('calca_jeans',R+'01_jeans.png'),('calca_casual',R+'02_calca_casual.png'),('calca_alfaiataria',R+'03_calca_alfaiataria.png'),('calca_cargo',R+'04_calca_cargo.png'),('calca_jogger',R+'07_calca_jogger.png')]
sizes=[(1200,1600),(1080,1350),(1600,1200),(1000,1000),(1500,2000)]
for i,(n,g) in enumerate(tees):
    W,H=sizes[i]; photo(g,'tee_'+n,W,H,[0.55,0.82,0.66,0.74,0.48][i],[0.04,-0.05,0.0,0.06,-0.03][i],[0.03,0.02,-0.06,0.0,0.05][i],[2,-4,0,5,-2][i],BGS[i],[88,92,85,90,80][i])
for i,(n,f) in enumerate(pants):
    W,H=sizes[(i+2)%5]; photo(Image.open(f).convert('RGBA'),'pants_'+n,W,H,[0.60,0.86,0.52,0.72,0.66][i],[-0.03,0.02,0.05,-0.04,0.0][i],[0.02,0.0,-0.04,0.03,0.05][i],[-3,2,4,0,-5][i],BGS[(i+3)%6],[90,84,92,86,88][i])
print('ok')
