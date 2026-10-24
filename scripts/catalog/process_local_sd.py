#!/usr/bin/env python3
"""Peça inteira (Total frame) LOCAL com Stable Diffusion: packshot "ghost mannequin" sem API paga.

    .venv/bin/python scripts/catalog/process_local_sd.py --measure-only --limit 5000   # 1. só mede: relatório da altura (< 25% → quarentena)
    .venv/bin/python scripts/catalog/process_local_sd.py --limit 20 --dry-run          # 2. ensaio: gera em ./output_images, não grava no banco
    .venv/bin/python scripts/catalog/process_local_sd.py --limit 200                   # 3. gera e grava processed_image_url

Etapas por foto: baixa (link direto ou og:image de página HTML) → rembg LOCAL com a classe de roupa da categoria (cima,
baixo, corpo inteiro; calçado/acessório usa o recorte geral) → medição e limpeza da máscara (pessoa, outras peças, riscos e
silhuetas fora do perímetro; altura da peça menor que 25% da foto = INELEGÍVEL, nada é gerado) → inpainting só onde o
corpo aparecia POR DENTRO da peça (gola, punhos, barra, entre as pernas) com Stable Diffusion Inpainting local, opcional
ControlNet inpaint → composição: o tecido ORIGINAL é preservado pixel a pixel (a IA nunca redesenha estampa, logo ou
costura), fundo branco, peça centralizada com a maior aresta em 50% do quadro 3:4 de 900×1200 e sombra suave → PNG em
--out-dir → UPDATE da coluna (caminho local ou URL pública com --public-base-url).

Banco pelo SQLAlchemy (MySQL/PostgreSQL): DATABASE_URL (ou FAI_DATABASE_URL) ou as MYSQL_* do backend — senha nunca no
código nem no log. GPU: CUDA → fp16; Apple Silicon (MPS) e CPU → fp32. Falha numa foto não para o lote (fica no
relatório com o motivo); a memória do acelerador é liberada a cada foto (torch.cuda/mps.empty_cache).

Modelos: `runwayml/stable-diffusion-inpainting` saiu do ar em 2024 — o padrão é a republicação oficial
`stable-diffusion-v1-5/stable-diffusion-inpainting`; `--model diffusers/stable-diffusion-xl-1.0-inpainting-0.1` para SDXL.
Nada é excluído do catálogo por este script: a quarentena (quarantine_unsafe_products.py) é um passo separado e auditado.

Engine `--engine fashn-open` (fashn_open.py): o pipeline aberto da FASHN — parser humano com os rótulos por categoria do
fashn-vton-1.5 + BiRefNet (alfa fino do primeiro plano) + LaMa só na região fantasma; `--sd` acrescenta o Stable Diffusion
por cima. Pesos fixados por sha256 em `--weights` (`python scripts/catalog/fashn_open.py download`). O enquadramento e a
regra dos 25 % são os mesmos dos dois engines.
"""
from __future__ import annotations

import argparse
import gc
import hashlib
import html as html_lib
import io
import json
import logging
import os
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import urljoin, urlsplit

import numpy as np
from PIL import Image, ImageFilter, ImageOps, UnidentifiedImageError
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))

from photo_preflight import MIN_SOURCE_HEIGHT, fit_box, inspect_source  # noqa: E402
from photo_set import MAX_ANALYSIS_SIDE, MAX_INPUT_PIXELS, LocalClothProvider, PhotoMasks, clean_target_mask  # noqa: E402
from whole_frame import HEIGHT, WIDTH, GarmentSegmenter, cloth_class  # noqa: E402
from fashn_open import FashnOpenProvider, LamaInpainter  # noqa: E402

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


# ───────────────────────── download: link direto ou página HTML (og:image)

Fetch = Callable[[str], tuple[int, bytes, str]]
_META = re.compile(r"<meta\b[^>]*>", re.I)
_ATTR = re.compile(r"""([a-zA-Z_:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))""")


def og_image(page: bytes, page_url: str) -> Optional[str]:
    """`og:image` (ou `og:image:secure_url`, `twitter:image`) da página; só http(s), resolvido contra a página."""
    text = page.decode("utf-8", "replace")
    found = {}
    for tag in _META.findall(text):
        attrs = {m.group(1).lower(): next(g for g in m.groups()[1:] if g is not None) for m in _ATTR.finditer(tag)}
        key = (attrs.get("property") or attrs.get("name") or "").lower()
        if key in ("og:image:secure_url", "og:image", "twitter:image") and attrs.get("content"):
            found.setdefault(key, html_lib.unescape(attrs["content"]).strip())
    for key in ("og:image:secure_url", "og:image", "twitter:image"):
        url = found.get(key)
        if url:
            url = urljoin(page_url, "https:" + url if url.startswith("//") else url)
            if urlsplit(url).scheme in ("http", "https"):
                return url
    return None


HOST_PAUSED = "host-paused"                 # "content-type" sintético: o host pediu para parar e não foi mais consultado


