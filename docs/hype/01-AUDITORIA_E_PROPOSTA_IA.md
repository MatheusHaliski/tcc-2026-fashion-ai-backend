# FashionAI — Auditoria de abas, cards e Hype + proposta de arquitetura de informação

> Fases 1 e 2 da refatoração "HypeScore v2 + arquitetura de abas". Documento de decisão: o que existe hoje, o que
> muda, o que fica para depois e por quê. A arquitetura do HypeScore está em [`HYPESCORE_ARCHITECTURE.md`](HYPESCORE_ARCHITECTURE.md).

## 1. Inventário (estado antes da refatoração)

### 1.1 Navegação (`components/app-shell.tsx`)

| Grupo | Itens |
|---|---|
| Descobrir | Feed · Buscar · Explorador · Marcas |
| Meu guarda-roupa | Meu perfil (`/lookbook` → `/u/<eu>`) · Closet · Fotos · Meu Quarto · Espelho · Meu Avatar 3D · Provador |
| Criar | Criar Look · DNA de Estilo · Autopiloto · Copilot |
| Jogar e ganhar | Desafios · FLAIR · FAI Points · Destaques · Cupons |
| Gestão (admin) | Administração |

Barra inferior (celular): Feed · Buscar · **[Criar]** (sheet: peça, look, DNA, fotos) · Closet · Perfil.
Não há rota "Histórico"; "Adicionar peça" só aparece no sheet do celular (no desktop, nenhum item leva a `/pieces/new`).

### 1.2 Páginas com abas/subabas (mais relevantes)

| Página | Abas | Observação |
|---|---|---|
| `/u/[username]` (Lookbook) | Closet Digital · Meus looks · DNA · Looks salvos · Peças salvas · Look do Dia · Cápsula · Meus cupons resgatados · Agrupamentos | 9 abas; cupons duplica `/coupons`; salvos divididos em 2 abas |
| `/closet` | — (FilterBar: estado rápido, categoria, cor, ocasião, ordenação) | duplica a aba Closet do Lookbook com controles diferentes |
| `/search` | Looks · Peças · Pessoas · Marcas · Celebridades | Looks sem termo = `/api/feed` (duplica o Feed) |
| `/explorer` | Passarela 3D · Painel global · Buscar marcas & lojas · Insights globais | aba de marcas usa 6 `Select` em linha em vez do `FilterBar` |
| `/brands/[slug]` | até 15 abas + subabas + chips + selects | navegação mais profunda do app |
| `/copilot` | 5 seções num tablist feito à mão (prontos, novos, esquecidos, clima, em alta) | duplica `Tabs`; sem modos de recomendação |
| `/photos` | Galeria · Linha do tempo · Insights de IA · Comparar | histórico de fotos isolado do resto |
| `/highlights` | — | contém o gráfico "Evolução" (outro histórico) |
| `/flair` | 7 abas → grade de modos → painel | profundo, mas coerente (jogo) |

Histórico disperso em três lugares: aba Look do Dia (card "Histórico"), `/photos` (Linha do tempo) e `/highlights` (Evolução).

### 1.3 Componentes reutilizáveis já existentes (reaproveitados nesta refatoração)

`components/ui/index.tsx`: `Tabs` (tablist rolável, setas do teclado), `SegmentPicker` (radiogroup), `Dropdown`/`Select`
(lista FashionAI, sem `<select>` nativo), `Chip`, `ChipMultiSelect`, `Sheet` (drawer lateral/inferior com foco preso),
`Dialog`, `ActionMenu`, `EmptyState`, `ErrorState`, `Skeleton`. `components/filter-bar.tsx`: `FilterBar` (busca, filtros,
estado rápido, ordenação). **Não existiam**: gauge reutilizável (havia um privado em `scheme-anatomies.tsx`), card com
verso, drawer analítico, indicador de tendência.

### 1.4 Cards

* `PieceCard` (`components/piece-card.tsx`): cabeçalho → foto dominante (abre o detalhe) → ações sociais → nome/marca/preço.
  **Não mostrava Hype**, nem no detalhe expandido.
