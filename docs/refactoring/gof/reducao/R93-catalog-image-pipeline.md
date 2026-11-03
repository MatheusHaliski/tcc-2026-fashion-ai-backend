# Lote R93-catalog-image-pipeline — serviço como Facade; pipeline, CLI e teste divididos por responsabilidade

Base: `claude/relaxed-pasteur-5b5466` (merge `--ff-only` antes de começar e merge antes do commit final).
Pacote: `fai-application/src/main/java/br/com/fashionai/application/catalog/image/`. Fora do lote e intocados:
`FabricFrame`, `ProductRuleFrame`, `SemanticCropper`, `ProductSegmenter`.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `CatalogImagePipelineService.java` (`java-service`, 250) | 1025 | 249 | 11 colaboradores, tabela abaixo | **Facade** (estrutural) |
| `CatalogImagePipeline.java` (`java-outro`, 250) | 432 | 234 | `CatalogSourceIntake` (55), `CatalogPersonEvidence` (99), `CatalogCropGeometry` (96), `CatalogAnalysisReport` (67) | NENHUM |
| `CatalogImageBatchCli.java` (`java-outro`, 250) | 456 | 172 | `CatalogBatchArgs` (61), `CatalogBatchLoop` (99), `CatalogBatchInput` (142), `CatalogBatchReport` (92) | NENHUM |
| `src/test/.../CatalogImagePipelineServiceTest.java` (`teste`, 400) | 843 | 237 | `CatalogImagePipelineServiceFixture` (168), `…CardTest` (223), `…PreviewTest` (209), `…TextureTest` (100) | NENHUM |

Colaboradores do `CatalogImagePipelineService` (todos `final`, package-private, sem Spring, criados uma vez no
construtor do serviço):

| Arquivo novo | Linhas | Responsabilidade |
|---|---:|---|
| `CatalogImageWorker` | 213 | `claim`, `process` (download → cache por hash → pipeline → metadados → canônica), `markFailed` (corpo do `catch` do `tick`), `sameContext`, `apply`, `automaticFrame`, `finish` |
| `CatalogFrameSelection` | 143 | `ensurePreview` (travas por produto, `previewCapacity`) e `verifySelection` (regra do produto na foto original) |
| `CatalogTextureTransport` | 112 | `texturePhoto` do provador (derivado isolado → preview persistido → original; frente/costas) e `viewRank` |
| `CatalogImageReview` | 152 | fila de revisão, `decide`, métricas, depuração, `enqueueProduct` e `view` |
| `CatalogImageRanking` | 58 | `rerank` (papéis pelo `ImageCandidateRanker`) |
| `CatalogPreviewWriter` | 99 | `rememberPreview` (cache `previewFrames`, tecido e Peça inteira), `store` (master/variantes), `put` |
| `CatalogImageBindings` | 87 | `selectedVariant`, `contextVariants`, `boundPhotoSet`, `currentBoundPreview`, `allowsPersistence`, `host` |
| `CatalogCardImage` | 106 | `cardImage(1)` e `cardImage(3)` (leitura do card) |
| `CatalogPhotoEvidence` | 139 | `photoSet(3)`, `contextColor`, `validSha256`, `sameId`, `derivativeUrl`, `wholeFrame`, `validPreflight`, `processedWhole`, `number`, `vtonGarment` |
| `CatalogPreviewCache` | 51 | `previewContext`, `previewAssets`, `currentPreviewSource`, `currentPreview` |
| `CatalogImageColumns` | 75 | colunas do nível A: `dimension`, `cropJson`, `metricsJson`, `gateReasons`, `qualityScore`, `copyAnalysis` |

## Como foi dividido

- **CatalogImagePipelineService**: corpos movidos sem alteração por caso de uso; as únicas mudanças são a qualificação
  das chamadas que passaram a outro colaborador (`boundPhotoSet(…)` → `bindings.boundPhotoSet(…)`,
  `rememberPreview` → `writer.rememberPreview`, `rerank` → `ranking.rerank`, `CatalogImagePipelineService::viewRank` →
  `CatalogTextureTransport::viewRank`) e imports estáticos (`CatalogImageColumns`, `CatalogPhotoEvidence`,
  `CatalogPreviewCache`, constantes do serviço) para manter os corpos iguais. O serviço continua o único bean, com o
  mesmo construtor de 12 argumentos (só guarda referências e cria colaboradores; `ServiceFakes.FakeCatalogImagePipelineService`
  compila e constrói sem alteração), o `@Scheduled tick`, `DONE`, `ACTIONS`, as três versões públicas
  (`PREVIEW_CACHE_VERSION`, `WHOLE_FRAME_VERSION`, `WHOLE_PROCESSED_VERSION`) e os tipos públicos `TexturePhoto`,
  `TextureView` e `ReviewCommand`. Todos os métodos públicos continuam (estáticos delegam com a mesma assinatura).
