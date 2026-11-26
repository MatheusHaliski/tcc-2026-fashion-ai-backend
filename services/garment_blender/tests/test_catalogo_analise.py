"""Leitura da foto em imagens sintéticas: cor do tecido, logo no peito com o lugar dele, listras, sombra de dobra e
fila de botões que não são desenho. Roda no ambiente do catálogo (scipy); sem ele, pula."""
import sys
from pathlib import Path

import numpy as np
import pytest

pytest.importorskip("scipy")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from catalogo.analise import analyze  # noqa: E402
from catalogo.cores import lab_to_rgb, rgb_to_lab, to_hex  # noqa: E402

H, W = 700, 600
TOP, HEM, LEFT, RIGHT = 100, 600, 150, 450     # a peça: 500 px de altura = 0,70 m (≈ 714 px/m)
NAVY = np.array([31, 42, 68])


def garment(color=NAVY):
    """Camiseta deitada vista de frente: tronco retangular e mangas curtas, fundo branco, sombra larga suave."""
    rgb = np.full((H, W, 3), 245, np.uint8)
    labels = np.zeros((H, W), np.uint8)
    labels[TOP:HEM, LEFT:RIGHT] = 3
    labels[TOP:TOP + 120, LEFT - 90:LEFT] = 3
    labels[TOP:TOP + 120, RIGHT:RIGHT + 90] = 3
    yy, xx = np.mgrid[0:H, 0:W]
    shade = 1 + 0.12 * np.sin(xx / 90.0) * np.cos(yy / 120.0)     # dobra larga: muda devagar
    body = np.clip(color[None, None] * shade[..., None], 0, 255)
    rgb[labels == 3] = body[labels == 3].astype(np.uint8)
    return rgb, labels


def test_peca_lisa_com_sombra_e_dobra_fina_sai_lisa_na_cor_dela():
    rgb, labels = garment()
    rgb[300:302, 220:330] = (NAVY * 0.55).astype(np.uint8)           # vinco escuro, fino e comprido
    r = analyze(rgb, labels, 0.70, 0.21)
    assert r["ok"] and r["padrao"] == "liso"
    lab = rgb_to_lab(np.array([int(r["cor"][i:i + 2], 16) for i in (1, 3, 5)]))
    assert np.linalg.norm(lab - rgb_to_lab(NAVY)) < 6


def test_logo_no_peito_sai_recortado_e_no_lugar():
    rgb, labels = garment()
    # logo branco de 70 × 40 px com "letras" (barras), à direita na foto = lado esquerdo de quem veste
    y0, x0 = TOP + 150, 330
    for k in range(5):
        rgb[y0:y0 + 40, x0 + k * 15:x0 + k * 15 + 9] = (240, 240, 240)
    r = analyze(rgb, labels, 0.70, 0.21)
    assert r["padrao"] == "localizada" and len(r["decalques"]) == 1
    d = r["decalques"][0]
    ppm = 500 / 0.70
    assert d["x"] == pytest.approx((x0 + 34.5 - 300) / ppm, abs=0.01)        # +: lado esquerdo de quem veste
    assert d["abaixo_do_ombro"] == pytest.approx(170 / ppm, abs=0.01)
    assert d["largura"] == pytest.approx(69 / ppm, abs=0.01)
    alpha = d["imagem"][..., 3]
    assert alpha.max() == 255 and 0.4 < (alpha > 0).mean() < 0.9            # as letras, não a caixa inteira


def test_botoes_em_fila_no_eixo_nao_viram_desenho_mas_letras_lado_a_lado_viram():
    rgb, labels = garment()
    for y in range(TOP + 80, HEM - 40, 70):                              # seis botões no meio da frente
        rgb[y:y + 8, 296:304] = (230, 230, 225)
    assert analyze(rgb, labels, 0.70, 0.21)["padrao"] == "liso"
    rgb, labels = garment()
    for k in range(6):                                                   # seis letras numa linha, no eixo
        rgb[TOP + 160:TOP + 172, 280 + k * 8:285 + k * 8] = (230, 230, 225)
    r = analyze(rgb, labels, 0.70, 0.21)
    assert r["padrao"] == "localizada" and r["decalques"][0]["x"] == pytest.approx(0.0, abs=0.02)


