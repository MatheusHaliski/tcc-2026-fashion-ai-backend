# Lote R92-inventory — `InventoryScoreService` e `FaiPointsService` como Facade sobre colaboradores por caso de uso

Base: `claude/relaxed-pasteur-5b5466` (`bd8e821`). Branch: `worktree-agent-a5e98778303863581`.
Pacote: `fai-application/src/main/java/br/com/fashionai/application/service/`.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `service/InventoryScoreService.java` (`java-service`, 250) | 1178 | 248 | 18 classes, tabela abaixo | **Facade** (estrutural) |
| `service/FaiPointsService.java` (`java-service`, 250) | 411 | 249 | `FaiPointsShop` (166), `FaiPointsRoomItems` (86), `FaiPointsStatements` (30) | **Facade** (estrutural) |

Arquivos novos do Inventory Score (mesmo pacote, sem Spring, nenhum é bean; categoria `java-outro`, limite 250):

| Arquivo novo | Linhas | Responsabilidade | Padrão |
|---|---:|---|---|
| `InventoryScoreContext` | 49 | monta os nove colaboradores uma vez a partir das 14 dependências do construtor (e guarda `optIns` para o job diário) | NENHUM (objeto de parâmetros) |
| `InventoryScoreRubric` | 34 | `WEIGHTS`, `NAMES`, `COMBO_CATEGORIES` e o bloco estático que os preenche | NENHUM (tabela) |
| `InventoryCompleteness` | 99 | regras puras §3.1/§5: `completeness`, `field`, `detected`, `detectedConfidence`, `catalogReady`, `missingFields` | NENHUM (funções puras) |
| `InventoryScoreRules` | 144 | regras puras: `alive`, `available`, `entropy`, `overlap`, `cosine`, `family`, `pairKey`, `comboKeyOf`, `distribution`, `pct`, `lastUse`, `daysSince` | NENHUM (funções puras) |
| `InventoryUsageHistory` | 76 | `usageDays` (diário com antifraude de 24 h) e `exposureDays` (transições de disponibilidade) | NENHUM |
| `InventoryScoreSheet` | 49 | planilha de um cálculo: dados da janela e as saídas que cada dimensão deixa para as seguintes | NENHUM (objeto de dados) |
| `InventoryCatalogDimensions` | 103 | dimensões C (catalogação), D (diversidade) e V (versatilidade) | NENHUM |
| `InventoryUsageDimensions` | 139 | dimensões U (utilização) e R (descoberta) | NENHUM |
| `InventoryRoomDimension` | 75 | dimensão O (organização, a partir do quarto) | NENHUM |
| `InventoryIdentityDimension` | 54 | dimensão I (identidade, Camada 1 do DNA) | NENHUM |
| `InventoryScoreCalculator` | 211 | `load` (janela de 90 dias) e `computeNow` (as 7 dimensões na ordem C, D, U, V, O, R, I, nota, métricas, gravações isoladas) | NENHUM |
| `InventoryScoreRecorder` | 82 | `snapshot` (dia e mês) e `checkAchievements` | NENHUM |
| `InventoryHighlightCards` | 74 | cards de Seus Destaques (`highlights`, `card`) | NENHUM |
| `InventoryProgress` | 116 | `monthDelta`, `evolution`, `records` | NENHUM |
| `InventoryHighlightsTab` | 96 | `highlightsTab`, `suggestedChallenges`, `improvementHints` a partir da nota já calculada | NENHUM |
| `InventoryAlbum` | 46 | Álbum de Combinações (DET-G01) | NENHUM |
| `InventoryRetrospective` | 65 | Retrospectiva do ano (DET-K01) | NENHUM |
| `InventoryRankings` | 165 | `optIn`, `rankings`, `recomputeRankings` (com o record local `Row`), `put`, `num` | NENHUM |

## Como foi dividido

- **InventoryScoreService.** O código foi movido por faixas de linhas do original com um script de extração, sem alterar os
  corpos. `computeNow` tinha 271 linhas sozinho (acima do limite de qualquer arquivo): os blocos `// ---- C` … `// ---- I`
  viraram métodos estáticos das classes de dimensão, cada um abrindo com as variáveis locais lidas da
  `InventoryScoreSheet` (`List<WardrobeItem> all = sheet.all;`, uma por linha) e terminando com as saídas que as dimensões
  seguintes e as métricas usam (`sheet.combos = combos;` etc.), de modo que o corpo de cada bloco ficou idêntico ao original.
  O carregamento da janela (linhas 342–386) virou `InventoryScoreCalculator.load`; a soma da nota, as métricas e as
  gravações seguem em `computeNow`, na mesma ordem. As únicas outras mudanças são qualificadores (`usageDays(` →
  `history.usageDays(`, `exposureDays(` → `history.exposureDays(`, `snapshot(` → `recorder.snapshot(`,
  `checkAchievements(` → `recorder.checkAchievements(`, `monthDelta/evolution/records(` → `progress.…(`,
  `highlights(` → `cards.highlights(`, `InventoryScoreService::alive/available` → `InventoryScoreRules::…`), imports
  estáticos das constantes e regras (os corpos ficam iguais) e a retirada de `public`/`private` das cópias movidas. Um
  script de conferência confirmou que toda linha dos colaboradores, tirados os qualificadores, existe no original — só
  cabeçalhos, campos, construtores, assinaturas, as variáveis lidas da planilha e as chamadas às dimensões são novas.
