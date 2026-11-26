"""Móveis de uma sala só: júri, loja, box, set, quadra e gala (o lote 1 da fase 1, segunda parte).

Medidas tiradas dos móveis procedurais que eles substituem (lib/flair/nucleos/scene/moveis): a frente do móvel
procedural (+z) é a frente do objeto (-Y no Blender), então ``y = -z``.
"""
from __future__ import annotations

import math

from ..core import barra, caixa, cilindro, esfera, material, toro, torneado
from . import receita


@receita("mesa-dos-jurados", "Mesa dos jurados com placas de LED", movel="mesaDosJurados")
def mesa_dos_jurados() -> None:
    tampo = material("laca", "#F4EFE8", aspereza=0.25, papel="tampo")
    saia = material("estofado", "#2A2A33", aspereza=0.8, papel="saia", textura="tecido")
    placa = material("led", "#FFD447", emissao=3.0, papel="placa")
    metal = material("cromado", "#C9CCD1", metal=1.0, aspereza=0.2)
    larg = 2.4
    caixa("tampo", tampo, (larg, 0.7, 0.06), (0, 0, 0.76), chanfro=0.02)
    caixa("saia", saia, (larg, 0.04, 0.7), (0, -0.33, 0.38), chanfro=0.01)
    for x in (-larg / 2 + 0.1, larg / 2 - 0.1):
        cilindro("perna", metal, 0.025, 0.72, (x, 0.25, 0.37), lados=10)
    for x in (-larg / 3, 0, larg / 3):
        caixa("placa", placa, (0.32, 0.02, 0.1), (x, -0.22, 0.81), giro=(20, 0, 0), chanfro=0.006, seg=1)
        caixa("microfone-base", metal, (0.06, 0.06, 0.02), (x + 0.22, -0.05, 0.8))
        barra("microfone", metal, (x + 0.22, -0.05, 0.8), (x + 0.18, -0.15, 0.98), 0.006, 6)
        caixa("assento", saia, (0.44, 0.42, 0.08), (x, 0.55, 0.46), chanfro=0.03)
        caixa("encosto", saia, (0.44, 0.07, 0.5), (x, 0.74, 0.74), chanfro=0.03)
        cilindro("coluna", metal, 0.03, 0.4, (x, 0.55, 0.22), lados=10)
        cilindro("pe", metal, 0.2, 0.02, (x, 0.55, 0.01), lados=16)


@receita("balcao", "Balcão de loja com vitrine", movel="balcao")
def balcao() -> None:
    madeira = material("nogueira", "#6B4A33", aspereza=0.55, papel="madeira", textura="madeira")
    tampo = material("tampo", "#1E1E22", metal=0.6, aspereza=0.3, papel="tampo")
    vidro = material("vidro", "#DDE6EA", metal=0.2, aspereza=0.05, papel="vidro")
    larg = 1.8
    caixa("corpo", madeira, (larg, 0.6, 0.82), (0, 0, 0.43), chanfro=0.015)
    for i in range(1, 6):
        caixa("ripa", madeira, (0.02, 0.012, 0.7), (-larg / 2 + larg / 6 * i, -0.306, 0.45))
    caixa("tampo", tampo, (larg + 0.08, 0.68, 0.05), (0, 0, 0.885), chanfro=0.012)
    caixa("rodape", tampo, (larg - 0.2, 0.02, 0.03), (0, -0.31, 0.2))
    x = -larg * 0.22
    caixa("vitrine", vidro, (larg * 0.45, 0.4, 0.26), (x, 0, 1.04), chanfro=0.01)
    caixa("base-da-vitrine", tampo, (larg * 0.45 + 0.02, 0.42, 0.02), (x, 0, 0.92))
    for dx in (-0.2, 0.0, 0.2):
        caixa("joia", tampo, (0.08, 0.06, 0.02), (x + dx, 0, 0.94), chanfro=0.005, seg=1)
    caixa("caixa-registradora", tampo, (0.3, 0.26, 0.14), (larg / 2 - 0.3, 0.05, 0.98), chanfro=0.02)


