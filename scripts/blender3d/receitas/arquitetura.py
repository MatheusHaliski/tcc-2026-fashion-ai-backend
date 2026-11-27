"""Arquitetura em módulos (lote 2 da fase 1): prédios e vitrines da rua, palco do show, cenário de três paredes do set
e arquibancada. Cada medida usada nas salas é um arquivo (``variantes``); a frente do móvel procedural (+z) é a frente
do objeto (-Y no Blender), então ``y = -z``.
"""
from __future__ import annotations

import math

from ..core import barra, caixa, cilindro, duplicar, esfera, material, torneado
from . import receita, variantes

PREDIOS = ((1.8, 3.2), (1.5, 2.4), (2.0, 3.4), (1.7, 2.7))


@variantes("predio", "Prédio de {largura} m por {altura} m com janelas", {f"{round(l * 10)}x{round(a * 10)}": {"largura": l, "altura": a} for l, a in PREDIOS}, movel="predio")
def _predio(largura: float, altura: float) -> None:
    prof = 1.2
    parede = material("reboco", "#8A8F98", aspereza=0.85)
    janelas = material("janelas", "#FFD98A", emissao=1.6, papel="janelas")
    escuro = material("caixilho", "#2A2D33", metal=0.6, aspereza=0.4)
    caixa("corpo", parede, (largura, prof, altura), (0, 0, altura / 2), chanfro=0.02)
    caixa("embasamento", escuro, (largura + 0.04, prof + 0.04, 0.3), (0, 0, 0.15))
    caixa("cornija", escuro, (largura + 0.08, prof + 0.08, 0.08), (0, 0, altura - 0.04))
    colunas = max(2, round(largura / 0.5))
    andares = max(2, round((altura - 0.6) / 0.62))
    passo_x = largura / colunas
    passo_z = (altura - 0.6) / andares
    modelo = caixa("janela", janelas, (passo_x * 0.6, 0.02, passo_z * 0.55), (0, 0, 0))
    for i in range(colunas):
        for j in range(andares):
            x = -largura / 2 + passo_x * (i + 0.5)
            z = 0.55 + passo_z * (j + 0.5)
            if j == 0 and i == colunas // 2:
                continue
            duplicar(modelo, (x, -prof / 2 - 0.005, z))
    bpy_del(modelo)
    caixa("porta", escuro, (passo_x * 0.7, 0.03, 0.5), (0, -prof / 2 - 0.01, 0.3 + 0.25))
    caixa("casa-de-maquinas", parede, (largura * 0.4, prof * 0.5, 0.5), (largura * 0.15, 0, altura + 0.25), chanfro=0.02)
    cilindro("caixa-dagua", escuro, 0.16, 0.3, (-largura * 0.25, 0.1, altura + 0.15), lados=12)


def bpy_del(obj) -> None:
    """Tira da cena o modelo usado só para duplicar (as cópias dividem a malha)."""
    import bpy

    bpy.data.objects.remove(obj, do_unlink=True)


@variantes("fachada-vitrine", "Fachada com vitrine de {largura} m e toldo", {str(round(w * 10)): {"largura": w} for w in (2.2, 2.6, 2.8, 3.0)}, movel="fachadaVitrine")
def _fachada(largura: float) -> None:
    moldura = material("moldura", "#2A2D33", metal=0.6, aspereza=0.4, papel="moldura")
    vidro = material("vidro", "#BFD3DE", metal=0.3, aspereza=0.05, papel="vidro")
    toldo = material("toldo", "#C62B28", aspereza=0.85, papel="toldo", textura="tecido")
    manequim = material("manequim", "#ECE6DC", aspereza=0.5)
    caixa("soleira", moldura, (largura + 0.2, 0.16, 0.3), (0, -0.08, 0.15), chanfro=0.01)
    caixa("vidro", vidro, (largura, 0.02, 2.0), (0, -0.1, 1.3))
    for x in (-largura / 2 - 0.05, largura / 2 + 0.05):
        caixa("coluna", moldura, (0.1, 0.14, 2.0), (x, -0.08, 1.3), chanfro=0.01)
    caixa("verga", moldura, (largura + 0.2, 0.16, 0.12), (0, -0.08, 2.36), chanfro=0.01)
    caixa("toldo", toldo, (largura + 0.3, 0.95, 0.04), (0, -0.5, 2.62), giro=(-22, 0, 0), chanfro=0.01)
    caixa("sanefa", toldo, (largura + 0.3, 0.02, 0.18), (0, -0.94, 2.36))
    caixa("expositor", moldura, (largura * 0.5, 0.4, 0.5), (0, 0.2, 0.55), chanfro=0.02)
    for x in (-largura * 0.15, largura * 0.15):
        torneado("busto", manequim, [(0, 0.8), (0.08, 0.82), (0.16, 0.98), (0.13, 1.2), (0.17, 1.38), (0.06, 1.48), (0, 1.5)], pos=(x, 0.2, 0), lados=14)