- O serviço continua o único bean e dono do cache (`compute` com TTL de 1 h), dos 11 `@Transactional` (o `REQUIRES_NEW` de
  `computeIsolated` inclusive), dos 7 `@EventListener` de invalidação e dos 2 `@Scheduled`, nos mesmos métodos públicos.
  Os métodos que liam a nota (`highlightsTab`, `explain`, `improvementHints`, `album`, `rankings`) continuam chamando
  `compute(…, true)` no próprio serviço e passam o `Result` ao colaborador; `dailySnapshots` continua no serviço. O
  snapshot e as conquistas continuam em `SideEffectRunner.run` (transação própria), chamados no mesmo ponto.
- Contrato preservado: construtor de 14 argumentos, constantes públicas, `Band`, `BANDS`, `band`, `Dimension`, `Result`,
  `completeness`, `catalogReady`, `family`; e, por terem chamadores fora da classe (`CopilotDiagnosis`, `DnaSynthesis`,
  testes), os estáticos package-private `combos`, `entropy`, `cosine`, `distribution`, `pct`, `missingFields` e a
  constante `CACHE_TTL`, agora delegando. `ServiceFakes` (fai-web) compila sem alteração.
- Saíram do serviço sem delegação (sem chamador fora da classe, inclusive testes e `fai-web`; agora nos colaboradores):
  os estáticos `WEIGHTS`, `NAMES`, `COMBO_CATEGORIES`, `detected`, `detectedConfidence`, `comboKeyOf`, `lastUse`,
  `daysSince`, os privados `field`, `alive`, `available`, `overlap`, `pairKey`, `card`, `put`, `num`, e os métodos de
  instância package-private `usageDays`, `exposureDays`, `computeNow`, `snapshot`, `checkAchievements`, `monthDelta`,
  `highlights`, `evolution`, `records`, `suggestedChallenges`. Nada foi apagado. O campo package-private `ctx` expõe os
  colaboradores ao teste de caracterização, que passou a chamá-los por ali.
- **FaiPointsService.** `shop`, `tryOn`, `buy(user, sku, requestKey)`, `requestRef` e `repeatedPurchase` foram para
  `FaiPointsShop`; `apply`, `unapply` e `releaseDisplaced` para `FaiPointsRoomItems`; `statement` (extrato na central de
  notificações) para `FaiPointsStatements`, usado por `award` e pela compra. As leituras de saldo/total/nível dentro da loja
  eram autochamadas do bean (`level(user.id())`); agora são `points.level(user.id())` no mesmo objeto (o serviço se passa
  ao construtor da loja), também sem proxy — o comportamento transacional é o mesmo. Ficaram no serviço `Level`, `Award`,
  `ZONE`, `RoomLayoutAccess`, o construtor de 7 argumentos (os testes que passam `null` em várias dependências seguem
  verdes), `award`/`awardIsolated`, `game`, `balance`, `lifetime`, `level`, `account` e as anotações
  8 `@Transactional` (o `readOnly` de `shop` e `account`, o `READ_COMMITTED` de `buy`, os de `apply` e `unapply`), cada um delegando
  numa instrução; `buy(user, sku)` segue chamando `buy(user, sku, null)` do próprio serviço; `requestRef` (usado pelos
  testes) segue como estático package-private delegando.

## Por que Facade (e não Strategy/Composite nas dimensões)

Os consumidores (`HighlightsController`, `WardrobeService`, `CopilotService` e colaboradores, `ChallengeService`,
`DashboardService`, `AdminService`, `MirrorService`, `ServiceFakes`, …) continuam falando só com os dois serviços, que
escondem colaboradores por caso de uso e coordenam cache, transação, eventos e jobs — a estrutura extraída é de fato uma
fachada; não foi criada interface. **Composite/Strategy para as dimensões** foi avaliado e descartado: no original as 7
dimensões não eram uma família de componentes com a mesma assinatura somados, e sim blocos em sequência de um mesmo
método que compartilham resultados intermediários (D produz `combos` que V lê; U produz `forgottenNow` e R produz
`rescued`, lidos pelas métricas) e cuja ordem define a ordem de `dims` e da explicação. Os métodos extraídos mantêm essa
sequência explícita em `computeNow`; uma interface comum esconderia essas dependências sem permitir trocar ou recombinar
dimensões. **Template Method** para os cálculos também não: a soma ponderada é uma única conta sobre o mapa `dims`.
`InventoryScoreSheet` é um objeto de dados do cálculo, não um Builder (não há montagem de produto com passos opcionais).

