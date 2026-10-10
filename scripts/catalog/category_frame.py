"""Explicit 3:4 editor framing; never claims inferred landmarks were detected.

Geometry ("Editar foto"): the frame width is 50% of the photo width (the editor's slider measures normalized crop
width, not garment occupancy) and the height follows the 3:4 aspect in pixels. The frame is centred on a category
target and clamped inside the photo:

    upper_piece      centre of the garment (shirt centre)
    lower_piece      zipper/fastening region when the pipeline found one; otherwise the upper-centre of the garment
    shoes_piece      laces when found; otherwise the centre of the upper (cabedal)
    accessory_piece  centre of the object
    full_body_piece  centre of the garment
    other/unknown    centre of the object; without a usable detection, the centre of the photo

Default mode keeps the human review for estimated landmarks (NEEDS_REPROCESSING). ``force=True`` is the project
owner's explicit decision for the batch: every photo completes with APPROVED and the uncertainty (estimated focus,
unknown category, missing detection, reduced or clamped frame, Java fallback) is recorded as observations in
``editorFrame.observations`` instead of blocking the result.
"""
import copy
import json
import math

VERSION = 'CATALOG_FRAME_34_50_V1'
FORCED_DECISION = 'FORCED_CATEGORY_FRAME'
WIDTH_PERCENT = 50
ASPECT = .75                      # 3:4 in pixels
KNOWN = {'upper_piece', 'lower_piece', 'accessory_piece', 'shoes_piece', 'full_body_piece'}
TARGETS = {'upper_piece': 'shirt_center', 'lower_piece': 'zipper', 'accessory_piece': 'center',
           'shoes_piece': 'laces', 'full_body_piece': 'garment_center'}
FULL = {'x': 0.0, 'y': 0.0, 'w': 1.0, 'h': 1.0}


def _object(value):
    return json.loads(value) if isinstance(value, str) else value


def _rect_ok(rect):
    return isinstance(rect, dict) and all(isinstance(rect.get(k), (float, int)) and not isinstance(rect.get(k), bool)
                                          and math.isfinite(rect[k]) for k in ('x', 'y', 'w', 'h'))


def _landmark(focus, words):
    """Pipeline focus region whose name says the landmark was found (e.g. ``waistband_pockets_fastening``)."""
    name = str((focus or {}).get('name') or '').lower()
    rect = (focus or {}).get('rect')
    return rect if any(w in name for w in words) and _rect_ok(rect) else None


def focus_point(category, product, focus):
    """(cx, cy, source, observation): where the frame centres and how certain that is."""
    if product is None:
        return .5, .5, 'IMAGE_CENTER', 'NO_PRODUCT_REGION'
    cx, cy = product['x'] + product['w'] / 2, product['y'] + product['h'] / 2
    if category == 'lower_piece':
        rect = _landmark(focus, ('zipper', 'fastening', 'fly'))
        if rect:
            return rect['x'] + rect['w'] / 2, rect['y'] + rect['h'] / 2, 'PIPELINE_LANDMARK', None
        return cx, product['y'] + product['h'] * .25, 'ESTIMATED_UPPER_CENTER', 'ZIPPER_NOT_DETECTED_ESTIMATED'
    if category == 'shoes_piece':
        rect = _landmark(focus, ('lace',))
        if rect:
            return rect['x'] + rect['w'] / 2, rect['y'] + rect['h'] / 2, 'PIPELINE_LANDMARK', None
        return cx, product['y'] + product['h'] * .4, 'ESTIMATED_UPPER_CENTER', 'LACES_NOT_DETECTED_ESTIMATED'
    return cx, cy, 'PRODUCT_CENTER', None


def frame_rect(width, height, cx, cy, *, force=False):
    """50%-wide 3:4 frame centred on (cx, cy) and clamped inside the photo.

    A very wide photo cannot hold a 50%-wide 3:4 frame: default mode refuses it; ``force`` shrinks the frame to the
    photo height (recorded as an observation and in ``widthPercent``) so the batch still completes.
    """
    w = WIDTH_PERCENT / 100
    h = w * width / height / ASPECT
    observations = []
    if h > 1:
        if not force:
            raise ValueError('CATEGORY_FRAME_DOES_NOT_FIT')
        h = 1.0
        w = h * ASPECT * height / width
        observations.append('FRAME_REDUCED_TO_FIT_IMAGE')
    x, y = max(0.0, min(1 - w, cx - w / 2)), max(0.0, min(1 - h, cy - h / 2))
    if abs(x - (cx - w / 2)) > 1e-9 or abs(y - (cy - h / 2)) > 1e-9:
        observations.append('FRAME_CLAMPED_TO_IMAGE_BOUNDS')
    return dict(x=x, y=y, w=w, h=h), round(w * 100, 2), observations


