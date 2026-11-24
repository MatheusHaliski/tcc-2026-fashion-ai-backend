"""Mobília dos cenários: cadeiras, penteadeira e luminária."""
from __future__ import annotations

import math

from ..core import barra, caixa, cilindro, duplicar, esfera, material, toro, torneado
from . import receita


@receita("cadeira", "Cadeira da plateia", movel="cadeira")
def cadeira() -> None:
    madeira = material("madeira", "#3B2A20", aspereza=0.45)
    estofado = material("estofado", "#7A1F2B", aspereza=0.85)
    for x in (-0.19, 0.19):
        barra("pe-frente", madeira, (x, -0.17, 0), (x * 0.95, -0.16, 0.43), 0.018)
        barra("pe-tras", madeira, (x, 0.19, 0), (x * 0.92, 0.23, 0.92), 0.018)        # o pé de trás sobe e vira o encosto
        barra("travessa-lado", madeira, (x, -0.165, 0.2), (x, 0.2, 0.2), 0.011, 6)
    barra("travessa-frente", madeira, (-0.19, -0.165, 0.26), (0.19, -0.165, 0.26), 0.011, 6)
    caixa("saia", madeira, (0.4, 0.38, 0.05), (0, 0.01, 0.415), chanfro=0.008)
    caixa("assento", estofado, (0.44, 0.42, 0.07), (0, 0, 0.47), chanfro=0.03, seg=3)
    for z, largura in ((0.6, 0.36), (0.72, 0.36)):
        caixa("ripa-encosto", madeira, (largura, 0.016, 0.05), (0, 0.213 + (z - 0.6) * 0.1, z), giro=(-6, 0, 0), chanfro=0.006)
    caixa("encosto", estofado, (0.38, 0.045, 0.2), (0, 0.222, 0.85), giro=(-6, 0, 0), chanfro=0.02, seg=3)


@receita("cadeira-diretor", "Cadeira de diretor", movel="cadeiraDiretor")
def cadeira_diretor() -> None:
    madeira = material("madeira-clara", "#B8834A", aspereza=0.5)
    lona = material("lona", "#1B1B1F", aspereza=0.95)
    ferragem = material("ferragem", "#A8ABB0", metal=1.0, aspereza=0.35)
    for x in (-0.27, 0.27):
        barra("perna-a", madeira, (x, -0.22, 0), (x, 0.22, 0.5), 0.017)             # as duas pernas cruzam em X
        barra("perna-b", madeira, (x, 0.22, 0), (x, -0.22, 0.5), 0.017)
        cilindro("pino", ferragem, 0.012, 0.05, (x, 0, 0.25), giro=(0, 90, 0), lados=8)
        barra("trilho-assento", madeira, (x, -0.24, 0.5), (x, 0.24, 0.5), 0.017)
        barra("coluna-braco", madeira, (x, -0.2, 0.5), (x, -0.2, 0.7), 0.014)
        barra("coluna-encosto", madeira, (x, 0.2, 0.5), (x, 0.24, 1.02), 0.016)
        caixa("braco", madeira, (0.05, 0.5, 0.022), (x, 0.01, 0.71), chanfro=0.008)
    for y in (-0.22, 0.22):
        barra("travessa-piso", madeira, (-0.27, y, 0.02), (0.27, y, 0.02), 0.014, 6)
    caixa("assento-lona", lona, (0.55, 0.44, 0.012), (0, 0, 0.495), chanfro=0.004)
    caixa("encosto-lona", lona, (0.56, 0.012, 0.2), (0, 0.232, 0.9), giro=(-4, 0, 0), chanfro=0.004)


@receita("cadeira-de-camarim", "Cadeira giratória de camarim", movel="cadeiraDeCamarim")
def cadeira_de_camarim() -> None:
    cromado = material("cromado", "#C9CCD1", metal=1.0, aspereza=0.18)
    couro = material("couro", "#E9D9C6", aspereza=0.55)
    borracha = material("borracha", "#17171A", aspereza=0.9)
    for i in range(5):
        a = math.radians(72 * i + 18)
        ponta = (0.3 * math.cos(a), 0.3 * math.sin(a), 0.07)
        barra("pata", cromado, (0, 0, 0.11), ponta, 0.018)
        esfera("rodizio", borracha, 0.032, (ponta[0], ponta[1], 0.032), lados=10)
    cilindro("cubo", cromado, 0.05, 0.06, (0, 0, 0.11), lados=14, chanfro=0.008)
    cilindro("coluna", cromado, 0.028, 0.36, (0, 0, 0.3), lados=12)
    toro("apoio-pes", cromado, 0.2, 0.011, (0, 0, 0.26), lados=24, lados_tubo=6)
    for a in (0, 120, 240):
        r = math.radians(a)
        barra("raio-apoio", cromado, (0, 0, 0.26), (0.2 * math.cos(r), 0.2 * math.sin(r), 0.26), 0.007, 6)
    torneado("assento", couro, [(0, 0.47), (0.19, 0.47), (0.215, 0.49), (0.22, 0.53), (0.2, 0.56), (0, 0.565)], lados=24)
    barra("haste-encosto", cromado, (0, 0.17, 0.5), (0, 0.24, 0.76), 0.012)
    caixa("encosto", couro, (0.36, 0.06, 0.2), (0, 0.25, 0.84), giro=(-8, 0, 0), chanfro=0.03, seg=3)


