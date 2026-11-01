"""Configuração do pod do RunPod: valida as variáveis do pod e grava o arquivo que o runpod_start.sh carrega.

No RunPod não há Docker nem compose: Redis, RustFS, API e workers rodam como processos no mesmo contêiner, falando
por 127.0.0.1. Este módulo reproduz o que o compose.yaml fazia com o .env (REDIS_URL montada a partir de
REDIS_PASSWORD, S3_ENDPOINT local) e acrescenta os padrões da Fase 2 numa A100 80 GB (bf16 completo + Lightning).

    python3 -m services.garment_gpu.scripts.runpod_env --out /tmp/fai-runpod/fai.env --redis-conf /tmp/fai-runpod/redis.conf

Só usa a biblioteca padrão (roda antes da venv existir). Nunca imprime valores, só nomes de variáveis."""
from __future__ import annotations

import argparse
import os
import re
import shlex
import sys
from pathlib import Path
from urllib.parse import quote

from services.garment_gpu import config, security

WORKSPACE = "/workspace"
LIGHTNING_REPO = "lightx2v/Qwen-Image-Edit-2511-Lightning"
LIGHTNING_FILE = "Qwen-Image-Edit-2511-Lightning-8steps-V1.0-bf16.safetensors"
REDIS_PORT = 6379
S3_PORT = 9000

# Padrões do pod (A100 80 GB). Uma variável definida no pod sempre vence o padrão.
DEFAULTS = {
    "FAI_DEVICE": "cuda",
    "RECON_QUANTIZE": "none",
    "RECON_OFFLOAD": "none",
    "RECON_LORA_PATH": LIGHTNING_REPO,
    "RECON_LORA_WEIGHT_NAME": LIGHTNING_FILE,
    "RECON_STEPS": "8",
    "RECON_TRUE_CFG": "1.0",
    "RECON_MAX_ATTEMPTS": "1",      # orçamento: uma geração por vista; o portão de custo decide se sobe
    "RECON_BACK_VIEW": "true",
    "RECON_MAX_SIDE": "1024",
    "METRICS_PUBLIC": "false",      # a URL do proxy do RunPod é pública e não filtra rotas
    "RETENTION_DAYS": "30",
    "S3_BUCKET": "fai-garment-assets",
    "SEGMENT_GPU": "0",
    "RECONSTRUCT_GPU": "0",
    "PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:True",
}

# Segredos: digitados pelo usuário como Secrets do RunPod. FAI_API_KEYS (só SHA-256) ou FAI_API_KEY (legada).
REQUIRED = ("REDIS_PASSWORD", "S3_ACCESS_KEY", "S3_SECRET_KEY")
SECRETS = REQUIRED + ("FAI_API_KEYS", "FAI_API_KEY", "HF_TOKEN")

# Variáveis do pod repassadas aos processos (além de DEFAULTS e SECRETS).
PASS_PREFIXES = ("RECON_", "QA_", "MASK_", "S3_", "HF_", "FAI_", "WORKER_", "RATE_LIMIT_", "MAX_", "JOB_",
                 "SEGMENT_", "RECONSTRUCT_", "BOX_", "TEXT_", "DETECTOR_", "SEGMENTER_", "RETENTION_", "METRICS_",
                 "LOG_LEVEL")
# Topologia do pod: sempre local, nunca vem do painel.
LOCAL_ONLY = ("REDIS_URL", "S3_ENDPOINT", "PRIVATE_BIND")

SAFE_SECRET = re.compile(r"^[!#-&(-\[\]-~]+$")   # ASCII visível sem espaço, aspas nem barra invertida
TEMPLATE = re.compile(r"\{\{.*\}\}")


class PodConfigError(ValueError):
    """Configuração do pod inválida. A mensagem cita só nomes de variáveis, nunca valores."""


