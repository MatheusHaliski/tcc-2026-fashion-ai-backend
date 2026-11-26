"""O crivo dos desenhos em imagens sintéticas: o que não é estampa (vão do braço, ferragem do agasalho, par de
feitio, colar), a junção dos pedaços, a estampa corrida contra o cartaz no peito, as faixas de manga e as pistas do
texto. Roda no ambiente do catálogo (scipy); sem ele, pula."""
import sys
from pathlib import Path

import numpy as np
import pytest

pytest.importorskip("scipy")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from catalogo import juncao, pistas  # noqa: E402
from catalogo.analise import analyze  # noqa: E402
from catalogo.avaliacao import score, summary  # noqa: E402
from catalogo.estampa import Group  # noqa: E402
from catalogo.mascara import garment_mask  # noqa: E402
from catalogo.cores import rgb_to_lab  # noqa: E402

H, W = 700, 600
TOP, HEM, LEFT, RIGHT = 100, 600, 150, 450     # a peça: 500 px de altura = 0,70 m (≈ 714 px/m)
NAVY = np.array([31, 42, 68])
WHITE = (240, 240, 235)
SLEEVE = {"meia_ombro": 0.21, "queda": 0.0, "comprimento": 0.2}


def garment(color=NAVY):
    """Camiseta deitada vista de frente: tronco retangular e mangas curtas, fundo branco."""
    rgb = np.full((H, W, 3), 245, np.uint8)
    labels = np.zeros((H, W), np.uint8)
    labels[TOP:HEM, LEFT:RIGHT] = 3
    labels[TOP:TOP + 70, LEFT - 140:LEFT] = 3
    labels[TOP:TOP + 70, RIGHT:RIGHT + 140] = 3
    rgb[labels == 3] = color
    return rgb, labels


def test_vao_entre_braco_e_tronco_sai_da_mascara_mas_o_buraco_do_peito_fica():
    rgb, labels = garment()
    labels[250:400, 180:200] = 0                    # vão do braço: fundo aparecendo, longe do eixo
    rgb[250:400, 180:200] = 245
    labels[220:260, 280:320] = 0                    # estampa branca no peito que o segmentador não rotulou
    rgb[220:260, 280:320] = 245
    mask = garment_mask(labels, rgb_to_lab(rgb).astype(np.float32))
    assert not mask[300, 190] and mask[240, 300]
    assert garment_mask(labels)[300, 190]           # sem a foto, o buraco é fechado como antes


def test_ferragem_pequena_do_agasalho_nao_e_desenho_e_o_logo_do_peito_continua():
    rgb, labels = garment()
    rgb[420:434, 360:372] = (200, 200, 205)         # puxador de zíper de bolso: pequeno, neutro, abaixo do peito
    rgb[230:250, 350:400] = WHITE                   # logo de peito
    clues = pistas.from_text("Jaqueta de couro", "", "jacket", "ziper_inteiro")
    r = analyze(rgb, labels, 0.70, 0.21, clues=clues)
    assert r["padrao"] == "localizada" and len(r["decalques"]) == 1
    assert 0.08 < r["decalques"][0]["x"] < 0.16 and r["decalques"][0]["abaixo_do_ombro"] < 0.3


def test_par_espelhado_no_eixo_e_feitio_da_peca():
    rgb, labels = garment()
    for x in (240, 340):                            # pontas de gola, botões do trespasse: iguais dos dois lados
        rgb[200:216, x:x + 20] = WHITE
    assert analyze(rgb, labels, 0.70, 0.21)["padrao"] == "liso"


def test_pedacos_vizinhos_viram_um_desenho_so():
    rgb, labels = garment()
    rgb[220:250, 250:290] = WHITE                   # duas palavras do mesmo logo, a 14 px (2 cm) uma da outra
    rgb[220:250, 304:350] = WHITE
    r = analyze(rgb, labels, 0.70, 0.21)
    assert len(r["decalques"]) == 1
    assert r["decalques"][0]["largura"] == pytest.approx(100 / 714, abs=0.01)


