# Auditoria de abas: onde aplicar o HypeScore v2

> Pedido: "Revise toda e qualquer aba onde pode ser aplicado o hype score".
> Auditoria só de leitura (nenhum arquivo do repositório foi alterado). Base: `docs/hype/HYPESCORE_ARCHITECTURE.md`,
> `lib/hype/*`, `components/hype/*`, `components/insights/*`, cards (`piece-card.tsx`, `scheme-card.tsx`, `fashion-card.tsx`),
> navegação (`components/app-shell.tsx`), as 52 páginas de `app/` e os controllers e serviços de `fai-*`.
> Os contratos `seals-hype-api.md`, `globe-hype-api.md`, `lens-api.md` e `insights-api.md` estão sendo implementados agora
> e contam como **cobertos**.

## 0. Resumo

**Regras usadas em cada proposta** (da arquitetura):

- A **aba muda o contexto** e o **filtro restringe os dados**: Hype entra como ordenação ou filtro ("Em alta" = faixa mínima), nunca como aba nova.
- **Hype ≠ DNA.** Onde aparece um, a compatibilidade pessoal fica ao lado e separada do outro.
- **Tendência ≠ popularidade.** TREND e momento são diferentes de volume ou curtidas.
- **Sem pay-to-win.** Patrocínio, cupom, ponto e promoção nunca alimentam o Hype nem são vendidos com ele.
- **Privacidade.** Item privado ou só para seguidores tem apenas Hype *pessoal* (visível ao dono). Em contexto de terceiros, ordenar ou agregar usa só `publicEligible`.
- **"Sem dados" nunca vira 0.** A interface mostra "Dados insuficientes" ou "—", e na ordenação a dimensão sem base fica neutra (50) ou por último.
- **A faixa sempre aparece com rótulo em texto.**
- **Explicação descritiva, nunca juízo de qualidade.**

**Números da auditoria**

| | Quantidade |
|---|---|
| Páginas em `app/` | 52 (41 do app, 5 de autenticação, gate, home, 404 e 3 do lab) |
| Abas e subabas avaliadas | 88 linhas na tabela §1 (algumas agrupam várias abas: Lens = 6, autenticação = 5 páginas, abas da marca etc.) |
| Linhas já com v2 completo (✓) | 11 (fora os cards v2 que aparecem em quase todas as outras linhas) |
| Linhas cobertas pelos contratos em andamento | 4 (mapa/globo, Selos da marca, Lens com 6 abas, globo do admin a coordenar) |
| **Propostas P1** (valor claro, risco baixo) | **10** |
| **Propostas P2** | **20** |
| **Propostas P3** | **17** |
| Linhas **N/A** (o Hype não deve ser aplicado) | 26 |
| Usos do **v1 legado** encontrados | 19 no backend (1 resolvido durante a auditoria: L10) + 13 arquivos de frontend (§2) |

**Achados que mais pesam**

1. **Inconsistências visíveis entre v1 e v2 na mesma tela.** A anatomia "Hype Focus" do card mostra um medidor v1 ao lado do badge v2. Os cards de Eras e Coleções aparecem ordenados por "Maior Hype Score" calculado no v1, mas exibem o badge v2. A tabela da Passarela 3D mostra números v1 e a faixa de Insights logo acima é v2.
2. **Privacidade no v1.** `vw_brand_usage.avg_hype` (V6__dashboard_analytics.sql:28-36) tira a média de *todas* as peças, privadas inclusive. Essa média é usada como fallback do Hype da marca em Explorador › Buscar marcas & lojas, que é uma tela pública e anônima (ExplorerService.java:194-207). Os agregados v1 do MysqlAnalyticsAdapter filtram só `visibility='PUBLIC'` e ignoram perfil privado e contas de teste.
3. **Juízos de qualidade feitos a partir do Hype.** As faixas v1 "Muito estiloso", "Arrasando no look" e "Ícone de estilo" (ExplorerService.java:64-74, MysqlAnalyticsAdapter.java:98-118, look-exports.tsx), as "estrelas" da marca derivadas do Hype (ExplorerService.java:207) e "Qualidade média do HypeScore" no FLAIR (FlairLooks.java:748) contrariam a regra da explicação descritiva.
4. **"Em alta" calculado como popularidade.** A Passarela usa `EM_ALTA = curtidas + 2·salvos` (ShowcaseService.java:454-455), e isso contraria a regra tendência ≠ popularidade.
5. **Lacunas de valor alto e risco baixo.** Meus looks não tem ordenação nem filtro por Hype, embora o guarda-roupa tenha. O editor de look não mostra o Hype das peças escolhidas nem uma prévia (o `LookScorer` já calcula os seis números a partir das peças). Não existe notificação de marco de Hype.

---

## 1. Tabela resumo: página › aba

Legenda da coluna *Hype hoje*: **v2** = HypeScore v2 (summaries/badge/verso/drawer); **v1** = `hypeScore` legado (`HypeScoreService`, colunas `hype_score`, `avg_hype`); **—** = nada.
Os IDs das propostas (P1-xx, P2-xx, P3-xx) são detalhados em §1.1.

### 1.A Descobrir

