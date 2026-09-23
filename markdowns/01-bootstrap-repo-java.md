# Etapas 1 e 2 — Novo repositório Fashion AI (Java) : insumos, decisões e prompt de bootstrap

## 1. Inventário de insumos

### 1.1 Já disponíveis neste repositório

| Insumo | Caminho | Uso na migração |
|---|---|---|
| Especificação completa (3 Objetivos, É/Não É, Visão, Atores, RF, HU, Modelo de dados, UML) | `docs/especificacao-fai-social-network.md` | Base textual do novo README e do domínio |
| SRS e Especificação em PDF | `FAI_SRS_Rede_Social.pdf`, `FAI_Social_Network_Especificacao_TCC.pdf` | Anexos do TCC |
| Histórias de Usuário 01–20 | `markdowns/HU01.md` … `markdowns/HU20.md` | HU20 = DNA de Estilo; HU17 = Autopiloto. **Correção desta rodada:** estes arquivos são a versão histórica/local — a fonte canônica dos Critérios de Aceite hoje é a checklist "Critérios de Aceite" de cada card **HU-RF1…HU-RF26** no Product Backlog do Trello (regra explícita de `02-rf-reestruturados-e-criterios-aceite.md` §0: um CA vive em um único lugar). Não há ainda card HU-RF para RF31–RF36 (§1.3) — nascem só em texto neste repositório. |
| UML — casos de uso da rede social | `docs/uml-casos-rede-social.md` | Diagramas de caso de uso (parte 3) |
| UML — atores e atividades principais | `docs/uml-actors-main-activities.md`, `docs/main-activity-workflows.md` | Base dos diagramas de atividade (Etapa 8) |
| UML — casos, ER e classes | `docs/uml-casos-er-classes.md`, `docs/relational-entity-diagrams-activities.md` | Modelo de classes JPA |
| Design do card de esquema e de peça | `docs/design-schema-outfit-card.md`, `docs/design-schema-piece-card.md` | Especificação de interface (Etapa 7) |
| Diagramas HTML | `docs/diagrama-outfit-card.html`, `docs/diagrama-pipeline-3d.html` | Artefatos de modelagem já prontos |
| Arquitetura de persistência poliglota | `docs/arquitetura-persistencia-poliglota.md` | **Base direta da decisão MySQL + NoSQL** |
| Migração Firestore → MySQL | `docs/migracao-firestore-mysql.md`, `db/`, `migrations/` | Esquema relacional de partida |
| Vínculo marca/celebridade por selo | `docs/rf20-rf21-vinculo-marca-celebridade.md` | RF20/RF21 |
| **Meu Quarto, Vista-me, Destaques, Desafios & Games** *(novo, ver §1.3)* | `docs/meu-quarto/01-especificacao-meu-quarto.md`, `02-inventory-score-calculo.md`, `03-desafios-e-games.md`, `04-detalhes-de-engajamento.md`, `RF33_Vista-me_Atividades.puml` | RF32–RF36, extensão de RF10 |
| Board Trello | *TCC 2026 (Fashion AI)* — listas RF (**27 cards** — 26 RF + 1 de rastreabilidade, atualizado desta rodada; era 30 antes da absorção de RF27–RF29), RNF (**12 cards**, atualizado desta rodada; era 8), Product Backlog (cards HU-RF1–HU-RF26), 4 Sprints | Requisitos e cronograma |

### 1.2 Insumos que **faltam** e precisam ser depositados antes da Etapa 6/7

> ✅ O material de padrões de interface **LGPD** do RNF6 já foi recebido e está em `insumos/lgpd/padroes-interface-lgpd.html`.
>
> O conector do Trello desta sessão lê cards, listas, descrições, checklists e comentários — **mas não expõe anexos**. Os arquivos abaixo ainda precisam ser baixados manualmente e colocados em `docs/novo-projeto/insumos/`:

| Insumo | Onde está | Etapa que trava sem ele |
|---|---|---|
| **Artefato "Vinte pranchas"** das novas telas | anexo/Drive do time | Etapa 6 inteira |
| **Aulas**: Perfil Lookbook, DNA de Estilo, Closet Digital | material da disciplina | Etapa 3 (refinamento de CAs desses RFs) |
| Artefato de modelagem UML **parte 3** | anexo do board | Etapa 7 (esquema de vestimenta e peças) |