def polite_fetch(fetch: Fetch, min_interval: float = 1.0, retries: int = 2, sleep=time.sleep, clock=time.monotonic,
                 host_limit: int = 3) -> Fetch:
    """Polidez por host (os CDNs das lojas — vtexassets.com — devolvem 429 a quem baixa em rajada) e espera em 429/503:
    respeita Retry-After quando vem, senão 5 s, até `retries` vezes; depois devolve o status para virar RETRY no relatório.
    Disjuntor por host (a regra do coletor, "o site pediu para parar"): depois de `host_limit` URLs seguidas em que o host
    terminou em 429/503 mesmo após as esperas, as próximas URLs dele voltam 429 sem pedido algum; um 200 zera a conta; 0 desliga."""
    last: dict[str, float] = {}
    strikes: dict[str, int] = {}

    def fetch_polite(url: str) -> tuple[int, bytes, str]:
        host = urlsplit(url).hostname or ""
        if host_limit and strikes.get(host, 0) >= host_limit:
            return 429, b"", HOST_PAUSED
        for attempt in range(retries + 1):
            wait = last.get(host, -1e9) + min_interval - clock()
            if wait > 0:
                sleep(wait)
            last[host] = clock()
            status, body, ctype = fetch(url)
            if status not in (429, 503) or attempt == retries:
                strikes[host] = strikes.get(host, 0) + 1 if status in (429, 503) else 0
                return status, body, ctype
            retry_after = ctype if isinstance(ctype, str) and ctype.startswith("retry-after:") else ""
            try:
                pause = float(retry_after.split(":", 1)[1]) if retry_after else 5.0
            except ValueError:
                pause = 5.0
            sleep(min(max(pause, 1.0), 60.0))
        return status, body, ctype                                  # pragma: no cover

    return fetch_polite


def requests_fetch(timeout: float = 20, min_interval: float = 1.0, host_limit: int = 3) -> Fetch:
    """fetch(url) -> (status, corpo até MAX_BYTES, content-type) com requests, polidez por host e espera em 429.
    Em 429/503 o "content-type" devolvido é "retry-after:<s>" para o polite_fetch saber quanto esperar."""
    import requests

    def fetch(url: str) -> tuple[int, bytes, str]:
        with requests.get(url, headers={"User-Agent": UA, "Accept": "image/*,text/html;q=0.9,*/*;q=0.5"},
                          timeout=timeout, stream=True) as r:
            if r.status_code in (429, 503):
                return r.status_code, b"", "retry-after:" + (r.headers.get("Retry-After") or "")
            data = bytearray()
            for chunk in r.iter_content(64 * 1024):
                data.extend(chunk)
                if len(data) > MAX_BYTES:
                    raise PhotoSkip("IMAGE_TOO_LARGE", "REJECTED")
            return r.status_code, bytes(data), r.headers.get("Content-Type", "")
    return polite_fetch(fetch, min_interval, host_limit=host_limit)


def resolve_image(url: str, fetch: Fetch) -> tuple[bytes, str]:
    """Bytes da imagem: a própria URL se for imagem; página HTML → og:image → imagem. (status, url final)."""
    if not url or urlsplit(url).scheme not in ("http", "https"):
        raise PhotoSkip("INVALID_IMAGE_URL", "REJECTED")
    status, body, ctype = fetch(url)
    if status in (403, 429):
        raise PhotoSkip(f"HTTP_{status}" + ("_HOST_PAUSED" if ctype == HOST_PAUSED else ""), "RETRY")
    if status != 200:
        raise PhotoSkip(f"HTTP_{status}", "RETRY" if status >= 500 else "REJECTED")
    kind = (ctype or "").split(";")[0].strip().lower()
    if kind.startswith("image/") or (not kind and urlsplit(url).path.lower().endswith(IMAGE_EXT)):
        return body, url
    if "html" in kind or body[:512].lstrip().lower().startswith((b"<!doctype html", b"<html")):
        direct = og_image(body, url)
        if not direct:
            raise PhotoSkip("NO_OG_IMAGE", "REJECTED")
        status, body, ctype = fetch(direct)
        if status != 200 or not (ctype or "").lower().startswith("image/"):
            raise PhotoSkip("OG_IMAGE_UNAVAILABLE", "RETRY" if status >= 500 else "REJECTED")
        return body, direct
    raise PhotoSkip("NOT_AN_IMAGE", "REJECTED")


def open_image(data: bytes) -> tuple[Image.Image, tuple[int, int]]:
    """Imagem RGB orientada pelo EXIF e reduzida para análise; devolve também o tamanho original."""
    try:
        with Image.open(io.BytesIO(data)) as raw:
            if raw.width * raw.height > MAX_INPUT_PIXELS:
                raise PhotoSkip("IMAGE_TOO_LARGE", "REJECTED")
            if min(raw.size) < MIN_SIDE:
                raise PhotoSkip("BELOW_MINIMUM_300X300", "REJECTED")
            image = ImageOps.exif_transpose(raw).convert("RGB")
            image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise PhotoSkip("CORRUPT_IMAGE", "REJECTED") from None
    original = image.size
    image.thumbnail((MAX_ANALYSIS_SIDE, MAX_ANALYSIS_SIDE), Image.Resampling.LANCZOS)
    return image, original


# ───────────────────────── máscaras: peça, corpo e a região "fantasma"

