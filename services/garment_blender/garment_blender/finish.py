"""Acabamento de cada tecido no Principled BSDF: rugosidade, reflexo especular, brilho de pelo (sheen), verniz e anisotropia.

Uma tabela só, lida por ``blender_io``: o exportador glTF do Blender 4.2 grava esses valores como
KHR_materials_specular, KHR_materials_sheen, KHR_materials_clearcoat e KHR_materials_anisotropy, então o provador
(three.js, MeshPhysicalMaterial) recebe o mesmo acabamento da prévia.

``specular`` é o Specular IOR Level do Blender (0,5 = F0 de 4 %, o de um plástico): pano de fibra espalha a luz, e o
reflexo cinza de 4 % clareava e acinzentava os escuros (o preto saía grafite). ``sheen`` é a força do brilho rasante
dos pelos, tingido pela cor do tecido (Sheen Tint = sheen × cor). Os números foram acertados contra o teste de
calibração (``calibracao.py``): amostras lisas de preto a branco renderizadas a até 4 de L da ficha.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Finish:
    roughness: float
    specular: float = 0.05        # Specular IOR Level
    sheen: float = 0.0            # Sheen Tint = sheen × cor do tecido (Sheen Weight 1)
    sheen_roughness: float = 0.5
    coat: float = 0.0             # verniz (Coat Weight)
    coat_roughness: float = 0.3
    anisotropic: float = 0.0


FINISH = {
    "jersey": Finish(0.85, sheen=0.25),
    "malha_algodao": Finish(0.88, sheen=0.25),
    "moletom": Finish(0.92, sheen=0.3, sheen_roughness=0.6),
    "malha_la": Finish(0.92, sheen=0.35, sheen_roughness=0.6),
    "sarja": Finish(0.78),
    "denim": Finish(0.82),
    "tricoline": Finish(0.7),
    "la_plana": Finish(0.85, sheen=0.12, sheen_roughness=0.6),
    "couro": Finish(0.45, specular=0.35, coat=0.12, coat_roughness=0.35),
    "camurca": Finish(0.95, specular=0.04, sheen=0.5, sheen_roughness=0.45),
    "nylon": Finish(0.5, specular=0.3),
    "acolchoado": Finish(0.45, specular=0.32),
    "veludo": Finish(0.8, specular=0.04, sheen=0.8, sheen_roughness=0.3),
    "cetim": Finish(0.3, specular=0.4, anisotropic=0.5),
}
TRIM = Finish(0.7, specular=0.1)     # cadarço do zíper
METAL = Finish(0.35, specular=0.5)   # dentes do zíper (com Metallic)
PLASTIC = Finish(0.35, specular=0.5) # botão


def finish(kind: str) -> Finish:
    return FINISH[kind]