* `SchemeCard` (`components/scheme-card.tsx`): mostrava só um chip qualitativo (`HypeBadge`: "Em alta" ≥ 70, "Crescendo" ≥ 40)
  calculado do `hypeScore` v1; o número exato não aparecia em lugar nenhum do card.
* Lógica de Hype duplicada na UI: `hypeColor`/`hypeBand` (scheme-card), `hypeStatus` + `Gauge` privado (scheme-anatomies),
  gauge da DNA (dna-card), painel do Look do Dia (lookbook-tabs).

### 1.5 Backend do Hype (v1, RF6)

`HypeScoreService`: `Hype = 0,65·E_norm + 0,35·T_norm` (engajamento bruto `L+3C+5S+8R` e alinhamento de tendência, ambos por
percentil), recalibrado a cada 4 h, **sobrescrevendo** `hype_score` nas entidades públicas. Sem histórico por entidade,
sem `algorithmVersion`, sem decaimento temporal, sem distinção entre popularidade e tendência. Faixas duplicadas em Java
(`HypeScoreService.BANDS`), SQL (`MysqlAnalyticsAdapter`) e `ExplorerService`. O painel do Look do Dia é calculado num GET
que grava (`hype_score_metrics`).

Sinais com data disponíveis: `reactions`, `comments`, `shares`, `saved_items`, `piece_usage_diary`, `daily_looks`,
`schemes.original_scheme_id` (remix). Visualizações existiam só como contador sem data (e a de peça nunca era incrementada).

### 1.6 Divergências frontend × backend encontradas na auditoria

1. Histórico do Look do Dia lia `h.scheme?.title`/`h.hype`, o backend devolve `title`/`hypeScore` → colunas vazias. **Corrigido.**
2. "Destaques do mês" (`/highlights`) filtrava `h.text`, o backend devolve `name`/`value` → seção nunca aparecia. **Corrigido.**
3. Evolução (`/highlights`) vinha do mais novo para o mais antigo e o front cortava `slice(-24)` → mostrava os mais antigos, invertidos. **Corrigido.**
4. Copilot: `reply.purchases` × backend `purchaseSuggestions`. **Documentado** (fora do escopo do Hype).
5. Duas regras de "peça esquecida": 30 dias (sugestões) × 60 dias (chat). **Documentado**; a Redescoberta usa a regra de 60 dias (`RoomService.FORGOTTEN_DAYS`).

## 2. Princípios aplicados

1. **Aba muda o contexto; filtro restringe dados.** Cor, estilo, ocasião, marca, material, disponibilidade, popularidade e
   HypeScore são filtros/ordenações (`FilterBar`, `Chip`, `Dropdown`), nunca abas.
2. **Uma visão de cada vez.** Variações de uma mesma lista usam `SegmentPicker` dentro da aba (ex.: Salvos → Looks | Peças).
3. **Domínios no menu, não telas.** O menu lateral agrupa por domínio; telas raras viram abas de um domínio.
4. **Nada é apagado sem migração.** Abas removidas mantêm o id antigo como alias (links internos e do backend continuam válidos).
5. **Analítico separado do operacional.** Números de Hype ficam no verso do card, no drawer de análise e na aba Hype do
   Histórico; a frente do card continua visual e social.

## 3. Arquitetura proposta

### 3.1 Menu (implementado)

| Domínio | Itens |
|---|---|
| Descobrir | Feed · Buscar · Explorador (+ aba **Em alta**) · Marcas |
| Guarda-roupa | Minhas peças (`/closet`) · **Adicionar peça** (agora também no desktop) · Meu Quarto · Minhas fotos · Provador · Espelho · Meu Avatar 3D |
| Looks | Criar look · Copilot · Autopiloto · DNA de Estilo |
| Perfil | Meu perfil (Lookbook) · **Histórico** (novo) |
| Jogar e ganhar | Desafios · FLAIR · FAI Points · Destaques · Cupons |

### 3.2 Guarda-roupa (`/closet`)

Contextos operacionais (estado rápido do `FilterBar`): Todas · Favoritas · Disponíveis · Indisponíveis · À venda.
Filtros: categoria (parte de cima, parte de baixo, calçados, acessórios…), cor, ocasião, **faixa de Hype**.
Ordenações novas: Maior Hype · Menor Hype · Maior crescimento · Mais usada · Menos usada · Mais rara · Mais tempo sem uso
(além de recentes, nome, preço). "Para doar" exige um campo novo na peça e fica como próximo passo (§5).

