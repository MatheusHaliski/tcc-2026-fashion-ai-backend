# Lote R72 — áreas do cenário Heist: vestíbulo e Grande Salão

Objetivo: os 9 módulos de `components/heist/scene/areas/` do lote dentro do limite da categoria `lib-ts` (**250**
linhas), por extração de responsabilidades em arquivos auxiliares, sem mudar geometria, material, número, string ou
ordem de montagem. Os nomes exportados que `vestibulo.ts`, `salao.ts` e `interior-doors.ts` importam continuam
saindo dos mesmos arquivos (reexportados quando a implementação mudou de lugar).

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `vestibulo-kit.ts` | 313 | 182 | `vestibulo-tex.ts` (107) — ruído periódico, gerador de superfícies, cache de materiais e atalhos `v*`; `vestibulo-stones.ts` (46) — superfícies de Carrara, Botticino, nero, calcário e madeira | NENHUM |
| `vestibulo-floor.ts` | 295 | 112 | `vestibulo-granite.ts` (42) — campo de granito e `floorMaterial`; `vestibulo-floor-tex.ts` (165) — ladrilhos de pedra, `drawnSurface`, faixa, rosácea e tapete | NENHUM |
| `vestibulo-furniture.ts` | 411 | 216 | `vestibulo-furniture-kit.ts` (23) — contexto, `L`/`W`, luz, gerador com semente, planos; `vestibulo-desk.ts` (107) — balcão "Nocturne"; `vestibulo-cloak.ts` (106) — balcão da chapelaria, guarda-volumes e arara | NENHUM |
| `vestibulo-stair.ts` | 259 | 212 | `vestibulo-stair-kit.ts` (16) — `ST`, `RAIL`, balaústre; `vestibulo-gallery.ts` (51) — galeria sobre a porta do salão | NENHUM |
| `vestibulo-walls.ts` | 331 | 197 | `vestibulo-walls-kit.ts` (18) — `at`, `wb`, `run`; `vestibulo-niche.ts` (57) — nichos; `vestibulo-walls-art.ts` (91) — placas, cartazes e pinturas | NENHUM |
| `salao-kit.ts` | 259 | 212 | `salao-tinting.ts` (55) — lote por acabamento (`tinting`) | NENHUM |
| `salao-food.ts` | 275 | 231 | `salao-food-table.ts` (59) — mesa vestida (saia plissada, trilho) e guirlanda | NENHUM |
| `salao-dj.ts` | 387 | 227 | `salao-dj-tex.ts` (112) — texturas desenhadas da festa; `salao-dj-rig.ts` (70) — pista, treliça e line arrays (`DANCE`, `TRUSS`) | NENHUM |
| `salao-walls.ts` | 406 | 203 | `salao-floor-tex.ts` (135) — piso, rosácea, barra grega e tapete; `salao-chandelier.ts` (49) — lustre "Coroa Celeste"; `salao-drapes.ts` (55) — cortinas | NENHUM |

`line_ratchet.py`: os 9 arquivos saíram da lista de violações (54 → 45 no total do repositório; as 45 restantes são
de outros lotes, p.ex. `lib/heist/*`). Os 9 não estavam em `line_baseline.json`, por isso não há `--update` a fazer.

## Como foi dividido

- **Critério:** cada arquivo novo é um assunto do cenário — texturas procedurais/desenhadas (`*-tex.ts`,
  `*-stones.ts`, `*-granite.ts`), ferramentas compartilhadas (`*-kit.ts`) ou um conjunto de peças coeso
  (balcão, chapelaria, galeria, nichos, quadros, lustre, cortinas, pista/treliça, mesa vestida). O original passou a
  compor: importa os auxiliares e mantém a montagem (`buildFloor`, `buildWalls`, `buildStair`, `dressDj`,
  `dressWalls`…).
