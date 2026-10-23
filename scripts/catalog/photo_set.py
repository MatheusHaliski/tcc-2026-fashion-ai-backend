"""Category-aware catalog photo isolation, contour cleanup and immutable photo sets.

The local semantic segmenter selects garment classes; it never paints over people,
reconstructs hidden garment pixels or uses skin colour as a human detector. A mask
without semantic provenance, an ambiguous result or a missing model yields DEFAULT.
The caller then supplies the category/colour-specific FAI reference asset.
"""
from __future__ import annotations

import io
import math
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol

import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage

try:
    from .whole_frame import BACKGROUND, HEIGHT, WIDTH, cloth_class
    from .photo_preflight import inspect_source, fit_box
except ImportError:  # standalone batch worker
    from whole_frame import BACKGROUND, HEIGHT, WIDTH, cloth_class
    from photo_preflight import inspect_source, fit_box

PHOTO_SET_VERSION = "CATALOG_PHOTO_SET_V2"
MAX_INPUT_PIXELS = 40_000_000
MAX_ANALYSIS_SIDE = 2048
SET_SUBCATEGORIES = {"matching_set", "set", "two_piece_set", "bikini", "bikini_set"}
HUMAN_LABELS = {1, 2, 12, 13, 14, 15, 16}  # FASHN: face/hair/arms/hands/legs/feet/torso


@dataclass
class PhotoMasks:
    target: Image.Image
    forbidden: Image.Image | None = None
    confidence: float | None = None
    verified: bool = False
    target_category: str | None = None
    target_subcategory: str | None = None
    human_present: bool | None = None
    source: str = "unspecified"
    measurement_verified: bool = False
    isolation_verified: bool = False
    complete: bool | None = None
    occluded: bool | None = None


@dataclass
class PhotoSet:
    status: str
    reason: str | None = None
    whole: bytes | None = None
    fabric: bytes | None = None
    metrics: dict = field(default_factory=dict)


class PhotoMaskProvider(Protocol):
    def masks(self, image: Image.Image, category: str, subcategory: str | None) -> PhotoMasks: ...


def _normal(value: str | None) -> str:
    return (value or "").strip().lower()


class LocalClothProvider:
    """Local u2net cloth classes, optionally cross-checked with the existing FASHN parser.

    The parser is optional and loads only a configured LOCAL weights directory.
    No photograph is uploaded. u2net cannot distinguish two garments of the same
    class/layer; ambiguous disconnected pieces are refused downstream.
    """

    def __init__(self, segmenter=None, parser=None):
        self.segmenter = segmenter
        self.parser = parser
        self._parser_initialized = parser is not None

    def _parser(self):
        if not self._parser_initialized:
            self._parser_initialized = True
            weights = os.getenv("CATALOG_PHOTO_PARSER_WEIGHTS")
            if weights:
                root = Path(weights).resolve()
                if not root.is_dir():
                    raise ValueError("PARSER_LOCAL_WEIGHTS_MISSING")
                from fashn_human_parser import FashnHumanParser
                self.parser = FashnHumanParser(model_id=str(root), device=os.getenv("CATALOG_PHOTO_DEVICE", "cpu"))
        return self.parser

    def masks(self, image, category, subcategory=None):
        klass = cloth_class(category, subcategory)
        if klass is None:
            raise ValueError("SEMANTIC_CATEGORY_UNSUPPORTED")
        if self.segmenter is None:
            try:
                from .whole_frame import GarmentSegmenter
            except ImportError:
                from whole_frame import GarmentSegmenter
            self.segmenter = GarmentSegmenter()
        if _normal(subcategory) in SET_SUBCATEGORIES:
            # A coordinated set comprises both upper and lower garments, not only
            # the parser's one-piece/dress class. Keep the evidence explicit.
            selected = [self.segmenter.mask(image, category=c, model=True) for c in ("upper_piece", "lower_piece", "full_body_piece")]
            target = np.maximum.reduce([np.asarray(mask.convert("L")) for mask in selected])
            target = Image.fromarray(target.astype(np.uint8))
        else:
            # Always semantic, including flat lays: general foreground removal
            # would retain a person, shoes or another garment in the source.
            target = self.segmenter.mask(image, category=category, subcategory=subcategory, model=True)
        parser = self._parser()
        forbidden = None
        human = None
        source = "u2net_cloth_seg"
        if parser is not None:
            labels = np.asarray(parser.predict(image))
            if labels.shape != (image.height, image.width) or not np.isin(labels, np.arange(18)).all():
                raise ValueError("PARSER_INVALID_LABELS")
            allowed = {3} if klass == 0 else ({5} if _normal(subcategory) in {"skirt", "mini_skirt", "midi_skirt", "maxi_skirt"} else {5, 6}) if klass == 1 else {4}
            if _normal(subcategory) in SET_SUBCATEGORIES:
                allowed = {3, 4, 5, 6}
            target_array = np.asarray(target.convert("L"))
            # The intersection retains only pixels independently labelled as the
            # selected garment. Face, fingers and accessories never survive it.
            target = Image.fromarray(np.where(np.isin(labels, list(allowed)), target_array, 0).astype(np.uint8))
            forbidden = Image.fromarray(np.where(np.isin(labels, list(HUMAN_LABELS | (set(range(1, 18)) - allowed))), 255, 0).astype(np.uint8))
            human = bool(np.isin(labels, list(HUMAN_LABELS)).any())
            source += "+fashn_human_parser"
        # Semantic provenance is not calibrated confidence or proof of a complete
        # garment. Production validation/review must attest those separately.
        return PhotoMasks(target, forbidden, verified=True, target_category=category,
                          target_subcategory=subcategory, human_present=human, source=source,
                          isolation_verified=parser is not None)


