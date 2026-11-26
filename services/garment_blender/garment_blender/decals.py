"""Decalque: o desenho da foto (logo, estampa localizada) colado na frente do tronco.

É uma placa fina, 0,7 mm acima do pano, amostrada na mesma superfície que forma o tronco (``details.surface``): ela
acompanha a curva do peito e, no provador, anda com o pano. A largura é medida ao longo do pano (arco), não em
projeção. A imagem vai inteira na placa (UV 0–1) e o fundo sai pelo alfa (material com recorte, ``alphaMode: MASK``).

Onde o pano não existe a placa também não: acima do decote ela desce para baixo dele; numa frente que abre (zíper,
botões, quimono) as faces que cruzariam o vão ficam de fora.
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image

from .details import FRONT, surface
from .geometry import Mesh, Row

LIFT = 0.0007        # acima do pano (m)
NECK_CLEAR = 0.012   # folga mínima entre o alto do desenho e o decote (m)
HEM_CLEAR = 0.02     # e entre o pé do desenho e a barra
GRID = 24            # divisões na largura (a altura segue a proporção)


def _arc(rows: list[Row], y: float) -> tuple[np.ndarray, np.ndarray]:
    """Ângulos da frente (0 a π) e o arco a partir do centro da frente, positivo para +x (θ < π/2)."""
    th = np.linspace(0.02, math.pi - 0.02, 157)
    pts = np.array([surface(rows, t, y)[0] for t in th])
    cum = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))])
    return th, float(np.interp(FRONT, th, cum)) - cum


def _nominal(rows: list[Row], theta: float, y: float) -> float:
    """Altura nominal do anel cujo ponto em ``theta`` fica na altura real ``y`` (o decote desce a frente)."""
    yn = y
    for _ in range(4):
        yn += y - surface(rows, theta, yn)[0][1]
    return yn


def place(decal, aspect: float, height: float, neck_front: float, floor: float) -> tuple[float, float, float]:
    """(centro y real, largura, altura) do desenho: abaixo do decote, acima da barra, encolhido se não couber."""
    w, h = decal.largura, decal.largura * aspect
    room = neck_front - NECK_CLEAR - (floor + HEM_CLEAR)
    if h > room:
        w, h = w * room / h, room
    y = height - decal.abaixo_do_ombro
    y = min(y, neck_front - NECK_CLEAR - h / 2)
    y = max(y, floor + HEM_CLEAR + h / 2)
    return y, w, h


def add_decal(mesh: Mesh, rows: list[Row], decal, mat: str, neck_front: float, floor: float,
              gap: float = 0.0, gap_from: float = -1.0, limit=None) -> int:
    """Cola um desenho; devolve quantas faces entraram. ``gap``: meia largura do vão no meio da frente (0 sem vão),
    acima da altura ``gap_from`` (a vista curta da polo só abre em cima). ``limit(y)``: meia largura do pano na altura
    y (a cava da peça sem manga): o desenho não passa dela."""
    with Image.open(decal.imagem) as im:
        aspect = im.height / im.width
    y_c, w, h = place(decal, aspect, rows[-1].y, neck_front, floor)
    nu = GRID
    nv = max(2, round(GRID * h / w))
    half = None
    ids = np.empty((nv + 1, nu + 1), int)
    arcs = np.empty((nv + 1, nu + 1))
    for j in range(nv + 1):
        y = y_c + h / 2 - h * j / nv
        th_tab, arc_tab = _arc(rows, y)
        half = float(arc_tab[0])
        if limit is not None:   # até a cava: o arco no ângulo em que o anel tem a meia largura do pano
            a = float(surface(rows, 0.0, y)[0][0])
            half = min(half, float(np.interp(math.acos(min(1.0, limit(y) / a)), th_tab, arc_tab)))
        for i in range(nu + 1):
            s = float(np.clip(decal.x - w / 2 + w * i / nu, -half * 0.97, half * 0.97))
            th = float(np.interp(s, arc_tab[::-1], th_tab[::-1]))
            p, n = surface(rows, th, _nominal(rows, th, y))
            ids[j, i] = mesh.add(p + n * LIFT)
            arcs[j, i] = s
    faces = 0
    for j in range(nv):
        y_mid = y_c + h / 2 - h * (j + 0.5) / nv
        for i in range(nu):
            lo, hi = arcs[j, i], arcs[j, i + 1]
            if gap and y_mid > gap_from and lo < gap and hi > -gap:
                continue
            u0, u1, v0, v1 = i / nu, (i + 1) / nu, 1 - j / nv, 1 - (j + 1) / nv
            mesh.quad((ids[j + 1, i], ids[j + 1, i + 1], ids[j, i + 1], ids[j, i]),
                      [(u0, v1), (u1, v1), (u1, v0), (u0, v0)], mat, "detalhe")
            faces += 1
    return faces
