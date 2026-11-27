"""Peça sem manga com alça de verdade (strap_cut, tank, shoulder_bridge): o peito na largura toda até a axila, a alça
reta pelo meio do ombro passando por cima dele, o decote desenhado entre as alças e a cava em curva."""
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from garment_blender.edge_frame import edge_frame  # noqa: E402
from garment_blender.geometry import COLUMNS, Mesh, ellipse_semi_axes  # noqa: E402
from garment_blender.manifest import fit_manifest  # noqa: E402
from garment_blender.prints import Decal  # noqa: E402
from garment_blender.shoulder_bridge import boundary_cycles  # noqa: E402
from garment_blender.spec import load  # noqa: E402
from garment_blender.strap_cut import resolve  # noqa: E402
from garment_blender.tank import K_O, build_sleeveless_torso  # noqa: E402
from garment_blender.top import build_top  # noqa: E402

SPECS = Path(__file__).resolve().parents[1] / "specs"
NAMES = ("everlane-air-muscle-tank", "amaro-top-costura-contrastante", "hope-body-modelador-microfibra",
         "allsaints-astra-tailored-vest")
SIZES = ("PP", "M", "XG")


def spec_of(name, size=None, **changes):
    spec = load(SPECS / f"{name}.json", size)
    return replace(spec, **changes) if changes else spec


def regata_basica(size=None):   # t_shirt sem manga de gola careca, como o catálogo monta a "Regata Básica"
    return spec_of("sacai-tshirt", size, sem_manga=True, ribana=True, gola="careca", estampas=(), manga_curta=False)


def torso(spec, opening=0.0):
    cut, m = resolve(spec, spec.medidas)
    mesh = Mesh()
    grid, loops, neck, rows, idx, front = build_sleeveless_torso(mesh, m, cut, spec.ribana, opening, 0.002)
    return mesh, cut, m, grid, loops, neck, rows, front


