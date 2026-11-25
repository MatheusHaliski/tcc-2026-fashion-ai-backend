"""Padronagem que cobre a peça toda: listras (medidas na foto e redesenhadas nítidas) e estampa corrida (um pedaço da
foto, espelhado para repetir sem emenda).
"""
from __future__ import annotations

import numpy as np
from scipy import ndimage

from .cores import lab_to_rgb, to_hex


def _two_colors(pts: np.ndarray, iters: int = 12) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """k-médias com k = 2 em Lab: (centro do fundo, centro da listra, rótulo de cada ponto; 0 = fundo, o mais comum)."""
    lo, hi = np.percentile(pts[:, 0], 10), np.percentile(pts[:, 0], 90)
    c = np.array([pts[pts[:, 0] <= lo].mean(0), pts[pts[:, 0] >= hi].mean(0)])
    for _ in range(iters):
        lab = np.argmin(((pts[:, None] - c[None]) ** 2).sum(-1), 1)
        c = np.array([pts[lab == k].mean(0) if (lab == k).any() else c[k] for k in (0, 1)])
    if (lab == 1).mean() > 0.5:
        c, lab = c[::-1], 1 - lab
    return c[0], c[1], lab


def _period(profile: np.ndarray) -> tuple[float, float]:
    """(período em px, força 0–1) do perfil: o primeiro pico da autocorrelação depois do zero."""
    p = profile - profile.mean()
    if p.std() < 1e-6 or len(p) < 24:
        return 0.0, 0.0
    ac = np.correlate(p, p, "full")[len(p) - 1:]
    ac /= ac[0]
    lag = int(np.argmax(ac < 0)) if (ac < 0).any() else 0     # depois do primeiro vale
    if lag == 0:
        return 0.0, 0.0
    best = lag + int(np.argmax(ac[lag:len(p) // 3])) if lag < len(p) // 3 else 0
    if best <= lag:
        return 0.0, 0.0
    return float(best), float(ac[best])


def stripes(lab: np.ndarray, mask: np.ndarray, frame) -> dict | None:
    """Listras horizontais ou verticais no meio do tronco: perfil periódico entre linhas (ou colunas) e cada linha
    quase de uma cor só. Devolve as cores, o período (px) e a fração da listra; None sem listras."""
    w = frame.right - frame.left
    best = None
    for direction in ("horizontal", "vertical"):
        if direction == "horizontal":
            ys = slice(int(frame.top + 0.28 * frame.height), int(frame.hem - 0.08 * frame.height))
            xs = slice(int(frame.center - 0.07 * w), int(frame.center + 0.07 * w))   # estreita: a listra inclina
        else:
            ys = slice(int(frame.top + 0.3 * frame.height), int(frame.top + 0.65 * frame.height))
            xs = slice(int(frame.center - 0.26 * w), int(frame.center + 0.26 * w))
        box, inside = lab[ys, xs], mask[ys, xs]
        if box.size == 0 or inside.mean() < 0.9:
            continue
        axis = 1 if direction == "horizontal" else 0
        prof = np.where(inside[..., None], box, np.nan)
        lines = np.nanmean(prof, axis)                              # cor média de cada linha (ou coluna)
        if not np.isfinite(lines).all() or np.nanstd(lines, 0).mean() < 1.5:
            continue
        main = lines - lines.mean(0)
        u, s, vt = np.linalg.svd(main, full_matrices=False)
        period, strength = _period(main @ vt[0])
        if strength > 0.5 and period >= 4 and (best is None or strength > best["forca"]):
            bg, fg, lab_k = _two_colors(box[inside].reshape(-1, 3))
            if np.linalg.norm(bg - fg) < 12 or not 0.12 < lab_k.mean() <= 0.5:   # duas cores de verdade, as duas largas
                continue
            if np.hypot(*(bg - fg)[1:]) < 6 and abs(bg[0] - fg[0]) < 30:   # mesmo tom, só mais escuro: o pesponto
                continue                                                    # do acolchoado, não listra
            best = {"direcao": direction, "periodo_px": period, "forca": round(strength, 2),
                    "fundo": to_hex(lab_to_rgb(bg)), "listra": to_hex(lab_to_rgb(fg)),
                    "fracao": round(float(lab_k.mean()), 3)}
    return best


def tile(rgb: np.ndarray, lab: np.ndarray, mask: np.ndarray, frame, avoid_center: bool) -> tuple[np.ndarray, int] | None:
    """Pedaço retangular da estampa corrida dentro da peça (fora da vista de botões quando há), sem a sombra larga
    das dobras, espelhado 2 × 2 para repetir sem emenda. Devolve (imagem, lado do pedaço original em px)."""
    w = frame.right - frame.left
    x0, x1 = (frame.center + 0.05 * w, frame.center + 0.3 * w) if avoid_center else \
        (frame.center - 0.22 * w, frame.center + 0.22 * w)
    y0, y1 = frame.top + 0.3 * frame.height, frame.hem - 0.12 * frame.height
    inner = ndimage.binary_erosion(mask, iterations=4)
    for _ in range(12):   # encolhe até caber na peça
        box = inner[int(y0):int(y1), int(x0):int(x1)]
        if box.size and box.mean() > 0.985:
            break
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        x0, x1, y0, y1 = cx + (x0 - cx) * 0.88, cx + (x1 - cx) * 0.88, cy + (y0 - cy) * 0.88, cy + (y1 - cy) * 0.88
    else:
        return None
    side = int(min(x1 - x0, y1 - y0))
    if side < 24:
        return None
    ya, xa = int((y0 + y1) / 2 - side / 2), int((x0 + x1) / 2 - side / 2)
    crop = lab[ya:ya + side, xa:xa + side].copy()
    broad = ndimage.gaussian_filter(crop[..., 0], side / 6)
    crop[..., 0] = np.clip(crop[..., 0] - (broad - broad.mean()), 0, 100)   # tira a sombra larga, deixa o desenho
    piece = lab_to_rgb(crop).astype(np.uint8)
    row = np.concatenate([piece, piece[:, ::-1]], 1)
    return np.concatenate([row, row[::-1]], 0), side
