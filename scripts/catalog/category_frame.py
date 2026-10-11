"""Quadro 3:4 preenchido 100% pela peça, sem fundo, padding ou pessoas.

V4 usa FabricFrame: gola, zíper, centro do acessório e logo do calçado.
A ausência de região válida impede o recorte, inclusive no modo forçado.
Focos estimados são registrados para auditoria. V1/V2/V3 são reprocessados.
"""
import copy
import json
import math

VERSION = 'CATALOG_FRAME_34_FILLED_V4'
# V1: 50%-wide editor frame (could show background); V2: fabric-only close-up (chest/fly/upper) — both differ from the
# card rule and are redone on the next run
LEGACY_VERSIONS = ('CATALOG_FRAME_34_50_V1', 'CATALOG_FRAME_34_FABRIC_V2', 'CATALOG_FRAME_34_PRODUCT_RULE_V3')
POLICY = 'PIECE_FILLED_100'
FORCED_DECISION = 'FORCED_CATEGORY_FRAME'
# V3 recusou a foto e a imagem enquadrada antiga (V1/V2) voltou ao estado anterior ao quadro
REVERTED_DECISION = 'REVERTED_TO_ORIGINAL'
UNAVAILABLE = 'FRAME_UNAVAILABLE:'
FRAMED_PATH = '/catalog/framed/'                     # chave dos JPEGs do lote no S3 (category_frame_storage.FrameStorage)
ASPECT = .75                                         # 3:4 in pixels
KNOWN = {'upper_piece', 'lower_piece', 'accessory_piece', 'shoes_piece', 'full_body_piece'}


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


def apply_frame(response, category, *, force=False, fallback=None, subcategory=None):
    """Latest rule: every pixel belongs to the piece; no padding or person is allowed, even with force."""
    if fallback:
        raise ValueError(UNAVAILABLE + 'JAVA_' + str(fallback))
    if category not in KNOWN:
        raise ValueError('CATEGORY_FRAME_UNSUPPORTED:' + str(category))
    frame = response.get('fabricFrame')
    if not isinstance(frame, dict) or frame.get('ok') is not True:
        raise ValueError(UNAVAILABLE + str((frame or {}).get('reason') or 'NO_FILLED_FRAME'))
    if _number(frame.get('fabricCoverage')) != 1:
        raise ValueError(UNAVAILABLE + 'COVERAGE_BELOW_100')
    rect = frame.get('crop')
    if not _rect_ok(rect) or rect['w'] <= 0 or rect['h'] <= 0 or not crop_inside_photo(rect):
        raise ValueError(UNAVAILABLE + 'INVALID_CROP')
    result = copy.deepcopy(response)
    columns = result['columns']
    w, h = columns.get('width'), columns.get('height')
    if not isinstance(w, int) or not isinstance(h, int) or w <= 0 or h <= 0:
        raise ValueError('CATEGORY_FRAME_INVALID_DIMENSIONS')
    if abs(rect['w'] * w / (rect['h'] * h) - ASPECT) > .02:
        raise ValueError(UNAVAILABLE + 'ASPECT_NOT_3_4')
    anchor = frame.get('anchor') or {}
    crop = _object(columns.get('crop_json')) or {}
    crop.update(aspect='3:4', crop=rect, ruleCompliant=True)
    for key in ('rule', 'detail', 'padding', 'selectionFrame'):
        crop.pop(key, None)
    crop['editorFrame'] = dict(version=VERSION, policy=POLICY, fabricFrameVersion=frame.get('version'),
        category=category, subcategory=subcategory, target=frame.get('target'), focus=dict(x=anchor.get('x'), y=anchor.get('y')),
        focusSource=anchor.get('source'), fit='COVER', align='FOCUS', garmentCoverage=1.0, coverageScope='FRAME',
        padding=0, requiresReview=False, observations=['FOCUS_ESTIMATED'] if str(anchor.get('source', '')).startswith('ESTIMATED') else [],
        decision=FORCED_DECISION if force else 'CATEGORY_FRAME', widthPercent=round(rect['w']*100, 2), fallback=None)
    metrics = _object(columns.get('metrics_json')) or {}
    metrics.setdefault('debug', {})['editorFrame'] = crop['editorFrame']
    columns.update(crop_json=json.dumps(crop, ensure_ascii=False, allow_nan=False),
        metrics_json=json.dumps(metrics, ensure_ascii=False, allow_nan=False), pipeline_version=VERSION, processing_status='APPROVED')
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
