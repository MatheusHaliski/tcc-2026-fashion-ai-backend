# HypeScore v2 — arquitetura

> **HypeScore = f(entidade, comportamento, contexto, tempo).** O Hype não responde "esta peça é boa?". Responde "qual é a
> relevância atual desta peça (ou look) dentro do FashionAI e como essa relevância está evoluindo?". E fica sempre
> separado da **compatibilidade pessoal** com o DNA de estilo.

Auditoria e proposta de navegação que motivaram esta entrega: [`01-AUDITORIA_E_PROPOSTA_IA.md`](01-AUDITORIA_E_PROPOSTA_IA.md).
Auditoria de abas (onde o v2 foi aplicado, lotes 1–9 e adiados): [`HYPE_AUDITORIA_ABAS.md`](HYPE_AUDITORIA_ABAS.md).
Requisito e critérios de aceite: [`RF53_HypeScore_v2.md`](../novos-rf/RF53_HypeScore_v2.md). Teste real de ponta a ponta:
[`EVIDENCIAS_E2E.md`](EVIDENCIAS_E2E.md).

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
 qualquer evento acima ──► HypeLiveRecalc.markDirty() ──(verificação 30 s, ≤ 1 recálculo / 120 s)──► HypeSnapshotService
 HypeSnapshotService (subida de faixa/momento) ──► DomainEvents.HypeMilestone ──► HypeMilestoneNotifier ──► hype_milestones + notificação
