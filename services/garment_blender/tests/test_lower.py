"""Peças de baixo: uma ficha por subcategoria da taxonomia, perna curta, saia com roda e pregas, saia-short."""
import json
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from garment_blender.lower import build_lower  # noqa: E402
from garment_blender.manifest import fit_manifest  # noqa: E402
from garment_blender.sizes_pants import CUTS, check_pants, pants_measures  # noqa: E402
from garment_blender.spec import load  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
SPECS = Path(__file__).resolve().parents[1] / "specs"
TAXONOMY = ROOT / "fai-application/src/main/resources/taxonomy/taxonomy.json"


def lower_subcategories() -> list[str]:
    return [s["code"] for s in json.loads(TAXONOMY.read_text(encoding="utf-8"))["subcategories"] if s["category"] == "lower_piece"]


def specs_by_subcategory() -> dict:
    out = {}
    for f in sorted(SPECS.glob("*.json")):
        sub = json.loads(f.read_text(encoding="utf-8"))["subcategoria"]
        out.setdefault(sub, f)
    return out


def test_toda_subcategoria_de_baixo_da_taxonomia_tem_modelo_e_uma_ficha():
    subs = lower_subcategories()
    assert set(subs) <= set(CUTS)
    assert set(subs) <= set(specs_by_subcategory())


@pytest.mark.parametrize("sub", lower_subcategories())
def test_cada_ficha_de_baixo_vira_malha_com_as_medidas_dela(sub):
    spec = load(specs_by_subcategory()[sub])
    assert not check_pants(spec.medidas_calca)
    mesh, report = build_lower(spec)
    assert len(mesh.verts) > 1500
    measured, used = report["medido_cm"], report["medidas_cm"]
    assert abs(measured["cintura"] - used["cintura"]) <= used["cintura"] * 0.05
    manifest = fit_manifest(spec, mesh)
    assert manifest["categoria"] == "lower_piece" and manifest["subcategoria"] == sub


def test_short_e_bermuda_tem_a_entreperna_do_modelo_e_aceite_de_perna_curta():
    for cut, inseam in (("shorts", 14), ("bermuda_shorts", 26), ("denim_shorts", 10)):
        m = pants_measures("40", cut)
        assert m.entreperna == inseam
        assert m.barra <= m.coxa * 1.1                       # a perna curta não estreita até um joelho que não tem
    spec = load(specs_by_subcategory()["shorts"])
    mesh, report = build_lower(spec)
    assert report["medido_cm"]["entreperna"] == pytest.approx(12.7)
    assert fit_manifest(spec, mesh)["dicas"]["aceite"]["furada"] == pytest.approx(0.04)
    long_spec = load(specs_by_subcategory()["jeans"])
    assert "aceite" not in fit_manifest(long_spec, build_lower(long_spec)[0])["dicas"]


def test_saia_abre_do_quadril_a_barra_e_tem_pregas():
    spec = load(specs_by_subcategory()["skirt"])
    mesh, report = build_lower(spec)
    m = report["medidas_cm"]
    assert report["medido_cm"]["barra"] == pytest.approx(m["quadril"] * m["roda"], rel=0.06)
    assert report["medido_cm"]["comprimento"] == pytest.approx(m["comprimento"], abs=0.5)
    v = np.array(mesh.verts)
    hem = v[np.abs(v[:, 1]) < 1e-6]
    radius = np.hypot(hem[:, 0], hem[:, 2] / 0.74)            # elipse da barra → raio
    assert radius.max() - radius.min() > 0.012                 # as pregas saem e entram na barra
    assert spec.pregas == 24


def test_saia_short_tem_o_short_e_a_saia_por_cima():
    spec = load(specs_by_subcategory()["skort"])
    mesh, _ = build_lower(spec)
    assert {"perna_d", "perna_e"} <= set(mesh.parts)         # o short por baixo
    v = np.array(mesh.verts)
    legs_bottom = min(mesh.verts[i][1] for f, p in zip(mesh.faces, mesh.parts) if p == "perna_d" for i in f)
    skirt_hem = v[:, 1].min()
    assert skirt_hem < legs_bottom                             # a saia cobre o short


def test_ficha_recusa_pregas_que_nao_dividem_o_anel():
    raw = json.loads((SPECS / "allsaints-jax-pleated-midi-skirt.json").read_text(encoding="utf-8"))
    raw["pregas"] = 25
    from garment_blender.spec import parse
    with pytest.raises(ValueError, match="pregas"):
        parse(raw)


def test_bolsos_tem_a_costura_de_cada_tipo():
    def linha(sub):
        mesh, _ = build_lower(load(specs_by_subcategory()[sub]))
        return mesh, sum(1 for m in mesh.mats if m == "linha")
    jeans, n_jeans = linha("jeans")
    chino, n_chino = linha("chino_pants")
    legging, n_legging = linha("leggings")
    assert n_jeans > n_chino > n_legging > 0                     # o jeans tem o kit de cinco bolsos; a legging só cós e barra
    assert "botao" in chino.mats and "furo" in chino.mats         # o bolso embutido da chino leva botão
    assert "dentes" in jeans.mats                                 # rebites do jeans
    from dataclasses import replace
    short = load(specs_by_subcategory()["shorts"])
    with_pocket = sum(1 for m in build_lower(short)[0].mats if m == "linha")
    without = sum(1 for m in build_lower(replace(short, bolsos=()))[0].mats if m == "linha")
    assert with_pocket > without                                  # o bolso da costura lateral tem pesponto e travetas
