#!/bin/sh
# Imprime o "Custom Start Command" de um banco no Railway: roda FAI_START_SCRIPT só se o SHA-256 bater com o script
# desta pasta; senão o banco sobe exatamente como antes do endurecimento e o log diz por quê (variável colada errada
# ou desatualizada nunca derruba o banco). Uso: infra/railway/start-command.sh redis|mysql|cassandra|opensearch
# O valor de FAI_START_SCRIPT é o arquivo SEM a quebra de linha final (o Railway pode apará-la).
set -eu
dir=$(dirname "$0")
svc="${1:?uso: $0 redis|mysql|cassandra|opensearch}"
f="$dir/$svc/start.sh"
[ -f "$f" ] || { echo "sem $f" >&2; exit 1; }
hash=$(printf %s "$(cat "$f")" | sha256sum | cut -c1-16)
case "$svc" in
  # comandos de antes do endurecimento (o que o Railway rodava)
  redis)      before='rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --save 60 1 --dir $RAILWAY_VOLUME_MOUNT_PATH' ;;
  mysql)      before='exec docker-entrypoint.sh mysqld --innodb-use-native-aio=0 --disable-log-bin --performance_schema=0 --innodb-buffer-pool-size=1G' ;;
  cassandra)  before='exec docker-entrypoint.sh cassandra -f' ;;
  opensearch) before='chown -R 1000:1000 /usr/share/opensearch/data && exec chroot --userspec=1000:1000 --skip-chdir / env HOME=/usr/share/opensearch ./opensearch-docker-entrypoint.sh opensearch -Ediscovery.type=single-node' ;;
  *) echo "serviço desconhecido: $svc" >&2; exit 1 ;;
esac
printf '%s\n' "/bin/sh -c 'printf %s \"\$FAI_START_SCRIPT\" > /tmp/fai-start.sh; if [ \"\$(sha256sum < /tmp/fai-start.sh | cut -c1-16)\" = \"$hash\" ]; then unset FAI_START_SCRIPT; exec /bin/sh /tmp/fai-start.sh; fi; echo \"fai-start: ERRO: FAI_START_SCRIPT difere de infra/railway/$svc/start.sh ($hash); subindo como antes\" >&2; unset FAI_START_SCRIPT; $before'"
