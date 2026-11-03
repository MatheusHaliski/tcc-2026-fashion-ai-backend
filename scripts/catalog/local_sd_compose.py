"""Composição do packshot do lote local (tecido original, região fantasma preenchida, quadro 900×1200 com sombra) e o
nome determinístico do arquivo."""
from __future__ import annotations

import io
import re
from dataclasses import dataclass
from typing import Optional

import numpy as np
from PIL import Image, ImageFilter

from photo_preflight import fit_box
from whole_frame import HEIGHT, WIDTH
from local_sd_base import BACKGROUND, VERSION, PhotoSkip

# ───────────────────────── composição do packshot

@dataclass
class Packshot:
    data: bytes
    info: dict


def compose_packshot(source: Image.Image, target: np.ndarray, generated: Optional[Image.Image], ghost: np.ndarray, *,
                     background: tuple[int, int, int] = BACKGROUND, shadow: bool = True, alpha: Optional[np.ndarray] = None,
                     keep_alpha: bool = False) -> Packshot:
    """Tecido original onde há peça; o resultado da IA só na região fantasma (com IA); fundo liso no resto. Depois o
    Total frame: peça centralizada, maior aresta em 50% do quadro 900×1200, proporção preservada, sombra suave.
    `alpha` (0..1, engine fashn-open) é o alfa fino do BiRefNet: a borda vem do modelo, sem desfoque. `keep_alpha`: PNG
    RGBA com o RGB já composto sobre o fundo e o matte da peça no canal alfa (quem ignora o alfa vê o packshot normal;
    o provador 3D recebe o recorte pronto, sem a franja clara da borda serrilhada)."""
    src = np.asarray(source.convert("RGB"))
    if generated is not None:
        gen = np.asarray(generated.convert("RGB").resize(source.size, Image.Resampling.LANCZOS))
        rgb = np.where(target[..., None], src, gen)
        hard = target | ghost
    else:
        rgb, hard = src, target
    cutout = Image.fromarray(rgb.astype(np.uint8)).convert("RGBA")
    if alpha is None:
        # borda do alfa com 1 px de suavização: o contorno da segmentação deixa de parecer serrilhado, sem comer a peça
        matte = Image.fromarray((hard * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    else:
        soft = np.asarray(alpha, dtype=np.float32)
        if generated is not None:
            soft = np.maximum(soft, ghost.astype(np.float32))      # a região fantasma preenchida entra opaca
        matte = Image.fromarray((np.clip(soft, 0, 1) * 255).round().astype(np.uint8))
    cutout.putalpha(matte)
    box = cutout.getbbox()
    if box is None:
        raise PhotoSkip("WHOLE_EMPTY_MASK")
    cutout = cutout.crop(box)
    x, y, w, h, framing = fit_box(cutout.size, (WIDTH, HEIGHT))
    cutout = cutout.resize((w, h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), (*background, 255))
    if shadow:
        # sombra de apoio: a silhueta deslocada para baixo, escurecida e desfocada — nunca sobre a peça
        layer = Image.new("RGBA", (WIDTH, HEIGHT), (20, 24, 31, 0))
        silhouette = cutout.getchannel("A").point(lambda v: int(v * 0.22))
        layer.paste((20, 24, 31, 255), (x, y + max(4, h // 40)), silhouette)
        canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(max(6, w // 30))))
    canvas.alpha_composite(cutout, (x, y))
    if keep_alpha:
        matte = Image.new("L", (WIDTH, HEIGHT), 0)
        matte.paste(cutout.getchannel("A"), (x, y))
        canvas.putalpha(matte)
    out = io.BytesIO()
    (canvas if keep_alpha else canvas.convert("RGB")).save(out, "PNG", optimize=True)
    info = {"version": VERSION, "width": WIDTH, "height": HEIGHT, "background": "#%02X%02X%02X" % background,
            "box": {"x": round(x / WIDTH, 4), "y": round(y / HEIGHT, 4), "w": round(w / WIDTH, 4), "h": round(h / HEIGHT, 4)},
            "garmentPixels": int(target.sum()), "ghostPixels": int(ghost.sum()) if generated is not None else 0,
            "ai": generated is not None, "framing": framing, "matte": "mask-blur" if alpha is None else "birefnet", "alphaChannel": keep_alpha}
    return Packshot(out.getvalue(), info)


def slugify(value) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", str(value or "")).strip("_")[:60] or "unknown"


def output_name(row: dict) -> str:
    """{marca}_{categoria}_{produto}[_{imagem}].png — determinístico, só caracteres seguros."""
    stem = "_".join(slugify(row.get(k)) for k in ("brand", "category", "product_id"))
    image_id = str(row.get("id") or "")
    return stem + (f"_{slugify(image_id)[:8]}" if image_id and image_id != str(row.get("product_id")) else "") + ".png"
