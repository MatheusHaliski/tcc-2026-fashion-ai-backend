"""Peça inteira (Total frame): a peça recortada, sem pessoa, centralizada num quadro 3:4 de 900×1200.

Equivalente ao enquadramento de Tecido (``category_frame``), mas mostra a peça INTEIRA: o segmentador de roupa separa a
peça do corpo (pele, cabelo, outras roupas) e do fundo; a peça vai para um fundo claro com a margem do Total frame
(``lib/photo-framing.ts`` TOTAL_FRAME: até 76% da largura e 74% da altura). Lado cortado na foto (``truncated``) encosta na
borda do quadro, sem margem falsa. Foto com pessoa nunca sai daqui para serviço externo: o segmentador roda localmente.
"""
from __future__ import annotations

import io
from dataclasses import dataclass

from PIL import Image, ImageChops, ImageFilter, ImageOps

WHOLE_FRAME_VERSION = "WHOLE_FRAME_V3"
WIDTH, HEIGHT = 900, 1200
BACKGROUND = (0xF4, 0xF5, 0xF7)
MAX_W, MAX_H = 0.5, 0.5
# máscara menor que isto (fração da foto) não é uma peça: segmentação falhou ou a peça é um detalhe
MIN_AREA = 0.01

# classes do u2net_cloth_seg (rembg): 0 = parte de cima, 1 = parte de baixo, 2 = corpo inteiro
UPPER, LOWER, FULL = 0, 1, 2
ONE_PIECE_SUBCATEGORIES = {"dress", "jumpsuit", "romper", "overall", "overalls", "bodysuit", "swimsuit", "set"}


def cloth_class(category: str | None, subcategory: str | None = None) -> int | None:
    """Classe de roupa do segmentador para a categoria do catálogo; None = objeto inteiro (calçado, acessório)."""
    c = (category or "").strip().lower()
    s = (subcategory or "").strip().lower()
    if s in ONE_PIECE_SUBCATEGORIES or c in ("full_body_piece", "full_body"):
        return FULL
    if c in ("upper_piece", "upper"):
        return UPPER
    if c in ("lower_piece", "lower"):
        return LOWER
    return None


@dataclass
class WholeResult:
    data: bytes
    info: dict


def _bbox(mask: Image.Image, threshold: int = 128):
    binary = mask.point(lambda v: 255 if v >= threshold else 0)
    return binary.getbbox(), binary


def render_whole(image: Image.Image, mask: Image.Image, truncated=(), *, preflight=None) -> WholeResult:
    """Recorta a peça pela máscara, compõe no fundo claro e encaixa no quadro 3:4 com a margem do Total frame.

    ``mask``: L (0–255), 255 = peça. ``truncated``: lados cortados na foto original ("top", "bottom", "left", "right").
    """
    image = ImageOps.exif_transpose(image).convert("RGB")
    if preflight is None or preflight.status != "PASS":
        raise ValueError("SOURCE_PREFLIGHT_REQUIRED")
    if truncated:
        raise ValueError("GARMENT_COMPLETENESS_UNCERTAIN")
    if mask.size != image.size:
        raise ValueError("MASK_DIMENSIONS_MISMATCH")
    mask = mask.convert("L")
    box, binary = _bbox(mask)
    if box is None:
        raise ValueError("WHOLE_EMPTY_MASK")
    area = sum(binary.histogram()[255:]) / float(image.width * image.height)
    if area < MIN_AREA:
        raise ValueError("WHOLE_MASK_TOO_SMALL")
    piece = image.crop(box)
    alpha = binary.crop(box)
    sides = set()
    pw, ph = piece.size
    try:
        from .photo_preflight import fit_box
    except ImportError:
        from photo_preflight import fit_box
    x, y, tw, th, framing = fit_box((pw, ph), (WIDTH, HEIGHT))
    scale = framing["scale"]
    resized = piece.resize((tw, th), Image.LANCZOS)
    resized_alpha = alpha.resize((tw, th), Image.LANCZOS)
    canvas = Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)
    canvas.paste(resized, (x, y), resized_alpha)
    out = io.BytesIO()
    canvas.save(out, "JPEG", quality=92, optimize=True, progressive=True)
    info = {
        "version": WHOLE_FRAME_VERSION, "width": WIDTH, "height": HEIGHT,
        "background": "#%02X%02X%02X" % BACKGROUND,
        # caixa da peça no quadro renderizado (normalizada), para a interface encaixar sem recalcular
        "box": {"x": round(x / WIDTH, 4), "y": round(y / HEIGHT, 4), "w": round(tw / WIDTH, 4), "h": round(th / HEIGHT, 4)},
        "sourceBox": {"x": box[0], "y": box[1], "w": box[2] - box[0], "h": box[3] - box[1]},
        "maskArea": round(area, 4), "scale": round(scale, 4), "upscaled": scale > 1.0,
        "truncated": sorted(sides),
        "preflight": preflight.metrics, "framing": framing,
    }
    return WholeResult(out.getvalue(), info)


class GarmentSegmenter:
    """Máscara da peça, rodando localmente (foto com pessoa não sai para serviço externo).

    Com pessoa na foto (``model=True``) e classe de roupa conhecida, usa o u2net_cloth_seg do rembg e pega só a classe
    da peça — tira pele, cabelo e as outras roupas. Foto de produto (sem pessoa) ou objeto inteiro usa o recorte geral
    (isnet/u2net). ``backend`` pode ser injetado nos testes.
    """

    def __init__(self, backend=None):
        self._backend = backend
        self._sessions = {}

    def _session(self, name):
        if name not in self._sessions:
            from rembg import new_session  # dependência opcional: requirements-whole.txt
            self._sessions[name] = new_session(name)
        return self._sessions[name]

    def mask(self, image: Image.Image, *, category=None, subcategory=None, model=False) -> Image.Image:
        klass = cloth_class(category, subcategory)
        if self._backend is not None:
            return self._backend(image, klass=klass, model=model)
        if model and klass is not None:
            masks = self._session("u2net_cloth_seg").predict(image.convert("RGB"))
            if klass >= len(masks):
                raise ValueError("WHOLE_CLOTH_CLASS_MISSING")
            return masks[klass].convert("L")
        from rembg import remove
        cut = remove(image.convert("RGB"), session=self._session("isnet-general-use"), only_mask=True)
        return cut.convert("L")
