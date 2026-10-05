#!/usr/bin/env bash
# RF47 · Carrega o acervo do catálogo no MySQL do Railway (ou de qualquer ambiente), na ordem certa:
#   1. seed_catalog.py      — 100 marcas, apelidos, fontes oficiais e os produtos do seed
#   2. import_products.py   — o acervo coletado dos sites oficiais (data/catalog/acervo/*.jsonl.gz)
#   3. rebuild_search_index.py — texto de busca (FULLTEXT) de todos os produtos
# Idempotente: rodar de novo não duplica nada (dedup por identificador forte / URL canônica / modelo+cor).
#
# Uso (o MySQL do Railway só aceita conexão externa por um TCP proxy temporário: MySQL → Settings → Networking):
#   export RAILWAY_MYSQL_APP_PASSWORD=...        # valor de MYSQL_APP_PASSWORD do serviço MySQL (nunca no código/log)
#   scripts/catalog/import_railway.sh <host-do-proxy> <porta-do-proxy> [--dry-run]
#   ex.: scripts/catalog/import_railway.sh mainline.proxy.rlwy.net 11960 --dry-run
# Remova o TCP proxy ao terminar.
# Rode de uma máquina com saída TCP livre (o protocolo do MySQL não passa por proxy HTTPS: numa sessão do
# Claude Code na nuvem o túnel abre mas o MySQL não responde).
#
# Usuário: fai_app (menor privilégio, só com TLS) — infra/railway/mysql/start.sh. Banco: fashionai.
set -euo pipefail

HOST="${1:?informe o host do TCP proxy (ex.: mainline.proxy.rlwy.net)}"
PORT="${2:?informe a porta do TCP proxy}"
DRY="${3:-}"
[ -z "$DRY" ] || [ "$DRY" = "--dry-run" ] || { echo "3º argumento só pode ser --dry-run" >&2; exit 2; }
[ -n "${RAILWAY_MYSQL_APP_PASSWORD:-}" ] || { echo "defina RAILWAY_MYSQL_APP_PASSWORD (MYSQL_APP_PASSWORD do serviço MySQL)" >&2; exit 2; }

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
ACERVO=("$ROOT"/data/catalog/acervo/*.jsonl.gz)
[ -e "${ACERVO[0]}" ] || { echo "nenhum acervo em data/catalog/acervo/" >&2; exit 2; }

python3 -c "import pymysql" 2>/dev/null || python3 -m pip install -q -r "$HERE/requirements.txt"

export MYSQL_HOST="$HOST" MYSQL_PORT="$PORT" MYSQL_DATABASE="${MYSQL_DATABASE:-fashionai}" MYSQL_USER="${MYSQL_USER:-fai_app}" \
       MYSQL_PASSWORD="$RAILWAY_MYSQL_APP_PASSWORD" MYSQL_SSL_MODE=REQUIRED

cd "$ROOT"                                     # os passos abaixo usam caminhos relativos à raiz do repositório
echo "== Conexão (TLS) com $MYSQL_HOST:$MYSQL_PORT/$MYSQL_DATABASE como $MYSQL_USER"
python3 - <<'EOF'
import sys
sys.path.insert(0, "scripts/catalog")
from db import connect
c = connect()
with c.cursor() as cur:
    cur.execute("SELECT VERSION() AS v, (SELECT COUNT(*) FROM catalog_products) AS produtos, (SELECT COUNT(*) FROM brands) AS marcas, "
                "(SELECT MAX(CAST(version AS UNSIGNED)) FROM flyway_schema_history WHERE success = 1) AS schema_v")   # version é VARCHAR: MAX(texto) daria V9
    r = cur.fetchone()
    cur.execute("SHOW STATUS LIKE 'Ssl_cipher'")
    ssl = cur.fetchone()
print(f"MySQL {r['v']} · schema V{r['schema_v']} · {r['marcas']} marcas · {r['produtos']} produtos · TLS {ssl['Value'] or 'NÃO'}")
if not ssl["Value"]:
    sys.exit("conexão sem TLS — abortando")
c.close()
EOF

echo "== 1/3 Seed (marcas, apelidos, fontes oficiais, produtos do seed)"
python3 scripts/catalog/seed_catalog.py ${DRY}
echo "== 2/3 Acervo oficial: ${ACERVO[*]##*/}"
python3 scripts/catalog/import_products.py "${ACERVO[@]}" --batch-size 1000 ${DRY}
echo "== 3/3 Índice de busca"
if [ -z "$DRY" ]; then python3 scripts/catalog/rebuild_search_index.py; else echo "(pulado no dry-run)"; fi
echo "== Pronto. Remova o TCP proxy do MySQL no Railway."
