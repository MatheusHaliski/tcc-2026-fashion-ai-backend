"""Pure image helpers (no GPU): validation, mask cleanup and the PNG layouts the API returns."""
from __future__ import annotations

import io

import numpy as np
from PIL import Image, ImageFilter, ImageOps

ACCEPTED = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}


class InvalidImage(ValueError):
    pass


def decode_upload(raw: bytes, max_pixels: int) -> Image.Image:
    """Decodes a client upload safely: real format sniffing, pixel ceiling before decoding, EXIF rotation applied."""
    try:
        with Image.open(io.BytesIO(raw)) as probe:
            if probe.format not in ACCEPTED:
                raise InvalidImage("Envie JPG, PNG ou WEBP")
            if probe.width * probe.height > max_pixels:
                raise InvalidImage(f"Imagem excede {max_pixels // 1_000_000} megapixels")
            probe.load()
            picture = ImageOps.exif_transpose(probe).convert("RGB")
    except InvalidImage:
        raise
    except (Image.DecompressionBombError, OSError, ValueError, SyntaxError) as exc:
        raise InvalidImage("Arquivo não é imagem válida") from exc
    if min(picture.size) < 64:
        raise InvalidImage("Imagem pequena demais (mínimo 64 px por lado)")
    return picture


def png_bytes(image: Image.Image, optimize: bool = False) -> bytes:
    out = io.BytesIO()
    image.save(out, format="PNG", optimize=optimize)
    return out.getvalue()


def open_png(raw: bytes) -> Image.Image:
    with Image.open(io.BytesIO(raw)) as img:
        img.load()
        return img.copy()


def check_bbox(box, width: int, height: int):
    if box is None:
        return None
    if len(box) != 4:
        raise ValueError("Bounding box deve conter quatro coordenadas")
    x1, y1, x2, y2 = map(float, box)
    if not (0 <= x1 < x2 <= width and 0 <= y1 < y2 <= height):
        raise ValueError("Bounding box fora da imagem")
    if (x2 - x1) < 8 or (y2 - y1) < 8:
        raise ValueError("Bounding box pequeno demais")
    return [x1, y1, x2, y2]


def clean_mask(mask, box=None, min_island_fraction: float = 0.02) -> np.ndarray:
    """Keeps the connected components that matter (the largest, plus islands ≥2% of it that touch the box) and fills
    enclosed holes. SAM sometimes leaves specks of skin/background; we never add pixels the model did not select
    except fully enclosed holes inside the garment."""
    from scipy import ndimage

    binary = np.asarray(mask) > 0
    labels, count = ndimage.label(binary)
    if count == 0:
        return binary.astype(np.uint8)
    sizes = ndimage.sum(binary, labels, index=range(1, count + 1))
    largest = float(max(sizes))
    keep = np.zeros(count + 1, dtype=bool)
    for idx, size in enumerate(sizes, start=1):
        if size == largest or size >= largest * min_island_fraction:
            keep[idx] = True
    if box is not None:
        x1, y1, x2, y2 = (int(round(v)) for v in box)
        inside = np.zeros_like(binary)
        inside[max(0, y1):y2, max(0, x1):x2] = True
        for idx in range(1, count + 1):
            if keep[idx] and sizes[idx - 1] != largest and not (inside & (labels == idx)).any():
                keep[idx] = False
    cleaned = keep[labels]
    return ndimage.binary_fill_holes(cleaned).astype(np.uint8)


def _alpha(image: Image.Image, mask) -> Image.Image:
    if mask.shape != (image.height, image.width):
        raise ValueError("Máscara fora do tamanho da imagem")
    alpha = Image.fromarray((np.asarray(mask) > 0).astype(np.uint8) * 255, "L")
    return alpha.filter(ImageFilter.GaussianBlur(radius=1.2))


def make_cutout_png(image: Image.Image, mask) -> bytes:
    """Same frame as the input, garment pixels opaque and everything else transparent (rembg-compatible output)."""
    rgba = image.convert("RGBA")
    rgba.putalpha(_alpha(image, mask))
    return png_bytes(rgba)


def make_catalog_png(image: Image.Image, mask, background: str = "white", size=(1024, 1536)) -> bytes:
    """Crop real image pixels with a soft alpha mask; DOES NOT reconstruct covered areas."""
    if background not in {"white", "transparent"}:
        raise ValueError("Fundo inválido")
    alpha = _alpha(image, mask)
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError("Máscara vazia")
    rgba = image.convert("RGBA")
    rgba.putalpha(alpha)
    cropped = rgba.crop(bbox)
    tw, th = size
    margin = 0.10
    scale = min((tw * (1 - 2 * margin)) / cropped.width, (th * (1 - 2 * margin)) / cropped.height)
    dst = cropped.resize((max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))),
                         Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (tw, th), (255, 255, 255, 255) if background == "white" else (0, 0, 0, 0))
    canvas.alpha_composite(dst, ((tw - dst.width) // 2, (th - dst.height) // 2))
    return png_bytes(canvas, optimize=True)


def mask_png(mask) -> bytes:
    return png_bytes(Image.fromarray((np.asarray(mask) > 0).astype(np.uint8) * 255, "L"))


def fit_within(image: Image.Image, max_side: int, multiple: int = 16) -> Image.Image:
    """Downscales so the longest side ≤ max_side and both sides are multiples of `multiple` (diffusion latents)."""
    scale = min(1.0, max_side / max(image.size))
    w = max(multiple, int(image.width * scale) // multiple * multiple)
    h = max(multiple, int(image.height * scale) // multiple * multiple)
    return image if (w, h) == image.size else image.resize((w, h), Image.Resampling.LANCZOS)


def on_white(rgba: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    canvas.alpha_composite(rgba.convert("RGBA"))
    return canvas.convert("RGB")
