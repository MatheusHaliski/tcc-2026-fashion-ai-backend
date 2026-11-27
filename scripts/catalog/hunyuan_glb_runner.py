#!/usr/bin/env python3
"""Roda na GPU do lote (pod da RunPod ou VM da GCP): gera um .glb por produto, em duas etapas, cada uma num processo.

1. ``--stage shape``: baixa a imagem da fonte do lote (glb_batch_sources.py). Fonte ``FOTO``: tira a pessoa antes
   (hunyuan_glb_cutout.py). Forma com o Hunyuan3D-2mv (frente + costas quando o flat lay tem costas; ``--shape-turbo``:
   5 passos + FlashVDM) → ``work/<id>/white.obj``.
2. ``--stage paint``: textura pela frente — ``--paint 2.1`` (PBR, ≥ 24 GB) ou ``--paint 2.0`` (cor, cabe na T4) →
   ``glb/<id>.glb`` e uma linha no ``manifesto.csv`` (product_id, glb, generator, segundos, vistas, fonte, recorte): o
   formato que o import_meshy_glbs.py lê com a ligação "ID".

Saída só na pasta local da GPU (nada vai ao bucket de produção nem ao banco); falhas em ``falhas.csv`` sem parar o
lote; retomável.

    python hunyuan_glb_runner.py --stage shape --lot lote.csv --out glb-hunyuan --root /workspace
    python hunyuan_glb_runner.py --stage paint --lot lote.csv --out glb-hunyuan --root /workspace --paint 2.1
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import shutil
import time
import urllib.request
from pathlib import Path

MANIFEST = ["product_id", "glb", "generator", "segundos", "vistas", "fonte", "recorte"]
MAX_IMAGE_BYTES = 25_000_000
REPO_DIRS = {"shape": "Hunyuan3D-2", "2.0": "Hunyuan3D-2", "2.1": "Hunyuan3D-2.1"}


def generator_name(paint: str) -> str:
    return f"hunyuan3d-2mv+{paint}"


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


def shape_one(row: dict, out: Path, backend, fetch, cutter=None) -> None:
    pid, work = row["product_id"], out / "work" / row["product_id"]
    front = fetch(row["front_url"], out / "img" / f"{pid}-front")
    if row.get("fonte") == "FOTO":   # foto do produto: sem a pessoa antes da forma
        if cutter is None:
            raise RuntimeError("RECORTE_INDISPONIVEL")
        front = cutter(front, row.get("category", ""), row.get("subcategory", ""), work / "front_cut.png")
    views = {"front": front}
    if row.get("back_url"):
        views["back"] = fetch(row["back_url"], out / "img" / f"{pid}-back")
    backend.generate(views, work)
    (work / "vistas.txt").write_text("+".join({"front": "frente", "back": "costas"}[v] for v in views))


def paint_one(row: dict, out: Path, backend, fetch, cutter=None) -> None:
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


def manifest_row(row: dict, work: Path, seconds: float, generator: str) -> dict:
    cut = work / "recorte.json"
    return {"product_id": row["product_id"], "glb": f"glb/{row['product_id']}.glb", "generator": generator,
            "segundos": round(seconds + float((work / "shape_segundos.txt").read_text() or 0), 1),
            "vistas": (work / "vistas.txt").read_text(), "fonte": row.get("fonte") or "FLAT_LAY",
            "recorte": json.loads(cut.read_text())["modo"] if cut.is_file() else ""}


def run(stage: str, lot: list[dict], out: Path, backend, fetch=download, clock=time.monotonic,
        limit: int | None = None, cutter=None, generator: str = generator_name("2.1")) -> dict:
    todo = pending(stage, lot, out)
    todo = todo[:limit] if limit else todo
    counts = {"feitos": 0, "falhas": 0, "pendentes": len(todo)}
    for n, row in enumerate(todo, 1):
        pid, started, work = row["product_id"], clock(), out / "work" / row["product_id"]
        try:
            (shape_one if stage == "shape" else paint_one)(row, out, backend, fetch, cutter)
            seconds = round(clock() - started, 1)
            (work / f"{stage}_segundos.txt").write_text(str(seconds))
            if stage == "paint":
                append(out / "manifesto.csv", MANIFEST, manifest_row(row, work, seconds, generator))
            counts["feitos"] += 1
            print(f"[{stage} {n}/{len(todo)}] {pid} ok em {seconds}s", flush=True)
        except Exception as exc:   # noqa: BLE001 - um produto com problema não para o lote
            message = " ".join(f"{type(exc).__name__}: {exc}".split())[:200]
            append(out / "falhas.csv", ["product_id", "etapa", "erro"], {"product_id": pid, "etapa": stage,
                                                                         "erro": message})
            counts["falhas"] += 1
            print(f"[{stage} {n}/{len(todo)}] {pid} FALHOU {message}", flush=True)
    return counts


def _real_backend(args):
    from hunyuan_glb_backends import Paint20, Paint21, ShapeMV
    root = Path(args.root)
    if args.stage == "shape":
        return ShapeMV(root / REPO_DIRS["shape"], seed=args.seed, turbo=args.shape_turbo)
    if args.paint == "2.0":
        return Paint20(root / REPO_DIRS["2.0"], seed=args.seed, offload=args.paint_offload)
    return Paint21(root / REPO_DIRS["2.1"], seed=args.seed)


def _real_cutter(weights: Path):
    from hunyuan_glb_cutout import GarmentCutout
    return GarmentCutout(weights)


def main(argv=None, make_backend=_real_backend, make_cutter=_real_cutter) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--stage", choices=["shape", "paint"], required=True, help="uma etapa por processo")
    parser.add_argument("--lot", type=Path, required=True, help="lote.csv do export_glb_batch.py")
    parser.add_argument("--out", type=Path, required=True, help="pasta local da GPU")
    parser.add_argument("--root", type=Path, default=Path("/workspace"), help="pasta com Hunyuan3D-2 e Hunyuan3D-2.1")
    parser.add_argument("--paint", choices=["2.0", "2.1"], default="2.1", help="textura: 2.1 PBR (≥24 GB) ou 2.0 (T4)")
    parser.add_argument("--shape-turbo", action="store_true", help="forma em 5 passos + FlashVDM (mais rápida)")
    parser.add_argument("--paint-offload", action="store_true", help="2.0 com os modelos na CPU entre chamadas")
    parser.add_argument("--fashn-weights", type=Path, help="pesos do recorte (fashn_open.py download --only parser,birefnet)")
    parser.add_argument("--limit", type=int, help="processa só os N primeiros pendentes (piloto)")
    parser.add_argument("--seed", type=int, default=1234)
    args = parser.parse_args(argv)
    lot = read_lot(args.lot)
    args.out.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    backend = make_backend(args)
    needs_cut = args.stage == "shape" and any(r.get("fonte") == "FOTO" for r in pending("shape", lot, args.out))
    cutter = make_cutter(args.fashn_weights) if needs_cut and args.fashn_weights else None
    print(f"{args.stage}: modelos carregados em {round(time.monotonic() - started)}s; lote: {len(lot)}"
          + ("" if cutter or not needs_cut else " · AVISO: há fonte FOTO e falta --fashn-weights"), flush=True)
    counts = run(args.stage, lot, args.out, backend, limit=args.limit, cutter=cutter,
                 generator=generator_name(args.paint))
    peak = backend.peak_memory_gb() if hasattr(backend, "peak_memory_gb") else "?"
    print(f"{args.stage}: fim em {round(time.monotonic() - started)}s · {counts} · pico da GPU {peak} GB", flush=True)
    return 1 if counts["falhas"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
