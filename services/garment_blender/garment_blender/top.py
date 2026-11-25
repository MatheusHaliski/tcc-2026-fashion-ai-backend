"""Monta a parte de cima inteira (sem Blender): tronco, mangas, barra e punhos dobrados, gola ou capuz e detalhes."""
from __future__ import annotations

from dataclasses import replace

import numpy as np

from .buttons import LAP, buttons
from .closures import ZIP_GAP, facing, zipper
from .collars import point_collar
from .details import chest_pocket, kangaroo
from .geometry import COLUMNS, Mesh, build_torso
from .hood import build_hood
from .measure import measure_top
from .sleeves import build_sleeve, extend, inset
from .spec import GarmentSpec
from .stitches import ring_line, stitch_line

COLLAR_HEIGHT = {"careca": None, "alta": 6.0}   # None: a altura da tabela (gola careca em ribana)


def _collar(mesh: Mesh, spec: GarmentSpec, neck: list[int], thick: float, closed: bool) -> None:
    neck_pts = np.array([mesh.verts[i] for i in neck])
    mesh.seams.update(neck)
    if spec.gola == "colarinho":   # pé e folha virada com pontas (collars.py)
        point_collar(mesh, neck, thick, closed)
        return
    gola = (COLLAR_HEIGHT[spec.gola] or spec.medidas.gola) * 0.01
    # a gola sobe reta (estreitando para abraçar o pescoço ela batia nele e a colisão a picotava) e a dobra de dentro
    # fica dentro da altura dela (descendo abaixo do decote, também batia no pescoço)
    extend(mesh, neck, (0, 1, 0), [(gola * 0.5, 1.0), (gola, 1.0), (gola - 0.004, inset(neck_pts, thick)),
                                   (gola * 0.35, inset(neck_pts, thick))], "ribana", closed=closed)


def build_top(spec: GarmentSpec) -> tuple[Mesh, dict]:
    """Malha da peça e as medidas usadas (cm) para o relatório."""
    m, mesh = spec.medidas, Mesh()
    ribbed = spec.ribana
    edge_mat = "ribana" if ribbed else "corpo"
    thick = spec.tecido.espessura_mm / 1000 * (2 if ribbed else 1)   # borda dobrada: duas camadas
    zipped, buttoned = spec.fechamento == "ziper_inteiro", spec.fechamento == "botoes"
    opening = ZIP_GAP if zipped else -LAP if buttoned else 0.0
    grid, loops, rows, (i_arm, i_sh, i_neck), front = build_torso(mesh, m, ribbed, opening, thick * 1.5)
    ys, half = np.array([r.y for r in rows[: i_sh + 1]]), np.array([r.a for r in rows[: i_sh + 1]])
    torso_half = lambda y: float(np.interp(y, ys, half))   # noqa: E731 - meia largura do tronco na altura y
    cuffs = [build_sleeve(mesh, loop, m, side, rows[i_sh].y, ribbed, spec.angulo_manga, torso_half)
             for loop, side in zip(loops, (1, -1))]
    hem = front.hem if front else [int(v) for v in grid[0]]
    hem_pts = np.array([mesh.verts[i] for i in hem])
    extend(mesh, hem, (0, 1, 0), [(0.0, inset(hem_pts, thick)), (0.015, inset(hem_pts, thick))], edge_mat,
           closed=front is None)
    for (cuff, direction), part in zip(cuffs, ("manga_d", "manga_e")):   # o punho dobra para dentro da manga
        pts = np.array([mesh.verts[i] for i in cuff])
        extend(mesh, cuff, -direction, [(0.0, inset(pts, thick)), (0.015, inset(pts, thick))], edge_mat, part)
        if not ribbed:   # barra da manga dobrada: pesponto a 1,2 cm da borda
            line = np.vstack([pts, pts[:1]]) - np.asarray(direction) * 0.012
            radial = line - line.mean(0); radial -= np.outer(radial @ direction, direction)
            stitch_line(mesh, line, radial / np.maximum(np.linalg.norm(radial, axis=1, keepdims=True), 1e-9), part=part)
    if not ribbed:       # barra dobrada: pesponto a 1,2 cm da borda
        stitch_line(mesh, *ring_line(mesh, hem, 0.012, closed=front is None))
    neck = front.neck if front else [int(v) for v in grid[i_neck]]
    if spec.gola == "capuz":
        build_hood(mesh, neck, 0.02 if spec.caimento in ("amplo", "oversized") else 0.012, "corpo", thick,
                   down=spec.capuz_abaixado, order=neck if front else None)
    else:
        _collar(mesh, spec, neck, thick, closed=front is None)
    rib_top = (m.ribana_barra if ribbed else 0.0) * 0.01
    closure = {}
    if front:            # bordas da frente com espessura e a vista por dentro
        facing(mesh, front.plus, 1, thick); facing(mesh, front.minus, -1, thick)
    if zipped:
        closure = zipper(mesh, front, thick, rows[i_neck].y)
    if buttoned:
        neck_front = mesh.verts[front.plus[i_neck]][1]
        closure = buttons(mesh, front, spec.botoes, rib_top + 0.11, neck_front - 0.03)
    if "canguru" in spec.bolsos:
        kangaroo(mesh, rows, rib_top, zipped, "corpo")
    if "peito" in spec.bolsos:
        chest_pocket(mesh, rows, rows[i_arm].y, "corpo")
    # a fita métrica mede a manga ao longo do eixo x: com a manga caída, mede a mesma peça construída em pose T
    medido = measure_top(mesh, m) if not spec.angulo_manga else build_top(replace(spec, angulo_manga=0.0))[1]["medido_cm"]
    used = {k: getattr(m, k) for k in m.__dataclass_fields__}
    return mesh, {"medidas_cm": used, "colunas": COLUMNS, "angulo_manga": spec.angulo_manga, "medido_cm": medido,
                  "fechamento": closure}
