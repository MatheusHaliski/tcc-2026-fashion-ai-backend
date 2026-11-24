"""Malha da parte de cima a partir das medidas (sem Blender): anéis do tronco, cava aberta, mangas, ribanas e gola.

Espaço do provador: metros, Y para cima, frente em +Z, barra em y = 0, braços na horizontal (pose T). Cada anel é uma
elipse com o perímetro da medida; o tronco é uma grade de anéis × colunas e a manga nasce do contorno da cava (os
mesmos vértices), então não há costura aberta entre tronco e manga.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from .sizes import TopMeasures

COLUMNS = 96   # vértices por anel do tronco (múltiplo de 4: lados e centro da frente/costas caem em colunas)
TILE = 0.05    # metros por repetição da textura de tecido (UV)


def ellipse_semi_axes(perimeter: float, ratio: float) -> tuple[float, float]:
    """Semieixos (a, b = ratio·a) de uma elipse com o perímetro dado (Ramanujan II, erro < 0,01 %)."""
    def p(a):
        b = ratio * a
        h = ((a - b) / (a + b)) ** 2
        return math.pi * (a + b) * (1 + 3 * h / (10 + math.sqrt(4 - 3 * h)))
    a = perimeter / (2 * math.pi)
    for _ in range(30):            # p(a) é linear em a: uma correção já basta, o laço só garante
        a *= perimeter / p(a)
    return a, ratio * a


@dataclass
class Mesh:
    verts: list = field(default_factory=list)          # (x, y, z)
    faces: list = field(default_factory=list)          # índices (quad ou tri)
    uvs: list = field(default_factory=list)            # por face: lista de (u, v) na ordem dos índices
    mats: list = field(default_factory=list)           # por face: nome do material
    parts: list = field(default_factory=list)          # por face: "tronco", "manga_d", "manga_e" (para medir)
    seams: set = field(default_factory=set)            # vértices de costura (viram vinco)

    def add(self, p) -> int:
        self.verts.append(tuple(float(c) for c in p))
        return len(self.verts) - 1

    def quad(self, idx, uv, mat, part="tronco"):
        self.faces.append(tuple(idx)); self.uvs.append(list(uv)); self.mats.append(mat); self.parts.append(part)


@dataclass
class Row:
    y: float
    a: float          # semieixo em x (largura)
    b: float          # semieixo em z (profundidade)
    mat: str
    drop: np.ndarray | None = None   # descida por coluna (decote)
    dz: float = 0.0
    cx: float = 0.0                  # centro em x (perna da calça)


def _torso_rows(m: TopMeasures, ribbed: bool) -> tuple[list[Row], int, int, int]:
    """Anéis do tronco de baixo para cima; devolve também os índices da linha da axila, do ombro e do decote."""
    cm = 0.01
    H, rib = m.comprimento * cm, (m.ribana_barra * cm if ribbed else 0.0)
    y_arm, y_sh = H - m.cava * cm, H - m.caimento_ombro * cm
    a_chest, b_chest = ellipse_semi_axes(m.torax * cm, 0.68)
    rows: list[Row] = []
    hem_a, hem_b = ellipse_semi_axes(m.barra * cm * (0.9 if ribbed else 1.0), 0.68)
    for y in np.linspace(0, rib, 4)[:-1] if ribbed else []:
        rows.append(Row(y, hem_a, hem_b, "ribana"))
    body_a, body_b = ellipse_semi_axes(m.barra * cm, 0.68)
    for y in np.linspace(rib, y_arm, max(4, int((y_arm - rib) / 0.035)) + 1):
        t = min(1.0, (y - rib) / max(1e-6, (y_arm - 0.06) - rib))
        rows.append(Row(y, body_a + (a_chest - body_a) * t, body_b + (b_chest - body_b) * t, "corpo"))
    i_arm = len(rows) - 1
    for y in np.linspace(y_arm, y_sh, 7)[1:]:
        t = (y - y_arm) / (y_sh - y_arm)
        rows.append(Row(y, a_chest + (m.ombro * cm / 2 - a_chest) * t, b_chest * (1 - 0.18 * t), "corpo"))
    i_sh = len(rows) - 1
    neck_a, neck_b = ellipse_semi_axes(m.pescoco * cm, 0.82)
    theta = np.linspace(0, 2 * np.pi, COLUMNS, endpoint=False)
    front = np.clip(np.sin(theta), 0, None) ** 1.6
    back = np.clip(-np.sin(theta), 0, None) ** 1.6
    drop = (front * m.decote_frente + back * m.decote_costas) * cm
    top = rows[-1]
    for t in np.linspace(0, 1, 6)[1:]:
        s = t ** 0.8
        rows.append(Row(y_sh + (H - y_sh) * t, top.a + (neck_a - top.a) * s, top.b + (neck_b - top.b) * s, "corpo",
                        drop * t, dz=-0.01 * t))
    i_neck = len(rows) - 1
    return rows, i_arm, i_sh, i_neck


def _ring(row: Row) -> np.ndarray:
    theta = np.linspace(0, 2 * np.pi, COLUMNS, endpoint=False)
    y = row.y - (row.drop if row.drop is not None else 0.0)
    return np.stack([row.a * np.cos(theta), np.broadcast_to(y, theta.shape), row.b * np.sin(theta) + row.dz], 1)


def _arc(points: np.ndarray, closed: bool = True) -> np.ndarray:
    """Comprimento acumulado ao longo do anel (o último valor é o perímetro, fechando no primeiro ponto)."""
    pts = np.vstack([points, points[:1]]) if closed else points
    return np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))])


# Meia abertura angular da cava a partir do lado (rad). Perto do lado da elipse o arco vale ≈ b·dθ, então ±0,4 rad
# abrem 0,8·b: cerca de 40 % da profundidade do tronco, a largura de uma cava vista de lado.
ARMHOLE_HALF_ANGLE = 0.4


def armhole_columns() -> int:
    """Meia abertura da cava, em colunas do tronco."""
    return max(2, round(ARMHOLE_HALF_ANGLE / (2 * math.pi / COLUMNS)))


def build_torso(mesh: Mesh, m: TopMeasures, ribbed: bool):
    """Tronco em grade; as cavas ficam abertas. Devolve a grade de índices e os contornos das cavas (direita, esquerda)."""
    rows, i_arm, i_sh, i_neck = _torso_rows(m, ribbed)
    grid = np.array([[mesh.add(p) for p in _ring(r)] for r in rows])
    rings = [_ring(r) for r in rows]
    k = armhole_columns()
    sides = {0: set(range(-k, k)), COLUMNS // 2: set(range(COLUMNS // 2 - k, COLUMNS // 2 + k))}
    hole = {c % COLUMNS for cols in sides.values() for c in cols}
    for j in range(len(rows) - 1):
        arc0, arc1 = _arc(rings[j]), _arc(rings[j + 1])
        for i in range(COLUMNS):
            if i_arm <= j < i_sh and i in hole:
                continue
            n = (i + 1) % COLUMNS
            y0, y1 = rows[j].y / TILE, rows[j + 1].y / TILE   # arc[COLUMNS] é o perímetro: a última coluna não volta a 0
            uv = [(arc0[i] / TILE, y0), (arc0[i + 1] / TILE, y0), (arc1[i + 1] / TILE, y1), (arc1[i] / TILE, y1)]
            mat = "ribana" if rows[j].mat == "ribana" else "corpo"
            mesh.quad((grid[j, i], grid[j, n], grid[j + 1, n], grid[j + 1, i]), uv, mat)
    loops = []
    for center in (0, COLUMNS // 2):
        lo, hi = center - k, center + k
        loop = [grid[i_arm, c % COLUMNS] for c in range(lo, hi + 1)]
        loop += [grid[j, hi % COLUMNS] for j in range(i_arm + 1, i_sh + 1)]
        loop += [grid[i_sh, c % COLUMNS] for c in range(hi - 1, lo - 1, -1)]
        loop += [grid[j, lo % COLUMNS] for j in range(i_sh - 1, i_arm, -1)]
        loops.append(loop)
    seam_rows = [0, 3] if ribbed else [0]
    mesh.seams.update(int(v) for j in seam_rows for v in grid[j])
    for c in (0, COLUMNS // 2):   # costuras laterais (barra → axila) e do ombro (ponta → decote)
        mesh.seams.update(int(grid[j, c]) for j in range(seam_rows[-1], i_arm + 1))
        mesh.seams.update(int(grid[j, c]) for j in range(i_sh, i_neck + 1))
    for loop in loops:
        mesh.seams.update(int(v) for v in loop)
    return grid, loops, rows, (i_arm, i_sh, i_neck)
