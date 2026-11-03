"""Máscaras do lote local: peça e corpo por categoria, a região "fantasma" (corpo por dentro da peça), a limpeza
tolerante e a medição da altura da peça (regra dos 25 %)."""
from __future__ import annotations

from typing import Optional

import numpy as np
from PIL import Image
from scipy import ndimage

from photo_preflight import MIN_SOURCE_HEIGHT, inspect_source
from photo_set import PhotoMasks, clean_target_mask
from whole_frame import HEIGHT, WIDTH, cloth_class
from local_sd_base import PhotoSkip

# ───────────────────────── máscaras: peça, corpo e a região "fantasma"

def ghost_mask(target: np.ndarray, forbidden: Optional[np.ndarray], feather: int = 3, *,
               category: Optional[str] = None) -> np.ndarray:
    """Onde o corpo aparecia POR DENTRO da peça — é só isso que a IA preenche: buracos fechados da máscara da peça (gola
    fechada, cós) e pixels de pessoa/outra peça ENTRE o primeiro e o último pixel da peça na mesma linha (pescoço entre os
    ombros, punhos, barra). Para lower_piece, o vão aberto entre as duas pernas permanece transparente. Rosto acima dos
    ombros, braços ao lado do tronco, fundo e qualquer coisa fora do perímetro ficam de fora; o tecido em si nunca entra
    (é restaurado na composição)."""
    target = np.asarray(target, dtype=bool)
    if not target.any():
        return np.zeros_like(target)
    h, w = target.shape
    rows = target.any(axis=1)
    first_x = np.argmax(target, axis=1)
    last_x = w - 1 - np.argmax(target[:, ::-1], axis=1)
    xs = np.arange(w)[None, :]
    between = rows[:, None] & (xs >= first_x[:, None]) & (xs <= last_x[:, None])
    holes = ndimage.binary_fill_holes(target) & ~target
    body = np.zeros_like(target) if forbidden is None else (np.asarray(forbidden, dtype=bool) & between & ~target)
    ghost = holes | body
    if feather > 0 and ghost.any():
        ghost = ndimage.binary_dilation(ghost, iterations=feather)
    if category == "lower_piece":
        # Cada perna é uma faixa horizontal independente abaixo do gancho.
        # O espaço entre as duas faixas não é uma cavidade da roupa: nunca
        # preencher ali pele/fundo com LaMa nem torná-lo opaco no whole.png.
        starts = target & ~np.pad(target[:, :-1], ((0, 0), (1, 0)), constant_values=False)
        split_rows = starts.sum(axis=1) >= 2
        gap = between & ~target
        ghost[split_rows] &= ~gap[split_rows]
    return ghost


def body_from_foreground(target: np.ndarray, foreground: np.ndarray, margin: int = 2) -> np.ndarray:
    """Corpo e outras peças SEM o parser humano: tudo que o recorte geral (isnet) vê como primeiro plano e não é a peça —
    com uma folga de `margin` px em volta dela, para a própria borda do tecido nunca ser marcada como corpo."""
    target = np.asarray(target, dtype=bool)
    near = ndimage.binary_dilation(target, iterations=margin) if margin > 0 else target
    return np.asarray(foreground, dtype=bool) & ~near


def masks_for(image: Image.Image, category: Optional[str], subcategory: Optional[str], provider, segmenter,
              foreground_body: bool = True) -> PhotoMasks:
    """Peça + corpo pela classe de roupa (LocalClothProvider); calçado/acessório (sem classe) usa o recorte geral.
    Sem máscara de corpo do provedor (parser humano não configurado), o corpo sai do primeiro plano geral menos a peça."""
    if cloth_class(category, subcategory) is not None:
        masks = provider.masks(image, category, subcategory)
        if masks.forbidden is None and foreground_body:
            target = np.asarray(masks.target.convert("L")) >= 128
            foreground = np.asarray(segmenter.mask(image, model=False).convert("L")) >= 128
            body = body_from_foreground(target, foreground)
            masks.forbidden = Image.fromarray((body * 255).astype(np.uint8))
            masks.human_present = bool(body.sum() > 0.002 * body.size)
            masks.source = f"{masks.source}+isnet-foreground"
        return masks
    target = segmenter.mask(image, category=category, subcategory=subcategory, model=False)
    return PhotoMasks(target.convert("L"), None, verified=True, target_category=category, target_subcategory=subcategory,
                      source="isnet-general-use", human_present=False)


LENIENT_REASONS = {"UNCLASSIFIED_THIN_CONTOUR", "AMBIGUOUS_TARGET_COMPONENTS", "SOURCE_EXTENT_UNCERTAIN"}


