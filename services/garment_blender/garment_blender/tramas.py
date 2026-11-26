"""Relevo dos tecidos que não são malha nem sarja de algodão: couro, camurça, nylon, acolchoado, veludo, cetim e lã plana.

Mesma convenção de ``fabric.height_map``: relevo 0–1 numa imagem de ``SIZE`` px que cobre ``REPEAT[kind]`` repetições
de 5 cm em cada direção (o gomo do acolchoado tem 10 cm e não cabe em 5), e a força do normal map. Tudo procedural e
com semente fixa, como o resto do motor.
"""
from __future__ import annotations

import numpy as np

SHELLS = ("couro", "camurca", "nylon", "acolchoado", "veludo", "cetim", "la_plana")
REPEAT = {"acolchoado": 2}   # repetições de 5 cm por imagem (o resto: 1)
CHANNEL = 0.6                # expoente do gomo do acolchoado: abaixo de 1, o gomo é cheio e a costura funda


def _nylon(grid, noise) -> np.ndarray:
    """O amassado largo da casca com um resto da tela de fio sintético (180 fios por 5 cm, quase invisível)."""
    x, y = grid()
    weave = 0.5 + 0.5 * np.cos(np.pi * x * 180) * np.cos(np.pi * y * 180)
    return 0.06 * weave + 0.64 * noise(21, 6) + 0.3 * noise(23, 14)


def shell_height(kind: str, grid, noise) -> tuple[np.ndarray, float]:
    """(relevo 0–1, força) do tecido ``kind`` (um de ``SHELLS``). ``grid`` e ``noise``: os de ``fabric.py``."""
    x, y = grid()
    if kind == "couro":        # flor do couro: poro miúdo sobre o vinco largo
        h = 0.45 * noise(13, 96) + 0.35 * noise(14, 192) + 0.2 * noise(15, 20)
        return h, 1.0
    if kind == "camurca":      # pelo curto e fosco, sem poro
        return 0.6 * noise(16, 256) + 0.4 * noise(17, 48), 1.2
    if kind == "veludo":       # pelo macio: só ruído fino, o brilho vem do sheen do material
        return 0.7 * noise(18, 256) + 0.3 * noise(19, 32), 0.8
    if kind == "cetim":        # flutuação do cetim: fios longos quase paralelos, pouco relevo
        floats = 0.5 + 0.5 * np.sin(2 * np.pi * (x * 120 + 0.2 * y))
        return 0.25 * floats + 0.75 * noise(22, 10), 0.8
    if kind == "la_plana":     # sarja fina de alfaiataria (2/2) coberta pela penugem da lã
        twill = 0.5 + 0.5 * np.sin(2 * np.pi * (x + y) * 90)
        return 0.6 * twill + 0.4 * noise(20, 160), 0.9
    if kind == "nylon":
        return _nylon(grid, noise), 4.0
    if kind == "acolchoado":   # gomos horizontais de 10 cm costurados na casca: a imagem cobre 2 × 2 repetições
        reps = REPEAT[kind]
        micro = np.tile(_nylon(grid, noise), (reps, reps))   # a tela na mesma resolução por cm das outras
        v = (np.arange(micro.shape[0]) + 0.5) / micro.shape[0]
        channel = np.abs(np.sin(np.pi * v)) ** CHANNEL
        return 0.88 * channel[:, None] * np.ones_like(micro) + 0.12 * micro, 22.0
    raise KeyError(kind)
