"""Faixas de manga: o punho de outra cor, o friso e as listras que dão a volta na manga perto da barra dela.

Só detecta — o resultado vai para a ``origem`` da ficha, o motor ainda não desenha faixa. Cada manga é o que sobra da
peça para fora do ombro; ao longo dela (da ponta do ombro à ponta mais distante da manga) mede-se, fatia por fatia,
quanto do pano foge da cor do tecido. Faixa é um trecho de fatias quase todas de outra cor, estreito perto do
comprimento da manga; só vale quando as duas mangas mostram a mesma faixa (a mão, a dobra e a sombra do braço não
se repetem iguais dos dois lados).
"""
from __future__ import annotations

import numpy as np

from .cores import lab_to_rgb, to_hex
from .estampa import THRESHOLD

FULL = 0.6        # fração da fatia de outra cor para a fatia ser de faixa
MIN_W = 0.006     # faixa mais estreita (m): o friso do punho
MAX_PART = 0.45   # faixa mais larga, em fração do comprimento da manga (mais que isso é manga de outra cor)


def _side(dist, lab, mask, frame, ppm: float, sleeve: dict, sign: int) -> tuple[list[dict], float]:
    """As faixas de uma manga (``sign`` +1 = à direita na foto, a manga esquerda de quem veste) e o comprimento
    visto dela (m). O eixo da manga vai da ponta do ombro à ponta mais distante dela."""
    tip_x = frame.center + sign * sleeve["meia_ombro"] * ppm
    tip_y = frame.top + sleeve["queda"] * ppm
    ys, xs = np.nonzero(mask)
    out = (xs - tip_x) * sign > 0
    ys, xs = ys[out], xs[out]
    if len(ys) < 150:
        return [], 0.0
    far = np.hypot(xs - tip_x, ys - tip_y)
    k = int(np.argmax(far))
    length = float(far[k])
    if length < 0.06 * ppm:
        return [], 0.0
    ux, uy = (xs[k] - tip_x) / length, (ys[k] - tip_y) / length
    values, vectors = np.linalg.eigh(np.cov(np.vstack([xs, ys])))
    if values[1] > 2.5 * values[0]:   # manga comprida na foto: o eixo dela é o da própria mancha, não a diagonal
        ax, ay = vectors[:, 1]
        ux, uy = (ax, ay) if ax * ux + ay * uy > 0 else (-ax, -ay)
        length = float(((xs - tip_x) * ux + (ys - tip_y) * uy).max())
    along = (xs - tip_x) * ux + (ys - tip_y) * uy
    step = max(1.0, 0.003 * ppm)
    bins = np.clip((along / step).astype(int), 0, None)
    n = int(bins.max()) + 1
    other = dist[ys, xs] > THRESHOLD
    count = np.bincount(bins, minlength=n).astype(float)
    frac = np.bincount(bins, weights=other, minlength=n) / np.maximum(count, 1)
    hit = (frac > FULL) & (count >= 0.25 * np.median(count[count > 0]))
    bands, start = [], None
    for i in range(n + 1):
        on = i < n and hit[i]
        if on and start is None:
            start = i
        elif not on and start is not None:
            width = (i - start) * step / ppm
            if MIN_W <= width <= MAX_PART * length / ppm:
                sel = (bins >= start) & (bins < i) & other
                color = np.median(lab[ys[sel], xs[sel]], 0)
                bands.append({"distancia_m": round((start + i) / 2 * step / ppm, 4), "largura_m": round(width, 4),
                              "cor": to_hex(lab_to_rgb(color)), "_lab": color})
            start = None
    return bands, length / ppm


def sleeve_bands(dist: np.ndarray, lab: np.ndarray, mask: np.ndarray, frame, ppm: float, sleeve: dict | None
                 ) -> list[dict]:
    """``[{lado, distancia_m, largura_m, cor}]``: as faixas que aparecem nas duas mangas, à mesma distância da ponta
    da manga (medida de volta a partir da barra dela, que é o que as duas fotos de manga têm em comum) e da mesma
    cor. ``distancia_m`` é da ponta do ombro ao meio da faixa, manga abaixo."""
    if sleeve is None or frame.worn or frame.symmetry < 0.72:
        return []
    left, len_l = _side(dist, lab, mask, frame, ppm, sleeve, -1)
    right, len_r = _side(dist, lab, mask, frame, ppm, sleeve, 1)
    out = []
    for a in right:
        for b in left:
            same_place = abs((len_r - a["distancia_m"]) - (len_l - b["distancia_m"])) < 0.02
            same_width = 0.5 < a["largura_m"] / b["largura_m"] < 2.0
            if same_place and same_width and float(np.linalg.norm(a["_lab"] - b["_lab"])) < 20:
                for side, band in (("manga_esquerda", a), ("manga_direita", b)):
                    out.append({"lado": side, **{k: v for k, v in band.items() if k != "_lab"}})
                break
    return out
