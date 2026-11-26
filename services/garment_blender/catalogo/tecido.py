"""O tecido da peça pelo que o nome e a descrição dizem (um dos ``FABRICS`` do motor) ou None: vale a base.

Três cuidados que o casamento de palavra solta não tinha:

- **forro e detalhe não são a peça**: "fleece-lined", "forro de lã", "ribbed cuffs", "leather patch", "golden fleece®
  buttons" saem do texto antes das regras (``clean``);
- **a casca dita vale mais**: "nylon shell", "confeccionado em moletom", "crafted of sherpa fleece" decidem antes de
  qualquer outra palavra da descrição (``STATED``);
- **palavra de construção vale mais que fibra**: tricô, sarja, cetim dizem como o pano é feito; lã, viscose, linho,
  seda e nylon só dizem o fio, e o pano que dão depende da peça (lã no blazer é lã plana; no suéter, tricô).

O nome manda mais que a descrição. Texto em minúsculo e sem acento, menos o "lã" — que sem acento vira o artigo "la"
do catalão e do espanhol e o pronome de "vesti-la": é reconhecido antes de tirar o acento.
"""
from __future__ import annotations

import re

from .texto import _rx, plain

OUTER = ("jacket", "coat", "parka", "windbreaker", "vest", "blazer")
TAILORED = OUTER + ("shirt", "kimono")                       # lã aqui é pano plano
KNIT_ONLY = ("t_shirt", "polo_shirt", "tank_top", "top", "crop_top", "bodysuit")   # fibra nenhuma muda a malha
NO_LINEN = ("t_shirt", "polo_shirt", "sweater", "cardigan", "sweatshirt", "hoodie")
SHELL_FROM_TEXT = ("jacket", "coat", "parka", "windbreaker", "vest")   # acolchoado e couro vindos da descrição
NO_FLEECE_FROM_TEXT = ("t_shirt", "tank_top", "top", "crop_top", "bodysuit", "polo_shirt", "shirt", "blouse")

_FIBER = r"(fleece|sherpa|wool|flannel|flanela|mesh|quilted|satin|taffeta|pile|faux fur|shearling|teddy|la|pelo|pelucia)"
NOISE = _rx(   # trechos que falam de forro, acabamento, técnica de estampa ou são expressão feita
    r"silk[- ]?screen\w*", r"\bem silk\b", r"\bsilky\b", r"\bsatin[- ]stitch\w*", r"\bmit satin\b",
    _FIBER + r"[- ]?(lined|lining|interior|inside|collar|trim)\b",
    r"\b(high[- ]pile |sherpa |cozy |soft |plush )*fleece[- ]lin(ed|ing)\b",
    r"\blin(ed|ing) (with|in|of) [^.,;]{0,40}", r"\b(with|com) [^.,;]{0,30}(lining|forro)\b",
    r"\bforr(o|ad[oa]s?)( intern[oa])?( de| em| com)? [^.,;]{0,30}", r"\b(interior|interno|inside|inner)( de| em| in| of)? \w+",
    r"\brib(bed)?([- ]knit)? [^.,;]{0,25}(cuffs?|trims?|hems?|collar|neck(line)?|waistband|bands?)\b",
    r"\b(cuffs?|hems?|collar|neck(line)?|waistband|trims?)( and \w+)? (in|with|of) rib\w*",
    r"\b(gola|punhos?|barra|decote|acabamento)s?( e (a |os? )?\w+)?( em| de| com)? (ribana|canelad\w*)",
    r"\bgolden fleece\b", r"\bfeatherweight fleece\b",
    r"\b(leather|couro|suede|camurca|velvet|veludo|corduroy|satin|cetim|wool)[- ](trim\w*|patch\w*|label|logo|tab|pulls?|"
    r"details?|buttons?|piping|collar|elbow\w*|appliq\w*)\b",
    r"\b(patch|etiqueta|detalhes?|logo|tag|puxador|aplicac\w+|botoes|botao|label|gola|vivo|recortes?|bolsos?|pocket|"
    r"cotoveleiras?)( \w+)? (de|em|in|of) (couro|leather|camurca|suede|veludo|velvet|cetim|satin|la|wool)\b",
    r"button[- ]down", r"\b(up|upside|top|pull\w*|turn\w*|roll\w*|fold\w*|zip\w*|tone\w*|cool\w*|size\w*) (it )?(or )?down\b",
    r"\bdown (the|to|on|at|from|into)\b", r"sweat[- ]?(wick|resist|absor|proof|activat)\w*", r"\bwick\w* (away )?(the )?sweat\b",
    r"\b(puff|puffed|balloon)[- ]sleeves?\b", r"manga\w* bufante\w*", r"\b(com|with|sobre|over|under|sob) (seu |sua |your |a |o )?"
    r"(calca |shorts? |saia )?(jeans|denim)\b",
)
DENIM_SELF = _rx(r"(jaqueta|camisa|colete|blusa|blazer|casaco|jacket|shirt|vest|coat)( de| em)? (jeans|denim)",
                 r"\b(jeans|denim) (jacket|shirt|vest|blazer|coat|trucker)", r"chambray", r"trucker")
