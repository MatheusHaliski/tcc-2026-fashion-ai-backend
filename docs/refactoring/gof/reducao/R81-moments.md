# Lote R81-moments — `MomentService` como Facade

Base: `claude/relaxed-pasteur-5b5466` (`060c640`; merge de `40dd593` antes do commit final, que trouxe Java só do
pacote de selos). Branch: `worktree-agent-a1c0b3f9fbb54f9e4`. Pacote: `fai-application/src/main/java/br/com/fashionai/application/moments/`.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `MomentService.java` (`java-service`, 250) | 1902 | 248 | 17 arquivos, tabela abaixo | **Facade** (estrutural) |

Arquivos novos (todos package-private no pacote `moments`, sem Spring; nenhum é bean):

| Arquivo novo | Linhas | Responsabilidade | Padrão |
|---|---:|---|---|
| `MomentContext` | 70 | as 17 dependências injetadas no serviço + o relógio (único estado mutável, trocado por `useClock`) | NENHUM (objeto de parâmetros) |
| `MomentSupport` (abstrata) | 247 | base dos colaboradores: campos lidos do contexto, `now()`, `LIVE/VISIBLE/ENGAGED` e as regras de acesso compartilhadas (`canSee`, `isMember`, `countryOf`, `inScope`, `visibleLive`, `find`, `visible`, Hype v2, `settings`, `competitive`, `isFlair`, `contextOf`, `participationView`) | NENHUM |
| `MomentRules` | 96 | funções puras: `idOf`, `rounded`, `outcome`, `contextualHype`, `explain`, `strings`, `publiclyListed`, `top`, `nz`, `nonNull`, `index` | NENHUM (funções puras) |
| `MomentInput` | 52 | leitura de pedido: `parseInstant` (hora de parede no fuso do Momento) e `enumOf` (400 em vez de 500) | NENHUM (funções puras) |
| `MomentQueries` | 133 | `home`, `nowBanner`, `calendar`, `list` | NENHUM |
| `MomentDetail` | 109 | `detail`, `participants`, `candidateLooks` | NENHUM |
| `MomentHistory` | 170 | `mine`, `mineSummary`, `badges`, `timeline`, `replay` | NENHUM |
| `MomentContextual` | 109 | `contextFor` (verso do card) e `activeSummary` (Copilot) | NENHUM |
| `MomentParticipationFlow` | 147 | `save`, `unsave`, `fresh`, `join`, `recordCardChallenge`, `leave`, `setProfileVisibility` | NENHUM |
| `MomentSubmissionFlow` | 175 | `preview`, `submit`, `grantBadge`, `ownedScheme` | NENHUM |
| `MomentEvaluator` | 157 | record `Evaluation`, `evaluate` (fatos verificáveis), `subjectOf` (look e peça) | NENHUM |
| `MomentCommunity` | 151 | `visibleSubmissions`, `feed`, `submissionView` (2), `trending` (2) | NENHUM |
| `MomentRanking` | 127 | `leaderboard`, `vote` | NENHUM |
| `MomentGroups` | 186 | FLAIR: `groupMoments`, `groupSummary`, `createGroupMoment`, `slugFor` | NENHUM |
| `MomentLifecycle` | 175 | job: `tick` (sem as anotações), `end`, `memoryLook` | NENHUM |
| `MomentAdmin` | 82 | `adminList`, `adminDetail`, `adminTransition`, `withStatus` | NENHUM |
| `MomentAdminWriter` | 149 | `adminSave` (campos do Momento oficial e desafios) | NENHUM |
| `package-info.java` | 17 | visão e regras gerais dos Momentos (antes no javadoc da classe) | — |

Teste novo: `MomentServiceRetratoTest` (173 linhas) + `MomentRetrato` (93) + retrato `src/test/resources/moments/moment-service-retrato.txt`.

## Como foi dividido

- **Facade.** `MomentService` continua o único bean e mantém: construtor (mesma assinatura — `Kit.build`, Spring e
  `ServiceFakes.FakeMomentService` dependem dela), as constantes públicas (`UPCOMING_DAYS`, `LEADERBOARD_MAX`,
  `FEED_MAX`, `MAX_PRIZE`, `DEFAULT_COOP_POINTS`), os 6 records públicos (`JoinRequest`, `SubmitRequest`, `VoteRequest`,
  `GroupMomentRequest`, `AdminMomentRequest`, `AdminChallengeRequest`), `useClock`, o `@Scheduled` do `tick` e as
  **33 assinaturas públicas** com as mesmas anotações `@Transactional` (30 métodos; nenhuma movida, nenhuma
  acrescentada; `canSee`, `contextualHype` e `useClock` continuam sem transação). Cada método público só delega.
- **Colaboradores criados por chamada** (`new MomentQueries(ctx).home(viewer)`), como no R02: leem o relógio do
  `MomentContext` a cada chamada e não guardam estado. Chamadas entre casos de uso que antes eram auto-invocações
  (`submit → join`, `createGroupMoment → join/detail`, `adminSave → slugFor/adminDetail`, `adminTransition → end`,
  `detail → trending/submissionView`, `home → mineSummary/groupSummary`, `leaderboard → visibleSubmissions`) agora
  são chamadas diretas ao colaborador. Como a auto-invocação nunca passava pelo proxy, a semântica transacional é a
  mesma: tudo roda na transação aberta pelo método público do bean.
