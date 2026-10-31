#!/usr/bin/env bash
# Confere o servidor GPU antes do `docker compose up`: driver NVIDIA, Docker, NVIDIA Container Toolkit e disco.
set -euo pipefail
ok() { printf '  \033[32mOK\033[0m %s\n' "$1"; }
bad() { printf '  \033[31mFALHA\033[0m %s\n' "$1"; FAILED=1; }
FAILED=0
CUDA_TEST_IMAGE="${CUDA_TEST_IMAGE:-nvidia/cuda:12.6.3-base-ubuntu22.04}"

echo "FashionAI garment GPU — preflight"
[ "$(uname -s)" = "Linux" ] && ok "Linux $(uname -m)" || bad "precisa de Linux x86-64 (Docker Desktop no macOS não expõe CUDA)"
if command -v nvidia-smi >/dev/null; then
  nvidia-smi --query-gpu=index,name,memory.total,driver_version --format=csv,noheader | sed 's/^/  GPU /'
  ok "driver NVIDIA (CUDA máxima suportada: $(nvidia-smi | sed -n 's/.*CUDA Version: \([0-9.]*\).*/\1/p'))"
else
  bad "nvidia-smi ausente: instale o driver NVIDIA"
fi
command -v docker >/dev/null && ok "$(docker --version)" || bad "Docker Engine ausente"
docker compose version >/dev/null 2>&1 && ok "$(docker compose version | head -1)" || bad "Docker Compose v2 ausente"
if docker run --rm --gpus all "$CUDA_TEST_IMAGE" nvidia-smi -L >/dev/null 2>&1; then
  ok "contêiner enxerga a GPU (NVIDIA Container Toolkit)"
else
  bad "contêiner sem GPU: sudo nvidia-ctk runtime configure --runtime=docker && sudo systemctl restart docker"
fi
FREE_GB=$(df -BG --output=avail /var/lib/docker 2>/dev/null | tail -1 | tr -dc '0-9' || echo 0)
if [ "${FREE_GB:-0}" -ge 80 ]; then ok "${FREE_GB} GB livres em /var/lib/docker"
else bad "${FREE_GB:-?} GB livres: reserve ≥ 20 GB (segmentação) e ≥ 80 GB com o Qwen-Image-Edit"; fi
[ -f .env ] && ok ".env presente" || bad ".env ausente: cp .env.example .env e preencha os segredos"
if [ -f .env ] && grep -qE '^[A-Z0-9_]+=CHANGE_ME' .env; then bad ".env ainda tem valores CHANGE_ME"; fi
exit "$FAILED"