- **Código movido sem alteração:** corpos, nomes, assinaturas e ordem das chamadas iguais; só ganharam `export` as
  funções que passaram a ser usadas de outro arquivo. Conferido por comparação do multiconjunto de linhas de código
  (sem imports/comentários/prefixo `export`) entre os 9 originais e os arquivos novos. Diferenças, todas forçadas pela
  separação em módulos:
  - `seed = 77/31/4242` → `reseed(77/31/4242)`: o gerador `rnd` e a semente `let seed` foram para
    `vestibulo-furniture-kit.ts`, e um módulo ES não pode atribuir a um `let` importado. A sequência sorteada é a
    mesma (o retrato confirma).
  - `void mul;` saiu do fim de `buildGallery`: `mul` não é mais importado ali.
  - `const col = (h) => new THREE.Color(h)` existe em `salao-food.ts` e em `salao-food-table.ts` (os dois usam).
- **Reexportações para os consumidores:** `vestibulo-kit` reexporta ruído, superfícies, `v*` e as pedras
  (`interior-doors.ts` usa `arcPts`/`profileGeo`); `vestibulo-floor` reexporta `floorMaterial`,
  `graniteFieldSurface`, `drawnSurface`; `vestibulo-stair` reexporta `ST`, `buildGallery`; `vestibulo-furniture`
  reexporta `desk`, `coatCheck`, `cloakWall`, `rack`; `salao-kit` reexporta `tinting`; `salao-dj` reexporta `DANCE`
  (e mantém `BPM`, `BOOTH_H`); `salao-walls` reexporta `floorMaterialSalao`, `floorSurfaceSalao`, `crownChandelier`.
- **Caches por chave preservados:** as chaves `vestibulo-…`/`salao-…` de materiais, texturas e geometrias não
  mudaram; os `Map` de cache foram com o código que os usa (um só dono por cache).

## Por que NENHUM padrão GoF

São construtores procedurais de geometria Three.js: funções que acrescentam peças a um lote. Separar texturas,
ferramentas e grupos de móveis é organização por responsabilidade. Não surgiu família de variações (Strategy), cadeia,
árvore recursiva nem fachada nova — os arquivos originais já eram o ponto de entrada de cada parte da sala e continuam
sendo; `tinting` já era um decorador de contexto existente e só mudou de arquivo. Criar interfaces ou classes para
"encaixar" um padrão seria estrutura artificial.

## Testes e equivalência

Caracterização escrita **antes** da extração e executada no código original (commit `eb0586a`):
`components/heist/scene/areas/areas-vestibulo-salao.snapshot.test.ts` (163 linhas, jsdom) monta as duas áreas
inteiras (`AREA.dress` + todos os móveis da planta da sala via `AREA.props`) nas qualidades `low` e `high`, com um
`Batch`/`Instances` que só grava. Retratos versionados (`areas-vestibulo-salao.vestibulo.snapshot.json`,
`areas-vestibulo-salao.salao.snapshot.json`): por grupo (sala | material | hash da geometria | sombra) a contagem, o
hash das matrizes arredondadas a 3 casas e a posição da primeira peça; o hash da ordem global das chamadas; âncoras de
luz, chamas, giroflex; malhas soltas do grupo (instâncias, pontos, planos) antes e depois dos tiques com festa e com
alarme; materiais com dimensões/espaço de cor/repetição das texturas e as superfícies da casca. Vestíbulo `low`:
14 móveis, 3019 peças; salão `low`: 9 móveis, 4803 peças, 12 malhas soltas, 2 tiques.

| Etapa | Comando | Resultado |
|---|---|---|
| Antes (original) | `npx vitest run components/heist/scene/areas/areas-vestibulo-salao.snapshot.test.ts` | 2 retratos gravados; 2/2 verdes ao repetir |
| Depois | mesmo comando | 2/2 verdes; `git diff` dos `.snapshot.json`: vazio |
| Suíte | `npx vitest run components/heist components/lab` | 6 arquivos, 29 testes, 0 falhas |
| Tipos | `npx tsc --noEmit` (e `--noUnusedLocals` nos arquivos do lote) | 0 erros |
| Catraca | `python3 scripts/refactoring/line_ratchet.py` | nenhum arquivo do lote nem novo listado (maior: `salao-food.ts` 231) |

## Pendências

Nenhuma: os 9 arquivos e os 19 novos estão dentro de 250 linhas; o teste tem 163 (limite 400).
