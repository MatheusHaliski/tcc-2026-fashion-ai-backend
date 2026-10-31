"""Automatic comparison between a generative reconstruction and the garment pixels actually photographed.

It answers "is this still the same garment?" with measurable signals — colour fidelity (CIELAB ΔE between dominant
colours), colour distribution, structure and silhouette against the segmented cut-out, clean white background and
leftover skin. It cannot certify logos, crests or text: every reconstruction still goes to human review."""
from __future__ import annotations

import numpy as np
from PIL import Image

QA_SIZE = (256, 384)


def srgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    c = rgb.astype(np.float64) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]).T
    xyz /= np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], axis=-1)


def white_background_mask(image: Image.Image, tolerance: int = 18) -> np.ndarray:
    """Foreground of an image shot on white: near-white regions connected to the border are background."""
    from scipy import ndimage

    rgb = np.asarray(image.convert("RGB"), dtype=np.int16)
    near_white = (rgb.min(axis=-1) >= 255 - tolerance)
    labels, _ = ndimage.label(near_white)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    background = np.isin(labels, border[border > 0])
    return ndimage.binary_fill_holes(~background)


def white_to_alpha(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    rgba.putalpha(Image.fromarray(white_background_mask(image).astype(np.uint8) * 255, "L"))
    return rgba


def dominant_colors(lab: np.ndarray, k: int = 3, iterations: int = 12):
    """Tiny deterministic k-means (quantile init) — enough to compare the 2-3 main colours of a garment."""
    if len(lab) > 20000:
        lab = lab[np.linspace(0, len(lab) - 1, 20000).astype(int)]
    order = np.argsort(lab[:, 0])
    centers = lab[order[np.linspace(0, len(lab) - 1, k).astype(int)]].copy()
    for _ in range(iterations):
        assign = np.argmin(((lab[:, None, :] - centers[None]) ** 2).sum(-1), axis=1)
        for j in range(k):
            if np.any(assign == j):
                centers[j] = lab[assign == j].mean(axis=0)
    weights = np.bincount(assign, minlength=k) / len(lab)
    return centers, weights


def color_delta_e(original_lab: np.ndarray, candidate_lab: np.ndarray) -> float:
    oc, ow = dominant_colors(original_lab)
    cc, _ = dominant_colors(candidate_lab)
    nearest = np.sqrt(((oc[:, None, :] - cc[None]) ** 2).sum(-1)).min(axis=1)
    return float((nearest * ow).sum())


def chroma_histogram_similarity(a_lab: np.ndarray, b_lab: np.ndarray, bins: int = 16) -> float:
    edges = np.linspace(-100, 100, bins + 1)
    ha, _, _ = np.histogram2d(a_lab[:, 1], a_lab[:, 2], bins=[edges, edges])
    hb, _, _ = np.histogram2d(b_lab[:, 1], b_lab[:, 2], bins=[edges, edges])
    return float(np.minimum(ha / max(ha.sum(), 1), hb / max(hb.sum(), 1)).sum())


def _normalized(image: Image.Image, mask: np.ndarray):
    ys, xs = np.nonzero(mask)
    box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    gray = image.convert("L").crop(box).resize(QA_SIZE, Image.Resampling.BILINEAR)
    sil = Image.fromarray(mask[box[1]:box[3], box[0]:box[2]].astype(np.uint8) * 255).resize(QA_SIZE)
    return np.asarray(gray, dtype=np.float64), np.asarray(sil) > 127


def ssim(a: np.ndarray, b: np.ndarray) -> float:
    from scipy.ndimage import gaussian_filter

    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    mu_a, mu_b = gaussian_filter(a, 1.5), gaussian_filter(b, 1.5)
    var_a = gaussian_filter(a * a, 1.5) - mu_a ** 2
    var_b = gaussian_filter(b * b, 1.5) - mu_b ** 2
    cov = gaussian_filter(a * b, 1.5) - mu_a * mu_b
    index = ((2 * mu_a * mu_b + c1) * (2 * cov + c2)) / ((mu_a ** 2 + mu_b ** 2 + c1) * (var_a + var_b + c2))
    return float(index.mean())


def skin_fraction(rgb: np.ndarray) -> float:
    """Share of pixels in the classic YCbCr skin range (heuristic; catches a leftover arm/neck, not identity)."""
    if len(rgb) == 0:
        return 0.0
    r, g, b = (rgb[:, i].astype(np.float64) for i in range(3))
    cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
    cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
    return float(np.mean((cb >= 77) & (cb <= 127) & (cr >= 133) & (cr <= 173)))


def compare(original: Image.Image, original_mask: np.ndarray, candidate: Image.Image, settings) -> dict:
    """original + mask = what the camera saw; candidate = the reconstruction on white."""
    original = original.convert("RGB")
    candidate = candidate.convert("RGB")
    cand_mask = white_background_mask(candidate)
    coverage = float(cand_mask.mean())
    flags = []
    if coverage < 0.05 or coverage > 0.95:
        return {"verdict": "fail", "score": 0.0, "flags": ["EMPTY_OR_FULL_FRAME"], "coverage": round(coverage, 4),
                "requires_human_review": ["logos", "crests", "text", "stitching"]}
    orig_rgb = np.asarray(original)[np.asarray(original_mask) > 0]
    cand_rgb = np.asarray(candidate)[cand_mask]
    orig_lab, cand_lab = srgb_to_lab(orig_rgb), srgb_to_lab(cand_rgb)
    delta_e = color_delta_e(orig_lab, cand_lab)
    hist = chroma_histogram_similarity(orig_lab, cand_lab)
    og, osil = _normalized(Image.fromarray(np.where(np.asarray(original_mask)[..., None] > 0, np.asarray(original), 255)
                                           .astype(np.uint8)), np.asarray(original_mask) > 0)
    cg, csil = _normalized(candidate, cand_mask)
    structure = max(0.0, ssim(og, cg))
    iou = float((osil & csil).sum() / max((osil | csil).sum(), 1))
    rgb = np.asarray(candidate)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    background_clean = float(np.mean(border.min(axis=-1) >= 235))
    extra_skin = skin_fraction(cand_rgb) - skin_fraction(orig_rgb)
    color_score = float(np.clip(1 - delta_e / 50.0, 0, 1))
    score = 0.35 * color_score + 0.20 * hist + 0.20 * structure + 0.15 * iou + 0.10 * background_clean
    if delta_e > settings.qa_max_delta_e:
        flags.append("COLOR_DRIFT")
    if background_clean < 0.85:
        flags.append("BACKGROUND_NOT_CLEAN")
    if extra_skin > 0.08:
        flags.append("POSSIBLE_PERSON_LEFT")
    if iou < 0.35:
        flags.append("SILHOUETTE_CHANGED")
    hard_fail = delta_e > settings.qa_max_delta_e * 1.5 or "POSSIBLE_PERSON_LEFT" in flags
    verdict = "fail" if hard_fail else ("pass" if score >= settings.qa_min_score and not flags else "warn")
    return {"verdict": verdict, "score": round(score, 4), "flags": flags, "coverage": round(coverage, 4),
            "delta_e": round(delta_e, 2), "chroma_histogram": round(hist, 4), "ssim": round(structure, 4),
            "silhouette_iou": round(iou, 4), "background_clean": round(background_clean, 4),
            "extra_skin": round(extra_skin, 4),
            "requires_human_review": ["logos", "crests", "text", "stitching"]}
