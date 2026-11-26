"""Capuz: casca sobre a cabeça costurada ao decote, com a abertura do rosto, a costura do meio das costas e a borda
do rosto dobrada (canal do cordão).

O capuz começa e termina no centro da frente do decote (onde o zíper fecha, ou onde as bordas se cruzam no capuz de
pulôver) e dá a volta pelas costas. Cada coluna do decote vira um meridiano que sobe até perto do alto da cabeça; as
das pontas formam a borda do rosto, abrindo de ``FACE_OPENING`` graus para cada lado.
"""
from __future__ import annotations

import math

import numpy as np

from .geometry import COLUMNS, TILE, Mesh

FACE_OPENING = 62.0     # meia abertura do rosto (graus a partir da frente)
ROWS = 14
DOWN_ANGLE = 118.0      # capuz abaixado: quanto ele tomba para trás, sobre as costas


def _fold_back(pts: np.ndarray, pivot: np.ndarray, angle: float) -> np.ndarray:
    """Gira em torno do eixo x que passa por ``pivot``: o alto do capuz vai para trás e para baixo."""
    c, s = math.cos(angle), math.sin(angle)
    d = pts - pivot
    y = d[:, 1] * c + d[:, 2] * s
    z = -d[:, 1] * s + d[:, 2] * c
    return np.stack([pts[:, 0], pivot[1] + y, pivot[2] + z], 1)


def build_hood(mesh: Mesh, neck: list[int], ease: float, mat: str, thickness: float, down: bool = False,
               order: list[int] | None = None) -> None:
    """``neck``: vértices do decote em ordem de coluna (coluna COLUMNS/4 = centro da frente). ``ease``: folga (m).
    ``down``: capuz abaixado, deitado nas costas (como fica no corpo quando não está na cabeça)."""
    front = COLUMNS // 4
    # centro da frente → costas → centro da frente; com a frente aberta, cada ponta é a borda de um painel
    order = order or [neck[(front + k) % COLUMNS] for k in range(COLUMNS + 1)]
    base = np.array([mesh.verts[i] for i in order])
    side_y = float(np.array([mesh.verts[i] for i in neck])[:, 1].max())
    center = np.array([0.0, side_y + 0.10, -0.015])                     # centro da cabeça, acima do decote
    rx, ry = 0.118 + ease, 0.215 + ease * 0.6
    back_neck = base[COLUMNS // 2]
    pivot = np.array([0.0, back_neck[1] + 0.02, back_neck[2] + 0.01])
    grid = [order]
    pts_rows = [base]
    for r in range(1, ROWS + 1):
        v = r / ROWS
        e = -0.35 + v * (1.48 + 0.35)                                   # elevação: abaixo do queixo → perto do alto
        w = min(1.0, v * 2.5); w = w * w * (3 - 2 * w)
        pts = []
        for k in range(COLUMNS + 1):
            az = math.radians(FACE_OPENING + (k / COLUMNS) * (360 - 2 * FACE_OPENING))
            rz = (0.112 if math.cos(az) > 0 else 0.150) + ease
            shell = center + np.array([-math.sin(az) * rx * math.cos(e), ry * math.sin(e), math.cos(az) * rz * math.cos(e)])
            pts.append(base[k] * (1 - w) + shell * w)
        pts = np.array(pts)
        if down:   # tomba para trás em torno do eixo x que passa na nuca, entrando aos poucos a partir do decote
            pts = _fold_back(pts, pivot, math.radians(DOWN_ANGLE) * min(1.0, v * 1.6))
        grid.append([mesh.add(p) for p in pts]); pts_rows.append(pts)
    for r in range(ROWS):
        a0 = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(pts_rows[r], axis=0), axis=1))]) / TILE
        a1 = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(pts_rows[r + 1], axis=0), axis=1))]) / TILE
        h0 = float(np.linalg.norm(pts_rows[r] - pts_rows[0], axis=1).mean()) / TILE
        h1 = float(np.linalg.norm(pts_rows[r + 1] - pts_rows[0], axis=1).mean()) / TILE
        for k in range(COLUMNS):
            mesh.quad((grid[r][k], grid[r][k + 1], grid[r + 1][k + 1], grid[r + 1][k]),
                      [(a0[k], h0), (a0[k + 1], h0), (a1[k + 1], h1), (a1[k], h1)], mat, "capuz")
    mesh.seams.update(int(grid[r][COLUMNS // 2]) for r in range(ROWS + 1))   # costura do meio das costas
    mesh.seams.update(int(v) for v in order)                                # capuz costurado ao decote
    for col in (0, COLUMNS):   # borda do rosto dobrada para dentro: 2,5 cm de vista com a espessura do tecido
        edge = [grid[r][col] for r in range(ROWS + 1)]
        ep = np.array([mesh.verts[i] for i in edge])
        inward = center - ep; inward /= np.linalg.norm(inward, axis=1, keepdims=True)
        back = np.array([0.0, 0.0, -1.0])
        inner = [mesh.add(p) for p in ep + inward * thickness + back * 0.025]
        for r in range(ROWS):
            mesh.quad((edge[r], edge[r + 1], inner[r + 1], inner[r]), [(0, 0), (0.5, 0), (0.5, 0.5), (0, 0.5)], mat, "capuz")
        mesh.seams.update(int(v) for v in edge)
