# Fashion AI — backend (TCC 2026)

API REST do **Fashion AI**, rede social de moda com guarda-roupa digital, composição de looks por IA, DNA de Estilo,
Hype Score, selos de marcas/celebridades, Meu Quarto, Smart Mirror, Inventory Score, FAI Points, desafios e Momentos (o calendário da moda: datas, temporadas, desafios e eventos privados FLAIR — `docs/momentos/MOMENTOS.md`).
Este repositório contém o backend Java (Spring Boot 4.1, Java 21) e os assets/documentação do projeto.
O frontend Next.js consome esta API.

| Item | Valor |
|---|---|
| Stack | Java 21 (imagem Docker na JVM 25 LTS) · Spring Boot 4.1 (Spring Framework 7, Hibernate 7, Jackson 3) · Spring Security 7 (JWT RS256 próprio) · Spring Data JPA · Flyway · MySQL 8.4/9.x |
| Opcionais | Redis (cotas/contadores), Cassandra (timeline/notificações com TTL), OpenSearch (busca), S3/MinIO (mídia) |
| IA | Claude (SDK oficial), Gemini, Replicate (FLUX), FASHN (try-on), Meshy (3D), remove.bg/rembg — com fallback local para cada capacidade |
| Documentação da API | `http://localhost:8080/swagger-ui.html` (OpenAPI 3 em `/v3/api-docs`) |

## Como rodar em 5 minutos

Pré-requisitos: JDK 21, Maven 3.9, Docker (para o MySQL) ou um MySQL 8 local.

```bash
# 1) banco
docker compose -f docker-compose.dev.yml up -d mysql

# 2) variáveis (só o MySQL é obrigatório; o resto tem fallback local)
cp .env.example .env
set -a; . ./.env; set +a
export DATA_ENCRYPTION_KEY=$(openssl rand -base64 32)   # chave AES para campos sensíveis

# 3) build + run (Flyway cria o schema V1..V6 na primeira subida)
mvn -DskipTests package            # rode na raiz do repositório (onde está o pom.xml)
ls fai-bootstrap/target/fai-bootstrap-*.jar   # o jar só existe se o build terminar com BUILD SUCCESS
java -jar fai-bootstrap/target/fai-bootstrap-*.jar
# alternativa sem java -jar: mvn -DskipTests install && mvn -pl fai-bootstrap spring-boot:run
```

> **`Error: Unable to access jarfile fai-bootstrap/target/...jar`**: o jar não foi gerado. Causas comuns:
> (1) o `mvn package` falhou ou não foi executado (leia o erro acima do `BUILD FAILURE`; `java -version` e
> `mvn -v` precisam mostrar JDK 21 ou superior); (2) o comando `java -jar` foi executado fora da raiz do
> repositório (o caminho é relativo); (3) o `mvn` foi rodado dentro de um submódulo em vez da raiz.

Depois: `curl http://localhost:8080/actuator/health` → `{"status":"UP"}` e abra o Swagger em
`http://localhost:8080/swagger-ui.html`. Sem chaves de IA, e-mails saem no console (`EMAIL_PROVIDER=log`) e cada
capacidade de IA usa o motor local, então o fluxo completo funciona offline.

Serviços opcionais: `docker compose -f docker-compose.dev.yml --profile redis --profile cassandra --profile opensearch --profile minio up -d`
e ligue-os com `REDIS_ENABLED=true`, `CASSANDRA_ENABLED=true` + `SPRING_PROFILES_ACTIVE=cassandra`,
`OPENSEARCH_ENABLED=true`, `STORAGE_TYPE=s3` (veja `.env.example`).

## Primeiro uso da API

```bash
# cadastro (abre sessão e devolve accessToken + refreshToken)
curl -X POST localhost:8080/api/auth/register -H 'Content-Type: application/json' -d '{
  "profileType":"PESSOAL","fullName":"Ana Souza","username":"ana.souza","email":"ana@example.com",
  "password":"SenhaForte#2026","confirmPassword":"SenhaForte#2026","acceptTerms":true,"birthDate":"1999-05-10","country":"BR"}'

# login
curl -X POST localhost:8080/api/auth/login -H 'Content-Type: application/json' \
  -d '{"identifier":"ana@example.com","password":"SenhaForte#2026","rememberMe":true}'

# chamadas autenticadas
curl localhost:8080/api/me -H "Authorization: Bearer <accessToken>"
```

