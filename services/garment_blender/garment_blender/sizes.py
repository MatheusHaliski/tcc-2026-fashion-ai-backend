"""Medidas de peça pronta (cm) por tamanho, para a parte de cima, na grade de letras do provador (PP…XG).

Ponto de partida: o corpo de referência de cada tamanho é o mesmo de ``lib/tryon/sizes.ts`` (tórax do PP: 92 cm no
feminino, 100 cm no masculino; passo de 6 cm). A peça pronta é o corpo + a folga do caimento (``EASE``), e as medidas
de comprimento crescem por passo como numa graduação de modelagem comum (ABNT NBR 16060 e tabelas de marcas: ombro
+1,2 cm, comprimento +2 cm, manga +1 cm por tamanho). Uma tabela da marca (``override``) sempre vale mais que isso.
"""
from __future__ import annotations

from dataclasses import dataclass, fields, replace

LETTERS = ("PP", "P", "M", "G", "GG", "XG")

# folga total no perímetro do tórax (cm) por caimento
EASE = {"justo": 4.0, "regular": 10.0, "amplo": 18.0, "oversized": 28.0}


@dataclass(frozen=True)
class TopMeasures:
    """Medidas da peça pronta, em cm. Perímetros são a volta inteira; alturas a partir do ponto alto do ombro (HPS)."""
    torax: float            # perímetro do tórax da peça (2,5 cm abaixo da cava)
    barra: float            # perímetro da barra, sem a ribana (antes de franzir)
    comprimento: float      # HPS até a barra, ribana incluída
    ombro: float            # ponta a ponta do ombro, pelas costas
    cava: float             # profundidade da cava (HPS até a linha do tórax)
    manga: float            # ponta do ombro até o fim do punho
    biceps: float           # perímetro do braço da manga 2,5 cm abaixo da cava
    punho: float            # perímetro do punho pronto (ribana relaxada)
    pescoco: float          # perímetro do decote (onde a gola é costurada)
    decote_frente: float    # descida VERTICAL do decote na frente, a partir do HPS, já vestida (a de molde é maior)
    decote_costas: float    # descida do decote nas costas
    caimento_ombro: float   # quanto a ponta do ombro desce em relação ao HPS
    ribana_barra: float     # altura da ribana da barra
    ribana_punho: float     # altura da ribana do punho
    gola: float             # altura da gola (ribana) pronta


# tamanho M de referência (masculino, caimento regular) e o passo por tamanho
_M_MASC = TopMeasures(torax=110, barra=104, comprimento=70, ombro=47, cava=24, manga=63, biceps=40, punho=21,
                      pescoco=48, decote_frente=4.0, decote_costas=2.0, caimento_ombro=4.5, ribana_barra=6.5,
                      ribana_punho=6.5, gola=2.5)
_M_FEM = TopMeasures(torax=102, barra=98, comprimento=63, ombro=40, cava=21, manga=59, biceps=34, punho=19,
                     pescoco=46, decote_frente=3.8, decote_costas=2.0, caimento_ombro=4.0, ribana_barra=6.0,
                     ribana_punho=6.0, gola=2.5)
_STEP = {"torax": 6.0, "barra": 6.0, "comprimento": 2.0, "ombro": 1.2, "cava": 1.0, "manga": 1.0, "biceps": 2.0,
         "punho": 1.0, "pescoco": 1.0, "decote_frente": 0.15, "decote_costas": 0.0, "caimento_ombro": 0.1}


def top_measures(size: str, sex: str = "MASCULINO", fit: str = "regular",
                 override: dict[str, float] | None = None) -> TopMeasures:
    """Medidas da peça pronta no tamanho pedido. ``fit`` troca só a folga de tórax, barra e bíceps."""
    if size not in LETTERS:
        raise ValueError(f"tamanho fora da grade de letras: {size}")
    if fit not in EASE:
        raise ValueError(f"caimento desconhecido: {fit}")
    base = _M_FEM if sex.upper().startswith("F") else _M_MASC
    steps = LETTERS.index(size) - LETTERS.index("M")
    values = {f.name: getattr(base, f.name) + steps * _STEP.get(f.name, 0.0) for f in fields(TopMeasures)}
    extra = EASE[fit] - EASE["regular"]
    for name, share in (("torax", 1.0), ("barra", 1.0), ("biceps", 0.35)):
        values[name] += extra * share
    if fit in ("amplo", "oversized"):   # ombro caído: a costura do ombro desce pelo braço
        values["ombro"] += extra * 0.25
        values["cava"] += extra * 0.12
    measures = TopMeasures(**values)
    return replace(measures, **(override or {}))


def check(m: TopMeasures) -> list[str]:
    """Combinações que não fecham uma peça (erro de tabela ou de override): vazio quando está tudo coerente."""
    problems = []
    if m.ombro >= m.torax / 2:
        problems.append("ombro maior que a meia largura do tórax")
    if m.punho >= m.biceps:
        problems.append("punho maior que o bíceps")
    if m.cava >= m.comprimento - m.ribana_barra:
        problems.append("cava passa da barra")
    if m.pescoco >= m.torax * 0.6:
        problems.append("decote largo demais para o tórax")
    if min(m.torax, m.comprimento, m.manga, m.punho, m.pescoco) <= 0:
        problems.append("medida não positiva")
    return problems
