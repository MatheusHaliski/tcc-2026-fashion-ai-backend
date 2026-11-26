"""Saia (sem Blender): tubo do cós à barra que abre do quadril para baixo (a roda), com pregas opcionais, e a saia de
cima da saia-short. Metros, Y para cima, frente +Z, barra em y = 0 (na saia-short, a barra da saia fica onde ela cai).

A roda é a razão barra ÷ quadril: 1 é uma saia reta, 1,6 uma midi evasê. As pregas são faca: a borda de cada uma sai
e volta em dente de serra ao redor da saia, mais funda na barra e sumindo no quadril (onde a prega é costurada).
"""
from __future__ import annotations

import math

import numpy as np

from .geometry import COLUMNS, Mesh, Row, ellipse_semi_axes
from .pants import build_upper
from .sizes_pants import PantsMeasures

HIP_DROP = 0.18      # do topo do cós até a linha do quadril (m), como na calça


def _perimeter(m: PantsMeasures, y: float, hip_y: float, band0: float, hem_y: float, roda: float) -> float:
    cm = 0.01
    if y >= hip_y:   # do quadril ao cós: estreita até a cintura
        t = min(1.0, (y - hip_y) / max(band0 - hip_y, 1e-6))
        return (m.quadril + (m.cintura - m.quadril) * t) * cm
    t = (hip_y - y) / max(hip_y - hem_y, 1e-6)   # do quadril à barra: abre até a roda
    return m.quadril * (1 + (roda - 1) * t ** 0.9) * cm


def skirt_rows(m: PantsMeasures, length_cm: float, roda: float, with_band: bool = True,
               bottom: float = 0.0) -> tuple[list[Row], int]:
    """Anéis da barra (y = ``bottom``) ao topo (``bottom`` + comprimento); com ``with_band`` os de cima são o cós."""
    cm = 0.01
    top = bottom + length_cm * cm
    band0 = top - m.cos * cm if with_band else top
    hip_y = top - HIP_DROP
    ys = list(np.linspace(bottom, band0, max(8, int((band0 - bottom) / 0.03)) + 1))
    if with_band:
        ys += list(np.linspace(band0, top, 4)[1:])
    rows, i_band = [], len(ys) - 1
    for y in ys:
        a, b = ellipse_semi_axes(_perimeter(m, y, hip_y, band0, bottom, roda), 0.74)
        mat = "cos" if with_band and y > band0 + 1e-6 else "corpo"
        if mat == "cos" and i_band == len(ys) - 1:
            i_band = len(rows) - 1
        rows.append(Row(y, a, b, mat))
    return rows, i_band


def pleat(mesh: Mesh, grid: np.ndarray, rows: list[Row], count: int, depth: float, hip_y: float) -> None:
    """Pregas faca: cada coluna sai ou entra (dente de serra com ``count`` dentes na volta), ``depth`` m na barra e
    nada no quadril. ``count`` precisa dividir as colunas do anel para as pregas ficarem iguais."""
    bottom = rows[0].y
    for j, r in enumerate(rows):
        if r.y >= hip_y:
            continue
        amp = depth * ((hip_y - r.y) / max(hip_y - bottom, 1e-6)) ** 0.7
        for i in range(COLUMNS):
            f = (i * count / COLUMNS) % 1.0             # 0 → 1 ao longo de uma prega
            x, y, z = mesh.verts[int(grid[j, i])]
            rad = math.hypot(x, z)
            k = 1 + amp * (f - 0.5) / max(rad, 1e-6)
            mesh.verts[int(grid[j, i])] = (x * k, y, z * k)


def build_skirt(mesh: Mesh, m: PantsMeasures, length_cm: float, roda: float, pleats: int = 0, with_band: bool = True,
                bottom: float = 0.0) -> tuple[np.ndarray, list[Row], int]:
    """Malha da saia; devolve a grade de índices, os anéis e o índice do primeiro anel do cós."""
    rows, i_band = skirt_rows(m, length_cm, roda, with_band, bottom)
    grid = build_upper(mesh, rows)
    if pleats:
        pleat(mesh, grid, rows, pleats, 0.018, rows[-1].y - HIP_DROP)
        for i in range(0, COLUMNS, COLUMNS // pleats):   # a dobra de cada prega é um vinco
            mesh.seams.update(int(grid[j, i]) for j in range(len(rows)))
    for c in (0, COLUMNS // 2):                           # costuras laterais
        mesh.seams.update(int(v) for v in grid[:, c])
    return grid, rows, i_band
