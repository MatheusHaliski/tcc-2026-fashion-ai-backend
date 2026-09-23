#!/usr/bin/env bash
# Backup lógico do MySQL do Fashion AI (mysqldump + gzip) com retenção.
# Uso: MYSQL_HOST=... MYSQL_USER=... MYSQL_PASSWORD=... ./scripts/backup/mysql_backup.sh [destino] [dias_retencao]
# Agende no cron (ex.: 03:00 diário): 0 3 * * * /caminho/scripts/backup/mysql_backup.sh /var/backups/fashionai 14
set -euo pipefail

DEST="${1:-./backups}"
RETENTION_DAYS="${2:-14}"
HOST="${MYSQL_HOST:-localhost}"
PORT="${MYSQL_PORT:-3306}"
DB="${MYSQL_DATABASE:-fashionai}"
USER="${MYSQL_USER:-fashionai}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$DEST/fashionai-$STAMP.sql.gz"

mkdir -p "$DEST"
export MYSQL_PWD="${MYSQL_PASSWORD:-}"
mysqldump --host="$HOST" --port="$PORT" --user="$USER" \
  --single-transaction --routines --triggers --events --set-gtid-purged=OFF \
  "$DB" | gzip -9 > "$FILE"

SIZE=$(stat -c %s "$FILE" 2>/dev/null || stat -f %z "$FILE")
SUM=$(sha256sum "$FILE" | cut -d' ' -f1)
echo "$STAMP $FILE $SIZE $SUM" >> "$DEST/backups.log"
echo "backup ok: $FILE ($SIZE bytes, sha256 $SUM)"

# retenção
find "$DEST" -name 'fashionai-*.sql.gz' -mtime +"$RETENTION_DAYS" -print -delete
