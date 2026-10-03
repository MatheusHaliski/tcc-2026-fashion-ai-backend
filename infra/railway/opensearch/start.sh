#!/bin/sh
# OpenSearch do FashionAI no Railway (imagem opensearchproject/opensearch:2.19.1): plugin de segurança ligado.
#
#   admin    superusuário (manutenção): OPENSEARCH_ADMIN_PASSWORD. É o ÚNICO usuário do internal_users.yml —
#            os usuários de demonstração da imagem (kibanaserver, logstash...) têm senhas públicas e nunca entram.
#   fai_app  a API (OPENSEARCH_USERNAME/OPENSEARCH_PASSWORD): ler, gravar e criar só índices fai-*; nada de cluster,
#            nada de índices do sistema, nada da API de segurança.
#
# TLS no HTTP e no transporte com CA própria (nunca os certificados de demonstração), gerada uma vez no volume
# (.fai-tls/). O certificado da CA (público) sai no log a cada início para virar OPENSEARCH_CA_CERT_PEM na API.
# Auditoria (logins recusados, acesso negado) vai para o log do serviço.
# O usuário fai_app e o papel dele são conferidos a cada início pela API REST de segurança (rotação = trocar a
# variável e reiniciar o OpenSearch e a API). Como aplicar: infra/railway/README.md.
set -eu
: "${OPENSEARCH_ADMIN_PASSWORD:?defina OPENSEARCH_ADMIN_PASSWORD (secret(40) do Railway)}"
: "${OPENSEARCH_APP_PASSWORD:?defina OPENSEARCH_APP_PASSWORD (secret(40) do Railway)}"
APP_USER="${OPENSEARCH_APP_USER:-fai_app}"
TLS_HOST="${OPENSEARCH_TLS_HOST:-opensearch.railway.internal}"
OS_HOME=/usr/share/opensearch
DATA="$OS_HOME/data"
CONF="$OS_HOME/config"
TLS="$DATA/.fai-tls"
KT="$OS_HOME/jdk/bin/keytool"

log() { echo "fai-start: $*"; }
for v in "$APP_USER" "$OPENSEARCH_ADMIN_PASSWORD" "$OPENSEARCH_APP_PASSWORD"; do
  case "$v" in *[!A-Za-z0-9_]*) log "nome ou senha com caractere fora de [A-Za-z0-9_]" >&2; exit 1 ;; esac
done
[ "${#OPENSEARCH_ADMIN_PASSWORD}" -ge 24 ] && [ "${#OPENSEARCH_APP_PASSWORD}" -ge 24 ] || { log "senhas com menos de 24 caracteres" >&2; exit 1; }

# --- TLS: CA própria + certificado do nó (uma vez, no volume) ---
if [ ! -s "$TLS/node.p12" ]; then
  log "gerando CA e certificado do nó em $TLS"
  rm -rf "$TLS"; mkdir -p "$TLS"; chmod 700 "$TLS"
  head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$TLS/storepass"; chmod 600 "$TLS/storepass"
  SP="-storepass:file $TLS/storepass -keypass:file $TLS/storepass -storetype PKCS12"
  "$KT" -genkeypair -keystore "$TLS/ca.p12" $SP -alias ca -keyalg RSA -keysize 3072 -validity 3650 \
    -dname "CN=fai-opensearch-ca,O=FashionAI" -ext bc:c=ca:true,pathlen:0 -ext ku:c=keyCertSign,cRLSign
  "$KT" -exportcert -rfc -keystore "$TLS/ca.p12" $SP -alias ca -file "$TLS/ca.pem"
  "$KT" -genkeypair -keystore "$TLS/node.p12" $SP -alias node -keyalg RSA -keysize 2048 -validity 3650 \
    -dname "CN=$TLS_HOST,O=FashionAI"
  "$KT" -certreq -keystore "$TLS/node.p12" $SP -alias node -file "$TLS/node.csr"
  "$KT" -gencert -keystore "$TLS/ca.p12" $SP -alias ca -infile "$TLS/node.csr" -outfile "$TLS/node.crt" -rfc \
    -validity 3650 -ext "SAN=dns:$TLS_HOST,dns:localhost,ip:127.0.0.1" -ext ku:c=digitalSignature,keyEncipherment \
    -ext eku=serverAuth,clientAuth
  "$KT" -importcert -noprompt -keystore "$TLS/node.p12" $SP -alias ca -file "$TLS/ca.pem"
  "$KT" -importcert -noprompt -keystore "$TLS/node.p12" $SP -alias node -file "$TLS/node.crt"
  "$KT" -importcert -noprompt -keystore "$TLS/trust.p12" $SP -alias ca -file "$TLS/ca.pem"
  rm -f "$TLS/node.csr" "$TLS/node.crt"
fi
PW=$(cat "$TLS/storepass")
# o plugin só lê certificados de dentro do diretório de configuração
mkdir -p "$CONF/fai-tls"
cp "$TLS/node.p12" "$TLS/trust.p12" "$TLS/ca.pem" "$CONF/fai-tls/"
chmod 700 "$CONF/fai-tls"; chmod 600 "$CONF/fai-tls/"*

