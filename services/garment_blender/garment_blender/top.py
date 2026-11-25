"""Monta a parte de cima inteira (sem Blender): tronco, mangas, barra e punhos dobrados, gola ou capuz e detalhes."""
from __future__ import annotations

from dataclasses import replace

import numpy as np

from .bodysuit import add_brief
from .buttons import LAP, buttons
from .closures import ZIP_GAP, facing, zipper
from .collars import neck_finish
from .details import chest_pocket, kangaroo
from .geometry import ARMHOLE_HALF_ANGLE, COLUMNS, Mesh, build_torso, ellipse_semi_axes
from .hood import build_hood
from .measure import measure_top
from .sleeves import build_sleeve, extend, fold_edge, inset
from .spec import GarmentSpec
from .stitches import ring_line, stitch_line

OPEN_GAP = 0.10      # frente aberta (quimono, cardigã sem botão): vão entre as bordas (m)
POLO_PLACKET = 0.14  # vista curta da polo (m abaixo do decote)
STRAP = 0.045       # largura da alça da regata (m)
STRAP_DROP = 1.5     # quanto a alça desce do decote até a ponta dela (cm)
SLEEVELESS_DROP = 3.0   # quanto a cava sem manga desce além da de manga (cm)
SLEEVELESS_ARMHOLE = 0.75   # cava da regata: entra pela frente e pelas costas até a alça (rad a partir do lado)


