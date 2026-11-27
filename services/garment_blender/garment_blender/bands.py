"""Faixas de outra cor no mesmo tecido: a da barra (o top bege com a barra amarela) e as da manga (o anel escuro na
manga da camiseta branca). Não mudam a malha: trocam o material das faces que caem dentro da faixa.
"""
from __future__ import annotations

import numpy as np

from .geometry import Mesh

FABRIC = ("corpo", "ribana")


def paint_hem(mesh: Mesh, height: float) -> int:
    """Faces do tronco (barra dobrada incluída) abaixo da faixa viram ``faixa_barra``. A altura é levada à linha de
    vértices mais perto dela (os anéis do tronco são horizontais): a borda da faixa sai reta, sem serrilhado."""
    torso = [k for k, (p, m) in enumerate(zip(mesh.parts, mesh.mats)) if p == "tronco" and m in FABRIC]
    if not torso:
        return 0
    ys = np.unique(np.round([mesh.verts[i][1] for k in torso for i in mesh.faces[k]], 4))
    cut = float(ys[np.argmin(np.abs(ys - height))])
    count = 0
    for k in torso:
        if max(mesh.verts[i][1] for i in mesh.faces[k]) <= cut + 2e-4:
            mesh.mats[k] = "faixa_barra"
            count += 1
    return count


def _along(mesh: Mesh, sleeve: dict) -> dict[int, float]:
    """Distância de cada vértice da manga à ponta do ombro, pela linha de cima da manga (a do anel dele)."""
    pts = np.array([[mesh.verts[i] for i in ring] for ring in sleeve["rings"]])
    top = int(np.argmin(np.abs(np.angle(np.exp(1j * sleeve["phi"])))))
    line = pts[:, top]
    along = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(line, axis=0), axis=1))])
    return {int(v): float(along[r]) for r, ring in enumerate(sleeve["rings"]) for v in ring}


def paint_sleeves(mesh: Mesh, bands) -> int:
    """Cada faixa de manga (``lado``, ``distancia``, ``largura``) vira o material ``faixa_manga_<k>`` nas faces da
    manga daquele lado cujo meio cai dentro dela."""
    by_side = {("manga_esquerda" if s["side"] > 0 else "manga_direita"): s for s in mesh.sleeves}
    count = 0
    for k, band in enumerate(bands):
        sleeve = by_side.get(band.lado)
        if sleeve is None:
            continue
        along = _along(mesh, sleeve)
        lo, hi = band.distancia - band.largura / 2, band.distancia + band.largura / 2
        for j, (face, mat) in enumerate(zip(mesh.faces, mesh.mats)):
            if mat in FABRIC and all(i in along for i in face) and lo <= np.mean([along[i] for i in face]) <= hi:
                mesh.mats[j] = f"faixa_manga_{k}"
                count += 1
    return count
