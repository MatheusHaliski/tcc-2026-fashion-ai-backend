"""Cor pelo nome dado pela marca (português e inglês), para o produto sem foto que sirva: o tom mais comum de cada."""
from __future__ import annotations

from .texto import plain

NAMES = (   # do mais específico ao mais geral: "verde militar" antes de "verde"
    ("off white", "#ece6d8"), ("off-white", "#ece6d8"), ("verde militar", "#5b5e3a"), ("olive", "#5b5e3a"),
    ("azul marinho", "#1f2a44"), ("marinho", "#1f2a44"), ("navy", "#1f2a44"), ("azul claro", "#9cbbe0"),
    ("light blue", "#9cbbe0"), ("vinho", "#6d1f2f"), ("burgundy", "#6d1f2f"), ("bordo", "#6d1f2f"),
    ("mescla", "#9a9a9a"), ("heather", "#9a9a9a"), ("chumbo", "#4a4a4a"), ("charcoal", "#3d3d3f"),
    ("preto", "#1b1b1b"), ("preta", "#1b1b1b"), ("black", "#1b1b1b"), ("branco", "#f2f2f0"), ("branca", "#f2f2f0"),
    ("white", "#f2f2f0"), ("cinza", "#8a8a8a"),
    ("gray", "#8a8a8a"), ("grey", "#8a8a8a"), ("azul", "#2f4f8f"), ("blue", "#2f4f8f"), ("vermelho", "#b3242c"),
    ("red", "#b3242c"), ("verde", "#2e6b3f"), ("green", "#2e6b3f"), ("amarelo", "#e3c23b"), ("yellow", "#e3c23b"),
    ("rosa", "#e3a1b5"), ("pink", "#e3a1b5"), ("roxo", "#6a4c93"), ("purple", "#6a4c93"), ("lilas", "#b9a3d6"),
    ("lilac", "#b9a3d6"), ("laranja", "#e07a2f"), ("orange", "#e07a2f"), ("marrom", "#6b4a33"), ("brown", "#6b4a33"),
    ("caramelo", "#a8703a"), ("camel", "#b08a5a"), ("bege", "#d8c7a8"), ("beige", "#d8c7a8"), ("caqui", "#b5a27a"),
    ("khaki", "#b5a27a"), ("creme", "#efe6cf"), ("cream", "#efe6cf"), ("nude", "#d9b8a0"), ("menta", "#a8d8c0"),
    ("mint", "#a8d8c0"), ("terracota", "#b5573a"), ("mostarda", "#c9a227"), ("coral", "#ee7f6d"),
)


def color_from_name(*texts: str | None) -> str | None:
    for text in texts:
        t = plain(text)
        for name, hex_color in NAMES:
            if name in t:
                return hex_color
    return None