def apply_frame(response, category, *, force=False, fallback=None):
    """Attach the category frame to a CatalogImageBatchCli response.

    ``fallback`` names the reason the Java analysis is missing or unusable (``force`` only): the frame is then
    computed from the decoded photo alone. Raises ValueError in default mode for anything that needs a person.
    """
    result = copy.deepcopy(response)
    columns = result['columns']
    crop = _object(columns.get('crop_json')) or {}
    product = crop.get('product') if _rect_ok(crop.get('product')) else None
    observations = []
    if fallback:
        observations.append('JAVA_ANALYSIS_FALLBACK:' + str(fallback))
    if category not in KNOWN:
        if not force:
            raise ValueError('CATEGORY_FRAME_UNSUPPORTED:' + str(category))
        observations.append('CATEGORY_UNKNOWN:' + str(category))
    if product is None:
        if not force:
            reasons = columns.get('gate_reasons') or 'NO_PRODUCT_REGION'
            raise ValueError('CATEGORY_FRAME_MISSING_PRODUCT:' + str(reasons))
        if columns.get('gate_reasons'):
            observations.append('PIPELINE_GATE:' + str(columns['gate_reasons'])[:200])
    width, height = columns.get('width'), columns.get('height')
    if not isinstance(width, int) or not isinstance(height, int) or width <= 0 or height <= 0:
        raise ValueError('CATEGORY_FRAME_INVALID_DIMENSIONS')
    cx, cy, source, note = focus_point(category if category in KNOWN else None, product, crop.get('focus'))
    if note:
        observations.append(note)
    rect, width_percent, geometry_notes = frame_rect(width, height, cx, cy, force=force)
    observations.extend(geometry_notes)
    estimated = source.startswith('ESTIMATED') or source == 'IMAGE_CENTER'
    review = estimated and not force
    metrics = _object(columns.get('metrics_json')) or {}
    confidence = metrics.get('segmentationConfidence')
    if isinstance(confidence, (int, float)) and not isinstance(confidence, bool) and confidence < .45:
        observations.append('LOW_SEGMENTATION_CONFIDENCE')
    crop.update(aspect='3:4', crop=rect, ruleCompliant=not review, product=product or dict(FULL))
    crop['editorFrame'] = dict(version=VERSION, widthPercent=width_percent, category=category,
                              target=TARGETS.get(category, 'center'), focus=dict(x=round(cx, 4), y=round(cy, 4)),
                              focusSource=source, requiresReview=review, clamped='FRAME_CLAMPED_TO_IMAGE_BOUNDS' in observations,
                              observations=observations, decision=FORCED_DECISION if force else 'CATEGORY_FRAME',
                              fallback=fallback)
    # Old crop scores/rules describe a different geometry and must not survive.
    for key in ('rule', 'detail', 'padding'):
        crop.pop(key, None)
    columns['crop_json'] = json.dumps(crop, ensure_ascii=False, allow_nan=False)
    metrics.setdefault('debug', {}).pop('ruleCompliance', None)
    metrics['debug']['editorFrame'] = crop['editorFrame']
    columns['metrics_json'] = json.dumps(metrics, ensure_ascii=False, allow_nan=False)
    columns['pipeline_version'] = VERSION
    if force:
        columns['processing_status'] = 'APPROVED'
    elif review:
        columns['processing_status'] = 'NEEDS_REPROCESSING'
        reasons = columns.get('gate_reasons') or ''
        if not isinstance(reasons, str):
            raise ValueError('CATEGORY_FRAME_INVALID_GATE_REASONS')
        columns['gate_reasons'] = (reasons + ',' if reasons else '') + 'CATEGORY_FRAME_LANDMARK_REVIEW'
        columns['gate_reasons'] = columns['gate_reasons'][:500]
    return result


def report_fields(response):
    """Flat fields for the spreadsheet/JSONL from a framed response (never raises)."""
    try:
        frame = (_object(response['columns'].get('crop_json')) or {}).get('editorFrame') or {}
    except (KeyError, TypeError, ValueError):
        return {}
    return {'frame_category': frame.get('category'), 'frame_target': frame.get('target'),
            'frame_focus': frame.get('focus'), 'frame_focus_source': frame.get('focusSource'),
            'frame_width_percent': frame.get('widthPercent'), 'frame_fallback': frame.get('fallback'),
            'frame_observations': list(frame.get('observations') or []), 'frame_decision': frame.get('decision')}
