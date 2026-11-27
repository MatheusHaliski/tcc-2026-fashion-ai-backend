"""Móveis de loja, camarim e box que aparecem em várias salas: arara, espelho, banco estofado e armário de gavetas."""
from __future__ import annotations

import math

from ..core import barra, caixa, cilindro, esfera, material, toro
from . import receita, variantes

# (largura em metros, peças penduradas) que as salas usam: o slug leva as duas medidas
ARARAS = ((1.4, 6), (1.5, 7), (1.6, 5), (1.6, 6), (1.6, 7))


@variantes("arara", "Arara de roupas de {largura} m com {pecas} peças",
           {f"{round(l * 10)}-{p}": {"largura": l, "pecas": p} for l, p in ARARAS}, movel="arara")
def _arara(largura: float, pecas: int) -> None:
    metal = material("cromado", "#C9CCD1", metal=1.0, aspereza=0.2, papel="metal", textura="escovado")
    roupas = material("roupas", "#3E6B74", aspereza=0.85, papel="roupas", textura="tecido")
    borracha = material("borracha", "#17171A", aspereza=0.9)
    meia = largura / 2
    for x in (-meia, meia):
        cilindro("coluna", metal, 0.018, 1.5, (x, 0, 0.83), lados=10)
        barra("pe", metal, (x, -0.22, 0.075), (x, 0.22, 0.075), 0.018)
        esfera("joelho", metal, 0.026, (x, 0, 1.6), lados=8)
        for y in (-0.22, 0.22):
            esfera("rodizio", borracha, 0.03, (x, y, 0.03), lados=8)
    barra("varao", metal, (-meia, 0, 1.6), (meia, 0, 1.6), 0.018, 10)
    barra("travessa", metal, (-meia, 0, 0.3), (meia, 0, 0.3), 0.012, 6)
    for i in range(pecas):
        x = -meia + 0.16 + ((largura - 0.32) / max(1, pecas - 1)) * i
        comprimento = 0.75 + (i % 3) * 0.14
        giro = 6 if i % 2 == 0 else -6
        s, c = math.sin(math.radians(giro)), math.cos(math.radians(giro))
        toro("gancho", metal, 0.02, 0.004, (x, 0, 1.585), giro=(0, 90, giro), lados=8, lados_tubo=4)
        for lado in (-1, 1):                                             # o cabide: dois braços caindo para os ombros
            barra("cabide", metal, (x, 0, 1.555), (x - lado * 0.19 * s, lado * 0.19 * c, 1.5), 0.006, 4)
        caixa("ombros", roupas, (0.05, 0.4, 0.07), (x, 0, 1.485), giro=(0, 0, giro), chanfro=0.02, seg=1)
        caixa("corpo", roupas, (0.045, 0.34, comprimento - 0.1), (x, 0, 1.46 - comprimento / 2), giro=(0, 0, giro), chanfro=0.015, seg=1)
        caixa("barra", roupas, (0.05, 0.4, 0.06), (x, 0, 1.5 - comprimento + 0.05), giro=(0, 0, giro), chanfro=0.012, seg=1)


# (largura, altura do vidro, lâmpadas de camarim em volta)
ESPELHOS = {"7x19": (0.7, 1.9, 0), "13x28": (1.3, 2.8, 0), "18x24-luz": (1.8, 2.4, 14)}


@variantes("espelho", "Espelho de {largura} × {altura} m com moldura",
           {s: {"largura": l, "altura": a, "lampadas": n} for s, (l, a, n) in ESPELHOS.items()}, movel="espelho")
