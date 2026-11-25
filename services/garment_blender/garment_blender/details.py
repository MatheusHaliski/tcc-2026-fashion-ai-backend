"""Detalhes aplicados sobre o tronco: bolsos (canguru, de peito) com pesponto, e o puxador do zíper.

Cada detalhe é uma placa que acompanha a superfície do tronco (amostrada nos mesmos anéis que o formam), um pouco
acima dela, com uma saia até a superfície nas bordas costuradas (o detalhe parece costurado, não flutuando) e vinco de
pesponto nelas. Borda aberta (a boca do bolso) fica sem saia e sem pesponto: é a abertura.
"""
from __future__ import annotations

import math

import numpy as np

from .geometry import COLUMNS, TILE, Mesh, Row
from .stitches import stitch_line

FRONT = math.pi / 2


def surface(rows: list[Row], theta: float, y: float) -> tuple[np.ndarray, np.ndarray]:
    """Ponto e normal do tronco no ângulo ``theta`` e na altura nominal ``y`` (a do anel; o decote desce a frente)."""
    ys = np.array([r.y for r in rows])
    j = int(np.clip(np.searchsorted(ys, y) - 1, 0, len(rows) - 2))
    t = float(np.clip((y - ys[j]) / max(ys[j + 1] - ys[j], 1e-9), 0, 1))
    r0, r1 = rows[j], rows[j + 1]
    col = int(round(theta / (2 * math.pi) * COLUMNS)) % COLUMNS
    drop = lambda r: float(r.drop[col]) if r.drop is not None else 0.0   # noqa: E731
    a, b = r0.a + (r1.a - r0.a) * t, r0.b + (r1.b - r0.b) * t
    dz, dy = r0.dz + (r1.dz - r0.dz) * t, drop(r0) + (drop(r1) - drop(r0)) * t
    p = np.array([r0.cx + a * math.cos(theta), y - dy, b * math.sin(theta) + dz])
    n = np.array([math.cos(theta) / a, 0.0, math.sin(theta) / b])
    return p, n / np.linalg.norm(n)


def patch(mesh: Mesh, rows: list[Row], corners, lift: float, mat: str, stitched=(True, True, True, True),
          segments=(10, 8), part="detalhe") -> None:
    """Placa entre quatro cantos (theta, y) — baixo-esq., baixo-dir., cima-dir., cima-esq. — ``lift`` metros acima do
    tronco. ``stitched``: (baixo, direita, cima, esquerda) costuradas (saia + pesponto) ou abertas."""
    nu, nv = segments
    grid = np.empty((nv + 1, nu + 1), int)
    base = np.empty((nv + 1, nu + 1, 3))
    (t0, y0), (t1, y1), (t2, y2), (t3, y3) = corners
    for j in range(nv + 1):
        for i in range(nu + 1):
            s, t = i / nu, j / nv
            th = (t0 * (1 - s) + t1 * s) * (1 - t) + (t3 * (1 - s) + t2 * s) * t
            y = (y0 * (1 - s) + y1 * s) * (1 - t) + (y3 * (1 - s) + y2 * s) * t
            p, n = surface(rows, th, y)
            base[j, i] = p
            grid[j, i] = mesh.add(p + n * lift)
    pos = np.array([mesh.verts[k] for k in grid.ravel()]).reshape(nv + 1, nu + 1, 3)
    u = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(pos[0], axis=0), axis=1))]) / TILE
    v = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(pos[:, 0], axis=0), axis=1))]) / TILE
    for j in range(nv):
        for i in range(nu):
            mesh.quad((grid[j, i], grid[j, i + 1], grid[j + 1, i + 1], grid[j + 1, i]),
                      [(u[i], v[j]), (u[i + 1], v[j]), (u[i + 1], v[j + 1]), (u[i], v[j + 1])], mat, part)
    edges = [(grid[0, :], base[0, :]), (grid[:, -1], base[:, -1]), (grid[-1, ::-1], base[-1, ::-1]),
             (grid[::-1, 0], base[::-1, 0])]
    for (ring, under), sewn in zip(edges, stitched):
        if not sewn:   # boca do bolso: sem saia nem pesponto
            continue
        mesh.seams.update(int(k) for k in ring)
        top = np.array([mesh.verts[k] for k in ring])
        inward = top + (pos[nv // 2, nu // 2] - top) * 0.004 / np.maximum(
            np.linalg.norm(pos[nv // 2, nu // 2] - top, axis=1, keepdims=True), 1e-9)   # pesponto a 4 mm da borda
        stitch_line(mesh, inward, top - under, part=part)
        low = [mesh.add(p) for p in under]   # saia até o tronco: a borda costurada encosta no tecido de baixo
        for k in range(len(ring) - 1):
            mesh.quad((ring[k], ring[k + 1], low[k + 1], low[k]), [(0, 0), (0.2, 0), (0.2, 0.05), (0, 0.05)], mat, part)


def kangaroo(mesh: Mesh, rows: list[Row], y_rib: float, split: bool, mat: str) -> None:
    """Bolso canguru: 20 cm de altura, boca inclinada dos lados (abertas); ``split`` (frente com zíper) divide em dois."""
    a = rows[len(rows) // 3].a
    half_bottom, half_top = 0.19 / a, 0.13 / a           # meias larguras (m) em ângulo, perto da frente
    yb, yt = y_rib + 0.01, y_rib + 0.21
    if split:
        gap = 0.018 / a
        for sgn in (-1, 1):
            inner, outer_b, outer_t = FRONT + sgn * gap, FRONT + sgn * half_bottom, FRONT + sgn * half_top
            c = [(inner, yb), (outer_b, yb), (outer_t, yt), (inner, yt)] if sgn > 0 else \
                [(outer_b, yb), (inner, yb), (inner, yt), (outer_t, yt)]
            open_side = (True, False, True, True) if sgn > 0 else (True, True, True, False)
            patch(mesh, rows, c, 0.003, mat, open_side)
        return
    c = [(FRONT + half_bottom, yb), (FRONT - half_bottom, yb), (FRONT - half_top, yt), (FRONT + half_top, yt)]
    patch(mesh, rows, c, 0.003, mat, (True, False, True, False))   # bocas laterais abertas


def chest_pocket(mesh: Mesh, rows: list[Row], y_arm: float, mat: str, side: int = 1) -> None:
    """Bolso de peito chapado, 11 × 13 cm, boca em cima; ``side`` +1 no lado esquerdo de quem veste (+x), −1 no outro."""
    a = rows[len(rows) // 2].a
    c0 = FRONT - side * 0.10 / a
    w = 0.055 / a
    yb, yt = y_arm - 0.17, y_arm - 0.04
    patch(mesh, rows, [(c0 + w, yb), (c0 - w, yb), (c0 - w, yt), (c0 + w, yt)], 0.0025, mat, (True, True, False, True),
          (6, 6))


def puller(mesh: Mesh, at: np.ndarray, normal: np.ndarray, mat: str) -> None:
    """Cursor e puxador: uma placa de 1,4 × 3,2 cm pendurada para baixo, 2 mm de espessura."""
    w, h, d = 0.007, 0.032, 0.001
    side = np.cross(normal, [0.0, 1.0, 0.0]); side /= np.linalg.norm(side)
    down = np.array([0.0, -1.0, 0.0])
    corners = [at + side * sx * w + down * hy * h + normal * dz * d for dz in (-1, 1) for hy in (0, 1) for sx in (-1, 1)]
    idx = [mesh.add(p) for p in corners]
    for f in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
        mesh.quad(tuple(idx[k] for k in f), [(0, 0), (1, 0), (1, 1), (0, 1)], mat)
