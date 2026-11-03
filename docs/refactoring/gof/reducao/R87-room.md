# Lote R87-room — `RoomService` como Facade sobre colaboradores por caso de uso

Base: `claude/relaxed-pasteur-5b5466` (`6f8b647`). Branch: `worktree-agent-ae6c621d9995caf31`.
Pacote: `fai-application/src/main/java/br/com/fashionai/application/service/`.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `service/RoomService.java` (`java-service`, 250) | 1436 | 246 | 15 classes, tabela abaixo | **Facade** (estrutural) |

Arquivos novos (todos no mesmo pacote, sem Spring, nenhum é bean; categoria `java-outro`, limite 250):

| Arquivo novo | Linhas | Responsabilidade | Padrão |
|---|---:|---|---|
| `RoomLayoutPort` (abstrata) | 71 | a porta `FaiPointsService.RoomLayoutAccess` (RF35) da fachada: `levelOf`, `layout`, `setLevel`, `compatibleModules`, `applyFinish`, `resetFinish` (com as mesmas `@Override`/`@Transactional`), `labels`/`labelSources` (lidos por `InventoryScoreService`) e `defaultModules` | parte da Facade |
| `RoomContext` | 100 | as 21 dependências injetadas + os 9 colaboradores, montados uma vez na ordem de dependência | NENHUM (objeto de parâmetros) |
| `RoomModules` | 142 | regras puras do JSON do layout: `module` (fábrica de módulo), `defaultModules`, `modules`, `module(layout, id)`, `capacity`, `labels`, `labelSources`, `saveLabels`, `keys`, `positions` | NENHUM (funções puras) |
| `RoomPlacement` | 147 | regras puras da atribuição automática (CA02/CA07): record `Occupancy`, `freeIn`, `freeHanger`, `freeDrawer`, `place` | NENHUM (funções puras) |
| `RoomPieceStates` | 128 | regras puras dos estados (§1.2): `period`, `seasonalDecoration`, `lastUse`, `forgotten`, `pieceSummary`, `statesOf` | NENHUM (funções puras) |
| `RoomModuleViews` | 59 | regra pura: visão de cada módulo na cena (gavetas, cabides das portas, rótulo acessível) | NENHUM (função pura) |
| `RoomFurniture` | 147 | o móvel: `levelOf`, `layout` (criação e mescla dos módulos do nível), `setLevel`, `compatibleModules`, `applyFinish`, `resetFinish` | NENHUM |
| `RoomAddressing` | 138 | endereçamento (§1.1): `entries` (com reparo no lugar), `autoAssign`, `automaticEntry`, `onPieceDeleted`, `locate`, `locateAll`, `outOfSeason` | NENHUM |
| `RoomAmbience` | 104 | `closetLights` (RF29), `setLight`, `setMonogram` | NENHUM |
| `RoomKeys` | 73 | Chave do Quarto: `giveKey`, `hasKey`, `keyUserIds` (com o mesmo logger `RoomService`) | NENHUM |
| `RoomScene` | 242 | a cena: `room`, `tour`, `render`, `dailyLookPieces`, `listView`, `open` | NENHUM |
| `RoomMoves` | 163 | ações: `owned`, `move`, `renameDrawer`, `showInRoom`, `seasonStorage` | NENHUM |
| `RoomDiary` | 107 | `usedRecently`, `lastDiaryDates`, `pieceTag`, `diaryEntry` | NENHUM |
| `RoomOrganizer` | 233 | organizar com IA (CA05): `organizePreview`, `applyOrganization`, `undoOrganization` | NENHUM |
| `RoomIsland` | 83 | ilha central (Loft): `island`, `islandHype` | NENHUM |

## Como foi dividido

