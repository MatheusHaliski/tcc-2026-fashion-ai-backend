"""Roda NO POD: as duas pipelines oficiais do lote, cada uma carregada no seu próprio processo (a VRAM não soma).

- ``ShapeMV``: forma com o Hunyuan3D-2mv (repositório Hunyuan3D-2, pacote ``hy3dgen``), condicionada pela frente e, se
  houver, pelas costas do flat lay aprovado. README oficial: 6 GB de VRAM.
- ``Paint21``: textura PBR com o Hunyuan3D 2.1 (``hy3dpaint``), que condiciona só pela primeira imagem (a frente).
  README oficial: 21 GB de VRAM.

Os commits de cada repositório ficam fixados no runpod_setup_hunyuan.sh.
"""
from __future__ import annotations

import sys
from pathlib import Path

SHAPE_MODEL = ("tencent/Hunyuan3D-2mv", "hunyuan3d-dit-v2-mv")
VIEW_KEYS = {"front": "front", "back": "back"}   # vista do flat lay → chave do 2mv (câmera atrás = foto das costas)


def cutout(image_path: Path, remover):
    """RGBA com fundo removido; imagem sem nenhum pixel transparente passa pelo removedor de fundo."""
    from PIL import Image
    image = Image.open(image_path).convert("RGBA")
    if image.getchannel("A").getextrema()[0] == 255:
        image = remover(image.convert("RGB"))
    return image


class ShapeMV:
    def __init__(self, repo: Path, seed: int = 1234, steps: int = 50):
        sys.path.insert(0, str(repo))
        import torch
        from hy3dgen.rembg import BackgroundRemover
        from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
        self.torch, self.seed, self.steps = torch, seed, steps
        self.remover = BackgroundRemover()
        self.pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
            SHAPE_MODEL[0], subfolder=SHAPE_MODEL[1], variant="fp16")

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


class Paint21:
    def __init__(self, repo: Path, seed: int = 1234, steps: int = 50):
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
