"""Evidence-only gate run before alpha cleanup, rendering, enlargement or upload.

Unknown measurements stay null. A failed model, empty mask or incomplete garment
is a review/retry, never evidence for removing an entire catalogue product.
"""
from __future__ import annotations

from dataclasses import dataclass
import math

import numpy as np
from PIL import Image
from scipy import ndimage

PREFLIGHT_VERSION = "CATALOG_SOURCE_PREFLIGHT_V1"
MIN_SOURCE_HEIGHT = .25
FRAME_OCCUPANCY = .5


@dataclass(frozen=True)
class Preflight:
    status: str
    reason: str | None
    metrics: dict


def inspect_source(image: Image.Image, masks, category: str, subcategory: str | None = None,
                   *, original_size: tuple[int, int] | None = None) -> Preflight:
    """Measure the *source* selected garment, never the canvas or a body bbox.

    ``measurement_verified`` and ``complete`` are positive attestations by the
    provider/reviewer, not inferred from the mere existence of a model mask.
    Opening below estimates supported extent only; it does not edit RGB/alpha.
    """
    original_size = original_size or image.size
    metrics = {"version": PREFLIGHT_VERSION, "sourceWidth": original_size[0],
               "sourceHeight": original_size[1], "analysisWidth": image.width,
               "analysisHeight": image.height, "sourceGarmentBox": None,
               "sourceGarmentHeightFraction": None, "sourceGarmentHeightPixels": None,
               "measurementReliable": False, "minimumHeightFraction": MIN_SOURCE_HEIGHT,
               "quality": {"shortEdgePixels": min(original_size)},
               "maskSource": masks.source, "isolationVerified": masks.isolation_verified is True,
               "humanAssessmentComplete": isinstance(masks.human_present, bool) and masks.forbidden is not None}
    automation = getattr(masks, 'automation', {}) or {}
    if automation:
        metrics['automaticEvidence'] = automation

    def decision(status, reason=None):
        return Preflight(status, reason, {**metrics, "status": status, "reason": reason})

    if not masks.verified:
        return decision("REVIEW", "UNVERIFIED_SEMANTIC_MASK")
    normal = lambda value: (value or "").strip().lower()
    if not masks.target_category or normal(masks.target_category) != normal(category):
        return decision("REVIEW", "MASK_CATEGORY_MISMATCH")
    if normal(masks.target_subcategory) != normal(subcategory):
        return decision("REVIEW", "MASK_SUBCATEGORY_MISMATCH")
    confidence = masks.confidence
    valid_confidence = not isinstance(confidence, bool) and isinstance(confidence, (int, float)) and math.isfinite(confidence)
    metrics["segmentationConfidence"] = confidence if valid_confidence else None
    if confidence is not None and (not valid_confidence or not .8 <= confidence <= 1):
        return decision("REVIEW", "LOW_SEGMENTATION_CONFIDENCE")
    if masks.target.size != image.size or (masks.forbidden is not None and masks.forbidden.size != image.size):
        return decision("REVIEW", "MASK_DIMENSIONS_MISMATCH")
    raw = np.asarray(masks.target.convert("L")) >= 192
    if not raw.any():
        return decision("REVIEW", "TARGET_MASK_EMPTY")
    # An independently classified exterior line is not part of the garment.
    # This measurement view never mutates the source photograph or output alpha.
    prohibited = np.zeros(raw.shape, dtype=bool)
    if masks.forbidden is not None:
        prohibited = np.asarray(masks.forbidden.convert("L")) >= 192
        raw = raw & ~prohibited
    # Single-pixel exterior scratches must not inflate the measured source bbox.
    supported = ndimage.binary_opening(raw, structure=np.ones((3, 3), dtype=bool))
    labels, _ = ndimage.label(supported)
    areas = np.bincount(labels.ravel())
    areas[0] = 0
    keep = np.flatnonzero(areas >= max(24, int(supported.sum() * .004)))
    if not len(keep):
        return decision("REVIEW", "SOURCE_EXTENT_UNCERTAIN")
    support = np.isin(labels, keep)
    # Opening must never make a real thin strap disappear and turn a >=25%
    # garment into deletion evidence. An unresolved appendage/detached contour
    # makes the source extent unknown until semantic review identifies it.
    classified_perimeter = ndimage.binary_dilation(prohibited, iterations=1) if prohibited.any() else prohibited
    if (raw & ~support & ~classified_perimeter & (ndimage.distance_transform_edt(~support) > 3)).any():
        return decision("REVIEW", "SOURCE_EXTENT_UNCERTAIN")
    ys, xs = np.where(support)
    left, top, right, bottom = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    height_fraction = (bottom - top) / image.height
    metrics.update(sourceGarmentBox={"x": left / image.width, "y": top / image.height,
                                    "w": (right-left) / image.width, "h": height_fraction},
                   sourceGarmentHeightFraction=height_fraction,
                   sourceGarmentHeightPixels=height_fraction * original_size[1],
                   extentParts=len(keep), measurementMethod="SEMANTIC_SUPPORTED_BBOX",
                   complete=masks.complete, occluded=masks.occluded)
    # More disjoint selected garments cannot be treated as one tall piece.
    is_set = normal(subcategory) in {"matching_set", "set", "two_piece_set", "bikini", "bikini_set"}
    max_parts = 4 if is_set else 2 if normal(category) in {"lower_piece", "shoes_piece"} else 1
    if len(keep) > max_parts:
        return decision("REVIEW", "AMBIGUOUS_TARGET_COMPONENTS")
    if automation.get('reviewReason'):
        return decision('REVIEW', automation['reviewReason'])
    if masks.occluded is not False:
        return decision("REVIEW", "GARMENT_OCCLUSION_UNCERTAIN" if masks.occluded is None else "GARMENT_OCCLUDED")
    if masks.complete is not True or left == 0 or top == 0 or right == image.width or bottom == image.height:
        return decision("REVIEW", "GARMENT_COMPLETENESS_UNCERTAIN")
    reliable = masks.measurement_verified is True
    metrics["measurementReliable"] = reliable
    if masks.isolation_verified is not True or masks.forbidden is None or not isinstance(masks.human_present, bool):
        return decision("REVIEW", "HUMAN_EXCLUSION_UNVERIFIED")
    bounds = automation.get('sourceHeightFractionBounds')
    if bounds is not None:
        if (not isinstance(bounds, (list, tuple)) or len(bounds) != 2
                or any(isinstance(v, bool) or not isinstance(v, (int,float)) or not math.isfinite(v) for v in bounds)
                or not 0 <= bounds[0] <= height_fraction <= bounds[1] <= 1):
            metrics['measurementReliable'] = False
            return decision('REVIEW', 'SOURCE_EXTENT_UNCERTAIN')
        if bounds[0] < MIN_SOURCE_HEIGHT <= bounds[1]:
            metrics['measurementReliable'] = False
            return decision('REVIEW', 'SOURCE_HEIGHT_NEAR_THRESHOLD')
    if height_fraction < MIN_SOURCE_HEIGHT:
        return decision("INELIGIBLE" if reliable else "REVIEW",
                        "SOURCE_GARMENT_BELOW_MIN_HEIGHT" if reliable else "SOURCE_HEIGHT_UNCERTAIN")
    if not reliable:
        return decision("REVIEW", "SOURCE_HEIGHT_UNCERTAIN")
    return decision("PASS")


def fit_box(piece_size: tuple[int, int], canvas_size: tuple[int, int]) -> tuple[int, int, int, int, dict]:
    """Uniform contain: the larger normalized edge occupies 50% of the canvas.

    Both edges can equal 50% only when piece and canvas share an aspect ratio.
    No axis is stretched independently.
    """
    pw, ph = piece_size
    width, height = canvas_size
    scale = min(width * FRAME_OCCUPANCY / pw, height * FRAME_OCCUPANCY / ph)
    w, h = max(1, round(pw * scale)), max(1, round(ph * scale))
    x, y = (width-w)//2, (height-h)//2
    return x, y, w, h, {"fit": "CONTAIN", "targetMaxNormalizedEdge": FRAME_OCCUPANCY,
                         "maxNormalizedEdge": max(w / width, h / height),
                         "sourceAspectRatio": pw / ph, "preserveAspectRatio": True,
                         "scale": scale}
