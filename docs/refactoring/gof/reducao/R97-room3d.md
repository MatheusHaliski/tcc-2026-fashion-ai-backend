# Lote R97-room3d — Meu Quarto 3D (cena, objetos, roupa pendurada, avatar, criador, regras e página)

Base: `claude/relaxed-pasteur-5b5466` (`d55f5a1`). Objetivo: os 8 arquivos do lote dentro do limite da categoria
(`componente`/`lib-ts`/`pagina` **250**; hooks novos `use-*.ts` **150**), por extração de responsabilidades, sem mudar
DOM, acessibilidade, i18n, efeitos/cleanup, a árvore Three.js nem os nomes exportados (os módulos originais reexportam
tudo o que tinham; nenhum consumidor precisou mudar de import).

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `components/room3d/room-scene.tsx` | 1005 | 229 | `room-scene-types.ts` (54) — `RoomPiece3D`, `RoomModule3D`, `RoomDecoration`, `RoomData3D`, `MirrorOverlay`, `RoomSceneProps`, `SceneView`, `Ctx`; `room-layout.ts` (79) — `LEVELS`, `atLeast`, medidas do FAI Origem, `kelvinColor`, `GRAB`, `layoutFor`, `moduleAnchor`, `moduleFacing`; `use-room-texture.ts` (44) — `useTex`, `useReflection`; `interaction-anchor.tsx` (27); `piece-mesh.tsx` (60); `loose-pieces.tsx` (45); `wardrobe-bays.tsx` (121) — `DoorMark`, `DoorBay`, `Drawer`, `LookBox`; `room-mirror.tsx` (99) — molde, vidro (Reflector), `Mirror`; `room-stands.tsx` (106) — cesto, arara, cadeira, vitrine, ilha; `room-cameras.tsx` (157) — `CameraRig`, `OrbitTurn`, `ResponsiveFov`, `PresetCamera`, `FogFollow`, `CameraProbe`; `room-walls.tsx` (94) — `shownHits`/`visibleHits`, `Wall`, `Carcass`, `Wardrobe2Body`, `LockedWardrobe` | NENHUM |
| `components/room3d/room-props.tsx` | 471 | 12 | `room-props-kit.tsx` (105) — `deg`, `pointer`, `useCanvasTex`, `textTex`, `Label3D`, croqui, teia, poeira, etiqueta, ponto dourado; `room-props-fixtures.tsx` (185) — gaveta vazia, busto, interruptor, janela/sol, porta, abajur, luzes do closet; `room-props-challenges.tsx` (116) — Caixa FAI, chaves, cortiça, calendário, fita, brilho; `room-props-brand.tsx` (82) — medalhão, neon e tapete FashionAI. `room-props.tsx` fica como índice de reexportação | NENHUM |
| `components/room3d/hung-garment.tsx` | 334 | 122 | `hung-shape.ts` (89) — `HungKind`, `HungPiece`, `hungKindOf`, `HUNG_LENGTH`/`HUNG_DEPTH`, `hungProfile`, `clothFolds`, `hungShape`, `hangJitter`; `hung-cloth.ts` (142) — `averageColor`, trama, recorte e `buildCloth` (com `CLOTH_TIME`/`CLOTH_SWAY`) | NENHUM |
| `components/room3d/room-avatar-controller.tsx` | 292 | 243 | `use-room-avatar-input.ts` (49) — o efeito dos controles (teclas, cursor, botões de girar, setas na prova, limpeza); `reach-hand.ts` (21) — CCD da mão (`reachHand`, reexportado) | NENHUM |
| `components/room3d/wardrobe-creator.tsx` | 256 | 216 | `wardrobe-creator-model.ts` (38) — tipos da API do criador, `AVAILABILITY`, `SLOT_LABELS`, formulário vazio, `finishOf`; `store-swatch.tsx` (16) — `StoreSwatch` | NENHUM |
| `app/(site)/(app)/room/page.tsx` | 665 | 199 | em `components/room3d/room-page/`: `room-page-model.ts` (55) — tipos da API, `CARE`/`ORIGIN`, modo foto, `webglOk`, `linkKey`, `slotsOf`; hooks `use-room-light.ts` (29), `use-room-vista.ts` (36), `use-room-copilot.ts` (20), `use-room-photo.ts` (35), `use-mirror-nav.ts` (34), `use-room-settings.ts` (69), `use-mirror-walk.ts` (89), `use-mirror-actions.ts` (77), `use-closet-lights.ts` (16), `use-room-keys.ts` (27), `use-mirror-deep-link.ts` (43); seções `room-toolbar.tsx` (37), `room-mirror-side.tsx` (43), `room-flat-mirror.tsx` (35), `room-assist-dialogs.tsx` (61), `room-piece-dialogs.tsx` (52), `avatar-still.tsx` (6) | NENHUM |
| `lib/room3d/interaction.ts` | 350 | 218 | `room-walk.ts` (98) — colisão (`BODY_RADIUS`, `penetration`), `moveInRoom`, `stepToward`, constantes do passo; `room-body.ts` (48) — `CHAIR`, `seatOf`, `thighDrop`, `HAND_SPEED`/`HAND_REACH`, `nudgeHand`, `keepInFront` (todos reexportados) | NENHUM |
| `lib/room3d/mirror-session.ts` | 297 | 196 | `mirror-pieces.ts` (64) — lugares do corpo, `HandPiece`, `handSlotOf`, `assetStateOf`, `handsOf`; `mirror-reaction.ts` (47) — `reactionKindOf`, `reactionChoreo` (reexportados) | NENHUM |

