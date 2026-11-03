"""Picture 1 for Phase 2: the Phase 1 cut-out with the places covered by hands or forearms filled with fabric.

Phase 1 leaves those places open on purpose (filling them with photo pixels pasted the hand into the cut-out). Sent
as-is, the white gap looked like part of the design and Phase 2 drew a decorative cut-out where the hand had been
(RunPod test, 02/11/2026). Two shapes are covered: a hole enclosed by the fabric (hand on the chest) and a notch at
the edge of the silhouette (hand on the hip): skin blobs lying almost entirely inside the garment's convex hull, the
same rule analysis.classify uses for OCCLUDED. Arms hanging beside the garment or the neck continue outside the hull
and are left alone. Each place takes the colour of the nearest real fabric, softened so it reads as continuous
cloth; the generator redraws the texture. The QA keeps comparing against the real mask."""
from __future__ import annotations

import numpy as np
from PIL import Image

from services.garment_gpu.analysis import convex_hull_mask, enclosed_skin, skin

SMOOTHING = 9   # pixels of averaging inside the filled area: hides the seams of the nearest-colour fill


def occluders(rgb: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Skin in front of the garment: enclosed holes and edge notches inside its convex hull."""
    hull = convex_hull_mask(mask)
    return enclosed_skin(skin(rgb) & ~mask, hull) & hull


def fill_occlusions(image: Image.Image, mask: np.ndarray) -> tuple[Image.Image, np.ndarray, int]:
    """Returns (image with the covered places filled, mask including them, filled pixel count)."""
    from scipy import ndimage

    rgb = np.asarray(image.convert("RGB"))
    mask = np.asarray(mask) > 0
    covered = occluders(rgb, mask) if mask.any() else np.zeros_like(mask)
    filled_px = int(covered.sum())
    if filled_px == 0:
        return image.convert("RGB"), mask, 0
    _, (iy, ix) = ndimage.distance_transform_edt(~mask, return_indices=True)
    out = rgb.copy()
    out[covered] = rgb[iy[covered], ix[covered]]
    region = (mask | covered).astype(np.float32)   # average fabric only: a notch borders the white background
    num = ndimage.uniform_filter(out.astype(np.float32) * region[..., None], size=(SMOOTHING, SMOOTHING, 1))
    den = ndimage.uniform_filter(region, size=SMOOTHING)[..., None]
    soft = num / np.maximum(den, 1e-6)
    out[covered] = np.clip(soft[covered], 0, 255).astype(np.uint8)
    return Image.fromarray(out), mask | covered, filled_px
