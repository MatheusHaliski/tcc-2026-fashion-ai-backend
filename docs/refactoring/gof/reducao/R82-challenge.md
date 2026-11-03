# Lote R82-challenge — `ChallengeService` e `FlairChallengeService` como Facade sobre casos de uso

Base: `claude/relaxed-pasteur-5b5466`. Pacote: `fai-application/src/main/java/br/com/fashionai/application/service/`.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `ChallengeService.java` (`java-service`, 250) | 1852 | 239 | 17 colaboradores + montagem, tabela abaixo | **Facade** (estrutural); Observer mantido |
| `FlairChallengeService.java` (`java-service`, 250) | 1035 | 155 | 9 colaboradores, tabela abaixo | **Facade** (estrutural) |
| `ChallengeServiceTest.java` (`teste`, 400) | 486 | 263 | `ChallengeServiceFixture` (125), `ChallengeServiceRulesTest` (156) | NENHUM |
| `FlairChallengeServiceTest.java` (`teste`, 400) | 432 | 141 | `FlairChallengeServiceFixture` (153), `FlairChallengeServiceCommunityTest` (188) | NENHUM |

Colaboradores do `ChallengeService` (todos `final`, package-private, sem Spring):

| Arquivo novo | Linhas | Responsabilidade |
|---|---:|---|
| `ChallengeParts` | 67 | montagem dos subsistemas, sem ciclos, a partir dos 21 argumentos do construtor do serviço |
| `ChallengeRules` | 131 | regras puras e tabelas: dimensões, temas, regras do Desafio do Dia, blocos, origens, `VOTED`/`SINGLE_SHOT`, datas no fuso, `dayRef`, nome/regra do modelo (i18n), `teamOf`, `round2`, `windowStart`, `mirrorPhotoUrl`, `describe` |
| `ChallengeStore` | 92 | modelo ativo, instância, novo participante, participações ativas e gravação idempotente de evidência |
| `ChallengeParticipations` | 112 | contagem de ativos, limite de 3 (CA06), `mineRaw` e "minhas participações" |
| `ChallengeProgressMeter` | 163 | progresso verificável por modelo (§4) e sequência do Sem Repetir |
| `ChallengeRuleEvaluator` | 100 | blocos de regra sobre um look, cartela da Minha Estação, dias sem uso |
| `ChallengeConclusion` | 179 | `refresh`, conclusão e recompensa por modo (CA12), pontuação do duelo |
| `ChallengeLifecycle` | 170 | ativação com metas pessoais, início antecipado, expiração, job `tick`, aviso da janela do Espelho |
| `ChallengeParams` | 95 | validação dos parâmetros ao criar (peças do 10×10/Cápsula, metas) |
| `ChallengeStartFlow` | 198 | criar, lançar rascunho, convidar (CA04), entrar no desafio da comunidade |
| `ChallengeMembership` | 137 | aceitar, recusar, iniciar com o mínimo, sair (CA11), cancelar |
| `ChallengeEvidenceListeners` | 188 | corpo dos 4 ouvintes (looks, Looks do Dia, espelho, peça cadastrada) dentro do `SideEffectRunner` |
| `ChallengeDetailView` | 238 | visão do desafio, looks inscritos às cegas, card de resultado |
| `ChallengeSocial` | 205 | inscrição de look, feed e voto às cegas, bilhetes e reações |
| `ChallengeRealMirror` | 199 | Espelho de Verdade: foto privada, leitura autorizada, confirmação por colega |
| `ChallengeCatalogView` | 98 | catálogo (CA01/CA02) |
| `ChallengeProposals` | 112 | desafios propostos pela comunidade e promoção pelo admin |
| `ChallengeIntegrations` | 122 | decorações do quarto (CA13), restrição do Vista-me (CA14), resumo do Copilot |

Colaboradores do `FlairChallengeService`:

