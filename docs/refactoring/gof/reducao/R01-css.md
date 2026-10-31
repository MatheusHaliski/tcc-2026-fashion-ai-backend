# Lote R01-css — folhas de estilo dentro do limite

Base: `claude/serene-thompson-yetcg5` (`a0e10d7`). Branch: `gof/r01-css`.

## Resultado por arquivo

| Arquivo | Antes | Depois | Padrão GoF |
|---|---:|---:|---|
| `app/(site)/globals.css` | 4329 | 31 (índice: `@import "tailwindcss"`, typography, `@source` e 24 `@import`) | NENHUM |
| `components/heist/heist.css` | 294 | 2 (índice com 2 `@import`) | NENHUM |

Arquivos novos (trechos contíguos do original, na mesma ordem; cortes só em linhas de nível 0 fora de comentário,
verificados por script, nenhuma regra/`@media` partida):

| Arquivo | Linhas originais | Linhas |
|---|---|---:|
| `app/(site)/_styles/01-tokens-temas.css` | 8–104 (tokens, temas claro/escuro/contraste, container, chrome) | 97 |
| `app/(site)/_styles/02-controles-base.css` | 105–311 (superfícies, controles, listas, abas, aviso, painel, menu) | 207 |
| `app/(site)/_styles/03-card-look.css` | 312–517 (card do look, listas, filtros, selo) | 206 |
| `app/(site)/_styles/04-dna-capsula.css` | 518–694 (card DNA, Minha Cápsula) | 177 |
| `app/(site)/_styles/05-palco-anatomias.css` | 695–936 (palco RF11, anatomias da seção B) | 242 |
| `app/(site)/_styles/06-shell-navegacao.css` | 937–1135 (globo, provador 2D, editor, shell, fluxo) | 199 |
| `app/(site)/_styles/07-meu-quarto.css` | 1136–1242 | 107 |
| `app/(site)/_styles/08-layout-secao-c.css` | 1243–1351 | 109 |
| `app/(site)/_styles/09-flair-cartas-modos.css` | 1352–1518 | 167 |
| `app/(site)/_styles/10-dashboard-detalhes.css` | 1519–1641 | 123 |
| `app/(site)/_styles/11-card-peca-detalhe.css` | 1642–1802 | 161 |
| `app/(site)/_styles/12-card-peca-camadas.css` | 1803–2040 | 238 |
| `app/(site)/_styles/13-arte-fundo-seletores.css` | 2041–2286 | 246 |
| `app/(site)/_styles/14-fashioncard-hype.css` | 2287–2506 | 220 |
| `app/(site)/_styles/15-provador-espelho.css` | 2507–2726 | 220 |
| `app/(site)/_styles/16-criador-selo-insights.css` | 2727–2859 | 133 |
| `app/(site)/_styles/17-lens.css` | 2860–3037 | 178 |
| `app/(site)/_styles/18-hype-selos-globo.css` | 3038–3264 | 227 |
| `app/(site)/_styles/19-momentos-carta-flair.css` | 3265–3461 | 197 |
| `app/(site)/_styles/20-orientacao-cabecalhos.css` | 3462–3614 | 153 |
| `app/(site)/_styles/21-flair-central-desafios.css` | 3615–3817 | 203 |
| `app/(site)/_styles/22-aura-hype.css` | 3818–4054 | 237 |
| `app/(site)/_styles/23-aura-perfil-heist.css` | 4055–4194 | 140 |
| `app/(site)/_styles/24-metamorfoses-layouts.css` | 4195–4329 | 135 |
| `components/heist/styles/hud.css` | 1–137 (tokens `.hz-game`, HUD) | 137 |
| `components/heist/styles/panels.css` | 138–294 (conversa, mapa, roda, painéis, telas) | 157 |

Por que os blocos são por feature e não por "tipo" (tokens/reset/utilitários/temas/media): o original é ordenado por
funcionalidade e cada bloco já traz junto seus overrides de tema escuro/contraste, `@media` e `@keyframes`. Reagrupar
por tipo mudaria a ordem da cascata (regras de mesma especificidade dependem da posição). Os cortes preservam a ordem
exata; o nome de cada arquivo descreve a família de componentes que ele contém.

`_styles/` usa o prefixo `_` (pasta privada do App Router: nunca vira rota). O índice mantém no topo
`@import "tailwindcss" source(none)`, o import de tipografia e os três `@source` — eles **não** foram para os
trechos porque os caminhos de `@source` são relativos ao arquivo que os declara. Não há `@theme`/`@layer` no arquivo.

## Como o @import é processado

`postcss.config.mjs` só tem `@tailwindcss/postcss` (Tailwind 4.3.3, Next 16.4.3). O Tailwind percorre todos os
`@import` do AST e embute os arquivos locais antes de gerar o CSS; o resultado final não contém `@import` locais.
`heist.css` antes não tinha nenhuma diretiva Tailwind e passava intacto; agora, por ter `@import`, o plugin o
processa: embute os dois trechos, acrescenta o banner de licença do Tailwind e descarta os comentários — regras e
declarações idênticas (ver prova 3).

## Provas

1. **Concatenação byte a byte** (`scripts/ux/css-bundle.cjs` substitui cada linha `@import "./…";` pelo arquivo):
   `git show a0e10d7:"app/(site)/globals.css" | cmp - <(node scripts/ux/css-bundle.cjs "app/(site)/globals.css")` → idêntico;
   idem `components/heist/heist.css` → idêntico.
2. **PostCSS com a config do projeto** (postcss + `@tailwindcss/postcss`, `from` = caminho real), antes × depois:
   `globals.css`: 19 952 nós, 0 diferenças na comparação canônica (AST com espaços normalizados). A única diferença
   textual é o Tailwind reimprimir em uma linha 6 valores/seletores que no original quebravam linha (espaço em branco,
   sem efeito). Utilitários gerados idênticos.
3. `heist.css`: 1 501 nós de regra/declaração/at-rule, 0 diferenças ignorando comentários.

## Ferramentas ajustadas (para continuar vendo o conteúdo, não só o índice)

- `package.json` `lint:styles`: inclui `"app/\\(site\\)/_styles/*.css"` (parênteses escapados; sem escape o glob não
  casa nada). Conferido com um arquivo-sonda `font-size: 9px` → erro detectado.
- `scripts/ux/check-design.cjs`: lê `globals.css` via `readCssBundle` (mesmo texto de antes).
- `components/hype/hype-card.test.tsx` e `hype-seals.test.tsx`: as asserções de CSS leem o mesmo texto via
  `readCssBundle`; asserções inalteradas.

## Testes

| Verificação | Antes | Depois |
|---|---|---|
| `npm run lint:styles` | ok | ok (26 arquivos) |
| `node scripts/ux/check-design.cjs` | passou | passou |
| `npx vitest run components/hype/hype-card.test.tsx components/hype/hype-seals.test.tsx` | 40/40 | 40/40 |
| `npx tsc --noEmit -p .` | — | exit 0 |
| `python3 scripts/refactoring/line_ratchet.py` | 260 congelados | 258 congelados, 0 violações |

`next build` não foi rodado (pesado); a equivalência foi provada com a cadeia PostCSS do projeto.

## Padrão GoF

NENHUM: são folhas de estilo declarativas sem comportamento nem objetos; a divisão é só por arquivos contíguos
importados em ordem. Não há variação de política, construção ou estado que um padrão resolveria.
