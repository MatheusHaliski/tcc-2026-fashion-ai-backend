"""Stage 2 — generative reconstruction with Qwen-Image-Edit (open weights, Apache-2.0) on our own GPU.

The segmented cut-out (only real pixels) is picture 1; the original photo is picture 2, used only as a reference for
hidden details. The model returns a front-facing catalogue photo on white. It is an AI reconstruction: it is marked as
such, compared automatically against the original and kept as `pending` until a person approves it."""
from __future__ import annotations

import math

from PIL import Image

from services.garment_gpu.image_ops import fit_within

NOUNS = {
    "upper_piece": "top garment",
    "lower_piece": "bottom garment",
    "shoes_piece": "pair of shoes",
    "accessory_piece": "fashion accessory",
    "auto": "garment",
}
GUARD = ("Preserve the existing colors, patterns, trims, collar, logos, crests, printed text, stitching, fabric "
         "texture and proportions exactly. Do not invent additional brand markings, text or decorations.")
NEGATIVE = ("person, human, body, skin, arms, hands, face, neck, mannequin, hanger, extra logos, invented text, "
            "watermark, deformed, blurry, low quality, cluttered background, shadows on background")


def _clean_hint(value: str | None, limit: int = 80) -> str:
    if not value:
        return ""
    return " ".join("".join(ch for ch in value if ch.isprintable()).split())[:limit]


def build_prompt(category: str, name: str | None = None, color: str | None = None, custom: str | None = None) -> str:
    """Catalogue prompt for picture 1 (cut-out) + picture 2 (original). A client prompt replaces the description but
    never the guard sentence: brand marks must not be invented."""
    if custom:
        return f"{_clean_hint(custom, 2000)} {GUARD}"
    subject = _clean_hint(name) or NOUNS.get(category, "garment")
    tint = _clean_hint(color)
    color_clause = f" in its original {tint} color" if tint else ""
    return (
        f"Create a professional e-commerce product photograph of the {subject}{color_clause} shown in picture 1. "
        "Use picture 2 only as a reference for parts of the garment that are hidden or cut off in picture 1. "
        "Show it as a flat lay: the garment alone, laid flat and stretched smooth on a surface, seen from directly "
        "above, centered, symmetric, front side up, sleeves and legs extended naturally, on a pure white seamless "
        "background with soft even lighting. There is no body inside it: no person, body part, mannequin, hanger, "
        "ghost-mannequin hollow or wrinkles from being worn. "
        f"{GUARD} Reconstruct missing fabric naturally and symmetrically, consistent with the visible parts."
    )


BACK_VIEW_CATEGORIES = {"upper_piece", "lower_piece", "auto"}


def build_back_prompt(category: str, name: str | None = None, color: str | None = None) -> str:
    """Back of the same garment, for the avatar's back panel (Phase 3). Picture 1 is the front flat lay already
    generated; picture 2 is the original photo. Front-only details must not migrate to the back."""
    subject = _clean_hint(name) or NOUNS.get(category, "garment")
    tint = _clean_hint(color)
    color_clause = f" in its original {tint} color" if tint else ""
    return (
        f"Picture 1 is the front of a {subject}{color_clause} laid flat. Create the BACK of exactly the same garment "
        "as a flat lay product photograph: same fabric, color, size, proportions, silhouette, trims and seams, laid "
        "flat and stretched smooth on a surface, seen from directly above, back side up, centered, on a pure white "
        "seamless background. Use picture 2 only for details of the back that are visible in it. Do not copy front "
        "logos, prints, buttons, plackets or pockets to the back, and do not invent brand markings or text. There is "
        "no body inside it: no person, body part, mannequin, hanger or ghost-mannequin hollow."
    )


class ReconstructionEngine:
    def __init__(self, settings, pipeline=None, torch_module=None):
        self.settings = settings
        if pipeline is not None:
            self.pipeline, self.torch = pipeline, torch_module
            self.models = {"reconstruction": settings.recon_model}
            return
        import torch
        from diffusers import QwenImageEditPlusPipeline

        if settings.device == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("Reconstrução precisa de GPU CUDA NVIDIA (Qwen-Image-Edit não é viável em CPU).")
        self.torch = torch
        dtype = torch.bfloat16 if settings.device == "cuda" else torch.float32
        quantized = quantization_kwargs(settings, torch)
        pipe = QwenImageEditPlusPipeline.from_pretrained(settings.recon_model, torch_dtype=dtype, **quantized)
        self.models = {"reconstruction": settings.recon_model, **({"quantization": "nf4"} if quantized else {})}
        if settings.recon_lora_path:
            # local file, or a Hub repo + file (e.g. lightx2v/Qwen-Image-Edit-2511-Lightning, 8 steps, true_cfg 1.0)
            extra = {"weight_name": settings.recon_lora_weight_name} if settings.recon_lora_weight_name else {}
            pipe.load_lora_weights(settings.recon_lora_path, adapter_name="fai_garment", **extra)
            pipe.set_adapters(["fai_garment"], adapter_weights=[settings.recon_lora_scale])
            self.models["lora"] = settings.recon_lora_path
            self.models["lora_layers"] = require_lora_layers(pipe.transformer, settings.recon_lora_path)
            if is_lightning(settings.recon_lora_path):
                use_lightning_scheduler(pipe)
                self.models["scheduler"] = "lightning"
        if settings.recon_offload == "model":
            # one component on the GPU at a time: text encoder, then transformer, then VAE. With nf4 this is what
            # lets Phase 2 share the 24 GB L4 with Phase 1 (all 4-bit weights at once leave no room to generate).
            pipe.enable_model_cpu_offload()
        elif quantized:
            pass  # 4-bit weights are already placed on the GPU by device_map
        elif settings.recon_offload == "sequential":
            pipe.enable_sequential_cpu_offload()
        else:
            pipe.to(settings.device)
        if settings.recon_offload == "sequential":
            enable_vae_tiling(pipe)   # with model offload the VAE runs alone on the GPU and needs no tiling
        pipe.set_progress_bar_config(disable=True)
        self.pipeline = pipe

    def generator(self, seed: int):
        if self.torch is None:
            return seed
        device = "cpu" if self.settings.recon_offload != "none" else self.settings.device
        return self.torch.Generator(device=device).manual_seed(int(seed))

    def generate(self, references: list[Image.Image], prompt: str, seed: int, size: tuple[int, int]) -> Image.Image:
        images = [fit_within(r.convert("RGB"), self.settings.recon_max_side) for r in references]
        width, height = size
        call = dict(image=images, prompt=prompt, negative_prompt=NEGATIVE, width=width, height=height,
                    num_inference_steps=self.settings.recon_steps, true_cfg_scale=self.settings.recon_true_cfg,
                    generator=self.generator(seed), num_images_per_prompt=1)
        if self.torch is not None:
            with self.torch.inference_mode():
                result = self.pipeline(**call)
        else:
            result = self.pipeline(**call)
        return result.images[0].convert("RGB")


