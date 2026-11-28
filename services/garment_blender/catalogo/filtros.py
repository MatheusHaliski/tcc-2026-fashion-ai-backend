"""O último crivo de cada desenho achado, já com o lugar dele na peça: o que é tinta (borda de degrau, cor própria) e
o que é luz e sombra do tecido (rampa suave, a mesma cor só mais clara ou mais escura), com a régua mais dura onde o
lixo mais aparece — a manga da foto em modelo, a peça dita lisa, o material de brilho.

As réguas foram medidas nos produtos rotulados a olho (``tests/data/rotulos_estampa.json``, ``avaliacao.py``): na
manga, todo desenho de verdade tem borda ≥ 18 de L por pixel e degrau ≥ 0,38 do contraste; as dobras e o reflexo
que passavam ficavam quase todos abaixo disso.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import ndimage

from .cores import lab_to_rgb

SLEEVE_EDGE, SLEEVE_STEP, SLEEVE_CONTRAST = 15.0, 0.36, 40.0
WORN_HALO, WORN_CONTRAST = 0.12, 30.0   # na frente da foto em modelo: degrau limpo e contraste de tinta…
WORN_TINT, WORN_TINT_HALO = 0.3, 0.2    # …ou uma cor própria (que a sombra não dá) com degrau razoável
FLAT_HALO = 0.25                        # na peça sozinha (sem dobra de corpo) basta o degrau
INK_EDGE, INK_STEP = 12.0, 0.33         # borda de tinta: degrau de L por pixel e a fração dele no contraste
SMALL, LOGO = 0.02, 0.06                # lado maior (m): menor que isso é miúdo demais; logo de peito para cima
PIECE = 20.0                            # contraste mínimo do pedaço que pode entrar junto de um desenho vizinho


@dataclass
class Looks:
    """O que o crivo mede de cada desenho: ``contrast`` (Lab, sem a sombra), ``dl`` (quanto a luminosidade foge da
    sombra do lugar, em média), ``dab`` (quanto a cor foge, mediana do croma), ``edge`` (mediana do degrau de L na
    borda, por pixel), ``step`` (``edge`` / ``dl``: degrau de tinta perto de 0,4, rampa de sombra perto de 0,2) e
    ``tint`` (diferença de cromaticidade, que a sombra não muda: tecido mais escuro tem a mesma) e ``halo`` (o quanto o
    pano logo em volta, de 1 a 3 px fora, ainda foge do tecido, em fração do contraste: tinta tem degrau e o pano em
    volta volta ao tecido, ~0,1; sombra e dobra são rampa e o em volta ainda está meio escuro, ~0,2–0,5)."""
    contrast: float
    dl: float
    dab: float
    edge: float
    step: float
    tint: float
    compact: bool
    fill: float
    halo: float
    bg: float = 0.0


class Ruler:
    """Os mapas da foto que o crivo usa, calculados uma vez por foto."""

    def __init__(self, lab: np.ndarray, shade: np.ndarray, base: np.ndarray, dist: np.ndarray, cand: np.ndarray,
                 mask: np.ndarray, background: np.ndarray | None = None):
        self.lab, self.shade, self.base, self.dist, self.cand, self.mask = lab, shade, base, dist, cand, mask
        self.background = background
        gy, gx = np.gradient(ndimage.gaussian_filter(lab[..., 0], 0.7))
        self.grad = np.hypot(gx, gy)
        self.base_tint = _tint(base[None])[0]

    def looks(self, g) -> Looks:
        y0, y1, x0, x1 = g.box
        a = g.alpha
        px = self.lab[y0:y1, x0:x1][a]
        d_l = np.abs(px[:, 0] - self.shade[y0:y1, x0:x1][a])
        ring = ndimage.binary_dilation(a) & ~ndimage.binary_erosion(a)
        edge = float(np.median(self.grad[y0:y1, x0:x1][ring])) if ring.any() else 0.0
        dl = float(d_l.mean())
        h, w = y1 - y0, x1 - x0
        return Looks(contrast=g.contrast, dl=dl,
                     dab=float(np.median(np.hypot(px[:, 1] - self.base[1], px[:, 2] - self.base[2]))),
                     edge=edge, step=edge / max(1.0, dl),
                     tint=float(np.median(np.abs(_tint(px) - self.base_tint).sum(-1))),
                     compact=max(h, w) <= 3 * min(h, w), fill=float(a.mean()), halo=self._halo(g),
                     bg=0.0 if self.background is None else float((np.abs(px - self.background).max(-1) < 7).mean()))

    def _halo(self, g) -> float:
        y0, y1, x0, x1 = g.box
        ya, xa = max(0, y0 - 4), max(0, x0 - 4)
        sl = (slice(ya, y1 + 4), slice(xa, x1 + 4))
        a = np.zeros(self.dist[sl].shape, bool)
        a[y0 - ya:y1 - ya, x0 - xa:x1 - xa] = g.alpha
        ring = ndimage.binary_dilation(a, iterations=3) & ~ndimage.binary_dilation(a) & ~self.cand[sl] & self.mask[sl]
        return float(np.median(self.dist[sl][ring])) / max(g.contrast, 1.0) if ring.any() else 1.0


def _tint(lab_px: np.ndarray) -> np.ndarray:
    """Cromaticidade (r, g, b somando 1, em RGB linear): a sombra escurece os três canais por igual e não a muda."""
    rgb = lab_to_rgb(lab_px) / 255.0
    lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4) + 1e-3
    return lin / lin.sum(-1, keepdims=True)


def verdict(look: Looks, where: dict, frame, clues: dict | None, open_front: bool = False) -> int:
    """2: desenho; 1: pedaço que só entra junto de um desenho vizinho (``juncao.merge``); 0: não é desenho.

    Na manga só tinta de verdade (borda de degrau e contraste alto): é onde dobra, sombra de braço e reflexo mais
    viram desenho. Na frente saem primeiro as coisas que não são pintura — ferragem e botão do agasalho, o fundo pelo
    vão do braço, o colar e a renda ralos — e depois a régua de tinta contra sombra."""
    clues = clues or {}
    w, h, x, y = where["largura"], where["altura"], where["x"], where["abaixo_do_ombro"]
    big = max(w, h)
    ink = look.edge >= INK_EDGE and look.step >= INK_STEP
    if where["lado"] != "frente":
        sure = look.edge >= SLEEVE_EDGE and look.step >= SLEEVE_STEP and look.contrast >= SLEEVE_CONTRAST
        return 2 if sure and big >= SMALL and not clues.get("brilho") else 0
    colored = look.tint >= WORN_TINT
    logo_spot = 0.08 <= y <= 0.30 and 0.04 <= abs(x) <= 0.17 and h <= 1.5 * w
    if clues.get("aberta") or clues.get("brilho") or open_front:   # zíper, botão, rebite, o que aparece por dentro
        if big < LOGO and (y > 0.33 or not (colored or (logo_spot and look.contrast >= 35 and look.halo <= 0.15))):
            return 0
        if open_front and not (logo_spot and look.halo <= WORN_HALO and look.contrast >= 35):
            return 0
    if abs(x) > 0.12 and y > 0.3 and h > 2 * w and look.bg >= 0.3:   # o fundo da foto pelo vão do braço
        return 0
    if frame.worn:
        if big < SMALL or (look.fill < 0.12 and not ink):   # colar, renda, cordão: ralo e sem degrau
            return 0
        if (look.halo <= WORN_HALO and look.contrast >= WORN_CONTRAST) or (colored and look.halo <= WORN_TINT_HALO):
            return 2
        if ink and look.contrast >= 35 and look.halo <= 0.2 and big >= LOGO:   # letra só de contorno, grande
            return 2
        if min(w, h) >= 0.1 and look.contrast >= 35 and look.fill >= 0.25 and look.halo <= 0.3:   # estampa grande
            return 2
        if min(w, h) >= 0.15 and abs(x) < 0.08 and look.contrast >= 25 and look.fill >= 0.25 and look.halo <= 0.35:
            return 2   # estampa enorme no meio do peito (o "BULLS" lavado): dobra não tem esse tamanho
        return 1 if look.contrast >= PIECE else 0
    if look.halo <= FLAT_HALO and (look.contrast >= 24 or big >= 0.04):
        return 2
    if look.step >= 0.25 and big >= 0.04 and look.fill >= 0.15 and look.halo <= 0.4:   # tom sobre tom, grande
        return 2
    return 1 if look.contrast >= PIECE else 0
