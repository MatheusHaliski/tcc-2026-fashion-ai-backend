"""Rótulos do fashn-human-parser por categoria do catálogo, idênticos aos do fashn-vton-1.5, e os limites das
atestações do engine fashn-open."""
from __future__ import annotations

from typing import Optional

from photo_set import SET_SUBCATEGORIES
from whole_frame import FULL, LOWER, UPPER, cloth_class

# Cópia da tabela do fashn-human-parser (labels.py) — a mesma que o fashn-vton-1.5 usa; o teste confere contra o pacote.
LABELS_TO_IDS = {"background": 0, "face": 1, "hair": 2, "top": 3, "dress": 4, "skirt": 5, "pants": 6, "belt": 7, "bag": 8,
                 "hat": 9, "scarf": 10, "glasses": 11, "arms": 12, "hands": 13, "legs": 14, "feet": 15, "torso": 16, "jewelry": 17}
IDS_TO_LABELS = {v: k for k, v in LABELS_TO_IDS.items()}
CATEGORY_TO_BODY_COVERAGE = {"tops": "upper", "bottoms": "lower", "one-pieces": "full"}
BODY_COVERAGE_TO_LABELS = {"upper": ["top", "dress", "scarf"], "lower": ["skirt", "pants", "belt"],
                           "full": ["top", "dress", "scarf", "skirt", "pants", "belt"]}
# Só isto prova que há pessoa na foto: o parser "vê" cabelo em textura de produto (bola, tricô), então cabelo não conta.
PERSON_LABELS = frozenset({1, 12, 13, 14, 15, 16})
HUMAN_LABELS = PERSON_LABELS | {2}
# Fora das três categorias da FASHN (que não cobrem calçado nem acessório), o rótulo que fica quando há pessoa na foto.
EXTRA_KEEP = {"shoes_piece": ("feet",), "accessory_piece": ("belt", "bag", "hat", "scarf", "glasses", "jewelry")}
# Atestações do preflight (photo_preflight.inspect_source) só com os dois modelos concordando: o parser separou pessoa e
# peça e o BiRefNet isolou o produto; ou o parser não viu pessoa e o BiRefNet isolou o produto solto (flat-lay).
VERIFIED_MODES = frozenset({"parser+birefnet", "birefnet-flat-lay"})
OCCLUDER_LABELS = frozenset({8, 11, 13, 17})     # bolsa, óculos, mãos, joia: o que fica NA FRENTE do tecido
MAX_BODY_INSIDE = 0.12                            # corpo por dentro da peça (gola, entre as pernas) acima disto = oclusão incerta
MAX_OCCLUDER = 0.05                               # mão/bolsa sobre o tecido: medido 0,8 % (mão na cintura) e 2,4 % (mão sobre o vestido)


# ───────────────────────── rótulos por categoria (idêntico ao fashn-vton-1.5)

def fashn_category(category: Optional[str], subcategory: Optional[str] = None) -> Optional[str]:
    """Categoria da API da FASHN (tops / bottoms / one-pieces) para a do catálogo; None = calçado, acessório, desconhecida."""
    if (subcategory or "").strip().lower() in SET_SUBCATEGORIES:
        return "one-pieces"                                    # conjunto = cima + baixo, como a cobertura "full"
    return {UPPER: "tops", LOWER: "bottoms", FULL: "one-pieces"}.get(cloth_class(category, subcategory))


def garment_label_ids(category: Optional[str], subcategory: Optional[str] = None) -> Optional[frozenset[int]]:
    """Os rótulos que o fashn-vton-1.5 mantém em create_garment_image para a categoria (None = sem parser)."""
    fashn = fashn_category(category, subcategory)
    if fashn is not None:
        return frozenset(LABELS_TO_IDS[name] for name in BODY_COVERAGE_TO_LABELS[CATEGORY_TO_BODY_COVERAGE[fashn]])
    names = EXTRA_KEEP.get((category or "").strip().lower())
    return frozenset(LABELS_TO_IDS[name] for name in names) if names else None
