"""Relatório do teste de cor do provador 3D (PROVADOR-3D §6), a partir dos quadros de capture-colors.mjs.
Mede a cor do peito (mediana de um recorte fixo do tecido, longe do selo e da gola) em CIELAB e calcula ΔE2000:
  - herança: 1ª vermelha × última vermelha na MESMA cena (depois de branca, preta e estampada) — deve ser ≈ 0;
  - ambiente: loja da marca × loja neutra, mesma cor e mesma luz — quanto a cor de destaque da loja tinge a peça;
  - foto: peça renderizada × cor do tecido na foto (inclui a luz; serve para ver o matiz e a ordem branco > vermelho > preto).
Uso: python3 -I scripts/tryon/color-report.py <pasta dos quadros> <public/lab/cores/cores.json> <saida.md> [x0,y0,x1,y1]"""
import json, math, sys
from PIL import Image

DIR, REF, OUT = sys.argv[1:4]
BOX = tuple(int(v) for v in (sys.argv[4] if len(sys.argv) > 4 else '488,215,540,290').split(','))
SEQ = ['vermelha', 'branca', 'preta', 'estampada', 'vermelha']

def lab(rgb):
    def lin(c): c /= 255; return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(c) for c in rgb)
    x, y, z = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    return 116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))

def de2000(a, b):
    L1, a1, b1 = a; L2, a2, b2 = b
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2); Cm = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)))
    a1p, a2p = a1 * (1 + G), a2 * (1 + G); C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p, h2p = math.degrees(math.atan2(b1, a1p)) % 360, math.degrees(math.atan2(b2, a2p)) % 360
    dL, dC = L2 - L1, C2p - C1p
    dh = 0 if C1p * C2p == 0 else (h2p - h1p if abs(h2p - h1p) <= 180 else h2p - h1p - 360 if h2p > h1p else h2p - h1p + 360)
    dH = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dh / 2))
    Lm, Cmp = (L1 + L2) / 2, (C1p + C2p) / 2
    hm = h1p + h2p if C1p * C2p == 0 else ((h1p + h2p) / 2 if abs(h1p - h2p) <= 180 else (h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2)
    T = 1 - 0.17 * math.cos(math.radians(hm - 30)) + 0.24 * math.cos(math.radians(2 * hm)) + 0.32 * math.cos(math.radians(3 * hm + 6)) - 0.20 * math.cos(math.radians(4 * hm - 63))
    SL = 1 + 0.015 * (Lm - 50) ** 2 / math.sqrt(20 + (Lm - 50) ** 2); SC = 1 + 0.045 * Cmp; SH = 1 + 0.015 * Cmp * T
    RT = -2 * math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7)) * math.sin(math.radians(60 * math.exp(-((hm - 275) / 25) ** 2)))
    return math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH))

def chest(path):
    im = Image.open(path).convert('RGB').crop(BOX); px = list(im.getdata())
    return tuple(sorted(c[i] for c in px)[len(px) // 2] for i in range(3))

ref = json.load(open(REF))['tecido']
rows, lines = {}, []
for store in ('fitting-neutral', 'fitting-brand'):
    for light in ('daylight', 'store', 'night'):
        for i, c in enumerate(SEQ):
            rgb = chest(f'{DIR}/{store}-{light}-{i}-{c}.png'); rows[(store, light, i)] = rgb
f = lambda t: '#%02x%02x%02x' % t
lines.append('| loja | luz | ' + ' | '.join(f'{i + 1}. {c}' for i, c in enumerate(SEQ)) + ' | ΔE herança (1ª × 5ª vermelha) |')
lines.append('|---|---|' + '---|' * len(SEQ) + '---|')
worst_inherit = 0
for store in ('fitting-neutral', 'fitting-brand'):
    for light in ('daylight', 'store', 'night'):
        d = de2000(lab(rows[(store, light, 0)]), lab(rows[(store, light, 4)])); worst_inherit = max(worst_inherit, d)
        lines.append(f'| {store} | {light} | ' + ' | '.join(f'`{f(rows[(store, light, i)])}`' for i in range(len(SEQ))) + f' | {d:.2f} |')
lines.append('')
lines.append('| cor | luz | ΔE ambiente (marca × neutra) | C* do branco na loja da marca | ΔE foto × render (neutra) |')
lines.append('|---|---|---|---|---|')
worst_env = 0
for i, c in enumerate(SEQ[:4]):
    for light in ('daylight', 'store', 'night'):
        a, b = lab(rows[('fitting-neutral', light, i)]), lab(rows[('fitting-brand', light, i)]); d = de2000(a, b); worst_env = max(worst_env, d)
        chroma = f'{math.hypot(b[1], b[2]):.1f}' if c == 'branca' else '—'
        lines.append(f'| {c} | {light} | {d:.2f} | {chroma} | {de2000(lab(tuple(ref[c])), a):.1f} |')
head = [f'# Teste de cor do provador 3D — {DIR.rstrip("/").split("/")[-1]}', '',
        f'Recorte do peito: caixa {BOX} (px) no quadro de 1100×680, mediana por canal. ΔE = CIEDE2000.', '',
        f'**Herança entre peças (pior caso): ΔE {worst_inherit:.2f}** · **tingimento pelo ambiente (pior caso): ΔE {worst_env:.2f}**', '']
open(OUT, 'w', encoding='utf-8').write('\n'.join(head + lines) + '\n')
print('\n'.join(head))
