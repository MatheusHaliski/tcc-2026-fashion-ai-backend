"""O que pende do teto: lustre, luminária comprida e trilho de spots (a sala alinha o objeto pela caixa do móvel)."""
from __future__ import annotations

import math

from ..core import barra, caixa, cilindro, esfera, material, toro, torneado
from . import variantes


@variantes("lustre", "Lustre de latão de {raio} m de raio", {"60": {"raio": 0.6}, "75": {"raio": 0.75}}, movel="lustre")
def _lustre(raio: float) -> None:
    latao = material("latao", "#B08A3E", metal=1.0, aspereza=0.28, papel="latao", textura="escovado")
    luz = material("lampada", "#FFE2A8", emissao=6.0, papel="luz")
    cilindro("haste", latao, 0.02, 0.86, (0, 0, 0.6), lados=8)
    torneado("canopla", latao, [(0, 1.05), (0.1, 1.05), (0.1, 1.035), (0.035, 0.98), (0.02, 0.97)], lados=14)
    torneado("corpo", latao, [(0, -0.2), (0.03, -0.19), (0.05, -0.12), (0.03, -0.04), (0.085, 0.08), (0.09, 0.14),
                              (0.05, 0.2), (0.025, 0.24), (0.02, 0.3)], lados=14)
    toro("aro", latao, raio, 0.022, lados=28, lados_tubo=6)
    toro("aro-de-baixo", latao, raio * 0.5, 0.02, (0, 0, -0.26), lados=20, lados_tubo=6)
    for i in range(10):
        a = 2 * math.pi * i / 10
        x, y = raio * math.cos(a), raio * math.sin(a)
        barra("braco", latao, (0.05 * math.cos(a), 0.05 * math.sin(a), 0.12), (x, y, 0), 0.009, 5)
        cilindro("prato", latao, 0.04, 0.008, (x, y, 0.03), lados=8)
        cilindro("vela", latao, 0.012, 0.07, (x, y, 0.065), lados=6)
        esfera("chama", luz, 0.045, (x, y, 0.1), escala=(1, 1, 1.2), lados=8)
    for i in range(6):
        a = 2 * math.pi * i / 6 + 0.3
        x, y = raio * 0.5 * math.cos(a), raio * 0.5 * math.sin(a)
        esfera("gota", luz, 0.05, (x, y, -0.18), lados=8)
        barra("corrente", latao, (2 * x, 2 * y, 0), (x, y, -0.26), 0.005, 4)


@variantes("luminaria-de-teto", "Luminária de teto de {comprimento} m",
           {str(round(c * 10)): {"comprimento": c} for c in (2.2, 2.4, 2.6, 3.0)}, movel="luminariaDeTeto")
def _luminaria_de_teto(comprimento: float) -> None:
    corpo = material("corpo", "#22262B", metal=0.8, aspereza=0.4, papel="corpo")
    luz = material("difusor", "#FFF3D6", emissao=5.0, papel="luz")
    caixa("calha", corpo, (0.5, comprimento, 0.09), (0, 0, 0.075), chanfro=0.025)
    caixa("difusor", luz, (0.4, comprimento - 0.1, 0.016), (0, 0, 0.02))
    for y in (-comprimento / 2 + 0.012, comprimento / 2 - 0.012):
        caixa("tampa", corpo, (0.46, 0.024, 0.07), (0, y, 0.045), chanfro=0.006, seg=1)
    aletas = round(comprimento / 0.3)
    for i in range(1, aletas):                                           # aletas que quebram o brilho do difusor
        caixa("aleta", corpo, (0.41, 0.01, 0.028), (0, -comprimento / 2 + comprimento / aletas * i, 0.014))
    for y in (-comprimento / 3, comprimento / 3):
        cilindro("pendural", corpo, 0.012, 0.47, (0, y, 0.355), lados=6)
        cilindro("presilha", corpo, 0.03, 0.03, (0, y, 0.13), lados=8)
        torneado("canopla", corpo, [(0.012, 0.56), (0.05, 0.59), (0.05, 0.61), (0, 0.61)], pos=(0, y, 0), lados=10)


@variantes("trilho-spots", "Trilho de {spots} spots em treliça de {comprimento} m",
           {"6-5": {"comprimento": 6, "spots": 5}, "9-6": {"comprimento": 9, "spots": 6}}, movel="trilhoSpots")
def _trilho_spots(comprimento: float, spots: int) -> None:
    metal = material("trelica", "#2A2D33", metal=0.9, aspereza=0.45, papel="metal")
    luz = material("lente", "#FFF1CC", emissao=7.0, papel="luz")
    meia = comprimento / 2
    for x in (-0.12, 0.12):
        barra("banzo", metal, (x, -meia, 0), (x, meia, 0), 0.03, 8)
    passos = round(comprimento / 0.5)
    for i in range(passos):                                              # diagonais da treliça, em zigue-zague
        y0, y1 = -meia + comprimento / passos * i, -meia + comprimento / passos * (i + 1)
        lado = 1 if i % 2 == 0 else -1
        barra("diagonal", metal, (-0.12 * lado, y0, 0), (0.12 * lado, y1, 0), 0.01, 4)
    for i in range(spots):
        y = -meia + (comprimento / (spots - 1)) * i
        caixa("travessa", metal, (0.3, 0.04, 0.04), (0, y, 0))
        barra("garfo", metal, (0, y, -0.02), (0, y, -0.11), 0.012, 6)
        cilindro("canhao", metal, 0.09, 0.22, (0, y, -0.2), giro=(-25, 0, 0), lados=12, raio_topo=0.07, chanfro=0.008)
        toro("aro", metal, 0.088, 0.008, (0, y - 0.044, -0.295), giro=(-25, 0, 0), lados=12, lados_tubo=4)
        cilindro("lente", luz, 0.08, 0.02, (0, y - 0.05, -0.3), giro=(-25, 0, 0), lados=12)
