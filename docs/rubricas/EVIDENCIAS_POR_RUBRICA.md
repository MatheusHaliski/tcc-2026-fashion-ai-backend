# Fashion AI — Evidências por rubrica

Conferido no código em 30/09/2026 · Bryan Strey

Onde está, neste repositório, a evidência de cada critério da rubrica (`docs/rubricas/QUARTA_TCC_Rubricas.csv`) em que
há algo feito. Os caminhos partem da raiz do repositório. A coluna **Situação** é o que foi conferido no código nesta
data, não a autoavaliação de `docs/rubricas/GUIA_RUBRICAS.md` — onde as duas divergem, a diferença está anotada.

## Itens obrigatórios

| Item | Onde mostrar | Situação |
| --- | --- | --- |
| ≥ 80% do escopo acordado | `docs/testes/TABELA_ENDPOINTS_POR_RF.md` (RF × CA × endpoint × tela) · 32 controllers em `fai-web/src/main/java/br/com/fashionai/web/controller/` · roteiro ponta a ponta em `scripts/e2e/` | Feito |
| Processo ágil documentado (sprints) | `TDEword/DOCUMENTACAO_FASHION_AI_VERSAO_FINAL.docx` · `docs/rubricas/TDE_SECAO_4_RF25_RF39.md` · board do Trello (fora do repositório) | Parcial: falta descrever cada sprint (objetivo, cards, review) |
| Frontend bem acabado e resiliente a erros | `components/ui/index.tsx` (`useToast`, `EmptyState`, `ErrorState`, `Skeleton`) · capturas em `docs/telas-bloco7/` e `docs/telas-bloco11/` | Feito |
| Backend RESTful com JSON | Controllers acima · erro padronizado em `fai-web/src/main/java/br/com/fashionai/web/error/GlobalExceptionHandler.java` · Swagger em `/swagger-ui.html` | Feito |
| Dados persistidos em banco | 79 entidades em `fai-domain/src/main/java/br/com/fashionai/domain/model/` · migrações V1–V28 em `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/` | Feito |
| ≥ 2 perfis de acesso (front e back) | `fai-web/src/main/java/br/com/fashionai/web/config/SecurityConfig.java` · `fai-application/src/main/java/br/com/fashionai/application/security/Guard.java` · teste `fai-web/src/test/java/br/com/fashionai/web/security/ResourceOwnerAuthorizationTest.java` · telas em `app/(site)/(app)/admin/` | Feito (PESSOAL, MARCA, CELEBRIDADE + ADMIN) |
| Dashboard com filtros e gráficos | `app/(site)/(app)/admin/dashboard/page.tsx` · `fai-application/src/main/java/br/com/fashionai/application/service/DashboardService.java` · `fai-infrastructure/persistence-mysql/src/main/java/br/com/fashionai/infrastructure/mysql/analytics/MysqlAnalyticsAdapter.java` · procedures em `V6__dashboard_analytics.sql` e `V10__dashboard_ia_por_pais.sql` | Feito |
| Git organizado com todos os alunos | `git shortlog -sne origin/main`: Matheus 171, Bryan 11 (duas contas: 6 + 5), Claude 160, Copilot 22 · Conventional Commits com o RF no escopo · PR #46 (`feature/multi-piece-upload`) | Feito, com participação do Bryan bem menor |

## Engenharia de software

| Critério (peso) | O que existe | Onde está | Situação |
| --- | --- | --- | --- |
| Requisitos e análise: UML, BDD, jornadas (1,0) | 21 histórias de usuário; critérios de aceite por RF; diagramas de atividades, sequência, estados, classes e componentes; diagrama de classes e de componentes geral v4 | `markdowns/HU01.md` … `markdowns/HU21.md` · `markdowns/02-rf-reestruturados-e-criterios-aceite.md` · `docs/diagramas/` (pastas RF4, RF5, RF25–RF39) · `docs/diagramas/fashionai-classes-v4.puml` e `fashionai-componentes-v4.puml` | Parcial: diagramas cobrem 17 RFs e entraram num só commit (24/09); falta a tabela sprint → artefatos |
| Processo de qualidade (1,0) | Teste ponta a ponta por critério de aceite (452 passos, 368 endpoints) com evidência de requisição, resposta e banco; conferências das entregas; correções registradas em commits `fix(...)`; PR revisado | `docs/testes/` · `scripts/e2e/` · `docs/checklist/` · histórico git (`git log --grep "^fix"`) | Parcial: falta plano de testes por sprint e registro de reprovação de QA |
| Prototipação e usabilidade (1,5) | Protótipos de anatomia dos cards (v17, v18, v19) e do card de DNA (v4) em HTML; capturas das telas por RF | `docs/anatomias/` · `docs/telas-bloco7/`, `docs/telas-bloco11/`, `docs/telas-rf16-estudio/` | Fraco: sem Figma, sem checklist de usabilidade (heurísticas) e sem teste filmado |

