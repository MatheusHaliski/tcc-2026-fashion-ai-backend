"""Gera a peça em Blender a partir da ficha: um .glb por tamanho, com o manifesto de encaixe e o relatório de medidas.

    ~/.venv-blender/bin/python -m garment_blender.cli specs/stockton-sweater.json --out saida --tamanhos P M GG --previa
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import replace
from pathlib import Path

from . import blender_io
from .manifest import fit_manifest
from .spec import load
from .lower import build_lower
from .top import build_top


def build(spec_path: Path, size: str, out: Path, preview: bool, angle: float | None = None) -> dict:
    spec = load(spec_path, size)
    if angle is not None:
        spec = replace(spec, angulo_manga=angle)
    mesh, info = build_lower(spec) if spec.calca else build_top(spec)
    blender_io.reset()
    mats = blender_io.fabric_materials(spec, out / "texturas")
    blender_io.to_object(mesh, f"{spec.subcategoria}-{size}", mats)
    glb = out / size / "modelo.glb"
    blender_io.export_glb(glb)
    (glb.with_suffix(".fit.json")).write_text(json.dumps(fit_manifest(spec, mesh), ensure_ascii=False, indent=1))
    report = {"produto": spec.produto, "marca": spec.marca, "tamanho": size, "tecido": spec.tecido.tipo,
              "vertices": len(mesh.verts), "faces": len(mesh.faces), "ficha": info["medidas_cm"],
              "medido_no_modelo_cm": info["medido_cm"], "bytes": glb.stat().st_size}
    (out / size / "medidas.json").write_text(json.dumps(report, ensure_ascii=False, indent=1))
    if preview:
        report["previas"] = [str(p) for p in blender_io.render_preview(out / size / "previa.png")]
    return report


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("ficha", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--tamanhos", nargs="+", help="tamanhos a gerar (padrão: o da ficha)")
    ap.add_argument("--previa", action="store_true", help="renderiza frente e ¾ (Cycles, CPU)")
    ap.add_argument("--angulo", type=float, help="ângulo da manga abaixo da horizontal (troca o da ficha)")
    args = ap.parse_args(argv)
    for size in args.tamanhos or [load(args.ficha).tamanho]:
        r = build(args.ficha, size, args.out, args.previa, args.angulo)
        print(json.dumps({k: r[k] for k in ("tamanho", "vertices", "bytes", "medido_no_modelo_cm")}, ensure_ascii=False),
              flush=True)
    return 0


if __name__ == "__main__":
    # o bpy 4.2 como módulo cai (segfault) ao ser descarregado no fim do processo, depois de tudo gravado:
    # sai direto com o código do main, sem passar pela limpeza do Python
    code = main()
    sys.stdout.flush(); sys.stderr.flush()
    os._exit(code)
