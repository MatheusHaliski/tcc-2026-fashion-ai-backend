# Módulo 15 — rotas Next App Router, BFF e shell: lote EXPLORER-GLOBAL-INSIGHTS-001

Base: `bcaee73` (main após PR #416). Branch: `gof/15-rotas-next`. `git status --short` limpo antes do lote.

## Escolha do lote

Candidatos avaliados:

- **BFF `app/bff/auth/[action]/route.ts` (165 linhas):** já tem `route.test.ts` (6 testes) e `route-sessao.test.ts`
  (19 testes) cobrindo cookie HttpOnly `path=/bff/auth`, ações permitidas, origem, 413, refresh/logout e repasse ao
  upstream com `fetch` mockado. Está abaixo do limite e é coeso (Proxy de segurança já explícito). Sem lote necessário.
- **Páginas congeladas em `line_baseline.json`:** `explorer/page.tsx` (352), `pieces/new/page.tsx` (341),
  `room/page.tsx` (665). `room` e `pieces/new` pertencem aos domínios 11 e 04; `/explorer` é rota sem dono temático e
  nenhuma branch `gof/*` a tocou. Escolhido `/explorer`.

## Mapeamento real

`app/(site)/(app)/explorer/page.tsx` (`"use client"`, `Suspense` + `useSearchParams` para `?tab=`)
→ `useApi` + `api.get` (`lib/api/client`, anônimo quando não há sessão)
→ `GET /api/explorer/global`, `/api/explorer/brands`, `/api/explorer/insights`, `/api/hype/globe`
→ `ExplorerController` / `HypeGlobeController` (fai-web) → serviços do domínio Hype (não alterados).
A aba **Insights globais** recebe `Insights { rankings, hype: InsightsHype, aiInsight, fallbackUsed, note }` e renderiza
três blocos: Hype atual (v2, 4 cards), Crescimento (TREND, 50 = estável) e Volume (contagens).

## Problema concreto e decisão

A página misturava a composição da rota (abas, filtros na URL, globo, busca de marcas) com ~140 linhas de
apresentação da aba Insights (5 componentes internos + tipos + rótulos) e, dentro do JSX, as regras numéricas das
barras: corte 0–100 do Hype, barra divergente do Crescimento com direção pelo valor arredondado, barra de Volume
relativa ao maior e descarte de valores não finitos. Essas regras não tinham teste unitário e só eram observáveis via
render completo da página.

Extração (sem mudar DOM, i18n, a11y, URL ou `"use client"`):

- `lib/explorer/rank-bars.ts` (novo, puro): `finiteRankRows`, `hypeBarWidth`, `growthBar`, `volumeValue`,
  `volumeBarWidths` — mesmas expressões e mesmas strings de estilo de antes.
- `components/explorer/global-insights.tsx` (novo, client): `GlobalInsights`, `HypeRankCard`, `GrowthCard`,
  `VolumeCard`, `RowName`, `rowName`, `RANK_LABEL`, tipos `RankRow`/`InsightsHype`/`Insights` e `LevelChip`
  (exportado, ainda usado pela página em `BrandHypeLine` e `CountryRow`).
- `explorer/page.tsx`: passa a importar `GlobalInsights`, `LevelChip` e o tipo `Insights`; imports órfãos
  (`tr`, `levelTone`) removidos.

### Padrões avaliados e NÃO aplicados

- **Strategy (variantes de card Hype/Crescimento/Volume):** três componentes pequenos com markup diferente; uma
  estratégia comum só deslocaria o `if` e acoplaria DOMs distintos. Composição simples é mais clara.
- **Adapter (DTO `Insights` → view-model):** o DTO já chega no formato exibido; o único "mapeamento" são as regras de
  barra, que viraram funções puras. Um Adapter adicionaria um tipo intermediário sem ganho.
- **Facade de API do Explorador:** as quatro chamadas continuam inline via `useApi`; extraí-las exige caracterizar
  dependências de efeito (`enabled` por aba, `anonymous`) — fica para lote próprio.
- **Proxy (BFF):** já aplicado em `app/bff/auth/[action]/route.ts` e coberto por 25 testes; não tocado.
- **Singleton/Mediator:** não se aplicam.

## Verificação (executada)

| Etapa | Comando | Resultado |
|---|---|---|
| Caracterização **antes** da extração, sobre a página original (5 testes novos: larguras 0–100/divergente/relativa, direção arredondada, descarte de não finitos, rótulos por tipo, mínimo padrão 3) + testes existentes da página | `npx vitest run components/explorer/global-insights.characterization.test.tsx components/explorer-hype.test.tsx` | 2 arquivos, 10 testes, 0 falhas |
| Depois da extração + unit de `rank-bars` (4 testes) | `npx vitest run components/explorer/global-insights.characterization.test.tsx components/explorer-hype.test.tsx lib/explorer/rank-bars.test.ts` | 3 arquivos, 14 testes, 0 falhas |
| Consumidores/vizinhos (`globe-hype`, `insights-wiring`, `hype-ranking`, `app/pages.smoke`) | `npx vitest run … (7 arquivos)` | 229 testes: 221 ok, 8 falhas **preexistentes** em `pages.smoke` para `lab/heist*` (timeout 3 s); reproduzidas com a `page.tsx` original restaurada (`-t heist`: 8 falhas idênticas) — sem relação com o Explorador |
| Tipos | `npx tsc --noEmit -p .` | exit 0, 0 erros |
| Catraca de linhas | `python …/scripts/refactoring/line_ratchet.py` | 0 violações nos arquivos tocados; `explorer/page.tsx` pede APERTAR 352 → 214. As 13 violações Java listadas vêm do baseline da branch principal (lotes de outros domínios) |

Logs: `evidence/15-explorer-insights-before.log`, `evidence/15-explorer-insights-after.log`.
Sem servidor, banco, navegador, rede externa ou deploy.

## Métricas

| Arquivo | Antes | Depois |
|---|---|---|
| `app/(site)/(app)/explorer/page.tsx` | 352 | 214 (−138; −39 %) |
| `components/explorer/global-insights.tsx` (novo) | — | 148 |
| `lib/explorer/rank-bars.ts` (novo) | — | 43 |
| Produção combinada | 352 | 405 (+53: cabeçalhos de módulo, imports, doc das funções puras) |
| Testes novos | — | 110 (caracterização) + 39 (unit) |

O ganho é a página como ponto de composição e regras de barra testáveis sem render; não há redução global de linhas.

## Contratos preservados

URL `/explorer` e `?tab=`, `"use client"` e `Suspense`, chamadas HTTP e parâmetros, classes CSS, `data-ranking`,
`data-direction`, `aria-label`/`aria-labelledby`, `aria-hidden` das barras, chaves i18n e textos, strings de estilo
(`width`/`left` em %), ordem das seções e cards. Nenhum token ou cookie envolvido.

## Riscos e pendências do domínio 15

- `explorer/page.tsx` continua PARTIAL: o painel do mapa (globo + lista de países, ~90 linhas de JSX) e a busca de
  marcas (`BrandHypeLine`, filtros) ainda vivem na página; candidatos a `components/explorer/*` com a mesma técnica.
- `LevelChip` está duplicado em ~10 componentes de Hype (`hype-dashboards`, `lens-parts`, `dna-card` …); consolidar
  pertence ao domínio 08.
- `room/page.tsx` (665) e `pieces/new/page.tsx` (341) seguem congeladas (domínios 11 e 04).
- `app/pages.smoke.test.tsx` falha para `lab/heist*` no commit base (timeout de 3 s) — investigar à parte.
- Baseline: o orquestrador deve rodar `line_ratchet --update` para baixar o teto de `explorer/page.tsx` para 214.
