# Módulo 09 — FLAIR, cartas, decks, modos, jogos e desafios: lote CHALLENGE-REWARD-SPLIT-001

Base: `bcaee73` (main após PR #416). Branch: `gof/09-flair`. `git status --short` limpo antes do lote.

## Mapeamento real (confirmado no código)

Arquivos grandes do domínio: `ChallengeService` (1888 linhas), `FlairModesService` (1643), `FlairService` (1117),
`FlairChallengeService` (1035), `FlairLooks` (818), `FlairEngine` (365), `FlairCollectionService` (309). Entidades
confirmadas em `fai-domain`: `ChallengeTemplate`, `ChallengeInstance`, `ChallengeParticipant`, `ChallengeEvent`,
`ChallengeVote`, `ChallengeNote`, `CommunityTrend`, `FlairProfile`, `FlairCardInstance`, `FlairChallenge`,
`FlairChallengeSubmission`, `FlairCombination`, `FlairMatch`, `FlairMatchEntry`, `FlairModeState`, `FlairTeam`,
`FlairTeamMember`, `FlairTerritory`, `FlairTrophy` (+ `FlairCoinEntry`, `FlairRedemption`, `FlairChallengeGroup`,
`MomentChallenge`).

Fluxo do lote (conclusão de desafio, CA12):
`/challenges/[id]` → `ChallengeController` (`fai-web`) → `ChallengeService.conclude` (`@Transactional`), chamado por
`refresh` (meta atingida), `tick()` (`@Scheduled` a cada 15 min, desafios vencidos) e testes
→ `refreshProgressOnly` → `ChallengeParticipantRepository` → `duelScores` (votos às cegas via `ChallengeEventRepository`
/`ChallengeVoteRepository`, ou recorde pessoal via `progress`) → **`ChallengeRewardSplit`** (novo, puro)
→ `reward()` (status `CONCLUIU` + `FaiPointsService.award(user, "CHALLENGE_COMPLETED", "CHALLENGE", instanceId, pts)`)
→ `ChallengeInstance.resultJson` → `NotificationService` (`CHALLENGE_RESULT`) → `resultCard`/`detail` na página.

## Problema concreto e decisão

`conclude()` tinha um `switch (mode)` de ~55 linhas misturando três políticas de divisão de prêmio (equipe, duelo
individual/por times, solo/comunidade) com I/O (consulta de usernames, concessão de pontos, persistência). As regras de
pontos (piso de 25 %, pote médio dividido em partes inteiras, ¼ do prêmio para quem perde o duelo, empate = vitória
para todos, time nulo conta como A) não tinham teste direto: os testes existentes só checavam chaves do resultado.

Decisão: **Strategy (enum)** — `ChallengeRewardSplit { TEAM, DUEL, INDIVIDUAL }`, escolhida por `forMode(mode)`, com
`split(members, scores, reward) → Outcome(summary, points, winners)`. É variação real de política por modo (o prompt
cita "Strategy para regras de modo"), e o enum evita interface + 3 classes + registro Spring. A classe é
package-private, sem Spring, repositório, relógio, i18n ou concessão de pontos.

Permanecem no serviço, sem alteração: `@Transactional`, guarda `CONCLUIDO` (conclusão uma só vez), `refreshProgressOnly`,
`duelScores`, a chave `scoring` (depende de `VOTED` + `Msg`), lookup de usernames de `winners`/`ranking`, `reward()`
(marca `CONCLUIU` e só concede se `pts > 0`), persistência e notificações. A ordem das chaves do `resultJson` e a ordem
das chamadas `award` (ordem dos membros) foram preservadas e são verificadas por teste.

Detalhe de preservação: o progresso (`BigDecimal`) só é convertido para `double` nas estratégias que o usam
(TEAM/INDIVIDUAL), como antes — no duelo um progresso nulo continua não sendo lido.

### Padrões avaliados e não aplicados neste lote

- **State (RASCUNHO → AGUARDANDO → ATIVO → CONCLUIDO/EXPIRADO):** as transições estão espalhadas em `start`,
  `launchDraft`, `accept`, `startNow`, `cancel`, `leave`, `tick`, `conclude`, todas `@Transactional` com autorização
  própria; extrair exige mover lógica entre métodos transacionais — fica para lote com caracterização de cada transição.
- **Command (participação/entrega idempotente):** a idempotência já é garantida por `record()` +
  `existsBy...RefId` (uq_ch_evt) e por `FaiPointsService.award` idempotente; um Command não resolveria problema atual.
- **Observer (pontos uma vez):** os listeners `@TransactionalEventListener(AFTER_COMMIT)` já são o Observer do Spring;
  nada a acrescentar.
- **Interpreter (blocos de regra `evaluate`):** existe uma mini-linguagem de blocos (`color_family`, `monochrome`…), mas
  `evaluate` depende de `daysUnused` (repositório do diário); extrair exigiria um port — candidato a lote futuro.
- **Factory Method/Abstract Factory (decks/desafios), Composite, Memento:** sem família coerente/edição reversível no
  trecho tocado. **Singleton:** nenhum manual.
- FLAIR (`FlairModesService`, `FlairService`, `FlairChallengeService`) não foi tocado neste lote.

## Verificação (executada)

| Etapa | Comando | Resultado |
|---|---|---|
| Caracterização **antes** (código original): `ChallengeConclusionRewardTest` (10 testes: equipe com pote/divisão inteira/piso e quem saiu, solo/comunidade com teto/piso e `fraction` do 1º membro, duelo individual com empate, duelo zerado, duelo por times com time nulo = A e empate de times, ordem das chaves do resultado, ordem das chamadas `award`, conclusão uma só vez) + testes existentes | `mvn -B -pl fai-application -Dtest='ChallengeConclusionRewardTest,ChallengeServiceTest,ChallengeSecurityTest' -Dsurefire.failIfNoSpecifiedTests=false test` | 33 testes, 0 falhas |
| Depois da extração + `ChallengeRewardSplitTest` (8 testes puros: seleção por modo, piso exato de 25 %, equipe vazia, teto 100 %, duelo sem ler progresso, times zerados) + consumidores do `ChallengeService` no módulo | `mvn -B -pl fai-application -Dtest='ChallengeConclusionRewardTest,ChallengeRewardSplitTest,ChallengeServiceTest,ChallengeSecurityTest,CopilotAnswerTest,SearchHypeV2Test,SearchPeopleProfilesTest' -Dsurefire.failIfNoSpecifiedTests=false test` | 63 testes, 0 falhas |
| Catraca de tamanho | `python /home/user/tcc-2026-fashion-ai-backend/scripts/refactoring/line_ratchet.py` | `ChallengeService` 1888 → 1852 (APERTAR); 0 violações nos arquivos do lote (7 violações preexistentes em arquivos de outros lotes, por a worktree partir de `bcaee73`) |

Suíte completa não executada (máquina compartilhada; brief pede só os testes necessários). Sem banco, servidor,
rede, GPU ou dados reais. Os testes não dependem do relógio (frações/recordes fixados; participantes em `CONCLUIU` não
são recalculados).

Logs: `evidence/09-challenge-reward-baseline.log`, `evidence/09-challenge-reward-after.log`.

## Métricas

| Arquivo | Antes | Depois |
|---|---|---|
| `ChallengeService.java` | 1888 linhas | 1852 (−36) |
| `conclude()` | ~73 linhas | ~37 |
| `ChallengeRewardSplit.java` (novo) | — | 117 |
| Runtime combinado | 1888 | 1969 (+81: javadoc, records `Member`/`Outcome`, assinaturas das estratégias) |
| Testes novos | — | `ChallengeConclusionRewardTest` 234 linhas, `ChallengeRewardSplitTest` 89 linhas |

## Contratos preservados

URLs, DTOs, `resultJson` (chaves e ordem: `code, name, mode, concludedAt` + `teamFraction, rewardEach` | `scoring,
teams?, winners, ranking` | `fraction?`), valores de pontos por modo, código `CHALLENGE_COMPLETED`/`CHALLENGE`/instanceId
na concessão, `@Transactional`, idempotência da conclusão, notificações e chaves i18n. Sem mudança de schema, migration,
configuração ou frontend.

## Riscos e pendências do domínio 09

- `ChallengeService` continua PARTIAL (1852 linhas): `progress()` (switch por código de desafio), `handleLook()` (switch
  de evidências) e `evaluate()` (blocos de regra) são os próximos candidatos (Strategy por código de desafio /
  Interpreter com port de "dias sem uso"), exigindo caracterização com relógio controlado (`today()` é estático hoje).
- `FlairModesService` (1643), `FlairService` (1117), `FlairChallengeService` (1035) e `FlairLooks` (818) não foram
  tocados; raridades, propriedade de cartas, bloqueio de entregues e janelas de Momentos seguem sem lote GoF.
- Ordem do `ranking` em empate de pontuação depende da ordem de um `HashMap` (comportamento preexistente, mantido).
