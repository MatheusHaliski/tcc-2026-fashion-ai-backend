"""Catálogo → ficha: a base da subcategoria com os detalhes que o nome e a descrição confirmam."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from catalogo import texto  # noqa: E402
from catalogo.ficha import BASES, spec_for  # noqa: E402
from catalogo.nomes_cor import color_from_name  # noqa: E402
from catalogo.produtos import image_urls, ident  # noqa: E402
from garment_blender.spec import SUBCATEGORIES, parse  # noqa: E402


def product(sub, name, desc="", gender=None, brand="Marca"):
    return {"subcategory": sub, "product_name": name, "description": desc, "gender": gender, "brand": brand,
            "official_product_url": f"https://loja.example/{name.replace(' ', '-').lower()}"}


def spec(sub, name, desc="", **kw):
    return spec_for(product(sub, name, desc, **kw), "#336699", {})


def test_toda_subcategoria_de_cima_tem_base_e_a_ficha_monta_no_motor():
    assert set(BASES) <= set(SUBCATEGORIES)
    for sub in BASES:
        s = spec(sub, "Peça básica")
        assert parse(s).subcategoria == sub


@pytest.mark.parametrize("sub, name, expected", [
    ("t_shirt", "Camiseta Manga Longa Gola V Algodão", {"gola": "v", "manga_curta": False, "sem_manga": False}),
    ("t_shirt", "Regata Básica", {"sem_manga": True}),
    ("hoodie", "Moletom Canguru com Zíper", {"gola": "capuz", "fechamento": "ziper_inteiro", "bolsos": ["canguru"]}),
    ("sweatshirt", "Blusão Gola Alta", {"gola": "alta", "ribana": True}),
    ("shirt", "Henley Thermal Shirt", {"gola": "careca", "fechamento": "polo"}),
    ("shirt", "Camisa Linho Manga Curta com Bolso", {"gola": "colarinho", "fechamento": "botoes", "manga_curta": True,
                                                     "bolsos": ["peito"]}),
    ("blazer", "Blazer Oversized Acinturado", {"gola": "lapela", "fechamento": "botoes", "caimento": "oversized"}),
    ("t_shirt", "Slim fit t-shirt in cotton jersey", {"caimento": "justo", "manga_curta": True}),
    ("sweater", "Suéter Cashmere Gola Careca", {"gola": "careca", "tecido": "malha_la"}),
    ("jacket", "Jaqueta Jeans Trucker", {"tecido": "denim", "gola": "colarinho", "fechamento": "botoes",
                                         "bolsos": ["peito"]}),
    ("kimono", "Kimono Estampado", {"gola": "faixa", "fechamento": "aberto"}),
    ("polo_shirt", "Polo Piquet", {"gola": "polo", "fechamento": "polo", "tecido": "malha_algodao"}),
])
def test_texto_confirma_os_detalhes(sub, name, expected):
    s = spec(sub, name)
    got = {k: (s["tecido"]["tipo"] if k == "tecido" else s[k]) for k in expected}
    assert got == expected
    parse(s)


def test_combinacao_que_o_motor_nao_monta_vira_a_mais_proxima():
    assert spec("t_shirt", "Camiseta com botões")["fechamento"] == "polo"        # vista curta, não a frente toda
    assert spec("hoodie", "Hoodie com botões")["fechamento"] == "ziper_inteiro"  # capuz com frente que abre
    assert spec("t_shirt", "Camiseta Full Zip")["fechamento"] == "nenhum"
    assert spec("coat", "Casaco Lapela")["fechamento"] == "botoes"


def test_jeans_na_descricao_e_a_calca_do_look_nao_o_tecido_da_peca():
    assert spec("blazer", "Oversized Blazer", "Use com jeans e tênis.")["tecido"]["tipo"] == "la_plana"
    assert spec("jacket", "Dakota Jacket", "Jaqueta jeans com lavagem escura.")["tecido"]["tipo"] == "denim"


def test_base_da_subcategoria_traz_o_v_da_lapela_e_o_comprimento():
    assert spec("blazer", "Blazer")["medidas_marca"]["decote_frente"] == 26
    assert spec("coat", "Casaco", gender="FEMININO")["medidas_marca"]["comprimento"] == pytest.approx(63 * 1.45, abs=0.1)
    assert spec("t_shirt", "Camiseta Gola V")["medidas_marca"]["decote_frente"] == 12


def test_decote_reto_da_regata_vira_recorte_quadrado():
    raw = spec("tank_top", "Top De Tricot Decote Reto")
    assert raw["sem_manga"] and raw["decote"] == "quadrado" and raw["gola"] == "vies"
    assert parse(raw).decote == "quadrado"
    assert spec("tank_top", "Regata Decote U")["decote"] == "redondo"
    assert "decote" not in spec("t_shirt", "Camiseta Decote Reto")   # com manga o recorte é o de sempre


def test_cropped_encurta_a_base():
    assert spec("crop_top", "Top Cropped Listras")["medidas_marca"]["comprimento"] < 50
    assert "medidas_marca" not in spec("t_shirt", "Camiseta Básica")


def test_sexo_pelo_campo_pelo_texto_pela_subcategoria_e_pela_marca():
    assert spec("t_shirt", "Camiseta", gender="FEMININO")["sexo"] == "FEMININO"
    assert spec("t_shirt", "Women's Relaxed Tee")["sexo"] == "FEMININO"
    assert spec("t_shirt", "Camiseta Masculina Básica")["sexo"] == "MASCULINO"
    assert spec("blouse", "Blusa Básica")["sexo"] == "FEMININO"
    assert spec_for(product("t_shirt", "Camiseta", brand="Animale"), "#ffffff", {"animale": "FEMININO"})["sexo"] == \
        "FEMININO"


@pytest.mark.parametrize("name, reason", [
    ("Camiseta Infantil Manga Curta", "infantil"), ("Boys' Graphic Tee", "infantil"),
    ("Sunset Surf Crochet Triangle Bikini Top", "praia"), ("CashSoft Sweater Pants", "parte_de_baixo"),
    ("Vestido Midi", "vestido"), ("Camisa Social Slim", None), ("Dress Shirt Oxford", None),
    ("Camiseta Manga Curta", None),
])
def test_pula_o_que_nao_e_roupa_de_cima_adulta(name, reason):
    assert texto.skip_reason(name) == reason


def test_infantil_pelo_endereco_e_pela_linha_da_marca():
    assert texto.skip_reason("Camiseta Estampada Spacebus", "https://x.com/camiseta-mini-spacebus/p", "Reserva") == \
        "infantil"
    assert texto.skip_reason("Body Pica-Pau", "https://x.com/body-pica-pau/p", "Reserva", "bodysuit") == "infantil"
    assert texto.skip_reason("Rash Vest", "https://x.com/rash-vest-boys-8-16-years") == "infantil"
    assert texto.skip_reason("Camisa Mini Xadrez", "https://x.com/camisa-mini-xadrez", "Aramis") is None   # padrão
    assert texto.skip_reason("Blusa Feminina", "https://x.com/blusa-feminina-preta") is None


def test_botao_tom_sobre_tom_e_dourado_quando_o_texto_diz():
    on_white = spec_for(product("shirt", "Camisa Social"), "#f2f2f0", {})["cor_botao"]
    on_black = spec_for(product("shirt", "Camisa Social"), "#1b1b1b", {})["cor_botao"]
    assert int(on_white[1:3], 16) < 0xf2 and int(on_black[1:3], 16) > 0x1b     # um tom abaixo / acima do tecido
    assert spec("blazer", "Blazer Botões Dourados")["cor_botao"] == "#c9a54a"


def test_cor_pelo_nome_e_utilidades_do_catalogo():
    assert color_from_name("Azul Marinho") == "#1f2a44"
    assert color_from_name(None, "Off White") == "#ece6d8"
    assert color_from_name("Estampado") is None
    p = {"images": [{"url": " https://a/1.jpg "}, {"url": None}, "https://a/2.jpg", {"url": "https://a/1.jpg"}]}
    assert image_urls(p) == ["https://a/1.jpg", "https://a/2.jpg"]
    assert ident(product("t_shirt", "X")) == ident(product("t_shirt", "X"))
    assert ident(product("t_shirt", "X")).startswith("marca-")


def test_recorte_pela_foto_encurta_so_com_a_barriga_aparecendo_e_manga_pelo_braco():
    from catalogo import forma
    top = spec("top", "Top Básico", gender="FEMININO")
    assert forma.from_photo(top, {"comprimento_foto": 0.35, "pele_abaixo": 0.6, "em_modelo": True}, True) == \
        ["comprimento"]
    assert top["medidas_marca"]["comprimento"] == pytest.approx(35, abs=0.5)
    tucked = spec("shirt", "Camisa Social")                  # para dentro da calça: a barra some, não é cropped
    assert forma.from_photo(tucked, {"comprimento_foto": 0.45, "pele_abaixo": 0.0, "em_modelo": True}, True) == []
    blouse = spec("blouse", "Blusa Básica")                  # o texto não diz a manga; o braço à mostra diz
    assert forma.from_photo(blouse, {"braco_alto": 0.0, "braco_baixo": 0.12, "em_modelo": True}, False) == ["manga"] and blouse["manga_curta"]
    told = spec("blouse", "Blusa Manga Longa")
    assert forma.from_photo(told, {"braco_alto": 0.0, "braco_baixo": 0.12, "em_modelo": True}, True) == []
