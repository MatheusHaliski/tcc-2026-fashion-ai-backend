# Bancos do FashionAI no Railway — endurecimento como código

Cada banco roda a imagem oficial com um **script de início** versionado aqui. O script vai para o Railway numa
variável do serviço (`FAI_START_SCRIPT`) e o comando de início só o executa — assim a configuração de segurança
fica no git, revisável e reaplicável, sem imagem própria nem build.

| Serviço | Script | O que muda |
|---|---|---|
| Redis 8.2 | `redis/start.sh` | usuário ACL `fashionai` só para a API: chaves `rate:* counter:* render:* jobs:*`, sem comandos `@dangerous` (FLUSHALL, CONFIG, KEYS, DEBUG, MODULE, ACL...), sem pub/sub. `default` continua só para administração. |
| MySQL 9 | `mysql/start.sh` | `fai_app` (API) só no banco da aplicação, sem privilégio global, **só com TLS**; `fai_backup` só leitura para o mysqldump, só com TLS. `root` fica para administração. |
| Cassandra 4.1 | `cassandra/start.sh` | `PasswordAuthenticator` + `CassandraAuthorizer`; `fai_admin` (superusuário), `fai_app` (só o keyspace `fashionai_feed`, sem DROP/AUTHORIZE); papel padrão `cassandra` desativado; TLS cliente→nó com CA própria. |
| OpenSearch 2.19 | `opensearch/start.sh` | plugin de segurança ligado, TLS no HTTP e no transporte com CA própria (nunca os certificados de demonstração), só o `admin` no `internal_users.yml` (os usuários de demonstração com senha pública nunca entram), `fai_app` só em `fai-*`, auditoria de falhas no log. |

Todos os scripts:
- conferem as senhas (pelo menos 24 caracteres, só `[A-Za-z0-9_]`). **MySQL e Redis nunca deixam de subir** por
  isso (a API inteira depende deles): sobem como antes, sem os usuários novos, com `fai-start: ERRO` no log.
  Cassandra e OpenSearch recusam subir sem senhas válidas (falham fechados: nunca sobem sem autenticação);
- conferem usuários, papéis e permissões **a cada início** (idempotentes): rotação de senha = trocar a variável e
  reiniciar o banco e depois a API;
- tiram o próprio script e as senhas do ambiente do processo do banco antes de entregá-lo à imagem;
- escrevem senhas só em arquivos 0600 temporários, nunca na linha de comando.

## Como aplicar (uma vez por serviço)

1. **Variáveis do serviço do banco** (Railway → serviço → Variables). As senhas são geradas pelo próprio Railway e
   nunca passam por chat, terminal ou git:

   | Serviço | Variáveis novas |
   |---|---|
   | Redis | `REDIS_APP_PASSWORD=${{secret(40, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")}}` |
   | MySQL | `MYSQL_APP_PASSWORD=${{secret(40, "...")}}`, `MYSQL_BACKUP_PASSWORD=${{secret(40, "...")}}` |
   | cassandra | `CASSANDRA_ADMIN_PASSWORD=${{secret(40, "...")}}`, `CASSANDRA_APP_PASSWORD=${{secret(40, "...")}}`, `CASSANDRA_TLS_OPTIONAL=true` |
   | opensearch | `OPENSEARCH_ADMIN_PASSWORD=${{secret(40, "...")}}`, `OPENSEARCH_APP_PASSWORD=${{secret(40, "...")}}` |

   (`"..."` = o mesmo alfabeto alfanumérico da primeira linha.) Mais `FAI_START_SCRIPT` = conteúdo do `start.sh`.

2. **Comando de início** do serviço (Settings → Deploy → Custom Start Command): a saída de
   `infra/railway/start-command.sh <redis|mysql|cassandra|opensearch>`. Ele só roda `FAI_START_SCRIPT` se o SHA-256
   bater com o `start.sh` desta pasta (o valor da variável é o arquivo **sem** a quebra de linha final); se não bater
   — variável colada errada ou script desatualizado —, o banco sobe exatamente como antes do endurecimento e o log
   mostra `fai-start: ERRO: FAI_START_SCRIPT difere...`. Mudou um `start.sh`? Atualize a variável **e** o comando.