Enquanto não chegarem, os CAs de RF6, RF13 e RF23 no documento `02-…` foram escritos a partir de HU20, HU05, HU12 e dos documentos de design de card já versionados — devem ser **revalidados** contra as aulas.

---

### 1.3 Requisitos e numeração — o que mudou desde a última atualização deste documento

**Política de numeração (`02-rf-reestruturados-e-criterios-aceite.md` §1): números de RF nunca são reciclados.** RFs absorvidos ficam `[ABSORVIDO em RFx]` e arquivados; RFs novos recebem o próximo número livre. Isso já explicava `RF24` (motor de IA, número reaproveitado) e a criação de `RF31`. Desde então:

- **RF31 — Filtros de estado do acervo** (favoritar/disponível/indisponível/todos, desmembrado de RF19) já estava coberto por `02-rf-reestruturados-e-criterios-aceite.md`, mas não constava na lista de RF cobertos pela seção 4 deste documento (corrigido abaixo).
- **RF32–RF36 são novos**, especificados em `docs/meu-quarto/` (§1.1): **RF32** Meu Quarto, **RF33** Smart Mirror e Vista-me (`RF33_Vista-me_Atividades.puml`), **RF34** Destaques do Meu Inventário, **RF35** FAI Points e progressão do quarto, **RF36** Desafios & Games (`03-desafios-e-games.md`). Nenhum é redenominação de um RF existente — todos usam número novo, seguindo a política acima.
- **RF10 (Copilot) foi estendido**, não renumerado — ganha os CAs `RF10.CA08` em diante para o Copilot contextual do Meu Quarto.
- **Nenhum destes seis (RF31–RF36) tem card HU-RF correspondente no Trello ainda** — o Product Backlog vai só até `HU-RF26`. Enquanto isso não for criado, os Critérios de Aceite de RF31–RF36 vivem só nos arquivos-fonte listados acima (não na checklist do Trello, como a regra de `02-…` §0 exige para os demais RFs).
- **Contagem de cards do board Trello mudou** (tabela da seção 1.1): a lista *Requisitos Funcionais* caiu de 30 para 27 cards (absorção de RF27–RF29 em RF1/RF6, já arquivados) e a lista *RNF* cresceu de 8 para 12 cards (RNF9–RNF12 são adições mais recentes: dimensões de card, notificações via chrome, tratamento de upload, diretrizes de promoção de selo).

**Ação para quem for atualizar a seção 4 (prompt de bootstrap) ou o documento `02-…`:** tratar RF31–RF36 como requisitos reais e numerados, não como rascunho — mas sinalizar ao time que os CAs precisam de um card HU-RF antes de serem considerados "canônicos" pela própria regra do projeto.

---

## 2. Tabela de decisões técnicas do novo repositório

