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

def main():
    OUT.mkdir(exist_ok=True)
    n = 0
    for src in sorted(SRC.glob("*-normal-512.png")):
        slug = src.name.replace("-normal-512.png", "")
        for size in (24, 48):
            glyph(src, size).save(OUT / f"{slug}-{size}.png", optimize=True)
        n += 1
    print(f"{n} ícones → {OUT}")

if __name__ == "__main__":
    main()
