"""Automatic local garment isolation with measured model evidence.

FASHN supplies actual class probabilities; u2net_cloth_seg supplies an independent
garment mask. Their agreement is a reproducible quality gate, not a calibrated
probability that a garment is correct. No RGB pixel is generated or repainted.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

AUTOMATIC_POLICY_VERSION = "CATALOG_AUTOMATIC_ISOLATION_V1"
HUMAN_LABELS = {1, 2, 12, 13, 14, 15, 16}
SET_SUBCATEGORIES = {"matching_set", "set", "two_piece_set", "bikini", "bikini_set"}


def parser_weights():
    explicit = os.getenv("CATALOG_PHOTO_PARSER_WEIGHTS")
    if explicit:
        return Path(explicit)
    root = os.getenv("FAI_FASHN_WEIGHTS")
    if root:
        return Path(root) / "parser"
    return Path("/opt/fashionai/weights/fashn/parser")


class FashnProbabilityParser:
    """Read only local weights, retaining the real softmax values from logits."""
    def __init__(self, weights=None, device=None):
        root = Path(weights) if weights else parser_weights()
        if not all((root / name).is_file() for name in ("config.json", "model.safetensors")):
            raise ValueError("PARSER_LOCAL_WEIGHTS_MISSING")
        config = json.loads((root / "config.json").read_text())
        expected = {"0": "background", "3": "top", "4": "dress", "5": "skirt", "6": "pants", "13": "hands"}
        if any(config.get("id2label", {}).get(key) != value for key, value in expected.items()):
            raise ValueError("PARSER_SEMANTIC_LABELS_MISMATCH")
        self.model_sha256 = hashlib.sha256((root / "model.safetensors").read_bytes()).hexdigest()
        from fashn_human_parser import FashnHumanParser
        self.parser = FashnHumanParser(model_id=str(root.resolve()), device=device or os.getenv("CATALOG_PHOTO_DEVICE", "cpu"))

    def probabilities(self, image):
        logits = self.parser.predict(image, return_logits=True)
        return logits.softmax(dim=1).squeeze(0).detach().cpu().numpy()


def _box(mask):
    y, x = np.where(mask)
    if not len(x):
        return None
    return int(x.min()), int(y.min()), int(x.max()) + 1, int(y.max()) + 1


def _allowed(category, subcategory):
    c, s = (category or '').strip().lower(), (subcategory or '').strip().lower()
    if s in SET_SUBCATEGORIES:
        return {3, 4, 5, 6}
    if c in {'full_body_piece', 'full_body'} or s in {'dress', 'jumpsuit', 'romper', 'overall', 'overalls', 'bodysuit', 'swimsuit'}:
        return {4}
    if c in {'upper_piece', 'upper'}:
        return {3}
    if c in {'lower_piece', 'lower'}:
        return {5} if s in {'skirt', 'mini_skirt', 'midi_skirt', 'maxi_skirt'} else {6}
    raise ValueError('SEMANTIC_CATEGORY_UNSUPPORTED')


class AutomaticClothProvider:
    def __init__(self, segmenter=None, parser=None, *, weights=None, device=None):
        self.segmenter, self.parser = segmenter, parser
        self.weights, self.device = weights, device

    def masks(self, image, category, subcategory=None):
        try:
            from .photo_set import PhotoMasks
            from .whole_frame import GarmentSegmenter
        except ImportError:
            from photo_set import PhotoMasks
            from whole_frame import GarmentSegmenter
        allowed = _allowed(category, subcategory)
        if self.parser is None:
            self.parser = FashnProbabilityParser(self.weights, self.device)
        if self.segmenter is None:
            self.segmenter = GarmentSegmenter()
        p = np.asarray(self.parser.probabilities(image), dtype=np.float32)
        if p.shape != (18, image.height, image.width) or not np.isfinite(p).all() or (p < 0).any() or (p > 1).any() or not np.allclose(p.sum(axis=0), 1, atol=.002):
            raise ValueError('PARSER_INVALID_PROBABILITIES')
        labels, score = p.argmax(axis=0), p.max(axis=0)
        semantic = np.isin(labels, list(allowed))
        selected_probability = p[list(allowed)].sum(axis=0)
        if (subcategory or '').strip().lower() in SET_SUBCATEGORIES:
            masks = [self.segmenter.mask(image, category=c, model=True) for c in ('upper_piece', 'lower_piece', 'full_body_piece')]
            cloth = np.maximum.reduce([np.asarray(m.convert('L')) for m in masks]) >= 192
        else:
            mask = self.segmenter.mask(image, category=category, subcategory=subcategory, model=True)
            if mask.size != image.size:
                raise ValueError('MASK_DIMENSIONS_MISMATCH')
            cloth = np.asarray(mask.convert('L')) >= 192
        human = np.isin(labels, list(HUMAN_LABELS))
        other = ~semantic & (labels != 0)
        forbidden = (~semantic & (score >= .8))
        # Preserve original logo/print pixels inside the independently selected
        # garment silhouette. Never fill a hole classified as skin/another item.
        interior = ndimage.binary_fill_holes(semantic)
        target = cloth & (semantic | (interior & ~other & ~human))
        union = cloth | semantic
        intersection = cloth & semantic
        agreement = float(intersection.sum() / union.sum()) if union.any() else 0.0
        core = ndimage.binary_erosion(intersection, iterations=2)
        confidence = float(np.quantile(selected_probability[core], .1)) if core.any() else None
        semantic_box, cloth_box, target_box = _box(semantic), _box(cloth), _box(target)
        evidence = {'version': AUTOMATIC_POLICY_VERSION, 'method': 'FASHN_SOFTMAX_AND_U2NET_AGREEMENT',
                    'parserModelSha256': getattr(self.parser, 'model_sha256', None),
                    'modelScoreMeaning': '10TH_PERCENTILE_TARGET_SOFTMAX_IN_CONSENSUS_INTERIOR_NOT_CALIBRATED_ACCURACY',
                    'maskIoU': agreement, 'minimumMaskIoU': .90, 'targetSoftmaxP10': confidence,
                    'reviewReason': None, 'sourceHeightFractionBounds': None}
        occluded = False
        if cloth.any():
            interior_cloth = ndimage.binary_erosion(ndimage.binary_fill_holes(cloth), iterations=2)
            occluded = int((interior_cloth & other).sum()) >= max(12, int(cloth.sum() * .001))
        reason = None
        if target_box is None or semantic_box is None or cloth_box is None:
            reason = 'TARGET_MASK_EMPTY'
        elif confidence is None or confidence < .8:
            reason = 'LOW_SEGMENTATION_CONFIDENCE'
        elif agreement < .90:
            reason = 'SEMANTIC_MODEL_DISAGREEMENT'
        else:
            margin = max(2, int(min(image.size) * .005))
            l, t, r, b = target_box
            if min(l, t, image.width-r, image.height-b) < margin:
                reason = 'GARMENT_COMPLETENESS_UNCERTAIN'
            # Both models must agree on the actual source extent; ±2 analysis
            # pixels retain a conservative threshold interval instead of fake
            # precision at 25% or after resizing.
            lower = max(0, min(semantic_box[3]-semantic_box[1], cloth_box[3]-cloth_box[1], b-t)-2) / image.height
            upper = min(image.height, max(semantic_box[3]-semantic_box[1], cloth_box[3]-cloth_box[1], b-t)+2) / image.height
            evidence['sourceHeightFractionBounds'] = [lower, upper]
            if upper-lower > .025:
                reason = 'SOURCE_EXTENT_UNCERTAIN'
        if occluded:
            reason = 'GARMENT_OCCLUDED'
        evidence['reviewReason'] = reason
        reliable = reason is None
        # Removing background cannot erase a real logo inside the trusted core.
        forbidden = forbidden & ~target
        return PhotoMasks(Image.fromarray((target*255).astype(np.uint8)),
                          Image.fromarray((forbidden*255).astype(np.uint8)), confidence=confidence,
                          verified=True, target_category=category, target_subcategory=subcategory,
                          human_present=bool(human.any()), source='FASHN_LOGITS+U2NET_CLOTH_SEG',
                          measurement_verified=reliable, isolation_verified=reliable,
                          complete=True if reliable else None, occluded=occluded, automation=evidence)
