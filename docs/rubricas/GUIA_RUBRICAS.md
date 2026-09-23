# Guia das rubricas do TCC — Fashion AI

Gerado por `scripts/rubricas/gerar_guia.py` a partir de `docs/rubricas/QUARTA_TCC_Rubricas.csv`. A planilha equivalente está em `docs/rubricas/GUIA_RUBRICAS.xlsx`.

Legenda: ✅ evidência pronta · 🟡 parcial · ⬜ pendente · 🔴 risco de reprovação.

## 1. Critérios obrigatórios (2,5 pontos — todos ou nenhum)

Se qualquer um faltar, o trabalho não pode ser entregue.

| # | Critério | Status | Evidência no repositório | Falta no código | Falta a equipe fazer |
|---|---|---|---|---|---|
| 1 | ≥ 80% do escopo acordado com os professores | 🟡 PARCIAL | Serviços de aplicação para RF1–RF36 e RNF1–RNF12 em fai-application/.../service; entidades e migrações V1–V6; docs/novo-projeto/tabela-*.md. | Bloco 8 (API REST de todos os serviços) e bloco 11 (frontend com todas as telas). | Levar aos professores a lista de RFs do escopo acordado e marcar, RF a RF, onde está a tela e o endpoint (a planilha de IA/entidades do bloco 12 serve de checklist). |
| 2 | Processo ágil documentado no TDE (sprints) | ⬜ PENDENTE | Board do Trello com HUs/RFs; HUs e critérios de aceite em markdowns/HU*.md e markdowns/02-rf-reestruturados-e-criterios-aceite.md. | — | Para cada sprint: objetivo, cards comprometidos x entregues, print do board no início e no fim, review/retrospectiva curta, link dos commits/PRs da sprint. Preencher o modelo do TDE. |
| 3 | Frontend bem acabado, mensagens informativas e resiliente a erros | ⬜ PENDENTE | Backend já devolve erros de negócio com código e mensagem (ApiException, ex.: 409 PECA_INDISPONIVEL, 429 cota de IA, 422 validação); tipografia oficial (lib/design/typography.css) e 77 ícones FAI. | Bloco 11: toasts de sucesso/erro, estados vazios, skeletons de carregamento, error boundary por página, retry em falha de rede, mensagens de fallback de IA. | Na demo, provocar um erro de propósito (ex.: sem internet, campo inválido) e mostrar a mensagem. |
| 4 | Backend RESTful comunicando via JSON | 🟡 PARCIAL | Casos de uso prontos e compilando; DTOs/records em JSON; módulo fai-web. | Bloco 8: controllers REST (substantivos no plural, verbos HTTP, 201/204/404/409/422), GlobalExceptionHandler com application/problem+json, OpenAPI. | Mostrar o Swagger UI e uma chamada no DevTools (Network) com o JSON. |
| 5 | Dados relevantes persistidos em banco | ✅ OK | MySQL via Flyway V1–V6 (JPA, UUID CHAR(36), campos sensíveis cifrados com AES-GCM); auditoria em audit_log; log de inferência de IA; Cassandra (timeline) e Redis (contadores/cache). | Bloco 10: subir a aplicação contra o MySQL e validar ponta a ponta. | Levar o diagrama ER (docs/novo-projeto/tabela-entidades-rf-bancos.md + markdowns/uml-casos-er-classes.md). |
| 6 | ≥ 2 perfis de acesso validados no frontend E no backend | 🟡 PARCIAL | Perfis PESSOAL, MARCA e CELEBRIDADE (ProfileType) + papel USER/ADMIN (User.role); guard.requireAdmin em AdminService/ChallengeService/BackgroundStudioService; dashboard de emissor só para MARCA/CELEBRIDADE; ResourceOwnerAuthorizationTest. | Bloco 8: @PreAuthorize/filtros por papel e 403 JSON. Bloco 11: guarda de rota e menus ocultos por perfil. | Na demo: logar como PESSOAL e tentar abrir /admin (bloqueado na tela e 403 na API); logar como ADMIN e abrir. |
| 7 | Dashboard gerencial com informações, filtros e gráficos | 🟡 PARCIAL | DashboardService (admin e emissor), filtros período/país/tipo de perfil, alertas, layout de widgets salvo por usuário; V6 com procedures sp_admin_kpis/sp_timeseries, views vw_country_insights/vw_brand_usage e índices. | Bloco 8 (endpoint /api/admin/dashboard) e bloco 11 (gráficos de linha/barra/pizza/mapa). | Preparar 2–3 perguntas gerenciais que o dashboard responde (ex.: 'em qual país a IA custa mais por usuário?'). |
| 8 | Git organizado (branches, commits) com participação de TODOS os alunos | 🔴 RISCO | Branches por feature e PRs (#8, #12); commits no padrão Conventional Commits (feat/fix/chore com RF no escopo). ATENÇÃO: `git shortlog -sn --all` neste repositório mostra commits só de Matheus + bots; nenhum do Bryan. | — | Bryan precisa commitar com a própria conta (docs das sprints, testes, telas, revisões de PR). Todo PR revisado/aprovado pelo outro integrante. Apresentar também o histórico do repositório SAI-TCC-2026. Confirmar com os professores a política sobre commits assistidos por IA (co-autoria aparece no log). |

## 2. Critérios opcionais

**Recomendados (prioridade A):** 7 critérios, ~8.5 pontos previstos. Aproveitam o que já existe no backend e no plano do frontend.
**Reserva (prioridade B):** 9 critérios, ~8.2 pontos previstos. Servem de margem caso algum A seja avaliado abaixo do esperado.
**Não recomendados (C):** exigiriam mudar a arquitetura ou têm pouco retorno.

Confirmem com os professores o teto da nota e quais critérios subjetivos (prototipação, acessibilidade, livre) serão anotados na planilha da equipe.

| Prior. | Critério | Área | Valor | Meta | Pontos previstos | Status | Evidência | Ação |
|---|---|---|---|---|---|---|---|---|
| A | SQL avançado: grouped queries, índices de regra de negócio, procedures | Backend | 1.5 | 100% | 1.50 | ✅ OK | a) GROUP BY no MysqlAnalyticsAdapter (uso de IA, marcas, países, faixas de Hype/Inventory, funil de selos); b) índices UNIQUE que impõem regras (username/e-mail únicos, seguir 1×, 1 Look do Dia por dia, 1 reação por alvo, 1 voto por entrada de desafio, ledger idempotente de FAI Points) + índices de V6; c) procedures sp_admin_kpis, sp_timeseries, sp_purge_notifications e views. | Mostrar o EXPLAIN de uma consulta do dashboard usando o índice. |
| A | Serviços cloud relevantes (≥4) | Backend | 1.5 | 100% | 1.50 | 🟡 PARCIAL | Hospedagem Vercel; storage S3/Vercel Blob (fotos e cards); IA generativa (Claude, Gemini, FASHN, Meshy); e-mail transacional Resend; login federado Google; MySQL gerenciado. | Bloco 9 (adaptadores) + deploy; no TDE, justificar cada serviço pelo problema de negócio. |
| A | Responsivo e customizável (temas, mobile, tela customizável salva) | Frontend | 1.5 | 100% | 1.50 | 🟡 PARCIAL | Layout de widgets do dashboard salvo por usuário (user_preferences.dashboard_layout_json); Background Studio/skins de cards; tokens de tipografia. | Bloco 11: temas claro/escuro/alto contraste, breakpoints mobile, arrastar/ocultar widgets com salvamento. |
| A | Engenharia de requisitos (UML/BDD/jornadas) em ≥80% das sprints | Eng. software | 1.0 | 100% | 1.00 | 🟡 PARCIAL | HU01–HU20 com critérios de aceite, casos de uso e ER (markdowns/uml-*.md), diagramas de atividade (markdowns/05-diagramas-atividade.md, RF33_Vista-me_Atividades.puml), diagramas de sequência dos pipelines RF4/RF18. | Marcar em cada sprint do TDE qual HU/diagrama modelou os cards daquela sprint. |
| A | Documentação: OpenAPI com sumário/descrição, payloads reais, README completo | Backend | 1.0 | 100% | 1.00 | ⬜ PENDENTE | — | Bloco 8: springdoc-openapi com @Operation/@ExampleObject por endpoint; README.md (o que é, como subir, como rodar). |
| A | Migrações profissionais (evidência em ≥50% das sprints) | Backend | 1.0 | 30% agora → 100% | 1.00 | 🟡 PARCIAL | Flyway V1–V6 (baseline, RFs completos, seed de marcas, critérios, Meu Guarda-Roupa, dashboard). Hoje todas as migrações têm a mesma data de commit, o que só garante a faixa de 30%. | A partir desta sprint, toda mudança de banco entra como V7, V8…, commitada na sprint em que foi feita; tabela 'migração × sprint' no TDE. |
| A | Padrões de projeto e arquitetura limpa (backend) | Backend | 1.0 | 100% | 1.00 | ✅ OK | Hexagonal em módulos Maven (domain/application/infrastructure/web/bootstrap), ports & adapters, Strategy + Chain of Responsibility no AiEngine (provedor principal → fallback → local), Observer (DomainEvents), Repository, Circuit Breaker/Retry (resilience4j), Facade (DashboardService). | Escrever docs/arquitetura/PADROES.md com um trecho de código por padrão e o motivo. |
| B | Prototipação no Figma + checklist de usabilidade + teste filmado | Eng. software | 1.5 | 60–100% | 0.90 | 🟡 PARCIAL | Anatomias dos cards (docs/anatomias), pranchas de telas (markdowns/04-telas-artefatos-e-pranchas.md). | Exportar telas para o Figma; aplicar checklist das 10 heurísticas de Nielsen; filmar 1 usuário usando o app (5 min). |
| B | Internacionalização (textos, formatos, dados e moeda) | Frontend | 1.5 | 60–100% | 0.90 | ⬜ PENDENTE | Locale do usuário já existe nas preferências. | Bloco 11: PT-BR/EN/ES com arquivos de mensagens; Intl.DateTimeFormat/NumberFormat; preços com moeda da loja. |
| B | Acessibilidade (público, estratégias, teste com o público) | Frontend | 1.5 | 60–100% | 0.90 | ⬜ PENDENTE | — | Público sugerido: pessoas com daltonismo (moda depende de cor). Estratégias: nome da cor em texto em toda peça, alto contraste, foco visível/teclado, alt text gerado. Teste com 3 pessoas e registrar. |
| B | CI/CD por ambiente (dev, test, prod) | DevOps | 1.5 | 60–100% | 0.90 | 🟡 PARCIAL | Frontend já com deploys automáticos Preview/Production na Vercel e variáveis por ambiente. | GitHub Actions: build + testes + JaCoCo em PR (test); deploy do backend em dev (branch) e prod (main). |
| B | Monitoramento e observabilidade | DevOps | 1.5 | 60% | 0.90 | 🟡 PARCIAL | Actuator (health/metrics), audit_log, ai_inference_log com custo/latência, alertas no dashboard. | Expor /actuator/prometheus e um painel Grafana Cloud com 1 alerta (erro 5xx ou custo de IA). |
| B | Técnica/tecnologia livre (acordada até a 3ª sprint) | Livre | 1.5 | 100% se acordado | 1.50 | 🟡 PARCIAL | Pipelines de IA generativa: flat lay (RF4), provador virtual 2D (RF18), modelo 3D (Meshy), mosaico RF11. | Confirmar com os professores se essa tecnologia foi registrada até a 3ª sprint. |
| B | Processo de qualidade (plano de testes, revisão no git, reprovações de QA) | Eng. software | 1.0 | 60–100% | 0.60 | ⬜ PENDENTE | Critérios de aceite por RF (CA01..) já servem de casos de teste. | Plano de testes por sprint a partir dos CAs; coluna 'QA' no Trello com cards reprovados; revisão obrigatória em PR. |
| B | Cobertura de testes do backend (JaCoCo) | Backend | 1.0 | 50% (0,6) | 0.60 | ⬜ PENDENTE | Serviços puros e testáveis (Hype, Inventory Score, RoomAddress, faixas de clima, cursor de busca). | Bloco 10: JaCoCo no pom + testes unitários das regras de cálculo; relatório HTML como evidência. |
| B | Padrões de projeto e arquitetura limpa (frontend) | Frontend | 1.0 | 100% | 1.00 | ⬜ PENDENTE | — | Bloco 11: camadas api/ (client), hooks/, components/, features/; Adapter para a API; Provider para tema/i18n. |
| C | NoSQL avançado (JSON Schema, índices/TTL, aggregation/sharding) | Backend | 1.5 | 30–60% | 0.45 | 🟡 PARCIAL | Cassandra (timeline particionada por usuário) e Redis com TTL (cache, rate limit). | Só vale se sobrar tempo: TTL explícito nas tabelas do Cassandra + validação de schema do payload. |
| C | Microsserviços | Backend | 1.5 | — | 0.00 | — NÃO SE APLICA | Arquitetura é monólito modular hexagonal (decisão consciente). | Não perseguir. |
| C | Service Discovery + API Gateway | Backend | 1.0 | — | 0.00 | — NÃO SE APLICA | — | Não perseguir. |
| C | Cobertura de testes do frontend | Frontend | 1.0 | 20% (0,3) | 0.30 | ⬜ PENDENTE | — | Opcional: Vitest nos componentes utilitários. |
| C | Infraestrutura como código | DevOps | 1.0 | 30–60% | 0.30 | ⬜ PENDENTE | — | docker-compose.dev.yml (bloco 9) conta como parcial; Terraform só se sobrar tempo. |

## 3. Roteiro da equipe (em ordem)

1. **Hoje:** Bryan começa a commitar com a própria conta (obrigatório nº 8). Toda PR passa a ter revisão do outro integrante.
2. **Sprint atual:** preencher o TDE de todas as sprints já feitas (obrigatório nº 2) usando o histórico do Trello.
3. **Após os blocos 8–11:** gravar a demo dos perfis (PESSOAL × ADMIN) e do dashboard com filtros (obrigatórios nº 6 e 7).
4. **Toda sprint:** nova migração Flyway versionada na própria sprint (opcional de migrações).
5. **Antes da banca:** README, Swagger com exemplos, docs/arquitetura/PADROES.md, EXPLAIN de uma consulta indexada.
6. **Reserva:** teste de acessibilidade com 3 pessoas daltônicas, pipeline do GitHub Actions, painel Grafana.
