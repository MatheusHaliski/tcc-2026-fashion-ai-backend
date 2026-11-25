"""Detalhes da calça: braguilha em J com botão, cordão do elástico, passantes, bolso faca (só a abertura), bolsos de
trás chapados e bolsos cargo com lapela."""
from __future__ import annotations

import math

import numpy as np

from .details import FRONT, patch, surface
from .geometry import COLUMNS, TILE, Mesh, Row

BACK = 3 * math.pi / 2


def _nearest(grid: np.ndarray, rows: list[Row], theta: float, y: float) -> int:
    j = int(np.argmin([abs(r.y - y) for r in rows]))
    return int(grid[j, int(round(theta / (2 * math.pi) * COLUMNS)) % COLUMNS])


def groove_line(mesh: Mesh, grid, rows, points) -> None:
    """Pesponto ao longo de uma linha (theta, y) no tronco da calça: marca os vértices mais próximos como vinco."""
    for (t0, y0), (t1, y1) in zip(points, points[1:]):
        for s in np.linspace(0, 1, 24):
            mesh.seams.add(_nearest(grid, rows, t0 + (t1 - t0) * s, y0 + (y1 - y0) * s))


def fly(mesh: Mesh, grid, rows, band0: float, y_c: float) -> None:
    """Braguilha: costura do meio da frente até o gancho e o pesponto em J do lado esquerdo de quem veste (+x)."""
    a = rows[len(rows) // 2].a
    d = 0.035 / a
    groove_line(mesh, grid, rows, [(FRONT, band0), (FRONT, y_c)])
    groove_line(mesh, grid, rows, [(FRONT - d, band0), (FRONT - d, band0 - 0.15), (FRONT - d * 0.4, band0 - 0.185),
                                   (FRONT, band0 - 0.19)])


def slant_pockets(mesh: Mesh, grid, rows, band0: float) -> None:
    """Bolso faca: a abertura é uma linha do cós até a lateral, 16 cm abaixo (os dois lados)."""
    a = rows[len(rows) // 2].a
    for sgn in (1, -1):
        start = FRONT - sgn * 0.09 / a
        side = 0.0 if sgn > 0 else math.pi
        groove_line(mesh, grid, rows, [(start, band0), (side + sgn * 0.02, band0 - 0.16)])


def back_pockets(mesh: Mesh, rows: list[Row], band0: float) -> None:
    a = rows[len(rows) // 2].a
    for sgn in (1, -1):
        c, w = BACK + sgn * 0.085 / a, 0.07 / a
        corners = [(c - w, band0 - 0.20), (c + w, band0 - 0.20), (c + w, band0 - 0.05), (c - w, band0 - 0.05)]
        patch(mesh, rows, corners, 0.0025, "corpo", (True, True, False, True), (6, 6))


def cargo_pockets(mesh: Mesh, legs: list[list[Row]], knee: float) -> None:
    """Bolso cargo na lateral de cada coxa (18 × 20 cm) com a lapela por cima (só a costura de cima)."""
    for rows, outer, part in zip(legs, (0.0, math.pi), ("detalhe@perna_d", "detalhe@perna_e")):
        a = min(rows, key=lambda r: abs(r.y - (knee + 0.16))).a   # largura da perna no meio do bolso
        w = 0.09 / a
        yb, yt = knee + 0.06, knee + 0.26
        body = [(outer - w, yb), (outer + w, yb), (outer + w, yt), (outer - w, yt)]
        if outer:   # perna esquerda: o lado de fora é theta = pi; a ordem dos cantos inverte
            body = [(outer + w, yb), (outer - w, yb), (outer - w, yt), (outer + w, yt)]
        stack = sorted(rows, key=lambda r: r.y)
        patch(mesh, stack, body, 0.004, "corpo", (True, True, False, True), (6, 7), part)
        flap = [(c[0], y) for c, y in zip(body, (yt - 0.065, yt - 0.065, yt + 0.012, yt + 0.012))]
        patch(mesh, stack, flap, 0.0075, "corpo", (False, False, True, False), (6, 3), part)


def belt_loops(mesh: Mesh, rows: list[Row], band0: float, top: float) -> None:
    a = rows[-1].a
    for theta in (FRONT - 0.7, FRONT + 0.7, 0.05, math.pi - 0.05, BACK - 0.5, BACK, BACK + 0.5):
        w = 0.0055 / a
        c = [(theta - w, band0 - 0.008), (theta + w, band0 - 0.008), (theta + w, top - 0.003), (theta - w, top - 0.003)]
        patch(mesh, rows, c, 0.003, "cos", (True, False, True, False), (1, 4))


def button(mesh: Mesh, rows: list[Row], y: float, mat: str) -> None:
    """Botão de metal (1,7 cm, 3 mm de altura) no meio da frente do cós: um cilindro de 12 lados."""
    p, n = surface(rows, FRONT, y)
    side = np.cross(n, [0.0, 1.0, 0.0]); side /= np.linalg.norm(side)
    up = np.cross(side, n)
    rings = []
    for h in (0.0, 0.003):
        rings.append([mesh.add(p + n * h + (side * math.cos(t) + up * math.sin(t)) * 0.0085)
                      for t in np.linspace(0, 2 * math.pi, 12, endpoint=False)])
    for k in range(12):
        j = (k + 1) % 12
        mesh.quad((rings[0][k], rings[0][j], rings[1][j], rings[1][k]), [(0, 0), (1, 0), (1, 1), (0, 1)], mat, "detalhe")
    center = mesh.add(p + n * 0.0035)
    for k in range(12):
        mesh.faces.append((rings[1][k], rings[1][(k + 1) % 12], center))
        mesh.uvs.append([(0, 0), (1, 0), (0.5, 1)]); mesh.mats.append(mat); mesh.parts.append("detalhe")


def drawcord(mesh: Mesh, rows: list[Row], y: float, mat: str) -> None:
    """Cordão do elástico: duas pontas de 24 cm saindo do cós, 2 cm de cada lado do meio da frente."""
    a = rows[-1].a
    for sgn in (1, -1):
        p, n = surface(rows, FRONT + sgn * 0.02 / a, y)
        start = p + n * 0.004
        rings = []
        for k, s in enumerate(np.linspace(0, 0.24, 9)):
            c = start + np.array([sgn * 0.01 * s / 0.24, -s, 0.012 * math.sin(math.pi * s / 0.24)])
            rings.append([mesh.add(c + np.array([math.cos(t) * 0.0028, 0, math.sin(t) * 0.0028]))
                          for t in np.linspace(0, 2 * math.pi, 6, endpoint=False)])
        for r in range(len(rings) - 1):
            for k in range(6):
                j = (k + 1) % 6
                mesh.quad((rings[r][k], rings[r][j], rings[r + 1][j], rings[r + 1][k]),
                          [(k / 6, r * 0.03 / TILE), ((k + 1) / 6, r * 0.03 / TILE), ((k + 1) / 6, (r + 1) * 0.03 / TILE),
                           (k / 6, (r + 1) * 0.03 / TILE)], mat, "detalhe")


def double_knee(mesh: Mesh, legs: list[list[Row]], knee: float) -> None:
    """Joelho duplo (calça de trabalho): reforço chapado na frente de cada perna, do meio da canela ao meio da coxa,
    costurado nos quatro lados."""
    w = 0.65   # rad para cada lado da frente: o reforço cobre a frente da perna
    for rows, part in zip(legs, ("detalhe@perna_d", "detalhe@perna_e")):
        stack = sorted(rows, key=lambda r: r.y)
        c = [(FRONT + w, knee - 0.12), (FRONT - w, knee - 0.12), (FRONT - w, knee + 0.22), (FRONT + w, knee + 0.22)]
        patch(mesh, stack, c, 0.003, "corpo", (True, True, True, True), (8, 8), part)
