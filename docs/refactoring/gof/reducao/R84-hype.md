# Lote R84-hype — `HypeQueryService` como Facade; job, cálculo, configuração e marcos por responsabilidade

Base: `claude/relaxed-pasteur-5b5466`. Branch: `worktree-agent-aebea2ff79a070fc5`.
Pacote: `fai-application/src/main/java/br/com/fashionai/application/hype/`.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `HypeQueryService.java` (`java-service`, 250) | 1512 | 248 | 13 colaboradores, tabela abaixo | **Facade** (estrutural) |
| `HypeSnapshotService.java` (`java-service`, 250) | 530 | 225 | `HypeSnapshotWriter` (216), `HypePieceEntries` (118), `HypeSchemeEntries` (100), `HypeSignalHistory` (64) | NENHUM |
| `HypeCalculator.java` (`java-outro`, 250) | 379 | 229 | `HypeReasons` (99), `HypeRawMeasures` (56), `HypeMath` (48), `HypeAggregation` (47) | NENHUM |
| `HypeScoreConfig.java` (`java-outro`, 250) | 283 | 215 | `HypeConfigParsing` (84) | NENHUM |
| `HypeMilestoneNotifier.java` (`java-outro`, 250) | 263 | 206 | `HypeMilestoneDigestText` (78) | NENHUM |
| `src/test/.../hype/HypeMilestoneTest.java` (`teste`, 400) | 424 | 329 | `HypeMilestoneDetectionTest` (134) | — |

Colaboradores do `HypeQueryService` (todos `final`, package-private, sem Spring; criados uma vez no construtor):

| Arquivo novo | Linhas | Responsabilidade |
|---|---:|---|
| `HypeReadCore` | 202 | dependências (repositórios, guard, serviços, cache) + setters opcionais; visibilidade (`canView`, `visible`, `views`), `summary` do card, `lookPieces`, `currentOf`, `monthAverage`, `publicPool` |
| `HypeCards` | 51 | mapeamento puro: `dimensions`, `num`, `point` |
| `HypeRankFilters` | 79 | recortes puros: região, país, categorias/subcategorias, `trendOf`, `categoryOrder`, `taxonomyLabel`, `round1`/`blank`/`norm`/`upper` |
| `HypeStyleProfiles` | 52 | `profileOf` (DNA, peça, look) e `colorsOf` |
| `HypeEntityReads` | 119 | `summaries`, `detail`, `history` |
| `HypeTrending` | 89 | `trending`, `rank` |
| `HypeGroupRanking` | 213 | `trendingGroups`, `rankGroups`, `groupRows`, `officialBrandSlugs`, `creatorOptOuts` |
| `HypeGroupChips` | 137 | `groups`, `groupKeys`, `groupTable`, `groupView`, `emptyGroup` |
| `HypePersonalHype` | 215 | `Owned`, `owned`, `wardrobe`, `rediscoveries`, `movers`, `isMoving`, `value`, `averageSeries`, `pieceCard`, `lookCard` |
| `HypeRegionalRanking` | 141 | `ranking`, `rankRegional` |
| `HypeRankingFacets` | 120 | `rankingFacets`, `facets` |
| `HypeRankingPositions` | 96 | `positions`, `position` |
| `HypeGlobe` / `HypeGlobeAggregate` | 173 / 147 | globo: filtros, destaque visível e mini cards / agregados por país e região, cor dominante, `mostFrequent` |

## Como foi dividido

- **HypeQueryService**: os métodos foram movidos por faixas de linhas do original (script), sem mudar nome, assinatura
  ou corpo; as únicas mudanças são a qualificação do que passou para a base (`pieces.` → `core.pieces.`,
  `summary(` → `core.summary(`, `canView(` → `core.canView(`…), as referências de método (`HypeQueryService::trendOf` →
  `HypeRankFilters::trendOf`, `::point` → `HypeCards::point`, `::value` → `HypePersonalHype::value`) e as chamadas entre
  colaboradores (`groupRows` → `ranking.groupRows`, `globeAggregate` → `aggregate.globeAggregate`). Utilitários,
  constantes e estáticos públicos entram por `import static`, então os corpos ficaram idênticos.
- O serviço continua o único bean: **as 12 anotações `@Transactional(readOnly = true)`** ficaram nos mesmos métodos
  públicos (`trendingGroups` continua sem anotação, como antes); os dois construtores (11 e 12 argumentos), os setters
  opcionais (`setPreferences`, `setFashionDrops`, que agora gravam na base e por isso valem depois da construção), o
  `enum RankGroup`, as constantes (`MAX_BATCH`, `MAX_GROUP_KEYS`, `RANKING_MAX_SIZE`, `GLOBE_MIN_ITEMS` públicas;
  `FORGOTTEN_DAYS`, `MIN_GROUP_ITEMS`, `GROUP_TOP_ITEMS`, `NO_REGION`, `POSITIONS_WINDOW`, `GLOBE_TOP_CANDIDATES`) e os
  estáticos públicos (`profileOf` ×3, `colorsOf`, `brandKey`, `idleDays`) não mudaram. Nos colaboradores os métodos são
  package-private e sem anotação (chamados de dentro da transação do bean).
