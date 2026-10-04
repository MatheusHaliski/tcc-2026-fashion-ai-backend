# HypeScore v2 — arquitetura

> **HypeScore = f(entidade, comportamento, contexto, tempo).** O Hype não responde "esta peça é boa?". Responde "qual é a
> relevância atual desta peça (ou look) dentro do FashionAI e como essa relevância está evoluindo?". E fica sempre
> separado da **compatibilidade pessoal** com o DNA de estilo.

Auditoria e proposta de navegação que motivaram esta entrega: [`01-AUDITORIA_E_PROPOSTA_IA.md`](01-AUDITORIA_E_PROPOSTA_IA.md).

## 1. Visão geral

```
 ações do app                    agregado diário              job de snapshots (6/6 h)             leitura (GET nunca recalcula)
 ─────────────                   ───────────────              ────────────────────────             ─────────────────────────────
 curtir / comentar / salvar  ─┐                                ┌─ HypeSignalSeries (séries)       /api/hype/summaries  (lote, cards)
 compartilhar / remixar       │  DomainEvents.HypeSignal       │  HypeCalculator (puro)           /api/hype/pieces|looks/{id}[/history]
 visualizar peça/look         ├─► HypeIntegrityPolicy ──► hype_signal_daily ─► HypeSnapshotService ─► hype_scores (estado atual)
 vestir peça (diário)         │  (antimanipulação)             │  algorithm_version = HYPE_V2      hype_score_snapshots (1/dia)
 look salvo / look do dia   ──┘  HypeSignalRecorder (AFTER_COMMIT)                                 /api/hype/trending · /api/me/hype/*
                                                                                                    + HypeCache (geração)
```

| Camada | Onde | Papel |
|---|---|---|
| Configuração | `application/hype/HypeScoreConfig` | pesos, janelas, decaimento, faixas, integridade, `algorithmVersion` |
| Cálculo puro | `HypeCalculator`, `HypeInputs`, `HypeResult`, `HypeSignalSeries` | sem banco, 100% testável |
| Ingestão | `HypeSignalRecorder`, `HypeIntegrityPolicy` | eventos → agregado diário, com filtros |
| Job | `HypeSnapshotService.recalculate()` | lote periódico + admin (`POST /api/admin/hype/snapshots`, job "hype") |
| Leitura | `HypeQueryService`, `HypeCache`, `HypeController` | visibilidade, ranking com recortes, painéis pessoais |
| Contexto do Copilot | `RecommendationScoring`, `StyleCompatibility`, `CopilotService.hypeAnswer/scoreLooks` | Hype como contexto, nunca critério único |
| UI | `components/fashion-card.tsx`, `components/hype/*`, `lib/hype/*` | frente/verso, estados, análise completa |

### Convivência com o v1 (RF6)

O `HypeScoreService` (v1: `0,65·E_norm + 0,35·T_norm`) continua dono das colunas `hype_score`/`hype_score_global` das
entidades, do painel do Look do Dia, do Explorador e do FLAIR. O v2 grava **só** nas tabelas novas, sempre com
`algorithm_version`, então as duas séries nunca se misturam. Cards, Histórico, Insights, ordenações do guarda-roupa,
ranking "Em alta" e Copilot leem o v2. A migração dos demais consumidores é o próximo passo (§11).

## 2. Dimensões (cada uma 0–100, nunca soma de contagens brutas)

| Dimensão | Mede | Como |
|---|---|---|
| **Popularidade** | alcance e uso acumulados | `log1p(atividade no horizonte + interações acumuladas + 0,1·visualizações)`, em percentil (midrank) da população **pública** |
| **Engajamento** | intensidade de interação | `(I + k·μ) ÷ (E + k)`: interações ponderadas ÷ alcance, com suavização bayesiana (`k = 20` impressões emprestadas da média μ da comunidade). 2 curtidas em 2 visualizações não viram 100% |
| **Trend** | crescimento recente | janela atual (7 d) × anterior (7 d), as duas com o mesmo decaimento `e^(−λ·idade)`; `100·σ(2,5·ln((atual+α)/(anterior+α)))`, `α = 3`. Com pouco volume, puxa para 50 ou usa a tendência das **peças semelhantes** |
| **Velocidade** | aceleração | `g_i = ln((w_i+α)/(w_{i+1}+α))` nas semanas 0–3; aceleração `g_0 − média(g_1, g_2)`; `100·σ(5·aceleração)` (+4% → +11% → +28% = emergente) |
| **Novidade** | recência ou retorno à atenção | `max(100·0,5^(idade/30), 75 se voltou a ter atividade após ≥ 21 dias parada)`. Não é qualidade |
| **Longevidade** | relevância sustentada (sentido oposto ao decaimento) | semanas com atividade ÷ semanas de vida no horizonte (12), × `min(1, idade/56)` |
| **Raridade** | frequência do modelo | `100·(1 − presença^0,35)`, presença = donos do mesmo produto do catálogo (ou categoria+subcategoria+marca) ÷ donos; edição limitada tem piso 85. **Nunca** "poucas interações" |
| **Originalidade** | combinação incomum | autoinformação média (bits) dos pares de atributos (categoria×cor, categoria×material, estilo; no look, pares de peças e estilo×ocasião), em percentil. Indicador computacional, não verdade estética |
| **Influência** (looks) | remixes e looks derivados | `log1p(remixes + 0,5·looks derivados de 2ª geração)`; só entra quando existe (não pune quem não foi remixado) |