- **Corpos movidos sem alteração**, por script (`block` do original → colaborador): `MomentSupport` expõe os mesmos
  nomes de campo (`moments`, `participations`, `guard`…), e funções estáticas/constantes entram por `import static`,
  então as linhas dos métodos ficaram idênticas. Conferido por script: as únicas linhas do original ausentes no
  código novo são campos/atribuições do construtor (agora em `MomentContext`/`MomentSupport`), `now()`/`useClock`
  (relógio no contexto), `private static idOf` → `static`, os 8 separadores de seção e as chamadas entre colaboradores
  listadas acima, além de `ev.match` → `ev.match()` (e `scores/lines/facts`): o record `Evaluation` saiu da classe
  aninhada para `MomentEvaluator`, e o acesso direto ao campo privado só valia dentro do mesmo arquivo.
- **Package-private que só testes chamavam** (`competitive`, `countryOf`, `inScope`, `isFlair`, `hypeScore(s)`,
  `visibleLive`, `end`, `memoryLook`, `grantBadge`, `slugFor`, `submissionView` e os estáticos `rounded`, `strings`,
  `nz`, `nonNull`, `index`, `top`, `explain`, `outcome`, `parseInstant`, `publiclyListed`) saíram do serviço sem
  delegação; os testes do pacote passaram a chamar o dono (`new MomentQueries(svc.ctx).competitive(m)`,
  `MomentRules.rounded(...)`): troca mecânica por script, 69 linhas em 7 classes, nenhuma asserção removida, mesmo
  número de linhas por arquivo. O campo `ctx` do serviço é package-private para esse acesso.
- **Javadoc da classe**: a visão do módulo e as "regras que valem para tudo aqui" passaram para `package-info.java`
  (agora valem para o pacote inteiro); o javadoc do serviço descreve a Facade. Os javadocs dos métodos foram junto
  com o código para os colaboradores.

## Por que Facade (e não outros)

- **Facade:** controllers (`MomentController`, `MomentAdminController`), `FlairChallengeService`, `CopilotService`,
  `AdminService` e o fake de `fai-web` continuam vendo uma interface única e estável, enquanto o subsistema fica em 15
  colaboradores coesos por caso de uso. Não há eventos/listeners de domínio neste serviço (notificações são chamadas
  diretas a `NotificationService`), então não há fase after-commit a preservar (Observer não se aplica).
- **Template Method (base `MomentSupport`):** avaliado e não registrado como padrão: a base só compartilha
  dependências e regras de acesso; não há esqueleto de algoritmo com passos sobrescritos.
- **Strategy (transições do admin, modos FLAIR):** são `switch` pequenos e estáveis; sem variação de algoritmo em
  tempo de execução.
- **Builder (`AdminMomentRequest`/`GroupMomentRequest`):** os records são contrato da API (JSON dos controllers).
- **State (status do Momento):** o status efetivo é derivado do relógio em `MomentTime`; classes de estado não
  simplificariam `tick`/`adminTransition`.

## Testes e equivalência

Caracterização antes da extração: `MomentServiceRetratoTest` percorre num roteiro único todos os métodos públicos
(consultas, ações, envio com pontos, votação, feed, ranking, em alta, histórico, Replay, contexto, FLAIR, admin, job
antes e depois do fim) e compara o retrato textual (chaves ordenadas, UUIDs por fichas, erros por código/status, mais
as chamadas a `points.award` e `notifications.notify`) com o arquivo gravado **no código original** (commit
`6a80555`); rodado 3× no original para confirmar que é determinístico.

| Etapa | Comando | Resultado |
|---|---|---|
| Antes (original), testes do lote | `mvn -B -pl fai-application -am -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest='FlairChallengeServiceAdminTest,FlairChallengeServiceTest,GuideServiceTest,MomentMatchTest,MomentPointsPolicyTest,MomentServiceAcoesTest,MomentServiceComunidadeTest,MomentServiceConsultasTest,MomentServiceGrupoAdminTest,MomentServiceHistoricoTest,MomentServiceJobTest,MomentServiceRulesReviewTest,MomentServiceRulesTest,MomentTimeTest,CopilotServiceTest,AdminServiceTest' test` | 126 testes, 0 falhas |
| Depois, mesma lista + `MomentServiceRetratoTest` | idem com `-o` | **127 testes, 0 falhas** (retrato idêntico) |
| Suíte completa `fai-application`, código original + retrato | `mvn -B -o -pl fai-application -am -Djacoco.skip=true test` | 2024 testes, 0 falhas, 27 skipped |
| Suíte completa `fai-application`, depois | idem | **2024 testes, 0 falhas, 27 skipped** |
| Suíte completa depois do merge da base | idem | 2030 testes (+6 de selos vindos da base), 0 falhas, 27 skipped |
| `fai-web` antes / depois / após merge | `mvn -B -o -pl fai-web -am -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest='ControllerDelegacaoTest' test` | 697 / 697 / 697, 0 falhas (não há teste de controller específico de Momentos; `ServiceFakes` compila sem mudança) |
| Catraca | `python3 scripts/refactoring/line_ratchet.py` | `APERTAR MomentService.java: teto 1902 -> 248`; 0 violações após o merge |

Observação: o primeiro `mvn` precisou rodar sem `-o` para baixar `junit-platform-launcher:6.0.3`, ausente no `~/.m2`.

Sem banco, servidor, rede externa (fora o download do Maven), IA paga, migration ou mudança de DTO/URL/i18n/autorização/transação.

## Pendências

- `python -m scripts.refactoring.line_ratchet --update` fica para o integrador (o baseline não foi tocado).
- `MomentSupport` (247) está perto do limite: uma nova regra de acesso compartilhada deve ir para um colaborador próprio.
