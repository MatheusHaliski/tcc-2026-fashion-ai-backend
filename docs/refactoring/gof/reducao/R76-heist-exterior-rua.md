# Lote R76-heist-exterior-rua — rua, fachada do museu, mobiliário e beco do MET Gala Heist v2

Base: `claude/relaxed-pasteur-5b5466`. Branch: `worktree-agent-aa91c7509a372a71a`. Objetivo: os 6 arquivos do lote
em `components/heist/scene/` dentro do limite da categoria (`lib-ts`/`componente` **250**; hooks novos **150**), por
extração de responsabilidades, sem mudar nomes exportados, números, strings nem a ordem de montagem da cena.
Arquivos de outros lotes (`lib/heist/*`, `scene/areas/*`, `scene/interior-*`, `exterior-blocks.ts`,
`exterior-citytex.ts`, `exterior-textures.ts`, `lib/avatar3d/*`) não foram tocados.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `exterior-alley-tex.ts` | 655 | 30 | `exterior-alley-tex-noise.ts` (53) — cache "beco-…", `rng`, `field`/`fieldOf`, `samp`, `clamp01`, `smooth`, `hash`; `exterior-alley-tex-canvas.ts` (56) — `canvas`, `texFrom`, `normalCanvas`, `dataCanvas`, `pbr`, `maskOf`, `wrapStroke`, `crackPath`; `exterior-alley-tex-pbr.ts` (148) — asfalto, remendo, concreto, tijolo, concreto pintado; `exterior-alley-tex-atlas.ts` (70) — `Rect01`, `Atlas`, fontes, `atlas`, spray, névoa, borda rasgada, papel; `exterior-alley-tex-decals.ts` (165) — `wallDecals`, `groundDecals`, `puddleAtlas`; `exterior-alley-tex-signs.ts` (72) — `windowInteriors`, `alleySigns`; `exterior-alley-tex-props.ts` (112) — grades, bituca, mato, bueiro, madeira, papelão, tecido, brilho | Facade (módulo de reexports) |
| `exterior-alley-props.ts` | 305 | 222 | `exterior-alley-foot.ts` (29) — `Y0`, `Foot`, `footOf`, `L`, `B`, `planeUV`; `exterior-alley-pieces.ts` (48) — `bagGeo`, `pallet`, `cylinderP45`; `exterior-alley-dumpster.ts` (37) — `dumpster` (todos reexportados) | NENHUM |
| `exterior-alley-facade.ts` | 281 | 186 | `exterior-alley-facade-plan.ts` (43) — planos, alturas, vãos, `GROUND`, `holedWall`, `reveals`; `exterior-alley-facade-ground.ts` (81) — `groundFloor` (térreo) | NENHUM |
| `exterior-street.tsx` | 562 | 103 | `exterior-street-layout.ts` (37) — medidas, `streetProps`, `roadGeometry`, `crossRoadGeometry`, `streetLights`; `use-street-ground.ts` (81) — `useGround`, `useStairs`; `use-street-platforms.ts` (78) — `useDockRamp`, `useRisers`; `use-street-furniture.ts` (110) — `useRopes`, `useBarriers`, `useLamps`, `useTrees`; `exterior-street-decor.tsx` (138) — `Podium`, `Florals`, `VendorStand`; `exterior-street-signs.tsx` (85) — `Signage`, `FanSigns`, `Hydrant` | NENHUM |
| `exterior-facade.tsx` | 336 | 74 | `exterior-facade-dims.ts` (29) — medidas e perfis; `use-facade-geometry.ts` (108); `use-facade-windows.ts` (36); `exterior-facade-banners.tsx` (39) — `BANNERS`, `Banners`; `exterior-facade-doors.tsx` (99) — `FrontDoors`, `ArchGlazing`, `DockGate`, `FireDoorFrame` | NENHUM |
| `exterior-furniture.tsx` | 335 | 118 | `exterior-furniture-parts.ts` (18) — `Parts`, `add`, `T`, `quadUV`, `iuv`; `exterior-furniture-street.ts` (102) — abrigo, placa, banca, lixeira, parquímetro, paraciclo, caixas de jornal, proibido estacionar; `exterior-furniture-gala.ts` (72) — banco, vaso, totem, painel de fotos, refletor, manobrista; `exterior-furniture-signals.ts` (36) — `signal`, `cabinet`; `use-furniture-textures.ts` (32) — `routeMapTex`, `useTextures` | NENHUM |

