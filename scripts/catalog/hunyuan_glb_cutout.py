"""Roda na GPU do lote 3D, antes da forma: tira a pessoa da foto do produto (fonte ``FOTO`` do glb_batch_sources.py).

Reusa o recorte FASHN do packshot (fashn_open.FashnOpenProvider: parser humano + BiRefNet, rótulos por categoria do
fashn-vton-1.5). Sai um PNG RGBA só com a peça, no formato que o Hunyuan3D espera (alfa = peça). Foto com a peça pequena
demais é recusada; peça cortada pela borda da foto segue, mas fica anotada (``incompleta``) para a revisão.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

MIN_FRACTION = 0.02          # peça abaixo de 2 % da foto: não há o que reconstruir
MARGIN = 0.08                # folga em volta da peça no recorte


def to_rgba(image: Image.Image, alpha: np.ndarray, target: np.ndarray) -> Image.Image:
    """Recorte quadrado com folga em volta da peça; alfa fino do BiRefNet só onde é peça."""
    rgba = image.convert("RGBA")
    a = (np.clip(alpha, 0, 1) * np.asarray(target, dtype=bool) * 255).astype(np.uint8)
    rgba.putalpha(Image.fromarray(a))
    ys, xs = np.nonzero(target)
    top, bottom, left, right = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    side = int(max(bottom - top, right - left) * (1 + 2 * MARGIN))
    cy, cx = (top + bottom) // 2, (left + right) // 2
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(rgba.crop((left, top, right, bottom)), (side // 2 - (cx - left), side // 2 - (cy - top)))
    return canvas


def review(fusion, target: np.ndarray) -> dict:
    """O que vai para ``recorte.json``: modo do recorte, pessoa na foto, peça cortada pela borda, fração da foto."""
    attest = fusion.attestations()
    return {"modo": fusion.mode, "pessoa": bool(fusion.person), "incompleta": attest["complete"] is False,
            "fracao": round(float(np.asarray(target, dtype=bool).mean()), 4)}


class GarmentCutout:
    def __init__(self, weights: Path, device: str = "cuda", provider=None):
        if provider is None:
            from fashn_open import FashnOpenProvider
            provider = FashnOpenProvider(Path(weights), device)
        self.provider = provider

    def __call__(self, photo: Path, category: str, subcategory: str, dest: Path) -> Path:
        image = Image.open(photo)
        image.load()
        image = image.convert("RGB")
        fusion = self.provider.analyse(image, category or None, subcategory or None)
        target = np.asarray(fusion.target, dtype=bool)
        if target.mean() < MIN_FRACTION:
            raise ValueError("RECORTE_PECA_PEQUENA")
        dest.parent.mkdir(parents=True, exist_ok=True)
        to_rgba(image, fusion.alpha, target).save(dest)
        (dest.parent / "recorte.json").write_text(json.dumps(review(fusion, target), ensure_ascii=False))
        return dest
