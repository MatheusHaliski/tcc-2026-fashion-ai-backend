"""Ponte da alça por cima do ombro e os contornos abertos (cavas, decote, barra) lidos da malha.

A alça da frente e a das costas sobem retas até o alto do painel; a ponte as liga por cima do ombro numa curva de
Bézier no plano (y, z) de cada coluna (x fixo): sai da frente para cima, passa pela linha do ombro e desce para as
costas. Os vértices das pontas são os do painel (malha fechada, sem costura aberta) e o meio da ponte é a costura do
ombro.
"""
from __future__ import annotations

import numpy as np

from .geometry import TILE, Mesh

SEGMENTS = 8   # trechos da ponte da frente às costas (com 6, a curva sobre o ombro ficava facetada)


def shoulder_y(cut, x: float) -> float:
    """Linha do ombro da peça em x: o HPS no pescoço, descendo até a ponta do ombro."""
    t = (abs(x) - cut.neck_a) / max(cut.sh_half - cut.neck_a, 1e-6)
    return cut.H - cut.caimento * float(np.clip(t, 0, 1))


def _unit(v: np.ndarray) -> np.ndarray:
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-12)


def bridge(mesh: Mesh, cut, front_cols: list[int], top_f: list[int], top_b: list[int], u: np.ndarray,
           below_f: np.ndarray, below_b: np.ndarray) -> list[list[int]]:
    """Liga a borda de cima da alça da frente (``top_f``, colunas ``front_cols`` em ordem) à das costas (``top_b``, as
    colunas parceiras). ``u``: coordenada u (arco) de cada coluna; ``below_*``: a linha da alça logo abaixo (a curva
    sai na direção da alça, sem quina). Devolve as linhas da ponte, da frente às costas."""
    pf = np.array([mesh.verts[i] for i in top_f])
    pb = np.array([mesh.verts[i] for i in top_b])
    df, db = _unit(pf - below_f), _unit(pb - below_b)
    rise = np.array([shoulder_y(cut, p[0]) - p[1] for p in pf])
    # o meio da Bézier sobe 3/8 da soma das alturas dos controles: chega na linha do ombro
    lift = (8 * rise / (3 * np.maximum(df[:, 1] + db[:, 1], 0.5)))[:, None]
    q1, q2 = pf + df * lift, pb + db * lift
    rows, pts = [list(top_f)], [pf]
    for s in np.arange(1, SEGMENTS) / SEGMENTS:
        p = (1 - s) ** 3 * pf + 3 * (1 - s) ** 2 * s * q1 + 3 * (1 - s) * s ** 2 * q2 + s ** 3 * pb
        rows.append([mesh.add(v) for v in p]); pts.append(p)
    rows.append(list(top_b)); pts.append(pb)
    along = np.concatenate([np.zeros((1, len(pf))),
                            np.cumsum(np.linalg.norm(np.diff(np.array(pts), axis=0), axis=2), axis=0)])
    v = (pf[:, 1][None, :] + along) / TILE
    for s in range(SEGMENTS):
        for k in range(len(front_cols) - 1):
            mesh.quad((rows[s][k], rows[s][k + 1], rows[s + 1][k + 1], rows[s + 1][k]),
                      [(u[k] / TILE, v[s, k]), (u[k + 1] / TILE, v[s, k + 1]), (u[k + 1] / TILE, v[s + 1, k + 1]),
                       (u[k] / TILE, v[s + 1, k])], "corpo")
    mesh.seams.update(int(i) for i in rows[SEGMENTS // 2])   # costura do ombro
    return rows


def boundary_cycles(faces: list[tuple]) -> list[list[int]]:
    """Contornos abertos de um conjunto de faces de mesma orientação: cada aresta de uma face só, seguida no sentido
    da face. Devolve cada contorno como ciclo de vértices (sem repetir o primeiro)."""
    count: dict = {}
    for f in faces:
        for a, b in zip(f, f[1:] + f[:1]):
            key = (min(a, b), max(a, b))
            count[key] = count.get(key, 0) + 1
    nxt = {}
    for f in faces:
        for a, b in zip(f, f[1:] + f[:1]):
            if count[(min(a, b), max(a, b))] == 1:
                if a in nxt:
                    raise ValueError(f"contorno ramificado no vértice {a}")
                nxt[a] = b
    cycles, seen = [], set()
    for start in nxt:
        if start in seen:
            continue
        cyc, v = [], start
        while v not in seen:
            seen.add(v); cyc.append(int(v)); v = nxt[v]
        cycles.append(cyc)
    return cycles


def open_path(cycle: list[int], start: int, end: int, avoid: int) -> list[int]:
    """Trecho de um ciclo de ``start`` a ``end``, no sentido que não passa logo por ``avoid`` (a borda da frente)."""
    i = cycle.index(start)
    seq = cycle[i:] + cycle[:i]
    if len(seq) > 1 and seq[1] == avoid:
        seq = [seq[0]] + seq[1:][::-1]
    return seq[: seq.index(end) + 1]
