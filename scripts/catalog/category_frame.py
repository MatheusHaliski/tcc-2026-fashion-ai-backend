"""Category frame for the catalogue batch (V3): the 3:4 editor frame follows the card's Product Framing Rule.

Policy (CATALOG_FRAME_34_PRODUCT_RULE_V3, ``PRODUCT_RULE``): the frame is computed by the Java pipeline
(ProductRuleFrame) with the same rule engine as the card — catalog/semantic-regions.json resolved for the category and
subcategory and ``SemanticCropper.registryRuleCrop`` — in the 3:4 proportion of the editor frame:

    upper_piece / full_body_piece  COVER/TOP: the piece fills the frame, collar/neckline on the top edge, sleeves cut by the
                                   sides; on a model the frame starts at the garment neckline (no face/neck skin) and never
                                   shows background or skin
    lower_piece                    COVER/TOP: waistband on the top edge, the piece fills the width, pockets and fly in the
                                   upper half (waistband → crotch is all piece) and the legs continue past the bottom edge;
                                   on a model the shirt/jacket above the waistband is excluded; skirt/skort: the whole frame
    shoes_piece                    WIDTH/CENTER: the whole shoe, its full length across the width (2% margin), centred,
                                   background above/below
    accessory_piece                CONTAIN/CENTER: the whole object with background margins (bags, jewellery, beanie, scarf,
                                   belt); watch COVER on the dial; sunglasses/eyeglasses WIDTH

Where the 3:4 window of a whole-object rule goes past the photo, the renderer completes it with the studio background
colour (the card's smartPadding). A cover frame (upper/lower/full body) narrower than 55% of the garment width at the
frame's top band (the torso across the frame rows from the neckline; the hips in the waistband → crotch band) is a blurred
zoom of fabric and is refused (``COVER_FRAME_TOO_NARROW``). When the rule cannot be satisfied (piece not isolated — e.g. a
shoe on a foot —, no waistband visible, no cover window at the neckline, frame too small or too narrow, background not
uniform) the photo is NOT reframed and no new frame is stored: ``FRAME_UNAVAILABLE:<reason>``. If that photo is still showing
a legacy frame (V1/V2 under /catalog/framed/), the process script restores it to its pre-frame state (``frame_revert``,
decision ``REVERTED_TO_ORIGINAL``). ``--force-category-frame`` only waives source authorisation and confirmed visual identity
(process script); here it keeps rule-compliance doubts as observations instead of review.
"""
import copy
import json
import math

VERSION = 'CATALOG_FRAME_34_PRODUCT_RULE_V3'
# V1: 50%-wide editor frame (could show background); V2: fabric-only close-up (chest/fly/upper) — both differ from the
# card rule and are redone on the next run
LEGACY_VERSIONS = ('CATALOG_FRAME_34_50_V1', 'CATALOG_FRAME_34_FABRIC_V2')
POLICY = 'PRODUCT_RULE'
FORCED_DECISION = 'FORCED_CATEGORY_FRAME'
# V3 recusou a foto e a imagem enquadrada antiga (V1/V2) voltou ao estado anterior ao quadro
REVERTED_DECISION = 'REVERTED_TO_ORIGINAL'
UNAVAILABLE = 'FRAME_UNAVAILABLE:'
FRAMED_PATH = '/catalog/framed/'                     # chave dos JPEGs do lote no S3 (category_frame_storage.FrameStorage)
ASPECT = .75                                         # 3:4 in pixels
KNOWN = {'upper_piece', 'lower_piece', 'accessory_piece', 'shoes_piece', 'full_body_piece'}
FITS = {'COVER', 'WIDTH', 'CONTAIN'}
ALIGNS = {'TOP', 'CENTER', 'FOCUS'}
WHOLE_OBJECT_FITS = {'WIDTH', 'CONTAIN'}             # the object must be whole; the frame may go past the photo (padding)


def _object(value):
    return json.loads(value) if isinstance(value, str) else value


def _number(value):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) else None


def _rect_ok(rect):
    return isinstance(rect, dict) and all(_number(rect.get(k)) is not None for k in ('x', 'y', 'w', 'h'))


def framed_url(url):
    """URL de um JPEG gravado pelo lote de enquadramento (``…/catalog/framed/<uuid>/<sha256>.jpg``)."""
    if not isinstance(url, str) or not url.strip():
        return False
    from urllib.parse import unquote, urlsplit
    try:
        return FRAMED_PATH in unquote(urlsplit(url.strip()).path)
    except ValueError:
        return False


