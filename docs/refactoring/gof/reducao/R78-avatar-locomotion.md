# Lote R78-avatar-locomotion — `lib/avatar3d/human/locomotion.ts`

Base: `claude/relaxed-pasteur-5b5466` (`c63eec0`). Objetivo: levar `locomotion.ts` (lib-ts, limite 250; teto congelado
1005, mas o arquivo tinha 1331 linhas e violava a catraca) para dentro do limite, por extração de responsabilidades,
sem mudar nenhuma pose, número ou nome exportado.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `lib/avatar3d/human/locomotion.ts` | 1331 | 138 | `locomotion-model.ts` (89), `locomotion-math.ts` (22), `locomotion-kinematics.ts` (148), `locomotion-rig.ts` (76), `locomotion-gait.ts` (138), `locomotion-stance.ts` (68), `locomotion-combat.ts` (85), `locomotion-social.ts` (144), `locomotion-scripted.ts` (68), `locomotion-dance-moves.ts` (142), `locomotion-dance.ts` (98), `locomotion-dj.ts` (64), `locomotion-eat.ts` (43), `locomotion-floor.ts` (93), `locomotion-overlays.ts` (53) | NENHUM |

Teste novo: `locomotion.snapshot.test.ts` (164 linhas, categoria teste ≤ 400).

## Como foi dividido

O código foi **movido sem alteração** (mesmo nome, assinatura e corpo; só `export` acrescentado onde outro módulo usa o
nome). As faixas de linhas foram recortadas do original por script, para não haver reescrita manual.

| Arquivo | Responsabilidade |
|---|---|
| `locomotion-model.ts` | Modelo de dados: `Motion`, `MOTIONS`, `Grip`, `MOTION_DURATION`, `CHANGE_SWAP_AT`, nomes de ossos/dedos, `Side`/`SIGN`, `Rig`, `MotionState`, `newMotionState`, `MotionInput`. |
| `locomotion-math.ts` | Temporários compartilhados (`Q1..Q4`, `V1..V6`, `M1/M2`, `CHAIN`, `A/B/C`) e funções escalares (`clamp`, `smooth`, `mix`, `hash`, `pulse`, `D`). Os temporários continuam sendo **um conjunto só** para todos os módulos, como no original (a cena roda numa thread; nenhuma instância foi duplicada, então a ordem de escrita/leitura é a mesma). |
| `locomotion-kinematics.ts` | Cinemática: `reset`, orientação/posição no espaço do modelo, rotações (`lean/swing/twist/bank`), `aim`/`orient`, IK de dois ossos, `leg`/`arm`/`handTo`/`curl`/`pointFinger`, pontos do corpo (`chest/headPt/pelvis`). |
| `locomotion-rig.ts` | Construção do esqueleto: `makeRig`, `cloneRig`, `syncBase`, `jointPos`. |
| `locomotion-gait.ts` | Marcha: `gaitParams`, `footCycle`, `lower`, `weightShift`, `armsFree`, `breathe`, `idleHead`, `headLevel`. |
| `locomotion-stance.ts` | Parada e posturas: `stand`, `holdIdle`, `crouchArms`, `discreet`, `tiredOverlay`. |
| `locomotion-combat.ts` | Ações do heist: `lowReady`, `aimPose`, `reload`, `strike`, `pickpocket`, `takedown`. |
| `locomotion-social.ts` | Gestos da festa: `textHold`, `talk`, `phone`, `drink`, `photo`, `cheer`, `serve`, `guardHands`, `point`, `wave`, `interact`, `play`. |
| `locomotion-scripted.ts` | Gestos roteirizados com começo e fim: `change`, `celebrate`, `cower`. |
| `locomotion-dance-moves.ts` | Vocabulário da dança: `DANCE_BPM`, `danceBeat`, passos (`footwork`, `stepArc`) e estilos de braços (`armStyle`). |
| `locomotion-dance.ts` | `dance` (composição dos passos e braços no relógio comum). |
| `locomotion-dj.ts` | `DJ_DESK`, `djPose`. |
| `locomotion-eat.ts` | `eatPhase`, `eat`. |
| `locomotion-floor.ts` | Poses deitadas e sentadas: `fall`, `downed`, `crawl`, `sit`, `climb`. |
| `locomotion-overlays.ts` | Camadas por cima: `DRAW_TIME`, `drawOverlay`, `lookAt`, `flinch`. |
| `locomotion.ts` | Fachada pública: o comentário de arquitetura, as reexportações de todos os nomes públicos de antes, a mistura entre gestos (`save`/`blendInto`), `LYING`/`UPPER`, `animate` e o despacho `pose`. |

Grafo de dependências sem ciclos: `math` ← `model` ← `kinematics` ← `rig`/`gait` ← gestos (`combat`, `social`, `eat`,
`scripted`, `dance-moves` → `dance`, `dj`, `floor`, `overlays`) ← `stance` ← `locomotion.ts`. Nenhum módulo auxiliar
importa `locomotion.ts`.

