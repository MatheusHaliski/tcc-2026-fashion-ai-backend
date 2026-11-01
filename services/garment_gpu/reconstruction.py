"""Stage 2 — generative reconstruction with Qwen-Image-Edit (open weights, Apache-2.0) on our own GPU.

The segmented cut-out (only real pixels) is picture 1; the original photo is picture 2, used only as a reference for
hidden details. The model returns a front-facing catalogue photo on white. It is an AI reconstruction: it is marked as
such, compared automatically against the original and kept as `pending` until a person approves it."""
from __future__ import annotations

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
        pipe = QwenImageEditPlusPipeline.from_pretrained(settings.recon_model, torch_dtype=dtype)
        self.models = {"reconstruction": settings.recon_model}
        if settings.recon_lora_path:
            pipe.load_lora_weights(settings.recon_lora_path, adapter_name="fai_garment")
            pipe.set_adapters(["fai_garment"], adapter_weights=[settings.recon_lora_scale])
            self.models["lora"] = settings.recon_lora_path
        if settings.recon_offload == "model":
            pipe.enable_model_cpu_offload()
        elif settings.recon_offload == "sequential":
            pipe.enable_sequential_cpu_offload()
        else:
            pipe.to(settings.device)
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
