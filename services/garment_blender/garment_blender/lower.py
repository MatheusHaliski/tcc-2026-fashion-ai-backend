"""Monta a calça inteira (sem Blender): tronco até o gancho, pernas, cós dobrado, barra e os detalhes da ficha."""
from __future__ import annotations

from dataclasses import replace

import numpy as np

from .geometry import Mesh
from .measure import section_perimeter
from .pants import build_leg, build_upper, crotch_loops, leg_rows, upper_rows
from .pants_details import (back_pockets, belt_loops, button, cargo_pockets, double_knee, drawcord, fly,
                            slant_pockets)
from .sizes_pants import skirt_shape
from .skirt import build_skirt
from .sleeves import extend, inset
from .spec import GarmentSpec


def _skirt(spec: GarmentSpec) -> tuple[Mesh, dict]:
    """Saia: o tubo com a roda, a barra dobrada para dentro e o cós dobrado."""
    m, mesh, cm = spec.medidas_calca, Mesh(), 0.01
    thick = spec.tecido.espessura_mm / 1000 * 2
    length, roda = skirt_shape(spec.subcategoria)
    length = spec.medidas_marca.get("comprimento", length)
    grid, rows, i_band = build_skirt(mesh, m, length, roda, spec.pregas)
    hem, waist = [int(v) for v in grid[0]], [int(v) for v in grid[-1]]
    hpts, wpts = np.array([mesh.verts[i] for i in hem]), np.array([mesh.verts[i] for i in waist])
    extend(mesh, hem, (0, 1, 0), [(0.0, inset(hpts, thick)), (0.03, inset(hpts, thick))], "corpo")
    extend(mesh, waist, (0, -1, 0), [(0.0, inset(wpts, thick)), (m.cos * cm * 0.9, inset(wpts, thick))], "cos")
    mesh.seams.update(int(v) for v in grid[i_band])
    top = rows[-1].y
    measured = {"cintura": round(section_perimeter(mesh, (0, 1, 0), (0, top - m.cos * cm / 2, 0), "tronco") / cm, 1),
                "quadril": round(section_perimeter(mesh, (0, 1, 0), (0, top - 0.18, 0), "tronco") / cm, 1),
                "barra": round(section_perimeter(mesh, (0, 1, 0), (0, 0.04, 0), "tronco") / cm, 1),
                "comprimento": round(top / cm, 1)}
    used = {k: getattr(m, k) for k in ("cintura", "quadril", "cos")} | {"comprimento": length, "roda": roda}
    return mesh, {"medidas_cm": used, "medido_cm": measured}


def build_lower(spec: GarmentSpec) -> tuple[Mesh, dict]:
    if spec.subcategoria == "skirt":
        return _skirt(spec)
    m, mesh = spec.medidas_calca, Mesh()
    cm = 0.01
    thick = spec.tecido.espessura_mm / 1000 * 2
    rows, i_band = upper_rows(m)
    grid = build_upper(mesh, rows)
    band0, top, y_c = rows[i_band].y, rows[-1].y, m.entreperna * cm
    mesh.seams.update(int(v) for v in grid[i_band])                     # emenda do cós
    mesh.seams.update(int(v) for v in grid[:, 0]); mesh.seams.update(int(v) for v in grid[:, 48])   # laterais
    mesh.seams.update(int(v) for v in grid[: i_band + 1, 72])            # meio das costas
    right, left, bridge = crotch_loops(mesh, grid[0])
    mesh.seams.update(bridge)
    legs = [leg_rows(m, side, rows[0].a) for side in (1, -1)]
    hems = [build_leg(mesh, loop, lr, part) for loop, lr, part in zip((right, left), legs, ("perna_d", "perna_e"))]
    for hem, part in zip(hems, ("perna_d", "perna_e")):
        pts = np.array([mesh.verts[i] for i in hem])
        fold = 0.012 if m.ribana_barra else 0.03                        # barra reta: 3 cm dobrados para dentro
        extend(mesh, hem, (0, 1, 0), [(0.0, inset(pts, thick)), (fold, inset(pts, thick))],
               "ribana" if m.ribana_barra else "corpo", part)
        mesh.seams.add(int(hem[0]))
    waist = [int(v) for v in grid[-1]]
    wpts = np.array([mesh.verts[i] for i in waist])
    extend(mesh, waist, (0, -1, 0), [(0.0, inset(wpts, thick)), (m.cos * cm * 0.9, inset(wpts, thick))], "cos")
    if spec.fechamento == "botao_ziper":
        fly(mesh, grid, rows, band0, y_c)
        button(mesh, rows, (band0 + top) / 2, "dentes")
    if spec.fechamento == "cordao":
        drawcord(mesh, rows, band0 + 0.01, "cadarco")
    if spec.passantes:
        belt_loops(mesh, rows, band0, top)
    if "faca" in spec.bolsos:
        slant_pockets(mesh, grid, rows, band0)
    if "traseiro" in spec.bolsos:
        back_pockets(mesh, rows, band0)
    if "cargo" in spec.bolsos:
        cargo_pockets(mesh, legs, y_c * 0.45)
    if "joelho_duplo" in spec.bolsos:
        double_knee(mesh, legs, y_c * 0.45)
    if skirt_shape(spec.subcategoria):   # saia-short: a saia por cima, do quadril alto até cobrir o short
        length, roda = skirt_shape(spec.subcategoria)
        build_skirt(mesh, replace(m, cintura=m.cintura + 2, quadril=m.quadril + 3), length - m.cos, roda, spec.pregas,
                    with_band=False, bottom=band0 - (length - m.cos) * cm)   # 1 cm por fora do short: sem as duas cascas juntas
    measured = {
        "cintura": round(section_perimeter(mesh, (0, 1, 0), (0, (band0 + top) / 2 - 0.01, 0), "tronco") / cm, 1),
        "quadril": round(section_perimeter(mesh, (0, 1, 0), (0, top - 0.18, 0), "tronco") / cm, 1),
        "coxa": round(section_perimeter(mesh, (0, 1, 0), (0, max(0.006, y_c - min(0.10, y_c * 0.6)), 0), "perna_d") / cm, 1),
        "joelho": round(section_perimeter(mesh, (0, 1, 0), (0, y_c * 0.45, 0), "perna_d") / cm, 1),
        "barra": round(section_perimeter(mesh, (0, 1, 0), (0, max(0.004, m.ribana_barra * cm / 2), 0), "perna_d") / cm, 1),
        "entreperna": round(y_c / cm, 1),
        "lateral": round(top / cm, 1),
    }
    used = {k: getattr(m, k) for k in m.__dataclass_fields__}
    return mesh, {"medidas_cm": used, "medido_cm": measured}
