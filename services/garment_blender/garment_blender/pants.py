"""Calça (sem Blender): tubo da cintura ao gancho, as duas pernas separadas por uma ponte de costura no gancho, a barra
reta dobrada ou o punho de ribana, e o cós. Metros, Y para cima, frente +Z, barra em y = 0, pernas na vertical.

As costas sobem mais que a frente (o gancho de trás é maior): o topo do cós desce na frente. A perna nasce do contorno
do gancho (metade do anel + a ponte) e vai, aos poucos, para a elipse da coxa, do joelho e da barra.
"""
from __future__ import annotations

import math

import numpy as np

from .geometry import COLUMNS, TILE, Mesh, Row, _arc, _ring, ellipse_semi_axes
from .sizes_pants import PantsMeasures

BRIDGE = 8          # segmentos da costura do gancho (frente → costas, por baixo)
BLEND = 0.10        # do gancho até a coxa a seção muda aos poucos (m)
LEG_RATIO = 0.92


def upper_rows(m: PantsMeasures) -> tuple[list[Row], int]:
    """Anéis do gancho ao topo do cós; devolve também o índice do primeiro anel do cós."""
    cm = 0.01
    y_c, front_top = m.entreperna * cm, (m.entreperna + m.gancho_frente) * cm
    lift = (m.gancho_costas - m.gancho_frente) * 0.3 * cm          # quanto as costas sobem acima da frente
    top = front_top + lift
    band0 = top - m.cos * cm
    theta = np.linspace(0, 2 * np.pi, COLUMNS, endpoint=False)
    front = np.clip(np.sin(theta), 0, None)
    hip_y = top - 0.18
    rows, i_band = [], 0
    ys = list(np.linspace(y_c, band0, max(6, int((band0 - y_c) / 0.015)) + 1))
    for y in ys + list(np.linspace(band0, top, 4)[1:]):
        if y <= hip_y:
            t = (y - y_c) / max(hip_y - y_c, 1e-6)
            perim = (m.quadril * (0.97 + 0.03 * t)) * cm
        else:
            t = min(1.0, (y - hip_y) / max(band0 - hip_y, 1e-6))
            perim = (m.quadril + (m.cintura - m.quadril) * t) * cm
        a, b = ellipse_semi_axes(perim, 0.72)
        k = float(np.clip((y - hip_y) / (top - hip_y), 0, 1))
        mat = "cos" if y > band0 + 1e-6 else "corpo"
        if mat == "cos" and not i_band:
            i_band = len(rows) - 1
        rows.append(Row(y, a, b, mat, front * lift * k))
    return rows, i_band


def build_upper(mesh: Mesh, rows: list[Row]) -> np.ndarray:
    grid = np.array([[mesh.add(p) for p in _ring(r)] for r in rows])
    rings = [_ring(r) for r in rows]
    for j in range(len(rows) - 1):
        a0, a1 = _arc(rings[j]), _arc(rings[j + 1])
        y0, y1 = rows[j].y / TILE, rows[j + 1].y / TILE
        mat = "cos" if rows[j + 1].mat == "cos" else "corpo"
        for i in range(COLUMNS):
            n = (i + 1) % COLUMNS
            mesh.quad((grid[j, i], grid[j, n], grid[j + 1, n], grid[j + 1, i]),
                      [(a0[i] / TILE, y0), (a0[i + 1] / TILE, y0), (a1[i + 1] / TILE, y1), (a1[i] / TILE, y1)], mat)
    return grid