| Dimensão | Decisão | Justificativa |
|---|---|---|
| **Linguagem** | **Java 21 (LTS)** | Exigência do time; LTS com suporte até 2029; records e pattern matching reduzem *boilerplate* de DTO |
| **Framework** | **Spring Boot 3.3.x** | Cobre sozinho RNF1 (Spring Security), RNF2 (JWT), RNF5 (auditoria), RNF8 (Resilience4j) |
| **Persistência** | **Spring Data JPA + Hibernate 6** | Obrigatório por decisão do time; `@EntityListeners(AuditingEntityListener.class)` preenche os metadados de cada entidade (quem criou/alterou e quando) — **não** é o log de auditoria do RNF5 |
| **Auditoria (RNF5)** | **`AuditService` próprio** + tabela `audit_log` + `ApplicationEventPublisher` | O listener do JPA só enxerga escrita de entidade. Os eventos que o RNF5 exige — login falho, 403, revogação de consentimento, chamada de IA — **não passam pelo Hibernate** e precisam de um serviço explícito |
| **Banco relacional (fonte da verdade)** | **MySQL 8.0** | Continuidade com `db/schema.sql` já modelado; transações e FKs para usuários, peças, esquemas, vínculos |
| **NoSQL — feed/timeline** | **Cassandra 4.1** (dev: Docker; prod: DataStax Astra free tier) | É o store que a Meta/Instagram usa para timeline; escrita *append-only* ordenada por tempo, sem `JOIN` |
| **NoSQL — contadores e cache** | **Redis 7** | Curtidas, reações, contadores de seguidores; `INCR` atômico com *write-behind* para o MySQL |
| **Busca** | **OpenSearch 2.x** | Aba Buscar/Explorar (RF8) com facetas por estilo, cor, marca |
| **Mídia** | **S3 / MinIO** (dev) | No banco fica só a URL; nunca binário em coluna |
| **Migração de schema** | **Flyway** | Versionamento de DDL rastreável — `V1__baseline.sql` gerado a partir de `db/schema.sql` |
| **Mapeamento DTO** | **MapStruct** | Impede vazar entidade JPA na API (risco de expor campo sensível) |
| **API** | **REST + OpenAPI (springdoc)** | Contrato publicado = artefato do TCC |
| **Autenticação** | **Spring Security + JWT** (access 15 min / refresh 7 dias, refresh rotativo em tabela) | RNF2 e RF3.CA09/CA10 |
| **Resiliência** | **Resilience4j** (circuit breaker, retry, timeout, rate limiter) | RNF8 e RF24.CA13/CA14 |
| **Observabilidade** | **Actuator + Micrometer + Logback JSON** | RNF5 e RNF7 (medir os 3 s) |
| **Testes** | **JUnit 5 + Testcontainers + RestAssured** | Testcontainers sobe MySQL/Redis reais → CA verificável de verdade |
| **Build** | **Maven** (multi-módulo) | Mais previsível que Gradle para banca e para CI |
| **Frontend** | **Next.js 15 + TypeScript**, repositório separado, consumindo só a API | Preserva o investimento de UI sem herdar o backend legado |
| **CI** | **GitHub Actions** — build, testes, `spotless`, análise de segredos | Impede repetir o vazamento de credenciais do repositório atual |
| **Domínio** | novo domínio próprio (ex.: `fashionai.app`), **sem** reaproveitar host/projeto Firebase | Firebase sai por completo |

### 2.1 Arquitetura de persistência — quem guarda o quê

| Dado | Store | Justificativa |
|---|---|---|
| `users`, `brands`, `celebrities`, `wardrobe_items`, `schemes`, `scheme_items`, `brand_links` | **MySQL** | Integridade forte, FK, transação |
| `follows` | **MySQL + Redis** (cache dos contadores) | Grafo pequeno/médio; grafo dedicado é trabalho futuro |
| Timeline de seguidores (fan-out on write) | **Cassandra** | `PK = (owner_user_id)`, `CK = created_at DESC`; paginação por cursor |
| Contadores de curtida/reação, sessão, rate-limit de IA | **Redis** | `INCR` atômico, TTL nativo |
| Índice de busca de looks, peças, pessoas, marcas | **OpenSearch** | Full-text com facetas |
| Notificações (RF3.CA15–CA18) | **Cassandra** | Mesmo padrão da timeline: append-only por usuário, expurgo por TTL de 90 dias |
| Fotos, PNGs recortados, GLB | **S3/MinIO** | Binário nunca no banco |
| `pipeline_jobs` (3D) | **MySQL** (estado) + fila | Máquina de estados auditável |

**Regra de ouro:** o MySQL é a única fonte da verdade. Cassandra, Redis e OpenSearch são **projeções derivadas**, alimentadas por eventos de domínio — nunca donos independentes do mesmo dado.

