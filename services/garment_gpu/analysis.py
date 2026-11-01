"""Phase 1 → Phase 2 routing: is the segmented cut-out already a final flat product, or must the generative stage
rebuild it? Phase 1 only keeps real pixels, so it can never flatten a garment that a person is wearing: any photo
with a model goes to Phase 2, as do occluded and truncated garments. Used by the API (mode=auto) and the batch.

Signals (input photo + garment mask returned by the GPU API, same frame):
* CUT       — the garment touches the photo border: part of it is outside the picture.
* person    — skin-tone pixels outside the garment (a model is wearing it).
* OCCLUDED  — skin inside the garment's convex hull (an arm/hand in front of it) or, for tops, a very concave mask.
Heuristic thresholds: the pilot report shows every metric so they can be recalibrated with real catalogue photos."""
from __future__ import annotations

import numpy as np

BORDER_FRACTION = 0.01
PERSON_SKIN_FRACTION = 0.01
OCCLUSION_SKIN_FRACTION = 0.04
MIN_SOLIDITY_UPPER = 0.70

CLASSES = {
    "COMPLETE_PRODUCT": "peça sozinha, completa",
    "COMPLETE_ON_MODEL": "vestida por modelo → reconstrução (tecido esticado)",
    "OCCLUDED": "com modelo, parte coberta → reconstrução",
    "CUT": "peça cortada pela foto → reconstrução",
}


def skin(rgb: np.ndarray) -> np.ndarray:
    """Classic YCbCr skin range (catches arms/necks/hands; not identity, not perfect on beige backgrounds)."""
    r, g, b = (rgb[..., i].astype(np.float64) for i in range(3))
    cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
    cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
    return (cb >= 77) & (cb <= 127) & (cr >= 133) & (cr <= 173)


def convex_hull_mask(mask: np.ndarray) -> np.ndarray:
    """Raster of the mask's convex hull (scipy.spatial.ConvexHull over the boundary pixels)."""
    from scipy import ndimage
    from scipy.spatial import ConvexHull, QhullError

    edge = mask & ~ndimage.binary_erosion(mask)
    ys, xs = np.nonzero(edge)
    if len(xs) < 4:
        return mask.copy()
    try:
        hull = ConvexHull(np.column_stack([xs, ys]))
    except QhullError:
        return mask.copy()
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    gy, gx = np.mgrid[y0:y1, x0:x1]
    pts = np.column_stack([gx.ravel(), gy.ravel()]).astype(np.float64)
    inside = np.all(pts @ hull.equations[:, :2].T + hull.equations[:, 2] <= 1e-9, axis=1)
    out = np.zeros_like(mask)
    out[y0:y1, x0:x1] = inside.reshape(gy.shape)
    return out | mask


def enclosed_skin(skin_free: np.ndarray, hull: np.ndarray, inside_share: float = 0.85) -> np.ndarray:
    """Skin blobs (not covered by the garment) lying almost entirely inside its hull: a hand or forearm in front of
    it. Arms hanging beside a T-shirt or the neck also enter the hull, but they continue outside it, so they are
    not counted."""
    from scipy import ndimage

    labels, count = ndimage.label(skin_free)
    if count == 0:
        return np.zeros_like(skin_free)
    total = np.bincount(labels.ravel())
    inside = np.bincount(labels.ravel(), weights=hull.ravel().astype(np.float64), minlength=len(total))
    keep = (inside / np.maximum(total, 1)) >= inside_share
    keep[0] = False
    return keep[labels]


def skin_holes(rgb: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Enclosed holes of the garment mask that are skin: a hand or forearm in front of the fabric. Filling them would
    paste the hand into the cut-out (the error seen in the pilot), so they stay open for Phase 2 to repaint."""
    from scipy import ndimage

    mask = np.asarray(mask) > 0
    holes = ndimage.binary_fill_holes(mask) & ~mask
    return holes & skin(np.asarray(rgb)[..., :3])


def classify(rgb: np.ndarray, mask: np.ndarray, category: str | None = None) -> dict:
    mask = np.asarray(mask) > 0
    h, w = mask.shape
    area = int(mask.sum())
    if area == 0:
        return {"class": "NO_GARMENT", "metrics": {}}
    ys, xs = np.nonzero(mask)
    margin_x, margin_y = max(1, int(w * BORDER_FRACTION)), max(1, int(h * BORDER_FRACTION))
    touches = [side for side, hit in (("left", xs.min() < margin_x), ("right", xs.max() >= w - margin_x),
                                      ("top", ys.min() < margin_y), ("bottom", ys.max() >= h - margin_y)) if hit]
    sk = skin(np.asarray(rgb)[..., :3])
    hull = convex_hull_mask(mask)
    skin_outside = float((sk & ~mask).sum()) / (h * w)
    skin_in_hull = float(enclosed_skin(sk & ~mask, hull).sum()) / area
    solidity = area / max(int(hull.sum()), 1)
    person = skin_outside >= PERSON_SKIN_FRACTION
    occluded = person and (skin_in_hull > OCCLUSION_SKIN_FRACTION
                           or (category == "upper_piece" and solidity < MIN_SOLIDITY_UPPER))
    if touches:
        klass = "CUT"
    elif occluded:
        klass = "OCCLUDED"
    else:
        klass = "COMPLETE_ON_MODEL" if person else "COMPLETE_PRODUCT"
    return {"class": klass, "needs_reconstruction": klass != "COMPLETE_PRODUCT",
            "metrics": {"mask_fraction": round(area / (h * w), 4), "touches": touches, "person": person,
                        "skin_outside": round(skin_outside, 4), "skin_in_hull": round(skin_in_hull, 4),
                        "solidity": round(solidity, 4)}}
