"""Cava do tronco: o contorno do recorte (para a manga nascer dele ou para o viés da regata) e, na regata, a curva.

A cava é um recorte de ``k`` colunas de cada lado do lado do tronco, da axila ao ombro. Para a manga ele é reto (a manga
nasce do retângulo). Na regata as colunas são redistribuídas em ângulo a cada anel (``warped_thetas``): o recorte fica
estreito na axila e abre até a alça, sem degraus — cortar colunas diferentes por anel deixava a borda em escada.
"""
from __future__ import annotations

import numpy as np

CURVE = (0.5, 1.0)   # regata: meia abertura da cava (rad a partir do lado) na axila e no alto, onde vira alça


def warped_thetas(j: int, k: int, i_arm: int, i_sh: int, i_neck: int, columns: int) -> np.ndarray | None:
    """Ângulos das colunas do anel ``j`` com a cava da regata curva: as colunas da cava (±``k`` do lado) se espalham
    por ±α, e as de fora vão de α até o meio da frente e das costas. α cresce da axila ao ombro (a cava é estreita
    embaixo e abre até a alça) e volta ao normal até o decote. Abaixo da axila nada muda."""
    if j < i_arm:
        return None
    lo, hi = CURVE
    if j <= i_sh:
        # abre logo acima da axila: a raiz do braço (o deltoide) passa por ali; estreita, a cava abraçava o braço e o
        # provador a empurrava em volta dele
        alpha = lo + (hi - lo) * ((j - i_arm) / max(i_sh - i_arm, 1)) ** 0.35
    else:
        natural = k * 2 * np.pi / columns
        alpha = hi + (natural - hi) * (j - i_sh) / max(i_neck - i_sh, 1)
    quarter = columns // 4
    theta = np.empty(columns)
    for c in range(columns):
        side = 0 if c < quarter or c >= 3 * quarter else columns // 2
        o = ((c - side + columns // 2) % columns) - columns // 2   # deslocamento com sinal a partir do lado
        a = abs(o)
        ang = a / k * alpha if a <= k else alpha + (a - k) / (quarter - k) * (np.pi / 2 - alpha)
        theta[c] = side * 2 * np.pi / columns + np.sign(o) * ang
    return theta % (2 * np.pi)


def armhole_path(ks: dict, i_arm: int, i_sh: int) -> list[tuple[int, int]]:
    """Contorno da cava como (anel, deslocamento de coluna a partir do lado): o fundo, subindo pela direita (andando no
    anel quando a abertura cresce), o alto e descendo pela esquerda. Com a abertura constante é o retângulo de sempre."""
    k0, right, cur = ks[i_arm], [], ks[i_arm]
    for j in range(i_arm, i_sh):
        right += [(j, o) for o in range(cur + 1, ks[j] + 1)]
        right.append((j + 1, ks[j]))
        cur = ks[j]
    top = [(i_sh, o) for o in range(cur - 1, -cur - 1, -1)]
    left = [(j, -o) for j, o in reversed(right[:-1])]
    return [(i_arm, o) for o in range(-k0, k0 + 1)] + right + top + left
