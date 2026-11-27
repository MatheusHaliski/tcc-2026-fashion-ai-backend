"""Peças de gala usadas em várias salas do caso: tapete com pedestais e cordões de veludo, palco com cortina pregueada
e o fundo de cortina (o pano de boca do palco do brinde e o fundo da passarela)."""
from __future__ import annotations

import math

from scripts.blender3d.core import caixa, torneado

from ..formas import cortina, esconder_modelo, instancia, jogo, varrer
from ..materiais import material

CIRCULO = [(0.018 * math.cos(2 * math.pi * i / 12), 0.018 * math.sin(2 * math.pi * i / 12)) for i in range(13)]


def tapete(cor: str, largura: float, de_z: float, ate_z: float, x: float = 0.0) -> None:
    carpete = material("tapete", cor, "carpete", aspereza=0.95, fibra=0.5, repete=2)
    caixa("tapete", carpete, (largura, ate_z - de_z, 0.016), pos=jogo(x, 0.008, (de_z + ate_z) / 2), chanfro=0.006, seg=3)


def pedestais(z_de: float, z_ate: float, n: int, x: float, cordao: str = "#8E1630") -> None:
    """Pedestais de latão em fila (x fixo) com o cordão de veludo pendendo em catenária entre eles."""
    latao = material("latao", "#B8903E", metal=1.0, aspereza=0.28)
    veludo = material("cordao", cordao, "veludo", aspereza=0.7, fibra=0.9, repete=4)
    poste = torneado("pedestal", latao, [(0, 0), (0.16, 0), (0.17, 0.012), (0.16, 0.03), (0.04, 0.05), (0.022, 0.08), (0.02, 0.9),
                                         (0.03, 0.91), (0.026, 0.93), (0.04, 0.96), (0.035, 0.99), (0, 1.0)], lados=48)
    poste["heroi"] = True
    passo = (z_ate - z_de) / (n - 1)
    pontos = []
    for i in range(17):
        t = i / 16
        pontos.append((0, -t * abs(passo), 0.92 - 0.22 * (1 - (2 * t - 1) ** 2)))
    corda = varrer("cordao", veludo, CIRCULO, pontos)
    esconder_modelo(poste)
    esconder_modelo(corda)
    for i in range(n):
        z = z_de + i * passo
        instancia(poste, jogo(x, 0, z))
        if i < n - 1:
            instancia(corda, jogo(x, 0, z), 0 if passo < 0 else 180)


def palco_com_cortina(cx: float, cz: float, largura: float, fundo: float, giro: float, cor_cortina: str,
                      altura_palco: float = 0.32) -> None:
    """Tablado com frente em perfil, degrau, e cortina pregueada atrás, presa por bandôs (giro: para onde olha)."""
    madeira = material("palco", "#3A2418", "madeira", aspereza=0.35, verniz=0.6, repete=1)
    pano = material("cortina", cor_cortina, "veludo", aspereza=0.75, fibra=0.9, repete=1.5)
    latao = material("latao", "#B8903E", metal=1.0, aspereza=0.28)
    meio = jogo(cx, 0, cz)
    pecas = [caixa("palco-tablado", madeira, (largura, fundo, altura_palco), pos=(0, 0, altura_palco / 2), chanfro=0.02, seg=4),
             caixa("palco-degrau", madeira, (largura * 0.5, 0.3, altura_palco / 2), pos=(0, -fundo / 2 - 0.15, altura_palco / 4),
                   chanfro=0.015, seg=3)]
    friso = [(0, 0), (0.025, 0), (0.035, 0.015), (0.03, 0.03), (0.04, 0.045), (0, 0.05)]
    pecas.append(varrer("palco-friso", latao, friso, [(-largura / 2, -fundo / 2, altura_palco - 0.05), (largura / 2, -fundo / 2, altura_palco - 0.05)]))
    pecas.append(cortina("palco-cortina", pano, largura * 0.5, 2.8, pregas=10, fundo=0.08, pos=(-largura * 0.27, fundo / 2 - 0.1, altura_palco),
                         puxada=0.45))
    pecas.append(cortina("palco-cortina-2", pano, largura * 0.5, 2.8, pregas=10, fundo=0.08, pos=(largura * 0.27, fundo / 2 - 0.1, altura_palco),
                         puxada=-0.45))
    pecas.append(cortina("palco-bando", pano, largura + 0.1, 0.45, pregas=16, fundo=0.05, pos=(0, fundo / 2 - 0.25, altura_palco + 2.6)))
    pecas.append(caixa("palco-fundo", pano, (largura, 0.03, 2.8), pos=(0, fundo / 2 - 0.02, altura_palco + 1.4)))
    microfone = torneado("palco-microfone", latao, [(0, 0), (0.12, 0), (0.12, 0.015), (0.015, 0.03), (0.01, 1.4), (0.025, 1.42),
                                                     (0.03, 1.5), (0.02, 1.56), (0, 1.57)], lados=32, pos=(0, -fundo / 4, altura_palco))
    pecas.append(microfone)
    for p in pecas:
        p["heroi"] = True
        esconder_modelo(p)
        instancia(p, meio, giro)