def legacy_framed(record):
    """A imagem mostra hoje um quadro de uma versão anterior (V1 50%, V2 só tecido): versão antiga e stored_url do lote."""
    return record.get('pipeline_version') in LEGACY_VERSIONS and framed_url(record.get('stored_url'))


def reverted_marker(record):
    """Marcador ``REVERTED_TO_ORIGINAL`` gravado quando a V3 recusou a foto e o quadro antigo foi desfeito (ou None).

    Fica em ``crop_json.editorFrame`` e ``metrics_json.debug.editorFrame`` (e em ``assets_json.editorFrame`` quando a
    imagem voltou a ter assets)."""
    if record.get('pipeline_version') != VERSION:
        return None
    sources = []
    for name in ('crop', 'assets', 'metrics'):
        value = record.get(name + '_json', record.get(name))
        try:
            value = _object(value)
        except ValueError:
            value = None
        if isinstance(value, dict):
            sources.append(value.get('editorFrame') if name != 'metrics' else (value.get('debug') or {}).get('editorFrame'))
    for frame in sources:
        if isinstance(frame, dict) and frame.get('decision') == REVERTED_DECISION:
            return frame
    return None


def crop_inside_photo(rect):
    return rect['x'] >= -1e-9 and rect['y'] >= -1e-9 and rect['x'] + rect['w'] <= 1 + 1e-9 and rect['y'] + rect['h'] <= 1 + 1e-9


def product_frame(response):
    """The Java product-rule frame, validated; raises ValueError('FRAME_UNAVAILABLE:<reason>') when there is none."""
    frame = response.get('productFrame')
    if not isinstance(frame, dict):
        reasons = (response.get('columns') or {}).get('gate_reasons') or response.get('outcome') or 'NO_PRODUCT_FRAME'
        raise ValueError(UNAVAILABLE + str(reasons)[:200])
    if frame.get('ok') is not True:
        raise ValueError(UNAVAILABLE + str(frame.get('reason') or 'NO_FRAME'))
    rule = frame.get('rule') if isinstance(frame.get('rule'), dict) else {}
    fit, align = rule.get('fit'), rule.get('align')
    if fit not in FITS or align not in ALIGNS:
        raise ValueError(UNAVAILABLE + 'INVALID_RULE')
    crop = frame.get('crop')
    if not _rect_ok(crop) or crop['w'] <= 0 or crop['h'] <= 0:
        raise ValueError(UNAVAILABLE + 'INVALID_CROP')
    if frame.get('coverageScope') is not None:
        # parte de cima/baixo (COVER na máscara da peça): a peça preenche o quadro, que fica dentro da foto
        if not crop_inside_photo(crop):
            raise ValueError(UNAVAILABLE + 'INVALID_CROP')
        if _number(frame.get('garmentCoverage')) != 1:
            raise ValueError(UNAVAILABLE + 'COVERAGE_BELOW_100')
    else:
        # objeto (WIDTH/CONTAIN inteiro, COVER no mostrador): o quadro pode passar da foto (fundo de estúdio), com limite
        if crop['x'] < -2 or crop['y'] < -2 or crop['x'] + crop['w'] > 3 or crop['y'] + crop['h'] > 3:
            raise ValueError(UNAVAILABLE + 'INVALID_CROP')
        if fit in WHOLE_OBJECT_FITS and (_number(frame.get('objectInside')) or 0) < .999:
            raise ValueError(UNAVAILABLE + 'OBJECT_CUT')
    return frame


