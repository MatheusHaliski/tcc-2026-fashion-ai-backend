"""Texturas de tecido geradas por procedimento (numpy): cor e relevo (normal map), repetíveis sem emenda.

Cada imagem cobre ``TILE`` (5 cm) do tecido real, então a contagem de pontos é a do tecido: tricô de lã com ~2,2
colunas e ~3 carreiras por cm, ribana 2×2, malha de moletom/jersey bem mais fina e sarja/denim em diagonal de 45°.
Nada de foto nem de IA: o mesmo tecido sai igual em qualquer máquina (semente fixa).
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

SIZE = 512
# colunas e carreiras de ponto por repetição de 5 cm e força do relevo; na sarja, diagonais por repetição
KNITS = {"malha_la": (11, 15, 5.0), "malha_algodao": (16, 22, 3.5), "moletom": (30, 40, 1.6), "jersey": (34, 46, 1.4)}
TWILLS = {"sarja": (70, 2.0), "denim": (60, 2.6)}
WEAVES = {"tricoline": (110, 1.1)}   # tela (um fio por cima, um por baixo): fios por repetição (par) e força


def _grid():
    y, x = np.mgrid[0:SIZE, 0:SIZE] / SIZE
    return x, y


def _noise(seed: int, cells: int) -> np.ndarray:
    """Ruído suave e repetível (valor em grade, interpolado em cosseno, com borda que fecha no começo)."""
    rng = np.random.default_rng(seed)
    g = rng.random((cells, cells))
    x, y = _grid()
    fx, fy = x * cells, y * cells
    i0, j0 = fx.astype(int) % cells, fy.astype(int) % cells
    i1, j1 = (i0 + 1) % cells, (j0 + 1) % cells
    tx, ty = (1 - np.cos(np.pi * (fx % 1))) / 2, (1 - np.cos(np.pi * (fy % 1))) / 2
    top = g[j0, i0] * (1 - tx) + g[j0, i1] * tx
    bottom = g[j1, i0] * (1 - tx) + g[j1, i1] * tx
    return top * (1 - ty) + bottom * ty


def _stitch(cols: int, rows: int) -> np.ndarray:
    """Relevo do ponto de meia (as duas pernas inclinadas de cada laçada formam o V)."""
    x, y = _grid()
    fx, fy = (x * cols) % 1, (y * rows) % 1
    h = np.zeros_like(fx)
    for sign in (-1, 1):
        cx = 0.5 + sign * 0.22
        dx, dy = fx - cx - sign * (fy - 0.5) * 0.35, fy - 0.5
        h = np.maximum(h, np.clip(1 - (dx / 0.2) ** 2 - (dy / 0.55) ** 2, 0, None))
    return np.sqrt(h)


def height_map(kind: str, rib: bool = False) -> tuple[np.ndarray, float]:
    """(relevo 0–1, força do normal map) do tecido (ou dos dentes do zíper: ``kind == "dentes"``)."""
    x, y = _grid()
    if kind == "dentes":   # 20 dentes por 5 cm (passo de 2,5 mm), cada um um bloco arredondado
        f = (y * 20) % 1
        return np.clip(1 - ((f - 0.5) / 0.32) ** 2, 0, 1) ** 0.5, 6.0
    if kind in WEAVES:   # xadrez fininho dos cruzamentos de urdume e trama
        n, strength = WEAVES[kind]
        h = 0.5 + 0.5 * np.cos(np.pi * x * n) * np.cos(np.pi * y * n)
        return 0.8 * h + 0.2 * _noise(5, 64), strength
    if kind in TWILLS:
        lines, strength = TWILLS[kind]
        h = 0.5 + 0.5 * np.sin(2 * np.pi * (x + y) * lines)        # diagonal da sarja (repete na borda)
        h = 0.75 * h + 0.25 * _noise(7, 64)
        return h, strength
    cols, rows, strength = KNITS[kind]
    h = _stitch(cols, rows)
    if rib:   # ribana 2×2: duas colunas em relevo, duas recuadas
        wale = 0.5 + 0.5 * np.cos(2 * np.pi * x * (cols / 2))
        h = h * (0.35 + 0.65 * wale)
        strength *= 1.6
    return 0.85 * h + 0.15 * _noise(3, 32), strength


def _rgb(hex_color: str) -> np.ndarray:
    return np.array([int(hex_color[i:i + 2], 16) for i in (1, 3, 5)], float) / 255


def _normal(h: np.ndarray, strength: float) -> np.ndarray:
    hs = h * strength   # derivada circular: o relevo fecha na borda da repetição, sem emenda
    gx = (np.roll(hs, -1, 1) - np.roll(hs, 1, 1)) / 2
    gy = (np.roll(hs, -1, 0) - np.roll(hs, 1, 0)) / 2
    n = np.stack([-gx * SIZE / 64, gy * SIZE / 64, np.ones_like(h)], -1)   # +Y para cima (convenção do glTF)
    return n / np.linalg.norm(n, axis=-1, keepdims=True)


def _save(rgb: np.ndarray, normal: np.ndarray, out: Path, tag: str) -> dict[str, Path]:
    """Cor e normal map em JPEG (o .glb leva JPEG; o PNG fica para o que tem alfa, o decalque)."""
    out.mkdir(parents=True, exist_ok=True)
    paths = {"cor": out / f"{tag}-cor.jpg", "normal": out / f"{tag}-normal.jpg"}
    Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).save(paths["cor"], quality=90)
    Image.fromarray(((normal * 0.5 + 0.5) * 255).astype(np.uint8)).save(paths["normal"], quality=92)
    return paths


def write_maps(kind: str, color: str, out: Path, rib: bool = False) -> dict[str, Path]:
    """Grava a cor e o normal map e devolve os caminhos; a rugosidade vai como valor no material."""
    h, strength = height_map(kind, rib)
    base = _rgb(color)
    shade = 0.78 + 0.3 * h[..., None]
    rgb = base * shade
    if kind == "denim":   # trama branca aparecendo entre os fios de índigo
        rgb = rgb * 0.85 + 0.15 * (1 - h[..., None]) * np.array([0.92, 0.93, 0.95])
    if kind != "dentes":
        rgb = rgb * (0.94 + 0.12 * _noise(11, 128)[..., None])
    # a cor no nome: o cadarço do zíper (sarja um tom abaixo) não sobrescreve o corpo de sarja
    return _save(rgb, _normal(h, strength), out, f"{kind}{'-ribana' if rib else ''}-{color.lstrip('#')}")
