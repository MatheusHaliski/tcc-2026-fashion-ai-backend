# FLAIR › Partidas: painéis por código (Strategy) e duelo de equipes fora do FlairService

Data: 27/11/2026. Escopo: `components/flair/modes.tsx` (congelado em 422 linhas) e `FlairService.teamBattle`
(`FlairService` congelado em 1063 linhas). Auditoria e notas: `docs/flair/modos-flair/AUDITORIA_PARTIDAS.md`.

## Problema concreto

1. `modes.tsx` tinha o catálogo, o hook de jogada e os 15 painéis de modo no mesmo arquivo; o shell escolhia o painel
   por 15 `{current.code === "X" && <XPanel/>}`. Qualquer recurso comum aos modos (arena do resultado, mão de cartas,
   leitura tática, convite da rede FAI) teria de ser repetido painel a painel num arquivo que não podia crescer.
2. Dar jogo solo às Equipes (adversário da Casa) exigia mexer em `teamBattle`, dentro de um arquivo congelado.

## Decisão

- **Strategy por código de modo** (`PANELS: Record<string, ComponentType<PanelProps>>` em `modes.tsx`): cada painel é
  uma estratégia com a mesma interface (`looks`, `catalog`, `onDone`); o shell só compõe. Os painéis ficam agrupados
  por família em `components/flair/modes/panels-{duels,season,board,cards}.tsx`. Os metadados de cada modo (família,
  tipo de multiplayer, complexidade, mão, cenário) vivem num registro puro, `lib/flair/modes/registry.ts`, lido pelo
  catálogo e pelos painéis: nenhuma regra de modo fica espalhada em `if (code === …)`.
- **Composição** para o que é comum: `ModeOutcome` (arena + detalhe das rodadas), `DeckHand`, `TacticsCard`,
  `OpponentField`/`FaiNetworkPicker` e `ChallengeNetwork` entram em todos os painéis sem herança.
- **Extração de responsabilidade no backend**: `FlairTeamBattles` recebe o duelo de equipes inteiro (pares, registro,
  liga, Atelier) e acrescenta o treino contra a Casa; `FlairService.teamBattle` só delega. O contrato de
  `POST /api/flair/teams/battles` não mudou para códigos de equipe (coberto por `FlairServiceTest`).

## Alternativas descartadas

- Template Method/herança entre painéis: os modos diferem demais no que montam (looks, cartas soltas, tabuleiro,
  territórios); composição de peças comuns resolve sem acoplamento.
- Um registro com os componentes dentro de `lib/`: `lib/` fica sem JSX; o mapa de componentes fica no shell.

## Resultado

`modes.tsx` 422 → 96 linhas (saiu do baseline); `FlairService` 1063 → 984; maior arquivo novo: `FlairTeamBattles` (≈190).
