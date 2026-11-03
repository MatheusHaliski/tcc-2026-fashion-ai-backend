# Lote R73 — áreas do cenário do MET Gala Heist: galeria, lounge, cofre e doca

Objetivo: os 12 módulos de `components/heist/scene/areas/` do lote dentro do limite da categoria `lib-ts` (**250**
linhas, `docs/refactoring/LINE_RULES.md`), por extração de responsabilidades, com a cena gerada idêntica (mesmas
geometrias, materiais, matrizes, âncoras de luz, animações e texturas procedurais) e os mesmos nomes exportados.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `galeria.ts` | 400 | 147 | `galeria-planta.ts` (40) — pé-direito, paredes com vãos, perfis das molduras, gessos; `galeria-paredes.ts` (147) — rodapé, tecido por seção, pilastras, arcos, portas, vinil, friso, quadros e nicho do Aurora; `galeria-teto.ts` (100) — caixotões, lanternim e spots de museu | NENHUM |
| `galeria-props.ts` | 361 | 107 | `galeria-props-mats.ts` (47) — materiais, etiquetas/arte do atlas, âncora; `galeria-vitrines.ts` (107) — vitrines de piso e de parede; `galeria-moveis.ts` (142) — móveis próprios (vitrine de joia, mesa de croquis, atril, audioguia) | NENHUM |
| `galeria-tex.ts` | 293 | 122 | `galeria-tex-textos.ts` (111) — textos de parede, créditos, friso, etiquetas de museu; `galeria-tex-arte.ts` (77) — croquis e guaches | NENHUM |
| `galeria-trajes.ts` | 281 | 227 | `galeria-trajes-mats.ts` (24) — manequim, cetim, cristal, ouros, pérola; `galeria-joias.ts` (48) — colar, pérolas, tiara, brincos, anel, busto | NENHUM |
| `lounge.ts` | 397 | 97 | `lounge-planta.ts` (26) — medidas e referencial das paredes; `lounge-paredes.ts` (103) — lambri, sanca, sobreporta, janelas em arco; `lounge-teto.ts` (75) — caixotões, lustre, pendentes, arandelas; `lounge-estante.ts` (61) — estante do bar; `lounge-decor.ts` (95) — pintura, espelho, relógio, luminária, plantas, tapetes, frisa | NENHUM |
| `lounge-mob.ts` | 449 | 124 | `lounge-mats.ts` (46) — materiais; `lounge-copos.ts` (63) — auxiliares do referencial, taças, garrafas, votivas; `lounge-bar-onix.ts` (144) — bar de ônix e banquetas; `lounge-sala.ts` (125) — sofás, poltronas, mesas baixas, guéridons | NENHUM |
| `lounge-tex.ts` | 363 | 177 | `lounge-tex-tapetes.ts` (95) — tapetes persas e franja; `lounge-tex-papeis.ts` (108) — rótulos, cardápio, partitura, livros, pintura, biombo | NENHUM |
| `cofre.ts` | 375 | 126 | `cofre-planta.ts` (30) — medidas, paredes, lambri, pilastras, painéis, perfis; `cofre-piso.ts` (58) — faixas e rosácea; `cofre-paredes.ts` (120) — paredes, nichos, cortinas, luar; `cofre-teto.ts` (42) — caixotões, tambor e cúpula; `cofre-vigilancia.ts` (52) — postes dos lasers e câmeras | NENHUM |
| `cofre-props.ts` | 311 | 165 | `cofre-props-mats.ts` (29) — materiais, etiqueta, luz das vitrines, âncora; `cofre-conservacao.ts` (142) — mesa de restauração, mapoteca, estação fotográfica, carrinho | NENHUM |
| `doca.ts` | 279 | 200 | `doca-planta.ts` (32) — medidas e ajudantes no espaço da sala; `doca-teto.ts` (67) — estrutura, utilidades e luminárias | NENHUM |
| `doca-props.ts` | 450 | 103 | `doca-mats.ts` (88) — materiais, geometrias tingidas/UV, ajudantes do referencial, sorteio; `doca-trabalho.ts` (143) — estante, bancada, guarita; `doca-carga.ts` (84) — flight cases, paleteira, paletes; `doca-empilhadeira.ts` (76) — empilhadeira patolada | NENHUM |
| `doca-tex.ts` | 374 | 112 | `doca-tex-base.ts` (77) — cache, ruído, gerador de superfície, trincas; `doca-tex-folha.ts` (201) — folha de desenhos e retângulos UV | NENHUM |

Total: 12 arquivos de 279–450 linhas → 12 arquivos de 97–227 linhas + 32 arquivos novos (24–201 linhas), todos dentro
do limite de 250. Nenhum desses 12 arquivos constava de `line_baseline.json` (eram violações diretas); o baseline não
foi alterado.

## Como foi dividido

