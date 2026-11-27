"""Body: a parte de cima continua abaixo da barra até fechar no gancho, com as duas aberturas das pernas.

A blusa é construída como sempre (a barra em y = 0, sem a dobra da barra); depois sobe ``BRIEF`` metros e a calcinha
é costurada no anel da barra: anéis que passam pelo quadril e fecham no gancho (a mesma ponte da calça,
``pants.crotch_loops``), e cada perna termina num elástico dobrado. Uma malha só, sem costura aberta na cintura.
"""
from __future__ import annotations

import numpy as np

from .geometry import COLUMNS, TILE, Mesh, Row, _arc, _ring, ellipse_semi_axes
from .pants import crotch_loops
from .sleeves import extend, inset

BRIEF = 0.16         # da barra da blusa ao gancho (m)
CROTCH = 0.02        # altura do gancho acima do fim do body (m)


def raise_mesh(mesh: Mesh, dy: float) -> None:
    mesh.verts = [(x, y + dy, z) for x, y, z in mesh.verts]


def add_brief(mesh: Mesh, hem: list[int], hem_perimeter: float, thick: float, mat: str = "corpo") -> dict:
    """Sobe a blusa ``BRIEF`` e costura a calcinha no anel da barra (``hem``, ``COLUMNS`` vértices na ordem das
    colunas). Devolve as medidas da calcinha (cm) para o relatório."""
    raise_mesh(mesh, BRIEF)
    hip = hem_perimeter * 1.04
    ys = np.linspace(CROTCH, BRIEF, 9)[:-1]           # o último anel é a própria barra da blusa
    rows = []
    for y in ys:
        t = (y - CROTCH) / (BRIEF - CROTCH)
        perim = hip * (0.88 + 0.12 * np.sin(np.pi * min(1.0, t * 1.4) / 2)) if t < 0.72 else hip + (hem_perimeter - hip) * (t - 0.72) / 0.28
        a, b = ellipse_semi_axes(perim, 0.72)
        rows.append(Row(float(y), a, b, mat))
    grid = [[mesh.add(p) for p in _ring(r)] for r in rows] + [list(hem)]
    pts = [np.array([mesh.verts[i] for i in ring]) for ring in grid]
    for j in range(len(grid) - 1):
        a0, a1 = _arc(pts[j]), _arc(pts[j + 1])
        v0, v1 = pts[j][:, 1].mean() / TILE, pts[j + 1][:, 1].mean() / TILE
        for i in range(COLUMNS):
            n = (i + 1) % COLUMNS
            mesh.quad((grid[j][i], grid[j][n], grid[j + 1][n], grid[j + 1][i]),
                      [(a0[i] / TILE, v0), (a0[i + 1] / TILE, v0), (a1[i + 1] / TILE, v1), (a1[i] / TILE, v1)], mat)
    right, left, bridge = crotch_loops(mesh, np.array(grid[0]))
    mesh.seams.update(bridge)
    for loop in (right, left):                         # elástico das pernas, dobrado para dentro
        lp = np.array([mesh.verts[i] for i in loop])
        extend(mesh, loop, (0, 1, 0), [(0.0, inset(lp, thick)), (0.012, inset(lp, thick))], mat)
    return {"quadril_body": round(hip * 100, 1), "gancho_body": round(BRIEF * 100, 1)}
