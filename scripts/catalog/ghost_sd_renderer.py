"""Estratégia de preenchimento com Stable Diffusion."""

from typing import Optional

from PIL import Image

from ghost_sd_defaults import CONTROLNET_MODEL, DEFAULT_MODEL, NEGATIVE, PROMPT
from ghost_sd_runtime import emit, free_memory, make_inpaint_condition, pick_device


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