def _problems(env) -> list[str]:
    problems = []
    for name in SECRETS:
        value = env.get(name, "")
        if value and TEMPLATE.search(value):
            problems.append(f"{name}: o RunPod não resolveu o segredo (confira o nome em {{{{ RUNPOD_SECRET_... }}}})")
    for name in REQUIRED:
        value = env.get(name, "").strip()
        if not value:
            problems.append(f"{name}: obrigatória e vazia")
        elif value.upper().startswith("CHANGE_ME"):
            problems.append(f"{name}: ainda tem o valor de exemplo (CHANGE_ME...)")
        elif not SAFE_SECRET.match(value):
            problems.append(f"{name}: use só caracteres visíveis, sem espaço, aspas ou barra invertida "
                            "(ex.: openssl rand -hex 32)")
    if len(env.get("S3_ACCESS_KEY", "").strip()) < 3 or len(env.get("S3_SECRET_KEY", "").strip()) < 8:
        problems.append("S3_ACCESS_KEY/S3_SECRET_KEY: o RustFS exige ao menos 3 e 8 caracteres")
    if not env.get("FAI_API_KEYS", "").strip() and not env.get("FAI_API_KEY", "").strip():
        problems.append("FAI_API_KEYS: obrigatória (cliente:sha256:escopos;... — a mesma do .env da VM)")
    return problems


def build(env, workspace: str = WORKSPACE) -> dict[str, str]:
    """Junta padrões + variáveis do pod + topologia local e valida tudo como o worker e a API fariam ao subir."""
    problems = _problems(env)
    if problems:
        raise PodConfigError("configuração do pod incompleta:\n  - " + "\n  - ".join(dict.fromkeys(problems)))
    merged = dict(DEFAULTS)
    merged["HF_HOME"] = f"{workspace}/hf"
    for name, value in env.items():
        if name in LOCAL_ONLY:
            continue
        if name in SECRETS or name in DEFAULTS or name.startswith(PASS_PREFIXES):
            merged[name] = value.strip()
    password = quote(merged["REDIS_PASSWORD"], safe="")
    merged["REDIS_URL"] = f"redis://:{password}@127.0.0.1:{REDIS_PORT}/0"
    merged["S3_ENDPOINT"] = f"http://127.0.0.1:{S3_PORT}"
    try:
        config.load(merged)
        security.parse_keys(merged.get("FAI_API_KEYS", ""), merged.get("FAI_API_KEY", ""))
    except ValueError as exc:   # mensagens de config/security citam nomes e faixas, não segredos
        raise PodConfigError(f"configuração do pod inválida: {exc}") from None
    return {name: merged[name] for name in sorted(merged) if merged[name] != ""}


def render_env(values: dict[str, str]) -> str:
    lines = ["# Gerado por runpod_env.py a cada subida do pod. Contém segredos: não copie nem versione."]
    lines += [f"{name}={shlex.quote(value)}" for name, value in values.items()]
    return "\n".join(lines) + "\n"


def render_redis_conf(values: dict[str, str], workspace: str = WORKSPACE) -> str:
    """Redis só no loopback, com senha e AOF no volume (as filas sobrevivem a parar e ligar o pod)."""
    return "\n".join([
        "bind 127.0.0.1",
        "protected-mode yes",
        f"port {REDIS_PORT}",
        f"dir {workspace}/redis",
        "appendonly yes",
        "save 300 1",
        f'requirepass "{values["REDIS_PASSWORD"]}"',
        "",
    ])


def write_private(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write(content)
    os.chmod(path, 0o600)


def summary(values: dict[str, str]) -> str:
    """Resumo seguro para o log: só a configuração não secreta da Fase 2."""
    shown = ("RECON_QUANTIZE", "RECON_OFFLOAD", "RECON_STEPS", "RECON_TRUE_CFG", "RECON_MAX_ATTEMPTS",
             "RECON_BACK_VIEW", "RECON_MAX_SIDE", "RECON_LORA_PATH", "METRICS_PUBLIC", "HF_HOME")
    return " ".join(f"{name}={values.get(name, '')}" for name in shown)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, required=True, help="arquivo de variáveis (permissão 600)")
    parser.add_argument("--redis-conf", type=Path, required=True, help="redis.conf com a senha (permissão 600)")
    parser.add_argument("--workspace", default=os.environ.get("FAI_WORKSPACE", WORKSPACE))
    args = parser.parse_args(argv)
    try:
        values = build(os.environ, args.workspace)
    except PodConfigError as exc:
        print(exc, file=sys.stderr)
        return 2
    write_private(args.out, render_env(values))
    write_private(args.redis_conf, render_redis_conf(values, args.workspace))
    print(f"configuração do pod ok: {summary(values)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
