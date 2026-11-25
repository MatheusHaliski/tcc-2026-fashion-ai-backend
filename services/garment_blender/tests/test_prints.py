"""Pintura da peça: desenho colado na frente (logo, estampa localizada), listras e estampa corrida no tecido."""
import json
import math
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from garment_blender.decals import NECK_CLEAR  # noqa: E402
from garment_blender.pattern import fit_period, pattern_maps  # noqa: E402
from garment_blender.prints import Decal  # noqa: E402
from garment_blender.spec import load, parse  # noqa: E402
from garment_blender.top import build_top  # noqa: E402

SPECS = Path(__file__).resolve().parents[1] / "specs"


@pytest.fixture()
def logo(tmp_path):
    """Desenho de 200 × 100 px: metade vermelha opaca, o resto transparente."""
    img = np.zeros((100, 200, 4), np.uint8)
    img[:, :100] = (200, 30, 30, 255)
    path = tmp_path / "logo.png"
    Image.fromarray(img, "RGBA").save(path)
    return path


def tee(tmp_path, logo, **decal):
    raw = json.loads((SPECS / "sacai-tshirt.json").read_text(encoding="utf-8"))
    raw["estampas"] = [{"imagem": logo.name, "x": 0.0, "abaixo_do_ombro": 0.22, "largura": 0.16, **decal}]
    (tmp_path / "ficha.json").write_text(json.dumps(raw), encoding="utf-8")
    return load(tmp_path / "ficha.json")


def decal_verts(mesh, mat="estampa_0"):
    ids = {i for f, m in zip(mesh.faces, mesh.mats) if m == mat for i in f}
    return np.array([mesh.verts[i] for i in sorted(ids)])


def test_desenho_fica_no_peito_com_a_largura_e_a_altura_da_ficha(tmp_path, logo):
    spec = tee(tmp_path, logo)
    mesh, info = build_top(spec)
    v = decal_verts(mesh)
    height = info["medidas_cm"]["comprimento"] / 100
    assert v[:, 1].mean() == pytest.approx(height - 0.22, abs=0.012)       # 22 cm abaixo do ombro
    assert v[:, 0].mean() == pytest.approx(0.0, abs=0.01)                  # no centro da frente
    assert np.ptp(v[:, 1]) == pytest.approx(0.08, abs=0.006)               # altura pela proporção 2:1
    assert 0.13 < np.ptp(v[:, 0]) <= 0.16                                  # 16 cm de pano: a projeção é menor
    assert (v[:, 2] > 0).all()                                             # na frente
    assert all(p == "detalhe" for p, m in zip(mesh.parts, mesh.mats) if m == "estampa_0")


def test_desenho_acompanha_o_pano_um_pouco_acima_dele(tmp_path, logo):
    spec = tee(tmp_path, logo)
    plain, _ = build_top(replace(spec, estampas=()))
    mesh, _ = build_top(spec)
    torso = np.array([plain.verts[i] for f, p in zip(plain.faces, plain.parts) if p == "tronco" for i in f])
    v = decal_verts(mesh)
    front = torso[(torso[:, 2] > 0) & (np.abs(torso[:, 1] - v[:, 1].mean()) < 0.05)]
    gap = [np.min(np.linalg.norm(front - p, axis=1)) for p in v[::7]]
    assert max(gap) < 0.02                                                 # colado no peito, não solto


def test_desenho_alto_desce_para_baixo_do_decote(tmp_path, logo):
    spec = tee(tmp_path, logo, abaixo_do_ombro=0.03)
    mesh, info = build_top(spec)
    m = info["medidas_cm"]
    neck_front = m["comprimento"] / 100 - m["decote_frente"] / 100
    assert decal_verts(mesh)[:, 1].max() <= neck_front - NECK_CLEAR + 0.004


def test_frente_com_ziper_deixa_o_vao_sem_desenho(tmp_path, logo):
    raw = json.loads((SPECS / "sacai-hoodie.json").read_text(encoding="utf-8"))
    raw["estampas"] = [{"imagem": logo.name, "x": 0.0, "abaixo_do_ombro": 0.3, "largura": 0.2}]
    (tmp_path / "f.json").write_text(json.dumps(raw), encoding="utf-8")
    mesh, _ = build_top(load(tmp_path / "f.json"))
    faces = [f for f, m in zip(mesh.faces, mesh.mats) if m == "estampa_0"]
    xs = [np.mean([mesh.verts[i][0] for i in f]) for f in faces]
    assert faces and min(abs(x) for x in xs) > 0.005                       # nada no vão do zíper
    assert any(x > 0 for x in xs) and any(x < 0 for x in xs)               # metade de cada lado


def test_ficha_recusa_desenho_sem_imagem_ou_fora_do_lugar(tmp_path, logo):
    raw = json.loads((SPECS / "sacai-tshirt.json").read_text(encoding="utf-8"))
    with pytest.raises(ValueError, match="não encontrada"):
        parse({**raw, "estampas": [{"imagem": "nao-existe.png", "x": 0, "abaixo_do_ombro": 0.2, "largura": 0.1}]},
              base_dir=tmp_path)
    with pytest.raises(ValueError, match="fora do lugar"):
        parse({**raw, "estampas": [{"imagem": logo.name, "x": 0, "abaixo_do_ombro": 0.2, "largura": 2.0}]},
              base_dir=tmp_path)
    with pytest.raises(ValueError, match="listras"):
        parse({**raw, "listras": {"direcao": "diagonal", "fundo": "#ffffff", "listra": "#000000", "periodo": 0.04,
                                  "fracao": 0.5}})


@pytest.mark.parametrize("period", [0.006, 0.0428, 0.07, 0.12])
def test_listra_fecha_na_repeticao_com_periodo_perto_do_pedido(period):
    m, n = fit_period(period)
    assert 1 <= m <= 8 and n >= 1                                          # até 40 cm numa direção
    assert m * 0.05 / n == pytest.approx(period, rel=0.13)


def test_listras_e_estampa_corrida_viram_a_textura_do_corpo(tmp_path):
    spec = load(SPECS / "sacai-tshirt.json")
    striped = replace(spec, listras=parse({**json.loads((SPECS / "sacai-tshirt.json").read_text()), "listras": {
        "direcao": "horizontal", "fundo": "#2f8962", "listra": "#65b69a", "periodo": 0.0428, "fracao": 0.44}}).listras)
    maps, scale = pattern_maps("jersey", striped, tmp_path)
    color = np.asarray(Image.open(maps["cor"]), float)
    m = round(1 / scale[1])
    assert scale[0] == 1.0 and color.shape[:2] == (512 * m, 512)
    rows = color[:, :, 1].mean(1)
    assert rows.max() - rows.min() > 40                                    # as duas cores aparecem
    tile = np.zeros((64, 64, 3), np.uint8); tile[:, :32] = (255, 0, 0)
    Image.fromarray(tile).save(tmp_path / "t.jpg")
    printed = replace(spec, estampa_corrida=parse({**json.loads((SPECS / "sacai-tshirt.json").read_text()),
                                                   "estampa_corrida": {"imagem": "t.jpg", "lado": 0.2}},
                                                  base_dir=tmp_path).estampa_corrida)
    maps, scale = pattern_maps("jersey", printed, tmp_path)
    color = np.asarray(Image.open(maps["cor"]), float)
    assert scale == (0.25, 0.25) and color.shape[:2] == (2048, 2048)
    assert color[:, -100:, 0].mean() > 2 * color[:, :100, 0].mean()       # espelhada: o u corre de +x para −x
    assert math.isclose(scale[0], 1 / 4)
