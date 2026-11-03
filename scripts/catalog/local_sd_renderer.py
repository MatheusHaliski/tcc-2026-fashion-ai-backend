"""Stable Diffusion Inpainting local do lote (opcional ControlNet inpaint): o recorte enviado ao modelo e o renderizador."""
from __future__ import annotations

from typing import Optional

import numpy as np
from PIL import Image

from local_sd_base import CONTROLNET_MODEL, DEFAULT_MODEL, NEGATIVE, PROMPT, emit, free_memory, pick_device

# ───────────────────────── Stable Diffusion local

def sd_inputs(source: Image.Image, target: np.ndarray, ghost: np.ndarray, max_side: int,
              extra_mask: Optional[np.ndarray] = None) -> tuple[Image.Image, Image.Image, tuple[int, int, int, int]]:
    """Recorte da peça com margem (a IA trabalha na melhor resolução possível), lados múltiplos de 8 e até `max_side`.
    Devolve (imagem, máscara de inpainting, caixa do recorte na foto de análise). `extra_mask` (corpo e outras peças)
    também entra na máscara, sem alargar o recorte: o preenchimento não pode copiar pele que ficou fora da região fantasma."""
    region = target | ghost
    ys, xs = np.where(region)
    pad = int(0.08 * max(xs.max() - xs.min(), ys.max() - ys.min())) + 8
    box = (max(0, int(xs.min()) - pad), max(0, int(ys.min()) - pad),
           min(source.width, int(xs.max()) + 1 + pad), min(source.height, int(ys.max()) + 1 + pad))
    crop = source.crop(box)
    hole = ghost if extra_mask is None else (ghost | np.asarray(extra_mask, dtype=bool))
    mask = Image.fromarray((hole * 255).astype(np.uint8)).crop(box)
    scale = min(1.0, max_side / max(crop.size))
    tw = max(8, int(round(crop.width * scale / 8)) * 8)
    th = max(8, int(round(crop.height * scale / 8)) * 8)
    return (crop.resize((tw, th), Image.Resampling.LANCZOS), mask.resize((tw, th), Image.Resampling.NEAREST), box)


def make_inpaint_condition(image: Image.Image, mask: Image.Image):
    """Imagem de controle do ControlNet inpaint: pixels mascarados = -1 (convenção do control_v11p_sd15_inpaint)."""
    import torch
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32) / 255.0
    masked = np.asarray(mask.convert("L")) > 127
    rgb[masked] = -1.0
    return torch.from_numpy(rgb).permute(2, 0, 1)[None]


class SdGhostRenderer:
    """Stable Diffusion Inpainting local (opcional ControlNet inpaint). Carrega sob demanda; CUDA em fp16, MPS/CPU em fp32."""

    def __init__(self, model: str = DEFAULT_MODEL, device: str = "auto", controlnet: bool = False, steps: int = 30,
                 guidance: float = 7.5, seed: Optional[int] = None, max_side: Optional[int] = None, offload: bool = False,
                 prompt: str = PROMPT, negative: str = NEGATIVE):
        self.model, self.wanted, self.controlnet = model, device, controlnet
        self.steps, self.guidance, self.seed, self.offload = steps, guidance, seed, offload
        self.prompt, self.negative = prompt, negative
        self.xl = "xl" in model.lower()
        self.max_side = max_side or (1024 if self.xl else 512)
        self.pipe = None
        self.device = "cpu"

    def load(self):
        if self.pipe is not None:
            return
        import torch
        self.device = pick_device(torch, self.wanted)
        dtype = torch.float16 if self.device == "cuda" else torch.float32
        kwargs = {"torch_dtype": dtype}
        if not self.xl:
            kwargs.update(safety_checker=None, requires_safety_checker=False)
        if self.controlnet:
            if self.xl:
                raise SystemExit("--controlnet só com modelo SD 1.5 (control_v11p_sd15_inpaint)")
            from diffusers import ControlNetModel, StableDiffusionControlNetInpaintPipeline
            cn = ControlNetModel.from_pretrained(CONTROLNET_MODEL, torch_dtype=dtype)
            self.pipe = self._load(StableDiffusionControlNetInpaintPipeline, controlnet=cn, **kwargs)
        else:
            from diffusers import AutoPipelineForInpainting
            self.pipe = self._load(AutoPipelineForInpainting, **kwargs)
        self.pipe.set_progress_bar_config(disable=True)
        if self.device == "cuda" and self.offload:
            self.pipe.enable_model_cpu_offload()          # GPU pequena: cada bloco vai à GPU só na hora de usar
        else:
            self.pipe.to(self.device)
        self.pipe.enable_attention_slicing()
        if hasattr(self.pipe, "enable_vae_slicing"):
            self.pipe.enable_vae_slicing()
        emit("model_loaded", model=self.model, device=self.device, dtype=str(dtype), controlnet=self.controlnet)

    def _load(self, cls, **kwargs):
        try:
            return cls.from_pretrained(self.model, variant="fp16", use_safetensors=True, **kwargs)   # pesos menores
        except (OSError, ValueError, EnvironmentError):
            return cls.from_pretrained(self.model, **kwargs)

    def render(self, init: Image.Image, mask: Image.Image) -> Image.Image:
        import torch
        self.load()
        generator = None
        if self.seed is not None:
            generator = torch.Generator("cpu" if self.device == "mps" else self.device).manual_seed(self.seed)
        kwargs = dict(prompt=self.prompt, negative_prompt=self.negative, image=init, mask_image=mask, width=init.width,
                      height=init.height, num_inference_steps=self.steps, guidance_scale=self.guidance, generator=generator)
        if self.controlnet:
            kwargs["control_image"] = make_inpaint_condition(init, mask)
        if self.xl:
            kwargs["strength"] = 0.99                         # recomendação do modelo SDXL inpainting 0.1
        with torch.inference_mode():
            return self.pipe(**kwargs).images[0].convert("RGB")

    def free(self):
        free_memory(self.device)