Nomes exportados por `locomotion.ts` (inalterados): `Motion`, `MOTIONS`, `Grip`, `MOTION_DURATION`, `CHANGE_SWAP_AT`,
`Rig`, `makeRig`, `cloneRig`, `syncBase`, `reset`, `MotionState`, `newMotionState`, `MotionInput`, `animate`, `DANCE_BPM`,
`danceBeat`, `DJ_DESK`, `eatPhase`, `DRAW_TIME`, `jointPos`. Consumidores (`components/heist/people/*`,
`components/lab/heist-gente-scenarios.ts`, `locomotion.test.ts`) não precisaram de mudança.

## Por que NENHUM

- **State**: não há máquina de estados de modos de marcha. `MotionState` só guarda o gesto atual/anterior para uma
  mistura de ~0,2 s; a escolha da pose é um `switch` sobre `Motion` refeito do zero a cada quadro, sem transições
  próprias por estado. Classes de estado não acrescentariam nada.
- **Strategy**: os gestos **não** têm a mesma assinatura (`fall(r, st, m, t)`, `sit(r, st, t, grip)`,
  `dance(r, st, t, inp)`, `serve(r, st, walking)`, `talk(r, st, t, walking)`…), e vários se compõem (o despacho chama
  `lower` + `breathe` antes de um gesto de tronco; `holdIdle` reaproveita `drink`/`serve`/`play`/`eat`). Uniformizar as
  assinaturas para uma tabela de estratégias mudaria o contrato interno e o custo por quadro (sem alocação), sem
  problema concreto para resolver. Os estilos de dança (`footwork`/`armStyle`) são `switch` de dados sobre um objeto de
  saída pré-alocado — também não pedem classes.
- **Facade**: `locomotion.ts` agora só compõe e reexporta, mas já era a porta de entrada pública; não se criou camada
  nova, então não se registra como aplicação de padrão.

## Testes e equivalência

`lib/avatar3d/human/locomotion.snapshot.test.ts` (novo) monta os dois corpos (FEMININO 1,65 m e MASCULINO 1,78 m) e
amostra, com `dt` e sementes fixos: os 40 gestos de `MOTIONS` parados, andando (1,3 m/s) e correndo cansados (4,2 m/s);
13 objetos na mão × 8 gestos; dança, DJ (com `scale`), comer, conversar, celular, fã e nocaute em 8 sementes; olhar,
apontar, recuo de tiro, sacar/guardar, cansaço extremo, mira acima do limite; uma sequência com troca de gesto
(mistura) e `dt` acima de 0,1; `eatPhase`, `danceBeat`, constantes, `newMotionState`, `reset`, `jointPos`, e
`cloneRig` + `syncBase`. Cada retrato (quatérnios de todos os ossos + quadril, números arredondados a 6 casas) vira
SHA-256; 590 cenários são resumidos num SHA único. Os valores foram **capturados no código original** (1331 linhas) e
passam sem mudança depois da extração.

| Etapa | Comando | Resultado |
|---|---|---|
| Antes (original) | `npx vitest run lib/avatar3d/human/locomotion.snapshot.test.ts` | 2/2 (SHAs capturados `a0195469…` e `ed6128a0…`) |
| Depois | `npx vitest run lib/avatar3d/human/locomotion` | 2 arquivos, 11/11 (9 de `locomotion.test.ts` + 2 de caracterização) |
| Depois | `npx vitest run lib/avatar3d components/avatar3d components/heist components/lab` | 76 arquivos: 69 ok, 6 falham, 1 skipped; 797 testes ok, 15 falham, 2 skipped |
| Depois | `npx tsc --noEmit` | sem erros |
| Depois | `python3 scripts/refactoring/line_ratchet.py` | `APERTAR lib/avatar3d/human/locomotion.ts: teto 1005 -> 138`; nenhum arquivo novo em violação |

As 15 falhas são as mesmas antes e depois e não envolvem locomoção (preexistentes, fora do lote):
`garment-layers.test.ts` (4), `garments.test.ts` (4), `mould-library.test.ts` (2), `shirt-placket.test.ts` (2),
`shoulder-texture-seam.test.ts` (1), `matriz3d/matriz3d.test.ts` (2). Na execução "antes", `components/heist/people/people-retrato.test.tsx`
também falhou ao carregar (`@react-three/fiber` ausente do `node_modules` em uso naquele momento) e 18 arquivos a
menos foram coletados; com um `node_modules` completo, esse arquivo passa — diferença de ambiente, não de código.

`tsc --noUnusedLocals` só aponta `T2` em `locomotion-kinematics.ts`, temporário já sem uso no original (mantido para não
mudar código movido).

## Pendências

- O integrador roda `python -m scripts.refactoring.line_ratchet --update` para tirar `locomotion.ts` do baseline.
- `lib/heist/types.ts` aparece em violação na catraca (cresceu para 284 > 276), fora deste lote.
