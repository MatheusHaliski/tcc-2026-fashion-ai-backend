"""Manifesto de encaixe (``<modelo>.fit.json``) do .glb gerado, no formato de ``lib/avatar3d/meshy/manifest.ts``.

A peça já sai no espaço canônico do provador (Y para cima, frente +Z, giro 0) e em metros. ``medidaReal`` e
``tamanhoGerado`` dizem ao provador que este .glb é a peça daquele tamanho em escala real (um .glb por tamanho).
"""
from __future__ import annotations

import numpy as np

from .bodysuit import BRIEF
from .geometry import Mesh
from .spec import GarmentSpec

# Manga curta: o antebraço nu passa à frente do quadril e a pele do colo fica acima da gola; a métrica de furos do
# provador conta essa pele como "à frente do pano do tronco". Aceite um pouco mais largo só aqui (a camisa da Meshy usa
# 4,5 %, lib/avatar3d/meshy/slots.ts), conferido na tela (docs/provador/garment-blender/).
SHORT_SLEEVE_PIERCED = 0.04
TIGHT_PIERCED = 0.05   # peça colada (top, body): o busto encosta no pano; conferido na tela


def _short_edge(spec: GarmentSpec) -> bool:
    """Manga curta ou perna de short/bermuda: a pele nua logo abaixo da barra conta como "furo" no provador (a coxa à
    frente da barra do short, como o antebraço na camiseta). Conferido na tela (docs/provador/garment-blender/)."""
    if spec.calca:
        return 0 < spec.medidas_calca.entreperna < 35
    return spec.manga_curta


def pierced_allowance(spec: GarmentSpec) -> float | None:
    """Aceite de furos da peça: a da barra curta (manga curta, short) e a da peça colada, em que o busto encosta no
    pano. Decote V, cava e frente aberta não precisam: o provador já não conta a pele vista pela abertura como furo
    (glb-garment/cover.ts, uma camada só). None: vale o aceite padrão."""
    if _short_edge(spec):
        return SHORT_SLEEVE_PIERCED
    if spec.caimento == "justo":
        return TIGHT_PIERCED
    return None


def fit_manifest(spec: GarmentSpec, mesh: Mesh) -> dict:
    v = np.array(mesh.verts)
    lo, hi = v.min(0), v.max(0)
    lower = spec.calca
    return {
        "versao": 1, "categoria": "lower_piece" if lower else "upper_piece", "subcategoria": spec.subcategoria,
        "slot": "lower" if lower else "upper", "attach": "wrap", "osso": "Hips" if lower else "Spine2", "giroY": 0, "centro": [round(float(c), 5) for c in (lo + hi) / 2],
        "caixa": [round(float(c), 5) for c in hi - lo], "escalaNominal": 0,
        "dicas": {"par": False, "corteX": 0, "abertura": 0, "bracosAbertos": not lower and spec.angulo_manga < 30, "aberto": False, "sola": 0, **({"aceite": {"furada": pierced_allowance(spec)}} if pierced_allowance(spec) else {})},
        "tamanhos": {"grade": "numeric" if lower else "letter", "porPasso": {"largura": 0.04, "comprimento": 0.02, "manga": 0.015},
                     "limite": [-3, 4], "convencao": "RELATIVE_VISUAL_APPROXIMATION", "alegacaoDeCaimento": "NONE",
                     "medidasDoAvatarAlteradas": False},
        "estado": "veste", "medidaReal": True, "tamanhoGerado": spec.tamanho,
        # a barra está em y = 0; no body ela sobe a altura da calcinha
        **({} if lower else {"pontoAlto": round(spec.medidas.comprimento * 0.01 + (BRIEF if spec.subcategoria == "bodysuit" else 0), 4)}),
        "motivo": f"FAI Garment Blender: {spec.subcategoria} {spec.tamanho}, {spec.tecido.tipo}",
    }