`line_ratchet.py`: os 8 arquivos aparecem só como `APERTAR` (1005→229, 471→12, 334→122, 292→243, 256→216, 665→199,
350→218, 297→196); nenhum arquivo do lote nem novo em `VIOLAÇÃO` (maior novo: `room-props-fixtures.tsx`, 185; maior
hook: `use-mirror-walk.ts`, 89). O baseline não foi alterado (o integrador roda `--update`).

## Como foi dividido

- **Critério:** uma responsabilidade por arquivo, código **movido sem alteração** por faixas de linhas do original, com
  asserção sobre a primeira e a última linha de cada faixa (scripts no scratchpad, não versionados). As mudanças são:
  `export` nas declarações movidas que outro arquivo passou a usar, os imports, um cabeçalho por arquivo novo e, no
  módulo original, a reexportação dos nomes que ele exportava.
- **`room-scene.tsx`** fica com a `RoomScene` (o Canvas, as quatro paredes com o que está preso nelas e os móveis), que
  já era a composição. Dados, medidas e regras puras de posição saíram para `room-scene-types.ts`/`room-layout.ts`;
  cada peça da cena (âncora, peça, peça solta, vãos, espelho, móveis soltos, câmeras, paredes) virou componente próprio.
  Os dois componentes que já não eram usados (`GlassButton`, `Basket`) foram movidos junto, sem export, como estavam.
- **`room-props.tsx`** já era uma coleção de objetos independentes: virou índice de reexportação sobre kit (o que os
  outros objetos usam), objetos fixos, desafios e identidade FashionAI. Os novos importam o kit direto (sem ciclo pelo
  índice); `hover` continua o mesmo objeto (`pointer as hover`).
- **`hung-garment.tsx`** fica com cabide, `HungGarment` e `ShelfPiece`; forma (pura) e pano (geometria, máscara e shader,
  com os uniformes compartilhados `CLOTH_TIME`/`CLOTH_SWAY`, agora exportados) saíram.
- **`room-avatar-controller.tsx`**: o `useEffect` dos controles foi para `useRoomAvatarInput` com as refs do controlador
  como parâmetros. Refs são estáveis: acrescentá-las às dependências (`[camera, engine, gl, sessionRef, parts, pointer]`)
  não muda quando o efeito roda. O quadro (`useFrame`) ficou inteiro no controlador.
- **Página:** composição. Estado e efeitos foram para hooks `use-*.ts` por assunto (luz, Vista-me, Copilot, modo foto,
  navegação do espelho, Configurações, caminhada, peças no espelho, luzes do closet, atalhos, link do espelho); as seções
  visuais (barra/modo foto, lateral do espelho, espelho plano, diálogos) viraram componentes com o mesmo JSX. Duas
  linhas que juntavam declarações de assuntos diferentes foram separadas pelo `;` (linhas 82 e 430 do original); o
  `useState` de `preview`/`highlight` subiu para antes dos hooks que usam `setHighlight`.
- **Ordem dos efeitos preservada:** os hooks são chamados na posição dos efeitos originais (E1…E19), inclusive a
  inscrição no `engine` (fica na página, entre a caminhada e as peças no espelho) e o "Mostrar no quarto" antes do link
  do espelho. A única mudança de posição é a limpeza do temporizador do aviso de vista (só roda ao desmontar).
- **`interaction.ts` / `mirror-session.ts`**: a classe e o estado da sessão ficam; caminhar/colisão e corpo
  (assento, mão por teclas) saem de um, peças em mãos e reação saem do outro. O `UP` do passo passou a ser exportado
  por `room-walk.ts` para a mão por teclas usar o mesmo eixo.