- O código foi movido por faixas de linhas do original (script de extração), sem alterar os corpos. As únicas mudanças
  são: a qualificação das chamadas que passaram a outro colaborador (`layout(u)` → `furniture.layout(u)`,
  `entries(...)` → `addressing.entries(...)`, `owned(...)` → `moves.owned(...)`, `closetLights` → `ambience.closetLights`,
  `keyUserIds` → `roomKeys.keyUserIds`, `lastDiaryDates` → `diaryUse.lastDiaryDates`, `RoomService::capacity` →
  `RoomModules::capacity`); imports estáticos para as regras puras e as constantes de `RoomService` (os corpos ficam
  iguais); a retirada de `public`, `@Override` e `@Transactional` das cópias movidas; `static` em `modules`, `module`,
  `labels`, `labelSources`, `saveLabels`, `keys`, `positions`, `place`, `pieceSummary` e `statesOf` (não usavam
  estado); e o laço de visão dos módulos de `render` (34 linhas) virou `RoomModuleViews.moduleViews`, chamado no mesmo
  ponto. Um script de conferência confirmou que toda linha dos colaboradores, tirados os qualificadores, existe no
  original — só cabeçalhos, campos, construtores e a chamada a `moduleViews` são novos.
- O serviço continua o único bean: os 26 `@Transactional` (22 no serviço e 4 em `RoomLayoutPort`; o `readOnly` de `island` inclusive), o
  `@TransactionalEventListener(AFTER_COMMIT, fallbackExecution = true)` de `onPieceCreated` (que segue chamando
  `autoAssign` do próprio bean, como antes) e o `@EventListener @Transactional` de `onPieceDeleted` ficaram nos mesmos
  métodos públicos, cada um delegando numa instrução. Os seis métodos da porta RF35 ficaram com as mesmas anotações em
  `RoomLayoutPort`, que `RoomService` estende (`RoomService` continua implementando `FaiPointsService.RoomLayoutAccess`
  pela superclasse). Construtor de 21 argumentos, constantes públicas (`ZONE`, `FORGOTTEN_DAYS`, capacidades,
  `DEFAULT_DRAWER_LABELS`), `OUTERWEAR`, `DecorationsProvider` e `Location` não mudaram; `ServiceFakes.FakeRoomService`
  (fai-web) compila sem alteração, e `HypePersonalDataTest` (construtor com nulos) segue verde.
- **Autorização**: `guard.requireOwner` (via `owned` e na ilha) e `guard.deny` (Room Tour) foram junto com o corpo do caso
  de uso, na mesma ordem, e rodam dentro da transação do método do bean. As autochamadas do original (`render` →
  `entries`, `locate` → `autoAssign`, `setLight(2)` → `setLight(4)`, `diaryEntry` → `pieceTag`, `showInRoom` → `locate`)
  já não passavam pelo proxy; continuam chamadas diretas.
- Mantidos no serviço como delegação por terem chamador fora da classe: os estáticos públicos `coherent`,
  `drawerCapacity`, `lastUse`, `forgotten`; em `RoomLayoutPort`, `defaultModules` (testes) e `labels`/`labelSources`
  (`InventoryScoreService`).
- Saíram do serviço sem delegação (sem chamador fora da classe, inclusive testes e `fai-web`; agora nos colaboradores):
  `module` (2 sobrecargas), `modules`, `capacity`, `saveLabels`, `closetLights`, o record privado `Occupancy`, `freeIn`,
  `freeHanger`, `freeDrawer`, `place`, `automaticEntry`, `period`, `seasonalDecoration`, `pieceSummary`, `statesOf`,
  `dailyLookPieces`, `keys`, `render`, `keyUserIds`, `positions`, `owned`, `islandHype` e o logger. Nada foi apagado.

## Por que Facade

`RoomController`, `FaiPointsService` (pela porta RF35), `CopilotService`, `MirrorService`, `InventoryScoreService`,
`ChallengeService` e `ServiceFakes` continuam falando só com `RoomService`, que esconde nove colaboradores por caso de
uso e quatro classes de regras puras e coordena transação, eventos e dependências — a estrutura extraída é de fato uma
fachada; não foi criada interface. `RoomLayoutPort` é a mesma fachada dividida em duas camadas (a porta que o
`FaiPointsService` consome e os demais casos de uso), não um padrão à parte. **Strategy** para as zonas do endereço
(porta, gaveta, vitrines, cadeira) em `place`/`move` foi descartado: cada zona é um ramo curto de `switch` sobre os mesmos
dados e a ordem de tentativa importa; classes por zona espalhariam uma regra que hoje se lê inteira. **Template Method**
para prévia/aplicação da organização também não: `applyOrganization` recebe a prévia pronta do cliente, sem esqueleto comum.

