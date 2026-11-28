"""Bolsos com lapela da peça de cima: os dois de peito da jaqueta militar e da camisa utilitária (``peito_lapela``) e
os dois do quadril da parka e do casaco de campo (``lapela``). Cada um é o bolso chapado (``details.patch``) com a
lapela por cima — uma placa um pouco mais larga, costurada só em cima, que cobre a boca — e a pressão no meio dela.
"""
from __future__ import annotations

import numpy as np

from .closures import box
from .details import FRONT, patch, surface
from .geometry import Mesh, Row

LIFT = 0.0025          # o bolso fica 2,5 mm acima do pano
FLAP_LIFT = 0.0045     # e a lapela, por cima da boca dele


def _pocket(mesh: Mesh, rows: list[Row], center: float, half_w: float, yb: float, yt: float, flap_h: float,
            mat: str) -> None:
    a = rows[len(rows) // 2].a
    w, fw = half_w / a, (half_w + 0.004) / a
    patch(mesh, rows, [(center + w, yb), (center - w, yb), (center - w, yt), (center + w, yt)], LIFT, mat,
          (True, True, False, True), (6, 6))
    flap_b = yt - flap_h
    patch(mesh, rows, [(center + fw, flap_b), (center - fw, flap_b), (center - fw, yt + 0.006), (center + fw, yt + 0.006)],
          FLAP_LIFT, mat, (False, False, True, False), (6, 3))
    p, n = surface(rows, center, flap_b + 0.012)
    side = np.cross(n, [0.0, 1.0, 0.0]); side /= max(np.linalg.norm(side), 1e-9)
    box(mesh, p + n * (FLAP_LIFT + 0.0012), np.array([0.0, 1.0, 0.0]), side, n, (0.011, 0.011, 0.003), "botao",
        "detalhe")


def chest_flap_pockets(mesh: Mesh, rows: list[Row], y_arm: float, mat: str) -> None:
    """Dois bolsos de peito de 13 × 15 cm com lapela de 5 cm, a 10 cm do meio de cada lado."""
    a = rows[len(rows) // 2].a
    for side in (1, -1):
        _pocket(mesh, rows, FRONT - side * 0.105 / a, 0.065, y_arm - 0.19, y_arm - 0.04, 0.05, mat)


def hip_flap_pockets(mesh: Mesh, rows: list[Row], y_rib: float, mat: str) -> None:
    """Dois bolsos de quadril de 17 × 19 cm com lapela de 6 cm, a 12 cm do meio de cada lado, 6 cm acima da barra."""
    a = rows[len(rows) // 3].a
    for side in (1, -1):
        _pocket(mesh, rows, FRONT - side * 0.12 / a, 0.085, y_rib + 0.06, y_rib + 0.25, 0.06, mat)
