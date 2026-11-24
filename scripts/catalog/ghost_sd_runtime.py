"""Funções de dispositivo, memória, logging e preparação de controle."""

import gc
import json
import logging
import sys

import numpy as np
from PIL import Image

LOG = logging.getLogger("fashionai.sd")


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


def make_inpaint_condition(image: Image.Image, mask: Image.Image):
    """Imagem de controle do ControlNet inpaint: pixels mascarados = -1 (convenção do control_v11p_sd15_inpaint)."""
    import torch
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32) / 255.0
    masked = np.asarray(mask.convert("L")) > 127
    rgb[masked] = -1.0
    return torch.from_numpy(rgb).permute(2, 0, 1)[None]
