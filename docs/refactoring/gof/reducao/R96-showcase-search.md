# Lote R96-showcase-search — `ShowcaseService`, `SearchService` e `ExplorerService` como Facade por caso de uso

Base: `claude/relaxed-pasteur-5b5466`. Branch: `worktree-agent-adc8a461c57a95909`.
Pacote: `fai-application/src/main/java/br/com/fashionai/application/service/` (`java-service` e `java-outro`, limite 250).

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `ShowcaseService.java` | 899 | 201 | 10 colaboradores, tabela abaixo | **Facade** (estrutural) |
| `SearchService.java` | 877 | 211 | 9 colaboradores, tabela abaixo | **Facade** (estrutural) |
| `ExplorerService.java` | 523 | 90 | 4 colaboradores, tabela abaixo | **Facade** (estrutural) |

Colaboradores (todos `final`, package-private, sem Spring, no mesmo pacote, criados uma vez no construtor do serviço):

| Serviço | Arquivo novo | Linhas | Responsabilidade |
|---|---|---:|---|
| Search | `SearchHype` | 148 | regras puras do HypeScore v2 em contexto de terceiros: `publicRow`, `publicScore`, `scoreFor`, `trendFor`, `growthFor`, `risingFor`, `hypeRows`, `parseLevel`, `levelMinimum`, `meetsLevel`, `hypeSummary`, `round1` (também usadas pela vitrine e pelo Explorador) |
| Search | `SearchMatching` | 80 | regras puras: filtros em chips (`matches` look/peça), `relevance` (2), `publishedAt`, `NEUTRAL_HYPE` |
| Search | `SearchVisibility` | 65 | RF8.CA05: `blockedFor`, `showcaseAllows`, `visible` (look/peça), `sharerVisible` |
| Search | `SearchCommunityFeed` | 193 | feed comunitário: `Post`, `communityFeed`, `hypeOfPosts`, `dnaStyles` |
| Search | `SearchFollowingRunway` | 163 | The Runway ("Seguindo"): `entryContent`, `entryId`, `sharedEntry`, `runway` |
| Search | `SearchTabs` | 220 | busca segmentada: `search`, `brandResults`, `looks`, `pieces` |
| Search | `SearchSuggestions` | 90 | busca vazia (CA04): `alternatives`, `trending`, `TRENDING_POOL` |
| Search | `SearchPeople` | 59 | aba Pessoas: `personProfiles`, `groupedCounts` |
| Search | `SearchPublicPieces` | 61 | vitrine de Peças Públicas: `publicPieces` |
| Showcase | `ShowcaseHype` | 26 | leitura do Hype v2 de uma lista numa consulta (`of`) |
| Showcase | `ShowcaseMannequin` | 148 | `look` (2), `canRequest`, `piece`, `mannequin` (2), `mannequinBase` |
| Showcase | `ShowcaseLooks3d` | 100 | "Gerar 3D": `look3d`, `piece3d`, `requestModels` |
| Showcase | `ShowcasePhotos` | 112 | RF4/RF5: `pieceMannequinPhoto`, `schemeMannequinPhoto`, `deleteMannequinPhoto`, `storeMannequinPhoto`, `faceOf`, `groupingCover` |
| Showcase | `ShowcaseRunway` | 224 | Passarela 3D: `entry`, `runway(f)` |
| Showcase | `ShowcaseRunwayOrder` | 42 | regras puras da Passarela: `runwayOrder`, `count` |
| Showcase | `ShowcaseGroupings` | 153 | Eras/Coleções: `self`, `owner`, `groupingsOf`, `visibleSchemes`, `visiblePieces`, `list`, `groupingCard`, `period` |
| Showcase | `ShowcaseGroupingItems` | 130 | busca da aba: `items`, `contains`, `order` |
| Showcase | `ShowcaseInsights` | 131 | `groupHype`, `insights`, `avgHype`, `norm` |
| Showcase | `ShowcaseStage` | 65 | My Stage 3D: `stage` |
| Explorer | `ExplorerGlobalPanel` | 88 | RF26.CA01: `globalPanel` |
| Explorer | `ExplorerHype` | 102 | `PublicPiece`, `publicPieces`, `brandKey`, `brandHype` |
| Explorer | `ExplorerBrandGrid` | 223 | Marcas & lojas: `hypeValue`, `passesHype`, `brandsAndStores` (perfis BRAND + catálogo RF47) |
| Explorer | `ExplorerInsights` | 178 | Insights globais: `Agg`, `averageBy`, `rows`, `hypeRankings`, `seasonAverages`, `insights` |

