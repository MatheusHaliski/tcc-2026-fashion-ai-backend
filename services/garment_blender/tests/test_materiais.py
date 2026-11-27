"""Cor e acabamento dos tecidos: a textura tem a cor da ficha, o .glb leva as extensões KHR e a prévia é calibrada.

As partes que usam o Blender rodam num processo à parte (o ``bpy`` cai ao ser descarregado no fim do processo):

    ~/.venv-blender/bin/python -m pytest services/garment_blender/tests/test_materiais.py
"""
import importlib.util
import json
import struct
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from garment_blender import calibracao, fabric, pattern  # noqa: E402
from garment_blender.finish import FINISH  # noqa: E402
from garment_blender.spec import FABRICS, parse  # noqa: E402

needs_bpy = pytest.mark.skipif(importlib.util.find_spec("bpy") is None, reason="precisa do Blender (bpy)")
COLORS = ("#fdfdfd", "#f2f2f2", "#808080", "#6d1f2f", "#1f2a44", "#1b1b1b", "#0d0d0d")


def _lab_of_mean(path: Path) -> np.ndarray:
    """Lab da média em luz linear do JPEG gravado (o que o .glb leva, depois do arredondamento e da compressão)."""
    img = np.asarray(Image.open(path).convert("RGB"), float) / 255
    mean = fabric.to_srgb(fabric.to_linear(img).reshape(-1, 3).mean(0)) * 255
    return calibracao._lab(mean)


def _lab_hex(color: str) -> np.ndarray:
    return calibracao._lab(np.array([int(color[i:i + 2], 16) for i in (1, 3, 5)], float))


@pytest.mark.parametrize("kind", FABRICS)
def test_textura_gravada_tem_a_cor_da_ficha_e_o_branco_nao_corta(kind, tmp_path):
    for color in COLORS:
        maps = fabric.write_maps(kind, color, tmp_path)
        delta = float(np.linalg.norm(_lab_of_mean(maps["cor"]) - _lab_hex(color)))
        assert delta <= 1.0, f"{kind} {color}: ΔE {delta:.2f}"
    white = np.asarray(Image.open(fabric.write_maps(kind, "#f2f2f2", tmp_path)["cor"]).convert("RGB"))
    assert (white.max(-1) >= 255).mean() < 0.005   # quase nenhum pixel estourado: o relevo aparece no branco


def test_ribana_e_denim_tambem_ficam_na_cor_da_ficha(tmp_path):
    for kind, color, rib in (("malha_la", "#f2f2f2", True), ("moletom", "#1f2a44", True), ("denim", "#1b1b1b", False)):
        maps = fabric.write_maps(kind, color, tmp_path, rib=rib)
        assert np.linalg.norm(_lab_of_mean(maps["cor"]) - _lab_hex(color)) <= 1.0


def test_listras_ficam_na_media_das_duas_cores(tmp_path):
    spec = parse({"produto": "t", "marca": "t", "subcategoria": "t_shirt", "tecido": {"tipo": "jersey", "cor": "#f2f2f2"},
                  "listras": {"fundo": "#f2f2f2", "listra": "#1f2a44", "periodo": 0.025, "fracao": 0.5,
                              "direcao": "horizontal"}})
    maps, _ = pattern.pattern_maps("jersey", spec, tmp_path)
    want = (fabric.to_linear(fabric._rgb("#f2f2f2")) + fabric.to_linear(fabric._rgb("#1f2a44"))) / 2
    got = fabric.to_linear(np.asarray(Image.open(maps["cor"]).convert("RGB"), float) / 255).reshape(-1, 3).mean(0)
    assert np.allclose(got, want, rtol=0.03, atol=0.004)


def test_todo_tecido_tem_acabamento_exportavel():
    assert set(FINISH) == set(FABRICS)
    for kind, fin in FINISH.items():
        assert 0 < fin.specular <= 0.5, kind      # acima de 0,5 o exportador troca o fator pela cor especular
        assert 0 <= fin.sheen <= 1 and 0 <= fin.coat <= 1, kind
    assert FINISH["malha_la"].sheen > FINISH["sarja"].sheen                 # lã: véu de pelo; sarja: seca
    assert FINISH["couro"].roughness < FINISH["sarja"].roughness < FINISH["moletom"].roughness
    assert FINISH["couro"].coat and FINISH["cetim"].anisotropic and FINISH["veludo"].sheen >= 0.8