@receita("prateleira-de-bolsas", "Prateleira de bolsas e sapatos", movel="prateleiraDeBolsas")
def prateleira_de_bolsas() -> None:
    madeira = material("carvalho", "#B98F5A", aspereza=0.6, papel="madeira", textura="madeira")
    bolsa = material("couro", "#7A2E46", aspereza=0.5, papel="bolsa")
    sapato = material("verniz", "#1C1C20", aspereza=0.25, papel="sapato")
    metal = material("latao", "#C9A24A", metal=1.0, aspereza=0.3)
    larg = 1.4
    for x in (-larg / 2, larg / 2):
        caixa("lateral", madeira, (0.04, 0.4, 1.6), (x, 0, 0.8), chanfro=0.01)
    for z in (0.45, 1.0, 1.55):
        caixa("tabua", madeira, (larg, 0.38, 0.04), (0, 0, z), chanfro=0.008)
    caixa("fundo", madeira, (larg, 0.02, 1.6), (0, 0.19, 0.8))
    for x in (-0.45, 0, 0.45):
        caixa("bolsa", bolsa, (0.3, 0.12, 0.24), (x, 0, 1.14), chanfro=0.04, seg=3)
        toro("alca", bolsa, 0.09, 0.01, (x, 0, 1.28), giro=(90, 0, 0), lados=14, lados_tubo=5)
        caixa("fecho", metal, (0.06, 0.01, 0.03), (x, -0.065, 1.2))
    for x in (-0.48, -0.16, 0.16, 0.48):
        caixa("sapato", sapato, (0.1, 0.26, 0.06), (x, 0, 0.5), chanfro=0.025)
        cilindro("salto", sapato, 0.012, 0.07, (x, 0.1, 0.5), lados=6)
    caixa("bolsa-grande", bolsa, (0.34, 0.14, 0.3), (0.3, 0, 1.72), chanfro=0.05, seg=3)


@receita("carro-de-corrida", "Carro de corrida no box", movel="carroDeCorrida")
def carro_de_corrida() -> None:
    pintura = material("laca", "#E0B21F", metal=0.4, aspereza=0.25, papel="pintura")
    carbono = material("carbono", "#1C1C20", metal=0.3, aspereza=0.4, papel="carbono", textura="escovado")
    pneu = material("pneu", "#121214", aspereza=0.9, papel="pneu", textura="borracha")
    metal = material("roda", "#B8BCC0", metal=1.0, aspereza=0.3, papel="metal")
    caixa("assoalho", carbono, (3.6, 1.0, 0.06), (0, 0, 0.1), chanfro=0.02)
    caixa("bico", pintura, (1.6, 0.34, 0.22), (-1.25, 0, 0.26), giro=(0, -4, 0), chanfro=0.08, seg=3)
    caixa("cockpit", pintura, (1.5, 0.7, 0.4), (0.15, 0, 0.33), chanfro=0.12, seg=3)
    caixa("halo", carbono, (0.55, 0.5, 0.12), (-0.1, 0, 0.56), chanfro=0.04)
    esfera("capacete", pintura, 0.2, (0.35, 0, 0.58), escala=(1.1, 1, 0.65), lados=14)
    caixa("motor", pintura, (1.0, 0.5, 0.36), (0.95, 0, 0.4), giro=(0, 6, 0), chanfro=0.1, seg=3)
    caixa("asa-dianteira", carbono, (0.3, 1.5, 0.04), (-2.05, 0, 0.12), chanfro=0.01)
    for y in (-0.74, 0.74):
        caixa("placa-dianteira", pintura, (0.32, 0.04, 0.18), (-2.0, y, 0.2), chanfro=0.01)
    caixa("asa-traseira", carbono, (0.36, 1.0, 0.05), (1.75, 0, 0.82), chanfro=0.01)
    for y in (-0.5, 0.5):
        caixa("placa-traseira", pintura, (0.36, 0.04, 0.4), (1.75, y, 0.65), chanfro=0.01)
    for x, y, r in ((-1.05, -0.62, 0.29), (-1.05, 0.62, 0.29), (1.2, -0.66, 0.33), (1.2, 0.66, 0.33)):
        torneado("pneu", pneu, [(r * 0.55, -0.15), (r, -0.15), (r * 1.02, 0), (r, 0.15), (r * 0.55, 0.15)], pos=(x, y, r), giro=(90, 0, 0), lados=20)
        cilindro("cubo", metal, r * 0.5, 0.31, (x, y, r), giro=(90, 0, 0), lados=12)