## Como foi dividido

- Código movido por faixas de linhas do original (script de extração), sem alterar os corpos. Mudanças nos corpos:
  qualificação das chamadas que passaram a outro colaborador (`visible(...)` → `visibility.visible(...)`,
  `hypeOf(...)` → `hypes.of(...)`, `look(...)` → `mannequins.look(...)`, `owner(...)` → `base.owner(...)`,
  `SearchService.scoreFor` → `SearchHype.scoreFor`, `SearchService.showcaseAllows` → `SearchVisibility.showcaseAllows`,
  `publicPieces()` → `hypes.publicPieces()`…), import estático para as regras puras e constantes que ficaram na fachada
  (`meetsLevel`, `matches`, `TABS`, `offsetOf`, `RUNWAY_RANKINGS`, `MIN_BRAND_ITEMS`…), retirada de `public`/`@Transactional`
  das cópias e `private` → package-private onde outro colaborador chama. Uma linha longa foi quebrada depois da
  qualificação (`SearchHype.hypeRows(...)` em `SearchPublicPieces`) e `ExplorerBrandGrid.brandsAndStores` ganhou uma linha
  no início (`CatalogService catalog = catalogSource.get();`) para ler o catálogo opcional.
- Os três serviços continuam os únicos beans: **as 22 anotações `@Transactional`** (Showcase: 7 de escrita e 6
  `readOnly`; Search: 5 `readOnly`; Explorer: 4 `readOnly`) estão nos mesmos métodos públicos, cada um
  delegando numa instrução; `runway(viewer, limit)`, `search(…, size)`, `globalPanel(viewer, country)` e
  `brandsAndStores(5)` continuam chamando a sobrecarga no próprio serviço, como antes. Construtores (mesma ordem e tipos;
  `ServiceFakes` e os testes os usam), records/enums públicos (`RunwayFilter`, `Kind`, `Filters`, `PersonProfile`),
  `RunwayEntry`, `Cursor`, as constantes, `kind`, `offsetOf`/`encodeOffset` e o setter opcional `setCatalog` não mudaram.
  O catálogo opcional do Explorador chega ao `ExplorerBrandGrid` por `Supplier` (`() -> catalog`), para o setter continuar
  valendo depois da construção.
- **Autorização**: `guard.requireCanCreate`, `requireOwner`, `requireView`, `canView`, `schemeService.owned` e
  `schemeService.canView` foram junto com o corpo de cada caso de uso, na mesma ordem, e rodam dentro da transação do
  método do bean.
- Saíram dos serviços sem delegação (estáticos e package-private; chamadores apontados para o colaborador, mesma
  assinatura, nenhuma asserção mudou): de `SearchService` as regras de Hype (→ `SearchHype`), `matches`, `relevance`,
  `publishedAt`, `NEUTRAL_HYPE` (→ `SearchMatching`), `showcaseAllows`, `blockedFor`, `sharerVisible` (→ `SearchVisibility`),
  `dnaStyles`, `alternatives`, `trending`, `TRENDING_POOL`, `brandResults`, `looks`, `pieces`, `hypeRows` de instância; de
  `ShowcaseService` `look` (2), `mannequin` (2), `piece`, `entry`, `runwayOrder`, `count`, `period`, `order`, `groupHype`; de
  `ExplorerService` `publicPieces`, `brandKey`, `brandHype`, `averageBy`, `hypeRankings`, `seasonAverages`. Chamadores
  atualizados: `ShowcaseServiceTest`, `ShowcaseHypeV2Test`, `SearchHypeV2Test`, `ExplorerBrandsHypeV2Test` e os três testes
  de caracterização. Ficaram como delegação por terem chamador em teste existente: `SearchService.visible` (2),
  `SearchService.personProfiles`, `ShowcaseService.hypeOf`.
- Javadocs dos métodos foram junto com o código; os separadores `// ====` ficaram na fachada.

## Por que Facade (e não Specification/Composite/Strategy)

`ShowcaseController`, `DiscoveryController`, `InsightService`, `PublicInsights` e `ServiceFakes` continuam falando só com os
três serviços, que escondem os colaboradores por caso de uso e coordenam transações e dependências — uma fachada de fato,
sem interface criada.