def _espelho(largura: float, altura: float, lampadas: int) -> None:
    moldura = material("moldura", "#B8923F", metal=0.9, aspereza=0.35, papel="moldura", textura="escovado")
    vidro = material("vidro", "#DDE6EA", metal=1.0, aspereza=0.04, papel="vidro")
    luz = material("lampada", "#FFE9BF", emissao=6.0, papel="luz")
    m, meio = 0.09, altura / 2 + 0.06
    caixa("vidro", vidro, (largura, 0.012, altura), (0, -0.02, meio))
    caixa("fundo", moldura, (largura + m, 0.012, altura + m), (0, 0.026, meio))
    for z in (meio + altura / 2 + m / 2, meio - altura / 2 - m / 2):     # travessas e montantes com filete por dentro
        caixa("travessa", moldura, (largura + 2 * m, 0.07, m), (0, 0, z), chanfro=0.018)
        caixa("filete", moldura, (largura, 0.05, 0.02), (0, -0.012, z - math.copysign(m / 2 + 0.008, z - meio)), chanfro=0.006, seg=1)
    for x in (-largura / 2 - m / 2, largura / 2 + m / 2):
        caixa("montante", moldura, (m, 0.07, altura), (x, 0, meio), chanfro=0.018)
        caixa("filete", moldura, (0.02, 0.05, altura), (x - math.copysign(m / 2 + 0.008, x), -0.012, meio), chanfro=0.006, seg=1)
        for z in (meio + altura / 2 + m / 2, meio - altura / 2 - m / 2):
            cilindro("roseta", moldura, 0.036, 0.016, (x, -0.036, z), giro=(90, 0, 0), lados=12, chanfro=0.004)
    por_lado = lampadas // 2
    for i in range(por_lado):
        z = meio - altura / 2 + (altura / (por_lado - 1)) * i
        for x in (-largura / 2 - m / 2, largura / 2 + m / 2):
            cilindro("soquete", moldura, 0.028, 0.03, (x, -0.045, z), giro=(90, 0, 0), lados=10)
            esfera("lampada", luz, 0.045, (x, -0.06, z), lados=10)


@variantes("banco-estofado", "Banco estofado de {largura} m", {"13": {"largura": 1.3}, "16": {"largura": 1.6}}, movel="bancoEstofado")
def _banco_estofado(largura: float) -> None:
    estofado = material("veludo", "#7A2E46", aspereza=0.9, papel="estofado", textura="tecido")
    base = material("latao", "#B08A3E", metal=1.0, aspereza=0.3, papel="base", textura="escovado")
    caixa("almofada", estofado, (largura, 0.45, 0.13), (0, 0, 0.405), chanfro=0.045, seg=3)
    caixa("vivo", estofado, (largura - 0.02, 0.43, 0.025), (0, 0, 0.345), chanfro=0.01, seg=1)
    caixa("quadro", base, (largura - 0.08, 0.38, 0.05), (0, 0, 0.305), chanfro=0.008)
    botoes = max(3, round(largura / 0.26))
    for i in range(botoes):                                              # capitonê: duas fileiras de botões afundados
        x = -largura / 2 + (largura / (botoes + 1)) * (i + 1)
        for y in (-0.1, 0.1):
            esfera("botao", estofado, 0.022, (x, y, 0.468), escala=(1, 1, 0.45), lados=8)
    for x in (-largura / 2 + 0.1, largura / 2 - 0.1):
        barra("longarina", base, (x, -0.14, 0.2), (x, 0.14, 0.2), 0.008, 6)
        for y in (-0.14, 0.14):
            cilindro("perna", base, 0.018, 0.28, (x, y, 0.14), lados=10, raio_topo=0.026)
            cilindro("sapata", base, 0.024, 0.012, (x, y, 0.006), lados=10)


@receita("armario-ferramentas", "Armário de gavetas com tampo", movel="armarioFerramentas")
def armario_ferramentas() -> None:
    corpo = material("laca", "#E0B21F", metal=0.3, aspereza=0.4, papel="corpo")
    metal = material("aco", "#A8ABB0", metal=1.0, aspereza=0.35, papel="metal", textura="escovado")
    borracha = material("tapete", "#17171A", aspereza=0.9, textura="borracha")
    largura = 1.6
    caixa("rodape", borracha, (largura - 0.06, 0.44, 0.07), (0, 0.01, 0.035))
    caixa("corpo", corpo, (largura, 0.5, 0.88), (0, 0, 0.51), chanfro=0.012)
    caixa("tampo", metal, (largura + 0.04, 0.54, 0.04), (0, 0, 0.97), chanfro=0.008)
    caixa("tapete", borracha, (largura - 0.1, 0.42, 0.008), (0, 0, 0.993))
    for z in (0.2, 0.42, 0.64, 0.84):
        caixa("gaveta", metal, (largura - 0.12, 0.02, 0.17), (0, -0.256, z), chanfro=0.006, seg=1)
        caixa("puxador", corpo, (largura - 0.3, 0.016, 0.028), (0, -0.272, z + 0.05), chanfro=0.006, seg=1)
    cilindro("fechadura", metal, 0.014, 0.012, (largura / 2 - 0.12, -0.27, 0.9), giro=(90, 0, 0), lados=10)
    for x in (-largura / 2 - 0.012, largura / 2 + 0.012):
        barra("alca", metal, (x, -0.12, 0.8), (x, 0.12, 0.8), 0.012, 6)
