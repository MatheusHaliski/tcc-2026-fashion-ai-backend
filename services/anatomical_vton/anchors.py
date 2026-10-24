import numpy as np
from .models import AlignmentError, AnchorSet, Observation
from .profiles import rules_for


def validate_mask(mask, shape, name):
    m = np.asarray(mask)
    if m.shape != shape or not np.isfinite(m).all():
        raise AlignmentError(f'INVALID_{name}_MASK')
    m = m.astype(np.float64)
    if m.min() < 0 or m.max() > 1:
        raise AlignmentError(f'{name}_MASK_EXPECTED_0_TO_1')
    if not np.any(m > .5):
        raise AlignmentError(f'EMPTY_{name}_MASK')
    return m


def _point(observation, name, shape, confidence):
    a = observation.anchors.get(name)
    if a is None or not np.isfinite([a.x, a.y, a.confidence]).all():
        raise AlignmentError(f'MISSING_OR_INVALID_ANCHOR:{name}')
    if not confidence <= a.confidence <= 1:
        raise AlignmentError(f'LOW_CONFIDENCE_ANCHOR:{name}')
    h, w = shape
    if not 0 <= a.x <= w-1 or not 0 <= a.y <= h-1:
        raise AlignmentError(f'ANCHOR_OUTSIDE_IMAGE:{name}')
    return [a.x, a.y]


def extract_garment_and_body_anchors(garment_rgba, body_rgb, family, *,
        garment: Observation | None = None, body: Observation | None = None,
        extractor=None, sleeve='NONE', custom_rules=None, min_confidence=.8,
        placket_source=None, placket_target=None) -> AnchorSet:
    """Use annotated evidence or a real detector adapter; never infer anatomy from a bbox.

    Targets are garment-specific points projected on/around the body: cuff and hem
    positions must reflect the actual sleeve/garment length and fit, not a fixed
    rule that forces every top to the pelvis or every skirt to the ankles.
    """
    if garment_rgba.ndim != 3 or garment_rgba.shape[2] != 4 or body_rgb.ndim != 3 or body_rgb.shape[2] != 3:
        raise AlignmentError('EXPECTED_RGBA_GARMENT_AND_RGB_PERSON')
    if not 0 < min_confidence <= 1:
        raise AlignmentError('INVALID_CONFIDENCE_THRESHOLD')
    if garment is None or body is None:
        if extractor is None:
            raise AlignmentError('DETECTOR_OR_ANNOTATED_EVIDENCE_REQUIRED')
        garment = garment or extractor.garment(garment_rgba, family)
        body = body or extractor.body(body_rgb)
    gm = validate_mask(garment.mask, garment_rgba.shape[:2], 'GARMENT')
    bm = validate_mask(body.mask, body_rgb.shape[:2], 'BODY')
    rules = rules_for(family, sleeve, custom_rules)
    source = np.array([_point(garment, r.name, gm.shape, min_confidence) for r in rules], dtype=float)
    target = np.array([_point(body, r.name, bm.shape, min_confidence) for r in rules], dtype=float)
    # Curves and seam profiles may name the same physical point. Merge only
    # when both sides agree; contradictory anchors must never be averaged away.
    keep=[]
    for i in range(len(source)):
        duplicate=next((j for j in keep if np.linalg.norm(source[i]-source[j])<1e-5),None)
        if duplicate is not None:
            if np.linalg.norm(target[i]-target[duplicate])>.05:
                raise AlignmentError('CONFLICTING_DUPLICATE_ANCHORS')
            if rules[i].hard and not rules[duplicate].hard:
                keep.remove(duplicate);keep.append(i)
        else:keep.append(i)
    source,target=source[keep],target[keep];rules=[rules[i] for i in keep]
    for points in (source, target):
        if len(np.unique(points, axis=0)) != len(points):
            raise AlignmentError('COINCIDENT_ANCHORS')
        if np.linalg.matrix_rank(np.c_[np.ones(len(points)), points]) < 3:
            raise AlignmentError('COLLINEAR_ANCHORS')
    ps = pt = None
    if (placket_source is None) != (placket_target is None):
        raise AlignmentError('BOTH_PLACKET_LINES_REQUIRED')
    if placket_source is not None:
        ps, pt = np.asarray(placket_source, float), np.asarray(placket_target, float)
        if ps.shape != pt.shape or ps.ndim != 2 or ps.shape[1] != 2 or not 2 <= len(ps) <= 12 or not np.isfinite(ps).all() or not np.isfinite(pt).all():
            raise AlignmentError('INVALID_PLACKET_LINE')
        for line, shape in ((ps, gm.shape), (pt, bm.shape)):
            if np.any(line < 0) or np.any(line[:, 0] > shape[1]-1) or np.any(line[:, 1] > shape[0]-1):
                raise AlignmentError('PLACKET_OUTSIDE_IMAGE')
            if np.any(np.linalg.norm(np.diff(line, axis=0), axis=1) < 1):
                raise AlignmentError('PLACKET_REQUIRES_ORDERED_DISTINCT_POINTS')
    return AnchorSet(source, target, np.array([r.hard for r in rules]),
                     np.array([r.weight for r in rules]), [r.name for r in rules], gm, bm, ps, pt,
                     {'garment': garment.provenance, 'body': body.provenance,
                      'space': 'PROJECTED_2D', 'family': family, 'sleeve': sleeve})
