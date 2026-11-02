# Lote R71-heist-core — núcleo do MET Gala Heist v2 (jogo, pessoas, objetos, áudio, CSS, laboratório)

Base: `claude/relaxed-pasteur-5b5466`. Branch: `worktree-agent-a4d00111273fcaade`. Objetivo: os 6 arquivos do lote
dentro do limite da categoria (`componente`/`lib-ts`/`css` **250**; hooks novos **150**), por extração de
responsabilidades, sem mudar DOM, classes CSS, i18n, acessibilidade, nomes exportados nem números/strings/ordem.
Arquivos de `lib/heist/*` e `components/heist/scene/*` (outros lotes) não foram tocados.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `components/heist/game.tsx` | 417 | 187 | `driver.tsx` (95) — laço por quadro dentro do Canvas; `use-heist-events.ts` (89) — nomes, falas e eventos da simulação; `use-heist-edges.ts` (84) — bordas dos controles e roda de itens; `use-heist-tips.ts` (35) — tutorial gradual; `use-heist-lab.ts` (30) — `window.__heist` e começo em checkpoint; `game-types.ts` (11) — `Panel`, `Stage`, `GUARD_NAMES`, `deckKey` | NENHUM |
| `components/heist/people/people.tsx` | 394 | 128 | `person.ts` (129) — modelo/pessoa, clone vestido, objeto na mão e quadro de animação; `accessories.ts` (89) — gravata, touca e botões do chef, cabelo de casca, frente da peça, joias; `template-builder.tsx` (49) — montagem do modelo; `player-body.tsx` (52) — corpo da jogadora | NENHUM |
| `components/heist/people/holds.ts` | 334 | 186 | `holds-kit.ts` (29) — `painted`, `at`, `wedge`, `box`, `cyl`, `mesh`; `holds-geometry.ts` (85) — geometrias compartilhadas e taças da bandeja; `jewelry.ts` (61) — brincos, colar, lenço (reexportados por `holds.ts`) | NENHUM |
| `components/heist/audio.ts` | 265 | 242 | `audio-tables.ts` (28) — `REVERB`, `FLOOR_STEP`, `CROWD`, `CHORDS`, `BASS` e `impulse()` | NENHUM |
| `components/heist/heist.css` | 296 | 2 | — (índice de `@import`; as 2 linhas finais de "reduzir clarões" foram para o fim de `styles/panels.css`: 157 → 159) | NENHUM |
| `components/lab/heist-gente-scene.tsx` | 277 | 139 | `heist-gente-scenarios.ts` (147) — câmeras, cabine/mesa, geradores e `scenario()`; `Preset` reexportado | NENHUM |

`line_ratchet.py`: `game.tsx` e `people.tsx` (congelados) aparecem só como `APERTAR` (409 → 187, 302 → 128); os
demais arquivos do lote e todos os novos estão dentro do limite, sem `VIOLAÇÃO`. O baseline não foi alterado
(o integrador roda `--update`). As violações restantes listadas são de `components/heist/scene/*` (outro lote).

## Como foi dividido

- **Critério:** uma responsabilidade por arquivo. O código foi **movido sem alteração** (mesmo nome, assinatura e
  corpo); as únicas mudanças são `export` nas declarações movidas, os imports e um cabeçalho por arquivo novo. Os
  trechos de `holds.ts`, `audio.ts`, `people.tsx`, `heist-gente-scene.tsx` e `heist.css` foram movidos por intervalos
  de linhas do original, com asserções sobre as linhas-limite (script em scratchpad, não versionado).
- **`game.tsx`** fica com a composição: estado da partida, efeitos de configuração, painéis, começo/continuar/
  reiniciar e o JSX (idêntico). `Driver` (o `useFrame` do laço) virou componente próprio; os callbacks e efeitos
  coesos viraram hooks `use-heist-*.ts` (≤ 150). Para os hooks, refs e setters que antes eram capturados por fechamento
  passam como parâmetros; refs e setters do React são estáveis, então acrescentá-los às listas de dependência de
  `useCallback`/`useEffect` não muda quando os efeitos rodam. O laço de bordas (`useEffect` sem dependências, um rAF
  por renderização) e `pickWheel` (função recriada a cada render) mantêm a mesma semântica, e o `wheelInfo` mantém a
  dependência só em `hud` (com o mesmo `eslint-disable`).
- **`people.tsx`** fica com a multidão (`HeistPeople`: plano de carga, clones, desenho por distância, lanternas,
  limpeza). A pessoa e seu quadro (`instantiate`, `syncHold`, `drawFor`, `holdEffects`, `toModel`, `talkingOf`, `step`,
  `longSkirt`, `DETAIL`) vão para `person.ts`; os acabamentos presos aos ossos para `accessories.ts`; `TemplateBuilder`
  e `PlayerBody` para arquivos próprios.