@receita("capacete-no-suporte", "Capacete de piloto no suporte", movel="capaceteNoSuporte")
def capacete_no_suporte() -> None:
    casco = material("casco", "#E0B21F", metal=0.3, aspereza=0.2, papel="casco")
    viseira = material("viseira", "#1B2A4A", metal=0.8, aspereza=0.05, papel="viseira")
    metal = material("aco", "#B8BCC0", metal=1.0, aspereza=0.3, papel="metal", textura="escovado")
    torneado("base", metal, [(0, 0), (0.18, 0), (0.17, 0.02), (0.14, 0.03), (0, 0.03)], lados=20)
    cilindro("haste", metal, 0.02, 1.05, (0, 0, 0.55), lados=10)
    esfera("casco", casco, 0.16, (0, 0, 1.2), escala=(0.94, 1.06, 1.0), lados=20)
    esfera("viseira", viseira, 0.13, (0, -0.09, 1.21), escala=(0.96, 0.6, 0.55), lados=16)
    toro("faixa", viseira, 0.152, 0.008, (0, 0, 1.14), lados=24, lados_tubo=5)


@receita("espelho-de-parede", "Espelho de parede com moldura dourada", movel="espelhoDeParede")
def espelho_de_parede() -> None:
    moldura = material("moldura", "#C9A24A", metal=0.9, aspereza=0.3, papel="moldura", textura="escovado")
    espelho = material("espelho", "#DDE6EA", metal=1.0, aspereza=0.04, papel="espelho")
    larg, alt = 1.0, 2.2
    meio = 0.2 + alt / 2
    caixa("fundo", moldura, (larg, 0.03, alt), (0, 0.015, meio))
    for z in (meio + alt / 2 - 0.04, meio - alt / 2 + 0.04):
        caixa("travessa", moldura, (larg, 0.06, 0.08), (0, 0, z), chanfro=0.015)
    for x in (-larg / 2 + 0.04, larg / 2 - 0.04):
        caixa("montante", moldura, (0.08, 0.06, alt), (x, 0, meio), chanfro=0.015)
    caixa("vidro", espelho, (larg - 0.16, 0.01, alt - 0.16), (0, -0.034, meio))
    esfera("florao", moldura, 0.05, (0, -0.03, meio + alt / 2 - 0.02), escala=(1.6, 0.5, 1), lados=10)


@receita("pedestais-com-cordao", "Pedestais de latão com cordão de veludo", movel="pedestaisComCordao")
def pedestais_com_cordao() -> None:
    metal = material("latao", "#C9A24A", metal=1.0, aspereza=0.25, papel="metal", textura="escovado")
    cordao = material("veludo", "#7A1F3A", aspereza=0.9, papel="cordao", textura="tecido")
    vao, n = 1.1, 3
    for i in range(n):
        x = (i - (n - 1) / 2) * vao
        torneado("base", metal, [(0, 0), (0.14, 0), (0.13, 0.03), (0.06, 0.05), (0.03, 0.07), (0, 0.07)], pos=(x, 0, 0), lados=20)
        cilindro("coluna", metal, 0.022, 0.86, (x, 0, 0.5), lados=12)
        esfera("bola", metal, 0.04, (x, 0, 0.96), lados=12)
        toro("argola", metal, 0.025, 0.006, (x + 0.03, 0, 0.84), giro=(90, 0, 0), lados=10, lados_tubo=4)
        if i < n - 1:
            pontos = [(x + vao * k / 6, 0, 0.84 - 0.12 * math.sin(math.pi * k / 6)) for k in range(7)]
            for de, ate in zip(pontos, pontos[1:]):
                barra("cordao", cordao, de, ate, 0.018, 8)