## Testes e equivalência

Caracterização antes (commit `eef32ab`, no código original): novo `InventoryScoreCharacterizationTest` (208 linhas) com o
cenário `InventoryScoreScenario` (252 linhas) e o retratista `InventoryScorePortrait` (136 linhas). Cenário fixo relativo
ao dia da execução: ids `UUID(0xB00, n)`; 3 pessoas (14+1 peças, 12 e 4 peças); criações ao meio-dia de N dias atrás (a
exposição em dias fica inteira, independente da hora); 9 looks (um arquivado, um com 1 peça, um de hoje que não sobreviveu
24 h); diário MANUAL/SCHEME/DAILY_LOOK com resgates (notas na mesma semana e longe dela, para não depender do dia da
semana) e Looks do Dia em dias seguidos até hoje; transições de disponibilidade; quarto com rótulos e endereços coerentes e
incoerentes; DNA de estilo; snapshots do mês anterior e de dias anteriores; 5 modelos de desafio. O retrato canônico
(chaves e conjuntos ordenados; datas como distância em dias até hoje; meses dos snapshots como distância em meses;
instantes recentes como `<agora>`) cobre `compute` (Result inteiro, cache, `computeIsolated`, invalidações), `computeNow`,
`explain` (8 códigos, inclusive minúsculo e inexistente), `improvementHints`, `highlightsTab` (elegível e não elegível),
`highlights`, `evolution`, `records`, `monthDelta`, `suggestedChallenges`, `album` (2), `usageDays` (2), `exposureDays`,
`optIn` (4), `dailySnapshots`, `recomputeRankings` e as posições gravadas (antes e depois de uma saída), `rankings` (3),
snapshots gravados, conquistas concedidas, `describe`, e as funções puras (`completeness`, `catalogReady`,
`missingFields`, `family`, `detected`, `detectedConfidence` das 15 peças, `lastUse`, `daysSince`, `comboKeyOf`, `combos`,
`entropy`, `cosine`, `distribution`, `pct`, `band` em 16 notas, `BANDS`). A Retrospectiva usa datas absolutas (2023–2025)
num segundo teste. Os retratos (`src/test/resources/inventory/inventory-score-portrait.txt`, 80 linhas, ~34 KB, SHA-256
`3f0552af…`; `inventory-retrospective-portrait.txt`, SHA-256 `495712c3…`) saíram idênticos em 4 execuções seguidas no
original antes de serem versionados (a primeira versão tinha JSON de `Map.of` no cenário, com ordem variável entre JVMs;
o cenário passou a gravar `TreeMap`). Depois da extração, o teste só trocou as chamadas aos métodos que saíram do serviço
(`score.ctx.calculator.computeNow`, `score.ctx.history.usageDays`, `InventoryCompleteness.detected`,
`InventoryScoreRules.lastUse` …) e o retrato saiu byte a byte igual. `FaiPointsService` já tinha cobertura de todos os
métodos públicos com valores exatos (`FaiPointsServiceContaTest`, `FaiPointsShopTest`, `FaiPointsStatementTest`,
`FaiPointsGamesTest`, `RoomInventoryApplyTest`).

```
mvn -B -o -pl fai-application -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false \
    "-Dtest=InventoryScore*Test,InventoryCombo*Test,ScoreBandsTest,FaiPoints*Test,RoomInventoryApplyTest,Copilot*Test,AutopilotScoresTest,MirrorScoresTest,LookPreviewServiceTest" test
mvn -B -q -o -pl fai-web -am -Djacoco.skip=true -DskipTests install
mvn -B -o -pl fai-application -Djacoco.skip=true test
mvn -B -o -pl fai-web -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest='ControllerDelegacaoTest,ContratoRotasPorTagTest' test
python3 scripts/refactoring/line_ratchet.py
```

| Etapa | Resultado |
|---|---|
| Original: testes do lote e consumidores + caracterização | 91 testes, 0 falhas |
| Após os dois Facades (mesmos retratos) | **91 testes, 0 falhas, 0 erros** |
| `install` de `fai-web` com dependências (`ServiceFakes` sem alteração) | sucesso |
| Suíte completa de `fai-application` | 2048 testes, 0 falhas, 0 erros, 27 skipped |
| `fai-web` `ControllerDelegacaoTest` + `ContratoRotasPorTagTest` | 698 testes, 0 falhas |
| Catraca | `InventoryScoreService.java` (1178 → 248) e `FaiPointsService.java` (411 → 249) só como `APERTAR`; 0 violações; nenhum arquivo novo acima do limite |

Sem banco, servidor, rede externa, IA paga, migration ou mudança de DTO/URL/i18n.

## Pendências

- Nenhuma para o limite. `scripts/refactoring/line_baseline.json` não foi alterado (o integrador roda `--update`).
- `FaiPointsService` ficou em 249 linhas: a próxima mudança nele deve antes extrair `account` (visão da conta) ou o enum
  `Level` para um arquivo próprio.
