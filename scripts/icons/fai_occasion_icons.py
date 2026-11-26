#!/usr/bin/env python3
"""Ícones FAI das ocasiões do Vista-me (família OCC), desenhados localmente — sem IA de imagem.

Mesma medalha dos ícones FAI (disco #2A211C com a malha, halo #F57C1F e medalhão creme #F5EBD7): a moldura vem do
PNG oficial de referência (NAV-07, 512 px) com o medalhão central repintado em creme; o objeto é uma silhueta preta
fosca (#1E1B18) com detalhes em creme e sombra curta, ocupando ~60% do medalhão (checklist do catálogo).

Gera public/icons/fai/occ-XX-normal-{512,96,48,24}.png, a variante glifo (public/icons/fai/glyph/occ-XX-{24,48}.png,
o mesmo recorte de scripts/assets/fai-glyphs.py) e o catálogo lib/icons/fai-occasion-icons.json, que o FaiIcon soma ao
catálogo principal. Uso: python3 scripts/icons/fai_occasion_icons.py
"""
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
FAI = ROOT / "public/icons/fai"
FRAME_SRC = FAI / "nav-07-normal-512.png"
K = 4                                   # supersampling: desenha a 2048 px e reduz para 512
C = 256                                 # centro do medalhão
DISC_R = 117                            # raio do medalhão creme no PNG de 512 px
INK = (30, 27, 24, 255)                 # #1E1B18
CREAM = (245, 235, 215, 255)            # #F5EBD7
GLYPH_RADIUS = 112                      # o mesmo raio de scripts/assets/fai-glyphs.py

# (id, chave da ocasião no front, pt, en, es, glifo)
OCCASIONS = [
    ("OCC-01", "work", "Trabalho", "Work", "Trabajo", "briefcase"),
    ("OCC-02", "college", "Faculdade", "College", "Facultad", "mortarboard"),
    ("OCC-03", "dinner", "Jantar", "Dinner", "Cena", "plate"),
    ("OCC-04", "date", "Encontro", "Date", "Cita", "hearts"),
    ("OCC-05", "party", "Festa", "Party", "Fiesta", "balloons"),
    ("OCC-06", "gym", "Academia", "Gym", "Gimnasio", "dumbbell"),
    ("OCC-07", "beach", "Praia", "Beach", "Playa", "umbrella"),
    ("OCC-08", "trip", "Viagem", "Trip", "Viaje", "suitcase"),
    ("OCC-09", "home", "Casa", "Home", "Casa", "house"),
    ("OCC-10", "walk", "Passeio", "Walk", "Paseo", "tree"),
    ("OCC-11", "surprise", "Surpreenda-me", "Surprise me", "Sorpréndeme", "sparkle"),
    ("OCC-12", "repeat", "Repetir último pedido", "Repeat last request", "Repetir último pedido", "repeat"),
]


def s(*v):
    return [x * K for x in v]


def rr(d, box, r, fill=INK):
    d.rounded_rectangle(s(*box), radius=r * K, fill=fill)


def heart(d, cx, cy, size, fill=INK):
    pts = []
    for i in range(120):
        t = 2 * math.pi * i / 120
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append(((cx + x * size / 32) * K, (cy - y * size / 32) * K))
    d.polygon(pts, fill=fill)


