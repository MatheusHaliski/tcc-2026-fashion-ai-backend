"""Sala 1 dos jogos FLAIR 3D, A Passarela (lib/flair/nucleos/scene/salas/passarela.ts), em alta densidade.

Mesma planta da sala procedural, porque a jogabilidade depende dela: salão de 10 m (x de -5 a 5), do fundo z = -9 à
frente z = 7, pé-direito 5 m; passarela de 1,6 m × 0,3 m de z = -8 a 2,6; a fileira da plateia em x = ±2 (onde os
personagens sentam) e mais duas fileiras em arquibancada atrás dela, fora da zona dos personagens; arco do backstage em
z = -8,45; telão de LED de 5 × 2,6 m em z = -8,8 (o placar do jogo fica na frente dele); treliças de luz em x = ±1,3 a
4,7 m; grades do fosso dos fotógrafos em z = 2,4 e, no fosso, as câmeras nos tripés.
"""
from __future__ import annotations

import bpy

from scripts.blender3d.core import caixa

from ..formas import cortina, esconder_modelo, instancia, jogo, juntar
from ..materiais import material
from ..render import luz_area, luz_foco
from . import Importado, sala
from .kit_gala import pedestais
from .kit_palco import arco, passarela, poltrona, refletor, telao, trelica

CADEIRAS_Z = [-6.2, -5.45, -4.7, -3.95, -3.2, -2.45, -1.7, -0.95, -0.2, 0.55, 1.3]
#: as fileiras: x, altura do degrau
FILEIRAS = ((2.0, 0.0), (3.1, 0.25), (3.95, 0.5))


def _casca() -> None:
    resina = material("piso-resina", "#16141C", "concreto", aspereza=0.22, verniz=0.7, repete=0.25)
    parede = material("parede-acustica", "#1A0E18", "veludo", aspereza=0.8, fibra=0.5, repete=1)
    teto = material("teto", "#0E0C12", "concreto", aspereza=0.95, repete=0.3)
    cortinado = material("cortinado", "#3A1730", "veludo", aspereza=0.75, fibra=1.0, repete=1.5)
    caixa("piso", resina, (10.0, 16.0, 0.04), pos=jogo(0, -0.02, -1.0))
    caixa("parede-fundo", parede, (10.0, 0.12, 5.0), pos=jogo(0, 2.5, -9.06))
    for s in (-1, 1):
        caixa(f"parede-{'esq' if s < 0 else 'dir'}", parede, (0.12, 16.0, 5.0), pos=jogo(s * 5.06, 2.5, -1.0))
        # cortinado pesado nas laterais, preso no alto (quatro panos de cada lado)
        pano = cortina(f"cortinado-{s}", cortinado, 3.9, 4.6, pregas=16, fundo=0.11, giro=(0, 0, 90), linhas=24)
        esconder_modelo(pano)
        pano["heroi"] = True
        for z in (-7.0, -3.0, 1.0, 5.0):
            instancia(pano, jogo(s * 4.86, 0.25, z))
    caixa("teto", teto, (10.0, 16.0, 0.08), pos=jogo(0, 5.04, -1.0))


def _arquibancada(veludo: str) -> None:
    madeira = material("degrau", "#1C1A20", "madeira", aspereza=0.5, verniz=0.4, repete=1)
    for s in (-1, 1):
        for x, h in FILEIRAS[1:]:
            caixa(f"degrau-{s}-{x}", madeira, (0.85, 8.4, h), pos=jogo(s * x, h / 2, -2.45), chanfro=0.015, seg=3)
    assento = poltrona(veludo)
    for s in (-1, 1):
        for x, h in FILEIRAS:
            for z in CADEIRAS_Z:
                for peca in assento:
                    instancia(peca, jogo(s * x, h, z), -s * 90)


def _luz_de_palco() -> None:
    viga = trelica(9.6)
    travessa = trelica(3.2)
    spot = refletor()
    for x in (-1.3, 1.3):
        instancia(viga, jogo(x, 4.7, -2.5), 90)
        for k in range(6):
            for peca in spot:
                instancia(peca, jogo(x, 4.52, -6.6 + k * 1.6), 90 if x < 0 else -90)
    for z in (-7.3, 2.3):
        instancia(travessa, jogo(0, 4.7, z), 0)
        for xs in (-0.7, 0.7):
            for peca in spot:
                instancia(peca, jogo(xs, 4.52, z), 0 if z > 0 else 180)


def _fosso() -> None:
    """Fosso dos fotógrafos: o tablado baixo e as câmeras de cinema nos tripés (a receita do motor, fundida)."""
    from scripts.blender3d.receitas.palco import camera_tripe

    madeira = material("fosso", "#1C1A20", "madeira", aspereza=0.5, verniz=0.3, repete=1)
    caixa("fosso-tablado", madeira, (4.2, 1.2, 0.12), pos=jogo(0, 0.06, 3.6), chanfro=0.015, seg=3)
    antes = set(bpy.data.objects)
    camera_tripe()
    camera = juntar([o for o in bpy.data.objects if o not in antes], "camera-tripe")
    esconder_modelo(camera)
    for x in (-1.5, -0.5, 0.5, 1.5):
        instancia(camera, jogo(x, 0.12, 3.7), 180 + x * 6)
    pedestais(2.6, 4.4, 3, -2.3)
    pedestais(2.6, 4.4, 3, 2.3)


@sala(slug="passarela", titulo="A Passarela (high poly)", familia="passarela",
      camera=((3.4, 2.6, 6.2), (0.0, 1.0, -4.0)), ambiente=(0.0, 1.7, -2.0), assar=("piso",),
      importados=(Importado("monumentalVase", (-2.25, 0, -8.25), 0, 1.7), Importado("monumentalVase", (2.25, 0, -8.25), 0, 1.7),
                  Importado("loungeArmchair", (-4.3, 0, 3.6), 120, 0.95), Importado("loungeArmchair", (4.3, 0, 3.6), -120, 0.95)),
      jogos=("PASSARELA",))
def passarela_jogo() -> None:
    _casca()
    for peca in passarela(1.6, 10.6, 0.3, "#F4F1EC", "#FF4FA3"):
        instancia(peca, jogo(0, 0, -2.7), 0)
    for peca in arco(2.6, 3.0, "#3A1730", luz_cor="#FF4FA3"):
        instancia(peca, jogo(0, 0, -8.45), 0)
    for peca in telao(5.0, 2.6):
        instancia(peca, jogo(0, 0.5, -8.86), 0)
    _arquibancada("#3A1730")
    _luz_de_palco()
    _fosso()
    luz_foco("palco-1", (0, 4.5, -0.5), (0, 0.3, -2.5), 2500, 50)
    luz_foco("palco-2", (0, 4.5, -6.0), (0, 0.3, -6.0), 1500, 45, (1, 0.6, 0.85))
    luz_area("plateia", (0, 4.8, -2.0), (0, 0, -2.0), 900, 6, (0.9, 0.8, 1))
    luz_area("frente", (0, 3.0, 7.0), (0, 1, 0), 500, 4)