def ghost_mask(target: np.ndarray, forbidden: Optional[np.ndarray], feather: int = 3) -> np.ndarray:
    """Onde o corpo aparecia POR DENTRO da peça — é só isso que a IA preenche: buracos fechados da máscara da peça (gola
    fechada, cós) e pixels de pessoa/outra peça ENTRE o primeiro e o último pixel da peça na mesma linha (pescoço entre os
    ombros, punhos, barra, entre as pernas). Rosto acima dos ombros, braços ao lado do tronco, fundo e qualquer coisa fora
    do perímetro ficam de fora; o tecido em si nunca entra (é restaurado na composição)."""
    target = np.asarray(target, dtype=bool)
    if not target.any():
        return np.zeros_like(target)
    h, w = target.shape
    rows = target.any(axis=1)
    first_x = np.argmax(target, axis=1)
    last_x = w - 1 - np.argmax(target[:, ::-1], axis=1)
    xs = np.arange(w)[None, :]
    between = rows[:, None] & (xs >= first_x[:, None]) & (xs <= last_x[:, None])
    holes = ndimage.binary_fill_holes(target) & ~target
    body = np.zeros_like(target) if forbidden is None else (np.asarray(forbidden, dtype=bool) & between & ~target)
    ghost = holes | body
    if feather > 0 and ghost.any():
        ghost = ndimage.binary_dilation(ghost, iterations=feather)
    return ghost


def body_from_foreground(target: np.ndarray, foreground: np.ndarray, margin: int = 2) -> np.ndarray:
    """Corpo e outras peças SEM o parser humano: tudo que o recorte geral (isnet) vê como primeiro plano e não é a peça —
    com uma folga de `margin` px em volta dela, para a própria borda do tecido nunca ser marcada como corpo."""
    target = np.asarray(target, dtype=bool)
    near = ndimage.binary_dilation(target, iterations=margin) if margin > 0 else target
    return np.asarray(foreground, dtype=bool) & ~near


def masks_for(image: Image.Image, category: Optional[str], subcategory: Optional[str], provider, segmenter,
              foreground_body: bool = True) -> PhotoMasks:
    """Peça + corpo pela classe de roupa (LocalClothProvider); calçado/acessório (sem classe) usa o recorte geral.
    Sem máscara de corpo do provedor (parser humano não configurado), o corpo sai do primeiro plano geral menos a peça."""
    if cloth_class(category, subcategory) is not None:
        masks = provider.masks(image, category, subcategory)
        if masks.forbidden is None and foreground_body:
            target = np.asarray(masks.target.convert("L")) >= 128
            foreground = np.asarray(segmenter.mask(image, model=False).convert("L")) >= 128
            body = body_from_foreground(target, foreground)
            masks.forbidden = Image.fromarray((body * 255).astype(np.uint8))
            masks.human_present = bool(body.sum() > 0.002 * body.size)
            masks.source = f"{masks.source}+isnet-foreground"
        return masks
    target = segmenter.mask(image, category=category, subcategory=subcategory, model=False)
    return PhotoMasks(target.convert("L"), None, verified=True, target_category=category, target_subcategory=subcategory,
                      source="isnet-general-use", human_present=False)


LENIENT_REASONS = {"UNCLASSIFIED_THIN_CONTOUR", "AMBIGUOUS_TARGET_COMPONENTS", "SOURCE_EXTENT_UNCERTAIN"}


def lenient_clean(target: Image.Image, forbidden: Optional[Image.Image], category: Optional[str], subcategory: Optional[str]) -> tuple[np.ndarray, dict]:
    """Plano B da limpeza, só neste lote de revisão visual: tira o corpo (com folga), abre a máscara (3×3: some risco,
    fio e serrilhado fino) e fica com os componentes relevantes — 2 pernas/pés, até 4 peças num conjunto, 1 nos demais.
    A trilha verificada do catálogo continua estrita; aqui o modo fica registrado na evidência (`cleanupMode`)."""
    a = np.asarray(target.convert("L")) >= 128
    if forbidden is not None:
        a &= ~ndimage.binary_dilation(np.asarray(forbidden.convert("L")) >= 128, iterations=1)
    before = int(a.sum())
    opened = ndimage.binary_opening(a, structure=np.ones((3, 3), dtype=bool))
    labels, _ = ndimage.label(opened)
    areas = np.bincount(labels.ravel()); areas[0] = 0
    sub = (subcategory or "").lower(); cat = (category or "").lower()
    max_parts = 4 if sub in {"matching_set", "set", "two_piece_set", "bikini", "bikini_set"} else 2 if cat in {"lower_piece", "shoes_piece"} or sub == "socks" else 1
    keep = [k for k in np.argsort(areas)[::-1] if areas[k] >= max(24, int(opened.sum() * .004))][:max_parts]
    if not keep:
        raise PhotoSkip("TARGET_MASK_EMPTY_AFTER_CLEANUP", "REVIEW")
    cleaned = np.isin(labels, keep)
    kept = int(cleaned.sum())
    if kept < 64 or kept < .6 * max(before, 1):
        raise PhotoSkip("EXCESSIVE_MASK_REMOVAL", "REVIEW")
    return cleaned, {"cleanupMode": "LENIENT_OPENING", "removedPixels": before - kept, "targetPixels": kept, "retainedParts": len(keep),
                     "removedFraction": round(1 - kept / max(before, 1), 5), "maskCoverage": round(kept / cleaned.size, 5)}


