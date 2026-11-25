"""Malha da parte de cima a partir das medidas (sem Blender): anéis do tronco, cava aberta, mangas, ribanas e gola.

Espaço do provador: metros, Y para cima, frente em +Z, barra em y = 0, braços na horizontal (pose T). Cada anel é uma
elipse com o perímetro da medida; o tronco é uma grade de anéis × colunas e a manga nasce do contorno da cava (os
mesmos vértices), então não há costura aberta entre tronco e manga.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from .armhole import armhole_path, warped_thetas
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


def _torso_rows(m: TopMeasures, ribbed: bool, v_neck: bool = False, v_cut: bool = False) -> tuple[list[Row], int, int, int]:
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
    # decote quase redondo e centrado no pescoço: achatado e recuado, as costas da gola caíam dentro da nuca
    neck_a, neck_b = ellipse_semi_axes(m.pescoco * cm, 0.9)
    theta = np.linspace(0, 2 * np.pi, COLUMNS, endpoint=False)
    front = np.clip(np.sin(theta), 0, None) ** 1.6
    if v_neck:   # decote V: a descida cai em linha reta dos dois lados até o centro da frente
        front = np.clip(1 - np.abs(theta - np.pi / 2) / 0.9, 0, None)
    if v_cut:    # V da frente aberta: quem faz o V são as bordas (v_thetas), a frente não desce
        front = np.zeros_like(theta)
    back = np.clip(-np.sin(theta), 0, None) ** 1.6
    drop = (front * m.decote_frente + back * m.decote_costas) * cm
    # a descida do decote se espalha da axila ao pescoço: na frente cada anel fica sempre acima do anterior (com a
    # descida toda só nos anéis de cima, a frente deles caía abaixo do anel do ombro e o pano dobrava no peito)
    spread = lambda y: drop * (y - y_arm) / (H - y_arm)   # noqa: E731
    # profundidade numa curva só da axila ao pescoço (a frente fica reta até perto do alto): com uma quina na axila e
    # outra na linha do ombro, a luz marcava dois vincos atravessando o peito
    depth = lambda y: b_chest + (neck_b - b_chest) * ((y - y_arm) / (H - y_arm)) ** 2.2   # noqa: E731
    for y in np.linspace(y_arm, y_sh, 7)[1:]:
        t = (y - y_arm) / (y_sh - y_arm)
        rows.append(Row(y, a_chest + (m.ombro * cm / 2 - a_chest) * t, depth(y), "corpo", spread(y)))
    i_sh = len(rows) - 1
    top = rows[-1]
    for t in np.linspace(0, 1, 6)[1:]:
        s, y = t ** 0.8, y_sh + (H - y_sh) * t
        rows.append(Row(y, top.a + (neck_a - top.a) * s, depth(y), "corpo", spread(y)))
    i_neck = len(rows) - 1
    return rows, i_arm, i_sh, i_neck


def _ring(row: Row, theta: np.ndarray | None = None) -> np.ndarray:
    theta = np.linspace(0, 2 * np.pi, COLUMNS, endpoint=False) if theta is None else theta
    y = row.y - (row.drop if row.drop is not None else 0.0)
    return np.stack([row.a * np.cos(theta), np.broadcast_to(y, theta.shape), row.b * np.sin(theta) + row.dz], 1)


def _arc(points: np.ndarray, closed: bool = True) -> np.ndarray:
    """Comprimento acumulado ao longo do anel (o último valor é o perímetro, fechando no primeiro ponto)."""
    pts = np.vstack([points, points[:1]]) if closed else points
    return np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))])


# Meia abertura angular da cava a partir do lado (rad). Perto do lado da elipse o arco vale ≈ b·dθ, então ±0,4 rad
# abrem 0,8·b: cerca de 40 % da profundidade do tronco, a largura de uma cava vista de lado.
ARMHOLE_HALF_ANGLE = 0.4


def armhole_columns(half_angle: float = ARMHOLE_HALF_ANGLE) -> int:
    """Meia abertura da cava, em colunas do tronco."""
    return max(2, round(half_angle / (2 * math.pi / COLUMNS)))


FRONT_COLUMN = COLUMNS // 4   # centro da frente (theta = 90°, +z)


@dataclass
class FrontOpening:
    """Frente aberta (zíper ou botões): a coluna do centro da frente vira duas bordas, uma por painel.

    ``plus``/``minus``: vértices da borda do painel do lado +x / −x, da barra ao decote. ``hem``/``neck``: a barra e o
    decote como contornos abertos (da borda −x, dando a volta pelas costas, até a borda +x)."""
    plus: list
    minus: list
    hem: list | None   # None na vista curta (polo): a barra é fechada
    neck: list


V_HALF = 0.9   # V da frente aberta: meia abertura (rad a partir do centro da frente) no decote


def v_thetas(theta: np.ndarray | None, beta: float) -> np.ndarray:
    """Ângulos do anel com o V aberto ``beta`` rad de cada lado do centro da frente: as colunas da frente se juntam
    em direção às costas (o pano entre as bordas do V vai para o lado de cada painel, nada fica no V)."""
    t = np.linspace(0, 2 * np.pi, COLUMNS, endpoint=False) if theta is None else theta.copy()
    half = np.pi / 2
    right = t <= half                                      # painel +x: de 0 (lado) a π/2 (centro) → até π/2 − β
    left = (t > half) & (t <= np.pi)                       # painel −x: de π (lado) a π/2 → até π/2 + β
    t[right] = t[right] * (half - beta) / half
    t[left] = np.pi - (np.pi - t[left]) * (half - beta) / half
    return t


def _edge_points(row: Row, beta: float) -> tuple[np.ndarray, np.ndarray]:
    """As duas bordas do V no anel: a do painel +x em π/2 − β e a do −x em π/2 + β."""
    pt = lambda th: np.array([row.a * np.cos(th), row.y, row.b * np.sin(th) + row.dz])   # noqa: E731
    return pt(np.pi / 2 - beta), pt(np.pi / 2 + beta)


def _split_front(mesh: Mesh, grid: np.ndarray, rings: list, opening: float, lap_depth: float,
                 split_from: int = 0, edges: list | None = None) -> np.ndarray:
    """Duplica a coluna do centro da frente: a original fica com o painel +x, a cópia com o painel −x. ``opening`` > 0:
    vão entre as bordas (o zíper ocupa); < 0: transpasse (o painel +x passa por cima do −x, que recua ``lap_depth``).
    ``split_from``: os anéis abaixo dele ficam fechados (a vista curta da polo começa ali, em ponta)."""
    minus = np.array(grid[:, FRONT_COLUMN], int)
    for j, ring in enumerate(rings):
        if j < split_from:
            continue
        p = ring[FRONT_COLUMN].copy()
        if edges is not None and edges[j] is not None:   # acima do fundo do V: cada borda no seu lado do V
            mesh.verts[grid[j, FRONT_COLUMN]] = tuple(edges[j][0])
            minus[j] = mesh.add(edges[j][1])
            continue
        mesh.verts[grid[j, FRONT_COLUMN]] = (opening / 2, p[1], p[2])
        q = (-opening / 2, p[1], p[2] - (lap_depth if opening < 0 else 0.0))
        minus[j] = mesh.add(q)
    return minus


def build_torso(mesh: Mesh, m: TopMeasures, ribbed: bool, opening: float = 0.0, lap_depth: float = 0.0,
                v_neck: bool = False, placket: float = 0.0, armhole: float = ARMHOLE_HALF_ANGLE, curved: bool = False):
    """Tronco em grade; as cavas ficam abertas. Devolve a grade de índices, os contornos das cavas (direita, esquerda),
    os anéis, os índices (axila, ombro, decote) e a frente aberta (``FrontOpening``; None com ``opening`` = 0).
    ``placket`` > 0: só os ``placket`` metros de cima da frente abrem (vista curta da polo); a barra fica fechada."""
    v_cut = v_neck and opening != 0
    rows, i_arm, i_sh, i_neck = _torso_rows(m, ribbed, v_neck and not v_cut, v_cut)
    k = armhole_columns(armhole)
    y_v = rows[-1].y - m.decote_frente * 0.01
    thetas = [warped_thetas(j, k, i_arm, i_sh, i_neck, COLUMNS) if curved else None for j in range(len(rows))]
    # quanto cada borda da frente se afasta do centro (rad): o V aberto e, com vão (zíper, frente aberta), metade do vão
    # — as colunas vizinhas vão junto com a borda; paradas, ficavam dentro do vão e o painel dobrava sobre si
    betas = [max(V_HALF * (r.y - y_v) / (rows[-1].y - y_v) if v_cut and r.y > y_v else 0.0,
                 np.arcsin(min(1.0, opening / 2 / r.a)) if opening > 0 else 0.0) for r in rows]
    thetas = [v_thetas(t, b) if b else t for t, b in zip(thetas, betas)]
    rings = [_ring(r, t) for r, t in zip(rows, thetas)]
    edges = [_edge_points(r, b) if b else None for r, b in zip(rows, betas)] if opening else None
    grid = np.array([[mesh.add(p) for p in ring] for ring in rings])
    split_from = next((j for j, r in enumerate(rows) if r.y >= rows[i_neck].y - placket), 0) if placket else 0
    minus = _split_front(mesh, grid, rings, opening, lap_depth, split_from, edges) if opening else None
    # meia abertura da cava em cada faixa de anéis (a mesma em todas; a curva da regata vem de _warped_thetas)
    ks = {j: k for j in range(i_arm, i_sh)}
    hole = lambda j, i: any((i - c) % COLUMNS < ks[j] or (c - i - 1) % COLUMNS < ks[j] for c in (0, COLUMNS // 2))  # noqa: E731
    for j in range(len(rows) - 1):
        arc0, arc1 = _arc(rings[j]), _arc(rings[j + 1])
        for i in range(COLUMNS):
            if i_arm <= j < i_sh and hole(j, i):
                continue
            n = (i + 1) % COLUMNS
            first = minus[j] if minus is not None and i == FRONT_COLUMN else grid[j, i]
            first_up = minus[j + 1] if minus is not None and i == FRONT_COLUMN else grid[j + 1, i]
            y0, y1 = rows[j].y / TILE, rows[j + 1].y / TILE   # arc[COLUMNS] é o perímetro: a última coluna não volta a 0
            uv = [(arc0[i] / TILE, y0), (arc0[i + 1] / TILE, y0), (arc1[i + 1] / TILE, y1), (arc1[i] / TILE, y1)]
            mat = "ribana" if rows[j].mat == "ribana" else "corpo"
            mesh.quad((first, grid[j, n], grid[j + 1, n], first_up), uv, mat)
    path = armhole_path(ks, i_arm, i_sh)
    loops = [[grid[j, (center + o) % COLUMNS] for j, o in path] for center in (0, COLUMNS // 2)]
    seam_rows = [0, 3] if ribbed else [0]
    mesh.seams.update(int(v) for j in seam_rows for v in grid[j])
    for c in (0, COLUMNS // 2):   # costuras laterais (barra → axila) e do ombro (ponta → decote)
        mesh.seams.update(int(grid[j, c]) for j in range(seam_rows[-1], i_arm + 1))
        mesh.seams.update(int(grid[j, c]) for j in range(i_sh, i_neck + 1))
    for loop in loops:
        mesh.seams.update(int(v) for v in loop)
    front = None
    if minus is not None:
        around = lambda j: [int(minus[j])] + [int(grid[j, (FRONT_COLUMN + k) % COLUMNS]) for k in range(1, COLUMNS)] \
            + [int(grid[j, FRONT_COLUMN])]   # noqa: E731
        start = max(0, split_from - 1)   # a vista curta começa no ponto fechado logo abaixo dela
        front = FrontOpening([int(v) for v in grid[start:, FRONT_COLUMN]], [int(v) for v in minus[start:]],
                             None if split_from else around(0), around(i_neck))
    return grid, loops, rows, (i_arm, i_sh, i_neck), front


def densify(stations: list, step: float = 0.03) -> list:
    """Estações (posição ao longo da peça, perímetro, material) com anéis intermediários a cada ``step`` metros, o
    perímetro interpolado em linha reta. O provador dobra e encaixa a peça vértice a vértice: com 20–30 cm numa face só,
    a manga não acompanhava o cotovelo e a colisão via fatias. Perímetro None (transição) é copiado da estação vizinha."""
    out = [stations[0]]
    for (p0, c0, m0), (p1, c1, m1) in zip(stations, stations[1:]):
        k = int(abs(p1 - p0) // step)
        a, b = (c0 if c0 is not None else c1), (c1 if c1 is not None else c0)
        for i in range(1, k + 1):
            t = i / (k + 1)
            out.append((p0 + (p1 - p0) * t, None if a is None else a + (b - a) * t, m1 if m0 == m1 else "corpo"))
        out.append((p1, c1, m1))
    return out

