"""Objetos de set e palco: câmera de cinema no tripé, canhão de luz e poste de rua."""
from __future__ import annotations

import math

from ..core import barra, caixa, cilindro, esfera, material, toro, torneado
from . import receita


def _tripe(metal, topo: float, abertura: float, raio: float = 0.016) -> None:
    """Três pernas em duas seções (a de baixo mais fina), com sapata de borracha e a travessa de trava."""
    borracha = material("borracha", "#141416", aspereza=0.9)
    for i in range(3):
        a = math.radians(120 * i + 90)
        pe = (abertura * math.cos(a), abertura * math.sin(a), 0.02)
        meio = (pe[0] * 0.5, pe[1] * 0.5, topo * 0.52)
        barra("perna-baixo", metal, pe, meio, raio * 0.75)
        barra("perna-cima", metal, meio, (0.03 * math.cos(a), 0.03 * math.sin(a), topo), raio)
        esfera("sapata", borracha, raio * 1.6, pe, escala=(1, 1, 0.6), lados=8)
        barra("trava", metal, (0, 0, topo * 0.45), (meio[0] * 0.9, meio[1] * 0.9, topo * 0.47), raio * 0.45, 5)


@receita("camera-tripe", "Câmera de cinema no tripé", movel="cameraTripe")
def camera_tripe() -> None:
    preto = material("corpo", "#1C1C20", aspereza=0.5)
    metal = material("aluminio", "#8E9298", metal=1.0, aspereza=0.35)
    lente = material("lente", "#0B1A2E", metal=0.6, aspereza=0.05)
    vermelho = material("rec", "#E0202A", emissao=3.0)
    _tripe(metal, topo=1.14, abertura=0.42)
    cilindro("cabeca", metal, 0.07, 0.07, (0, 0, 1.18), lados=14, chanfro=0.008)
    caixa("prato", preto, (0.16, 0.26, 0.03), (0, 0, 1.235), chanfro=0.006)
    barra("manopla", metal, (0.07, 0.06, 1.2), (0.26, 0.42, 1.05), 0.012)
    cilindro("punho", preto, 0.02, 0.14, (0.275, 0.45, 1.038), giro=(-63, 0, 26), lados=8)
    caixa("corpo", preto, (0.24, 0.44, 0.25), (0, 0.02, 1.38), chanfro=0.02, seg=3)
    torneado("objetiva", preto, [(0.07, 0), (0.07, 0.1), (0.085, 0.11), (0.085, 0.2), (0.095, 0.22), (0.075, 0.22)],
             pos=(0, -0.2, 1.38), giro=(90, 0, 0), lados=20)
    cilindro("vidro", lente, 0.075, 0.01, (0, -0.415, 1.38), giro=(90, 0, 0), lados=20)
    caixa("parasol", preto, (0.26, 0.09, 0.2), (0, -0.46, 1.38), chanfro=0.008)
    caixa("parasol-vao", lente, (0.22, 0.01, 0.16), (0, -0.5, 1.38))
    for y in (-0.02, 0.18):
        cilindro("chassi", preto, 0.115, 0.06, (0, y, 1.6), giro=(0, 90, 0), lados=18, chanfro=0.008)   # os dois rolos de filme
    caixa("visor", preto, (0.07, 0.2, 0.07), (-0.15, 0.1, 1.44), chanfro=0.012)
    cilindro("ocular", preto, 0.03, 0.06, (-0.15, 0.23, 1.44), giro=(90, 0, 0), lados=10)
    barra("alca", metal, (0, -0.12, 1.5), (0, 0.16, 1.5), 0.011)
    esfera("luz-rec", vermelho, 0.012, (0.121, 0.2, 1.45), lados=8)