def measure(image: Image.Image, masks: PhotoMasks, category: Optional[str], subcategory: Optional[str],
            original: tuple[int, int], lenient: bool = True) -> tuple[np.ndarray, Optional[np.ndarray], dict]:
    """Limpa a máscara e mede a peça. Altura menor que 25% da foto → INELIGIBLE (o motivo vai ao relatório; nada é
    gerado nem apagado). O preflight completo entra no relatório como evidência, sem bloquear a geração local. A limpeza
    estrita do catálogo vem primeiro; contorno fino não classificado ou extensão ambígua caem na tolerante (`lenient`)."""
    preflight = inspect_source(image, masks, category or "", subcategory, original_size=original)
    try:
        cleaned, cleanup = clean_target_mask(masks.target, masks.forbidden, category or "", subcategory)
        target = np.asarray(cleaned) >= 128
        cleanup = {"cleanupMode": "STRICT", **cleanup}
    except ValueError as error:
        if not lenient or str(error) not in LENIENT_REASONS:
            raise PhotoSkip(str(error), "REVIEW", {"preflight": preflight.metrics}) from None
        target, cleanup = lenient_clean(masks.target, masks.forbidden, category, subcategory)
        cleanup["strictReason"] = str(error)
    ys, xs = np.where(target)
    height_fraction = (ys.max() + 1 - ys.min()) / image.height
    frame_height = min(0.5, 0.5 * ((ys.max() + 1 - ys.min()) / (xs.max() + 1 - xs.min())) * (WIDTH / HEIGHT))
    metrics = {"preflight": preflight.metrics, "cleanup": cleanup, "sourceGarmentHeightFraction": round(float(height_fraction), 4),
               "frameGarmentHeightFraction": round(float(frame_height), 4), "minimumHeightFraction": MIN_SOURCE_HEIGHT,
               "sourceBox": {"x": int(xs.min()), "y": int(ys.min()), "w": int(xs.max() + 1 - xs.min()), "h": int(ys.max() + 1 - ys.min())}}
    if height_fraction < MIN_SOURCE_HEIGHT:
        raise PhotoSkip("SOURCE_GARMENT_BELOW_MIN_HEIGHT", "INELIGIBLE", metrics)
    forbidden = None if masks.forbidden is None else np.asarray(masks.forbidden.convert("L")) >= 128
    return target, forbidden, metrics


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


# ───────────────────────── composição do packshot

@dataclass
class Packshot:
    data: bytes
    info: dict


