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

from . import estampa, padrao
from .cores import dominant_lab, lab_to_rgb, rgb_to_lab, to_hex
from .mascara import body_hints, frame_of, garment_mask, image_score, pixels_per_meter

WORK = 900          # lado maior da imagem de análise (px)
SOLID = 0.0008      # menos que isso de desenho na peça: lisa (um logo de peito pequeno tem ~0,1–0,4 %)
ALL_OVER = 0.18     # desenho em mais que isso da peça, espalhado pelo tronco: estampa corrida
FLAT_HALF = 1.3     # peça deitada: meia largura da frente ≈ ¼ da volta ≈ 1,3 × a (tronco de seção elíptica, b = 0,68·a)


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


def _placement(g: estampa.Group, frame, ppm: float, chest_a: float) -> dict | None:
    """Lugar do desenho na peça (m): ``x`` do centro da frente (+ = lado esquerdo de quem veste, à direita na foto),
    ``abaixo_do_ombro`` do centro do desenho e ``largura``. Na foto em modelo a distância ao centro é projeção do
    tronco redondo: vira arco (a·arcsen). Só a frente do tronco: na foto em modelo ela vai até ±a (os braços ficam do
    lado), na peça deitada até ±¼ da volta; desenho na manga e na lateral fica de fora por enquanto."""
    y0, y1, x0, x1 = g.box
    x = ((x0 + x1) / 2 - frame.center) / ppm
    if frame.worn:
        x = chest_a * math.asin(max(-0.98, min(0.98, x / chest_a)))
    below = ((y0 + y1) / 2 - frame.top) / ppm
    width, height = (x1 - x0) / ppm, (y1 - y0) / ppm
    zone = 0.85 * (chest_a if frame.worn else FLAT_HALF * chest_a)
    if abs(x) + width / 2 > zone or below - height / 2 < 0.02 or below + height / 2 > 0.97 * frame.height / ppm:
        return None
    return {"x": round(x, 4), "abaixo_do_ombro": round(below, 4), "largura": round(width, 4),
            "altura": round(height, 4)}


def analyze(rgb_full: np.ndarray, labels_full: np.ndarray, length_m: float, chest_a: float,
            avoid_center: bool = False) -> dict:
    """Tudo o que a foto diz da pintura da peça. ``length_m``: comprimento da base (ombro à barra); ``chest_a``: meia
    largura do tronco da base no peito (m); ``avoid_center``: a frente tem vista (botões/zíper) no meio."""
    rgb, labels, f = _work(rgb_full, labels_full)
    mask = garment_mask(labels)
    frame = frame_of(labels, mask)
    if frame is None:
        return {"ok": False, "motivo": "sem peça de cima na foto"}
    gains = white_balance(rgb, labels)
    rgb = np.clip(rgb * gains, 0, 255).astype(np.uint8)
    lab = rgb_to_lab(rgb).astype(np.float32)
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
    found = estampa.groups(cand, frame, mask.sum(), dist, limit=6)
    if _all_over(cand, raw, mask, frame, coverage, found):
        piece = padrao.tile(rgb, lab, mask, frame, avoid_center)
        if piece is not None:
            img, side = piece
            out.update(padrao="corrida", corrida={"imagem": img, "lado": round(2 * side / ppm, 4)})
            return out
    if coverage <= SOLID or frame.symmetry < 0.72:   # de lado, o desenho cairia no lugar errado: só a cor
        return out
    rgb_big = np.clip(rgb_full * gains, 0, 255).astype(np.uint8) if f > 1 else rgb
    for g in found[:4]:
        where = _placement(g, frame, ppm, chest_a)
        if where is None or not _keep(where, frame, avoid_center):
            continue
        where["imagem"] = estampa.decal_rgba(rgb_big, lab, shade, base, g, f)
        out["padrao"] = "localizada"
        out["decalques"].append(where)
    return out


def _all_over(cand, raw, mask, frame, coverage: float, found: list) -> bool:
    """Estampa corrida: desenho espalhado pelo tronco todo. A de traço fino (letras vazadas, nanquim) o filtro de
    "fino" apaga: na peça sozinha (sem dobra de corpo) vale a cobertura antes dele. Poucos desenhos grandes (o "AX"
    gigante no peito) são estampa localizada grande, não corrida."""
    thin = not frame.worn and raw.sum() / mask.sum() > 0.05 and estampa.spread(raw, mask, frame) >= 0.89
    wide = coverage > ALL_OVER and estampa.spread(cand, mask, frame) >= 0.67
    if not (thin or wide):
        return False
    torso = 0.6 * (frame.right - frame.left) * 0.8 * frame.height
    biggest = max(((g.box[1] - g.box[0]) * (g.box[3] - g.box[2]) for g in found), default=0) / max(torso, 1.0)
    return not (len(found) <= 3 and biggest < 0.6)


def _keep(where: dict, frame, avoid_center: bool) -> bool:
    """Desenho que é mesmo desenho e está no pano: nem lasca, nem cordão do capuz ou cadarço do zíper no meio, nem o
    que aparece pela frente aberta vestida (o meio e o V mostram a roupa de baixo)."""
    w, h, x = where["largura"], where["altura"], where["x"]
    if min(w, h) < 0.008 or w * h < 0.0002:
        return False
    if h > 2.5 * w and abs(x) < 0.08:
        return False
    return not (avoid_center and frame.worn and (abs(x) < w / 2 or (abs(x) < 0.08 and where["abaixo_do_ombro"] < 0.35)))
