"""Mangas que nascem do contorno da cava e as bordas com espessura (barra, punho e gola dobrados para dentro).

A manga segue o eixo do braço (``angle`` abaixo da horizontal), com a linha de cima saindo da ponta do ombro e se
afastando 3 cm por metro dela (o braço afina).
Cada estação da manga tem o perímetro da medida (cava → bíceps → cotovelo → punho); o primeiro anel são os próprios
vértices da cava do tronco, então tronco e manga formam uma malha só.
"""
from __future__ import annotations

import numpy as np

from .geometry import TILE, Mesh, _arc, densify, ellipse_semi_axes
from .sizes import TopMeasures

SLOPE = 0.03          # queda da linha de cima da manga (m por m)
SLEEVE_RATIO = 0.85   # profundidade/altura da seção da manga
CAP = 0.15            # da cava até o bíceps a seção muda aos poucos da forma da cava para a da manga (m)
# Manga caída: a articulação do ombro fica 4 cm para dentro da ponta do ombro (o eixo do braço sai dela).
JOINT_IN = 0.04


def _stations(m: TopMeasures, loop_perimeter: float, ribbed: bool) -> list[tuple[float, float, str]]:
    """(distância da ponta do ombro em m, perímetro em m, material) do ombro ao fim do punho."""
    cm, L = 0.01, m.manga * 0.01
    cuff = m.ribana_punho * cm if ribbed else 0.0
    cap = min(CAP, 0.6 * L)
    st = [(cap * t, loop_perimeter + (m.biceps * cm - loop_perimeter) * t, "corpo") for t in (0.1, 0.3, 0.55, 0.8)]
    st.append((cap, m.biceps * cm, "corpo"))
    if L > 0.3:
        st.append((0.55 * L, (m.biceps * 0.82 + m.punho * 0.18) * cm, "corpo"))
    before = (m.punho * (1.3 if ribbed else 1.0)) * cm
    st.append((L - cuff - (0.01 if ribbed else 0.0), max(before, m.punho * cm), "corpo"))
    if ribbed:
        st += [(L - cuff, m.punho * cm, "ribana"), (L - cuff / 2, m.punho * cm, "ribana"), (L, m.punho * cm, "ribana")]
    out, last = [], -1.0
    for x, p, mat in st:   # estações sempre crescentes (manga curta encosta o bíceps no fim)
        if x > last + 0.004:
            out.append((x, p, mat)); last = x
    return densify(out)