@receita("penteadeira", "Penteadeira de camarim com espelho iluminado", movel="penteadeira")
def penteadeira() -> None:
    corpo = material("laca", "#F4EFE8", aspereza=0.3)
    tampo = material("tampo", "#2A2320", aspereza=0.25)
    latao = material("latao", "#C9A24A", metal=1.0, aspereza=0.3)
    espelho = material("espelho", "#DDE6EE", metal=1.0, aspereza=0.04)
    luz = material("lampada", "#FFE9B8", emissao=4.0)
    vidro = material("frasco", "#C6275E", aspereza=0.15)
    for x in (-0.58, 0.58):
        caixa("gaveteiro", corpo, (0.44, 0.46, 0.77), (x, 0, 0.385), chanfro=0.012)
        for z in (0.18, 0.42, 0.62):
            caixa("frente-gaveta", corpo, (0.4, 0.014, 0.2), (x, -0.236, z), chanfro=0.006, seg=1)
            barra("puxador", latao, (x - 0.06, -0.255, z), (x + 0.06, -0.255, z), 0.008, 6)
    caixa("tampo", tampo, (1.64, 0.5, 0.045), (0, 0, 0.795), chanfro=0.012)
    caixa("moldura", corpo, (1.2, 0.05, 0.86), (0, 0.22, 1.28), chanfro=0.015)
    caixa("espelho", espelho, (1.02, 0.01, 0.68), (0, 0.192, 1.28))
    lampada = esfera("lampada", luz, 0.034, (-0.55, 0.18, 0.92), lados=8)
    for i in range(1, 6):
        duplicar(lampada, (-0.55, 0.18, 0.92 + i * 0.144))
    for i in range(6):
        duplicar(lampada, (0.55, 0.18, 0.92 + i * 0.144))
    for i in range(1, 7):
        duplicar(lampada, (-0.55 + i * 0.157, 0.18, 1.64))
    for i, x in enumerate((-0.5, -0.38, -0.27)):
        altura = 0.14 + i * 0.03
        torneado("frasco", vidro, [(0, 0), (0.035 - i * 0.005, 0), (0.035 - i * 0.005, altura * 0.7), (0.012, altura * 0.85), (0.012, altura), (0, altura)],
                 pos=(x, -0.05, 0.818), lados=12)
    cilindro("copo-pinceis", latao, 0.035, 0.1, (0.42, -0.06, 0.868), lados=12)
    for dx in (-0.015, 0.0, 0.015):
        barra("pincel", tampo, (0.42 + dx, -0.06, 0.87), (0.42 + dx * 4, -0.06 + dx, 1.08), 0.006, 6)


@receita("luminaria", "Luminária de piso", movel="luminaria")
def luminaria() -> None:
    latao = material("latao", "#B08A3E", metal=1.0, aspereza=0.32)
    cupula = material("cupula", "#F2E6CF", aspereza=0.9, emissao=0.6)
    luz = material("lampada", "#FFE2A8", emissao=6.0)
    torneado("base", latao, [(0, 0), (0.17, 0), (0.17, 0.02), (0.1, 0.045), (0.03, 0.06), (0.02, 0.1), (0, 0.1)], lados=24)
    cilindro("haste", latao, 0.014, 1.32, (0, 0, 0.74), lados=10)
    toro("anel", latao, 0.02, 0.008, (0, 0, 0.75), lados=12, lados_tubo=6)
    torneado("cupula", cupula, [(0.2, 1.3), (0.125, 1.62), (0.118, 1.62), (0.192, 1.305)], lados=24)
    for a in (0, 120, 240):
        r = math.radians(a)
        barra("aranha", latao, (0, 0, 1.4), (0.16 * math.cos(r), 0.16 * math.sin(r), 1.47), 0.004, 4)
    esfera("lampada", luz, 0.05, (0, 0, 1.46), escala=(1, 1, 1.25), lados=12)