Normalização: com população pública ≥ 5, percentil midrank; abaixo disso, curva absoluta `100·(1 − e^(−x/escala))`
(ambiente de desenvolvimento/TCC com poucos dados).

### Sinais por tipo (PieceHype × LookHype)

| Sinal (`HypeSignalType`) | Peça | Look | Peso na atividade |
|---|---|---|---|
| LIKE_CREATED | ✓ | ✓ | 1 |
| COMMENT_CREATED | ✓ | ✓ | 2 |
| SAVE_CREATED | ✓ | ✓ | 2 |
| SHARE_CREATED | ✓ | ✓ | 3 |
| FAVORITE_CREATED | ✓ | ✓ | 1,5 |
| LOOK_REMIXED / PIECE_REMIXED | ✓ (semente) | ✓ (fork) | 4 / 3 |
| LOOK_VIEWED / PIECE_VIEWED | ✓ | ✓ | 0,1 |
| PIECE_USED (diário de uso) | ✓ | — | 1 |
| PIECE_IN_LOOK (aparição em looks) | ✓ | — | 1,5 |
| LOOK_WORN (look do dia) | — | ✓ | 1 |

## 3. Score final

```
HypeScore = Σ wᵢ·dᵢ ÷ Σ wᵢ      (só sobre as dimensões presentes; ausente ≠ 0)
```

Pesos iniciais (**não definitivos**, centralizados em `HypeScoreConfig`, sobrescrevíveis por propriedade):

| | popularidade | engajamento | trend | velocidade | originalidade | raridade | longevidade | novidade | influência |
|---|---|---|---|---|---|---|---|---|---|
| peça | 0,20 | 0,18 | 0,18 | 0,12 | 0,10 | 0,08 | 0,08 | 0,06 | — |
| look | 0,20 | 0,18 | 0,18 | 0,12 | 0,10 | 0,08 | 0,08 | 0,06 | 0,08 |

**Dados insuficientes**: eventos no horizonte + interações acumuladas < 3 → `status = INSUFFICIENT_DATA`, `score = null`
(a interface mostra "Dados insuficientes", nunca 0).

### Faixas (sempre com rótulo em texto)

| 0–19 | 20–39 | 40–59 | 60–74 | 75–89 | 90–100 |
|---|---|---|---|---|---|
| Sinal baixo | Nicho | Relevante | Em alta | Tendência | Viral |

A faixa segue o número exibido (arredondado): 89,6 aparece como 90 e é "Viral".

### Movimento e momento

* **Delta**: score atual × snapshot de 7 dias antes (o mais recente entre D−10 e D−7). `|Δ| < 2 pts` = **estável** (→);
  acima, ↑/↓ com o percentual (ou pontos, se a base for 0). Sem base = sem seta.
* **Momento** (`HypeMomentum`): EMERGING (trend ≥ 70, velocidade ≥ 65, popularidade < 60), RISING (trend ≥ 60),
  CLASSIC (longevidade ≥ 75 e trend > 35), COOLING (trend ≤ 40), STABLE.

## 4. Explicabilidade

`HypeCalculator.reasons()` devolve motivos como **códigos estáveis + número**; o frontend traduz (`lib/hype/explain.ts`,
chaves `hype.reason.*`). Exemplos: `SAVES_GROWTH 43` → "43% mais salvamentos nos últimos 7 dias";
`POPULAR_NOT_GROWING` → "Muito popular, mas sem crescimento recente — popularidade não é tendência";
`SIMILAR_GROWTH 31` → "Peças semelhantes cresceram 31% em popularidade recentemente". Nunca juízo de qualidade.
Código desconhecido (versão nova do algoritmo) cai num texto neutro, sem quebrar a tela.

## 5. Eventos e ingestão