def top_row(grid):
    """Anel do joelho: o último em que o meio da frente ainda tem pano."""
    return int(np.nonzero(grid[:, COLUMNS // 4] >= 0)[0].max())


@pytest.mark.parametrize("name", NAMES[:3])
@pytest.mark.parametrize("size", SIZES)
def test_malha_fechada_com_quatro_contornos(name, size):
    mesh, cut, m, grid, loops, neck, rows, front = torso(spec_of(name, size))
    cycles = boundary_cycles(mesh.faces)
    hem = [int(v) for v in grid[0]]
    assert sorted(map(sorted, cycles)) == sorted(map(sorted, (hem, loops[0], loops[1], neck)))
    for cyc in cycles:
        assert len(set(cyc)) == len(cyc)
    used = {i for f in mesh.faces for i in f}
    assert used == set(range(len(mesh.verts)))                    # nenhum vértice solto
    assert all(i >= 0 for f in mesh.faces for i in f)


@pytest.mark.parametrize("name", NAMES)
def test_peito_inteiro_e_alca_no_meio_do_ombro(name):
    spec = spec_of(name)
    mesh, cut, m, grid, loops, neck, rows, front = torso(spec, -0.026 if spec.fechamento == "botoes" else 0.0)
    v = np.array(mesh.verts)
    chest = v[(np.abs(v[:, 1] - (cut.y_arm - 0.01)) < 0.004) & (v[:, 2] > 0)]
    assert np.abs(chest[:, 0]).max() >= 0.95 * cut.a_c              # sem cone: o peito vai até a axila
    band = v[(v[:, 1] > cut.y_t - 0.02) & (v[:, 1] <= cut.y_t + 1e-6) & (v[:, 2] > 0)]
    assert np.abs(band[:, 0]).min() >= cut.x_in - 0.005 and np.abs(band[:, 0]).max() <= cut.x_out + 0.005
    na = ellipse_semi_axes(m.pescoco * 0.01, 0.9)[0]
    centro = spec.alca_centro if spec.alca_centro is not None else (0.6 if spec.subcategoria == "vest" else 0.5)
    if spec.subcategoria == "bodysuit":
        centro = 0.45
    assert (cut.x_in + cut.x_out) / 2 == pytest.approx(na + centro * (m.ombro * 0.005 - na), abs=0.01)
    assert cut.x_in >= na + 0.008 - 1e-9                            # a alça não abraça o pescoço (frente única)
    top = top_row(grid)
    for c in (K_O, COLUMNS // 2 - K_O, COLUMNS // 2 + K_O, COLUMNS - K_O):   # bordas de fora da alça: retas
        xs = [v[i, 0] for i in grid[top:, c] if i >= 0]
        assert np.std(xs) < 0.003


def test_largura_da_alca_e_relatorio():
    spec = spec_of(NAMES[0])
    mesh, report = build_top(spec)
    assert report["alca"]["largura_cm"] == pytest.approx(6.0, abs=0.5)
    assert report["alca"]["largura_cm"] <= 9 and "biceps" not in report["medido_cm"]
    assert "manga_d" not in mesh.parts and "manga_e" not in mesh.parts
    assert report["medido_cm"]["torax"] == pytest.approx(report["medidas_cm"]["torax"], rel=0.08)


def _front_neck(mesh, neck):
    p = np.array([mesh.verts[i] for i in neck])
    return p[p[:, 2] > 0], p[p[:, 2] < 0]


@pytest.mark.parametrize("shape", ["redondo", "quadrado", "v"])
def test_decote_desenhado(shape):
    spec = spec_of(NAMES[1], decote=shape if shape != "v" else None, gola="v" if shape == "v" else "vies")
    mesh, cut, m, grid, loops, neck, rows, front = torso(spec)
    f, b = _front_neck(mesh, neck)
    assert f[:, 1].min() == pytest.approx(cut.H - m.decote_frente * 0.01, abs=0.01)
    assert b[:, 1].min() == pytest.approx(cut.H - m.decote_costas * 0.01, abs=0.01)
    assert b[:, 1].min() >= f[:, 1].min() - 1e-6
    low = f[np.abs(f[:, 0]) < cut.x_in - 0.002]                   # a curva, sem a borda reta da alça
    ax, ay = np.abs(low[:, 0]), low[:, 1]
    if shape == "quadrado":
        flat = ay[ax < cut.x_in - 0.015]
        assert flat.max() - flat.min() < 0.003
    elif shape == "v":
        r = np.corrcoef(ax, ay)[0, 1]
        assert r ** 2 > 0.98
    else:
        order = np.argsort(ax)
        assert np.all(np.diff(ay[order]) >= -1e-6)                  # sobe do meio para a alça


@pytest.mark.parametrize("name", NAMES[:3])
def test_cava_e_ponte_sobre_o_ombro(name):
    mesh, cut, m, grid, loops, neck, rows, front = torso(spec_of(name))
    v = np.array(mesh.verts)
    for loop in loops:
        p = v[loop]
        low = p[np.argmin(p[:, 1])]
        assert low[1] == pytest.approx(cut.y_arm, abs=0.01) and abs(low[2]) < 0.03
        apex = p[np.argmax(p[:, 1])]
        assert abs(apex[2]) < 0.015 and cut.H - 0.04 <= apex[1] <= cut.H
        assert cut.x_in - 1e-6 <= abs(apex[0]) <= cut.x_out + 1e-6
    assert float(cut.armhole_knee(cut.x_out, 1)) > float(cut.armhole_knee(cut.x_out, -1))
    assert v[:, 1].max() <= cut.H + 0.005


def test_viés_dobra_para_dentro_do_pano_sem_aba():
    mesh, cut, m, grid, loops, neck, rows, front = torso(spec_of(NAMES[0]))
    v = np.array(mesh.verts)
    for loop, closed in ((loops[0], True), (loops[1], True), (neck, True)):
        normal, away = edge_frame(mesh, loop, closed)
        p = v[loop]
        deep = p - normal * 0.002 + away * 0.01
        assert np.all(deep[:, 1] <= p[:, 1].max() + 0.003)          # nada sobe acima da ponte
        assert np.all(np.linalg.norm(deep - p, axis=1) < 0.015)
        inside = p + away * 0.007                                  # o pesponto cai no pano, não no buraco
        center = p.mean(0)
        assert np.mean(np.linalg.norm((inside - center) * [1, 1, 0], axis=1) >=
                       np.linalg.norm((p - center) * [1, 1, 0], axis=1) - 1e-4) > 0.8


def test_desenho_na_regata_fica_no_pano(tmp_path):
    png = tmp_path / "logo.png"
    Image.new("RGBA", (40, 20), (200, 0, 0, 255)).save(png)
    spec = spec_of(NAMES[0], estampas=(Decal(str(png), 0.0, 0.16, 0.42),))
    mesh, report = build_top(spec)
    cut, m = resolve(spec, spec.medidas)
    pts = np.array([mesh.verts[i] for f, mat in zip(mesh.faces, mesh.mats) if mat == "estampa_0" for i in f])
    assert len(pts)
    assert pts[:, 1].max() <= cut.H - m.decote_frente * 0.01 - 0.012 + 1e-6
    assert np.all(np.abs(pts[:, 0]) <= np.array([cut.armhole_x(y, 1) for y in pts[:, 1]]) + 0.003)


def test_colete_abre_ate_o_fundo_do_v_com_botoes_e_ziper():
    spec = spec_of(NAMES[3])
    mesh, report = build_top(spec)
    assert report["fechamento"]["botoes"] == 4
    torso_mesh, cut, m, grid, loops, neck, rows, front = torso(spec, -0.026)
    assert torso_mesh.verts[front.plus[-1]][1] == pytest.approx(cut.y_bot_f, abs=0.005)   # a frente abre até o V
    assert torso_mesh.verts[front.minus[-1]][1] == pytest.approx(cut.y_bot_f, abs=0.005)
    assert front.neck[0] == front.minus[-1] and front.neck[-1] == front.plus[-1]
    assert len(front.hem) == COLUMNS + 1
    zipped, rep = build_top(replace(spec, fechamento="ziper_inteiro"))
    assert rep["fechamento"]["dentes"] > 0


def test_body_continua_fechando_no_gancho():
    spec = spec_of(NAMES[2])
    mesh, cut, m, grid, *_ = torso(spec)
    assert (grid[0] >= 0).sum() == COLUMNS
    full, report = build_top(spec)
    assert "quadril_body" in report["medidas_cm"]
    assert fit_manifest(spec, full)["pontoAlto"] == pytest.approx(spec.medidas.comprimento * 0.01 + 0.16)


def _check_faces(mesh):
    v = np.array(mesh.verts)
    directed = set()
    for f in mesh.faces:
        p = v[list(f)]
        area = 0.5 * np.linalg.norm(np.cross(p[2] - p[0], p[3] - p[1]))
        assert area > 1e-7
        for a, b in zip(f, f[1:] + f[:1]):
            assert (a, b) not in directed                          # vizinhas com a mesma orientação
            directed.add((a, b))


@pytest.mark.parametrize("size", ("PP", "P", "M", "G", "GG", "XG"))
def test_toda_ficha_sem_manga_em_toda_a_grade(size):
    specs = [spec_of(n, size) for n in NAMES] + [regata_basica(size)]
    for spec in specs:
        mesh, cut, m, grid, loops, neck, rows, front = torso(spec, -0.026 if spec.fechamento == "botoes" else 0.0)
        _check_faces(mesh)
        assert cut.y_base + 0.02 - 1e-9 <= float(cut.armhole_knee(cut.a_c, 1))
        assert cut.y_t - cut.y_bot_f >= 0.025 - 1e-9 and cut.y_t - cut.y_bot_b >= 0.025 - 1e-9
        full, report = build_top(spec)
        assert len(full.verts) > 2500 and "alca" in report


def test_regata_de_gola_careca_tem_alca_junto_do_pescoco():
    spec = regata_basica()
    mesh, report = build_top(spec)
    cut, m = resolve(spec, spec.medidas)
    na = ellipse_semi_axes(m.pescoco * 0.01, 0.9)[0]
    assert cut.x_in == pytest.approx(na + 0.008, abs=1e-6)
    assert report["alca"]["decote"] == "redondo" and "ribana" in mesh.mats