def _array(mask: Image.Image, size: tuple[int, int]) -> np.ndarray:
    if mask.size != size:
        raise ValueError("MASK_DIMENSIONS_MISMATCH")
    return np.asarray(mask.convert("L")) >= 192


def clean_target_mask(target: Image.Image, forbidden: Image.Image | None, category: str,
                      subcategory: str | None = None) -> tuple[Image.Image, dict]:
    """Clean alpha only: no RGB retouching, no hole-filling over skin/occlusions.

    Only an independently forbidden perimeter may trim attached lines. Unclassified
    thin appendages go to review; blindly eroding them could remove straps or lace.
    Two separate pant legs are retained rather than taking only the largest blob.
    """
    a = _array(target, target.size)
    prohibited = np.zeros(a.shape, dtype=bool) if forbidden is None else _array(forbidden, target.size)
    before = int(a.sum())
    if before == 0:
        raise ValueError("TARGET_MASK_EMPTY")
    # Dilating forbidden regions is conservative at fingers/hairline boundaries.
    exclude = ndimage.binary_dilation(prohibited, iterations=1) if prohibited.any() else prohibited
    a &= ~exclude
    labels, count = ndimage.label(a)
    areas = np.bincount(labels.ravel())
    areas[0] = 0
    significant = np.flatnonzero(areas >= max(24, int(a.sum() * .004)))
    if not len(significant):
        raise ValueError("TARGET_MASK_EMPTY_AFTER_CLEANUP")
    is_set = _normal(subcategory) in SET_SUBCATEGORIES
    paired = _normal(category) in {"lower_piece", "shoes_piece"} or _normal(subcategory) == "socks"
    max_parts = 4 if is_set else 2 if paired else 1
    if len(significant) > max_parts:
        raise ValueError("AMBIGUOUS_TARGET_COMPONENTS")
    if paired and len(significant) == 2:
        boxes = [ndimage.find_objects((labels == k).astype(np.uint8))[0] for k in significant]
        overlap = max(0, min(b[0].stop for b in boxes) - max(b[0].start for b in boxes))
        if overlap < .4 * min(b[0].stop - b[0].start for b in boxes):
            raise ValueError("AMBIGUOUS_TARGET_COMPONENTS")
    cleaned = np.isin(labels, significant) & ~exclude
    opened = ndimage.binary_opening(cleaned, structure=np.ones((3, 3), dtype=bool))
    # Ordinary curved corners survive unchanged; long unclassified thin details
    # are reviewed instead of being erased (a strap and a line can look alike).
    if ((cleaned & ~opened) & (ndimage.distance_transform_edt(~opened) > 3)).any():
        raise ValueError("UNCLASSIFIED_THIN_CONTOUR")
    kept = int(cleaned.sum())
    if kept < 64 or kept < .6 * before:
        raise ValueError("EXCESSIVE_MASK_REMOVAL")
    height, width = cleaned.shape
    if kept / (height * width) < .01:
        raise ValueError("TARGET_MASK_TOO_SMALL")
    # An all-foreground semantic mask is not evidence of an isolated product.
    if kept / (height * width) > .94:
        raise ValueError("TARGET_MASK_NOT_ISOLATED")
    return Image.fromarray((cleaned * 255).astype(np.uint8)), {
        "removedPixels": before - kept, "targetPixels": kept, "retainedParts": len(significant),
        "forbiddenPixels": int(prohibited.sum()), "removedFraction": round(1 - kept / before, 5),
        "maskCoverage": round(kept / (height * width), 5), "contourInsetPx": 0,
    }