`DomainEvents.HypeSignal(signal, entityType, entityId, actorId, ownerId)` é publicado por `SocialService` (curtida,
comentário, save, favorito, compartilhamento, remix de peça), `SchemeService` (visualização de look, remix de look) e
`WardrobeService` (visualização de peça). Uso vem dos eventos que já existiam: `PieceWorn`, `SchemeSaved(created)` e
`DailyLookRegistered`. O `HypeSignalRecorder` grava depois do commit, em transação própria (`SideEffectRunner`), com
`INSERT … ON DUPLICATE KEY UPDATE` atômico. **Nada é recalculado por evento**.

## 6. Banco (Flyway `V31__hype_score_v2.sql`)

| Tabela | Chave única | Conteúdo |
|---|---|---|
| `hype_signal_daily` | (entity_type, entity_id, signal_type, signal_date) | `event_count`, `weighted_count` — o EntityInteractionAggregate |
| `hype_scores` | (entity_type, entity_id, algorithm_version) | estado atual: score, faixa, 9 dimensões, delta, direção, momento, `public_eligible`, recortes (categoria, estilos, ocasiões), `signals_json`, `reasons_json`, janela |
| `hype_score_snapshots` | (entity_type, entity_id, algorithm_version, snapshot_date) | série histórica diária (score, faixa, dimensões, status, janela, `calculated_at`) |

A migração faz backfill dos sinais que já tinham data (`reactions`, `comments`, `shares`, `saved_items`,
`piece_usage_diary`, `daily_looks`, remixes via `original_scheme_id`, aparições via `scheme_items`), sem
auto-interação. Visualizações não tinham data e começam a contar a partir da V31. Tabelas reaproveitadas, nada
duplicado: `metric_snapshots`/`hype_score_metrics` continuam do v1 (calibração e painel do Look do Dia).

## 7. API

| Método e rota | Acesso | Resposta |
|---|---|---|
| `GET /api/hype/summaries?type=PIECE\|LOOK&ids=a,b` | público (respeita visibilidade) | Hype de até 100 cards numa requisição |
| `GET /api/hype/pieces/{id}` · `/api/hype/looks/{id}` | público (visibilidade) | análise completa: dimensões, motivos, sinais, pesos, `compatibility` à parte |
| `GET /api/hype/pieces/{id}/history?days=90` · `/looks/{id}/history` | público (visibilidade) | snapshots diários |
| `GET /api/hype/trending?type&window=1\|7\|30&category&style&occasion&limit` | público | ranking só de `public_eligible`; 1 = trend, 7 = score, 30 = média do mês |
| `GET /api/me/hype/wardrobe` | autenticado | Hype médio, destaques, redescobertas |
| `GET /api/me/hype/movers?days=90` | autenticado | séries, subiram/caíram, emergentes, novas tendências |
| `POST /api/admin/hype/snapshots` | admin | recalcula agora |
| `GET /api/hype/method` | público | v1 + `v2` (configuração ativa) |
| `GET /api/me/closet?sort=hype_desc\|hype_asc\|growth\|worn\|least_worn\|rarity\|idle&hypeLevel=HOT` | autenticado | ordenações e filtro por faixa |

O painel pessoal fica em `/api/me/hype/*` (convenção `/api/me` da API), não em `/api/hype/me/*`, porque `/api/hype/**`
é público para GET.

## 8. Cache e desempenho

* O GET lê o estado gravado; o card pede em **lote** (`useHypeSummary` junta os pedidos do mesmo tick numa requisição).
* No frontend, cada card assina só a própria chave (`useSyncExternalStore`): chegar o Hype de um card não re-renderiza a
  grade; cache de 5 min com limite de 600 entradas e descarte das não observadas (sem vazamento em listas longas).
* No backend, `HypeCache` (Redis quando ligado, memória no fallback) com **geração**: o job incrementa a geração e
  todas as chaves antigas expiram sozinhas (TTL 10 min). Usado no ranking.
* O verso do card só é montado no primeiro giro; o drawer de análise só busca dados quando abre.

## 9. Privacidade

* Só peças/looks **públicos**, aprovados, de perfis não privados e de contas fora do modo de teste entram na régua
  (percentis), no ranking, na tendência pública, nas "novas tendências" e no `public_eligible`.
* Item privado tem Hype **pessoal** (visível só para o dono), calculado contra a régua pública; para terceiros, a
  leitura em lote simplesmente não o devolve, e o detalhe responde 404.
* A tendência das "peças semelhantes" usa só sinais de peças públicas; a presença de um modelo entre guarda-roupas é
  um agregado não identificável.

## 10. Antimanipulação (mínimo implementado + pontos de extensão)

Implementado em `HypeIntegrityPolicy`: interação ou visualização do próprio dono não conta; 1 sinal por pessoa,
entidade, tipo e dia (save → unsave → save conta uma vez; visualizações repetidas também); contas com menos de 7 dias
pesam 0,5; visitante sem conta não conta.

