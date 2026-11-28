"""Acabamentos do kit da mansão: cada peça pede o seu com um nome próprio (``dono``), então nenhum móvel, lustre ou
porta divide material com outro — a nogueira da biblioteca não é a do escritório. Madeiras com veio e verniz, metais
(latão envelhecido, ferro forjado, dourado), cristal, estofados (veludo, brocado, couro) e vidro."""
from __future__ import annotations

from ..materiais import material


def nogueira(dono: str, tom: str = "#4A2C18"):
    return material(f"{dono}:nogueira", tom, "madeira", aspereza=0.32, verniz=0.7, repete=1.6)


def mogno(dono: str, tom: str = "#5A1E12"):
    return material(f"{dono}:mogno", tom, "madeira", aspereza=0.28, verniz=0.85, repete=1.8)


def ebano(dono: str, tom: str = "#121014"):
    return material(f"{dono}:ebano", tom, "laca", aspereza=0.12, verniz=1.0, repete=1.0)


def carvalho(dono: str, tom: str = "#9A6A3A"):
    return material(f"{dono}:carvalho", tom, "madeira", aspereza=0.45, verniz=0.4, repete=1.5)


def pintado(dono: str, tom: str = "#E8E0D0"):
    return material(f"{dono}:pintado", tom, "laca", aspereza=0.35, verniz=0.3, repete=0.8)


def latao_velho(dono: str, tom: str = "#9C7A3C"):
    return material(f"{dono}:latao-velho", tom, "escovado", metal=1.0, aspereza=0.38, repete=3)


def dourado(dono: str, tom: str = "#D4AF37"):
    return material(f"{dono}:dourado", tom, metal=1.0, aspereza=0.16)


def ferro(dono: str, tom: str = "#1E1F22"):
    return material(f"{dono}:ferro", tom, "concreto", metal=0.85, aspereza=0.55, repete=4)


def cromo(dono: str):
    return material(f"{dono}:cromo", "#D8DCE2", metal=1.0, aspereza=0.06)


def cristal(dono: str, brilho: float = 0.8):
    return material(f"{dono}:cristal", "#F4F8FF", aspereza=0.02, verniz=1.0, emissao=brilho)


def vidro(dono: str, tom: str = "#B8D0D8"):
    return material(f"{dono}:vidro", tom, aspereza=0.03, verniz=1.0)


def luz(dono: str, tom: str = "#FFE2A8", forca: float = 8.0):
    return material(f"{dono}:luz", tom, emissao=forca)


def veludo(dono: str, tom: str):
    return material(f"{dono}:veludo", tom, "veludo", aspereza=0.75, fibra=1.0, repete=3)


def brocado(dono: str, tom: str):
    return material(f"{dono}:brocado", tom, "tecido", aspereza=0.55, fibra=0.7, repete=5)


def couro(dono: str, tom: str = "#3A1A10"):
    return material(f"{dono}:couro", tom, "veludo", aspereza=0.42, fibra=0.15, repete=2)


def marmore(dono: str, tom: str = "#ECE8E0"):
    return material(f"{dono}:marmore", tom, "marmore", aspereza=0.12, verniz=0.8, repete=1.2)
