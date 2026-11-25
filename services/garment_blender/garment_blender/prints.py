"""Pintura da peça na ficha: desenhos colados (logo, estampa localizada), listras e estampa corrida.

Nada disto muda a forma da peça: a malha é a mesma da base; o desenho vira decalque (``decals.py``) e a padronagem
vira a textura de cor do tecido (``fabric.py``).
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
SIDES = ("frente",)
DIRECTIONS = ("horizontal", "vertical")


@dataclass(frozen=True)
class Decal:
    """Desenho colado no tronco. Medidas em metros, na peça pronta."""
    imagem: str              # PNG com alfa (caminho resolvido no ``parse``)
    x: float                 # centro, a partir do centro da frente, ao longo do pano (+: lado esquerdo de quem veste)
    abaixo_do_ombro: float   # centro, abaixo do ponto alto do ombro (HPS)
    largura: float           # a altura sai da proporção da imagem
    lado: str = "frente"


@dataclass(frozen=True)
class Stripes:
    direcao: str             # horizontal: listras em volta do corpo; vertical: de cima a baixo
    fundo: str
    listra: str
    periodo: float           # m (uma listra + um fundo)
    fracao: float            # parte do período com a cor da listra


@dataclass(frozen=True)
class AllOver:
    imagem: str              # pedaço da estampa que repete sem emenda (RGB)
    lado: float              # quantos metros de pano o pedaço cobre


def _image(value, base_dir: Path | None) -> str:
    p = Path(str(value))
    p = p if p.is_absolute() or base_dir is None else base_dir / p
    if not p.is_file():
        raise ValueError(f"imagem da estampa não encontrada: {value}")
    return str(p)


def parse_prints(raw: dict, base_dir: Path | None) -> dict:
    """Campos de pintura da ficha (``estampas``, ``listras``, ``estampa_corrida``) validados; vazio sem eles."""
    out = {}
    decals = []
    for d in raw.get("estampas") or []:
        unknown = set(d) - {"imagem", "x", "abaixo_do_ombro", "largura", "altura", "lado"}
        if unknown:
            raise ValueError(f"campos desconhecidos na estampa: {', '.join(sorted(unknown))}")
        decal = Decal(_image(d["imagem"], base_dir), float(d["x"]), float(d["abaixo_do_ombro"]), float(d["largura"]),
                      str(d.get("lado", "frente")))
        if decal.lado not in SIDES or not 0.005 <= decal.largura <= 0.6 or not 0 < decal.abaixo_do_ombro < 1.2:
            raise ValueError(f"estampa fora do lugar: {d}")
        decals.append(decal)
    if decals:
        out["estampas"] = tuple(decals)
    if raw.get("listras"):
        s = raw["listras"]
        stripes = Stripes(str(s["direcao"]), str(s["fundo"]).lower(), str(s["listra"]).lower(), float(s["periodo"]),
                          float(s["fracao"]))
        if stripes.direcao not in DIRECTIONS or not (HEX.match(stripes.fundo) and HEX.match(stripes.listra)) or \
                not 0.003 <= stripes.periodo <= 0.4 or not 0.05 <= stripes.fracao <= 0.95:
            raise ValueError(f"listras inválidas: {s}")
        out["listras"] = stripes
    if raw.get("estampa_corrida"):
        a = raw["estampa_corrida"]
        out["estampa_corrida"] = AllOver(_image(a["imagem"], base_dir), float(a["lado"]))
        if not 0.02 <= out["estampa_corrida"].lado <= 1.0:
            raise ValueError("estampa_corrida.lado fora de 2 cm–1 m")
    if "listras" in out and "estampa_corrida" in out:
        raise ValueError("listras e estampa corrida ao mesmo tempo")
    return out
