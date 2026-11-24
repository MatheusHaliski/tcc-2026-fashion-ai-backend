"""Mangas que nascem do contorno da cava e as bordas com espessura (barra, punho e gola dobrados para dentro).

A manga segue o eixo do braço (``angle`` abaixo da horizontal), com a linha de cima saindo da ponta do ombro e se
afastando 3 cm por metro dela (o braço afina).
Cada estação da manga tem o perímetro da medida (cava → bíceps → cotovelo → punho); o primeiro anel são os próprios
vértices da cava do tronco, então tronco e manga formam uma malha só.
"""
from __future__ import annotations

import numpy as np

from .geometry import TILE, Mesh, _arc, ellipse_semi_axes
from .sizes import TopMeasures

SLOPE = 0.03          # queda da linha de cima da manga (m por m)
SLEEVE_RATIO = 0.85   # profundidade/altura da seção da manga
CAP = 0.15            # da cava até o bíceps a seção muda aos poucos da forma da cava para a da manga (m)


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
    return out


def build_sleeve(mesh: Mesh, loop: list[int], m: TopMeasures, side: int, y_shoulder: float, ribbed: bool,
                 angle: float = 0.0) -> tuple[list[int], np.ndarray]:
    """Manga horizontal a partir do contorno da cava (a queda até o ângulo do braço é feita depois, por ``bend``).
    Devolve a boca do punho (na ordem do contorno) e a direção da manga."""
    angle = 0.0
    p0 = np.array([mesh.verts[i] for i in loop])
    c = p0.mean(0)
    phi = np.arctan2(p0[:, 2] - c[2], p0[:, 1] - c[1])   # ângulo a partir de +Y em direção a +Z
    local = np.stack([p0[:, 1] - c[1], p0[:, 2] - c[2]], 1)   # o contorno no plano da cava (cima, frente)
    a = np.radians(angle)
    d = np.array([side * np.cos(a), -np.sin(a), 0.0])        # eixo da manga
    up = np.array([side * np.sin(a), np.cos(a), 0.0])        # "cima" da seção (lado de fora do braço)
    z = np.array([0.0, 0.0, 1.0])
    anchor = np.array([side * m.ombro * 0.01 / 2, y_shoulder, 0.0])   # ponta do ombro: a linha de cima passa aqui
    loop_perimeter = float(_arc(p0)[-1])
    rings, rows, centers = [list(loop)], [p0], [c]
    stations = _stations(m, loop_perimeter, ribbed)
    cap = stations[4][0]
    # o centro da cava já está ``start`` metros adiante da ponta do ombro ao longo do braço (com a manga caída, ~9 cm):
    # as estações do começo são comprimidas entre ``start`` e o fim da transição, sempre avançando (a manga não dobra)
    start = float(np.clip((c - anchor) @ d, 0.0, 0.8 * cap))
    for x, perim, _ in stations:
        ay, az = ellipse_semi_axes(perim, SLEEVE_RATIO)
        s = start + x * (1 - start / cap) if x < cap else x
        center = anchor + d * s - up * (ay + SLOPE * s)
        pts = center + np.outer(ay * np.cos(phi), up) + np.outer(az * np.sin(phi), z)
        w = min(1.0, x / cap)
        w = w * w * (3 - 2 * w)                    # suave: sem degrau embaixo do braço
        if w < 1:   # mistura com o contorno da cava, girado para o plano da estação e escalado para o perímetro dela
            k = perim / loop_perimeter
            mid = (c + d * (s - (c - anchor) @ d)) * (1 - w) + center * w
            shape = mid + np.outer(local[:, 0] * k, up) + np.outer(local[:, 1] * k, z)
            pts = shape * (1 - w) + pts * w
            center = mid
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



def bend(mesh: Mesh, side: int, m: TopMeasures, y_shoulder: float, angle: float) -> None:
    """Deixa a manga cair ``angle`` graus em torno de um pivô logo abaixo da ponta do ombro, com o giro entrando aos
    poucos entre a cava e o bíceps: o tecido de cima estica um pouco e o de baixo do braço se junta, como numa peça
    pendurada. Só os vértices que são exclusivamente da manga giram (a cava continua costurada ao tronco)."""
    if angle <= 0:
        return
    part = "manga_d" if side > 0 else "manga_e"
    sleeve, torso = set(), set()
    for f, p in zip(mesh.faces, mesh.parts):
        (sleeve if p == part else torso).update(f)
    moving = sorted(sleeve - torso)
    x_sp = m.ombro * 0.01 / 2
    pivot = np.array([side * (x_sp - 0.02), y_shoulder - 0.05])
    x0, x1 = x_sp - 0.01, x_sp + CAP
    a = np.radians(angle) * -side
    for i in moving:
        x, y, z = mesh.verts[i]
        t = float(np.clip((abs(x) - x0) / (x1 - x0), 0, 1))
        t = t * t * (3 - 2 * t)
        th = a * t
        dx, dy = x - pivot[0], y - pivot[1]
        mesh.verts[i] = (pivot[0] + dx * np.cos(th) - dy * np.sin(th), pivot[1] + dx * np.sin(th) + dy * np.cos(th), z)