> **Gap encontrado nesta rodada — `schemes` está incompleta para o RF11/RF5 atuais.** `db/schema.sql` (a base de partida citada na seção 1.1) modela `schemes` só com `title`, `description`, `creation_mode`, `style`, `occasion`, `visibility`, `community_indexed`, `cover_image_url` — sem nenhuma coluna para o Background Studio (RF11) nem para a seleção de skin (RF5, Etapa 4 nova). Os documentos-fonte já existentes neste repositório (`markdowns/RF11_PROPOSTA_CONTAINER_EDITORIAL_VS_AURA.md`, `RF11_Configurar_Visual_Card_Atividades.puml`, `RF5_Criar_Look_Atividades_Corrigido.puml`) especificam campos que a Tarefa 2 da seção 4 precisa incluir na entidade `Scheme` e que `V1__baseline.sql` (Flyway) precisa criar, sem equivalente hoje em `db/schema.sql`:
> - `background_config` — cor sólida, gradiente, arte de IA (armazenamento JSON/embedded; ver `OutfitBackgroundConfig` no front-end atual)
> - `border_color` — cor da borda do card (2px, arredondada — constantes de raio/espessura não são colunas)
> - `content_container_color`, `content_container_origem` (`INDEFINIDA` | `MANUAL` | `AUTO`), `content_container_obrigatorio` (Boolean) — o container do esquema (v13) e a regra de trava automática ao aplicar a "Direção recomendada" (RF11)
> - `card_skin` (`ATELIER` | `SPREAD` | `INDEX` | `TRADING` | `FAI_MAX` | `STUB` | `SPECIMEN`) — skin de card escolhido na nova Etapa 4 do RF5
>
> `daily_looks`, por outro lado, **já está correta**: `UNIQUE KEY uq_daily_looks_user_date (user_id, look_date)` evita duplicidade de "look do dia" por usuário/data — o equivalente Firestore do repositório antigo (`saiDailyLooks`, sem essa restrição) tinha essa lacuna, corrigida separadamente nesta mesma rodada.

### 2.2 Estrutura de módulos Maven proposta

```
fashion-ai-api/
├── pom.xml                       (parent, dependencyManagement)
├── fai-domain/                   entidades JPA, VOs, enums, eventos de domínio  — zero dependência de framework
├── fai-application/              casos de uso (1 classe por RF), portas (interfaces)
├── fai-infrastructure/
│   ├── persistence-mysql/        repositórios Spring Data, Flyway
│   ├── persistence-cassandra/    timeline + notificações
│   ├── cache-redis/              contadores, rate-limit
│   ├── search-opensearch/        índices
│   ├── storage-s3/               mídia
│   └── ai-providers/             adaptadores Claude, Gemini, FASHN, Meshy, rembg
├── fai-web/                      controllers REST, DTOs, MapStruct, OpenAPI, Spring Security
└── fai-bootstrap/                aplicação Spring Boot + configuração
```

Dependências apontam sempre para dentro: `web → application → domain`; `infrastructure → application` (implementa as portas). O domínio não conhece Spring nem Hibernate — só as anotações JPA, que ficam isoladas em `fai-domain` para não pagar o custo de um mapeamento paralelo.

---

## 3. Variáveis de ambiente e configuração de segurança

### 3.1 Princípios

1. **Nenhum segredo no repositório.** Só `.env.example` com placeholders e `application.yml` lendo `${VAR}`. `.env` no `.gitignore` desde o primeiro commit.
2. **Segredos em cofre**, não em arquivo: GitHub Actions Secrets no CI; AWS Secrets Manager / Doppler / Railway Variables em produção.
3. **Rotacionar tudo o que já existiu no repositório antigo.** Como o repositório atual pode ter tido credenciais expostas, **toda** chave migrada deve ser considerada comprometida: gerar novas em Google AI, OpenAI/Anthropic, Meshy, FASHN, remove.bg, Resend, AWS, e revogar as antigas.
4. **Descartar completamente o projeto Firebase.** Não migrar `NEXT_FIREBASE_*` nem `NEXT_PUBLIC_FIREBASE_*`; apagar o projeto no console após a migração dos dados.
5. **Sem prefixo público para segredo.** No frontend só entram variáveis `NEXT_PUBLIC_*` que sejam realmente públicas (URL da API, chave do mapa com restrição de domínio). Chave de IA **nunca**.
6. **Verificação automática**: `gitleaks` no pre-commit e no CI, bloqueando o merge se um segredo aparecer no diff.

### 3.2 `.env.example` do novo repositório