def test_tecidos_novos_tem_relevo_proprio_e_blazer_nao_usa_ponto_de_trico():
    heights = {k: fabric.height_map(k)[0] for k in ("la_plana", "malha_la", "couro", "nylon", "veludo", "cetim")}
    for a in heights:
        for b in heights:
            assert a == b or not np.allclose(heights[a], heights[b]), (a, b)
    assert fabric.height_map("la_plana")[1] < fabric.height_map("malha_la")[1] / 3   # relevo bem mais raso que o tricô
    quilt, strength = fabric.height_map("acolchoado")
    assert quilt.shape[0] == fabric.SIZE * fabric.repeat("acolchoado") and strength > 4   # gomo de 10 cm, fundo


def _glb_json(path: Path) -> dict:
    data = path.read_bytes()
    length = struct.unpack("<I", data[12:16])[0]
    return json.loads(data[20:20 + length])


@needs_bpy
@pytest.mark.parametrize("kind,extensions", [
    ("veludo", ("KHR_materials_sheen", "KHR_materials_specular")),
    ("couro", ("KHR_materials_clearcoat", "KHR_materials_specular")),
    ("cetim", ("KHR_materials_anisotropy", "KHR_materials_specular")),
    ("malha_la", ("KHR_materials_sheen", "KHR_materials_specular")),
])
def test_glb_leva_o_acabamento_nas_extensoes_khr(kind, extensions, tmp_path):
    ficha = tmp_path / "ficha.json"
    ficha.write_text(json.dumps({"produto": "t", "marca": "t", "subcategoria": "t_shirt", "manga_curta": True,
                                 "ribana": False, "tecido": {"tipo": kind, "cor": "#6d1f2f"}}))
    subprocess.run([sys.executable, "-m", "garment_blender.cli", str(ficha), "--out", str(tmp_path)], cwd=ROOT,
                   check=True, capture_output=True, timeout=300)
    gltf = _glb_json(tmp_path / "M" / "modelo.glb")
    body = next(m for m in gltf["materials"] if m["name"] == "corpo")
    for ext in extensions:
        assert ext in body.get("extensions", {}), (kind, ext, list(body.get("extensions", {})))
    assert body["pbrMetallicRoughness"]["roughnessFactor"] == pytest.approx(FINISH[kind].roughness, abs=0.01)
    spec = body["extensions"]["KHR_materials_specular"]["specularFactor"]
    assert spec == pytest.approx(2 * FINISH[kind].specular, abs=0.02)
    if FINISH[kind].sheen:   # o brilho de pelo sai tingido pela cor do tecido, na força da receita
        tint = body["extensions"]["KHR_materials_sheen"]["sheenColorFactor"]
        assert max(tint) == pytest.approx(FINISH[kind].sheen * max(fabric.to_linear(fabric._rgb("#6d1f2f"))), rel=0.05)


def _calibrate(tmp_path: Path, kinds: list[str], colors: list[str]) -> list[dict]:
    run = subprocess.run([sys.executable, "-m", "garment_blender.calibracao", "--out", str(tmp_path), "--tecidos",
                          *kinds, "--cores", *colors], cwd=ROOT, check=True, capture_output=True, text=True, timeout=600)
    return [json.loads(line) for line in run.stdout.splitlines() if line.startswith("{")]


def _check(rows: list[dict]) -> None:
    for r in rows:
        assert abs(r["dL"]) <= 4, r
        assert r["croma"] is None or r["croma"] >= 0.85, r


@needs_bpy
def test_calibracao_previa_amostras_lisas_saem_na_cor_da_ficha(tmp_path):
    rows = _calibrate(tmp_path, ["jersey"], list(calibracao.SWATCHES))
    assert len(rows) == len(calibracao.SWATCHES)
    _check(rows)
    by_color = {r["cor"]: r["previa_lab"] for r in rows}
    assert by_color["#1b1b1b"][0] <= 14                       # o preto não vira grafite
    assert np.hypot(*by_color["#1f2a44"][1:]) >= 15           # o marinho continua azul


@needs_bpy
def test_calibracao_previa_vale_para_trico_sarja_e_casca_brilhante(tmp_path):
    rows = _calibrate(tmp_path, ["malha_la", "sarja", "couro", "nylon"], ["#1b1b1b", "#1f2a44", "#f2f2f2"])
    assert len(rows) == 12
    _check(rows)
