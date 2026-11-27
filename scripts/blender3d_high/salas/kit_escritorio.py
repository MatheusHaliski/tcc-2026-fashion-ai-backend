"""Peças do Arquivo e do Escritório da direção em alta densidade: cofre de porta redonda, mapoteca de gavetas rasas,
mesa de vidro com cadeira giratória, troféus torneados, janela com caixilho e cortinas, escada de biblioteca."""
from __future__ import annotations

import math

import bpy

from scripts.blender3d.core import barra, caixa, cilindro, toro, torneado

from ..formas import capitone, cortina, jogo
from ..materiais import material
from .kit_atelie import _copias
from .kit_moveis import estante
from .kit_pecas import modelos


def cofre() -> list[bpy.types.Object]:
    """Cofre de aço: caixa com quinas arredondadas, porta redonda com anel, volante de cinco raios, segredo e trincos."""
    aco = material("cofre", "#3A4048", "escovado", metal=0.9, aspereza=0.35, repete=2)
    latao = material("latao", "#B8903E", metal=1.0, aspereza=0.28)
    pecas = [caixa("cofre-corpo", aco, (1.0, 0.7, 1.15), pos=(0, 0, 0.6), chanfro=0.05, seg=5),
             caixa("cofre-base", aco, (1.04, 0.74, 0.06), pos=(0, 0, 0.03), chanfro=0.01, seg=2),
             cilindro("cofre-porta", aco, 0.42, 0.06, pos=(0, -0.37, 0.62), giro=(90, 0, 0), lados=96, chanfro=0.012),
             toro("cofre-anel", latao, 0.4, 0.014, pos=(0, -0.405, 0.62), giro=(90, 0, 0), lados=96, lados_tubo=12),
             cilindro("cofre-cubo", latao, 0.06, 0.06, pos=(0, -0.43, 0.62), giro=(90, 0, 0), lados=48, chanfro=0.008),
             torneado("cofre-segredo", latao, [(0, 0), (0.07, 0), (0.075, 0.01), (0.07, 0.03), (0, 0.035)], pos=(0, -0.4, 0.95),
                      giro=(90, 0, 0), lados=64)]
    for i in range(5):
        a = 2 * math.pi * i / 5
        fim = (0.2 * math.cos(a), -0.47, 0.62 + 0.2 * math.sin(a))
        pecas.append(barra("cofre-raio", latao, (0, -0.46, 0.62), fim, 0.012, 12))
        pecas.append(torneado("cofre-pegador", latao, [(0, 0), (0.02, 0), (0.024, 0.03), (0, 0.045)], pos=fim, giro=(90, 0, 0), lados=16))
    for z in (0.3, 0.95):
        pecas.append(cilindro("cofre-dobradica", aco, 0.035, 0.14, pos=(0.47, -0.36, z), lados=24, chanfro=0.006))
    return modelos(*pecas, heroi=True)


def mapoteca(larg: float = 1.3) -> list[bpy.types.Object]:
    """Mapoteca de madeira: oito gavetas rasas e largas com puxador de concha e porta-etiqueta."""
    madeira = material("mapoteca", "#6B4A30", "madeira", aspereza=0.4, verniz=0.5, repete=1.2)
    latao = material("latao", "#B8903E", metal=1.0, aspereza=0.28)
    pecas = [caixa("mapoteca-corpo", madeira, (larg, 0.85, 0.95), pos=(0, 0, 0.5), chanfro=0.012, seg=3),
             caixa("mapoteca-tampo", madeira, (larg + 0.05, 0.9, 0.04), pos=(0, 0, 0.99), chanfro=0.012, seg=4)]
    gaveta = caixa("mapoteca-gaveta", madeira, (larg - 0.08, 0.025, 0.095), chanfro=0.006, seg=2)
    concha = torneado("mapoteca-concha", latao, [(0, 0), (0.045, 0), (0.05, 0.012), (0.03, 0.02), (0, 0.02)], giro=(90, 0, 0), lados=24)
    concha.scale = (1.0, 1.0, 0.45)
    etiqueta = caixa("mapoteca-etiqueta", latao, (0.1, 0.006, 0.04), chanfro=0.003, seg=2)
    copias = []
    for i in range(8):
        z = 0.12 + i * 0.105
        copias += _copias(gaveta, [(0, -0.43, z, 0)]) if i == 0 else [_mais(gaveta, (0, -0.43, z))]
        copias.append(_mais(concha, (0, -0.445, z - 0.01)))
        copias.append(_mais(etiqueta, (-0.4, -0.445, z + 0.02)))
    return modelos(*pecas) + copias


