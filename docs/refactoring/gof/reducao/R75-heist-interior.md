# Lote R75-heist-interior — `components/heist/scene/interior-*.ts`

Objetivo: os 6 arquivos do lote dentro do limite da categoria `lib-ts` (**250** linhas, `docs/refactoring/LINE_RULES.md`),
por extração de responsabilidades, sem mudar nenhum número, string, ordem de chamada, material, geometria ou export.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `interior-props.ts` | 690 | 94 | `interior-props-kit.ts` (30) — referencial da pegada (`L`, `worldOf`, `box`, `cyl`, `anchor`) e tornos comuns; `interior-props-textures.ts` (82) — telão, folha de chamada, placa, plaquinhas, CCTV; `interior-props-hall.ts` (95) — coluna, mesas, vasos; `interior-props-stage.ts` (93) — palcos, telão, monitores, espelho de camarim, vaporizador; `interior-props-furniture.ts` (154) — mesas/bancadas, sofá, bar, espelho, piano, banco, chapelaria, arara; `interior-props-display.ts` (151) — bustos, vitrines, joias, estátua, pedestal e diamante; `interior-props-security.ts` (90) — mesa de monitores, cofre, quadro de luz, engradados, detector, cordão | NENHUM |
| `interior-fx.ts` | 507 | 87 | `interior-fx-env.ts` (82) — clima/sondas de reflexo; `interior-fx-lights.ts` (127) — `LightPool`, cintilação, `KeyLight`; `interior-fx-mirror.ts` (97) — `FloorMirror`; `interior-fx-vision.ts` (90) — contorno da Visão; `interior-fx-glow.ts` (73) — giroflex e halos | NENHUM |
| `interior-hall.ts` | 432 | 172 | `interior-hall-arches.ts` (87) — arcos, pilastras, cortina; `interior-hall-ornaments.ts` (84) — rosa, castiçal, lustre; `interior-hall-textures.ts` (57) — estandartes, cartaz, cúpula; `interior-hall-floral.ts` (76) — instalação floral | NENHUM |
| `interior-tex.ts` | 412 | 30 | `interior-tex-noise.ts` (61) — ruído periódico e primitivos; `interior-tex-surface.ts` (56) — gerador de superfície (cor/relevo/rugosidade); `interior-tex-floors.ts` (111); `interior-tex-walls.ts` (65); `interior-tex-misc.ts` (66); `interior-tex-drawn.ts` (80) — canvas desenhado, fontes, `spaced`/`fit`/`drawSymbol`/`drawGown`/`paper` | NENHUM (Facade simples por reexport, ver abaixo) |
| `interior-doors-leaf.ts` | 372 | 81 | `interior-doors-leaf-parts.ts` (95) — `LeafSpec`, `LEAF_T`, materiais, `Parts`, peças comuns; `interior-doors-leaf-tex.ts` (46); `interior-doors-leaf-wood.ts` (90) — nobre, acolchoada, francesa; `interior-doors-leaf-metal.ts` (104) — aço, palco, disfarçada, blindada | NENHUM |
| `interior-shell.ts` | 256 | 212 | `interior-shell-grid.ts` (56) — índices da grade, sala por célula, divisórias, distância à parede, parapeito | NENHUM |

Teste novo: `interior.snapshot.test.ts` (264) + 6 retratos em `__snapshots__/interior-*.txt` (977 linhas).

## Como foi dividido

- **Movimento mecânico:** cada arquivo novo foi gerado por um script que copia faixas de linhas do original, sem editar
  o corpo (só `export` acrescentado à declaração quando outro arquivo do grupo a usa), e confere que toda linha
  não vazia do original foi para exatamente um destino. Os originais ficaram com o cabeçalho (com um parágrafo novo
  apontando os irmãos), os imports e reexports, e o que é de fato deles.
- **`interior-props.ts`:** mantém `LightAnchor`, `PropsCtx`, `Foot` (agora `export interface`, só tipo), `foot`,
  `BUILT_KINDS`, `buildProp` (o `switch` intacto, na mesma ordem), `INTERIOR_PROP_ROOMS` e reexporta
  `callSheetTexture`, `cctvTexture`, `placardTexture`, `diamondGeometry` e `candelabra` (consumidos por `areas/*` e
  `interior-fx`). Famílias: salão/mesas, palco/produção, mobília, exposição, segurança/doca. O `void M; void glass;`
  final (que só segurava imports não usados) saiu junto com esses imports.
- **`interior-fx.ts`:** mantém `roomsInView` (com `LINKS`), `updateDoors` e `updateAnimated`; reexporta tudo o que
  `interior.tsx`, `interior-build.ts`, `models.tsx` e os testes importam (`MOOD`, `PROBE_AT`, `roomMaterial`,
  `applyRoomEnv`, `captureProbes`, `LightPool`, `LIGHT_GAIN`, `flickerOf`, `KeyLight`, `FloorMirror`, Visão, giroflex,
  halos). Um efeito por arquivo.
