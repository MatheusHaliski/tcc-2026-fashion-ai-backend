"""Salas 1, 3 e 7 do caso "A Coleção Maré": Entrada da gala, Salão principal e Sala de segurança.

Os pontos (x, z) são os de fai-application/.../flair3d/detetive/DetetiveSalas.java; cada peça de jogo fica onde a sala
procedural a punha (``contra_parede``), então a troca é só de aparência.
"""
from __future__ import annotations

from scripts.blender3d.core import caixa, cilindro

from ..formas import esconder_modelo, instancia, jogo
from ..materiais import material
from . import Importado, sala
from .kit_casca import Estilo, arandelas, casca, luz_de_prova
from .kit_gala import palco_com_cortina, pedestais, tapete
from .kit_moveis import estante
from .kit_pecas import armario, coluna, em_ponto, porta

CASCA = ("piso", "parede-fundo", "parede-esq", "parede-dir")
CAMERA = ((0.0, 4.6, 7.8), (0.0, 0.7, -0.6))
JOGO = ("FASHION_DETECTIVE",)
ARANDELAS_FUNDO = [(-2.9, 1.75, -3.64, 0), (2.9, 1.75, -3.64, 0)]
ARANDELAS_LADOS = [(-4.74, 1.75, z, 90) for z in (-2.9, 0.3, 2.6)] + [(4.74, 1.75, z, -90) for z in (-2.9, 0.3, 2.6)]


def portas(madeira: str, batente: str, saidas: list[tuple[float, float]]) -> None:
    """As portas das saídas que ficam numa parede (a da frente aberta é só a soleira acesa, desenhada pelo jogo)."""
    modelo = porta(madeira, batente)
    for x, z in saidas:
        if not (abs(x) < 2.5 and z > 1):
            em_ponto(modelo, x, z)


@sala(slug="detetive-entrada", titulo="Entrada da gala (high poly)", familia="detetive", camera=CAMERA, assar=CASCA,
      importados=(Importado("vestFloral", (-4.1, 0, -3.1), 0, 1.85), Importado("vestFloral", (4.1, 0, -3.1), 0, 1.85),
                  Importado("monumentalVase", (-1.7, 0, -3.15), 0, 1.6), Importado("monumentalVase", (1.7, 0, -3.15), 0, 1.6),
                  Importado("vestConsole", (-3.95, 0, 1.5), 90, 0.78)),
      jogos=JOGO)
def entrada() -> None:
    casca(Estilo("#E8E0D2", "marmore", "#E6DCC8", "#B08A3E", "#F2EBDD", repete_piso=0.35))
    arandelas("#FFE6B8", ARANDELAS_FUNDO + ARANDELAS_LADOS)
    tapete("#9E1B2C", 1.5, -3.55, 3.7)
    for lado in (-1, 1):
        pedestais(3.4, 0.6, 4, lado * 1.0)
    em_ponto(coluna("#EFE8DC"), 3, 1.5)
    em_ponto(armario("#4A2E20", alt=1.95, larg=1.1, prefixo="guarda-casacos"), -3, -1.5)
    portas("#5A3A24", "#F2EBDD", [(0, -2.2), (3, -1.5)])
    luz_de_prova()


@sala(slug="detetive-salao", titulo="Salão principal (high poly)", familia="detetive", camera=CAMERA, assar=CASCA,
      importados=(Importado("patronTable", (-3.55, 0, 1.1), 15, 1.0), Importado("dessertTable", (2.3, 0, -3.2), 0, 0.95),
                  Importado("monumentalVase", (-1.9, 0, -3.2), 0, 1.7), Importado("terracoUrn", (-4.2, 0, -3.15), 0, 1.5)),
      jogos=JOGO)
def salao() -> None:
    casca(Estilo("#5A3A2A", "madeira", "#3B1F2B", "#C9A24A", "#2A1620", repete_piso=0.6))
    arandelas("#FFD9A0", ARANDELAS_FUNDO + ARANDELAS_LADOS)
    palco_com_cortina(4.05, 1.0, 2.4, 1.4, -90, "#7A1028")
    portas("#2A1620", "#C9A24A", [(0, -2.4), (3, -1.8), (-3, -1.8)])
    _lustre()
    luz_de_prova((1, 0.86, 0.7))


