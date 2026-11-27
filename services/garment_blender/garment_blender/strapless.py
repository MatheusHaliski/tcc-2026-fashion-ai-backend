"""Tomara que caia, tarja, bandeau: a peça sem alça é um tubo da barra até logo abaixo da axila, um pouco mais justo
em cima (é o aperto no busto que a segura), com a borda de cima e a barra dobradas para dentro.

A barra fica onde ficaria a de uma blusa do mesmo comprimento (contado do ombro, ``comprimento``): o tubo começa
``cava + 1 cm`` abaixo do ombro. O manifesto continua com ``pontoAlto`` = comprimento, então o provador põe a barra
no mesmo lugar; o alto do tubo é que fica abaixo da axila.
"""
from __future__ import annotations

import numpy as np

from .geometry import COLUMNS, TILE, Mesh, Row, _arc, _ring, ellipse_semi_axes
from .sleeves import extend, inset
from .stitches import ring_line, stitch_line

BELOW_ARM = 1.0    # o alto do tubo fica isso abaixo da axila (cm)
GRIP = 0.96        # o anel de cima tem 96 % do tórax: segura no busto
STEP = 0.025       # anéis a cada 2,5 cm


def tube_height(m) -> float:
    """Altura do tubo (m), da barra ao alto: o comprimento menos o trecho do ombro até logo abaixo da axila."""
    return max(0.08, (m.comprimento - m.cava - BELOW_ARM) * 0.01)


def build_strapless(mesh: Mesh, m, thick: float, edge_mat: str, ribbed: bool) -> list[Row]:
    """Tubo, bordas dobradas e pespontos; devolve os anéis (para os desenhos colados na frente)."""
    H = tube_height(m)
    rows = []
    for y in np.linspace(0.0, H, max(4, int(H / STEP)) + 1):
        t = y / H
        perim = (m.barra + (m.torax * GRIP - m.barra) * t ** 1.5) * 0.01
        a, b = ellipse_semi_axes(perim, 0.68)
        rows.append(Row(float(y), a, b, "corpo"))
    rings = [_ring(r) for r in rows]
    grid = [[mesh.add(p) for p in ring] for ring in rings]
    for j in range(len(rows) - 1):
        arc0, arc1 = _arc(rings[j]), _arc(rings[j + 1])
        y0, y1 = rows[j].y / TILE, rows[j + 1].y / TILE
        for i in range(COLUMNS):
            n = (i + 1) % COLUMNS
            mesh.quad((grid[j][i], grid[j][n], grid[j + 1][n], grid[j + 1][i]),
                      [(arc0[i] / TILE, y0), (arc0[i + 1] / TILE, y0), (arc1[i + 1] / TILE, y1), (arc1[i] / TILE, y1)],
                      "corpo")
    for c in (0, COLUMNS // 2):   # costuras laterais
        mesh.seams.update(int(grid[j][c]) for j in range(len(rows)))
    hem, top = grid[0], grid[-1]
    hem_pts, top_pts = np.array([mesh.verts[i] for i in hem]), np.array([mesh.verts[i] for i in top])
    extend(mesh, hem, (0, 1, 0), [(0.0, inset(hem_pts, thick)), (0.015, inset(hem_pts, thick))], edge_mat)
    extend(mesh, top, (0, -1, 0), [(0.0, inset(top_pts, thick)), (0.02, inset(top_pts, thick))], edge_mat)
    if not ribbed:   # barra e borda de cima com pesponto a 1,2 cm
        stitch_line(mesh, *ring_line(mesh, hem, 0.012))
        stitch_line(mesh, *ring_line(mesh, top, -0.012))
    mesh.seams.update(int(v) for v in hem + top)
    return rows


def measure_tube(mesh: Mesh, rows: list[Row]) -> dict:
    """Perímetros da malha no alto (tórax) e na barra, e a altura total, em cm."""
    v = np.array(mesh.verts)
    ring = lambda r: float(_arc(_ring(r))[-1]) * 100   # noqa: E731
    return {"torax": round(ring(rows[-1]), 1), "barra": round(ring(rows[0]), 1),
            "altura_total": round(float(v[:, 1].max() - v[:, 1].min()) * 100, 1)}
