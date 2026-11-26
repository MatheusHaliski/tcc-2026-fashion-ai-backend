"""Fechamento por botões: vista transpassada, botões de quatro furos costurados em X e casas bordadas.

O painel +x (o esquerdo de quem veste, no masculino) passa por cima do −x por ``LAP`` metros. Os botões ficam no
centro da frente, sobre o painel de cima (passando pela casa), e a casa é uma fenda horizontal bordada com a linha —
um pouco mais longa que o botão, então as pontas dela aparecem dos dois lados dele. A vista leva duas linhas de
pesponto: rente à borda e na largura da vista.
"""
from __future__ import annotations

import math

import numpy as np

from .closures import box
from .geometry import Mesh, FrontOpening
from .stitches import offset_line, stitch_line

LAP = 0.026           # transpasse da vista (m): a largura da vista de uma camisa-jaqueta
RADIUS = 0.0068       # botão de 13,6 mm
SIDES = 20


def button(mesh: Mesh, at: np.ndarray, normal: np.ndarray, r: float = RADIUS) -> None:
    """Botão de quatro furos: disco com aba (borda alta), centro rebaixado, furos escuros e a linha em X."""
    n = normal / np.linalg.norm(normal)
    u = np.cross(n, [0.0, 1.0, 0.0]); u /= np.linalg.norm(u)
    v = np.cross(n, u)
    profile = [(0.0, 0.0013), (0.55, 0.0014), (0.78, 0.0022), (1.0, 0.0019), (1.0, 0.0004), (0.88, 0.0)]
    rings = []
    for rr, h in profile:
        ring = [mesh.add(at + n * h + (u * math.cos(a) + v * math.sin(a)) * rr * r)
                for a in np.linspace(0, 2 * math.pi, SIDES, endpoint=False)]
        rings.append(ring)
    for k in range(len(rings) - 1):
        for i in range(SIDES):
            j = (i + 1) % SIDES
            mesh.quad((rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]), [(0, 0), (1, 0), (1, 1), (0, 1)],
                      "botao")
    for ring, flip in ((rings[0], False), (rings[-1], True)):   # tampas: o centro e o fundo
        c = mesh.add(np.mean([mesh.verts[i] for i in ring], axis=0))
        for i in range(SIDES):
            j = (i + 1) % SIDES
            tri = (c, ring[j], ring[i]) if flip else (c, ring[i], ring[j])
            mesh.quad(tri, [(0.5, 0.5), (1, 0), (0, 1)], "botao")
    hole = 0.0017                                            # furos a 1,7 mm do centro, 0,8 mm de raio
    top = at + n * 0.00145
    for du, dv in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
        c = top + (u * du + v * dv) * hole / math.sqrt(2)
        ring = [mesh.add(c + (u * math.cos(a) + v * math.sin(a)) * 0.0008) for a in np.linspace(0, 2 * math.pi, 8, endpoint=False)]
        mid = mesh.add(c)
        for i in range(8):
            mesh.quad((mid, ring[i], ring[(i + 1) % 8]), [(0.5, 0.5), (1, 0), (0, 1)], "furo")
    for d in ((u + v), (u - v)):                             # linha em X passando pelos furos
        d = d / np.linalg.norm(d)
        box(mesh, top + n * 0.00005, d, np.cross(n, d), n, (hole * 2.2, 0.0007, 0.0005), "linha")


def buttonhole(mesh: Mesh, at: np.ndarray, normal: np.ndarray, length: float) -> None:
    """Casa horizontal bordada: dois cordões de linha ao longo da fenda e as travetas nas pontas."""
    n = normal / np.linalg.norm(normal)
    x = np.array([1.0, 0.0, 0.0]); y = np.array([0.0, 1.0, 0.0])
    for dy in (-1, 1):
        box(mesh, at + y * dy * 0.0011, x, y, n, (length, 0.0012, 0.0006), "linha")
    for dx in (-1, 1):
        box(mesh, at + x * dx * length / 2, y, x, n, (0.0036, 0.0012, 0.0007), "linha")


def buttons(mesh: Mesh, front: FrontOpening, count: int, y_low: float, y_high: float) -> dict:
    """``count`` botões e casas no centro da frente, de ``y_high`` (perto do decote) a ``y_low``, e o pesponto da
    vista. Devolve contagens para o relatório."""
    edge = np.array([mesh.verts[i] for i in front.plus])        # borda do painel de cima (passa do meio)
    ys = np.linspace(y_high, y_low, count)
    for y in ys:
        z = float(np.interp(y, edge[:, 1], edge[:, 2]))
        at = np.array([0.0, y, z + 0.0004])
        normal = np.array([0.0, 0.0, 1.0])
        buttonhole(mesh, at - np.array([0.0015, 0.0, 0.0]), normal, 2 * RADIUS + 0.003)
        button(mesh, at + normal * 0.0006, normal)
    stitched = 0
    ids = [i for i in front.plus if mesh.verts[i][1] <= y_high + 0.03]
    for offset in (0.002, LAP + 0.004):                         # rente à borda e na largura da vista
        pts, normals = offset_line(mesh, ids, (offset, 0.0, 0.0006))
        stitched += stitch_line(mesh, pts, normals)
    return {"botoes": count, "pontos_pesponto": stitched}