| Página › Aba | Entidades | Hype hoje | Lacuna | Proposta | Backend | Prioridade |
|---|---|---|---|---|---|---|
| Feed › Feed | looks (SchemeCard) | v2 no card: badge + verso (scheme-card.tsx:186,233,305-309; feed/page.tsx:38). **Ordem de "relevância" usa v1** (SearchService.java:223-231: `0,3·Scheme.hypeScore`) | A ordem do feed segue o v1 e o badge mostra o v2. Não há "Em alta" | **P1-01** relevância com v2 (`publicEligible`; sem base = neutro 0,5). **P2-01** chip/filtro "Em alta" (faixa mínima) | SearchService (repositório `HypeScoreCurrentRepository` + config), DiscoveryController `hypeLevel` | P1 / P2 |
| Feed › Passarela (seguindo) | looks de quem sigo | v2 no card | Nenhuma: ordem cronológica por definição | Não reordenar por Hype. *Observação lateral*: `/api/runway` devolve `{reason, scheme, …}` e feed/page.tsx:38 passa o item inteiro para `SchemeCard`. Provável bug, conferir | — | N/A (ordem) |
| Busca › Looks | looks | v2 no card (search/page.tsx:139) | Sem filtro "Em alta". A busca vazia ("Em alta na comunidade", search/page.tsx:135) vem do **v1** (SearchService.java:492-496) | **P1-02** busca vazia com v2 (trending 7 d, só públicos). **P2-01** `hypeLevelFilter()` no FilterBar | SearchService, DiscoveryController | P1 / P2 |
| Busca › Peças | peças públicas | v2 no card (search/page.tsx:140) | Sem "Em alta" | **P2-01** (mesmo filtro em `/api/search?tab=PECAS` e `/api/public-pieces`) | SearchService | P2 |
| Busca › Pessoas | usuários | — (search/page.tsx:141) | Sem Hype de criador | **P2-02** chip "Criador em alta" (agregado CREATOR; aparece só com ≥ 3 itens públicos; ausente = nada; nunca ordena a busca por Hype) | **Novo** `GET /api/hype/groups?type=CREATOR&keys=` (HypeQueryService/HypeController, ambos em edição, **adiado**) | P2 |
| Busca › Marcas | marcas (perfil e catálogo) | — (search/page.tsx:142-146) | Sem Hype de marca | **P2-03** chip agregado BRAND (chave = nome normalizado) | Mesmo endpoint novo `type=BRAND` (**adiado**) | P2 |
| Busca › Celebridades | perfis de celebridade | — | Sem Hype de criador | **P2-02** (CREATOR) | Idem (**adiado**) | P2 |
| Explorador › Passarela 3D | looks do dia (desfile + tabela Top 100) | **v1**: ranking, tabela e LookCard (runway-panel.tsx:19,113,131; ShowcaseService.java:148-149,450-458,480,533). InsightStrip EXPLORER_RUNWAY é v2 (explorer/page.tsx:49) | Números v1 sob Insights v2. "Em alta" = curtidas + 2·salvos (popularidade) | **P1-03** Top 100 pelo score v2 do look; "Em alta" = TREND v2 / momento RISING-EMERGING; tabela e LookCard com `HypeBadge` (summary no payload + `primeHype`) e "Ver análise completa" | ShowcaseService.runway: `hype` (summary) por linha, só `publicEligible` | P1 |
| Explorador › Em alta | peças, looks, marcas, criadores | **v2 ✓** (hype-trending.tsx) | Valor do grupo sem rótulo de faixa (hype-trending.tsx:83). A marca leva para a busca, não para o perfil oficial (:72) | **P3-01** `level` no item de grupo + rótulo; link `/brands/{slug}` quando houver perfil | `rankGroups` (HypeQueryService, **adiado**) | P3 |
| Explorador › Ranking | peças, looks (região, país, categoria) | **v2 ✓** (hype-ranking.tsx:83,122) | — | — | — | ✓ |
| Explorador › Painel global (mapa) | países | v1 (explorer/page.tsx:23,37,59,70,83; globe.tsx:21,78) | — | **Coberto** por `globe-hype-api.md` (agente em andamento) | `/api/hype/globe` | coberto |
| Explorador › Buscar marcas & lojas | marcas (perfil e catálogo) | **v1**: `hypeScore`, `stars`, `hypeMin`, `sort=HYPE` (explorer/page.tsx:20,38,100-101,109-110; ExplorerService.java:194-211,249-250). Fallback `vw_brand_usage.avg_hype` **inclui peças privadas** | Número v1, "0" quando não há dado (explorer/page.tsx:109), estrelas derivadas do Hype (juízo), vazamento de agregado privado | **P1-04** campo aditivo `hype: {value, level, items, basis}` (v2: agregado BRAND público ≥ 3 itens; marca com selo = média v2 dos looks vinculados, como no contrato de selos); `minLevel` no lugar de `hypeMin`; estrelas desligadas do Hype; parar de usar `avg_hype` da view | ExplorerService.brandsAndStores, DiscoveryController. **Front adiado** (explorer/page.tsx em edição) | P1 |
| Explorador › Insights globais | rankings (estação, cor, marca, país) | **v1** (explorer/page.tsx:22,24,119-125; ExplorerService.java:271-280; MysqlAnalyticsAdapter.java:80-97,215-229; LocalAdvisors.java:51-66) + InsightStrip EXPLORER_GLOBAL v2 (:118) | Dois "Hype" diferentes na mesma aba | **P2-04** rankings v2: categorias, cores e marcas pela média v2 pública (≥ 3 itens), crescimento (TREND) separado de popularidade; texto local sobre o v2 | ExplorerService.insights lendo `hype_scores` (`publicEligible`). **Front adiado** | P2 |
| Marcas (/brands) › Marcas | perfis de marca | — (brands/page.tsx:17-34; ordens AFINIDADE/RECENTES) | Sem ordem nem chip de Hype | **P2-05** ordem "Em alta" (BRAND) + chip | InstitutionalService.brandFeed (**em edição**) + endpoint de grupos (**adiado**) | P2 |
| Marcas › Celebridades | perfis de celebridade | — | idem | **P2-05** (CREATOR) | InstitutionalService.celebrityFeed (**adiado**) | P2 |

### 1.B Perfil de marca e celebridade (`/brands/[slug]`, abas em brands/[slug]/page.tsx:66-67; linhas do commit `8c483759`)

| Página › Aba | Entidades | Hype hoje | Lacuna | Proposta | Backend | Prioridade |
|---|---|---|---|---|---|---|
| Cabeçalho | marca/celebridade | — (brands/[slug]/page.tsx:85-92) | Sem Hype agregado | **P2-06** chip "Hype da marca" (BRAND; celebridade = CREATOR) com link para Explorador › Em alta | Endpoint de grupos (**adiado**). A página está em edição (aba Selos) | P2 |
| Coleções / Eras › Busca | looks + peças | Cards v2, mas a **ordenação "Maior Hype Score" usa v1** (showcase-tabs.tsx:76,100; ShowcaseService.java:665-701) | A ordem v1 não bate com o badge v2 | **P1-05** ordenar pelo score v2 (sem Hype = por último) + opção "Em crescimento" (Δ/TREND) | ShowcaseService.order | P1 |
| Coleções / Eras › Insights | eras/coleções | **v1** `topHype`, `mostHype`, peso 0,35 (ShowcaseService.java:69,706-761; showcase-tabs.tsx:211,223,337) | Hype v1 misturado com curtidas | **P2-07** maior v2 e média v2 com faixa; curtidas exibidas à parte (popularidade ≠ Hype) | ShowcaseService | P2 |
| Eras › My Stage 3D | look da celebridade | **v1** (ShowcaseService.java:771: "look de maior Hype Score") | — | **P2-07** escolher pelo v2 | ShowcaseService | P2 |
| Esquemas em destaque · Peças em destaque · Looks consagrados · Catálogo | looks / peças | Cards v2. **Durante esta auditoria** o commit `c5bcadd2` passou a ordenar os destaques pelo HypeScore v2 (sem score = no fim) e trocou o filtro `DESTAQUES` para v2 (InstitutionalService.java:335,403-416,454-467) | A interface não tem controle de ordenação nem "Em crescimento" | **P3-17** (era P2-08) SegmentPicker "Recentes · Hype · Em crescimento" (ordenação, não aba); `filter=GROWTH` | InstitutionalService (adiado, Lote A2) | P3 |
| Selos | selos | v2 (contrato de selos; `SealHypeStat` já entrou no commit `8c483759`) | — | **Coberto** por `seals-hype-api.md` | — | coberto |
| Promoções | promoções | — | — | Não exibir nem usar Hype: promoção e cupom não podem parecer compra de relevância | — | N/A |
| FLAIR (combinações) | combinações patrocinadas | — | — | Comercial e patrocínio ficam fora do Hype | — | N/A |
| Meus cupons promocionais | cupons | — | — | Sem pay-to-win | — | N/A |
| Guarda-roupa 3D | componentes 3D (loja) | — | — | Loja de móveis/peças 3D: não é entidade de Hype | — | N/A |
| Central do emissor | verificação | — | — | Fluxo administrativo | — | N/A |
| Esquemas salvos · Peças salvas (dono) | looks / peças | v2 nos cards (:102-103) | — | — | — | ✓ |
| Revisão de vínculos | vínculos pendentes | — (:145-153) | — | Não exibir: a revisão julga conformidade com a política e o Hype enviesaria (o critério de Hype, quando existe, vem no "atende:" do contrato de selos) | — | N/A |
| Métricas | métricas do emissor | — (:154-159) | Sem Hype dos looks vinculados | **P2-09** "Hype médio v2 dos looks vinculados" + Δ7d + top 3 | SealService.issuerMetrics (**em edição**, adiado). Alternativa no Dashboard (P2-19) | P2 |

### 1.C Perfil pessoal e Lookbook (`/u/[username]`, `/lookbook` → lookbook-tabs.tsx:53-57)