@receita("monitor-de-video", "Monitor de vídeo do set, no carrinho", movel="monitorDeVideo")
def monitor_de_video() -> None:
    carcaca = material("carcaca", "#2A2D33", metal=0.6, aspereza=0.4, papel="carcaca")
    tela = material("tela", "#5B8DEF", emissao=2.0, papel="tela")
    borracha = material("borracha", "#121214", aspereza=0.9)
    caixa("base", carcaca, (0.56, 0.44, 0.06), (0, 0, 0.12), chanfro=0.015)
    for x in (-0.22, 0.22):
        for y in (-0.18, 0.18):
            cilindro("rodizio", borracha, 0.05, 0.03, (x, y, 0.05), giro=(0, 90, 0), lados=12)
    cilindro("haste", carcaca, 0.03, 0.9, (0, 0, 0.6), lados=10)
    caixa("monitor", carcaca, (0.62, 0.08, 0.42), (0, 0, 1.2), giro=(8, 0, 0), chanfro=0.02)
    caixa("tela", tela, (0.54, 0.01, 0.34), (0, -0.046, 1.2), giro=(8, 0, 0))
    caixa("quebra-luz", carcaca, (0.64, 0.12, 0.02), (0, -0.08, 1.42), giro=(8, 0, 0))


@receita("banco-reservas", "Banco de reservas coberto", movel="bancoReservas")
def banco_reservas() -> None:
    metal = material("estrutura", "#2A2D33", metal=0.8, aspereza=0.4, papel="metal")
    assento = material("assento", "#C62B28", aspereza=0.5, papel="assento")
    cobertura = material("acrilico", "#A9C7E4", metal=0.1, aspereza=0.1, papel="cobertura")
    larg = 3.2
    lugares = 6
    for i in range(lugares):
        x = -larg / 2 + 0.25 + (larg - 0.5) / (lugares - 1) * i
        caixa("assento", assento, (0.46, 0.4, 0.06), (x, 0.15, 0.45), chanfro=0.03)
        caixa("encosto", assento, (0.46, 0.04, 0.34), (x, 0.36, 0.72), chanfro=0.02)
    caixa("longarina", metal, (larg - 0.2, 0.06, 0.06), (0, 0.15, 0.4))
    for x in (-larg / 2 + 0.3, larg / 2 - 0.3):
        caixa("pe", metal, (0.05, 0.36, 0.45), (x, 0.15, 0.225))
    for x in (-larg / 2, larg / 2):
        cilindro("poste", metal, 0.03, 2.0, (x, 0.45, 1.0), lados=10)
        barra("braco", metal, (x, 0.45, 2.0), (x, -0.5, 2.3), 0.03, 10)
    caixa("cobertura", cobertura, (larg + 0.1, 1.15, 0.03), (0, -0.05, 2.14), giro=(20, 0, 0), chanfro=0.01)
    caixa("fundo", cobertura, (larg, 0.02, 1.9), (0, 0.47, 1.0))


@receita("tabela-de-basquete", "Tabela de basquete com aro e rede", movel="tabelaDeBasquete")
def tabela_de_basquete() -> None:
    metal = material("estrutura", "#2A2D33", metal=0.8, aspereza=0.4, papel="metal")
    tabela = material("tabela", "#F4F4F0", aspereza=0.3, papel="tabela")
    aro = material("aro", "#E8662B", metal=0.6, aspereza=0.35, papel="aro")
    rede = material("rede", "#F4F4F0", aspereza=0.9, papel="rede")
    torneado("base", metal, [(0, 0), (0.3, 0), (0.3, 0.12), (0.12, 0.2), (0, 0.2)], pos=(0, 0.9, 0), lados=16)
    cilindro("poste", metal, 0.09, 3.3, (0, 0.9, 1.65), lados=14)
    caixa("braco", metal, (0.12, 0.9, 0.12), (0, 0.45, 3.25), chanfro=0.02)
    caixa("tabela", tabela, (1.8, 0.05, 1.05), (0, 0, 3.35), chanfro=0.015)
    caixa("quadrado", aro, (0.62, 0.02, 0.05), (0, -0.03, 3.32))
    for x in (-0.3, 0.3):
        caixa("quadrado-lado", aro, (0.05, 0.02, 0.42), (x, -0.03, 3.12))
    toro("aro", aro, 0.23, 0.02, (0, -0.28, 3.05), lados=24, lados_tubo=6)
    for i in range(12):
        a = 2 * math.pi * i / 12
        barra("fio", rede, (0.23 * math.cos(a), -0.28 + 0.23 * math.sin(a), 3.05),
              (0.15 * math.cos(a + 0.4), -0.28 + 0.15 * math.sin(a + 0.4), 2.65), 0.004, 4)
