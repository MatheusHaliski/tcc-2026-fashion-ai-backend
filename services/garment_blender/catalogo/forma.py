"""Medidas de construção da base de cada subcategoria e o recorte que a foto mostra (comprimento, manga).

As bases do motor (``specs/``) trazem medidas que fazem a peça ser o que é: o V fundo da lapela do blazer, o casaco
longo, o colete curto, a manga larga do quimono. Aqui elas valem para todo produto da subcategoria — em cm, e o
comprimento como fração do comprimento padrão do sexo (``sizes.py``: 63 cm no feminino, 70 no masculino).
"""
from __future__ import annotations

SHAPE = {
    "blazer": {"decote_frente": 26, "comprimento": 1.1},
    "coat": {"decote_frente": 24, "comprimento": 1.45},
    "vest": {"decote_frente": 22, "comprimento": 0.92},
    "cardigan": {"decote_frente": 20},
    "kimono": {"comprimento": 1.27, "biceps": 52, "punho": 48, "manga": 50},
    "parka": {"comprimento": 1.2},
    "top": {"comprimento": 0.85, "decote_frente": 9},
    "tank_top": {"cava": 25, "decote_frente": 9},
    "crop_top": {"comprimento": 0.7},
    "bodysuit": {"decote_frente": 8},
}
V_DEPTH = {"sweater": 16, "cardigan": 20, "vest": 22}   # gola V fechada: o V desce isso do ombro (cm); 12 nas outras
CROP = 0.72
SHORT, LONG = 0.8, 1.25   # comprimento medido na foto que muda a base: abaixo de 80 % ou acima de 125 %
SKIN_BELOW = 0.3          # barriga aparecendo logo abaixo da barra em 30 % dela: cropped de verdade (não para dentro)


def base_length(sex: str) -> float:
    return 63.0 if sex == "FEMININO" else 70.0


def measures(sub: str, sex: str, collar: str, cropped: bool) -> dict[str, float]:
    """Medidas da base da subcategoria que a ficha leva em ``medidas_marca``."""
    full = base_length(sex)
    out = {k: round(full * v, 1) if k == "comprimento" else float(v) for k, v in SHAPE.get(sub, {}).items()}
    if collar == "v" and sub not in ("blazer", "coat"):
        out["decote_frente"] = float(max(out.get("decote_frente", 0), V_DEPTH.get(sub, 12)))
    if cropped:
        out["comprimento"] = round(min(out.get("comprimento", full), full) * CROP, 1)
    return out


def from_photo(spec: dict, photo: dict, sleeves_from_text: bool) -> list[str]:
    """Ajusta a ficha ao que a foto em modelo mostra; devolve o que mudou. Comprimento: medido pela altura do rosto,
    só quando difere muito da base (a peça para dentro da calça não encurta: precisa da barriga aparecendo). Manga:
    só quando o texto não disse, pela pele do braço à mostra."""
    changed = []
    measured = photo.get("comprimento_foto")
    current = spec.get("medidas_marca", {}).get("comprimento", base_length(spec["sexo"]))
    if measured:
        cm = measured * 100
        if cm < SHORT * current and photo.get("pele_abaixo", 0) >= SKIN_BELOW:
            spec.setdefault("medidas_marca", {})["comprimento"] = round(max(cm, 0.5 * current), 1)
            changed.append("comprimento")
        elif cm > LONG * current and spec["subcategoria"] not in ("bodysuit", "crop_top"):
            spec.setdefault("medidas_marca", {})["comprimento"] = round(min(cm, 1.6 * current), 1)
            changed.append("comprimento")
    arms = photo.get("bracos")
    if not sleeves_from_text and arms is not None and photo.get("em_modelo") and \
            spec["subcategoria"] in ("blouse", "top", "bodysuit", "crop_top", "shirt", "t_shirt"):
        if not spec["manga_curta"] and not spec["sem_manga"] and arms > 0.06:
            spec["manga_curta"] = True
            changed.append("manga")
        elif (spec["manga_curta"] or spec["sem_manga"]) and arms < 0.01:
            spec["manga_curta"] = spec["sem_manga"] = False
            changed.append("manga")
    if "comprimento" in spec.get("medidas_marca", {}) and spec["medidas_marca"].get("cava"):
        spec["medidas_marca"]["cava"] = min(spec["medidas_marca"]["cava"], spec["medidas_marca"]["comprimento"] * 0.6)
    return changed