Avaliados e descartados:
- **Specification/Composite** para os filtros da busca: `Filters` é um record de cinco atributos fixos e `matches` é uma
  conjunção fixa com extração diferente para look (via peças do look) e peça; não há critérios como objetos combináveis
  com a mesma assinatura, e o filtro de faixa de Hype é aplicado à parte (`meetsLevel`). Criar a árvore seria estrutura
  artificial.
- **Strategy** para as abas da busca, os rankings da Passarela, as ordenações de Eras/Coleções e as ordenações de Marcas &
  lojas: são `switch` curtos que devolvem listas ou `Comparator` sobre os mesmos dados, escolhidos por um texto da
  requisição; já são funções puras isoladas (`ShowcaseRunwayOrder.runwayOrder`, `ShowcaseGroupingItems.order`).

## Testes e equivalência

Caracterização antes (commit `6c02bbe`, no código original), com o helper `testkit/Portrait` (chaves ordenadas, records
por campo, entidades `Tipo#id`, ids/instantes novos como marcadores), mundos fixos de ids `UUID(prefixo, n)` e Hype v2
gravado (`calculatedAt` de 2025):

- `SearchServiceCharacterizationTest` + `SearchServiceCharacterizationFixture`: feed comunitário (filtros, faixa mínima,
  página 1/2 pelo cursor), The Runway (timeline ligada/desligada, vínculos de marca, fallback), as cinco abas (índice
  ligado e desligado, cursor de deslocamento, sugestões da busca vazia), Peças Públicas, regras puras e todas as chamadas a
  14 mocks. Views viram `look:id`/`piece:id` e cursores são decodificados com o instante em minutos antes da base do mundo,
  para a **ordem exata** dos resultados ficar no retrato — `search/search-service-portrait.txt` (327 linhas).
- `ShowcaseServiceCharacterizationTest` + `…Fixture` + `…Stubs`: look/peça no manequim, modelos 3D, fotos com o manequim
  (SHA-256 dos JPEG enviados à mídia), a Passarela em todos os rankings e filtros (tabela e lote em ordem), Eras/Coleções
  (lista, busca nas 8 ordenações e por era/ano/texto, insights, palco), regras puras e as chamadas a 16 mocks —
  `showcase/showcase-service-portrait.txt` (1649 linhas).
- `ExplorerServiceCharacterizationTest`: painel global, Marcas & lojas (com e sem catálogo, filtros, ordenações, faixas),
  Insights (anônimo e com a chamada à IA; o JSON dos rankings é relido com chaves ordenadas porque sai de `Map.of`), regras
  puras e as chamadas aos repositórios — `explorer/explorer-service-portrait.txt` (160 linhas).

Os três retratos saíram idênticos em execuções repetidas (JVMs diferentes) no original e depois da refatoração.

```
mvn -B -o -pl fai-application -am -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false \
    -Dtest='ShowcaseServiceCharacterizationTest,SearchServiceCharacterizationTest,ExplorerServiceCharacterizationTest,ShowcaseServiceTest,ShowcaseHypeV2Test,SearchHypeV2Test,SearchPeopleProfilesTest,ExplorerBrandsHypeV2Test,Block7RulesTest,SchemeRulesTest,InsightServiceTest,InsightNewContextsTest,BrandWebSearchServiceTest' test
mvn -B -q -o -pl fai-web -am -Djacoco.skip=true -DskipTests install
mvn -B -o -pl fai-application -am -Djacoco.skip=true test
mvn -B -o -pl fai-web -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest='ControllerDelegacaoTest,ContratoRotasPorTagTest' test
python3 scripts/refactoring/line_ratchet.py
```

| Etapa | Resultado |
|---|---|
| Original: testes do lote + caracterização | 70 testes, 0 falhas |
| Depois (mesmos retratos) | 70 testes, 0 falhas, 0 erros |
| `install` de `fai-web` com dependências | sucesso (`ServiceFakes` sem alteração) |
| Suíte completa de `fai-application` | 2064 testes, 0 falhas, 0 erros, 27 skipped |
| `fai-web` delegação/contrato | 698 testes, 0 falhas |
| Catraca | os 3 arquivos só como `APERTAR` (899 → 201, 877 → 211, 523 → 90); 0 violações |

Sem banco, servidor, rede externa, IA paga, migration ou mudança de DTO/URL/i18n.

## Pendências

- Nenhuma para o limite. `scripts/refactoring/line_baseline.json` não foi alterado (o integrador roda `--update`).
