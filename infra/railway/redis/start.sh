#!/bin/sh
# Redis do FashionAI no Railway (imagem redis:8.2): ACL com um usuário só da aplicação.
#
#   default    administração (painel do Railway, REDIS_URL): senha REDIS_PASSWORD (requirepass), sem mudança.
#   fashionai  a API (REDIS_USERNAME/REDIS_PASSWORD): só as chaves rate:* counter:* render:* jobs:*,
#              nenhum comando @dangerous (FLUSHALL, CONFIG, KEYS, DEBUG, MODULE, SHUTDOWN, ACL, MONITOR...)
#              e nenhum canal de pub/sub. INFO volta liberado: o health check do Spring Boot usa INFO.
#
# Prefixo novo na API (fai-infrastructure/cache-redis/RedisAdapters) => acrescente aqui, senão o comando volta NOPERM.
# Como aplicar: infra/railway/README.md (variável FAI_START_SCRIPT + comando de início).
set -eu
: "${REDIS_PASSWORD:?defina REDIS_PASSWORD}"
APP_USER="${REDIS_APP_USER:-fashionai}"
DATA="${RAILWAY_VOLUME_MOUNT_PATH:-/data}"
rm -rf "$DATA/lost+found/"

# Sem a senha da aplicação (ou com senha curta), o Redis sobe como antes — só com o "default" — e o log diz por quê:
# a API só troca para o usuário fashionai depois de ver "usuário ACL ... ativo" no log.
case "${REDIS_APP_PASSWORD:-}" in
  ""|*[!A-Za-z0-9_]*) APP_OK=0 ;;
  *) [ "${#REDIS_APP_PASSWORD}" -ge 24 ] && APP_OK=1 || APP_OK=0 ;;
esac
if [ "$APP_OK" -eq 0 ]; then
  echo "fai-start: ERRO: REDIS_APP_PASSWORD ausente, curta ou fora de [A-Za-z0-9_] — Redis sobe SEM o usuário $APP_USER" >&2
  unset FAI_START_SCRIPT REDIS_APP_PASSWORD
  exec docker-entrypoint.sh redis-server --requirepass "$REDIS_PASSWORD" --save 60 1 --dir "$DATA"
fi

APP_PW="$REDIS_APP_PASSWORD"
unset FAI_START_SCRIPT REDIS_APP_PASSWORD   # o servidor não precisa deles no ambiente
echo "fai-start: usuário ACL $APP_USER ativo (chaves rate:* counter:* render:* jobs:*, sem @dangerous)"
exec docker-entrypoint.sh redis-server \
  --requirepass "$REDIS_PASSWORD" \
  --user "$APP_USER" reset on ">$APP_PW" \
      "~rate:*" "~counter:*" "~render:*" "~jobs:*" resetchannels "+@all" "-@dangerous" "+info" \
  --save 60 1 --dir "$DATA"