| Página › Aba | Entidades | Hype hoje | Lacuna | Proposta | Backend | Prioridade |
|---|---|---|---|---|---|---|
| Perfil › Cabeçalho | pessoa | — (u/[username]/page.tsx:32-46) | Sem "criador em alta" | **P2-10** chip CREATOR (≥ 3 itens públicos; bloqueio respeitado; sem dado = nada) | Endpoint de grupos (**adiado**) | P2 |
| Lookbook › Peças | peças do perfil | v2 no card (lookbook-tabs.tsx:88) | Sem ordenar nem filtrar por Hype (o /closet tem) | **P2-11** Dropdown Recentes/Hype/Em crescimento + `hypeLevelFilter()`; para visitante, só scores `publicEligible` (o resto "—", por último) | `/api/users/{id}/closet` já aceita `sort` (WardrobeController.java:103-117), mas sem guarda de privacidade nem `hypeLevel`. WardrobeService **em edição**, adiado | P2 |
| Lookbook › Looks | looks publicados | v2 no card (:117) | Sem ordenação | **P3-02** ordenar por Hype | ProfileService `/api/profiles/{id}` | P3 |
| Lookbook › Publicações | looks + peças | v2 no card (:135-137) | — | Cronológico por definição | — | N/A (ordem) |
| Lookbook › Favoritos | looks / peças | v2 no card (:157-158) | — | — | — | ✓ |
| Lookbook › Salvos | looks / peças salvos | v2 no card (saved-looks.tsx:84; lookbook-tabs.tsx:184) | Sem ordenação | **P3-03** ordenar por Hype (só summaries públicos) | LookbookService saved-* | P3 |
| Lookbook › DNA de estilo | cards DNA | **v1** na narrativa HYPE_FOCUS (dna-card.tsx:21,242-245: `hypeScoreGlobal`, "🔥 N%", `hypeColor`; DnaService.java:768,817-819,1151,1350) | Percentual e escala legada; 0 no lugar de "sem dados" | **P2-12** v2 do dono (score + faixa; "Dados insuficientes"); sem "%" | DnaService.hypeOf → v2 | P2 |
| Lookbook › Look do dia | look do dia + histórico | **v1**: painel (lookbook-tabs.tsx:195,204-213; LookbookService.java:313-320 → HypeScoreService.panel), histórico (:222; DailyLookService.java:146), capa FAI Magazine ≥ 85 "Arrasando no Look" (look-exports.tsx:11,80). InsightStrip HISTORY v2 (:199) | Dois Hype na mesma aba | **P1-06** `HypeInline` v2 do look ao lado do painel + histórico com `HypeBadge` v2. **P2-13** número do painel em v2 (mantém as 6 versões visuais) + capa liberada por faixa v2 ≥ Tendência (texto descritivo) | LookbookService, DailyLookService (P1: só `schemeId` nas linhas do histórico); HypeScoreService.panel (P2) | P1 / P2 |
| Lookbook › Cápsula | peças-base | InsightStrip CAPSULE v2 (:244) | — | Cápsula = versatilidade e uso (Hype ≠ uso) | — | N/A |
| Lookbook › Agrupamentos | agrupamentos + "HypeGroups (IA)" | **v1**: `/api/me/hype-groups*` = clusters de similaridade com nome de Hype (lookbook-tabs.tsx:264-272; LookbookController.java:149-163,217-220) | O nome engana (é similaridade) | **P3-04** renomear para "Agrupamentos sugeridos (similaridade)" + Hype médio v2 do agrupamento na lista | LookbookService/LookbookController (rótulos) | P3 |
| Lookbook › Insights | painel do guarda-roupa | **v2 ✓** (lookbook-tabs.tsx:69) | — | — | — | ✓ |

### 1.D Guarda-roupa

| Página › Aba | Entidades | Hype hoje | Lacuna | Proposta | Backend | Prioridade |
|---|---|---|---|---|---|---|
| Guarda-roupa (/closet) › Todas / Superior / Inferior / Calçados / Acessórios | peças | **v2 ✓**: ordenações, filtro de faixa, InsightStrip CLOSET, cards (closet/page.tsx:74,81,86,101; filtro "Com selo" do contrato de selos já entrou) | — (em edição pelo agente de selos: filtro `seal=`) | — | — | ✓ |
| Peça (/pieces/[id]) | peça | v2 ✓ `HypeInline` (expanded-card.tsx:274) | "Looks com esta peça" sem Hype (:277-285) | **P3-05** `HypeBadge` v2 por look (lote via `useHypeSummary`) | — | P3 |
| Nova peça (/pieces/new) | formulário | — | — | Peça nova não tem sinais; o Hype aparece em cerca de 2 min (HypeLiveRecalc) | — | N/A |
| Quarto (/room) › 3D · 2.5D · Lista | módulos e endereços físicos | — (ilha "Compare looks" em **v1**, RoomService.java:1422, sem UI) | — | Organização física não depende de Hype. **P3-06** só migrar a ilha para v2 quando tiver UI | RoomService | N/A (P3 ilha) |
| Fotos (/photos) › Galeria · Linha do tempo · Insights | fotos pessoais | InsightStrip HISTORY (photos/page.tsx:208) | — | Foto pessoal não é entidade com Hype | — | N/A |
| Provador (/try-on) › Lojas · Guarda-roupa · Salvas | catálogo, peças, provas | — (try-on/page.tsx:256-301) | — | "Lojas" é comercial: destacar por Hype misturaria comércio e relevância. O provador é composição visual | — | N/A |
| Espelho (/mirror) | look do dia em slots | — | Sem leitura do look montado | **P3-07** `LookScores` (compatibilidade · Hype · uso…) do look via `POST /api/schemes/scores` (P1-08) | depende do Lote 2 | P3 |
| Avatar 3D (/avatar) | corpo/avatar | — | — | — | — | N/A |

### 1.E Looks e IA

| Página › Aba | Entidades | Hype hoje | Lacuna | Proposta | Backend | Prioridade |
|---|---|---|---|---|---|---|
| Meus looks (/looks) › Meus looks | looks do dono (inclusive rascunhos) | v2 no card + InsightStrip LOOKS (looks/page.tsx:126) | **Sem ordenar nem filtrar por Hype** (my-looks.tsx:43-50), ao contrário do guarda-roupa | **P1-07** Dropdown "Ordenar: Recentes · Maior Hype · Menor Hype · Em crescimento" + `hypeLevelFilter()` (Hype pessoal do dono) | SchemeService.mine (`sort`, `hypeLevel`) + SchemeController. **Sem** injetar HypeQueryService (ciclo HypeQueryService → SchemeService): usar `HypeScoreCurrentRepository` + `HypeScoreConfig`, como no WardrobeService | P1 |
| Meus looks › Salvos | looks de outros | v2 no card | Sem ordenação | **P3-03** | LookbookService | P3 |
| Criar/Editar look › Peças | peças do dono (seleção) | **—**: `PieceCard` em modo seleção desliga o Hype (piece-card.tsx:56-57; scheme-builder.tsx:253). Slots sem Hype (:244-250) | Não se vê o Hype das peças escolhidas nem uma prévia do look. Só as sugestões de selo já mostram o Hype do look (`SealSuggestionHype`, contrato de selos) | **P1-08** `HypeBadge` v2 em cada slot escolhido + "Prévia do look" no aside: `LookScores` (compatibilidade DNA · Hype médio das peças · novidade · reutilização · uso · sustentabilidade), com o aviso "o Hype do look nasce dos sinais do próprio look; aqui é a média das peças" | **Novo** `POST /api/schemes/scores {pieceIds}` → `LookScorer.scoreLooks` (já existe, LookScorer.java:113-117). Nada é gravado e nenhum sinal é emitido | P1 |
| Criar look › Modo (IA) | composições sugeridas | — (scheme-builder.tsx:234). A IA recebe o **v1** (SchemeService.java:225) | Sem números nas sugestões | **P2-14** composições com `scores` + `LookScores` no `AiCompositionCard`; IA recebe v2 | SchemeService.compose + LookPreviewService | P2 |
| Criar look › Revisão (PNG) | prévia PNG | **v1** (SchemeService.java:1018 → SchemeCardRenderer) | — | **P2-15** score v2 + rótulo da faixa (omitir sem dados) | SchemeService, SchemeCardRenderer | P2 |
| Editar look (/schemes/[id]/edit) | look existente | — | O look já tem Hype e não aparece | **P3-08** `HypeInline` no topo | — | P3 |
| Look (/schemes/[id]) | look ampliado | v2 ✓ badge + "Ver análise completa" (scheme-card.tsx:235,301) | **A anatomia HYPE_FOCUS da frente do card é v1** (scheme-anatomies.tsx:112,158,374-400,456-463: `hypeScore`/`hypeScoreGlobal`, "%", paleta "crítica") | **P1-09** HypeFocus com v2 das peças (`useHypeSummary`, faixa em texto, "Dados insuficientes", sem "%", sem vermelho). Vale para todos os cards com essa anatomia | — (summaries) | P1 |
| Copilot › Recomendações · Descoberta · Redescoberta · Insights | looks, peças | **v2 ✓** (copilot/page.tsx:136-147; CopilotService.java:317-322) | — | — | — | ✓ |
| Copilot › Experimentar | novas combinações | — (copilot/page.tsx:126-133) | Sem os números de `LookScores` | **P2-16** `scores` nas `newCombinations` + `LookScores` no card | CopilotService (`scorer.scoreLooks`) | P2 |
| Copilot › Chat | respostas, looks | v2 ✓ (`LookScores`, intenção HYPE; :179) | — | — | — | ✓ |
| Autopiloto › Hoje | sugestões | v2 ✓ (`LookScores`, InsightStrip AUTOPILOT; autopilot/page.tsx:42,52) | — | — | — | ✓ |
| Autopiloto › Semana | plano semanal | — | Sem números por dia | **P3-09** `scores` por dia | AutopilotService (week) | P3 |
| DNA (/dna) · Novo DNA · Editar DNA | looks do dono (seleção) | v2 no SchemeCard compacto (dna-builder.tsx:187) | — | Hype ≠ DNA: não usar Hype como critério do DNA (a narrativa HYPE_FOCUS entra em P2-12) | — | N/A |
| DNA (/dna-schemes/[id]) | card DNA ampliado | v1 na narrativa HYPE_FOCUS | — | **P2-12** | DnaService | P2 |
| Lens (/lens, /lens/[scanId]) › Leitura · Guarda-roupa · Recriar · Estilo & Hype · Descobrir · Captura | scans | v2 (contrato) | — | **Coberto** por `lens-api.md` | — | coberto |

