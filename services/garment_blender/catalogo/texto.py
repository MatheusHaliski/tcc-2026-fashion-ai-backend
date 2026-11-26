"""O que o nome e a descrição do produto dizem da construção da peça (português e inglês, sem acento, minúsculo).

Cada regra devolve um valor da ficha do motor ou None (o texto não diz: vale a base da subcategoria). O nome manda
mais que a descrição — a descrição às vezes fala de outra peça ("combine com a calça…"). O tecido tem regras próprias,
em ``tecido.py``.
"""
from __future__ import annotations

import re
import unicodedata


def plain(text: str | None) -> str:
    """Minúsculo e sem acento: "Gola Rulê" → "gola rule"."""
    t = unicodedata.normalize("NFKD", text or "")
    return "".join(c for c in t if not unicodedata.combining(c)).lower()


def _rx(*words: str) -> re.Pattern:
    return re.compile("|".join(words))


# peças que não são roupa de cima adulta, mesmo listadas como tal: decidido só pelo nome
SKIP = {
    "infantil": _rx(r"infant", r"\bkids?\b", r"\bboys?\b", r"\bgirls?\b", r"\bbaby\b", r"\bbebe\b", r"juvenil",
                    r"toddler", r"menin[oa]", r"\bteen", r"\bjunior\b", r"\bchild"),
    "praia": _rx(r"bikini", r"biquini", r"\bmaio\b", r"\bswim", r"\bsunga\b", r"rash ?guard"),
    "parte_de_baixo": _rx(r"\bpants?\b", r"\bcalca\b", r"\bshorts\b", r"\bsaia\b", r"\bskirt", r"legging",
                          r"bermuda", r"\bjeans\b(?! jacket| shirt)"),
    "vestido": _rx(r"vestido", r"\bdress\b(?! shirt)", r"macacao", r"jumpsuit"),
}

SLEEVES = (   # (valor, regra) na ordem: a primeira que casar decide
    ("sem", _rx(r"\bregata\b", r"sem manga", r"sleeveless", r"\btank\b", r"\balcas?\b", r"alcinha", r"strappy",
                r"\bcami\b", r"camisole", r"tomara que caia", r"strapless", r"\bmuscle\b")),
    ("curta", _rx(r"manga curta", r"mangas curtas", r"short[- ]sleeve", r"\bs/s\b", r"meia manga")),
    ("longa", _rx(r"manga longa", r"mangas longas", r"long[- ]sleeve", r"\bl/s\b", r"manga 3/4", r"3/4 sleeve",
                  r"three[- ]quarter")),
)
COLLARS = (
    ("capuz", _rx(r"\bcapuz", r"\bhood(ie|ed)?\b")),
    ("polo", _rx(r"gola polo", r"polo collar")),
    ("alta", _rx(r"gola alta", r"turtle ?neck", r"mock[- ]?neck", r"gola rule", r"funnel", r"high[- ]neck",
                 r"half[- ]zip", r"quarter[- ]zip", r"1/4 zip", r"meio ziper", r"gola padre", r"mandarin")),
    ("v", _rx(r"gola v\b", r"decote v\b", r"decote em v", r"v[- ]neck", r"\bdecote v")),
    ("lapela", _rx(r"lapela", r"\blapel", r"notch", r"peak lapel")),
    ("colarinho", _rx(r"colarinho", r"gola de camisa", r"button[- ]down", r"spread collar", r"point collar",
                      r"camp collar", r"gola italiana")),
    ("vies", _rx(r"decote u\b", r"\bscoop", r"gola canoa", r"boat ?neck", r"decote quadrado", r"decote reto",
                 r"square neck")),
    ("careca", _rx(r"gola careca", r"crew[- ]?neck", r"gola redonda", r"round neck", r"decote redondo")),
)
# forma do decote da peça sem manga (o motor desenha o recorte com ela; strap_cut.py)
NECKLINES = (
    ("quadrado", _rx(r"decote (reto|quadrado)", r"square[- ]neck", r"straight[- ]neck")),
    ("redondo", _rx(r"decote (u|redondo|cavado)\b", r"\bscoop")),
)
CLOSURES = (
    ("polo", _rx(r"henley")),
    ("nenhum", _rx(r"half[- ]zip", r"quarter[- ]zip", r"1/4 zip", r"meio ziper", r"pullover")),
    ("ziper_inteiro", _rx(r"\bziper\b", r"\bzip(per|ped)?\b", r"full[- ]zip", r"fecho ecler", r"zip[- ]up")),
    ("aberto", _rx(r"open[- ]front", r"frente aberta", r"sem fecho", r"\bkimono\b", r"\bquimono\b")),
    ("botoes", _rx(r"\bbotoes\b", r"\bbotao\b", r"\bbuttons?\b", r"\bbuttoned\b", r"abotoad", r"button[- ]up",
                   r"button[- ]front")),
)
FITS = (
    ("oversized", _rx(r"oversized?", r"\bover\b", r"\bboxy\b")),
    ("amplo", _rx(r"\bampl[ao]\b", r"relaxed", r"\bloose", r"\bsolt[ao]\b", r"folgad")),
    ("justo", _rx(r"\bslim\b", r"\bjust[ao]\b", r"\bfitted\b", r"skinny", r"ajustad", r"segunda pele",
                  r"second skin", r"compress", r"\bmuscle\b", r"modelador")),
)
STRIPED = _rx(r"listrad", r"\blistras?\b", r"striped", r"\bstripes?\b", r"breton", r"marinier")
POCKET_KANGAROO = _rx(r"canguru", r"kangaroo")
POCKET_CHEST = _rx(r"bolso (no |de )?peito", r"chest pocket", r"bolso chapado", r"com bolso", r"\bpocket\b",
                   r"patch pocket", r"utility", r"bolsos? frontal")
