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
  mkdir -p "$LOGS" "$RUN" "$WS/bin" "$WS/redis" "${FAI_S3_DATA:-$WS/rustfs}"
  chmod 700 "$RUN"
  local free_gb
  free_gb=$(df -Pk "$WS" | awk 'NR==2 {print int($4/1048576)}')
  say "volume $WS: ${free_gb} GB livres (pesos da Fase 2 ~60 GB na primeira subida)"
}

# shellcheck source=runpod_install.sh
. "$(dirname "$0")/runpod_install.sh"   # ensure_redis, ensure_rustfs, ensure_venv

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

# Mesmo sinal que a API usa no mode=auto: o batimento do worker no Redis, que só começa com os modelos carregados.
worker_alive() {
  local key
  for key in $(REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli -h 127.0.0.1 --scan --pattern 'fai:worker:*' 2>/dev/null); do
    REDISCLI_AUTH="$REDIS_PASSWORD" redis-cli -h 127.0.0.1 get "$key" 2>/dev/null | grep -q "\"stage\": \"$1\"" && return 0
  done
  return 1
}

# Batimentos de workers que já não rodam: valem até 120 s no Redis, e o start seguinte dizia "pronto" na hora (03/11,
# após um restart), com o worker da Fase 2 ainda carregando: as fotos enviadas nesse intervalo saíam sem Fase 2.
forget_workers() {
  [ -f "$RUN/fai.env" ] || return 0
  local pass key
  pass=$(sed -n "s/^REDIS_PASSWORD=//p" "$RUN/fai.env" | tr -d "'")
  for key in $(REDISCLI_AUTH="$pass" redis-cli -h 127.0.0.1 --scan --pattern 'fai:worker:*' 2>/dev/null); do
    REDISCLI_AUTH="$pass" redis-cli -h 127.0.0.1 del "$key" >/dev/null 2>&1
  done
}

# "Pronto" só com os workers no ar: lote enviado antes disso volta só com o recorte da Fase 1 (teste de 03/11/2026).
# FAI_READY_TIMEOUT=0 pula a espera. Ctrl+C interrompe só a espera; os serviços continuam rodando.
wait_workers() {
  local timeout="${FAI_READY_TIMEOUT:-3600}" started pending stage elapsed
  [ "$timeout" = 0 ] && return 0
  started=$(date +%s)
  say "esperando os workers carregarem os modelos (pesos em $HF_HOME; na 1ª vez baixa ~60 GB)"
  while :; do
    pending=""
    for stage in segment reconstruct; do
      if wanted "$stage" && ! worker_alive "$stage"; then pending="$pending $stage"; fi
    done
    [ -z "$pending" ] && { say "pronto: workers no ar. Pode rodar o lote."; return 0; }
    elapsed=$(( $(date +%s) - started ))
    [ "$elapsed" -lt "$timeout" ] || die "workers fora do ar após ${timeout}s:$pending (veja $LOGS/<worker>.log)"
    if [ $(( elapsed % 60 )) -lt 10 ]; then
      say "aguardando:$pending · pesos: $(du -sh "$HF_HOME" 2>/dev/null | cut -f1) · $(tail -n 1 "$LOGS/reconstruct.log" 2>/dev/null | cut -c1-110)"
    fi
    sleep 10
  done
}

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
    running segment || running reconstruct || forget_workers   # Redis do volume pode guardar batimentos antigos
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
  say "URL pública: https://${RUNPOD_POD_ID:-<pod-id>}-8000.proxy.runpod.net"
  wait_workers
}

stop_all() {
  touch "$RUN/stopping" 2>/dev/null || true
  local name pid
  for name in reconstruct segment api storage redis; do
    running "$name" || continue
    if [ "$name" = redis ]; then forget_workers; fi   # workers já parados: seus batimentos não podem sobrar
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
  if [ -f "$RUN/fai.env" ]; then
    set -a
    # shellcheck disable=SC1091
    . "$RUN/fai.env"
    set +a
    for name in segment reconstruct; do
      if worker_alive "$name"; then echo "worker $name: modelos carregados"; else echo "worker $name: ainda não"; fi
    done
  fi
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