### 1.F Histórico

| Página › Aba | Entidades | Hype hoje | Lacuna | Proposta | Backend | Prioridade |
|---|---|---|---|---|---|---|
| Histórico › Timeline | looks do dia | v2 ✓ (history-timeline.tsx:18,24) | — | — | — | ✓ |
| Histórico › Evolução do estilo | DNA | — | — | Hype ≠ DNA | — | N/A |
| Histórico › Uso de peças | peças (mais usadas, menos usadas, paradas) | — (history-usage.tsx:12-37) | — | **P3-10** `HypeBadge` nas "paradas" + link para a Redescoberta | — | P3 |
| Histórico › Hype | séries, subiram/caíram, emergentes | v2 ✓ (history-hype.tsx:27) | — | — | — | ✓ |
| Histórico › Insights da IA | insights + painel | v2 ✓ (history-insights.tsx:14,22) | — | — | — | ✓ |

### 1.G Jogar

| Página › Aba | Entidades | Hype hoje | Lacuna | Proposta | Backend | Prioridade |
|---|---|---|---|---|---|---|
| Desafios › Catálogo · Meus desafios · Propor | desafios | — | — | Desafios premiam uso e variedade. Com Hype virariam concurso de popularidade | — | N/A |
| Desafios › Votação + /challenges/[id] (entradas) | looks votados | — | — | Não exibir Hype ao lado do voto (enviesa). Conferir que voto de desafio não vira sinal de Hype | — | N/A |
| FLAIR › Modos de jogo · Duelos e equipes | looks (stats), liga | **v1**: stat HYPE = "força-base" com peso 1,5 (FlairLooks.java:226,254; FlairModesService.java:241; modes-shared.tsx:8-9,34); "Qualidade média do HypeScore" (FlairLooks.java:748). A coluna "Hype" da liga é soma de pontos de rodada (modes.tsx:117,133-134; FlairModesService.java:565-683), só homônima | Juízo de qualidade e nome que confunde | **P2-17** stat HYPE ← v2 (INSUFFICIENT = 50 neutro, peso ≤ demais stats); "qualidade" → "relevância média (HypeScore)"; a coluna da liga vira "Pontos de estilo". A Passarela em modos (modes.tsx:63) herda P1-03 | FlairModesService, FlairLooks | P2 |
| FLAIR › Cartas e álbum · Decks | cartas (peças), decks | **v1**: raridade "RARE se hype ≥ 80 ou preço ≥ R$ 1.500"; HYPE_BOOST (FlairEngine.java:27,120-121,138; flair/page.tsx:218) | Raridade de carta ≠ raridade v2; preço como poder | **P2-18** raridade a partir da dimensão RARITY v2 (frequência do modelo) + faixa v2; tirar o preço do poder (evita pay-to-win) | FlairService.input, FlairEngine | P2 |
| FLAIR › Combinações das lojas · Carteira · Quests | cupons, vouchers, missões | — | — | Comercial: cupom nunca se liga ao Hype | — | N/A |
| FAI Points (/points) | saldo, extrato | — | — | Sem pay-to-win: ponto não compra nem deriva de Hype | — | N/A |
| Destaques (/highlights) | Inventory Score, recordes, conquistas | InsightStrip CLOSET (:72) | — | Inventory ≠ Hype (N/A para o score; conquistas de Hype também N/A, por incentivarem manipulação). **P3-11** card "Maior crescimento de Hype do mês" em "Destaques do mês" (de `/api/me/hype/wardrobe`) | — | N/A (P3) |
| Cupons (/coupons) | cupons resgatados | — | — | Sem pay-to-win | — | N/A |

### 1.H Conta, sistema e administração

| Página › Aba | Entidades | Hype hoje | Lacuna | Proposta | Backend | Prioridade |
|---|---|---|---|---|---|---|
| Notificações › Caixa de entrada | notificações | — (NotificationType.java não tem tipo de Hype) | O dono não sabe quando a peça ou o look entrou em alta | **P1-10** `HYPE_MILESTONE` (categoria ACHIEVEMENT, desativável): peça ou look do dono **sobe** pela 1ª vez para Em alta/Tendência/Viral ou vira EMERGING. **Nunca** notifica queda (ETI-02). Um resumo por dia; o link abre o detalhe | HypeSnapshotService (detecção ao gravar o nível, :333-341), DomainEvents, NotificationType, listener novo, tabela de dedupe (migração) | P1 |
| Notificações › Preferências | tipos | — | — | O novo tipo aparece sozinho (enum com opt-out) | idem | P1 (P1-10) |
| Configurações › Conta · Aparência · Sessões | — | — | — | — | — | N/A |
| Configurações › Privacidade | visibilidade, consentimentos | — (settings/page.tsx:97-109) | A pessoa não sabe como o Hype usa os dados dela | **P2-19** card "HypeScore e privacidade" (o que entra no público; privado e seguidores = Hype só pessoal; perfil privado fora dos rankings; patrocínio nunca entra) + link do método. **P3-12** opção de não aparecer em "Criadores em alta" | P3: campo de preferência + `publicEligible` | P2 / P3 |
| Configurações › Dados | exportação LGPD | — | — | **P3-13** incluir o Hype pessoal (snapshots do dono) na exportação | AccountService (exportação LGPD, `/api/me/exports` em MeController) | P3 |
| Dashboard do emissor (/dashboard) | selos, vínculos, resgates | — (dashboard/page.tsx:20-31) | Sem leitura de relevância dos looks vinculados | **P2-20** bloco "Hype dos looks vinculados" (média v2 + Δ7d + top 3; só públicos) | DashboardService.issuerDashboard | P2 |
| Admin › Dashboard › Conteúdo | widget `hype_bands` | **v1** com rótulos de juízo (admin/dashboard/page.tsx:32,134; DashboardService.java:107; MysqlAnalyticsAdapter.java:98-118) | Faixas v1 e de juízo | **P2-21** distribuição por faixa v2 (peças e looks) + cobertura (AVAILABLE, INSUFFICIENT, NOT_CALCULATED) + versão e último job | DashboardService, MysqlAnalyticsAdapter (só **acrescentar** consultas) | P2 |
| Admin › Dashboard › Usuários (globo) | países | **v1** `avg_hype` (admin/dashboard/page.tsx:122) | — | Coordenar com o agente do globo (manter `GlobePoint.avg_hype` ou ajustar esta linha) | — | coberto (coordenar) |
| Admin › Dashboard › Visão geral · Engajamento · IA · Sistema | métricas | — | — | — | — | N/A |
| Admin › Sistema | jobs | job "hype" roda v1 + v2 (system/page.tsx:26; AdminService.java:252) | Sem estado do v2 | **P3-14** última execução v2, recálculo ao vivo, cobertura | AdminService | P3 |
| Admin › Usuários · Moderação | contas, fila | — | — | A moderação nunca considera Hype | — | N/A |
| Login · Cadastro · Esqueci a senha · Redefinir · Verificar e-mail · Gate · Lab (3) · 404 · Home (redirect) | — | — | — | — | — | N/A |