- **`interior-hall.ts`:** mantém `hallWall`, `HALL_H`, `BALC_Y`, `DOMES`, `HallOut` e `buildHall`; reexporta
  `roseGeometry`, `candelabra`, `chandelier` e `buildFloral`.
- **`interior-tex.ts`:** vira a porta de entrada das texturas (todos os consumidores — `areas/*`, materiais, portas —
  continuam importando de `./interior-tex`); fica com `TILE`. Os desenhos (`interior-props-*`, `interior-hall-*`,
  `interior-doors-leaf-tex`, `interior-fx-glow`) também importam `drawnTexture` por `./interior-tex`.
- **`interior-doors-leaf.ts`:** mantém `closerArm`, `CLOSER_SHOE`, o cache e `buildLeaf` (a tabela
  `{ grand, steel, … }[s.style]` é a mesma); reexporta `LEAF_T`, `LeafStyle`, `LeafSpec`, `DoorMats` e `doorMats`.
- **`interior-shell.ts`:** a leitura da grade saiu; `interior-shell-grid.ts` importa `isInterior`/`roomAtPoint` de
  volta (ciclo só entre funções, nada é avaliado no carregamento do módulo — o mesmo tipo de ciclo que já existia entre
  `interior-props` e `areas/*`).

## Por que NENHUM padrão GoF

- **`buildProp`:** o brief sugeria trocar o `switch` por `Record<kind, builder>` (Strategy) se simplificasse. Não
  simplifica: 6 dos 26 casos escolhem o construtor pela sala ou variante (`table`, `stage`, `screen`, `mirror`, `case`,
  `sofa` com o material) ou passam argumentos diferentes (`crate`, `desk`, `rack`), e dois são especiais (`floral`
  retorna sem nada, `fixture` desenha o bloco). Uma tabela exigiria um adaptador por entrada repetindo esse `if` — mais
  código, mesmo comportamento. O `switch` ficou como estava.
- **`buildLeaf`** já despacha por uma tabela de estilo → função (um Strategy leve preexistente); só mudou de onde as
  funções vêm.
- **`interior-tex.ts` e os reexports** são fachadas de módulo (pontos de entrada estáveis para os consumidores); não
  há classe nova nem interface, então não registramos isso como aplicação de Facade.
- Os demais arquivos são catálogos de funções puras por família; não há família de variações nova, estado, cadeia nem
  árvore recursiva.

## Testes e equivalência

`interior.snapshot.test.ts` (jsdom) foi escrito e executado **no código original**, gravando 6 retratos; as áreas
(`areaProp`, `areaSurface`, `areaKeys`) são simuladas como `null` para o retrato cobrir só o código genérico do lote.
Registra: `buildProp` para um móvel sintético por ramo de cada tipo de `BUILT_KINDS` mais todos os móveis internos da
planta, nas duas qualidades (lotes por material com hash das posições/uv/normais arredondadas a 3 casas, instâncias
com hash das matrizes e cores, âncoras de luz, chamas, malhas animadas e soltas); Grande Salão, instalação floral,
lustre e castiçal; casca (pisos, paredes, rodapés, tetos, máscaras, `doorSides`, `roomAtPoint`); as 11 folhas de porta
das 7 famílias e o braço da mola em 3 ângulos; por quadro: salas visíveis, `LightPool`, `KeyLight`, `roomMaterial`,
`FloorMirror.patch` (shader resultante), Visão, giroflex, halos, `updateDoors` e `updateAnimated`; texturas: pixels
(8 × 8 no jsdom) das 27 superfícies × 2 qualidades, `fbm`, `rand`, `TILE`, e o rastro completo das chamadas de canvas
de cada `drawnTexture` (dimensões, `srgb`, contagem e hash). Conferido que um hash alterado no retrato faz o teste
falhar.

| Etapa | Comando | Resultado |
|---|---|---|
| Antes (original) | `npx vitest run components/heist/scene` | 3 arquivos, 19 testes, 0 falhas (6 retratos gravados) |
| Depois | `npx vitest run components/heist components/lab` | 6 arquivos, 33 testes, 0 falhas; 6 retratos idênticos |
| Tipos | `npx tsc --noEmit` | 0 erros |
| Catraca | `python3 scripts/refactoring/line_ratchet.py` | lote só como `APERTAR` (`interior-props` 671→94, `interior-fx` 505→87, `interior-hall` 398→172, `interior-tex` 412→30); `interior-doors-leaf` e `interior-shell` não estavam no baseline e ficaram ≤ 250; nenhum arquivo novo em violação (as violações restantes são de outros lotes) |

## Pendências

Nenhuma: os 6 arquivos e os 27 arquivos novos estão dentro do limite (maior: `interior-shell.ts`, 212). O baseline
não foi alterado (o integrador roda `--update`).
