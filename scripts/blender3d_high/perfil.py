"""Regras do perfil ``high``: o teto de triângulos por objeto e o orçamento de cada sala por nível de detalhe.

Puro (sem Blender), para o teste e para o relatório. A regra que separa este perfil do motor de objetos soltos:

- objeto **comum** continua com o teto do motor (``scripts.blender3d.build.MAX_TRIANGULOS``, 3 mil triângulos);
- objeto marcado como **herói** (``heroi=True`` na receita da sala: passarela, poltrona, refletor, cortina, telão...)
  pode chegar a ``TETO_HEROI`` triângulos, e só dentro de uma sala do perfil ``high``;
- a sala inteira respeita o orçamento do nível (``ORCAMENTO``): triângulos desenhados (cada cópia conta), chamadas de
  desenho (um grupo de cópias com instancing conta uma) e o tamanho do arquivo comprimido.
"""
from __future__ import annotations

from dataclasses import dataclass

#: o mesmo teto dos objetos soltos do motor (scripts/blender3d/build.py); repetido para não importar o bpy
TETO_COMUM = 3000
#: teto de um objeto herói numa sala high poly (uma cópia)
TETO_HEROI = 80_000
NIVEIS = ("alto", "medio")


@dataclass(frozen=True)
class Orcamento:
    triangulos: int
    chamadas: int
    megabytes: float


#: alto: perto da câmera e tela larga (placa de vídeo); medio: celular, máquina fraca e a qualidade Média/Baixa
ORCAMENTO: dict[str, dict[str, Orcamento]] = {
    "passarela": {"alto": Orcamento(900_000, 160, 15.0), "medio": Orcamento(260_000, 120, 6.0)},
    "detetive": {"alto": Orcamento(450_000, 140, 8.0), "medio": Orcamento(150_000, 110, 4.0)},
}
#: quanto da malha sobra no nível médio (gltfpack -si) e o lado máximo das texturas
RAZAO_MEDIO = 0.3
#: a família que repete muito a mesma malha (66 poltronas da Passarela) desce mais no médio
RAZAO_MEDIO_DA_FAMILIA = {"passarela": 0.2}
TEXTURA = {"alto": 1024, "medio": 512}


def teto_do_objeto(heroi: bool) -> int:
    return TETO_HEROI if heroi else TETO_COMUM


def estouros_de_objeto(objetos: dict[str, tuple[int, bool]]) -> list[str]:
    """``objetos``: nome -> (triângulos de uma cópia, herói?). Devolve os que passam do teto, com o motivo."""
    return [f"{nome}: {tri} triângulos (teto {teto_do_objeto(heroi)}{' de herói' if heroi else ''})"
            for nome, (tri, heroi) in sorted(objetos.items()) if tri > teto_do_objeto(heroi)]


def estouros_da_sala(familia: str, nivel: str, triangulos: int, chamadas: int, bytes_: int) -> list[str]:
    limite = ORCAMENTO[familia][nivel]
    fora = []
    if triangulos > limite.triangulos:
        fora.append(f"{nivel}: {triangulos} triângulos (orçamento {limite.triangulos})")
    if chamadas > limite.chamadas:
        fora.append(f"{nivel}: {chamadas} chamadas de desenho (orçamento {limite.chamadas})")
    if bytes_ / 2**20 > limite.megabytes:
        fora.append(f"{nivel}: {bytes_ / 2**20:.1f} MB (orçamento {limite.megabytes} MB)")
    return fora
