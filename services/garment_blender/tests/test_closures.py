"""Frente aberta, zíper, botões, pesponto e colarinho (sem Blender: só a malha)."""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from garment_blender.buttons import LAP  # noqa: E402
from garment_blender.closures import ZIP_GAP  # noqa: E402
from garment_blender.collars import point_collar  # noqa: E402
from garment_blender.geometry import FRONT_COLUMN, Mesh, build_torso  # noqa: E402
from garment_blender.sizes import top_measures  # noqa: E402
from garment_blender.spec import load  # noqa: E402
from garment_blender.top import build_top  # noqa: E402

SPECS = Path(__file__).resolve().parents[1] / "specs"


def test_frente_aberta_vira_duas_bordas_e_contornos_abertos():
    mesh = Mesh()
    grid, _, rows, (_, _, i_neck), front = build_torso(mesh, top_measures("M"), True, ZIP_GAP)
    plus = np.array([mesh.verts[i] for i in front.plus])
    minus = np.array([mesh.verts[i] for i in front.minus])
    assert np.allclose(plus[:, 0], ZIP_GAP / 2) and np.allclose(minus[:, 0], -ZIP_GAP / 2)   # o vão do zíper
    assert len(front.hem) == len(front.neck) == grid.shape[1] + 1                              # a coluna da frente duplicou
    assert front.hem[0] == front.minus[0] and front.hem[-1] == front.plus[0]
    # nenhuma face liga as duas bordas: a frente está aberta de verdade
    edges = {frozenset(e) for f in mesh.faces for e in zip(f, f[1:] + f[:1])}
    assert not any(frozenset((a, b)) in edges for a, b in zip(front.plus, front.minus))
    assert int(grid[0, FRONT_COLUMN]) == front.plus[0]


def test_transpasse_dos_botoes_poe_o_painel_mais_x_por_cima():
    mesh = Mesh()
    *_, front = build_torso(mesh, top_measures("M"), False, -LAP, 0.002)
    plus, minus = mesh.verts[front.plus[10]], mesh.verts[front.minus[10]]
    assert plus[0] < 0 < minus[0]                 # cada borda passa do meio
    assert plus[2] > minus[2]                     # o painel de baixo recua


def test_moletom_com_ziper_tem_dentes_cursor_e_pesponto():
    mesh, report = build_top(load(SPECS / "sacai-hoodie.json"))
    assert report["fechamento"]["dentes"] > 300   # um dente a cada 3 mm de cada lado
    assert report["fechamento"]["pontos_pesponto"] > 200
    assert {"dentes", "cadarco", "linha"} <= set(mesh.mats)


def test_camisa_jaqueta_tem_botoes_casas_colarinho_e_pesponto():
    spec = load(SPECS / "chambray-shirt-jacket.json")
    mesh, report = build_top(spec)
    assert report["fechamento"]["botoes"] == spec.botoes == 7
    assert {"botao", "furo", "linha"} <= set(mesh.mats)


def test_colarinho_abre_em_pontas_retas_de_cada_lado_da_vista():
    mesh = Mesh()
    *_, front = build_torso(mesh, top_measures("M", "FEMININO"), False, -LAP, 0.002)
    first = len(mesh.verts)
    point_collar(mesh, front.neck, 0.0015, closed=False)
    n = len(front.neck)
    tips = np.array(mesh.verts[first + 5 * n:first + 6 * n])   # último anel da folha (pé 2 + dobra 1 + folha 3)
    neck_y = mesh.verts[front.plus[-1]][1]
    assert tips[0, 0] < -0.01 and tips[-1, 0] > 0.01           # cada ponta abriu para o lado do seu painel
    assert tips[-1, 0] - tips[0, 0] > 0.04                       # sem cruzar: as pontas ficam afastadas
    assert tips[0, 1] < neck_y and tips[-1, 1] < neck_y         # e desce abaixo do decote, sobre o peito
    back = tips[n // 2]
    assert back[1] > tips[0, 1] + 0.03                         # nas costas a folha é mais curta que a ponta