**Transversais P3:** **P3-15** novos contextos da InsightStrip (FEED, SEARCH, BRAND_PROFILE, CREATOR_PROFILE, LOOK_EDITOR, ISSUER), que dependem do pacote Insights hoje em edição. **P3-16** limpeza final do v1 (ver §2).

### 1.1 Detalhe das propostas

**P1 (10)**
- **P1-01 Feed: relevância com v2.** `SearchService.relevance`: trocar `s.getHypeScore()` pelo score v2 do look, usado **só se `publicEligible`**. Sem Hype = 0,5 (neutro), para não punir conteúdo novo. O backend busca o estado em lote com `findByEntityTypeAndEntityIdInAndAlgorithmVersion` antes do sort (uma consulta por página).
- **P1-02 Busca vazia "Em alta na comunidade" com v2.** `SearchService.trending()` passa a ordenar por v2 (janela 7, população pública), igual ao `/api/hype/trending?type=LOOK&window=7`.
- **P1-03 Passarela 3D com v2.** `ShowcaseService.runway`:
  - `TOP100_*` ordenado pelo score v2;
  - `EM_ALTA` = TREND v2 (crescimento) ou momento RISING/EMERGING, não curtidas;
  - cada linha e cada look ganham `hype: HypeSummary` (via `summaries`, que respeita visibilidade); `hypeScore` v1 fica deprecado.

  No front, runway-panel.tsx e o Look3d mostram `HypeBadge`, e o LookCard ganha "Ver análise completa".
- **P1-04 Explorador › Marcas & lojas, backend v2 aditivo.**
  - `hype {value, level, items, basis: BRAND_GROUP | BONDED_LOOKS}`;
  - `minLevel`;
  - `sort=HYPE` passa a usar v2;
  - remover o fallback `vw_brand_usage.avg_hype` (agregado com peças privadas);
  - `stars` deixa de depender do Hype.

  O front (explorer/page.tsx) fica no Lote A3.
- **P1-05 Eras e Coleções: ordenação v2.** `ShowcaseService.order(...)`: `HYPE` = score v2 com nulos por último. Nova opção `GROWTH` (deltaPoints ou TREND).
- **P1-06 Look do dia com v2 visível.** `HypeInline` do look de hoje, mais `HypeBadge` em cada linha do histórico (a linha precisa de `schemeId`). O painel v1 continua, rotulado "Painel do Look do Dia (v1)", até P2-13.
- **P1-07 Meus looks: ordenar e filtrar por Hype.** `/api/me/schemes?sort=hype_desc|hype_asc|growth&hypeLevel=HOT`, com nulos por último e o mesmo arredondamento de faixa do guarda-roupa (`min - 0,5`). Front: `lookHypeSortOptions()` (subconjunto sem "usos"/"parada") + `hypeLevelFilter()`.
- **P1-08 Editor de look: Hype das peças + prévia.** Badges v2 nos slots (Hype pessoal do dono). `POST /api/schemes/scores` devolve os seis números de `RecommendationScoring` (o Hype nunca passa de 20% em nenhum modo e nunca vira "nota do look"). Novo componente `components/hype/look-hype-preview.tsx` reutiliza `LookScores`.
- **P1-09 Anatomia Hype Focus em v2.** `scheme-anatomies.tsx`:
  - `HypeFocus`/`CompactSignature` leem `useHypeSummary("PIECE", id)` (lote; sem requisição extra quando o cache já foi preenchido por `primeHype`);
  - medidor `HypeScoreGauge` sem "%";
  - legenda com as 6 faixas v2 (`hype.level.*`), sem paleta "critical";
  - manter a exportação `hypeStatus` (usada em cards.test.tsx:36) ou ajustar o teste.
- **P1-10 Notificação de marco de Hype.**
  - Em `HypeSnapshotService`, comparar o `existing.getLevel()` anterior com o novo `r.level()` e publicar `DomainEvents.HypeMilestone(type, id, ownerId, level, momentum)` só quando houver **subida** para HOT, TRENDING ou VIRAL, ou quando surgir EMERGING;
  - dedupe por (entidade, nível) numa tabela nova para não oscilar na borda (o recálculo ao vivo roda a cada 120 s);
  - listener AFTER_COMMIT agrupa em 1 notificação por dono por dia;
  - categoria ACHIEVEMENT, `optOutAllowed=true`;
  - nunca notifica queda; item privado notifica só o dono (é Hype pessoal).

**P2 (20)**
- P2-01: filtro "Em alta" (`hypeLevel`) em feed, busca e peças públicas (só `publicEligible`).
- P2-02 e P2-03: chips de criador e de marca na busca.
- P2-04: Insights globais em v2.
- P2-05: ordem "Em alta" em /brands.
- P2-06: Hype agregado no cabeçalho da marca.
- P2-07: Insights de Eras e Coleções e My Stage em v2.
- P2-08: rebaixada para P3-17 (o backend passou a ordenar por v2 durante a auditoria).
- P2-09: métricas de Hype do emissor no perfil.
- P2-10: Hype de criador no perfil pessoal.
- P2-11: ordenar e filtrar Lookbook › Peças, com guarda de privacidade.
- P2-12: DNA HYPE_FOCUS em v2.
- P2-13: painel do Look do Dia e capa FAI Magazine em v2.
- P2-14: composições da IA com `scores`, e a IA passa a receber v2.
- P2-15: PNG do card em v2.
- P2-16: Copilot › Experimentar com `scores`.
- P2-17: FLAIR stat HYPE em v2, com renomeações.
- P2-18: raridade do FLAIR em v2, sem preço.
- P2-19: Configurações › Privacidade explicando o Hype.
- P2-20: Dashboard do emissor com Hype.
- P2-21: widget de faixas do admin em v2.

**P3 (17)**
- P3-01: rótulo de faixa e link de marca no Em alta.
- P3-02: Lookbook › Looks com ordenação.
- P3-03: Salvos com ordenação.
- P3-04: renomear HypeGroups + Hype médio.
- P3-05: badges em "Looks com esta peça".
- P3-06: ilha "Compare looks" em v2.
- P3-07: Espelho com `LookScores`.
- P3-08: `HypeInline` no editar look.
- P3-09: Autopiloto › Semana com `scores`.
- P3-10: Uso de peças com badges.
- P3-11: card de crescimento em Destaques.
- P3-12: opt-out de "Criadores em alta".
- P3-13: exportação LGPD do Hype pessoal.
- P3-14: estado do v2 em Admin › Sistema.
- P3-15: novos contextos da InsightStrip.
- P3-16: limpeza final do v1.
- P3-17: controle de ordenação e "Em crescimento" nas abas de destaque da marca (ex-P2-08).

---

## 2. Legado v1

O RF6 diz que o v1 "continua dono das colunas `hype_score`/`hype_score_global`, do painel do Look do Dia, do Explorador e do FLAIR", e o §15 da arquitetura manda migrar. Abaixo, cada consumidor e a recomendação.

### 2.1 Backend

