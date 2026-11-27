"""Portas do kit da mansão, cada uma um modelo próprio: folha dupla com vidro (salão), porta de biblioteca com
almofadas entalhadas, porta de serviço, a PORTA DOS FUNDOS (peça-herói trancada, com fechadura grande, ferrolho e
cadeado) e o portão de ferro forjado do jardim. As folhas saem como nós próprios (``folha``, ``folha-esq``,
``folha-dir``) com o pivô na dobradiça, para o jogo abrir girando."""
from __future__ import annotations

import math

import bpy
from mathutils import Matrix

from scripts.blender3d.core import caixa, cilindro, esfera, toro, torneado

from ..formas import esconder_modelo, instancia, juntar, varrer
from . import acabamentos as a
from .pecas import peca

BATENTE = [(0, 0), (0.035, 0), (0.045, 0.012), (0.06, 0.02), (0.075, 0.03), (0.095, 0.034), (0.095, 0), (0, 0)]


def _folha(partes: list, nome: str, dobradica: tuple[float, float, float]) -> bpy.types.Object:
    """Funde as partes da folha num nó com o pivô na dobradiça (o jogo gira esse nó para abrir)."""
    folha = juntar(partes, nome)
    folha.data.transform(Matrix.Translation([-c for c in dobradica]))
    folha.location = dobradica
    return folha


def _batente(dono: str, larg: float, alt: float, mat) -> None:
    varrer(f"{dono}-batente", mat, BATENTE, [(-larg / 2, 0, 0), (-larg / 2, 0, alt), (larg / 2, 0, alt), (larg / 2, 0, 0)], normal=(0, -1, 0))
    caixa(f"{dono}-soleira", mat, (larg + 0.22, 0.18, 0.03), pos=(0, -0.05, 0.015), chanfro=0.008, seg=3)


def _macaneta(nome: str, metal, x: float, y: float, z: float, lado: int = 1) -> list:
    espelho = caixa(f"{nome}-espelho", metal, (0.05, 0.012, 0.24), pos=(x, y, z), chanfro=0.006, seg=3)
    alavanca = varrer(f"{nome}-alavanca", metal, [(0.009 * math.cos(t), 0.009 * math.sin(t)) for t in [i * math.pi / 6 for i in range(13)]],
                      [(x, y, z + 0.04), (x, y - 0.05, z + 0.04), (x - lado * 0.12, y - 0.06, z + 0.03)])
    chave = cilindro(f"{nome}-entrada", a.ebano(nome), 0.007, 0.014, pos=(x, y - 0.006, z - 0.07), giro=(90, 0, 0), lados=12)
    return [espelho, alavanca, chave]


@peca("porta-salao-dupla", "Porta dupla do salão com vidro bisotado", "piso", ("salao-baile", "hall", "jantar"), papel="porta")
def porta_salao() -> None:
    madeira = a.pintado("porta-salao", "#F2EDE2")
    ouro = a.dourado("porta-salao")
    vidro = a.vidro("porta-salao", "#DDEBF0")
    larg, alt = 1.8, 2.7
    _batente("porta-salao", larg, alt, ouro)
    caixa("porta-salao-bandeira", madeira, (larg + 0.3, 0.08, 0.35), pos=(0, 0.02, alt + 0.2), chanfro=0.02, seg=4)
    torneado("porta-salao-concha", ouro, [(0, 0), (0.16, 0), (0.12, 0.06), (0.05, 0.1), (0, 0.11)], lados=48, pos=(0, -0.03, alt + 0.2),
             giro=(90, 0, 0))
    for s, nome in ((-1, "folha-esq"), (1, "folha-dir")):
        cx = s * larg / 4
        partes = [caixa(f"{nome}-quadro", madeira, (larg / 2 - 0.02, 0.05, alt - 0.02), pos=(cx, 0, alt / 2), chanfro=0.008, seg=2)]
        for fila in range(5):
            for col in range(2):
                x = cx + (col - 0.5) * 0.36
                z = 0.95 + fila * 0.34
                partes.append(caixa(f"{nome}-vidro", vidro, (0.3, 0.056, 0.28), pos=(x, 0, z), chanfro=0.01, seg=2))
        partes.append(caixa(f"{nome}-almofada", madeira, (larg / 2 - 0.2, 0.065, 0.55), pos=(cx, 0, 0.42), chanfro=0.03, seg=4))
        partes += _macaneta(nome, ouro, cx - s * (larg / 4 - 0.1), -0.03, 1.05, -s)
        _folha(partes, nome, (s * larg / 2, 0, 0))


