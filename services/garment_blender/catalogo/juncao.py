"""Junta os pedaços de um mesmo desenho e tira os pares espelhados que são feitio da peça.

O desenho de traço fino ou de pouco contraste (letras espaçadas, linha de texto apagada embaixo do logo) sai da foto
em vários pedaços; alguns passam no crivo (``filtros.verdict`` = 2), outros só ficam de pé ao lado de um que passou
(= 1). Aqui os vizinhos viram um desenho só — um decalque, um lugar. Dois achados pequenos iguais, um de cada lado do
eixo na mesma altura, são ponta de gola, bolso, botão do trespasse ou platina: feitio, não estampa.
"""
from __future__ import annotations

import numpy as np

from .estampa import Group

NEAR = 0.025     # pedaços a até 2,5 cm um do outro (m) são o mesmo desenho
PAIR = 0.06      # só o achado pequeno (lado maior até 6 cm) pode ser metade de um par de feitio


def mirrored(items: list[tuple]) -> set[int]:
    """Índices dos achados da frente que formam par espelhado no eixo. ``items``: (grupo, lugar, veredito)."""
    out = set()
    for i, (_, a, _) in enumerate(items):
        for j, (_, b, _) in enumerate(items):
            if j <= i or a["lado"] != "frente" or b["lado"] != "frente":
                continue
            size_a, size_b = max(a["largura"], a["altura"]), max(b["largura"], b["altura"])
            if max(size_a, size_b) > PAIR or not 0.5 < size_a / size_b < 2.0 or min(abs(a["x"]), abs(b["x"])) < 0.03:
                continue
            if abs(a["x"] + b["x"]) < 0.025 and abs(a["abaixo_do_ombro"] - b["abaixo_do_ombro"]) < 0.025:
                out.update((i, j))
    return out


def _gap(a: tuple, b: tuple) -> float:
    """Distância (px) entre duas caixas (y0, y1, x0, x1); 0 quando se tocam ou se cobrem."""
    dy = max(a[0] - b[1], b[0] - a[1], 0)
    dx = max(a[2] - b[3], b[2] - a[3], 0)
    return float(np.hypot(dx, dy))


def union(a: Group, b: Group) -> Group:
    """Os dois pedaços num grupo só, na caixa que cobre os dois."""
    y0, y1 = min(a.box[0], b.box[0]), max(a.box[1], b.box[1])
    x0, x1 = min(a.box[2], b.box[2]), max(a.box[3], b.box[3])
    alpha = np.zeros((y1 - y0, x1 - x0), bool)
    fill = np.zeros_like(alpha)
    for g in (a, b):
        sl = (slice(g.box[0] - y0, g.box[1] - y0), slice(g.box[2] - x0, g.box[3] - x0))
        alpha[sl] |= g.alpha
        if g.fill is not None:
            fill[sl] |= g.fill
    area = a.area + b.area
    return Group((y0, y1, x0, x1), area, alpha, (a.contrast * a.area + b.contrast * b.area) / area,
                 fill if fill.any() else None)


def merge(items: list[tuple], ppm: float, place) -> list[tuple]:
    """Os desenhos finais (grupo, lugar): cada achado aceito puxa os vizinhos (aceitos ou pedaços) do mesmo lado, até
    não haver mais vizinho. ``place``: caixa → lugar (None quando a caixa junta não cabe em lugar nenhum; aí a junção
    não é feita)."""
    pool = [(g, w, v) for g, w, v in items]
    out = []
    while True:
        k = next((k for k, it in enumerate(pool) if it[2] == 2), None)
        if k is None:
            break
        g, where, _ = pool.pop(k)
        grew = True
        while grew:
            grew = False
            for j, (h, wh, _) in enumerate(pool):
                if wh["lado"] != where["lado"] or _gap(g.box, h.box) > NEAR * ppm or h.contrast < 0.4 * g.contrast:
                    continue
                both = union(g, h)
                spot = place(both.box)
                if spot is None or spot["lado"] != where["lado"]:
                    continue
                g, where, grew = both, spot, True
                pool.pop(j)
                break
        out.append((g, where))
    return sorted(out, key=lambda it: -it[0].area)