| # | Onde | O que usa | Tela afetada | Recomendação |
|---|---|---|---|---|
| L1 | `HypeScoreService` (v1: `0,65·E_norm + 0,35·T_norm`) | escreve `wardrobe_items.hype_score`, `schemes.hype_score(_global)`, `metric_snapshots`, `hype_score_metrics`; `panel()`; `cluster()`; `recalibrate()`; `describe()` | Look do Dia, HypeGroups, `/api/hype/method`, admin | **Manter só como compatibilidade** até P2-13. Depois parar de escrever as colunas (P3-16). `/api/admin/hype/recalibration` (AdminController.java:141-144) e o v1 do job "hype" (AdminService.java:252) saem junto |
| L2 | `LookbookService` daily-look-tab (LookbookService.java:313-320), `HypeScorePanelVersion` | painel v1 | Lookbook › Look do dia | **Migrar** o número para v2 (P2-13), mantendo as 6 versões visuais |
| L3 | `/api/me/hype-groups*`, `/api/hype/groups` (LookbookController.java:149-163,217-220; LookbookService.java:398-445) | clusters de similaridade com nome "Hype" | Lookbook › Agrupamentos | **Renomear** (não é Hype). Hype médio v2 opcional (P3-04) |
| L4 | `ExplorerService.globalPanel` + `HYPE_BANDS` v1 (ExplorerService.java:64-147) + `MysqlAnalyticsAdapter.schemesByCountry/piecesByCountry/hypeBySeason/colorRanking` | `avg_hype`, faixas de juízo | Explorador › Painel global | **Coberto** pelo `/api/hype/globe`. Depois, deprecar a parte de Hype de `/api/explorer/global` |
| L5 | `ExplorerService.brandsAndStores` (:194-211,249-250) + `vw_brand_usage.avg_hype` (V6) | média v1 dos looks vinculados; fallback com **peças privadas**; `stars` | Explorador › Marcas & lojas | **Migrar já** (P1-04, aditivo); remover o fallback da view |
| L6 | `ExplorerService.insights` (:271-280) + `MysqlAnalyticsAdapter.hypeByColor/hypeByBrand/hypeBySeason` (:80-97,215-229) + `LocalAdvisors` (:51-66) | rankings v1 | Explorador › Insights globais | **Migrar** (P2-04), calculando sobre `hype_scores` `publicEligible` |
| L7 | `DashboardService` `hype_bands` (:38,107) + `MysqlAnalyticsAdapter.hypeBands` (:98-118) + `vw_country_insights.avg_hype` | faixas v1 | Admin › Conteúdo/Usuários | **Migrar** (P2-21). O globo do admin acompanha o agente do globo |
| L8 | `SearchService.relevance` (:223-231) e `trending` (:492-496) | `Scheme.hypeScore` | Feed, busca vazia | **Migrar já** (P1-01, P1-02) |
| L9 | `ShowcaseService` runway (:148-149,450-458,480,533), `order` (:665-701), insights (:69,706-761), My Stage e capa (:617,771) | `getHypeScore()` | Passarela 3D, Eras/Coleções, My Stage | **Migrar já** (P1-03, P1-05, P2-07) |
| L10 | `InstitutionalService` destaques e filtro `DESTAQUES` | era v1 | Abas de destaque da marca | **Resolvido** no commit `c5bcadd2` (v2: InstitutionalService.java:335,403-416,454-467). Falta só a interface (P3-17) |
| L11 | `DnaService.hypeOf` (:768,817-819,926,1151,1350) | `hypeScoreGlobal` → `hypeScore` | DNA HYPE_FOCUS, contexto da IA | **Migrar** (P2-12) para o v2 do dono |
| L12 | `FlairService.input` (:161) / `FlairEngine` (:27,120-121,138) | hype → raridade, HYPE_BOOST | FLAIR cartas e decks | **Migrar** (P2-18) |
| L13 | `FlairModesService.look` (:241) / `FlairLooks` (:226,254,748) | stat HYPE, "qualidade média" | FLAIR modos e duelos | **Migrar** e renomear (P2-17) |
| L14 | `DailyLookService.view` (:146) | `hypeScore` | Look do dia (histórico), `/api/me/daily-looks` | **Migrar** (P1-06 / P2-13) |
| L15 | `RoomService` ilha (:1422) | `hypeScore` | sem UI | P3-06 |
| L16 | `SchemeService` catálogo da IA no editor (:225) e PNG do card (:1018 → `SchemeCardRenderer`) | `hypeScore` | Criar look, PNG | **Migrar** (P2-14, P2-15) |
| L17 | `ProjectionService` (:69,98) | `hypeScore` no documento de busca | motor de busca | P3-16: trocar pelo v2 (`publicEligible`) ou remover |
| L18 | `Views.PieceView/SchemeView` `hypeScore`, `hypeScoreGlobal` (Views.java:53-54,101,134,152,193,220) | campos v1 em toda resposta | frontend (anatomias, painel) | **Deprecar** quando P1-09/P2-13 saírem e remover em P3-16 |
| L19 | `AnalyticsQueryPort` (métodos v1) | — | — | Lotes 1 e 7 só **acrescentam**; remoção em P3-16 |

### 2.2 Frontend

| Arquivo:linha | Uso v1 | Proposta |
|---|---|---|
| `components/scheme-anatomies.tsx:112,158,374-400,456-463` | `piece.hypeScore/hypeScoreGlobal`, "%", paleta crítica | P1-09 |
| `components/showcase/runway-panel.tsx:19,113,131`; `components/three/common.tsx:17`; `components/three/runway-scene.tsx:12` | `hypeScore` da Passarela | P1-03 |
| `components/showcase/showcase-tabs.tsx:30-31,76,100,211,223,337` | `topHype`, `mostHype`, sort HYPE | P1-05 / P2-07 |
| `components/lookbook-tabs.tsx:195,208-212,222` (daily), `:264-272` (hype-groups) | painel, histórico, HypeGroups | P1-06 / P2-13 / P3-04 |
| `components/look-exports.tsx:11,30,68,80,87` | capa ≥ 85 v1, "HYPE N" no PNG | P2-13 |
| `components/dna-card.tsx:21,242-245` | `hypeScoreGlobal`, "%", `hypeColor` | P2-12 |
| `components/flair/modes-shared.tsx:8-9`, `modes.tsx:50,117,133-134`, `app/(site)/(app)/flair/page.tsx:218` | stat HYPE, coluna "Hype" da liga, texto de raridade | P2-17 / P2-18 |
| `app/(site)/(app)/explorer/page.tsx:19-24,37-38,59,70,83,100-101,109-110,119-125` | mapa, marcas, insights | mapa coberto; marcas e insights no Lote A3 |
| `components/globe.tsx:21,78` | `avg_hype` | coberto (agente do globo) |
| `app/(site)/(app)/admin/dashboard/page.tsx:19,122,134` | `hypeBands`, `avg_hype` do globo | P2-21 + coordenação com o globo |
| `lib/api/types.ts:28,46` | `hypeScore`, `hypeScoreGlobal` | P3-16 |
| `lib/hype/model.ts:62` (`hypeColor`, "escala legada") | dna-card e painel | Deprecar depois de P2-12/P2-13 |
| `lib/i18n/messages/*.json` `explorer.despretensioso_0_14`…`icone_de_estilo_96` | rótulos das faixas v1 | P3-16 |

---

## 3. Riscos e regras de implementação (transversais)

