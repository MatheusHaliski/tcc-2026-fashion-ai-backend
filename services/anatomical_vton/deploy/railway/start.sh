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
# Um socket IPv4 + IPv6 (healthcheck do Railway por IPv4, rede privada *.railway.internal por IPv6): ver serve.py.
exec python -m services.anatomical_vton.deploy.railway.serve
