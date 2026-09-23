import os, sys
from PIL import Image, ImageEnhance, ImageDraw, ImageFont
from objects import OBJ, HAS_ACTIVE, LABEL

BASES = {
    'full': (Image.open('base_full.png').convert('RGBA'), (511.77, 518.33, 241.76)),
    'half': (Image.open('base_half.png').convert('RGBA'), (511.77, 518.33, 241.76)),
    'plain': (Image.open('base_plain.png').convert('RGBA'), (512, 512, 502 * 0.64)),
}
# mesh saturation boost for the active state ("nós mais saturados")
SAT = {}
for k, (b, g) in BASES.items():
    rgb = ImageEnhance.Color(b.convert('RGB')).enhance(1.3).convert('RGBA')
    rgb.putalpha(b.getchannel('A'))
    SAT[k] = rgb


def compose(oid, st, base):
    b, (cx, cy, r) = BASES[base]
    canvas = (SAT[base] if st == 'ativo' else b).copy()
    lay = Image.open(f'layers/{oid}-{st}.png').convert('RGBA')
    size = round(2 * r)
    lay = lay.resize((size, size), Image.LANCZOS)
    canvas.alpha_composite(lay, (round(cx - r), round(cy - r)))
    return canvas


SIZES = [(512, 'full'), (96, 'full'), (48, 'half'), (24, 'plain')]


def export(out='out/public/icons/fai'):
    os.makedirs(out, exist_ok=True)
    n = 0
    for oid in OBJ:
        for st in ['normal'] + (['ativo'] if HAS_ACTIVE[oid] else []):
            cache = {}
            for size, base in SIZES:
                if base not in cache:
                    cache[base] = compose(oid, st, base)
                cache[base].resize((size, size), Image.LANCZOS).save(f'{out}/{oid}-{st}-{size}.png', optimize=True)
                n += 1
    return n


def sheet(path='sheet.png', ids=None, cell=200, cols=8, state='normal'):
    ids = ids or list(OBJ)
    rows = (len(ids) + cols - 1) // cols
    img = Image.new('RGB', (cols * cell, rows * (cell + 30)), 'white')
    d = ImageDraw.Draw(img)
    try:
        f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
    except Exception:
        f = None
    for i, oid in enumerate(ids):
        st = state if (state == 'normal' or HAS_ACTIVE[oid]) else 'normal'
        im = compose(oid, st, 'full').resize((cell - 10, cell - 10), Image.LANCZOS)
        x, y = (i % cols) * cell, (i // cols) * (cell + 30)
        img.paste(im, (x + 5, y + 5), im)
        d.text((x + 8, y + cell - 2), f'{oid} {LABEL[oid]}'[:26], fill='black', font=f)
    img.save(path)


if __name__ == '__main__':
    if sys.argv[1:] == ['export']:
        print(export())
    else:
        sheet('sheet_soc.png', [k for k in OBJ if k.startswith('soc') or k.startswith('nav')])
        sheet('sheet_act.png', [k for k in OBJ if k.startswith('act')])
