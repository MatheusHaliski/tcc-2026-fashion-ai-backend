"""Tronco da peça sem manga (regata, top, body, colete) com alça de verdade, sem Blender.

Abaixo de ``cut.y_base`` (3 cm abaixo da axila) são os anéis de sempre. Acima, cada coluna do tronco sobe até o seu
"joelho" (``strap_cut``): o corte da cava nas colunas do lado, o do decote nas do meio; as colunas da alça seguem até o
alto do painel e a ponte (``shoulder_bridge``) as leva por cima do ombro até as costas. O peito fica com a largura
toda (as colunas não afinam até o pescoço): a alça sobe reta pelo meio do ombro.

Colunas de um quarto do anel (do lado ao meio da frente): 0–``K_O`` lado (a cava), ``K_O``–``K_I`` alça e
``K_I``–24 decote. Os ângulos são repartidos para que as bordas da alça caiam exatamente em x_out e x_in.
"""
from __future__ import annotations

import math
from dataclasses import replace

import numpy as np

from .geometry import COLUMNS, FRONT_COLUMN, TILE, FrontOpening, Mesh, Row, _arc, _split_front, _torso_rows, v_thetas
from .shoulder_bridge import boundary_cycles, bridge, open_path

K_O, K_I = 7, 13            # colunas da borda de fora e da de dentro da alça (a partir do lado)
QUARTER = COLUMNS // 4
STEP = 0.022                # distância alvo entre linhas da grade de cima (m)


def _even(cut, th0: float, th1: float, n: int, knee) -> np.ndarray:
    """``n`` + 1 ângulos de ``th0`` a ``th1`` com passos iguais ao longo da linha de corte (``knee``) em 3D: onde a cava
    ou o decote sobe quase na vertical, ângulos iguais deixavam um lado de 7 cm no contorno."""
    th = np.linspace(th0, th1, 400)
    x = cut.a_c * np.cos(th)
    step = np.zeros(len(th) - 1)
    for side in (1, -1):   # frente e costas dividem os mesmos ângulos: vale o passo maior das duas
        y = knee(x, side)
        p = np.stack([x, y, cut.b(y) * np.sin(th)], 1)
        step = np.maximum(step, np.linalg.norm(np.diff(p, axis=0), axis=1))
    cum = np.concatenate([[0.0], np.cumsum(step)])
    return np.interp(np.linspace(0, cum[-1], n + 1), cum, th)


def strap_thetas(cut) -> np.ndarray:
    """Ângulo de cada coluna acima de ``y_base``: as bordas da alça em x_out e x_in, a alça linear e, na cava e no
    decote, passos iguais ao longo do corte."""
    t_o, t_i = math.acos(cut.x_out / cut.a_c), math.acos(cut.x_in / cut.a_c)
    q = np.concatenate([_even(cut, 0.0, t_o, K_O, cut.armhole_knee), np.linspace(t_o, t_i, K_I - K_O + 1)[1:-1],
                        _even(cut, t_i, math.pi / 2, QUARTER - K_I, cut.neck_knee)])
    th = np.empty(COLUMNS)
    for c in range(COLUMNS):   # os outros quartos são o espelho do primeiro (esquerda e costas)
        quad = c // QUARTER
        th[c] = (q[c] if quad == 0 else math.pi - q[2 * QUARTER - c] if quad == 1 else
                 math.pi + q[c - 2 * QUARTER] if quad == 2 else 2 * math.pi - q[COLUMNS - c])
    return th


def _bands() -> tuple[list[str], np.ndarray]:
    """Faixa de cada coluna ("lado", "alca", "decote") e de que lado ela está (+1 frente, −1 costas)."""
    band, side = [], np.empty(COLUMNS)
    for c in range(COLUMNS):
        q = min(c % (2 * QUARTER), 2 * QUARTER - c % (2 * QUARTER))   # colunas a partir do lado mais próximo
        band.append("lado" if q <= K_O else "decote" if q >= K_I else "alca")
        side[c] = 1 if c <= 2 * QUARTER else -1
    return band, side


def _knees(cut, x: np.ndarray) -> np.ndarray:
    band, side = _bands()
    fn = {"lado": cut.armhole_knee, "decote": cut.neck_knee, "alca": cut.strap_knee}
    return np.array([float(fn[b](x[c], int(side[c]))) for c, b in enumerate(band)])


def _cut_face(band: list[str], c: int) -> bool:
    n = (c + 1) % COLUMNS
    return band[c] == band[n] and band[c] != "alca"


