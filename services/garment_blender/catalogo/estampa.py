"""Estampa e logo na foto da peça: o que difere da cor do tecido, separado da sombra das dobras.

A sombra muda a luminosidade devagar; a estampa muda de repente. Por isso a referência de cada pixel não é a cor do
tecido, é a cor do tecido com a sombra do lugar (``shading``: a luminosidade dos pixels lisos em volta, borrada).
Pixel que foge dela é candidato; candidatos finos e compridos (costura, borda de bolso, vinco), botões em fila e a
gola por dentro saem; o resto, juntado letra com letra, vira decalque: um recorte RGBA com a sombra tirada.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import ndimage

from .cores import lab_to_rgb

LIKE_AB, LIKE_L = 10.0, 22.0   # pixel "liso": até 10 de croma e 22 de luminosidade longe da cor do tecido
SHADE_RANGE = 35.0             # a sombra das dobras escurece (ou a luz clareia) até isso
THRESHOLD = 15.0               # distância (Lab, com a sombra tirada) a partir da qual o pixel é estampa
MIN_GROUP = 0.0003             # menor desenho aceito, em fração da área da peça (logo de peito ~0,1–0,3 %)


def shading(lab: np.ndarray, mask: np.ndarray, base: np.ndarray, sigma: float) -> np.ndarray:
    """Luminosidade esperada do tecido liso em cada pixel (média gaussiana dos pixels lisos em volta)."""
    like = mask & (np.hypot(lab[..., 1] - base[1], lab[..., 2] - base[2]) < LIKE_AB) & \
        (np.abs(lab[..., 0] - base[0]) < LIKE_L)
    weight = ndimage.gaussian_filter(like.astype(np.float32), sigma)
    total = ndimage.gaussian_filter(np.where(like, lab[..., 0], 0).astype(np.float32), sigma)
    s = np.where(weight > 0.05, total / np.maximum(weight, 1e-6), base[0])
    return np.clip(s, base[0] - SHADE_RANGE, base[0] + SHADE_RANGE)


def distance(lab: np.ndarray, base: np.ndarray, shade: np.ndarray) -> np.ndarray:
    """Distância (Lab) de cada pixel à cor do tecido com a sombra do lugar."""
    return np.sqrt((lab[..., 0] - shade) ** 2 + (lab[..., 1] - base[1]) ** 2 + (lab[..., 2] - base[2]) ** 2)


def candidates(d: np.ndarray, mask: np.ndarray, width: int) -> np.ndarray:
    inner = ndimage.binary_erosion(mask, iterations=max(3, int(0.006 * width)))   # a sombra do contorno não conta
    c = inner & (d > THRESHOLD)
    return ndimage.binary_opening(c, structure=np.ones((2, 2), bool))


def _thin(sl, comp: np.ndarray) -> bool:
    """Componente fino e comprido: costura, borda de bolso, vinco, zíper."""
    h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
    fill = comp.sum() / max(1, h * w)
    return max(h, w) / max(1, min(h, w)) > 6 or (fill < 0.12 and max(h, w) > 20)


def _fold(comp: np.ndarray, lab: np.ndarray, shade: np.ndarray, base: np.ndarray, h: int, w: int) -> bool:
    """Dobra: risco comprido da mesma cor do tecido, só mais escuro (o vinco) ou mais claro (a luz na crista)."""
    px = lab[comp]
    darker = float((px[:, 0] - shade[comp]).mean()) < 0
    hue = float(np.hypot(px[:, 1] - base[1], px[:, 2] - base[2]).mean())
    return hue < 8 and max(h, w) > (2.2 if darker else 2.5) * min(h, w)


def clean(cand: np.ndarray, mask: np.ndarray, frame, lab: np.ndarray, shade: np.ndarray, base: np.ndarray) -> np.ndarray:
    """Tira dos candidatos o que não é desenho: fino e comprido, a sombra rente à borda (entre braço e tronco, na
    cava), a dobra, a gola por dentro e a fila de botões."""
    comps, n = ndimage.label(cand, structure=np.ones((3, 3), bool))
    out = np.zeros_like(cand)
    small = []
    width = max(1, frame.right - frame.left)
    mask_area = mask.sum()
    edge = ndimage.distance_transform_edt(mask)
    for i, sl in enumerate(ndimage.find_objects(comps), start=1):
        comp = comps[sl] == i
        area = comp.sum()
        if area < 4 or _thin(sl, comp):
            continue
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        depth = edge[sl][comp]
        if depth.max() < 0.02 * width or (np.median(depth) < 0.035 * width and max(h, w) > 1.8 * min(h, w)):
            continue
        if _fold(comp, lab[sl], shade[sl], base, h, w):
            continue
        cy, cx = (sl[0].start + sl[0].stop) / 2, (sl[1].start + sl[1].stop) / 2
        near_neck = sl[0].start < frame.top + 0.09 * frame.height and abs(cx - frame.center) < 0.16 * width
        if near_neck and sl[0].stop < frame.top + 0.16 * frame.height:   # gola por dentro, etiqueta
            continue
        if area < 0.002 * mask_area and abs(cx - frame.center) < 0.05 * width:
            small.append((i, cx, cy))
            continue
        out[sl] |= comp
    for i in _keep_not_buttons(small, width, frame.height):
        out |= comps == i
    return out


def _keep_not_buttons(small: list, width: int, height: int) -> list[int]:
    """Pontinhos no eixo: três ou mais um embaixo do outro (mesma coluna, espalhados na altura) são botões — o motor
    faz os dele; letras de um logo ficam lado a lado (mesma linha) e voltam."""
    buttons = set()
    for i, cx, cy in small:
        column = [(j, y) for j, x, y in small if abs(x - cx) < 0.012 * width]
        ys = [y for _, y in column]
        if len(column) >= 3 and max(ys) - min(ys) > 0.12 * height:
            buttons.update(j for j, _ in column)
    return [i for i, _, _ in small if i not in buttons]


@dataclass
class Group:
    box: tuple[int, int, int, int]   # y0, y1, x0, x1 (px, na imagem de análise)
    area: int                        # pixels de desenho
    alpha: np.ndarray                # máscara do desenho no recorte
    contrast: float = 0.0            # distância média (Lab, sem a sombra) do desenho ao tecido

    def sure(self) -> bool:
        """Desenho de verdade: contraste alto, ou médio num desenho compacto. Dobra e sombra que escaparam do filtro
        ficam logo acima do limiar e são compridas."""
        h, w = self.box[1] - self.box[0], self.box[3] - self.box[2]
        return self.contrast >= 26 or (self.contrast >= 19 and max(h, w) <= 2.5 * min(h, w))


def groups(cand: np.ndarray, frame, mask_area: float, dist: np.ndarray, limit: int = 4) -> list[Group]:
    """Desenhos: candidatos juntados (letra com letra, peça com peça) pela dilatação de ~1,2 % da largura da peça.
    ``dist``: a distância de cada pixel ao tecido (Lab, sem a sombra), para o contraste de cada desenho."""
    r = max(2, int(0.012 * (frame.right - frame.left)))
    joined = ndimage.binary_dilation(cand, iterations=r)
    lab, n = ndimage.label(joined)
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        alpha = cand[sl] & (lab[sl] == i)
        area = int(alpha.sum())
        if area < MIN_GROUP * mask_area:
            continue
        ys, xs = np.nonzero(alpha)
        y0, x0 = sl[0].start + ys.min(), sl[1].start + xs.min()
        y1, x1 = sl[0].start + ys.max() + 1, sl[1].start + xs.max() + 1
        alpha = cand[y0:y1, x0:x1] & (lab[y0:y1, x0:x1] == i)
        g = Group((y0, y1, x0, x1), area, alpha, float(dist[y0:y1, x0:x1][alpha].mean()))
        if g.sure() and alpha.mean() >= 0.08:   # só contorno ralo (o pesponto do bolso) não é desenho
            out.append(g)
    return sorted(out, key=lambda g: -g.area)[:limit]


def spread(cand: np.ndarray, mask: np.ndarray, frame) -> float:
    """Em quantas das 9 casas (3 × 3) do tronco há desenho (> 4 % da casa): estampa corrida ocupa quase todas."""
    width, (h, w) = frame.right - frame.left, mask.shape
    x0, x1 = max(0, int(frame.center - 0.3 * width)), min(w, int(frame.center + 0.3 * width))
    y0, y1 = max(0, int(frame.top + 0.15 * frame.height)), min(h, int(frame.hem - 0.05 * frame.height))
    if x1 - x0 < 3 or y1 - y0 < 3:
        return 0.0
    hits = 0
    for ys in np.array_split(np.arange(y0, y1), 3):
        for xs in np.array_split(np.arange(x0, x1), 3):
            cell_m = mask[np.ix_(ys, xs)]
            if cell_m.sum() > 0 and (cand[np.ix_(ys, xs)] & cell_m).sum() > 0.04 * cell_m.sum():
                hits += 1
    return hits / 9


def decal_rgba(rgb: np.ndarray, lab: np.ndarray, shade: np.ndarray, base: np.ndarray, group: Group,
               scale: float = 1.0) -> np.ndarray:
    """Recorte RGBA do desenho: a sombra das dobras tirada da luminosidade (o 3D faz a sombra dele) e o alfa do
    desenho. ``scale`` > 1: recorte da foto original, maior que a de análise (o alfa é ampliado)."""
    y0, y1, x0, x1 = group.box
    fix = lab[y0:y1, x0:x1].copy()
    fix[..., 0] = np.clip(fix[..., 0] + (base[0] - shade[y0:y1, x0:x1]), 0, 100)
    out = np.dstack([lab_to_rgb(fix), group.alpha * 255]).astype(np.uint8)
    if scale == 1.0:
        return out
    from PIL import Image
    big = rgb[int(y0 * scale):int(y1 * scale), int(x0 * scale):int(x1 * scale)]
    size = (big.shape[1], big.shape[0])
    a = Image.fromarray(out[..., 3]).resize(size, Image.Resampling.BILINEAR)
    l_fix = Image.fromarray(((base[0] - shade[y0:y1, x0:x1]) * 2 + 128).clip(0, 255).astype(np.uint8)).resize(
        size, Image.Resampling.BILINEAR)
    from .cores import rgb_to_lab
    lab_big = rgb_to_lab(big)
    lab_big[..., 0] = np.clip(lab_big[..., 0] + (np.asarray(l_fix, float) - 128) / 2, 0, 100)
    alpha = (np.asarray(a) > 127) * 255
    return np.dstack([lab_to_rgb(lab_big), alpha]).astype(np.uint8)
