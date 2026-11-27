"""Referencial de uma borda do tronco: a normal de fora do pano e a direção, na superfície, para dentro do pano.

O viés da cava e do decote dobra para dentro da peça (pela normal) e deita para o lado do pano. Com a normal
horizontal (saindo do eixo do corpo), na alça que passa por cima do ombro a "normal" ficava deitada e a dobra
saía para cima, em aba. Aqui a normal é a das faces do tronco em volta de cada vértice da borda.
"""
from __future__ import annotations

import numpy as np

from .geometry import Mesh


def _unit(v: np.ndarray) -> np.ndarray:
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-12)


def edge_frame(mesh: Mesh, loop: list[int], closed: bool = True) -> tuple[np.ndarray, np.ndarray]:
    """(normal, away) por vértice de ``loop``: a normal de fora (média das faces do tronco em volta, pesada pela área)
    e a direção na superfície perpendicular à borda que entra no pano (para o centro das faces vizinhas)."""
    v = np.array(mesh.verts)
    tronco = [f for f, p in zip(mesh.faces, mesh.parts) if p == "tronco"]
    wanted = set(loop)
    normal_sum = {i: np.zeros(3) for i in loop}
    toward = {i: np.zeros(3) for i in loop}
    sign = 0.0
    for f in tronco:
        p = v[list(f)]
        n = np.cross(p[2] - p[0], p[3] - p[1] if len(f) == 4 else p[1] - p[0])   # dobro da área, na orientação da face
        c = p.mean(0)
        radial = np.array([c[0], 0.0, c[2]])
        sign += float(n @ radial)   # a malha tem uma orientação só: a soma diz se a face aponta para fora ou para dentro
        for i in f:
            if i in wanted:
                normal_sum[i] += n
                toward[i] += c - v[i]
    sign = 1.0 if sign >= 0 else -1.0
    pts = v[loop]
    normal = _unit(np.array([normal_sum[i] for i in loop]) * sign)
    ext = np.vstack([pts[-1:], pts, pts[:1]]) if closed else np.vstack([pts[:1], pts, pts[-1:]])
    tangent = _unit(ext[2:] - ext[:-2])
    away = _unit(np.cross(tangent, normal))
    # o pano fica sempre do mesmo lado de quem anda pela borda: um sinal só, o da maioria (vértice a vértice, numa
    # quina da cava o centro das faces vizinhas fica de lado e o sinal trocava, torcendo o viés)
    if np.einsum("ij,ij->i", away, np.array([toward[i] for i in loop])).sum() < 0:
        away = -away
    return normal, away
