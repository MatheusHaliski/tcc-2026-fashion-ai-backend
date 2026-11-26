"""Onde cada desenho achado na foto fica na peça 3D: na frente (``x`` do centro e ``abaixo_do_ombro``, em metros) ou
numa manga (distância da ponta do ombro manga abaixo), e o que não fica em lugar nenhum (lasca, cordão, gola por
dentro, a roupa de baixo aparecendo pela frente aberta).
"""
from __future__ import annotations

import math

import numpy as np

FLAT_HALF = 1.3     # peça deitada: meia largura da frente ≈ ¼ da volta ≈ 1,3 × a (tronco de seção elíptica, b = 0,68·a)


def torso_half(mask: np.ndarray, frame) -> float | None:
    """Meia largura do tronco que aparece na foto em modelo (px): o trecho de peça que passa pelo eixo, da cintura ao
    quadril (de 55 % a 80 % da altura), onde o braço caído costuma já estar separado do corpo. A mediana das linhas;
    None quando não dá para medir."""
    halves = []
    for y in np.linspace(frame.top + 0.55 * frame.height, frame.top + 0.8 * frame.height, 9).astype(int):
        if not 0 <= y < mask.shape[0]:
            continue
        xs = np.flatnonzero(mask[y])
        if len(xs) == 0:
            continue
        runs = np.split(xs, np.flatnonzero(np.diff(xs) > 1) + 1)
        run = next((r for r in runs if r[0] <= frame.center <= r[-1]), None)
        if run is not None:
            halves.append((run[-1] - run[0]) / 2)
    return float(np.median(halves)) if halves else None


def placement(box, frame, ppm: float, chest_a: float, sleeve: dict | None, half_px: float | None = None
              ) -> dict | None:
    """Lugar do desenho na peça (m): ``x`` do centro da frente (+ = lado esquerdo de quem veste, à direita na foto),
    ``abaixo_do_ombro`` do centro do desenho e ``largura``. Na foto em modelo a distância ao centro é projeção do
    tronco redondo: vira arco (a·arcsen), medida contra a meia largura do tronco que a foto mostra (``half_px``) — o
    casaco fofo ou a pessoa maior que a base não empurram o logo do peito para a manga. A frente vai, na foto em
    modelo, até ±a e, na peça deitada, até ±¼ da volta; o desenho com o centro fora dela é de manga."""
    y0, y1, x0, x1 = box
    raw_x = ((x0 + x1) / 2 - frame.center) / ppm
    width, height = (x1 - x0) / ppm, (y1 - y0) / ppm
    below = ((y0 + y1) / 2 - frame.top) / ppm
    if frame.worn:
        seen = half_px / ppm if half_px else chest_a
        seen = min(max(seen, 0.8 * chest_a), 1.8 * chest_a)
        x = chest_a * math.asin(max(-0.98, min(0.98, raw_x / seen)))
        zone = 0.85 * chest_a
    else:
        x, zone = raw_x, 0.85 * FLAT_HALF * chest_a
    spans = x0 < frame.center < x1 and abs(x) < zone   # o desenho largo que passa pelo eixo é da frente
    if abs(x) + width / 4 > zone and not spans:
        return on_sleeve(raw_x, below, width, height, sleeve) if sleeve else None
    big = spans and min(width, height) >= 0.15   # a estampa grande do peito pode encostar no ombro ou na barra
    if not big and (below - height / 2 < 0.02 or below + height / 2 > 0.97 * frame.height / ppm):
        return None
    return {"x": round(x, 4), "abaixo_do_ombro": round(below, 4), "largura": round(width, 4),
            "altura": round(height, 4), "lado": "frente"}


def on_sleeve(x: float, below: float, width: float, height: float, sleeve: dict) -> dict | None:
    """Desenho na manga: a distância é da ponta do ombro (meio ombro para o lado, a queda do ombro para baixo) ao
    centro do desenho, manga abaixo; o lado é o de quem veste (à direita na foto = manga esquerda). A estampa comprida
    que desce a manga (a da Champion) cabe até 0,9 do comprimento."""
    dx, dy = abs(x) - sleeve["meia_ombro"], below - sleeve["queda"]
    along = math.hypot(max(dx, 0.0), dy)
    if dy < 0 or not 0.04 < along < sleeve["comprimento"] - 0.03 or max(width, height) > 0.9 * sleeve["comprimento"]:
        return None
    return {"x": 0.0, "abaixo_do_ombro": round(along, 4), "largura": round(width, 4), "altura": round(height, 4),
            "lado": "manga_esquerda" if x > 0 else "manga_direita"}


def keep(where: dict, frame, avoid_center: bool, neck: float) -> bool:
    """Desenho que é mesmo desenho e está no pano: nem lasca, nem cordão do capuz ou cadarço do zíper no meio, nem o
    fundo da gola aparecendo pelo decote (o V), nem o que aparece pela frente aberta vestida (o meio e o V mostram a
    roupa de baixo), nem botão da vista."""
    w, h, x = where["largura"], where["altura"], where["x"]
    if min(w, h) < 0.008 or w * h < 0.0002:
        return False
    if where["lado"] != "frente":
        return True
    if h > 2.5 * w and abs(x) < 0.08 and w < 0.03:
        return False
    if abs(x) < 0.05 and where["abaixo_do_ombro"] - h / 2 < neck + 0.02:
        return False
    if avoid_center and abs(x) < 0.04 and max(w, h) < 0.04:
        return False
    return not (avoid_center and frame.worn and (abs(x) < w / 2 + 0.01 or (abs(x) < 0.04 and
                                                                         where["abaixo_do_ombro"] < 0.35)))


def open_front(mask: np.ndarray, frame) -> bool:
    """A peça está vestida aberta: no eixo, do peito à cintura, mais de um terço das linhas não é a peça (aparece a
    roupa de baixo ou a pele)."""
    c = int(round(frame.center))
    if not frame.worn or not 2 <= c < mask.shape[1] - 2:
        return False
    rows = slice(int(frame.top + 0.15 * frame.height), int(frame.top + 0.7 * frame.height))
    return bool((~mask[rows, c - 2:c + 3].any(1)).mean() > 0.33)
