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
FOLD_DL = 40.0                 # o vinco mais fundo escurece ~30 de L; daí para cima é traço de tinta
FILL_MIN = 4.5                 # dentro do contorno forte, o preenchimento claro (bege no branco) a partir disso
FILL_FROM = 35.0               # contraste do contorno que deixa procurar o preenchimento dentro dele


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
    """Dobra: risco comprido da mesma cor do tecido, só mais escuro (o vinco) ou mais claro (a luz na crista). O vinco
    escurece pouco (até ~30 de L, já na foto em modelo); traço preto no branco (ou branco no preto) foge muito mais da
    sombra e é tinta: o "9" e o "1" de contorno preto da camiseta branca não são dobra."""
    px = lab[comp]
    d_l = px[:, 0] - shade[comp]
    if float(np.abs(d_l).mean()) >= FOLD_DL:
        return False
    hue = float(np.hypot(px[:, 1] - base[1], px[:, 2] - base[2]).mean())
    return hue < 8 and max(h, w) > (2.2 if float(d_l.mean()) < 0 else 2.5) * min(h, w)


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
    """Pontinhos no eixo: três ou mais um embaixo do outro (mesma coluna, espalhados na altura e separados uns dos
    outros) são botões — o motor faz os dele. Pontinho com vizinhos lado a lado na mesma linha é letra (o logo de
    tachinhas, o texto em pontos) e volta, com os vizinhos."""
    def letter(cx, cy):
        return sum(1 for _, x, y in small if abs(y - cy) < 0.015 * height and 0 < abs(x - cx) < 0.06 * width) >= 2
    alone = [(i, x, y) for i, x, y in small if not letter(x, y)]
    buttons = set()
    for i, cx, cy in alone:
        ys = sorted(y for _, x, y in alone if abs(x - cx) < 0.012 * width)
        gaps = np.diff(ys) if len(ys) > 1 else np.array([])
        if len(ys) >= 3 and ys[-1] - ys[0] > 0.12 * height and (gaps > 0.03 * height).mean() > 0.6:
            buttons.update(j for j, x, _ in alone if abs(x - cx) < 0.012 * width)
    return [i for i, _, _ in small if i not in buttons]


@dataclass
class Group:
    box: tuple[int, int, int, int]   # y0, y1, x0, x1 (px, na imagem de análise)
    area: int                        # pixels de desenho
    alpha: np.ndarray                # máscara do desenho no recorte
    contrast: float = 0.0            # distância média (Lab, sem a sombra) do desenho ao tecido
    fill: np.ndarray | None = None   # preenchimento claro achado dentro do contorno (fora do ``alpha``)

    def sure(self) -> bool:
        """Desenho de verdade: contraste alto, ou médio num desenho compacto. Dobra e sombra que escaparam do filtro
        ficam logo acima do limiar e são compridas."""
        h, w = self.box[1] - self.box[0], self.box[3] - self.box[2]
        return self.contrast >= 26 or (self.contrast >= 19 and max(h, w) <= 2.5 * min(h, w))


def groups(cand: np.ndarray, frame, mask_area: float, dist: np.ndarray, limit: int = 4,
           fill: tuple[np.ndarray, np.ndarray] | None = None) -> list[Group]:
    """Desenhos: candidatos juntados (letra com letra, peça com peça) pela dilatação de ~1,2 % da largura da peça.
    ``dist``: a distância de cada pixel ao tecido (Lab, sem a sombra), para o contraste de cada desenho;
    ``fill``: para o miolo claro (``fill_inside``), a distância que vale e o mapa de onde o pano tem outra cor de
    verdade; sem ele vale ``dist``."""
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
            if g.contrast >= FILL_FROM:
                weak, real = (dist, None) if fill is None else fill
                g.fill = fill_inside(alpha, weak[y0:y1, x0:x1], max(1, r // 2), touching=not frame.worn,
                                     real=None if real is None else real[y0:y1, x0:x1])
            out.append(g)
    return sorted(out, key=lambda g: -g.area)[:limit]


def fill_inside(alpha: np.ndarray, dist: np.ndarray, close: int, touching: bool = False,
                real: np.ndarray | None = None) -> np.ndarray:
    """O miolo de pouco contraste dentro de um contorno forte (o "91" bege de contorno preto na camiseta branca): os
    pixels que fogem um pouco do tecido (``FILL_MIN``) e ficam presos no contorno fechado. O miolo da cor do próprio
    tecido (o vão do "A", do "9") continua vazado; pontinho solto de ruído não entra. ``touching`` (foto da peça
    sozinha, sem dobra de corpo): vale também o miolo que só encosta no traço forte, dentro da caixa do desenho — o
    contorno de um pixel do lado de lá some na análise e não fecha o "9". ``real``: onde o pano tem outra cor de
    verdade; o pedaço de miolo que não é quase todo assim (o pano do próprio tecido dentro da letra vazada) sai."""
    pad = close + 1
    hull = np.pad(alpha, pad)
    hull = ndimage.binary_fill_holes(ndimage.binary_closing(hull, iterations=close))[pad:-pad, pad:-pad]
    weak = ~alpha & (dist > FILL_MIN)
    comps, n = ndimage.label(weak if touching else weak & hull)
    if n == 0:
        return weak & hull
    idx = range(1, n + 1)
    keep = ndimage.sum(weak, comps, idx) >= 12
    if touching:   # preso no contorno, ou encostado no traço forte
        near = ndimage.binary_dilation(alpha, iterations=2)
        keep &= (ndimage.maximum(near, comps, idx) > 0) | (ndimage.mean(hull, comps, idx) > 0.9)
    if real is not None:
        keep &= ndimage.mean(real, comps, idx) >= 0.8
    return np.isin(comps, np.flatnonzero(keep) + 1)


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