```

| Camada | Onde | Papel |
|---|---|---|
| Configuração | `application/hype/HypeScoreConfig` | pesos, janelas, decaimento, faixas, integridade, `algorithmVersion` |
| Cálculo puro | `HypeCalculator`, `HypeInputs`, `HypeResult`, `HypeSignalSeries` | sem banco, 100% testável |
| Ingestão | `HypeSignalRecorder`, `HypeIntegrityPolicy` | eventos → agregado diário, com filtros |
| Job | `HypeSnapshotService.recalculate()` (`synchronized`) | lote periódico + admin (`POST /api/admin/hype/snapshots`, job "hype"); grava país, região, categorias e subcategorias (V39) e os sinais por tipo (`signals_json.byType`) |
| Ao vivo | `HypeLiveRecalc` | eventos só marcam "sujo"; verificação a cada 30 s, no máximo um recálculo a cada 120 s (§8) |
| Marcos | `HypeSnapshotService.milestones`, `HypeMilestoneNotifier` | notificação `HYPE_MILESTONE` só na subida (§17) |
| Selos de Hype | `HypeSeals` | códigos derivados do estado atual; nada gravado (§16) |
| Leitura | `HypeQueryService`, `HypeCache`, `HypeController` | visibilidade, Em alta, ranking regional, facetas, posições, globo, painéis pessoais |
| Insights | `application/insights` (`InsightService`, `PublicInsights`, `PersonalInsights`, `InsightMath`), `InsightsController` | insights determinísticos por aba (§18) |
| Contexto do Copilot | `RecommendationScoring`, `StyleCompatibility`, `CopilotService.hypeAnswer/scoreLooks` | Hype como contexto, nunca critério único |
| UI | `components/fashion-card.tsx`, `components/hype/*`, `lib/hype/*` | frente/verso, estados, análise completa |

### Fim do v1 (RF6) — limpeza final P3-16

O v1 (`0,65·E_norm + 0,35·T_norm`, percentis de 90 dias, 7 faixas de juízo "Despretensioso…Ícone de estilo", Top X%
semanal e HypeGroups com `hypeScoreGlobal`) **saiu do código** no lote Final da auditoria de abas:

* nada mais grava `wardrobe_items.hype_score(_global)`, `schemes.hype_score(_global)`, `hype_group_id`,
  `dna_schemes.hype_score`, `hype_score_metrics`, `hype_groups` nem os `metric_snapshots` `HYPE_CAL_*`/`HYPE_WEEK_*`. O
  job agendado do v1 (a cada 4 h) e as entidades/repositórios `HypeScoreMetric`, `HypeGroup`, `MetricSnapshot` e o enum
  `HypeScoreBand` foram removidos. As **colunas e tabelas ficam no banco** só como histórico (o schema é 100% Flyway e
  nenhuma migração as apaga; um `DROP` pode vir numa migração futura, depois de exportar o histórico se o time quiser);
* as views da API (`PieceView`, `PieceRow`, `SchemeView`) e os mapas de Passarela, My Stage, ilha do quarto, histórico
  do Look do Dia, DNA (`hypeScoreGlobal` das células e o `hype` v1 dos medidores), documento de busca e insights de
  Eras/Coleções (`topHype`) não levam mais `hypeScore`/`hypeScoreGlobal`;
* o painel do Look do Dia (`HypeScoreService.panel`) só lê: devolve `v2`, `magazineCover`, `tip` (dica pela dimensão v2
  mais fraca, local ou da IA) e `previousDailyLook`. Antes a dica saía como `aiSuggestion`, que a tela não lia;
* Explorador: saíram o filtro `hypeBand` e as faixas `HYPE_BANDS` do painel global, o `avg_hype` (v1) dos países, o
  "hype por estação" do país (virou `looksBySeason`, só volume), o `hypeMin` numérico e os campos `hypeScore`/`stars`
  de Marcas & lojas; no admin, o `hypeBands` v1 e as médias `avg_hype` de marcas e países;
* `GET /api/hype/method` publica só a configuração v2; `GET /api/similarity-groups/global` (HypeGroups v1, sem tela)
  foi removido; o job "hype" do admin e o atalho `POST /api/admin/hype/recalibration` (RF6.CA10) recalculam só o v2.

O v2 grava só nas tabelas próprias, sempre com `algorithm_version`; uma calibração futura entra como `HYPE_V3` (§15).

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

## 6. Banco (Flyway `V31__hype_score_v2.sql`, depois V39 e V41)

| Tabela | Chave única | Conteúdo |
|---|---|---|
| `hype_signal_daily` | (entity_type, entity_id, signal_type, signal_date) | `event_count`, `weighted_count` — o EntityInteractionAggregate |
| `hype_scores` | (entity_type, entity_id, algorithm_version) | estado atual: score, faixa, 9 dimensões, delta, direção, momento, `public_eligible`, recortes (categoria, estilos, ocasiões), `signals_json`, `reasons_json`, janela |
| `hype_score_snapshots` | (entity_type, entity_id, algorithm_version, snapshot_date) | série histórica diária (score, faixa, dimensões, status, janela, `calculated_at`) |

A migração faz backfill dos sinais que já tinham data (`reactions`, `comments`, `shares`, `saved_items`,
`piece_usage_diary`, `daily_looks`, remixes via `original_scheme_id`, aparições via `scheme_items`), sem
auto-interação. Visualizações não tinham data e começam a contar a partir da V31. As tabelas do v1
(`metric_snapshots`, `hype_score_metrics`, `hype_groups`) e as colunas `hype_score*` ficam só como histórico: desde a
limpeza P3-16 nada as grava nem as lê (§1).

Migrações seguintes:

| Migração | Tabela | Conteúdo |
|---|---|---|
| `V39__hype_regiao_e_subcategorias.sql` | `hype_scores` | `country` (país do dono), `region` (`WorldRegions`), `categories` e `subcategories` (no look, as das peças) + índice `(entity_type, algorithm_version, public_eligible, region)`. Base do ranking regional e do globo |
| `V41__hype_milestones.sql` | `hype_milestones` | marco alcançado, único por (entity_type, entity_id, milestone); `level`, `momentum`, `score`, `public_eligible`, `digest_date` e `notification_id` (resumo do dia). Queda nunca grava linha |

## 7. API

| Método e rota | Acesso | Resposta |
|---|---|---|
| `GET /api/hype/summaries?type=PIECE\|LOOK&ids=a,b` | público (respeita visibilidade) | Hype de até 100 cards numa requisição |
| `GET /api/hype/pieces/{id}` · `/api/hype/looks/{id}` | público (visibilidade) | análise completa: dimensões, motivos, sinais, pesos, `compatibility` à parte |
| `GET /api/hype/pieces/{id}/history?days=90` · `/looks/{id}/history` | público (visibilidade) | snapshots diários |
| `GET /api/hype/trending?type&window=1\|7\|30&category&style&occasion&limit` | público | ranking só de `public_eligible`; 1 = trend, 7 = score, 30 = média do mês |
| `GET /api/hype/trending?type=BRAND\|CREATOR&…` | público | **Marcas em alta** (só peças) e **Criadores em alta** (peças + looks): agregados por marca ou por pessoa, só com itens `public_eligible`; o grupo precisa de ≥ 3 itens públicos e o valor é a média dos seus 5 itens mais relevantes; criador bloqueado some para quem vê |
| `GET /api/hype/ranking?type&window&region&country&category&subcategory&page&size` | público | **Ranking de HypeScore** (Explorador): só `public_eligible` e AVAILABLE; o look entra pelas categorias das peças e traz `pieces` (Hype de cada peça); sem país = região `OUTRAS`; numeração pública (quem vê só some itens que não pode ver); `size ≤ 48`; cache por geração |
| `GET /api/hype/ranking/facets?type&window&region&category` | público | contagens de regiões (com Hype médio), países, categorias e subcategorias do recorte, e o total do mundo |
| `GET /api/hype/pieces/{id}/positions` · `/looks/{id}/positions` | público (visibilidade) | posições no ranking público (janela 7): mundo, categoria e subcategoria (peça), região e país; fora da população pública → `eligible: false` |
| `GET /api/hype/globe?type&window=1\|7\|30&category&subcategory&minLevel` | público | **Globo do Painel global** (Explorador): por país do dono, só `public_eligible` — itens, criadores, Hype médio/máximo (com a faixa), crescimento (TREND), subindo, faixas, cor dominante, item de destaque (respeita a visibilidade de quem vê) e `sufficient` (≥ 3 itens); sem país só no `world`. Camadas no front: números, colunas 3D, bonecos, cards e calor |
| `GET /api/me/hype/wardrobe` · alias `GET /api/hype/me/wardrobe` | autenticado | Hype médio, destaques, redescobertas (o alias, citado na especificação, exige login no próprio endpoint porque `/api/hype/**` é GET público) |
| `GET /api/me/hype/movers?days=90` | autenticado | séries, subiram/caíram, emergentes, novas tendências |
| `POST /api/admin/hype/snapshots` | admin | recalcula agora |
| `GET /api/hype/method` | público | configuração ativa do v2 (dimensões, pesos, faixas, janelas, decaimento); o v1 saiu em P3-16 |
| `GET /api/me/closet?sort=hype_desc\|hype_asc\|growth\|worn\|least_worn\|rarity\|idle&hypeLevel=HOT&seal=hype\|brand\|any` | autenticado | ordenações, filtro por faixa e filtro "Com selo" (§16) |
| `GET /api/me/schemes?sort=recent\|hype_desc\|hype_asc\|growth&hypeLevel=` | autenticado | Meus looks pelo Hype pessoal do dono (nulos por último) |
| `POST /api/schemes/scores {pieceIds, occasion, style}` | autenticado | prévia do editor: os seis números de `RecommendationScoring` para as peças escolhidas; nada é gravado e nenhum sinal é emitido |
| `GET /api/insights?context&window&region&category&subcategory&withAi` | `EXPLORER_*` público; demais autenticado (401) | insights dinâmicos da aba (§18) |
| `GET /api/pieces/seals?ids=` | público (visibilidade) | selos de marca/celebridade APPROVED de tier PEÇA que cobrem cada peça (até 60 ids) (§16) |
| `GET /api/schemes/{id}/seal-suggestions` · `POST /api/seal-suggestions/preview[-piece]` | autenticado | sugestões de selo com `hype {score, level}` da entidade avaliada, ordenadas por Hype (§16) |
| `GET /api/feed` · `/api/search` · `/api/public-pieces` `?hypeLevel=` | público | faixa mínima do Hype público v2 (lote 1) |
| `GET /api/hype/groups?type=BRAND\|CREATOR&keys=&window=` | público | Hype agregado de várias marcas (chave = nome normalizado) ou pessoas (chave = id) para os chips da busca, do perfil e de /brands — faixa, valor, itens públicos, `sufficient` (≥ 3) e posição (Lote A1). A rota legada de agrupamentos por similaridade v1 foi removida em P3-16 |

O painel pessoal fica em `/api/me/hype/*` (convenção `/api/me` da API). `/api/hype/me/wardrobe` existe só como alias,
com a checagem de login no controller, porque `/api/hype/**` é público para GET.

## 8. Cache e desempenho

* O GET lê o estado gravado; o card pede em **lote** (`useHypeSummary` junta os pedidos do mesmo tick numa requisição).
* No frontend, cada card assina só a própria chave (`useSyncExternalStore`): chegar o Hype de um card não re-renderiza a
  grade; cache de 5 min com limite de 600 entradas e descarte das não observadas (sem vazamento em listas longas).
* No backend, `HypeCache` (Redis quando ligado, memória no fallback) com **geração**: o job incrementa a geração e
  todas as chaves antigas expiram sozinhas (TTL 10 min). Usado no ranking.
* O verso do card só é montado no primeiro giro; o drawer de análise só busca dados quando abre.
* **Hype ao vivo** (`HypeLiveRecalc`): criar/editar/excluir peça, salvar look, qualquer sinal, uso, look do dia e
  mudança de disponibilidade só MARCAM o Hype como sujo; uma verificação a cada 30 s recalcula tudo de uma vez, no
  máximo a cada 120 s (`fashionai.hype.live-recalc-seconds`). Rajadas de curtidas viram um recálculo só; peça nova tem
  Hype em ~2 minutos em vez de esperar o job de 6 h. `recalculate()` é `synchronized` (job e ao vivo nunca se sobrepõem).

## 9. Privacidade

* Só peças/looks **públicos**, aprovados, de perfis não privados e de contas fora do modo de teste entram na régua
  (percentis), no ranking, na tendência pública, nas "novas tendências" e no `public_eligible`.
* Item privado tem Hype **pessoal** (visível só para o dono), calculado contra a régua pública; para terceiros, a
  leitura em lote simplesmente não o devolve, e o detalhe responde 404.
* A tendência das "peças semelhantes" usa só sinais de peças públicas; a presença de um modelo entre guarda-roupas é
  um agregado não identificável.
* **Opt-out de "Criadores em alta"** (P3-12, `user_preferences.hype_creator_opt_out`, V42): em Configurações ›
  Privacidade a pessoa pode sair do agregado público de criadores — some do ranking (os demais sobem) e o lote de chips
  devolve a chave dela sem valor, faixa nem posição. Peças e looks públicos dela continuam com o próprio Hype; trocar a
  opção (`PUT /api/me/preferences`, `hypeCreatorOptOut`) incrementa a geração do `HypeCache` e vai na exportação LGPD.

**Resumo das regras por superfície**

| Superfície | Quem entra | O que quem vê recebe |
|---|---|---|
| Card, detalhe, histórico | qualquer item visível para quem vê | privado de terceiros: fora do lote / 404 |
| Em alta, Ranking, facetas, Globo, Insights públicos, Marcas/Criadores em alta | só `public_eligible` e AVAILABLE | o item de destaque e as páginas aplicam bloqueio e visibilidade de quem vê; agregados não aplicam bloqueio |
| Posições na análise completa | só `public_eligible` | item fora da população pública → `eligible: false`; o dono continua vendo o Hype pessoal |
| Selos de Hype | só `public_eligible` e AVAILABLE | item privado não tem selo de Hype |
| Guarda-roupa, Meus looks, editor, Insights pessoais, Look do Dia | itens do dono | Hype pessoal (inclusive de item privado) |
| Marcos de Hype | itens do dono | só o dono é avisado; item privado é descrito como Hype pessoal |
| Exportação LGPD | o próprio usuário | snapshots do Hype pessoal e marcos (`AccountService`) |
| Selos, prévia do editor, marcos, Lens, votação de desafio | — | **nunca** escrevem em `hype_signal_daily` |
| Configurações › Privacidade | — | card "HypeScore e privacidade" explica as regras acima |

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
* **Arte dinâmica do verso** (`HypeBackArt`): o fundo do verso acompanha a faixa — sinal baixo é tímido (céu discreto,
  3 estrelas lentas), nicho 6, relevante 10, em alta 16 com brilho atravessando, tendência 24, viral 36 estrelas com
  gradiente dourado em movimento e halo pulsando atrás do número. CSS puro (gradientes, estrelas de quatro pontas por
  `clip-path` em posições determinísticas pela semente = id do item, só nas bordas; véu no miolo para os dados). Pausa
  quando o card volta para a frente, para com movimento reduzido, some no alto contraste e em `forced-colors`.
* **Análise completa conectada** (`HypeAnalyticsDrawer`): além de score, faixa, histórico e explicação, mostra o peso de
  cada dimensão (do `HypeScoreConfig`), os **sinais reais por tipo** (curtidas, salvos, compartilhamentos, remixes,
  visualizações, usos, aparições em looks — janela atual × anterior × horizonte, gravados pelo job em
  `signals_json.byType`), em quantos looks a peça aparece, as **peças do look com o Hype de cada uma**, a **posição no
  ranking público** (categoria, subcategoria, região, país — só itens elegíveis) e, com poucos sinais, as dimensões
  estruturais que já existem (raridade, originalidade, novidade) em vez de esconder tudo.
* **Telas**: cards de peça e look; detalhe ampliado; Guarda-roupa (ordenações + filtro); Lookbook → Insights;
  Histórico (novo: Timeline, Evolução do estilo, Uso de peças, Hype, Insights da IA); Explorador → Em alta; Copilot
  (modos, seções, seis números por look, perguntas de Hype).
* **Ranking de HypeScore** (`components/hype/hype-ranking.tsx`, `HypeRankingPanel`): Peças/Looks, Hoje/7/30 dias,
  região (com contagem), país, chips de categoria e subcategoria, barra "Hype por região" (toque filtra), cards com a
  posição e a região; no look, "Peças do look" com o Hype de cada peça. Filtros na URL.
* **Globo do Painel global** (`components/globe.tsx`, `components/hype/hype-globe.tsx`, `lib/hype/globe.ts`): camadas
  `numbers`, `columns`, `figures` (bonecos = criadores), `cards` e `heat` (padrão: números, colunas e cards); métricas
  Hype médio, máximo, volume e crescimento; tipo, janela, categoria e nível mínimo; legenda, visão em tabela
  (`HypeGlobeTable`), tema escuro, alto contraste e movimento reduzido.
* **Selos de Hype** (`components/hype/hype-seals.tsx`, `lib/hype/seals.ts`): medalhão Padrão FashionAI por código no
  `SealSlot` (máx. 2 no card), `HypeSealProgressList` no drawer, `SealSuggestionHype` nas sugestões e `SealHypeStat`
  (Hype do selo) na aba Selos do emissor.
* **Insights** (`components/insights/insight-strip.tsx`, `insight-card.tsx`, `lib/insights/types.ts`): `InsightStrip`
  por contexto no Explorador (Passarela, Em alta, Ranking, Painel global, Marcas, Insights globais), na Cápsula, no
  Copilot, no Autopiloto, no Histórico, no Guarda-roupa e em Meus looks; "Reescrever com IA" opcional.
* **Looks**: `LookHypePreview`/`PieceHypeTag` (`components/hype/look-hype-preview.tsx`) no editor; `lookHypeSortOptions()`
  em Meus looks; `LookScores` compartilhado por Copilot, Autopiloto e Espelho ("Leitura do look", P3-07).
* **Painéis** (`components/hype/hype-dashboards.tsx`): `IssuerHypeBlock` (dashboard do emissor), `HypeCoverageTable` e
  `HypeJobStatus` (admin).

## 12. Copilot

* Intenção `HYPE` (regex, sem custo de IA): "qual a peça mais relevante", "o que está crescendo", "tenho peça rara",
  "o que está voltando a ser tendência", "qual look tem mais potencial de trend". Pedidos para **montar** look
  continuam `LOOKS`. Toda resposta traz a compatibilidade com o estilo ao lado e o aviso "Hype ≠ seu estilo".
* Modos `SAFE` / `DISCOVERY` / `EXPERIMENTAL` reordenam os looks por `RecommendationScoring`, com **seis** dimensões
  independentes, todas exibidas no card do look: compatibilidade com o DNA, Hype, novidade (pares nunca combinados),
  reutilização (traz de volta peças paradas há 60+ dias), **uso comprovado** (peças que a pessoa de fato veste, 8+ usos
  = 100) e **sustentabilidade** (metade pela parte do look que a pessoa já tem, metade pelo quanto mais um uso dilui o
  custo por uso das peças pouco usadas). Pesos por modo:

  | Modo | Compat. | Hype | Novidade | Reutilização | Uso | Sustentab. |
  |---|---|---|---|---|---|---|
  | SEGURO | .50 | .10 | .05 | .10 | .15 | .10 |
  | DESCOBERTA | .30 | .20 | .20 | .10 | .10 | .10 |
  | EXPERIMENTAL | .15 | .20 | .40 | .10 | .05 | .10 |

  O Hype nunca passa de 20% do peso; dimensão sem base fica neutra (50) e aparece como "—", nunca 0.
* O cálculo dos seis números fica no `LookScorer`, compartilhado por Copilot, Autopiloto (que ganhou os três modos e
  os números em Hoje e Semana), composições da IA no editor, a prévia `POST /api/schemes/scores` (`LookPreviewService`)
  e o Espelho (P3-07: `scores` no estado de `/api/me/mirror` e no Vista-me; só peças do dono, só leitura do Hype gravado).
  Os mesmos números aparecem em `LookScores` em todas essas telas.
* "Peça esquecida" tem uma régua só no app inteiro: `RoomService.FORGOTTEN_DAYS` (60 dias desde o último uso ou, se
  nunca usada, desde o cadastro). O Copilot usava 30 dias e contava como esquecida até a peça cadastrada ontem.
* As sugestões de compra (`purchaseSuggestions`: subcategoria, cor e ganho de combinações, sem marca) passaram a
  aparecer na tela — a página lia um campo `purchases` que o backend nunca enviou. Patrocínio fica num bloco separado.
* A ferramenta da IA (`buscar_pecas`) agora recebe o Hype v2 e a data do último uso de cada peça.

## 13. Testes

* Backend (JUnit): `HypeScoreConfigTest`, `HypeCalculatorTest` (insuficiente ≠ 0, 10 mil antigas × 2 recentes, trend ≠
  popularidade, aceleração, decaimento, engajamento normalizado, raridade sem interações, clássico, revival,
  semelhantes, influência), `HypeSignalSeriesTest`, `HypeIntegrityPolicyTest`, `HypeSnapshotRulesTest` (privado fora
  do público), `HypeQueryPrivacyTest`, `RecommendationScoringTest`, `StyleCompatibilityTest`, `CopilotHypeIntentTest`.
* Frontend (Vitest): `lib/hype/model.test.ts`, `components/hype/hype-card.test.tsx` (abre na frente, flip e volta,
  curtir e foto não viram, teclado/Esc/foco, só um card vira, movimento reduzido, score 0, nulo, carregando,
  desatualizado, erro, histórico vazio, uma requisição por grade).
* Evolução (contagem e lista em [`RF53_HypeScore_v2.md`](../novos-rf/RF53_HypeScore_v2.md) §4): `HypeLiveRecalcTest`,
  `HypeRegionalRankingTest`, `HypeGlobeTest`, `HypeRankGroupsTest`, `HypeSealsTest`, `HypeSealsQueryTest`,
  `HypeMilestoneTest`, `InsightServiceTest`, `InsightsAccessTest`, `AutopilotScoresTest`, `SealPoliciesHypeTest`,
  `SealHypeServiceTest`, `ClosetSealFilterTest`, `SealPromotionFlowTest`, `InstitutionalDisplayPolicyTest` e os testes
  dos lotes 1–9; no frontend, `hype-ranking`, `globe-hype`, `hype-seals`, `insight-strip`, `looks`, `lookbook-hype`,
  `hype-dashboards`, `flair-hype` e `hype-personal-details`.
* Lote Final (P3-07/P3-12): `MirrorScoresTest`, `HypeCreatorOptOutTest`, `CreatorOptOutPreferencesTest`; no frontend,
  `app/mirror-settings-hype.test.tsx`.
* Validação manual: MySQL 8.4 + API + Next com Playwright (screenshots do flip, análise, Histórico, Insights, Em alta).
  Segunda rodada (2026-10-05, V1–V40): [`EVIDENCIAS_E2E.md`](EVIDENCIAS_E2E.md).

## 14. Limitações conhecidas

* O job lê todas as peças e looks não arquivados de uma vez (adequado ao volume do TCC); em escala, paginar por
  dono/lote e calcular a régua com amostragem.
* Visualizações só existem a partir da V31; até lá o engajamento usa interações como piso do alcance.
* "Usuários únicos" é aproximado pelo dedupe pessoa/dia, não por contagem distinta exata.
* Ranking por região: implementado (V39). Linhas anteriores à V39 ficam sem país/região até o próximo recálculo, e
  quem não informou o país cai em "Outras regiões". Ranking, facetas e globo filtram a população pública em memória
  (volume do TCC); em escala, agregar por região/país no job.
* Marcas em alta agrupam pelo nome da marca normalizado (minúsculas, sem espaços nas pontas); variações de grafia
  ("Levi's" × "Levis") ainda contam como marcas diferentes até a peça apontar para o catálogo (RF47).
* O ranking de marcas e criadores carrega as entidades da população pública numa consulta (volume do TCC); em escala,
  gravar `brand_key` no `hype_scores` durante o job.

## 15. Próximos passos

1. Lotes adiados da auditoria de abas: A1 (`/api/hype/groups`), A2 (perfil da marca e /brands), A3 (telas do
   Explorador), A4 (Lookbook › Peças para visitante), A5 (InsightStrip em novos contextos) e a limpeza final do v1
   (P3-16: parar de escrever `hype_score`, remover os campos das views e as faixas v1).
2. Calibrar os pesos com dados reais e publicar como `HYPE_V3` (nova série, histórico do v2 preservado).
3. Antifraude além do mínimo (§10) e rótulo de patrocínio.
4. `influenceScore` também para peças (looks derivados que usam a peça).

## 16. Selos × HypeScore e Selos de Hype FashionAI

Princípio: **o Hype alimenta os selos; selo nunca alimenta o Hype**. Nenhum vínculo, emissão ou selo vira sinal do
`HypeCalculator`, e o Hype usado é sempre o estado atual de `hype_scores`.

* **Critério de Hype na política padronizada** (`SealPolicies`, JSON em `seals.background_config_json.policy`, sem
  migração): `rule.hypeMin` (a peça só passa no filtro com Hype ≥ o nível) e `policy.hype {minLevel, minScore,
  momentum[≤ 3]}` para a entidade avaliada (peça no tier PEÇA, look no tier LOOK). Valor fora da escala → 400
  `POLITICA_INVALIDA`. Sem Hype disponível (`NOT_CALCULATED`, `INSUFFICIENT_DATA`) o critério não é atendido. A frase da
  política inclui o trecho de Hype ("look com Hype ≥ 60 e em crescimento").
* **Sugestões** (`SealService`): cada sugestão traz `hype {score, level}` da entidade avaliada (tier LOOK: o Hype do
  look; tier PEÇA: o maior Hype entre as peças vinculadas) e elas vêm ordenadas por Hype, sem Hype por último
  (ordenação estável).
* **Hype do selo**: listagens de selos trazem `hype {avgScore, level, bonded}` = média do HypeScore atual dos itens com
  vínculo APPROVED. Exibido em `SealHypeStat` na aba Selos.
* **Selos de Hype FashionAI** (`HypeSeals.of`, puro, nada gravado, nada emitido por marca), só para item AVAILABLE e
  `publicEligible`:

  | Código | Regra | Limiar |
  |---|---|---|
  | `VIRAL` | faixa = VIRAL | ≥ 90 |
  | `TRENDING` | faixa ∈ {HOT, TRENDING} e momento ∈ {RISING, EMERGING} | ≥ 60 |
  | `EMERGING` | momento EMERGING (e não VIRAL/TRENDING) | — |
  | `CLASSIC` | momento CLASSIC, ou longevidade ≥ 70 e faixa ≥ RELEVANT | ≥ 40 |
  | `RARE` | raridade ≥ 75 e faixa ≥ NICHE | ≥ 20 |

  Prioridade VIRAL > TRENDING > EMERGING > CLASSIC > RARE; o card mostra no máximo 2 (`summary().seals`) e o detalhe
  traz `sealProgress [{code, earned, criteria}]` com o que falta.
* **Guarda-roupa**: `seal=hype|brand|any` em `/api/me/closet` e `GET /api/pieces/seals` (até 60 ids) para os selos de
  marca/celebridade na frente do card da peça. Chip "Com selo" (Hype · Marca · Qualquer).
* **Perfil do emissor** (`InstitutionalService`): destaques só com vínculo APPROVED vigente, ordenados pelo Hype v2.
  Recusa por teto fica gravada (`SealService.SealUnavailable` + `noRollbackFor`, 409 `SELO_INDISPONIVEL`). Regras
  completas no [RF50](../novos-rf/RF50_Criador_de_Selos.md).

## 17. Marcos de Hype (notificação `HYPE_MILESTONE`)

* **Detecção** (`HypeSnapshotService.milestones`, depois de gravar o estado): só **subida** para HOT, TRENDING ou VIRAL
  (faixa nova acima da anterior) ou o surgimento do momento EMERGING. Sem estado anterior (primeiro cálculo ou nova
  `algorithmVersion`) não há marco, para não disparar avisos em massa. O evento `DomainEvents.HypeMilestone` só é
  publicado depois do commit do job.
* **Registro** (`HypeMilestoneNotifier`, AFTER_COMMIT, transação própria via `SideEffectRunner`): dedupe por
  (entidade, marco) em `hype_milestones`; atingir Viral já cobre Em alta e Tendência, então oscilar na borda (o
  recálculo ao vivo roda a cada 120 s) nunca avisa de novo. O destinatário é sempre o dono, conferido no banco.
* **Resumo diário**: os marcos do dono no mesmo dia (America/Sao_Paulo) atualizam a mesma notificação, que volta a
  ficar não lida; com vários itens, o link abre `/history?tab=hype`.
* **Regras**: categoria ACHIEVEMENT, desativável em Notificações › Preferências (o marco é gravado mesmo assim, para
  não reaparecer); nunca notifica queda (ETI-02); não é sinal de Hype; marcos saem na exportação LGPD.

## 18. Insights dinâmicos (`GET /api/insights`)

* **Contextos**: públicos `EXPLORER_RUNWAY`, `EXPLORER_TRENDING`, `EXPLORER_RANKING`, `EXPLORER_MAP`,
  `EXPLORER_BRANDS`, `EXPLORER_GLOBAL` (sem login, só agregados de itens `public_eligible`, no `HypeCache` pela
  geração); pessoais `CAPSULE`, `COPILOT`, `AUTOPILOT`, `HISTORY`, `CLOSET`, `LOOKS` (401 sem login). Contexto
  desconhecido → 400 `CONTEXTO_INVALIDO`; região fora de `WorldRegions` → 400. Em implementação (Lote A5, sem commit
  em 2026-10-05): `FEED`, `SEARCH`, `BRAND_PROFILE` e `CREATOR_PROFILE` (públicos) e `LOOK_EDITOR` (pessoal).
* **Resposta**: `{context, generatedAt, algorithmVersion, source: local|ia, items[≤ 5]}`; cada insight tem `code`
  estável (ex.: `REGION_LEADER`, `CATEGORY_RISING`, `POPULAR_NOT_GROWING`, `CAPSULE_IDLE_REDISCOVERY`,
  `PIECE_HYPE_AND_STYLE`), `tone`, `title`, `text` com o número, `metric`, `action` (CTA) e `basis` (HYPE_V2,
  WARDROBE_USAGE, STYLE_DNA…). Lista vazia = "ainda sem dados suficientes".
* **Regras**: tudo determinístico a partir dos dados (`PublicInsights`, `PersonalInsights`); `withAi=true` só reescreve
  o texto pelo `AiEngine` (INSIGHT_GENERATOR), e a reescrita é descartada se os números mudarem (`InsightMath.numbers`).
  Hype citado num contexto pessoal vem sempre com compatibilidade ou uso ao lado; tendência ≠ popularidade
  (`TREND_VS_POPULARITY`); redescoberta antes de compra; sem pay-to-win.
