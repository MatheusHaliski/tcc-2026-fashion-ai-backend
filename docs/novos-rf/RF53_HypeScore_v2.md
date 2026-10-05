# RF53 — HypeScore v2: Hype analítico de peças e looks (verso dos cards, Histórico, Em alta, Guarda-roupa e Copilot)

**Numeração.** Esta implementação foi originalmente identificada como RF49 (cartão
[YP4B9hfa](https://trello.com/c/YP4B9hfa)). Como a documentação atual também usa RF49–RF52 para outros requisitos,
ela aparece aqui como **RF53**; confirme a numeração final no Trello. O RF48 permanece reservado às propostas de
resgate e doações de FAI Points ([RF48_FAI_Points_Resgate_e_Doacoes.md](RF48_FAI_Points_Resgate_e_Doacoes.md)).
Este documento registra **o que foi implementado**. A arquitetura completa está em
[`docs/hype/HYPESCORE_ARCHITECTURE.md`](../hype/HYPESCORE_ARCHITECTURE.md), e a auditoria com a proposta de navegação
que motivou a entrega, em [`docs/hype/01-AUDITORIA_E_PROPOSTA_IA.md`](../hype/01-AUDITORIA_E_PROPOSTA_IA.md).
A auditoria de abas que levou o v2 a todas as telas (lotes 1–9) está em
[`docs/hype/HYPE_AUDITORIA_ABAS.md`](../hype/HYPE_AUDITORIA_ABAS.md), e o teste real de ponta a ponta, em
[`docs/hype/EVIDENCIAS_E2E.md`](../hype/EVIDENCIAS_E2E.md).

> **HypeScore = f(entidade, comportamento, contexto, tempo).** O Hype não responde "esta peça é boa?". Responde "qual
> é a relevância atual desta peça ou deste look no FashionAI, e como ela está mudando?". Ele fica sempre separado da
> **compatibilidade pessoal** com o DNA de estilo.

---

## 1. Entrega

### 1.1 Base (primeira entrega)

| Área | O que mudou |
|---|---|
| **Cálculo** | 9 dimensões de 0 a 100: popularidade, engajamento (normalizado pelo alcance), tendência, velocidade da tendência, novidade, longevidade, raridade, originalidade e, só em looks, influência. Pesos centralizados (`HypeScoreConfig`), decaimento temporal (meia-vida de 7 dias), níveis LOW_SIGNAL…VIRAL sempre com texto, seta ↑↓→ pela direção calculada, momentum (emergente, subindo, estável, esfriando, clássico) e motivos explicáveis |
| **Sinais** | eventos de domínio (curtir, comentar, salvar, favoritar, compartilhar, remixar, visualizar, vestir, peça em look, look do dia) → agregado diário com antimanipulação |
| **Snapshots** | job a cada 6 h (e manual pelo admin) grava o estado atual e o histórico diário, sempre com `algorithm_version = HYPE_V2` |
| **Cards** | `FashionCard`: frente visual e social com Hype compacto; verso "Hype analytics" pelo botão ↻ (teclado, foco, `inert`, movimento reduzido); "Ver análise completa" abre um drawer com gráfico, dimensões, explicação e "Hype × seu estilo" |
| **Navegação** | domínios Guarda-roupa, Looks, Descobrir, Perfil e Jogar; "aba muda o contexto, filtro restringe os dados"; o Lookbook perdeu a aba de cupons (`?tab=cupons` redireciona para `/coupons`), ganhou **Insights** e os Salvos viraram um segmento (looks / peças) |
| **Histórico** | página `/history` com as abas Linha do tempo, Estilo, Uso, **Hype** (subidas, quedas, redescobertas, looks emergentes e novas tendências) e Insights |
| **Guarda-roupa** | ordenar por maior/menor Hype, maior crescimento, mais/menos usada, mais rara e mais tempo sem uso; filtro por nível mínimo. Corrigiu um bug: a tela enviava `mais_usadas`/`nome`/`preco`, que o backend ignorava (os nomes antigos continuam aceitos como alias) |
| **Descobrir** | aba **Em alta** no Explorador: ranking com Hoje / 7 / 30 dias e recortes por categoria, estilo e ocasião, só com conteúdo público; Marcas e Criadores em alta (agregados com ≥ 3 itens públicos) |
| **Copilot** | responde perguntas sobre Hype sem recomendar só o que está em alta; modos **Seguro / Descoberta / Experimental**; seções Recomendações, Descoberta, Experimentar, Redescoberta e Insights |

### 1.2 Evolução (2026-10-05)

| Área | O que mudou | Commit |
|---|---|---|
| **Hype ao vivo** | `HypeLiveRecalc`: criar, editar ou excluir peça, salvar look, qualquer sinal, uso, look do dia e mudança de disponibilidade só **marcam** o Hype como sujo; uma verificação a cada 30 s recalcula tudo de uma vez, no máximo a cada 120 s (`fashionai.hype.live-recalc-seconds`). `recalculate()` é `synchronized`: o job de 6 h e o recálculo ao vivo nunca se sobrepõem | `8e527e85` |
| **Recortes regionais** | V39: `hype_scores` ganha `country`, `region` (tabela `WorldRegions`, pelo país do dono), `categories` e `subcategories` (no look, as das peças dele) | `8e527e85` |
| **Ranking de HypeScore** | Explorador › Ranking: peças ou looks por região do mundo, país, categoria e subcategoria, janelas 1 / 7 / 30 dias. O look entra pelas categorias das peças e mostra o Hype de cada peça. Barra "Hype por região" com o Hype médio de cada região | `6f6c5c34`, `07262131` |
| **Verso do card** | `HypeBackArt`: fundo por faixa (3 estrelas no sinal baixo → 36 no viral, posições determinísticas pelo id, brilho a partir de Em alta, gradiente dourado e halo no viral). CSS puro; pausa fora do verso, para com movimento reduzido e some em alto contraste e `forced-colors` | `7cf7d285` |
| **Análise completa** | drawer conectado: peso de cada dimensão, sinais reais por tipo (janela atual × anterior × horizonte, em `signals_json.byType`), em quantos looks a peça aparece, peças do look com o Hype de cada uma, posição no ranking público e progresso dos Selos de Hype | `7cf7d285`, `6f6c5c34`, `53812185` |
| **Insights dinâmicos** | `GET /api/insights?context=`: 6 contextos públicos (Explorador) e 6 pessoais (Cápsula, Copilot, Autopiloto, Histórico, Guarda-roupa, Looks). `InsightStrip` em cada aba com análise. Os insights são determinísticos, e a IA só reescreve o texto, sem mudar números | `9c8aacbe`, `6f1f7a5f` |
| **Copilot e Autopiloto** | `LookScorer` compartilhado: seis números por look (compatibilidade, Hype, novidade, reutilização, uso, sustentabilidade) e os três modos também no Autopiloto. Experimentar (Copilot) e Semana (Autopiloto) com os seis números | `9c8aacbe`, `e51690a1` |
| **Selos × HypeScore** | critério de Hype na política padronizada (`policy.hype` e `rule.hypeMin`); sugestões de selo com o Hype da entidade e ordenadas por ele; **Hype do selo** (média dos vínculos aprovados); **Selos de Hype FashionAI** derivados (VIRAL, TRENDING, EMERGING, CLASSIC, RARE); filtro `seal=` no guarda-roupa; `GET /api/pieces/seals`. **Selo nunca alimenta o Hype** | `53812185`, `8c483759` |
| **Perfil de marca/celebridade** | `InstitutionalService`: só looks com vínculo APPROVED vigente aparecem em destaque, ordenados pelo HypeScore v2. Recusa por teto de emissões fica gravada (`SealUnavailable` + `noRollbackFor`). Detalhes no [RF50](RF50_Criador_de_Selos.md#exibição-no-perfil-do-emissor-rf14rf22--política-revisada-em-2026-10-05) | `c5bcadd2`, `53812185` |
| **Globo do Painel global** | `GET /api/hype/globe`: Hype público por país (médio, máximo, crescimento, faixas, criadores, cor dominante e item de destaque). Camadas números, colunas 3D, bonecos, cards e calor; métricas Hype médio, máximo, volume e crescimento; visão em tabela, tema escuro, alto contraste e movimento reduzido | `28228340` |
| **Auditoria de abas, lotes 1–9** | v2 no feed, busca, Passarela 3D, vitrines e marcas (1); Meus looks com ordenação e prévia `POST /api/schemes/scores` no editor (2); anatomia Hype Focus (3); Lookbook, DNA, Look do dia e capa da FAI Magazine (4); notificação `HYPE_MILESTONE` + V41 (5); números no Copilot e no Autopiloto (6); painéis do emissor e do admin (7); FLAIR sem preço como poder (8); card de privacidade nas Configurações e Hype pessoal na exportação LGPD (9) | `42e76c98`, `bce04fc5`, `e51690a1`, `7fe78f1a`, `fb099a83` |
| **Correção de ids gerados** | `AiInferenceLog`, `ProcessingJobLog` e `MetricSnapshot` recebiam id à mão apesar do `@GeneratedValue`. No Hibernate 6.6, o `save()` virava merge e falhava ("Row was already updated or deleted"), e a transação de quem chamou a IA ficava rollback-only: `GET /api/schemes/{id}/seal-suggestions` respondia 500. Achado no teste real com MySQL | `94c48f3a`, `e51690a1` |
| **Convivência com o v1 (RF6)** | o `HypeScoreService` v1 ainda escreve as colunas `hype_score` das entidades. Depois dos lotes 1–9, o painel do Look do Dia exibe o v2 (`v2` no payload), e feed, busca, Passarela 3D, vitrines, DNA, FLAIR e painéis leem o v2. Ainda mostram números v1 as telas Marcas & lojas e Insights globais do Explorador e o painel lateral do país no globo (`avg_hype` por estação): o backend já envia o v2, e a troca na tela é o Lote A3. A limpeza final do v1 (P3-16) continua pendente | — |

## 2. Servidor

**Banco** (Flyway):

| Migração | Conteúdo |
|---|---|
| `V31__hype_score_v2.sql` | `hype_signal_daily` (sinais por entidade, tipo e dia), `hype_scores` (estado atual por versão do algoritmo) e `hype_score_snapshots` (um por entidade, versão e dia), com backfill |
| `V39__hype_regiao_e_subcategorias.sql` | `hype_scores.country`, `region`, `categories`, `subcategories` + índice `(entity_type, algorithm_version, public_eligible, region)` |
| `V41__hype_milestones.sql` | `hype_milestones`: marcos já alcançados, únicos por (entidade, marco), com `digest_date` e `notification_id` (resumo diário) |

A V40 é do FashionAI Lens ([RF54](RF54_FashionAI_Lens.md)).

**API do Hype** (`HypeController`, `LookbookController` para o método):

| Método | Rota | Regra |
|---|---|---|
| GET | `/api/hype/summaries?type=&ids=` | lote de até 100 ids para os cards; item que quem vê não pode ver fica fora da resposta; cada item traz `seals` (Selos de Hype) |
| GET | `/api/hype/pieces/{id}` · `/api/hype/looks/{id}` | detalhe: dimensões, motivos, sinais (`byType`), pesos, `sealProgress`, `inLooks` (peça) ou `pieces` (look) e compatibilidade com o DNA (separada) |
| GET | `/api/hype/pieces/{id}/history` · `/api/hype/looks/{id}/history` | série diária (`days`, padrão 90) |
| GET | `/api/hype/pieces/{id}/positions` · `/api/hype/looks/{id}/positions` | posição no ranking público: mundo, categoria e subcategoria (peça), região e país; fora da população pública = `eligible: false`; quem não pode ver = 404 |
| GET | `/api/hype/trending` | `type` (PIECE, LOOK, BRAND, CREATOR), `window` (1/7/30), `category`, `style`, `occasion`, `limit`; só `public_eligible`; cache por geração |
| GET | `/api/hype/ranking` | `type`, `window`, `region`, `country`, `category`, `subcategory`, `page`, `size` (≤ 48); só `public_eligible` e AVAILABLE; numeração independente de quem vê |
| GET | `/api/hype/ranking/facets` | contagens de regiões (com Hype médio), países, categorias e subcategorias do recorte |
| GET | `/api/hype/globe` | `type`, `window`, `category`, `subcategory`, `minLevel` (400 fora da escala); agregado por país, `sufficient` = ≥ 3 itens; o `top` respeita a visibilidade de quem vê |
| GET | `/api/me/hype/wardrobe` (alias `/api/hype/me/wardrobe`) | destaques do próprio guarda-roupa |
| GET | `/api/me/hype/movers` | subidas e quedas pela direção calculada, redescobertas, looks emergentes e novas tendências |
| POST | `/api/admin/hype/snapshots` | recálculo manual (admin) |
| GET | `/api/hype/method` | método v1 + configuração ativa do v2 |

**Rotas de outros controllers que usam o v2:**

| Método | Rota | Regra |
|---|---|---|
| GET | `/api/insights?context=&window=&region=&category=&subcategory=&withAi=` | `EXPLORER_*` sem login; `CAPSULE`, `COPILOT`, `AUTOPILOT`, `HISTORY`, `CLOSET` e `LOOKS` exigem login (401) |
| GET | `/api/me/closet?sort=&hypeLevel=&seal=hype\|brand\|any` | ordenações, faixa mínima e filtro "Com selo" |
| GET | `/api/me/schemes?sort=recent\|hype_desc\|hype_asc\|growth&hypeLevel=` | Meus looks pelo Hype pessoal do dono |
| POST | `/api/schemes/scores` | prévia do editor: os seis números das peças escolhidas; nada é gravado e nenhum sinal é emitido |
| GET | `/api/pieces/seals?ids=` | selos APPROVED de tier PEÇA que cobrem cada peça (até 60 ids; visibilidade de sempre) |
| GET | `/api/schemes/{id}/seal-suggestions` · POST `/api/seal-suggestions/preview[-piece]` | sugestões com `hype {score, level}`, ordenadas por Hype |
| GET | `/api/feed` · `/api/search` · `/api/public-pieces` com `hypeLevel` | faixa mínima do Hype público v2 |

**Em implementação (Lote A1; no working tree em 2026-10-05, ainda sem commit):** `GET /api/hype/groups?type=BRAND|CREATOR&keys=&window=`
devolve o Hype agregado de várias marcas (chave = nome normalizado) ou pessoas (chave = id) numa requisição, para os
chips da busca, do perfil e de /brands: faixa, valor, itens públicos, `sufficient` (≥ 3) e posição, só com conteúdo
público. A rota legada de mesmo caminho (agrupamentos por similaridade, v1) passa para `/api/similarity-groups/global`
(deprecada). Até o commit, vale a versão do último commit (rota legada).

**Privacidade:** item privado de outra pessoa → 404 / fora do lote; ranking, globo, insights públicos e estatísticas
só leem a população pública elegível (item público, perfil não privado, moderação aprovada, conta não-teste).
**Antimanipulação** (`HypeIntegrityPolicy`): interação do próprio dono não conta (o uso conta); 1 sinal por pessoa,
entidade, tipo e dia; conta com menos de 7 dias pesa 0,5; visitante sem conta não conta; patrocínio nunca entra.
Selos, prévia do editor, marcos, Lens e votação de desafio **nunca** escrevem em `hype_signal_daily`.

## 3. Critérios de aceite

| CA | Regra | Situação |
|---|---|---|
| RF53.CA01 | card de peça e de look com frente (Hype compacto) e verso "Hype analytics"; só o botão ↻ vira, um card por vez, sem virar ao tocar na foto ou no curtir | pronto (`components/fashion-card.tsx`, `piece-card.tsx`, `scheme-card.tsx`) |
| RF53.CA02 | o giro funciona por teclado e toque, move o foco e respeita `prefers-reduced-motion` | pronto |
| RF53.CA03 | estados CARREGANDO, HYPE NÃO CALCULADO, DADOS INSUFICIENTES, HYPE DISPONÍVEL, HYPE DESATUALIZADO e ERRO; "sem dado" nunca aparece como 0 | pronto (`lib/hype/model.ts`, `HypeStateNotice`) |
| RF53.CA04 | HypeScore com 9 dimensões normalizadas, pesos centralizados e decaimento temporal | pronto (`HypeCalculator`, `HypeScoreConfig`) |
| RF53.CA05 | nível sempre com texto e seta ↑/↓/→ pela direção calculada (−1,9 pts dentro da faixa estável é "estável") | pronto |
| RF53.CA06 | snapshots diários com `algorithmVersion` e histórico no drawer | pronto |
| RF53.CA07 | explicação humana dos motivos ("apresenta forte crescimento de salvamentos"), nunca juízo de qualidade | pronto (`lib/hype/explain.ts`) |
| RF53.CA08 | tendência ≠ popularidade e Hype ≠ compatibilidade com o DNA, sempre exibidos separados | pronto |
| RF53.CA09 | guarda-roupa ordena por Hype, crescimento, uso, raridade e tempo sem uso, e filtra por nível mínimo | pronto |
| RF53.CA10 | Histórico › Hype e Lookbook › Insights mostram subidas, quedas, redescobertas e destaques do próprio guarda-roupa | pronto |
| RF53.CA11 | Explorador › Em alta com Hoje / 7 / 30 dias e recortes por categoria, estilo e ocasião | pronto |
| RF53.CA12 | Copilot responde perguntas sobre Hype, nunca recomenda só pelo Hype e oferece os modos Seguro, Descoberta e Experimental | pronto |
| RF53.CA13 | item privado nunca entra em ranking nem em estatística pública, e terceiros não leem o Hype dele | pronto |
| RF53.CA14 | sinais filtrados contra autointeração, repetição, conta nova e visitante; patrocínio nunca pesa | pronto (extensões previstas: reputação, cadência de bots, grafo de contas, IP/dispositivo) |
| RF53.CA15 | navegação por domínios sem remover funcionalidades: rotas antigas continuam por alias ou redirecionamento | pronto |
| RF53.CA16 | peça criada (ou look salvo, sinal, uso, look do dia, disponibilidade) tem Hype recalculado em até ~2 min, sem esperar o job de 6 h; uma rajada de eventos gera um recálculo só; job e recálculo ao vivo nunca rodam juntos; o GET continua sem recalcular | pronto (`HypeLiveRecalc`, `HypeLiveRecalcTest`) |
| RF53.CA17 | Explorador › Ranking filtra por região do mundo, país, categoria e subcategoria, em peças e looks; um look entra no recorte "Calçados" se tiver um calçado e mostra o Hype de cada peça; janela 1 = trend, 7 = score, 30 = média do mês; sem país = "Outras regiões" | pronto (`HypeQueryService.ranking`, `hype-ranking.tsx`) |
| RF53.CA18 | a numeração do ranking é pública e igual para todos; item bloqueado ou que deixou de ser visível só some da página; item privado, não aprovado ou sem dados nunca entra | pronto (`HypeRegionalRankingTest`) |
| RF53.CA19 | a análise completa mostra a posição do item no mundo, na categoria, na subcategoria, na região e no país; item fora da população pública responde `eligible: false` e quem não pode ver recebe 404 | pronto (`positions`) |
| RF53.CA20 | a análise completa mostra o peso de cada dimensão, os sinais reais por tipo (atual × anterior × horizonte), em quantos looks a peça aparece e as peças do look com o Hype de cada uma | pronto (`HypeAnalyticsDrawer`) |
| RF53.CA21 | o verso do card muda de arte conforme a faixa (3 estrelas no sinal baixo → 36 no viral); a animação pausa fora do verso, para com movimento reduzido e some em alto contraste e `forced-colors` | pronto (`HypeBackArt`, `hype-card.test.tsx`) |
| RF53.CA22 | `GET /api/insights` devolve de 0 a 5 insights do contexto; contexto público funciona sem login e só com agregados públicos; contexto pessoal sem login → 401; contexto desconhecido → 400 | pronto (`InsightServiceTest`, `InsightsAccessTest`) |
| RF53.CA23 | todo insight pessoal que cita Hype traz a compatibilidade ou o uso ao lado; `withAi=true` só troca o texto e a troca é descartada se mudar qualquer número | pronto |
| RF53.CA24 | Copilot (Experimentar e looks das respostas do chat) e Autopiloto (Hoje e Semana) mostram os seis números por look; o Hype nunca passa de 20% do peso em nenhum modo; dimensão sem base fica neutra (50) e aparece como "—" | pronto (`RecommendationScoringTest`, `AutopilotScoresTest`) |
| RF53.CA25 | a política de um selo aceita critério de Hype (`minLevel`, `minScore`, até 3 `momentum`, `hypeMin` por regra); valor fora da escala → 400 `POLITICA_INVALIDA`; sem Hype disponível o critério não é atendido | pronto (`SealPoliciesHypeTest`) |
| RF53.CA26 | sugestões de selo trazem o Hype da entidade avaliada e vêm ordenadas por ele; a aba Selos mostra o Hype do selo (média dos vínculos aprovados); nenhum selo, vínculo ou emissão gera sinal de Hype | pronto (`SealHypeServiceTest`) |
| RF53.CA27 | Selos de Hype FashionAI são derivados do Hype atual (VIRAL > TRENDING > EMERGING > CLASSIC > RARE), só para item AVAILABLE e público elegível; o card mostra no máximo 2 e o detalhe mostra todos com o critério do que falta | pronto (`HypeSeals`, `HypeSealsTest`) |
| RF53.CA28 | o guarda-roupa filtra "Com selo" (Hype, Marca, Qualquer); `GET /api/pieces/seals` devolve só selos APPROVED que cobrem a peça; peça privada não tem selo de Hype | pronto (`ClosetSealFilterTest`) |
| RF53.CA29 | no perfil de marca/celebridade só aparece look de outra pessoa com vínculo APPROVED vigente, ordenado pelo Hype v2; aceite com teto atingido grava `REJECTED` + `RECUSADO_LIMITE` e responde 409 `SELO_INDISPONIVEL` | pronto (`InstitutionalDisplayPolicyTest`, `SealPromotionFlowTest`; regras no RF50) |
| RF53.CA30 | `GET /api/hype/globe` agrega por país só itens públicos elegíveis; país com menos de 3 itens fica apagado e sem card; item sem país entra só no total do mundo; o destaque respeita bloqueio e visibilidade de quem vê | pronto (`HypeGlobeTest`, `globe-hype.test.tsx`) |
| RF53.CA31 | o globo desenha as camadas números, colunas, bonecos, cards e calor, e tem visão em tabela com os mesmos números; card do país abre a análise completa | pronto |
| RF53.CA32 | feed e busca vazia usam o Hype público v2 (sem dado = neutro); a Passarela 3D ordena pelo v2 e "Em alta" é crescimento, não curtidas; `hypeLevel` filtra feed, busca e peças públicas; o Hype da marca não usa mais média com peças privadas nem vira estrelas | pronto (`SearchHypeV2Test`, `ShowcaseHypeV2Test`, `ExplorerBrandsHypeV2Test`) |
| RF53.CA33 | Meus looks ordena por Hype e crescimento e filtra por faixa; o editor mostra o Hype de cada peça e a prévia com os seis números (nada gravado, nenhum sinal); a anatomia Hype Focus não mostra "%" nem 0 para "sem dados" | pronto (`LookPreviewServiceTest`, `SchemeFiltersTest`, `looks.test.tsx`) |
| RF53.CA34 | o painel do Look do Dia mostra o v2; a capa da FAI Magazine é liberada pela faixa v2 ≥ Tendência; DNA HYPE_FOCUS em v2; agrupamentos do Lookbook se chamam "similaridade" | pronto (`DnaHypeFocusV2Test`, `LookbookPublicationsTest`) |
| RF53.CA35 | o dono recebe `HYPE_MILESTONE` só quando a peça ou o look **sobe** pela 1ª vez para Em alta, Tendência ou Viral, ou passa a ser Emergente; nunca na queda; no máximo um resumo por dia; ninguém além do dono é avisado; o tipo pode ser desativado | pronto (`HypeMilestoneTest`) |
| RF53.CA36 | dashboard do emissor mostra o Hype dos looks vinculados; o admin vê a distribuição das seis faixas v2, a cobertura e o estado do job; no FLAIR o stat HYPE vem do v2 público (neutro 50), a raridade vem da dimensão de raridade e o preço não dá poder | pronto (`DashboardHypeV2Test`, `FlairEngineTest`, `FlairLooksTest`) |
| RF53.CA37 | Configurações › Privacidade explica o que entra no Hype público; a exportação LGPD inclui os snapshots de Hype pessoal e os marcos | pronto (`HypePersonalDataTest`) |
| RF53.CA38 | chamada de IA registrada (`ai_inference_log`) nunca derruba a transação de quem chamou: `GET /api/schemes/{id}/seal-suggestions` responde 200 com MySQL real | pronto (`94c48f3a`; conferido no E2E) |

## 4. Testes

Contagem de `@Test` por classe (backend, JUnit) e de `it(...)` por arquivo (frontend, Vitest).

| Área | Backend | Frontend |
|---|---|---|
| Núcleo | `HypeCalculatorTest` 19, `RecommendationScoringTest` 9, `HypeScoreConfigTest` 5, `HypeIntegrityPolicyTest` 4, `HypeSnapshotRulesTest` 4, `HypeQueryPrivacyTest` 3, `StyleCompatibilityTest` 3, `HypeSignalSeriesTest` 2, `CopilotHypeIntentTest` 2 | `hype-card.test.tsx` 27, `lib/hype/model.test.ts` 9 |
| Ao vivo, ranking, globo | `HypeLiveRecalcTest` 6, `HypeRegionalRankingTest` 11, `HypeGlobeTest` 8, `HypeRankGroupsTest` 3 | `hype-ranking.test.tsx` 13, `globe-hype.test.tsx` 20, `hype-trending.test.tsx` 2 |
| Insights, Copilot, Autopiloto | `InsightServiceTest` 13, `AutopilotScoresTest` 4, `CopilotAnswerTest` 5, `InsightsAccessTest` 3 (fai-web) | `insight-strip.test.tsx` 9, `insights-wiring.test.tsx` 3, `copilot-autopilot-scores.test.tsx` 3 |
| Selos × Hype e perfil do emissor | `HypeSealsTest` 7, `HypeSealsQueryTest` 3, `SealPoliciesHypeTest` 9, `SealHypeServiceTest` 7, `ClosetSealFilterTest` 2, `SealPromotionFlowTest` 11, `InstitutionalDisplayPolicyTest` 17 | `hype-seals.test.tsx` 13, `seal-policy-editor.test.tsx` 8 |
| Lotes 1–9 da auditoria | `SearchHypeV2Test` 8, `ShowcaseHypeV2Test` 7, `ExplorerBrandsHypeV2Test` 6, `LookPreviewServiceTest` 7, `SchemeFiltersTest` 9, `DnaHypeFocusV2Test` 4, `LookbookPublicationsTest` 4, `HypeMilestoneTest` 12, `DashboardHypeV2Test` 6, `FlairEngineTest` 10, `FlairLooksTest` 14, `HypePersonalDataTest` 4 | `feed-hype.test.tsx` 3, `runway-hype.test.tsx` 4, `looks.test.tsx` 16, `scheme-anatomies.test.tsx` 6, `lookbook-hype.test.tsx` 8, `hype-dashboards.test.tsx` 9, `flair-hype.test.tsx` 4, `hype-personal-details.test.tsx` 6 |
| **Total** | **251** em 36 classes | **163** em 18 arquivos |

Teste de ponta a ponta com MySQL 8.4 e o backend local: o primeiro (V31) cobriu sinais, autocurtida ignorada, salvar →
desfazer → salvar contado uma vez, peso de conta nova, job, resumos, 404 de privado, histórico, Em alta, insights,
subidas/quedas, ordenações do guarda-roupa e intenções de Hype do Copilot. O segundo (2026-10-05, V1–V40, 6 pessoas em
5 países, 24/24 verificações de selos por política aceita, telas do ranking, do globo, do verso, da análise completa,
dos selos e do Lens) está em [`docs/hype/EVIDENCIAS_E2E.md`](../hype/EVIDENCIAS_E2E.md).

## 5. Diagramas

`docs/diagramas/RF53/` (fonte `.puml` e `.png` lado a lado):

| Tipo | Arquivos |
|---|---|
| Atividades | `RF53_Atividades` (sinal → sujo/ao vivo ou job → snapshot com recortes → marcos → card, verso e análise) · `RF53_Atividades_Selos` (política com Hype → sugestão → aceite → emissão → perfil; Selos de Hype derivados) |
| Sequência | `RF53_Sequencia` (sinal, recálculo ao vivo, job com marcos, leitura no card e na análise) · `RF53_Sequencia_Explorador` (ranking, facetas, posições, globo e insights) · `RF53_Sequencia_Selos` (sugestão com Hype, aceite com teto, Hype do selo, selos das peças) |
| Componentes | `RF53_Componentes` (núcleo do Hype) · `RF53_Componentes_Integracoes` (Insights, Copilot/Autopiloto, Selos, perfil do emissor, Looks, painéis, FLAIR, notificações, LGPD) |
| Máquina de estados | `RF53_MaquinaDeEstados_Hype` (estado do Hype, com "sujo" e Selos de Hype) · `RF53_MaquinaDeEstados_Marco` (marcos de Hype e resumo diário) |
| Classes | `RF53_Classes` (entidades, recortes da V39, marcos da V41, núcleo) · `RF53_Classes_Integracoes` (Insights, Selos × Hype, prévia e scores) |

Os diagramas dos RF afetados na primeira entrega continuam valendo: RF6 (Lookbook), RF10 (Copilot), RF19 (interações →
sinais), RF26 (Em alta), RF31 (ordenações e filtro de Hype), RF42 (look do dia → LOOK_WORN), além dos globais
`fashionai-classes-v4` e `fashionai-componentes-v4`. O Lens tem os próprios em `docs/diagramas/RF54/`.

## 6. Limites conhecidos e próximos passos

- **Lotes adiados da auditoria** (`HYPE_AUDITORIA_ABAS.md` §4): A1 (`/api/hype/groups` para chips de criador e marca),
  A2 (Hype no cabeçalho e nas métricas do emissor, ordem "Em alta" em /brands), A3 (telas Marcas & lojas e Insights
  globais do Explorador consumindo o v2), A4 (Lookbook › Peças com Hype para visitante), A5 (InsightStrip em feed,
  busca, perfis e editor) e a limpeza final do v1 (P3-16). Na data desta revisão, A1, A4 e A5 estavam em implementação
  (sem commit; o andamento fica em `HYPE_AUDITORIA_ABAS.md` §5) e não entram nos critérios e testes acima.
- O v1 ainda escreve `hype_score`/`hype_score_global` e devolve esses campos nas views (deprecados).
- A normalização por percentil precisa de população pública ≥ 5; abaixo disso usa curva absoluta (ambiente de TCC).
- O job, o ranking, as facetas e o globo carregam a população pública inteira de uma vez (volume do TCC); em escala,
  paginar o job e gravar agregados por região/país.
- Linhas de `hype_scores` anteriores à V39 ficam sem país e região até o próximo recálculo.
- Marcas em alta agrupam pelo nome normalizado; "Levi's" × "Levis" só se unem quando a peça aponta para o catálogo.
- Extensões antimanipulação listadas no CA14 estão como ponto de extensão, não implementadas.
- O E2E de 2026-10-05 rodou até a V40; a notificação de marco (V41) só tem testes de unidade.

🔗 **Dependência:** RF5, RF6 (v1), RF8, RF10, RF13 (DNA), RF14/RF22 (perfil do emissor), RF19, RF26, RF31, RF42, RF50
(selos), RF54 (Lens: lê o Hype, nunca escreve).
