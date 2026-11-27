"""Medidas de calça pronta (cm) pela numeração do provador (34…50), com a mesma regra de corpo de
``lib/tryon/sizes.ts``: cintura do corpo = 2N + 2 (masc.) ou 2N − 4 (fem.); quadril = 2N + 16 (masc.) ou 2N + 22 (fem.).

A peça pronta é o corpo + a folga do modelo (``CUTS``); comprimentos não mudam com a numeração (a entreperna é a do
modelo). Uma tabela da marca (``override``) sempre vale mais que isso.
"""
from __future__ import annotations

from dataclasses import dataclass, fields, replace

NUMBERS = tuple(str(n) for n in range(34, 52, 2))

# folga (cm) de cintura, quadril, coxa, joelho e barra por modelo, e barra: "reta" ou "ribana". Opcionais:
# ``entreperna`` (masc., fem.) em cm, quando não é a calça inteira; ``barra_coxa``: a boca da perna como fração da coxa
# (short, bermuda: um pouco menor que a coxa do gancho — a coxa afina até a barra; igual, a barra abria em sino); ``saia``: (comprimento do cós à barra em cm, roda = barra ÷ quadril).
CUTS = {
    "casual_pants": dict(cintura=2, quadril=8, coxa=8, joelho=6, barra=40, punho="reta"),
    "chino_pants": dict(cintura=2, quadril=6, coxa=6, joelho=4, barra=36, punho="reta"),
    "cargo_pants": dict(cintura=3, quadril=12, coxa=12, joelho=10, barra=44, punho="reta"),
    "jogger_pants": dict(cintura=0, quadril=10, coxa=8, joelho=4, barra=24, punho="ribana"),
    "sweatpants": dict(cintura=0, quadril=12, coxa=10, joelho=6, barra=24, punho="ribana"),
    "jeans": dict(cintura=1, quadril=4, coxa=4, joelho=2, barra=36, punho="reta"),
    "tailored_pants": dict(cintura=2, quadril=8, coxa=10, joelho=14, barra=52, punho="reta"),
    "leggings": dict(cintura=-4, quadril=-8, coxa=-6, joelho=-4, barra=20, punho="reta"),
    "culottes": dict(cintura=2, quadril=12, coxa=10, joelho=20, barra=60, punho="reta", entreperna=(54, 50)),
    "shorts": dict(cintura=0, quadril=10, coxa=5, joelho=0, barra=0, punho="reta", entreperna=(14, 12), barra_coxa=0.88),
    "bermuda_shorts": dict(cintura=2, quadril=12, coxa=7, joelho=0, barra=0, punho="reta", entreperna=(26, 24),
                           barra_coxa=0.9),
    "denim_shorts": dict(cintura=1, quadril=4, coxa=3, joelho=0, barra=0, punho="reta", entreperna=(10, 8), barra_coxa=0.9),
    "skort": dict(cintura=1, quadril=8, coxa=3, joelho=0, barra=0, punho="reta", entreperna=(8, 8), barra_coxa=0.9,
                  saia=(36, 1.35)),
    "skirt": dict(cintura=1, quadril=6, coxa=0, joelho=0, barra=0, punho="reta", entreperna=(0, 0), saia=(75, 1.6)),
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
    coxa = round(thigh + c["coxa"], 1)
    barra = round(coxa * c["barra_coxa"], 1) if "barra_coxa" in c else c["barra"] + (n - 40) * 0.5
    inseam = c.get("entreperna", (81.0, 76.0))[1 if fem else 0]
    m = PantsMeasures(
        cintura=waist + c["cintura"], quadril=hip + c["quadril"], coxa=coxa,
        joelho=round(thigh * 0.68 + c["joelho"], 1) if c["joelho"] or "barra_coxa" not in c else coxa, barra=barra,
        entreperna=float(inseam), gancho_frente=25.0 + (n - 40) * 0.25, gancho_costas=35.0 + (n - 40) * 0.25,
        cos=4.0, ribana_barra=8.0 if c["punho"] == "ribana" else 0.0)
    return replace(m, **(override or {}))


def skirt_shape(cut: str) -> tuple[float, float] | None:
    """(comprimento do cós à barra em cm, roda) da saia do modelo; None quando o modelo não tem saia."""
    return CUTS[cut].get("saia")


def check_pants(m: PantsMeasures) -> list[str]:
    problems = []
    if m.quadril <= m.cintura * 0.9:
        problems.append("quadril menor que a cintura")
    if m.coxa >= m.quadril * 0.8:
        problems.append("coxa maior que 80 % do quadril")
    if m.coxa and m.barra > m.coxa * 1.1:
        problems.append("barra mais larga que a coxa")
    if min(getattr(m, f.name) for f in fields(PantsMeasures) if f.name not in ("ribana_barra", "entreperna", "coxa",
                                                                            "joelho", "barra")) <= 0:
        problems.append("medida não positiva")
    return problems
