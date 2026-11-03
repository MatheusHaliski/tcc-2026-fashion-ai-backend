# Lote R70-heist-lib — `lib/heist/` (simulação, planta, tipos, IA, combate, aparências)

Base: `claude/relaxed-pasteur-5b5466`. Objetivo: os 6 arquivos do lote dentro do limite da categoria `lib-ts`
(**250** linhas, `docs/refactoring/LINE_RULES.md`), por extração de responsabilidades em arquivos auxiliares, sem
mudar nenhum número, string, ordem, nome de export nem comportamento da simulação.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `sim.ts` | 824 | 89 | `sim-player.ts` (147) — passo da jogadora, ação em andamento, esquiva, cancelamento; `sim-combat.ts` (137) — recarga, tiro, golpe/nocaute, `meleeTarget`, `quickHeal`, garrafa, ruídos pendentes; `sim-prompts.ts` (105) — `promptAt`/`describe`; `sim-interact.ts` (98) — `interact`, esconderijo, conversas, interfone, uniforme; `sim-loot.ts` (83) — pickup, fim do furto, espólio, vitrines/chapelaria, esconderijos; `sim-puzzles.ts` (60); `sim-cutscene.ts` (106) — cena do diamante, alarme, vitória, objetivos/checkpoints, beats; `sim-actions.ts` (105) — vestir, usar carta, equipar, trocar, comprar | NENHUM |
| `level.ts` | 620 | 102 | `level-maze.ts` (54) — `MAZE`, `mazeWalls`, `mazeCell`, `INNER_WALLS`; `level-floor.ts` (21) — alturas e `floorY`; `level-props.ts` (237) — `baseProps`; `level-points.ts` (25) — início, diamante, checkpoints, fila, saídas; `level-people.ts` (128) — `GUARDS`, `CIVILIANS`; `level-interacts.ts` (75) — `INTERACTS`, `CLIMB_TO`, `STASH_REWARD`, `CODES`, `RING_SYMBOLS`, `VENDOR_OFFERS` | NENHUM |
| `types.ts` | 284 | 159 | `types-level.ts` (48) — planta (Vec, salas, portas, formas, móveis, interações); `types-people.ts` (87) — aparências, joias/espólio, animações, seguranças, civis | NENHUM |
| `ai.ts` | 379 | 184 | `ai-walk.ts` (28) — `walkTo`/`OPEN_ALL`; `ai-guards.ts` (188) — `updateGuards`, cobertura, flanco, tiro do segurança | NENHUM |
| `combat.ts` | 252 | 194 | `combat-shot.ts` (65) — `wallDistance` + `castShot` (raio do tiro) e `V3` | NENHUM |
| `looks.ts` | 287 | 229 | `looks-face.ts` (65) — `paintFace` (rosto sintético em canvas) | NENHUM |

Os arquivos originais continuam como ponto de entrada e reexportam tudo o que exportavam (`sim.ts` também exporta
`CHANGE_SWAP`, como antes); nenhum consumidor em `components/` ou `lib/` precisou mudar de import.

## Como foi dividido

- **Movido sem alterar:** os blocos foram recortados por intervalo de linhas (script em Python), com o corpo, nomes,
  comentários e formatação originais. A única mudança textual em código foi acrescentar `export` a funções que agora
  são usadas por outro arquivo (`player`, `combat`, `melee`, `unhide`, `pickup`, `addLoot`, `win`, `progress`,
  `IDLE_INPUT`, `applyWear`, `walkTo`, `OPEN_ALL`…). Conferido por script: todas as linhas não-import dos 6 originais
  existem idênticas nos arquivos novos, exceto `void CIV_R;` (só silenciava import não usado em `sim.ts`; o import
  saiu) e o cabeçalho `/* ---------- rosto sintético ---------- */` de `looks.ts` (virou o cabeçalho de
  `looks-face.ts` e um comentário de reexport). Os imports de cada arquivo listam só o que ele usa.
- **`sim.ts`** ficou com `step`, portas e lasers (o laço do quadro), e reexporta as ações das telas. As dependências
  entre os `sim-*.ts` são só de funções (ciclos de import entre módulos ES só com funções, chamadas em tempo de
  execução, não de inicialização). `isPistol`/`PISTOLS` foram para `sim-combat.ts` (dono do uso principal).
- **`level.ts`** ficou com salas, luz, nível, portas, araras e lasers (a "planta" usada por quase todos os
  consumidores) e reexporta o resto. A ordem de avaliação mantém-se: `INNER_WALLS = mazeWalls()`, `CIVILIANS = civs()`
  e `INTERACTS` (que usa `EXITS`) são calculados uma vez no carregamento, como antes.
- **`types.ts`** (só tipos) foi separado por domínio: planta e personagens; cartas, jogadora, puzzles, eventos, entrada
  e `SimState` ficaram. Reexporta com `export type`.