def apply_frame(response, category, *, force=False, fallback=None, subcategory=None):
    """Attach the product-rule category frame to a CatalogImageBatchCli response.

    Raises ValueError when there is no frame (``fallback`` = the Java analysis did not run for this photo), when the
    photo's dimensions are invalid, and — default mode only — for an unknown category.
    """
    if fallback:
        raise ValueError(UNAVAILABLE + 'JAVA_' + str(fallback)[:200])
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
    frame = product_frame(result)
    rect = {k: float(frame['crop'][k]) for k in ('x', 'y', 'w', 'h')}
    if abs(rect['w'] * width / (rect['h'] * height) - ASPECT) > .02:
        raise ValueError(UNAVAILABLE + 'ASPECT_NOT_3_4')
    rule = dict(frame['rule'])
    crop = _object(columns.get('crop_json')) or {}
    product = frame.get('product') if _rect_ok(frame.get('product')) else (crop.get('product') if _rect_ok(crop.get('product')) else None)
    focus = frame.get('focus') if isinstance(frame.get('focus'), dict) else {}
    compliance = frame.get('compliance') if isinstance(frame.get('compliance'), dict) else {}
    observations.extend(str(o) for o in frame.get('observations') or [])
    skin = _number(frame.get('skinExcluded'))
    if frame.get('model') and skin and skin > 0:
        observations.append('PERSON_SKIN_EXCLUDED_FROM_MASK')
    metrics = _object(columns.get('metrics_json')) or {}
    confidence = metrics.get('segmentationConfidence')
    if isinstance(confidence, (int, float)) and not isinstance(confidence, bool) and confidence < .45:
        observations.append('LOW_SEGMENTATION_CONFIDENCE')
    # regra cumprida pelo próprio cálculo da conformidade do card (foco na metade de cima, calçado de lado…); dúvida vira revisão
    # no modo padrão e observação no modo forçado
    compliant = compliance.get('ok') is not False
    if not compliant:
        observations.append('RULE_COMPLIANCE_DOUBT')
    review = not compliant and not force
    background = frame.get('background') or crop.get('background')
    padding = _number(frame.get('padding')) or 0
    crop.update(aspect='3:4', crop=rect, ruleCompliant=not review, product=product or rect)
    if background:
        crop['background'] = background
    source = frame.get('ruleSource') if isinstance(frame.get('ruleSource'), dict) else {}
    crop['editorFrame'] = dict(
        version=VERSION, policy=POLICY, productFrameVersion=frame.get('version'), rule=rule, fit=rule.get('fit'),
        align=rule.get('align'), view=rule.get('view'), ruleSource=source, widthPercent=round(rect['w'] * 100, 2),
        category=category, subcategory=subcategory, target=frame.get('target'),
        focus=dict(x=_number(focus.get('x')), y=_number(focus.get('y'))), focusName=focus.get('name'),
        focusSource=compliance.get('focusSource') or ('WAIST_TO_CROTCH_MASK' if frame.get('coverageScope') == 'WAIST_TO_CROTCH' else 'REGISTRY'),
        garmentCoverage=_number(frame.get('garmentCoverage')), coverageScope=frame.get('coverageScope'),
        objectInside=_number(frame.get('objectInside')), padding=padding, background=background,
        model=bool(frame.get('model')), skinExcluded=skin, cropWidthPx=frame.get('cropWidthPx'),
        frameWidthShare=_number(compliance.get('frameWidthShare')), garmentWidthPx=compliance.get('garmentWidthPx'),
        compliance={k: compliance.get(k) for k in ('ok', 'focusInTopHalf', 'focusCenter', 'frameFilledByProduct',
                                                    'widthFilledByProduct', 'productInsideFrame', 'sideView') if k in compliance},
        requiresReview=review, clamped=False, observations=observations,
        decision=FORCED_DECISION if force else 'CATEGORY_FRAME', fallback=None)
    # Old crop scores/rules describe a different geometry (the 4:5 card crop) and must not survive.
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
        columns['gate_reasons'] = ((reasons + ',' if reasons else '') + 'CATEGORY_FRAME_RULE_REVIEW')[:500]
    return result


def report_fields(response):
    """Flat fields for the spreadsheet/JSONL from a framed response (never raises)."""
    try:
        frame = (_object(response['columns'].get('crop_json')) or {}).get('editorFrame') or {}
    except (KeyError, TypeError, ValueError):
        return {}
    source = frame.get('ruleSource') or {}
    return {'frame_category': frame.get('category'), 'frame_target': frame.get('target'),
            'frame_focus': frame.get('focus'), 'frame_focus_source': frame.get('focusSource'),
            'frame_width_percent': frame.get('widthPercent'), 'frame_fallback': frame.get('fallback'),
            'frame_observations': list(frame.get('observations') or []), 'frame_decision': frame.get('decision'),
            'frame_policy': frame.get('policy'),
            # nome antigo mantido para os relatórios: cobertura da peça no quadro (COVER) ou objeto inteiro (WIDTH/CONTAIN)
            'frame_fabric_coverage': frame.get('garmentCoverage') if frame.get('garmentCoverage') is not None else frame.get('objectInside'),
            'frame_fit': frame.get('fit'), 'frame_align': frame.get('align'),
            'frame_rule_source': (source.get('origin') or '') + ('@' + str(source.get('registryVersion')) if source.get('registryVersion') else '') or None,
            'frame_padding': frame.get('padding'), 'frame_width_share': frame.get('frameWidthShare')}
