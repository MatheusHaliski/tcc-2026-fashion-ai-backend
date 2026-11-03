"""Nome e tipo do produto do coletor oficial: subtipo pela taxonomia (nunca chutado), título limpo com a cor citada,
peças fora do acervo, kits e a mesma marca escrita de outro jeito."""
from __future__ import annotations

import re
from typing import Optional

from normalize_product import Normalizer, key

# ───────────────────────── produto do catálogo

MODIFIERS = ("short sleeve", "short sleeved", "long sleeve", "long sleeved", "manga curta", "manga longa", "manga corta",
             "shoe bag", "for shoes", "shoe care", "sock liner", "boot cut", "bootcut", "shirt dress", "tee dress")
ENGLISH_HINTS = {"men", "mens", "women", "womens", "kids", "boys", "girls", "unisex", "with", "the", "and", "for", "s"}


def infer_subcategory(n: Normalizer, *texts: Optional[str]) -> Optional[str]:
    """Subtipo pela taxonomia, lendo nome/categoria da página. Modificadores ("short sleeve", "manga curta") não contam.
    Em inglês o núcleo do nome vem no fim ("...Short-Sleeve Top" = top); em português/espanhol, no começo ("Camiseta
    ..."). Frases maiores vencem as menores na mesma posição. Sem acerto: None (nunca chutado)."""
    for t in texts:
        k = " " + key(t) + " "
        for m in MODIFIERS:
            k = k.replace(" " + m + " ", " · ")
        words = k.split()
        hits = []                                                 # (início, fim, subtipo)
        for size in (3, 2, 1):
            for i in range(len(words) - size + 1):
                gram = words[i:i + size]
                if "·" in gram:
                    continue
                sub = n.subcategory(" ".join(gram))
                if sub and not any(h[0] <= i and i + size <= h[1] for h in hits):
                    hits.append((i, i + size, sub))
        if hits:
            english = len(ENGLISH_HINTS & set(words)) > 0
            hits.sort(key=lambda h: h[0])
            return hits[-1][2] if english else hits[0][2]
    return None


UNSUPPORTED = ("bra", "bras", "sports bra", "sutia", "underwear", "cueca", "cuecas", "calcinha", "calcinhas", "boxer", "boxers",
               "brief", "briefs", "lingerie", "thong", "tanga", "gift card", "vale presente", "cartao presente")
_PACK = re.compile(r"\b(tripack|tri pack|\d+\s?pack|pack\s?\d+|kit\s?(com\s)?\d+|\d+\s?pares|multipack)\b")


_AUDIENCE = re.compile(r"\s+-\s+(women|men|unisex|kids|boys|girls|baby|feminino|masculino|infantil)\s*$", re.I)


def clean_title(raw: Optional[str], brand: str, n: Normalizer) -> tuple[Optional[str], Optional[str]]:
    """Título da página → (nome do produto, cor citada no título).

    "Utility Barrel Pant | Bone | Tall" → ("Utility Barrel Pant", "Bone");
    "Trench Coat in Ivory white - Women | Burberry® Official" → ("Trench Coat", "Ivory white").
    Sufixo da loja ("| Marca® Official"), público ("- Women") e caimento ("| Tall") saem; a cor só é separada quando a
    taxonomia a reconhece (senão fica no nome)."""
    if not raw:
        return raw, None
    parts = [p.strip() for p in re.split(r"\s+\|\s+", raw) if p.strip()]
    brand_key = _squash(brand)
    parts = [p for p in parts if not (brand_key and brand_key in _squash(p) and re.search(r"official|oficial|loja|store|®", p, re.I))
             and not re.fullmatch(r"(official|oficial)( site| store| loja)?", p, re.I)] or parts[:1]
    name, color = parts[0], None
    for extra in parts[1:]:
        if color is None and n.color(extra):
            color = extra
    name = _AUDIENCE.sub("", name).strip()
    m = re.search(r"\s+in\s+([A-Za-z][A-Za-z /-]{2,30})$", name)
    if m and n.color(m.group(1)):
        color = color or m.group(1).strip()
        name = name[:m.start()].strip()
    return name or raw, color


def unsupported_reason(name: Optional[str]) -> Optional[str]:
    """Peças fora da taxonomia do acervo (roupa íntima, vale-presente): ficam de fora em vez de virar outro tipo."""
    k = " " + key(name) + " "
    hit = next((u for u in UNSUPPORTED if f" {u} " in k), None)
    return f"tipo fora do acervo ({hit})" if hit else None


def is_pack(name: Optional[str]) -> bool:
    return bool(_PACK.search(key(name)))


def _squash(s: Optional[str]) -> str:
    return re.sub(r"[^a-z0-9]", "", key(s))


def same_brand(n: Normalizer, page_brand: str, brand: str) -> bool:
    """"Levis" = "Levi's" = "LEVI’S®"; apelidos cadastrados (CK → Calvin Klein) também valem."""
    a, b = _squash(page_brand), _squash(brand)
    if a and b and (a in b or b in a):
        return True
    sa, sb = n.brand_slug(page_brand), n.brand_slug(brand)
    return bool(sa and sb and sa == sb)
