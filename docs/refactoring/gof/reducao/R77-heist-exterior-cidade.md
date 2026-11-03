# Lote R77-heist-exterior-cidade — quadras e texturas procedurais da cidade em volta da avenida

Base: `claude/relaxed-pasteur-5b5466`. Branch: `worktree-agent-a087d08d39a0b5229`. Objetivo: os 3 arquivos do lote
(`lib-ts`, limite **250**) dentro do limite por extração de responsabilidades, sem mudar nenhum número, string, ordem
ou nome exportado. Arquivos de outros lotes (`lib/heist/*`, `scene/areas/*`, `scene/interior-*`,
`scene/exterior-alley-*`, `exterior-street/facade/furniture.tsx`, `lib/avatar3d/*`) não foram tocados.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `components/heist/scene/exterior-textures.ts` | 553 | 133 | `exterior-tex-core.ts` (83): cache `memo`, `prng`, ruído periódico, `samp`/`smooth`, canvas → textura, normal, `pbr`; `exterior-tex-pbr.ts` (191): pedra, granito, asfalto, calçada, tapete, tijolo, ruído fino; `exterior-tex-type.ts` (28): `SIGNAGE`, `SERIF`/`SANS`, `spaced`, `fitFont`; `exterior-tex-signs.ts` (147): banners, placa, inscrição, letreiros, bufê, cartazes dos fãs | NENHUM |
| `components/heist/scene/exterior-citytex.ts` | 505 | 71 | `exterior-citytex-paint.ts` (27): `cellUV` e auxiliares de pintura; `exterior-citytex-windows.ts` (91): atlas de janelas; `exterior-citytex-interior.ts` (61): grade/células e atlas de interiores; `exterior-citytex-shopwall.ts` (146): parede do fundo de cada ramo; `exterior-citytex-signs.ts` (93): lojas, toldos e atlas de letreiros; `exterior-citytex-flyers.ts` (71): atlas e UV dos panfletos | NENHUM |
| `components/heist/scene/exterior-blocks.ts` | 466 | 88 | `exterior-blocks-layout.ts` (31): traçado (linhas, transversais), `Wall`/`Style`/`WALL`, `Building`, alturas; `exterior-blocks-kit.ts` (62): `CityKit`, `Anchor`/`Pool`/`Glow`, quads, `L`, `iuv`/`suv`; `exterior-blocks-parts.ts` (30): `PARTS`; `exterior-blocks-shop.ts` (112): térreo, vitrine, toldo, portaria; `exterior-blocks-shopprops.ts` (75): móveis por ramo; `exterior-blocks-upper.ts` (68): andares de cima; `exterior-blocks-plan.ts` (66): `cityPlan` | NENHUM |

`line_ratchet.py`: `exterior-textures.ts` (congelado) aparece só como `APERTAR` (teto 531 → 133); `exterior-blocks.ts`,
`exterior-citytex.ts` e os 17 arquivos novos ficam dentro do limite, sem `VIOLAÇÃO`. As violações restantes da
listagem são de outros lotes (`scene/areas/*`, `exterior-alley-*`, `lib/heist/types.ts`). O baseline não foi alterado.

## Como foi dividido

- **Código movido sem alteração**, por intervalos de linhas do original (script em scratchpad que confere cada troca);
  as únicas mudanças são `export` nas declarações que agora atravessam módulos (`pbr`, os auxiliares de pintura e
  `SCRIPT`, `shopWall`, `WALL`, `quad`/`quadX`/`quadY`/`L`/`iuv`/`suv`, `groundFloor`, `shopProps`, `upperDetailed`,
  `upperFlat`), os imports e um cabeçalho por arquivo novo. Comentários e formatação originais preservados.
- **Os três originais** continuam com os nomes que outros arquivos importam, por reexportação (`export … from`):
  consumidores (`exterior.tsx`, `exterior-city.tsx`, `exterior-street.tsx`, `exterior-furniture.tsx`,
  `exterior-facade.tsx`, `exterior-vehicles.tsx`, `exterior-litter.tsx`, `exterior-fx.tsx`, `exterior-skyline.tsx`,
  `exterior-materials.ts`, `exterior-glow.tsx`, `sky.tsx`) não mudaram. `exterior-textures.ts` mantém fachadas da
  vizinhança, folhagem, flores e brilhos; `exterior-citytex.ts` mantém porta de enrolar, skyline e painel da gala;
  `exterior-blocks.ts` mantém `buildBuilding`, `sideFace` e `buildCity`.
- **Ciclos evitados:** os módulos novos importam a base (`exterior-tex-core`, `exterior-tex-type`) direto, não o
  arquivo de fachada; o único ciclo é `exterior-citytex-interior` ↔ `exterior-citytex-shopwall`, só de tipo
  (`import type { ShopKind }`), apagado na compilação. O cache de texturas continua um só (`exterior-tex-core`).

## Por que NENHUM

São funções de construção e tabelas de dados divididas por família (base, PBR, texto, cada atlas, cada parte do
prédio). Os originais reexportam por compatibilidade de imports, o que não é uma Facade nova (não há interface
simplificada sobre colaboradores, só o mesmo conjunto de nomes). Não há variação de algoritmo nem montagem passo a
passo que justifique Strategy/Builder além do que o código já fazia.

## Testes e equivalência

- Caracterização antes da extração (commit separado no original):
  `components/heist/scene/exterior-cidade.snapshot.test.ts` (`// @vitest-environment jsdom`, 10 testes) com um
  contexto 2D gravador: cada textura (qualidades low e high, os 3 idiomas dos atlas) grava dimensões do canvas,
  número de chamadas e SHA-256 do registro de todas as chamadas (números a 3 casas, pixels de `putImageData` por
  SHA-256), além de `colorSpace`, wrap, repeat e anisotropia; `Math.random` com semente para placa e porta. Na quadra:
  `PARTS`, constantes e alturas, o `cityPlan()` e `buildCity()`/`buildCity(true)` com contagens e hash das geometrias
  fundidas por material, das matrizes das instâncias (3 casas), das cores e das âncoras/poças/brilhos.
- Depois da divisão: snapshot idêntico (nenhuma linha alterada no `.snap`, 10/10).
- `npx vitest run components/heist components/lab "app/(site)/lab"`: 12 arquivos, 72 testes, todos verdes.
- `npx tsc --noEmit`: sem erros.
- `python3 scripts/refactoring/line_ratchet.py`: lote só como `APERTAR`.

## Pendências

- O integrador roda `python -m scripts.refactoring.line_ratchet --update` (teto de `exterior-textures.ts`).
- `exterior-tex-pbr.ts` (191) é o maior arquivo novo; coeso (uma família PBR por função), sem necessidade de dividir.
