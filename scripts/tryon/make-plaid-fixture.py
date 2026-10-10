"""Camisa XADREZ para o laboratório (PROVADOR-3D / CATALOGO-3D): a camisa do acervo (01_parte_superior_02_shirt_camisa)
com o corpo azul trocado por um xadrez (mantém gola, punhos, botões e selo). Uso: python3 -I scripts/tryon/make-plaid-fixture.py
Saída: public/lab/cores/camisa-xadrez.webp (e o tecido base liso em camisa-lisa.webp para comparar)."""
from PIL import Image
import math
src = Image.open("public/_derived/pecas_thumb/01_parte_superior_02_shirt_camisa-640.webp").convert("RGBA")
w, h = src.size; px = src.load()
plaid = Image.new("RGBA", (w, h)); pp = plaid.load()
plain = Image.new("RGBA", (w, h)); qq = plain.load()
def plaid_at(x, y):
    # xadrez de 3 cores: fundo creme, listras largas verde-oliva, linha fina vinho (período 48 px)
    base = (222, 206, 168); olive = (108, 118, 72); wine = (110, 40, 48)
    sx, sy = x % 48, y % 48
    c = list(base)
    if sx < 14 or sy < 14: c = [(a + b) // 2 for a, b in zip(c, olive)]
    if sx < 14 and sy < 14: c = olive
    if 30 <= sx < 33 or 30 <= sy < 33: c = [(a + 2 * b) // 3 for a, b in zip(c, wine)]
    return tuple(int(v) for v in c)
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if a < 8: pp[x, y] = (0, 0, 0, 0); qq[x, y] = (0, 0, 0, 0); continue
        # azul do corpo: matiz azul dominante; o resto (laranja da gola/punhos/botões, selo) fica igual
        blue = b > r + 40 and b > g - 10
        if blue:
            lum = (0.3 * r + 0.59 * g + 0.11 * b) / 150.0            # sombra/luz da foto preservada
            pr, pg, pb = plaid_at(x, y); pp[x, y] = (int(min(255, pr * lum)), int(min(255, pg * lum)), int(min(255, pb * lum)), a)
            qq[x, y] = (int(min(255, 222 * lum)), int(min(255, 206 * lum)), int(min(255, 168 * lum)), a)
        else: pp[x, y] = (r, g, b, a); qq[x, y] = (r, g, b, a)
plaid.save("public/lab/cores/camisa-xadrez.webp", quality=90, method=6)
plain.save("public/lab/cores/camisa-lisa.webp", quality=90, method=6)
print("ok", w, h)