- **`wardrobe-creator.tsx`**: tipos e tabelas para `wardrobe-creator-model.ts` (interfaces internas ganharam `export`),
  amostra da loja para `store-swatch.tsx`; `room-store.tsx`, `admin/room-assets` e `brands/[slug]` não mudaram.

## Por que NENHUM padrão GoF

- Cena e objetos: componentes React por objeto e funções puras de medida/posição; não há família de variações
  (Strategy), cadeia (Chain of Responsibility) nem montagem passo a passo (Builder). O índice `room-props.tsx` só
  reexporta nomes — não simplifica uma interface, então não é uma Facade.
- Página: hooks e seções são a divisão idiomática do React pedida em `LINE_RULES.md`; um "mediator" entre hooks seria
  estrutura artificial. `interaction.ts`/`mirror-session.ts`: funções puras extraídas, as classes não mudaram.

## Testes e equivalência

Caracterização escrita **antes** da extração e gravada no código original (commit `bcedc5c`), com o retrato comum em
`test-utils/room3d-retrato.ts` (árvore Three.js: tipo, nome, flags, matriz de mundo com 3 casas, hash de geometria e
material, luzes e `userData`; canvas 2D gravador; `Math.random` semeado, `performance.now` parado, texturas e GLB fixos):

- `components/room3d/room-scene.retrato.test.tsx` (7): `RoomScene` em ESTREIA (órbita, foco e busto), STUDIO à noite
  (2º guarda-roupa trancado, paredes inteiras), LOFT completo, três pontos de vista (canto do teto, planta com corte
  seco e paredes baixas, vista salva) e modo andar (peça na mão e no chão; alvos, ações e obstáculos do motor), cada um
  montado e depois de 5 quadros, com a pose da câmera.
- `components/room3d/room-props.retrato.test.tsx` (20): cada objeto de `room-props` em variações, funções puras do kit,
  `HungGarment`/`ShelfPiece` por tipo de peça e os **nomes exportados** de `room-props`, `hung-garment`, `room-scene`,
  `room-avatar-controller`, `wardrobe-creator`, `interaction` e `mirror-session`.
- `app/room-page-retrato.test.tsx` (4): DOM da página (ids do React normalizados) e as props passadas à cena, com e sem
  WebGL — quarto, Organizar, Vista-me, Copilot, modo foto, etiqueta, chaves, gaveta vazia, abrir porta, luz, outra
  sugestão e usar o look, prova no espelho e volta, módulo pelo link `?piece=` e espelho plano — e as chamadas à API.

| Etapa | Comando | Resultado |
|---|---|---|
| Antes (original, testes existentes) | `npx vitest run components/room3d lib/room3d "app/(site)/(app)/room" app/pages.smoke.test.tsx app/room-page.test.tsx app/mirror-tipo-look.test.tsx app/mirror-settings-hype.test.tsx` | 25 arquivos, 393 testes; falhas só as 8 páginas `lab/heist*` de `pages.smoke` (+1 de `room-store.test.tsx` que só falha com a máquina carregada; sozinho, 18/18) |
| Antes (original + caracterização) | idem + os 3 retratos | 28 arquivos, 424 testes, 416 passam; 8 falhas = `lab/heist*`; 84 snapshots gravados |
| Depois | mesmo comando | 28 arquivos, 424 testes, 416 passam; as mesmas 8 falhas `lab/heist*`; nenhum snapshot reescrito |
| Depois (+ consumidores) | idem + `components/flair components/mirror` | 43 arquivos, 539 testes; além das 8 `lab/heist*`, falha `components/flair/classic-modes.test.tsx` › "erro do duelo vira aviso" (texto "Oponente sem deck"), em código que o lote não toca (`components/flair` idêntico à base) |
| Tipos | `npx tsc --noEmit -p .` | 0 erros (`--noUnusedLocals` nos arquivos do lote: só `GlassButton` e `Basket`, que já não eram usados no original) |
| Catraca | `python3 scripts/refactoring/line_ratchet.py` | lote só como `APERTAR`; nenhuma violação em arquivos do lote ou novos |

## Pendências

- Nenhuma do lote: os 8 arquivos estão dentro do limite. Falta o integrador rodar
  `python -m scripts.refactoring.line_ratchet --update` para tirar as 8 entradas do baseline.
- `GlassButton` (espelho) e `Basket` (cesto) continuam sem uso, como no original; a remoção fica para quem decidir o
  destino dos botões 3D do espelho e do cesto "para lavar".
- O projeto não tem `eslint.config.*`; as listas de dependência dos hooks foram conferidas à mão (iguais às originais,
  com as refs acrescentadas só em `useRoomAvatarInput`).
