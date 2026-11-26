"""Recorte da peça sem manga: a alça, o decote e a cava desenhados em x (largura) e y (altura), sem Blender.

A regata de verdade tem o peito na largura toda até a axila, a cava subindo em curva até a borda de fora da alça e a
alça subindo reta (vertical) pelo meio do ombro; entre as duas alças fica o decote (redondo, quadrado/reto ou V).
Antes a alça era o próprio decote alargado: o tronco afinava até o pescoço e a peça parecia frente única.

Tudo aqui é uma linha de corte: ``armhole_knee`` e ``neck_knee`` dão, para cada x, a altura onde o pano acaba (o
"joelho" de cada coluna do tronco); ``tank.py`` monta a malha até essas alturas e a alça passa por cima do ombro.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field, replace

import numpy as np

from .geometry import ellipse_semi_axes
from .sizes import TopMeasures

CM = 0.01
SLEEVELESS_DROP = 3.0   # quanto a cava sem manga desce além da de manga (cm), quando a marca não dá a cava
# subcategoria → (largura da alça cm, centro da alça 0–1 do pescoço à ponta do ombro, forma do decote da frente,
# fundo da frente cm sem medida da marca, fundo das costas cm, quanto a cava sobe na frente e nas costas até a alça)
DEFAULTS = {
    "tank_top": (4.5, 0.50, "redondo", 12.0, 8.0, 0.55, 0.40),
    "top": (4.0, 0.50, "redondo", 10.0, 6.0, 0.55, 0.40),
    "bodysuit": (2.5, 0.45, "redondo", 12.0, 9.0, 0.50, 0.40),
    "blouse": (5.0, 0.50, "redondo", 9.0, 5.0, 0.55, 0.40),
    "vest": (7.0, 0.60, "v", 22.0, 3.0, 0.50, 0.45),
}
SHAPES = {"redondo": "redondo", "quadrado": "quadrado", "reto": "quadrado", "v": "v"}
STRAP_GOLAS = ("vies", "careca", "alta", "v")   # golas que o recorte novo acaba; as outras precisam do anel do decote
CORNER = 0.015          # raio do canto do decote quadrado (m)
MIN_CURVE = 2.5         # quanto o decote desce, no mínimo, abaixo do alto do painel (cm)
KNEE_LOW, KNEE_HIGH = 0.02, 0.015   # o corte fica 2 cm acima da base da grade e 1,5 cm abaixo do alto do painel

# caminho antigo (sem manga com colarinho, polo, lapela, faixa ou capuz): a alça é o decote + 4,5 cm de cada lado
STRAP = 0.045
STRAP_DROP = 1.5
SLEEVELESS_ARMHOLE = 0.75


@dataclass
class StrapCut:
    """Linhas do recorte, em metros (x a partir do meio, y a partir da barra)."""
    H: float
    y_arm: float          # fundo da cava
    y_t: float            # alto do painel (onde a alça vira a ponte por cima do ombro)
    y_base: float         # abaixo daqui o tronco é o de sempre
    a_c: float            # meia largura do peito
    b_c: float            # meia profundidade do peito
    b_t: float            # meia profundidade da elipse no alto do painel
    neck_a: float         # meia largura do pescoço
    sh_half: float        # meia largura de ponta a ponta das alças
    caimento: float       # quanto a ponta do ombro desce do HPS
    x_s: float            # meio da alça
    x_in: float           # borda de dentro (decote)
    x_out: float          # borda de fora (cava)
    w: float              # largura da alça
    y_bot_f: float        # fundo do decote da frente
    y_bot_b: float        # e das costas
    shape_f: str
    shape_b: str
    R_f: float            # quanto a cava sobe até a alça, em fração da altura da axila ao alto (frente)
    R_b: float
    cm_report: dict = field(default_factory=dict)

    def b(self, y):
        """Meia profundidade do tronco na altura y: a do peito até a axila, encolhendo até a do ombro no alto."""
        t = np.clip((np.asarray(y, float) - self.y_arm) / (self.y_t - self.y_arm), 0, 1)
        return self.b_c + (self.b_t - self.b_c) * t ** 2.2

    def _guard(self, h):
        return np.clip(h, self.y_base + KNEE_LOW, self.y_t - KNEE_HIGH)

    def armhole_knee(self, x, side: int):
        """Altura do corte da cava em x (|x| de x_out ao lado): plana no fundo, vertical ao chegar na alça."""
        R = self.R_f if side > 0 else self.R_b
        u = np.clip((self.a_c - np.abs(x)) / (self.a_c - self.x_out), 0, 1)
        return self._guard(self.y_arm + R * (self.y_t - self.y_arm) * (1 - np.sqrt(1 - u ** 2)))

    def neck_corner(self, side: int) -> float:
        """Altura em que o decote chega na borda de dentro da alça: no alto do painel (o U e o V sobem até a alça); o
        quadrado vira a quina antes e a alça sobe reta dali."""
        y_bot, shape = (self.y_bot_f, self.shape_f) if side > 0 else (self.y_bot_b, self.shape_b)
        if shape != "quadrado":
            return self.y_t - KNEE_HIGH
        return min(self.y_t - KNEE_HIGH, y_bot + 0.6 * (self.y_t - y_bot))

    def neck_knee(self, x, side: int):
        """Altura do corte do decote em x (|x| de 0 a x_in): o fundo no meio, chegando na alça em ``neck_corner``."""
        y_bot, shape = (self.y_bot_f, self.shape_f) if side > 0 else (self.y_bot_b, self.shape_b)
        y_c = self.neck_corner(side)
        r = np.clip(np.abs(x) / self.x_in, 0, 1)
        if shape == "v":
            h = y_bot + (y_c - y_bot) * r
        elif shape == "quadrado":   # reto no fundo e um quarto de círculo até a alça
            d = np.clip((np.abs(x) - (self.x_in - CORNER)) / CORNER, 0, 1)
            h = y_bot + (y_c - y_bot) * (1 - np.sqrt(1 - d ** 2))
            h = np.where(d >= 1, y_c, h)
        else:
            h = y_c - (y_c - y_bot) * np.sqrt(1 - r ** 2)
        return self._guard(h)

    def strap_knee(self, x, side: int):
        """Na alça o corte vai em linha reta do decote (x_in) à cava (x_out): é só onde a grade dobra."""
        t = np.clip((np.abs(x) - self.x_in) / (self.x_out - self.x_in), 0, 1)
        return (1 - t) * self.neck_knee(self.x_in, side) + t * self.armhole_knee(self.x_out, side)

    def armhole_x(self, y, side: int = 1) -> float:
        """Meia largura do pano na altura y pela cava (o inverso de ``armhole_knee``): o peito inteiro até a axila."""
        R = self.R_f if side > 0 else self.R_b
        s = float(np.clip((y - self.y_arm) / (R * (self.y_t - self.y_arm)), 0, 1))
        return self.a_c - math.sqrt(max(0.0, 1 - (1 - s) ** 2)) * (self.a_c - self.x_out)


def resolve(spec, m: TopMeasures) -> tuple[StrapCut, TopMeasures]:
    """Recorte da ficha: largura e posição da alça, forma e fundo dos decotes, cava. Devolve também as medidas com a
    cava sem manga e os fundos de decote que valeram (o relatório e os botões do colete usam os mesmos)."""
    brand = spec.medidas_marca
    w_cm, centro, shape, d_front, d_back, R_f, R_b = DEFAULTS.get(spec.subcategoria, DEFAULTS["tank_top"])
    if "cava" not in brand:   # a cava sem manga desce abaixo da axila: o braço caído não prensa o pano no tronco
        m = replace(m, cava=m.cava + SLEEVELESS_DROP)
    w = min(9.0, max(1.5, spec.alca if spec.alca is not None else w_cm)) * CM
    centro = min(0.8, max(0.2, spec.alca_centro if spec.alca_centro is not None else centro))
    H = m.comprimento * CM
    a_c, b_c = ellipse_semi_axes(m.torax * CM, 0.68)
    neck_a = ellipse_semi_axes(m.pescoco * CM, 0.9)[0]
    sh_half = m.ombro * CM / 2
    x_s = neck_a + centro * (sh_half - neck_a)
    crew = spec.gola in ("careca", "alta")
    if crew:   # regata de gola careca: o decote é o do pescoço, a alça encosta nele
        x_s = neck_a + 0.008 + w / 2
    x_in, x_out = x_s - w / 2, x_s + w / 2
    x_in = max(x_in, neck_a + 0.008)
    x_out = min(x_out, sh_half - 0.01, 0.92 * a_c)
    if x_out - x_in < 0.015:   # tórax estreito: a alça encolhe, mas não some
        x_in = x_out - 0.015
    w, x_s = x_out - x_in, (x_in + x_out) / 2
    if spec.gola == "v":
        shape = "v"
    elif crew:
        shape, d_front = "redondo", max(m.decote_frente, 6.0)
    elif spec.decote:
        shape = SHAPES[spec.decote]
    if "decote_frente" in brand and not crew:
        d_front = m.decote_frente
    # o decote desce pelo menos 2,5 cm abaixo do alto do painel (caimento do ombro + 1 cm): mais raso, a curva sumia e
    # o pano entre as alças virava uma borda reta
    shallow = m.caimento_ombro + 1.0 + MIN_CURVE
    d_front = min(max(d_front, 6.0, shallow), min(30.0, m.cava - 3.0))
    d_back = min(max(m.decote_costas if "decote_costas" in brand else d_back, 3.0, shallow), d_front)
    m = replace(m, decote_frente=round(d_front, 1), decote_costas=round(d_back, 1))
    y_arm = H - m.cava * CM
    y_t = H - m.caimento_ombro * CM - 0.01
    y_base = min(y_arm, H - d_front * CM, H - d_back * CM) - 0.03
    b_t = 0.055 * m.torax * CM / math.sqrt(1 - (x_s / a_c) ** 2)   # o ombro tem ~5,5 % do tórax de cada lado no meio
    report = {"largura_cm": round(w / CM, 1), "centro_cm": round(x_s / CM, 1), "decote": shape,
              "decote_cm": round(d_front, 1), "decote_costas_cm": round(d_back, 1),
              "decote_costas_forma": SHAPES[spec.decote_costas_forma]}
    cut = StrapCut(H, y_arm, y_t, y_base, a_c, b_c, b_t, neck_a, sh_half, m.caimento_ombro * CM, x_s, x_in, x_out, w,
                   H - d_front * CM, H - d_back * CM, shape, SHAPES[spec.decote_costas_forma], R_f, R_b, report)
    return cut, m


def legacy_sleeveless(m: TopMeasures, spec) -> TopMeasures:
    """Sem manga com colarinho, polo, lapela, faixa ou capuz: o recorte antigo, em que a alça é o decote alargado."""
    if "ombro" not in spec.medidas_marca:   # a alça é o decote + 4,5 cm de cada lado
        neck_a, _ = ellipse_semi_axes(m.pescoco * 0.01, 0.9)
        # e a alça desce só o que o trapézio desce em 4,5 cm (1,5 cm): com a queda de um ombro de manga (4 cm) ela subia
        # reta do ombro até o decote e ficava em pé, solta do corpo
        m = replace(m, ombro=round(2 * (neck_a + STRAP) * 100, 1), caimento_ombro=STRAP_DROP)
    if "cava" not in spec.medidas_marca:
        m = replace(m, cava=m.cava + SLEEVELESS_DROP)
    return m
