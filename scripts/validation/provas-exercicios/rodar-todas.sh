#!/usr/bin/env bash
# Roda todas as provas fotográficas (exercícios 09 a 20 e Tipo Look automático) contra um `next dev` local.
# Antes, em outro terminal, na raiz do repositório:
#   DEV_GATE_ENABLED=false npx next dev -p 3150
# Uso: PROVAS_OUT=/pasta/das/fotos scripts/validation/provas-exercicios/rodar-todas.sh
# Nenhum backend, banco ou conta real é usado: toda chamada /api/** é respondida pela API simulada dos scripts.
set -u
cd "$(dirname "$0")"
export BASE_URL="${BASE_URL:-http://localhost:3150}"
export PROVAS_OUT="${PROVAS_OUT:-$PWD/provas-9-20}"
falhas=0
rodar() {
  echo "== $*"
  if ! node "$@" > "$PROVAS_OUT/$(echo "$*" | tr ' ' '-').json"; then
    echo "FALHOU: $*"
    falhas=$((falhas + 1))
  fi
}
mkdir -p "$PROVAS_OUT"
rodar look-automatico.cjs
rodar ex09-10.cjs 09
rodar ex09-10.cjs 10
rodar ex11-12.cjs 11
rodar ex11-12.cjs 12
for n in 13 14 15 16 17 18 19 20; do
  rodar "ex$n.cjs"
done
echo "falhas: $falhas"
exit "$falhas"