- **`holds.ts`** mantém materiais (`mats`), os objetos na mão, violino, ponto, gravata, `placeInHand` e `HOLD_SIDE`, e
  reexporta `makeEarrings`/`makeNecklace`/`makePocketSquare`/`Jewel` de `jewelry.ts` (os consumidores e
  `holds.test.ts` não mudaram).
- **`audio.ts`** mantém a classe `HeistAudio` inteira; as tabelas de dados e a síntese da resposta ao impulso foram
  para `audio-tables.ts`.
- **`heist.css`** já era um índice de `@import` (`styles/hud.css`, `styles/panels.css`), mas duas linhas tinham sido
  acrescentadas depois da divisão (regra "reduzir clarões"). Foram movidas para o fim de `panels.css`, preservando a
  ordem da cascata.

## Por que NENHUM padrão GoF

- `game.tsx`: hooks React por responsabilidade (eventos, tutorial, bordas, laboratório) e um componente de quadro;
  não há família de variações (Strategy), cadeia (Chain of Responsibility) nem fachada nova — o componente já é a
  composição. Um "mediator" entre hooks seria estrutura artificial.
- `people.tsx`/`holds.ts`: funções de montagem de geometria e de animação por pessoa; os clones compartilhando
  geometrias e materiais já existiam (compartilhamento do three, não um Flyweight introduzido aqui).
- `audio.ts`: tabelas de dados e uma função pura; `heist.css` e `heist-gente-scene.tsx`: separação de dados/estilos.

## Testes e equivalência

Caracterização escrita **antes** da extração e executada no código original (snapshots gravados no original e
versionados junto):

- `components/heist/people/holds-retrato.test.ts` (4): árvore Three.js de cada objeto (nome, tipo, posição, giro,
  escala, sombra, `renderOrder`, chaves de `userData`, geometria com vértices/índice/cores/uv/caixa, materiais com cor
  e propriedades) → nomes dos nós, contagem de malhas e SHA-256; `HOLD_SIDE`; `placeInHand` com um rig falso.
- `components/heist/audio-retrato.test.ts` (1): AudioContext falso que registra cada nó, ligação, parâmetro, início e
  parada; `Math.random` determinístico; sessão cobrindo agendador da música, 13 salas, intensidades, 30 efeitos (com e
  sem posição, com oclusão), alarme, batimento, `duck`, passos em 3 calçados × 8 pisos → contagens por tipo de nó e
  SHA-256 do registro e das amostras.
- `components/heist/people/people-retrato.test.tsx` (2, jsdom): `HeistPeople` com fiber falso e `HumanAvatar` stub —
  DOM antes/depois de 3 quadros, propriedades de cada avatar (modelos montados, dois por vez, dos mais perto primeiro),
  `window.__heistPeople` e chamadas de `onProgress`, em qualidade alta e baixa.
- `components/lab/heist-gente-scene.test.tsx` (14, jsdom): para as 13 cenas, DOM montado, SceneView em 0 s/0,7 s/2,9 s
  (jogadora legível; figurantes como contagem + SHA-256 + os dois primeiros), `__heistGenteInfo` e ambiente; `at` fixo.
- `components/heist/game-retrato.test.tsx` (4, jsdom): `HeistGame` com fiber/cena/câmera falsos — DOM do briefing e
  depois de "Começar o golpe" (HUD, dica, classes, props do canvas), qualidade baixa + depuração, `window.__heist`
  (chaves, `loading`, `startAt="cofre"`, `hurt`, `takeDiamond`) e limpeza ao desmontar.

| Etapa | Comando | Resultado |
|---|---|---|
| Antes (original, testes existentes) | `npx vitest run components/heist components/lab "app/(site)/lab"` | 6 arquivos, 37 testes, 0 falhas |
| Antes (original + caracterização) | mesmos arquivos de retrato acima | 5 arquivos, 25 testes; 25 snapshots gravados |
| Depois | `npx vitest run components/heist components/lab "app/(site)/lab"` | 11 arquivos, 62 testes, 0 falhas; nenhum snapshot reescrito |
| Depois (+ FLAIR) | idem + `components/flair/heist-deck.test.tsx` | 12 arquivos, 66 testes, 0 falhas |
| CSS | `cat styles/hud.css styles/panels.css \| cmp - heist.css(original)` | idêntico byte a byte; `npx stylelint` nos dois arquivos: 0 erros |
| Tipos | `npx tsc --noEmit -p .` | 0 erros (`--noUnusedLocals`: nenhum nos arquivos do lote) |
| Catraca | `python3 scripts/refactoring/line_ratchet.py` | lote só como `APERTAR` (game 409→187, people 302→128); nenhuma violação em arquivos do lote ou novos |

## Pendências

Nenhuma do lote: os 6 arquivos estão dentro do limite (maior: `audio.ts`, 242). Falta só o integrador rodar
`python -m scripts.refactoring.line_ratchet --update` para tirar `game.tsx` e `people.tsx` do baseline.
`components/heist/heist.css` (`css`) não é coberto por `npm run lint:styles` (a lista do script só inclui
`app/(site)`); foi verificado com `npx stylelint` direto.