| Arquivo novo | Linhas | Responsabilidade |
|---|---:|---|
| `FlairChallengeClock` | 25 | relógio compartilhado (o `useClock` dos testes vale para todos depois da construção) |
| `FlairChallengeValues` | 123 | funções puras: visão do Momento, leitura escolhida, leituras no formato do motor, multiplicador/pontos previstos, leitura tolerante de campos |
| `FlairChallengeWindows` | 106 | janela (E1–E3), busca por id/slug, Momento ligado, visibilidade |
| `FlairChallengeViews` | 151 | entregas da pessoa, grupos, resumo do card, visão da entrega |
| `FlairChallengeBuilds` | 210 | montagem conferida, contexto, cartas do motor, retrato, avaliação, linhas de pontos |
| `FlairChallengeReads` | 226 | lista, detalhe, comunidade (I1), memória (E2, D2, I2) |
| `FlairChallengeSubmissions` | 222 | conferir e entregar (atômico), conclusão do grupo, capítulos do Atelier |
| `FlairPrivateChallenges` | 103 | desafio no Momento privado de grupo |
| `FlairChallengeAdmin` | 174 | lista e gravação da administração (R1, P2, A1) |

## Como foi dividido

- O código foi movido por faixas de linhas do original (script de extração), sem alterar corpos. As únicas mudanças nos
  corpos são a qualificação das chamadas que passaram a outro colaborador (`detail(…)` → `views.detail(…)`,
  `record(…)` → `store.record(…)`, `refresh(…)` → `conclusion.refresh(…)`, `now()` → `clock.now()`…); constantes e
  funções puras continuam chamadas sem qualificação por `import static`. Caiu `public` dos métodos movidos e as
  anotações ficaram só no serviço. Um campo foi renomeado para não ser sombreado pela variável local `params` de
  `start` (`parameters.validateParams`).
- **Transação, agendamento e ouvintes**: os dois serviços continuam os únicos beans. Os 24 `@Transactional` do
  `ChallengeService` e os 7 do `FlairChallengeService` (com `readOnly`), o `@Scheduled(cron = "0 */15 * * * *", zone = "America/Sao_Paulo")` do `tick` e os 4
  `@TransactionalEventListener(phase = AFTER_COMMIT, fallbackExecution = true)` (`onSchemeSaved`, `onDailyLook`,
  `onMirror`, `onPieceCreated`) estão nos mesmos métodos públicos; o corpo de cada ouvinte delega para
  `ChallengeEvidenceListeners`, que mantém o `safe(…)` → `SideEffectRunner.run("desafios:<Evento>", …)` idêntico.
  Autochamadas do original (`start` → `detail`, `refresh` → `conclude`, `tick` → `conclude`) continuam sem passar
  pelo proxy, como antes. `ChallengeService` continua implementando `RoomService.DecorationsProvider` e
  `MirrorService.PieceRestrictionProvider`.
- **Autorização**: `guard.requireCanCreate`, `requireOwner`, `requireAdmin`, `deny` e `blocked` foram junto com o corpo
  do caso de uso, na mesma ordem e dentro da transação do método do serviço.
- **Contrato mantido**: construtores (21 e 13 argumentos), constantes públicas, records públicos (`Progress`,
  `StartRequest`, `ProposalRequest`, `Window`, `BuildRequest`, `Line`, `PrivateChallengeRequest`,
  `AdminChallengeRequest`) e os package-private `MirrorUpload`, `Build`, `HIDDEN`; `window(…)` do Flair segue como
  delegação (testes). `ServiceFakes` de `fai-web` compila sem alteração.
- **Package-private sem chamador fora da classe**: foram para os colaboradores sem delegação. Os que tinham chamador
  em testes ou em outra classe tiveram o chamador atualizado para o novo dono: `today`, `mirrorPhotoUrl`, `describe`,
  `dailyRuleBlocks`, `dailyRuleText`, `teamOf`, `windowStart` → `ChallengeRules` (testes); `round2` → `ChallengeRules`
  (`ChallengeRewardSplit`); `evaluate`, `paletteFamilies` → `ChallengeRuleEvaluator` (via `evaluator()` da base de
  testes, com os mesmos repositórios do `Kit`); `storePrivateMirrorPhoto`, `mirrorPhotos` → `ChallengeRealMirror`
  (`ChallengeSecurityTest`, mesmos dublês); `position`, `uuid`, `strings`, `instant`, `accepts` →
  `FlairChallengeValues` (`FlairChallengeServiceAdminTest`). Removidos por não terem uso: o `Logger log` do
  `ChallengeService` e `now()`/`today()` do `FlairChallengeService` (agora em `FlairChallengeClock`).