def _mais(modelo: bpy.types.Object, pos) -> bpy.types.Object:
    from ..formas import instancia

    if modelo.name in bpy.context.scene.collection.objects:
        bpy.context.scene.collection.objects.unlink(modelo)
    c = instancia(modelo, pos)
    bpy.context.scene.collection.objects.unlink(c)
    return c


def mesa_de_vidro() -> list[bpy.types.Object]:
    """Mesa de diretoria: tampo de vidro com borda lapidada sobre dois cavaletes cromados, gaveteiro, caneta e papéis."""
    vidro = material("mesa-vidro", "#B8D0D8", metal=0.0, aspereza=0.02, verniz=1.0)
    cromo = material("cromo", "#D8DCE2", metal=1.0, aspereza=0.08)
    pecas = [caixa("mesa-vidro", vidro, (1.7, 0.85, 0.02), pos=(0, 0, 0.75), chanfro=0.008, seg=3),
             caixa("mesa-gaveteiro", material("gaveteiro", "#1B2440", "laca", aspereza=0.3, verniz=0.6), (0.45, 0.55, 0.58),
                   pos=(0.55, 0.05, 0.3), chanfro=0.012, seg=3)]
    for x in (-0.75, 0.75):
        caminho = [(x, -0.38, 0), (x, -0.38, 0.74), (x, 0.38, 0.74), (x, 0.38, 0)]
        pecas.append(_tubo_cromado("mesa-cavalete", cromo, caminho))
    pecas.append(caixa("papel", material("papel", "#F4F1EA", aspereza=0.9), (0.21, 0.3, 0.004), pos=(-0.25, -0.05, 0.762), giro=(0, 0, 8)))
    pecas.append(cilindro("caneta", material("caneta", "#101014", metal=0.4, aspereza=0.2), 0.006, 0.14, pos=(-0.05, -0.1, 0.766),
                          giro=(0, 90, 20), lados=16))
    cadeira = _cadeira()
    return modelos(*pecas, heroi=True) + cadeira


def _tubo_cromado(nome, mat, caminho):
    from ..formas import varrer

    return varrer(nome, mat, [(0.02 * math.cos(a), 0.02 * math.sin(a)) for a in [2 * math.pi * i / 16 for i in range(17)]], caminho)


def _cadeira() -> list[bpy.types.Object]:
    """Cadeira giratória de couro: encosto e assento capitonê, base de cinco pés com rodízios."""
    couro = material("couro", "#1C1C22", "veludo", aspereza=0.45, fibra=0.2, repete=2)
    cromo = material("cromo", "#D8DCE2", metal=1.0, aspereza=0.08)
    encosto = capitone("cadeira-encosto", couro, 0.5, 0.65, 0.07, botoes=(3, 3), pos=(0, 0.55, 0.88), resolucao=10)
    assento = capitone("cadeira-assento", couro, 0.5, 0.48, 0.07, botoes=(3, 3), pos=(0, 0.3, 0.48), giro=(-90, 0, 0), resolucao=10)
    pecas = [encosto, assento, cilindro("cadeira-coluna", cromo, 0.03, 0.36, pos=(0, 0.3, 0.27), lados=24, chanfro=0.004)]
    for i in range(5):
        a = 2 * math.pi * i / 5 + 0.3
        fim = (0.3 * math.cos(a), 0.3 + 0.3 * math.sin(a), 0.07)
        pecas.append(barra("cadeira-pe", cromo, (0, 0.3, 0.1), fim, 0.016, 12))
        pecas.append(toro("cadeira-rodizio", material("borracha", "#1A1A1E", aspereza=0.8), 0.025, 0.012, pos=(fim[0], fim[1], 0.03),
                          giro=(90, 0, math.degrees(a)), lados=20, lados_tubo=8))
    return modelos(*pecas, heroi=True)


