"""Ficha do motor para um produto do catálogo: a base da subcategoria (a construção padrão que o motor já monta) com os
detalhes que o texto confirma — gola, fecho, bolsos, mangas, caimento, tecido, comprimento — e a cor da foto.

A base nunca é trocada pela foto: a forma vem sempre do motor. Combinação que o motor não monta (lapela sem abertura,
capuz com botões…) é acertada para a mais próxima que ele monta.
"""
from __future__ import annotations

from . import forma, tecido, texto

# subcategoria → (gola, fechamento, tecido, gramatura, manga, ribana, caimento, bolsos, botões)
BASES = {
    "t_shirt": ("careca", "nenhum", "jersey", 160, "curta", False, "regular", (), 6),
    "polo_shirt": ("polo", "polo", "malha_algodao", 220, "curta", False, "regular", (), 3),
    "shirt": ("colarinho", "botoes", "tricoline", 120, "longa", False, "regular", (), 7),
    "blouse": ("vies", "nenhum", "jersey", 150, "longa", False, "regular", (), 6),
    "sweater": ("careca", "nenhum", "malha_la", 300, "longa", True, "regular", (), 6),
    "sweatshirt": ("careca", "nenhum", "moletom", 320, "longa", True, "regular", (), 6),
    "hoodie": ("capuz", "nenhum", "moletom", 340, "longa", True, "regular", ("canguru",), 6),
    "cardigan": ("v", "botoes", "malha_la", 300, "longa", True, "regular", (), 5),
    "tank_top": ("vies", "nenhum", "jersey", 160, "sem", False, "regular", (), 6),
    "top": ("vies", "nenhum", "jersey", 180, "sem", False, "justo", (), 6),
    "crop_top": ("careca", "nenhum", "jersey", 180, "curta", False, "justo", (), 6),
    "bodysuit": ("vies", "nenhum", "jersey", 180, "sem", False, "justo", (), 6),
    "vest": ("v", "botoes", "sarja", 240, "sem", False, "regular", (), 4),
    "jacket": ("alta", "ziper_inteiro", "sarja", 240, "longa", False, "regular", (), 6),
    "blazer": ("lapela", "botoes", "la_plana", 280, "longa", False, "regular", (), 2),
    "coat": ("lapela", "botoes", "la_plana", 450, "longa", False, "amplo", (), 4),
    "parka": ("capuz", "ziper_inteiro", "nylon", 200, "longa", False, "amplo", ("peito",), 6),
    "windbreaker": ("capuz", "ziper_inteiro", "nylon", 110, "longa", False, "regular", (), 6),
    "kimono": ("faixa", "aberto", "tricoline", 140, "longa", False, "amplo", (), 6),
}
# gramatura de cada tecido quando o texto troca o da base. No motor ela só dá a espessura aparente da casca
# (``spec.Fabric.espessura_mm``): couro e acolchoado levam o valor que dá a espessura certa, não o peso real do couro.
WEIGHT = {"jersey": 160, "malha_algodao": 220, "moletom": 320, "malha_la": 300, "sarja": 240, "denim": 380,
          "tricoline": 120, "la_plana": 280, "couro": 300, "camurca": 300, "nylon": 130, "acolchoado": 380,
          "veludo": 280, "cetim": 110}
FEMALE_ONLY = ("blouse", "top", "crop_top", "bodysuit", "kimono")
PLACKET_ONLY = ("t_shirt", "polo_shirt", "sweater", "sweatshirt", "crop_top", "bodysuit", "tank_top", "top")


def _closure(sub: str, collar: str, closure: str) -> str:
    """Fecho que o motor monta com essa gola e nessa peça."""
    if closure == "botoes" and sub in PLACKET_ONLY:
        closure = "polo"                      # camiseta, suéter com botões: a vista curta
    if closure == "ziper_inteiro" and sub in ("t_shirt", "tank_top", "top", "bodysuit", "blouse", "polo_shirt"):
        closure = "nenhum"
    if collar == "lapela" and closure in ("nenhum", "polo"):
        closure = "botoes"                    # a lapela é a frente que abre
    if collar == "faixa":
        closure = "aberto"
    if collar == "polo" and closure == "nenhum":
        closure = "polo"
    if collar == "capuz" and closure not in ("nenhum", "ziper_inteiro"):
        closure = "ziper_inteiro"
    return closure


def _collar(sub: str, collar: str, closure: str) -> str:
    if collar == "faixa" and closure != "aberto":
        return BASES[sub][0] if BASES[sub][0] != "faixa" else "v"
    if collar == "lapela" and sub in PLACKET_ONLY:
        return "colarinho"
    return collar


