#!/usr/bin/env bash
# Sobe o serviço inteiro DENTRO de um pod do RunPod (template PyTorch/CUDA 12), sem Docker: Redis e RustFS só em
# 127.0.0.1, API (uvicorn :8000, exposta como HTTP port → https://<pod-id>-8000.proxy.runpod.net) e os workers da
# Fase 1 (segment) e da Fase 2 (reconstruct). Cada processo é vigiado e reiniciado se cair. Guia: deploy/RUNPOD.md.
#   bash /workspace/fashionai/services/garment_gpu/scripts/runpod_start.sh [start|stop|restart|status]
# Persistente no network volume (/workspace): venv, pesos (HF_HOME), dados do Redis e do RustFS, logs.
# Efêmero (some ao parar o pod): /tmp/fai-runpod com o arquivo de segredos gerado e os PIDs.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
SVC="$REPO/services/garment_gpu"
WS="${FAI_WORKSPACE:-/workspace}"
LOGS="$WS/logs"
RUN="${FAI_RUN_DIR:-/tmp/fai-runpod}"
VENV="$WS/venv-fai"
RUSTFS_VERSION="1.0.4"
RUSTFS_SHA256="4924ad4b699b9f59943051efedae2d1eb6d4cac503a1b0384c4b25f7c2c31b5c"   # rustfs-linux-x86_64-musl-v1.0.4.zip
RUSTFS_URL="https://github.com/rustfs/rustfs/releases/download/$RUSTFS_VERSION/rustfs-linux-x86_64-musl-v$RUSTFS_VERSION.zip"
RUSTFS_BIN="$WS/bin/rustfs-$RUSTFS_VERSION"
SERVICES="${FAI_SERVICES:-redis storage api segment reconstruct}"   # ex.: FAI_SERVICES="redis storage api segment"

say() { echo "[$(date '+%H:%M:%S')] $*"; }
die() { echo "ERRO: $*" >&2; exit 1; }

check_volume() {
  [ -d "$WS" ] && [ -w "$WS" ] || die "$WS não existe ou não é gravável: o pod precisa do network volume em $WS"
  mkdir -p "$LOGS" "$RUN" "$WS/bin" "$WS/hf" "$WS/redis" "${FAI_S3_DATA:-$WS/rustfs}"
  chmod 700 "$RUN"
  local free_gb
  free_gb=$(df -Pk "$WS" | awk 'NR==2 {print int($4/1048576)}')
  say "volume $WS: ${free_gb} GB livres (pesos da Fase 2 ~60 GB na primeira subida)"
}

ensure_redis() {
  command -v redis-server >/dev/null && return 0
  say "instalando redis-server (disco do contêiner; refeito a cada pod novo, ~20 s)"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq >/dev/null && apt-get install -y -qq redis-server >/dev/null
}

ensure_rustfs() {
  [ -x "$RUSTFS_BIN" ] && return 0
  command -v unzip >/dev/null || { apt-get update -qq >/dev/null && apt-get install -y -qq unzip >/dev/null; }
  say "baixando RustFS $RUSTFS_VERSION para o volume"
  local tmp
  tmp=$(mktemp -d)
  curl -fsSL --retry 3 -o "$tmp/rustfs.zip" "$RUSTFS_URL"
  echo "$RUSTFS_SHA256  $tmp/rustfs.zip" | sha256sum -c --quiet - || die "SHA-256 do RustFS não confere"
  unzip -q -o "$tmp/rustfs.zip" -d "$tmp"
  install -m 755 "$tmp/rustfs" "$RUSTFS_BIN"
  rm -rf "$tmp"
}

ensure_venv() {
  # --system-site-packages: torch/torchvision vêm da imagem CUDA do template, como no Dockerfile.worker.
  local want
  python3 -c 'import torch' 2>/dev/null || say "AVISO: python3 sem torch; use o template PyTorch do RunPod"
  want=$( { python3 -c 'import sys, torch; print(sys.version, torch.__version__)' 2>/dev/null || python3 -V
            cat "$SVC"/requirements-api.txt "$SVC"/requirements-segment.txt "$SVC"/requirements-reconstruct.txt; } \
          | sha256sum | cut -c1-16)
  if [ -x "$VENV/bin/python" ] && [ "$(cat "$VENV/.fai-installed" 2>/dev/null)" = "$want" ]; then
    return 0
  fi
  say "instalando dependências na venv do volume (uma vez; log em $LOGS/install.log)"
  python3 -m venv --system-site-packages "$VENV" >>"$LOGS/install.log" 2>&1 \
    || die "python3 -m venv falhou (veja $LOGS/install.log)"
  python3 -m pip freeze 2>/dev/null | grep -iE '^(torch|torchvision)==' > "$RUN/constraints.txt" || true
  "$VENV/bin/pip" install -q --upgrade pip >>"$LOGS/install.log" 2>&1
  "$VENV/bin/pip" install -q -c "$RUN/constraints.txt" -r "$SVC/requirements-segment.txt" \
    -r "$SVC/requirements-reconstruct.txt" >>"$LOGS/install.log" 2>&1 \
    || die "pip install falhou (veja $LOGS/install.log)"
  "$VENV/bin/python" -c "import torch, torchvision, transformers, diffusers, peft; print('torch', torch.__version__, 'cuda', torch.version.cuda)" \
    | tee -a "$LOGS/install.log"
  echo "$want" > "$VENV/.fai-installed"
}

write_config() {
  ( cd "$REPO" && PYTHONPATH="$REPO" python3 -m services.garment_gpu.scripts.runpod_env \
      --out "$RUN/fai.env" --redis-conf "$RUN/redis.conf" --workspace "$WS" ) \
    || die "corrija as variáveis do pod (Edit Pod → Environment Variables) e rode de novo"
  set -a
  # shellcheck disable=SC1091
  . "$RUN/fai.env"
  set +a
}

