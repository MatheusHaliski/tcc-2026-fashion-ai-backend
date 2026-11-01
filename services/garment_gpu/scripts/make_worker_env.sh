#!/usr/bin/env bash
# Roda no servidor CENTRAL (fai-gpu-1). Publica Redis e RustFS só na rede privada do Tailscale e gera o worker.env
# que a VM da Fase 2 usa para entrar na mesma fila e no mesmo armazenamento. Não imprime nenhum segredo.
#   cd ~/fashionai/services/garment_gpu && ./scripts/make_worker_env.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo ".env do servidor central não encontrado" >&2; exit 1; }
TS_IP="$(tailscale ip -4 2>/dev/null | head -1)"
[ -n "$TS_IP" ] || { echo "Tailscale não está conectado nesta máquina (sudo tailscale up)" >&2; exit 1; }
get() { sed -n "s/^$1=//p" .env | head -1 | sed 's/^"\(.*\)"$/\1/; s/[[:space:]]*#.*$//'; }

# Redis e RustFS passam a aceitar conexões de fora do contêiner. A VM não tem IP público, então isso alcança só a
# rede interna do projeto e o Tailscale (WireGuard, só máquinas da sua conta); Redis tem senha e o RustFS, chaves.
# 0.0.0.0 em vez do IP do Tailscale: no boot o Docker pode subir antes do tailscaled e o bind no IP falharia.
if grep -q '^PRIVATE_BIND=' .env; then sed -i "s/^PRIVATE_BIND=.*/PRIVATE_BIND=0.0.0.0/" .env; else echo "PRIVATE_BIND=0.0.0.0" >> .env; fi
sudo docker compose up -d redis storage

umask 077
cat > worker.env <<EOF
WORKER_STAGE=reconstruct
REDIS_URL=redis://:$(get REDIS_PASSWORD)@$TS_IP:6379/0
S3_ENDPOINT=http://$TS_IP:9000
S3_ACCESS_KEY=$(get S3_ACCESS_KEY)
S3_SECRET_KEY=$(get S3_SECRET_KEY)
S3_BUCKET=$(get S3_BUCKET)
HF_HOME=/models
FAI_DEVICE=cuda
RECON_MODEL=Qwen/Qwen-Image-Edit-2511
RECON_OFFLOAD=none
# Lightning: 8 passos em vez de 40 (~5× mais rápido), com true_cfg 1.0, como pede o autor do LoRA
RECON_LORA_PATH=lightx2v/Qwen-Image-Edit-2511-Lightning
RECON_LORA_WEIGHT_NAME=Qwen-Image-Edit-2511-Lightning-8steps-V1.0-bf16.safetensors
RECON_STEPS=8
RECON_TRUE_CFG=1.0
RECON_MAX_ATTEMPTS=2
QA_MIN_SCORE=0.62
QA_MAX_DELTA_E=10
WORKER_MAX_IDLE_SECONDS=0
GPU_IDS=0
EOF
echo "worker.env gerado (permissão 600) com Redis/RustFS em $TS_IP. Copie para a VM da Fase 2 — veja deploy/PHASE2_GCP.md."
