"""Calibração da prévia: camisetas lisas em cores de referência, renderizadas como na prévia, e a cor medida no tronco.

    ~/.venv-blender/bin/python -m garment_blender.calibracao --out /tmp/calib --tecidos jersey sarja

Imprime uma linha JSON por amostra: a cor da ficha e a mediana de um retângulo no peito da frente, em Lab, com ΔL e a
razão de croma. O critério (teste ``test_calibracao_previa``): |ΔL| ≤ 4 e croma ≥ 85 % do da ficha.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SWATCHES = ("#0d0d0d", "#1b1b1b", "#1f2a44", "#6d1f2f", "#808080", "#f2f2f2")
RESOLUTION = (450, 320)   # metade da prévia: a mesma luz e o mesmo enquadramento, em um quarto do tempo
PATCH = (0.05, 0.18, 0.30)   # meia largura e faixa abaixo do topo da peça (m): o peito da frente


def _lab(rgb: np.ndarray) -> np.ndarray:
    c = np.asarray(rgb, float) / 255
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750],
                  [0.0193339, 0.1191920, 0.9503041]])
    xyz = lin @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def chest_patch(png: Path, verts: np.ndarray, resolution=RESOLUTION) -> np.ndarray:
    """Pixels do peito na prévia de frente: o retângulo ``PATCH`` projetado pela câmera ortográfica de ``previa``."""
    img = np.asarray(Image.open(png).convert("RGB"), float)
    w, h = resolution
    x, z = verts[:, 0], verts[:, 1]   # x e a altura (o y do motor é o z do Blender)
    mid_x, mid_z = (x.min() + x.max()) / 2, (z.min() + z.max()) / 2
    scale = max(x.max() - x.min(), (z.max() - z.min()) * w / h) * 1.15   # ortho_scale: cobre a largura
    px = w / scale
    half, below_a, below_b = PATCH
    c0, c1 = (int(w / 2 + (mid_x + s * half - mid_x) * px) for s in (-1, 1))
    r0, r1 = (int(h / 2 - (z.max() - d - mid_z) * px) for d in (below_a, below_b))
    return img[r0:r1, c0:c1].reshape(-1, 3)


def measure(color: str, kind: str, out: Path, samples: int = 32) -> dict:
    from . import blender_io
    from .spec import parse
    from .top import build_top
    spec = parse({"produto": "calibração", "marca": "motor", "subcategoria": "t_shirt", "manga_curta": True,
                  "ribana": False, "tecido": {"tipo": kind, "cor": color}})
    mesh, _ = build_top(spec)
    blender_io.reset()
    blender_io.to_object(mesh, "amostra", blender_io.fabric_materials(spec, out / "texturas"))
    png = blender_io.render_preview(out / f"{kind}-{color.lstrip('#')}.png", views=((0, "frente"),),
                                    resolution=RESOLUTION, samples=samples)[0]
    got = np.median(_lab(chest_patch(png, np.asarray(mesh.verts))), 0)
    want = _lab(np.array([int(color[i:i + 2], 16) for i in (1, 3, 5)], float))
    c_want, c_got = float(np.hypot(*want[1:])), float(np.hypot(*got[1:]))
    return {"tecido": kind, "cor": color, "ficha_lab": [round(float(v), 1) for v in want],
            "previa_lab": [round(float(v), 1) for v in got], "dL": round(float(got[0] - want[0]), 2),
            "croma": round(c_got / c_want, 3) if c_want > 5 else None, "imagem": str(png)}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--tecidos", nargs="+", default=["jersey"])
    ap.add_argument("--cores", nargs="+", default=list(SWATCHES))
    args = ap.parse_args(argv)
    for kind in args.tecidos:
        for color in args.cores:
            print(json.dumps(measure(color, kind, args.out), ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    code = main()   # o bpy 4.2 cai ao ser descarregado no fim do processo: sai direto (como o cli)
    sys.stdout.flush(); sys.stderr.flush()
    os._exit(code)
