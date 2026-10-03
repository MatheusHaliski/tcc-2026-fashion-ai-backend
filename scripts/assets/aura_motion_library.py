#!/usr/bin/env python3
"""
Fashion AI — biblioteca de animações dos presets AURA (uma linguagem de movimento por variante).

Cada variante estática de /public/aura_sem_GIF ganha um vídeo próprio em /public/aura_com_GIF/<variante>.mp4
(480 px, 20 fps, 8 s, loop perfeito), escolhido pela geometria e pelo conceito da imagem — nada de tratar toda
imagem como líquido. Famílias usadas (ver FAMILIES):

  iluminação     reflexo metálico deslizando (cromo, alfaiataria), lâmpada pulsando (biblioteca), luz da janela
                 varrendo a sala (escritório), holofotes acendendo um após o outro (estúdio editorial)
  parallax       camadas do horizonte em velocidades diferentes (crepúsculo), névoa em camadas (floresta)
  zoom           aproximação lenta com faixa de sol (deserto)
  pulso          sol respirando com tremor de calor (dunas), bokeh pulsante (brilho suave)
  ondulação      estrutura oscilando sem virar líquido: fita cromada (fluxo de luz), cortina (interiores)
  paralelo       faixas diagonais deslizando em velocidades diferentes (diagonais esportivas)
  batimento      pulsos de energia correndo pelos feixes em X (feixes)
  radar/palco    holofote varrendo o palco e luzes da passarela em dominó (palco)
  partículas     pétalas caindo em trajetórias curvas (pétalas)
  digital        segmentos de circuito acendendo + glitch controlado (circuitos), scanner vertical (diagonais neon)
  traçado        por cima do movimento da foto, cada variante recebe um desenho vetorial fino próprio (linguagem do
                 mosaico AURA V2): linhas de medida, hexágonos, retângulos em cascata, anéis concêntricos, radar,
                 chevrons, circuito, visor, órbitas, pontilhados, quadrado caminhando pela borda…

Cada vídeo varia ao menos três atributos (direção, velocidade, geometria, tipo de movimento, escala, ritmo,
iluminação, quantidade de elementos, origem). Os Aura Electro ficam em aura_electro_frames.py.

Uso:
    python3 scripts/assets/aura_motion_library.py                       # todas
    python3 scripts/assets/aura_motion_library.py aura_glam_noite__palco  # uma
    python3 scripts/assets/build_asset_catalog.py --no-derived && python3 scripts/assets/build_card_art_index.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import av
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "public" / "aura_sem_GIF"
OUT = ROOT / "public" / "aura_com_GIF"
WIDTH, FPS, SECONDS = 480, 20, 8
FRAMES = FPS * SECONDS
TAU = 2 * np.pi

# ----------------------------------------------------------------------------------------------- utilidades

def load(vid: str) -> np.ndarray:
    im = Image.open(SRC / f"{vid}.png").convert("RGB")
    h = round(im.height * WIDTH / im.width) // 2 * 2
    return np.asarray(im.resize((WIDTH, h), Image.LANCZOS)).astype(np.float32) / 255.0


def grid(img):
    H, W = img.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    return H, W, yy, xx


def warp(img, ux, uy, mode="reflect"):
    return np.stack([ndi.map_coordinates(img[..., c], [uy, ux], order=1, mode=mode) for c in range(3)], -1)


def zoom(img, s, cx=None, cy=None):
    H, W, yy, xx = grid(img)
    cx = W / 2 if cx is None else cx
    cy = H / 2 if cy is None else cy
    return warp(img, cx + (xx - cx) / s, cy + (yy - cy) / s)


def band(yy, xx, angle_deg, pos, width):
    """Faixa gaussiana perpendicular à direção angle, centrada em pos (fração do percurso 0..1)."""
    a = np.deg2rad(angle_deg)
    d = xx * np.cos(a) + yy * np.sin(a)
    lo, hi = d.min(), d.max()
    c = lo + (hi - lo) * pos
    return np.exp(-((d - c) ** 2) / (2 * width ** 2))


def disc(yy, xx, cx, cy, r):
    return np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * r ** 2))


def screen(img, light, color=(1, 1, 1)):
    col = np.asarray(color, np.float32)[None, None, :]
    return 1 - (1 - img) * (1 - np.clip(light, 0, 1)[..., None] * col)


def add(img, light, color=(1, 1, 1)):
    return np.clip(img + np.clip(light, 0, 1)[..., None] * np.asarray(color, np.float32)[None, None, :], 0, 1)


def hue_shift(img, deg):
    """Rotação de matiz (matriz YIQ), em graus; deg pode ser um mapa H×W."""
    th = np.deg2rad(deg)
    c, s = np.cos(th), np.sin(th)
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    y = 0.299 * r + 0.587 * g + 0.114 * b
    i = 0.596 * r - 0.274 * g - 0.322 * b
    q = 0.211 * r - 0.523 * g + 0.312 * b
    i2 = i * c - q * s
    q2 = i * s + q * c
    out = np.stack([y + 0.956 * i2 + 0.621 * q2, y - 0.272 * i2 - 0.647 * q2, y - 1.106 * i2 + 1.703 * q2], -1)
    return np.clip(out, 0, 1)


def smooth(t):
    return t * t * (3 - 2 * t)


def ramp(yy, lo, hi):
    """Máscara 0→1 entre as linhas lo e hi (frações da altura)."""
    H = yy.shape[0]
    return np.clip((yy - lo * H) / max(1.0, (hi - lo) * H), 0, 1)



# ----------------------------------------------------------------------------------------------- traçados vetoriais
# linguagem do mosaico AURA V2: linhas finas com pontos nas extremidades, retângulos, círculos concêntricos, hexágonos,
# linhas pontilhadas e caminhos de circuito desenhados progressivamente sobre a foto.

def seg(yy, xx, x0, y0, x1, y1, w=1.1, progress=1.0):
    """Máscara de um segmento (desenhado até `progress`), espessura w."""
    x1 = x0 + (x1 - x0) * progress; y1 = y0 + (y1 - y0) * progress
    vx, vy = x1 - x0, y1 - y0
    L2 = max(vx * vx + vy * vy, 1e-6)
    u = np.clip(((xx - x0) * vx + (yy - y0) * vy) / L2, 0, 1)
    d2 = (xx - (x0 + u * vx)) ** 2 + (yy - (y0 + u * vy)) ** 2
    return np.exp(-d2 / (2 * w * w))


def ring(yy, xx, cx, cy, r, w=1.1, arc=1.0, start=0.0):
    """Círculo (ou arco de `arc` voltas a partir de `start`), espessura w."""
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    m = np.exp(-((d - r) ** 2) / (2 * w * w))
    if arc < 1:
        a = (np.arctan2(yy - cy, xx - cx) / TAU - start) % 1.0
        m = m * (a <= arc)
    return m


def poly(yy, xx, pts, w=1.1, progress=1.0, close=True):
    """Polilinha desenhada progressivamente (traçado): progress 0..1 percorre todos os lados."""
    pts = list(pts) + ([pts[0]] if close else [])
    n = len(pts) - 1
    m = np.zeros_like(xx)
    for k in range(n):
        p = np.clip(progress * n - k, 0, 1)
        if p <= 0:
            break
        (x0, y0), (x1, y1) = pts[k], pts[k + 1]
        m = np.maximum(m, seg(yy, xx, x0, y0, x1, y1, w, p))
    return m


def rect(yy, xx, x0, y0, x1, y1, w=1.1, progress=1.0):
    return poly(yy, xx, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], w, progress)


def ngon(cx, cy, r, n=6, rot=0.0):
    return [(cx + r * np.cos(TAU * (k / n) + rot), cy + r * np.sin(TAU * (k / n) + rot)) for k in range(n)]


def dotted(yy, xx, x0, y0, x1, y1, n=24, r=1.3, phase=0.0):
    """Linha pontilhada; `phase` faz os pontos caminharem ao longo da linha."""
    m = np.zeros_like(xx)
    for k in range(n):
        u = ((k + phase) % n) / n
        m = np.maximum(m, disc(yy, xx, x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, r))
    return m


def endpoints(yy, xx, pts, r=2.2):
    m = np.zeros_like(xx)
    for x, y in pts:
        m = np.maximum(m, disc(yy, xx, x, y, r))
    return m


def ink(img, mask, color=(1, 1, 1), alpha=0.85):
    """Pinta o traçado por cima da foto (mistura normal, não aditiva: fica legível também sobre áreas claras)."""
    a = np.clip(mask, 0, 1)[..., None] * alpha
    return img * (1 - a) + np.asarray(color, np.float32)[None, None, :] * a


def pulse(t, k=1, phase=0.0):
    return 0.5 + 0.5 * np.sin(TAU * (k * t + phase))


def tri(t):
    """0→1→0 ao longo do loop (desenha e apaga)."""
    return 1 - abs(2 * (t % 1.0) - 1)


# ----------------------------------------------------------------------------------------------- famílias
# cada família: f(img, t) -> frame, t em [0, 1) (loop)

def metallic_sweep(img, t, angle=-35, width=38, strength=0.55, lines=3, hue=0.0):
    """Reflexo metálico deslizando pela dobra + linhas finas em velocidades diferentes (alfaiataria)."""
    H, W, yy, xx = grid(img)
    out = img
    out = screen(out, strength * band(yy, xx, angle, t, width))
    for k in range(lines):
        pos = (t * (1.5 + 0.5 * k) + k / lines) % 1.0
        out = screen(out, 0.18 * band(yy, xx, angle, pos, 4 + 2 * k))
    if hue:
        out = hue_shift(out, hue * np.sin(TAU * t))
    return out


def chrome_prism(img, t):
    """Reflexo especular + matiz deslocando ao longo da chapa (cromo lilás): o arco-íris do holográfico caminha."""
    H, W, yy, xx = grid(img)
    spec = band(yy, xx, 25, (t * 1.0) % 1.0, 30)
    shift = 40 * np.sin(TAU * (t + xx / W * 0.6 + yy / H * 0.2))
    out = hue_shift(img, shift * 0.35)
    out = screen(out, 0.5 * spec, (0.95, 0.9, 1.0))
    out = screen(out, 0.25 * band(yy, xx, 25, (t * 2.0 + 0.5) % 1.0, 8))
    return out


def structural_wave(img, t, amp=6.0, periods=1.6, axis="x", travel=1.0, sparkle=0):
    """A própria geometria oscila mantendo a estrutura (amplitude pequena, onda viajando)."""
    H, W, yy, xx = grid(img)
    if axis == "x":  # colunas sobem/descem: fita vertical ondula
        uy = yy + amp * np.sin(TAU * (periods * xx / W - travel * t))
        out = warp(img, xx, uy)
    else:            # linhas deslocam para o lado: cortina balança
        ux = xx + amp * np.sin(TAU * (periods * yy / H - travel * t)) * (0.3 + 0.7 * yy / H)
        out = warp(img, ux, yy)
    if sparkle:
        rng = np.random.default_rng(7)
        for k in range(sparkle):
            u = (t * (0.6 + 0.15 * (k % 4)) + rng.random()) % 1.0
            x = W * (0.35 + 0.3 * np.sin(TAU * (u * 1.3 + k))); y = H * u
            out = add(out, 0.6 * (0.5 + 0.5 * np.sin(TAU * (t * 3 + k))) * disc(yy, xx, x, y, 2.2), (1, 0.95, 1))
    return out


def parallax_h(img, t, layers=((0.0, 0.42, 4), (0.42, 0.7, 10), (0.7, 1.0, 18)), zoom_amp=0.0):
    """Camadas horizontais (céu, montes, primeiro plano) deslocando em velocidades diferentes (sinusoidal: loop)."""
    H, W, yy, xx = grid(img)
    dx = np.zeros_like(xx)
    for lo, hi, amp in layers:
        m = ramp(yy, lo - 0.05, lo + 0.05) * (1 - ramp(yy, hi - 0.05, hi + 0.05))
        dx += m * amp
    ux = xx + dx * np.sin(TAU * t)
    out = warp(img, ux, yy)
    if zoom_amp:
        out = zoom(out, 1 + zoom_amp * (0.5 + 0.5 * np.cos(TAU * t)))
    return out


def zoom_light(img, t, zoom_max=1.08, angle=-20, color=(1, 0.85, 0.6)):
    """Aproximação lenta + faixa de sol varrendo as dunas."""
    H, W, yy, xx = grid(img)
    s = 1 + (zoom_max - 1) * (0.5 - 0.5 * np.cos(TAU * t))
    out = zoom(img, s, W * 0.55, H * 0.45)
    out = screen(out, 0.35 * band(yy, xx, angle, t, 60), color)
    return out


def sun_pulse(img, t, cx=0.5, cy=0.17, r=70, shimmer=1.5):
    """Sol respirando + tremor de calor (linhas oscilam poucos pixels) nas dunas emolduradas."""
    H, W, yy, xx = grid(img)
    # o tremor some perto das bordas laterais (senão a moldura branca do pôster vira um pontilhado na margem)
    edge = np.clip(np.minimum(xx, W - 1 - xx) / 14.0, 0, 1)
    ux = xx + shimmer * np.sin(TAU * (yy / 18 + 2 * t)) * ramp(yy, 0.3, 0.9) * edge
    out = warp(img, ux, yy)
    glow = 0.5 + 0.5 * np.sin(TAU * t)
    out = screen(out, (0.25 + 0.3 * glow) * disc(yy, xx, W * cx, H * cy, r * (0.9 + 0.2 * glow)), (1, 0.8, 0.45))
    return out


def lamp_flicker_zoom(img, t, lamp=(0.33, 0.52), r=90, zoom_max=1.06):
    """Lâmpada a óleo tremulando (ritmo irregular, porém periódico) + aproximação lenta da escrivaninha."""
    H, W, yy, xx = grid(img)
    s = 1 + (zoom_max - 1) * (0.5 - 0.5 * np.cos(TAU * t))
    out = zoom(img, s, W * 0.4, H * 0.55)
    f = 0.55 + 0.25 * np.sin(TAU * 7 * t) * np.sin(TAU * 3 * t) + 0.2 * np.sin(TAU * 13 * t) ** 2
    out = screen(out, 0.45 * f * disc(yy, xx, W * lamp[0], H * lamp[1], r), (1, 0.72, 0.35))
    out = out * (0.92 + 0.08 * f)
    return np.clip(out, 0, 1)


def window_wipe(img, t, angle=12, width=90, color=(1, 0.9, 0.7)):
    """Luz da janela varrendo a sala devagar (dominó de iluminação, da esquerda para a direita) com poeira."""
    H, W, yy, xx = grid(img)
    out = screen(img, 0.3 * band(yy, xx, angle, smooth((t * 1.0) % 1.0), width), color)
    rng = np.random.default_rng(3)
    for k in range(18):
        u = (t * 0.25 + rng.random()) % 1.0
        x = W * ((rng.random() + 0.04 * np.sin(TAU * (t + k))) % 1.0); y = H * u
        out = add(out, 0.25 * disc(yy, xx, x, y, 1.3), color)
    return out


def sequential_spots(img, t, spots=((0.3, 0.1, 110), (0.72, 0.08, 110), (0.5, 0.5, 150)), zoom_min=0.97):
    """Holofotes do estúdio acendendo um após o outro (iluminação sequencial) e um afastamento quase imperceptível."""
    H, W, yy, xx = grid(img)
    s = 1 + (zoom_min - 1) * (0.5 - 0.5 * np.cos(TAU * t))
    out = zoom(img, s)
    n = len(spots)
    for k, (cx, cy, r) in enumerate(spots):
        phase = (t * n - k) % n
        lit = np.clip(1 - abs(phase - 0.5) * 1.3, 0, 1) if phase < 1 else 0.0
        out = screen(out, 0.22 * lit * disc(yy, xx, W * cx, H * cy, r), (1, 0.97, 0.9))
    return out


def diagonal_bands(img, t, angle=-38, speeds=(14, -22, 30), count=3):
    """Faixas paralelas (ao longo da diagonal) deslizando em velocidades e sentidos diferentes."""
    H, W, yy, xx = grid(img)
    a = np.deg2rad(angle)
    nx, ny = np.cos(a), np.sin(a)          # direção da faixa
    px, py = -ny, nx                        # perpendicular: divide as faixas
    d = xx * px + yy * py
    lo, hi = d.min(), d.max()
    u = (d - lo) / (hi - lo)
    dx = np.zeros_like(xx); dy = np.zeros_like(yy)
    for k in range(count):
        m = np.clip(1 - abs(u - (k + 0.5) / count) * count, 0, 1)
        sh = speeds[k % len(speeds)] * np.sin(TAU * t)
        dx += m * sh * nx; dy += m * sh * ny
    return warp(img, xx + dx, yy + dy)


def beam_pulses(img, t, beams=(((0.08, 0.95), (0.92, 0.1)), ((0.1, 0.08), (0.9, 0.95))), colors=((0.4, 1, 1), (0.7, 1, 0.3))):
    """Pulsos de energia correndo pelos feixes em X (sentidos opostos) e os feixes respirando."""
    H, W, yy, xx = grid(img)
    breathe = 0.92 + 0.08 * np.sin(TAU * 2 * t)
    out = np.clip(img * breathe, 0, 1)
    for k, ((x0, y0), (x1, y1)) in enumerate(beams):
        col = colors[k % len(colors)]
        for j in range(3):
            u = (t * (1 + 0.5 * k) + j / 3) % 1.0
            if k % 2: u = 1 - u
            x = W * (x0 + (x1 - x0) * u); y = H * (y0 + (y1 - y0) * u)
            out = add(out, 0.9 * disc(yy, xx, x, y, 7), col)
            out = add(out, 0.35 * disc(yy, xx, x, y, 22), col)
    return out


def stage_sweep(img, t, pivot=(0.5, -0.1), runway_y=0.86, lights=9):
    """Holofote varrendo o palco (cunha girando do teto) + luzes da passarela acendendo em dominó."""
    H, W, yy, xx = grid(img)
    ang = np.arctan2(yy - H * pivot[1], xx - W * pivot[0])
    center = np.pi / 2 + np.deg2rad(32) * np.sin(TAU * t)
    wedge = np.exp(-((ang - center) ** 2) / (2 * np.deg2rad(9) ** 2)) * ramp(yy, 0.05, 0.5)
    out = screen(img, 0.35 * wedge, (1, 0.9, 0.7))
    for k in range(lights):
        phase = (t * 2 * lights - k) % lights
        lit = np.clip(1 - abs(phase - 0.5) * 2, 0, 1) if phase < 1 else 0.15
        x = W * (0.08 + 0.84 * k / (lights - 1))
        out = add(out, 0.6 * lit * disc(yy, xx, x, H * runway_y, 5), (1, 0.85, 0.5))
    return out


def mist_layers(img, t, layers=((0.55, 10, 1.0), (0.75, 18, -1.6), (0.9, 28, 2.4))):
    """Névoa em camadas: véus translúcidos deslizando em sentidos e velocidades diferentes + leve aproximação."""
    H, W, yy, xx = grid(img)
    rng = np.random.default_rng(11)
    out = zoom(img, 1 + 0.03 * (0.5 - 0.5 * np.cos(TAU * t)))
    for k, (ybase, amp, speed) in enumerate(layers):
        phase = TAU * (xx / W * (1.2 + 0.4 * k) + speed * t * 0.5)
        veil = (0.5 + 0.5 * np.sin(phase)) * (0.5 + 0.5 * np.sin(TAU * (xx / W * 0.5 + 0.3 * k + t)))
        veil *= np.exp(-((yy - H * ybase) ** 2) / (2 * (H * 0.09) ** 2))
        out = screen(out, (0.10 + 0.04 * k) * veil, (0.95, 0.97, 1.0))
    return out


def curtain_sway(img, t):
    return structural_wave(img, t, amp=3.5, periods=1.2, axis="y", travel=0.8)


def bokeh_pulse(img, t, n=22):
    """Pontos de bokeh pulsando em ritmos diferentes + zoom lento sincronizado com a pulsação."""
    H, W, yy, xx = grid(img)
    rng = np.random.default_rng(5)
    out = zoom(img, 1 + 0.04 * (0.5 + 0.5 * np.sin(TAU * t)))
    for k in range(n):
        x, y = rng.random() * W, rng.random() * H
        r = 6 + rng.random() * 16
        ph = rng.integers(1, 4)
        lit = 0.5 + 0.5 * np.sin(TAU * (ph * t + rng.random()))
        out = screen(out, 0.35 * lit * disc(yy, xx, x, y, r), (1, 0.85, 0.9))
    return out


def petal_particles(img, t, n=28):
    """Pétalas caindo em trajetórias curvas (seno horizontal), rodando e com tamanhos diferentes."""
    H, W, yy, xx = grid(img)
    rng = np.random.default_rng(9)
    out = img
    for k in range(n):
        speed = 0.4 + rng.random() * 0.6
        u = (t * speed + rng.random()) % 1.0
        x = W * ((rng.random() + 0.08 * np.sin(TAU * (u * 2 + k))) % 1.0); y = H * (u * 1.1 - 0.05)
        rx, ry = 4 + rng.random() * 4, 2 + rng.random() * 2
        ang = TAU * (t + k / n)
        dx, dy = xx - x, yy - y
        ex = (dx * np.cos(ang) + dy * np.sin(ang)) / rx; ey = (-dx * np.sin(ang) + dy * np.cos(ang)) / ry
        petal = np.exp(-(ex ** 2 + ey ** 2) / 2)
        out = screen(out, 0.55 * petal, (1, 0.6, 0.72))
    return out


def circuit_glitch(img, t, angle=-40):
    """Segmentos de circuito acendendo ao longo das diagonais + glitch controlado (fatias deslocadas) + scanline."""
    H, W, yy, xx = grid(img)
    out = img
    for k in range(5):
        pos = (t * (0.8 + 0.3 * k) + k * 0.2) % 1.0
        out = add(out, 0.5 * band(yy, xx, angle, pos, 3) * (0.5 + 0.5 * np.sin(TAU * (yy / 40 + t * 4))), (0.2, 1, 1) if k % 2 else (1, 0.2, 0.8))
    # glitch: 2 instantes curtos por loop, fatias horizontais deslocadas
    g = max(0.0, 1 - abs(((t * 2) % 1.0) - 0.5) * 25)
    if g > 0:
        rng = np.random.default_rng(int(t * 2))
        ux = xx.copy()
        for _ in range(6):
            y0 = int(rng.random() * H); h = int(4 + rng.random() * 22)
            ux[y0:y0 + h] += (rng.random() - 0.5) * 40 * g
        out = warp(out, ux, yy, mode="wrap")
        out = np.stack([out[..., 0], np.roll(out[..., 1], int(3 * g), 1), np.roll(out[..., 2], -int(3 * g), 1)], -1)
    out = out * (0.94 + 0.06 * (np.sin(TAU * yy / 3) > 0))[..., None]
    return np.clip(out, 0, 1)


def scanner_vertical(img, t):
    """Linha vertical varrendo a composição; o neon ganha brilho onde o scanner passou (revelação) e volta a dormir."""
    H, W, yy, xx = grid(img)
    pos = smooth((t * 1.0) % 1.0)
    line = band(yy, xx, 0, pos, 2.5)
    trail = np.clip(1 - (pos - xx / W) * 6, 0, 1) * (xx / W <= pos)
    bright = np.clip(img.max(-1) - 0.45, 0, 1) * 2
    out = screen(img, 0.35 * bright * trail, (1, 0.6, 1))
    out = add(out, 0.8 * line, (0.5, 1, 1))
    out = add(out, 0.3 * band(yy, xx, 0, pos, 12), (0.3, 0.9, 1))
    return np.clip(out * (0.96 + 0.04 * np.sin(TAU * 4 * t)), 0, 1)



# ----------------------------------------------------------------------------------------------- traçados por variante

def ov_measure_lines(img, t):
    """Alfaiataria: linhas de medida horizontais desenhadas da esquerda com pontos nas pontas (traçado), em cascata."""
    H, W, yy, xx = grid(img)
    m = np.zeros_like(xx)
    rows = [0.18, 0.31, 0.57, 0.74]
    for k, fy in enumerate(rows):
        p = np.clip(tri((t - k * 0.12) % 1.0) * 1.6, 0, 1)
        x0, x1 = W * (0.06 + 0.1 * (k % 2)), W * (0.4 + 0.5 * ((k + 1) % 2) * 0.9)
        m = np.maximum(m, seg(yy, xx, x0, H * fy, x1, H * fy, 1.0, p))
        m = np.maximum(m, endpoints(yy, xx, [(x0, H * fy), (x0 + (x1 - x0) * p, H * fy)], 2.0) * (p > 0))
        m = np.maximum(m, seg(yy, xx, x0, H * fy - 5, x0, H * fy + 5, 1.0) * (p > 0))
    return ink(img, m, (0.85, 0.92, 1.0), 0.9)


def ov_hexagons(img, t):
    """Cromo lilás: hexágonos aninhados (fractal) girando em sentidos opostos, o de fora desenhado progressivamente."""
    H, W, yy, xx = grid(img)
    cx, cy = W * 0.5, H * 0.46
    m = poly(yy, xx, ngon(cx, cy, 120, 6, TAU * t * 0.25), 1.1, progress=min(1, tri(t) * 1.5))
    m = np.maximum(m, poly(yy, xx, ngon(cx, cy, 78, 6, -TAU * t * 0.25), 1.0))
    m = np.maximum(m, poly(yy, xx, ngon(cx, cy, 40, 6, TAU * t * 0.5), 0.9) * pulse(t, 2))
    m = np.maximum(m, endpoints(yy, xx, ngon(cx, cy, 78, 6, -TAU * t * 0.25), 2.0))
    return ink(img, m, (1, 1, 1), 0.8)


def ov_ribbon_path(img, t):
    """Fluxo de luz: um traço fino percorre a curva da fita (desenha e apaga) com uma partícula na ponta."""
    H, W, yy, xx = grid(img)
    pts = [(W * (0.42 + 0.22 * np.sin(TAU * (u * 0.9 + 0.1))), H * (0.05 + 0.9 * u)) for u in np.linspace(0, 1, 18)]
    p = tri(t)
    m = poly(yy, xx, pts, 1.0, progress=p, close=False)
    k = min(len(pts) - 1, int(p * (len(pts) - 1)))
    m = np.maximum(m, disc(yy, xx, pts[k][0], pts[k][1], 3.0))
    return ink(img, m, (1, 0.95, 1), 0.85)


def ov_horizon_lines(img, t):
    """Crepúsculo: curvas de horizonte finas deslizando em alturas e velocidades diferentes (parallax de linhas)."""
    H, W, yy, xx = grid(img)
    m = np.zeros_like(xx)
    for k, (fy, amp, sp) in enumerate([(0.36, 6, 1), (0.52, 10, -1.5), (0.7, 14, 2)]):
        pts = [(W * u, H * fy + amp * np.sin(TAU * (u * 1.5 + sp * t * 0.3))) for u in np.linspace(0, 1, 24)]
        m = np.maximum(m, poly(yy, xx, pts, 0.9, close=False) * (0.5 + 0.5 * pulse(t, 1, k / 3)))
    return ink(img, m, (1, 0.9, 0.75), 0.75)


def ov_viewfinder(img, t):
    """Deserto: retângulo de visor expandindo do centro para as bordas (expansão geométrica) com cantos marcados."""
    H, W, yy, xx = grid(img)
    s = 0.15 + 0.8 * smooth(t)
    x0, x1 = W * (0.5 - 0.45 * s), W * (0.5 + 0.45 * s); y0, y1 = H * (0.5 - 0.42 * s), H * (0.5 + 0.42 * s)
    fade = 1 - smooth(t) ** 3
    m = rect(yy, xx, x0, y0, x1, y1, 0.9) * 0.6
    c = 10
    for (px, py, dx, dy) in [(x0, y0, 1, 1), (x1, y0, -1, 1), (x1, y1, -1, -1), (x0, y1, 1, -1)]:
        m = np.maximum(m, seg(yy, xx, px, py, px + dx * c, py, 1.4)); m = np.maximum(m, seg(yy, xx, px, py, px, py + dy * c, 1.4))
    return ink(img, m * fade, (1, 0.95, 0.85), 0.9)


def ov_sun_rings(img, t, cx=0.5, cy=0.17):
    """Dunas douradas: anéis concêntricos pulsando a partir do sol (expansão), apagando ao crescer."""
    H, W, yy, xx = grid(img)
    m = np.zeros_like(xx)
    for k in range(3):
        u = (t + k / 3) % 1.0
        m = np.maximum(m, ring(yy, xx, W * cx, H * cy, 20 + 220 * u, 1.0) * (1 - u) ** 1.5)
    return ink(img, m, (1, 0.85, 0.55), 0.8)


def ov_spine_scan(img, t):
    """Biblioteca: linhas verticais pontilhadas (lombadas lidas) caindo em velocidades diferentes."""
    H, W, yy, xx = grid(img)
    m = np.zeros_like(xx)
    for k, fx in enumerate([0.12, 0.2, 0.62, 0.7, 0.84]):
        m = np.maximum(m, dotted(yy, xx, W * fx, 0, W * fx, H, 30, 1.1, phase=t * 30 * (1 + 0.4 * k)) * 0.6)
    return ink(img, m, (1, 0.85, 0.6), 0.6)


def ov_rect_cascade(img, t):
    """Escritório: retângulos de inventário aparecendo um após o outro, da esquerda para a direita (dominó)."""
    H, W, yy, xx = grid(img)
    boxes = [(0.06, 0.1, 0.3, 0.28), (0.36, 0.22, 0.6, 0.4), (0.66, 0.12, 0.92, 0.3), (0.1, 0.62, 0.34, 0.8), (0.42, 0.7, 0.66, 0.88), (0.7, 0.58, 0.94, 0.76)]
    m = np.zeros_like(xx)
    for k, (a, b, c, d) in enumerate(boxes):
        ph = (t * len(boxes) - k) % len(boxes)
        vis = np.clip(1 - abs(ph - 1.5) / 1.5, 0, 1) if ph < 3 else 0.0
        m = np.maximum(m, rect(yy, xx, W * a, H * b, W * c, H * d, 0.9, progress=min(1, ph / 0.8) if ph < 3 else 1) * vis)
    return ink(img, m, (1, 0.95, 0.85), 0.85)


def ov_studio_frames(img, t):
    """Estúdio editorial: molduras de enquadramento ao redor do vaso e régua vertical com marcas (traçado)."""
    H, W, yy, xx = grid(img)
    m = rect(yy, xx, W * 0.3, H * 0.28, W * 0.7, H * 0.72, 0.9, progress=min(1, tri(t) * 1.4))
    m = np.maximum(m, rect(yy, xx, W * 0.34, H * 0.34, W * 0.66, H * 0.66, 0.8) * pulse(t, 2))
    for k in range(9):
        y = H * (0.2 + 0.6 * k / 8); w = 10 if k % 4 == 0 else 5
        m = np.maximum(m, seg(yy, xx, W * 0.88, y, W * 0.88 + w, y, 0.9))
    m = np.maximum(m, seg(yy, xx, W * 0.88, H * 0.2, W * 0.88, H * 0.8, 0.9))
    m = np.maximum(m, disc(yy, xx, W * 0.88, H * (0.2 + 0.6 * ((t * 2) % 1.0)), 2.4))
    return ink(img, m, (0.2, 0.2, 0.2), 0.7)


def ov_chevrons(img, t, angle=-38):
    """Diagonais esportivas: setas (chevrons) deslizando ao longo da diagonal dominante (zigue-zague)."""
    H, W, yy, xx = grid(img)
    a = np.deg2rad(angle); nx, ny = np.cos(a), np.sin(a)
    m = np.zeros_like(xx)
    for k in range(6):
        u = (t * 1.5 + k / 6) % 1.0
        cx, cy = W * 0.5 + (u - 0.5) * W * 1.3 * nx, H * 0.5 + (u - 0.5) * W * 1.3 * ny
        px, py = -ny * 12, nx * 12
        pts = [(cx - nx * 10 + px, cy - ny * 10 + py), (cx + nx * 6, cy + ny * 6), (cx - nx * 10 - px, cy - ny * 10 - py)]
        m = np.maximum(m, poly(yy, xx, pts, 1.3, close=False))
    return ink(img, m, (1, 1, 1), 0.85)


def ov_scanline_h(img, t):
    """Feixes: linha horizontal pontilhada de leitura descendo (scanner) com marcação lateral."""
    H, W, yy, xx = grid(img)
    y = H * smooth(t)
    m = dotted(yy, xx, 0, y, W, y, 40, 1.0, phase=t * 40)
    m = np.maximum(m, seg(yy, xx, W * 0.03, y - 6, W * 0.03, y + 6, 1.2))
    return ink(img, m, (0.8, 1, 1), 0.8)


def ov_floor_rings(img, t, cx=0.5, cy=0.84):
    """Palco: elipses concêntricas no piso expandindo a partir da passarela (radar)."""
    H, W, yy, xx = grid(img)
    m = np.zeros_like(xx)
    for k in range(3):
        u = (t + k / 3) % 1.0
        r = 10 + 150 * u
        d = np.sqrt((xx - W * cx) ** 2 + ((yy - H * cy) * 3.2) ** 2)
        m = np.maximum(m, np.exp(-((d - r) ** 2) / (2 * 1.1 ** 2)) * (1 - u))
    return ink(img, m, (1, 0.9, 0.7), 0.8)


def ov_rain_lines(img, t):
    """Floresta: linhas verticais finas caindo em velocidades e comprimentos diferentes (queda)."""
    H, W, yy, xx = grid(img)
    rng = np.random.default_rng(21)
    m = np.zeros_like(xx)
    for k in range(9):
        fx = rng.random(); sp = 0.6 + rng.random(); L = H * (0.12 + 0.2 * rng.random())
        y = ((t * sp + rng.random()) % 1.0) * (H + L) - L
        m = np.maximum(m, seg(yy, xx, W * fx, y, W * fx, y + L, 0.8))
    return ink(img, m, (1, 1, 1), 0.55)


def ov_edge_walker(img, t):
    """Interiores: um pequeno quadrado percorre a borda da composição (elemento caminhando pelo perímetro)."""
    H, W, yy, xx = grid(img)
    x0, y0, x1, y1 = W * 0.08, H * 0.08, W * 0.92, H * 0.92
    per = 2 * ((x1 - x0) + (y1 - y0)); u = (t % 1.0) * per
    if u < (x1 - x0): x, y = x0 + u, y0
    elif u < (x1 - x0) + (y1 - y0): x, y = x1, y0 + (u - (x1 - x0))
    elif u < 2 * (x1 - x0) + (y1 - y0): x, y = x1 - (u - (x1 - x0) - (y1 - y0)), y1
    else: x, y = x0, y1 - (u - 2 * (x1 - x0) - (y1 - y0))
    m = rect(yy, xx, x0, y0, x1, y1, 0.7) * 0.35
    m = np.maximum(m, rect(yy, xx, x - 7, y - 7, x + 7, y + 7, 1.1))
    return ink(img, m, (1, 1, 1), 0.8)


def ov_radar(img, t, cx=0.5, cy=0.5):
    """Brilho suave: círculos concêntricos + varredura de radar com pontos detectados na passagem."""
    H, W, yy, xx = grid(img)
    m = ring(yy, xx, W * cx, H * cy, 60, 0.9) * 0.6
    m = np.maximum(m, ring(yy, xx, W * cx, H * cy, 120, 0.9) * 0.6)
    m = np.maximum(m, ring(yy, xx, W * cx, H * cy, 180, 0.9) * 0.4)
    ang = TAU * t
    m = np.maximum(m, seg(yy, xx, W * cx, H * cy, W * cx + 185 * np.cos(ang), H * cy + 185 * np.sin(ang), 1.0))
    m = np.maximum(m, ring(yy, xx, W * cx, H * cy, 185, 1.0, arc=0.12, start=t - 0.12) * 0.8)
    rng = np.random.default_rng(4)
    for k in range(7):
        a = rng.random(); r = 40 + rng.random() * 140
        blip = np.clip(1 - ((t - a) % 1.0) * 3, 0, 1)
        m = np.maximum(m, disc(yy, xx, W * cx + r * np.cos(TAU * a), H * cy + r * np.sin(TAU * a), 2.5) * blip)
    return ink(img, m, (1, 1, 1), 0.75)


def ov_orbits(img, t, cx=0.5, cy=0.5):
    """Pétalas: pequenos círculos orbitando o centro em raios e velocidades diferentes (órbita)."""
    H, W, yy, xx = grid(img)
    m = np.zeros_like(xx)
    for k, (r, sp) in enumerate([(70, 1), (120, -0.6), (170, 0.4)]):
        m = np.maximum(m, ring(yy, xx, W * cx, H * cy, r, 0.7) * 0.3)
        a = TAU * (sp * t + k / 3)
        m = np.maximum(m, ring(yy, xx, W * cx + r * np.cos(a), H * cy + r * np.sin(a), 6, 1.0))
    return ink(img, m, (1, 1, 1), 0.8)


def ov_circuit_trace(img, t):
    """Circuitos: caminhos de circuito com curvas em ângulo reto desenhados progressivamente e nós piscando."""
    H, W, yy, xx = grid(img)
    paths = [[(0.05, 0.3), (0.3, 0.3), (0.3, 0.5), (0.55, 0.5), (0.55, 0.2), (0.8, 0.2)],
             [(0.95, 0.8), (0.7, 0.8), (0.7, 0.62), (0.45, 0.62), (0.45, 0.9), (0.2, 0.9)]]
    m = np.zeros_like(xx)
    for k, pts in enumerate(paths):
        p = tri((t + 0.5 * k) % 1.0)
        pts_px = [(W * x, H * y) for x, y in pts]
        m = np.maximum(m, poly(yy, xx, pts_px, 1.0, progress=p, close=False))
        for j, (x, y) in enumerate(pts_px):
            if j / (len(pts_px) - 1) <= p:
                m = np.maximum(m, disc(yy, xx, x, y, 2.3) * (0.6 + 0.4 * pulse(t, 4, j / 6)))
    return ink(img, m, (0.6, 1, 1), 0.85)


def ov_arrows_h(img, t):
    """Diagonais neon: par de linhas horizontais e setas atravessando (deslocamento direcional)."""
    H, W, yy, xx = grid(img)
    m = seg(yy, xx, 0, H * 0.5 - 3, W, H * 0.5 - 3, 0.7) * 0.5
    m = np.maximum(m, seg(yy, xx, 0, H * 0.5 + 3, W, H * 0.5 + 3, 0.7) * 0.5)
    for k in range(4):
        u = (t * 1.2 + k / 4) % 1.0; x = W * u; y = H * 0.5
        m = np.maximum(m, poly(yy, xx, [(x - 14, y - 7), (x, y), (x - 14, y + 7)], 1.3, close=False))
    return ink(img, m, (1, 1, 1), 0.85)


# ----------------------------------------------------------------------------------------------- registro
# (descrição, movimento da foto, traçado vetorial)
FAMILIES = {
    "aura_alfaiataria__cabides": ("iluminação · reflexo escovado + linhas de medida em traçado", lambda im, t: metallic_sweep(im, t, angle=-35, width=38, lines=3), ov_measure_lines),
    "aura_avantgarde_cromo__cromo_lilas": ("iluminação · prisma holográfico + hexágonos fractais contra-rotacionando", chrome_prism, ov_hexagons),
    "aura_avantgarde_cromo__fluxo_de_luz": ("ondulação estrutural · fita cromada + traço seguindo a curva", lambda im, t: structural_wave(im, t, amp=7, periods=1.4, axis="x", travel=1.0, sparkle=10), ov_ribbon_path),
    "aura_boemio_terracota__crepusculo": ("parallax · céu, montes e areia + curvas de horizonte", lambda im, t: parallax_h(im, t), ov_horizon_lines),
    "aura_boemio_terracota__deserto": ("zoom · aproximação + faixa de sol + visor em expansão", lambda im, t: zoom_light(im, t, zoom_max=1.09, angle=-20), ov_viewfinder),
    "aura_boemio_terracota__dunas_douradas": ("pulso · sol respirando + anéis concêntricos", lambda im, t: sun_pulse(im, t), ov_sun_rings),
    "aura_dark_academia__biblioteca": ("iluminação · lâmpada tremulando + zoom + lombadas pontilhadas", lambda im, t: lamp_flicker_zoom(im, t, lamp=(0.33, 0.52), r=90), ov_spine_scan),
    "aura_dark_academia__escritorio": ("dominó · luz da janela varrendo + retângulos em cascata", lambda im, t: window_wipe(im, t, angle=12, width=90), ov_rect_cascade),
    "aura_editorial_mono__estudio": ("iluminação · holofotes em sequência + molduras e régua", lambda im, t: sequential_spots(im, t), ov_studio_frames),
    "aura_esportivo_performance__diagonais": ("paralelo · faixas diagonais + chevrons em zigue-zague", lambda im, t: diagonal_bands(im, t, angle=-38), ov_chevrons),
    "aura_esportivo_performance__feixes": ("batimento · pulsos nos feixes em X + scanner horizontal", lambda im, t: beam_pulses(im, t), ov_scanline_h),
    "aura_glam_noite__palco": ("radar/palco · holofote varrendo + passarela em dominó + elipses no piso", lambda im, t: stage_sweep(im, t), ov_floor_rings),
    "aura_natural_organico__floresta": ("parallax · névoa em camadas + linhas verticais caindo", lambda im, t: mist_layers(im, t), ov_rain_lines),
    "aura_natural_organico__interiores": ("ondulação estrutural · cortina + quadrado percorrendo a borda", curtain_sway, ov_edge_walker),
    "aura_romantico_petala__brilho_suave": ("pulso · bokeh pulsante + radar com pontos detectados", lambda im, t: bokeh_pulse(im, t), ov_radar),
    "aura_romantico_petala__petalas": ("partículas · pétalas em curvas + círculos orbitando", lambda im, t: petal_particles(im, t), ov_orbits),
    "aura_streetwear_neon__circuitos": ("digital · glitch controlado + circuito traçado com nós", lambda im, t: circuit_glitch(im, t), ov_circuit_trace),
    "aura_streetwear_neon__diagonais": ("scanner · linha vertical revelando o neon + setas horizontais", scanner_vertical, ov_arrows_h),
}


def write_mp4(frames, path: Path) -> None:
    h, w = frames[0].shape[:2]
    with av.open(str(path), "w") as container:
        stream = container.add_stream("libx264", rate=FPS)
        stream.width, stream.height, stream.pix_fmt = w, h, "yuv420p"
        stream.options = {"crf": "21", "preset": "slow", "movflags": "+faststart", "profile": "high"}
        for fr in frames:
            rgb = (np.clip(fr, 0, 1) * 255).round().astype(np.uint8)
            for packet in stream.encode(av.VideoFrame.from_ndarray(rgb, format="rgb24")):
                container.mux(packet)
        for packet in stream.encode():
            container.mux(packet)


def render(vid: str) -> Path:
    desc, motion, overlay = FAMILIES[vid]
    img = load(vid)
    frames = [overlay(motion(img, f / FRAMES), f / FRAMES) for f in range(FRAMES)]
    out = OUT / f"{vid}.mp4"
    write_mp4(frames, out)
    return out


def main() -> None:
    wanted = sys.argv[1:] or list(FAMILIES)
    OUT.mkdir(parents=True, exist_ok=True)
    for i, vid in enumerate(wanted, 1):
        out = render(vid)
        print(f"[{i}/{len(wanted)}] {vid} · {FAMILIES[vid][0]} → {out.name} ({out.stat().st_size // 1024} KB)", flush=True)


if __name__ == "__main__":
    main()
