#!/usr/bin/env python3
"""
RF4 — casos de teste da detecção de marca: peças desenhadas (camiseta, polo, calça, shorts, tênis) com o nome da marca
em posições, tamanhos, cores, fontes e condições diferentes (rotação, baixo contraste, ruído, desfoque), mais controles
sem marca e com texto que não é marca. Uso: python3 scripts/marcas/gerar-casos.py <pasta-de-saída>
Grava <pasta>/casos.json (id, arquivo, categoria, marca esperada, região, variação) e as imagens JPEG.
"""
import json, math, os, random, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = sys.argv[1] if len(sys.argv) > 1 else "casos-marca"
os.makedirs(OUT, exist_ok=True)
F = "/usr/share/fonts/truetype/"
FONTS = {
    "sans-bold": F + "dejavu/DejaVuSans-Bold.ttf", "sans": F + "dejavu/DejaVuSans.ttf", "serif-bold": F + "dejavu/DejaVuSerif-Bold.ttf",
    "lib-bold": F + "liberation/LiberationSans-Bold.ttf", "lib-italic": F + "liberation/LiberationSans-BoldItalic.ttf",
    "free-sans-bold": F + "freefont/FreeSansBold.ttf", "free-serif-bold": F + "freefont/FreeSerifBold.ttf", "mono-bold": F + "liberation/LiberationMono-Bold.ttf",
}
W, H = 1000, 1200
BG = (236, 236, 234)


def canvas(dark=False):
    """Fundo de estúdio com leve degradê; peça clara vai em fundo médio (como uma foto real, com contraste)."""
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    for y in range(H):
        v = int((150 if dark else 240) - 12 * y / H)
        d.line([(0, y), (W, y)], fill=(v, v, v - 3))
    return im


def tee(d, color, polo=False):
    pts = [(300, 170), (420, 140), (500, 175), (580, 140), (700, 170), (880, 330), (790, 420), (720, 360), (720, 1060), (280, 1060), (280, 360), (210, 420), (120, 330)]
    d.polygon(pts, fill=color)
    dark = tuple(max(0, c - 28) for c in color)
    d.arc((420, 110, 580, 230), 0, 180, fill=dark, width=14)  # gola
    if polo:
        d.rectangle((485, 175, 515, 330), fill=dark)
        for y in (215, 265, 310):
            d.ellipse((493, y - 7, 507, y + 7), fill=(235, 235, 235))
    return {"chest_c": (500, 430), "chest_l": (395, 340), "chest_r": (605, 340), "collar": (500, 205), "back": (500, 520)}


def pants(d, color, shorts=False):
    bottom = 700 if shorts else 1140
    d.polygon([(300, 120), (700, 120), (740, bottom), (540, bottom), (500, 380), (460, bottom), (260, bottom)], fill=color)
    d.rectangle((300, 120, 700, 175), fill=tuple(max(0, c - 25) for c in color))
    return {"waist_r": (620, 250), "leg_l": (360, 560 if shorts else 700), "patch": (620, 250)}


def shoe(d, color):
    d.polygon([(150, 700), (260, 540), (430, 500), (560, 560), (820, 660), (880, 760), (150, 780)], fill=color)
    d.rectangle((140, 780, 890, 830), fill=(245, 245, 245))
    return {"side": (520, 680)}


def text(im, s, at, size, font, fill, rotate=0, box=None, maxw=390):
    """Texto centrado em `at`; a fonte encolhe até caber em `maxw` px (o logo nunca passa da largura do peito)."""
    f = ImageFont.truetype(FONTS[font], size)
    while size > 12 and ImageDraw.Draw(im).textbbox((0, 0), s, font=f)[2] > maxw:
        size -= 4; f = ImageFont.truetype(FONTS[font], size)
    tmp = Image.new("RGBA", (int(size * len(s) * 0.9) + 40, int(size * 1.6)), (0, 0, 0, 0))
    td = ImageDraw.Draw(tmp)
    bb = td.textbbox((20, 10), s, font=f)
    if box:                                                  # etiqueta/patch atrás do texto
        td.rectangle((bb[0] - 14, bb[1] - 10, bb[2] + 14, bb[3] + 10), fill=box)
    td.text((20, 10), s, font=f, fill=fill)
    tmp = tmp.crop((max(0, bb[0] - 16), max(0, bb[1] - 12), bb[2] + 16, bb[3] + 12))
    if rotate:
        tmp = tmp.rotate(rotate, expand=True, resample=Image.BICUBIC)
    im.paste(tmp, (int(at[0] - tmp.width / 2), int(at[1] - tmp.height / 2)), tmp)


