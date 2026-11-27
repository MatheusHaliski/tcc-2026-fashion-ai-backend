"""Peças de jogo do Fashion Detective em alta densidade: coluna canelada, armário de portas almofadadas e porta com
batente. Cada peça é modelada uma vez na origem (frente em -y do Blender, +z do jogo), marcada como herói quando passa
do teto comum, e posta nos pontos do servidor com ``em_ponto`` (a mesma regra de ``contraParede`` da sala procedural).
"""
from __future__ import annotations

import math

import bmesh
import bpy

from scripts.blender3d.core import _objeto, caixa, cilindro, torneado

from ..formas import esconder_modelo, instancia, jogo, varrer
from ..materiais import material


def contra_parede(x: float, z: float) -> tuple[float, float, float]:
    """A mesma regra de components/flair/detetive/sala-3d.tsx: o objeto se afasta do ponto para a borda mais perto."""
    if abs(x) >= 2.5:
        return x + math.copysign(0.9, x), z, -90.0 if x > 0 else 90.0
    return (x, z + 0.9, 180.0) if z > 1 else (x, z - 0.9, 0.0)


def em_ponto(pecas: list[bpy.types.Object], x: float, z: float, giro_extra: float = 0.0) -> None:
    px, pz, giro = contra_parede(x, z)
    for peca in pecas:
        instancia(peca, jogo(px, 0, pz), giro + giro_extra)


def modelos(*objetos: bpy.types.Object, heroi: bool = False) -> list[bpy.types.Object]:
    """Tira os modelos da cena (ficam só as cópias) e marca os heróis."""
    for o in objetos:
        if heroi:
            o["heroi"] = True
        esconder_modelo(o)
    return list(objetos)


def fuste(nome: str, mat, raio_base: float, raio_topo: float, altura: float, caneluras: int = 20, lados: int = 160,
          aneis: int = 24, fundo: float = 0.022) -> bpy.types.Object:
    """Fuste de coluna com caneluras (sulcos verticais de seção redonda) e leve êntase."""
    bm = bmesh.new()
    camadas = []
    for j in range(aneis + 1):
        v = j / aneis
        raio = raio_base + (raio_topo - raio_base) * v + 0.012 * math.sin(math.pi * v)
        anel = []
        for i in range(lados):
            a = 2 * math.pi * i / lados
            sulco = max(0.0, math.cos(caneluras * a)) ** 2.5
            r = raio - fundo * sulco
            anel.append(bm.verts.new((r * math.cos(a), r * math.sin(a), altura * v)))
        camadas.append(anel)
    for baixo, cima in zip(camadas, camadas[1:]):
        for i in range(lados):
            bm.faces.new((baixo[i], baixo[(i + 1) % lados], cima[(i + 1) % lados], cima[i]))
    bm.faces.new(camadas[-1])
    return _objeto(bm, nome, mat, (0, 0, 0), (0, 0, 0), liso=True)


def coluna(cor: str, altura: float = 3.2) -> list[bpy.types.Object]:
    pedra = material("coluna-pedra", cor, "marmore", aspereza=0.3, repete=0.6)
    plinto = caixa("coluna-plinto", pedra, (0.86, 0.86, 0.14), pos=(0, 0, 0.07), chanfro=0.012, seg=3)
    base = torneado("coluna-base", pedra, [(0.4, 0.14), (0.41, 0.17), (0.4, 0.2), (0.36, 0.22), (0.37, 0.25), (0.35, 0.28),
                                           (0.34, 0.3), (0, 0.3)], lados=96)
    corpo = fuste("coluna-fuste", pedra, 0.34, 0.3, altura - 0.62)
    corpo.location.z = 0.3
    capitel = torneado("coluna-capitel", pedra, [(0, altura - 0.32), (0.3, altura - 0.32), (0.32, altura - 0.29),
                                                 (0.36, altura - 0.24), (0.42, altura - 0.18), (0.43, altura - 0.16), (0, altura - 0.16)], lados=96)
    abaco = caixa("coluna-abaco", pedra, (0.9, 0.9, 0.16), pos=(0, 0, altura - 0.08), chanfro=0.015, seg=3)
    return modelos(plinto, base, corpo, capitel, abaco, heroi=True)


