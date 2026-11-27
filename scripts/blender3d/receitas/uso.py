"""Objetos dos lugares da fase de uso dos jogos de zonas: caixa d'água, antena, caixa de retorno e bandeira do clube."""
from __future__ import annotations

import math

from ..core import barra, caixa, cilindro, material, toro, torneado
from . import receita


@receita("caixa-d-agua", "Caixa d'água de terraço", movel="caixaDAgua", jogos=("SUPER_HEROI",))
def caixa_d_agua() -> None:
    aco = material("aco-torre", "#5E636E", metal=0.8, aspereza=0.5, papel="metal", textura="escovado")
    tanque = material("tanque", "#7C8794", metal=0.4, aspereza=0.55, papel="tanque")
    ferrugem = material("ferrugem", "#7A4A2E", aspereza=0.9)
    perfil = [(0, 1.5), (0.74, 1.5), (0.75, 1.52)]
    for z in (1.85, 2.2, 2.55):                                           # as cintas soldadas do tanque
        perfil += [(0.75, z - 0.02), (0.765, z), (0.75, z + 0.02)]
    perfil += [(0.75, 2.8), (0.6, 2.95), (0.12, 3.02), (0, 3.02)]
    torneado("tanque", tanque, perfil, lados=24)
    cilindro("tampa", aco, 0.16, 0.06, (0, 0, 3.04), lados=12, chanfro=0.01)
    caixa("plataforma", aco, (1.7, 1.7, 0.06), (0, 0, 1.47), chanfro=0.01)
    for x in (-1, 1):
        for y in (-1, 1):
            barra("pe", aco, (x * 0.7, y * 0.7, 0), (x * 0.62, y * 0.62, 1.45), 0.045, lados=8)
            barra("diagonal", aco, (x * 0.68, y * 0.68, 0.15), (x * 0.64, -y * 0.64, 1.3), 0.015, lados=6)
    for i in range(9):                                                   # a escada de marinheiro do lado da frente
        caixa("degrau", aco, (0.42, 0.03, 0.03), (0, -0.92, 0.25 + i * 0.3))
    for x in (-0.21, 0.21):
        caixa("banzo", aco, (0.035, 0.035, 2.95), (x, -0.92, 1.48))
    toro("guarda", aco, 0.3, 0.015, (0, -1.05, 2.4), giro=(90, 0, 0), lados=16, lados_tubo=5)
    caixa("mancha", ferrugem, (0.4, 0.005, 0.25), (0.3, -0.755, 1.62), giro=(0, 0, 8))


@receita("antena", "Antena de telhado estaiada", movel="antena", jogos=("SUPER_HEROI",))
def antena() -> None:
    aco = material("aco-antena", "#9AA0A6", metal=1.0, aspereza=0.35, papel="metal")
    cabo = material("cabo", "#2A2C30", aspereza=0.7)
    cilindro("mastro", aco, 0.035, 3.2, (0, 0, 1.6), lados=8)
    caixa("base", aco, (0.4, 0.4, 0.06), (0, 0, 0.03), chanfro=0.01)
    for i, largura in enumerate((1.1, 0.85, 0.6)):
        z = 2.3 + i * 0.35
        barra("travessa", aco, (-largura / 2, 0, z), (largura / 2, 0, z), 0.015, lados=6)
        for k in range(-2, 3):
            x = k * largura * 0.2
            barra("haste", aco, (x, -0.2, z), (x, 0.2, z), 0.009, lados=5)
    for a in (0, 120, 240):                                               # os três estais presos no piso
        r = math.radians(a)
        barra("estai", cabo, (0, 0, 2.0), (math.cos(r) * 0.9, math.sin(r) * 0.9, 0.02), 0.006, lados=4)
    cilindro("caixa-de-ligacao", cabo, 0.06, 0.12, (0, 0.06, 1.2), lados=8)


@receita("caixa-de-retorno", "Caixa de retorno de palco", movel="caixaDeRetorno", jogos=("FAVORITE_SINGER",))
def caixa_de_retorno() -> None:
    corpo = material("corpo-retorno", "#1A141F", aspereza=0.75, papel="caixa")
    tela = material("tela-retorno", "#2A2C30", metal=0.3, aspereza=0.6, papel="tela", textura="tecido")
    metal = material("cantoneira", "#8E939C", metal=1.0, aspereza=0.4)
    caixa("base", corpo, (0.8, 0.5, 0.12), (0, 0, 0.06), chanfro=0.012)
    caixa("cunha", corpo, (0.8, 0.42, 0.3), (0, -0.03, 0.2), giro=(-35, 0, 0), chanfro=0.015)
    caixa("tela", tela, (0.7, 0.02, 0.26), (0, -0.2, 0.24), giro=(-35, 0, 0), chanfro=0.004)
    for x in (-0.18, 0.18):
        cilindro("cone", metal, 0.09, 0.01, (x, -0.215, 0.245), giro=(55, 0, 0), lados=16)
    for x in (-1, 1):
        caixa("cantoneira", metal, (0.03, 0.03, 0.12), (x * 0.39, 0.24, 0.06))
    caixa("alca", metal, (0.24, 0.03, 0.02), (0, 0.255, 0.14), chanfro=0.006)


@receita("bandeira-do-clube", "Bandeira do clube no mastro", movel="bandeiraDoClube", jogos=("CLUBE_CORACAO",))
def bandeira_do_clube() -> None:
    mastro = material("mastro", "#F2F2F2", metal=0.6, aspereza=0.35, papel="mastro")
    pano = material("pano", "#1E5AA8", aspereza=0.8, papel="pano", textura="tecido")
    faixa = material("faixa", "#F5F5F2", aspereza=0.8, papel="faixa", textura="tecido")
    cilindro("mastro", mastro, 0.03, 3.6, (0, 0, 1.8), lados=10)
    cilindro("pe", mastro, 0.12, 0.08, (0, 0, 0.04), lados=12, chanfro=0.01)
    toro("pomo", mastro, 0.035, 0.015, (0, 0, 3.62), lados=10, lados_tubo=5)
    for i in range(6):                                                    # o pano ondulado em gomos
        x = 0.06 + i * 0.22
        y = math.sin(i * 1.1) * 0.05
        giro = math.degrees(math.cos(i * 1.1) * 0.25)
        caixa("pano", pano, (0.23, 0.01, 0.42), (x + 0.11, y, 3.27), giro=(0, 0, giro))
        caixa("faixa", faixa, (0.23, 0.01, 0.42), (x + 0.11, y, 2.85), giro=(0, 0, giro))