def lenient_clean(target: Image.Image, forbidden: Optional[Image.Image], category: Optional[str], subcategory: Optional[str]) -> tuple[np.ndarray, dict]:
    """Plano B da limpeza: abertura 3×3 identifica componentes sustentados, sem aparar sua silhueta original.
    Tira o corpo (com folga) e mantém até 2 pernas/pés, 4 peças num conjunto, 1 nos demais.
    A trilha verificada do catálogo continua estrita; aqui o modo fica registrado na evidência (`cleanupMode`)."""
    a = np.asarray(target.convert("L")) >= 128
    if forbidden is not None:
        a &= ~ndimage.binary_dilation(np.asarray(forbidden.convert("L")) >= 128, iterations=1)
    before = int(a.sum())
    opened = ndimage.binary_opening(a, structure=np.ones((3, 3), dtype=bool))
    labels, _ = ndimage.label(opened)
    areas = np.bincount(labels.ravel()); areas[0] = 0
    sub = (subcategory or "").lower(); cat = (category or "").lower()
    max_parts = 4 if sub in {"matching_set", "set", "two_piece_set", "bikini", "bikini_set"} else 2 if cat in {"lower_piece", "shoes_piece"} or sub == "socks" else 1
    keep = [k for k in np.argsort(areas)[::-1] if areas[k] >= max(24, int(opened.sum() * .004))][:max_parts]
    if not keep:
        raise PhotoSkip("TARGET_MASK_EMPTY_AFTER_CLEANUP", "REVIEW")
    support = np.isin(labels, keep)
    # Reconstrói somente pixels presentes na máscara original e ligados ao
    # núcleo: não perde detalhes legítimos finos de cós, barras e costuras.
    cleaned = ndimage.binary_propagation(support, mask=a)
    kept = int(cleaned.sum())
    if kept < 64 or kept < .6 * max(before, 1):
        raise PhotoSkip("EXCESSIVE_MASK_REMOVAL", "REVIEW")
    return cleaned, {"cleanupMode": "LENIENT_OPENING", "removedPixels": before - kept, "targetPixels": kept, "retainedParts": len(keep),
                     "removedFraction": round(1 - kept / max(before, 1), 5), "maskCoverage": round(kept / cleaned.size, 5)}


def measure(image: Image.Image, masks: PhotoMasks, category: Optional[str], subcategory: Optional[str],
            original: tuple[int, int], lenient: bool = True) -> tuple[np.ndarray, Optional[np.ndarray], dict]:
    """Limpa a máscara e mede a peça. Altura menor que 25% da foto → INELIGIBLE (o motivo vai ao relatório; nada é
    gerado nem apagado). O preflight completo entra no relatório como evidência, sem bloquear a geração local. A limpeza
    estrita do catálogo vem primeiro; contorno fino não classificado ou extensão ambígua caem na tolerante (`lenient`)."""
    preflight = inspect_source(image, masks, category or "", subcategory, original_size=original)
    try:
        cleaned, cleanup = clean_target_mask(masks.target, masks.forbidden, category or "", subcategory)
        target = np.asarray(cleaned) >= 128
        cleanup = {"cleanupMode": "STRICT", **cleanup}
    except ValueError as error:
        if not lenient or str(error) not in LENIENT_REASONS:
            raise PhotoSkip(str(error), "REVIEW", {"preflight": preflight.metrics}) from None
        target, cleanup = lenient_clean(masks.target, masks.forbidden, category, subcategory)
        cleanup["strictReason"] = str(error)
    if category == "lower_piece" and preflight.metrics.get("status") == "PASS":
        # Um preflight válido da fonte não atesta a máscara depois da limpeza.
        # Se ela perder o topo (cós) ou as barras, impedir READY silencioso.
        before_ys = np.flatnonzero((np.asarray(masks.target.convert("L")) >= 128).any(axis=1))
        after_ys = np.flatnonzero(target.any(axis=1))
        if before_ys.size and after_ys.size:
            top_loss = max(0, int(after_ys[0] - before_ys[0]))
            bottom_loss = max(0, int(before_ys[-1] - after_ys[-1]))
            tolerance = max(3, int(round(image.height * 0.02)))
            if top_loss > tolerance or bottom_loss > tolerance:
                raise PhotoSkip("LOWER_PIECE_EXTENT_LOSS", "REVIEW",
                                {"preflight": preflight.metrics, "cleanup": cleanup,
                                 "extentLoss": {"topPixels": top_loss, "bottomPixels": bottom_loss}})
    ys, xs = np.where(target)
    height_fraction = (ys.max() + 1 - ys.min()) / image.height
    frame_height = min(0.5, 0.5 * ((ys.max() + 1 - ys.min()) / (xs.max() + 1 - xs.min())) * (WIDTH / HEIGHT))
    metrics = {"preflight": preflight.metrics, "cleanup": cleanup, "sourceGarmentHeightFraction": round(float(height_fraction), 4),
               "frameGarmentHeightFraction": round(float(frame_height), 4), "minimumHeightFraction": MIN_SOURCE_HEIGHT,
               "sourceBox": {"x": int(xs.min()), "y": int(ys.min()), "w": int(xs.max() + 1 - xs.min()), "h": int(ys.max() + 1 - ys.min())}}
    if height_fraction < MIN_SOURCE_HEIGHT:
        raise PhotoSkip("SOURCE_GARMENT_BELOW_MIN_HEIGHT", "INELIGIBLE", metrics)
    forbidden = None if masks.forbidden is None else np.asarray(masks.forbidden.convert("L")) >= 128
    return target, forbidden, metrics
