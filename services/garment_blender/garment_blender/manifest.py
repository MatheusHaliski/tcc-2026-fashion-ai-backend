"""Manifesto de encaixe (``<modelo>.fit.json``) do .glb gerado, no formato de ``lib/avatar3d/meshy/manifest.ts``.

A peça já sai no espaço canônico do provador (Y para cima, frente +Z, giro 0) e em metros. ``medidaReal`` e
``tamanhoGerado`` dizem ao provador que este .glb é a peça daquele tamanho em escala real (um .glb por tamanho).
"""
from __future__ import annotations

import numpy as np

from .geometry import Mesh
from .spec import GarmentSpec


def fit_manifest(spec: GarmentSpec, mesh: Mesh) -> dict:
    v = np.array(mesh.verts)
    lo, hi = v.min(0), v.max(0)
    lower = spec.calca
    return {
        "versao": 1, "categoria": "lower_piece" if lower else "upper_piece", "subcategoria": spec.subcategoria,
        "slot": "lower" if lower else "upper", "attach": "wrap", "osso": "Hips" if lower else "Spine2", "giroY": 0, "centro": [round(float(c), 5) for c in (lo + hi) / 2],
        "caixa": [round(float(c), 5) for c in hi - lo], "escalaNominal": 0,
        "dicas": {"par": False, "corteX": 0, "abertura": 0, "bracosAbertos": not lower and spec.angulo_manga < 30, "aberto": False, "sola": 0},
        "tamanhos": {"grade": "numeric" if lower else "letter", "porPasso": {"largura": 0.04, "comprimento": 0.02, "manga": 0.015},
                     "limite": [-3, 4], "convencao": "RELATIVE_VISUAL_APPROXIMATION", "alegacaoDeCaimento": "NONE",
                     "medidasDoAvatarAlteradas": False},
        "estado": "veste", "medidaReal": True, "tamanhoGerado": spec.tamanho,
        **({} if lower else {"pontoAlto": round(spec.medidas.comprimento * 0.01, 4)}),   # a barra está em y = 0
        "motivo": f"FAI Garment Blender: {spec.subcategoria} {spec.tamanho}, {spec.tecido.tipo}",
    }
