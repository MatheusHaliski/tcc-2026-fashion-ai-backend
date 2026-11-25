"""Caracterização: as peças com manga (e as sem manga com gola de colarinho, polo, lapela, faixa ou capuz) saem
idênticas, vértice a vértice, ao que o motor fazia antes da regata com alça de verdade.

O retrato fica em ``tests/data/sleeved_snapshot.json``: um sha256 dos vértices (arredondados a 1e-6 m), das faces, dos
materiais e das partes, mais as medidas tiradas da malha. Para regravar (só quando a mudança na peça com manga é
intencional): ``FAI_SNAPSHOT_UPDATE=1 python -m pytest tests/test_sleeved_snapshot.py``.
"""
import hashlib
import json
import os
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from garment_blender.spec import load  # noqa: E402
from garment_blender.top import build_top  # noqa: E402

SPECS = Path(__file__).resolve().parents[1] / "specs"
SNAPSHOT = Path(__file__).resolve().parent / "data" / "sleeved_snapshot.json"
# sem manga com gola que precisa do anel inteiro do decote: segue o caminho antigo (ficha, gola, fechamento)
# (o colarinho fechado, sem frente que abre, cai no pesponto: fica de fora até ser corrigido à parte)
LEGACY = (("everlane-air-muscle-tank", "capuz", "nenhum"), ("amaro-top-costura-contrastante", "colarinho", "botoes"),
          ("hope-body-modelador-microfibra", "polo", "polo"), ("allsaints-astra-tailored-vest", "lapela", "botoes"),
          ("allsaints-astra-tailored-vest", "faixa", "aberto"))


def _cases() -> dict:
    cases = {}
    for f in sorted(SPECS.glob("*.json")):
        raw = json.loads(f.read_text(encoding="utf-8"))
        if raw.get("sem_manga"):
            continue
        cases[f.stem] = (f, None, None)
    for name, gola, fecho in LEGACY:
        cases[f"{name}+{gola}"] = (SPECS / f"{name}.json", gola, fecho)
    return cases


def fingerprint(spec) -> dict:
    mesh, report = build_top(spec)
    h = hashlib.sha256()
    h.update(np.round(np.array(mesh.verts), 6).tobytes())
    for face in mesh.faces:
        h.update(np.asarray(face, np.int64).tobytes())
    h.update("|".join(mesh.mats).encode()); h.update("|".join(mesh.parts).encode())
    h.update(json.dumps(sorted(mesh.seams)).encode())
    return {"sha256": h.hexdigest(), "verts": len(mesh.verts), "medido_cm": report["medido_cm"]}


def _spec(case):
    path, gola, fecho = case
    spec = load(path)
    if spec.calca:
        return None
    return replace(spec, gola=gola, fechamento=fecho) if gola else spec


CASES = {k: v for k, v in _cases().items() if _spec(v) is not None}


@pytest.mark.skipif(not os.environ.get("FAI_SNAPSHOT_UPDATE"), reason="só para regravar o retrato")
def test_regrava_o_retrato():
    SNAPSHOT.parent.mkdir(exist_ok=True)
    data = {k: fingerprint(_spec(v)) for k, v in CASES.items()}
    SNAPSHOT.write_text(json.dumps(data, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")


@pytest.mark.parametrize("name", sorted(CASES))
def test_peca_com_manga_nao_muda(name):
    expected = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    assert name in expected, f"{name} fora do retrato: regrave com FAI_SNAPSHOT_UPDATE=1"
    assert fingerprint(_spec(CASES[name])) == expected[name]
