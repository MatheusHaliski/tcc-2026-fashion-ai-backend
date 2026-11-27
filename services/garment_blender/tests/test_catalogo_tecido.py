"""Tecido pelo texto: forro e detalhe não decidem a peça, a casca dita vale mais, e a fibra depende da peça."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from catalogo.ficha import BASES, WEIGHT, spec_for  # noqa: E402
from catalogo.tecido import fabric_of  # noqa: E402
from garment_blender.spec import FABRICS, parse  # noqa: E402


@pytest.mark.parametrize("sub, name, desc, expected", [
    # forro e acabamento não são o tecido da peça
    ("jacket", "Rainforest Open Winter Jacket", "The nylon shell and fleece-lined interior keep you warm.", "nylon"),
    ("jacket", "Switchback II Sherpa Lined Jacket", "Waterproof jacket lined with cozy Sherpa fleece.", "nylon"),
    ("jacket", "Duck Canvas High Pile Fleece Lined Jacket", "100% cotton duck canvas, high pile fleece interior.",
     "sarja"),
    ("blazer", "Doeskin Double-Breasted Blazer", "Pure wool, with golden fleece® metal buttons.", "la_plana"),
    ("hoodie", "Full-zip hoodie", "Ribbed cuffs and hem.", None),
    ("jacket", "Cozy Luxe Track Jacket", "Ribbed interior collar, cuffs and hem.", None),
    ("jacket", "Jaqueta Bomber", "Forro de lã e punhos em ribana.", None),
    ("t_shirt", "Camiseta Logo", "Etiqueta de couro na barra.", None),
    # a casca dita na descrição decide
    ("coat", "Casaco Com Capuz", "Casaco confeccionado em moletom sem felpa.", "moletom"),
    ("jacket", "Panorama Long Jacket", "Crafted of cozy Sherpa fleece.", "moletom"),
    ("jacket", "Max Soft Hooded Jacket", "Made from SKECH-SWEATS Max Soft Fleece fabric.", "moletom"),
    # palavra solta que não é tecido
    ("jacket", "Jaqueta biker", "Descobreix la nova col·lecció de jaquetes.", "couro"),
    ("shirt", "Camisa cenyida", "Descobreix la nova col·lecció.", None),
    ("t_shirt", "Camiseta Run", "Tecnologia para mantê-la seca e vesti-la sempre.", None),
    ("t_shirt", "Camiseta Big Logo", "Estampa frontal em silk.", None),
    ("t_shirt", "Camiseta Biella", "Logo em silkscreen no peito.", None),
    ("jacket", "Cozy Luxe Jacket", "Silky soft fabric.", None),
    ("shirt", "Relaxed Fit Check Cotton Shirt", "Button-down collar.", None),
    ("t_shirt", "Chrome Tee", "Great for dressing it up or down.", "jersey"),
    ("t_shirt", "Rain Bear Cotton T-shirt", "A print of a bear in our iconic trench.", None),
    ("t_shirt", "Training Tee", "Sweat-wicking fabric that wicks sweat away.", "jersey"),
    ("tank_top", "Bogata Bay Tank", "Wicks sweat and dries fast.", None),
    ("t_shirt", "Featherweight Fleece Training Tee", "", "jersey"),
    ("blouse", "Puff-Sleeve Top", "Blusa de manga bufante.", None),
    ("t_shirt", "Camiseta Flame", "Use com jeans e denimwear.", None),
    ("blazer", "Blazer Marseille", "Denim blazer com lapela.", "denim"),
    ("t_shirt", "Knight Stamp Cotton T-shirt", "Our knight stamp reimagined in tactile velvet.", None),
    ("polo_shirt", "Floral Embroidery Polo Shirt", "Detailed with an ivory satin stitch embroidery.", None),
    # o nome vale mais que a descrição
    ("jacket", "Jaqueta de Couro", "Combine com tricot e jeans.", "couro"),
    ("jacket", "Quilted Nylon Parka", "Fleece-lined pockets.", "acolchoado"),
    ("coat", "Velvet coat", "100% wool blend lining.", "veludo"),
    # tecidos novos
    ("jacket", "Jaqueta de Camurça", "", "camurca"),
    ("jacket", "Bomber de PU", "", "couro"),
    ("vest", "Colete Puffer", "", "acolchoado"),
    ("jacket", "Arctic Crest Down Jacket", "", "acolchoado"),
    ("jacket", "Corta-vento com capuz", "", "nylon"),
    ("shirt", "Camisa Cetim Com Elastano", "", "cetim"),
    ("tank_top", "Regata de Seda", "", "cetim"),
    # a fibra depende da peça; a construção vale mais que a fibra
    ("blazer", "Wool Hopsack Blazer", "", "la_plana"),
    ("coat", "Wool gabardine coat", "", "la_plana"),
    ("jacket", "Cashmere Blend Jacket", "", "la_plana"),
    ("jacket", "Jaqueta de punt", "Jaqueta de tricot em lã.", "malha_la"),
    ("sweater", "Suéter de Lã Merino", "", "malha_la"),
    ("t_shirt", "Merino Tee", "", "jersey"),
    ("t_shirt", "Camiseta de Viscose", "Composição: viscose e poliamida.", None),
    ("shirt", "Camisa de Viscose", "", "tricoline"),
    ("shirt", "Camisa de Linho", "", "tricoline"),
    ("coat", "Trench Coat", "", "sarja"),
    ("coat", "Casaco Feminino Powercool", "Tecido dry com proteção UV.", "jersey"),
])
def test_tecido_pelo_texto(sub, name, desc, expected):
    assert fabric_of(name, desc, sub) == expected


def test_agasalho_sem_palavra_de_tecido_usa_a_base_da_subcategoria():
    assert {s: BASES[s][2] for s in ("coat", "blazer", "parka", "windbreaker", "jacket", "vest")} == {
        "coat": "la_plana", "blazer": "la_plana", "parka": "nylon", "windbreaker": "nylon", "jacket": "sarja",
        "vest": "sarja"}
    assert set(WEIGHT) == set(FABRICS)


@pytest.mark.parametrize("sub, name", [("jacket", "Jaqueta de Couro"), ("vest", "Colete Puffer"),
                                       ("coat", "Sobretudo Alfaiataria"), ("blazer", "Velvet Blazer"),
                                       ("shirt", "Camisa de Cetim"), ("jacket", "Jaqueta de Camurça")])
def test_ficha_com_tecido_novo_monta_no_motor(sub, name):
    product = {"subcategory": sub, "product_name": name, "description": "", "brand": "Marca",
               "official_product_url": "https://loja.example/p"}
    spec = spec_for(product, "#1f2a44", {})
    assert parse(spec).tecido.tipo == spec["tecido"]["tipo"] != "malha_la"
