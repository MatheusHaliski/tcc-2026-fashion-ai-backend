"""Etapa B do lote (venv do Blender): monta o .glb de cada ficha pronta da etapa A num processo só (o bpy carrega uma
vez). Com ``--seguir`` espera as fichas novas enquanto a etapa A roda e para quando ela marca o fim. Ficha que falha
ganha ``falha.txt`` e não volta a ser tentada.

    cd services/garment_blender && ~/.venv-blender/bin/python -m catalogo.construir --pasta ~/catalogo-3d --seguir
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import time
import traceback
from pathlib import Path

from catalogo.produtos import shard


def pending(root: Path, part: int = 0, parts: int = 1) -> list[Path]:
    return [d for d in sorted(root.iterdir()) if d.is_dir() and (d / "ficha.json").is_file()
            and not (d / "M" / "modelo.glb").is_file() and not (d / "falha.txt").exists()
            and shard(d.name, parts) == part]


def build_one(folder: Path, preview: bool) -> dict:
    from garment_blender import blender_io
    from garment_blender.cli import build
    t0 = time.time()
    report = build(folder / "ficha.json", "M", folder, False)
    if preview:
        blender_io.render_preview(folder / "M" / "previa.png", views=((0, "frente"),))
    shutil.rmtree(folder / "texturas", ignore_errors=True)   # já estão dentro do .glb
    return {"id": folder.name, "vertices": report["vertices"], "bytes": report["bytes"], "s": round(time.time() - t0, 1)}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--pasta", type=Path, required=True)
    ap.add_argument("--seguir", action="store_true", help="espera fichas novas até a etapa A terminar")
    ap.add_argument("--previa", action="store_true", help="renderiza a frente de cada peça (Cycles, ~8 s)")
    ap.add_argument("--maximo", type=int, default=250, help="peças por processo (o laço de fora reabre)")
    ap.add_argument("--parte", default="0/1", help="i/n: só a parte i de n (vários processos em paralelo)")
    args = ap.parse_args(argv)
    part, parts = (int(v) for v in args.parte.split("/"))
    done = 0
    log = (args.pasta / f"construcao-{part}.jsonl").open("a", encoding="utf-8")
    while done < args.maximo:
        todo = pending(args.pasta, part, parts)
        if not todo:
            if args.seguir and not (args.pasta / "fim-analise").exists():
                time.sleep(15)
                continue
            break
        for folder in todo[: args.maximo - done]:
            try:
                row = build_one(folder, args.previa)
            except Exception as e:   # noqa: BLE001 - uma ficha ruim não para o lote
                (folder / "falha.txt").write_text(traceback.format_exc()[-3000:], encoding="utf-8")
                row = {"id": folder.name, "falha": f"{type(e).__name__}: {e}"[:300]}
            log.write(json.dumps(row, ensure_ascii=False) + "\n"); log.flush()
            print(json.dumps(row, ensure_ascii=False), flush=True)
            done += 1
    left = len(pending(args.pasta, part, parts))
    if not left and (args.pasta / "fim-analise").exists():
        (args.pasta / f"fim-construcao-{part}").write_text(time.strftime("%Y-%m-%d %H:%M:%S"))
    if all((args.pasta / f"fim-construcao-{i}").exists() for i in range(parts)):
        (args.pasta / "fim-construcao").write_text(time.strftime("%Y-%m-%d %H:%M:%S"))
    print(json.dumps({"fim": done, "restam": left}), flush=True)
    return 0 if (args.pasta / f"fim-construcao-{part}").exists() or not args.seguir else 3   # 3: o laço reabre


if __name__ == "__main__":
    code = main()
    sys.stdout.flush(); sys.stderr.flush()
    os._exit(code)   # o bpy 4.2 cai ao descarregar no fim do processo (ver cli.py)
