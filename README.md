# Fashion AI (TCC 2026)

Rede social de moda com guarda-roupa digital, composição de looks por IA, DNA de Estilo, Hype Score, selos de
marcas/celebridades, Meu Quarto, Smart Mirror, Inventory Score, FAI Points, desafios e Momentos (o calendário da moda:
datas, temporadas, desafios e eventos privados FLAIR — `docs/momentos/MOMENTOS.md`).

Este repositório contém **o sistema inteiro**: a API REST em Java (Spring Boot) e o frontend web em Next.js, além dos
assets e da documentação do projeto.

| Item | Valor |
|---|---|
| Backend | Java 21 (imagem Docker na JVM 25 LTS) · Spring Boot 4.1 (Spring Framework 7, Hibernate 7, Jackson 3) · Spring Security 7 (JWT RS256 próprio) · Spring Data JPA · Flyway · MySQL 8.4/9.x |
| Frontend | Next.js 16 · React 19 · TypeScript · Tailwind CSS · Three.js / React Three Fiber (cenas 3D) |
| Opcionais | Redis (cotas/contadores), Cassandra (timeline/notificações com TTL), OpenSearch (busca), S3/MinIO (mídia) |
| IA | Claude (SDK oficial), Gemini, Replicate (FLUX), FASHN (try-on), Meshy (3D), remove.bg/rembg — com fallback local para cada capacidade |
| Serviços cloud | Vercel (frontend), Railway (API, bancos e bucket S3), Resend (e-mail), Google OAuth (acesso restrito), Open-Meteo (clima) |
| Documentação da API | `http://localhost:8080/swagger-ui.html` (OpenAPI 3 em `/v3/api-docs`) |

## Pré-requisitos

* **JDK 21** e **Maven 3.9** (backend)
* **Node.js 22** e npm (frontend)
* **Docker** (para o MySQL e os serviços opcionais) ou um MySQL 8 local

## Como rodar o sistema completo

São dois processos: a API (porta 8080) e o frontend (porta 3000). Rode tudo na raiz do repositório.

### 1. Backend (API)

```bash
# 1) banco
docker compose -f docker-compose.dev.yml up -d mysql

# 2) variáveis (só o MySQL é obrigatório; o resto tem fallback local)
cp .env.example .env
set -a; . ./.env; set +a
export DATA_ENCRYPTION_KEY=$(openssl rand -base64 32)   # chave AES para campos sensíveis

# 3) build + run (o Flyway cria e atualiza o schema sozinho na subida: V1..V54)
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
capacidade de IA usa o motor local, então o fluxo completo funciona offline. A porta muda com `PORT=` no `.env`.

Serviços opcionais: `docker compose -f docker-compose.dev.yml --profile redis --profile cassandra --profile opensearch --profile minio up -d`
e ligue-os com `REDIS_ENABLED=true`, `CASSANDRA_ENABLED=true` + `SPRING_PROFILES_ACTIVE=cassandra`,
`OPENSEARCH_ENABLED=true`, `STORAGE_TYPE=s3` (veja `.env.example`).

### 2. Frontend (web)

Em outro terminal, também na raiz do repositório:

```bash
# 1) dependências
npm install

# 2) endereço da API (o mesmo host e porta da API acima)
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8080" > .env.local

# 3) servidor de desenvolvimento
npm run dev
```

Abra `http://localhost:3000`. Para criar uma conta use a tela de cadastro (o código de verificação aparece no console
da API quando `EMAIL_PROVIDER=log`). Build de produção: `npm run build && npm run start`.

### 3. Acesso de administrador

Perfis de acesso: `PESSOAL`, `MARCA`, `CELEBRIDADE` (tipo de perfil) × papel `USER`/`ADMIN`. As rotas `/api/admin/**`
exigem `ROLE_ADMIN` no JWT **e** a checagem `Guard.requireAdmin` no serviço (papel relido do banco a cada requisição).
Para promover um administrador (o painel fica em `/admin/dashboard` no frontend):

```sql
UPDATE users SET role='ADMIN' WHERE username='...';
```

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

Todos os endpoints estão no Swagger (`/swagger-ui.html`), com sumário e descrição (RF/CA) em cada operação. Exemplos
de requisição e resposta com dados reais de cada endpoint estão nas evidências do teste ponta a ponta em `docs/testes/`.

