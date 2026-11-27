"""Roda na GPU do lote (pod da RunPod ou VM da GCP): as pipelines oficiais, cada etapa no seu processo (a VRAM não soma).

- ``ShapeMV``: forma com o Hunyuan3D-2mv (repositório Hunyuan3D-2, pacote ``hy3dgen``), condicionada pela frente e, se
  houver, pelas costas do flat lay. README oficial: 6 GB de VRAM. ``turbo``: 5 passos + FlashVDM (T4).
- ``Paint20``: textura (cor) com o Hunyuan3D-2 Paint turbo (``hy3dgen.texgen``); cabe na T4 de 16 GB.
- ``Paint21``: textura PBR com o Hunyuan3D 2.1 (``hy3dpaint``). README oficial: 21 GB de VRAM (A40/A100/L40S, não T4).

As duas texturas condicionam só pela primeira imagem (a frente). Commits fixados em hunyuan_glb_setup_runpod.sh e
scripts/cloud/hunyuan_t4_vm.py.
"""
from __future__ import annotations

import sys
from pathlib import Path

SHAPE_MODEL = ("tencent/Hunyuan3D-2mv", "hunyuan3d-dit-v2-mv")
SHAPE_TURBO = ("tencent/Hunyuan3D-2mv", "hunyuan3d-dit-v2-mv-turbo")
PAINT20_MODEL = "tencent/Hunyuan3D-2"
VIEW_KEYS = {"front": "front", "back": "back"}   # vista do flat lay → chave do 2mv (câmera atrás = foto das costas)


def cutout(image_path: Path, remover):
    """RGBA com fundo removido; imagem sem nenhum pixel transparente passa pelo removedor de fundo."""
    from PIL import Image
    image = Image.open(image_path).convert("RGBA")
    if image.getchannel("A").getextrema()[0] == 255:
        image = remover(image.convert("RGB"))
    return image


class ShapeMV:
    def __init__(self, repo: Path, seed: int = 1234, steps: int = 50, turbo: bool = False):
        sys.path.insert(0, str(repo))
        import torch
        from hy3dgen.rembg import BackgroundRemover
        from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
        model, subfolder = SHAPE_TURBO if turbo else SHAPE_MODEL
        self.torch, self.seed, self.steps = torch, seed, 5 if turbo else steps
        self.remover = BackgroundRemover()
        self.pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(model, subfolder=subfolder, variant="fp16")
        if turbo:
            self.pipeline.enable_flashvdm(topk_mode="merge")

    def generate(self, views: dict[str, Path], work: Path) -> Path:
        """``views``: {"front": png, "back": png?} → ``work/white.obj`` (+ as vistas recortadas, para a revisão)."""
        work.mkdir(parents=True, exist_ok=True)
        images = {}
        for name, path in views.items():
            images[VIEW_KEYS[name]] = cutout(path, self.remover)
            images[VIEW_KEYS[name]].save(work / f"{name}_rgba.png")
        mesh = self.pipeline(image=images, num_inference_steps=self.steps, octree_resolution=380, num_chunks=20000,
                             generator=self.torch.manual_seed(self.seed), output_type="trimesh")[0]
        mesh.export(work / "white.obj")
        self.torch.cuda.empty_cache()
        return work / "white.obj"

    def peak_memory_gb(self) -> float:
        return round(self.torch.cuda.max_memory_allocated() / 1e9, 1)


class Paint20:
    def __init__(self, repo: Path, seed: int = 1234, offload: bool = False):
        sys.path.insert(0, str(repo))
        import torch
        import trimesh
        from hy3dgen.texgen import Hunyuan3DPaintPipeline
        self.torch, self.trimesh = torch, trimesh
        self.pipeline = Hunyuan3DPaintPipeline.from_pretrained(PAINT20_MODEL)
        if offload:   # VRAM curta: modelos na CPU entre as chamadas (mais lento)
            self.pipeline.enable_model_cpu_offload()

    def generate(self, work: Path) -> Path:
        """``work/white.obj`` + ``work/front_rgba.png`` → ``work/textured.glb``."""
        mesh = self.trimesh.load(work / "white.obj", force="mesh")
        textured = self.pipeline(mesh, image=str(work / "front_rgba.png"))
        textured.export(work / "textured.glb")
        self.torch.cuda.empty_cache()
        return work / "textured.glb"

    def peak_memory_gb(self) -> float:
        return round(self.torch.cuda.max_memory_allocated() / 1e9, 1)


class Paint21:
    def __init__(self, repo: Path, seed: int = 1234):
        sys.path[:0] = [str(repo / "hy3dpaint"), str(repo)]
        import torch
        from textureGenPipeline import Hunyuan3DPaintConfig, Hunyuan3DPaintPipeline
        try:
            from torchvision_fix import apply_fix
            apply_fix()
        except ImportError:
            pass
        self.torch = torch
        conf = Hunyuan3DPaintConfig(6, 512)
        conf.realesrgan_ckpt_path = str(repo / "hy3dpaint/ckpt/RealESRGAN_x4plus.pth")
        conf.multiview_cfg_path = str(repo / "hy3dpaint/cfgs/hunyuan-paint-pbr.yaml")
        conf.custom_pipeline = str(repo / "hy3dpaint/hunyuanpaintpbr")
        self.pipeline = Hunyuan3DPaintPipeline(conf)

    def generate(self, work: Path) -> Path:
        """``work/white.obj`` + ``work/front_rgba.png`` → ``work/textured.glb``."""
        self.pipeline(mesh_path=str(work / "white.obj"), image_path=str(work / "front_rgba.png"),
                      output_mesh_path=str(work / "textured.obj"))
        self.torch.cuda.empty_cache()
        return work / "textured.glb"

    def peak_memory_gb(self) -> float:
        return round(self.torch.cuda.max_memory_allocated() / 1e9, 1)
