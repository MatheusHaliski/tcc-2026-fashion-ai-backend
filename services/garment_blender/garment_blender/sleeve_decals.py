"""Desenho na manga (o "C" da Champion, a bandeira da Napapijri): colado no lado de fora da manga, girado 60° para a
frente — é onde o logo de manga aparece na peça vestida vista de frente —, em pé com o braço caído (o alto da imagem
para o ombro). A distância é medida da ponta do ombro manga abaixo, pela linha de cima da manga; a largura, em volta
da manga. Os anéis vêm de ``sleeves.build_sleeve`` (``Mesh.sleeves``).
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image

from .geometry import Mesh

FRONT_OUT = math.radians(60)   # de cima/fora da manga em direção à frente
LIFT = 0.0007
GRID = 12


def _rings(mesh: Mesh, sleeve: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """(pontos dos anéis [r, i, 3], centros [r, 3], distância pela linha de cima desde a ponta do ombro [r])."""
    pts = np.array([[mesh.verts[i] for i in ring] for ring in sleeve["rings"]])
    centers = pts.mean(1)
    top = int(np.argmin(np.abs(np.angle(np.exp(1j * sleeve["phi"])))))   # o vértice de phi ≈ 0: o alto da manga
    line = pts[:, top]
    along = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(line, axis=0), axis=1))])
    return pts, centers, along


def _point(pts, centers, along, phis, s: float, phi: float) -> tuple[np.ndarray, np.ndarray]:
    r = int(np.clip(np.searchsorted(along, s) - 1, 0, len(along) - 2))
    t = float(np.clip((s - along[r]) / max(along[r + 1] - along[r], 1e-9), 0, 1))
    order = np.argsort(phis)
    out = []
    for ring in (pts[r], pts[r + 1]):
        out.append(np.array([np.interp(phi, phis[order], ring[order, k], period=2 * math.pi) for k in range(3)]))
    p = out[0] * (1 - t) + out[1] * t
    c = centers[r] * (1 - t) + centers[r + 1] * t
    n = p - c
    return p, n / max(np.linalg.norm(n), 1e-9)


def add_sleeve_decal(mesh: Mesh, sleeve: dict, decal, mat: str) -> int:
    """Cola o desenho na manga; devolve quantas faces entraram (0 quando não cabe na manga)."""
    with Image.open(decal.imagem) as im:
        aspect = im.height / im.width
    pts, centers, along = _rings(mesh, sleeve)
    w, h = decal.largura, decal.largura * aspect
    top, bottom = decal.abaixo_do_ombro - h / 2, decal.abaixo_do_ombro + h / 2
    top, bottom = max(top, 0.02), min(bottom, along[-1] - 0.03)   # nem no ombro nem no punho
    if bottom - top < 0.4 * h:
        return 0
    radius = float(np.linalg.norm(pts - centers[:, None], axis=2).mean())
    orient = -sleeve["side"]   # sem espelhar: na manga +x o u da imagem anda para phi menor, vista de fora
    nv = max(2, round(GRID * (bottom - top) / w))
    ids = np.empty((nv + 1, GRID + 1), int)
    for j in range(nv + 1):
        s = top + (bottom - top) * j / nv
        for i in range(GRID + 1):
            phi = FRONT_OUT + orient * (i / GRID - 0.5) * w / radius
            p, n = _point(pts, centers, along, sleeve["phi"], s, phi)
            ids[j, i] = mesh.add(p + n * LIFT)
    v_top, v_bottom = 1 - (top - (decal.abaixo_do_ombro - h / 2)) / h, 1 - (bottom - (decal.abaixo_do_ombro - h / 2)) / h
    part = "detalhe@manga_d" if sleeve["side"] > 0 else "detalhe@manga_e"
    for j in range(nv):
        v0 = v_top + (v_bottom - v_top) * j / nv
        v1 = v_top + (v_bottom - v_top) * (j + 1) / nv
        for i in range(GRID):
            u0, u1 = i / GRID, (i + 1) / GRID
            mesh.quad((ids[j + 1, i], ids[j + 1, i + 1], ids[j, i + 1], ids[j, i]),
                      [(u0, v1), (u1, v1), (u1, v0), (u0, v0)], mat, part)
    return nv * GRID