1. **Privacidade em ordenação de terceiros.** `HypeQueryService.currentOf` devolve o estado mesmo de item não público. Em feed, busca, Passarela, vitrines e perfil de terceiros, use o score **só se `publicEligible`**; senão "—" e posição neutra ou final. O próprio dono pode ver o Hype pessoal (Meus looks, editor, guarda-roupa).
2. **Ciclo de dependência.** `HypeQueryService` injeta `SchemeService` (views), então `SchemeService` **não pode** injetar `HypeQueryService`. Ordenações no SchemeService usam `HypeScoreCurrentRepository` + `HypeScoreConfig`, como o WardrobeService (WardrobeService.java:128-157,1445-1452). O endpoint de prévia (`LookScorer` precisa de `HypeQueryService`) fica num serviço **novo** (`LookPreviewService`).
3. **GET nunca recalcula.** Todas as propostas leem `hype_scores` (estado do job). Nenhuma tela nova emite sinal de Hype: prévia do editor, Lens, notificações e votações de desafio ficam de fora de `hype_signal_daily`.
4. **Sem pay-to-win e sem juízo.** Remover estrelas derivadas do Hype, "qualidade média do HypeScore", faixas v1 "Muito estiloso / Arrasando / Ícone" e o preço como poder no FLAIR.
5. **Faixa sempre com texto, e nunca 0 para "sem dados"** (explorer/page.tsx:109 hoje mostra `?? 0`; scheme-anatomies e dna-card usam `?? 0`).
6. **Arquivos compartilhados.** `lib/i18n/messages/{pt-BR,en,es}.json`, `fai-application/src/main/resources/i18n/messages*.properties` e `app/(site)/globals.css` **estão sendo editados agora** (`git status`) e serão tocados por quase todos os lotes. Regra: cada lote só **acrescenta** chaves no próprio namespace (ex.: `hypeLooks.*`, `hypeBuilder.*`, `hypeRunway.*`, `notifications.hype.*`), sem reformatar nem reordenar. Os merges entram em sequência. CSS novo vai num bloco comentado por lote no fim de `globals.css`, ou se usam só utilitários existentes.
7. **Migração Flyway** (P1-10): usar o próximo número livre **no momento do merge**. Outros agentes (selos, globo, lens) também podem criar migrações.

---

## 4. Lotes de implementação (arquivos disjuntos)

**Arquivos em edição agora**, que nenhum lote abaixo pode tocar:
- pedidos explicitamente: `components/globe.tsx`, `app/(site)/(app)/explorer/page.tsx`, `app/(site)/(app)/closet/page.tsx`, `components/piece-card.tsx`, `components/scheme-card.tsx`, `components/hype/hype-analytics-drawer.tsx`, `components/seal-*.tsx`, `app/(site)/(app)/brands/[slug]/page.tsx`, `lib/hype/types.ts`, `HypeQueryService.java`, `HypeController.java`, `SealService.java`, `SealPolicies.java`, `WardrobeService.java` e os pacotes `application/lens`, `application/insights`, `LensController`, `InsightsController`;
- observados no `git status` durante a auditoria (a lista muda): `WardrobeController.java`, `SealController.java`, `SchemeItemRepository.java`, `SealBondRepository.java`, `components/hype/hype-globe.tsx` (novo), `lib/hype/globe.ts` (novo), `HypeSeals.java` (novo), os testes novos de selos e globo, `app/(site)/globals.css` e os arquivos de i18n (ver §3.6). `InstitutionalService.java`, `components/hype/hype-seals.tsx` e `lib/hype/seals.ts` foram commitados (`8c483759`, `c5bcadd2`), mas continuam reservados aos lotes adiados. **Antes de cada lote, rodar `git status` de novo.**

Os Lotes 1 a 9 podem rodar **em paralelo agora**: nenhum arquivo aparece em dois lotes, e os de i18n e CSS seguem a regra §3.6. Os Lotes A1 a A5 e o Final são **adiados** e sequenciais.

### Lote 1: Descobrir em v2 (feed, busca vazia, Passarela 3D, vitrine de Eras e Coleções, Explorador › Marcas e Insights no backend)
P1-01, P1-02, P1-03, P1-04 (backend), P1-05, P2-01 (backend + chip no feed), P2-04 (backend), P2-07
- `fai-application/src/main/java/br/com/fashionai/application/service/SearchService.java`
- `fai-application/src/main/java/br/com/fashionai/application/service/ShowcaseService.java`
- `fai-application/src/main/java/br/com/fashionai/application/service/ExplorerService.java` (só `brandsAndStores` e `insights`; **não** tocar `globalPanel`; se o agente do globo editar este arquivo, adiar esta parte)
- `fai-application/src/main/java/br/com/fashionai/application/ai/local/LocalAdvisors.java`
- `fai-web/src/main/java/br/com/fashionai/web/controller/DiscoveryController.java` (`hypeLevel` em feed/search/public-pieces; `minLevel` em explorer/brands, mantendo `hypeMin` como deprecado)
- `components/showcase/runway-panel.tsx`, `components/showcase/showcase-tabs.tsx`, `components/three/common.tsx`, `components/three/runway-scene.tsx`
- `app/(site)/(app)/feed/page.tsx` (chip "Em alta" do P2-01; o filtro da busca fica com `search/page.tsx` no Lote A1, dono único)
- Testes novos: `fai-application/src/test/java/br/com/fashionai/application/service/SearchHypeV2Test.java`, `ShowcaseHypeV2Test.java`, `ExplorerBrandsHypeV2Test.java` (inclui a regressão de privacidade: peça privada fora do agregado)
- i18n: `hypeRunway.*`, `showcase.*` (só acréscimos)

### Lote 2: Looks: editor, gestão e prévia
P1-07, P1-08, P2-14, P2-15, P3-03 (salvos), P3-08
- `fai-application/src/main/java/br/com/fashionai/application/service/SchemeService.java` (`mine` com sort/hypeLevel via repositório; catálogo da IA em v2; PNG em v2; `scores` nas composições)
- `fai-application/src/main/java/br/com/fashionai/application/service/LookPreviewService.java` (**novo**; usa `LookScorer` sem alterá-lo)
- `fai-application/src/main/java/br/com/fashionai/application/imaging/SchemeCardRenderer.java`
- `fai-web/src/main/java/br/com/fashionai/web/controller/SchemeController.java` (`sort`, `hypeLevel`, `POST /api/schemes/scores`)
- `components/scheme-builder.tsx`, `components/ai-compositions.tsx`, `components/looks/my-looks.tsx`, `components/looks/saved-looks.tsx`
- `components/hype/hype-filters.ts` (só **acrescentar** `lookHypeSortOptions()`; não mudar `hypeSortOptions`, que o /closet usa)
- `components/hype/look-hype-preview.tsx` (**novo**)
- `app/(site)/(app)/schemes/[id]/edit/page.tsx`
- Testes: `fai-application/src/test/java/br/com/fashionai/application/service/SchemeFiltersTest.java` (ampliar), `LookPreviewServiceTest.java` (novo), `components/looks/looks.test.tsx` (ampliar)
- O backend do sort de salvos (P3-03) fica no **Lote 4**, dono de `LookbookController`/`LookbookService`. O `saved-looks.tsx` deste lote envia `sort`, que é ignorado com segurança até o Lote 4 entrar

### Lote 3: Anatomia Hype Focus em v2
P1-09
- `components/scheme-anatomies.tsx` (só internos; manter as assinaturas exportadas usadas por `scheme-card.tsx`, `piece-card.tsx` e `background-studio.tsx`)
- `components/cards.test.tsx` (ajustar `hypeStatus` se mudar)
- i18n: `anatomy.hype.*`

### Lote 4: Lookbook: Look do dia, DNA e agrupamentos
P1-06, P2-12, P2-13, P3-02, P3-03 (backend), P3-04
- `components/lookbook-tabs.tsx`, `components/look-exports.tsx`, `components/dna-card.tsx`
- `lib/hype/model.ts` (acrescentar `levelForScore`; deprecar `hypeColor` sem remover)
- `fai-application/src/main/java/br/com/fashionai/application/service/LookbookService.java`
- `fai-application/src/main/java/br/com/fashionai/application/service/DailyLookService.java`
- `fai-application/src/main/java/br/com/fashionai/application/service/DnaService.java`
- `fai-application/src/main/java/br/com/fashionai/application/service/HypeScoreService.java` (painel: número v2 por trás das 6 versões, P2-13)
- `fai-web/src/main/java/br/com/fashionai/web/controller/LookbookController.java` (rótulos dos agrupamentos; sort de salvos)
- `fai-application/src/main/java/br/com/fashionai/application/service/ProfileService.java` (sort de Lookbook › Looks, P3-02)
- Testes: `LookbookPublicationsTest.java` (ampliar), `DnaHypeFocusV2Test.java` (novo)

