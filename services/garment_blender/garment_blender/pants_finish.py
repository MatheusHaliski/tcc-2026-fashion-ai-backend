"""Acabamento à vista da peça de baixo: pespontos do cós e da barra e o J da braguilha; os bolsos com a costura de cada
um (pants_pockets.py); no jeans, a pala de trás, o bolsinho de moeda e os rebites; na alfaiataria, o vinco da perna.

O vinco do motor (``Mesh.seams``) só afunda 0,9 mm: de longe a braguilha e o bolso sumiam e a frente parecia um pano
liso e estufado. Aqui cada costura ganha a linha de verdade (``stitches.stitch_line``) sobre o tecido.
"""
from __future__ import annotations

import math

import numpy as np

from .closures import box
from .details import FRONT, patch, surface
from .geometry import Mesh, Row
from .pants_details import BACK, groove_line
from .pants_pockets import back_patch, cargo_details, front_mouths, side_seam_pockets, welt_pockets
from .stitches import ring_line, stitch_line

DOUBLE = 0.006       # entre as duas agulhas do pesponto duplo (m)


def _path(rows: list[Row], points: list[tuple[float, float]], lift: float = 0.0008, steps: int = 30):
    """Polilinha sobre o tronco da calça passando pelos pontos (theta, y), e a normal de fora em cada ponto."""
    pts, nrm = [], []
    for (t0, y0), (t1, y1) in zip(points, points[1:]):
        for s in np.linspace(0, 1, steps, endpoint=False):
            p, n = surface(rows, t0 + (t1 - t0) * s, y0 + (y1 - y0) * s)
            pts.append(p + n * lift); nrm.append(n)
    p, n = surface(rows, *points[-1])
    return np.array(pts + [p + n * lift]), np.array(nrm + [n])


DETAIL = "detalhe"   # a linha não é pano: fica fora das medidas e anda com a parte em que está costurada


def _stitch(mesh: Mesh, rows, points, double: bool = False, lift: float = 0.0008) -> None:
    pts, nrm = _path(rows, points, lift)
    stitch_line(mesh, pts, nrm, part=DETAIL)
    if double:   # a segunda agulha, paralela, 6 mm para dentro (para baixo na pala, para o lado no J)
        stitch_line(mesh, pts - np.array([0.0, DOUBLE, 0.0]), nrm, part=DETAIL)


def waistband(mesh: Mesh, grid: np.ndarray, i_band: int) -> None:
    """Pesponto rente às duas bordas do cós."""
    top, low = [int(v) for v in grid[-1]], [int(v) for v in grid[i_band]]
    stitch_line(mesh, *ring_line(mesh, top, -0.003), part=DETAIL)
    stitch_line(mesh, *ring_line(mesh, low, 0.003), part=DETAIL)


def hems(mesh: Mesh, hems_ids: list[list[int]], ribbed: bool) -> None:
    """Barra dobrada com pesponto duplo (a ribana do jogger não leva: é malha)."""
    if ribbed:
        return
    for ids, leg in zip(hems_ids, ("perna_d", "perna_e")):
        for h in (0.012, 0.012 + DOUBLE):
            stitch_line(mesh, *ring_line(mesh, ids, h), part=f"{DETAIL}@{leg}")


def fly_stitch(mesh: Mesh, rows, band0: float) -> None:
    """O J da braguilha à vista, do cós até a curva perto do gancho."""
    a = rows[len(rows) // 2].a
    d = 0.035 / a
    _stitch(mesh, rows, [(FRONT - d, band0 - 0.005), (FRONT - d, band0 - 0.15), (FRONT - d * 0.4, band0 - 0.185),
                         (FRONT, band0 - 0.19)])


def jeans_extras(mesh: Mesh, grid, rows, band0: float, corners: list[tuple[float, float]]) -> None:
    """Jeans de cinco bolsos: pala de trás em V com pesponto duplo, bolsinho de moeda e rebites na boca do bolso."""
    left = [(math.pi - 0.02, band0 - 0.05), (BACK, band0 - 0.09)]
    right = [(BACK, band0 - 0.09), (2 * math.pi - 0.02, band0 - 0.05)]
    for seg in (left, right):
        groove_line(mesh, grid, rows, seg)
        _stitch(mesh, rows, seg, double=True)
    a = rows[len(rows) // 2].a
    c, w = FRONT - 0.13 / a, 0.035 / a                       # bolsinho de moeda no bolso direito de quem veste (+x)
    patch(mesh, rows, [(c + w, band0 - 0.085), (c - w, band0 - 0.085), (c - w, band0 - 0.02), (c + w, band0 - 0.02)],
          0.0015, "corpo", (True, True, False, True), (4, 4))
    for th, yy in corners:                                    # rebites de cobre nas pontas da boca do bolso
        p = surface(rows, th, yy - 0.004)[0]
        n = np.array([p[0], 0.0, p[2]]); n /= max(np.linalg.norm(n), 1e-9)
        side = np.cross(n, [0.0, 1.0, 0.0]); side /= max(np.linalg.norm(side), 1e-9)
        box(mesh, p + n * 0.0008, np.array([0.0, 1.0, 0.0]), side, n, (0.006, 0.006, 0.0022), "dentes", DETAIL)


def crease(mesh: Mesh, legs: list[list[Row]]) -> None:
    """Vinco da alfaiataria: a linha passada no meio da frente de cada perna, da coxa à barra."""
    for rows, leg in zip(legs, ("perna_d", "perna_e")):
        stack = sorted(rows, key=lambda r: r.y)
        ys = [r.y for r in stack if r.y < stack[-1].y - 0.12]
        pts = np.array([[r.cx, r.y, r.b] for r in stack if r.y in ys]) + np.array([0.0, 0.0, 0.001])
        if len(pts) > 1:
            stitch_line(mesh, pts, np.array([0.0, 0.0, 1.0]), part=f"{DETAIL}@{leg}")


def finish(mesh: Mesh, spec, grid, rows, i_band: int, legs, hem_ids, band0: float, ribbed: bool) -> None:
    """Todo o acabamento à vista da calça, conforme a ficha."""
    jeans = spec.tecido.tipo == "denim" and spec.subcategoria in ("jeans", "denim_shorts", "culottes")
    waistband(mesh, grid, i_band)
    hems(mesh, hem_ids, ribbed)
    if spec.fechamento == "botao_ziper":
        fly_stitch(mesh, rows, band0)
    corners = front_mouths(mesh, rows, band0, jeans) if "faca" in spec.bolsos else []
    if jeans:
        jeans_extras(mesh, grid, rows, band0, corners)
    if "traseiro" in spec.bolsos:
        back_patch(mesh, rows, band0, jeans)
    if "vivo" in spec.bolsos:
        welt_pockets(mesh, rows, band0)
    if "lateral" in spec.bolsos:
        side_seam_pockets(mesh, rows, band0)
    if "cargo" in spec.bolsos:
        cargo_details(mesh, legs, rows[0].y * 0.45)
    if spec.subcategoria == "tailored_pants":
        crease(mesh, legs)
