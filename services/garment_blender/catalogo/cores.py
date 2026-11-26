"""Cor: sRGB ↔ Lab (D65) e hex, em numpy, para medir a cor do tecido na foto como a vemos (diferença ΔE em Lab)."""
from __future__ import annotations

import numpy as np

_M = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
_WHITE = np.array([0.95047, 1.0, 1.08883])


def rgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    """``rgb``: (..., 3) em 0–255 → Lab (..., 3)."""
    c = np.asarray(rgb, float) / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    xyz = lin @ _M.T / _WHITE
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def lab_to_rgb(lab: np.ndarray) -> np.ndarray:
    lab = np.asarray(lab, float)
    fy = (lab[..., 0] + 16) / 116
    f = np.stack([fy + lab[..., 1] / 500, fy, fy - lab[..., 2] / 200], -1)
    xyz = np.where(f ** 3 > 0.008856, f ** 3, (f - 16 / 116) / 7.787) * _WHITE
    lin = np.clip(xyz @ np.linalg.inv(_M).T, 0, 1)
    c = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - 0.055)
    return np.clip(np.round(c * 255), 0, 255)


def to_hex(rgb) -> str:
    r, g, b = (int(v) for v in np.asarray(rgb).ravel()[:3])
    return f"#{r:02x}{g:02x}{b:02x}"


def dominant_lab(lab: np.ndarray, radius: float = 12.0) -> np.ndarray:
    """A cor que mais aparece (pico do histograma em Lab, em caixas de 8 × 6 × 6) e a média dos pixels perto dela:
    a sombra das dobras e a estampa não puxam a média, como puxariam numa média simples."""
    pts = lab.reshape(-1, 3)
    if len(pts) > 40000:
        pts = pts[np.random.default_rng(0).choice(len(pts), 40000, replace=False)]
    bins = np.floor(pts / np.array([8.0, 6.0, 6.0])).astype(int)
    keys, counts = np.unique(bins, axis=0, return_counts=True)
    peak = (keys[np.argmax(counts)] + 0.5) * np.array([8.0, 6.0, 6.0])
    near = pts[np.linalg.norm(pts - peak, axis=1) < radius]
    return near.mean(0) if len(near) else peak
