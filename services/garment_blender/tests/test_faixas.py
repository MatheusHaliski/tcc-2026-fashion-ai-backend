"""Faixas de outra cor no mesmo tecido (barra e manga) e as alças pelo texto da peça sem manga."""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from catalogo import forma  # noqa: E402
from garment_blender.spec import parse  # noqa: E402
from garment_blender.top import build_top  # noqa: E402

SPECS = Path(__file__).resolve().parents[1] / "specs"


def tee(**extra):
    raw = json.loads((SPECS / "sacai-tshirt.json").read_text(encoding="utf-8"))
    return parse({**raw, **extra})


def test_faixa_da_barra_pinta_o_tronco_ate_a_altura_dela_com_borda_reta():
    mesh, _ = build_top(tee(faixa_barra={"cor": "#e4d576", "altura": 0.09}))
    band = [f for f, m in zip(mesh.faces, mesh.mats) if m == "faixa_barra"]
    tops = {round(max(mesh.verts[i][1] for i in f), 4) for f in band}
    assert band and max(tops) == pytest.approx(0.09, abs=0.02)
    rest = [f for f, m, p in zip(mesh.faces, mesh.mats, mesh.parts) if m == "corpo" and p == "tronco"]
    lowest = min(min(mesh.verts[i][1] for i in f) for f in rest)
    assert lowest >= max(tops) - 2e-4                                   # nada de corpo abaixo da borda: reta


def test_faixa_de_manga_e_um_anel_so_naquela_manga():
    band = {"lado": "manga_esquerda", "distancia": 0.12, "largura": 0.04, "cor": "#1c1b21"}
    mesh, _ = build_top(tee(faixas_manga=[band]))
    parts = {p for p, m in zip(mesh.parts, mesh.mats) if m == "faixa_manga_0"}
    assert parts == {"manga_d"}                                          # +x: a manga esquerda de quem veste
    with pytest.raises(ValueError, match="faixa de manga"):
        tee(faixas_manga=[{**band, "lado": "frente"}])


@pytest.mark.parametrize("text, expected", [
    ("top alfaiataria com alcinha", {"alca": 1.0, "decote": "quadrado", "decote_frente": 13.0}),
    ("regata alca larga", {"alca": 5.5}),
    ("top decote u", {"decote": "redondo"}),
    ("camiseta basica", {}),
])
def test_alca_e_decote_pelo_texto(text, expected):
    assert forma.straps(text, "top") == expected


def test_alcinha_fica_fina_no_motor():
    raw = json.loads((SPECS / "amaro-top-costura-contrastante.json").read_text(encoding="utf-8"))
    _, info = build_top(parse({**raw, "alca": 1.0}))
    assert info["alca"]["largura_cm"] == pytest.approx(1.0, abs=0.2)


def test_tomara_que_caia_e_um_tubo_sem_alca_abaixo_da_axila():
    raw = json.loads((SPECS / "amaro-top-costura-contrastante.json").read_text(encoding="utf-8"))
    spec = parse({**raw, "sem_alca": True})
    mesh, info = build_top(spec)
    assert spec.sem_manga and "manga_d" not in mesh.parts
    top = max(v[1] for v in mesh.verts)
    m = info["medidas_cm"]
    assert top == pytest.approx((m["comprimento"] - m["cava"] - 1) / 100, abs=0.01)   # para no busto, não no ombro
    assert info["medido_cm"]["torax"] < m["torax"]                                     # aperta em cima para segurar


def test_faixa_da_vista_corre_pelo_decote_e_pelas_bordas(tmp_path):
    from PIL import Image
    Image.new("RGB", (32, 32), (200, 170, 120)).save(tmp_path / "vista.jpg")
    raw = json.loads((SPECS / "burberry-cashmere-cardigan.json").read_text(encoding="utf-8"))
    spec = parse({**raw, "faixa_vista": {"cor": "#c8aa78", "largura": 0.06, "imagem": "vista.jpg", "lado": 0.04}},
                 base_dir=tmp_path)
    mesh, _ = build_top(spec)
    band = {i for f, m in zip(mesh.faces, mesh.mats) if m == "faixa_vista" for i in f}
    ys = [mesh.verts[i][1] for i in band]
    assert band and min(ys) < 0.1 and max(ys) > 0.5                                    # da barra até o decote
    assert "ribana" not in {m for f, m in zip(mesh.faces, mesh.mats) if min(mesh.verts[i][1] for i in f) > 0.45
                            and mesh.verts[f[0]][2] > 0.05}                            # a faixa ocupa o lugar da ribana do V