def build_top(spec: GarmentSpec) -> tuple[Mesh, dict]:
    """Malha da peça e as medidas usadas (cm) para o relatório."""
    m, mesh = spec.medidas, Mesh()
    if spec.sem_manga and "ombro" not in spec.medidas_marca:   # sem manga: a alça é o decote + 4,5 cm de cada lado
        neck_a, _ = ellipse_semi_axes(m.pescoco * 0.01, 0.9)
        # e a alça desce só o que o trapézio desce em 4,5 cm (1,5 cm): com a queda de um ombro de manga (4 cm) ela subia
        # reta do ombro até o decote e ficava em pé, solta do corpo
        m = replace(m, ombro=round(2 * (neck_a + STRAP) * 100, 1), caimento_ombro=STRAP_DROP)
    if spec.sem_manga and "cava" not in spec.medidas_marca:   # a cava sem manga desce abaixo da axila: o braço caído
        m = replace(m, cava=m.cava + SLEEVELESS_DROP)              # não prensa o pano contra o tronco
    ribbed = spec.ribana
    edge_mat = "ribana" if ribbed else "corpo"
    thick = spec.tecido.espessura_mm / 1000 * (2 if ribbed else 1)   # borda dobrada: duas camadas
    zipped, buttoned = spec.fechamento == "ziper_inteiro", spec.fechamento in ("botoes", "polo")
    opening = ZIP_GAP if zipped else -LAP if buttoned else OPEN_GAP if spec.fechamento == "aberto" else 0.0
    grid, loops, rows, (i_arm, i_sh, i_neck), front = build_torso(
        mesh, m, ribbed, opening, thick * 1.5, v_neck=spec.gola in ("v", "lapela"),
        placket=POLO_PLACKET if spec.fechamento == "polo" else 0.0, armhole=SLEEVELESS_ARMHOLE if spec.sem_manga else ARMHOLE_HALF_ANGLE,
        curved=spec.sem_manga)
    open_hem = front is not None and front.hem is not None
    ys, half = np.array([r.y for r in rows[: i_sh + 1]]), np.array([r.a for r in rows[: i_sh + 1]])
    torso_half = lambda y: float(np.interp(y, ys, half))   # noqa: E731 - meia largura do tronco na altura y
    if spec.sem_manga:   # regata, top, colete: a cava é acabada com um viés dobrado para dentro
        cuffs = []
        for loop in loops:
            fold_edge(mesh, loop, 0.01, thick * 1.5, edge_mat)
    else:
        cuffs = [build_sleeve(mesh, loop, m, side, rows[i_sh].y, ribbed, spec.angulo_manga, torso_half)
                 for loop, side in zip(loops, (1, -1))]
    hem = front.hem if open_hem else [int(v) for v in grid[0]]
    hem_pts = np.array([mesh.verts[i] for i in hem])
    body = spec.subcategoria == "bodysuit"   # o body não tem barra: a calcinha é costurada nela no fim
    if not body:
        extend(mesh, hem, (0, 1, 0), [(0.0, inset(hem_pts, thick)), (0.015, inset(hem_pts, thick))], edge_mat,
               closed=not open_hem)
    for (cuff, direction), part in zip(cuffs, ("manga_d", "manga_e")):   # o punho dobra para dentro da manga
        pts = np.array([mesh.verts[i] for i in cuff])
        extend(mesh, cuff, -direction, [(0.0, inset(pts, thick)), (0.015, inset(pts, thick))], edge_mat, part)
        if not ribbed:   # barra da manga dobrada: pesponto a 1,2 cm da borda
            line = np.vstack([pts, pts[:1]]) - np.asarray(direction) * 0.012
            radial = line - line.mean(0); radial -= np.outer(radial @ direction, direction)
            stitch_line(mesh, line, radial / np.maximum(np.linalg.norm(radial, axis=1, keepdims=True), 1e-9), part=part)
    if not ribbed and not body:   # barra dobrada: pesponto a 1,2 cm da borda
        stitch_line(mesh, *ring_line(mesh, hem, 0.012, closed=not open_hem))
    neck = front.neck if front else [int(v) for v in grid[i_neck]]
    if spec.gola == "capuz":
        build_hood(mesh, neck, 0.02 if spec.caimento in ("amplo", "oversized") else 0.012, "corpo", thick,
                   down=spec.capuz_abaixado, order=neck if front else None)
    else:
        y_v = rows[-1].y - m.decote_frente * 0.01
        neck_finish(mesh, spec, neck, front, y_v, thick, ribbed)
    rib_top = (m.ribana_barra if ribbed else 0.0) * 0.01
    closure = {}
    if front:            # bordas da frente com espessura e a vista por dentro
        facing(mesh, front.plus, 1, thick); facing(mesh, front.minus, -1, thick)
    if zipped:
        closure = zipper(mesh, front, thick, rows[i_neck].y)
    if buttoned:
        neck_front = mesh.verts[front.plus[-1]][1]
        low = neck_front - POLO_PLACKET + 0.03 if spec.fechamento == "polo" else rib_top + 0.11
        # com o V aberto, o último botão fica logo abaixo do fundo do V
        high = neck_front - 0.03 if spec.gola not in ("v", "lapela") else rows[-1].y - (m.decote_frente + 2) * 0.01
        closure = buttons(mesh, front, spec.botoes, low, high)
    if "canguru" in spec.bolsos:
        kangaroo(mesh, rows, rib_top, zipped, "corpo")
    if "peito" in spec.bolsos:
        chest_pocket(mesh, rows, rows[i_arm].y, "corpo")
    # a fita métrica mede a manga ao longo do eixo x: com a manga caída, mede a mesma peça construída em pose T
    medido = measure_top(mesh, m) if not spec.angulo_manga else build_top(replace(spec, angulo_manga=0.0))[1]["medido_cm"]
    if spec.sem_manga:
        medido = {k: v for k, v in medido.items() if k not in ("biceps", "punho", "manga")}
    used = {k: getattr(m, k) for k in m.__dataclass_fields__}
    if body:             # medido antes: as medidas da blusa contam a partir da barra, que agora sobe
        used |= add_brief(mesh, hem, m.barra * 0.01, thick)
    return mesh, {"medidas_cm": used, "colunas": COLUMNS, "angulo_manga": spec.angulo_manga, "medido_cm": medido,
                  "fechamento": closure}
