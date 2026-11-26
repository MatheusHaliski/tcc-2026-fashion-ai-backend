"""Segmentador de pessoas e roupas (fashn-ai/fashn-human-parser, SegFormer, 18 classes), na CPU.

Carregado uma vez por processo (8–9 s); cada foto leva ~2 s com 4 núcleos. A foto entra reduzida (lado maior 1024
px): os rótulos voltam nesse tamanho, e a análise amplia o recorte do desenho na foto original.
"""
from __future__ import annotations

import numpy as np
from PIL import Image

SIDE = 1024


class Segmentador:
    def __init__(self, threads: int | None = None):
        import torch
        from fashn_human_parser import FashnHumanParser
        if threads:
            torch.set_num_threads(threads)
        self.parser = FashnHumanParser(device="cpu")

    def labels(self, image: Image.Image) -> np.ndarray:
        """Mapa de rótulos (altura × largura da foto reduzida)."""
        small = image.convert("RGB")
        if max(small.size) > SIDE:
            small = small.copy()
            small.thumbnail((SIDE, SIDE), Image.Resampling.LANCZOS)
        return np.asarray(self.parser.predict(small)).astype(np.uint8)
