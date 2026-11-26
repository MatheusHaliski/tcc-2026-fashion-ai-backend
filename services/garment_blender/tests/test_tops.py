"""Partes de cima: uma ficha por subcategoria da taxonomia e as construções de cada uma (sem manga, V aberto com
lapela, vista curta da polo, frente aberta, body)."""
import json
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from garment_blender.bodysuit import BRIEF  # noqa: E402
from garment_blender.manifest import fit_manifest, pierced_allowance  # noqa: E402
from garment_blender.spec import SUBCATEGORIES, load  # noqa: E402
from garment_blender.top import build_top  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
SPECS = Path(__file__).resolve().parents[1] / "specs"
TAXONOMY = ROOT / "fai-application/src/main/resources/taxonomy/taxonomy.json"


def upper_subcategories() -> list[str]:
    return [s["code"] for s in json.loads(TAXONOMY.read_text(encoding="utf-8"))["subcategories"] if s["category"] == "upper_piece"]


def spec_of(sub: str):
    for f in sorted(SPECS.glob("*.json")):
        if json.loads(f.read_text(encoding="utf-8"))["subcategoria"] == sub:
            return load(f)
    raise AssertionError(f"sem ficha para {sub}")


def test_toda_subcategoria_de_cima_da_taxonomia_tem_ficha():
    subs = upper_subcategories()
    assert set(subs) <= set(SUBCATEGORIES)
    for sub in subs:
        assert spec_of(sub).subcategoria == sub


@pytest.mark.parametrize("sub", upper_subcategories())
def test_cada_ficha_de_cima_vira_malha_com_o_torax_dela(sub):
    spec = spec_of(sub)
    mesh, report = build_top(spec)
    assert len(mesh.verts) > 2500
    assert report["medido_cm"]["torax"] == pytest.approx(report["medidas_cm"]["torax"], rel=0.08)
    assert fit_manifest(spec, mesh)["subcategoria"] == sub


def test_sem_manga_tem_alca_estreita_e_cava_acabada():
    spec = spec_of("tank_top")
    mesh, report = build_top(spec)
    assert "manga_d" not in mesh.parts and "manga_e" not in mesh.parts
    assert report["alca"]["largura_cm"] <= 9                     # a alça, não o ombro de uma manga
    assert "biceps" not in report["medido_cm"]


def test_v_aberto_tem_as_bordas_afastadas_e_lapelas():
    spec = spec_of("blazer")
    mesh, report = build_top(spec)
    v = np.array(mesh.verts)
    top = spec.medidas.comprimento * 0.01
    neck_band = v[(v[:, 1] > top - 0.03) & (v[:, 1] < top) & (v[:, 2] > 0.05)]
    assert np.abs(neck_band[:, 0]).min() > 0.04                   # no alto do V não há pano no meio da frente
    assert report["medido_cm"]["torax"] < report["medidas_cm"]["torax"] * 1.08   # sem a dobra que cruzava os anéis
    assert report["fechamento"]["botoes"] == 2


def test_polo_tem_vista_curta_e_barra_fechada():
    spec = spec_of("polo_shirt")
    mesh, report = build_top(spec)
    assert report["fechamento"]["botoes"] == 3
    v = np.array(mesh.verts)
    hem_front = v[(v[:, 1] < 0.02) & (v[:, 2] > 0.1)]
    assert np.abs(hem_front[:, 0]).min() < 0.01                   # na barra a frente é inteira (não abre até embaixo)


def test_frente_aberta_do_quimono_e_body_fechado_no_gancho():
    kimono, _ = build_top(spec_of("kimono"))
    v = np.array(kimono.verts)
    mid = v[(np.abs(v[:, 1] - 0.4) < 0.02) & (v[:, 2] > 0.1)]
    assert np.abs(mid[:, 0]).min() > 0.03                         # vão entre as bordas (10 cm, menos a dobra da vista)
    body = spec_of("bodysuit")
    mesh, report = build_top(body)
    assert report["medidas_cm"]["gancho_body"] == pytest.approx(BRIEF * 100)
    assert np.array(mesh.verts)[:, 1].min() < 0.02                # desce até o gancho
    assert fit_manifest(body, mesh)["pontoAlto"] == pytest.approx(body.medidas.comprimento * 0.01 + BRIEF)


def test_aceite_de_furos_so_para_barra_curta_e_peca_colada():
    assert pierced_allowance(spec_of("blazer")) is None           # o V não precisa mais (provador: uma camada só)
    assert pierced_allowance(spec_of("polo_shirt")) == pytest.approx(0.04)
    assert pierced_allowance(spec_of("top")) == pytest.approx(0.05)
