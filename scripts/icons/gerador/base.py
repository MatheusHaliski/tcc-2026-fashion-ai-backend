import cv2, numpy as np
from PIL import Image, ImageFilter
im=cv2.imread('logo.png')[:,:,::-1].astype(np.float32)
H,W=im.shape[:2]
CX,CY=767.2,495.5; RX,RY=444.5,436.0
MX,MY=767.0,501.0
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
rm=np.hypot(xx-MX,yy-MY); ang=(np.degrees(np.arctan2(yy-MY,xx-MX))+360)%360
sect=((ang>200)&(ang<245))|((ang>295)&(ang<340))
flat=np.median(im[sect&(rm>150)&(rm<185)],axis=0)
print('flat',flat)
# gentle top-left light gradient measured from clean region
clean=sect&(rm<195)&(rm>100)
A=np.c_[xx[clean]-MX,yy[clean]-MY,np.ones(clean.sum())]
coef=[np.linalg.lstsq(A,im[clean][:,c],rcond=None)[0] for c in range(3)]
g=np.clip(1.0-0.012*((xx-MX)+(yy-MY))/200,0.97,1.02)[...,None]
fill=np.clip(flat[None,None,:]*g,0,255)
w=np.clip((200-rm)/6,0,1)[...,None]
out=im*(1-w)+fill*w
# crop square around disc and make circular
x0,x1=CX-RX-6,CX+RX+6; y0,y1=CY-RY-6,CY+RY+6
crop=Image.fromarray(np.clip(out,0,255).astype(np.uint8)).crop((int(x0),int(y0),int(x1),int(y1)))
S=1024; D=1004  # disc diameter in output
pad=(S-D)/2
sx=D/(2*RX); sy=D/(2*RY)
cw,ch=crop.size
big=crop.resize((round(cw*sx),round(ch*sy)),Image.LANCZOS)
canvas=Image.new('RGB',(S,S),(255,255,255))
ox=round(S/2-(CX-int(x0))*sx); oy=round(S/2-(CY-int(y0))*sy)
canvas.paste(big,(ox,oy))
# alpha: supersampled circle
ss=4; a=Image.new('L',(S*ss,S*ss),0)
from PIL import ImageDraw
ImageDraw.Draw(a).ellipse([pad*ss,pad*ss,(S-pad)*ss,(S-pad)*ss],fill=255)
a=a.resize((S,S),Image.LANCZOS)
# erode 2px to avoid white fringe
a=a.filter(ImageFilter.MinFilter(3))
base=canvas.convert('RGBA'); base.putalpha(a)
base.save('base_full.png')
# medallion geometry in output
mcx=S/2+(MX-CX)*sx; mcy=S/2+(MY-CY)*sy; mr=212*(sx+sy)/2
print('medallion',mcx,mcy,mr)
open('geom.txt','w').write(f'{mcx} {mcy} {mr}')