3. **Variáveis da API** (serviço `api`), por referência — o valor nunca é copiado:

   | Banco | Variáveis da API |
   |---|---|
   | Redis | `REDIS_USERNAME=fashionai`, `REDIS_PASSWORD=${{Redis.REDIS_APP_PASSWORD}}` |
   | MySQL | `MYSQL_USER=fai_app`, `MYSQL_PASSWORD=${{MySQL.MYSQL_APP_PASSWORD}}`, `MYSQL_SSL_MODE=REQUIRED`, `MYSQL_BACKUP_USER=fai_backup`, `MYSQL_BACKUP_PASSWORD=${{MySQL.MYSQL_BACKUP_PASSWORD}}` |
   | Cassandra | `CASSANDRA_USERNAME=fai_app`, `CASSANDRA_PASSWORD=${{cassandra.CASSANDRA_APP_PASSWORD}}`, `CASSANDRA_CREATE_KEYSPACE=false`, `CASSANDRA_SSL=true`, `CASSANDRA_CA_CERT_PEM=<certificado do log>` |
   | OpenSearch | `OPENSEARCH_URL=https://opensearch.railway.internal:9200`, `OPENSEARCH_USERNAME=fai_app`, `OPENSEARCH_PASSWORD=${{opensearch.OPENSEARCH_APP_PASSWORD}}`, `OPENSEARCH_CA_CERT_PEM=<certificado do log>` |

   O certificado da CA (público) sai no log do banco a cada início, logo depois de
   `fai-start: certificado da CA do TLS`.

## Ordem sem queda

| Passo | Por quê |
|---|---|
| 1. Redis e MySQL: variáveis + comando de início + reiniciar o banco | os usuários novos passam a existir; `default`/`root` continuam iguais, a API atual não percebe |
| 2. Cassandra: variáveis do banco (sem reiniciar) | as senhas existem para a API referenciar |
| 3. API: Redis, MySQL e Cassandra (usuário/senha, `CASSANDRA_CREATE_KEYSPACE=false`) | Cassandra ainda sem autenticação ignora as credenciais; se algo falhar, o health check segura o deploy novo e o antigo continua no ar |
| 4. Cassandra: comando de início + reiniciar | autenticação ligada; a API já tem as credenciais. TLS opcional (texto puro ainda aceito) |
| 5. OpenSearch: variáveis + comando de início + reiniciar | a busca da API cai para o MySQL até o passo 6 (o adaptador já faz isso); indexação falha com aviso no log |
| 6. API: `CASSANDRA_SSL`/CA e OpenSearch (`https`, usuário, CA) | os dois com TLS e senha |
| 7. Cassandra: `CASSANDRA_TLS_OPTIONAL=false` + reiniciar | texto puro recusado |

## Conferir

- log do banco: `fai-start: usuário ACL fashionai ativo` (Redis), `fai-start: usuários ... conferidos` e nenhum
  `[ERROR]` logo depois (MySQL), `fai-start: pronto: ...` (Cassandra e OpenSearch), e nenhum `fai-start: ERRO`;
- `GET /actuator/health` da API: `db`, `redis`, `cassandra` em `UP`;
- auditoria do OpenSearch: `FAILED_LOGIN` e `MISSING_PRIVILEGES` aparecem no log do serviço `opensearch`.

## Manutenção

- **Rotação da senha da aplicação**: troque a variável no banco (`${{secret(...)}}` de novo), reinicie o banco e
  depois a API (as referências pegam o valor novo no deploy).
- **Senha de administrador** (`fai_admin`, `admin`): os scripts não a trocam sozinhos (precisariam da senha antiga).
  Cassandra: `ALTER ROLE fai_admin WITH PASSWORD = '...'` pelo cqlsh; OpenSearch: `PUT _plugins/_security/api/account`
  como `admin`. Depois, atualize a variável.
- **Certificados** (10 anos, no volume em `fai-tls/` ou `.fai-tls/`): apagar a pasta gera CA nova no próximo início;
  atualize então `*_CA_CERT_PEM` na API.
