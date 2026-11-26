"""Golas: colarinho de camisa e de polo, lapela, faixa ao longo da frente aberta e viés.

Colarinho: o pé sobe do decote, a folha vira para fora e desce por cima dele; perto da frente desce mais e abre para
o lado — as pontas. A polo usa o mesmo desenho em malha de ribana, com pé mais baixo e pontas curtas (``STYLES``).
Lapela e faixa são a borda do painel virada e deitada no peito (``band_along``). Viés: a borda do decote dobrada para
dentro, sem subir — a gola da regata, do top e do body. Pesponto à vista em todas.
"""
from __future__ import annotations

import numpy as np

from .geometry import TILE, Mesh
from .stitches import stitch_line

# pé, quanto a folha desce nas costas e na ponta, quanto a ponta abre, por quantos cm do decote ela se estende (m)
STYLES = {
    "colarinho": dict(stand=0.032, back=0.036, point=0.08, spread=0.045, run=0.09, mat="corpo"),
    "polo": dict(stand=0.024, back=0.032, point=0.058, spread=0.028, run=0.07, mat="ribana"),
}
ROWS = (0.35, 0.7, 1.0)


def point_collar(mesh: Mesh, neck: list[int], thick: float, closed: bool, points: bool = True, style: str = "colarinho") -> None:
    """Colarinho sobre o decote ``neck`` (aberto: da borda −x pelas costas até a borda +x). ``points=False``: sem as
    pontas (o colarinho das costas do blazer, que encontra as lapelas no ombro). ``style``: chave de ``STYLES``."""
    st = STYLES[style]
    STAND, FALL_BACK, FALL_POINT, SPREAD, POINT_RUN, mat = st["stand"], st["back"], st["point"], st["spread"], st["run"], st["mat"]
    base = np.array([mesh.verts[i] for i in neck])
    c = base.mean(0)
    radial = base - c
    radial[:, 1] = 0.0
    radial /= np.maximum(np.linalg.norm(radial, axis=1, keepdims=True), 1e-9)
    z0, z1 = base[:, 2].min(), base[:, 2].max()
    front = np.clip((base[:, 2] - (z0 + z1) / 2) / max((z1 - z0) / 2, 1e-9), 0, 1)   # 0 nas laterais e costas, 1 na frente
    side = np.sign(base[:, 0])
    if not closed:   # as pontas do decote aberto: cada uma é do seu painel (no transpasse ela passa do meio)
        side[0], side[-1] = -1.0, 1.0
    up = np.array([0.0, 1.0, 0.0])
    rings = [base + up * STAND * 0.5, base + up * STAND, base + up * (STAND + thick) + radial * thick * 1.5]
    # ponta: a borda de baixo sobe em linha reta da ponta até ``POINT_RUN`` dela (a curva pela frente fazia uma gola
    # redonda, não um colarinho). Medido ao longo do decote a partir de cada ponta; no decote fechado não há ponta.
    arc = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(base, axis=0), axis=1))])
    tip = np.clip(1 - np.minimum(arc, arc[-1] - arc) / POINT_RUN, 0, 1) if not closed and points else np.zeros(len(base))
    fall = FALL_BACK + (FALL_POINT - FALL_BACK) * tip
    top = rings[-1]
    for t in ROWS:   # a folha desce por fora do pé, afastando-se dele e, na frente, abrindo para o lado
        # o tronco abre logo abaixo do decote (ombro e peito): a folha se afasta do pé à medida que desce, mais na
        # frente, onde a ponta deita sobre o peito — rente ao pé ela ficava por baixo do pano do ombro
        lift = (0.006 + (0.012 + 0.03 * front) * t)[:, None]
        out = radial * lift + np.outer(side * SPREAD * tip ** 1.5 * t, [1.0, 0.0, 0.0])
        rings.append(top - np.outer(fall * t, up) + out)
    for r in rings[2:]:   # da dobra para baixo cada folha começa no meio e abre para o seu lado: sem cruzar a outra
        r[:, 0] = side * np.maximum(side * r[:, 0], 0.002)
    ids = [list(neck)] + [[mesh.add(p) for p in r] for r in rings]
    n = len(neck)
    for r in range(len(ids) - 1):
        a, b = ids[r], ids[r + 1]
        for i in range(n if closed else n - 1):
            j = (i + 1) % n
            mesh.quad((a[i], a[j], b[j], b[i]), [(i * 0.2, r * 0.2), (j * 0.2, r * 0.2), (j * 0.2, (r + 1) * 0.2),
                                                 (i * 0.2, (r + 1) * 0.2)], mat)
    mesh.seams.update(int(v) for v in ids[2])   # dobra do colarinho
    edge = rings[-1] + up * 0.004 + radial * 0.0006   # pesponto 4 mm acima da borda da folha, por fora
    stitch_line(mesh, np.vstack([edge, edge[:1]]) if closed else edge, radial)


