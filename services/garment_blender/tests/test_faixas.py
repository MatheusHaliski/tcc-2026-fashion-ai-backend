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