```properties
# ─── Aplicação ────────────────────────────────────────────────
APP_ENV=dev                        # dev | staging | prod
APP_BASE_URL=https://api.fashionai.app
APP_CORS_ALLOWED_ORIGINS=https://fashionai.app

# ─── MySQL (fonte da verdade) ─────────────────────────────────
MYSQL_HOST=
MYSQL_PORT=3306
MYSQL_DATABASE=fashionai
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_SSL_MODE=REQUIRED
MYSQL_POOL_SIZE=10

# ─── Cassandra (timeline + notificações) ──────────────────────
CASSANDRA_CONTACT_POINTS=
CASSANDRA_PORT=9042
CASSANDRA_LOCAL_DATACENTER=datacenter1
CASSANDRA_KEYSPACE=fashionai_feed
CASSANDRA_USERNAME=
CASSANDRA_PASSWORD=

# ─── Redis (contadores, cache, rate-limit) ────────────────────
REDIS_URL=
REDIS_PASSWORD=
REDIS_TTL_SECONDS=3600

# ─── OpenSearch (busca) ───────────────────────────────────────
OPENSEARCH_URL=
OPENSEARCH_USERNAME=
OPENSEARCH_PASSWORD=

# ─── Object storage (mídia) ───────────────────────────────────
S3_ENDPOINT=
S3_REGION=
S3_BUCKET=fashionai-media
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=

# ─── Segurança / JWT (RNF2) ───────────────────────────────────
JWT_ISSUER=fashionai
JWT_ACCESS_TTL_MINUTES=15
JWT_REFRESH_TTL_DAYS=7
JWT_PRIVATE_KEY_PEM=                # par RSA; a chave privada só existe no cofre
JWT_PUBLIC_KEY_PEM=

# ─── Criptografia de dados sensíveis (RNF3) ───────────────────
DATA_ENCRYPTION_KEY=                # AES-256-GCM, base64, rotacionável
PASSWORD_HASH_ALGORITHM=argon2id
PASSWORD_HASH_MEMORY_KB=19456
PASSWORD_HASH_ITERATIONS=2

# ─── Provedores de IA (RF24) — só no backend ──────────────────
ANTHROPIC_API_KEY=
GOOGLE_AI_API_KEY=
FASHN_API_KEY=
MESHY_API_KEY=
AI_DAILY_QUOTA_PER_USER=50
AI_REQUEST_TIMEOUT_SECONDS=30
AI_CIRCUIT_BREAKER_FAILURE_RATE=50

# ─── E-mail transacional (RF3.CA07) ───────────────────────────
RESEND_API_KEY=
RESEND_FROM_EMAIL=nao-responda@fashionai.app

# ─── Observabilidade (RNF5/RNF7) ──────────────────────────────
LOG_LEVEL=INFO
LOG_FORMAT=json
AUDIT_RETENTION_DAYS=365
```

### 3.3 Checklist de segurança do primeiro commit

- [ ] `.gitignore` cobre `.env`, `*.pem`, `keys/`, `**/serviceAccount*.json`
- [ ] `gitleaks` configurado como GitHub Action obrigatória
- [ ] Branch `main` protegida: PR obrigatório, CI verde, sem force-push
- [ ] Dependabot ativo para Maven e npm
- [ ] Senhas com **Argon2id** (RNF3) — não BCrypt legado
- [ ] Campos pessoais sensíveis com `@Convert(converter = AesGcmConverter.class)` (RNF3)
- [ ] `@EntityListeners(AuditingEntityListener.class)` nas entidades — metadados de criação/alteração (**não confundir com o RNF5**)
- [ ] `AuditService` próprio gravando em `audit_log`, com um evento por CA-âncora do RNF5 (RNF5)
- [ ] Spring Security com `@PreAuthorize` por recurso e teste automatizado de 403 (RNF1 / RF3.CA14)
- [ ] Rate limit nas rotas `/api/ai/**` (RF24.CA14)
- [ ] CORS restrito ao domínio do frontend
- [ ] Headers de segurança: HSTS, CSP, X-Content-Type-Options
- [ ] **Nenhum dado real de usuário** migrado para o ambiente de demonstração

---

## 4. Prompt de bootstrap para o Claude Code

> Cole o texto abaixo em uma sessão nova do Claude Code, com o repositório novo já criado e vazio. Ele assume que a pasta `docs/novo-projeto/` deste repositório foi copiada para o novo.

