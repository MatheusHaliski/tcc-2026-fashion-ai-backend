"""Padronagem no tecido: listras e estampa corrida viram a textura de cor do corpo, com o relevo do tecido por cima.

O UV do motor é métrico (``TILE`` = 5 cm por repetição). A listra de 4,3 cm não fecha em 5 cm: a imagem cobre ``m``
repetições do relevo (listras: até 8, 40 cm numa direção só; estampa corrida: até 4 × 4) com ``n`` listras inteiras, e
o UV do corpo é dividido por ``m`` naquela direção (``uv_scale``). O período sai ajustado ao inteiro mais perto (erro
de poucos %).
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

from .fabric import SIZE, _normal, _rgb, _save, height_map, repeat, shade
from .geometry import TILE as TILE_M

MAX_TILES = 4         # estampa corrida: a imagem cresce nas duas direções
MAX_STRIPE_TILES = 8  # listras: só numa


def fit_period(period: float) -> tuple[int, int]:
    """(m repetições de 5 cm, n listras) com m·5 cm / n o mais perto do período pedido."""
    best = None
    for m in range(1, MAX_STRIPE_TILES + 1):
        n = max(1, round(m * TILE_M / period))
        err = abs(m * TILE_M / n - period) / period
        if best is None or err < best[0] - 1e-9:
            best = (err, m, n)
    return best[1], best[2]


def _band(length: int, n: int, fraction: float) -> np.ndarray:
    """0–1 ao longo de ``length`` px: 1 na listra (``fraction`` de cada um dos ``n`` períodos), borda suavizada."""
    fine = (np.arange(length * 4) + 0.5) / (length * 4) * n % 1.0 < fraction
    return fine.reshape(length, 4).mean(1)


def pattern_maps(kind: str, spec, out: Path) -> tuple[dict[str, Path], tuple[float, float]]:
    """Cor e normal map do corpo com a padronagem da ficha, e a escala do UV do corpo (u, v)."""
    h, strength = height_map(kind if repeat(kind) == 1 else "nylon")   # gomo do acolchoado: só a casca sob a estampa
    if spec.listras is not None:
        s = spec.listras
        m, n = fit_period(s.periodo)
        band = _band(SIZE * m, n, s.fracao)
        if s.direcao == "horizontal":   # varia em v (a altura): linhas da imagem
            color = np.outer(band, np.ones(SIZE))
            reps, scale = (m, 1), (1.0, 1.0 / m)
        else:
            color = np.outer(np.ones(SIZE), band)
            reps, scale = (1, m), (1.0 / m, 1.0)
        rgb = _rgb(s.fundo) * (1 - color[..., None]) + _rgb(s.listra) * color[..., None]
        tag = f"listras-{s.fundo.lstrip('#')}-{s.listra.lstrip('#')}"
    else:
        a = spec.estampa_corrida
        return image_maps(kind, a.imagem, a.lado, out, f"corrida-{Path(a.imagem).stem}")
    hh = np.tile(h, reps)
    rgb = shade(rgb, hh)   # a média de cada canal continua a da padronagem
    return _save(rgb, _normal(hh, strength), out, tag), scale


def image_maps(kind: str, image: str, side: float, out: Path, tag: str) -> tuple[dict[str, Path], tuple[float, float]]:
    """Cor e normal map de um pedaço de padronagem tirado da foto (estampa corrida, faixa xadrez da vista), que cobre
    ``side`` m de pano, com o relevo do tecido por cima; e a escala do UV."""
    h, strength = height_map(kind if repeat(kind) == 1 else "nylon")
    m = int(np.clip(round(side / TILE_M), 1, MAX_TILES))
    img = Image.open(image).convert("RGB").resize((SIZE * m, SIZE * m), Image.Resampling.LANCZOS)
    # o u do tronco cresce de +x para −x pela frente: a imagem vai espelhada para a estampa sair no sentido da foto
    rgb = np.asarray(img, float)[:, ::-1] / 255
    hh = np.tile(h, (m, m))
    return _save(shade(rgb, hh), _normal(hh, strength), out, tag), (1.0 / m, 1.0 / m)