def test_listras_horizontais_com_as_duas_cores_e_o_periodo():
    rgb, labels = garment(np.array([40, 130, 90]))
    rows = np.arange(H)
    stripe = ((rows // 15) % 2 == 1)[:, None] & (labels == 3)           # período de 30 px
    rgb[stripe] = (120, 190, 160)
    r = analyze(rgb, labels, 0.70, 0.21)
    assert r["padrao"] == "listras"
    s = r["listras"]
    assert s["direcao"] == "horizontal" and s["periodo"] == pytest.approx(30 / (500 / 0.70), rel=0.1)
    assert {s["fundo"], s["listra"]} != {s["fundo"]}


def test_cor_lab_ida_e_volta():
    rgb = np.array([[12, 200, 90], [250, 250, 250], [0, 0, 0]])
    assert np.abs(lab_to_rgb(rgb_to_lab(rgb)) - rgb).max() <= 1
    assert to_hex([255, 0, 16]) == "#ff0010"


def test_foto_pequena_com_a_peca_encostada_na_borda_nao_quebra():
    rgb, labels = garment()
    small_rgb, small_labels = rgb[:, 100:292], labels[:, 100:292]           # 192 px de largura, peça cortada à direita
    r = analyze(np.ascontiguousarray(small_rgb), np.ascontiguousarray(small_labels), 0.70, 0.21)
    assert r["ok"]


def _logo(rgb, y0, x0, letters=5):
    for k in range(letters):
        rgb[y0:y0 + 40, x0 + k * 15:x0 + k * 15 + 9] = (240, 240, 240)


def test_com_capuz_o_lugar_do_logo_conta_da_linha_do_ombro_nao_do_alto_do_capuz():
    rgb, labels = garment()
    labels[TOP - 150:TOP, 250:350] = 3                                   # o capuz em pé acima do decote
    rgb[TOP - 150:TOP, 250:350] = NAVY
    _logo(rgb, TOP + 150, 330)
    d = analyze(rgb, labels, 0.70, 0.21, hooded=True)["decalques"][0]
    assert d["abaixo_do_ombro"] == pytest.approx(170 / (500 / 0.70), abs=0.012)   # do ombro, não do capuz


def test_logo_na_manga_sai_com_o_lado_de_quem_veste_e_a_distancia_do_ombro():
    rgb, labels = garment()
    _logo(rgb, TOP + 40, RIGHT + 20, letters=3)                          # na manga à direita da foto
    sleeve = {"meia_ombro": 0.2, "queda": 0.045, "comprimento": 0.21}
    found = [d for d in analyze(rgb, labels, 0.70, 0.21, False, sleeve)["decalques"] if d["lado"] != "frente"]
    assert len(found) == 1 and found[0]["lado"] == "manga_esquerda"      # à direita na foto: a esquerda de quem veste
    assert 0.04 < found[0]["abaixo_do_ombro"] < 0.18
    assert analyze(rgb, labels, 0.70, 0.21, False, None)["decalques"] == []   # sem manga na base: fica de fora


def test_fundo_da_gola_v_aparecendo_nao_e_desenho():
    rgb, labels = garment()
    rgb[TOP + 10:TOP + 70, 290:310] = (200, 200, 200)                    # o forro claro da gola, no meio, no alto
    assert analyze(rgb, labels, 0.70, 0.21, neck=0.12)["decalques"] == []


def test_letras_de_pontos_no_eixo_nao_sao_botoes():
    rgb, labels = garment()
    rng = np.random.default_rng(3)
    for line in (0, 1):                                        # duas linhas de "letras" de tachinhas no meio
        for letter in range(7):
            for _ in range(18):
                y = TOP + 160 + line * 34 + int(rng.integers(0, 24))
                x = 252 + letter * 14 + int(rng.integers(0, 10))
                rgb[y:y + 3, x:x + 3] = (230, 230, 225)
    r = analyze(rgb, labels, 0.70, 0.21)
    assert r["padrao"] == "localizada" and abs(r["decalques"][0]["x"]) < 0.02
    assert r["decalques"][0]["largura"] > 0.1                  # o texto inteiro num desenho só, não dois pedaços