- **`ai.ts`** manteve os civis e a percepção (`witnessesOfChange`, `watchers`); os seguranças foram para
  `ai-guards.ts` e a locomoção comum para `ai-walk.ts`.

## Por que NENHUM padrão GoF

São módulos de funções puras sobre um estado de dados simples (o `SimState` precisa caber num `structuredClone`).
A divisão é por responsabilidade (passo, combate, prompt, interação, espólio, puzzles, cena, ações; tabelas da planta
por tema). Não há família de variações (o `switch` de `describe`/`interact` mapeia tipos de prompt fixos; um Strategy ou
Command por tipo só espalharia casos de 1 linha), nem fachada nova: `sim.ts`/`level.ts` só reexportam, sem lógica de
orquestração além do `step` que já existia. Os estados do segurança (`stepGuard`) seriam candidatos a State, mas a
troca exige tabela de transições caracterizada e mudaria o formato de dados do checkpoint — fora do escopo.

## Testes e equivalência

Caracterização escrita e executada **no código original** antes da extração (versionada):

- `lib/heist/level.snapshot.test.ts` (83 linhas): SHA-256 do JSON de 23 tabelas/saídas (lista de exports, `ROOMS`,
  `ROOM_LIGHT`, `ROOM_TIER`, `DOORS`, `MAZE`, `mazeWalls()`, `INNER_WALLS`, `mazeCell` em todas as células, alturas,
  `floorY` numa grade de 1 m + degraus, `baseProps()`, `RACKS`, pontos/checkpoints, `LASERS`, `GUARDS`, `CIVILIANS`,
  `INTERACTS`, `CLIMB_TO`, `STASH_REWARD`, `CODES`, `RING_SYMBOLS`, `VENDOR_OFFERS`) + contagens (73 paredes, 220
  móveis, 31 seguranças, 133 civis, 34 interações).
- `lib/heist/sim.snapshot.test.ts` (164 linhas): lista de exports de `sim.ts` e 6 cenários determinísticos que rodam
  `step` a 1/60 s com entradas fixas e acumulam num SHA-256 os eventos de cada quadro, os retornos das ações e o
  `snapshot` final: passeio (andar/correr/agachar/esquiva/garrafa/cura/beat), prompts em todo ponto/arara/civil,
  combate (tiro, recarga, faca, soco, nocaute, drops), puzzles (erros, decodificador, fusíveis, anéis, cena, fuga,
  skip), interações (uniforme, interfone, esconderijos, vitrines, chapelaria, escalada, arara, conversa, furto,
  lasers) e telas (vestir, cartas, troca, compra, equipar). Não há `Math.random` em `lib/heist` (o sorteio é o
  mulberry32 do estado), então não foi preciso `vi.spyOn`.
- `lib/heist/looks.snapshot.test.ts` (45 linhas): `LOOKS`, `PLAYER_DEFAULT`, escolha/tinta/escala por semente,
  `tailored` e `templatesFor` (o `paintFace` precisa de canvas e não entra no retrato; foi movido sem alteração).

| Etapa | Comando | Resultado |
|---|---|---|
| Antes (original) | `npx vitest run lib/heist components/heist` | 7 arquivos, 67 testes, 0 falhas |
| Antes (original + caracterização) | `npx vitest run lib/heist/*.snapshot.test.ts` | 3 arquivos, 11 testes, digests capturados |
| Depois (antes do merge) | `npx vitest run lib/heist components/heist components/lab` | 11 arquivos, 87 testes, 0 falhas (digests idênticos) |
| Depois | `npx tsc --noEmit` | 0 erros |
| Depois (após `git merge claude/relaxed-pasteur-5b5466`) | `npx tsc --noEmit` e `npx vitest run lib/heist components/heist components/lab test-utils` | 0 erros; 23 arquivos, 151 testes, 0 falhas |
| Depois (suíte inteira) | `npx vitest run` | 3241 passaram, 24 falharam em 8 arquivos fora do lote (`lib/avatar3d/**` 6 arquivos, `components/seal-creator.test.tsx`, `app/pages.smoke.test.tsx`). As 8 falhas do smoke são as páginas `lab/heist*` e se repetem idênticas com os `lib/heist/*.ts` originais restaurados (preexistentes); os testes de `lib/avatar3d` e do selo não importam `lib/heist` |
| Depois | `python3 scripts/refactoring/line_ratchet.py` | 0 violações; os 5 congelados do lote como `APERTAR` (sim 820→89, level 432→102, types 276→159, ai 375→184, looks 259→229); `combat.ts` (252, não congelado) deixou de ser violação; nenhum arquivo novo acima do limite |

## Pendências

Nenhuma: os 6 arquivos e os 20 arquivos novos estão dentro de 250 linhas (maior: `level-props.ts`, 237 — a tabela
de móveis, uma responsabilidade só). O integrador deve rodar `python -m scripts.refactoring.line_ratchet --update`.