def trofeus(madeira: str = "#2A2420") -> list[bpy.types.Object]:
    """A estante do escritório com taças torneadas douradas e placas nas prateleiras."""
    corpo = estante(madeira, "#1B2440", livros=("#1B2440", "#6B2A2A", "#B08A3E"))
    ouro = material("ouro", "#D4AF37", metal=1.0, aspereza=0.18)
    taca = torneado("taca", ouro, [(0, 0), (0.07, 0), (0.07, 0.03), (0.02, 0.05), (0.015, 0.14), (0.05, 0.17), (0.09, 0.24), (0.1, 0.32),
                                   (0.095, 0.33), (0.085, 0.25), (0.045, 0.18), (0, 0.17)], lados=48)
    copias = _copias(taca, [(-0.55, 0.0, 0.53, 0), (0.55, 0.0, 0.97, 0), (-0.1, 0.0, 1.41, 0)])
    return corpo + copias


def janela(x_jogo: float, z_jogo: float, giro: float, cortina_cor: str) -> None:
    """Janela na parede lateral: caixilho com travessas, vidro aceso pela cidade à noite e cortinas presas dos lados."""
    caixilho = material("caixilho", "#E3E1DC", "laca", aspereza=0.3, verniz=0.4)
    noite = material("noite", "#2A4A80", emissao=1.4, aspereza=0.05)
    pano = material("cortina-janela", cortina_cor, "veludo", aspereza=0.7, fibra=0.9, repete=1.5)
    centro = jogo(x_jogo, 0, z_jogo)
    pecas = [caixa("janela-vidro", noite, (1.6, 0.02, 1.7), pos=(0, 0.02, 1.65))]
    for x in (-0.82, -0.27, 0.27, 0.82):
        pecas.append(caixa("janela-montante", caixilho, (0.05, 0.08, 1.8), pos=(x, 0, 1.65), chanfro=0.008, seg=2))
    for z in (0.78, 1.35, 1.95, 2.52):
        pecas.append(caixa("janela-travessa", caixilho, (1.7, 0.08, 0.05), pos=(0, 0, z), chanfro=0.008, seg=2))
    pecas.append(caixa("janela-peitoril", caixilho, (1.9, 0.22, 0.05), pos=(0, -0.08, 0.76), chanfro=0.012, seg=3))
    for s in (-1, 1):
        pecas.append(cortina("janela-cortina", pano, 0.7, 2.7, pregas=7, fundo=0.06, pos=(s * 1.05, -0.12, 0.05), puxada=0.4 * s))
    for p in modelos(*pecas, heroi=True):
        from ..formas import instancia

        instancia(p, centro, giro)


def relogio(x_jogo: float, y_jogo: float, z_jogo: float) -> None:
    """O relógio do corredor (pista do enigma da linha do tempo): caixa torneada, mostrador aceso e ponteiros."""
    aro = material("relogio-aro", "#2A2E34", metal=0.9, aspereza=0.3)
    mostrador = material("relogio-mostrador", "#F4F1EA", emissao=0.4, aspereza=0.4)
    centro = jogo(x_jogo, y_jogo, z_jogo)
    pecas = [torneado("relogio-caixa", aro, [(0, 0), (0.24, 0), (0.25, 0.02), (0.24, 0.06), (0.22, 0.07), (0, 0.07)], lados=64,
                      pos=centro, giro=(90, 0, 0)),
             cilindro("relogio-mostrador", mostrador, 0.215, 0.01, pos=(centro[0], centro[1] - 0.07, centro[2]), giro=(90, 0, 0), lados=64)]
    for i in range(12):
        a = 2 * math.pi * i / 12
        pecas.append(caixa("relogio-marca", aro, (0.012, 0.006, 0.04), pos=(centro[0] + 0.18 * math.sin(a), centro[1] - 0.078,
                                                                         centro[2] + 0.18 * math.cos(a)), giro=(0, -math.degrees(a), 0)))
    pecas.append(caixa("relogio-hora", aro, (0.014, 0.006, 0.11), pos=(centro[0] + 0.04, centro[1] - 0.082, centro[2] + 0.03), giro=(0, -50, 0)))
    pecas.append(caixa("relogio-minuto", aro, (0.01, 0.006, 0.16), pos=(centro[0] - 0.02, centro[1] - 0.084, centro[2] + 0.075), giro=(0, 15, 0)))