# --- opensearch.yml: bloco de segurança (substitui o de um início anterior) ---
YML="$CONF/opensearch.yml"
sed -i '/^# >>> fai-security/,/^# <<< fai-security/d' "$YML"
cat >> "$YML" <<YAML
# >>> fai-security (infra/railway/opensearch/start.sh)
plugins.security.ssl.transport.keystore_type: PKCS12
plugins.security.ssl.transport.keystore_filepath: fai-tls/node.p12
plugins.security.ssl.transport.keystore_password: $PW
plugins.security.ssl.transport.truststore_type: PKCS12
plugins.security.ssl.transport.truststore_filepath: fai-tls/trust.p12
plugins.security.ssl.transport.truststore_password: $PW
plugins.security.ssl.transport.enforce_hostname_verification: false
plugins.security.ssl.http.enabled: true
plugins.security.ssl.http.keystore_type: PKCS12
plugins.security.ssl.http.keystore_filepath: fai-tls/node.p12
plugins.security.ssl.http.keystore_password: $PW
plugins.security.ssl.http.truststore_type: PKCS12
plugins.security.ssl.http.truststore_filepath: fai-tls/trust.p12
plugins.security.ssl.http.truststore_password: $PW
plugins.security.ssl.http.enabled_protocols: ["TLSv1.3", "TLSv1.2"]
plugins.security.nodes_dn: ["CN=$TLS_HOST,O=FashionAI"]
plugins.security.allow_default_init_securityindex: true
plugins.security.allow_unsafe_democertificates: false
plugins.security.restapi.roles_enabled: ["all_access"]
plugins.security.system_indices.enabled: true
plugins.security.audit.type: log4j
plugins.security.audit.config.log4j.logger_name: audit
plugins.security.audit.config.log4j.level: INFO
# <<< fai-security
YAML

# --- internal_users.yml: só o admin (vale na criação do índice de segurança) ---
HASH=$("$OS_HOME/plugins/opensearch-security/tools/hash.sh" -env OPENSEARCH_ADMIN_PASSWORD 2>/dev/null | tail -1)
case "$HASH" in '$2'*) ;; *) log "hash.sh não devolveu um hash bcrypt" >&2; exit 1 ;; esac
cat > "$CONF/opensearch-security/internal_users.yml" <<YAML
_meta:
  type: "internalusers"
  config_version: 2
admin:
  hash: "$HASH"
  reserved: true
  backend_roles:
  - "admin"
  description: "FashionAI: administrador (OPENSEARCH_ADMIN_PASSWORD)"
YAML
chown -R 1000:1000 "$DATA" "$CONF"

# --- usuário da aplicação: conferido a cada início pela API REST de segurança ---
api() {  # MÉTODO caminho [corpo]   (credenciais e corpo em arquivos 0600, nunca na linha de comando)
  cfg=$(mktemp); body=$(mktemp); chmod 600 "$cfg" "$body"
  printf 'user = "admin:%s"\n' "$OPENSEARCH_ADMIN_PASSWORD" > "$cfg"
  printf '%s' "${3:-}" > "$body"
  code=$(curl -sS -o /dev/null -w '%{http_code}' -K "$cfg" --cacert "$TLS/ca.pem" -X "$1" \
    -H 'Content-Type: application/json' --data-binary @"$body" "https://localhost:9200$2" 2>/dev/null || echo 000)
  rm -f "$cfg" "$body"; echo "$code"
}
bootstrap() {
  i=0
  until [ "$(api GET /_plugins/_security/health)" = 200 ]; do
    i=$((i + 1)); [ $i -ge 120 ] && { log "ERRO: o admin não autentica no OpenSearch; usuário $APP_USER NÃO conferido"; return 1; }
    sleep 5
  done
  r1=$(api PUT /_plugins/_security/api/roles/fai_app \
    '{"description":"FashionAI: API (indices fai-*)","cluster_permissions":[],"index_permissions":[{"index_patterns":["fai-*"],"allowed_actions":["crud","create_index","indices:admin/mapping/put"]}]}')
  r2=$(api PUT "/_plugins/_security/api/internalusers/$APP_USER" \
    "{\"password\":\"$OPENSEARCH_APP_PASSWORD\",\"opendistro_security_roles\":[\"fai_app\"],\"backend_roles\":[],\"description\":\"FashionAI: API\"}")
  case "$r1$r2" in
    20[01]20[01]) log "pronto: segurança ligada (TLS + usuários), $APP_USER só em fai-*" ;;
    *) log "ERRO ao conferir $APP_USER (papel: HTTP $r1, usuário: HTTP $r2)" ;;
  esac
}

log "certificado da CA do TLS (vai em OPENSEARCH_CA_CERT_PEM na API):"
cat "$TLS/ca.pem"
bootstrap &

# o entrypoint transforma cada linha de "env" com cara de "a.b=..." em -E: o script (multilinha) e as senhas saem
unset FAI_START_SCRIPT OPENSEARCH_ADMIN_PASSWORD OPENSEARCH_APP_PASSWORD
export DISABLE_SECURITY_PLUGIN=false DISABLE_INSTALL_DEMO_CONFIG=true
cd "$OS_HOME"
exec chroot --userspec=1000:1000 --skip-chdir / env HOME="$OS_HOME" ./opensearch-docker-entrypoint.sh opensearch -Ediscovery.type=single-node