def armario(madeira_cor: str, latao_cor: str = "#B8903E", larg: float = 1.0, alt: float = 1.0, fundo: float = 0.5,
            prefixo: str = "armario") -> list[bpy.types.Object]:
    """Armário baixo: caixa chanfrada, tampo com moldura, duas portas almofadadas, gaveta, pés torneados e puxadores."""
    madeira = material(f"{prefixo}-madeira", madeira_cor, "madeira", aspereza=0.38, verniz=0.5, repete=1.5)
    latao = material("latao", latao_cor, metal=1.0, aspereza=0.28)
    pecas = [caixa(f"{prefixo}-corpo", madeira, (larg - 0.04, fundo - 0.04, alt - 0.14), pos=(0, 0, 0.08 + (alt - 0.14) / 2),
                   chanfro=0.01, seg=3)]
    pecas.append(caixa(f"{prefixo}-tampo", madeira, (larg + 0.04, fundo + 0.02, 0.04), pos=(0, 0, alt - 0.02), chanfro=0.012, seg=4))
    perfil = [(0, 0), (0.02, 0), (0.026, 0.01), (0.02, 0.02), (0.024, 0.03), (0, 0.035)]
    pecas.append(varrer(f"{prefixo}-friso", madeira, perfil, [(-larg / 2, -fundo / 2, alt - 0.075), (larg / 2, -fundo / 2, alt - 0.075)]))
    gaveta_z, portas_alt = alt - 0.24, alt - 0.48
    pecas.append(caixa(f"{prefixo}-gaveta", madeira, (larg - 0.12, 0.03, 0.16), pos=(0, -fundo / 2 + 0.005, gaveta_z),
                       chanfro=0.008, seg=3))
    for lado in (-1, 1):
        x = lado * (larg - 0.12) / 4
        pecas.append(caixa(f"{prefixo}-porta", madeira, ((larg - 0.16) / 2, 0.025, portas_alt), pos=(x, -fundo / 2 + 0.005, 0.12 + portas_alt / 2),
                           chanfro=0.006, seg=2))
        pecas.append(caixa(f"{prefixo}-almofada", madeira, ((larg - 0.16) / 2 - 0.12, 0.03, portas_alt - 0.14),
                           pos=(x, -fundo / 2 - 0.004, 0.12 + portas_alt / 2), chanfro=0.016, seg=4))
        pecas.append(torneado(f"{prefixo}-puxador", latao, [(0, 0), (0.008, 0), (0.006, 0.02), (0.016, 0.034), (0.012, 0.044), (0, 0.046)],
                              pos=(lado * 0.05, -fundo / 2 - 0.01, 0.12 + portas_alt * 0.6), giro=(90, 0, 0), lados=20))
        for frente in (-1, 1):
            pecas.append(torneado(f"{prefixo}-pe", madeira, [(0, 0), (0.022, 0), (0.028, 0.03), (0.02, 0.06), (0.03, 0.08), (0, 0.08)],
                                  pos=(lado * (larg / 2 - 0.06), frente * (fundo / 2 - 0.06), 0), lados=24))
    pecas.append(torneado(f"{prefixo}-puxador-gaveta", latao, [(0, 0), (0.008, 0), (0.006, 0.02), (0.016, 0.034), (0.012, 0.044), (0, 0.046)],
                          pos=(0, -fundo / 2 - 0.01, gaveta_z), giro=(90, 0, 0), lados=20))
    return modelos(*pecas)


def porta(madeira_cor: str, batente_cor: str, larg: float = 1.3, alt: float = 2.3) -> list[bpy.types.Object]:
    """Porta de seis almofadas com batente em perfil (meia-esquadria), soleira, maçaneta de alavanca e dobradiças."""
    madeira = material("porta-madeira", madeira_cor, "madeira", aspereza=0.4, verniz=0.35, repete=1.2)
    batente = material("porta-batente", batente_cor, "laca", aspereza=0.3, verniz=0.4)
    latao = material("latao", "#B8903E", metal=1.0, aspereza=0.28)
    folha = caixa("porta-folha", madeira, (larg - 0.1, 0.05, alt - 0.04), pos=(0, 0, alt / 2), chanfro=0.006, seg=2)
    almofada = caixa("porta-almofada", madeira, (0.42, 0.03, 0.56), chanfro=0.02, seg=4)
    pecas = [folha, almofada]
    perfil = [(0, 0), (0.03, 0), (0.04, 0.012), (0.055, 0.02), (0.07, 0.026), (0.085, 0.028), (0.085, 0), (0, 0)]
    pecas.append(varrer("porta-batente", batente, perfil, [(-larg / 2, 0, 0), (-larg / 2, 0, alt), (larg / 2, 0, alt), (larg / 2, 0, 0)],
                        normal=(0, -1, 0)))
    pecas.append(caixa("porta-soleira", batente, (larg + 0.2, 0.16, 0.025), pos=(0, -0.04, 0.012), chanfro=0.006, seg=2))
    pecas.append(torneado("porta-espelho", latao, [(0, 0), (0.035, 0), (0.035, 0.008), (0.02, 0.014), (0, 0.014)], lados=24,
                          pos=(larg / 2 - 0.16, -0.025, 1.05), giro=(90, 0, 0)))
    pecas.append(cilindro("porta-alavanca", latao, 0.011, 0.13, pos=(larg / 2 - 0.21, -0.065, 1.05), giro=(0, 90, 0), lados=16, chanfro=0.003))
    for z in (0.35, alt - 0.35):
        pecas.append(cilindro("porta-dobradica", latao, 0.012, 0.1, pos=(-larg / 2 + 0.06, -0.03, z), lados=14, chanfro=0.002))
    esconder_modelo(almofada)
    copias = []
    for fila, z in enumerate((0.45, 1.13, 1.81)):
        for x in (-0.25, 0.25):
            copias.append(instancia(almofada, (x, -0.035, z + (0.06 if fila == 2 else 0))))
    for o in copias:
        o.parent = None
    return modelos(folha, *pecas[2:]) + [_grupo_de_almofadas(copias)]


def _grupo_de_almofadas(copias: list[bpy.types.Object]) -> bpy.types.Object:
    """As seis almofadas viram uma peça só (junto com a folha, a porta inteira é instanciada nas saídas da sala)."""
    from ..formas import juntar

    peca = juntar(copias, "porta-almofadas")
    esconder_modelo(peca)
    return peca