## Testes e equivalência

Caracterização antes (commit `5fd9a2e`, no código original): novo `RoomServiceCharacterizationTest` (365 linhas) com o
auxiliar `RoomPortrait` (95 linhas), valores fixos (ids `UUID(0xB00, n)`, datas de 2025, 3 pessoas em 3 níveis, 18 peças
de todas as categorias com estados variados, 30 peças para estourar na Cadeira, 3 looks, Look do Dia, DNA com peça ícone,
conquista recente). Monta um retrato canônico (chaves ordenadas; ids gerados na hora viram marcadores na ordem em que
aparecem; período do dia e decoração sazonal viram `<relógio>`) de: `layout`, `levelOf`, `entries`, `room` (dono, Room
Tour e quarto cheio), `listView` (2), `open`, `locate`, `locateAll`, `labels`, `labelSources`, `setLight` (4), `setMonogram`,
`giveKey` (4), `hasKey`, `tour` negado, `move` (12, com todos os erros), `renameDrawer` (3), `showInRoom` (2),
`seasonStorage` (4), `onPieceCreated`/`autoAssign`/`onPieceDeleted`, `organizePreview` local e com IA (motor local),
`applyOrganization` (2), `undoOrganization` (3), `compatibleModules`, `applyFinish`, `resetFinish`, `setLevel`,
`diaryEntry` (5), `pieceTag` (2), `usedRecently`, `lastDiaryDates`, `island` (4), `defaultModules` por nível, `coherent`
(18 peças × 14 endereços), `lastUse`, `forgotten`, `drawerCapacity`. O retrato
(`src/test/resources/room/room-service-portrait.txt`, 88 linhas, ~230 KB) saiu idêntico em 3 execuções seguidas no
original (SHA-256 `ce9f02cb…`) antes de ser versionado.

```
mvn -B -o -pl fai-application -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false \
    -Dtest='RoomService*Test,RoomPlacement*Test,HypePersonalDataTest,MirrorServiceTest,ChallengeServiceTest,InventoryScore*Test,RoomInventoryApplyTest' test
mvn -B -q -o -pl fai-web -am -Djacoco.skip=true -DskipTests install
mvn -B -o -pl fai-application -Djacoco.skip=true test
mvn -B -o -pl fai-web -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest='ControllerDelegacaoTest,ContratoRotasPorTagTest' test
python3 scripts/refactoring/line_ratchet.py
```

| Etapa | Resultado |
|---|---|
| Original: testes do quarto e consumidores + caracterização | 65 testes, 0 falhas |
| Após o Facade (mesmo retrato) + `RoomInventoryApplyTest` | **68 testes, 0 falhas, 0 erros** |
| `install` de `fai-web` com dependências (`ServiceFakes` sem alteração) | sucesso |
| Suíte completa de `fai-application` (depois; e após o merge da base, que trouxe R82/R83/R84/R86) | 2032 testes, 0 falhas, 27 skipped; após o merge 2046, 0 falhas, 27 skipped |
| `fai-web` `ControllerDelegacaoTest` + `ContratoRotasPorTagTest` | 698 testes, 0 falhas |
| Catraca | `RoomService.java` só como `APERTAR` (1436 → 246); 0 violações; nenhum arquivo novo acima do limite |

Sem banco, servidor, rede externa, IA paga, migration ou mudança de DTO/URL/i18n.

## Pendências

- Nenhuma para o limite. `scripts/refactoring/line_baseline.json` não foi alterado (o integrador roda `--update`).
- Sugestão futura: apontar `InventoryScoreService` direto para `RoomModules.labels`/`labelSources` e os testes para
  `RoomModules.defaultModules`, o que tiraria as três delegações package-private de `RoomLayoutPort`.
