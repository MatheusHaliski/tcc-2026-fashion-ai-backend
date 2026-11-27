"""Lustres e arandelas do kit da mansão, um desenho por cômodo: cristal de três andares (hall), imperial com festões de
contas (salão de baile), ferro forjado com velas (biblioteca), art déco de vidro escalonado (sala de jantar e closet).
As lâmpadas e chamas são emissivas (o jogo põe a luz de verdade na peça de papel "luz")."""
from __future__ import annotations

import math

from scripts.blender3d.core import cilindro, esfera, toro, torneado

from ..formas import esconder_modelo, instancia, varrer
from . import acabamentos as a
from .pecas import peca

TUBO = [(math.cos(2 * math.pi * i / 10), math.sin(2 * math.pi * i / 10)) for i in range(11)]


def _tubo(raio: float):
    return [(raio * x, raio * y) for x, y in TUBO]


def _corrente(metal, de_z: float, ate_z: float, elo: float = 0.035) -> None:
    """Corrente de elos alternados (cópias de um elo) do teto até a peça."""
    modelo = toro("elo", metal, elo, elo * 0.18, lados=16, lados_tubo=8, achatado=1.0)
    modelo.scale = (1, 1, 1.5)
    esconder_modelo(modelo)
    n = int((de_z - ate_z) / (elo * 2.2))
    for i in range(n):
        c = instancia(modelo, (0, 0, ate_z + i * elo * 2.2), 90 * (i % 2))
        c.rotation_euler[0] = math.radians(90)


def _bracos(metal, n: int, raio: float, z: float, curva: float, vela, bobeche) -> list[tuple[float, float, float]]:
    """Braços em S (perfil redondo varrido) saindo da coluna, cada um com bobeche e vela; devolve as pontas."""
    pontas = []
    braco = varrer("braco", metal, _tubo(0.011), [(0.05, 0, z), (raio * 0.35, 0, z - curva), (raio * 0.75, 0, z - curva * 0.6),
                                                 (raio, 0, z + 0.02), (raio, 0, z + 0.06)])
    esconder_modelo(braco)
    for i in range(n):
        g = 360 * i / n
        instancia(braco, (0, 0, 0), g)
        x, y = raio * math.cos(math.radians(g)), raio * math.sin(math.radians(g))
        instancia(bobeche, (x, y, z + 0.06), g)
        instancia(vela, (x, y, z + 0.07), g)
        pontas.append((x, y, z))
    return pontas


def _vela(dono: str, altura: float = 0.11):
    cera = a.pintado(f"{dono}-vela", "#F4EEDF")
    chama = a.luz(dono, "#FFD890", 9.0)
    corpo = torneado("vela", cera, [(0, 0), (0.014, 0), (0.014, altura), (0.011, altura + 0.004), (0, altura + 0.004)], lados=20)
    fogo = torneado("chama", chama, [(0, altura + 0.006), (0.008, altura + 0.02), (0.004, altura + 0.04), (0, altura + 0.05)], lados=16)
    esconder_modelo(corpo)
    esconder_modelo(fogo)
    return corpo, fogo


def _gotas(cristal, aneis: list[tuple[float, float, int]]) -> None:
    gota = torneado("gota", cristal, [(0, 0), (0.012, 0.008), (0.018, 0.03), (0.01, 0.055), (0, 0.06)], lados=8)
    esconder_modelo(gota)
    for raio, z, n in aneis:
        for i in range(n):
            ang = 2 * math.pi * i / n
            instancia(gota, (raio * math.cos(ang), raio * math.sin(ang), z - 0.06), 0)


