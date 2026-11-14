#!/usr/bin/env python3
"""Roda NO POD da RunPod: gera um .glb por produto do lote com o Hunyuan3D 2.1 (forma + textura PBR).

Entrada: ``lote.csv`` do export_glb_batch.py (product_id, front_url, back_url…). Baixa as vistas do flat lay aprovado
(URLs públicas /media/), tira o fundo da frente e gera. O Hunyuan3D 2.1 oficial (commit fixado no
runpod_setup_hunyuan.sh) condiciona forma e textura só pela primeira imagem: a costas é baixada para a revisão, não
entra na geração.

Saída, só no volume do pod (nada vai ao bucket nem ao banco): ``glb/<product_id>.glb``, ``manifesto.csv``
(product_id, glb, generator, segundos, vistas) — o formato que o import_meshy_glbs.py lê com a ligação "ID" —,
``falhas.csv`` e ``img/``. Retomável: o que já está no manifesto é pulado.

    cd /workspace/Hunyuan3D-2.1 && python /workspace/runner/runpod_hunyuan_runner.py \
        --lot /workspace/lote.csv --out /workspace/glb-hunyuan
"""
from __future__ import annotations

import argparse
import csv
import io
import shutil
import sys
import time
import urllib.request
from pathlib import Path

GENERATOR = "hunyuan3d-2.1"
MANIFEST = ["product_id", "glb", "generator", "segundos", "vistas"]
MAX_IMAGE_BYTES = 25_000_000


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


class HunyuanBackend:
    """As duas pipelines oficiais, carregadas uma vez. Precisa rodar com o cwd na raiz do repositório Hunyuan3D-2.1."""

    def __init__(self, repo: Path, seed: int = 1234, steps: int = 50):
        sys.path[:0] = [str(repo / "hy3dshape"), str(repo / "hy3dpaint"), str(repo)]
        import torch
        from hy3dshape.pipelines import Hunyuan3DDiTFlowMatchingPipeline
        from hy3dshape.rembg import BackgroundRemover
        from textureGenPipeline import Hunyuan3DPaintConfig, Hunyuan3DPaintPipeline
        try:
            from torchvision_fix import apply_fix
            apply_fix()
        except ImportError:
            pass
        self.torch, self.seed, self.steps = torch, seed, steps
        self.shape = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained("tencent/Hunyuan3D-2.1")
        self.rembg = BackgroundRemover()
        conf = Hunyuan3DPaintConfig(6, 512)
        conf.realesrgan_ckpt_path = str(repo / "hy3dpaint/ckpt/RealESRGAN_x4plus.pth")
        conf.multiview_cfg_path = str(repo / "hy3dpaint/cfgs/hunyuan-paint-pbr.yaml")
        conf.custom_pipeline = str(repo / "hy3dpaint/hunyuanpaintpbr")
        self.paint = Hunyuan3DPaintPipeline(conf)

    def cutout(self, path: Path):
        from PIL import Image
        image = Image.open(path).convert("RGBA")
        if image.getchannel("A").getextrema()[0] == 255:   # sem transparência nenhuma: tira o fundo
            image = self.rembg(image.convert("RGB"))
        return image

    def generate(self, front: Path, back: Path | None, work: Path) -> Path:
        work.mkdir(parents=True, exist_ok=True)
        image = self.cutout(front)
        image.save(work / "front_rgba.png")
        generator = self.torch.Generator(device="cuda").manual_seed(self.seed)
        mesh = self.shape(image=image, num_inference_steps=self.steps, generator=generator)[0]
        mesh.export(work / "white.obj")
        self.paint(mesh_path=str(work / "white.obj"), image_path=str(work / "front_rgba.png"),
                   output_mesh_path=str(work / "textured.obj"))
        self.torch.cuda.empty_cache()
        return work / "textured.glb"

    def peak_memory_gb(self) -> float:
        return round(self.torch.cuda.max_memory_allocated() / 1e9, 1)


def run(lot: list[dict], out: Path, backend, fetch=download, clock=time.monotonic, limit: int | None = None) -> dict:
    skip, counts = done_ids(out), {"gerados": 0, "pulados": 0, "falhas": 0}
    todo = [r for r in lot if r["product_id"] not in skip]
    counts["pulados"] = len(lot) - len(todo)
    for n, row in enumerate(todo[:limit] if limit else todo, 1):
        pid, started = row["product_id"], clock()
        try:
            front = fetch(row["front_url"], out / "img" / f"{pid}-front")
            back = fetch(row["back_url"], out / "img" / f"{pid}-back") if row.get("back_url") else None
            glb = backend.generate(front, back, out / "work" / pid)
            if not glb.is_file() or glb.stat().st_size == 0:
                raise RuntimeError("GLB_NAO_GERADO")
            (out / "glb").mkdir(parents=True, exist_ok=True)
            shutil.copyfile(glb, out / "glb" / f"{pid}.glb")
            seconds = round(clock() - started, 1)
            append(out / "manifesto.csv", MANIFEST, {"product_id": pid, "glb": f"glb/{pid}.glb", "generator": GENERATOR,
                                                     "segundos": seconds, "vistas": "frente"})
            counts["gerados"] += 1
            print(f"[{n}/{len(todo)}] {pid} ok em {seconds}s", flush=True)
        except Exception as exc:   # noqa: BLE001 - um produto com problema não para o lote
            message = " ".join(f"{type(exc).__name__}: {exc}".split())[:200]
            append(out / "falhas.csv", ["product_id", "erro"], {"product_id": pid, "erro": message})
            counts["falhas"] += 1
            print(f"[{n}/{len(todo)}] {pid} FALHOU {message}", flush=True)
    return counts


def main(argv=None, make_backend=HunyuanBackend) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--lot", type=Path, required=True, help="lote.csv do export_glb_batch.py")
    parser.add_argument("--out", type=Path, required=True, help="pasta no volume do pod")
    parser.add_argument("--repo", type=Path, default=Path.cwd(), help="raiz do Hunyuan3D-2.1 (padrão: pasta atual)")
    parser.add_argument("--limit", type=int, help="gera só os N primeiros pendentes (piloto)")
    parser.add_argument("--seed", type=int, default=1234)
    args = parser.parse_args(argv)
    lot = read_lot(args.lot)
    args.out.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    backend = make_backend(args.repo, seed=args.seed)
    print(f"modelos carregados em {round(time.monotonic() - started)}s; lote: {len(lot)} produtos", flush=True)
    counts = run(lot, args.out, backend, limit=args.limit)
    peak = backend.peak_memory_gb() if hasattr(backend, "peak_memory_gb") else "?"
    print(f"fim em {round(time.monotonic() - started)}s · {counts} · pico de memória da GPU {peak} GB", flush=True)
    return 1 if counts["falhas"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
