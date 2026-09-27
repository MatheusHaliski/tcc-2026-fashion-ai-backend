# Simula a foto das capturas: pessoa vestindo camiseta vermelha com a estampa "THE BEST PLAN" (a foto original não
# veio anexada). Parte da foto de teste do MediaPipe (pessoa de corpo inteiro, blusa preta, jeans) e recolore a blusa.
import numpy as np, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB'); W, H = im.size
a = np.asarray(im).astype(np.float32)
lum = a.mean(-1); sat = a.max(-1) - a.min(-1)
yy, xx = np.mgrid[0:H, 0:W]
top = (lum < 58) & (sat < 38) & (yy > H * 0.215) & (yy < H * 0.485)
m = Image.fromarray((top * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(5))
top = np.asarray(m) > 127
shade = np.clip(lum / 58.0, 0, 1)[..., None]            # dobras e sombras da malha continuam
red = np.array([200, 22, 46], np.float32)
b = a.copy(); b[top] = (red * (0.55 + 0.6 * shade))[top]
img = Image.fromarray(np.clip(b, 0, 255).astype(np.uint8))
d = ImageDraw.Draw(img)
f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', int(W * 0.032))
cx, y0 = int(W * 0.515), int(H * 0.30)
for i, t in enumerate(['THE', 'BEST', 'PLAN']):
    w = d.textlength(t, font=f); d.text((cx - w / 2, y0 + i * int(W * 0.038)), t, font=f, fill=(244, 239, 230))
img.save(out, quality=92)
print(W, H, int(top.sum()))