## Backend

| Critério (peso) | O que existe | Onde está | Situação |
| --- | --- | --- | --- |
| Cobertura de testes ≥ 75% (1,0) | JaCoCo configurado; medição ponta a ponta de 74,4% das linhas em 24/09 | `pom.xml` (plugin JaCoCo) · `docs/testes/COBERTURA_E2E.md` · `scripts/e2e/jacoco_report.jsh` · relatórios em `*/target/site/jacoco/` após `mvn verify` | Abaixo de 75%: testes automatizados cobrem 34,0% das linhas (medido em 30/09); a medição de 74,4% é anterior às mudanças recentes |
| Migrações profissionais (1,0) | Flyway V1–V28, uma migração por mudança; Hibernate não altera o schema (`ddl-auto: none`) | `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/` · `fai-bootstrap/src/main/resources/application.yml` | Feito; a rubrica pede migrações em ≥ 50% das sprints — mostrar as datas dos commits por sprint |
| Documentação da API e README (1,0) | springdoc-openapi com `@Operation` (RF/CA no sumário) nos endpoints; README com arquitetura e passo a passo; payloads reais nas evidências | `/swagger-ui.html` e `/v3/api-docs` com a API rodando · `README.md` · `docs/testes/` | Feito |
| SQL / ORM avançado (1,5) | (a) `GROUP BY` no dashboard; (b) 27 índices únicos que impõem regras (ex.: `uq_coupon_rights_source`, `uq_flair_profiles_user`), 82 índices e 97 chaves estrangeiras; (c) 4 procedures (`sp_admin_kpis`, `sp_timeseries`, `sp_ai_cost_by_country`, `sp_purge_notifications`) e 2 views chamadas pelo código | `MysqlAnalyticsAdapter.java` (caminho acima) · migrações V6 e V10 · `fai-domain/src/main/java/br/com/fashionai/domain/repository/` (78 repositórios, 24 consultas JPQL) · `docs/banco/EXPLAIN_DASHBOARD.md` | Feito (3 de 3) |
| NoSQL avançado (1,5) | (b) Cassandra com partição por usuário, ordenação e expiração automática (TTL 90 e 30 dias); Redis com TTL nos contadores; OpenSearch com índices e mapeamento em português | `fai-infrastructure/persistence-cassandra/src/main/resources/cassandra/schema.cql` · `fai-infrastructure/cache-redis/src/main/java/br/com/fashionai/infrastructure/redis/RedisAdapters.java` · `fai-infrastructure/search-opensearch/src/main/java/br/com/fashionai/infrastructure/opensearch/OpenSearchIndexAdapter.java` · `scripts/provision/provision.py` | Parcial (1 de 3): sem JSON Schema (a) e sem agregações (c); bancos atrás de feature flags |
| Serviços cloud relevantes (1,5) | Claude (IA), Resend (e-mail), Open-Meteo (clima), S3 (mídia), Google OAuth (acesso restrito da equipe), Vercel e Railway (hospedagem e bancos gerenciados); adaptadores prontos para Gemini, Replicate, FASHN, Meshy, Stability, Photoroom e remove.bg | `fai-infrastructure/ai-providers/` · `fai-infrastructure/platform/src/main/java/br/com/fashionai/infrastructure/platform/email/ResendEmailSender.java` · `fai-application/src/main/java/br/com/fashionai/application/service/WeatherService.java` · `fai-infrastructure/storage-s3/` · `app/(gate)/gate/google/` · `docs/deploy/DEPLOY.md` | Feito (≥ 4); mostrar em produção com as chaves ligadas |
| Padrões de projeto e arquitetura limpa (1,0) | Hexagonal em módulos Maven sem dependência invertida (0 violações); 16 portas e 30 adaptadores; Strategy + cadeia de fallback, Observer (13 eventos, 9 ouvintes), Repository, Facade, Circuit Breaker, Pipeline | `fai-domain/`, `fai-application/`, `fai-infrastructure/`, `fai-web/`, `fai-bootstrap/` (poms) · `fai-application/src/main/java/br/com/fashionai/application/ports/` · `…/application/ai/AiEngine.java` · `…/application/events/DomainEvents.java` · `fai-infrastructure/ai-providers/src/main/java/br/com/fashionai/infrastructure/ai/ProviderCircuit.java` · `DashboardService.java` · `README.md` (seção Arquitetura) | Feito; pontos a justificar: domínio usa JPA e serviços grandes (`WardrobeService` com 2.307 linhas) |

