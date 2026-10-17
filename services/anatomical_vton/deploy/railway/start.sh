#!/bin/sh
# A conta de serviço do Google chega como texto em GOOGLE_APPLICATION_CREDENTIALS_JSON (variável do Railway);
# é gravada só para este usuário e nunca impressa.
set -eu
if [ -n "${GOOGLE_APPLICATION_CREDENTIALS_JSON:-}" ]; then
  umask 077
  printf '%s' "$GOOGLE_APPLICATION_CREDENTIALS_JSON" > /tmp/google-service-account.json
  export GOOGLE_APPLICATION_CREDENTIALS=/tmp/google-service-account.json
  unset GOOGLE_APPLICATION_CREDENTIALS_JSON
fi
# "::" atende IPv4 e IPv6: a rede privada do Railway (*.railway.internal) usa IPv6. VTON_BIND_HOST troca em máquinas sem IPv6.
exec python -m uvicorn services.anatomical_vton.api:app --host "${VTON_BIND_HOST:-::}" --port "${PORT:-8080}" --workers 1 --no-access-log