`line_ratchet.py`: `exterior-street.tsx` (500 → 103) e `exterior-facade.tsx` (313 → 74), os dois congelados, aparecem
só como `APERTAR`; os demais arquivos do lote e os 28 novos estão dentro do limite, sem `VIOLAÇÃO`. O baseline não foi
alterado (o integrador roda `--update`). As violações que continuam listadas são de arquivos de outros lotes.

## Como foi dividido

- **Critério:** uma responsabilidade por arquivo. O código foi **movido sem alteração** (mesmo nome, assinatura e
  corpo), por faixas de linhas do original com asserções sobre as linhas-limite (scripts em scratchpad, não
  versionados). Uma conferência por multiconjunto de linhas (original × novos, ignorando imports, `export` e
  cabeçalhos) deu **0 linhas faltando** em cada arquivo. As únicas mudanças são `export` nas declarações movidas, os
  imports, um cabeçalho por arquivo novo, os reexports nos originais e a função `groundFloor` (abaixo).
- **`exterior-alley-tex.ts`** virou o ponto de entrada das texturas do beco: mantém o cabeçalho e reexporta todos os
  nomes antes exportados (`rng`, `Quality`, `PbrSet`, `Rect01`, `Atlas` e as texturas); `exterior-alley.tsx`,
  `exterior-alley-mats.ts`, `-ground.ts`, `-props.ts` e `-facade.ts` não mudaram de import. O cache `memo` continua
  um só (`exterior-alley-tex-noise.ts`), então as chaves `beco-…` e o compartilhamento entre texturas são os mesmos.
- **`exterior-alley-props.ts`** mantém `buildFixture` e os dez móveis; pegada, peças repetidas e caçambas saíram e
  são reexportadas (`footOf`, `L`, `planeUV`, `Y0`, `Foot`, `bagGeo`, `pallet`, `cylinderP45`, `dumpster`).
- **`exterior-alley-facade.ts`** mantém `neighborFacade` (andares, platibanda, escadas, fiação, decalques) e
  reexporta as medidas (`WALL_G`, `WALL_U`, `GLASS_X`, `Z_END`, `Z_MOUTH`, `BAYS`, `NEIGHBOR_ESCAPES`, `GROUND`). O
  térreo (linhas 64–130 do original) virou `groundFloor(bag, signs, r)`, chamado no mesmo ponto: recebe o mesmo
  sorteio `r` da fachada (o portão da garagem consome `r()`), então a sequência de sorteios e a ordem dos `bag.add`
  são as mesmas.
- **`exterior-street.tsx`** fica com `HeistStreet` (materiais e JSX idênticos) e `PAPARAZZI`; a geometria memorizada
  foi para hooks `use-street-*.ts` (chamados na mesma ordem) e as peças únicas para dois arquivos de componentes.
  Reexporta `crossRoadGeometry`, `roadGeometry`, `streetLights`, `streetProps` e `X_FAR`.
- **`exterior-facade.tsx`** fica com `Instanced` (usado por cidade, rua e decoração) e `HeistFacade`; reexporta
  `FACADE_Z`. Os estados de animação (`useFrame`/`useRef` das portas e do portão da doca) ficaram nos próprios
  componentes de `exterior-facade-doors.tsx`: estão presos às refs dos grupos e já são curtos.
- **`exterior-furniture.tsx`** fica com `furnitureLights` e `HeistFurniture` (laço dos móveis, materiais, folhas);
  montagem, modelos por grupo e as texturas por hook saíram.