- **Critério:** cada módulo de área ficou com a orquestração (a função `dress` que chama as partes, a luz, o `AREA`) e
  as partes foram para arquivos por responsabilidade: a *planta* compartilhada (medidas, referencial das paredes,
  perfis — o que todas as partes da decoração usam), paredes, teto, piso, vigilância, grupos coesos de móveis e,
  nas texturas, cada família de desenho (textos, arte, tapetes, papéis, folha da doca) ou a base técnica (ruído e
  gerador de superfície da doca). Nos arquivos de props, os materiais/ajudantes compartilhados saíram para um
  `*-mats.ts`, para que os grupos de móveis não importem do arquivo que os reexporta (sem import circular).
- **Movimento verbatim:** as faixas de linhas foram movidas sem alteração (mesmos nomes, assinaturas, corpos, números,
  strings e ordem); a única mudança nas linhas movidas é o prefixo `export` nas declarações que outro arquivo do grupo
  usa. Um script conferiu que toda linha de código dos 12 originais existe, com a mesma multiplicidade, no conjunto
  original + novos, que nenhuma linha nova de código foi criada fora de imports/reexports/cabeçalhos e que nenhum
  módulo novo importa do arquivo de onde saiu.
- **Contrato preservado:** cada original reexporta tudo o que exportava antes (`export { … } from "./novo"`), então
  `index.ts`, `terraco.ts` (`bottleAt`, `glassAt`, `loungeMats`), `cofre*.ts` (joias e materiais da galeria) e
  `doca.ts` continuam importando dos mesmos caminhos. Chaves de cache ("galeria-…", "lounge-…", "cofre-…", "doca-…"),
  ordem de chamadas ao lote/instâncias e a sequência dos sorteios com semente não mudaram (o retrato confirma).

## Por que NENHUM padrão GoF

Os módulos são construtores procedurais de geometria e texturas: funções que acrescentam malhas ao lote da sala. A
divisão é por parte da sala e família de desenho; não há família de algoritmos intercambiáveis (Strategy), esqueleto
com passos variáveis (Template Method), montagem passo a passo de um objeto (Builder) nem árvore recursiva nova
(Composite). O `AREA` de cada arquivo já era o ponto único da área (contrato `AreaModule` de `types.ts`, decisão
anterior); criar fachadas ou interfaces para as partes seria estrutura artificial.

## Testes e equivalência

Caracterização escrita e gravada **antes** da extração, no código original (commit `e6867c2`):

- `test-utils/heist-areas-retrato.ts` (138): monta cada área num contexto mínimo (`Batch`, `Instances`, âncoras, chamas,
  giroflex, cones, ticks) com os móveis da planta da área (`baseProps`), roda a decoração e dois quadros de animação
  (vista inicial; portão aberto e lasers sem energia) e reduz tudo a JSON determinístico: acabamento da casca,
  móveis desenhados, luzes-chave, âncoras/chamas/cones/animados com posições a 3 casas, malhas do lote (sala, material
  descrito, sombra, nº de vértices, caixa e hash FNV das geometrias), instâncias (chave, material, contagem, hash das
  matrizes e cores) e um gravador do contexto 2D (dimensões dos canvas, nº de chamadas e hash dos argumentos e dos
  pixels de `putImageData`). Os uuid aleatórios das texturas são retirados dos nomes de material.
- `areas-galeria-lounge-cofre-doca.snapshot.test.ts` (32): as quatro áreas em `low` e `high` (texturas de 8 px do jsdom)
  → `__retratos__/{area}-{q}.json`.
- `areas-galeria-lounge-cofre-doca-tex.snapshot.test.ts` (84): o navegador falso deixa de se chamar "jsdom" (os kits
  usam `FAKE = /jsdom/`), então as texturas saem **no tamanho real**: cada função de textura das quatro áreas (e o
  degradê do cetim) com tamanho, chamadas e digest, mais as quatro áreas inteiras em `low` com texturas reais →
  `__retratos__/tex-*.json` e `__retratos__/{area}-low-real.json`.

| Etapa | Comando | Resultado |
|---|---|---|
| Antes (original) | `npx vitest run components/heist/scene/areas/` | 16 testes, 16 retratos gravados; 2ª execução idêntica |
| Depois | `npx vitest run components/heist/scene/areas/` | 16 passed, retratos idênticos (sem regravar) |
| Suítes da área | `npx vitest run components/heist components/lab` | 7 arquivos, 43 testes, 0 falhas |
| Tipos | `npx tsc --noEmit` | sem erros |
| Movimento verbatim | script de conferência (linhas dos originais × originais + novos; ciclos) | 0 problemas |
| Catraca | `python3 scripts/refactoring/line_ratchet.py` | nenhum arquivo do lote nem arquivo novo listado; as 42 violações restantes são de outros lotes |

## Pendências

Nenhuma no lote: os 12 arquivos e os 32 novos estão abaixo de 250 linhas (maiores: `galeria-trajes.ts` 227,
`doca-tex-folha.ts` 201, `doca.ts` 200). O integrador não precisa rodar `--update` por causa deste lote (nenhum dos
arquivos estava congelado no baseline).