def _lustre() -> None:
    """Lustre de cristal no alto do fundo (acima da porta do escritório): aros de latão e pingentes instanciados."""
    from scripts.blender3d.core import esfera, toro

    latao = material("latao", "#B8903E", metal=1.0, aspereza=0.28)
    cristal = material("cristal", "#F4F8FF", metal=0.0, aspereza=0.03, emissao=0.6)
    centro = jogo(0, 2.75, -2.6)
    aros = [toro("lustre-aro", latao, r, 0.012, pos=(centro[0], centro[1], centro[2] + h), lados=64, lados_tubo=10)
            for r, h in ((0.55, 0), (0.38, 0.18), (0.22, 0.34))]
    for a in aros:
        a["heroi"] = True
    cilindro("lustre-haste", latao, 0.014, 0.7, pos=(centro[0], centro[1], centro[2] + 0.4), lados=16)
    gota = esfera("lustre-gota", cristal, 0.03, escala=(1, 1, 1.6), lados=16)
    esconder_modelo(gota)
    import math

    for r, h, n in ((0.55, -0.06, 24), (0.38, 0.12, 16), (0.22, 0.28, 10)):
        for i in range(n):
            a = 2 * math.pi * i / n
            instancia(gota, (centro[0] + r * math.cos(a), centro[1] + r * math.sin(a), centro[2] + h))


@sala(slug="detetive-seguranca", titulo="Sala de segurança (high poly)", familia="detetive", camera=CAMERA, assar=CASCA,
      importados=(Importado("valetStand", (-3.95, 0, -1.0), 90, 1.25),),
      jogos=JOGO)
def seguranca() -> None:
    casca(Estilo("#3A3F48", "concreto", "#56606C", "#9AA6B4", "#2E343C", repete_piso=0.4), painel_alto=False)
    arandelas("#DDE8FF", ARANDELAS_LADOS)
    em_ponto(estante("#4A5058", "#8C99A8"), -3, 1.5)
    em_ponto(armario("#3A4048", "#9AA6B4", alt=1.1, prefixo="balcao-ponto"), 3, -1)
    portas("#3A4048", "#9AA6B4", [(0, 2.4)])
    _monitores(3.95, 1.5)
    from .kit_escritorio import _cadeira, relogio

    for peca in _cadeira():
        instancia(peca, jogo(3.35, 0, 1.5), 90)
    cofre_de_parede = armario("#5A626C", "#C9CCD2", alt=1.9, larg=0.8, fundo=0.5, prefixo="armario-de-aco")
    for x in (-1.6, -0.8, 0.8, 1.6):
        for peca in cofre_de_parede:
            instancia(peca, jogo(x, 0, -3.38), 0)
    relogio(0, 2.55, -3.62)
    luz_de_prova((0.85, 0.92, 1))


def _monitores(x: float, z: float) -> None:
    """Bancada com seis monitores (2 × 3) de moldura fina e tela acesa, voltada para o meio da sala."""
    aco = material("monitor-aco", "#2A2E34", "escovado", metal=0.8, aspereza=0.35, repete=2)
    tela = material("monitor-tela", "#5FA8FF", emissao=1.6, aspereza=0.1)
    tampo = material("bancada", "#6A707A", "laca", aspereza=0.3, verniz=0.3)
    base = jogo(x, 0, z)
    pecas = [caixa("bancada-tampo", tampo, (0.75, 1.9, 0.05), pos=(0, 0, 0.76), chanfro=0.01, seg=3),
             caixa("bancada-gaveteiro", aco, (0.6, 0.45, 0.7), pos=(0.05, 0.65, 0.37), chanfro=0.01, seg=3),
             caixa("bancada-pe", aco, (0.6, 0.05, 0.72), pos=(0.05, -0.9, 0.37), chanfro=0.01, seg=3),
             caixa("bancada-teclado", aco, (0.16, 0.45, 0.02), pos=(-0.15, 0, 0.795), chanfro=0.006, seg=2)]
    moldura = caixa("monitor", aco, (0.05, 0.62, 0.38), chanfro=0.012, seg=3)
    vidro = caixa("monitor-vidro", tela, (0.01, 0.58, 0.34))
    for o in (*pecas, moldura, vidro):
        esconder_modelo(o)
    for p in pecas:
        instancia(p, base, 0)
    for linha in (1.1, 1.5):
        for coluna_y in (-0.64, 0, 0.64):
            instancia(moldura, (base[0] + 0.2, base[1] + coluna_y, linha), 0)
            instancia(vidro, (base[0] + 0.17, base[1] + coluna_y, linha), 0)
