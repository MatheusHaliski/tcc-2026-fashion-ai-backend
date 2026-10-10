"""Category frame for the catalogue batch: a 3:4 window filled 100% by the garment's fabric.

Policy (CATALOG_FRAME_34_FABRIC_V2): inside the frame there is never background, background art, hanger, person
(skin, face, hands) or any other object — only the piece's fabric. The Java pipeline (FabricFrame) builds the fabric
mask (segmented product without distractors and hanger, fully opaque pixels only, minus skin that differs from the
garment colour, eroded a few pixels) and returns the largest 3:4 rectangle wholly inside it, placed by category and
subcategory:

    upper_piece      chest below the collar, without the sleeves; open-front pieces (jacket, blazer, coat, cardigan,
                     vest, parka, windbreaker, kimono) on one front panel, away from the central opening
    lower_piece      the front rise with the zipper/fly (waist to crotch, never one isolated leg); skirt, skort,
                     leggings and culottes on the front panel below the waistband
    full_body_piece  the bodice
    shoes_piece      the upper (laces when the pipeline found them), without the sole
    accessory_piece  the body of a textile accessory (bags, cap, hat, beanie, scarf, tie, gloves, socks, belt, wallet);
                     jewellery, watches, glasses and hair accessories have no fabric frame

Without a fabric frame (no fabric region large enough, analysis failed, non-textile accessory, person inside the
frame) the photo is NOT reframed: a frame that shows background is never produced, not even with
``--force-category-frame``. That flag only waives source authorisation and confirmed visual identity (process
script); here it keeps estimated anchors as observations instead of sending them to review.
"""
import copy
import json
import math

VERSION = 'CATALOG_FRAME_34_FABRIC_V2'
LEGACY_VERSIONS = ('CATALOG_FRAME_34_50_V1',)       # 50%-wide editor frame: could show background, must be redone
POLICY = 'FABRIC_ONLY_100'
FORCED_DECISION = 'FORCED_CATEGORY_FRAME'
ASPECT = .75                                         # 3:4 in pixels
KNOWN = {'upper_piece', 'lower_piece', 'accessory_piece', 'shoes_piece', 'full_body_piece'}
# targets that depend on a detected landmark; the others are geometric rules of the category (not estimates)
LANDMARK_TARGETS = {('lower_piece', 'fly'): 'ZIPPER_NOT_DETECTED_ESTIMATED', ('shoes_piece', 'upper'): 'LACES_NOT_DETECTED_ESTIMATED'}


def _object(value):
    return json.loads(value) if isinstance(value, str) else value


def _rect_ok(rect):
    return isinstance(rect, dict) and all(isinstance(rect.get(k), (float, int)) and not isinstance(rect.get(k), bool)
                                          and math.isfinite(rect[k]) for k in ('x', 'y', 'w', 'h'))


def _number(value):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) else None


def fabric_frame(response):
    """The Java fabric frame, validated; raises ValueError('FABRIC_FRAME_UNAVAILABLE:<reason>') when there is none."""
    fabric = response.get('fabricFrame')
    if not isinstance(fabric, dict):
        reasons = (response.get('columns') or {}).get('gate_reasons') or response.get('outcome') or 'NO_FABRIC_FRAME'
        raise ValueError('FABRIC_FRAME_UNAVAILABLE:' + str(reasons)[:200])
    if fabric.get('ok') is not True:
        raise ValueError('FABRIC_FRAME_UNAVAILABLE:' + str(fabric.get('reason') or 'NO_FABRIC_REGION'))
    crop = fabric.get('crop')
    if not _rect_ok(crop) or crop['w'] <= 0 or crop['h'] <= 0 or crop['x'] < 0 or crop['y'] < 0 \
            or crop['x'] + crop['w'] > 1 + 1e-9 or crop['y'] + crop['h'] > 1 + 1e-9:
        raise ValueError('FABRIC_FRAME_UNAVAILABLE:INVALID_CROP')
    if _number(fabric.get('fabricCoverage')) != 1:
        raise ValueError('FABRIC_FRAME_UNAVAILABLE:FABRIC_COVERAGE_BELOW_100')
    return fabric


def apply_frame(response, category, *, force=False, fallback=None, subcategory=None):
    """Attach the fabric-only category frame to a CatalogImageBatchCli response.

    Raises ValueError when there is no fabric frame (``fallback`` = the Java analysis did not run for this photo), when
    the photo's dimensions are invalid, and — default mode only — for an unknown category.
    """
    if fallback:
        raise ValueError('FABRIC_FRAME_UNAVAILABLE:JAVA_' + str(fallback)[:200])
    result = copy.deepcopy(response)
    columns = result['columns']
    observations = []
    if category not in KNOWN:
        if not force:
            raise ValueError('CATEGORY_FRAME_UNSUPPORTED:' + str(category))
        observations.append('CATEGORY_UNKNOWN:' + str(category))
    width, height = columns.get('width'), columns.get('height')
    if not isinstance(width, int) or not isinstance(height, int) or width <= 0 or height <= 0:
        raise ValueError('CATEGORY_FRAME_INVALID_DIMENSIONS')
    fabric = fabric_frame(result)
    rect = {k: float(fabric['crop'][k]) for k in ('x', 'y', 'w', 'h')}
    if abs(rect['w'] * width / (rect['h'] * height) - ASPECT) > .02:
        raise ValueError('FABRIC_FRAME_UNAVAILABLE:ASPECT_NOT_3_4')
    crop = _object(columns.get('crop_json')) or {}
    product = crop.get('product') if _rect_ok(crop.get('product')) else None
    target = str(fabric.get('target') or '')
    anchor = fabric.get('anchor') if isinstance(fabric.get('anchor'), dict) else {}
    source = str(anchor.get('source') or '')
    estimated_note = LANDMARK_TARGETS.get((category, target))
    estimated = bool(estimated_note) and source != 'PIPELINE_LANDMARK'
    if estimated:
        observations.append(estimated_note)
    skin = _number(fabric.get('skinExcluded'))
    if skin and skin > 0:
        observations.append('PERSON_SKIN_EXCLUDED_FROM_MASK')
    metrics = _object(columns.get('metrics_json')) or {}
    confidence = metrics.get('segmentationConfidence')
    if isinstance(confidence, (int, float)) and not isinstance(confidence, bool) and confidence < .45:
        observations.append('LOW_SEGMENTATION_CONFIDENCE')
    review = estimated and not force
    crop.update(aspect='3:4', crop=rect, ruleCompliant=not review, product=product or rect)
    crop['editorFrame'] = dict(version=VERSION, policy=POLICY, fabricFrameVersion=fabric.get('version'), fabricCoverage=1.0,
                               widthPercent=round(rect['w'] * 100, 2), category=category, subcategory=subcategory, target=target,
                               focus=dict(x=_number(anchor.get('x')), y=_number(anchor.get('y'))), focusSource=source or None,
                               region=fabric.get('region'), skinExcluded=skin, cropWidthPx=fabric.get('cropWidthPx'),
                               requiresReview=review, clamped=False, observations=observations,
                               decision=FORCED_DECISION if force else 'CATEGORY_FRAME', fallback=None)
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
        columns['gate_reasons'] = ((reasons + ',' if reasons else '') + 'CATEGORY_FRAME_LANDMARK_REVIEW')[:500]
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
            'frame_observations': list(frame.get('observations') or []), 'frame_decision': frame.get('decision'),
            'frame_policy': frame.get('policy'), 'frame_fabric_coverage': frame.get('fabricCoverage')}
