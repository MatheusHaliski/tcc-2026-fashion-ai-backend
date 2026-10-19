"""Pixel-space evidence contracts. A projected anchor is not a measured 3-D landmark."""
from dataclasses import dataclass, field
from typing import Protocol
import numpy as np


class AlignmentError(ValueError):
    """Insufficient/invalid evidence or a rejected geometric result."""


@dataclass(frozen=True)
class Anchor:
    x: float
    y: float
    confidence: float = 1.0


@dataclass
class Observation:
    anchors: dict[str, Anchor]
    mask: np.ndarray
    provenance: str = "ANNOTATED_2D"
    # A detector may supply DensePose UV/SMPL-X projections, but must map them to
    # the same named anchors. UV alone does not identify collar/axilla seams.
    dense_uv: np.ndarray | None = None


class AnatomicalExtractor(Protocol):
    def garment(self, rgba: np.ndarray, family: str) -> Observation: ...
    def body(self, rgb: np.ndarray) -> Observation: ...


@dataclass(frozen=True)
class AnchorRule:
    name: str
    hard: bool = True
    weight: float = 1.0


@dataclass
class AnchorSet:
    source: np.ndarray
    target: np.ndarray
    hard: np.ndarray
    weights: np.ndarray
    names: list[str]
    garment_mask: np.ndarray
    body_mask: np.ndarray
    placket_source: np.ndarray | None = None
    placket_target: np.ndarray | None = None
    provenance: dict = field(default_factory=dict)


@dataclass
class WarpResult:
    rgba: np.ndarray
    diagnostics: dict