KNIT_WORD = _rx(r"\bknit", r"\btricot", r"\btrico\b", r"\bpunt\b", r"\bmalha\b", r"cardiga", r"sweater", r"sueter",
                r"pullover", r"jumper")
ATHLETIC = _rx(r"powercool", r"\bdry\b", r"thermo", r"\btrack\b", r"running", r"corrida", r"treino", r"training")

RULES = (   # (tecido, regra) na ordem: a primeira que casar no texto decide; "@fibra": depende da peça (``_fiber``)
    ("denim", _rx(r"\bjeans\b", r"\bdenim\b", r"chambray")),
    ("camurca", _rx(r"camurca", r"\bsuede\b", r"\bnu?buck\b")),
    ("couro", _rx(r"\bcouro\b", r"\bleather\b", r"\bpu\b", r"desserto", r"\bnapp?a\b", r"\bpelica\b")),
    ("acolchoado", _rx(r"\bpuffer", r"\bpuff (jacket|vest|coat)", r"(jaqueta|colete|casaco) puff", r"acolchoad",
                       r"matelass", r"\bquilted\b", r"\bpadded\b", r"steppjacke", r"\bplumas?\b", r"\binsulated\b",
                       r"\bdown[- ](fill\w*|insulat\w*|jacket|vest|coat|parka|puffer)", r"\b(goose|duck) down\b",
                       r"\d+[- ]?fill\b", r"\bfilled (canvas|jacket|coat|vest)")),
    ("veludo", _rx(r"\bvelvet\b", r"\bveludo\b(?! cotele)", r"\bvelou?r\b")),
    ("moletom", _rx(r"moletom", r"moleton", r"fleece", r"french terry", r"\bsweat\b", r"felpad", r"peluciad", r"sherpa")),
    ("malha_la", _rx(r"\btricot", r"\btrico\b", r"cable[- ]knit", r"chunky knit", r"\bknit(ted)? sweater")),
    ("la_plana", _rx(r"\btweed\b", r"hopsack", r"\bmelton\b", r"doeskin", r"\bsaxxon\b")),
    ("@la", _rx(r"\bwool", r"cashmere", r"merino", r"alpaca", r"mohair")),
    ("cetim", _rx(r"\bcetim\b", r"\bsatin\b", r"charmeuse")),
    ("malha_algodao", _rx(r"piquet", r"\bpique\b", r"waffle", r"canelad", r"ribbed", r"rib knit")),
    ("tricoline", _rx(r"tricoline", r"popeline", r"poplin", r"oxford", r"\bcrepe\b", r"chiffon", r"musseline", r"voil",
                      r"cambraia", r"georgette", r"broderie", r"laise")),
    ("sarja", _rx(r"\bsarja", r"twill", r"gabardin", r"canvas", r"\blona\b", r"\btrench")),
    ("@nylon", _rx(r"nylon", r"poliamida", r"polyamide", r"ripstop", r"tactel", r"soft ?shell", r"corta[- ]?vento",
                   r"windbreaker", r"\banorak", r"impermeavel", r"waterproof", r"water[- ]repellent", r"\btaffeta\b",
                   r"\brain(coat|wear| jacket)\b", r"\bshell jacket\b")),
    ("@seda", _rx(r"\bseda\b", r"\bsilk\b")),
    ("@linho", _rx(r"\blinho\b", r"\blinen\b")),
    ("@viscose", _rx(r"viscose", r"\brayon\b", r"\bliocel\b", r"\blyocell\b", r"tencel")),
    ("jersey", _rx(r"meia malha", r"\bjersey", r"\bmalha\b", r"\bpima\b", r"supima", r"modal", r"dry ?fit", r"dri-fit",
                   r"\btee\b")),
)
# a casca dita: (palavras antes) shell | made of (palavras depois)
STATED = (
    re.compile(r"((?:[a-z0-9%-]+ ){1,3})(?:shell|outer fabric|outer layer|exterior)\b"),
    re.compile(r"\b(?:shell|outer fabric|outer layer|exterior|tecido principal|tecido externo|parte externa)"
               r"(?: is| e| of| in| de| em|:)*((?: [a-z0-9%-]+){1,4})"),
    re.compile(r"\b(?:confeccionad[oa]|feit[oa]|produzid[oa]|desenvolvid[oa]|crafted|made|cut|constructed|tailored)"
               r" (?:em|com|de|of|from|in|with)((?: [a-z0-9%-]+){1,6})"),
    re.compile(r"\b(?:blusa|blusao|casaco|jaqueta|agasalho)(?: \w+)?( (?:de |em )?(?:moletom|moleton|fleece|tricot|trico)\b)"),
)