Todo erro volta como JSON: `{"status":422,"code":"VALIDACAO","message":"Revise os campos destacados.","details":{...},"path":"/api/pieces","timestamp":"...","correlationId":"..."}`.
O header `X-Correlation-Id` é devolvido em toda resposta e aparece nos logs.

Perfis de acesso: `PESSOAL`, `MARCA`, `CELEBRIDADE` (tipo de perfil) × papel `USER`/`ADMIN`. As rotas `/api/admin/**`
exigem `ROLE_ADMIN` no JWT **e** a checagem `Guard.requireAdmin` no serviço (papel relido do banco a cada requisição).
Para promover um administrador: `UPDATE users SET role='ADMIN' WHERE username='...'`.

## Arquitetura

Monólito modular em arquitetura hexagonal (ports & adapters):

```
fai-domain          entidades JPA, enums, repositórios Spring Data, cifragem AES-GCM de campos sensíveis
fai-application     casos de uso por RF (service/*), motor de IA governado (ai/AiEngine), pipelines de imagem locais,
                    portas para o mundo externo (ports/*), eventos de domínio, controle de acesso (security/Guard)
fai-infrastructure  adaptadores: persistence-mysql (auditoria, analytics via procedures/views, backup mysqldump),
                    platform (mídia local, memória, e-mail, Open-Meteo), ai-providers (Claude, Gemini, imagem),
                    cache-redis, persistence-cassandra, search-opensearch, storage-s3 (todos opt-in por propriedade)
fai-web             controllers REST (um por RF/área), segurança JWT, tratamento de erros, OpenAPI
fai-bootstrap       aplicação Spring Boot, application.yml, agendadores
```

Padrões aplicados: Ports & Adapters, Strategy + fallback em cadeia no `AiEngine` (provedor primário → alternativo →
motor local, sempre com log de inferência, consentimento e cota por usuário), Observer (`DomainEvents` via
`ApplicationEventPublisher` para pontos, conquistas, diário e projeções), Repository, Facade (`DashboardService`),
circuit breaker por provedor (`ProviderCircuit`).

## Banco de dados

* Schema 100% versionado com Flyway em `fai-infrastructure/persistence-mysql/src/main/resources/db/migration` (V1..V6).
* Regras de negócio reforçadas por índices `UNIQUE` (username/e-mail, seguir 1×, 1 Look do Dia por dia, 1 voto por entrada, ledger idempotente de FAI Points).
* Dashboard gerencial com `GROUP BY` (`MysqlAnalyticsAdapter`), views `vw_country_insights`/`vw_brand_usage` e procedures
  `sp_admin_kpis`, `sp_timeseries`, `sp_purge_notifications` (V6).
* NoSQL opcional: Cassandra com tabelas particionadas por usuário e TTL (`cassandra/schema.cql`); Redis com TTL para cotas e cache.
* Backup: `scripts/backup/mysql_backup.sh` (mysqldump + gzip + retenção) ou `POST /api/admin/backups` (job diário 03:00).

## Testes e qualidade

```bash
mvn test                       # unitários + WebMvc (segurança por dono do recurso)
mvn verify                     # inclui relatório JaCoCo em fai-*/target/site/jacoco
```

## Estrutura do repositório

* `docs/` — guia das rubricas (`docs/rubricas/GUIA_RUBRICAS.md`), anatomias de cards, tipografia, ícones, Meu Guarda-Roupa.
* `markdowns/` — histórias de usuário (HU01–HU20), critérios de aceite por RF, diagramas UML/atividade, pipelines.
* `public/` — assets servidos ao frontend (chrome, auras, materiais, mosaicos, skins, ícones FAI, imagens padrão de peças).
* `lib/design/` — tokens de tipografia; `lib/icons/` — catálogo dos 77 ícones.
* `scripts/` — geradores (ícones, rubricas), backup/restore, chaves JWT.