```text
Você vai criar do zero o backend do Fashion AI, um app de moda com rede social,
guarda-roupa virtual e recursos de IA. É um TCC de Sistemas de Informação (PUCPR).
NÃO reaproveite nenhum código do projeto anterior (Next.js + Firebase) — ele será
descartado por dívida técnica e por risco de credenciais expostas.

## Fontes da verdade (leia antes de escrever qualquer código)
- docs/novo-projeto/01-bootstrap-repo-java.md   → decisões técnicas, módulos, variáveis de ambiente
- docs/novo-projeto/02-rf-reestruturados-e-criterios-aceite.md → RF1–RF23, RF24, RF31 e ~150 critérios de aceite
- docs/novo-projeto/03-rf24-ia-e-servicos-externos.md → capacidades de IA e provedores
- docs/novo-projeto/05-diagramas-atividade.md   → fluxos por RF
- docs/meu-quarto/*.md, RF33_Vista-me_Atividades.puml → RF32–RF36 (novo — Meu Quarto, Smart
  Mirror/Vista-me, Destaques do Inventário, FAI Points, Desafios & Games), extensão de RF10.
  CAs ainda não têm card HU-RF no Trello — vivem só nestes arquivos (ver 01, seção 1.3).

## Stack obrigatória
Java 21, Spring Boot 3.3, Spring Data JPA + Hibernate 6, MySQL 8 como fonte da
verdade, Cassandra para timeline e notificações, Redis para contadores e rate
limit, OpenSearch para busca, S3/MinIO para mídia, Flyway, MapStruct,
Resilience4j, springdoc-openapi, JUnit 5 + Testcontainers, Maven multi-módulo.

## Tarefa 1 — Esqueleto
Crie o projeto Maven multi-módulo exatamente com os módulos descritos na seção
2.2 do documento 01. As dependências apontam para dentro: web → application →
domain; infrastructure implementa as portas definidas em application.

## Tarefa 2 — Domínio
Modele as entidades JPA a partir da seção 7 de docs/especificacao-fai-social-network.md
e de db/schema.sql do repositório antigo (use-o apenas como referência de modelo,
não copie código): User (com tipo de perfil PESSOAL | MARCA | CELEBRIDADE),
BrandProfile, CelebrityProfile, WardrobeItem, Scheme, SchemeItem, SchemeBrandLink
(com estado PENDENTE | APROVADO | RECUSADO | CADUCADO), Follow, Comment, Reaction,
Notification, StyleDna, Photo, PipelineJob.
Regras: sem relacionamento EAGER; toda coleção paginada; @Version onde houver
escrita concorrente; campos pessoais sensíveis com converter AES-GCM (RNF3);
metadados de criação/alteração via @EntityListeners.
Atenção: db/schema.sql NÃO tem colunas para o Background Studio (RF11) nem para
skin de card (RF5) — Scheme precisa ganhar backgroundConfig, borderColor,
contentContainerColor, contentContainerOrigem (INDEFINIDA|MANUAL|AUTO),
contentContainerObrigatorio (Boolean) e cardSkin (ATELIER|SPREAD|INDEX|TRADING|
FAI_MAX|STUB|SPECIMEN), conforme markdowns/RF11_PROPOSTA_CONTAINER_EDITORIAL_VS_AURA.md e
RF11_Configurar_Visual_Card_Atividades.puml (ver documento 01, seção 2.1).
Para RF32–RF36 (Meu Quarto), modele as entidades a partir de docs/meu-quarto/ só
quando essas tarefas entrarem na Tarefa 4 — não são pré-requisito das Tarefas 1–3.

## Tarefa 3b — Auditoria (RNF5)
Atenção: @EntityListeners(AuditingEntityListener.class) NÃO satisfaz o RNF5. Ele
só preenche createdAt/updatedAt/createdBy/lastModifiedBy quando uma entidade é
gravada pelo Hibernate. Os eventos que o RNF5 exige em sua maioria nem tocam o
Hibernate. Crie um AuditService explícito, gravando em audit_log
(actor, acao, recurso, resultado, ip, user_agent, timestamp, correlation_id),
alimentado por eventos de aplicação e com persistência em transação própria
(REQUIRES_NEW), para que o registro sobreviva ao rollback da operação auditada.
Eventos obrigatórios, um por CA:
  - login bem-sucedido e login falho / bloqueio por tentativas  (RF2.CA03)
  - acesso negado 403 a recurso de outro usuário                (RF3.CA14)
  - alteração de dado pessoal sensível e troca de senha         (RF3.CA01, CA11)
  - concessão e revogação de consentimento                      (RF3.CA06)
  - exportação e exclusão de conta                              (RF3.CA04, CA05)
  - mudança de estado de vínculo com marca/celebridade          (RF20.CA08)
  - chamada de IA: provedor, modelo, latência, custo estimado   (RF24.CA16)
Nenhum evento pode conter senha, token ou o conteúdo dos campos cifrados.

## Tarefa 3 — Segurança
Spring Security com JWT (RSA), access 15 min, refresh rotativo persistido, Argon2id
para senhas, @PreAuthorize por recurso, e um teste que prova que o usuário A recebe
403 ao acessar recurso do usuário B (RNF1 / RF3.CA14).

## Tarefa 4 — Fatiar por RF
Para cada RF, um caso de uso em fai-application, um controller em fai-web e testes
que verificam os CAs correspondentes do documento 02. Ordem: RF1, RF2, RF3, RF4,
RF6, RF5, RF9, RF31, RF8, RF19, RF17, RF10/RF24, RF13, RF14/RF20, RF22/RF21,
RF11, RF12, RF15, RF18, RF23, RF16.
RF32–RF36 (Meu Quarto — docs/meu-quarto/) ficam por último, depois de RF16: são
os mais novos do backlog, dependem de RF4/RF5/RF6/RF13/RF16/RF19/RF24/RF31 já
estarem prontos, e ainda não têm CA canônico em card HU-RF do Trello — trate como
pendentes de validação com o time antes de fatiar, não como parte fixa da ordem.

## Tarefa 5 — IA
Uma porta AiProviderPort em fai-application e adaptadores em
infrastructure/ai-providers, conforme a tabela do documento 03. Toda chamada com
timeout de 30 s, 1 retry com backoff, circuit breaker e rate limit por usuário.
Nenhuma chave de API sai do backend.

## Regras que valem para tudo
- Escreva o teste do critério de aceite junto com o código que o satisfaz.
- Nenhum segredo em arquivo versionado; só .env.example com placeholders.
- Todo endpoint documentado em OpenAPI com o RF que o originou no summary.
- Commits pequenos, um por RF, referenciando o card do Trello.
- Se um requisito estiver ambíguo, pare e pergunte — não invente regra de negócio.
```

