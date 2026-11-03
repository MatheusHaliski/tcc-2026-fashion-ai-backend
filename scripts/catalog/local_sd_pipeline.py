"""O lote local de peça inteira: as opções e o pipeline por foto (baixa → segmenta → mede → IA → compõe → grava)."""
from __future__ import annotations

import gc
import hashlib
import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

import numpy as np
from PIL import Image
from scipy import ndimage

from photo_set import LocalClothProvider
from whole_frame import GarmentSegmenter
from fashn_open import FashnOpenProvider, LamaInpainter
from local_sd_base import PhotoSkip, emit, free_memory
from local_sd_compose import compose_packshot, output_name
from local_sd_download import Fetch, open_image, requests_fetch, resolve_image
from local_sd_masks import ghost_mask, masks_for, measure
from local_sd_outputs import LotOutputs
from local_sd_renderer import SdGhostRenderer, sd_inputs

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
    photo_set: bool = False                 # também grava photo-sets/<id>/{whole,fabric}.png + set.json (photoSet do catálogo)
    extra: dict = field(default_factory=dict)


class GhostPipeline(LotOutputs):
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
        data = None
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
                metrics["fashnOpen"] = {"mode": fusion.mode, "personDetected": fusion.person, "parserLabelsKept": list(fusion.kept),
                                        "evidence": fusion.evidence, "attestations": fusion.attestations()}
                # o alfa fino do BiRefNet só vale dentro da peça limpa (mais 1 px de franja); fora dela é zero
                alpha = np.where(ndimage.binary_dilation(target, iterations=1), fusion.alpha, 0).astype(np.float32)
            if self.options.measure_only:
                return {**base, "status": "MEASURED", "metrics": metrics, "image_path": None}
            ghost = ghost_mask(target, forbidden, category=row.get("category"))
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
            result = {**base, "status": "RENDERED", "image_path": path.as_posix(), "stored_value": value, "metrics": info,
                      "seconds": round(time.monotonic() - started, 1)}
            if self.options.photo_set and fusion is not None:
                result["photoSet"] = self.write_photo_set(row, data, info, image=image, target=target, ghost=ghost, generated=generated, alpha=alpha)
            return result
        except PhotoSkip as skip:
            emit("photo_skipped", id=str(base["id"]), status=skip.status, reason=str(skip))
            result = {**base, "status": skip.status, "reason": str(skip), "metrics": skip.metrics, "image_path": None}
            if self.options.photo_set and self.open_provider is not None and data is not None and skip.status in ("INELIGIBLE", "REVIEW"):
                result["photoSet"] = self.write_photo_set(row, data, skip.metrics or {}, status=skip.status, reason=str(skip))
            return result
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
                can_store_photo_set = (not self.options.photo_set or
                                       (result.get("photoSet") or {}).get("status") == "READY")
                if (result["status"] == "RENDERED" and can_store_photo_set and
                        store is not None and not self.options.dry_run):
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
