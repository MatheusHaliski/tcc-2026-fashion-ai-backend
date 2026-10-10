"""Fixtures do teste de cor do provador (PROVADOR-3D §6): a camiseta de referência do acervo recolorida.
Só o tecido azul muda (vermelho, branco, preto, estampa listrada); gola/punhos laranja e o selo FAI ficam iguais, e o
sombreamento da foto é preservado (luminância relativa). Saída: public/lab/cores/camiseta-<cor>.webp + cores.json
com a cor de referência do tecido (mediana dos pixels recoloridos) para o cálculo de ΔE.
Uso: python3 -I scripts/tryon/make-color-fixtures.py"""
import colorsys, json
from PIL import Image

SRC = 'public/_derived/pecas_thumb/01_parte_superior_01_camiseta_referencia-640.webp'
OUT = 'public/lab/cores'
im = Image.open(SRC).convert('RGBA'); W, H = im.size; px = im.load()

def is_fabric(r, g, b, a):
    if a < 200: return False
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return 0.52 < h < 0.66 and s > 0.35 and v > 0.15

mask = [[is_fabric(*px[x, y]) for x in range(W)] for y in range(H)]
vals = sorted(colorsys.rgb_to_hsv(*(c / 255 for c in px[x, y][:3]))[2] for y in range(H) for x in range(W) if mask[y][x])
vref = vals[len(vals) // 2]

TARGETS = {'vermelha': (196, 30, 42), 'branca': (238, 238, 234), 'preta': (28, 28, 30)}
ref = {}
for name, rgb in list(TARGETS.items()) + [('estampada', None)]:
    out = im.copy(); o = out.load(); got = []
    for y in range(H):
        for x in range(W):
            if not mask[y][x]: continue
            r, g, b, a = px[x, y]; k = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[2] / vref   # sombreamento relativo
            base = rgb if rgb else ((238, 238, 234) if ((x + y) // 22) % 2 else (24, 40, 120))     # listras diagonais
            c = tuple(max(0, min(255, round(v * min(k, 1.25)))) for v in base)
            o[x, y] = (*c, a); got.append(c)
    out.save(f'{OUT}/camiseta-{name}.webp', quality=92)
    got.sort(key=lambda c: sum(c)); ref[name] = list(got[len(got) // 2]) if rgb else [round(sum(c[i] for c in got) / len(got)) for i in range(3)]
json.dump({'fonte': SRC, 'tecido': ref}, open(f'{OUT}/cores.json', 'w'), ensure_ascii=False, indent=1)
print(ref)