running() { [ -f "$RUN/$1.pid" ] && kill -0 "$(cat "$RUN/$1.pid")" 2>/dev/null; }

# Vigia: roda o comando em loop, num grupo de processos próprio (setsid), e reinicia se cair. Espera mais entre
# reinícios quando o processo morre logo (erro de configuração não vira laço apertado).
supervise() {
  local name="$1"
  shift
  if running "$name"; then
    say "$name já está no ar (pid $(cat "$RUN/$name.pid"))"
    return 0
  fi
  local cmd
  cmd=$(printf '%q ' "$@")
  setsid bash -c "
    delay=5
    while [ ! -f '$RUN/stopping' ]; do
      echo \"[\$(date '+%F %T')] supervisor: iniciando $name\"
      started=\$(date +%s)
      $cmd
      code=\$?
      [ -f '$RUN/stopping' ] && break
      if [ \$(( \$(date +%s) - started )) -gt 120 ]; then delay=5; else delay=\$(( delay * 2 > 120 ? 120 : delay * 2 )); fi
      echo \"[\$(date '+%F %T')] supervisor: $name saiu com código \$code; reinicia em \${delay}s\"
      sleep \$delay
    done" >>"$LOGS/$name.log" 2>&1 < /dev/null &
  echo $! > "$RUN/$name.pid"
  say "$name iniciado (log: $LOGS/$name.log)"
}

wait_for() {
  local name="$1" probe="$2" tries="${3:-60}"
  for _ in $(seq "$tries"); do
    if eval "$probe" >/dev/null 2>&1; then
      say "$name respondeu"
      return 0
    fi
    sleep 2
  done
  die "$name não respondeu; veja $LOGS/$name.log"
}

wanted() { [[ " $SERVICES " == *" $1 "* ]]; }

start_all() {
  check_volume
  wanted redis && ensure_redis
  wanted storage && ensure_rustfs
  write_config
  ensure_venv
  rm -f "$RUN/stopping"
  local py="$VENV/bin/python"
  if wanted redis; then
    supervise redis redis-server "$RUN/redis.conf"
    wait_for redis "REDISCLI_AUTH=\"\$REDIS_PASSWORD\" redis-cli -h 127.0.0.1 ping | grep -q PONG"
  fi
  if wanted storage; then
    # Chaves pelo ambiente (herdado pelo vigia), nunca na linha de comando: o ps mostraria os valores.
    export RUSTFS_ACCESS_KEY="$S3_ACCESS_KEY" RUSTFS_SECRET_KEY="$S3_SECRET_KEY"
    supervise storage env RUSTFS_VOLUMES="${FAI_S3_DATA:-$WS/rustfs}" RUSTFS_ADDRESS="127.0.0.1:9000" \
      RUSTFS_CONSOLE_ENABLE=false "$RUSTFS_BIN"
    unset RUSTFS_ACCESS_KEY RUSTFS_SECRET_KEY
    wait_for storage "curl -fsS http://127.0.0.1:9000/health"
  fi
  cd "$REPO"
  export PYTHONPATH="$REPO" PYTHONUNBUFFERED=1
  if wanted api; then
    supervise api "$py" -m uvicorn --factory services.garment_gpu.api:app_factory --host 0.0.0.0 --port 8000 \
      --proxy-headers --forwarded-allow-ips "*" --no-server-header
    wait_for api "curl -fsS http://127.0.0.1:8000/health"
  fi
  wanted segment && supervise segment env CUDA_VISIBLE_DEVICES="$SEGMENT_GPU" WORKER_METRICS_PORT=9101 \
    "$py" -m services.garment_gpu.worker --stage segment
  wanted reconstruct && supervise reconstruct env CUDA_VISIBLE_DEVICES="$RECONSTRUCT_GPU" WORKER_METRICS_PORT=9102 \
    "$py" -m services.garment_gpu.worker --stage reconstruct
  say "pronto. Workers carregam os modelos em segundo plano: tail -f $LOGS/reconstruct.log (espere 'modelos carregados')"
  say "URL pública: https://${RUNPOD_POD_ID:-<pod-id>}-8000.proxy.runpod.net"
}

stop_all() {
  touch "$RUN/stopping" 2>/dev/null || true
  local name pid
  for name in reconstruct segment api storage redis; do
    running "$name" || continue
    pid=$(cat "$RUN/$name.pid")
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    for _ in $(seq 20); do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
    kill -KILL -- "-$pid" 2>/dev/null || true
    rm -f "$RUN/$name.pid"
    say "$name parado"
  done
}

status_all() {
  local name
  for name in redis storage api segment reconstruct; do
    if running "$name"; then echo "$name: no ar (pid $(cat "$RUN/$name.pid"))"; else echo "$name: parado"; fi
  done
  curl -fsS -m 3 http://127.0.0.1:8000/health 2>/dev/null && echo || echo "API: sem resposta em 127.0.0.1:8000"
  command -v nvidia-smi >/dev/null && nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv,noheader
  df -h "$WS" | awk 'NR==2 {print "volume: " $3 " usados, " $4 " livres"}'
  grep -h "Successfully completed\|modelos carregados" "$LOGS"/segment.log "$LOGS"/reconstruct.log 2>/dev/null | tail -n 3 || true
}

case "${1:-start}" in
  start) start_all ;;
  stop) stop_all ;;
  restart) stop_all; start_all ;;
  status) status_all ;;
  *) echo "uso: $0 [start|stop|restart|status]" >&2; exit 2 ;;
esac