Extensões previstas: reputação do ator; detecção de bots por cadência e horário; grafos de contas que só interagem
entre si; limite por IP/dispositivo; quarentena de picos anômalos antes de entrar na série. **Patrocínio nunca entra no
Hype**: conteúdo patrocinado deve ter rótulo próprio e ficar fora de `hype_signal_daily`.

## 11. Frontend

* **FashionCard** (`components/fashion-card.tsx`): `FashionCard`, `FashionCardFront`, `FashionCardBack`,
  `CardFlipButton`. Só o ↻ vira (foto abre o detalhe; curtir curte); estado local e visual; face escondida `inert`;
  foco acompanha o giro; Esc volta; `rotateY` + `preserve-3d` + `backface-visibility` (≈ 380 ms); com
  `prefers-reduced-motion` ou a preferência do app, troca simples de face.
* **Componentes** (`components/hype/`): `HypeBadge`, `HypeTrendIndicator`, `HypeScoreGauge` (também usado pela
  anatomia "Hype Focus"), `HypeMetricBar`, `HypeBreakdown`, `HypeExplanation`, `HypeHistoryChart`, `HypeVsStyle`,
  `HypeStateNotice`, `HypeAnalyticsDrawer` (em portal), `HypeCardBack`, `HypeInline`, `HypeItemRow`,
  `HypeRediscoveryCard`, `HypeWardrobeInsights`, `HypeTrendingPanel`, `hypeSortOptions`/`hypeLevelFilter` (HypeSort/HypeFilter).
* **Estados**: carregando · Hype ainda não calculado · Dados insuficientes · disponível · desatualizado (> 24 h) · erro.
* **Telas**: cards de peça e look; detalhe ampliado; Guarda-roupa (ordenações + filtro); Lookbook → Insights;
  Histórico (novo: Timeline, Evolução do estilo, Uso de peças, Hype, Insights da IA); Explorador → Em alta; Copilot
  (modos, seções, quatro números por look, perguntas de Hype).

## 12. Copilot

* Intenção `HYPE` (regex, sem custo de IA): "qual a peça mais relevante", "o que está crescendo", "tenho peça rara",
  "o que está voltando a ser tendência", "qual look tem mais potencial de trend". Pedidos para **montar** look
  continuam `LOOKS`. Toda resposta traz a compatibilidade com o estilo ao lado e o aviso "Hype ≠ seu estilo".
* Modos `SAFE` / `DISCOVERY` / `EXPERIMENTAL` reordenam os looks por `RecommendationScoring`
  (compatibilidade, Hype, novidade, reutilização); o Hype nunca passa de 20% do peso.
* A ferramenta da IA (`buscar_pecas`) agora recebe o Hype v2 e a data do último uso de cada peça.

## 13. Testes

* Backend (JUnit): `HypeScoreConfigTest`, `HypeCalculatorTest` (insuficiente ≠ 0, 10 mil antigas × 2 recentes, trend ≠
  popularidade, aceleração, decaimento, engajamento normalizado, raridade sem interações, clássico, revival,
  semelhantes, influência), `HypeSignalSeriesTest`, `HypeIntegrityPolicyTest`, `HypeSnapshotRulesTest` (privado fora
  do público), `HypeQueryPrivacyTest`, `RecommendationScoringTest`, `StyleCompatibilityTest`, `CopilotHypeIntentTest`.
* Frontend (Vitest): `lib/hype/model.test.ts`, `components/hype/hype-card.test.tsx` (abre na frente, flip e volta,
  curtir e foto não viram, teclado/Esc/foco, só um card vira, movimento reduzido, score 0, nulo, carregando,
  desatualizado, erro, histórico vazio, uma requisição por grade).
* Validação manual: MySQL 8.4 + API + Next com Playwright (screenshots do flip, análise, Histórico, Insights, Em alta).

## 14. Limitações conhecidas

* O job lê todas as peças e looks não arquivados de uma vez (adequado ao volume do TCC); em escala, paginar por
  dono/lote e calcular a régua com amostragem.
* Visualizações só existem a partir da V31; até lá o engajamento usa interações como piso do alcance.
* "Usuários únicos" é aproximado pelo dedupe pessoa/dia, não por contagem distinta exata.
* Ranking por região não foi implementado (a arquitetura de recortes comporta; falta o país no `hype_scores`).

## 15. Próximos passos

1. Migrar Explorador, FLAIR, busca e o painel do Look do Dia para o v2 e aposentar a materialização v1.
2. Calibrar os pesos com dados reais e publicar como `HYPE_V3` (nova série, histórico do v2 preservado).
3. Antifraude além do mínimo (§10) e rótulo de patrocínio.
4. Recorte regional do ranking e `influenceScore` também para peças (looks derivados que usam a peça).