## Arquitetura

### Backend

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

### Frontend

```
app/          rotas do Next.js (App Router): páginas do site, área logada, admin e BFF de autenticação (app/bff)
components/   componentes por área (ui/ base, three/ e room3d/ para as cenas 3D, telas de cada funcionalidade)
lib/          cliente da API (lib/api), hooks, internacionalização (lib/i18n: pt-BR, en, es), avatar 3D e utilitários
public/       assets servidos ao navegador (chrome, auras, materiais, skins, ícones, modelos 3D)
test-utils/   utilitários de teste (renderização com providers, mocks da API e das cenas 3D)
```

Temas claro, escuro e alto contraste; textos, datas, números e moeda internacionalizados (pt-BR, en, es).

## Banco de dados

* Schema 100% versionado com Flyway em `fai-infrastructure/persistence-mysql/src/main/resources/db/migration` (V1..V54),
  uma migração por mudança; o Hibernate não altera o schema.
* Regras de negócio reforçadas por índices `UNIQUE` (username/e-mail, seguir 1×, 1 Look do Dia por dia, 1 voto por entrada, ledger idempotente de FAI Points).
* Dashboard gerencial com `GROUP BY` (`MysqlAnalyticsAdapter`), views `vw_country_insights`/`vw_brand_usage` e procedures
  `sp_admin_kpis`, `sp_timeseries`, `sp_ai_cost_by_country` e `sp_purge_notifications` (V6 e V10).
* NoSQL opcional: Cassandra com tabelas particionadas por usuário e TTL (`cassandra/schema.cql`); Redis com TTL para cotas e cache.
* Backup: `scripts/backup/mysql_backup.sh` (mysqldump + gzip + retenção) ou `POST /api/admin/backups` (job diário 03:00).

## Testes e qualidade

### Backend

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 21)   # macOS; em outros sistemas, aponte para o JDK 21
mvn test      # testes unitários e WebMvc
mvn verify    # testes + relatório de cobertura JaCoCo em fai-*/target/site/jacoco/index.html
```

O relatório do JaCoCo sai por módulo (o principal é `fai-application/target/site/jacoco/index.html`). Para ver a
cobertura de linhas do backend inteiro, depois do `mvn verify`:

```bash
python3 -c "
import csv,glob
m=c=0
for f in glob.glob('**/target/site/jacoco/jacoco.csv',recursive=True):
    for r in csv.DictReader(open(f)):
        m+=int(r['LINE_MISSED']); c+=int(r['LINE_COVERED'])
print(f'Backend: {c}/{m+c} linhas = {100*c/(m+c):.2f}%')
"
```

### Frontend

```bash
npm test                 # testes (Vitest + Testing Library)
npm run test:coverage    # testes + cobertura em coverage/index.html (resumo no terminal)
npx tsc --noEmit         # checagem de tipos
```

A [refatoração do provador](docs/REFATORACAO_PROVADOR.md) explica a divisão da rota `/try-on`
em componentes funcionais, hooks e conversões, com os testes de caracterização e a grade paginada do catálogo.

### Integração contínua

`.github/workflows/ci.yml` roda em todo pull request e em todo push para a `main`: build e testes da API
(`mvn verify`), typecheck, testes, build e `npm audit` do frontend, e varredura de segredos (gitleaks) no histórico.
O deploy do frontend (Vercel: Preview por PR e Production na `main`) e da API (Railway) acontece depois do CI.
Detalhes de deploy em `docs/deploy/DEPLOY.md`.

## Estrutura do repositório

* `fai-*` — módulos Maven do backend (veja Arquitetura).
* `app/`, `components/`, `lib/`, `public/`, `test-utils/` — frontend Next.js.
* `docs/` — rubricas (`docs/rubricas/`), testes ponta a ponta e evidências (`docs/testes/`), deploy, diagramas, anatomias de cards, tipografia, ícones, Meu Guarda-Roupa.
* `markdowns/` — histórias de usuário (HU01–HU21), critérios de aceite por RF, diagramas UML/atividade, pipelines.
* `scripts/` — geradores (ícones, rubricas), backup/restore, chaves JWT, checagens de i18n, roteiro ponta a ponta.
* `docker-compose.dev.yml`, `Dockerfile.backend` — ambiente local e imagem da API.