@peca("lustre-cristal", "Lustre de cristal de três andares", "teto", ("hall", "jantar"), papel="luz")
def lustre_cristal() -> None:
    metal = a.dourado("lustre-cristal", "#C9A24A")
    cristal = a.cristal("lustre-cristal")
    torneado("coluna", metal, [(0, -0.75), (0.05, -0.75), (0.07, -0.68), (0.03, -0.6), (0.05, -0.45), (0.03, -0.3), (0.045, -0.1),
                               (0.02, 0), (0, 0)], lados=48, pos=(0, 0, 0))
    for r, z in ((0.55, -0.62), (0.4, -0.42), (0.25, -0.22)):
        toro("aro", metal, r, 0.014, pos=(0, 0, z), lados=96, lados_tubo=12)
    corpo, fogo = _vela("lustre-cristal")
    bobeche = torneado("bobeche", metal, [(0, 0), (0.04, 0), (0.045, 0.01), (0.02, 0.012), (0, 0.012)], lados=24)
    esconder_modelo(bobeche)
    for raio, z, n in ((0.55, -0.62, 12), (0.4, -0.42, 8)):
        _bracos(metal, n, raio, z, 0.12, corpo, bobeche)
        for i in range(n):
            g = 2 * math.pi * i / n
            instancia(fogo, (raio * math.cos(g), raio * math.sin(g), z + 0.07))
    _gotas(cristal, [(0.55, -0.62, 48), (0.4, -0.42, 32), (0.25, -0.22, 20)])
    esfera("pingente", cristal, 0.06, (0, 0, -0.84), escala=(1, 1, 1.4), lados=24)
    _corrente(metal, 0.6, 0.0)
    torneado("canopla", metal, [(0, 0.6), (0.12, 0.6), (0.1, 0.56), (0.03, 0.54), (0, 0.54)], lados=48)


@peca("lustre-imperial", "Lustre imperial com festões de contas", "teto", ("salao-baile",), papel="luz")
def lustre_imperial() -> None:
    metal = a.dourado("lustre-imperial", "#E0B84E")
    cristal = a.cristal("lustre-imperial", 1.2)
    torneado("coluna", metal, [(0, -1.3), (0.08, -1.3), (0.1, -1.2), (0.04, -1.0), (0.08, -0.8), (0.04, -0.5), (0.07, -0.2), (0.02, 0), (0, 0)],
             lados=64)
    conta = esfera("conta", cristal, 0.012, lados=10)
    esconder_modelo(conta)
    for r, z, n in ((0.9, -1.05, 16), (0.65, -0.75, 12), (0.4, -0.45, 8)):
        toro("aro", metal, r, 0.018, pos=(0, 0, z), lados=128, lados_tubo=12)
        for i in range(n):                                         # festões: contas em catenária entre os braços
            g0, g1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
            for k in range(1, 14):
                t = k / 14
                g = g0 + (g1 - g0) * t
                instancia(conta, (r * math.cos(g), r * math.sin(g), z - 0.16 * (1 - (2 * t - 1) ** 2)))
        corpo, fogo = _vela(f"lustre-imperial-{n}", 0.13)
        bobeche = torneado("bobeche", metal, [(0, 0), (0.05, 0), (0.055, 0.012), (0.02, 0.014), (0, 0.014)], lados=24)
        esconder_modelo(bobeche)
        _bracos(metal, n, r, z, 0.15, corpo, bobeche)
        for i in range(n):
            g = 2 * math.pi * i / n
            instancia(fogo, (r * math.cos(g), r * math.sin(g), z + 0.07))
    _gotas(cristal, [(0.9, -1.05, 64), (0.65, -0.75, 48), (0.4, -0.45, 32), (0.15, -1.25, 12)])
    _corrente(metal, 0.5, 0.0, 0.045)


@peca("lustre-ferro-velas", "Lustre de ferro forjado com velas", "teto", ("biblioteca", "escritorio"), papel="luz")
def lustre_ferro() -> None:
    metal = a.ferro("lustre-ferro")
    toro("aro", metal, 0.6, 0.022, pos=(0, 0, -0.7), lados=96, lados_tubo=12, achatado=0.6)
    toro("aro-alto", metal, 0.32, 0.016, pos=(0, 0, -0.35), lados=64, lados_tubo=10)
    corpo, fogo = _vela("lustre-ferro", 0.16)
    prato = torneado("prato", metal, [(0, 0), (0.05, 0), (0.055, 0.015), (0.03, 0.02), (0, 0.02)], lados=20)
    esconder_modelo(prato)
    voluta = varrer("voluta", metal, _tubo(0.009), [(0.6 + 0.08 * math.cos(t) * (1 - t / 9), 0, -0.6 + 0.08 * math.sin(t) * (1 - t / 9))
                                                   for t in [i * 0.35 for i in range(24)]])
    esconder_modelo(voluta)
    for i in range(10):
        g = 36 * i
        x, y = 0.6 * math.cos(math.radians(g)), 0.6 * math.sin(math.radians(g))
        instancia(prato, (x, y, -0.7))
        instancia(corpo, (x, y, -0.68))
        instancia(fogo, (x, y, -0.68))
        instancia(voluta, (0, 0, 0), g)
    for i in range(5):
        g = 2 * math.pi * i / 5
        varrer(f"haste-{i}", metal, _tubo(0.01), [(0, 0, -0.1), (0.32 * math.cos(g), 0.32 * math.sin(g), -0.35),
                                                 (0.6 * math.cos(g), 0.6 * math.sin(g), -0.7)])
    _corrente(metal, 0.0, -0.1, 0.04)
    cilindro("canopla", metal, 0.09, 0.04, pos=(0, 0, 0.02), lados=32, chanfro=0.01)


