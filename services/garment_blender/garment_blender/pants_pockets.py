"""Bolsos da calça com a costura de verdade: o bolso de trás do jeans (cinco lados, pesponto duplo, arcos e travetas),
o bolso chapado de trabalho, o bolso embutido (vivo) da alfaiataria e da chino, a boca do bolso da frente com o
espelho e as travetas, o bolso cargo com lapela e pressão, e o bolso na costura lateral do short e do moletom.

Traveta: o ponto denso que trava a ponta de um bolso (onde ele leva o puxão da mão) — aqui uma barrinha de linha de
7 mm por 2 mm. Pesponto duplo: duas linhas a 6 mm uma da outra.
"""
from __future__ import annotations

import math

import numpy as np

from .closures import box
from .details import FRONT, patch, surface
from .geometry import Mesh, Row
from .pants_details import BACK
from .stitches import stitch_line

DETAIL = "detalhe"
POCKET_LIFT = 0.0025   # o bolso chapado fica 2,5 mm acima do tecido; a linha dele, um pouco acima disso


def _line(mesh: Mesh, rows, points, lift: float = 0.0008, part: str = DETAIL, steps: int = 24) -> np.ndarray:
    """Pesponto sobre o tronco da calça pelos pontos (theta, y); devolve os pontos da linha."""
    pts, nrm = [], []
    for (t0, y0), (t1, y1) in zip(points, points[1:]):
        for s in np.linspace(0, 1, steps, endpoint=False):
            p, n = surface(rows, t0 + (t1 - t0) * s, y0 + (y1 - y0) * s)
            pts.append(p + n * lift); nrm.append(n)
    p, n = surface(rows, *points[-1])
    pts.append(p + n * lift); nrm.append(n)
    stitch_line(mesh, np.array(pts), np.array(nrm), part=part)
    return np.array(pts)


def bar_tack(mesh: Mesh, rows, theta: float, y: float, lift: float, along=(0.0, 1.0, 0.0)) -> None:
    """Traveta: barrinha de linha densa travando a ponta do bolso."""
    p, n = surface(rows, theta, y)
    a = np.asarray(along, float); a = a - n * a.dot(n); a /= max(np.linalg.norm(a), 1e-9)
    box(mesh, p + n * lift, a, np.cross(n, a), n, (0.007, 0.002, 0.0008), "linha", DETAIL)