def build_sleeve(mesh: Mesh, loop: list[int], m: TopMeasures, side: int, y_shoulder: float, ribbed: bool,
                 angle: float = 0.0) -> tuple[list[int], np.ndarray]:
    """Manga montada na cava e caída ``angle`` graus abaixo da horizontal (0 = pose T; 80 = braço do avatar).

    Do bíceps ao punho, um tubo reto no eixo do braço, que sai da articulação do ombro. Da cava ao bíceps, cada ponto
    do contorno da cava vai ao ponto de mesmo ângulo do anel do bíceps por uma curva de Bézier que sai do tronco na
    horizontal e chega na direção do braço: o alto da cava vira o lado de fora do braço (a cabeça da manga desce por
    cima do ombro) e a axila vira o lado de dentro. Nada passa acima da linha do ombro. Devolve a boca do punho (na
    ordem do contorno) e a direção da manga."""
    cm = 0.01
    p0 = np.array([mesh.verts[i] for i in loop])
    c = p0.mean(0)
    phi = np.arctan2(p0[:, 2] - c[2], p0[:, 1] - c[1])   # ângulo a partir de +Y em direção a +Z
    a = np.radians(angle)
    d = np.array([side * np.cos(a), -np.sin(a), 0.0])        # eixo da manga
    up = np.array([side * np.sin(a), np.cos(a), 0.0])        # "cima" da seção (lado de fora do braço)
    z = np.array([0.0, 0.0, 1.0])
    ay_b, _ = ellipse_semi_axes(m.biceps * cm, SLEEVE_RATIO)
    joint = np.array([side * (m.ombro * cm / 2 - JOINT_IN * np.sin(a)), y_shoulder - ay_b, 0.0])
    stations = _stations(m, float(_arc(p0)[-1]), ribbed)
    cap = min(CAP, 0.6 * m.manga * cm)

    def ring(x: float, perim: float):
        ay, az = ellipse_semi_axes(perim, SLEEVE_RATIO)
        center = joint + d * x + up * (ay_b - ay - SLOPE * x)   # a linha de cima da manga segue reta
        return center + np.outer(ay * np.cos(phi), up) + np.outer(az * np.sin(phi), z), center

    bicep, _ = ring(cap, m.biceps * cm)
    rings, rows, centers = [list(loop)], [p0], [c]
    for x, perim, _ in stations:
        if x >= cap - 1e-9:
            pts, center = ring(x, perim)
        else:   # cabeça da manga: Bézier da cava (saindo na horizontal) ao bíceps (chegando no eixo do braço)
            t, h = x / cap, cap / 3
            q1, q2 = p0 + np.array([side * h, 0.0, 0.0]), bicep - d * h
            pts = (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * q1 + 3 * (1 - t) * t ** 2 * q2 + t ** 3 * bicep
            center = pts.mean(0)
        rings.append([mesh.add(p) for p in pts]); rows.append(pts); centers.append(center)
    mats = ["corpo"] + [s[2] for s in stations]
    n = len(loop)
    along = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(np.array(centers), axis=0), axis=1))])
    for r in range(len(rings) - 1):
        a0, a1 = _arc(rows[r]), _arc(rows[r + 1])
        v0, v1 = along[r] / TILE, along[r + 1] / TILE
        mat = "ribana" if mats[r] == "ribana" and mats[r + 1] == "ribana" else "corpo"
        for i in range(n):
            j = (i + 1) % n
            mesh.quad((rings[r][i], rings[r][j], rings[r + 1][j], rings[r + 1][i]),
                      [(a0[i] / TILE, v0), (a0[i + 1] / TILE, v0), (a1[i + 1] / TILE, v1), (a1[i] / TILE, v1)], mat,
                      "manga_d" if side > 0 else "manga_e")
    under = int(np.argmin(np.cos(phi)))            # costura de baixo da manga: o ponto mais baixo do contorno
    mesh.seams.update(int(ring[under]) for ring in rings)
    if ribbed:                                     # emenda do punho
        first_rib = 1 + next(k for k, s in enumerate(stations) if s[2] == "ribana")
        mesh.seams.update(int(v) for v in rings[first_rib])
    return rings[-1], d


def extend(mesh: Mesh, loop: list[int], axis, steps: list[tuple[float, float]], mat: str, part: str = "tronco") -> list[int]:
    """Anéis novos a partir de um contorno: cada passo (avanço em m ao longo de ``axis``, escala radial em torno do
    centro do contorno). Faz a dobra da barra, do punho e a gola. Devolve o último anel."""
    axis = np.asarray(axis, float) / np.linalg.norm(axis)
    base = np.array([mesh.verts[i] for i in loop])
    c = base.mean(0)
    prev, prev_pts, travelled = list(loop), base, 0.0
    n = len(loop)
    for advance, scale in steps:
        pts = c + (base - c) * scale + axis * advance
        ring = [mesh.add(p) for p in pts]
        a0, a1 = _arc(prev_pts), _arc(pts)
        step = float(np.linalg.norm(pts.mean(0) - prev_pts.mean(0))) + 1e-4
        v0, v1 = travelled / TILE, (travelled + step) / TILE
        for i in range(n):
            j = (i + 1) % n
            mesh.quad((prev[i], prev[j], ring[j], ring[i]),
                      [(a0[i] / TILE, v0), (a0[i + 1] / TILE, v0), (a1[i + 1] / TILE, v1), (a1[i] / TILE, v1)], mat,
                      part)
        prev, prev_pts, travelled = ring, pts, travelled + step
    return prev


def inset(loop_pts: np.ndarray, thickness: float) -> float:
    """Escala radial que recua o contorno ``thickness`` metros para dentro (pelo raio médio)."""
    r = float(np.linalg.norm(loop_pts - loop_pts.mean(0), axis=1).mean())
    return max(0.5, 1 - thickness / max(r, 1e-6))