- **Prefixo novo no Redis** (`fai-infrastructure/cache-redis`): acrescente em `redis/start.sh`, senão volta `NOPERM`.
- **Tabelas do Cassandra criadas pela API** ficam com permissão total para `fai_app` (comportamento do Cassandra
  para quem cria); as atuais foram criadas antes da autenticação e não têm esse dono.

## Testado

Cada script foi testado com a imagem exata do Railway num volume criado do jeito que o Railway cria hoje, sem
autenticação e com dados, para simular a migração. Também foi testado o segundo início (idempotente) e, com
SIGTERM, o encerramento limpo. A API (jar desta branch) subiu contra os quatro bancos endurecidos ao mesmo tempo:
Flyway aplicou as 27 migrações como `fai_app`, o health ficou `UP` e a busca chegou ao OpenSearch por TLS.
Também foi conferido o que precisa ser recusado: login padrão `cassandra/cassandra`, usuários de demonstração do
OpenSearch, `fai_app` fora do seu escopo (DROP, CREATE KEYSPACE, `system_auth`, `mysql.user`, CREATE USER,
FLUSHALL, KEYS, CONFIG, índices fora de `fai-*`, API de segurança, configurações do cluster), texto puro com TLS
obrigatório e escrita pelo usuário de backup.

## Estado em produção (projeto `fashion-ai-tcc-2026`, ambiente `production`)

| Passo | Quando (UTC) | Resultado |
|---|---|---|
| 1. Redis: ACL `fashionai` | 2026-10-03 12:56 | `fai-start: usuário ACL fashionai ativo`. A API ainda não usa Redis em produção (perfil `redis` inativo); o usuário fica pronto. |
| 1. MySQL: `fai_app` / `fai_backup` | 2026-10-03 12:57 | usuários conferidos, sem `[ERROR]`. O redeploy trouxe a imagem atual do `mysql:9`: **9.4.0 → 9.7.2** (corrige o alerta CVE-2026-21964 que o Railway já tinha armado). |
| 3. API → `fai_app` (TLS obrigatório) + credenciais do Cassandra | 2026-10-03 22:46 | deploy SUCCESS; Flyway validou 28 migrações como `fai_app`. A API não usa mais `root`. |
| 4. Cassandra: autenticação + TLS opcional | 2026-10-03 22:53 | `fai-start: pronto` — `fai_admin` criado, papel `cassandra` desativado, `fai_app` só em `fashionai_feed`. |
| 6. API → Cassandra com TLS (CA fixada) | 2026-10-03 22:57 | API conectou com TLS + `fai_app` (sem o aviso "did not send an authentication challenge"). |
| 5. OpenSearch: plugin de segurança | 2026-10-03 22:56 | `fai-start: pronto` — TLS no HTTP e no transporte (CA própria), só `admin` no `internal_users.yml`, `fai_app` só em `fai-*`, auditoria no log. |
| 7. Cassandra: TLS obrigatório | 2026-10-03 23:05 | `listening for CQL clients (encrypted)`; texto puro recusado. |
| 6. API → OpenSearch `https` + `fai_app` + CA | 2026-10-03 23:05 | deploy SUCCESS; reconectou o Cassandra no IP novo com TLS. Sem falhas no log da API nem na auditoria do OpenSearch. |

Tudo aplicado. Pendências só do painel: apagar o serviço `tmp-probe-secret` (sobra de um teste; a exclusão pela API do
Railway expira) e, quando quiser usar Redis na API, ligar o perfil `redis` (o usuário ACL já existe).

### Lições desta aplicação

- **IP do Cassandra muda a cada deploy** e o driver resolvia o nome só na subida da API: depois de reiniciar o
  Cassandra, a API ficou tentando o IP antigo até ser reimplantada. Corrigido no código (contact points por nome,
  `CASSANDRA_RESOLVE_CONTACT_POINTS=false`); até esse código chegar à produção, **reimplante a API depois de
  reiniciar o Cassandra**.
- O Cassandra deste contêiner leva ~3–4 min para abrir o CQL (replay do commit log com 512 MB de heap); o
  bootstrap espera até ~10 min.
- Redeploy de serviço com `image: mysql:9` puxa a versão mais nova da série 9 (upgrade in-place do dicionário de
  dados). Para controlar quando isso acontece, fixe a tag (ex.: `mysql:9.7`).
