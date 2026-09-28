#!/usr/bin/env bash
# Backup lógico do MySQL do Fashion AI (mysqldump + gzip) com retenção.
# Uso: MYSQL_HOST=... MYSQL_USER=... MYSQL_PASSWORD=... ./scripts/backup/mysql_backup.sh [destino] [dias_retencao]
# Agende no cron (ex.: 03:00 diário): 0 3 * * * /caminho/scripts/backup/mysql_backup.sh /var/backups/fashionai 14
#
# Segurança: a senha vai só pela variável MYSQL_PWD do processo (nunca na linha de comando, visível no ps); os arquivos
# nascem com umask 077 (só o dono lê); um dump incompleto é apagado. MYSQL_SSL_MODE (PREFERRED, REQUIRED, VERIFY_CA,
# VERIFY_IDENTITY) é repassado ao cliente MySQL quando definido. Usuário mínimo para o dump: infra/railway/mysql/README.md.
set -euo pipefail
umask 077

DEST="${1:-./backups}"
RETENTION_DAYS="${2:-14}"
HOST="${MYSQL_HOST:-localhost}"
PORT="${MYSQL_PORT:-3306}"
DB="${MYSQL_DATABASE:-fashionai}"
USER="${MYSQL_BACKUP_USER:-${MYSQL_USER:-fashionai}}"
PASSWORD="${MYSQL_BACKUP_PASSWORD:-${MYSQL_PASSWORD:-}}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$DEST/fashionai-$STAMP.sql.gz"

case "$RETENTION_DAYS" in
  '' | *[!0-9]*) echo "erro: dias de retenção inválido: $RETENTION_DAYS" >&2; exit 2 ;;
esac
if [ -z "$PASSWORD" ]; then
  echo "erro: defina MYSQL_PASSWORD (ou MYSQL_BACKUP_PASSWORD)" >&2
  exit 2
fi

SSL_ARGS=()
if [ -n "${MYSQL_SSL_MODE:-}" ]; then
  SSL_ARGS=("--ssl-mode=$MYSQL_SSL_MODE")
fi

mkdir -p "$DEST"
chmod 700 "$DEST"
# dump incompleto (erro no meio do pipe) não fica parecendo backup válido
trap 'rm -f "$FILE"' ERR
trap 'rm -f "$FILE"; exit 130' INT TERM
export MYSQL_PWD="$PASSWORD"
mysqldump --host="$HOST" --port="$PORT" --user="$USER" ${SSL_ARGS[@]+"${SSL_ARGS[@]}"} \
  --single-transaction --routines --triggers --events --set-gtid-purged=OFF --no-tablespaces \
  "$DB" | gzip -9 > "$FILE"
unset MYSQL_PWD
trap - ERR INT TERM

SIZE=$(stat -c %s "$FILE" 2>/dev/null || stat -f %z "$FILE")
SUM=$(sha256sum "$FILE" | cut -d' ' -f1)
echo "$STAMP $FILE $SIZE $SUM" >> "$DEST/backups.log"
echo "backup ok: $FILE ($SIZE bytes, sha256 $SUM)"

# retenção
find "$DEST" -name 'fashionai-*.sql.gz' -mtime +"$RETENTION_DAYS" -print -delete