---

## 5. Ordem de execução da migração

1. Criar o repositório novo (privado) e proteger `main`.
2. Copiar **apenas** `docs/`, `db/schema.sql` e os `HU*.md` do repositório atual — nada de código.
3. Rodar o prompt da seção 4 (Tarefas 1–3).
4. Gerar `V1__baseline.sql` no Flyway a partir do schema MySQL revisado.
5. Migrar os dados do Firestore → MySQL com um script descartável, **sem** dados reais de usuário no ambiente de demonstração.
6. Fatiar por RF (Tarefa 4), uma sprint por vez.
7. **Migrar as identidades antes de desligar o Firebase.** `db/schema.sql` mostra que a conta viva hoje é a do Firebase Auth: `users.firebase_uid VARCHAR(128) NULL UNIQUE` e `users.password_hash VARCHAR(255) NULL`, este último comentado no próprio schema como *"Legado: a autenticação migrou para o Firebase"*. Ou seja, **as contas existentes não têm hash de senha** — apagar o Firebase antes de migrar tranca todo mundo para fora. Sequência obrigatória:
   1. importar os usuários do Firebase Auth (`firebase auth:export`) preservando `firebase_uid` e e-mail;
   2. manter uma **ponte de autenticação temporária** — o backend Java valida o ID token do Firebase e, na primeira autenticação bem-sucedida, faz o *enrolment* da senha em Argon2id (ou dispara o fluxo de definição de senha do RF3.CA07);
   3. para quem não voltar dentro da janela, enviar convite de redefinição de senha por e-mail;
   4. **só desligar o Firebase quando** a taxa de contas com `password_hash` preenchido (ou identidade federada própria) cobrir a base ativa e um login de ponta a ponta estiver validado sem o Firebase.
8. Apagar o projeto Firebase e revogar todas as chaves antigas.
9. Arquivar o repositório atual como `fashion-ai-legacy` (somente leitura), preservando o histórico do TCC.
