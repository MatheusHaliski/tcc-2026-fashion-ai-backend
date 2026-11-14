#!/usr/bin/env python3
"""Roda NO POD da RunPod: gera um .glb por produto do lote, em duas etapas, cada uma num processo.

1. ``--stage shape``: baixa a frente e as costas do flat lay aprovado (URLs públicas /media/) e gera a forma com o
   Hunyuan3D-2mv (frente + costas; só frente quando o produto não tem costas) → ``work/<id>/white.obj``.
2. ``--stage paint``: textura PBR com o Hunyuan3D 2.1 (condiciona pela frente) → ``glb/<id>.glb`` e uma linha no
   ``manifesto.csv`` (product_id, glb, generator, segundos, vistas): o formato que o import_meshy_glbs.py lê com a
   ligação "ID".

Saída só no volume do pod (nada vai ao bucket nem ao banco); falhas em ``falhas.csv`` sem parar o lote; retomável.

    cd /workspace && python runner/runpod_hunyuan_runner.py --stage shape --lot lote.csv --out glb-hunyuan
    cd /workspace && python runner/runpod_hunyuan_runner.py --stage paint --lot lote.csv --out glb-hunyuan
"""
from __future__ import annotations

import argparse
import csv
import io
import shutil
import time
import urllib.request
from pathlib import Path

GENERATOR = "hunyuan3d-2mv+2.1"
MANIFEST = ["product_id", "glb", "generator", "segundos", "vistas"]
MAX_IMAGE_BYTES = 25_000_000
REPOS = {"shape": Path("/workspace/Hunyuan3D-2"), "paint": Path("/workspace/Hunyuan3D-2.1")}


def read_lot(path: Path) -> list[dict]:
    with path.open(encoding="utf-8", newline="") as handle:
        return [r for r in csv.DictReader(handle) if r.get("product_id") and r.get("front_url", "").startswith("https://")]


def done_ids(out: Path) -> set[str]:
    path = out / "manifesto.csv"
    if not path.is_file():
        return set()
    with path.open(encoding="utf-8", newline="") as handle:
        return {r["product_id"] for r in csv.DictReader(handle) if (out / r["glb"]).is_file()}


def append(path: Path, columns: list[str], row: dict) -> None:
    new = not path.is_file()
    with path.open("a", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        if new:
            writer.writeheader()
        writer.writerow(row)


def download(url: str, dest: Path, opener=urllib.request.urlopen) -> Path:
    """Só https, no máximo 25 MB, e precisa abrir como imagem (PNG/JPEG/WebP) antes de virar arquivo."""
    from PIL import Image
    if not url.startswith("https://"):
        raise ValueError("URL_NAO_HTTPS")
    with opener(urllib.request.Request(url, headers={"User-Agent": "fashionai-batch"}), timeout=60) as response:
        data = response.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise ValueError("IMAGEM_GRANDE_DEMAIS")
    with Image.open(io.BytesIO(data)) as image:
        image.verify()
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return dest


def shape_one(row: dict, out: Path, backend, fetch) -> None:
    pid, work = row["product_id"], out / "work" / row["product_id"]
    views = {"front": fetch(row["front_url"], out / "img" / f"{pid}-front")}
    if row.get("back_url"):
        views["back"] = fetch(row["back_url"], out / "img" / f"{pid}-back")
    backend.generate(views, work)
    (work / "vistas.txt").write_text("+".join({"front": "frente", "back": "costas"}[v] for v in views))


def paint_one(row: dict, out: Path, backend, fetch) -> None:
    pid, work = row["product_id"], out / "work" / row["product_id"]
    glb = backend.generate(work)
    if not glb.is_file() or glb.stat().st_size == 0:
        raise RuntimeError("GLB_NAO_GERADO")
    (out / "glb").mkdir(parents=True, exist_ok=True)
    shutil.copyfile(glb, out / "glb" / f"{pid}.glb")


def pending(stage: str, lot: list[dict], out: Path) -> list[dict]:
    done = done_ids(out)
    shaped = lambda r: (out / "work" / r["product_id"] / "white.obj").is_file()   # noqa: E731
    if stage == "shape":
        return [r for r in lot if r["product_id"] not in done and not shaped(r)]
    return [r for r in lot if r["product_id"] not in done and shaped(r)]


def run(stage: str, lot: list[dict], out: Path, backend, fetch=download, clock=time.monotonic,
        limit: int | None = None) -> dict:
    todo = pending(stage, lot, out)
    todo = todo[:limit] if limit else todo
    counts = {"feitos": 0, "falhas": 0, "pendentes": len(todo)}
    for n, row in enumerate(todo, 1):
        pid, started, work = row["product_id"], clock(), out / "work" / row["product_id"]
        try:
            (shape_one if stage == "shape" else paint_one)(row, out, backend, fetch)
            seconds = round(clock() - started, 1)
            (work / f"{stage}_segundos.txt").write_text(str(seconds))
            if stage == "paint":
                total = round(seconds + float((work / "shape_segundos.txt").read_text() or 0), 1)
                append(out / "manifesto.csv", MANIFEST, {"product_id": pid, "glb": f"glb/{pid}.glb",
                       "generator": GENERATOR, "segundos": total, "vistas": (work / "vistas.txt").read_text()})
            counts["feitos"] += 1
            print(f"[{stage} {n}/{len(todo)}] {pid} ok em {seconds}s", flush=True)
        except Exception as exc:   # noqa: BLE001 - um produto com problema não para o lote
            message = " ".join(f"{type(exc).__name__}: {exc}".split())[:200]
            append(out / "falhas.csv", ["product_id", "etapa", "erro"], {"product_id": pid, "etapa": stage,
                                                                         "erro": message})
            counts["falhas"] += 1
            print(f"[{stage} {n}/{len(todo)}] {pid} FALHOU {message}", flush=True)
    return counts


def _real_backend(stage: str, repo: Path, seed: int):
    from runpod_hunyuan_backends import Paint21, ShapeMV
    return (ShapeMV if stage == "shape" else Paint21)(repo, seed=seed)


def main(argv=None, make_backend=_real_backend) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--stage", choices=["shape", "paint"], required=True, help="uma etapa por processo")
    parser.add_argument("--lot", type=Path, required=True, help="lote.csv do export_glb_batch.py")
    parser.add_argument("--out", type=Path, required=True, help="pasta no volume do pod")
    parser.add_argument("--repo", type=Path, help="repositório oficial da etapa (padrão: /workspace/Hunyuan3D-2[.1])")
    parser.add_argument("--limit", type=int, help="processa só os N primeiros pendentes (piloto)")
    parser.add_argument("--seed", type=int, default=1234)
    args = parser.parse_args(argv)
    lot = read_lot(args.lot)
    args.out.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    backend = make_backend(args.stage, args.repo or REPOS[args.stage], args.seed)
    print(f"{args.stage}: modelo carregado em {round(time.monotonic() - started)}s; lote: {len(lot)}", flush=True)
    counts = run(args.stage, lot, args.out, backend, limit=args.limit)
    peak = backend.peak_memory_gb() if hasattr(backend, "peak_memory_gb") else "?"
    print(f"{args.stage}: fim em {round(time.monotonic() - started)}s · {counts} · pico da GPU {peak} GB", flush=True)
    return 1 if counts["falhas"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