## Por que (Facade | NENHUM)

- **Facade** em `exterior-alley-tex.ts`: o módulo passou a ser a interface única sobre sete colaboradores coesos
  (ruído, canvas/PBR, chão e paredes, traços das folhas, decalques, placas, texturas pequenas). Os consumidores continuam a importar de um
  só lugar sem conhecer a divisão interna — é o problema concreto que a fachada resolve aqui.
- Demais arquivos: funções de montagem de geometria, hooks de memorização e subcomponentes React; não há família de
  variações (Strategy), esqueleto com passos variáveis (Template Method) nem montagem incremental com estado próprio
  (Builder — o `Bag`/`Parts` já existia). Reexports pontuais nos originais não configuram um padrão novo.

## Testes e equivalência

Caracterização escrita **antes** da extração e executada no código original (commit `f44fe91`, snapshot versionado
em `components/heist/scene/__snapshots__/exterior-rua.snapshot.test.tsx.snap`):

- `components/heist/scene/exterior-rua.snapshot.test.tsx` (4 testes, jsdom, 169 linhas, 18 snapshots): renderiza
  `HeistStreet`, `HeistFacade`, `HeistFurniture` e `HeistAlley` com `@react-three/test-renderer` nas qualidades
  `high` e `low` e grava, por objeto, tipo, matriz de mundo (3 casas), flags de sombra/`renderOrder`, hash da
  geometria (atributos arredondados, índice, grupos) e do material (todas as propriedades, texturas com dimensões e
  hash do canvas), instâncias (contagem e hash das matrizes e cores) e contagens por tipo de material. O contexto 2D
  é um gravador (hash de cada chamada e atribuição no canvas) e `Math.random` é semeado. Também chama cada textura
  exportada por `exterior-alley-tex` nas duas qualidades e as funções puras (`streetProps`, `roadGeometry`,
  `crossRoadGeometry`, `streetLights`, `PAPARAZZI`, `furnitureLights`). Sensibilidade conferida: trocar uma cor do
  totem do beco (`#b8914a` → `#b8914b`) quebra 2 snapshots.
- Depois da fusão com a base, o teste das texturas estourou o tempo padrão de 5 s com a suíte inteira em paralelo;
  ganhou tempo limite explícito (120 s; 60 s no das funções puras). Nenhuma asserção mudou.

| Etapa | Comando | Resultado |
|---|---|---|
| Antes (original + caracterização) | `vitest run components/heist/scene/exterior-rua.snapshot.test.tsx` | 4 testes; 18 snapshots gravados; rodado 2× igual |
| Depois | mesmo comando | 4 testes, 0 falhas; nenhum snapshot reescrito |
| Depois (após `git merge claude/relaxed-pasteur-5b5466`) | `vitest run components/heist components/lab "app/(site)/lab"` | 17 arquivos, 91 testes, 0 falhas |
| Tipos | `tsc --noEmit -p .` | 0 erros (`--noUnusedLocals`: nenhum nos arquivos do lote) |
| Catraca | `python3 scripts/refactoring/line_ratchet.py` | lote só como `APERTAR` (street 500→103, facade 313→74); nenhuma violação em arquivos do lote ou novos |

Observação de ambiente: `npx` não funcionou no worktree depois que o `node_modules` do checkout principal virou um
link para si mesmo (feito por outra sessão); o worktree recebeu `npm ci --ignore-scripts` próprio (ignorado pelo git)
e os comandos rodaram como `node node_modules/vitest/vitest.mjs` e `node node_modules/typescript/bin/tsc`.

## Pendências

Nenhuma do lote: os 6 arquivos estão dentro do limite (maior: `exterior-alley-props.ts`, 222). Falta o integrador
rodar `python -m scripts.refactoring.line_ratchet --update` para tirar `exterior-street.tsx` e `exterior-facade.tsx`
do baseline.
