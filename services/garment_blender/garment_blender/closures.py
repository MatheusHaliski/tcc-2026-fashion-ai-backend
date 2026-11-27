"""Frente aberta de jaqueta e moletom: bordas com espessura (vista dobrada para dentro) e o zíper de verdade.

A borda de um painel não é o fim de uma folha de pano: o tecido dobra para dentro e forma a vista (``facing``) — de
frente se vê a espessura da dobra, e por dentro uma faixa de 3–4 cm do mesmo tecido. O zíper fica no vão entre as
duas bordas: cadarço sob cada painel, a corrente de dentes alternados (um de cada lado, encaixados no meio), o cursor
com o puxador no alto e o batente embaixo. Pesponto dos dois lados, a alguns milímetros da borda.
"""
from __future__ import annotations

import numpy as np

from .details import puller
from .geometry import TILE, Mesh, FrontOpening
from .stitches import offset_line, resample, stitch_line

FACING = 0.035          # largura da vista por dentro (m)
ZIP_GAP = 0.014         # vão entre as bordas dos painéis com o zíper (a corrente tem 6,8 mm; o resto é cadarço)
TOOTH_PITCH = 0.003     # um dente a cada 3 mm de cada lado (os dois lados defasados de meio passo)
TOOTH = (0.0026, 0.0040, 0.0022)   # comprimento (ao longo), largura (através), altura do dente
TAPE_W = 0.016          # largura de cada cadarço (a maior parte fica sob o painel)


def _normal(p: np.ndarray) -> np.ndarray:
    """Normal de fora do tronco perto do centro da frente: horizontal, saindo do eixo do corpo."""
    n = np.array([p[0], 0.0, p[2]]); n /= max(np.linalg.norm(n), 1e-9)
    return n


def facing(mesh: Mesh, edge: list[int], side: int, thick: float, mat: str = "corpo") -> None:
    """Dobra da borda do painel: da borda para dentro (a espessura) e de volta para o lado do painel ``side``
    (+1: painel +x, a vista vai para +x)."""
    pts = np.array([mesh.verts[i] for i in edge])
    across = np.array([side, 0.0, 0.0])
    inner = [mesh.add(p - _normal(p) * thick) for p in pts]
    back = [mesh.add(p - _normal(p) * thick + across * FACING) for p in pts]
    v = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))]) / TILE
    for j in range(len(edge) - 1):
        for a, b, u0, u1 in ((edge, inner, 0.0, thick / TILE), (inner, back, thick / TILE, (thick + FACING) / TILE)):
            quad = (a[j], b[j], b[j + 1], a[j + 1]) if side > 0 else (b[j], a[j], a[j + 1], b[j + 1])
            mesh.quad(quad, [(u0, v[j]), (u1, v[j]), (u1, v[j + 1]), (u0, v[j + 1])], mat)


def box(mesh: Mesh, center, along, across, up, size, mat: str, part: str = "tronco") -> list[int]:
    """Caixa (dente, cursor, batente) com os eixos dados; ``size`` = (ao longo, através, altura). Base em ``center``."""
    L, W, H = size
    corners = [center + along * a * L / 2 + across * c * W / 2 + up * h * H for h in (0, 1) for a in (-1, 1) for c in (-1, 1)]
    idx = [mesh.add(p) for p in corners]
    for f in ((0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5)):
        mesh.quad(tuple(idx[k] for k in f), [(0, 0), (1, 0), (1, 1), (0, 1)], mat, part)
    return idx


def zipper(mesh: Mesh, front: FrontOpening, thick: float, y_top: float) -> dict:
    """Zíper fechado no vão da frente, da barra até ``y_top`` (o decote). Devolve contagens para o relatório."""
    plus = np.array([mesh.verts[i] for i in front.plus])
    minus = np.array([mesh.verts[i] for i in front.minus])
    center_line = (plus + minus) / 2
    center_line = center_line[center_line[:, 1] <= y_top + 1e-6]
    x = np.array([1.0, 0.0, 0.0])
    base_lift = -thick * 0.5            # cadarço e base dos dentes: um pouco abaixo da superfície do painel
    for side in (1, -1):                # cadarço: do meio até sob o painel
        pts, _ = resample(center_line, 0.01)
        inner = [mesh.add(p + _normal(p) * base_lift + x * side * 0.001) for p in pts]
        outer = [mesh.add(p + _normal(p) * base_lift + x * side * TAPE_W) for p in pts]
        for j in range(len(pts) - 1):
            q = (inner[j], outer[j], outer[j + 1], inner[j + 1]) if side > 0 else (outer[j], inner[j], inner[j + 1], outer[j + 1])
            mesh.quad(q, [(0, j * 0.2), (0.3, j * 0.2), (0.3, (j + 1) * 0.2), (0, (j + 1) * 0.2)], "cadarco")
    teeth = 0
    for side, shift in ((1, 0.0), (-1, TOOTH_PITCH / 2)):
        pts, tangent = resample(center_line, TOOTH_PITCH)
        for p, t in zip(pts[:-1] + tangent[:-1] * shift, tangent[:-1]):
            n = _normal(p)
            # o dente passa 0,6 mm do meio: os dois lados se encaixam como numa corrente fechada
            c = p + n * base_lift + x * side * (TOOTH[1] / 2 - 0.0006)
            box(mesh, c, t, x, n, TOOTH, "dentes")
            teeth += 1
    top = center_line[-1]
    n, up = _normal(top), np.array([0.0, 1.0, 0.0])
    slider_at = top - up * 0.014 + n * (base_lift + TOOTH[2])
    box(mesh, slider_at, up, x, n, (0.02, 0.011, 0.0035), "dentes")                       # corpo do cursor
    puller(mesh, slider_at + n * 0.0045 - up * 0.004, n, "dentes")                         # puxador pendurado
    bottom = center_line[0] + up * 0.006
    box(mesh, bottom + _normal(bottom) * base_lift, up, x, _normal(bottom), (0.008, 0.009, 0.0028), "dentes")
    for side in (1, -1):                # batentes do alto, um em cada cadarço
        box(mesh, top + n * base_lift + x * side * 0.0025 - up * 0.002, up, x, n, (0.003, 0.003, 0.0024), "dentes")
    stitched = 0
    for edge, side in ((front.plus, 1), (front.minus, -1)):   # pesponto a 6 mm da borda, prendendo o cadarço
        ids = [i for i in edge if mesh.verts[i][1] <= y_top + 1e-6]
        pts, normals = offset_line(mesh, ids, (side * 0.006, 0.0, 0.0006))
        stitched += stitch_line(mesh, pts, normals)
    return {"dentes": teeth, "pontos_pesponto": stitched}