@receita("palco-pequeno", "Palco de show com treliça e caixas de som", movel="palcoPequeno")
def palco_pequeno() -> None:
    piso = material("piso", "#1C1C20", aspereza=0.6, papel="piso", textura="madeira")
    metal = material("metal", "#2A2D33", metal=0.9, aspereza=0.35, papel="metal", textura="escovado")
    luz = material("luz", "#FF4FD8", emissao=5.0, papel="luz")
    larg = 5.4
    caixa("praticavel", piso, (larg, 2.2, 0.4), (0, 0, 0.2), chanfro=0.02)
    caixa("saia", metal, (larg - 0.02, 0.02, 0.36), (0, -1.11, 0.19))
    for x in (-larg / 2 + 0.4, larg / 2 - 0.4):
        caixa("caixa-de-som", metal, (0.5, 0.42, 0.8), (x, -0.3, 0.8), chanfro=0.03)
        cilindro("alto-falante", luz, 0.13, 0.01, (x, -0.515, 0.9), giro=(90, 0, 0), lados=16)
        cilindro("tweeter", metal, 0.05, 0.01, (x, -0.515, 1.08), giro=(90, 0, 0), lados=12)
    for x in (-larg / 2 + 0.1, larg / 2 - 0.1):
        for dx in (-0.06, 0.06):
            for dy in (-0.06, 0.06):
                barra("banzo", metal, (x + dx, 0.5 + dy, 0.4), (x + dx, 0.5 + dy, 3.3), 0.012, 6)
        for k in range(6):
            z0, z1 = 0.4 + k * 0.48, 0.4 + (k + 1) * 0.48
            barra("diagonal", metal, (x - 0.06, 0.44, z0), (x + 0.06, 0.56, z1), 0.006, 4)
    barra("travessa", metal, (-larg / 2 + 0.1, 0.5, 3.3), (larg / 2 - 0.1, 0.5, 3.3), 0.05, 8)
    for x in (-larg / 4, larg / 4):
        cilindro("refletor", metal, 0.12, 0.26, (x, 0.42, 3.08), giro=(-40, 0, 0), lados=12, raio_topo=0.09)
        cilindro("lente", luz, 0.11, 0.02, (x, 0.34, 2.98), giro=(-40, 0, 0), lados=12)
    torneado("pe-do-microfone", metal, [(0, 0.4), (0.16, 0.4), (0.02, 0.44), (0, 0.44)], pos=(0, -0.5, 0), lados=14)
    cilindro("haste-do-microfone", metal, 0.012, 1.35, (0, -0.5, 1.08), lados=8)
    esfera("microfone", metal, 0.035, (0, -0.5, 1.79), escala=(1, 1, 1.4), lados=10)


@receita("cenario-de-tres-paredes", "Cenário de três paredes do set de filmagem", movel="cenarioDeTresParedes")
def cenario_de_tres_paredes() -> None:
    pintura = material("pintura", "#D9CBB2", aspereza=0.85, papel="pintura")
    madeira = material("madeira", "#8B6538", aspereza=0.7, papel="madeira", textura="madeira")
    luz = material("luz", "#FFE7B0", emissao=3.0, papel="luz")
    larg, alt, lado, abre = 5.2, 3.2, 2.6, 18
    caixa("fundo", pintura, (larg, 0.08, alt), (0, 0, alt / 2))
    rad = math.radians(abre)
    for s in (-1, 1):
        x = s * (larg / 2 + (lado / 2) * math.sin(rad))
        y = -(lado / 2) * math.cos(rad)
        caixa("lateral", pintura, (0.08, lado, alt), (x, y, alt / 2), giro=(0, 0, -s * abre))
    for x in (-larg / 3, 0, larg / 3):
        caixa("escora", madeira, (0.06, 0.06, alt * 1.05), (x, 0.55, alt / 2 - 0.05), giro=(20, 0, 0))
    caixa("rodape", madeira, (larg, 0.03, 0.12), (0, -0.05, 0.06))
    caixa("janela", madeira, (1.4, 0.06, 1.36), (1.1, -0.03, 1.8), chanfro=0.01)
    caixa("luz-da-janela", luz, (1.24, 0.02, 1.2), (1.1, -0.065, 1.8))
    for i in range(6):
        caixa("persiana", madeira, (1.24, 0.05, 0.04), (1.1, -0.09, 1.3 + i * 0.2), giro=(-25, 0, 0))
    caixa("quadro", madeira, (0.7, 0.05, 0.9), (-1.3, -0.04, 1.9), chanfro=0.01)
    caixa("tela-do-quadro", pintura, (0.58, 0.01, 0.78), (-1.3, -0.07, 1.9))


@variantes("arquibancada", "Arquibancada de {largura} m com três degraus", {str(round(l * 10)): {"largura": l} for l in (7.2, 9.0)}, movel="arquibancada")
def _arquibancada(largura: float) -> None:
    concreto = material("concreto", "#8A8F98", aspereza=0.9, papel="concreto")
    assento = material("assento", "#2F5D8A", aspereza=0.5, papel="assento")
    degraus = 3
    lugares = int(largura // 0.6)
    for d in range(degraus):
        z, y = 0.4 * d, 0.8 * d
        caixa("degrau", concreto, (largura, 0.8, 0.4), (0, y, z + 0.2), chanfro=0.015)
        modelo = None
        for i in range(lugares):
            x = -largura / 2 + 0.3 + i * 0.6
            if modelo is None:
                assento_ = caixa("assento", assento, (0.44, 0.4, 0.05), (x, y + 0.05, z + 0.45))
                encosto = caixa("encosto", assento, (0.44, 0.04, 0.3), (x, y + 0.27, z + 0.62))
                modelo = (assento_, encosto)
            else:
                duplicar(modelo[0], (x, y + 0.05, z + 0.45))
                duplicar(modelo[1], (x, y + 0.27, z + 0.62))
    altura = 0.4 * degraus + 0.5
    caixa("muro", concreto, (largura, 0.12, altura), (0, 0.8 * degraus - 0.34, altura / 2))
    barra("corrimao", concreto, (-largura / 2, -0.38, 0.95), (largura / 2, -0.38, 0.95), 0.025, 8)
    for x in (-largura / 2 + 0.1, 0, largura / 2 - 0.1):
        barra("pe-do-corrimao", concreto, (x, -0.38, 0.4), (x, -0.38, 0.95), 0.02, 6)
