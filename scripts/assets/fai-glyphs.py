#!/usr/bin/env python3
"""
Gera a variante "glifo" dos ícones FAI para tamanhos pequenos (menu, barra inferior).

Os PNGs oficiais têm o glifo num disco creme dentro de um anel ornamentado; em 24 px o anel ocupa quase tudo e os
ícones ficam iguais entre si. Aqui recortamos só o disco central (o desenho do glifo é o mesmo) e exportamos
24 px e 48 px (tela retina). Uso: python3 scripts/assets/fai-glyphs.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

SRC = Path("public/icons/fai")
OUT = SRC / "glyph"
RADIUS = 112  # raio do disco creme no PNG de 512 px (medido no centro do ícone)

def glyph(path: Path, size: int) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    c = im.size[0] // 2
    crop = im.crop((c - RADIUS, c - RADIUS, c + RADIUS, c + RADIUS)).resize((size * 4, size * 4), Image.LANCZOS)
    mask = Image.new("L", crop.size, 0)
    ImageDraw.Draw(mask).ellipse((1, 1, crop.size[0] - 2, crop.size[1] - 2), fill=255)
    alpha = Image.composite(crop.getchannel("A"), Image.new("L", crop.size, 0), mask)
    crop.putalpha(alpha)
    return crop.resize((size, size), Image.LANCZOS)

# Variante "glyph-lg": o desenho ocupa ~84% do disco (no glifo comum ocupa de 55% a 90%, conforme o ícone), então
# cada ícone é recortado no raio do PRÓPRIO desenho — em fileiras (reações, ações) os glifos ficam grandes e do mesmo
# tamanho visual. O fundo continua sendo o disco creme (o recorte fica dentro dele e ganha máscara circular).
OUT_LG = SRC / "glyph-lg"
FILL = 0.84

def drawing_radius(im: Image.Image) -> float:
    """Raio (px no PNG de 512) que contém 99% dos pixels escuros do desenho, sem a borda do disco."""
    import math
    c = im.size[0] // 2
    px = im.load()
    hist = [0] * 101
    for y in range(c - 100, c + 100):
        for x in range(c - 100, c + 100):
            r, g, b, a = px[x, y]
            d = int(math.hypot(x - c, y - c))
            if d <= 100 and a > 128 and (r + g + b) / 3 < 110:
                hist[d] += 1
    total, acc = sum(hist), 0
    for i, h in enumerate(hist):
        acc += h
        if total and acc >= 0.99 * total:
            return i
    return RADIUS

def glyph_lg(path: Path, size: int) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    radius = max(64, min(RADIUS, round(drawing_radius(im) / FILL)))
    c = im.size[0] // 2
    crop = im.crop((c - radius, c - radius, c + radius, c + radius)).resize((size * 4, size * 4), Image.LANCZOS)
    mask = Image.new("L", crop.size, 0)
    ImageDraw.Draw(mask).ellipse((1, 1, crop.size[0] - 2, crop.size[1] - 2), fill=255)
    crop.putalpha(Image.composite(crop.getchannel("A"), Image.new("L", crop.size, 0), mask))
    return crop.resize((size, size), Image.LANCZOS)

def main():
    OUT.mkdir(exist_ok=True)
    OUT_LG.mkdir(exist_ok=True)
    n = 0
    for src in sorted(SRC.glob("*-normal-512.png")):
        slug = src.name.replace("-normal-512.png", "")
        for size in (24, 48):
            glyph(src, size).save(OUT / f"{slug}-{size}.png", optimize=True)
        for size in (32, 64):
            glyph_lg(src, size).save(OUT_LG / f"{slug}-{size}.png", optimize=True)
        n += 1
    print(f"{n} ícones → {OUT} e {OUT_LG}")

if __name__ == "__main__":
    main()
