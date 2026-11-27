"""Cor: sRGB ↔ Lab (D65) e hex, em numpy, para medir a cor do tecido na foto como a vemos (diferença ΔE em Lab)."""
from __future__ import annotations

import numpy as np

_M = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
_WHITE = np.array([0.95047, 1.0, 1.08883])


def rgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    """``rgb``: (..., 3) em 0–255 → Lab (..., 3)."""
    c = np.asarray(rgb, float) / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    xyz = lin @ _M.T / _WHITE
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def lab_to_rgb(lab: np.ndarray) -> np.ndarray:
    lab = np.asarray(lab, float)
    fy = (lab[..., 0] + 16) / 116
    f = np.stack([fy + lab[..., 1] / 500, fy, fy - lab[..., 2] / 200], -1)
    xyz = np.where(f ** 3 > 0.008856, f ** 3, (f - 16 / 116) / 7.787) * _WHITE
    lin = np.clip(xyz @ np.linalg.inv(_M).T, 0, 1)
    c = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - 0.055)
    return np.clip(np.round(c * 255), 0, 255)


def to_hex(rgb) -> str:
    r, g, b = (int(v) for v in np.asarray(rgb).ravel()[:3])
    return f"#{r:02x}{g:02x}{b:02x}"


BIN = np.array([8.0, 6.0, 6.0])   # caixa do histograma em Lab
PEAKS = 64                        # caixas mais cheias que concorrem a cor da peça
SPREAD = 1.6                      # outra caixa leva só com essa vez a massa do pico (no lote: ≤ 1,3 ou ≥ 1,9)


def dominant_lab(lab: np.ndarray, radius: float = 12.0) -> np.ndarray:
    """A cor que mais aparece (pico do histograma em Lab) e a média dos pixels perto dela: a sombra das dobras e a
    estampa não puxam a média, como puxariam numa média simples.

    O pico é a caixa mais cheia, salvo quando outra das ``PEAKS`` mais cheias junta, num raio de ``2 * radius``, mais
    que ``SPREAD`` vezes os pixels do raio dele: na malha canelada furta-cor (Desigual rosa) os vãos escuros entre as
    nervuras caem todos numa caixa só e as nervuras rosa se espalham por muitas — o pico era o preto do vão."""
    pts = lab.reshape(-1, 3)
    if len(pts) > 40000:
        pts = pts[np.random.default_rng(0).choice(len(pts), 40000, replace=False)]
    keys, counts = np.unique(np.floor(pts / BIN).astype(int), axis=0, return_counts=True)
    centers = (keys[np.argsort(-counts, kind="stable")[:PEAKS]] + 0.5) * BIN
    mass = np.array([(np.linalg.norm(pts - c, axis=1) < 2 * radius).sum() for c in centers])
    peak = centers[int(np.argmax(mass))] if mass.max() > SPREAD * mass[0] else centers[0]
    near = pts[np.linalg.norm(pts - peak, axis=1) < radius]
    return near.mean(0) if len(near) else peak


# cor nominal de ``nomes_cor.color_from_name`` → família que acerta a cor medida (``match_name``)
FAMILIES = {"#1b1b1b": "preto", "#1f2a44": "marinho", "#f2f2f0": "branco", "#ece6d8": "off_white"}
NAVY_CHROMA = 0.6 * 17.6   # o marinho medido fica com pelo menos 60 % do croma do marinho nominal (#1f2a44)


def safe_gains(gains, garment_rgb) -> np.ndarray:
    """Ganhos do balanço de branco que podem ser aplicados à foto sem tirar a cor da peça.

    ``gains``: os ganhos (r, g, b) tirados do fundo; ``garment_rgb``: a cor da peça (0–255) medida **sem** os ganhos.
    O fundo sozinho não diz se a marca o tingiu de propósito (J.Crew creme: a peça está certa) ou se a foto inteira
    tem dominante (Napapijri azulada: a peça também). Por isso: peça escura (L < 25) não leva ganho — ele comia o azul
    do marinho —; peça quase neutra que o ganho deixa mais neutra leva o ganho inteiro (é dominante da foto); nos
    outros casos o ganho fica entre 0,97 e 1,03 (no máximo ~3 de b)."""
    gains = np.asarray(gains, float)
    before = rgb_to_lab(np.asarray(garment_rgb, float))
    after = rgb_to_lab(np.clip(np.asarray(garment_rgb, float) * gains, 0, 255))
    if before[0] < 25:
        return np.ones(3)
    c0, c1 = float(np.hypot(*before[1:])), float(np.hypot(*after[1:]))
    if min(c0, c1) < 10 and c1 < c0:
        return gains
    return np.clip(gains, 0.97, 1.03)


def match_name(lab, nominal_hex: str | None, solid: bool = True) -> np.ndarray:
    """A cor medida (Lab) acertada pelo nome de cor que a marca deu — só quando a medida já está perto dele.

    A foto subexposta deixa o preto entre L 2 e L 20, o marinho quase sem croma e o branco em modelo cinza (L 77–81).
    O nome é o sinal que falta: ``nominal_hex`` é o que ``nomes_cor.color_from_name`` devolve (None ou outra cor: a
    medida volta igual). Preto: L em 8–13 e sem dominante. Marinho: L ≥ 12 e croma ≥ 60 % do nominal, no matiz
    medido. Branco e off-white: só em peça lisa (``solid``) já clara e neutra — o nome "branco" de uma estampa branca
    numa camiseta preta não clareia nada —, com L ≥ 92 (branco, |b| ≤ 3) ou L ≥ 90 com o b quente (off-white)."""
    lab = np.asarray(lab, float).copy()
    family = FAMILIES.get((nominal_hex or "").lower())
    light, a, b = lab
    chroma = float(np.hypot(a, b))
    if family == "preto" and light < 30 and chroma < 12:
        scale = min(1.0, 4.0 / max(chroma, 1e-6))
        return np.array([float(np.clip(10 + 0.25 * (light - 10), 8, 13)), a * scale, b * scale])
    if family == "marinho" and light < 32 and (chroma < 8 or b < -abs(a)):
        if chroma < 3 or b >= -abs(a):           # sem matiz medido que preste: o do marinho nominal
            a, b = rgb_to_lab(np.array([0x1f, 0x2a, 0x44]))[1:]
            chroma = float(np.hypot(a, b))
        scale = max(1.0, NAVY_CHROMA / chroma)
        return np.array([max(light, 12.0), a * scale, b * scale])
    if family == "branco" and solid and light > 70 and chroma < 10:
        return np.array([max(light, 92.0), float(np.clip(a, -2, 2)), float(np.clip(b, -3, 3))])
    if family == "off_white" and solid and light > 70 and chroma < 14:
        return np.array([max(light, 90.0), float(np.clip(a, -3, 3)), float(np.clip(b, 3, 10))])
    return lab
