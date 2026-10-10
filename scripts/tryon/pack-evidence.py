"""Empacota as evidências do provador 3D (PROVADOR-3D): em cada pasta de caso, junta os quadros da caminhada e do giro
de 360° em GIFs animados e converte os PNG restantes em WebP (o repositório não precisa de PNG de 1 MB por quadro).
Os quadros soltos da caminhada saem depois de virar GIF. Uso: python3 -I scripts/tryon/pack-evidence.py <pasta> [...]"""
import glob, os, sys
from PIL import Image

def gif(frames, out, ms, scale=0.5):
    if not frames: return
    ims = [Image.open(f).convert('RGB') for f in frames]
    w, h = ims[0].size; ims = [im.resize((int(w * scale), int(h * scale)), Image.LANCZOS) for im in ims]
    pal = [im.quantize(colors=128, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG) for im in ims]
    pal[0].save(out, save_all=True, append_images=pal[1:], duration=ms, loop=0, optimize=True)

for root in sys.argv[1:]:
    for d in sorted({os.path.dirname(p) for p in glob.glob(os.path.join(root, '**', '*.png'), recursive=True)}):
        walk = sorted(glob.glob(os.path.join(d, 'caminhada-*.png')))
        gif(walk, os.path.join(d, 'caminhada.gif'), 90)
        gif(sorted(glob.glob(os.path.join(d, 'giro-*.png'))), os.path.join(d, 'giro-360.gif'), 450)
        for f in walk: os.remove(f)
        for f in glob.glob(os.path.join(d, '*.png')):
            Image.open(f).convert('RGB').save(f[:-4] + '.webp', quality=82, method=6); os.remove(f)
        print(d, 'ok')
