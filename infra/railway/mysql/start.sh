#!/bin/sh
# MySQL do FashionAI no Railway (imagem mysql:9): usuários de menor privilégio, recriados a cada início.
#
#   root        administração (painel do Railway, migrações manuais): sem mudança.
#   fai_app     a API (MYSQL_USER/MYSQL_PASSWORD): só o banco da aplicação, com o DDL que o Flyway precisa;
#               nenhum privilégio global (FILE, SUPER, PROCESS, CREATE USER...), nada no schema mysql. Só com TLS.
#   fai_backup  o backup (MYSQL_BACKUP_USER/MYSQL_BACKUP_PASSWORD): leitura para o mysqldump. Só com TLS.
#
# Os comandos vão num --init-file que o mysqld executa como servidor a cada início: as senhas acompanham as
# variáveis do Railway (rotação = trocar a variável e reiniciar o MySQL e a API) e os privilégios são sempre
# exatamente estes (REVOKE + GRANT). Como aplicar: infra/railway/README.md.
set -eu
MYSQLD_ARGS="--innodb-use-native-aio=0 --disable-log-bin --performance_schema=0 --innodb-buffer-pool-size=${MYSQL_INNODB_BUFFER_POOL:-1G}"
APP_USER="${MYSQL_APP_USER:-fai_app}"
BACKUP_USER="${MYSQL_BACKUP_USER:-fai_backup}"

# Falha aqui NUNCA derruba o banco (a API inteira depende dele): sem as variáveis certas, o mysqld sobe como antes,
# sem mexer nos usuários, e o log diz por quê. A API só troca para fai_app depois de "usuários conferidos" no log.
fail_safe() {
  echo "fai-start: ERRO: $* — MySQL sobe SEM conferir fai_app/fai_backup (infra/railway/README.md)" >&2
  unset FAI_START_SCRIPT MYSQL_APP_PASSWORD MYSQL_BACKUP_PASSWORD
  # shellcheck disable=SC2086
  exec docker-entrypoint.sh mysqld $MYSQLD_ARGS
}
[ -n "${MYSQL_DATABASE:-}" ] || fail_safe "MYSQL_DATABASE vazia"
[ -n "${MYSQL_APP_PASSWORD:-}" ] && [ -n "${MYSQL_BACKUP_PASSWORD:-}" ] || fail_safe "MYSQL_APP_PASSWORD ou MYSQL_BACKUP_PASSWORD vazia"
for v in "$MYSQL_DATABASE" "$APP_USER" "$BACKUP_USER" "$MYSQL_APP_PASSWORD" "$MYSQL_BACKUP_PASSWORD"; do
  case "$v" in *[!A-Za-z0-9_]*) fail_safe "nome ou senha com caractere fora de [A-Za-z0-9_]" ;; esac
done
[ "${#MYSQL_APP_PASSWORD}" -ge 24 ] && [ "${#MYSQL_BACKUP_PASSWORD}" -ge 24 ] || fail_safe "senhas com menos de 24 caracteres"

INIT=$(mktemp /tmp/fai-init.XXXXXX)
chmod 600 "$INIT"
DB="\`$MYSQL_DATABASE\`"
cat > "$INIT" <<SQL
CREATE USER IF NOT EXISTS '$APP_USER'@'%' IDENTIFIED BY '$MYSQL_APP_PASSWORD' REQUIRE SSL;
ALTER USER '$APP_USER'@'%' IDENTIFIED BY '$MYSQL_APP_PASSWORD' REQUIRE SSL ACCOUNT UNLOCK;
REVOKE ALL PRIVILEGES, GRANT OPTION FROM '$APP_USER'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, REFERENCES, CREATE TEMPORARY TABLES, LOCK TABLES, EXECUTE, CREATE VIEW, SHOW VIEW, CREATE ROUTINE, ALTER ROUTINE, TRIGGER, EVENT ON $DB.* TO '$APP_USER'@'%';
CREATE USER IF NOT EXISTS '$BACKUP_USER'@'%' IDENTIFIED BY '$MYSQL_BACKUP_PASSWORD' REQUIRE SSL;
ALTER USER '$BACKUP_USER'@'%' IDENTIFIED BY '$MYSQL_BACKUP_PASSWORD' REQUIRE SSL ACCOUNT UNLOCK;
REVOKE ALL PRIVILEGES, GRANT OPTION FROM '$BACKUP_USER'@'%';
GRANT SELECT, SHOW VIEW, TRIGGER, LOCK TABLES, EVENT ON $DB.* TO '$BACKUP_USER'@'%';
GRANT SHOW_ROUTINE ON *.* TO '$BACKUP_USER'@'%';
SQL
chown mysql:mysql "$INIT"

unset FAI_START_SCRIPT MYSQL_APP_PASSWORD MYSQL_BACKUP_PASSWORD   # já estão no arquivo; o mysqld não precisa deles

# o arquivo só precisa existir até o servidor ler; depois de pronto, sai do disco
( while [ ! -S /var/run/mysqld/mysqld.sock ]; do sleep 2; done; sleep 15; rm -f "$INIT" ) &

echo "fai-start: usuários $APP_USER e $BACKUP_USER conferidos no início (--init-file); erros aparecem como [ERROR] logo abaixo"
# shellcheck disable=SC2086
exec docker-entrypoint.sh mysqld --init-file="$INIT" $MYSQLD_ARGS
