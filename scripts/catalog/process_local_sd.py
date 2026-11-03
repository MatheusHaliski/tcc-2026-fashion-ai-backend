#!/usr/bin/env python3
"""Peça inteira (Total frame) LOCAL com Stable Diffusion: packshot "ghost mannequin" sem API paga.

    .venv/bin/python scripts/catalog/process_local_sd.py --measure-only --limit 5000   # 1. só mede: relatório da altura (< 25% → quarentena)
    .venv/bin/python scripts/catalog/process_local_sd.py --limit 20 --dry-run          # 2. ensaio: gera em ./output_images, não grava no banco
    .venv/bin/python scripts/catalog/process_local_sd.py --limit 200                   # 3. gera e grava processed_image_url

Etapas por foto: baixa (link direto ou og:image de página HTML) → rembg LOCAL com a classe de roupa da categoria (cima,
baixo, corpo inteiro; calçado/acessório usa o recorte geral) → medição e limpeza da máscara (pessoa, outras peças, riscos e
silhuetas fora do perímetro; altura da peça menor que 25% da foto = INELEGÍVEL, nada é gerado) → inpainting só onde o
corpo aparecia POR DENTRO da peça (gola, punhos, barra; preserva o vão entre pernas de calças) com Stable Diffusion Inpainting local, opcional
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
import json
import logging
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

# Fachada: CLI (argparse e main) aqui; base, download, máscaras, IA, composição, banco, saídas e o pipeline em
# local_sd_*.py. Os nomes de antes continuam importáveis deste módulo (testes, photoset_runtime, scripts/cloud).
from photo_preflight import MIN_SOURCE_HEIGHT, fit_box, inspect_source  # noqa: E402,F401
from photo_set import MAX_ANALYSIS_SIDE, MAX_INPUT_PIXELS, PHOTO_SET_VERSION, LocalClothProvider, PhotoMasks, clean_target_mask  # noqa: E402,F401
from photo_set import _fabric_box as fabric_box  # noqa: E402,F401
from whole_frame import HEIGHT, WIDTH, GarmentSegmenter, cloth_class  # noqa: E402,F401
from fashn_open import FashnOpenProvider, LamaInpainter  # noqa: E402,F401
from photo_set_quality import apply_quality_gate  # noqa: E402,F401
from local_sd_base import (BACKGROUND, CONTROLNET_MODEL, DEFAULT_MODEL, IDENT, IMAGE_EXT, LOG, MAX_BYTES,  # noqa: E402,F401
                           MIN_SIDE, NEGATIVE, PROMPT, SDXL_MODEL, UA, VERSION, PhotoSkip, emit, free_memory, pick_device)
from local_sd_download import HOST_PAUSED, Fetch, og_image, open_image, polite_fetch, requests_fetch, resolve_image  # noqa: E402,F401
from local_sd_masks import LENIENT_REASONS, body_from_foreground, ghost_mask, lenient_clean, masks_for, measure  # noqa: E402,F401
from local_sd_renderer import SdGhostRenderer, make_inpaint_condition, sd_inputs  # noqa: E402,F401
from local_sd_compose import Packshot, compose_packshot, output_name, slugify  # noqa: E402,F401
from local_sd_db import (TableSpec, describe, engine_from_env, ensure_column, fetch_pending,  # noqa: E402,F401
                         normalize_row, pending_sql, store_result)
from local_sd_outputs import LotOutputs  # noqa: E402,F401
from local_sd_pipeline import GhostPipeline, Options  # noqa: E402,F401


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
    ap.add_argument("--photo-set", action="store_true",
                    help="com --engine fashn-open: grava também photo-sets/<id>/{whole,fabric}.png + set.json, que process_photo_sets.py --from-lot importa como photoSet do catálogo")
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
                      device=args.device, lama_max_side=args.lama_max_side, lama_margin=args.lama_margin, photo_set=args.photo_set)
    if args.engine == "fashn-open" and not args.weights:
        raise SystemExit("--engine fashn-open precisa de --weights (ou CATALOG_FASHN_OPEN_WEIGHTS): python scripts/catalog/fashn_open.py download --dest /pasta")
    if args.photo_set and args.engine != "fashn-open":
        raise SystemExit("--photo-set exige --engine fashn-open: é o único engine que atesta o preflight (complete/occluded/isolação)")
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