- **Testes congelados**: `ChallengeServiceTest` e `FlairChallengeServiceTest` foram divididos por tema sobre uma base
  abstrata com o `@BeforeEach` e os atalhos (como no R04); nenhum teste ou asserção foi apagado (18 e 10 testes,
  mesmos nomes). Única troca: `challenges.evaluate/paletteFamilies` → `evaluator().evaluate/paletteFamilies`.

## Por que Facade (e Observer mantido)

- **Facade**: controllers (`ChallengeController`, `FlairChallengeController`) e serviços (`AdminService`,
  `SearchService`, `CopilotService`, `RoomService`, `MirrorService`) continuam falando só com o serviço, que esconde
  17 (e 8) subsistemas coesos e coordena transação, agendamento e ouvintes. `ChallengeParts` só monta os colaboradores
  (sem lógica), para o construtor do serviço não carregar a fiação. Nenhuma interface artificial foi criada.
- **Observer**: os ouvintes transacionais já eram Observer (eventos de domínio publicados por `SchemeService`,
  `DailyLookService`, `MirrorService`, `WardrobeService`); a inscrição (anotação no bean) não mudou, só o corpo saiu.
- **Strategy** para o `switch` por código de modelo em `progress`/`handleLook` foi avaliado e recusado: os casos
  compartilham as mesmas evidências e o mesmo laço por participação, e o catálogo de códigos é dado do banco (V5);
  uma classe por modelo espalharia o laço sem variação real de algoritmo. Nos testes, a base abstrata é só
  reaproveitamento de fixture (NENHUM).

## Testes e equivalência

Caracterização antes: novo `ChallengeServicesContractTest` (3 testes), verde **no código original** (commit
`b9adb51`): conjunto de métodos públicos com tipos genéricos, `@Transactional(readOnly)`, `@Scheduled` e
`@TransactionalEventListener(phase, fallbackExecution)` de cada um; constantes públicas, tipos aninhados e interfaces
implementadas; `@Service` nos dois. Os métodos públicos já tinham cobertura direta nos testes existentes.

Lista do lote: ChallengeServicesContractTest, ChallengeSecurityTest, ChallengeServiceTest, ChallengeServiceRulesTest,
ChallengeConclusionRewardTest, FlairChallengeServiceTest, FlairChallengeServiceCommunityTest,
FlairChallengeServiceAdminTest, CopilotAnswerTest, SearchHypeV2Test, SearchPeopleProfilesTest,
FlairCollectionServicePreviaTest.

```
mvn -B -o -pl fai-application -am -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest='<lista acima>' test
mvn -B -q -o -pl fai-web -am -Djacoco.skip=true -DskipTests install
mvn -B -o -pl fai-application -am -Djacoco.skip=true test
mvn -B -o -pl fai-web -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest='ControllerDelegacaoTest,ContratoRotasPorTagTest' test
python3 scripts/refactoring/line_ratchet.py
```

| Etapa | Resultado |
|---|---|
| Original, 9 classes existentes | 79 testes, 0 falhas |
| Original + `ChallengeServicesContractTest` | 82 testes, 0 falhas |
| Após o Facade do `ChallengeService` | 82 testes, 0 falhas |
| Após dividir os testes e o Facade do `FlairChallengeService` | **82 testes, 0 falhas, 0 erros** (12 classes) |
| `fai-web` install (compila tudo que depende) | BUILD SUCCESS |
| `fai-web` `ControllerDelegacaoTest` + `ContratoRotasPorTagTest` | 698 testes, 0 falhas |
| Suíte completa de `fai-application` (depois) | 2032 testes, 0 falhas, 0 erros, 27 skipped; após o merge da base (R81/R83/R85): 2039, 0 falhas |
| Catraca (após o merge) | os 4 arquivos só como `APERTAR` (1852 → 239, 1035 → 155, 486 → 263, 432 → 141); 3177 arquivos, 0 violações |

Sem banco, servidor, rede externa, IA paga, migration ou mudança de DTO/URL/i18n.

## Pendências

- Nenhum arquivo do lote ficou acima do limite. `scripts/refactoring/line_baseline.json` não foi alterado (o
  integrador roda `--update`; as entradas de `ChallengeService`, `FlairChallengeService`, `ChallengeServiceTest` e
  `FlairChallengeServiceTest` devem sair do baseline).
- `ChallengeDetailView` (238) é o colaborador mais perto do limite; um próximo acréscimo deve extrair a lista de
  membros/entradas antes.