def quantization_kwargs(settings, torch) -> dict:
    """RECON_QUANTIZE=nf4: transformer (~20B) and text encoder in 4-bit NF4 (bitsandbytes), ~40 GB → ~16 GB of VRAM.
    Lets Phase 2 run on a 24 GB L4 next to the Phase 1 worker when no A100 quota is available; a little quality
    and speed are traded for it, so the pilot must confirm the result."""
    if settings.recon_quantize != "nf4":
        return {}
    from diffusers.quantizers import PipelineQuantizationConfig

    config = PipelineQuantizationConfig(
        quant_backend="bitsandbytes_4bit",
        quant_kwargs={"load_in_4bit": True, "bnb_4bit_quant_type": "nf4", "bnb_4bit_compute_dtype": torch.bfloat16},
        components_to_quantize=["transformer", "text_encoder"])
    if settings.recon_offload == "model":
        return {"quantization_config": config}  # placement left to enable_model_cpu_offload
    return {"quantization_config": config, "device_map": "cuda"}


# Scheduler the Lightning LoRAs were distilled with (lightx2v/Qwen-Image-Lightning README): shift 3 and no
# shift_terminal. The stock Qwen scheduler (shift_terminal 0.02) leaves visible noise after 8 steps.
LIGHTNING_SCHEDULER = {
    "base_image_seq_len": 256, "base_shift": math.log(3), "invert_sigmas": False, "max_image_seq_len": 8192,
    "max_shift": math.log(3), "num_train_timesteps": 1000, "shift": 1.0, "shift_terminal": None,
    "stochastic_sampling": False, "time_shift_type": "exponential", "use_beta_sigmas": False,
    "use_dynamic_shifting": True, "use_exponential_sigmas": False, "use_karras_sigmas": False,
}


def is_lightning(lora_path: str) -> bool:
    return "lightning" in (lora_path or "").lower()


def use_lightning_scheduler(pipe) -> None:
    from diffusers import FlowMatchEulerDiscreteScheduler

    pipe.scheduler = FlowMatchEulerDiscreteScheduler.from_config(LIGHTNING_SCHEDULER)


def require_lora_layers(transformer, lora_path: str) -> int:
    """A LoRA whose keys do not match the transformer loads with only a warning and changes nothing; with a
    Lightning LoRA that means 8 steps of an undistilled model, i.e. noise. Refuse to start instead."""
    layers = sum(1 for module in transformer.modules() if hasattr(module, "lora_A"))
    if layers == 0:
        raise RuntimeError(f"LoRA {lora_path} não foi aplicado a nenhuma camada do transformer")
    return layers


def enable_vae_tiling(pipe) -> None:
    """Encodes/decodes the image in tiles: avoids the VAE memory peak on GPUs with little free VRAM."""
    vae = getattr(pipe, "vae", None)
    if vae is not None and hasattr(vae, "enable_tiling"):
        vae.enable_tiling()


def output_size(settings, canvas=(1024, 1536)) -> tuple[int, int]:
    """Generation size with the catalogue aspect (2:3), longest side RECON_MAX_SIDE, multiples of 16."""
    scale = settings.recon_max_side / max(canvas)
    return max(16, int(canvas[0] * scale) // 16 * 16), max(16, int(canvas[1] * scale) // 16 * 16)


def to_canvas(image: Image.Image, size=(1024, 1536), transparent: bool = False) -> Image.Image:
    """Fits the generated image into the catalogue canvas without distortion (white padding)."""
    scale = min(size[0] / image.width, size[1] / image.height)
    resized = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))),
                           Image.Resampling.LANCZOS)
    mode, fill = ("RGBA", (0, 0, 0, 0)) if transparent else ("RGB", (255, 255, 255))
    canvas = Image.new(mode, size, fill)
    canvas.paste(resized, ((size[0] - resized.width) // 2, (size[1] - resized.height) // 2),
                 resized if resized.mode == "RGBA" else None)
    return canvas