def build_sleeveless_torso(mesh: Mesh, m, cut, ribbed: bool, opening: float = 0.0, lap_depth: float = 0.0):
    """Tronco sem manga em grade. Devolve (grade de índices, −1 onde não há pano; [cava direita, cava esquerda];
    decote; anéis nominais; (axila, ombro, decote) nesses anéis; frente aberta ou None)."""
    rows_all = _torso_rows(m, ribbed)[0]
    rows_lo = [replace(r, drop=None) for r in rows_all if r.y < cut.y_base - 0.008]
    L = len(rows_lo)
    theta_up = strap_thetas(cut)
    uniform = np.linspace(0, 2 * np.pi, COLUMNS, endpoint=False)
    beta = lambda a: math.asin(min(1.0, opening / 2 / a)) if opening > 0 else 0.0   # noqa: E731 - vão do zíper
    x_up = cut.a_c * np.cos(theta_up)
    knee = _knees(cut, x_up)
    band, _ = _bands()
    strap = [c for c in range(COLUMNS) if min(c % (2 * QUARTER), 2 * QUARTER - c % (2 * QUARTER)) in range(K_O, K_I + 1)]
    K = max(2, math.ceil((knee.max() - cut.y_base) / STEP))
    J = K + max(2, math.ceil(max(cut.y_t - knee[c] for c in strap) / STEP))
    pos = np.empty((L + J + 1, COLUMNS, 3))
    for r, row in enumerate(rows_lo):
        w = {L - 2: 1 / 3, L - 1: 2 / 3}.get(r, 0.0)       # os dois anéis de baixo já vão para os ângulos de cima
        th = uniform * (1 - w) + theta_up * w
        b = beta(row.a)
        th = v_thetas(th, b) if b else th
        pos[r] = np.stack([row.a * np.cos(th), np.full(COLUMNS, row.y), row.b * np.sin(th)], 1)
    b = beta(cut.a_c)
    th_up = v_thetas(theta_up, b) if b else theta_up
    for j in range(J + 1):
        y = np.where(j <= K, cut.y_base + (knee - cut.y_base) * min(j, K) / K,
                     knee + (cut.y_t - knee) * max(0, j - K) / (J - K))
        pos[L + j] = np.stack([cut.a_c * np.cos(th_up), y, cut.b(y) * np.sin(th_up)], 1)
    top = L + K   # anel do joelho: acima dele só a alça
    faces = [(r, c) for r in range(L + J) for c in range(COLUMNS) if r < top or not _cut_face(band, c)]
    keep = np.zeros(pos.shape[:2], bool)
    for r, c in faces:
        n = (c + 1) % COLUMNS
        keep[r, c] = keep[r, n] = keep[r + 1, c] = keep[r + 1, n] = True
    grid = np.full(pos.shape[:2], -1, int)
    for r, c in zip(*np.nonzero(keep)):
        grid[r, c] = mesh.add(pos[r, c])
    minus = _split_front(mesh, grid[: top + 1], list(pos[: top + 1]), opening, lap_depth) if opening else None
    arcs = [_arc(p * [1.0, 0.0, 1.0]) for p in pos]   # u na volta horizontal: os joelhos não esticam o tecido
    for r, c in faces:
        n = (c + 1) % COLUMNS
        split = minus is not None and c == FRONT_COLUMN
        idx = (minus[r] if split else grid[r, c], grid[r, n], grid[r + 1, n], minus[r + 1] if split else grid[r + 1, c])
        uv = [(arcs[r][c] / TILE, pos[r, c, 1] / TILE), (arcs[r][c + 1] / TILE, pos[r, n, 1] / TILE),
              (arcs[r + 1][c + 1] / TILE, pos[r + 1, n, 1] / TILE), (arcs[r + 1][c] / TILE, pos[r + 1, c, 1] / TILE)]
        mesh.quad(idx, uv, "ribana" if r < L and rows_lo[r].mat == "ribana" else "corpo")
    first = len(mesh.faces) - len(faces)
    for cols in ([c for c in range(K_O, K_I + 1)], [c for c in range(2 * QUARTER - K_I, 2 * QUARTER - K_O + 1)]):
        back = [COLUMNS - c for c in cols]
        bridge(mesh, cut, cols, [int(grid[-1, c]) for c in cols], [int(grid[-1, c]) for c in back], arcs[-1][cols],
               pos[-2, cols], pos[-2, back])
    cycles = boundary_cycles(mesh.faces[first:])
    on = lambda v: next(cyc for cyc in cycles if v in cyc)   # noqa: E731
    loops = [on(int(grid[top, 0])), on(int(grid[top, 2 * QUARTER]))]
    front = None
    if minus is not None:
        around = lambda r: [int(minus[r])] + [int(grid[r, (FRONT_COLUMN + k) % COLUMNS]) for k in range(1, COLUMNS)] \
            + [int(grid[r, FRONT_COLUMN])]   # noqa: E731
        neck = open_path(on(int(minus[top])), int(minus[top]), int(grid[top, FRONT_COLUMN]), int(minus[top - 1]))
        front = FrontOpening([int(v) for v in grid[: top + 1, FRONT_COLUMN]], [int(v) for v in minus], around(0), neck)
    else:
        neck = on(int(grid[top, FRONT_COLUMN]))
    seam_rows = [0, 3] if ribbed else [0]
    mesh.seams.update(int(v) for j in seam_rows for v in grid[j])
    for c in (0, 2 * QUARTER):   # costuras laterais, da barra ao fundo da cava
        mesh.seams.update(int(grid[j, c]) for j in range(seam_rows[-1], top + 1))
    for loop in loops:
        mesh.seams.update(loop)
    rows = rows_lo + [Row(float(y), cut.a_c, float(cut.b(y)), "corpo") for y in np.arange(cut.y_base, cut.y_t, 0.02)]
    rows += [Row(cut.y_t, cut.a_c, cut.b_t, "corpo"), Row(cut.H, cut.a_c, cut.b_t, "corpo")]
    i_arm = int(np.argmin([abs(r.y - cut.y_arm) for r in rows]))
    return grid, loops, neck, rows, (i_arm, len(rows) - 1, len(rows) - 1), front