CROPPED = _rx(r"\bcropped\b", r"\bcrop\b")
HENLEY = _rx(r"henley")
SHIRT_JACKET = _rx(r"trucker", r"shacket", r"overshirt", r"shirt[- ]jacket", r"camisa[- ]jaqueta", r"sobrecamisa")
GOLD = _rx(r"dourad", r"\bgold", r"metal", r"\blatao\b", r"brass")
FEMALE = _rx(r"feminin", r"\bwomen", r"\bwoman", r"\bmulher", r"\bfemale", r"\bladies", r"\bdela\b")
MALE = _rx(r"masculin", r"\bmen\b", r"\bmens\b", r"\bmen's", r"\bhomem", r"\bmale\b", r"\bdele\b")


def first(rules, *texts: str) -> str | None:
    """O valor da primeira regra que casa, no nome antes da descrição."""
    for text in texts:
        for value, rx in rules:
            if rx.search(text):
                return value
    return None


KIDS_URL = {"infantil", "kids", "kid", "boys", "boy", "girls", "girl", "bebe", "baby", "menino", "menina", "toddler",
            "juvenil", "crianca", "teen", "teens", "children", "child", "infant", "youth", "crewcuts"}


def skip_reason(name: str, url: str = "", brand: str = "", sub: str = "") -> str | None:
    """Por que o produto não vira peça de cima adulta (None: vira). O nome decide; o endereço e a linha da marca pegam o
    infantil que o nome não diz (a linha Mini da Reserva, o body de bebê, o crewcuts da J.Crew)."""
    n = plain(name)
    found = next((reason for reason, rx in SKIP.items() if rx.search(n)), None)
    if found:
        return found
    tokens = set(re.split(r"[^a-z0-9]+", plain(url))) | set(re.split(r"[^a-z0-9]+", n))
    if tokens & KIDS_URL or (plain(brand) == "reserva" and ("mini" in tokens or sub == "bodysuit")):
        return "infantil"
    return None


def sex_of(text: str) -> str | None:
    f, m = bool(FEMALE.search(text)), bool(MALE.search(text))
    return "FEMININO" if f and not m else "MASCULINO" if m and not f else None