@peca("porta-biblioteca", "Porta de nogueira da biblioteca com almofadas entalhadas", "piso", ("biblioteca", "escritorio"), papel="porta")
def porta_biblioteca() -> None:
    madeira = a.nogueira("porta-biblioteca", "#3E2414")
    latao = a.latao_velho("porta-biblioteca")
    larg, alt = 1.1, 2.4
    _batente("porta-biblioteca", larg, alt, madeira)
    partes = [caixa("folha-corpo", madeira, (larg - 0.04, 0.055, alt - 0.02), pos=(0, 0, alt / 2), chanfro=0.006, seg=2)]
    friso = [(-0.012, 0), (-0.01, 0.006), (0, 0.012), (0.01, 0.006), (0.012, 0)]
    for (z, h) in ((0.25, 0.5), (0.9, 0.62), (1.67, 0.6)):
        for x in (-0.24, 0.24):
            partes.append(caixa("almofada", madeira, (0.34, 0.07, h - 0.08), pos=(x, 0, z + h / 2), chanfro=0.025, seg=4))
            w, hh = 0.21, h / 2
            partes.append(varrer("entalhe", madeira, friso, [(x - w, -0.03, z + hh - hh), (x + w, -0.03, z), (x + w, -0.03, z + h),
                                                              (x - w, -0.03, z + h)], fechado=True, normal=(0, -1, 0)))
    partes.append(torneado("macaneta", latao, [(0, 0), (0.03, 0), (0.03, 0.01), (0.012, 0.03), (0.012, 0.05), (0.035, 0.065),
                                                (0.03, 0.08), (0, 0.085)], lados=32, pos=(larg / 2 - 0.12, -0.03, 1.0), giro=(90, 0, 0)))
    partes.append(caixa("espelho", latao, (0.07, 0.008, 0.16), pos=(larg / 2 - 0.12, -0.03, 0.97), chanfro=0.008, seg=3))
    _folha(partes, "folha", (-larg / 2, 0, 0))


@peca("porta-servico", "Porta de serviço lisa com chapa de chute", "piso", ("qualquer",), papel="porta")
def porta_servico() -> None:
    tinta = a.pintado("porta-servico", "#8A9488")
    aco = a.cromo("porta-servico")
    larg, alt = 0.9, 2.1
    _batente("porta-servico", larg, alt, a.pintado("porta-servico-batente", "#D8D4CA"))
    partes = [caixa("folha-corpo", tinta, (larg - 0.03, 0.045, alt - 0.02), pos=(0, 0, alt / 2), chanfro=0.004, seg=2),
              caixa("chute", aco, (larg - 0.1, 0.05, 0.25), pos=(0, -0.002, 0.15), chanfro=0.003, seg=2),
              torneado("macaneta", aco, [(0, 0), (0.028, 0), (0.028, 0.008), (0.01, 0.02), (0.01, 0.045), (0.028, 0.055), (0, 0.065)],
                       lados=24, pos=(larg / 2 - 0.08, -0.025, 1.0), giro=(90, 0, 0))]
    _folha(partes, "folha", (-larg / 2, 0, 0))


@peca("porta-dos-fundos", "Porta dos fundos trancada (herói): ferragens, ferrolho e cadeado", "piso", ("qualquer",), papel="porta")
def porta_dos_fundos() -> None:
    carvalho = a.carvalho("porta-fundos", "#5A3A20")
    ferro = a.ferro("porta-fundos")
    latao = a.latao_velho("porta-fundos", "#A8823A")
    brilho = a.luz("porta-fundos-fechadura", "#FFB040", 2.5)
    larg, alt = 1.2, 2.5
    pedra = a.marmore("porta-fundos-pedra", "#8A8478")
    for s in (-1, 1):
        caixa(f"ombreira-{s}", pedra, (0.28, 0.32, alt + 0.2), pos=(s * (larg / 2 + 0.14), 0.04, (alt + 0.2) / 2), chanfro=0.03, seg=3)
    caixa("verga", pedra, (larg + 0.56, 0.32, 0.3), pos=(0, 0.04, alt + 0.35), chanfro=0.03, seg=3)
    partes = []
    for i in range(6):                                              # tábuas verticais com junta
        x = -larg / 2 + (i + 0.5) * larg / 6
        partes.append(caixa("tabua", carvalho, (larg / 6 - 0.008, 0.07, alt - 0.02), pos=(x, 0, alt / 2), chanfro=0.008, seg=2))
    rebite = esfera("rebite", ferro, 0.012, escala=(1, 0.6, 1), lados=10)
    esconder_modelo(rebite)
    for z in (0.35, 1.25, 2.15):                                    # três dobradiças de fita com rebites
        partes.append(caixa("fita", ferro, (larg * 0.85, 0.012, 0.08), pos=(-larg * 0.075, -0.042, z), chanfro=0.004, seg=2))
        for k in range(9):
            partes.append(instancia(rebite, (-larg / 2 + 0.08 + k * 0.11, -0.05, z)))
    for k in range(6):
        for z in (0.8, 1.7):
            partes.append(instancia(rebite, (-larg / 2 + 0.1 + k * 0.2, -0.04, z)))
    # a fechadura: caixa de latão grande com espelho, entrada de chave acesa (brilho fraco) e argola de ferro
    partes.append(caixa("fechadura", latao, (0.22, 0.06, 0.3), pos=(larg / 2 - 0.2, -0.07, 1.05), chanfro=0.012, seg=4))
    partes.append(torneado("espelho-chave", latao, [(0, 0), (0.06, 0), (0.065, 0.01), (0.04, 0.02), (0, 0.02)], lados=48,
                           pos=(larg / 2 - 0.2, -0.1, 1.02), giro=(90, 0, 0)))
    partes.append(caixa("buraco-chave", brilho, (0.018, 0.01, 0.05), pos=(larg / 2 - 0.2, -0.121, 1.02)))
    partes.append(esfera("buraco-chave-topo", brilho, 0.014, (larg / 2 - 0.2, -0.121, 1.05), lados=12))
    partes.append(toro("argola", ferro, 0.07, 0.012, pos=(larg / 2 - 0.2, -0.11, 1.25), giro=(90, 0, 0), lados=32, lados_tubo=10))
    partes.append(caixa("ferrolho", ferro, (0.5, 0.04, 0.05), pos=(larg / 2 - 0.05, -0.08, 1.45), chanfro=0.008, seg=2))
    _folha(partes, "folha", (-larg / 2, 0, 0))
    # o cadeado no ferrolho, preso à ombreira (fica no batente: a folha só gira depois de soltá-lo)
    toro("cadeado-arco", ferro, 0.04, 0.01, pos=(larg / 2 + 0.06, -0.1, 1.5), giro=(90, 0, 0), lados=24, lados_tubo=10)
    caixa("cadeado", latao, (0.1, 0.05, 0.11), pos=(larg / 2 + 0.06, -0.1, 1.42), chanfro=0.015, seg=4)
    caixa("cadeado-chave", brilho, (0.012, 0.01, 0.03), pos=(larg / 2 + 0.06, -0.126, 1.41))


