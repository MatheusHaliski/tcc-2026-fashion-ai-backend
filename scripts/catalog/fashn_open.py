#!/usr/bin/env python3
"""Pipeline aberto da FASHN para o packshot — engine `fashn-open` do process_local_sd.py.

O modelo `packshot` da API da FASHN é fechado (só roda nos servidores deles). O que a FASHN publica no Hugging Face é o
bastante para o pipeline equivalente, nesta ordem:

  1. fashn-human-parser com a MESMA seleção de rótulos por categoria do fashn-vton-1.5 (`create_garment_image`):
     tops → upper → top/dress/scarf · bottoms → lower → skirt/pants/belt · one-pieces → full → tudo isso. Foto sem
     pessoa (flat-lay, produto solto): o parser é ignorado — é o `disable_masking` do flat-lay da FASHN.
  2. BiRefNet (fashn-ai/BiRefNet, Swin-L a 1024²): alfa fino do primeiro plano. A borda peça/fundo vem dele; a borda
     peça/corpo e peça/outra peça vem do parser.
  3. LaMa (fashn-ai/LaMa, big-lama.pt TorchScript): preenche SÓ onde o corpo aparecia por dentro da peça (gola, punhos,
     entre as pernas). O tecido original nunca é redesenhado.
  4. Stable Diffusion inpainting opcional (`--sd` no process_local_sd.py) por cima do LaMa — acabamento ghost mannequin.
  5. Enquadramento do catálogo (process_local_sd.compose_packshot): 900×1200, maior aresta em 50 %, fundo branco; peça
     com altura < 25 % da foto → INELIGIBLE antes de qualquer geração.

Pesos:  python scripts/catalog/fashn_open.py download --dest /pasta/FORA/do/repositorio
        python scripts/catalog/fashn_open.py verify   --dest /pasta/FORA/do/repositorio
        python scripts/catalog/fashn_open.py smoke    --dest … --image foto.jpg --category upper_piece --subcategory t_shirt

Tudo fixado em fashn_open_assets.json (repositório, revisão, tamanho, sha256). O código do BiRefNet (ZhengPeng7/BiRefNet,
revisão fixa) só é importado depois que o hash confere. Nenhum passo chama serviço pago; nada grava no banco.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib
import importlib.util
import json
import sys
import time
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from typing import Callable, Iterable, Optional

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))

from photo_set import SET_SUBCATEGORIES, PhotoMasks  # noqa: E402
from whole_frame import FULL, LOWER, UPPER, cloth_class  # noqa: E402

ASSETS_FILE = Path(__file__).resolve().parent / "fashn_open_assets.json"
HF_URL = "https://huggingface.co/{repo}/resolve/{revision}/{filename}"
PACKAGE = "fashn_open_birefnet"            # nome do pacote sob o qual o código do BiRefNet é importado
BIREFNET_SIDE = 1024
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)
UA = "FashionAI-CatalogBot/1.0 (+https://fashionai.app/catalog-bot)"

# Cópia da tabela do fashn-human-parser (labels.py) — a mesma que o fashn-vton-1.5 usa; o teste confere contra o pacote.
LABELS_TO_IDS = {"background": 0, "face": 1, "hair": 2, "top": 3, "dress": 4, "skirt": 5, "pants": 6, "belt": 7, "bag": 8,
                 "hat": 9, "scarf": 10, "glasses": 11, "arms": 12, "hands": 13, "legs": 14, "feet": 15, "torso": 16, "jewelry": 17}
IDS_TO_LABELS = {v: k for k, v in LABELS_TO_IDS.items()}
CATEGORY_TO_BODY_COVERAGE = {"tops": "upper", "bottoms": "lower", "one-pieces": "full"}
BODY_COVERAGE_TO_LABELS = {"upper": ["top", "dress", "scarf"], "lower": ["skirt", "pants", "belt"],
                           "full": ["top", "dress", "scarf", "skirt", "pants", "belt"]}
# Só isto prova que há pessoa na foto: o parser "vê" cabelo em textura de produto (bola, tricô), então cabelo não conta.
PERSON_LABELS = frozenset({1, 12, 13, 14, 15, 16})
HUMAN_LABELS = PERSON_LABELS | {2}
# Fora das três categorias da FASHN (que não cobrem calçado nem acessório), o rótulo que fica quando há pessoa na foto.
EXTRA_KEEP = {"shoes_piece": ("feet",), "accessory_piece": ("belt", "bag", "hat", "scarf", "glasses", "jewelry")}


# ───────────────────────── rótulos por categoria (idêntico ao fashn-vton-1.5)

def fashn_category(category: Optional[str], subcategory: Optional[str] = None) -> Optional[str]:
    """Categoria da API da FASHN (tops / bottoms / one-pieces) para a do catálogo; None = calçado, acessório, desconhecida."""
    if (subcategory or "").strip().lower() in SET_SUBCATEGORIES:
        return "one-pieces"                                    # conjunto = cima + baixo, como a cobertura "full"
    return {UPPER: "tops", LOWER: "bottoms", FULL: "one-pieces"}.get(cloth_class(category, subcategory))


def garment_label_ids(category: Optional[str], subcategory: Optional[str] = None) -> Optional[frozenset[int]]:
    """Os rótulos que o fashn-vton-1.5 mantém em create_garment_image para a categoria (None = sem parser)."""
    fashn = fashn_category(category, subcategory)
    if fashn is not None:
        return frozenset(LABELS_TO_IDS[name] for name in BODY_COVERAGE_TO_LABELS[CATEGORY_TO_BODY_COVERAGE[fashn]])
    names = EXTRA_KEEP.get((category or "").strip().lower())
    return frozenset(LABELS_TO_IDS[name] for name in names) if names else None


# ───────────────────────── fusão parser × BiRefNet

@dataclass
class Fusion:
    target: np.ndarray                    # bool — a peça
    forbidden: Optional[np.ndarray]       # bool — corpo e tudo que é primeiro plano sem ser a peça
    alpha: np.ndarray                     # float32 0..1 — alfa fino da peça (borda do BiRefNet)
    mode: str                             # parser+birefnet · birefnet-flat-lay · birefnet-only
    person: bool
    kept: tuple[str, ...] = ()

    def photo_masks(self, category, subcategory, source: str = "fashn-open") -> PhotoMasks:
        def to_l(array):
            return Image.fromarray((np.asarray(array, dtype=bool) * 255).astype(np.uint8))
        return PhotoMasks(to_l(self.target), None if self.forbidden is None else to_l(self.forbidden), verified=True,
                          target_category=category, target_subcategory=subcategory, human_present=self.person,
                          source=f"{source}:{self.mode}", isolation_verified=self.mode == "parser+birefnet")


def fuse(labels: np.ndarray, alpha: np.ndarray, keep_ids: Optional[Iterable[int]], *, threshold: float = 0.5,
         person_min: float = 0.002, edge: Optional[int] = None) -> Fusion:
    """Peça = primeiro plano do BiRefNet ∩ rótulos da categoria no parser. Onde o parser (576×384) chamou de fundo mas o
    BiRefNet vê primeiro plano colado na peça, a borda fina do BiRefNet vence. Sem pessoa na foto (ou sem rótulos para a
    categoria) a peça é o primeiro plano inteiro — o flat-lay da FASHN."""
    labels = np.asarray(labels)
    alpha = np.asarray(alpha, dtype=np.float32)
    if labels.shape != alpha.shape:
        raise ValueError("FASHN_OPEN_SHAPE_MISMATCH")
    foreground = alpha >= threshold
    person = bool(np.isin(labels, list(PERSON_LABELS)).mean() >= person_min)
    if keep_ids is None or not person:
        soft = np.where(ndimage.binary_dilation(foreground, iterations=1), alpha, 0).astype(np.float32)
        return Fusion(foreground, None, soft, "birefnet-only" if keep_ids is None else "birefnet-flat-lay", person)
    keep_ids = frozenset(keep_ids)
    keep = np.isin(labels, list(keep_ids))
    radius = edge or max(4, int(round(0.006 * max(labels.shape))))
    target = foreground & keep
    target |= foreground & (labels == 0) & ndimage.binary_dilation(keep, iterations=radius)
    forbidden = (foreground | np.isin(labels, list(HUMAN_LABELS))) & ~target
    soft = np.where(ndimage.binary_dilation(target, iterations=1), alpha, 0).astype(np.float32)
    kept = tuple(sorted(IDS_TO_LABELS[i] for i in keep_ids if (labels == i).any()))
    return Fusion(target, forbidden, soft, "parser+birefnet", True, kept)


# ───────────────────────── pesos fixados

def assets() -> dict:
    return json.loads(ASSETS_FILE.read_text(encoding="utf-8"))


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def hf_url(entry: dict) -> str:
    return HF_URL.format(**entry)


def urllib_fetch(url: str, dest: Path, timeout: float = 120) -> None:
    """Baixa em blocos para `dest` (sem token: tudo é público). Quem chama confere o sha256 antes de aceitar."""
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=timeout) as response, Path(dest).open("wb") as out:
        for chunk in iter(lambda: response.read(1 << 20), b""):
            out.write(chunk)


def _selected(components: Optional[Iterable[str]]) -> list[dict]:
    wanted = set(components) if components else None
    return [e for e in assets()["files"] if wanted is None or e["component"] in wanted]


def verify(dest: Path, components: Optional[Iterable[str]] = None) -> list[str]:
    """Problemas (arquivo ausente, tamanho ou sha256 diferente do fixado); lista vazia = tudo confere."""
    problems = []
    for entry in _selected(components):
        path = Path(dest) / entry["path"]
        if not path.is_file():
            problems.append(f"ausente: {entry['path']}")
        elif path.stat().st_size != entry["size"]:
            problems.append(f"tamanho: {entry['path']}")
        elif sha256_of(path) != entry["sha256"]:
            problems.append(f"sha256: {entry['path']}")
    return problems


def verify_component(dest: Path, component: str) -> None:
    problems = verify(dest, {component})
    if problems:
        raise ValueError("FASHN_OPEN_ASSETS_INVALID:" + ";".join(problems))


def download(dest: Path, components: Optional[Iterable[str]] = None, fetch: Optional[Callable[[str, Path], None]] = None,
             log: Callable[[str], None] = print) -> list[dict]:
    """Baixa o que falta, confere o sha256 e só então renomeia; arquivo já íntegro não é baixado de novo."""
    fetch = fetch or urllib_fetch
    dest = Path(dest)
    manifest = []
    for entry in _selected(components):
        path = dest / entry["path"]
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.is_file() and path.stat().st_size == entry["size"] and sha256_of(path) == entry["sha256"]:
            log(f"  ✓ {entry['path']} já presente")
        else:
            part = path.with_name(path.name + ".part")
            started = time.monotonic()
            fetch(hf_url(entry), part)
            digest = sha256_of(part)
            if part.stat().st_size != entry["size"] or digest != entry["sha256"]:
                part.unlink(missing_ok=True)
                raise ValueError(f"FASHN_OPEN_SHA256_MISMATCH:{entry['path']}")
            part.replace(path)
            log(f"  ↓ {entry['path']} ({entry['size'] / 1e6:.1f} MB em {time.monotonic() - started:.0f}s, sha256 ok)")
        manifest.append({"path": entry["path"], "size": entry["size"], "sha256": entry["sha256"], "repo": entry["repo"], "revision": entry["revision"]})
    code_dir = dest / "birefnet" / "code"
    if code_dir.is_dir():
        (code_dir / "__init__.py").touch()          # vira pacote importável (import_birefnet)
    (dest / "fashn_open_manifest.json").write_text(json.dumps({"files": manifest}, indent=1), encoding="utf-8")
    return manifest


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
    (code_dir / "__init__.py").touch()
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


# ───────────────────────── CLI

def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0], formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    sub = ap.add_subparsers(dest="command", required=True)
    for name in ("download", "verify", "smoke"):
        p = sub.add_parser(name)
        p.add_argument("--dest", type=Path, required=True, help="pasta dos pesos (fora do repositório)")
        if name == "download":
            p.add_argument("--only", help="componentes separados por vírgula: parser,birefnet,lama")
        if name == "smoke":
            p.add_argument("--image", type=Path, required=True)
            p.add_argument("--category", default="upper_piece")
            p.add_argument("--subcategory")
            p.add_argument("--device", default="auto")
    args = ap.parse_args(argv)
    if args.command == "download":
        download(args.dest, [c.strip() for c in args.only.split(",")] if args.only else None)
        print(f"pesos em {args.dest} (fashn_open_manifest.json)")
        return 0
    if args.command == "verify":
        problems = verify(args.dest)
        print("tudo confere" if not problems else "\n".join(problems))
        return 0 if not problems else 1
    image = Image.open(args.image).convert("RGB")
    provider = FashnOpenProvider(args.dest, args.device)
    started = time.monotonic()
    fusion = provider.analyse(image, args.category, args.subcategory)
    seconds = time.monotonic() - started
    stem = args.image.with_suffix("")
    Image.fromarray((fusion.alpha * 255).astype(np.uint8)).save(f"{stem}-fashn-open-alpha.png")
    if fusion.forbidden is not None:
        Image.fromarray((fusion.forbidden * 255).astype(np.uint8)).save(f"{stem}-fashn-open-body.png")
    print(json.dumps({"mode": fusion.mode, "person": fusion.person, "kept": fusion.kept, "targetFraction": round(float(fusion.target.mean()), 4),
                      "tta": provider.tta, "device": provider.matting.device, "seconds": round(seconds, 1)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
