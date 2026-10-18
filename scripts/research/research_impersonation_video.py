#!/usr/bin/env python3
"""Bounded, reproducible research of primary video-model sources; never uploads photos.

Fetches public documentation only. A successful fetch is not a GPU benchmark or
proof of commercial permission, regional availability, or supported VRAM.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import csv
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import urllib.error
import urllib.request

SOURCES = [
    ("Wan2.1 I2V", "https://huggingface.co/Wan-AI/Wan2.1-I2V-14B-480P/raw/main/README.md", "IMAGE_TO_VIDEO"),
    ("LTX Video", "https://huggingface.co/Lightricks/LTX-Video/raw/main/README.md", "IMAGE_TO_VIDEO"),
    ("HunyuanVideo I2V", "https://huggingface.co/tencent/HunyuanVideo-I2V/raw/main/README.md", "IMAGE_TO_VIDEO"),
    ("CogVideoX I2V", "https://huggingface.co/THUDM/CogVideoX-5b-I2V/raw/main/README.md", "IMAGE_TO_VIDEO"),
    ("AnimateDiff", "https://raw.githubusercontent.com/guoyww/AnimateDiff/main/README.md", "MOTION_CONTROL"),
    ("LivePortrait", "https://raw.githubusercontent.com/KwaiVGI/LivePortrait/main/readme.md", "PORTRAIT_ONLY"),
    ("Veo on Vertex", "https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation", "MANAGED_VIDEO"),
    ("FASHN VTON", "https://huggingface.co/fashn-ai/fashn-vton-1.5/raw/main/README.md", "VIRTUAL_TRY_ON_STILL"),
]
MAX_BYTES = 1_000_000


def fetch_source(source, timeout=20, opener=urllib.request.urlopen):
    name, url, approach = source
    record = dict(name=name, url=url, approach=approach,
                  queried_at=datetime.now(timezone.utc).isoformat(),
                  status="ERROR", license_declared=None,
                  commercial_use="REQUIRES_LICENSE_REVIEW",
                  vram_measured_gb=None, latency_measured_seconds=None,
                  region_verified=False, gpu_benchmark_executed=False)
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "FashionAI-reference-research/1.0"})
        with opener(request, timeout=timeout) as response:
            raw = response.read(MAX_BYTES + 1)
            if len(raw) > MAX_BYTES:
                raise ValueError("SOURCE_TOO_LARGE")
            text = raw.decode("utf-8", errors="replace")
            record.update(status="FETCHED", final_url=response.geturl(), sha256=hashlib.sha256(raw).hexdigest())
            license_match = re.search(r"^license:\s*([^\n]+)", text, re.MULTILINE)
            record["license_declared"] = license_match.group(1).strip() if license_match else None
            # Short verbatim lines are evidence, not independently verified capability.
            record["evidence_lines"] = [line[:400] for line in text.splitlines()
                                        if re.search(r"VRAM|GPU memory|license|480[Pp]|720[Pp]|seconds|commercial", line)][:12]
            record["document"] = text
    except (OSError, ValueError, urllib.error.URLError) as error:
        record["error"] = type(error).__name__
        if isinstance(error, urllib.error.HTTPError): record["http_status"] = error.code
    return record


def write_report(output, records):
    output.mkdir(parents=True, exist_ok=True)
    public = []
    for index, item in enumerate(records):
        record = dict(item)
        document = record.pop("document", None)
        if document is not None:
            (output / f"source-{index + 1}.txt").write_text(document, encoding="utf-8")
        public.append(record)
    (output / "sources.json").write_text(json.dumps(public, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    fields = ["name", "approach", "status", "license_declared", "url", "queried_at", "gpu_benchmark_executed"]
    with (output / "sources.csv").open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore", lineterminator="\n")
        writer.writeheader(); writer.writerows(public)
    rows = ["# Pesquisa de vídeo Aura Impersonation", "",
            "Consulta de fontes primárias. Nenhum peso foi baixado, nenhuma foto foi enviada e nenhuma inferência GPU foi executada.", "",
            "| Fonte | Abordagem | Consulta | Licença declarada |", "| --- | --- | --- | --- |"]
    rows += [f"| [{r['name']}]({r['url']}) | {r['approach']} | {r['status']} | {r.get('license_declared') or 'Revisar fonte'} |" for r in public]
    rows += ["", "## Decisão de implementação", "",
             "Preservar VTON como etapa de imagem vestida. Avaliar image-to-video controlado por referência para o corpo inteiro; LivePortrait isoladamente não atende a roupa e pose de corpo inteiro.",
             "VFX 2.5D é uma opção determinística distinta, que deve ser identificada como tal. Não declarar motion transfer onde só há fundo animado.",
             "Não selecionar modelo 14B/5B para a T4 apenas pelo nome: medir VRAM, offload, identidade, fidelidade da peça e qualidade temporal antes de habilitar produção.",
             "Confirmar disponibilidade e licença comercial da revisão exata, região/provedor, política de dados e custo. Linhas extraídas dos documentos não substituem essa avaliação.", "",
             "## Benchmark pendente", "",
             "Medir duração de aproximadamente 5s, 24fps, resolução, latência, VRAM e custo. Verificar identidade, cor/estampa/forma da roupa, oclusão, flicker e transição último→primeiro frame em dados autorizados."]
    (output / "REPORT.md").write_text("\n".join(rows) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("work/impersonation-research"))
    parser.add_argument("--timeout", type=int, default=20, choices=range(1, 31), metavar="1..30")
    args = parser.parse_args()
    with ThreadPoolExecutor(max_workers=4) as pool:
        records = list(pool.map(lambda source: fetch_source(source, args.timeout), SOURCES))
    write_report(args.output, records)
    print(json.dumps({"sources": len(records), "fetched": sum(r["status"] == "FETCHED" for r in records),
                      "gpuBenchmarkExecuted": False, "output": str(args.output)}))


if __name__ == "__main__": main()
