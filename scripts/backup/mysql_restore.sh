#!/usr/bin/env bash
# Restaura um backup gerado por mysql_backup.sh (ou pelo job da API, baixado de restricted/backups/) em um banco
# (cria o banco se não existir).
# Uso: MYSQL_HOST=... MYSQL_USER=root MYSQL_PASSWORD=... ./scripts/backup/mysql_restore.sh backups/fashionai-XXXX.sql.gz [banco]
#
# Segurança: senha só por MYSQL_PWD (fora do ps), umask 077, nome do banco validado antes de entrar no SQL.
# MYSQL_SSL_MODE (PREFERRED, REQUIRED, VERIFY_CA, VERIFY_IDENTITY) é repassado ao cliente quando definido.
set -euo pipefail
umask 077

if [ $# -lt 1 ] || [ ! -r "$1" ]; then
  echo "uso: $0 <arquivo.sql.gz> [banco]" >&2
  exit 2
fi
FILE="$1"
DB="${2:-${MYSQL_DATABASE:-fashionai}}"
case "$DB" in
  '' | *[!A-Za-z0-9_]*) echo "erro: nome de banco inválido: $DB (use letras, números e _)" >&2; exit 2 ;;
esac
if [ -z "${MYSQL_PASSWORD:-}" ]; then
  echo "erro: defina MYSQL_PASSWORD" >&2
  exit 2
fi
# confere a integridade do gzip antes de tocar no banco
gzip -t "$FILE"

SSL_ARGS=()
if [ -n "${MYSQL_SSL_MODE:-}" ]; then
  SSL_ARGS=("--ssl-mode=$MYSQL_SSL_MODE")
fi
HOST="${MYSQL_HOST:-localhost}"
PORT="${MYSQL_PORT:-3306}"
USER="${MYSQL_USER:-root}"

export MYSQL_PWD="$MYSQL_PASSWORD"
mysql --host="$HOST" --port="$PORT" --user="$USER" ${SSL_ARGS[@]+"${SSL_ARGS[@]}"} \
  -e "CREATE DATABASE IF NOT EXISTS \`$DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
gunzip -c "$FILE" | mysql --host="$HOST" --port="$PORT" --user="$USER" ${SSL_ARGS[@]+"${SSL_ARGS[@]}"} "$DB"
unset MYSQL_PWD
echo "restaurado em $DB"
