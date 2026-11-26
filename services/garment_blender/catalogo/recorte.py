"""O recorte RGBA de cada desenho, tirado da foto inteira (não da imagem de análise): a sombra das dobras tirada da
luminosidade (o 3D faz a sombra dele) e o alfa refeito na resolução da foto, com borda suavizada.

A análise acha o desenho numa imagem de até 900 px; ampliar a máscara dela daria degrau de até 2,7 px da foto e
perderia o traço mais fino que um pixel de análise. Aqui a máscara de análise só diz onde procurar (dilatada um pixel
de análise): dentro disso, cada pixel da foto é desenho se foge da cor do tecido com a sombra do lugar, como na
análise; o miolo claro achado na análise (``Group.fill``) entra inteiro, sem novo limiar, para não sair furado.
Nada de fechar buracos: o vão das letras fica vazado.
"""
from __future__ import annotations

import numpy as np
from PIL import Image
from scipy import ndimage

from .cores import lab_to_rgb, rgb_to_lab
from .estampa import THRESHOLD, Group, distance

MAX_SIDE = 1024      # lado maior do recorte gravado (px)


def _up(a: np.ndarray, size: tuple[int, int], how) -> np.ndarray:
    """Amplia um mapa da análise para o tamanho do recorte da foto (``size`` = (largura, altura))."""
    return np.asarray(Image.fromarray(a).resize(size, how))


def decal_rgba(rgb: np.ndarray, lab: np.ndarray, shade: np.ndarray, base: np.ndarray, group: Group,
               scale: float = 1.0) -> np.ndarray:
    """Recorte RGBA do desenho. ``rgb``: a foto inteira; ``lab``/``shade``: os mapas da análise; ``scale``: quantos
    pixels da foto valem um da análise."""
    y0, y1, x0, x1 = group.box
    big = rgb[int(y0 * scale):max(int(y0 * scale) + 1, int(round(y1 * scale))),
              int(x0 * scale):max(int(x0 * scale) + 1, int(round(x1 * scale)))]
    size = (big.shape[1], big.shape[0])
    shade_big = _up(shade[y0:y1, x0:x1].astype(np.float32), size, Image.Resampling.BILINEAR)
    lab_big = rgb_to_lab(big)
    d_big = distance(lab_big, base, shade_big)
    fill = group.fill if group.fill is not None else np.zeros_like(group.alpha)
    where = (group.alpha | fill).astype(np.uint8) * 255
    roi = _up(where, size, Image.Resampling.NEAREST) > 0
    roi = ndimage.binary_dilation(roi, iterations=max(1, int(np.ceil(scale))))
    hard = _no_specks(roi & (d_big > THRESHOLD), max(2, int(scale * scale)))
    hard |= _up(fill.astype(np.uint8) * 255, size, Image.Resampling.BILINEAR) > 127   # o miolo claro entra inteiro
    alpha = np.clip(ndimage.gaussian_filter(hard.astype(np.float32), 0.6) * 255, 0, 255)
    lab_big[..., 0] = np.clip(lab_big[..., 0] + (base[0] - shade_big), 0, 100)
    out = np.dstack([lab_to_rgb(lab_big), alpha]).astype(np.uint8)
    if max(size) > MAX_SIDE:
        k = MAX_SIDE / max(size)
        out = np.asarray(Image.fromarray(out, "RGBA").resize((max(1, round(size[0] * k)), max(1, round(size[1] * k))),
                                                             Image.Resampling.LANCZOS))
    return out


def _no_specks(hard: np.ndarray, least: int) -> np.ndarray:
    """Tira os pontinhos soltos (ruído do JPEG, fiapo da malha) menores que ``least`` pixels da foto."""
    comps, n = ndimage.label(hard)
    if n == 0:
        return hard
    sizes = ndimage.sum(hard, comps, range(1, n + 1))
    return np.isin(comps, np.flatnonzero(sizes >= least) + 1)
