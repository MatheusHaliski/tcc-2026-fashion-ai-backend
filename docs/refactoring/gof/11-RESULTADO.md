# Módulo 11 — quarto 3D, inventário e posicionamento: lote ROOM-PLACEMENT-RULES-001

Base: `bcaee73` (main após PR #416). Branch: `gof/11-quarto`. `git status --short` limpo antes do lote.
Primeiro lote do domínio 11; escopo restrito ao backend (`RoomService`), sem tocar frontend `/room`, `components/room3d`,
`lib/room3d`, provador/avatar (12) nem AURA (14).

## Mapeamento real (só o necessário para o lote)

`app/(site)/(app)/room/page.tsx` (665 linhas, congelado) → BFF/`api` → `RoomController` (`fai-web`, 154 linhas:
`GET /api/room`, `open`, `move`, `rename drawer`, `organize preview/apply/undo`, `list`, `season`, `island`, …)
→ `RoomService` (1533 linhas, `@Service`, `@Transactional` por método) → `RoomLayoutRepository`,
`RoomStorageEntryRepository`, `WardrobeItemRepository`, `RoomInventoryItemRepository`, `RoomCatalogItemRepository`
→ entidades `RoomLayout` (modulesJson / drawerLabelsJson), `RoomStorageEntry` (address serializado por `RoomAddress`:
`door:{n}/hanger:{m}`, `drawer:{n}`, `bags:{n}`, `chair:{n}` …) → `Map<String,Object>` de visão.

Consumidores externos das regras de posicionamento confirmados por `grep`:
`InventoryScoreService` (`RoomService.coherent`, público), `MirrorService` (`RoomService.OUTERWEAR`, mesmo pacote),
`RoomServiceTest` (`suggestLabel`, `preferredDrawerLabel`, `coherent`).

## Problema concreto e decisão

`RoomService` misturava, no mesmo arquivo de 1533 linhas, ocupação/persistência/transação com um bloco de **regras
puras de posicionamento**: 7 conjuntos de subcategorias + tradução `SUBCATEGORY_PT`, `preferredDrawerLabel`,
`coherent` (matriz zona × categoria × rótulo de gaveta), `drawerCapacity`, `titleCase`, `suggestLabel` e, embutida
em `place()`, a ordem de portas do cabideiro (peça inteira 4, casaco 3, malha 2, demais 1, depois 1…6). Essas regras
são usadas por 4 fluxos (atribuição automática, `move`, `organizePreview`, reparo de endereços em `entries`) e por
outro serviço (`InventoryScoreService`), mas só podiam ser testadas montando o serviço inteiro.

Extração: **`RoomPlacementRules`** (final, package-private, mesmo pacote; sem Spring, repositório ou relógio) com
os conjuntos, `nz`, `preferredDrawerLabel`, `hangerDoorOrder` (novo nome para a ordem antes inline em `place()`),
`coherent`, `drawerCapacity`, `titleCase`, `suggestLabel`.

Permanecem em `RoomService`, sem alteração de comportamento: `Occupancy`, `freeIn/freeHanger/freeDrawer`, `place()`
(agora delega a ordem de portas e a gaveta preferida), toda transação, autorização, `ApiException`s e persistência.
Compatibilidade: `RoomService.coherent` e `RoomService.drawerCapacity` (públicos) viram delegações de 1 linha;
`RoomService.OUTERWEAR` vira alias da mesma instância (`isSameAs` testado) para não tocar `MirrorService` (domínio 12).
`suggestLabel`/`preferredDrawerLabel`/`titleCase` eram package-private: as 6 chamadas em `RoomServiceTest` passaram a
`RoomPlacementRules.*` (troca mecânica de qualificador, mesmas asserções, mesma contagem de linhas).

### Padrão GoF: nenhum aplicado (decisão registrada)

- **Strategy por zona** (door/drawer/bags/jewelry/chair): o `switch` de `coherent` tem 6 ramos de 1 linha e um
  sub-`switch` de rótulos; classes por zona espalhariam uma tabela de decisão que hoje cabe numa tela. Função pura.
- **Composite** (módulos do móvel): `modulesJson` é uma lista plana de mapas; não há hierarquia real no backend.
- **Command + Memento** (desfazer organização): já existe snapshot único em `undoOrganization` persistido no layout;
  generalizar exigiria mudar a serialização do layout — fora do lote.
- **Flyweight/Bridge/Abstract Factory/Visitor**: referem-se à cena Three.js (frontend); não tocados neste lote.
- **Singleton**: nenhum; classe utilitária `final` com construtor privado.

## Verificação (executada)

| Etapa | Comando | Resultado |
|---|---|---|
| Caracterização **antes** da extração (`RoomPlacementCharacterizationTest`, 6 testes: portas, 9 gavetas rotuladas incl. variantes sem acento/caixa, zonas especiais e cadeira/maleiro, capacidade por categoria, gaveta preferida + sugestão de rótulo + `titleCase`, porta preferida via `room.entries` com `door:{n}/hanger:` real) + consumidores | `mvn -B -pl fai-application -Dtest='RoomPlacementCharacterizationTest,RoomServiceTest,InventoryScore*Test,Mirror*Test' test` | 48 testes, 0 falhas (`evidence/11-room-placement-baseline.log`) |
| Depois da extração + `RoomPlacementRulesTest` (3 testes: ordem das 6 portas, alias/delegações idênticas, campos nulos) + `RoomInventory*`/`RoomAsset*` | `mvn -B -pl fai-application -Dtest='RoomPlacement*Test,RoomServiceTest,RoomInventory*Test,RoomAsset*Test,InventoryScore*Test,Mirror*Test' test` | 65 testes, 0 falhas (`evidence/11-room-placement-after.log`) |
| Demais testes que constroem `RoomService` | `mvn -B -pl fai-application -Dtest='ChallengeServiceTest,CopilotAnswerTest,HypePersonalDataTest,InsightNewContextsTest,InsightServiceTest' test` | 48 testes, 0 falhas (`evidence/11-room-placement-consumers.log`) |
| Compilação de `fai-web` (controllers do quarto) | `mvn -B -q -pl fai-web -am -DskipTests test-compile` | exit 0 |
| Catraca de linhas | `python /home/user/tcc-2026-fashion-ai-backend/scripts/refactoring/line_ratchet.py` | 0 violações nos arquivos tocados; `RoomService.java` pede APERTAR 1533 → 1436. As 8 violações listadas são de outros domínios (worktree em `bcaee73`, anterior às reduções da branch principal). |

Observação de caracterização: a primeira versão do teste supunha `door:3:` e falhou contra o código original; o
formato real serializado é `door:3/hanger:1` — a expectativa foi corrigida para o contrato real antes da extração.

Sem banco, servidor, navegador, WebGL, rede de produção, GPU ou dados reais.

## Métricas

| Arquivo | Antes | Depois |
|---|---|---|
| `RoomService.java` (congelado) | 1533 | 1436 (−97; −6,3 %) |
| `RoomPlacementRules.java` (novo) | — | 140 |
| Runtime combinado | 1533 | 1576 (+43: javadoc, cabeçalho, 2 delegações públicas, alias) |
| `RoomPlacementCharacterizationTest.java` (novo) | — | 152 |
| `RoomPlacementRulesTest.java` (novo) | — | 55 |
| `RoomServiceTest.java` | 381 | 381 (só qualificador) |

## Contratos preservados

IDs `door:{n}/hanger:{m}`, `drawer:{n}`, `bags`, `jewelry`, `chair:{n}`; ordem de portas por tipo; capacidade por
categoria (sapato 1, parte de baixo 2, demais 4); rótulos padrão e variantes sem acento; i18n (`Msg.t/k` com as mesmas
chaves); `@Transactional`, ownership (`owned`/`Guard`) e códigos `CATEGORIA_INCOMPATIVEL`; serialização do layout
(`modulesJson`, `drawerLabelsJson`). Sem mudança de DTO, URL, schema, migration ou configuração. Frontend intocado.

## Riscos e pendências do domínio 11

- `RoomService` segue PARTIAL (1436 linhas): próximo candidato é `Occupancy` + `freeIn/freeHanger/freeDrawer/place`
  como alocador puro (depende só de módulos + ocupação) — exige caracterizar colisão de categorias na mesma gaveta.
- `organizePreview`/`applyOrganization`/`undoOrganization` (~170 linhas) mistura IA, proposta e snapshot; lote próprio.
- Frontend congelado: `components/room3d/room-scene.tsx` (1005), `app/(site)/(app)/room/page.tsx` (665),
  `room-props.tsx` (471), `lib/room3d/interaction.ts` (350) — candidatos a hooks/funções puras com vitest, sem WebGL.
- `RoomService.OUTERWEAR` é alias mantido para `MirrorService` (domínio 12); migrar o consumidor quando o 12 for tocado.
