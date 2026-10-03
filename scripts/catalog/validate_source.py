"""Validação de origem: só fontes oficiais/autorizadas. A busca na web NÃO é licença de reuso — imagem sem autorização
explícita da fonte fica REFERENCE_ONLY (só a URL), nunca copiada."""
from __future__ import annotations

from normalize_product import domain

SOURCE_TYPES = {"OFFICIAL_BRAND", "OFFICIAL_STORE", "AUTHORIZED_RETAILER", "PARTNER_API", "MANUAL_ADMIN"}
BLOCKED = ("pinterest.", "pinimg.", "instagram.", "facebook.", "tiktok.", "reddit.", "blogspot.", "wordpress.",
           "tumblr.", "aliexpress.", "shein.", "wish.", "ebay.", "mercadolivre.", "olx.", "enjoei.")


def same_site(d: str | None, official: str | None) -> bool:
    if not d or not official:
        return False
    d, o = d.lower(), official.lower().removeprefix("www.")
    return d == o or d.endswith("." + o)


def blocked(url: str | None) -> bool:
    d = domain(url) or ""
    return any(b in d for b in BLOCKED)


def classify(url: str | None, official_domains: list[dict]) -> tuple[str | None, bool]:
    """(source_type da fonte oficial que casa com a URL, permite guardar cópia da imagem?)."""
    d = domain(url)
    for s in official_domains:
        if same_site(d, s["domain"]):
            return s["source_type"], bool(s["allows_image_persistence"])
    return None, False