- **Autorização** fica no método público, na mesma ordem: `guard.requireCanCreate` antes de produto/variante em
  `texturePhoto`, `ensurePreview` e `verifySelection`; `guard.requireAdmin` antes da validação da ação em `decide` e
  antes das consultas nos demais métodos de admin. `ensurePreview` continua chamando o `verifySelection` público
  (com a nova checagem de permissão) por um `Runnable` — mesmo despacho virtual, mesma trava e mesmo semáforo.
- **Transações**: o serviço não tem `@Transactional`; os `TransactionTemplate` (`claim`, gravação do `process`,
  `verifySelection`, `decide`, `enqueueProduct`, falha do `tick`) foram junto com o corpo que envolvem, sem mudar o que
  fica dentro de cada transação. Loggers dos colaboradores mantêm a categoria `CatalogImagePipelineService`.
- Saíram do serviço (package-private, agora só no colaborador): `apply`, `automaticFrame`, `rerank`, `processedWhole`,
  `copyAnalysis`, `host`, `view`, `wholeFrame`, `validPreflight`, `viewRank` e os privados. Consumidores ajustados
  (só testes): `…CardTest` (`CatalogPhotoEvidence.wholeFrame`/`validPreflight`), `…TextureTest`
  (`CatalogTextureTransport.viewRank`) e o retrato do serviço. Ficaram como delegação os package-private usados pelos
  testes do serviço: `claim`, `sameContext`, `allowsPersistence`.
- **CatalogImagePipeline**: `run` continua o orquestrador dos estágios na mesma ordem e com os mesmos nomes/notas;
  saíram blocos coesos — VALIDATION (`CatalogSourceIntake.decode`, devolve a foto ou a análise recusada), evidência de
  pessoa (`CatalogPersonEvidence`: `humanEvidence`, `cropHumanEvidence`, `checkFabric` — o bloco
  HUMAN_IN_FABRIC_FRAME —, `checkPerson`, `fabricHumanEvidence`), geometria pura (`CatalogCropGeometry`: `waistFocus`
  — o bloco do cós —, `fabricCover`, `logoInside`, `centroid`) e o relatório sem pixels (`CatalogAnalysisReport`:
  `reviewReasons` com `VIEWS`/`MIN_PRODUCT_AREA` e o mapa `debug`). `Request`, `Stage`, `Analysis`, `VERSION`,
  `ACCEPTED_MIME`, `sha256` e o construtor público não mudaram. Saiu do pipeline o package-private `humanEvidence`
  (sem chamadores fora).
- **CatalogImageBatchCli** (CLI: argumentos, execução e relatório separados): `CatalogBatchArgs` (`threads`, `env`,
  `personSegmenter`), `CatalogBatchLoop` (laço JSONL com pool, contrapressão `IN_FLIGHT_PER_THREAD` e `emit`),
  `CatalogBatchInput` (leitura dos pedidos: `path`, `read`, `candidates`, `imageType`, `text`, `Failure`) e
  `CatalogBatchReport` (respostas `analyzed`, `columns`, `ranked`, `error`). Ficam na CLI `main`, `USAGE`, o construtor
  público, `run`, `handle`, `ready` e `columns` (público, delega). O protocolo (stdout/stderr, mensagens, códigos de saída)
  é o mesmo. O nome `CatalogBatchInput` evita o sufixo `Request` (categoria `java-dto` do ratchet), que não descreve a
  classe.
- **CatalogImagePipelineServiceTest**: o estado em memória, o `setUp` e os construtores de dados (`image`,
  `sourcePreflight`, `photoEvidence`, `variant`, `isolated`) foram para `CatalogImagePipelineServiceFixture`
  (abstrata, herdada); os 40 testes foram distribuídos sem alteração por tema — worker/cache/nível B/proveniência/fila
  (14, `CatalogImagePipelineServiceTest`), card/Peça inteira/photo set/preflight (10), `ensurePreview`/`verifySelection`
  (12), textura do provador (4). A fixture ganhou só `newId()` (aleatório por padrão, como antes) para o retrato usar
  ids fixos.

## Por que Facade (serviço) e NENHUM (pipeline, CLI, testes)

- **Facade**: `CatalogController`, `AdminCatalogImageController`, `CatalogService`, `CatalogPhotoChoice`,
  `WardrobeService`, `AnatomicalTryOnService`, a CLI e os fakes de `fai-web` continuam falando só com
  `CatalogImagePipelineService`, que esconde 11 subsistemas coesos e mantém permissão, agendamento e tipos públicos.
  Nenhuma interface artificial foi criada.
