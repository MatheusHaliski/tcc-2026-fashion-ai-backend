"""A sala da demonstração jogável do Fashion Detective (/flair/3d/detective/demo) em alta densidade.

As caixas de colisão são as de lib/flair/detetive/demo/mundo.ts (o salão na frente, o arquivo atrás da parede com a
porta); o que se move continua no jogo (a folha da porta, a gaveta, as portas do armário e os itens). Aqui ficam o
piso, as paredes, a parede do arquivo com o batente da porta, a mesa, a arara, a cômoda, a coluna, o corpo do armário,
a estante e o guarda-corpo da frente.
"""
from __future__ import annotations

from scripts.blender3d.core import caixa, torneado

from ..formas import esconder_modelo, instancia, jogo, varrer
from ..materiais import material
from . import Importado, sala
from .kit_casca import RODAPE, SANCA, arandelas
from .kit_moveis import arara, estante
from .kit_pecas import armario, coluna

ALTURA = 3.0
SALAO = ("#5A3A2A", "#3B1F2B", "#C9A24A")
ARQUIVO = ("#6B5A48", "#8A8072")


def _cascas() -> None:
    tabuas = material("piso", SALAO[0], "madeira", aspereza=0.35, verniz=0.5, repete=0.6)
    tacos = material("piso-arquivo", ARQUIVO[0], "madeira", aspereza=0.5, repete=0.8)
    parede = material("parede", SALAO[1], "tecido", aspereza=0.85, repete=0.5)
    parede_arq = material("parede-arquivo", ARQUIVO[1], "tecido", aspereza=0.85, repete=0.5)
    lambri = material("lambri", "#2A1620", "laca", aspereza=0.32, verniz=0.4)
    dourado = material("detalhe", SALAO[2], metal=0.85, aspereza=0.3)
    caixa("piso", tabuas, (12.4, 12.5, 0.04), pos=jogo(0, -0.02, 3.75))
    caixa("piso-arquivo", tacos, (12.0, 4.5, 0.04), pos=jogo(0, -0.019, -4.75))
    caixa("parede-fundo", parede_arq, (12.0, 0.2, ALTURA), pos=jogo(0, ALTURA / 2, -7.1))
    for s in (-1, 1):
        caixa(f"parede-{s}", parede, (0.2, 17.0, ALTURA), pos=jogo(s * 6.1, ALTURA / 2, 1.5))
        caixa(f"divisoria-{s}", parede, (5.1, 0.3, ALTURA), pos=jogo(s * 3.45, ALTURA / 2, -2.5))
    caixa("verga", parede, (1.8, 0.3, 0.6), pos=jogo(0, 2.7, -2.5))
    batente = [(0, 0), (0.04, 0), (0.05, 0.015), (0.07, 0.025), (0.09, 0.03), (0.09, 0), (0, 0)]
    for z in (-2.34, -2.66):
        varrer(f"batente-{z}", dourado, batente, [jogo(-0.9, 0, z), jogo(-0.9, 2.4, z), jogo(0.9, 2.4, z), jogo(0.9, 0, z)],
               normal=(0, -1 if z > -2.5 else 1, 0))
    for nome, caminho in (("rodape-salao", [(-6, -2.35), (-0.9, -2.35)]), ("rodape-salao-2", [(0.9, -2.35), (6, -2.35)]),
                          ("rodape-esq", [(-6, 10), (-6, -2.35)]), ("rodape-dir", [(6, -2.35), (6, 10)])):
        varrer(nome, lambri, RODAPE, [jogo(x, 0, z) for x, z in caminho])
    varrer("sanca-esq", lambri, SANCA, [jogo(-6, ALTURA, 10), jogo(-6, ALTURA, -2.35), jogo(6, ALTURA, -2.35), jogo(6, ALTURA, 10)])
    varrer("guarda-corpo", dourado, [(0.03, 0), (0.03, 0.3), (-0.03, 0.3), (-0.03, 0)], [jogo(-6, 0, 5.1), jogo(6, 0, 5.1)])
    vara = torneado("guarda-corpo-pilar", dourado, [(0, 0), (0.05, 0), (0.05, 0.02), (0.025, 0.05), (0.025, 0.32), (0.04, 0.34), (0, 0.36)], lados=24)
    for x in (-5.8, -3, 0, 3, 5.8):
        instancia(vara, jogo(x, 0, 5.1))
    esconder_modelo(vara)


def _mesa() -> None:
    madeira = material("mesa", "#3A2418", "madeira", aspereza=0.35, verniz=0.6, repete=1)
    caixa("mesa-tampo", madeira, (2.8, 0.9, 0.06), pos=jogo(0, 0.75, 1.05), chanfro=0.015, seg=4)
    caixa("mesa-saia", madeira, (2.6, 0.75, 0.1), pos=jogo(0, 0.67, 1.05), chanfro=0.008, seg=2)
    pe = torneado("mesa-pe", madeira, [(0, 0), (0.03, 0), (0.04, 0.05), (0.03, 0.12), (0.045, 0.3), (0.03, 0.55), (0.04, 0.62),
                                       (0.04, 0.72), (0, 0.72)], lados=32)
    pe["heroi"] = True
    for x in (-1.3, 1.3):
        for z in (0.68, 1.42):
            instancia(pe, jogo(x, 0, z))
    esconder_modelo(pe)


@sala(slug="detetive-demo", titulo="Demonstração do Detective (high poly)", familia="detetive",
      camera=((0.0, 6.5, 10.5), (0.0, 0.5, -1.5)), ambiente=(0.0, 1.6, 1.0), assar=("piso", "piso-arquivo"),
      importados=(Importado("monumentalVase", (-5.4, 0, 4.4), 0, 1.6), Importado("vestFloral", (5.4, 0, 4.4), 0, 1.7)),
      jogos=("FASHION_DETECTIVE_DEMO",))
def demo() -> None:
    _cascas()
    _mesa()
    arandelas("#FFD9A0", [(-5.99, 1.8, z, 90) for z in (-0.5, 3.5)] + [(5.99, 1.8, z, -90) for z in (-0.5, 3.5)])
    for peca in arara(("#C6275E", "#1F7A76", "#F2F0EA", "#E8C93C"), larg=1.8):
        instancia(peca, jogo(-4.3, 0, -0.85), 0)
    for peca in armario("#4A2E22", larg=2.0, alt=0.95, fundo=0.6, prefixo="comoda"):
        instancia(peca, jogo(4.6, 0, -2.05), 0)
    for peca in coluna(SALAO[2], ALTURA):
        instancia(peca, jogo(2.9, 0, 2.7), 0)
    for peca in estante("#3A4A5A", larg=1.4, alt=2.2, fundo=0.6):
        instancia(peca, jogo(-5.0, 0, -6.7), 0)
    for peca in estante("#5A4632", larg=2.4, alt=2.3, fundo=0.5):
        instancia(peca, jogo(3.0, 0, -6.75), 0)
    from .kit_casca import luz_de_prova

    luz_de_prova((1, 0.88, 0.75))
