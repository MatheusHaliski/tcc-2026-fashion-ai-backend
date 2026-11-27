"""Confere no modelo pronto as medidas da ficha: corta a malha por um plano e mede o perímetro da seção.

É a fita métrica do motor: o relatório põe lado a lado o que a ficha pediu e o que a malha tem (tórax, barra, bíceps,
punho, envergadura e altura). Diferença acima de 2 % é erro de construção, não de tabela.
"""
from __future__ import annotations

import numpy as np

from .geometry import Mesh
from .sleeves import CAP
from .sizes import TopMeasures


def _edges(mesh: Mesh, part: str | None = None) -> np.ndarray:
    pairs = set()
    for f, p in zip(mesh.faces, mesh.parts):
        if part is not None and p != part:
            continue
        for a, b in zip(f, f[1:] + f[:1]):
            pairs.add((min(a, b), max(a, b)))
    return np.array(sorted(pairs))


def section_perimeter(mesh: Mesh, normal, point, part: str | None = None) -> float:
    """Perímetro da seção da malha no plano que passa por ``point`` com a normal ``normal``, só nas faces da parte
    ``part`` ("tronco", "manga_d"…; None = a malha toda)."""
    v = np.array(mesh.verts)
    n = np.asarray(normal, float) / np.linalg.norm(normal)
    dist = (v - np.asarray(point, float)) @ n + 1e-5   # um plano exatamente sobre um anel não cruza nenhuma aresta
    e = _edges(mesh, part)
    da, db = dist[e[:, 0]], dist[e[:, 1]]
    a, b = v[e[:, 0]], v[e[:, 1]]
    cross = (da * db) < 0
    t = (da[cross] / (da[cross] - db[cross]))[:, None]
    pts = a[cross] + (b[cross] - a[cross]) * t
    if len(pts) < 3:
        return 0.0
    u = np.cross(n, [0.0, 0.0, 1.0] if abs(n[2]) < 0.9 else [1.0, 0.0, 0.0]); u /= np.linalg.norm(u)
    w = np.cross(n, u)
    q = np.stack([(pts - pts.mean(0)) @ u, (pts - pts.mean(0)) @ w], 1)
    # a seção tem a casca de fora e a dobra de dentro: o contorno externo é o de maior raio em cada ângulo
    angle, radius = np.arctan2(q[:, 1], q[:, 0]), np.linalg.norm(q, axis=1)
    bins = np.linspace(-np.pi, np.pi, 181)
    outer = [q[(angle >= lo) & (angle < hi)][np.argmax(radius[(angle >= lo) & (angle < hi)])]
             for lo, hi in zip(bins[:-1], bins[1:]) if ((angle >= lo) & (angle < hi)).any()]
    outer = np.array(outer)
    return float(np.linalg.norm(np.diff(np.vstack([outer, outer[:1]]), axis=0), axis=1).sum())


def measure_top(mesh: Mesh, m: TopMeasures, angle: float = 0.0) -> dict[str, float]:
    """Medidas tiradas da malha (cm), na mesma altura/posição em que a ficha as define (manga direita, ao longo do
    eixo dela, ``angle`` graus abaixo da horizontal)."""
    cm = 0.01
    v = np.array(mesh.verts)
    a = np.radians(angle)
    d = np.array([np.cos(a), -np.sin(a), 0.0])
    anchor = np.array([m.ombro * cm / 2, (m.comprimento - m.caimento_ombro) * cm, 0.0])
    reach = float(((v[v[:, 0] > 0] - anchor) @ d).max())
    # bíceps: no fim da transição da cava ou 2,5 cm abaixo da axila ao longo do braço, o que vier depois (com a manga
    # caída, o plano no fim da transição ainda corta a cava, que é vertical no flanco do tronco)
    armpit = (m.cava - m.caimento_ombro) * cm / max(np.sin(a), 1e-6) + 0.025 if angle > 20 else 0.0
    cap = max(min(CAP, 0.6 * m.manga * cm), armpit)
    has_sleeve = "manga_d" in mesh.parts   # regata, colete: sem manga, só o tronco
    sleeve = (lambda point: round(section_perimeter(mesh, d, point, "manga_d") / cm, 1)) if has_sleeve else (lambda point: 0.0)  # noqa: E731
    return {
        "torax": round(section_perimeter(mesh, (0, 1, 0), (0, (m.comprimento - m.cava - 2.5) * cm, 0), "tronco") / cm, 1),
        "barra": round(section_perimeter(mesh, (0, 1, 0), (0, (m.ribana_barra + 3) * cm, 0), "tronco") / cm, 1),
        "biceps": sleeve(anchor + d * cap),
        "punho": sleeve(anchor + d * (reach - m.ribana_punho * cm / 2)),
        "manga": round(reach / cm, 1),
        "altura_total": round((v[:, 1].max() - v[:, 1].min()) / cm, 1),
    }
