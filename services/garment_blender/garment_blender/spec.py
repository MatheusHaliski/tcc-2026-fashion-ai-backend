"""Ficha técnica da peça que o motor constrói: tipo, tamanho, tecido e detalhes de construção.

Lida de JSON (``load``): dado de fora, validado aqui — campo desconhecido ou valor fora da lista é erro, nunca
adivinhado. Exemplo em ``specs/stockton-sweater.json``.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from .prints import AllOver, Decal, HemBand, SleeveBand, Stripes, parse_prints
from .sizes import EASE, LETTERS, TopMeasures, check, top_measures
from .sizes_pants import CUTS, NUMBERS, PantsMeasures, check_pants, pants_measures

SUBCATEGORIES = ("sweater", "sweatshirt", "hoodie", "t_shirt", "long_sleeve", "shirt", "jacket", "blouse", "tank_top", "top",
                 "crop_top", "polo_shirt", "bodysuit", "cardigan", "vest", "blazer", "coat", "parka", "windbreaker", "kimono")
PANTS = tuple(CUTS)
# tricoline: tecido plano; la_plana: lã de alfaiataria (tecida, não tricô); nylon: casca técnica lisa; acolchoado: gomos
FABRICS = ("malha_la", "malha_algodao", "jersey", "moletom", "sarja", "denim", "tricoline", "la_plana", "couro",
           "camurca", "nylon", "acolchoado", "veludo", "cetim")
COLLARS = ("careca", "alta", "capuz", "colarinho", "v", "lapela", "polo", "vies", "faixa")   # colarinho: pé + folha virada; lapela: V + colarinho + lapelas
CLOSURES = ("nenhum", "ziper_inteiro", "botao_ziper", "cordao", "botoes", "polo", "aberto")   # polo: vista curta; aberto: frente sem fecho
NECKLINES = ("redondo", "quadrado", "reto", "v")   # decote da peça sem manga (reto = quadrado)
POCKETS = ("canguru", "peito", "faca", "traseiro", "cargo", "joelho_duplo", "vivo", "lateral")   # joelho_duplo: reforço chapado
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


@dataclass(frozen=True)
class Fabric:
    tipo: str            # FABRICS
    cor: str             # "#rrggbb"
    gramatura: int = 300 # g/m² (só informativo e para a espessura da casca)

    @property
    def espessura_mm(self) -> float:
        """Espessura aparente da casca: malha leve ~1 mm, moletom/lã grossa ~3 mm."""
        return round(min(3.5, max(0.8, self.gramatura / 110)), 2)


@dataclass(frozen=True)
class GarmentSpec:
    produto: str
    marca: str
    subcategoria: str
    tamanho: str
    sexo: str
    caimento: str
    tecido: Fabric
    gola: str = "careca"
    fechamento: str = "nenhum"
    bolsos: tuple[str, ...] = ()
    ribana: bool = True               # barra e punho em ribana (sweater, moletom)
    manga_curta: bool = False
    cor_ziper: str = "#a7a9ac"        # dentes e cursor (metal)
    angulo_manga: float = 80.0        # graus abaixo da horizontal: 80 = braço do avatar na pose de exibição; 0 = pose T
    passantes: bool = False           # calça: passantes de cinto no cós
    capuz_abaixado: bool = False      # capuz deitado nas costas (experimental: atravessa as costas no provador)
    botoes: int = 6                   # quantos botões na vista (fechamento "botoes")
    pregas: int = 0                   # saia: pregas faca na volta (divisor de 96: 12, 16, 24, 32)
    sem_manga: bool = False           # regata, top, colete: cava acabada, sem manga
    alca: float | None = None         # sem manga: largura da alça (cm); None: a da subcategoria (strap_cut.DEFAULTS)
    alca_centro: float | None = None  # meio da alça, 0–1 do pescoço à ponta do ombro
    decote: str | None = None         # forma do decote da frente sem manga (NECKLINES); None: a da subcategoria
    decote_costas_forma: str = "redondo"
    cor_botao: str = "#2e2a26"
    cor_linha: str | None = None      # linha do pesponto; None: um tom abaixo do tecido (costura tom sobre tom)
    medidas_marca: dict[str, float] = field(default_factory=dict)
    estampas: tuple[Decal, ...] = ()  # desenhos colados no tronco (prints.py)
    listras: Stripes | None = None
    estampa_corrida: AllOver | None = None
    faixa_barra: HemBand | None = None   # faixa de outra cor da barra para cima
    faixas_manga: tuple[SleeveBand, ...] = ()   # anéis de outra cor na manga

    @property
    def calca(self) -> bool:
        return self.subcategoria in PANTS

    @property
    def medidas_calca(self) -> PantsMeasures:
        return pants_measures(self.tamanho, self.subcategoria, self.sexo, self.medidas_marca)

    @property
    def medidas(self) -> TopMeasures:
        m = top_measures(self.tamanho, self.sexo, self.caimento, self.medidas_marca)
        if self.manga_curta:
            from dataclasses import replace
            m = replace(m, manga=round(m.ombro * 0.45, 1), punho=round(m.biceps * 0.9, 1), ribana_punho=2.0)
        return m


def _pick(value, allowed, name):
    if value not in allowed:
        raise ValueError(f"{name} inválido: {value!r} (aceitos: {', '.join(allowed)})")
    return value


def parse(raw: dict, size: str | None = None, base_dir: Path | None = None) -> GarmentSpec:
    """Ficha a partir de um dicionário (JSON). ``size`` troca o tamanho da ficha (gerar a grade inteira); ``base_dir``:
    de onde as imagens das estampas são lidas (a pasta da ficha)."""
    known = {"produto", "marca", "subcategoria", "tamanho", "sexo", "caimento", "tecido", "gola", "fechamento",
             "bolsos", "ribana", "manga_curta", "angulo_manga", "cor_ziper", "passantes", "capuz_abaixado", "medidas_marca", "url_oficial", "observacao",
             "botoes", "cor_botao", "cor_linha", "pregas", "sem_manga", "estampas", "listras", "estampa_corrida", "origem", "faixa_barra", "faixas_manga",
             "alca", "alca_centro", "decote", "decote_costas_forma"}
    unknown = set(raw) - known
    if unknown:
        raise ValueError(f"campos desconhecidos na ficha: {', '.join(sorted(unknown))}")
    fabric = raw.get("tecido") or {}
    if not HEX.match(str(fabric.get("cor", ""))):
        raise ValueError("tecido.cor precisa ser #rrggbb")
    measures = {k: float(v) for k, v in (raw.get("medidas_marca") or {}).items()}
    pants = raw.get("subcategoria") in PANTS
    unknown_measures = set(measures) - set((PantsMeasures if pants else TopMeasures).__dataclass_fields__)
    if unknown_measures:
        raise ValueError(f"medidas desconhecidas: {', '.join(sorted(unknown_measures))}")
    spec = GarmentSpec(
        produto=str(raw["produto"])[:120], marca=str(raw["marca"])[:60],
        subcategoria=_pick(raw["subcategoria"], SUBCATEGORIES + PANTS, "subcategoria"),
        tamanho=_pick(size or raw.get("tamanho", "40" if pants else "M"), NUMBERS if pants else LETTERS, "tamanho"),
        sexo=_pick(str(raw.get("sexo", "MASCULINO")).upper(), ("MASCULINO", "FEMININO"), "sexo"),
        caimento=_pick(raw.get("caimento", "regular"), tuple(EASE), "caimento"),
        tecido=Fabric(_pick(fabric.get("tipo"), FABRICS, "tecido.tipo"), fabric["cor"].lower(),
                      int(fabric.get("gramatura", 300))),
        gola=_pick(raw.get("gola", "careca"), COLLARS, "gola"),
        fechamento=_pick(raw.get("fechamento", "nenhum"), CLOSURES, "fechamento"),
        bolsos=tuple(_pick(p, POCKETS, "bolso") for p in raw.get("bolsos", [])),
        ribana=bool(raw.get("ribana", True)), manga_curta=bool(raw.get("manga_curta", False)),
        angulo_manga=float(raw.get("angulo_manga", 80.0)),
        cor_ziper=str(raw.get("cor_ziper", "#a7a9ac")).lower(), passantes=bool(raw.get("passantes", False)),
        capuz_abaixado=bool(raw.get("capuz_abaixado", False)),
        botoes=int(raw.get("botoes", 6)), pregas=int(raw.get("pregas", 0)), sem_manga=bool(raw.get("sem_manga", False)), cor_botao=str(raw.get("cor_botao", "#2e2a26")).lower(),
        cor_linha=str(raw["cor_linha"]).lower() if raw.get("cor_linha") else None,
        alca=float(raw["alca"]) if raw.get("alca") is not None else None,
        alca_centro=float(raw["alca_centro"]) if raw.get("alca_centro") is not None else None,
        decote=_pick(raw["decote"], NECKLINES, "decote") if raw.get("decote") else None,
        decote_costas_forma=_pick(raw.get("decote_costas_forma", "redondo"), NECKLINES, "decote_costas_forma"),
        medidas_marca=measures, **parse_prints(raw, base_dir))
    for name in ("cor_ziper", "cor_botao", "cor_linha"):
        if getattr(spec, name) is not None and not HEX.match(getattr(spec, name)):
            raise ValueError(f"{name} precisa ser #rrggbb")
    if not 2 <= spec.botoes <= 12:
        raise ValueError("botoes fora de 2–12")
    if spec.pregas and 96 % spec.pregas:
        raise ValueError("pregas precisa dividir 96 (12, 16, 24, 32…)")
    if not 0 <= spec.angulo_manga <= 85:
        raise ValueError("angulo_manga fora de 0–85 graus")
    problems = check_pants(spec.medidas_calca) if pants else check(spec.medidas)
    if problems:
        raise ValueError("medidas incoerentes: " + "; ".join(problems))
    return spec


def load(path: Path, size: str | None = None) -> GarmentSpec:
    return parse(json.loads(Path(path).read_text(encoding="utf-8")), size, Path(path).parent)