- **NENHUM (pipeline)**: as etapas não têm a mesma assinatura (validação devolve foto ou recusa, segmentação devolve
  máscara, ROI devolve foco, recorte devolve `SemanticCropper.Result`, cada uma com entradas diferentes) e o código
  original não é uma cadeia/lista de etapas — é um método sequencial. Converter em Chain of Responsibility exigiria um
  contexto mutável artificial; a extração só isola blocos coesos.
- **NENHUM (CLI)**: separação por responsabilidade (argumentos, laço, leitura, respostas); o despacho `analyze`/`rank`
  é um `switch` de duas entradas, sem família de comandos que justifique Command/Strategy.
- **NENHUM (testes)**: herança de fixture de teste não é padrão GoF.

## Testes e equivalência

Caracterização antes (commit `737ed8e`, sobre o código original, com o teste já dividido e verde):

- `CatalogImagePipelineRetratoTest` — 21 fotos sintéticas (packshots, jeans, modelo com/sem mão, tênis, mocassim,
  relógio, fragmento/detalhe, cabide, adereço, pessoa, peça cortada, vestido, pequena, estúdio vazio, GIF, bytes
  inválidos, PNG recortado) × nível A/B × sem segmentador, com segmentador fake determinístico (fração de pele) e com
  segmentador que falha: veredito, motivos, recorte, métricas, estágios (sem tempo), depuração, colunas da CLI e
  **SHA-256 dos pixels ARGB** do master (transparente/branco/neutro/card/thumb) e dos quadros de preview (tecido e Peça
  inteira) — `catalog/image/pipeline-retrato.txt`.
- `CatalogImagePipelineServiceRetratoTest` — ids fixos; `claim`, `tick` (cache por hash, detalhe, pessoa, 404,
  duplicada), fila/`decide` (todas as ações e erros), métricas, depuração, `enqueueProduct`, nível B com **SHA-256 dos
  bytes gravados** no storage, `ensurePreview`/`verifySelection` (inclusive por variante/foto), `texturePhoto` (SHA dos
  bytes ou erro, todas as combinações), `cardImage`×3, `photoSet`×2, `wholeFrame`, `vtonGarment`, `host`,
  `allowsPersistence`, `sameContext`, `copyAnalysis`, foto órfã, constantes; todas as linhas de `catalog_images` em cada
  etapa — `catalog/image/service-retrato.txt`.
- `CatalogImageBatchCliRetratoTest` — `ready`, `USAGE`, 11 combinações de `--threads`, 29 pedidos (analyze com sucesso e
  todos os erros de arquivo/caminho/campos, rank com papéis e todos os erros, JSON inválido) e `run` (stdout e códigos de
  saída, inclusive stdout fechado) — `catalog/image/batch-cli-retrato.txt`.
- Os retratos ordenam chaves e conjuntos (`Map.of`/`Set.of` iteram em ordem sorteada por JVM), trocam instantes por
  `<t>` e zeram `ms`; gravados com `-Dretrato.gravar=true` e conferidos em outra JVM antes da extração.

```
mvn -B -q -o -pl fai-application -am -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest='br.com.fashionai.application.catalog.image.*Test' test
mvn -B -q -o -pl fai-web -am -Djacoco.skip=true -DskipTests install
mvn -B -q -o -pl fai-web -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest='ControllerDelegacaoTest' test
mvn -B -o -pl fai-application -Djacoco.skip=true test
python3 scripts/refactoring/line_ratchet.py
```

| Etapa | Resultado |
|---|---|
| Original, teste dividido (fixture + 4 classes) + demais testes do pacote | 40 testes do serviço iguais ao original; 0 falhas |
| Original + 3 retratos gravados e reconferidos em outra JVM | idênticos |
| Após as extrações (pacote `catalog.image`, 14 classes) | **107 testes, 0 falhas; os três retratos idênticos** |
| `fai-web` (install compila tudo; `ServiceFakes` sem alteração) | `ControllerDelegacaoTest` 697, 0 falhas |
| Suíte completa de `fai-application` (depois, antes do merge da base) | 2061 testes, 0 falhas, 0 erros, 27 skipped |
| Catraca | os 4 arquivos do lote só como `APERTAR` (1025 → 249, 432 → 234, 456 → 172, 843 → 237); 0 violações; nenhum arquivo novo acima do limite |

Sem banco, servidor, rede externa, GPU/IA paga, migration ou mudança de DTO/URL/i18n/protocolo.

## Pendências

- `CatalogImagePipelineService.java` ficou em 249: o que sobra é contrato (construtor de 12 argumentos, `tick`, 3
  tipos públicos, 5 constantes, ~30 métodos públicos de uma linha). Método novo exige antes mover tipos públicos para
  arquivos de topo (com ajuste de controllers, `ServiceFakes` e testes).
- `scripts/refactoring/line_baseline.json` não foi alterado (o integrador roda `--update`).