@receita("canhao-luz", "Canhão de luz no pedestal", movel="canhaoLuz")
def canhao_luz() -> None:
    preto = material("carcaca", "#202024", metal=0.4, aspereza=0.45)
    metal = material("aco", "#7C8087", metal=1.0, aspereza=0.4)
    luz = material("facho", "#FFF4D6", emissao=8.0)
    _tripe(metal, topo=0.92, abertura=0.36)
    cilindro("mastro", metal, 0.022, 0.62, (0, 0, 1.22), lados=10)
    for x in (-0.19, 0.19):
        caixa("garfo", metal, (0.02, 0.05, 0.3), (x, 0, 1.68), chanfro=0.006)
        cilindro("eixo", metal, 0.028, 0.03, (x * 1.06, 0, 1.78), giro=(0, 90, 0), lados=10)
    caixa("ponte-garfo", metal, (0.4, 0.05, 0.02), (0, 0, 1.53), chanfro=0.006)
    torneado("corpo", preto, [(0, 0), (0.13, 0), (0.15, 0.03), (0.15, 0.5), (0.17, 0.52), (0.17, 0.62), (0.155, 0.62)],
             pos=(0, 0.3, 1.66), giro=(110, 0, 0), lados=20)
    eixo = (0.0, -math.sin(math.radians(110)), math.cos(math.radians(110)))     # para onde o canhão aponta: frente, um pouco para baixo
    for i in range(5):
        t = 0.06 + i * 0.05
        toro("aleta", preto, 0.156, 0.008, (0, 0.3 + eixo[1] * t, 1.66 + eixo[2] * t), giro=(110, 0, 0), lados=20, lados_tubo=4)
    cilindro("lente", luz, 0.15, 0.012, (0, 0.3 + eixo[1] * 0.612, 1.66 + eixo[2] * 0.612), giro=(110, 0, 0), lados=20)
    caixa("alca-traseira", metal, (0.16, 0.02, 0.02), (0, 0.34, 1.66), chanfro=0.005)


@receita("poste", "Poste de rua com lanterna", movel="poste")
def poste() -> None:
    ferro = material("ferro", "#22262B", metal=0.8, aspereza=0.5)
    luz = material("lanterna", "#FFE7B0", emissao=7.0)
    torneado("base", ferro, [(0, 0), (0.17, 0), (0.17, 0.08), (0.12, 0.14), (0.12, 0.42), (0.09, 0.5), (0.075, 0.56), (0.065, 0.6), (0, 0.6)], lados=16)
    cilindro("fuste", ferro, 0.055, 3.0, (0, 0, 2.1), lados=12, raio_topo=0.04)
    for z in (0.62, 1.1, 3.55):
        toro("anel", ferro, 0.058 if z < 3 else 0.046, 0.014, (0, 0, z), lados=14, lados_tubo=6)
    pontos = [(0, 0, 3.6), (0, -0.1, 3.86), (0, -0.3, 4.0), (0, -0.55, 3.98), (0, -0.68, 3.86)]   # o braço em curva
    for de, ate in zip(pontos, pontos[1:]):
        barra("braco", ferro, de, ate, 0.022)
    barra("voluta", ferro, (0, 0, 3.3), (0, -0.3, 3.86), 0.012, 6)
    torneado("chapeu", ferro, [(0.2, 0), (0.12, 0.07), (0.05, 0.1), (0.02, 0.16), (0, 0.16)], pos=(0, -0.68, 3.78), lados=16)
    torneado("vidro", luz, [(0.07, -0.3), (0.16, 0), (0.15, 0), (0.065, -0.29)], pos=(0, -0.68, 3.78), lados=16)
    cilindro("fundo", ferro, 0.075, 0.02, (0, -0.68, 3.47), lados=16)
    for i in range(4):
        a = math.radians(90 * i + 45)
        barra("montante", ferro, (0.072 * math.cos(a), -0.68 + 0.072 * math.sin(a), 3.48),
              (0.16 * math.cos(a), -0.68 + 0.16 * math.sin(a), 3.78), 0.007, 4)
