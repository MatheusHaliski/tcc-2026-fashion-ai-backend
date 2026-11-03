"""Base do lote de peça inteira local (process_local_sd.py): constantes, o erro por foto (`PhotoSkip`), o evento JSON
do log e o dispositivo/memória do acelerador."""
from __future__ import annotations

import gc
import json
import logging
import re
import sys
from typing import Optional

LOG = logging.getLogger("fashionai.sd")
VERSION = "LOCAL_SD_GHOST_V1"
DEFAULT_MODEL = "stable-diffusion-v1-5/stable-diffusion-inpainting"
SDXL_MODEL = "diffusers/stable-diffusion-xl-1.0-inpainting-0.1"
CONTROLNET_MODEL = "lllyasviel/control_v11p_sd15_inpaint"
PROMPT = ("professional studio product photo, ghost mannequin effect, 3d hollow form, smooth fabric, "
          "clean white background, soft drop shadow, high catalog quality")
NEGATIVE = ("person, human, model, mannequin head, face, skin, hands, arms, legs, hair, text, watermark, logo, "
            "blurry, deformed, extra garment, duplicate")
MIN_SIDE = 300                      # foto original menor que 300×300 é descartada
MAX_BYTES = 15 * 1024 * 1024
UA = "FashionAI-CatalogBot/1.0 (+https://fashionai.app/catalog-bot)"
BACKGROUND = (255, 255, 255)
IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
IMAGE_EXT = (".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif")


class PhotoSkip(Exception):
    """Foto que não gera packshot: `status` (REJECTED, REVIEW, INELIGIBLE, RETRY) e motivo curto em maiúsculas."""

    def __init__(self, reason: str, status: str = "REVIEW", metrics: Optional[dict] = None):
        super().__init__(reason)
        self.status, self.metrics = status, metrics or {}


def emit(event: str, **values):
    LOG.info(json.dumps({"event": event, **values}, ensure_ascii=False, default=str))


# ───────────────────────── dispositivo e memória

def pick_device(torch_module=None, wanted: str = "auto") -> str:
    """CUDA → MPS (Apple Silicon) → CPU; `wanted` força um deles."""
    if wanted and wanted != "auto":
        return wanted
    torch = torch_module or __import__("torch")
    if torch.cuda.is_available():
        return "cuda"
    mps = getattr(torch.backends, "mps", None)
    if mps is not None and mps.is_available():
        return "mps"
    return "cpu"


def free_memory(device: str, torch_module=None):
    """Depois de cada foto: coletor + cache do acelerador (uma foto grande não deixa o lote sem memória)."""
    gc.collect()
    torch = torch_module or sys.modules.get("torch")
    if torch is None:
        return
    if device == "cuda":
        torch.cuda.empty_cache()
    elif device == "mps" and hasattr(torch, "mps"):
        torch.mps.empty_cache()