def clean(text: str | None) -> str:
    """Minúsculo, sem acento, com "lã" trocado por "wool" e sem os trechos de forro, acabamento e expressão feita."""
    t = re.sub(r"\blãs?\b", " wool ", (text or "").casefold())
    return NOISE.sub(" ", re.sub(r"\s+", " ", plain(t)))


def _fiber(tag: str, sub: str, text: str) -> str | None:
    """O pano que a fibra dá nessa peça (None: a fibra não muda a base da subcategoria)."""
    if tag == "@la":
        if KNIT_WORD.search(text) or sub in ("sweater", "cardigan", "sweatshirt", "hoodie"):
            return "malha_la"
        return "la_plana" if sub in TAILORED else None
    if tag == "@nylon":
        return "nylon" if sub in OUTER else None
    if tag == "@seda":
        return None if sub in NO_LINEN or sub in OUTER else "cetim"
    if tag == "@linho":
        return None if sub in NO_LINEN else "tricoline"
    return "tricoline" if sub in ("shirt", "blouse", "kimono") else None   # viscose


def _first(text: str, sub: str, from_name: bool) -> str | None:
    for kind, rx in RULES:
        if not rx.search(text):
            continue
        if kind.startswith("@"):
            kind = _fiber(kind, sub, text)
        elif kind == "denim" and not from_name and not DENIM_SELF.search(text):
            kind = None                                  # "jeans" solto na descrição é a calça do look
        elif kind in ("acolchoado", "couro", "camurca") and not from_name and sub not in SHELL_FROM_TEXT:
            kind = None                                  # o puffer e o couro citados na descrição de uma camiseta
        elif kind in ("veludo", "cetim") and not from_name and sub in KNIT_ONLY + NO_LINEN:
            kind = None                                  # o bordado de cetim, o flocado de veludo da estampa
        elif kind == "moletom" and not from_name and sub in NO_FLEECE_FROM_TEXT:
            kind = None
        elif kind == "acolchoado" and sub not in OUTER:
            kind = None
        elif kind == "jersey" and sub == "shirt":
            kind = None
        if kind:
            return kind
    return None


def fabric_of(name: str | None, description: str | None, sub: str) -> str | None:
    """Tecido do motor para o produto, ou None quando o texto não diz (vale a base da subcategoria)."""
    n, d = clean(name), clean((description or "")[:900])
    found = _first(n, sub, True)
    if found:
        return found
    if sub == "jacket" and re.search(r"\bbiker\b", n):     # jaqueta biker sem tecido no nome: couro
        return "couro"
    for rx in STATED:                                       # a casca dita na descrição
        for m in rx.finditer(d):
            found = _first(m.group(1), sub, True)
            if found:
                return found
    found = _first(re.sub(r"\btrench\w*", " ", d), sub, False)   # "our iconic trench" na descrição não é a peça
    if found is None and sub in ("coat", "blazer") and ATHLETIC.search(n + " " + d):
        return "jersey"                                     # casaco esportivo (Powercool, dry): malha, não lã
    return found
