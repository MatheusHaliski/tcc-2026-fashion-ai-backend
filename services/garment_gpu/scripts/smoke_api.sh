#!/usr/bin/env bash
# Envia uma foto, acompanha o job até o fim e baixa o PNG final.
#   FAI_API_KEY=... ./scripts/smoke_api.sh camiseta_holanda.png upper_piece reconstruct
# Variáveis opcionais: FAI_API_URL (padrão http://localhost:8000), BACKGROUND (white|transparent), BBOX='[x1,y1,x2,y2]'.
set -euo pipefail
: "${FAI_API_KEY:?Exporte FAI_API_KEY antes}"
IMAGE="${1:?Uso: smoke_api.sh imagem categoria [segment|reconstruct]}"
CATEGORY="${2:-upper_piece}"
MODE="${3:-segment}"
URL="${FAI_API_URL:-http://localhost:8000}"
ARGS=(-F "image=@${IMAGE}" -F "category=${CATEGORY}" -F "mode=${MODE}" -F "background=${BACKGROUND:-white}")
[ -n "${BBOX:-}" ] && ARGS+=(-F "bbox=${BBOX}")
field() { python3 -c "import json,sys; print(json.load(sys.stdin).get(sys.argv[1]) or '')" "$1"; }

JOB=$(curl -fsS -X POST "$URL/v1/garments" -H "X-API-Key: $FAI_API_KEY" "${ARGS[@]}" | field job_id)
echo "job $JOB enviado (mode=$MODE)"
for _ in $(seq 1 360); do
  BODY=$(curl -fsS "$URL/v1/jobs/$JOB" -H "X-API-Key: $FAI_API_KEY")
  STATUS=$(echo "$BODY" | field status)
  echo "  status=$STATUS stage=$(echo "$BODY" | field stage)"
  case "$STATUS" in
    completed)
      echo "$BODY" | python3 -m json.tool
      OUT="${IMAGE%.*}-${MODE}.png"
      curl -fsS "$URL/v1/jobs/$JOB/image" -H "X-API-Key: $FAI_API_KEY" -o "$OUT"
      echo "PNG salvo em $OUT"; exit 0 ;;
    failed) echo "$BODY" | python3 -m json.tool; exit 1 ;;
  esac
  sleep 5
done
echo "tempo esgotado aguardando o job $JOB"; exit 2