### Lote 5: Notificação de marco de Hype
P1-10
- `fai-domain/src/main/java/br/com/fashionai/domain/model/enums/NotificationType.java` (`HYPE_MILESTONE`)
- `fai-application/src/main/java/br/com/fashionai/application/events/DomainEvents.java` (`HypeMilestone`)
- `fai-application/src/main/java/br/com/fashionai/application/hype/HypeSnapshotService.java` (detecção; **confirmar** que nenhum agente o edita: hoje está limpo no `git status`)
- `fai-application/src/main/java/br/com/fashionai/application/hype/HypeMilestoneNotifier.java` (**novo**)
- `fai-domain/src/main/java/br/com/fashionai/domain/model/HypeMilestone.java` e `fai-domain/src/main/java/br/com/fashionai/domain/repository/HypeMilestoneRepository.java` (**novos**)
- `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V{próximo}__hype_milestones.sql` (**novo**)
- Testes: `fai-application/src/test/java/br/com/fashionai/application/hype/HypeMilestoneTest.java` (só subida, dedupe, nunca queda, privado só ao dono)
- i18n backend: `notification.hype.*`. O frontend (notifications/page.tsx) não muda: o link já cai em PIECE/SCHEME (notifications/page.tsx:21)

### Lote 6: Copilot e Autopiloto: números nas sugestões
P2-16, P3-09
- `fai-application/src/main/java/br/com/fashionai/application/service/CopilotService.java` (não tocar as chamadas a `InsightService`)
- `fai-application/src/main/java/br/com/fashionai/application/service/AutopilotService.java`
- `app/(site)/(app)/copilot/page.tsx`, `app/(site)/(app)/autopilot/page.tsx`
- Testes: `AutopilotScoresTest.java`, `CopilotAnswerTest.java` (ampliar)

### Lote 7: Painéis do emissor e do admin
P2-20, P2-21, P3-14
- `fai-application/src/main/java/br/com/fashionai/application/service/DashboardService.java`
- `fai-infrastructure/persistence-mysql/src/main/java/br/com/fashionai/infrastructure/mysql/analytics/MysqlAnalyticsAdapter.java` e `fai-application/src/main/java/br/com/fashionai/application/ports/AnalyticsQueryPort.java` (só **acrescentar** consultas v2; nada é removido, porque o Lote 1 ainda chama as v1)
- `fai-application/src/main/java/br/com/fashionai/application/service/AdminService.java` (estado do job v2)
- `app/(site)/(app)/dashboard/page.tsx`, `app/(site)/(app)/admin/dashboard/page.tsx` (só o widget `hype_bands`; **não** mexer na linha do `<Globe>`), `app/(site)/(app)/admin/system/page.tsx`

### Lote 8: FLAIR em v2
P2-17, P2-18
- `fai-application/src/main/java/br/com/fashionai/application/service/FlairService.java`, `FlairModesService.java`
- `fai-application/src/main/java/br/com/fashionai/application/flair/FlairEngine.java`, `FlairLooks.java`
- `components/flair/modes.tsx`, `components/flair/modes-shared.tsx`, `components/flair/flair-card.tsx`, `app/(site)/(app)/flair/page.tsx`
- Testes: `fai-application/src/test/java/br/com/fashionai/application/flair/FlairEngineTest.java`, `FlairLooksTest.java`

### Lote 9: Detalhes pessoais e privacidade
P2-19, P3-05, P3-06, P3-10, P3-11, P3-13
- `app/(site)/(app)/settings/page.tsx`, `components/expanded-card.tsx`, `components/history/history-usage.tsx`, `app/(site)/(app)/highlights/page.tsx`
- `fai-application/src/main/java/br/com/fashionai/application/service/RoomService.java`
- `fai-application/src/main/java/br/com/fashionai/application/service/AccountService.java` (exportação LGPD de `/api/me/exports`)

### Lotes adiados (sequenciais, depois que os agentes atuais terminarem)

| Lote | Espera | Propostas | Arquivos |
|---|---|---|---|
| **A1** Agregados de criador e marca | selos + globo liberarem `HypeQueryService.java`, `HypeController.java`, `lib/hype/types.ts` | P2-02, P2-03, P2-10, P3-01 | `HypeQueryService.java` (`GET /api/hype/groups?type=CREATOR\|BRAND&keys=` em lote, com `level`, `items`, `sufficient`, `rank`; `level` e `slug` da marca em `rankGroups`), `HypeController.java`, `lib/hype/types.ts`, `lib/hype/use-hype-group.ts` (**novo**, lote como `useHypeSummary`), `components/hype/hype-group-badge.tsx` (**novo**), `components/hype/hype-trending.tsx`, `app/(site)/(app)/search/page.tsx` (chips + filtro "Em alta" do Lote 1), `app/(site)/(app)/u/[username]/page.tsx`, `components/profile-header.tsx`, `fai-application/src/test/java/br/com/fashionai/application/hype/HypeRankGroupsTest.java` |
| **A2** Perfil da marca e /brands | agente de selos liberar `brands/[slug]/page.tsx`, `InstitutionalService.java`, `SealService.java`; depois do A1 | P2-05, P2-06, P2-09, P3-17 | `app/(site)/(app)/brands/[slug]/page.tsx`, `app/(site)/(app)/brands/page.tsx`, `InstitutionalService.java` (`filter=GROWTH`, ordem `EM_ALTA` em brand/celebrityFeed; destaques já em v2), `SealService.issuerMetrics` (Hype dos vinculados, reaproveitando o `hype.avgScore` do contrato de selos) |
| **A3** Explorador: telas | agente do globo liberar `explorer/page.tsx` e `globe.tsx`; depois do Lote 1 | P1-04 (front), P2-04 (front) | `app/(site)/(app)/explorer/page.tsx` (abas Marcas e Insights consumindo `hype` v2, `minLevel`, sem estrelas e sem "0"), conferir `app/(site)/(app)/admin/dashboard/page.tsx:122` contra a nova interface do `GlobePoint` |
| **A4** Lookbook › Peças com Hype | agente de selos liberar `WardrobeService.java`; depois do Lote 4 (dono de `lookbook-tabs.tsx`) | P2-11 | `WardrobeService.java` (usar só `publicEligible` quando `!self`), `WardrobeController.java` (passar `hypeLevel` em `/api/users/{id}/closet`), `components/lookbook-tabs.tsx` (ClosetTab). Opcional: `components/piece-card.tsx` com badge em modo seleção (P3) |
| **A5** InsightStrip em novos contextos | pacote Insights liberado | P3-15 | `lib/insights/types.ts`, `application/insights/*`, páginas feed, search, brands/[slug], u/[username], scheme-builder (cada uma depois do lote que a possui) |
| **Final** Limpeza do v1 | todos os anteriores | P3-07 (Espelho, depende do Lote 2), P3-12, P3-16 | `Views.java` e `lib/api/types.ts` (remover `hypeScore`/`hypeScoreGlobal`), `AnalyticsQueryPort`/`MysqlAnalyticsAdapter` (remover v1), `HYPE_BANDS`, `HypeScoreService` (parar de escrever colunas), `ProjectionService`, `AdminController` recalibration, `lib/hype/model.ts` (`hypeColor`), i18n v1, `app/(site)/(app)/mirror/page.tsx` (+ backend do espelho), preferência de opt-out de ranking (P3-12) |

### Ordem sugerida
1. Rodar **em paralelo** os Lotes 1, 2, 3, 4 e 5 (todos os P1).
2. Na sequência, também em paralelo, os Lotes 6, 7, 8 e 9 (P2/P3).
3. Quando os agentes de selos e do globo terminarem: A1 → A2, A3, A4.
4. Depois que o pacote Insights for liberado: A5. Por último, o lote Final.
