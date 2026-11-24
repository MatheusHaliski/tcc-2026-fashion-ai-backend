"""Medidas de calça pronta (cm) pela numeração do provador (34…50), com a mesma regra de corpo de
``lib/tryon/sizes.ts``: cintura do corpo = 2N + 2 (masc.) ou 2N − 4 (fem.); quadril = 2N + 16 (masc.) ou 2N + 22 (fem.).

A peça pronta é o corpo + a folga do modelo (``CUTS``); comprimentos não mudam com a numeração (a entreperna é a do
modelo). Uma tabela da marca (``override``) sempre vale mais que isso.
"""
from __future__ import annotations

from dataclasses import dataclass, fields, replace

NUMBERS = tuple(str(n) for n in range(34, 52, 2))

# folga (cm) de cintura, quadril, coxa, joelho e barra por modelo, e barra: "reta" ou "ribana"
CUTS = {
    "casual_pants": dict(cintura=2, quadril=8, coxa=8, joelho=6, barra=40, punho="reta"),
    "chino_pants": dict(cintura=2, quadril=6, coxa=6, joelho=4, barra=36, punho="reta"),
    "cargo_pants": dict(cintura=3, quadril=12, coxa=12, joelho=10, barra=44, punho="reta"),
    "jogger_pants": dict(cintura=0, quadril=10, coxa=8, joelho=4, barra=24, punho="ribana"),
    "sweatpants": dict(cintura=0, quadril=12, coxa=10, joelho=6, barra=24, punho="ribana"),
    "jeans": dict(cintura=1, quadril=4, coxa=4, joelho=2, barra=36, punho="reta"),
}


@dataclass(frozen=True)
class PantsMeasures:
    cintura: float          # perímetro do cós pronto (relaxado, no elástico)
    quadril: float          # perímetro do quadril, 18 cm abaixo do cós
    coxa: float             # perímetro de uma perna, 2,5 cm abaixo do gancho
    joelho: float           # perímetro da perna na altura do joelho
    barra: float            # perímetro da boca da perna (no punho de ribana, relaxado)
    entreperna: float       # gancho até a barra, pela costura de dentro
    gancho_frente: float    # do gancho ao topo do cós, na frente
    gancho_costas: float    # do gancho ao topo do cós, atrás (mais alto que a frente)
    cos: float              # altura do cós
    ribana_barra: float     # altura do punho de ribana (0 na barra reta)


def pants_measures(number: str, cut: str, sex: str = "MASCULINO", override: dict[str, float] | None = None
                   ) -> PantsMeasures:
    if number not in NUMBERS:
        raise ValueError(f"numeração fora da grade: {number}")
    if cut not in CUTS:
        raise ValueError(f"modelo de calça sem tabela: {cut}")
    n, fem, c = int(number), sex.upper().startswith("F"), CUTS[cut]
    waist = 2 * n - 4 if fem else 2 * n + 2
    hip = 2 * n + (22 if fem else 16)
    thigh = hip * 0.6 + (2 if fem else 0)
    m = PantsMeasures(
        cintura=waist + c["cintura"], quadril=hip + c["quadril"], coxa=round(thigh + c["coxa"], 1),
        joelho=round(thigh * 0.68 + c["joelho"], 1), barra=c["barra"] + (n - 40) * 0.5,
        entreperna=76.0 if fem else 81.0, gancho_frente=25.0 + (n - 40) * 0.25, gancho_costas=35.0 + (n - 40) * 0.25,
        cos=4.0, ribana_barra=8.0 if c["punho"] == "ribana" else 0.0)
    return replace(m, **(override or {}))


def check_pants(m: PantsMeasures) -> list[str]:
    problems = []
    if m.quadril <= m.cintura * 0.9:
        problems.append("quadril menor que a cintura")
    if m.coxa >= m.quadril * 0.8:
        problems.append("coxa maior que 80 % do quadril")
    if not m.barra < m.coxa:
        problems.append("barra mais larga que a coxa")
    if min(getattr(m, f.name) for f in fields(PantsMeasures) if f.name != "ribana_barra") <= 0:
        problems.append("medida não positiva")
    return problems
