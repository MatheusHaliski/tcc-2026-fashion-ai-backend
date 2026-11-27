#!/bin/bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/../.." && pwd)"
password_file="$project_dir/data/fashionai-demo/config/spring.datasource.password"
jar_file="$project_dir/fai-bootstrap/target/fai-bootstrap-0.1.0-SNAPSHOT.jar"

if [[ ! ${DATA_ENCRYPTION_KEY:-} =~ ^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$ ]]; then
  echo "Configure DATA_ENCRYPTION_KEY com a chave existente do banco de teste (Base64 de 32 bytes)." >&2
  exit 1
fi

if [[ ! -r "$password_file" || ! -f "$jar_file" ]]; then
  echo "Banco de demonstração ou JAR atualizado não encontrado." >&2
  exit 1
fi

cd "$project_dir"
exec env -i HOME="$HOME" PATH="/opt/homebrew/bin:/usr/bin:/bin" /bin/bash -c '
  IFS= read -r DATA_ENCRYPTION_KEY <&3
  exec 3<&-
  export DATA_ENCRYPTION_KEY
  export MYSQL_PASSWORD="$(cat "$1")"
  export MYSQL_HOST=127.0.0.1 MYSQL_PORT=13316 MYSQL_DATABASE=fashionai_demo MYSQL_USER=fashionai_demo
  export MYSQL_SSL_MODE=DISABLED MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL=true
  export PORT=8080 STORAGE_TYPE=local STORAGE_LOCAL_DIR="$2/data/fashionai-demo/media"
  export AI_REMOTE_ENABLED=false WEATHER_ENABLED=false CATALOG_IMAGE_PIPELINE_ENABLED=false
  export BACKUP_CRON=- EMAIL_PROVIDER=log
  exec /usr/bin/java -jar "$3" --server.address=127.0.0.1
' _ "$password_file" "$project_dir" "$jar_file" 3<<<"$DATA_ENCRYPTION_KEY"