def draw_object(glyph):
    layer = Image.new("RGBA", (512 * K, 512 * K), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    if glyph == "briefcase":
        d.rounded_rectangle(s(224, 186, 288, 222), radius=12 * K, outline=INK, width=14 * K)
        rr(d, (180, 212, 332, 318), 18)
        d.line(s(180, 250, 332, 250), fill=CREAM, width=5 * K)
        rr(d, (244, 238, 268, 262), 5, CREAM)
    elif glyph == "mortarboard":
        d.polygon(s(170, 226, 256, 190, 342, 226, 256, 262), fill=INK)
        d.polygon(s(206, 244, 306, 244, 300, 300, 212, 300), fill=INK)
        d.pieslice(s(212, 276, 300, 324), 0, 180, fill=INK)
        d.line(s(256, 226, 326, 236, 326, 290), fill=CREAM, width=5 * K)
        d.ellipse(s(318, 284, 334, 312), fill=CREAM)
    elif glyph == "plate":
        d.ellipse(s(196, 196, 316, 316), fill=INK)
        d.ellipse(s(216, 216, 296, 296), outline=CREAM, width=5 * K)
        for x in (162, 172, 182):
            d.line(s(x, 196, x, 226), fill=INK, width=6 * K)
        rr(d, (160, 220, 184, 236), 6)
        rr(d, (166, 230, 178, 316), 6)
        d.polygon(s(334, 196, 350, 202, 350, 262, 334, 262), fill=INK)
        rr(d, (334, 256, 348, 316), 6)
    elif glyph == "hearts":
        heart(d, 236, 252, 118)
        heart(d, 296, 232, 76)
        heart(d, 296, 232, 54, CREAM)
        heart(d, 296, 232, 40)
    elif glyph == "balloons":
        for cx, cy, r in ((226, 228, 40), (290, 214, 44)):
            d.ellipse(s(cx - r, cy - r * 1.2, cx + r, cy + r * 1.2), fill=INK)
            d.ellipse(s(cx - r * .45, cy - r * .85, cx - r * .15, cy - r * .35), fill=CREAM)
            d.polygon(s(cx - 7, cy + r * 1.2 + 8, cx + 7, cy + r * 1.2 + 8, cx, cy + r * 1.2 - 2), fill=INK)
        d.line(s(226, 284, 246, 312, 256, 334), fill=INK, width=5 * K)
        d.line(s(290, 274, 270, 310, 256, 334), fill=INK, width=5 * K)
    elif glyph == "dumbbell":
        rr(d, (200, 248, 312, 264), 6)
        for x0 in (168, 314):
            rr(d, (x0, 206, x0 + 30, 306), 10)
        for x0 in (190, 300):
            rr(d, (x0, 222, x0 + 22, 290), 8)
    elif glyph == "umbrella":
        d.pieslice(s(170, 176, 342, 336), 180, 360, fill=INK)
        for x in (213, 256, 299):
            d.line(s(256, 186, x, 256), fill=CREAM, width=5 * K)
        d.line(s(256, 256, 256, 330), fill=INK, width=12 * K)
        d.arc(s(220, 300, 256, 336), 0, 180, fill=INK, width=10 * K)
        d.pieslice(s(166, 318, 346, 362), 180, 360, fill=INK)
    elif glyph == "suitcase":
        d.rounded_rectangle(s(232, 178, 280, 210), radius=10 * K, outline=INK, width=12 * K)
        rr(d, (196, 202, 316, 320), 20)
        for x in (230, 282):
            d.line(s(x, 214, x, 308), fill=CREAM, width=7 * K)
        for x in (214, 298):
            d.ellipse(s(x - 9, 318, x + 9, 336), fill=INK)
    elif glyph == "house":
        d.polygon(s(166, 254, 256, 176, 346, 254), fill=INK)
        rr(d, (300, 184, 322, 230), 3)
        rr(d, (190, 240, 322, 330), 8)
        rr(d, (240, 270, 272, 330), 6, CREAM)
        d.ellipse(s(262, 296, 268, 302), fill=INK)
    elif glyph == "tree":
        for cx, cy, r in ((256, 214, 46), (216, 250, 40), (296, 250, 40), (256, 262, 44)):
            d.ellipse(s(cx - r, cy - r, cx + r, cy + r), fill=INK)
        d.polygon(s(244, 290, 268, 290, 274, 338, 238, 338), fill=INK)
        d.line(s(256, 300, 256, 270, 236, 250), fill=CREAM, width=5 * K)
        d.line(s(256, 278, 278, 256), fill=CREAM, width=5 * K)
    elif glyph == "sparkle":
        def star(cx, cy, r, w):
            d.polygon(s(cx, cy - r, cx + w, cy - w, cx + r, cy, cx + w, cy + w, cx, cy + r, cx - w, cy + w, cx - r, cy, cx - w, cy - w), fill=INK)
        star(240, 268, 78, 16)
        star(316, 198, 34, 8)
    elif glyph == "repeat":
        d.arc(s(184, 184, 328, 328), 40, 330, fill=INK, width=26 * K)
        d.polygon(s(300, 154, 352, 222, 278, 232), fill=INK)
    return layer.resize((512, 512), Image.LANCZOS)


def frame():
    base = Image.open(FRAME_SRC).convert("RGBA")
    med = Image.new("RGBA", (512 * K, 512 * K), (0, 0, 0, 0))
    md = ImageDraw.Draw(med)
    for i in range(DISC_R * K, 0, -K):            # medalhão creme com luz de cima à esquerda
        t = i / (DISC_R * K)
        col = tuple(int(a + (b - a) * t) for a, b in zip((252, 233, 193), (241, 214, 168))) + (255,)
        off = (1 - t) * -10 * K
        md.ellipse((C * K - i + off, C * K - i + off, C * K + i + off, C * K + i + off), fill=col)
    mask = Image.new("L", med.size, 0)
    ImageDraw.Draw(mask).ellipse(s(C - DISC_R, C - DISC_R, C + DISC_R, C + DISC_R), fill=255)
    med.putalpha(mask)
    base.alpha_composite(med.resize((512, 512), Image.LANCZOS))
    return base


def compose(glyph, fr):
    obj = draw_object(glyph)
    shadow = Image.new("RGBA", obj.size, (40, 25, 10, 0))
    shadow.putalpha(obj.getchannel("A").point(lambda a: a * 0.28))
    shadow = shadow.transform(obj.size, Image.AFFINE, (1, 0, -5, 0, 1, -7)).filter(ImageFilter.GaussianBlur(5))
    icon = fr.copy()
    icon.alpha_composite(shadow)
    icon.alpha_composite(obj)
    return icon


def glyph_variant(im, size):
    crop = im.crop((C - GLYPH_RADIUS, C - GLYPH_RADIUS, C + GLYPH_RADIUS, C + GLYPH_RADIUS)).resize((size * 4, size * 4), Image.LANCZOS)
    mask = Image.new("L", crop.size, 0)
    ImageDraw.Draw(mask).ellipse((1, 1, crop.size[0] - 2, crop.size[1] - 2), fill=255)
    crop.putalpha(Image.composite(crop.getchannel("A"), Image.new("L", crop.size, 0), mask))
    return crop.resize((size, size), Image.LANCZOS)


def main():
    fr = frame()
    (FAI / "glyph").mkdir(exist_ok=True)
    icons = []
    for iid, key, pt, en, es, glyph in OCCASIONS:
        slug = iid.lower()
        im = compose(glyph, fr)
        files = {}
        for px in (512, 96, 48, 24):
            path = FAI / f"{slug}-normal-{px}.png"
            im.resize((px, px), Image.LANCZOS).save(path, optimize=True)
            files[str(px)] = f"/icons/fai/{path.name}"
        for px in (24, 48):
            glyph_variant(im, px).save(FAI / "glyph" / f"{slug}-{px}.png", optimize=True)
        icons.append({"id": iid, "slug": slug, "family": "OCC", "rf": "RF28", "occasion": key,
                      "label": {"PT_BR": pt, "EN": en, "ES": es}, "states": ["normal"], "singleState": True,
                      "glyph": glyph, "ai": False, "drawn": "scripts/icons/fai_occasion_icons.py", "files": {"normal": files}, "available": True})
    out = ROOT / "lib/icons/fai-occasion-icons.json"
    out.write_text(json.dumps({"source": "scripts/icons/fai_occasion_icons.py (moldura do NAV-07, objeto desenhado)", "icons": icons},
                              ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(icons)} ícones OCC -> {FAI} e {out}")


if __name__ == "__main__":
    main()
