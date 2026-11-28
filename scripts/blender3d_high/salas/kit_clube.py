"""Peças do Clube underground em alta densidade: balcão de bar com prateleira de garrafas, pista de LED em ladrilhos,
globo espelhado de facetas, letreiro de neon em tubo e painel acústico capitonê."""
from __future__ import annotations

import math

import bmesh
import bpy

from scripts.blender3d.core import _objeto, caixa, torneado

from ..formas import capitone, esconder_modelo, instancia, jogo, varrer
from ..materiais import material
from .kit_atelie import _copias
from .kit_pecas import modelos

TUBO = [(0.012 * math.cos(2 * math.pi * i / 10), 0.012 * math.sin(2 * math.pi * i / 10)) for i in range(11)]


def bar(comprimento: float = 2.2) -> list[bpy.types.Object]:
    """Balcão de frente curva (perfil varrido), tampo de pedra com borda, faixa de luz embaixo e a prateleira de trás
    com três fileiras de garrafas torneadas (cópias)."""
    pedra = material("bar-tampo", "#1C1C22", "marmore", aspereza=0.15, verniz=0.8, repete=0.8)
    frente = material("bar-frente", "#2A2230", "veludo", aspereza=0.6, fibra=0.6, repete=2)
    luz = material("bar-luz", "#E040A0", emissao=5.0)
    meio = comprimento / 2
    perfil = [(0, 0), (0.05, 0), (0.12, 0.2), (0.14, 0.6), (0.12, 0.95), (0.05, 1.02), (0, 1.02)]
    corpo = varrer("bar-frente", frente, perfil, [(-meio, 0, 0), (meio, 0, 0)])
    pecas = [corpo, caixa("bar-tampo", pedra, (comprimento + 0.1, 0.6, 0.05), pos=(0, -0.05, 1.07), chanfro=0.015, seg=4),
             caixa("bar-luz", luz, (comprimento - 0.1, 0.02, 0.02), pos=(0, -0.13, 0.08)),
             caixa("bar-prateleira", material("bar-madeira", "#3A2418", "madeira", aspereza=0.4, verniz=0.4), (comprimento, 0.25, 0.03),
                   pos=(0, 0.62, 1.45), chanfro=0.006, seg=2),
             caixa("bar-prateleira-2", material("bar-madeira", "#3A2418"), (comprimento, 0.25, 0.03), pos=(0, 0.62, 1.85), chanfro=0.006, seg=2)]
    garrafas = []
    for i, (cor, alt) in enumerate((("#2E5A2E", 0.3), ("#6A3A1A", 0.26), ("#C8D8E0", 0.32))):
        vidro = material(f"garrafa-{i}", cor, metal=0.0, aspereza=0.05, verniz=1.0)
        garrafas.append(torneado(f"garrafa-{i}", vidro, [(0, 0), (0.035, 0), (0.038, 0.01), (0.038, alt * 0.6), (0.03, alt * 0.7),
                                                          (0.012, alt * 0.8), (0.012, alt), (0.014, alt + 0.005), (0, alt + 0.01)], lados=32))
    copias = []
    for n, z in enumerate((1.465, 1.865)):
        lugares = [(-meio + 0.12 + k * 0.105, 0.62, z, 0) for k in range(int((comprimento - 0.2) / 0.105))]
        for k, lugar in enumerate(lugares):
            copias += _copias_uma(garrafas[(k + n) % 3], lugar)
    for g in garrafas:
        esconder_modelo(g)
    return modelos(*pecas, heroi=True) + copias


def _copias_uma(modelo: bpy.types.Object, lugar) -> list[bpy.types.Object]:
    x, y, z, g = lugar
    c = instancia(modelo, (x, y, z), g)
    bpy.context.scene.collection.objects.unlink(c)
    return [c]


def pista_de_led(lado: int = 5, passo: float = 0.62) -> None:
    """Pista de dança: ladrilhos chanfrados de vidro aceso em duas cores, com a junta escura (cópias)."""
    cores = [material("led-rosa", "#E040A0", emissao=2.2, aspereza=0.1, verniz=1.0),
             material("led-ciano", "#30C8E0", emissao=2.2, aspereza=0.1, verniz=1.0),
             material("led-apagado", "#1A1620", aspereza=0.1, verniz=1.0)]
    ladrilhos = [caixa(f"ladrilho-{i}", m, (passo - 0.03, passo - 0.03, 0.03), chanfro=0.008, seg=3) for i, m in enumerate(cores)]
    for t in ladrilhos:
        esconder_modelo(t)
    for i in range(lado):
        for j in range(lado):
            k = (i * 3 + j * 7) % 5
            modelo = ladrilhos[0 if k in (0, 3) else 1 if k == 1 else 2]
            instancia(modelo, jogo((i - (lado - 1) / 2) * passo, 0.015, (j - (lado - 1) / 2) * passo))


def globo(pos_jogo, raio: float = 0.28) -> None:
    """Globo espelhado: icosfera subdividida com facetas planas, cada faceta um espelhinho, e o cabo."""
    espelho = material("globo", "#E8ECF2", metal=1.0, aspereza=0.06)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=4, radius=raio)
    obj = _objeto(bm, "globo", espelho, jogo(*pos_jogo), (0, 0, 0), liso=False)
    obj["heroi"] = True
    topo = jogo(pos_jogo[0], pos_jogo[1] + raio, pos_jogo[2])
    varrer("globo-cabo", material("cabo", "#1A1A1E"), [(0.004 * math.cos(a), 0.004 * math.sin(a)) for a in [i * math.pi / 3 for i in range(7)]],
           [topo, (topo[0], topo[1], topo[2] + 3.4 - pos_jogo[1] - raio)])


def neon(pontos_jogo: list[tuple[float, float, float]], cor: str, nome: str = "neon") -> None:
    """Tubo de neon aceso seguindo os pontos (letreiro, faixa na parede)."""
    varrer(nome, material(f"neon-{cor}", cor, emissao=8.0), TUBO, [jogo(*p) for p in pontos_jogo])


def painel_acustico(cor: str, lugares: list[tuple[float, float, float, float]]) -> None:
    """Painéis capitonê de veludo na parede (cópias): (x, y, z, giro) no espaço do jogo."""
    painel = capitone("painel-acustico", material("acustico", cor, "veludo", aspereza=0.7, fibra=0.9, repete=2), 1.1, 1.3, 0.08,
                      botoes=(4, 4), resolucao=8)
    painel["heroi"] = True
    for c in _copias(painel, [(*jogo(x, y, z), g) for x, y, z, g in lugares]):
        bpy.context.scene.collection.objects.link(c)
