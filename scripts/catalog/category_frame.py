"""Explicit 3:4 editor framing; never claims inferred landmarks were detected."""
import copy
import json
import math

VERSION = 'CATALOG_FRAME_34_50_V1'


def _object(value):
    return json.loads(value) if isinstance(value, str) else value


def apply_frame(response, category):
    result = copy.deepcopy(response)
    columns = result['columns']
    crop = _object(columns.get('crop_json')) or {}
    product = crop.get('product')
    if category not in {'upper_piece', 'lower_piece', 'accessory_piece', 'shoes_piece', 'full_body_piece'}:
        raise ValueError('CATEGORY_FRAME_UNSUPPORTED:' + str(category))
    if not product:
        reasons = columns.get('gate_reasons') or 'NO_PRODUCT_REGION'
        raise ValueError('CATEGORY_FRAME_MISSING_PRODUCT:' + str(reasons))
    width, height = columns['width'], columns['height']
    if width <= 0 or height <= 0:
        raise ValueError('CATEGORY_FRAME_INVALID_DIMENSIONS')
    # The editor slider measures normalized crop width, not garment occupancy.
    w, h = .5, .5 * width / height / .75
    if h > 1:
        raise ValueError('CATEGORY_FRAME_DOES_NOT_FIT')
    if any(not isinstance(product.get(k), (float, int)) or not math.isfinite(product[k]) for k in ('x', 'y', 'w', 'h')):
        raise ValueError('CATEGORY_FRAME_INVALID_PRODUCT')
    focus = crop.get('focus') or {}
    rect = focus.get('rect') if category in {'lower_piece', 'shoes_piece'} else product
    if not rect:
        raise ValueError('CATEGORY_FRAME_MISSING_FOCUS')
    cx, cy = rect['x'] + rect['w']/2, rect['y'] + rect['h']/2
    x, y = max(0, min(1-w, cx-w/2)), max(0, min(1-h, cy-h/2))
    review = category in {'lower_piece', 'shoes_piece'}
    crop.update(aspect='3:4', crop=dict(x=x, y=y, w=w, h=h), ruleCompliant=not review)
    crop['editorFrame'] = dict(version=VERSION, widthPercent=50, category=category,
                              target={'upper_piece':'shirt_center','lower_piece':'zipper','accessory_piece':'center','shoes_piece':'laces','full_body_piece':'garment_center'}[category],
                              focusSource='PIPELINE_REGION_ESTIMATE' if review else 'PRODUCT_CENTER',
                              requiresReview=review, clamped=x != cx-w/2 or y != cy-h/2)
    # Old crop scores/rules describe a different geometry and must not survive.
    for key in ('rule', 'detail', 'padding'):
        crop.pop(key, None)
    columns['crop_json'] = json.dumps(crop, ensure_ascii=False, allow_nan=False)
    metrics = _object(columns.get('metrics_json')) or {}
    metrics.setdefault('debug', {}).pop('ruleCompliance', None)
    metrics['debug']['editorFrame'] = crop['editorFrame']
    columns['metrics_json'] = json.dumps(metrics, ensure_ascii=False, allow_nan=False)
    columns['pipeline_version'] = VERSION
    if review:
        columns['processing_status'] = 'NEEDS_REPROCESSING'
        reasons = columns.get('gate_reasons') or ''
        if not isinstance(reasons, str):
            raise ValueError('CATEGORY_FRAME_INVALID_GATE_REASONS')
        columns['gate_reasons'] = (reasons + ',' if reasons else '') + 'CATEGORY_FRAME_LANDMARK_REVIEW'
        columns['gate_reasons'] = columns['gate_reasons'][:500]
    return result