@peca("portao-ferro", "Portão de ferro forjado com volutas, lanças e fechadura", "piso", ("jardim",), papel="porta")
def portao_ferro() -> None:
    ferro = a.ferro("portao")
    ouro = a.dourado("portao-ponteiras", "#B8903E")
    pedra = a.marmore("portao-pilar", "#B8B0A0")
    larg, alt = 2.4, 2.3
    for s in (-1, 1):
        caixa(f"pilar-{s}", pedra, (0.45, 0.45, alt + 0.4), pos=(s * (larg / 2 + 0.24), 0, (alt + 0.4) / 2), chanfro=0.02, seg=3)
        torneado(f"pinha-{s}", pedra, [(0, 0), (0.25, 0), (0.25, 0.06), (0.12, 0.1), (0.15, 0.25), (0.06, 0.38), (0, 0.42)], lados=48,
                 pos=(s * (larg / 2 + 0.24), 0, alt + 0.4))
    barra = [(0.012 * math.cos(t), 0.012 * math.sin(t)) for t in [i * math.pi / 4 for i in range(9)]]
    lanca = torneado("lanca", ouro, [(0, 0), (0.018, 0), (0.03, 0.05), (0, 0.12)], lados=12)
    esconder_modelo(lanca)
    espiral = varrer("voluta", ferro, [(0.008 * x, 0.008 * y) for x, y in ((1, 0), (0, 1), (-1, 0), (0, -1), (1, 0))],
                     [(0.09 * (1 - t / 13) * math.cos(t), 0, 0.09 * (1 - t / 13) * math.sin(t)) for t in [i * 0.3 for i in range(40)]])
    esconder_modelo(espiral)
    for s, nome in ((-1, "folha-esq"), (1, "folha-dir")):
        partes = []
        x0, x1 = (-larg / 2, 0) if s < 0 else (0, larg / 2)
        for z in (0.12, 0.9, alt - 0.25):
            partes.append(varrer("travessa", ferro, barra, [(x0, 0, z), (x1, 0, z)]))
        n = 9
        for k in range(n):
            x = x0 + (k + 0.5) * (x1 - x0) / n
            topo = alt - 0.1 + 0.18 * math.sin(math.pi * (k + 0.5) / n if s > 0 else math.pi * (n - k - 0.5) / n)
            partes.append(varrer("grade", ferro, barra, [(x, 0, 0.05), (x, 0, topo)]))
            partes.append(instancia(lanca, (x, 0, topo)))
            partes.append(instancia(espiral, (x + 0.06, 0, 0.5), 0))
        if s < 0:
            partes.append(caixa("fechadura", ouro, (0.16, 0.08, 0.22), pos=(-0.08, -0.03, 1.1), chanfro=0.012, seg=4))
            partes.append(toro("argola", ferro, 0.06, 0.012, pos=(-0.08, -0.08, 1.0), giro=(90, 0, 0), lados=24, lados_tubo=8))
        _folha(partes, nome, (s * larg / 2, 0, 0))
