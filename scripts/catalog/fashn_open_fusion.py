"""Fusão parser × BiRefNet do engine fashn-open: a peça, o corpo, o alfa fino e a evidência das atestações."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Optional

import numpy as np
from PIL import Image
from scipy import ndimage

from photo_set import PhotoMasks
from fashn_open_labels import (HUMAN_LABELS, IDS_TO_LABELS, MAX_BODY_INSIDE, MAX_OCCLUDER, OCCLUDER_LABELS, PERSON_LABELS,
                               VERIFIED_MODES)

# ───────────────────────── fusão parser × BiRefNet

@dataclass
class Fusion:
    target: np.ndarray                    # bool — a peça
    forbidden: Optional[np.ndarray]       # bool — corpo e tudo que é primeiro plano sem ser a peça
    alpha: np.ndarray                     # float32 0..1 — alfa fino da peça (borda do BiRefNet)
    mode: str                             # parser+birefnet · birefnet-flat-lay · birefnet-only
    person: bool
    kept: tuple[str, ...] = ()
    evidence: dict = field(default_factory=dict)   # touchesBorder, bodyInsideFraction, occluderFraction

    @property
    def verified(self) -> bool:
        return self.mode in VERIFIED_MODES

    def attestations(self) -> dict:
        """`complete`, `occluded` e `measurement_verified` do preflight, a partir da evidência dos dois modelos — nunca da
        mera existência de uma máscara. occluded=None (incerto) com corpo demais por dentro da peça ou mão/bolsa sobre o
        tecido; complete=False quando a peça encosta na borda da foto. Sem isolação verificada, nada é atestado."""
        if not self.verified:
            return {"complete": None, "occluded": None, "measurement_verified": False}
        e = self.evidence
        clear = e.get("bodyInsideFraction", 0.0) <= MAX_BODY_INSIDE and e.get("occluderFraction", 0.0) <= MAX_OCCLUDER
        return {"complete": not e.get("touchesBorder", True), "occluded": False if clear else None, "measurement_verified": True}

    def photo_masks(self, category, subcategory, source: str = "fashn-open") -> PhotoMasks:
        def to_l(array):
            return Image.fromarray((np.asarray(array, dtype=bool) * 255).astype(np.uint8))
        att = self.attestations()
        # flat-lay verificado: o parser não viu pessoa, então a máscara de corpo é vazia (e existe — a avaliação foi feita)
        forbidden = self.forbidden if self.forbidden is not None else (np.zeros_like(self.target) if self.verified else None)
        return PhotoMasks(to_l(self.target), None if forbidden is None else to_l(forbidden), verified=True,
                          target_category=category, target_subcategory=subcategory, human_present=self.person if self.verified else None,
                          source=f"{source}:{self.mode}", measurement_verified=att["measurement_verified"],
                          isolation_verified=self.verified, complete=att["complete"], occluded=att["occluded"])


def evidence_of(target: np.ndarray, forbidden: Optional[np.ndarray], labels: Optional[np.ndarray]) -> dict:
    """O que sustenta as atestações: peça encostando na borda; corpo visível ENTRE o primeiro e o último pixel da peça na
    mesma linha (gola, punhos, entre as pernas — é o que o preenchimento cobre); mãos/bolsa/óculos/joia dentro da caixa
    da peça (coisas na frente do tecido, que nenhum preenchimento recupera)."""
    h, w = target.shape
    touches = bool(target[0].any() or target[-1].any() or target[:, 0].any() or target[:, -1].any())
    area = max(1, int(target.sum()))
    body_inside = 0.0
    if forbidden is not None and area > 1:
        rows = target.any(axis=1)
        first = np.argmax(target, axis=1)
        last = w - 1 - np.argmax(target[:, ::-1], axis=1)
        xs = np.arange(w)[None, :]
        between = rows[:, None] & (xs >= first[:, None]) & (xs <= last[:, None])
        body_inside = float((np.asarray(forbidden, dtype=bool) & between).sum()) / area
    occluder = 0.0
    if labels is not None and area > 1:
        ys, xs_ = np.where(target)
        box = (slice(int(ys.min()), int(ys.max()) + 1), slice(int(xs_.min()), int(xs_.max()) + 1))
        occluder = float(np.isin(np.asarray(labels)[box], list(OCCLUDER_LABELS)).sum()) / area
    return {"touchesBorder": touches, "bodyInsideFraction": round(body_inside, 4), "occluderFraction": round(occluder, 4)}


def keep_large(mask: np.ndarray, min_fraction: float = 0.004, min_pixels: int = 24) -> np.ndarray:
    """Tira os cascalhos: componente menor que 0,4 % da peça (e que 24 px) não é peça — é franja do BiRefNet ou ruído do
    parser. É o mesmo critério de sustentação do preflight (inspect_source), que marcaria a extensão como incerta."""
    labelled, count = ndimage.label(mask)
    if count <= 1:
        return mask
    areas = np.bincount(labelled.ravel())
    areas[0] = 0
    return np.isin(labelled, np.flatnonzero(areas >= max(min_pixels, int(mask.sum() * min_fraction))))


def settle_extent(target: np.ndarray) -> np.ndarray:
    """Remove componentes isolados sem cortar extremidades finas ligadas ao tecido.

    A abertura 3×3 serve somente para encontrar o núcleo confiável da peça. Usar
    a própria abertura como máscara final (ou descartar tudo a mais de 3 px)
    encurta cós, barras e contornos de pernas. A reconstrução geodésica recupera
    pixels ORIGINAIS conectados ao núcleo; nunca cria tecido novo.
    """
    target = np.asarray(target, dtype=bool)
    support = keep_large(ndimage.binary_opening(target, structure=np.ones((3, 3), dtype=bool)))
    if not support.any():
        return keep_large(target)
    return keep_large(ndimage.binary_propagation(support, mask=target))


def fuse(labels: np.ndarray, alpha: np.ndarray, keep_ids: Optional[Iterable[int]], *, threshold: float = 0.5,
         person_min: float = 0.002, edge: Optional[int] = None) -> Fusion:
    """Peça = primeiro plano do BiRefNet ∩ rótulos da categoria no parser. Onde o parser (576×384) chamou de fundo mas o
    BiRefNet vê primeiro plano colado na peça, a borda fina do BiRefNet vence. Sem pessoa na foto (ou sem rótulos para a
    categoria) a peça é o primeiro plano inteiro — o flat-lay da FASHN."""
    labels = np.asarray(labels)
    alpha = np.asarray(alpha, dtype=np.float32)
    if labels.shape != alpha.shape:
        raise ValueError("FASHN_OPEN_SHAPE_MISMATCH")
    foreground = alpha >= threshold
    person = bool(np.isin(labels, list(PERSON_LABELS)).mean() >= person_min)
    if keep_ids is None or not person:
        foreground = settle_extent(foreground)
        soft = np.where(ndimage.binary_dilation(foreground, iterations=1), alpha, 0).astype(np.float32)
        mode = "birefnet-only" if keep_ids is None else "birefnet-flat-lay"
        return Fusion(foreground, None, soft, mode, person, evidence=evidence_of(foreground, None, labels if mode != "birefnet-only" else None))
    keep_ids = frozenset(keep_ids)
    keep = np.isin(labels, list(keep_ids))
    radius = edge or max(4, int(round(0.006 * max(labels.shape))))
    target = foreground & keep
    target |= foreground & (labels == 0) & ndimage.binary_dilation(keep, iterations=radius)
    target = settle_extent(target)
    forbidden = (foreground | np.isin(labels, list(HUMAN_LABELS))) & ~target
    soft = np.where(ndimage.binary_dilation(target, iterations=1), alpha, 0).astype(np.float32)
    kept = tuple(sorted(IDS_TO_LABELS[i] for i in keep_ids if (labels == i).any()))
    return Fusion(target, forbidden, soft, "parser+birefnet", True, kept, evidence_of(target, forbidden, labels))
