#!/bin/sh
# Cassandra do FashionAI no Railway (imagem cassandra:4.1): autenticação, autorização e TLS para os clientes.
#
#   fai_admin  superusuário para manutenção (cqlsh): CASSANDRA_ADMIN_PASSWORD.
#   fai_app    a API (CASSANDRA_USERNAME/CASSANDRA_PASSWORD): só o keyspace da aplicação, com SELECT, MODIFY,
#              CREATE e ALTER (a API cria as tabelas na subida); sem DROP, sem AUTHORIZE, nunca superusuário.
#   cassandra  papel padrão (senha pública "cassandra"): sem LOGIN, sem superusuário e com senha aleatória.
#
# TLS cliente -> nó: CA e certificado do nó gerados uma única vez no volume (fai-tls/). O certificado da CA
# (público) sai no log a cada início para virar CASSANDRA_CA_CERT_PEM na API. CASSANDRA_TLS_OPTIONAL=true aceita
# TLS e texto puro na mesma porta (só durante a transição); com a API em TLS, false.
#
# Os papéis são conferidos a cada início (senha do fai_app = variável atual: rotação = trocar a variável e reiniciar
# o Cassandra e a API). Como aplicar: infra/railway/README.md.
set -eu
: "${CASSANDRA_ADMIN_PASSWORD:?defina CASSANDRA_ADMIN_PASSWORD (secret(40) do Railway)}"
: "${CASSANDRA_APP_PASSWORD:?defina CASSANDRA_APP_PASSWORD (secret(40) do Railway)}"
ADMIN_USER="${CASSANDRA_ADMIN_USER:-fai_admin}"
APP_USER="${CASSANDRA_APP_USER:-fai_app}"
KEYSPACE="${CASSANDRA_APP_KEYSPACE:-fashionai_feed}"
TLS_HOST="${CASSANDRA_TLS_HOST:-cassandra.railway.internal}"
TLS_OPTIONAL="${CASSANDRA_TLS_OPTIONAL:-true}"
DATA=/var/lib/cassandra
TLS="$DATA/fai-tls"
CONF="${CASSANDRA_CONF:-/etc/cassandra}/cassandra.yaml"

log() { echo "fai-start: $*"; }
for v in "$ADMIN_USER" "$APP_USER" "$KEYSPACE" "$CASSANDRA_ADMIN_PASSWORD" "$CASSANDRA_APP_PASSWORD"; do
  case "$v" in *[!A-Za-z0-9_]*) log "nome ou senha com caractere fora de [A-Za-z0-9_]" >&2; exit 1 ;; esac
done
[ "${#CASSANDRA_ADMIN_PASSWORD}" -ge 24 ] && [ "${#CASSANDRA_APP_PASSWORD}" -ge 24 ] || { log "senhas com menos de 24 caracteres" >&2; exit 1; }
case "$TLS_OPTIONAL" in true|false) ;; *) log "CASSANDRA_TLS_OPTIONAL deve ser true ou false" >&2; exit 1 ;; esac

# --- TLS: CA própria + certificado do nó (uma vez, no volume) ---
if [ ! -s "$TLS/node.p12" ]; then
  log "gerando CA e certificado do nó em $TLS"
  rm -rf "$TLS"; mkdir -p "$TLS"; chmod 700 "$TLS"
  head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$TLS/storepass"; chmod 600 "$TLS/storepass"
  SP="-storepass:file $TLS/storepass -keypass:file $TLS/storepass -storetype PKCS12"
  keytool -genkeypair -keystore "$TLS/ca.p12" $SP -alias ca -keyalg RSA -keysize 3072 -validity 3650 \
    -dname "CN=fai-cassandra-ca,O=FashionAI" -ext bc:c=ca:true,pathlen:0 -ext ku:c=keyCertSign,cRLSign
  keytool -exportcert -rfc -keystore "$TLS/ca.p12" $SP -alias ca -file "$TLS/ca.pem"
  keytool -genkeypair -keystore "$TLS/node.p12" $SP -alias node -keyalg RSA -keysize 2048 -validity 3650 \
    -dname "CN=$TLS_HOST,O=FashionAI"
  keytool -certreq -keystore "$TLS/node.p12" $SP -alias node -file "$TLS/node.csr"
  keytool -gencert -keystore "$TLS/ca.p12" $SP -alias ca -infile "$TLS/node.csr" -outfile "$TLS/node.crt" -rfc \
    -validity 3650 -ext "SAN=dns:$TLS_HOST,dns:localhost,ip:127.0.0.1" -ext ku:c=digitalSignature,keyEncipherment \
    -ext eku=serverAuth
  keytool -importcert -noprompt -keystore "$TLS/node.p12" $SP -alias ca -file "$TLS/ca.pem"
  keytool -importcert -noprompt -keystore "$TLS/node.p12" $SP -alias node -file "$TLS/node.crt"
  rm -f "$TLS/node.csr" "$TLS/node.crt"
fi

# --- cassandra.yaml: autenticação, autorização e o bloco client_encryption_options ---
sed -i -e 's/^authenticator:.*/authenticator: PasswordAuthenticator/' \
       -e 's/^authorizer:.*/authorizer: CassandraAuthorizer/' \
       -e 's/^role_manager:.*/role_manager: CassandraRoleManager/' "$CONF"
