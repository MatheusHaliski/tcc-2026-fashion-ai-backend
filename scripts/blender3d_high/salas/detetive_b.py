"""Salas 4, 2 e 5 do caso "A Coleção Maré": Camarim, Clube underground e Ateliê (pontos de DetetiveSalas.java)."""
from __future__ import annotations

from ..formas import instancia, jogo
from . import Importado, sala
from .detetive_a import ARANDELAS_FUNDO, ARANDELAS_LADOS, CAMERA, CASCA, JOGO, portas
from .kit_atelie import chapeleiras, kit_de_costura, manequim, mesa_de_corte, penteadeira, rolos_de_tecido
from .kit_casca import Estilo, arandelas, casca, luz_de_prova
from .kit_clube import bar, globo, neon, painel_acustico, pista_de_led
from .kit_moveis import arara, caixotes
from .kit_pecas import armario, em_ponto


@sala(slug="detetive-camarim", titulo="Camarim (high poly)", familia="detetive", camera=CAMERA, assar=CASCA,
      importados=(Importado("loungeScreen", (2.7, 0, -3.25), 0, 1.75), Importado("loungeArmchair", (-2.6, 0, -2.95), 20, 0.95),
                  Importado("vestFloral", (-4.15, 0, -3.15), 0, 1.7)),
      jogos=JOGO)
def camarim() -> None:
    casca(Estilo("#D9BC94", "madeira", "#F6D5E0", "#C6275E", "#FBE6EE", repete_piso=0.6))
    arandelas("#FFE0EC", ARANDELAS_FUNDO + ARANDELAS_LADOS)
    em_ponto(arara(("#C6275E", "#1C1C22", "#E8DCC8", "#3A5BA0")), -3, 1.5)
    em_ponto(penteadeira(), 3, 1.5)
    em_ponto(kit_de_costura(), 3, -1.2)
    portas("#C6275E", "#FBE6EE", [(0, 2.4), (-3, -1.5)])
    luz_de_prova((1, 0.9, 0.92))


@sala(slug="detetive-clube", titulo="Clube underground (high poly)", familia="detetive", camera=CAMERA, assar=CASCA,
      importados=(Importado("djBooth", (3.95, 0, 1.5), -90, 1.15), Importado("djSpeaker", (4.3, 0, 0.15), -90, 2.0),
                  Importado("djSpeaker", (4.3, 0, 2.85), -90, 2.0), Importado("loungeStool", (-3.25, 0, 0.55), 0, 0.78),
                  Importado("loungeStool", (-3.25, 0, 2.45), 0, 0.78), Importado("terracoTotem", (-4.2, 0, -3.2), 0, 2.0),
                  Importado("terracoTotem", (4.2, 0, -3.2), 0, 2.0)),
      jogos=JOGO)
def clube() -> None:
    casca(Estilo("#1B1C22", "concreto", "#2A2230", "#E040A0", "#1A1620", repete_piso=0.5), painel_alto=False)
    painel_acustico("#3A1A40", [(x, 2.2, -3.62, 0) for x in (-3.0, -1.8, 1.8, 3.0)] + [(-4.72, 2.2, z, 90) for z in (-2.6, -0.2)]
                    + [(4.72, 2.2, -2.6, -90)])
    neon([(-4.0, 3.0, -3.6), (-1.2, 3.0, -3.6)], "#E040A0", "neon-fundo-1")
    neon([(1.2, 3.0, -3.6), (4.0, 3.0, -3.6)], "#30C8E0", "neon-fundo-2")
    neon([(-4.7, 2.95, -3.4), (-4.7, 2.95, 3.4)], "#E040A0", "neon-esq")
    neon([(4.7, 2.95, -3.4), (4.7, 2.95, 3.4)], "#30C8E0", "neon-dir")
    pista_de_led()
    globo((0, 2.9, -1.4))
    em_ponto(bar(), -3, 1.5, giro_extra=0)
    em_ponto(caixotes(), -3, -1.5)
    em_ponto(armario("#A02028", "#C9CCD2", alt=1.4, larg=1.0, prefixo="armario-ferramentas"), 3, -1.5)
    portas("#1A1620", "#E040A0", [(0, -2.4)])
    luz_de_prova((1, 0.7, 0.95))


@sala(slug="detetive-atelie", titulo="Ateliê (high poly)", familia="detetive", camera=CAMERA, assar=CASCA,
      jogos=JOGO)
def atelie() -> None:
    casca(Estilo("#B98F62", "madeira", "#D9D6D0", "#1F7A76", "#EDEBE6", repete_piso=0.6))
    arandelas("#FFF4E0", ARANDELAS_LADOS)
    em_ponto(mesa_de_corte(), -3, -1)
    em_ponto(chapeleiras(), 3, -1)
    corpo = manequim()
    for x, z, g in ((-3.6, -3.0, 20), (0.0, -3.15, 0), (3.6, -3.0, -20)):
        for peca in corpo:
            instancia(peca, jogo(x, 0, z), g)
    for peca in rolos_de_tecido():
        instancia(peca, jogo(-2.6, 0, -3.2), 0)
    portas("#3A5A58", "#EDEBE6", [(-3, 2), (3, 2), (-1.5, -2.5), (1.5, -2.5)])
    luz_de_prova()