LAPEL = 0.075        # largura da lapela no alto (m)


def _strip(mesh: Mesh, ids: list[int], across: np.ndarray, normal: np.ndarray, width: np.ndarray, thick: float,
           mat: str, flip: bool) -> np.ndarray:
    """Faixa deitada sobre o pano a partir da borda ``ids``: a dobra (a espessura) e a faixa de ``width`` m.
    Devolve a borda de fora (para o pesponto)."""
    base = np.array([mesh.verts[i] for i in ids])
    fold = base + normal * (thick * 2)
    outer = fold + across * width[:, None] + normal * 0.003
    f_ids, o_ids = [mesh.add(p) for p in fold], [mesh.add(p) for p in outer]
    for j in range(len(ids) - 1):
        for a, b in ((ids, f_ids), (f_ids, o_ids)):
            quad = (b[j], a[j], a[j + 1], b[j + 1]) if flip else (a[j], b[j], b[j + 1], a[j + 1])
            mesh.quad(quad, [(0, j * 0.2), (0.3, j * 0.2), (0.3, (j + 1) * 0.2), (0, (j + 1) * 0.2)], mat)
    mesh.seams.update(f_ids)
    return outer


def _frame(base: np.ndarray, away: float) -> tuple[np.ndarray, np.ndarray]:
    """Normal de fora (horizontal, saindo do eixo do corpo) e a direção na superfície perpendicular à curva, para o
    lado do pano (``away``: sinal que põe a primeira direção para o lado do painel)."""
    normal = base.copy(); normal[:, 1] = 0.0
    normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-9)
    tangent = np.gradient(base, axis=0)
    across = np.cross(normal, tangent)
    across /= np.maximum(np.linalg.norm(across, axis=1, keepdims=True), 1e-9)
    return normal, across * away


def lapels(mesh: Mesh, edges: list[tuple[list[int], int]], y_v: float, thick: float, mat: str = "corpo",
           width: float = LAPEL) -> None:
    """Lapelas do blazer e do casaco: a borda de cada painel no V (do fundo do V, ``y_v``, ao decote) virada para fora,
    deitada no peito — estreita no fundo, onde a lapela quebra, e larga em cima, onde encontra o colarinho.
    ``edges``: (vértices da borda do painel, de baixo para cima; lado do painel: +1 ou −1)."""
    for ids_all, side in edges:
        ids = [i for i in ids_all if mesh.verts[i][1] >= y_v - 1e-6]
        if len(ids) < 2:
            continue
        base = np.array([mesh.verts[i] for i in ids])
        normal, across = _frame(base, 1.0)
        across *= np.where(across[:, :1] * side >= 0, 1.0, -1.0)
        t = np.clip((base[:, 1] - y_v) / max(base[-1, 1] - y_v, 1e-6), 0, 1) ** 0.7
        outer = _strip(mesh, ids, across, normal, width * t, thick, mat, flip=side < 0)
        stitch_line(mesh, outer - across * 0.006 + normal * 0.0006, normal)


def band_along(mesh: Mesh, ids: list[int], width: float, thick: float, mat: str) -> None:
    """Faixa de largura constante ao longo de uma borda contínua (a borda −x de baixo para cima, o decote pelas costas
    e a borda +x de cima para baixo): a ribana do cardigã em V, a faixa do quimono. Deita sobre o pano, do lado dele."""
    base = np.array([mesh.verts[i] for i in ids])
    normal, across = _frame(base, 1.0)
    if across[0, 0] > 0:                       # começa na borda −x: o pano fica para −x
        across = -across
    outer = _strip(mesh, ids, across, normal, np.full(len(ids), width), thick, mat, flip=True)
    stitch_line(mesh, outer - across * 0.005 + normal * 0.0006, normal)