### 3.3 Lookbook (`/u/[username]`)

| Antes (9 abas) | Depois (8 abas) |
|---|---|
| Closet Digital | **Peças** |
| Meus looks | **Looks** |
| Meus looks DNA de estilo | **DNA de estilo** |
| Looks salvos + Peças salvas | **Salvos** (SegmentPicker Looks \| Peças; aliases `saved_looks`/`saved_pieces`) |
| Look do Dia · Cápsula · Agrupamentos | mantidos |
| Meus cupons resgatados | removida da navegação (alias `coupons`/`cupons` redireciona para `/coupons`, onde o mesmo componente já existia) |
| — | **Insights** (dono): peça e look com maior Hype, maior crescimento, clássico, rara, esquecida, look mais remixado |

### 3.4 Histórico (`/history`, novo)

Reúne o histórico que estava espalhado: **Timeline** (looks do dia, com o Hype de cada um) · **Evolução do estilo**
(Inventory Score ao longo do tempo + versões do DNA) · **Uso de peças** (mais usadas, menos usadas, esquecidas) ·
**Hype** (evolução do Hype médio, itens que subiram/caíram, novas tendências, redescobertas, looks emergentes) ·
**Insights da IA** (leituras das fotos + explicações do Hype). `/photos` e `/highlights` continuam existindo; o Histórico
consome os mesmos endpoints em vez de duplicar lógica.

### 3.5 Copilot

* **Modo** antes de gerar (SegmentPicker): Seguro (DNA de estilo) · Descoberta (familiar + novidades) · Experimental
  (mais distância do histórico). Enviado ao backend em `mode`.
* Seções (componente `Tabs`, no lugar do tablist manual): Recomendações · Descoberta · Experimentação · Redescoberta · Insights.
* Hype é **contexto**, nunca critério único: o Copilot responde "qual peça está em alta", "qual cresce", "tenho peça rara",
  "qual look tem potencial de trend", sempre com o aviso de que Hype ≠ compatibilidade com o seu estilo.

### 3.6 Descobrir → Explorador → Em alta

Ranking com recortes obrigatórios — janela (Hoje · 7 dias · 30 dias), tipo (Peças · Looks), categoria, estilo, ocasião —
nunca `ORDER BY hype DESC` global. Só entidades públicas entram.

## 4. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Links antigos para abas removidas (`?tab=cupons`, `saved_looks`) | aliases no `profileTab`; links internos atualizados; teste de rotas (`lib/routes.test.ts`) continua valendo |
| Dois algoritmos de Hype convivendo (v1 do Look do Dia e v2 dos cards) | `algorithmVersion` em cada snapshot; v1 segue dono das colunas `hype_score*` (Explorador, FLAIR, painel RF6) até a migração dos consumidores (§5); os cards e o Histórico leem só o v2 |
| Custo de leitura do Hype em grades grandes | leitura em lote (`/api/hype/summaries`, 1 requisição por grade), tabela de estado atual + cache com geração |
| Migração SQL sem teste automatizado de banco | DDL simples e idempotente na criação; backfill só com `INSERT … SELECT` e `GROUP BY` |
| Card com verso aumentando a altura | verso posicionado sobre a frente (sem layout shift), conteúdo do verso montado só no primeiro giro |

## 5. Próximos passos (fora desta entrega)

1. Migrar Explorador, FLAIR, busca e o painel do Look do Dia para o v2 e aposentar a materialização v1 em `hype_score`.
2. Campo "Para doar" na peça (subaba do guarda-roupa) e "Publicações" no Lookbook (depende de separar post × look).
3. Reduzir as 15 abas de `/brands/[slug]` (agrupar Looks/Peças em destaque e Salvos em SegmentPicker, como no Lookbook).
4. Unificar as duas regras de "peça esquecida" (30 × 60 dias) e corrigir `purchaseSuggestions` no Copilot.
5. Antifraude além do mínimo implementado (ver `HYPESCORE_ARCHITECTURE.md` §10).