CASES = []


LIGHT = set()                                                # casos com peça clara: fundo médio


def case(cid, category, brand, region, variation, draw):
    im = canvas(dark=cid in LIGHT); d = ImageDraw.Draw(im)
    draw(im, d)
    fn = f"{cid:02d}.jpg"
    im.save(os.path.join(OUT, fn), quality=92)
    CASES.append({"id": cid, "file": fn, "category": category, "expected": brand, "region": region, "variation": variation})


random.seed(7)
NAVY, WHITE, BLACK, RED, GREEN, GRAY, BEIGE = (28, 38, 72), (246, 246, 244), (24, 24, 26), (186, 32, 40), (22, 110, 60), (140, 140, 140), (214, 196, 160)
LIGHT.update({2, 3, 5, 8, 11, 15, 17, 20, 21, 24, 27, 29})


def blur(im, r):
    return im.filter(ImageFilter.GaussianBlur(r))


def noisy(im, amp):
    px = im.load()
    for _ in range(W * H // 6):
        x, y = random.randrange(W), random.randrange(H)
        c = px[x, y]; n = random.randint(-amp, amp)
        px[x, y] = tuple(max(0, min(255, v + n)) for v in c)


case(1, "upper_piece", "Lacoste", "centro do peito", "logo grande central, serifado branco em camiseta marinho",
     lambda im, d: text(im, "LACOSTE", tee(d, NAVY)["chest_c"], 92, "serif-bold", (245, 245, 245)))
case(2, "upper_piece", "Lacoste", "peito esquerdo", "polo branca, nome pequeno verde no peito",
     lambda im, d: text(im, "LACOSTE", tee(d, WHITE, polo=True)["chest_l"], 34, "sans-bold", GREEN))
case(3, "upper_piece", "Levi's", "centro do peito", "vermelho em camiseta branca, caixa mista com apóstrofo",
     lambda im, d: text(im, "Levi's", tee(d, WHITE)["chest_c"], 120, "lib-bold", RED))
case(4, "upper_piece", "Levi's", "centro do peito", "logo 'batwing': texto branco sobre forma vermelha",
     lambda im, d: text(im, "Levi's", tee(d, GRAY)["chest_c"], 96, "lib-bold", (250, 250, 250), box=RED))
case(5, "upper_piece", "Nike", "centro do peito", "preto grande em camiseta branca",
     lambda im, d: text(im, "NIKE", tee(d, WHITE)["chest_c"], 150, "sans-bold", BLACK))
case(6, "upper_piece", "Adidas", "centro do peito", "minúsculas brancas em camiseta preta",
     lambda im, d: text(im, "adidas", tee(d, BLACK)["chest_c"], 120, "free-sans-bold", WHITE))
case(7, "upper_piece", "Puma", "peito esquerdo", "pequeno no peito esquerdo",
     lambda im, d: text(im, "PUMA", tee(d, (40, 90, 160))["chest_l"], 44, "sans-bold", WHITE))
case(8, "upper_piece", "Tommy Hilfiger", "centro do peito", "duas palavras",
     lambda im, d: text(im, "TOMMY HILFIGER", tee(d, WHITE)["chest_c"], 60, "lib-bold", NAVY))
case(9, "upper_piece", "Calvin Klein", "centro do peito", "duas palavras, fonte fina",
     lambda im, d: text(im, "Calvin Klein", tee(d, (60, 60, 64))["chest_c"], 70, "sans", WHITE))
case(10, "upper_piece", "Ralph Lauren", "peito direito", "pequeno, peito direito",
      lambda im, d: text(im, "RALPH LAUREN", tee(d, (120, 170, 210))["chest_r"], 30, "serif-bold", NAVY))
case(11, "upper_piece", "Zara", "centro do peito", "serifado grande",
      lambda im, d: text(im, "ZARA", tee(d, BEIGE)["chest_c"], 150, "free-serif-bold", BLACK))
case(12, "upper_piece", "Gucci", "centro do peito", "dourado em preto",
      lambda im, d: text(im, "GUCCI", tee(d, BLACK)["chest_c"], 120, "serif-bold", (200, 160, 70)))
case(13, "upper_piece", "Hering", "centro do peito", "itálico",
      lambda im, d: text(im, "Hering", tee(d, (200, 40, 50))["chest_c"], 110, "lib-italic", WHITE))
case(14, "upper_piece", "Reserva", "centro do peito", "marca brasileira",
      lambda im, d: text(im, "RESERVA", tee(d, GREEN)["chest_c"], 100, "sans-bold", WHITE))
case(15, "upper_piece", "Osklen", "peito esquerdo", "pequeno",
      lambda im, d: text(im, "OSKLEN", tee(d, WHITE)["chest_l"], 40, "sans-bold", BLACK))
case(16, "upper_piece", "Nike", "centro do peito", "girado 12°",
      lambda im, d: text(im, "NIKE", tee(d, (230, 120, 40))["chest_c"], 130, "sans-bold", WHITE, rotate=12))
case(17, "upper_piece", "Adidas", "centro do peito", "baixo contraste (cinza claro em branco)",
      lambda im, d: text(im, "ADIDAS", tee(d, WHITE)["chest_c"], 110, "sans-bold", (190, 190, 190)))


def c18(im, d):
    text(im, "LEVI'S", tee(d, NAVY)["chest_c"], 110, "sans-bold", WHITE)


case(18, "upper_piece", "Levi's", "centro do peito", "foto com ruído e desfoque", c18)
im = Image.open(os.path.join(OUT, "18.jpg")); noisy(im, 28); blur(im, 1.6).save(os.path.join(OUT, "18.jpg"), quality=85)
case(19, "upper_piece", "Lacoste", "fundo da gola", "etiqueta na gola (fundo claro, texto escuro)",
      lambda im, d: text(im, "LACOSTE", tee(d, NAVY)["collar"], 26, "sans-bold", BLACK, box=(240, 240, 236)))
case(20, "upper_piece", "Zara", "fundo da gola", "etiqueta preta na gola",
      lambda im, d: text(im, "ZARA", tee(d, WHITE)["collar"], 30, "serif-bold", WHITE, box=BLACK))
case(21, "upper_piece", "Lacoste", "centro do peito", "verde grande em branco",
      lambda im, d: text(im, "Lacoste", tee(d, WHITE)["chest_c"], 110, "lib-bold", GREEN))
case(22, "lower_piece", "Levi's", "cós", "patch de couro na cintura do jeans",
      lambda im, d: text(im, "LEVI'S", pants(d, (46, 70, 120))["patch"], 40, "serif-bold", (70, 40, 20), box=(170, 120, 70)))
case(23, "lower_piece", "Nike", "perna", "shorts com nome na perna",
      lambda im, d: text(im, "NIKE", pants(d, BLACK, shorts=True)["leg_l"], 64, "sans-bold", WHITE))
case(24, "shoes_piece", "Puma", "lateral", "tênis com nome na lateral",
      lambda im, d: text(im, "PUMA", shoe(d, WHITE)["side"], 70, "sans-bold", BLACK))
case(25, "shoes_piece", "Adidas", "lateral", "tênis preto, nome branco",
      lambda im, d: text(im, "adidas", shoe(d, BLACK)["side"], 64, "free-sans-bold", WHITE))
case(26, "upper_piece", "Tommy Hilfiger", "peito esquerdo", "caixa mista, pequeno",
      lambda im, d: text(im, "Tommy Hilfiger", tee(d, NAVY)["chest_l"], 30, "lib-bold", WHITE))
case(27, "upper_piece", "Gucci", "centro do peito", "espaçado (letras separadas)",
      lambda im, d: text(im, "G U C C I", tee(d, WHITE)["chest_c"], 90, "serif-bold", BLACK))
# controles
case(28, "upper_piece", None, "—", "controle: camiseta lisa, sem texto", lambda im, d: tee(d, (90, 130, 90)))
case(29, "upper_piece", None, "centro do peito", "controle: frase que não é marca", lambda im, d: text(im, "GOOD VIBES ONLY", tee(d, WHITE)["chest_c"], 70, "sans-bold", BLACK))
case(30, "upper_piece", "KORVANO (fora do catálogo)", "centro do peito", "marca fora do catálogo: deve sair como 'possível'",
      lambda im, d: text(im, "KORVANO", tee(d, (80, 80, 80))["chest_c"], 110, "sans-bold", WHITE))

json.dump(CASES, open(os.path.join(OUT, "casos.json"), "w"), ensure_ascii=False, indent=1)
print(len(CASES), "casos em", OUT)