def crotch_loops(mesh: Mesh, ring: np.ndarray) -> tuple[list[int], list[int], list[int]]:
    """Contornos das duas pernas no anel do gancho: metade do anel + a ponte (frente → costas, um pouco mais baixa)."""
    fc, bc = COLUMNS // 4, 3 * COLUMNS // 4
    pf, pb = np.array(mesh.verts[ring[fc]]), np.array(mesh.verts[ring[bc]])
    bridge = []
    for j in range(1, BRIDGE):
        t = j / BRIDGE
        p = pf * (1 - t) + pb * t
        p[0], p[1] = 0.0, p[1] - 0.012 * math.sin(math.pi * t)
        bridge.append(mesh.add(p))
    right = [int(ring[c % COLUMNS]) for c in range(bc, COLUMNS + fc + 1)] + bridge
    left = [int(ring[c]) for c in range(fc, bc + 1)] + bridge[::-1]
    return right, left, bridge


def leg_rows(m: PantsMeasures, side: int, hip_a: float) -> list[Row]:
    """Estações da perna (de cima para baixo), como anéis com centro em x: coxa, joelho, barra (e o punho)."""
    cm, y_c = 0.01, m.entreperna * 0.01
    cx = side * hip_a * 0.5
    rib = m.ribana_barra * cm
    above = (m.barra * (1.35 if rib else 1.0)) * cm
    st = [(y_c - BLEND * t, None, "corpo") for t in (0.25, 0.5, 0.75)]
    st += [(y_c - BLEND, m.coxa * cm, "corpo"), (y_c * 0.45, m.joelho * cm, "corpo"), (rib + 0.004, above, "corpo")]
    if rib:
        st += [(rib, m.barra * cm, "ribana"), (rib / 2, m.barra * cm, "ribana"), (0.0, m.barra * cm, "ribana")]
    else:
        st.append((0.0, m.barra * cm, "corpo"))
    rows = []
    for y, perim, mat in st:
        a, b = ellipse_semi_axes(perim or m.coxa * cm, LEG_RATIO)
        rows.append(Row(y, a, b, mat, cx=cx - side * 0.012 * (1 - y / y_c)))   # a perna fecha um pouco até a barra
    return rows


def build_leg(mesh: Mesh, loop: list[int], rows: list[Row], part: str) -> list[int]:
    """Perna a partir do contorno do gancho; devolve a boca da barra (na ordem do contorno)."""
    p0 = np.array([mesh.verts[i] for i in loop])
    c = p0.mean(0)
    phi = np.arctan2(p0[:, 2] - c[2], p0[:, 0] - c[0])
    perim0 = float(_arc(p0)[-1])
    rings, pts_rows, y_c = [list(loop)], [p0], c[1]
    for r in rows:
        ell = np.stack([r.cx + r.a * np.cos(phi), np.full(len(phi), r.y), r.b * np.sin(phi)], 1)
        w = min(1.0, (y_c - r.y) / BLEND); w = w * w * (3 - 2 * w)
        if w < 1:
            k = float(_arc(ell)[-1]) / perim0
            shape = c + (p0 - c) * k
            shape[:, 1] = r.y
            ell = shape * (1 - w) + ell * w
        rings.append([mesh.add(p) for p in ell]); pts_rows.append(ell)
    n = len(loop)
    for k in range(len(rings) - 1):
        a0, a1 = _arc(pts_rows[k]), _arc(pts_rows[k + 1])
        v0, v1 = pts_rows[k][:, 1].mean() / TILE, pts_rows[k + 1][:, 1].mean() / TILE
        mat = "ribana" if rows[k].mat == "ribana" and (k == 0 or rows[k - 1].mat == "ribana") else "corpo"
        for i in range(n):
            j = (i + 1) % n
            mesh.quad((rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]),
                      [(a0[i] / TILE, v0), (a0[i + 1] / TILE, v0), (a1[i + 1] / TILE, v1), (a1[i] / TILE, v1)], mat, part)
    inner = int(np.argmin(np.abs(p0[:, 0])))       # entreperna: o ponto do contorno mais perto do meio
    outer = int(np.argmax(np.abs(p0[:, 0])))       # costura lateral
    mesh.seams.update(int(ring[inner]) for ring in rings)
    mesh.seams.update(int(ring[outer]) for ring in rings)
    return rings[-1]
