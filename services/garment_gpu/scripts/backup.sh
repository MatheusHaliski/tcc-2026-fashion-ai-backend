#!/usr/bin/env bash
# Backup do bucket (fotos, máscaras, PNGs, metadata.json com revisões) e do Redis (registros dos jobs).
#   ./scripts/backup.sh /srv/backups/fai-garment              # destino local (cron diário, ex.: 03:15)
#   BACKUP_REMOTE=offsite:fai-backups ./scripts/backup.sh ... # cópia extra para outro provedor (remote do rclone,
#                                                             # configurado em ~/.config/rclone/rclone.conf)
# Retenção local: KEEP_DAYS (padrão 14). Os pesos dos modelos não entram: são públicos e baixados de novo.
set -euo pipefail
DEST="${1:?Uso: backup.sh /caminho/do/backup}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RCLONE_IMAGE="${RCLONE_IMAGE:-rclone/rclone:1.70.3}"
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
mkdir -p "$DEST/$STAMP"
NET="$(docker compose ps -q storage | xargs docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' | awk '{print $1}')"

docker run --rm --network "$NET" -v "$DEST/$STAMP:/backup" \
  -e RCLONE_CONFIG_FAI_TYPE=s3 -e RCLONE_CONFIG_FAI_PROVIDER=Other -e RCLONE_CONFIG_FAI_ENDPOINT=http://storage:9000 \
  -e RCLONE_CONFIG_FAI_ACCESS_KEY_ID="$S3_ACCESS_KEY" -e RCLONE_CONFIG_FAI_SECRET_ACCESS_KEY="$S3_SECRET_KEY" \
  "$RCLONE_IMAGE" sync "fai:$S3_BUCKET" /backup/storage --quiet

docker compose exec -T redis sh -c 'redis-cli -a "$REDIS_PASSWORD" --no-auth-warning --rdb /data/backup.rdb >/dev/null'
docker compose cp redis:/data/backup.rdb "$DEST/$STAMP/redis.rdb"

if [ -n "${BACKUP_REMOTE:-}" ]; then
  docker run --rm -v "$DEST/$STAMP:/backup:ro" -v "$HOME/.config/rclone:/config/rclone:ro" "$RCLONE_IMAGE" \
    copy /backup "$BACKUP_REMOTE/$STAMP" --quiet
fi
find "$DEST" -mindepth 1 -maxdepth 1 -type d -mtime "+$KEEP_DAYS" -exec rm -rf {} +
echo "backup em $DEST/$STAMP"