@peca("lustre-art-deco", "Lustre art déco de vidro escalonado", "teto", ("jantar", "closet"), papel="luz")
def lustre_art_deco() -> None:
    metal = a.latao_velho("lustre-deco", "#B08A3E")
    vidro = a.luz("lustre-deco", "#FFF1D8", 3.5)
    for i, (r, z) in enumerate(((0.5, -0.75), (0.38, -0.62), (0.26, -0.5), (0.14, -0.4))):
        torneado(f"degrau-{i}", vidro, [(0, z - 0.06), (r, z - 0.06), (r, z), (0, z)], lados=8)
        toro(f"friso-{i}", metal, r + 0.004, 0.008, pos=(0, 0, z - 0.03), lados=8, lados_tubo=6, achatado=0.5)
    aleta = torneado("aleta", metal, [(0.0, -0.82), (0.01, -0.82), (0.01, -0.3), (0, -0.3)], lados=4)
    aleta.scale = (0.4, 6.0, 1.0)
    esconder_modelo(aleta)
    for i in range(8):
        instancia(aleta, (0.52 * math.cos(math.pi * i / 4), 0.52 * math.sin(math.pi * i / 4), 0), 45 * i + 90)
    cilindro("haste", metal, 0.012, 0.35, pos=(0, 0, -0.17), lados=16)
    torneado("canopla", metal, [(0, 0), (0.1, 0), (0.1, -0.02), (0.06, -0.04), (0, -0.04)], lados=8)


@peca("arandela-cristal", "Arandela de cristal com dois braços", "parede", ("hall", "salao-baile", "jantar"), papel="luz")
def arandela_cristal() -> None:
    metal = a.dourado("arandela-cristal", "#C9A24A")
    cristal = a.cristal("arandela-cristal")
    torneado("espelho", metal, [(0, 0), (0.07, 0), (0.075, 0.015), (0.05, 0.025), (0, 0.025)], lados=32, giro=(90, 0, 0), pos=(0, 0, 0.3))
    corpo, fogo = _vela("arandela-cristal")
    for s in (-1, 1):
        varrer(f"braco-{s}", metal, _tubo(0.009), [(0, -0.02, 0.28), (s * 0.08, -0.12, 0.22), (s * 0.16, -0.16, 0.26), (s * 0.18, -0.16, 0.32)])
        instancia(corpo, (s * 0.18, -0.16, 0.32))
        instancia(fogo, (s * 0.18, -0.16, 0.32))
        for k in range(5):
            torneado(f"gota-{s}-{k}", cristal, [(0, 0), (0.008, 0.006), (0.012, 0.02), (0, 0.04)], lados=8,
                     pos=(s * 0.18 + 0.03 * math.cos(k), -0.16 + 0.03 * math.sin(k), 0.26))


@peca("arandela-ferro", "Arandela de ferro com lanterna", "parede", ("biblioteca", "escritorio", "jardim"), papel="luz")
def arandela_ferro() -> None:
    metal = a.ferro("arandela-ferro")
    vidro = a.luz("arandela-ferro", "#FFD9A0", 4.0)
    cilindro("chapa", metal, 0.06, 0.012, pos=(0, 0, 0.3), giro=(90, 0, 0), lados=24, chanfro=0.003)
    varrer("braco", metal, _tubo(0.01), [(0, 0, 0.3), (0, -0.12, 0.34), (0, -0.2, 0.3)])
    torneado("lanterna", vidro, [(0, 0.12), (0.06, 0.14), (0.07, 0.26), (0, 0.27)], lados=6, pos=(0, -0.2, 0.0))
    torneado("chapeu", metal, [(0.09, 0.27), (0.05, 0.31), (0.01, 0.34), (0, 0.34)], lados=6, pos=(0, -0.2, 0.0))
    for i in range(6):
        g = math.pi * i / 3
        varrer(f"grade-{i}", metal, _tubo(0.004), [(0.065 * math.cos(g), -0.2 + 0.065 * math.sin(g), 0.13),
                                                   (0.072 * math.cos(g), -0.2 + 0.072 * math.sin(g), 0.27)])
