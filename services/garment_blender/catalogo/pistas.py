"""O que o texto do produto adianta sobre a pintura antes de olhar a foto: peça dita lisa (só logo pode haver), estampa
que cobre tudo (xadrez, floral, oncinha…), material de brilho (couro, metalizado, paetê: o reflexo não é desenho) e
agasalho que se usa aberto (o que aparece pela frente é a roupa de baixo).

A foto continua decidindo; a pista só muda o quanto ela precisa mostrar.
"""
from __future__ import annotations

import re

from .texto import plain

PLAIN = re.compile(r"\blis[ao]s?\b|\bbasic[ao]?s?\b|\bsolid\b|\bplain\b|\bessential\b|\bsem estampa\b")
PRINT = re.compile(r"estamp|\bprint|grafic|graphic|\blogo|\bslogan|bordad|embroider|\bpatch|\bletter|\bfrase")
ALL_OVER = re.compile(r"xadrez|\bplaid|tartan|\bcheck(ed|ered)?\b|vichy|gingham|floral|\bflores\b|\bflower|camufl|"
                      r"\bcamo\b|animal print|\bonca\b|leopard|zebra|paisley|tie[- ]?dye|all[- ]?over|\bpoa\b|"
                      r"polka|bolinha|\brenda\b|\blace\b|\bjacquard|monogram|toile|ikat|batik|\bfolhagem|tropical")
SHINY = re.compile(r"\bcouro\b|leather|\bpu\b|verniz|patent|metaliz|metallic|\bpaete|sequin|lantejoula|\bcetim\b|"
                   r"\bsatin\b|puffer|acolchoad|matelass|quilted|\bvinil|\bvinyl|\bpelo\b|\bpelucia|"
                   r"\bfur\b|shearling|sherpa|teddy|\bfleece\b|plush|veludo|velvet|tornasol|furta[- ]?cor|iridesc|"
                   r"\blurex|brilhos?\b|glitter|\bshiny\b|\bshine\b|perolad")
OUTER = {"jacket", "coat", "blazer", "parka", "vest", "windbreaker", "cardigan"}


def from_text(name: str | None, description: str | None = "", sub: str | None = "", closure: str = "") -> dict:
    """Pistas do nome (o que manda) e da descrição: ``liso`` (dita lisa e sem palavra de estampa), ``corrida``
    (palavra de estampa que cobre a peça), ``estampa`` (fala de estampa ou logo), ``brilho`` (material que reflete ou
    tem pelo) e ``aberta`` (agasalho de abrir na frente: casaco, jaqueta, blazer, cardigã ou peça com zíper inteiro)."""
    n, d = plain(name), plain(description)
    printed = bool(PRINT.search(n) or ALL_OVER.search(n))
    return {
        "liso": bool(PLAIN.search(n)) and not printed,
        "corrida": bool(ALL_OVER.search(n) or (not PLAIN.search(n) and ALL_OVER.search(d))),
        "estampa": printed or bool(PRINT.search(d)),
        "brilho": bool(SHINY.search(n)),
        "aberta": (sub or "") in OUTER or closure in ("ziper_inteiro", "aberto"),
    }
