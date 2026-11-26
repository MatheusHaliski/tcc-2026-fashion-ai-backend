"""O corpo humano leve das pessoas de cena (figurantes de longe, plateia e torcida): gente, não pino.

Uma pessoa em pé, de frente, pés no piso, modelada por seções (quadril, cintura, peito, ombros; coxa, joelho, canela;
queixo, maçãs, testa). Cada objeto começa com o nome da PARTE a que pertence (``tronco-…``, ``bracos-…``, ``maos-…``,
``cabeca-…``, ``rosto-…``, ``cabelo-…``, ``pernas-…``, ``pes-…``): o jogo junta cada parte numa malha instanciada e dá a
ela a cor da roupa, da pele e do cabelo de cada pessoa (components/flair/nucleos/gente/corpo-humano-leve.ts). As cores
daqui valem só na prévia.
"""
from __future__ import annotations

import math

import bpy  # noqa: F401  (antes do bmesh, como em core.py)
import bmesh

from ..core import _objeto, caixa, esfera, material
from . import receita

#: uma seção do corpo: (centro x, centro y, altura z, meia largura, meia profundidade)
Secao = tuple[float, float, float, float, float]


def _secoes(nome: str, mat, secoes: list[Secao], lados: int = 8):
    """Malha fechada que passa pelas seções elípticas, de baixo para cima (tronco, perna, braço, cabeça)."""
    bm = bmesh.new()
    aneis = [[bm.verts.new((cx + rx * math.cos(2 * math.pi * i / lados), cy + ry * math.sin(2 * math.pi * i / lados), z))
              for i in range(lados)] for cx, cy, z, rx, ry in secoes]
    for baixo, cima in zip(aneis, aneis[1:]):
        for i in range(lados):
            bm.faces.new((baixo[i], baixo[(i + 1) % lados], cima[(i + 1) % lados], cima[i]))
    bm.faces.new(list(reversed(aneis[0])))
    bm.faces.new(aneis[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _objeto(bm, nome, mat, (0, 0, 0), (0, 0, 0), liso=True)


@receita("pessoa-leve", "Corpo humano leve das pessoas de cena", categoria="gente")
def pessoa_leve() -> None:
    pele = material("pele", "#C99A7A", aspereza=0.7)
    roupa = material("roupa", "#3E6B74", aspereza=0.85)
    calca = material("calca", "#2A2F3A", aspereza=0.9)
    cabelo = material("cabelo", "#3A2A20", aspereza=0.8)
    escuro = material("traco", "#2A2220", aspereza=0.6)
    sapato = material("sapato", "#1C1C20", aspereza=0.5)

    _secoes("tronco-torso", roupa, [(0, 0, 0.84, 0.15, 0.1), (0, 0, 0.92, 0.172, 0.112), (0, 0, 1.05, 0.142, 0.092),
                                    (0, -0.005, 1.25, 0.176, 0.112), (0, 0, 1.37, 0.19, 0.098), (0, 0, 1.43, 0.125, 0.078),
                                    (0, 0, 1.465, 0.062, 0.058)], lados=10)
    for x in (-1, 1):
        esfera("tronco-ombro", roupa, 0.054, (x * 0.186, 0, 1.372), lados=8)
        # braço solto ao lado do corpo, um pouco aberto; a mão fecha em ponta
        _secoes("bracos-manga", roupa, [(x * 0.236, 0, 0.87, 0.032, 0.034), (x * 0.228, 0.004, 1.1, 0.041, 0.043),
                                        (x * 0.206, 0, 1.36, 0.05, 0.052)])
        _secoes("maos-mao", pele, [(x * 0.24, -0.008, 0.705, 0.011, 0.024), (x * 0.24, -0.004, 0.79, 0.019, 0.04),
                                   (x * 0.237, 0, 0.875, 0.028, 0.03)], lados=6)
        _secoes("pernas-perna", calca, [(x * 0.088, 0.004, 0.09, 0.04, 0.046), (x * 0.09, 0.006, 0.33, 0.056, 0.06),
                                        (x * 0.09, -0.004, 0.48, 0.052, 0.056), (x * 0.09, 0, 0.68, 0.074, 0.078),
                                        (x * 0.084, 0, 0.88, 0.086, 0.094)])
        caixa("pes-sapato", sapato, (0.092, 0.25, 0.075), (x * 0.09, -0.045, 0.0375), chanfro=0.024, seg=1)
        esfera("cabeca-orelha", pele, 0.022, (x * 0.087, 0.012, 1.635), escala=(0.45, 0.8, 1.2), lados=6)
        esfera("rosto-olho", escuro, 0.012, (x * 0.032, -0.09, 1.656), escala=(1.25, 0.5, 0.8), lados=6)
        caixa("rosto-sobrancelha", escuro, (0.034, 0.008, 0.007), (x * 0.033, -0.092, 1.682), giro=(0, x * -6, x * 14))
    _secoes("cabeca-pescoco", pele, [(0, 0.006, 1.44, 0.05, 0.052), (0, 0.004, 1.55, 0.046, 0.05)])
    _secoes("cabeca-cranio", pele, [(0, -0.012, 1.515, 0.034, 0.042), (0, -0.004, 1.555, 0.068, 0.078), (0, 0, 1.615, 0.084, 0.094),
                                    (0, 0, 1.68, 0.088, 0.1), (0, 0.004, 1.74, 0.066, 0.076), (0, 0.006, 1.768, 0.03, 0.036)], lados=10)
    caixa("cabeca-nariz", pele, (0.022, 0.026, 0.044), (0, -0.098, 1.626), giro=(-14, 0, 0), chanfro=0.008, seg=1)
    caixa("rosto-boca", escuro, (0.04, 0.008, 0.007), (0, -0.083, 1.583))
    esfera("cabelo-cabelo", cabelo, 0.1, (0, 0.02, 1.682), escala=(1.0, 1.15, 1.13), lados=10)
