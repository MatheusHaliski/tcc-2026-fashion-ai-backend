"""Modelos do engine fashn-open, carregados sob demanda depois da conferência dos pesos: BiRefNet (alfa), LaMa
(preenchimento) e o provedor parser + BiRefNet usado pelo process_local_sd."""
from __future__ import annotations

import importlib
import importlib.util
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Optional

import numpy as np
from PIL import Image

from fashn_open_fusion import Fusion, fuse
from fashn_open_labels import garment_label_ids
from fashn_open_weights import verify_component

PACKAGE = "fashn_open_birefnet"            # nome do pacote sob o qual o código do BiRefNet é importado
BIREFNET_SIDE = 1024
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


# ───────────────────────── modelos

def _device(torch_module, wanted: str = "auto") -> str:
    if wanted != "auto":
        return wanted
    if torch_module.cuda.is_available():
        return "cuda"
    mps = getattr(torch_module.backends, "mps", None)
    return "mps" if mps is not None and mps.is_available() else "cpu"


def import_birefnet(code_dir: Path):
    """Importa birefnet.py / BiRefNet_config.py (revisão fixa; hash já conferido por verify_component) como pacote isolado."""
    code_dir = Path(code_dir)
    init = code_dir / "__init__.py"
    if not init.exists():                       # no contêiner a pasta é só leitura: o download já criou o arquivo
        init.touch()
    if PACKAGE not in sys.modules:
        spec = importlib.util.spec_from_file_location(PACKAGE, code_dir / "__init__.py", submodule_search_locations=[str(code_dir)])
        package = importlib.util.module_from_spec(spec)
        sys.modules[PACKAGE] = package
        spec.loader.exec_module(package)
    return SimpleNamespace(cfg=importlib.import_module(PACKAGE + ".BiRefNet_config"), net=importlib.import_module(PACKAGE + ".birefnet"))


class BiRefNetMatting:
    """Alfa do primeiro plano com os pesos da FASHN no BiRefNet (Swin-L, entrada 1024²). Carrega sob demanda."""

    def __init__(self, root: Path, device: str = "auto", side: int = BIREFNET_SIDE):
        self.root, self.wanted, self.side = Path(root), device, side
        self.model = None
        self.device = "cpu"

    def load(self):
        if self.model is not None:
            return
        import torch
        from safetensors.torch import load_file
        verify_component(self.root, "birefnet")          # pesos E código conferidos antes de qualquer import
        module = import_birefnet(self.root / "birefnet" / "code")
        self.device = _device(torch, self.wanted)
        model = module.net.BiRefNet(bb_pretrained=False, config=module.cfg.BiRefNetConfig(bb_pretrained=False))
        model.load_state_dict(load_file(str(self.root / "birefnet" / "birefnet.safetensors")), strict=True)
        dtype = torch.float16 if self.device == "cuda" else torch.float32
        self.model = model.eval().to(self.device, dtype)

    def alpha(self, image: Image.Image) -> np.ndarray:
        import torch
        self.load()
        rgb = np.asarray(image.convert("RGB").resize((self.side, self.side), Image.Resampling.BICUBIC), dtype=np.float32) / 255.0
        x = torch.from_numpy((rgb - IMAGENET_MEAN) / IMAGENET_STD).permute(2, 0, 1)[None]
        x = x.to(self.device, next(self.model.parameters()).dtype)
        with torch.inference_mode():
            pred = self.model(x)
            pred = pred[-1] if isinstance(pred, (list, tuple)) else pred
            alpha = torch.nn.functional.interpolate(pred.float().sigmoid(), size=(image.height, image.width), mode="bilinear", align_corners=False)
        return alpha[0, 0].clamp(0, 1).cpu().numpy().astype(np.float32)


class LamaInpainter:
    """big-lama.pt (TorchScript) da FASHN: forward(image, mask) → imagem; fora da máscara o pixel volta igual."""

    def __init__(self, root: Path, device: str = "auto"):
        self.root, self.wanted = Path(root), device
        self.model = None
        self.device = "cpu"

    def load(self):
        if self.model is not None:
            return
        import torch
        verify_component(self.root, "lama")
        self.device = _device(torch, self.wanted)
        self.model = torch.jit.load(str(self.root / "lama" / "big-lama.pt"), map_location="cpu").eval().to(self.device)

    def inpaint(self, image: Image.Image, mask: Image.Image) -> Image.Image:
        import torch
        import torch.nn.functional as F
        self.load()
        if mask.size != image.size:
            raise ValueError("MASK_DIMENSIONS_MISMATCH")
        rgb = torch.from_numpy(np.asarray(image.convert("RGB"), dtype=np.float32) / 255.0).permute(2, 0, 1)[None]
        hole = torch.from_numpy((np.asarray(mask.convert("L")) > 127).astype(np.float32))[None, None]
        h, w = rgb.shape[-2:]
        pad_h, pad_w = (-h) % 8, (-w) % 8
        if pad_h or pad_w:                                 # LaMa trabalha em múltiplos de 8
            rgb = F.pad(rgb, (0, pad_w, 0, pad_h), mode="reflect")
            hole = F.pad(hole, (0, pad_w, 0, pad_h))
        with torch.inference_mode():
            out = self.model(rgb.to(self.device), hole.to(self.device))
        out = out[0, :, :h, :w].clamp(0, 1).cpu().permute(1, 2, 0).numpy()
        return Image.fromarray((out * 255).round().astype(np.uint8))


class FashnOpenProvider:
    """Parser + BiRefNet para o process_local_sd (engine fashn-open). Modelos carregam na primeira foto.
    `tta`: os rótulos saem da média dos logits da foto e do seu espelho — o parser sozinho confunde, por exemplo, um
    conjunto jeans (top + calça) com 'dress' e a calça perde a metade de baixo; com o espelho a confusão some."""

    def __init__(self, root: Path, device: str = "auto", parser=None, matting: Optional[BiRefNetMatting] = None, tta: bool = True):
        self.root, self.wanted, self.tta = Path(root), device, tta
        self.parser = parser
        self._parser_ready = parser is not None
        self.matting = matting or BiRefNetMatting(self.root, device)

    def labels(self, image: Image.Image) -> np.ndarray:
        parser = self._parser()
        if not self.tta:
            return np.asarray(parser.predict(image))
        import torch
        from PIL import ImageOps
        logits = parser.predict(image, return_logits=True)
        mirrored = parser.predict(ImageOps.mirror(image), return_logits=True)
        return (logits + torch.flip(mirrored, dims=[-1])).argmax(1)[0].cpu().numpy()

    def _parser(self):
        if not self._parser_ready:
            import torch
            from fashn_human_parser import FashnHumanParser
            verify_component(self.root, "parser")
            device = _device(torch, self.wanted)
            self.parser = FashnHumanParser(model_id=str(self.root / "parser"), device="cpu" if device == "mps" else device)
            self._parser_ready = True
        return self.parser

    def analyse(self, image: Image.Image, category: Optional[str], subcategory: Optional[str]) -> Fusion:
        keep = garment_label_ids(category, subcategory)
        alpha = self.matting.alpha(image)
        if keep is None:
            return fuse(np.zeros(alpha.shape, dtype=np.int64), alpha, None)
        labels = self.labels(image)
        if labels.shape != alpha.shape or not np.isin(labels, np.arange(18)).all():
            raise ValueError("PARSER_INVALID_LABELS")
        return fuse(labels, alpha, keep)