## Frontend

| Critério (peso) | O que existe | Onde está | Situação |
| --- | --- | --- | --- |
| Cobertura de testes ≥ 75% (1,0) | 18 arquivos de teste (172 testes) com Vitest, só em lógica pura | `vitest.config.mts` · `lib/**/*.test.ts` · `app/bff/auth/[action]/route.test.ts` | Abaixo: cerca de 15% do frontend; telas e componentes sem teste |
| Responsivo e customizável (1,5) | Temas claro, escuro e alto contraste; preferências salvas por usuário; Background Studio e skins de card; widgets do dashboard salvos; layout de celular | `app/(site)/globals.css` (`[data-theme="dark"]`, `[data-theme="contrast"]`) · `fai-domain/src/main/java/br/com/fashionai/domain/model/UserPreferences.java` · `components/background-studio.tsx` · `docs/telas-bloco11/temas.jpg`, `celular_390px.jpg` | Feito |
| Internacionalização (1,5) | Textos em pt-BR, en e es no frontend e no backend; datas, números e moeda por `Intl`; idioma segue `Accept-Language`; verificações automáticas no build | `lib/i18n/` (catálogos em `lib/i18n/messages/`) · `fai-application/src/main/resources/i18n/` · `scripts/i18n/` · `docs/i18n/RF23_Internacionalizacao.md` | Feito |
| Padrões de projeto e arquitetura (1,0) | Camadas de cliente da API, hooks, componentes base e providers de idioma e tema | `lib/api/client.ts` · `lib/hooks/use-api.ts` · `components/ui/index.tsx` · `lib/i18n/i18n.tsx` | Parcial: páginas misturam chamada à API, estado e tela; falta documento de arquitetura |
| Acessibilidade (1,5) | Tema de alto contraste; nome da cor em texto nas peças; buscador de marcas navegável por teclado (`role="combobox"`); rótulos ARIA | `app/(site)/globals.css` · `components/brand-search-input.tsx` · `components/ui/index.tsx` | Parcial: falta público escolhido, estudo e teste com esse público |

## DevOps

| Critério (peso) | O que existe | Onde está | Situação |
| --- | --- | --- | --- |
| CI/CD por ambiente (1,5) | Deploy automático do frontend na Vercel (Preview e Production) a cada push | `docs/deploy/DEPLOY.md` | Parcial: não há pipeline no repositório (sem `.github/workflows`) nem deploy automático do backend |
| Infraestrutura como código (1,0) | Imagem da API, ambiente local com todos os bancos, scripts idempotentes que configuram banco, índices e bucket | `Dockerfile.backend` · `docker-compose.dev.yml` · `scripts/provision/` · `docs/deploy/DEPLOY.md` | Parcial: recursos da Railway e da Vercel criados pelo painel; sem Terraform |
| Monitoramento e observabilidade (1,5) | Health check e 105 métricas no actuator (só ADMIN); `correlationId` em todo erro; log de cada chamada de IA com custo e latência; auditoria; alertas no dashboard de admin | `fai-bootstrap/src/main/resources/application.yml` (`management`) · `fai-web/src/main/java/br/com/fashionai/web/support/CorrelationIdFilter.java` · tabelas `ai_inference_log` e `audit_log` · `DashboardService.java` | Parcial: `/actuator/prometheus` responde 404 (falta a dependência `micrometer-registry-prometheus`); sem Grafana nem alertas externos |

## Técnica livre

| Critério (peso) | O que existe | Onde está | Situação |
| --- | --- | --- | --- |
| Técnica ou tecnologia não listada (1,5) | Pipelines de imagem (remoção de fundo, flat lay, foto de estúdio); várias peças numa foto com cópia por IA e selo; provador virtual; avatar e quarto 3D em WebGL | `fai-application/src/main/java/br/com/fashionai/application/imaging/FlatLayPipeline.java`, `StudioPipeline.java`, `AiSeal.java` · `fai-application/src/main/java/br/com/fashionai/application/service/MultiPieceService.java` · `fai-web/src/main/java/br/com/fashionai/web/controller/TryOnController.java` · `lib/avatar3d/` · `components/room3d/` · `components/three/` | Depende do acordo com os professores até a 3ª sprint |

## Sem evidência hoje

- **Microsserviços (1,5) e Service Discovery + API Gateway (1,0):** não se aplicam; o backend é um monólito modular hexagonal por decisão da equipe.
- **Prototipação no Figma e teste filmado de usabilidade:** nada no repositório.
- **JSON Schema e agregações em NoSQL:** não implementados.
