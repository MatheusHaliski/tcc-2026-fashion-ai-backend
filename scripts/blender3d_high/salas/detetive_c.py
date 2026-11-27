"""Salas 6, 8 e 9 do caso "A Coleção Maré": Arquivo, Escritório da direção e Passarela (pontos de DetetiveSalas.java)."""
from __future__ import annotations

from ..formas import instancia, jogo
from . import Importado, sala
from .detetive_a import ARANDELAS_FUNDO, ARANDELAS_LADOS, CAMERA, CASCA, JOGO, portas
from .kit_casca import Estilo, arandelas, casca, luz_de_prova
from .kit_escritorio import cofre, janela, mapoteca, mesa_de_vidro, trofeus
from .kit_moveis import estante
from .kit_palco import arco, passarela, poltrona, refletor, telao, trelica
from .kit_pecas import em_ponto


@sala(slug="detetive-arquivo", titulo="Arquivo (high poly)", familia="detetive", camera=CAMERA, assar=CASCA, jogos=JOGO)
def arquivo() -> None:
    casca(Estilo("#6B5A48", "madeira", "#8A8072", "#4A3A2A", "#5A4A3A", repete_piso=0.6), painel_alto=False)
    arandelas("#FFE6B8", ARANDELAS_LADOS)
    corpo = estante("#4A3A2A")
    em_ponto(corpo, -3, 1)
    em_ponto(corpo, 3, 1)
    for x in (-2.6, -0.8, 0.8, 2.6):
        for peca in corpo:
            instancia(peca, jogo(x, 0, -3.42), 0)
    em_ponto(cofre(), -3, -1.5)
    em_ponto(mapoteca(), 3, -1.5)
    luz_de_prova((1, 0.92, 0.8))


@sala(slug="detetive-escritorio", titulo="Escritório da direção (high poly)", familia="detetive", camera=CAMERA, assar=CASCA,
      importados=(Importado("loungeArmchair", (-4.05, 0, 0.85), 90, 0.95), Importado("loungeArmchair", (-4.05, 0, 2.15), 90, 0.95),
                  Importado("loungeCoffee", (-3.45, 0, 1.5), 0, 0.45), Importado("serviceBuffet", (2.3, 0, -3.3), 0, 0.95),
                  Importado("monumentalVase", (-4.2, 0, -3.15), 0, 1.6)),
      jogos=JOGO)
def escritorio() -> None:
    casca(Estilo("#2C2A28", "madeira", "#E3E1DC", "#1B2440", "#F0EEEA", repete_piso=0.6))
    arandelas("#FFF0D8", ARANDELAS_FUNDO)
    em_ponto(mesa_de_vidro(), 3, -1)
    em_ponto(trofeus(), -3, -1)
    janela(4.73, 1.5, -90, "#1B2440")
    luz_de_prova()


@sala(slug="detetive-passarela", titulo="Passarela da revelação (high poly)", familia="detetive", camera=CAMERA, assar=("piso",),
      importados=(Importado("monumentalVase", (-3.9, 0, -3.2), 0, 1.6), Importado("monumentalVase", (3.9, 0, -3.2), 0, 1.6)),
      jogos=JOGO)
def passarela_final() -> None:
    casca(Estilo("#121216", "concreto", "#1A1A22", "#F2F0EA", "#101014", repete_piso=0.4), painel_alto=False)
    for peca in passarela(1.8, 5.6, 0.04, "#F2F0EA", "#FF4FA3"):
        instancia(peca, jogo(0, 0, -0.4), 0)
    for peca in arco(2.6, 2.9, "#2A1033"):
        instancia(peca, jogo(0, 0, -3.3), 0)
    for peca in telao(2.5, 1.5):
        for x in (-3.2, 3.2):
            instancia(peca, jogo(x, 0.9, -3.5), 0)
    assento = poltrona("#3A1730")
    for lado in (-1, 1):
        for fila, x in enumerate((1.6, 2.35, 3.1)):
            for k in range(6):
                z = -2.2 + k * 0.8 + (0.4 if fila % 2 else 0)
                for peca in assento:
                    instancia(peca, jogo(lado * x, 0, z), -lado * 90)
    viga = trelica(5.6)
    spot = refletor()
    for x in (-1.3, 1.3):
        instancia(viga, jogo(x, 3.15, -0.4), 90)
        for k in range(4):
            for peca in spot:
                instancia(peca, jogo(x, 2.98, -2.4 + k * 1.35), 90 if x < 0 else -90)
    luz_de_prova((1, 0.85, 0.95))