def _fabric_box(mask: Image.Image) -> tuple[int, int, int, int] | None:
    """Largest exact 3:4 rectangle containing ONLY selected garment pixels."""
    a = np.asarray(mask) > 0
    height, width = a.shape
    integral = np.pad(a.astype(np.int32), ((1, 0), (1, 0))).cumsum(axis=0, dtype=np.int32).cumsum(axis=1, dtype=np.int32)
    low, high = 1, min(width // 3, height // 4)
    found = None
    ys, xs = np.where(a)
    if not len(xs):
        return None
    # Prefer a central part of the selected garment when several equal patches fit.
    centre_x, centre_y = float(np.median(xs)), float(np.median(ys))
    while low <= high:
        unit = (low + high) // 2
        w, h = unit * 3, unit * 4
        sums = integral[h:, w:] - integral[:-h, w:] - integral[h:, :-w] + integral[:-h, :-w]
        y, x = np.where(sums == w * h)
        if len(x):
            k = np.argmin((x + w / 2 - centre_x) ** 2 + (y + h / 2 - centre_y) ** 2)
            found = (int(x[k]), int(y[k]), int(x[k] + w), int(y[k] + h))
            low = unit + 1
        else:
            high = unit - 1
    return found if found and min(found[2] - found[0], found[3] - found[1]) >= 24 else None


def _png(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, "PNG", optimize=True)
    return buffer.getvalue()


def _render_whole(image: Image.Image, mask: Image.Image) -> tuple[bytes, dict]:
    box = mask.getbbox()
    assert box is not None
    cutout = image.convert("RGBA")
    cutout.putalpha(mask)
    cutout = cutout.crop(box)
    x, y, w, h, framing = fit_box(cutout.size, (WIDTH, HEIGHT))
    cutout = cutout.resize((w, h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), (255,255,255,255))
    canvas.alpha_composite(cutout, (x, y))
    return _png(canvas.convert("RGB")), {"width": WIDTH, "height": HEIGHT,
        "box": {"x": round(x / WIDTH, 5), "y": round(y / HEIGHT, 5), "w": round(w / WIDTH, 5), "h": round(h / HEIGHT, 5)},
        "sourceBox": {"x": box[0], "y": box[1], "w": box[2] - box[0], "h": box[3] - box[1]},
        "upscaled": framing["scale"] > 1, "background": "#FFFFFF", "rendered": True, "framing": framing}


def process_photo(image: Image.Image, category: str, subcategory: str | None = None, *,
                  masks: PhotoMasks | None = None, provider: PhotoMaskProvider | None = None) -> PhotoSet:
    """Render a verified mask once or return DEFAULT with a machine-readable reason.

    `verified` declares semantic mask provenance, not a claim of perfect model
    accuracy. Providers/models must be evaluated on the real catalog separately.
    """
    metrics = {"version": PHOTO_SET_VERSION, "category": category, "subcategory": subcategory,
               "sourceGarmentHeightFraction": None, "sourceQuality": None}
    if image.width * image.height > MAX_INPUT_PIXELS:
        return PhotoSet("REVIEW", "IMAGE_TOO_LARGE", metrics=metrics)
    try:
        source = ImageOps.exif_transpose(image).convert("RGB")
        original_size = source.size
        if masks is None:
            source.thumbnail((MAX_ANALYSIS_SIDE, MAX_ANALYSIS_SIDE), Image.Resampling.LANCZOS)
            masks = (provider or LocalClothProvider()).masks(source, category, subcategory)
        metrics["maskSource"] = masks.source
        preflight = inspect_source(source, masks, category, subcategory, original_size=original_size)
        metrics["preflight"] = preflight.metrics
        metrics["sourceGarmentHeightFraction"] = preflight.metrics["sourceGarmentHeightFraction"]
        metrics["sourceQuality"] = preflight.metrics["quality"]
        if preflight.status != "PASS":
            return PhotoSet(preflight.status, preflight.reason, metrics=metrics)
        mask, cleanup = clean_target_mask(masks.target, masks.forbidden, category, subcategory)
        metrics.update(cleanup)
        fabric_box = _fabric_box(mask)
        if fabric_box is None:
            return PhotoSet("REVIEW", "NO_SAFE_FABRIC_RECTANGLE", metrics=metrics)
        whole, metadata = _render_whole(source, mask)
        fabric = source.crop(fabric_box)
        # Avoid gratuitous enlargement; both dimensions retain an exact 3:4 ratio.
        if fabric.width > WIDTH:
            fabric = fabric.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
        metrics["whole"] = metadata
        metrics["fabric"] = {"width": fabric.width, "height": fabric.height, "sourceBox": list(fabric_box), "coverage": 1.0}
        return PhotoSet("READY", whole=whole, fabric=_png(fabric), metrics=metrics)
    except (ImportError, OSError, ValueError, RuntimeError) as error:
        # Do not serialize URLs, model paths or exception details into audit logs.
        reason = str(error) if isinstance(error, ValueError) and str(error).isupper() and len(str(error)) < 90 else "SEGMENTATION_UNAVAILABLE"
        return PhotoSet("RETRY" if reason == "SEGMENTATION_UNAVAILABLE" else "REVIEW", reason, metrics=metrics)
