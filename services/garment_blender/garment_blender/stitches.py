"""Pesponto à vista: a linha da costura como pontos de verdade (traços de linha um pouco acima do tecido).

O vinco (``Mesh.seams``) marca onde o tecido foi costurado; o pesponto é a linha que se vê por cima dele — numa barra,
na vista dos botões, ao lado do zíper, na boca do bolso. Cada ponto é uma faixa estreita (``WIDTH``) de ``LENGTH`` de
comprimento, com ``GAP`` até o próximo: 3 mm de ponto e 1,5 mm de intervalo, o passo de uma máquina reta comum.
"""
from __future__ import annotations

import numpy as np

from .geometry import Mesh

LENGTH = 0.003    # comprimento de um ponto (m)
GAP = 0.0015      # intervalo entre pontos
WIDTH = 0.0008    # largura aparente da linha
LIFT = 0.0007     # altura acima do tecido


def resample(points: np.ndarray, step: float) -> tuple[np.ndarray, np.ndarray]:
    """Pontos a cada ``step`` metros ao longo da polilinha e a tangente em cada um."""
    seg = np.linalg.norm(np.diff(points, axis=0), axis=1)
    s = np.concatenate([[0.0], np.cumsum(seg)])
    at = np.arange(0.0, s[-1] + 1e-9, step)
    out = np.stack([np.interp(at, s, points[:, k]) for k in range(3)], 1)
    tangent = np.gradient(out, axis=0) if len(out) > 1 else np.array([[0.0, 1.0, 0.0]])
    tangent /= np.maximum(np.linalg.norm(tangent, axis=1, keepdims=True), 1e-9)
    return out, tangent


def stitch_line(mesh: Mesh, points, normals, mat: str = "linha", part: str = "tronco") -> int:
    """Pesponto ao longo de ``points`` (polilinha sobre o tecido) com a normal de fora em cada ponto (uma normal só, ou
    uma por ponto). Devolve quantos pontos de linha foram feitos."""
    points = np.asarray(points, float)
    normals = np.broadcast_to(np.asarray(normals, float), points.shape)
    if len(points) < 2:
        return 0
    centers, tangent = resample(points, LENGTH + GAP)
    # normal de cada ponto: a da polilinha mais próxima (as polilinhas daqui são curtas e bem amostradas)
    near = np.argmin(np.linalg.norm(points[None, :, :] - centers[:, None, :], axis=2), axis=1)
    count = 0
    for c, t, n in zip(centers, tangent, normals[near]):
        n = n / max(np.linalg.norm(n), 1e-9)
        t = t - n * t.dot(n)
        if np.linalg.norm(t) < 1e-9:
            continue
        t /= np.linalg.norm(t)
        w = np.cross(n, t) * WIDTH / 2
        a, b = c + n * LIFT - t * LENGTH / 2, c + n * LIFT + t * LENGTH / 2
        idx = [mesh.add(p) for p in (a - w, b - w, b + w, a + w)]
        mesh.quad(idx, [(0, 0), (1, 0), (1, 1), (0, 1)], mat, part)
        count += 1
    return count


def offset_line(mesh: Mesh, ids: list[int], offset, normal=(0.0, 0.0, 1.0)) -> tuple[np.ndarray, np.ndarray]:
    """Polilinha paralela a uma borda (vértices ``ids``), deslocada ``offset`` (vetor em m) — a linha de pesponto a
    alguns milímetros da borda — e a normal de fora de cada ponto."""
    pts = np.array([mesh.verts[i] for i in ids]) + np.asarray(offset, float)
    return pts, np.broadcast_to(np.asarray(normal, float), pts.shape)


def ring_line(mesh: Mesh, ids: list[int], lift_to: float, closed: bool = True) -> tuple[np.ndarray, np.ndarray]:
    """Linha sobre um anel (barra, punho), subindo ``lift_to`` metros na direção y, com a normal radial (para fora do
    centro do anel). Usada no pesponto da barra dobrada."""
    pts = np.array([mesh.verts[i] for i in ids])
    if closed:
        pts = np.vstack([pts, pts[:1]])
    c = pts.mean(0)
    pts = pts + np.array([0.0, lift_to, 0.0])
    radial = pts - c
    radial[:, 1] = 0.0
    radial /= np.maximum(np.linalg.norm(radial, axis=1, keepdims=True), 1e-9)
    return pts, radial
