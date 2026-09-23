#!/usr/bin/env bash
# Restaura um backup gerado por mysql_backup.sh em um banco (cria o banco se não existir).
# Uso: MYSQL_HOST=... MYSQL_USER=root MYSQL_PASSWORD=... ./scripts/backup/mysql_restore.sh backups/fashionai-XXXX.sql.gz [banco]
set -euo pipefail
FILE="$1"
DB="${2:-${MYSQL_DATABASE:-fashionai}}"
export MYSQL_PWD="${MYSQL_PASSWORD:-}"
mysql --host="${MYSQL_HOST:-localhost}" --port="${MYSQL_PORT:-3306}" --user="${MYSQL_USER:-root}" \
  -e "CREATE DATABASE IF NOT EXISTS \`$DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
gunzip -c "$FILE" | mysql --host="${MYSQL_HOST:-localhost}" --port="${MYSQL_PORT:-3306}" --user="${MYSQL_USER:-root}" "$DB"
echo "restaurado em $DB"