- Autorização/visibilidade: `canView`, `guard.canView` e o filtro de bloqueio foram junto com o corpo de cada caso de
  uso, na mesma ordem. Autochamadas do original (`lookPieces`/`ranking`/`globe` → `currentOf`) passam a chamar
  `core.currentOf` direto — o mesmo comportamento sem proxy de antes; a única diferença teórica é para subclasses que
  sobrescrevessem só `currentOf` (o `FakeHypeQueryService` de `fai-web` sobrescreve todos os públicos e não chama a base).
- Membros package-private mantidos como delegação porque testes do pacote os usam: `summary`, `rank`, `creatorOptOuts`,
  `isMoving`. Saíram sem delegação (sem chamador fora da classe): `canView` ×2, `visible`, `lookPieces`, `point`, `num`,
  `dimensions`, `put`, `rankGroups`, `groupRows`, `officialBrandSlugs`, `groupKeys`, `groupTable`, `groupView`,
  `emptyGroup`, `monthAverage`, `views`, `Owned`/`owned`, `rediscoveries`, `value`, `averageSeries`, `pieceCard`,
  `lookCard`, `rankRegional`, `facets`, `position`, `publicPool`, os filtros estáticos, `globeLevel`, `globeCandidates`,
  `globeAggregate`, `globeCountry`, `mostFrequent`, `globeColors`, `globeCards`, `globeCard` (o único uso de teste,
  `HypeQueryService.dimensions` no novo retrato do job, passou a `HypeCards.dimensions`).
- **HypeSnapshotService** continua dono de `@Transactional`/`@Scheduled`/`synchronized` em `recalculate()`, dos records
  `Entry` e `Lifetime`, de `place`, `csvOf`, `ageDays`, `trim` (este passou de `private` a package-private para os
  montadores de entradas) e do mapa `byType` da execução (compartilhado com o `HypeSnapshotWriter`). Delegam:
  `signalCounts`, `lifetime`, `publicPiece`, `cohortKey`, `limitedEdition`, `attributeKeys` (usado por `LensReading`/
  `LensViews` e testes), `surprise`, `publicScheme`, `pieceEntries`, `schemeEntries`, `persist`, `milestones`. Saíram sem
  delegação: `lookKeys`, `deltaBase`, `reason`, `dimensions(Map)`, `dec`.
- **HypeCalculator** mantém `compute`, `baseline`, `direction`, `Baseline`, as constantes e o corpo de `compute` idêntico
  (os utilitários `at`, `clamp`, `round`, `sigmoid` e `reasons` entram por `import static`). Delegam: `rawPopularity`,
  `smoothedRate`, `isInteraction` (`HypeSignalSeries`, `HypeSnapshotService`), `weighted`, `momentum`, `normalize`,
  `sum` (`HypeSignalSeries`). `interactions`, `exposure`, `hasEngagementData` (antes privados) estão em `HypeRawMeasures`.
- **HypeScoreConfig**: a leitura tolerante das propriedades (`dimensions`, `signals`, `pairs`, `thresholds`) foi para
  `HypeConfigParsing`; o construtor chama `HypeConfigParsing.x(...)`; getters, `level`, `describe` sem mudança.
- **HypeMilestoneNotifier**: o texto/payload do resumo (`content`, `rank`, `append`) foi para `HypeMilestoneDigestText`;
  o notifier mantém o record `Content`, as constantes, `shortName`, o listener e a delegação `content`. Construtores
  inalterados (o teste que proíbe `ApplicationEventPublisher`/`HypeSnapshotService` entre as dependências continua verde).
- **HypeMilestoneTest**: os três testes de detecção no job (`milestones` e publicação depois de gravar, com
  `strongInputs`) foram movidos sem alteração para `HypeMilestoneDetectionTest`; nenhuma asserção foi apagada.

## Por que Facade (HypeQueryService) e NENHUM (demais)

- **Facade**: `HypeController`, `InsightService`/`PublicInsights`/`ProfileInsights`/`PersonalInsights`,
  `InstitutionalService`, `SealService`, `RoomService`, `CopilotService`, `LookScorer`, `MomentService` e outros continuam
  falando só com `HypeQueryService`, que esconde 13 subsistemas coesos e fica com as transações. Nenhuma interface
  artificial foi criada.
