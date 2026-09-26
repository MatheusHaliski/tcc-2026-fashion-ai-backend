# Provisionamento (bancos e IA)

Dois scripts idempotentes: rodar de novo não duplica nada. Credenciais só por variáveis de ambiente (as mesmas do
`.env.example`); nada é impresso nem gravado.

## Bancos — `provision.py`

Lê `docs/planilhas/Entidades_BD_por_RF_RNF.xlsx` e prepara cada banco da aba **Bancos**:

| Banco | O que o script faz | Variáveis |
|---|---|---|
| MySQL 8 | Cria o banco e o usuário da aplicação (só com `MYSQL_ADMIN_*`), confere a versão do Flyway e se **todas as tabelas da aba Entidades** existem | `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`; opcional `MYSQL_ADMIN_USER`, `MYSQL_ADMIN_PASSWORD` |
| Cassandra | Aplica `schema.cql` (keyspace `fashionai_feed`, tabelas `timeline_by_user` e `notifications_by_user`) | `CASSANDRA_ENABLED=true`, `CASSANDRA_CONTACT_POINTS`, `CASSANDRA_PORT`, `CASSANDRA_LOCAL_DATACENTER`, `CASSANDRA_USERNAME`, `CASSANDRA_PASSWORD`; Astra: `CASSANDRA_SECURE_BUNDLE_PATH` ou `CASSANDRA_SECURE_BUNDLE_BASE64` |
| OpenSearch | Cria `fai-pieces` e `fai-schemes` com mapeamento explícito (texto em português + `.keyword` para os filtros) | `OPENSEARCH_ENABLED=true`, `OPENSEARCH_URL`, `OPENSEARCH_USERNAME`, `OPENSEARCH_PASSWORD` |
| Redis | Confere conexão e senha (PING) | `REDIS_ENABLED=true`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_SSL` |
| S3 / MinIO / R2 | Cria o bucket e o CORS para o frontend; com `S3_PUBLIC_READ=true`, leitura pública de `users/` e `pending/` (os documentos em `restricted/` continuam privados) | `STORAGE_TYPE=s3`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `APP_CORS_ALLOWED_ORIGINS` |

> **Cloudflare R2**: nem toda API de bucket policy da AWS tem equivalente no R2, então `S3_PUBLIC_READ=true` pode falhar
> nele. Ative o acesso público direto no painel (bucket → Settings → Public Access) nesse caso.

> **DataStax Astra DB**: o Astra só expõe CQL pelo *Secure Connect Bundle*. Crie o banco com o keyspace
> `fashionai_feed` no painel (o Astra não aceita `CREATE KEYSPACE` por CQL), baixe o bundle e gere um Application Token.
> Depois: `CASSANDRA_USERNAME=token`, `CASSANDRA_PASSWORD=AstraCS:...` e `CASSANDRA_SECURE_BUNDLE_PATH` (arquivo) ou
> `CASSANDRA_SECURE_BUNDLE_BASE64` (`base64 -w0 secure-connect-*.zip`, para hosts sem arquivos). Com o bundle, contact
> points, porta e datacenter são ignorados. O script cria só as tabelas; o backend também as cria na subida.
> Provedores com porta CQL direta (Instaclustr, ScyllaDB Cloud) usam `CASSANDRA_CONTACT_POINTS` normalmente.

```bash
pip install openpyxl boto3 cassandra-driver     # opcionais: planilha, S3 e Cassandra
python3 scripts/provision/provision.py --check  # só confere
python3 scripts/provision/provision.py          # cria o que falta e confere
```

As tabelas do MySQL nascem das migrações Flyway na primeira subida do backend; o script avisa quando ainda não há
migrações e, depois, confere as 76 tabelas da planilha.

## IA — `ai.py`

Basta definir a chave de cada provedor nas variáveis do backend. O script confere cada chave com uma chamada de conta ou
listagem (sem custo), mostra quais RFs passam a usar IA remota e quais ficam no motor local, e sugere as flags.

```bash
python3 scripts/provision/ai.py --write-env
```

| Variável | Provedor | Usado em | Conferência online |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic Claude | RF5/RF10 composição, RF13 DNA, Copilot, visão RF4 | `GET /v1/models` |
| `GOOGLE_AI_API_KEY` | Google Gemini | visão e texto econômicos | `GET /v1beta/models` |
| `REPLICATE_API_TOKEN` | Replicate (FLUX schnell) | RF11 arte de fundo | `GET /v1/account` |
| `STABILITY_API_KEY` | Stability AI | RF16 3D e RF4 upscale | `GET /v1/user/account` |
| `REMOVE_BG_API_KEY` | remove.bg | RF4 remoção de fundo | `GET /v1.0/account` |
| `MESHY_API_KEY` | Meshy | RF16 image-to-3D | só presença |
| `PHOTOROOM_API_KEY` | Photoroom | RF4 estúdio | só presença |
| `FASHN_API_KEY` | FASHN | RF18 provador | só presença |
| `REMBG_URL` | rembg auto-hospedado | RF4 remoção de fundo | `GET /` |

Sem nenhuma chave o app funciona inteiro com os motores locais (heurísticas, recorte e relevo 3D locais).