def compose_packshot(source: Image.Image, target: np.ndarray, generated: Optional[Image.Image], ghost: np.ndarray, *,
                     background: tuple[int, int, int] = BACKGROUND, shadow: bool = True, alpha: Optional[np.ndarray] = None) -> Packshot:
    """Tecido original onde há peça; o resultado da IA só na região fantasma (com IA); fundo liso no resto. Depois o
    Total frame: peça centralizada, maior aresta em 50% do quadro 900×1200, proporção preservada, sombra suave.
    `alpha` (0..1, engine fashn-open) é o alfa fino do BiRefNet: a borda vem do modelo, sem desfoque."""
    src = np.asarray(source.convert("RGB"))
    if generated is not None:
        gen = np.asarray(generated.convert("RGB").resize(source.size, Image.Resampling.LANCZOS))
        rgb = np.where(target[..., None], src, gen)
        hard = target | ghost
    else:
        rgb, hard = src, target
    cutout = Image.fromarray(rgb.astype(np.uint8)).convert("RGBA")
    if alpha is None:
        # borda do alfa com 1 px de suavização: o contorno da segmentação deixa de parecer serrilhado, sem comer a peça
        matte = Image.fromarray((hard * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    else:
        soft = np.asarray(alpha, dtype=np.float32)
        if generated is not None:
            soft = np.maximum(soft, ghost.astype(np.float32))      # a região fantasma preenchida entra opaca
        matte = Image.fromarray((np.clip(soft, 0, 1) * 255).round().astype(np.uint8))
    cutout.putalpha(matte)
    box = cutout.getbbox()
    if box is None:
        raise PhotoSkip("WHOLE_EMPTY_MASK")
    cutout = cutout.crop(box)
    x, y, w, h, framing = fit_box(cutout.size, (WIDTH, HEIGHT))
    cutout = cutout.resize((w, h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), (*background, 255))
    if shadow:
        # sombra de apoio: a silhueta deslocada para baixo, escurecida e desfocada — nunca sobre a peça
        layer = Image.new("RGBA", (WIDTH, HEIGHT), (20, 24, 31, 0))
        silhouette = cutout.getchannel("A").point(lambda v: int(v * 0.22))
        layer.paste((20, 24, 31, 255), (x, y + max(4, h // 40)), silhouette)
        canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(max(6, w // 30))))
    canvas.alpha_composite(cutout, (x, y))
    out = io.BytesIO()
    canvas.convert("RGB").save(out, "PNG", optimize=True)
    info = {"version": VERSION, "width": WIDTH, "height": HEIGHT, "background": "#%02X%02X%02X" % background,
            "box": {"x": round(x / WIDTH, 4), "y": round(y / HEIGHT, 4), "w": round(w / WIDTH, 4), "h": round(h / HEIGHT, 4)},
            "garmentPixels": int(target.sum()), "ghostPixels": int(ghost.sum()) if generated is not None else 0,
            "ai": generated is not None, "framing": framing, "matte": "mask-blur" if alpha is None else "birefnet"}
    return Packshot(out.getvalue(), info)


def slugify(value) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", str(value or "")).strip("_")[:60] or "unknown"


def output_name(row: dict) -> str:
    """{marca}_{categoria}_{produto}[_{imagem}].png — determinístico, só caracteres seguros."""
    stem = "_".join(slugify(row.get(k)) for k in ("brand", "category", "product_id"))
    image_id = str(row.get("id") or "")
    return stem + (f"_{slugify(image_id)[:8]}" if image_id and image_id != str(row.get("product_id")) else "") + ".png"


# ───────────────────────── banco (SQLAlchemy: MySQL ou PostgreSQL)

@dataclass
class TableSpec:
    table: str = "catalog_images"
    id_column: str = "id"
    url_column: str = "image_url"
    out_column: str = "processed_image_url"

    def __post_init__(self):
        for name in (self.table, self.id_column, self.url_column, self.out_column):
            if not IDENT.match(name):
                raise SystemExit(f"identificador SQL inválido: {name!r}")

    @property
    def catalog(self) -> bool:
        return self.table == "catalog_images"


def engine_from_env(echo: bool = False):
    """DATABASE_URL/FAI_DATABASE_URL ou as MYSQL_* do backend. A URL nunca é impressa com senha."""
    from sqlalchemy import create_engine
    from sqlalchemy.engine import URL
    url = os.getenv("FAI_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not url:
        password = os.getenv("MYSQL_PASSWORD")
        if not password:
            raise SystemExit("defina DATABASE_URL (ex.: mysql+pymysql://user:senha@host:3306/fashionai) ou as MYSQL_* do backend")
        url = URL.create("mysql+pymysql", username=os.getenv("MYSQL_USER", "fashionai"), password=password,
                         host=os.getenv("MYSQL_HOST", "localhost"), port=int(os.getenv("MYSQL_PORT", "3306")),
                         database=os.getenv("MYSQL_DATABASE", "fashionai"), query={"charset": "utf8mb4"})
    return create_engine(url, pool_pre_ping=True, echo=echo)


def describe(engine) -> str:
    return engine.url.render_as_string(hide_password=True)


def ensure_column(engine, spec: TableSpec):
    """Cria a coluna de saída se faltar (o lote antigo fazia o mesmo). MySQL via information_schema; PostgreSQL com IF NOT EXISTS."""
    from sqlalchemy import text
    with engine.begin() as conn:
        if engine.dialect.name == "postgresql":
            conn.execute(text(f"ALTER TABLE {spec.table} ADD COLUMN IF NOT EXISTS {spec.out_column} TEXT"))
            return
        exists = conn.execute(text("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() "
                                   "AND TABLE_NAME = :t AND COLUMN_NAME = :c"), {"t": spec.table, "c": spec.out_column}).scalar()
        if not exists:
            conn.execute(text(f"ALTER TABLE {spec.table} ADD COLUMN {spec.out_column} TEXT NULL"))
            emit("column_added", table=spec.table, column=spec.out_column)


def pending_sql(spec: TableSpec, product_id: Optional[str] = None) -> str:
    """Fotos ainda sem packshot. Em catalog_images, junta produto e marca (categoria para o segmentador, nome do arquivo)
    e pula fotos recusadas; a canônica vem primeiro. Em outra tabela, lê as colunas que houver."""
    where = f"({spec.out_column} IS NULL OR {spec.out_column} = '')"
    if spec.catalog:
        sql = (f"SELECT i.{spec.id_column} AS id, i.{spec.url_column} AS image_url, i.product_id AS product_id, "
               f"p.category AS category, p.subcategory AS subcategory, p.product_name AS product_name, b.name AS brand "
               f"FROM catalog_images i JOIN catalog_products p ON p.id = i.product_id LEFT JOIN brands b ON b.id = p.brand_id "
               f"WHERE (i.{spec.out_column} IS NULL OR i.{spec.out_column} = '') AND i.usage_status <> 'REJECTED' "
               f"AND i.review_status <> 'REJECTED' AND p.ingestion_status <> 'REJECTED'")
        if product_id:
            sql += " AND i.product_id = :product_id"
        return sql + " ORDER BY i.is_canonical DESC, i.is_primary DESC, i.updated_at DESC LIMIT :limit"
    sql = f"SELECT * FROM {spec.table} WHERE {where}"
    if product_id:
        sql += f" AND {spec.id_column} = :product_id"
    return sql + f" ORDER BY {spec.id_column} LIMIT :limit"


def normalize_row(raw: dict, spec: TableSpec) -> dict:
    """Linha de qualquer tabela no formato que o lote usa (id, image_url, product_id, brand, category, subcategory)."""
    row = {k.lower(): v for k, v in raw.items()}
    brand = row.get("brand")
    if isinstance(brand, dict):
        brand = brand.get("name")
    return {"id": row.get("id", row.get(spec.id_column.lower())), "image_url": row.get("image_url", row.get(spec.url_column.lower(), row.get("url"))),
            "product_id": row.get("product_id", row.get("id")), "brand": brand or row.get("brand_name") or "FashionAI",
            "category": row.get("category"), "subcategory": row.get("subcategory"), "product_name": row.get("product_name") or row.get("name")}


def fetch_pending(engine, spec: TableSpec, limit: int, product_id: Optional[str] = None) -> list[dict]:
    from sqlalchemy import text
    with engine.connect() as conn:
        rows = conn.execute(text(pending_sql(spec, product_id)), {"limit": limit, "product_id": product_id}).mappings().all()
    return [normalize_row(dict(r), spec) for r in rows]


def store_result(engine, spec: TableSpec, row_id, value: str) -> bool:
    """UPDATE só se a coluna ainda estiver vazia (outra execução pode ter gravado antes)."""
    from sqlalchemy import text
    with engine.begin() as conn:
        result = conn.execute(text(f"UPDATE {spec.table} SET {spec.out_column} = :v WHERE {spec.id_column} = :id "
                                   f"AND ({spec.out_column} IS NULL OR {spec.out_column} = '')"), {"v": value, "id": row_id})
        return result.rowcount == 1


# ───────────────────────── o lote

@dataclass
class Options:
    out_dir: Path = Path("output_images")
    public_base_url: Optional[str] = None
    dry_run: bool = False
    measure_only: bool = False
    no_ai: bool = False
    shadow: bool = True
    foreground_body: bool = True
    lenient_cleanup: bool = True
    min_interval: float = 1.0
    host_limit: int = 3                     # URLs seguidas em 429/503 até parar de consultar o host (0 desliga)
    report: Optional[Path] = None
    engine: str = "sd"                      # sd: rembg + Stable Diffusion · fashn-open: parser FASHN + BiRefNet + LaMa
    weights: Optional[Path] = None          # pasta do fashn_open.py download (engine fashn-open)
    device: str = "auto"
    lama_max_side: int = 1024
    lama_margin: int = 4                    # px a mais em volta da região fantasma: o LaMa não copia a franja de pele
    extra: dict = field(default_factory=dict)


class GhostPipeline:
    """Uma foto por vez: baixa → segmenta → mede → (IA) → compõe → grava PNG → UPDATE. Erros ficam no relatório."""

    def __init__(self, renderer: Optional[SdGhostRenderer], options: Options, *, fetch: Optional[Fetch] = None,
                 provider=None, segmenter=None, filler: Optional[LamaInpainter] = None, open_provider: Optional[FashnOpenProvider] = None):
        self.renderer, self.options, self.filler = renderer, options, filler
        self.fetch = fetch or requests_fetch(min_interval=options.min_interval, host_limit=options.host_limit)
        if options.engine == "fashn-open":
            self.segmenter, self.provider = segmenter, provider            # o rembg não entra neste engine
            self.open_provider = open_provider or FashnOpenProvider(options.weights, options.device)
        else:
            self.segmenter = segmenter or GarmentSegmenter()
            self.provider = provider or LocalClothProvider(segmenter=self.segmenter)
            self.open_provider = None
        self.rows: list[dict] = []

    def process(self, row: dict) -> dict:
        base = {"id": row.get("id"), "product_id": row.get("product_id"), "brand": row.get("brand"), "category": row.get("category"),
                "subcategory": row.get("subcategory"), "source_url_sha256": hashlib.sha256(str(row.get("image_url") or "").encode()).hexdigest()}
        started = time.monotonic()
        try:
            data, final_url = resolve_image(str(row.get("image_url") or ""), self.fetch)
            image, original = open_image(data)
            fusion = alpha = None
            if self.open_provider is not None:
                fusion = self.open_provider.analyse(image, row.get("category"), row.get("subcategory"))
                masks = fusion.photo_masks(row.get("category"), row.get("subcategory"))
            else:
                masks = masks_for(image, row.get("category"), row.get("subcategory"), self.provider, self.segmenter, self.options.foreground_body)
            target, forbidden, metrics = measure(image, masks, row.get("category"), row.get("subcategory"), original, self.options.lenient_cleanup)
            metrics.update(sourceSha256=hashlib.sha256(data).hexdigest(), originalWidth=original[0], originalHeight=original[1], engine=self.options.engine)
            if fusion is not None:
                metrics["fashnOpen"] = {"mode": fusion.mode, "personDetected": fusion.person, "parserLabelsKept": list(fusion.kept)}
                # o alfa fino do BiRefNet só vale dentro da peça limpa (mais 1 px de franja); fora dela é zero
                alpha = np.where(ndimage.binary_dilation(target, iterations=1), fusion.alpha, 0).astype(np.float32)
            if self.options.measure_only:
                return {**base, "status": "MEASURED", "metrics": metrics, "image_path": None}
            ghost = ghost_mask(target, forbidden)
            generated = None
            if self.filler is not None and not self.options.no_ai and ghost.any():
                hole = ndimage.binary_dilation(ghost, iterations=self.options.lama_margin) if self.options.lama_margin > 0 else ghost
                # o corpo e as outras peças também ficam mascarados para o LaMa: ele preenche a gola a partir do tecido e do
                # fundo, nunca da pele do pescoço logo acima (o resultado fora da região fantasma é descartado na composição)
                init, mask, box = sd_inputs(image, target, hole, self.options.lama_max_side, extra_mask=forbidden)
                patch = self.filler.inpaint(init, mask).resize((box[2] - box[0], box[3] - box[1]), Image.Resampling.LANCZOS)
                generated = image.copy()
                generated.paste(patch, (box[0], box[1]))
                metrics["lama"] = {"device": self.filler.device, "inpaintSize": [init.width, init.height], "margin": self.options.lama_margin}
            if self.renderer is not None and not self.options.no_ai and ghost.any():
                basis = generated if generated is not None else image        # com LaMa antes, o SD parte do preenchimento dele
                init, mask, box = sd_inputs(basis, target, ghost, self.renderer.max_side)
                patch = self.renderer.render(init, mask).resize((box[2] - box[0], box[3] - box[1]), Image.Resampling.LANCZOS)
                generated = basis.copy()
                generated.paste(patch, (box[0], box[1]))
                metrics["sd"] = {"model": self.renderer.model, "device": self.renderer.device, "steps": self.renderer.steps,
                                 "guidance": self.renderer.guidance, "seed": self.renderer.seed, "controlnet": self.renderer.controlnet,
                                 "inpaintSize": [init.width, init.height]}
            shot = compose_packshot(image, target, generated, ghost, shadow=self.options.shadow, alpha=alpha)
            name = output_name(row)
            path = self.options.out_dir / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(shot.data)
            value = f"{self.options.public_base_url.rstrip('/')}/{name}" if self.options.public_base_url else path.as_posix()
            info = {**shot.info, **metrics, "sourceUrl": final_url}
            path.with_suffix(".json").write_text(json.dumps(info, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
            return {**base, "status": "RENDERED", "image_path": path.as_posix(), "stored_value": value, "metrics": info,
                    "seconds": round(time.monotonic() - started, 1)}
        except PhotoSkip as skip:
            emit("photo_skipped", id=str(base["id"]), status=skip.status, reason=str(skip))
            return {**base, "status": skip.status, "reason": str(skip), "metrics": skip.metrics, "image_path": None}
        except (ImportError, OSError, ValueError, RuntimeError, MemoryError) as error:
            # uma foto com erro (modelo sem memória, arquivo corrompido, rede) não derruba o lote
            reason = str(error) if isinstance(error, ValueError) and str(error).isupper() and len(str(error)) < 90 else type(error).__name__
            emit("photo_failed", id=str(base["id"]), reason=reason)
            return {**base, "status": "FAILED", "reason": reason, "image_path": None}
        finally:
            if self.renderer is not None:
                self.renderer.free()
            elif self.filler is not None:
                free_memory(self.filler.device)
            else:
                gc.collect()

    def run(self, rows: list[dict], store: Optional[Callable[[dict, str], bool]] = None) -> list[dict]:
        self.options.out_dir.mkdir(parents=True, exist_ok=True)
        report = self.options.report or (self.options.out_dir / "report.jsonl")
        try:
            from tqdm import tqdm
            progress = tqdm(rows, unit="foto", desc="packshot")
        except ImportError:                                 # pragma: no cover - tqdm é opcional
            progress = rows
        with report.open("a", encoding="utf-8") as audit:
            for row in progress:
                result = self.process(row)
                if result["status"] == "RENDERED" and store is not None and not self.options.dry_run:
                    result["stored"] = store(row, result["stored_value"])
                self.rows.append(result)
                audit.write(json.dumps(result, ensure_ascii=False, default=str) + "\n")
                audit.flush()
                if hasattr(progress, "set_postfix"):
                    counts = {}
                    for r in self.rows:
                        counts[r["status"]] = counts.get(r["status"], 0) + 1
                    progress.set_postfix(counts, refresh=False)
        self.write_manifest()
        return self.rows

    def write_manifest(self):
        """metadata_clean.json: produto, marca, categoria, arquivo e status de cada foto; e a lista para a quarentena."""
        rows = [{k: r.get(k) for k in ("id", "product_id", "brand", "category", "subcategory", "image_path", "stored_value", "status", "reason")}
                | {"heightFraction": (r.get("metrics") or {}).get("sourceGarmentHeightFraction")} for r in self.rows]
        counts = {}
        for r in self.rows:
            counts[r["status"]] = counts.get(r["status"], 0) + 1
        manifest = {"version": VERSION, "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "counts": counts,
                    "images": rows, "complete": True}
        (self.options.out_dir / "metadata_clean.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
        ineligible = [{"productId": r["product_id"], "imageId": r["id"], "heightFraction": (r.get("metrics") or {}).get("sourceGarmentHeightFraction"),
                       "reason": r.get("reason")} for r in self.rows if r["status"] == "INELIGIBLE"]
        (self.options.out_dir / "ineligible.json").write_text(json.dumps({"version": VERSION, "minimumHeightFraction": MIN_SOURCE_HEIGHT,
                                                                           "note": "candidatos a quarentena; nada foi apagado — use quarantine_unsafe_products.py",
                                                                           "products": ineligible}, ensure_ascii=False, indent=1), encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0], formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--limit", type=int, default=50, help="fotos pendentes nesta execução")
    ap.add_argument("--product-id", help="só as fotos de um produto")
    ap.add_argument("--table", default="catalog_images", help="tabela (catalog_images junta produto e marca; outra lê as colunas que houver)")
    ap.add_argument("--id-column", default="id")
    ap.add_argument("--url-column", default="image_url")
    ap.add_argument("--out-column", default="processed_image_url")
    ap.add_argument("--out-dir", type=Path, default=Path("output_images"))
    ap.add_argument("--public-base-url", help="grava URL pública (base + nome do arquivo) em vez do caminho local")
    ap.add_argument("--model", default=DEFAULT_MODEL, help=f"modelo de inpainting do Hugging Face (SDXL: {SDXL_MODEL})")
    ap.add_argument("--controlnet", action="store_true", help=f"usa {CONTROLNET_MODEL} (SD 1.5)")
    ap.add_argument("--device", default="auto", choices=["auto", "cuda", "mps", "cpu"])
    ap.add_argument("--steps", type=int, default=30)
    ap.add_argument("--guidance", type=float, default=7.5)
    ap.add_argument("--seed", type=int)
    ap.add_argument("--max-side", type=int, help="lado máximo do recorte enviado ao modelo (512 SD1.5, 1024 SDXL)")
    ap.add_argument("--offload", action="store_true", help="CUDA com pouca memória: blocos do modelo na GPU só na hora de usar")
    ap.add_argument("--prompt", default=PROMPT)
    ap.add_argument("--negative-prompt", default=NEGATIVE)
    ap.add_argument("--no-ai", action="store_true", help="só o recorte no quadro (sem Stable Diffusion; no fashn-open, também sem LaMa)")
    ap.add_argument("--engine", choices=["sd", "fashn-open"], default="sd",
                    help="sd: rembg + Stable Diffusion · fashn-open: parser FASHN (rótulos por categoria) + BiRefNet + LaMa, e --sd por cima")
    ap.add_argument("--weights", type=Path, default=os.getenv("CATALOG_FASHN_OPEN_WEIGHTS") or None,
                    help="pasta dos pesos do fashn-open (python scripts/catalog/fashn_open.py download --dest …) ou CATALOG_FASHN_OPEN_WEIGHTS")
    ap.add_argument("--sd", action="store_true", help="com --engine fashn-open: Stable Diffusion inpainting por cima do LaMa na região fantasma")
    ap.add_argument("--lama-max-side", type=int, default=1024, help="lado máximo do recorte enviado ao LaMa")
    ap.add_argument("--lama-margin", type=int, default=4, help="px a mais em volta da região fantasma que o LaMa preenche (esconde a franja de pele)")
    ap.add_argument("--no-shadow", action="store_true")
    ap.add_argument("--no-foreground-body", action="store_true", help="sem parser humano, NÃO deduzir o corpo do primeiro plano geral")
    ap.add_argument("--strict-cleanup", action="store_true", help="só a limpeza estrita do catálogo (contorno fino não classificado → REVIEW)")
    ap.add_argument("--min-interval", type=float, default=1.0, help="segundos mínimos entre downloads no mesmo host (CDNs devolvem 429 em rajada)")
    ap.add_argument("--host-retry-limit", type=int, default=3,
                    help="URLs seguidas em 429/503 até parar de consultar o host nesta execução (as demais viram RETRY sem pedido; 0 desliga)")
    ap.add_argument("--measure-only", action="store_true", help="só mede a altura da peça e escreve o relatório (nada gerado nem gravado)")
    ap.add_argument("--dry-run", action="store_true", help="gera os arquivos, mas não grava no banco")
    ap.add_argument("--no-ensure-column", action="store_true", help="não cria a coluna de saída se faltar")
    ap.add_argument("--input", type=Path, help="JSON com as linhas (id, image_url, product_id, brand, category, subcategory) no lugar do banco")
    ap.add_argument("--verbose", action="store_true")
    return ap


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(asctime)s %(message)s", stream=sys.stderr)
    for noisy in ("numba", "PIL", "urllib3", "filelock", "huggingface_hub", "diffusers", "matplotlib"):
        logging.getLogger(noisy).setLevel(logging.WARNING)       # --verbose é do lote, não do JIT do rembg
    spec = TableSpec(args.table, args.id_column, args.url_column, args.out_column)
    options = Options(out_dir=args.out_dir, public_base_url=args.public_base_url, dry_run=args.dry_run, measure_only=args.measure_only,
                      no_ai=args.no_ai, shadow=not args.no_shadow, foreground_body=not args.no_foreground_body,
                      lenient_cleanup=not args.strict_cleanup, min_interval=args.min_interval, host_limit=args.host_retry_limit,
                      engine=args.engine, weights=args.weights,
                      device=args.device, lama_max_side=args.lama_max_side, lama_margin=args.lama_margin)
    if args.engine == "fashn-open" and not args.weights:
        raise SystemExit("--engine fashn-open precisa de --weights (ou CATALOG_FASHN_OPEN_WEIGHTS): python scripts/catalog/fashn_open.py download --dest /pasta")
    engine = None
    if args.input:
        raw = json.loads(args.input.read_text(encoding="utf-8"))
        rows = [normalize_row(r, spec) for r in (raw.get("products", raw.get("images", [])) if isinstance(raw, dict) else raw)][: args.limit]
        emit("source", kind="file", rows=len(rows))
    else:
        engine = engine_from_env()
        emit("source", kind="database", target=describe(engine), table=spec.table)
        if not args.measure_only and not args.no_ensure_column and not args.dry_run:
            ensure_column(engine, spec)
        rows = fetch_pending(engine, spec, args.limit, args.product_id)
    emit("pipeline_started", version=VERSION, pending=len(rows), mode="measure" if args.measure_only else "dry-run" if args.dry_run else "apply",
         ai=not (args.no_ai or args.measure_only), engine=args.engine)
    renderer = filler = None
    if not args.no_ai and not args.measure_only and rows:
        if args.engine == "fashn-open":
            filler = LamaInpainter(args.weights, args.device)
        if args.engine == "sd" or args.sd:
            renderer = SdGhostRenderer(args.model, args.device, args.controlnet, args.steps, args.guidance, args.seed, args.max_side,
                                       args.offload, args.prompt, args.negative_prompt)
    store = (lambda row, value: store_result(engine, spec, row["id"], value)) if engine is not None else None
    results = GhostPipeline(renderer, options, filler=filler).run(rows, store)
    counts = {}
    for r in results:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    emit("pipeline_finished", **counts, out_dir=str(options.out_dir))
    print(f"Peça inteira local: {len(results)} fotos · " + " · ".join(f"{k}: {v}" for k, v in sorted(counts.items()))
          + f" · saída em {options.out_dir} (report.jsonl, metadata_clean.json, ineligible.json)")
    return 0 if not results or counts.get("RENDERED") or counts.get("MEASURED") else 2


if __name__ == "__main__":
    raise SystemExit(main())