def test_uniao_de_grupos_soma_area_e_cobre_as_duas_caixas():
    a = Group((10, 20, 10, 30), 200, np.ones((10, 20), bool), 60.0)
    b = Group((12, 30, 40, 50), 180, np.ones((18, 10), bool), 30.0)
    u = juncao.union(a, b)
    assert u.box == (10, 30, 10, 50) and u.area == 380 and u.alpha.shape == (20, 40)
    assert u.alpha[0, 0] and not u.alpha[0, 39] and u.alpha[19, 39]
    assert 30 < u.contrast < 60


def _printed(everywhere: bool):
    rng = np.random.default_rng(3)
    rgb, labels = garment(np.array([225, 222, 215]))
    yy, xx = np.mgrid[0:H, 0:W]
    dots = ((yy // 14 + xx // 14) % 2 == 0) & (rng.random((H, W)) > 0.1)
    area = labels == 3 if everywhere else (yy > 220) & (yy < 480) & (xx > 220) & (xx < 380)
    rgb[dots & area & (labels == 3)] = (150, 40, 60)
    return rgb, labels


def test_estampa_por_toda_a_peca_e_corrida_e_o_cartaz_no_peito_e_localizada():
    assert analyze(*_printed(True), 0.70, 0.21)["padrao"] == "corrida"
    r = analyze(*_printed(False), 0.70, 0.21)
    assert r["padrao"] == "localizada" and len(r["decalques"]) == 1 and abs(r["decalques"][0]["x"]) < 0.02


def test_brilho_do_material_nao_e_estampa_corrida():
    clues = pistas.from_text("Jaqueta puffer metalizada", "", "jacket", "ziper_inteiro")
    assert analyze(*_printed(True), 0.70, 0.21, clues=clues)["padrao"] != "corrida"


def test_faixa_no_punho_das_duas_mangas_e_detectada_e_a_de_uma_so_nao():
    rgb, labels = garment()
    rgb[TOP:TOP + 70, LEFT - 125:LEFT - 107] = WHITE
    rgb[TOP:TOP + 70, RIGHT + 107:RIGHT + 125] = WHITE
    r = analyze(rgb, labels, 0.70, 0.21, sleeve=SLEEVE)
    sides = {b["lado"] for b in r["faixas_manga"]}
    assert sides == {"manga_esquerda", "manga_direita"}
    band = r["faixas_manga"][0]
    assert band["largura_m"] == pytest.approx(18 / 714, abs=0.012) and band["cor"].startswith("#")
    rgb, labels = garment()
    rgb[TOP:TOP + 70, LEFT - 125:LEFT - 107] = WHITE
    assert "faixas_manga" not in analyze(rgb, labels, 0.70, 0.21, sleeve=SLEEVE)


def test_foto_miuda_nao_da_desenho():
    rgb, labels = garment()
    rgb[230:250, 350:400] = WHITE
    assert analyze(rgb, labels, 5.0, 0.21)["decalques"] == []      # 100 px por metro: só a cor


def test_pistas_do_nome_do_produto():
    c = pistas.from_text("Camisa Xadrez Flanela", "", "shirt", "botoes")
    assert c["corrida"] and c["estampa"] and not c["liso"] and not c["aberta"]
    c = pistas.from_text("Jaqueta de Couro Lisa", "com estampa interna", "jacket", "ziper_inteiro")
    assert c["liso"] and c["brilho"] and c["aberta"] and not c["corrida"]
    assert pistas.from_text(None)["liso"] is False


def test_pontuacao_da_avaliacao_separa_desenho_certo_de_lixo():
    want = {"padrao": "localizada", "desenhos": [{"lado": "frente", "x": "dir"}]}
    logo = {"lado": "frente", "x": 0.09, "largura": 0.05, "abaixo_do_ombro": 0.2}
    junk = {"lado": "manga_direita", "x": 0.0, "largura": 0.03, "abaixo_do_ombro": 0.3}
    s = score(want, {"padrao": "localizada", "decalques": [logo, junk]})
    assert s["padrao_ok"] and not s["falso"] and s["peito"] == [True] and s["decalques_falsos"] == 1
    f = score({"padrao": "liso"}, {"padrao": "localizada", "decalques": [junk]})
    assert f["falso"] and not f["padrao_ok"]
    total = summary({"a": s, "b": f})
    assert total["falso_nao_liso"] == 0.5 and total["peito_achado"] == 1.0 and total["liso_marcado_nao_liso"] == 1.0