def sex_of(product: dict, brand_prior: dict[str, str]) -> str:
    g = (product.get("gender") or "").upper()
    if g in ("FEMININO", "MASCULINO"):
        return g
    words = texto.plain(" ".join(str(product.get(k) or "") for k in ("product_name", "official_product_url")))
    found = texto.sex_of(words)
    if found:
        return found
    if product.get("subcategory") in FEMALE_ONLY:
        return "FEMININO"
    return brand_prior.get((product.get("brand") or "").strip().lower(), "MASCULINO")


def button_color(fabric_hex: str, gold: bool, kind: str) -> str:
    """Botão tom sobre tom (um pouco mais escuro no tecido claro, mais claro no escuro); dourado quando o texto diz;
    de metal no denim."""
    if gold:
        return "#c9a54a"
    if kind == "denim":
        return "#8a8f96"
    rgb = [int(fabric_hex[i:i + 2], 16) for i in (1, 3, 5)]
    light = sum(rgb) / 3 > 110
    mix = [round(c * 0.72) if light else round(c + (255 - c) * 0.2) for c in rgb]
    return "#" + "".join(f"{c:02x}" for c in mix)


def spec_for(product: dict, color: str, brand_prior: dict[str, str]) -> dict:
    """Ficha (dict, o formato dos JSON de ``specs/``) do produto, na cor dada (#rrggbb)."""
    sub = product["subcategory"]
    collar, closure, kind, weight, sleeve, rib, fit, pockets, n_buttons = BASES[sub]
    name, desc = texto.plain(product.get("product_name")), texto.plain(product.get("description"))[:800]
    collar = texto.first(texto.COLLARS, name, desc) or collar
    closure = texto.first(texto.CLOSURES, name) or closure
    if texto.HENLEY.search(name):             # henley: gola careca com a vista curta de botões
        collar, closure = "careca", "polo"
    sleeve = texto.first(texto.SLEEVES, name, desc) if sub not in ("tank_top",) else "sem"
    sleeve = sleeve or BASES[sub][4]
    fit = texto.first(texto.FITS, name, desc) or fit
    found = tecido.fabric_of(product.get("product_name"), product.get("description"), sub)
    if found:
        kind, weight = found, WEIGHT[found] if found != kind else weight
    if sub == "jacket" and (kind == "denim" or texto.SHIRT_JACKET.search(name)) and not texto.first(texto.CLOSURES, name):
        collar, closure, pockets = "colarinho", "botoes", ("peito",)   # jaqueta jeans, camisa-jaqueta: botões
    if texto.POCKET_KANGAROO.search(name + " " + desc) and sub in ("hoodie", "sweatshirt"):
        pockets = ("canguru",)
    elif texto.POCKET_CHEST.search(name) and sub in ("shirt", "t_shirt", "jacket", "polo_shirt", "blouse"):
        pockets = ("peito",)
    closure = _closure(sub, collar, closure)
    collar = _collar(sub, collar, closure)
    closure = _closure(sub, collar, closure)
    sex = sex_of(product, brand_prior)
    spec = {"produto": (product.get("product_name") or "")[:120], "marca": (product.get("brand") or "")[:60],
            "subcategoria": sub, "tamanho": "M", "sexo": sex, "caimento": fit,
            "tecido": {"tipo": kind, "cor": color, "gramatura": weight}, "gola": collar, "fechamento": closure,
            "bolsos": list(pockets), "ribana": rib,
            "manga_curta": sleeve == "curta", "sem_manga": sleeve == "sem", "botoes": n_buttons,
            "url_oficial": product.get("official_product_url") or ""}
    neckline = texto.first(texto.NECKLINES, name, desc) if sleeve == "sem" else None
    if neckline:                              # "Decote Reto": o recorte entre as alças sai quadrado
        spec["decote"] = neckline
    if closure in ("botoes", "polo") or collar == "lapela":
        spec["cor_botao"] = button_color(color, bool(texto.GOLD.search(name)), kind)
    shape = forma.measures(sub, sex, collar, bool(texto.CROPPED.search(name)) and sub != "crop_top")
    if shape:
        spec["medidas_marca"] = shape
    if forma.STRAPLESS.search(name) and sub in ("top", "crop_top", "tank_top", "blouse", "bodysuit"):
        spec.update(sem_alca=True, sem_manga=True, manga_curta=False)   # tomara que caia, tarja: sem alça nem manga
    if spec["sem_manga"]:   # alcinha, alça larga, decote reto ou em U: o que o texto disser
        found = forma.straps(name + " " + desc, sub)
        depth = found.pop("decote_frente", None)
        if depth and collar != "v":
            spec.setdefault("medidas_marca", {})["decote_frente"] = depth
        if collar == "v":
            found.pop("decote", None)
        spec.update(found)
    return spec