def binding(mesh: Mesh, neck: list[int], thick: float, closed: bool, mat: str = "corpo", frame=None) -> None:
    """Viés: a borda do decote dobrada para dentro, sem subir (regata, top, body, blusa de malha), com pesponto.
    ``frame``: (normal, para dentro do pano) de ``edge_frame``: o pesponto vai 7 mm para dentro do pano, não para baixo."""
    from .sleeves import fold_edge
    fold_edge(mesh, neck, 0.009, thick * 1.5, mat, closed=closed, frame=frame)
    if frame is not None:
        normal, away = frame
        pts = np.array([mesh.verts[i] for i in neck]) + away * 0.007
    else:
        pts = np.array([mesh.verts[i] for i in neck]) - np.array([0.0, 0.007, 0.0])
        normal = pts.copy(); normal[:, 1] = 0.0
        normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-9)
    if closed:
        pts, normal = np.vstack([pts, pts[:1]]), np.vstack([normal, normal[:1]])
    stitch_line(mesh, pts + normal * 0.0006, normal)


COLLAR_HEIGHT = {"careca": None, "alta": 6.0}   # None: a altura da tabela (gola careca em ribana)
V_BAND = 0.028       # ribana do cardigã em V (m)
SASH = 0.06          # faixa do quimono (m)


def _crew(mesh: Mesh, spec, neck: list[int], thick: float, closed: bool) -> None:
    """Gola careca (ribana) ou alta: sobe do decote e se inclina um pouco para o pescoço, com a dobra por dentro e o
    pesponto de cobertura logo abaixo da costura. Reta, de pé, ela parecia gola alta em toda peça."""
    from .sleeves import extend, inset
    pts = np.array([mesh.verts[i] for i in neck])
    crew = spec.gola == "careca"
    gola = (COLLAR_HEIGHT[spec.gola] or spec.medidas.gola) * 0.01 * (0.8 if crew else 1.0)   # careca baixa: 2 cm
    lean = 0.9 if crew else 1.0
    extend(mesh, neck, (0, 1, 0), [(gola * 0.5, (1 + lean) / 2), (gola, lean), (gola - 0.004, lean * inset(pts, thick)),
                                   (gola * 0.35, inset(pts, thick))], "ribana", closed=closed)
    line = pts - np.array([0.0, 0.006, 0.0])
    normal = line.copy(); normal[:, 1] = 0.0
    normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-9)
    if closed:
        line, normal = np.vstack([line, line[:1]]), np.vstack([normal, normal[:1]])
    stitch_line(mesh, line + normal * 0.0006, normal)


def neck_finish(mesh: Mesh, spec, neck: list[int], front, y_v: float, thick: float, ribbed: bool,
                frame=None) -> None:
    """A gola de cada peça (o capuz é à parte): colarinho, polo, lapela, V com ribana, faixa, viés, careca ou alta.
    ``neck``: o decote (aberto quando a frente abre); ``front``: a frente aberta; ``y_v``: o fundo do V. ``frame``: a
    peça sem manga de alça (``edge_frame``): careca e alta viram viés (a gola subindo não cabe no decote da alça)."""
    closed = front is None
    mesh.seams.update(neck)
    g = spec.gola
    if g in ("colarinho", "polo"):
        point_collar(mesh, neck, thick, closed, style=g)
    elif g == "lapela":                                   # colarinho só atrás; na frente, as lapelas
        point_collar(mesh, neck, thick, closed=False, points=False)
        lapels(mesh, [(front.plus, 1), (front.minus, -1)], y_v, thick,
               width=LAPEL * (1.3 if spec.subcategoria == "coat" else 1.0))
    elif g == "v" and front is not None and ribbed:      # cardigã: ribana contínua pelo V e pela nuca
        up = lambda ids: [i for i in ids if mesh.verts[i][1] >= y_v - 1e-6]   # noqa: E731
        band_along(mesh, up(front.minus) + neck[1:-1] + up(front.plus)[::-1], V_BAND, thick, "ribana")
    elif g == "v" and (frame is None or front is not None):   # colete de alfaiataria: só a vista
        return
    elif g == "faixa" and front is not None:             # quimono: a faixa corre a frente toda e a nuca
        band_along(mesh, list(front.minus) + neck[1:-1] + list(front.plus)[::-1], SASH, thick, "corpo")
    elif g == "vies" or frame is not None:
        binding(mesh, neck, thick, closed, "ribana" if frame is not None and g != "vies" and spec.ribana else "corpo",
                frame)
    else:
        _crew(mesh, spec, neck, thick, closed)
