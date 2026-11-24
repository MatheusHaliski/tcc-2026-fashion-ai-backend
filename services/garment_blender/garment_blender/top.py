"""Monta a parte de cima inteira (sem Blender): tronco, mangas, barra e punhos dobrados, gola ou capuz e detalhes."""
from __future__ import annotations

import numpy as np

from .details import chest_pocket, kangaroo, zipper
from .geometry import COLUMNS, Mesh, build_torso
from .hood import build_hood
from .measure import measure_top
from .sleeves import bend, build_sleeve, extend, inset
from .spec import GarmentSpec

COLLAR_HEIGHT = {"careca": None, "alta": 6.0}   # None: a altura da tabela (gola careca em ribana)


def _collar(mesh: Mesh, spec: GarmentSpec, neck: list[int], thick: float) -> None:
    neck_pts = np.array([mesh.verts[i] for i in neck])
    gola = (COLLAR_HEIGHT[spec.gola] or spec.medidas.gola) * 0.01
    mesh.seams.update(neck)
    extend(mesh, neck, (0, 1, 0), [(gola * 0.5, 0.985), (gola, 0.975), (gola - 0.004, 0.975 * inset(neck_pts, thick)),
                                   (-0.008, inset(neck_pts, thick))], "ribana")


def build_top(spec: GarmentSpec) -> tuple[Mesh, dict]:
    """Malha da peça e as medidas usadas (cm) para o relatório."""
    m, mesh = spec.medidas, Mesh()
    ribbed = spec.ribana
    edge_mat = "ribana" if ribbed else "corpo"
    thick = spec.tecido.espessura_mm / 1000 * (2 if ribbed else 1)   # borda dobrada: duas camadas
    grid, loops, rows, (i_arm, i_sh, i_neck) = build_torso(mesh, m, ribbed)
    cuffs = [build_sleeve(mesh, loop, m, side, rows[i_sh].y, ribbed) for loop, side in zip(loops, (1, -1))]
    hem = [int(v) for v in grid[0]]
    hem_pts = np.array([mesh.verts[i] for i in hem])
    extend(mesh, hem, (0, 1, 0), [(0.0, inset(hem_pts, thick)), (0.015, inset(hem_pts, thick))], edge_mat)
    for (cuff, direction), part in zip(cuffs, ("manga_d", "manga_e")):   # o punho dobra para dentro da manga
        pts = np.array([mesh.verts[i] for i in cuff])
        extend(mesh, cuff, -direction, [(0.0, inset(pts, thick)), (0.015, inset(pts, thick))], edge_mat, part)
    neck = [int(v) for v in grid[i_neck]]
    if spec.gola == "capuz":
        build_hood(mesh, neck, 0.02 if spec.caimento in ("amplo", "oversized") else 0.012, "corpo", thick,
                   down=spec.capuz_abaixado)
    else:
        _collar(mesh, spec, neck, thick)
    rib_top = (m.ribana_barra if ribbed else 0.0) * 0.01
    zipped = spec.fechamento == "ziper_inteiro"
    if zipped:
        zipper(mesh, rows, 0.004, rows[i_neck].y, "cadarco", "dentes")
    if "canguru" in spec.bolsos:
        kangaroo(mesh, rows, rib_top, zipped, "corpo")
    if "peito" in spec.bolsos:
        chest_pocket(mesh, rows, rows[i_arm].y, "corpo")
    medido = measure_top(mesh, m)   # a queda gira a manga sem mudar perímetros nem comprimento: mede antes dela
    for side in (1, -1):   # a manga cai até o ângulo do braço do avatar (depois do punho dobrado, que gira junto)
        bend(mesh, side, m, rows[i_sh].y, spec.angulo_manga)
    used = {k: getattr(m, k) for k in m.__dataclass_fields__}
    return mesh, {"medidas_cm": used, "colunas": COLUMNS, "angulo_manga": spec.angulo_manga, "medido_cm": medido}