def back_patch(mesh: Mesh, rows: list[Row], band0: float, jeans: bool) -> None:
    """Bolsos chapados de trás: o do jeans tem cinco lados (ponta embaixo) e os arcos; o de trabalho é retangular.
    Os dois com pesponto duplo nas laterais e no fundo, a bainha dobrada da boca pespontada e as travetas nos cantos."""
    a = rows[len(rows) // 2].a
    top, bottom = (band0 - 0.075, band0 - 0.21) if jeans else (band0 - 0.05, band0 - 0.20)
    point = 0.022 if jeans else 0.0
    for sgn in (1, -1):
        c, w = BACK + sgn * 0.085 / a, 0.07 / a
        corners = [(c - w, bottom + point), (c + w, bottom + point), (c + w, top), (c - w, top)]
        patch(mesh, rows, corners, POCKET_LIFT, "corpo", (True, True, False, True), (8, 6), point=point)
        lift = POCKET_LIFT + 0.0008
        inner = 0.010 / a                                    # segunda agulha: 1 cm para dentro da borda
        _line(mesh, rows, [(c - w + inner, top - 0.004), (c - w + inner, bottom + point + 0.008),
                           (c, bottom + 0.008), (c + w - inner, bottom + point + 0.008), (c + w - inner, top - 0.004)],
              lift)
        _line(mesh, rows, [(c - w, top - 0.016), (c + w, top - 0.016)], lift)   # bainha da boca do bolso
        for th in (c - w + 0.002 / a, c + w - 0.002 / a):
            bar_tack(mesh, rows, th, top - 0.006, lift + 0.0004)
        if jeans:                                            # os arcos (o desenho da marca)
            wb = 0.055 / a
            for dy in (0.0, 0.008):
                _line(mesh, rows, [(c - wb, top - 0.05 - dy), (c, top - 0.075 - dy), (c + wb, top - 0.05 - dy)], lift + 0.0002)


def welt_pockets(mesh: Mesh, rows: list[Row], band0: float) -> None:
    """Bolso embutido (vivo duplo) de trás da alfaiataria e da chino: a fenda de 13 cm com dois lábios, travetas nas
    pontas e o botão logo abaixo, no meio."""
    from .buttons import button
    a = rows[len(rows) // 2].a
    y = band0 - 0.075
    for sgn in (1, -1):
        c, w = BACK + sgn * 0.085 / a, 0.065 / a
        for y0, y1 in ((y, y + 0.006), (y - 0.006, y)):     # os dois lábios, um de cada lado da fenda
            patch(mesh, rows, [(c - w, y0), (c + w, y0), (c + w, y1), (c - w, y1)], 0.0012, "corpo",
                  (True, True, True, True), (8, 1))
        _line(mesh, rows, [(c - w, y + 0.0075), (c + w, y + 0.0075)], 0.0018)
        _line(mesh, rows, [(c - w, y - 0.0075), (c + w, y - 0.0075)], 0.0018)
        for th in (c - w, c + w):
            bar_tack(mesh, rows, th, y, 0.002)
        p, n = surface(rows, c, y - 0.022)
        button(mesh, p + n * 0.0015, n, 0.0055)


def front_mouths(mesh: Mesh, rows: list[Row], band0: float, jeans: bool) -> list[tuple[float, float]]:
    """Boca do bolso da frente pespontada; fora do jeans, a segunda linha do espelho e as travetas nas pontas.
    Devolve as pontas (theta, y) — no jeans viram rebites."""
    a = rows[len(rows) // 2].a
    ends = []
    for sgn in (1, -1):
        start, side = FRONT - sgn * 0.09 / a, (0.0 if sgn > 0 else math.pi) + sgn * 0.02
        pts = [(start, band0), (FRONT - sgn * 0.13 / a, band0 - 0.07), (side, band0 - 0.09)] if jeans else \
              [(start, band0), (side, band0 - 0.16)]
        _line(mesh, rows, pts)
        if not jeans:   # espelho: a segunda linha, 8 mm para dentro do bolso
            shift = sgn * 0.008 / a
            _line(mesh, rows, [(t + shift, y - 0.002) for t, y in pts])
            for t, y in (pts[0], pts[-1]):
                bar_tack(mesh, rows, t, y - (0.004 if y == band0 else -0.004), 0.0012, (math.cos(t), 0.0, 0.0))
        ends += [pts[0], pts[-1]]
    return ends


def side_seam_pockets(mesh: Mesh, rows: list[Row], band0: float) -> None:
    """Bolso na costura lateral (short, moletom): a abertura de 15 cm na lateral, pespontada, com travetas."""
    for side in (0.02, math.pi - 0.02):
        top, low = band0 - 0.03, band0 - 0.18
        _line(mesh, rows, [(side, top), (side, low)])
        for y in (top, low):
            bar_tack(mesh, rows, side, y, 0.0012, (0.0, 0.0, 1.0))


def cargo_details(mesh: Mesh, legs: list[list[Row]], knee: float) -> None:
    """Bolso cargo: pesponto em volta da lapela, a pressão de metal no meio dela e as travetas no alto do bolso."""
    for rows, outer, part in zip(legs, (0.0, math.pi), ("perna_d", "perna_e")):
        stack = sorted(rows, key=lambda r: r.y)
        a = min(rows, key=lambda r: abs(r.y - (knee + 0.16))).a
        w, yt = 0.09 / a, knee + 0.26
        lift = 0.0075 + 0.0008
        _line(mesh, stack, [(outer - w * 0.9, yt - 0.058), (outer + w * 0.9, yt - 0.058)], lift, f"{DETAIL}@{part}")
        _line(mesh, stack, [(outer - w * 0.9, yt + 0.004), (outer + w * 0.9, yt + 0.004)], lift, f"{DETAIL}@{part}")
        p, n = surface(stack, outer, yt - 0.04)
        side = np.cross(n, [0.0, 1.0, 0.0]); side /= max(np.linalg.norm(side), 1e-9)
        box(mesh, p + n * (lift + 0.0005), np.array([0.0, 1.0, 0.0]), side, n, (0.011, 0.011, 0.003), "dentes",
            f"{DETAIL}@{part}")
