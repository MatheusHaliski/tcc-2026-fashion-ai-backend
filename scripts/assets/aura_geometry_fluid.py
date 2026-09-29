#!/usr/bin/env python3
"""
Fashion AI — Aura Geometry: isola a geometria de destaque e gera a animação fluida.

Para cada arte em /public/aura/geometry/<colecao>/<id>/:
  original.png   captura original (criada na primeira execução a partir de imagem.png)
  imagem.png     geometria isolada, fundo transparente (usada como thumbnail/still)
  animacao_10s.gif  loop de 10 s em que a geometria se move sobre a superfície como um fluido

Limpeza (etapa 1 — ver clean()):
  • remove a moldura cinza da captura e o papel do pôster (cor de fundo, inclusive dentro dos anéis);
  • remove títulos, legendas, logotipos e assinaturas (componentes pequenos/escuros nas faixas superior e inferior);
  • remove sobreposições de rede social: contador "N/10", ícone de mudo, ícone de compartilhar,
    balão de corações e foto de perfil (heurísticas de forma/cor + aura_geometry_overrides.json).

Animação (etapa 2 — ver fluid_frames()):
  • domain warp com ruído periódico em (x, y, t): o campo de deslocamento evolui e viaja pela
    superfície, o que faz as formas escorrerem como líquido; loop perfeito de 10 s;
  • respiração de escala e leve rotação, como a câmera do vídeo de referência.

Uso:
    pip install pillow numpy scipy
    python3 scripts/assets/aura_geometry_fluid.py                 # tudo
    python3 scripts/assets/aura_geometry_fluid.py --only grafica/a016 gradientes/a001_coins
    python3 scripts/assets/aura_geometry_fluid.py --stills-only   # só imagem.png (revisão rápida)
    python3 scripts/assets/aura_geometry_fluid.py --sheet out.png # folha de contato das geometrias limpas
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parents[2]
GEOMETRY = ROOT / "public" / "aura" / "geometry"
OVERRIDES = Path(__file__).with_name("aura_geometry_overrides.json")

FPS = 10            # quadros por segundo do GIF (delay 100 ms, como os arquivos originais)
SECONDS = 10        # duração do loop
FRAMES = FPS * SECONDS

# ----------------------------------------------------------------------------------------------
# utilidades
# ----------------------------------------------------------------------------------------------

def dist(a: np.ndarray, c) -> np.ndarray:
    """Distância euclidiana RGB (0..441) de cada pixel à cor c."""
    return np.sqrt(((a - np.asarray(c, dtype=np.float32)) ** 2).sum(-1))


def components(mask: np.ndarray):
    lab, n = ndi.label(mask)
    if n == 0:
        return lab, []
    objs = ndi.find_objects(lab)
    out = []
    for i, sl in enumerate(objs, start=1):
        if sl is None:
            continue
        m = lab[sl] == i
        out.append({"id": i, "slice": sl, "area": int(m.sum()), "y0": sl[0].start, "y1": sl[0].stop, "x0": sl[1].start, "x1": sl[1].stop})
    return lab, out


def stats(a: np.ndarray, lab: np.ndarray, c: dict):
    sl = c["slice"]
    m = lab[sl] == c["id"]
    px = a[sl][m]
    mean = px.mean(0)
    lum = (0.299 * px[:, 0] + 0.587 * px[:, 1] + 0.114 * px[:, 2])
    sat = px.max(1) - px.min(1)
    white = float((px.min(1) > 205).mean())
    std = float(px.std(0).mean())
    h, w = m.shape
    return {
        "mean": mean, "lum": float(lum.mean()), "sat": float(sat.mean()), "white": white, "std": std,
        "fill": c["area"] / float(h * w), "aspect": w / float(h), "w": w, "h": h,
    }


# ----------------------------------------------------------------------------------------------
# etapa 1 — isolar a geometria
# ----------------------------------------------------------------------------------------------

def strip_frame(a: np.ndarray) -> np.ndarray:
    """Remove a moldura cinza de 1–3 px da captura, replicando a linha interna mais próxima."""
    a = a.copy()
    H, W = a.shape[:2]
    for _ in range(3):
        for side in ("t", "b", "l", "r"):
            for k in range(3):
                if side == "t": e, i = a[k], a[k + 3]
                elif side == "b": e, i = a[H - 1 - k], a[H - 4 - k]
                elif side == "l": e, i = a[:, k], a[:, k + 3]
                else: e, i = a[:, W - 1 - k], a[:, W - 4 - k]
                if np.median(np.sqrt(((e - i) ** 2).sum(-1))) > 18:
                    if side == "t": a[: k + 1] = a[k + 1]
                    elif side == "b": a[H - 1 - k:] = a[H - 2 - k]
                    elif side == "l": a[:, : k + 1] = a[:, k + 1: k + 2]
                    else: a[:, W - 1 - k:] = a[:, W - 2 - k: W - 1 - k]
    return a


def overlay_boxes(a: np.ndarray, opt: dict) -> list[tuple[int, int, int, int]]:
    """Caixas (x0, y0, x1, y1) das sobreposições da rede social: compartilhar, foto de perfil, corações, N/10, mudo."""
    H, W = a.shape[:2]
    area = float(H * W)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    boxes = []
    # ícone de compartilhar (círculo violeta) + foto de perfil logo acima/à esquerda
    share = (b > 200) & (r > 80) & (r < 175) & (g < 115) & (b - r > 70) & (r - g > 25)
    lab, comps = components(share)
    shares = []
    for c in comps:
        h, w = c["y1"] - c["y0"], c["x1"] - c["x0"]
        if c["area"] >= max(12, 0.0006 * area) and 0.6 <= w / max(h, 1) <= 1.6 and w < 0.3 * W:
            filled = ndi.binary_fill_holes(lab[c["slice"]] == c["id"])
            if filled.sum() / float(h * w) > 0.55:
                shares.append(c)
    for c in shares:
        d = max(c["x1"] - c["x0"], c["y1"] - c["y0"])
        cx, cy = (c["x0"] + c["x1"]) / 2, (c["y0"] + c["y1"]) / 2
        boxes.append((c["x0"] - 0.2 * d, c["y0"] - 0.2 * d, c["x1"] + 0.2 * d, c["y1"] + 0.2 * d))
        # a foto de perfil (≈ 1,6× o ícone) fica acima e à esquerda do ícone
        boxes.append((cx - 1.55 * d, cy - 1.8 * d, cx + 0.9 * d, cy + 0.4 * d))
    # corações vermelhos em par (dentro do balão claro)
    red = (r > 200) & (g < 95) & (b < 105)
    lab, comps = components(red)
    hearts = []
    light = (a.min(-1) > 195) & (a.max(-1) - a.min(-1) < 45)

    def bubble(x0, y0, x1, y1, pad):
        """O balão é claro: a moldura ao redor dos corações precisa ser quase branca."""
        X0, Y0, X1, Y1 = max(0, int(x0 - pad)), max(0, int(y0 - pad)), min(W, int(x1 + pad)), min(H, int(y1 + pad))
        ring = light[Y0:Y1, X0:X1].copy()
        ring[int(y0) - Y0:int(y1) - Y0, int(x0) - X0:int(x1) - X0] = False
        n = (Y1 - Y0) * (X1 - X0) - (int(y1) - int(y0)) * (int(x1) - int(x0))
        return n > 0 and ring.sum() / float(n) > 0.55

    for c in comps:
        h, w = c["y1"] - c["y0"], c["x1"] - c["x0"]
        if c["area"] >= 10 and w < 0.25 * W and c["area"] / float(h * w) > 0.45:
            asp = w / max(h, 1)
            if 1.7 <= asp <= 2.8 and bubble(c["x0"], c["y0"], c["x1"], c["y1"], 0.35 * h):
                hw = w / 2.0
                boxes.append((c["x0"] - 0.75 * hw, c["y0"] - 0.6 * hw, c["x1"] + 0.75 * hw, c["y1"] + 0.6 * hw))
            elif 0.7 <= asp <= 1.5:
                hearts.append(c)
    used = set()
    for i, c in enumerate(hearts):
        for c2 in hearts[i + 1:]:
            hw = c["x1"] - c["x0"]
            if abs(c["y0"] - c2["y0"]) < 0.35 * (c["y1"] - c["y0"]) and abs(c["x0"] - c2["x0"]) < 2.0 * hw and abs(hw - (c2["x1"] - c2["x0"])) < 0.35 * hw:
                x0, x1 = min(c["x0"], c2["x0"]), max(c["x1"], c2["x1"])
                y0, y1 = min(c["y0"], c2["y0"]), max(c["y1"], c2["y1"])
                if bubble(x0, y0, x1, y1, 0.35 * hw):
                    used |= {c["id"], c2["id"]}
                    boxes.append((x0 - 0.75 * hw, y0 - 0.6 * hw, x1 + 0.75 * hw, y1 + 0.6 * hw))
    # coração único grande num balão (sem par): só quando há ícone de compartilhar na imagem
    if shares:
        for c in hearts:
            if c["id"] not in used and bubble(c["x0"], c["y0"], c["x1"], c["y1"], 0.5 * (c["x1"] - c["x0"])):
                hw = c["x1"] - c["x0"]
                boxes.append((c["x0"] - 0.8 * hw, c["y0"] - 0.7 * hw, c["x1"] + 0.8 * hw, c["y1"] + 0.7 * hw))
    # pílula "N/10" e círculo de mudo/som: cinza semitransparente com glifo branco, perto dos cantos
    sat = a.max(-1) - a.min(-1)
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    grey = (sat < 55) & (lum > 40) & (lum < 165)
    grey = ndi.binary_opening(grey, iterations=1)
    lab, comps = components(grey)
    for c in comps:
        h, w = c["y1"] - c["y0"], c["x1"] - c["x0"]
        frac = c["area"] / area
        if not (0.002 <= frac <= 0.12 and 0.7 <= w / max(h, 1) <= 2.8 and w <= 0.65 * W and h <= 0.3 * H):
            continue
        cy = (c["y0"] + c["y1"]) / 2 / H
        if 0.3 < cy < 0.7:
            continue
        m = lab[c["slice"]] == c["id"]
        filled = ndi.binary_fill_holes(m)
        holes = filled & ~m
        if filled.sum() / float(h * w) < 0.62 or holes.sum() < 0.04 * filled.sum():
            continue
        hole_px = a[c["slice"]][holes]
        if (hole_px.min(-1) > 170).mean() < 0.4:
            continue
        g_px = a[c["slice"]][m]
        if g_px.std(0).mean() > 30:
            continue
        pad = 0.12 * max(h, w)
        boxes.append((c["x0"] - pad, c["y0"] - pad, c["x1"] + pad, c["y1"] + pad))
    # glifo branco dentro de um selo escuro: dígitos do contador "N/10", alto-falante do mudo/som
    white = (a.min(-1) > 215) & (sat < 40)
    labw, wcomps = components(white)
    dark = (lum < 150) & (sat < 75)
    for c in wcomps:
        h, w = c["y1"] - c["y0"], c["x1"] - c["x0"]
        if not (0.018 * H <= h <= 0.09 * H and w <= 0.35 * W and c["area"] >= 6):
            continue
        pad = max(2, int(0.35 * h))
        Y0, Y1, X0, X1 = max(0, c["y0"] - pad), min(H, c["y1"] + pad), max(0, c["x0"] - pad), min(W, c["x1"] + pad)
        ring = np.ones((Y1 - Y0, X1 - X0), bool)
        ring[c["y0"] - Y0:c["y1"] - Y0, c["x0"] - X0:c["x1"] - X0] = False
        if ring.sum() == 0:
            continue
        rl, rs = lum[Y0:Y1, X0:X1][ring], sat[Y0:Y1, X0:X1][ring]
        if rl.mean() > 125 or rs.mean() > 60 or (rl < 150).mean() < 0.7:
            continue
        # região escura conectada ao redor do glifo, limitada a uma janela de 3,6 h
        win = int(1.8 * h) + pad
        WY0, WY1, WX0, WX1 = max(0, c["y0"] - win), min(H, c["y1"] + win), max(0, c["x0"] - win), min(W, c["x1"] + win)
        sub = dark[WY0:WY1, WX0:WX1] | ndi.binary_dilation(labw[WY0:WY1, WX0:WX1] == c["id"], iterations=2)
        labd, _ = ndi.label(sub)
        seed = labd[c["y0"] - WY0 + h // 2, c["x0"] - WX0 + w // 2]
        if seed == 0:
            continue
        reg = labd == seed
        ys, xs = np.where(reg)
        by0, by1, bx0, bx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        # o selo é fechado: não pode encostar na janela (a não ser que a janela seja a borda da imagem)
        touches = (by0 == 0 and WY0 > 0) + (by1 == WY1 - WY0 and WY1 < H) + (bx0 == 0 and WX0 > 0) + (bx1 == WX1 - WX0 and WX1 < W)
        if touches > 0 or reg.sum() / float((by1 - by0) * (bx1 - bx0)) < 0.55:
            continue
        if (by1 - by0) < 1.3 * h or (bx1 - bx0) > 6 * h:
            continue
        m = 0.1 * max(by1 - by0, bx1 - bx0)
        boxes.append((WX0 + bx0 - m, WY0 + by0 - m, WX0 + bx1 + m, WY0 + by1 + m))
    boxes += [tuple(bx) for bx in opt.get("inpaint", [])]
    out = []
    for x0, y0, x1, y1 in boxes:
        out.append((max(0, int(x0)), max(0, int(y0)), min(W, int(np.ceil(x1))), min(H, int(np.ceil(y1)))))
    return out


def inpaint(a: np.ndarray, boxes, papers, T: float) -> np.ndarray:
    """Apaga as caixas: se a moldura ao redor é papel, vira papel (depois transparente); senão, inpaint."""
    import cv2
    if not boxes:
        return a
    H, W = a.shape[:2]
    a = a.copy()
    mask = np.zeros((H, W), np.uint8)
    for x0, y0, x1, y1 in boxes:
        X0, Y0, X1, Y1 = max(0, x0 - 3), max(0, y0 - 3), min(W, x1 + 3), min(H, y1 + 3)
        ring = np.ones((Y1 - Y0, X1 - X0), bool)
        ring[y0 - Y0:y1 - Y0, x0 - X0:x1 - X0] = False
        px = a[Y0:Y1, X0:X1][ring]
        best = None
        for c in papers:
            f = float((dist(px, c) < T).mean()) if len(px) else 0.0
            if f >= 0.5 and (best is None or f > best[0]):
                best = (f, c)
        if best is not None:
            a[y0:y1, x0:x1] = best[1]
        else:
            mask[y0:y1, x0:x1] = 255
    if mask.any():
        rad = max(3, int(0.02 * np.sqrt(H * W)))
        a = cv2.inpaint(np.clip(a, 0, 255).astype(np.uint8), mask, rad, cv2.INPAINT_TELEA).astype(np.float32)
    return a


def paper_colors(a: np.ndarray, T: float, opt: dict) -> list[np.ndarray]:
    """Cores de papel: a cor dominante de cada lado da borda que também domina os outros lados
    (ou uma cor clara que ocupa um lado inteiro, como a faixa de legenda de um pôster full-bleed)."""
    H, W = a.shape[:2]
    k = max(3, int(0.03 * min(H, W)))
    sides = [a[1:k].reshape(-1, 3), a[H - k:H - 1].reshape(-1, 3), a[:, 1:k].reshape(-1, 3), a[:, W - k:W - 1].reshape(-1, 3)]
    lum_all = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
    found: list[np.ndarray] = []
    for band in sides:
        q = (band // 12).astype(int)
        key = q[:, 0] * 10000 + q[:, 1] * 100 + q[:, 2]
        keys, counts = np.unique(key, return_counts=True)
        c = band[key == keys[counts.argmax()]].mean(0)
        if any(dist(c[None, None], f)[0, 0] < T for f in found):
            continue
        cov = [float((dist(b, c) < T).mean()) for b in sides]
        best = max(cov)
        others = sorted(cov)[:3]
        light = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] > 200
        global_frac = float((dist(a, c) < T).mean())
        ok = (best >= 0.6 and np.mean(others) >= float(opt.get("min_cover", 0.2))) or (best >= 0.9 and light and global_frac >= 0.04)
        if ok:
            found.append(c)
    return found


def clean(img: Image.Image, opt: dict | None = None) -> Image.Image:
    """Recebe a captura (RGB) e devolve RGBA só com a geometria de destaque."""
    opt = opt or {}
    a = strip_frame(np.asarray(img.convert("RGB")).astype(np.float32))
    H, W = a.shape[:2]
    area = float(H * W)
    T = float(opt.get("tolerance", 30))

    # --- 1. papel do pôster ---------------------------------------------------------------------
    bg = np.zeros((H, W), bool)
    soft = np.zeros((H, W), np.float32)
    papers = []
    if "paper" in opt:
        papers.append(np.array([int(opt["paper"].lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)], np.float32))
    elif not opt.get("keep_bg"):
        papers = paper_colors(a, T, opt)
    for hx in opt.get("extra_papers", []):
        papers.append(np.array([int(hx.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)], np.float32))

    # --- 2. sobreposições da rede social (corações, foto, compartilhar, N/10, mudo) --------------
    a = inpaint(a, overlay_boxes(a, opt), papers, T)
    for c in papers:
        d = dist(a, c)
        near = d < T
        lab, comps = components(near)
        edge_ids = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])).tolist()) - {0}
        keep_ids = [cc["id"] for cc in comps if cc["id"] in edge_ids or cc["area"] >= float(opt.get("hole_frac", 0.002)) * area]
        m = np.isin(lab, keep_ids)
        bg |= m
        soft = np.maximum(soft, np.where(ndi.binary_dilation(m, iterations=2), np.clip(1 - d / (T * 1.6), 0, 1), 0))

    fg = ~bg
    fg = ndi.binary_opening(fg, iterations=1) | (fg & ndi.binary_dilation(ndi.binary_opening(fg, iterations=1), iterations=2))

    # --- 3. textos, legendas e logotipos --------------------------------------------------------
    lab, comps = components(fg)
    drop = np.zeros(len(comps) + 2, bool)
    top, bottom = float(opt.get("top_band", 0.14)), float(opt.get("bottom_band", 0.16))
    side = float(opt.get("side_band", 0.1))
    min_frac = float(opt.get("min_frac", 0.0012))
    for c in comps:
        frac = c["area"] / area
        h, w = c["y1"] - c["y0"], c["x1"] - c["x0"]
        if frac < min_frac:
            drop[c["id"]] = True
            continue
        in_band = c["y1"] <= top * H or c["y0"] >= (1 - bottom) * H
        if in_band and h < 0.12 * H and frac < 0.04:
            s = stats(a, lab, c)
            barlike = w > 8 * h and s["sat"] >= 60 and s["fill"] > 0.8
            if not barlike:
                drop[c["id"]] = True
                continue
        in_side = c["x1"] <= side * W or c["x0"] >= (1 - side) * W
        if in_side and w < 0.06 * W and frac < 0.01:
            drop[c["id"]] = True
            continue
    keep = (lab > 0) & ~drop[lab]
    # remoções manuais (retângulos que viram transparência)
    for x0, y0, x1, y1 in opt.get("erase", []):
        keep[int(y0):int(y1), int(x0):int(x1)] = False

    alpha = np.where(keep, 1.0, 0.0)
    edge = keep & ndi.binary_dilation(~keep, iterations=1)
    alpha = np.where(edge, np.clip(1 - soft, 0.35, 1), alpha)
    alpha = (alpha * 255).round().astype(np.uint8)
    rgba = np.dstack([np.clip(a, 0, 255).astype(np.uint8), alpha])
    return Image.fromarray(rgba, "RGBA")


# ----------------------------------------------------------------------------------------------
# etapa 2 — animação fluida
# ----------------------------------------------------------------------------------------------

def periodic_noise(shape, cells, tcells, seed, frames):
    """Ruído de valor 3D periódico em x, y e t; devolve (frames, H, W) em [-1, 1]."""
    H, W = shape
    rng = np.random.default_rng(seed)
    cy, cx = cells
    lattice = rng.random((tcells, cy, cx)).astype(np.float32) * 2 - 1
    ys = np.linspace(0, cy, H, endpoint=False)
    xs = np.linspace(0, cx, W, endpoint=False)
    gy, gx = np.meshgrid(ys, xs, indexing="ij")
    y0 = np.floor(gy).astype(int); x0 = np.floor(gx).astype(int)
    fy = gy - y0; fx = gx - x0
    fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
    y1 = (y0 + 1) % cy; x1 = (x0 + 1) % cx
    out = np.empty((frames, H, W), np.float32)
    for f in range(frames):
        t = f / frames * tcells
        t0 = int(np.floor(t)) % tcells; t1 = (t0 + 1) % tcells
        ft = t - np.floor(t); ft = ft * ft * (3 - 2 * ft)
        L = lattice[t0] * (1 - ft) + lattice[t1] * ft
        v = (L[y0, x0] * (1 - fx) + L[y0, x1] * fx) * (1 - fy) + (L[y1, x0] * (1 - fx) + L[y1, x1] * fx) * fy
        out[f] = v
    return out


def fluid_frames(rgba: Image.Image, seed: int, frames: int = FRAMES):
    """Gera os quadros RGBA (premultiplicados) do warp fluido, em loop perfeito."""
    a = np.asarray(rgba).astype(np.float32) / 255.0
    H, W = a.shape[:2]
    prem = a.copy(); prem[..., :3] *= prem[..., 3:4]
    prem = np.moveaxis(prem, -1, 0)  # (4, H, W)
    scale = float(np.sqrt(H * W))
    amp1, amp2 = 0.075 * scale, 0.03 * scale
    rng = np.random.default_rng(seed)
    # o campo de ruído "viaja" pela superfície: deslocamento periódico de um período inteiro por loop
    ang = rng.uniform(0, 2 * np.pi)
    n1x = periodic_noise((H, W), (3, 3), 6, seed + 1, frames)
    n1y = periodic_noise((H, W), (3, 3), 6, seed + 2, frames)
    n2x = periodic_noise((H, W), (6, 6), 9, seed + 3, frames)
    n2y = periodic_noise((H, W), (6, 6), 9, seed + 4, frames)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = (W - 1) / 2, (H - 1) / 2
    out = []
    for f in range(frames):
        t = f / frames
        # campo que escorre: o ruído é amostrado com um deslocamento que percorre um período por loop
        sx = int(round(np.cos(ang) * W * t)); sy = int(round(np.sin(ang) * H * t))
        dx = amp1 * np.roll(n1x[f], (sy, sx), (0, 1)) + amp2 * np.roll(n2x[f], (-sy, sx), (0, 1))
        dy = amp1 * np.roll(n1y[f], (sy, sx), (0, 1)) + amp2 * np.roll(n2y[f], (sy, -sx), (0, 1))
        # respiração de escala e rotação suave (câmera do vídeo de referência)
        s = 1 / (1.04 + 0.04 * np.sin(2 * np.pi * t))
        th = np.deg2rad(2.5) * np.sin(2 * np.pi * t + 1.3)
        rx, ry = xx - cx, yy - cy
        ux = cx + s * (np.cos(th) * rx - np.sin(th) * ry) + dx
        uy = cy + s * (np.sin(th) * rx + np.cos(th) * ry) + dy
        fr = np.stack([ndi.map_coordinates(prem[ch], [uy, ux], order=1, mode="nearest") for ch in range(4)], -1)
        out.append(np.clip(fr, 0, 1))
    return out


def write_gif(frames, base: Image.Image, path: Path):
    """GIF com paleta global (255 cores da geometria + 1 índice transparente), loop infinito."""
    fg = np.asarray(base)
    px = fg[fg[..., 3] > 127][:, :3]
    if len(px) == 0:
        px = np.zeros((1, 3), np.uint8)
    strip = Image.fromarray(px[None, :, :].astype(np.uint8), "RGB")
    if strip.width > 200_000:
        strip = strip.resize((200_000, 1))
    pal_img = strip.quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    pal = pal_img.getpalette()[: 255 * 3] + [255, 0, 255]  # índice 255 = transparente
    pal_img.putpalette(pal)
    out = []
    for fr in frames:
        alpha = fr[..., 3]
        rgb = fr[..., :3] / np.maximum(alpha, 1e-4)[..., None]
        rgb = (np.clip(rgb, 0, 1) * 255).round().astype(np.uint8)
        q = Image.fromarray(rgb, "RGB").quantize(palette=pal_img, dither=Image.Dither.NONE)
        idx = np.asarray(q).copy()
        idx[alpha < 0.5] = 255
        p = Image.fromarray(idx, "P"); p.putpalette(pal)
        out.append(p)
    out[0].save(path, save_all=True, append_images=out[1:], duration=int(1000 / FPS), loop=0, disposal=2, transparency=255, optimize=False)


# ----------------------------------------------------------------------------------------------

def assets():
    for coll in sorted(p for p in GEOMETRY.iterdir() if p.is_dir()):
        for d in sorted(p for p in coll.iterdir() if p.is_dir()):
            if (d / "imagem.png").exists():
                yield f"{coll.name}/{d.name}", d


def process(key: str, d: Path, opt: dict, stills_only: bool):
    src = d / "original.png"
    if not src.exists():
        (d / "imagem.png").rename(src)
    still = clean(Image.open(src), opt)
    still.save(d / "imagem.png", optimize=True)
    if stills_only:
        return
    seed = int(hashlib.sha1(key.encode()).hexdigest()[:8], 16)
    frames = fluid_frames(still, seed)
    write_gif(frames, still, d / "animacao_10s.gif")


def contact_sheet(keys, path: Path, cols=10, width=150):
    tiles = []
    for key, d in keys:
        im = Image.open(d / "imagem.png").convert("RGBA")
        w, h = im.size
        im = im.resize((width, int(h * width / w)))
        bg = Image.new("RGBA", im.size, (90, 90, 90, 255))
        bg.alpha_composite(im)
        tiles.append(bg.convert("RGB"))
    H = max(t.height for t in tiles)
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (width * cols, H * rows), "black")
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % cols) * width, (i // cols) * H))
    sheet.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="chaves colecao/id")
    ap.add_argument("--stills-only", action="store_true")
    ap.add_argument("--sheet", help="grava folha de contato das geometrias limpas e sai")
    args = ap.parse_args()
    overrides = json.loads(OVERRIDES.read_text()) if OVERRIDES.exists() else {}
    items = [(k, d) for k, d in assets() if not args.only or k in args.only]
    if args.sheet:
        contact_sheet(items, Path(args.sheet))
        return
    for i, (k, d) in enumerate(items, 1):
        process(k, d, overrides.get(k, {}), args.stills_only)
        print(f"[{i}/{len(items)}] {k}", flush=True)


if __name__ == "__main__":
    main()
