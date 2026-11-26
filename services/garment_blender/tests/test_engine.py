"""Motor sem Blender: tabelas, ficha e a malha conferida com a fita métrica (measure.py). Roda com numpy e Pillow:

    python -m pytest services/garment_blender/tests
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from garment_blender.lower import build_lower  # noqa: E402
from garment_blender.sizes import LETTERS, top_measures  # noqa: E402
from garment_blender.sizes_pants import pants_measures  # noqa: E402
from garment_blender.spec import load, parse  # noqa: E402
from garment_blender.top import build_top  # noqa: E402

SPECS = Path(__file__).resolve().parents[1] / "specs"
BASE = {"produto": "t", "marca": "t", "subcategoria": "sweater", "tecido": {"tipo": "malha_la", "cor": "#6b7a5a"}}


def close(measured, wanted, tol=0.02):
    return abs(measured - wanted) <= tol * wanted


def test_grade_cresce_a_cada_tamanho_e_caimento_so_muda_a_folga():
    chest = [top_measures(s).torax for s in LETTERS]
    assert chest == sorted(chest) and chest[1] - chest[0] == 6
    regular, amplo = top_measures("M"), top_measures("M", fit="amplo")
    assert amplo.torax - regular.torax == 8 and amplo.comprimento == regular.comprimento


def test_ficha_recusa_campo_desconhecido_cor_invalida_e_medida_incoerente():
    with pytest.raises(ValueError, match="desconhecidos"):
        parse({**BASE, "botao_magico": True})
    with pytest.raises(ValueError, match="cor"):
        parse({**BASE, "tecido": {"tipo": "malha_la", "cor": "verde"}})
    with pytest.raises(ValueError, match="incoerentes"):
        parse({**BASE, "medidas_marca": {"punho": 60}})


@pytest.mark.parametrize("size", ["P", "M", "GG"])
def test_suéter_tem_na_malha_as_medidas_da_ficha(size):
    spec = load(SPECS / "stockton-sweater.json", size)
    mesh, info = build_top(spec)
    m, got = spec.medidas, info["medido_cm"]
    for key in ("torax", "biceps", "punho", "manga"):
        assert close(got[key], getattr(m, key)), (key, got[key], getattr(m, key))
    assert all(len(f) in (3, 4) for f in mesh.faces) and len(mesh.faces) == len(mesh.uvs) == len(mesh.mats)


def test_moletom_com_capuz_ziper_e_bolso_canguru_tem_cada_parte():
    mesh, _ = build_top(load(SPECS / "sacai-hoodie.json"))
    assert {"tronco", "manga_d", "manga_e", "capuz", "detalhe"} <= set(mesh.parts)
    assert {"cadarco", "dentes", "ribana"} <= set(mesh.mats)


@pytest.mark.parametrize("spec_file", ["nicholas-daley-cargo.json", "nicholas-daley-double-knee.json"])
def test_calca_tem_na_malha_as_medidas_da_ficha(spec_file):
    spec = load(SPECS / spec_file)
    mesh, info = build_lower(spec)
    m, got = spec.medidas_calca, info["medido_cm"]
    for key, tol in (("quadril", 0.02), ("coxa", 0.02), ("joelho", 0.02), ("cintura", 0.03), ("barra", 0.05)):
        assert close(got[key], getattr(m, key), tol), (key, got[key], getattr(m, key))
    assert got["entreperna"] == m.entreperna
    assert {"perna_d", "perna_e", "detalhe"} <= set(mesh.parts)


def test_numeracao_da_calca_segue_a_regra_do_provador():
    m40, m46 = pants_measures("40", "cargo_pants"), pants_measures("46", "cargo_pants")
    assert m40.cintura == 2 * 40 + 2 + 3 and m46.quadril - m40.quadril == 12
    assert pants_measures("40", "jogger_pants").ribana_barra > 0
    assert pants_measures("40", "chino_pants").ribana_barra == 0
