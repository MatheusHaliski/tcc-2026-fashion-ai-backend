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
import json
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

# Fachada: CLI (download/verify/smoke) aqui; rótulos, fusão, pesos e modelos em fashn_open_*.py. Os nomes de antes
# continuam importáveis deste módulo (process_local_sd, photoset_runtime e os testes).
from photo_set import SET_SUBCATEGORIES, PhotoMasks  # noqa: E402,F401
from whole_frame import FULL, LOWER, UPPER, cloth_class  # noqa: E402,F401
from fashn_open_labels import (BODY_COVERAGE_TO_LABELS, CATEGORY_TO_BODY_COVERAGE, EXTRA_KEEP, HUMAN_LABELS,  # noqa: E402,F401
                               IDS_TO_LABELS, LABELS_TO_IDS, MAX_BODY_INSIDE, MAX_OCCLUDER, OCCLUDER_LABELS, PERSON_LABELS,
                               VERIFIED_MODES, fashn_category, garment_label_ids)
from fashn_open_fusion import Fusion, evidence_of, fuse, keep_large, settle_extent  # noqa: E402,F401
from fashn_open_weights import (ASSETS_FILE, HF_URL, UA, _selected, assets, download, hf_url, sha256_of,  # noqa: E402,F401
                                urllib_fetch, verify, verify_component)
from fashn_open_models import (BIREFNET_SIDE, IMAGENET_MEAN, IMAGENET_STD, PACKAGE, BiRefNetMatting,  # noqa: E402,F401
                               FashnOpenProvider, LamaInpainter, _device, import_birefnet)

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
