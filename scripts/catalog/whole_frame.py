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

WHOLE_FRAME_VERSION = "WHOLE_FRAME_V2"
WIDTH, HEIGHT = 900, 1200
BACKGROUND = (0xF4, 0xF5, 0xF7)
MAX_W, MAX_H = 0.76, 0.74
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


def render_whole(image: Image.Image, mask: Image.Image, truncated=()) -> WholeResult:
    """Recorta a peça pela máscara, compõe no fundo claro e encaixa no quadro 3:4 com a margem do Total frame.

    ``mask``: L (0–255), 255 = peça. ``truncated``: lados cortados na foto original ("top", "bottom", "left", "right").
    """
    image = ImageOps.exif_transpose(image).convert("RGB")
    mask = mask.convert("L").resize(image.size, Image.LANCZOS)
    box, binary = _bbox(mask)
    if box is None:
        raise ValueError("WHOLE_EMPTY_MASK")
    area = sum(binary.histogram()[255:]) / float(image.width * image.height)
    if area < MIN_AREA:
        raise ValueError("WHOLE_MASK_TOO_SMALL")
    # borda suave: tira serrilhado sem engordar a peça
    soft = ImageChops.multiply(mask, binary.filter(ImageFilter.MaxFilter(3))).filter(ImageFilter.GaussianBlur(0.8))
    piece = image.crop(box)
    alpha = soft.crop(box)
    sides = {s for s in truncated or () if s in ("top", "bottom", "left", "right")}
    pw, ph = piece.size
    # só o lado cortado na foto encosta na borda; os outros lados mantêm a margem do Total frame
    margin_x, margin_y = (1 - MAX_W) / 2, (1 - MAX_H) / 2
    max_w = WIDTH * (1 - margin_x * (2 - len({"left", "right"} & sides)))
    max_h = HEIGHT * (1 - margin_y * (2 - len({"top", "bottom"} & sides)))
    scale = min(max_w / pw, max_h / ph)
    tw, th = max(1, round(pw * scale)), max(1, round(ph * scale))
    resized = piece.resize((tw, th), Image.LANCZOS)
    resized_alpha = alpha.resize((tw, th), Image.LANCZOS)
    if scale > 1.0:
        # ampliada: nitidez leve para o tecido não ficar lavado (sem inventar detalhe)
        resized = resized.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
    x = (WIDTH - tw) // 2
    y = (HEIGHT - th) // 2
    if "bottom" in sides:
        y = HEIGHT - th
    elif "top" in sides:
        y = 0
    if "left" in sides and "right" not in sides:
        x = 0
    elif "right" in sides and "left" not in sides:
        x = WIDTH - tw
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
