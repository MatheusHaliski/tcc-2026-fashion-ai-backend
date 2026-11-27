"""Cor medida: o balanço de branco que não tira a cor da peça e o acerto pelo nome de cor da marca."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from catalogo import cores  # noqa: E402
from catalogo.nomes_cor import color_from_name  # noqa: E402


def lab(hex_color):
    return cores.rgb_to_lab(np.array([int(hex_color[i:i + 2], 16) for i in (1, 3, 5)], float))


def gains_for(background_rgb):
    bg = np.asarray(background_rgb, float)
    return bg.mean() / bg


def test_fundo_creme_de_proposito_nao_azula_a_peca_branca():
    gains = gains_for((238, 231, 214))                      # J.Crew: fundo creme, peça branca certa na foto
    safe = cores.safe_gains(gains, (244, 243, 240))
    assert np.all(np.abs(safe - 1) <= 0.03 + 1e-9)
    assert abs(cores.rgb_to_lab(np.clip(np.array([244, 243, 240]) * safe, 0, 255))[2]) < 4.5   # sem o teto, o ganho inteiro levava o b a −8


def test_dominante_da_foto_inteira_e_corrigida_na_peca_quase_neutra():
    gains = gains_for((204, 214, 226))                      # Napapijri: a foto toda azulada, a camiseta branca também
    tee = np.array([222, 230, 243], float)
    safe = cores.safe_gains(gains, tee)
    assert np.allclose(safe, gains)
    assert abs(cores.rgb_to_lab(np.clip(tee * safe, 0, 255))[2]) < abs(cores.rgb_to_lab(tee)[2]) - 4


def test_peca_escura_e_peca_colorida_nao_perdem_a_cor_para_o_fundo():
    gains = gains_for((204, 214, 226))
    assert np.allclose(cores.safe_gains(gains, (27, 24, 38)), 1)           # polo marinho: o azul fica
    warm = gains_for((238, 231, 214))
    assert np.all(np.abs(cores.safe_gains(warm, (226, 196, 120)) - 1) <= 0.03 + 1e-9)   # amarelo: no máximo 3 %


@pytest.mark.parametrize("measured, name, light_range, max_chroma", [
    ("#080809", "Camiseta Black", (8, 13), 4), ("#2d3036", "Jaqueta Preta", (8, 13), 4),
    ("#100e12", "Polo Preto", (8, 13), 4), ("#26282f", "Black Dakota Jacket", (8, 13), 4),
])
def test_pretos_de_fotos_diferentes_ficam_o_mesmo_preto(measured, name, light_range, max_chroma):
    out = cores.match_name(lab(measured), color_from_name(name))
    assert light_range[0] <= out[0] <= light_range[1] and np.hypot(*out[1:]) <= max_chroma + 1e-6


def test_marinho_quase_preto_volta_a_ser_azul_no_matiz_medido():
    measured = lab("#1b1826")                               # Napapijri: L 9, arroxeado
    out = cores.match_name(measured, color_from_name("Polo Navy"))
    assert out[0] >= 12 and np.hypot(*out[1:]) >= cores.NAVY_CHROMA - 1e-6 and out[2] < 0
    assert np.arctan2(out[2], out[1]) == pytest.approx(np.arctan2(measured[2], measured[1]))
    flat = cores.match_name(lab("#141720"), color_from_name("Casaco Marinho"))   # croma 6,8: sobe para o mínimo
    assert np.hypot(*flat[1:]) >= cores.NAVY_CHROMA - 1e-6


def test_branco_em_modelo_sai_branco_e_off_white_continua_quente():
    white = cores.match_name(lab("#c7c8d1"), color_from_name("Camiseta Pima - Branco"))
    assert white[0] >= 92 and abs(white[2]) <= 3
    off = cores.match_name(lab("#d9d4c6"), color_from_name("Hoodie Off White"))
    assert off[0] >= 90 and 3 <= off[2] <= 10


def test_nome_que_nao_bate_com_a_medida_nao_muda_nada():
    for measured, name, solid in (("#3a3a3c", None, True),                 # sem nome
                                  ("#555a66", "Grey Dakota Jacket", True),   # cinza continua cinza
                                  ("#7a7d86", "Camiseta Preta", True),       # "preta" medida cinza médio: não é preto
                                  ("#1b1b1b", "Camiseta Branca", True),      # logo branco numa camiseta preta
                                  ("#c7c8d1", "Camisa Branca Estampada", False),   # estampada: não é lisa
                                  ("#8a2030", "Blusa Navy", True)):          # vinho com nome errado
        got = cores.match_name(lab(measured), color_from_name(name), solid)
        assert np.allclose(got, lab(measured)), (measured, name)


def test_malha_canelada_rosa_nao_sai_preta_pelos_vaos_entre_as_nervuras():
    rng = np.random.default_rng(1)
    ridges = np.column_stack([rng.uniform(40, 75, 6000), rng.uniform(30, 55, 6000), rng.uniform(8, 28, 6000)])
    valleys = np.column_stack([rng.uniform(3, 7, 3500), rng.uniform(0, 3, 3500), rng.uniform(-2, 1, 3500)])
    found = cores.dominant_lab(np.vstack([ridges, valleys]))
    assert found[0] > 40 and found[1] > 25                    # rosa, não o preto do vão


def test_branco_com_sombra_e_marinho_com_manga_cinza_ficam_na_cor_do_corpo():
    rng = np.random.default_rng(2)
    white = np.column_stack([rng.normal(95, 1.5, 6000), rng.normal(0, 1, 6000), rng.normal(1, 1, 6000)])
    shade = np.column_stack([rng.uniform(70, 90, 2500), rng.normal(0, 1.5, 2500), rng.normal(2, 1.5, 2500)])
    assert cores.dominant_lab(np.vstack([white, shade]))[0] > 92
    navy = np.column_stack([rng.normal(15, 2, 6000), rng.normal(3, 1, 6000), rng.normal(-14, 2, 6000)])
    grey = np.column_stack([rng.normal(55, 4, 3000), rng.normal(0, 1, 3000), rng.normal(3, 1, 3000)])
    assert cores.dominant_lab(np.vstack([navy, grey]))[0] < 20