awk -v ks="$TLS/node.p12" -v pw="$(cat "$TLS/storepass")" -v opt="$TLS_OPTIONAL" '
  /^client_encryption_options:/ {
    print; print "  enabled: true"; print "  optional: " opt
    print "  keystore: " ks; print "  keystore_password: " pw; print "  store_type: PKCS12"
    print "  require_client_auth: false"; print "  protocol: TLS"; print "  accepted_protocols: [TLSv1.2, TLSv1.3]"
    skip = 1; next
  }
  skip && /^ / { next }
  { skip = 0; print }
' "$CONF" > "$CONF.fai" && cat "$CONF.fai" > "$CONF" && rm -f "$CONF.fai"

# --- papéis: conferidos a cada início, em segundo plano, quando o CQL responder ---
cql() {  # usuário senha [arquivo .cql]  (senhas em arquivos 0600, nunca na linha de comando)
  rc=$(mktemp); chmod 600 "$rc"
  printf '[authentication]\nusername = %s\npassword = %s\n[connection]\ntimeout = 30\n[ssl]\ncertfile = %s\nvalidate = true\n' \
    "$1" "$2" "$TLS/ca.pem" > "$rc"
  if [ $# -ge 3 ]; then set -- -f "$3"; else set -- -e "SELECT release_version FROM system.local"; fi
  cqlsh --ssl --cqlshrc="$rc" 127.0.0.1 9042 "$@" >/dev/null 2>"$rc.err"; r=$?
  [ $r -eq 0 ] || LAST_ERR=$(tail -1 "$rc.err")
  rm -f "$rc" "$rc.err"; return $r
}
bootstrap() {
  set +e
  LAST_ERR=""
  i=0
  while :; do
    i=$((i + 1))
    if cql "$ADMIN_USER" "$ADMIN_PW"; then break; fi
    if cql cassandra cassandra; then
      f=$(mktemp); chmod 600 "$f"
      printf "CREATE ROLE IF NOT EXISTS %s WITH PASSWORD = '%s' AND SUPERUSER = true AND LOGIN = true;\n" \
        "$ADMIN_USER" "$ADMIN_PW" > "$f"
      cql cassandra cassandra "$f" && log "superusuário $ADMIN_USER criado" || log "falha ao criar $ADMIN_USER: $LAST_ERR"
      rm -f "$f"; [ $i -ge 120 ] && return 1; continue
    fi
    [ $i -ge 120 ] && { log "ERRO: nem $ADMIN_USER nem o papel padrão autenticam ($LAST_ERR). Papéis NÃO conferidos — veja infra/railway/README.md"; return 1; }
    sleep 5
  done
  f=$(mktemp); chmod 600 "$f"
  rnd=$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')
  cat > "$f" <<CQL
ALTER ROLE cassandra WITH PASSWORD = '$rnd' AND SUPERUSER = false AND LOGIN = false;
CREATE KEYSPACE IF NOT EXISTS $KEYSPACE WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};
CREATE ROLE IF NOT EXISTS $APP_USER WITH PASSWORD = '$APP_PW' AND LOGIN = true;
ALTER ROLE $APP_USER WITH LOGIN = true AND SUPERUSER = false;
GRANT SELECT ON KEYSPACE $KEYSPACE TO $APP_USER;
GRANT MODIFY ON KEYSPACE $KEYSPACE TO $APP_USER;
GRANT CREATE ON KEYSPACE $KEYSPACE TO $APP_USER;
GRANT ALTER ON KEYSPACE $KEYSPACE TO $APP_USER;
CQL
  ok=1
  cql "$ADMIN_USER" "$ADMIN_PW" "$f" || { ok=0; log "ERRO ao conferir os papéis: $LAST_ERR"; }
  # senha do fai_app = variável atual (rotação); o Cassandra recusa duas trocas de senha em menos de 5 s
  if [ $ok -eq 1 ] && ! cql "$APP_USER" "$APP_PW"; then
    sleep 6
    printf "ALTER ROLE %s WITH PASSWORD = '%s';\n" "$APP_USER" "$APP_PW" > "$f"
    cql "$ADMIN_USER" "$ADMIN_PW" "$f" && log "senha de $APP_USER atualizada" || { ok=0; log "ERRO ao trocar a senha de $APP_USER: $LAST_ERR"; }
  fi
  rm -f "$f"
  [ $ok -eq 1 ] && log "pronto: autenticação ligada, papel padrão desativado, $APP_USER só em $KEYSPACE (TLS opcional=$TLS_OPTIONAL)"
}

ADMIN_PW="$CASSANDRA_ADMIN_PASSWORD"; APP_PW="$CASSANDRA_APP_PASSWORD"
unset FAI_START_SCRIPT CASSANDRA_ADMIN_PASSWORD CASSANDRA_APP_PASSWORD   # o processo do Cassandra não precisa deles

log "certificado da CA do TLS (vai em CASSANDRA_CA_CERT_PEM na API):"
cat "$TLS/ca.pem"

docker-entrypoint.sh cassandra -f &
PID=$!
trap 'kill -TERM "$PID" 2>/dev/null' TERM INT
bootstrap &
set +e
wait "$PID"; rc=$?
while kill -0 "$PID" 2>/dev/null; do wait "$PID"; rc=$?; done
exit $rc