- **HypeCalculator — Strategy/Composite avaliados e recusados**: as dimensões não são componentes com a mesma assinatura;
  são trechos de um único `compute` que compartilham variáveis (janela, `rawCur`, `alpha`, sinais) e escrevem no mesmo
  `EnumMap`. Transformá-las em estratégias mudaria a estrutura e o risco numérico sem resolver problema concreto.
- **HypeSnapshotService**: o serviço segue orquestrando um único fluxo (ler → montar entradas → gravar); peças e looks
  têm algoritmos e entradas diferentes (não intercambiáveis), então não é Strategy; o job não esconde subsistemas de
  clientes externos (só o `recalculate`), então não se registra Facade.
- **HypeScoreConfig / HypeMilestoneNotifier**: extração de funções puras (parsing, texto); sem variação de algoritmo.

## Testes e equivalência

Caracterização antes (commit `880e94d`, verde no código original) — retratos textuais em
`fai-application/src/test/resources/hype/golden/`, gerados pelo `HypeGolden` (ordem do JSON mantida em mapas com ordem,
mapas sem ordem ordenados pela chave, números com `Double.toString` = equivalência numérica exata):

- `HypeCalculatorGoldenTest` (3 testes): 100 entradas fixas por semente (duas configurações), com régua cheia e vazia,
  retrato de status, score, faixa, dimensões, momento, motivos, sinais e direção; e a configuração (`describe`, pesos,
  pesos de sinal, faixas de −5 a 105, entradas inválidas).
- `HypeSnapshotGoldenTest` (1 teste): `recalculate()` num universo fixo (18 peças + arquivada, 5 looks com remix em 2
  gerações, sinais diários, histórico anterior, estado e snapshots já gravados) — retrato de tudo o que é gravado,
  apagado e publicado (3 marcos).
- `HypeQueryGoldenTest` (1 teste): todos os 13 públicos de leitura do `HypeQueryService` (cards, detalhe de peça e de look,
  histórico, Em alta ×6, ranking ×6 + recorte, filtros ×6 + recorte, posições ×2, globo ×6 + recorte, grupos ×6, chips ×2,
  painel pessoal e quem subiu/caiu) num universo fixo com bloqueio, privados e Fashion Card.

Observação: o `byType` gravado em `signalsJson` nasce de `Map.of(current, previous, total)`, cuja ordem muda a cada JVM
(comportamento pré-existente). O retrato do job passou a ordenar só esses três campos; o retrato regravado é idêntico ao
original normalizado da mesma forma (conferido por script).

```
mvn -B -q -o -pl fai-application -am -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest='br.com.fashionai.application.hype.*Test' test
mvn -B -q -o -pl fai-web -am -Djacoco.skip=true -DskipTests install
mvn -B -o -pl fai-application -Djacoco.skip=true test
mvn -B -o -pl fai-web -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest='ControllerDelegacaoTest,HypeController*Test,InsightsAccessTest' test
python3 scripts/refactoring/line_ratchet.py
```

| Etapa | Resultado |
|---|---|
| Original, pacote `hype` (19 classes) | 125 testes, 0 falhas, 0 erros |
| Original + retratos | 130 testes, 0 falhas |
| Após calculadora, configuração, marcos e job | 130 testes, 0 falhas |
| Após o Facade do `HypeQueryService` e a divisão do `HypeMilestoneTest` (23 classes) | **130 testes, 0 falhas, 0 erros** (retratos estáveis em 4 execuções seguidas) |
| `fai-web` install (compila tudo que depende; `ServiceFakes` sem alteração) | BUILD SUCCESS |
| Suíte completa de `fai-application` | 2034 testes, 0 falhas, 0 erros, 27 skipped |
| `fai-web` `ControllerDelegacaoTest`, `HypeController*Test`, `InsightsAccessTest` | 706 testes, 0 falhas, 0 erros (a seleção inclui os testes de controller do pacote) |
| Catraca | os 6 arquivos do lote só como `APERTAR` (1512 → 248, 530 → 225, 379 → 229, 283 → 215, 263 → 206, 424 → 329); nenhum arquivo novo acima do limite; 0 violações |

Sem banco, servidor, rede externa, IA paga, migration ou mudança de DTO/URL/i18n/JSON.

## Pendências

- `HypeQueryService` ficou com 248 linhas (limite 250): o que sobra é contrato (14 públicos, 12 com `@Transactional`,
  construtores, setters, `RankGroup`, constantes e estáticos públicos). Novo caso de uso deve nascer num colaborador.
- `scripts/refactoring/line_baseline.json` não foi alterado (o integrador roda `--update`).
