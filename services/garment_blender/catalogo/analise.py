"""Leitura de uma foto do produto: cor do tecido, padronagem (lisa, listrada, estampa corrida) e os desenhos (logo,
estampa localizada) com o lugar de cada um na peça, em metros a partir da linha do ombro e do centro da frente.

A forma da peça nunca vem da foto: ela é a base da subcategoria construída pelo motor. Da foto sai só a pintura e o
desenho, então tanto faz se a foto é em modelo, em manequim invisível ou da peça deitada.
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image
from scipy import ndimage

from . import estampa, filtros, juncao, lugar, padrao
from .recorte import decal_rgba
from .cores import dominant_lab, lab_to_rgb, rgb_to_lab, to_hex
from .mascara import background, body_hints, frame_of, garment_mask, image_score, pixels_per_meter

WORK = 900          # lado maior da imagem de análise (px)
SOLID = 0.0003      # menos que isso de desenho na peça: lisa (o "C" da manga da Champion tem ~0,05 %)
ALL_OVER = 0.07     # traço (borda de luminosidade) em mais que isso do tronco, por toda a peça: estampa corrida
SIDEWAYS = 0.68     # simetria da peça no eixo abaixo disso: pose de lado, o desenho cairia no lugar errado
MAX_DECALS = 4      # desenhos por peça, os maiores depois do crivo
MIN_PPM = 150       # foto com menos pixels por metro que isso não mostra desenho nenhum: só a cor


def white_balance(rgb: np.ndarray, labels: np.ndarray) -> np.ndarray:
    """Ganhos por canal que deixam neutro o fundo claro e quase neutro da foto (luz amarelada ou azulada de estúdio);
    fundo colorido de propósito (croma alto) fica como está."""
    h, w = labels.shape
    border = np.zeros_like(labels, bool)
    k = max(2, int(0.06 * min(h, w)))
    border[:k], border[-k:], border[:, :k], border[:, -k:] = True, True, True, True
    bg = rgb[border & (labels == 0)].astype(float)
    if len(bg) < 200:
        return np.ones(3)
    med = np.median(bg, 0)
    lab = rgb_to_lab(med)
    if lab[0] < 55 or math.hypot(lab[1], lab[2]) > 9:
        return np.ones(3)
    return np.clip(med.mean() / np.maximum(med, 1), 0.88, 1.12)


def _work(rgb: np.ndarray, labels: np.ndarray) -> tuple[np.ndarray, np.ndarray, float]:
    """Imagem e rótulos no tamanho da análise (os rótulos podem vir de uma foto já reduzida para o segmentador);
    devolve também o fator da foto original para a de análise."""
    h, w = rgb.shape[:2]
    f = max(1.0, max(h, w) / WORK)
    size = (round(w / f), round(h / f))
    small = rgb if f == 1.0 else np.asarray(Image.fromarray(rgb).resize(size, Image.Resampling.LANCZOS))
    if labels.shape != (size[1], size[0]):
        labels = np.asarray(Image.fromarray(labels.astype(np.uint8)).resize(size, Image.Resampling.NEAREST))
    return small, labels, f


def analyze(rgb_full: np.ndarray, labels_full: np.ndarray, length_m: float, chest_a: float,
            avoid_center: bool = False, sleeve: dict | None = None, *, hooded: bool = False,
            neck: float = 0.04, clues: dict | None = None) -> dict:
    """Tudo o que a foto diz da pintura da peça. ``length_m``: comprimento da base (ombro à barra); ``chest_a``: meia
    largura do tronco da base no peito (m); ``avoid_center``: a frente tem vista (botões/zíper) no meio; ``sleeve``:
    a manga da base (``meia_ombro``, ``queda``, ``comprimento``, em m), None sem manga; ``hooded``: com capuz;
    ``neck``: a descida do decote na frente (m) — o fundo da gola aparecendo por dentro não é desenho."""
    rgb, labels, f = _work(rgb_full, labels_full)
    gains = white_balance(rgb, labels)
    rgb = np.clip(rgb * gains, 0, 255).astype(np.uint8)
    lab = rgb_to_lab(rgb).astype(np.float32)
    mask = garment_mask(labels, lab)
    frame = frame_of(labels, mask, hooded)
    if frame is None:
        return {"ok": False, "motivo": "sem peça de cima na foto"}
    inner = ndimage.binary_erosion(mask, iterations=3)
    base = dominant_lab(lab[inner if inner.sum() > 100 else mask])
    ppm, how = pixels_per_meter(frame, length_m)
    out = {"ok": True, "cor": to_hex(lab_to_rgb(base)), "nota_foto": round(image_score(frame), 3),
           "em_modelo": frame.worn, "simetria": round(frame.symmetry, 3), "escala": how,
           "px_por_m": round(ppm, 1), "padrao": "liso", "decalques": [], **body_hints(labels, mask, frame)}
    shade = estampa.shading(lab, mask, base, 0.05 * frame.height)
    dist = estampa.distance(lab, base, shade)
    raw = estampa.candidates(dist, mask, frame.right - frame.left)
    cand = estampa.clean(raw, mask, frame, lab, shade, base)
    coverage = float(cand.sum() / mask.sum())
    out["cobertura"] = round(coverage, 4)
    stripes = padrao.stripes(lab, mask, frame)
    if stripes:   # a listra comprida sai dos candidatos como "fina": o teste dela é o período, não a cobertura
        stripes["periodo"] = round(stripes.pop("periodo_px") / ppm, 4)
        out.update(padrao="listras", listras=stripes)
        return out
    found = estampa.groups(cand, frame, mask.sum(), dist, limit=12)
    if _all_over(lab, mask, frame, clues):
        piece = padrao.tile(rgb, lab, mask, frame, avoid_center)
        if piece is not None:
            img, side = piece
            out.update(padrao="corrida", corrida={"imagem": img, "lado": round(2 * side / ppm, 4)})
            return out
    if coverage <= SOLID or frame.symmetry < SIDEWAYS:   # de lado, o desenho cairia no lugar errado: só a cor
        return out
    rgb_big = np.clip(rgb_full * gains, 0, 255).astype(np.uint8) if f > 1 else rgb
    for g, where in _decals(found, frame, mask, ppm, chest_a, sleeve, avoid_center, neck,
                            filtros.Ruler(lab, shade, base, dist, cand, mask, background(labels, lab)),
                            clues):
        where["imagem"] = decal_rgba(rgb_big, lab, shade, base, g, f)
        out["padrao"] = "localizada"
        out["decalques"].append(where)
    return out


def _decals(found, frame, mask, ppm, chest_a, sleeve, avoid_center, neck, ruler, clues) -> list:
    """Os desenhos que ficam, cada um com o lugar: todos os achados passam pelo lugar e pelo crivo, os pares de feitio
    saem, os pedaços vizinhos viram um desenho só e só então vem o corte nos ``MAX_DECALS`` maiores (o corte antes do
    crivo deixava a faixa da manga recusada tomar a vaga de uma linha de texto do peito)."""
    if ppm < MIN_PPM:
        return []
    half = lugar.torso_half(mask, frame) if frame.worn else None
    opened = avoid_center and lugar.open_front(mask, frame)

    def place(box):
        where = lugar.placement(box, frame, ppm, chest_a, sleeve, half)
        return where if where and lugar.keep(where, frame, avoid_center, neck) else None
    items = []
    for g in found:
        where = place(g.box)
        v = filtros.verdict(ruler.looks(g), where, frame, clues, opened) if where else 0
        if v:
            items.append((g, where, v))
    pairs = juncao.mirrored(items)
    return juncao.merge([it for k, it in enumerate(items) if k not in pairs], ppm, place)[:MAX_DECALS]


def _all_over(lab, mask, frame, clues: dict | None) -> bool:
    """Estampa corrida: traço por toda a peça — nas casas do tronco e na beira (mangas, ombros, barra). O desenho
    grande no peito (o cartaz, o "AX" gigante) deixa a beira lisa e é estampa localizada; o brilho do metalizado, do
    paetê e do veludo dá traço por toda parte sem ser estampa (só vale se o nome do produto falar em estampa)."""
    clues = clues or {}
    if clues.get("brilho") and not clues.get("corrida"):
        return False
    edge, full, rim = padrao.texture(lab, mask, frame)
    return edge >= ALL_OVER and full >= 0.8 and rim >= 0.75
