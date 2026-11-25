"""Colarinho de camisa: pé que sobe do decote e a folha virada por cima dele, terminando em pontas na frente.

O pé (``STAND``) sobe reto do decote. Na dobra a folha vira para fora e desce por cima do pé: nas costas desce
``FALL_BACK``, e perto da frente desce mais (``FALL_POINT``) e abre para o lado — são as pontas do colarinho, que
ficam afastadas uma da outra como numa camisa abotoada até em cima. Pesponto rente à borda da folha.
"""
from __future__ import annotations

import numpy as np

from .geometry import TILE, Mesh
from .stitches import stitch_line

STAND = 0.032        # altura do pé (m)
FALL_BACK = 0.036    # quanto a folha desce nas costas (cobre o pé e a costura do decote)
FALL_POINT = 0.08    # comprimento da ponta na frente
SPREAD = 0.045       # quanto cada ponta abre para o lado
POINT_RUN = 0.09     # a ponta se estende por 9 cm do decote, a partir da frente
ROWS = (0.35, 0.7, 1.0)


def point_collar(mesh: Mesh, neck: list[int], thick: float, closed: bool, mat: str = "corpo", points: bool = True) -> None:
    """Colarinho sobre o decote ``neck`` (aberto: da borda −x pelas costas até a borda +x). ``points=False``: sem as
    pontas (o colarinho das costas do blazer, que encontra as lapelas no ombro)."""
    base = np.array([mesh.verts[i] for i in neck])
    c = base.mean(0)
    radial = base - c
    radial[:, 1] = 0.0
    radial /= np.maximum(np.linalg.norm(radial, axis=1, keepdims=True), 1e-9)
    z0, z1 = base[:, 2].min(), base[:, 2].max()
    front = np.clip((base[:, 2] - (z0 + z1) / 2) / max((z1 - z0) / 2, 1e-9), 0, 1)   # 0 nas laterais e costas, 1 na frente
    side = np.sign(base[:, 0])
    if not closed:   # as pontas do decote aberto: cada uma é do seu painel (no transpasse ela passa do meio)
        side[0], side[-1] = -1.0, 1.0
    up = np.array([0.0, 1.0, 0.0])
    rings = [base + up * STAND * 0.5, base + up * STAND, base + up * (STAND + thick) + radial * thick * 1.5]
    # ponta: a borda de baixo sobe em linha reta da ponta até ``POINT_RUN`` dela (a curva pela frente fazia uma gola
    # redonda, não um colarinho). Medido ao longo do decote a partir de cada ponta; no decote fechado não há ponta.
    arc = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(base, axis=0), axis=1))])
    tip = np.clip(1 - np.minimum(arc, arc[-1] - arc) / POINT_RUN, 0, 1) if not closed and points else np.zeros(len(base))
    fall = FALL_BACK + (FALL_POINT - FALL_BACK) * tip
    top = rings[-1]
    for t in ROWS:   # a folha desce por fora do pé, afastando-se dele e, na frente, abrindo para o lado
        # o tronco abre logo abaixo do decote (ombro e peito): a folha se afasta do pé à medida que desce, mais na
        # frente, onde a ponta deita sobre o peito — rente ao pé ela ficava por baixo do pano do ombro
        lift = (0.006 + (0.012 + 0.03 * front) * t)[:, None]
        out = radial * lift + np.outer(side * SPREAD * tip ** 1.5 * t, [1.0, 0.0, 0.0])
        rings.append(top - np.outer(fall * t, up) + out)
    for r in rings[2:]:   # da dobra para baixo cada folha começa no meio e abre para o seu lado: sem cruzar a outra
        r[:, 0] = side * np.maximum(side * r[:, 0], 0.002)
    ids = [list(neck)] + [[mesh.add(p) for p in r] for r in rings]
    n = len(neck)
    for r in range(len(ids) - 1):
        a, b = ids[r], ids[r + 1]
        for i in range(n if closed else n - 1):
            j = (i + 1) % n
            mesh.quad((a[i], a[j], b[j], b[i]), [(i * 0.2, r * 0.2), (j * 0.2, r * 0.2), (j * 0.2, (r + 1) * 0.2),
                                                 (i * 0.2, (r + 1) * 0.2)], mat)
    mesh.seams.update(int(v) for v in ids[2])   # dobra do colarinho
    edge = rings[-1] + up * 0.004 + radial * 0.0006   # pesponto 4 mm acima da borda da folha, por fora
    stitch_line(mesh, np.vstack([edge, edge[:1]]) if closed else edge, radial)


LAPEL = 0.075        # largura da lapela no alto (m)


def lapels(mesh: Mesh, edges: list[tuple[list[int], int]], y_v: float, thick: float, mat: str = "corpo") -> None:
    """Lapelas do blazer e do casaco: a borda de cada painel no V (do fundo do V, ``y_v``, ao decote) virada para fora,
    deitada no peito — estreita no fundo, onde a lapela quebra, e larga em cima, onde encontra o colarinho.
    ``edges``: (vértices da borda do painel, de baixo para cima; lado do painel: +1 ou −1)."""
    for ids_all, side in edges:
        ids = [i for i in ids_all if mesh.verts[i][1] >= y_v - 1e-6]
        if len(ids) < 2:
            continue
        base = np.array([mesh.verts[i] for i in ids])
        tangent = np.gradient(base, axis=0)
        across = np.stack([tangent[:, 1], -tangent[:, 0], np.zeros(len(base))], 1)   # perpendicular à borda, no peito
        across *= np.where(across[:, :1] * side >= 0, 1.0, -1.0)
        across /= np.maximum(np.linalg.norm(across, axis=1, keepdims=True), 1e-9)
        normal = base.copy(); normal[:, 1] = 0.0
        normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-9)
        t = np.clip((base[:, 1] - y_v) / max(base[-1, 1] - y_v, 1e-6), 0, 1) ** 0.7
        fold = base + normal * (thick * 2)
        outer = fold + across * (LAPEL * t)[:, None] + normal * 0.003
        f_ids, o_ids = [mesh.add(p) for p in fold], [mesh.add(p) for p in outer]
        for j in range(len(ids) - 1):
            for a, b in ((ids, f_ids), (f_ids, o_ids)):
                quad = (a[j], b[j], b[j + 1], a[j + 1]) if side > 0 else (b[j], a[j], a[j + 1], b[j + 1])
                mesh.quad(quad, [(0, j * 0.2), (0.3, j * 0.2), (0.3, (j + 1) * 0.2), (0, (j + 1) * 0.2)], mat)
        mesh.seams.update(f_ids)
        stitch_line(mesh, outer - across * 0.006 + normal * 0.0006, normal)
