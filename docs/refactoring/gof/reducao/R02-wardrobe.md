# Lote R02-wardrobe — `WardrobeService` como Facade

Base: `claude/serene-thompson-yetcg5` (`a0e10d7`; rebase sobre `ed2458d` na verificação). Branch: `gof/r02-wardrobe`.

## Resultado por arquivo

| Arquivo | Antes | Depois | Padrão GoF |
|---|---|---|---|
| `fai-application/.../service/WardrobeService.java` | 2730 | 1001 | **Facade** (coordena os colaboradores abaixo) |

Arquivos novos (todos package-private, no mesmo pacote, sem Spring; nenhum é bean):

| Arquivo novo | Linhas | Responsabilidade | Padrão |
|---|---|---|---|
| `AiResponseJson` | 71 | JSON tolerante das respostas de IA (objeto no texto, strings, caixas 0–1000) | NENHUM (funções puras) |
| `PieceAnalysisParser` | 201 | resposta do analisador/moderação/recortes de marca → valores da taxonomia | NENHUM (funções puras) |
| `PieceAnalyzerPrompts` | 124 | prompts de sistema e mensagem do analisador | NENHUM (texto/constantes) |
| `PiecePrefill` | 150 | pré-preenchimento do formulário e padrões por tipo | NENHUM (funções puras) |
| `DraftEvidence` | 117 | recusa da foto, palpite local, candidatos, busca da marca, OCR, caixa do logo | NENHUM (funções puras) |
| `PieceDraftAnalyzer` | 195 | análise da foto até o pré-preenchimento (Flat Lay, aceite, moderação, detecção, logo/OCR) | NENHUM |
| `DraftRecorder` | 151 | grava o rascunho (job, arquivos, estúdio, resultado) e lê o recorte do rascunho | NENHUM |
| `DraftBrandRetry` | 104 | nova leitura da marca em grade (OCR → IA) | NENHUM |
| `FlatLayRemoteStep` | 39 | Flat Lay remoto como `AiEngine.RemoteStep` (antes classe anônima) | **Adapter** |
| `DraftPieceImport` | 178 | peça criada a partir do rascunho: imagens, moderação, qualidade, fotos, fila, reprocessamento | NENHUM |
| `PieceImages` | 60 | imagem do catálogo (RF47), imagem padrão e volta à padrão após excluir a foto | NENHUM |
| `PieceFormWriter` | 194 | validação do formulário, cópia saneada para a entidade, conservação, marca (cadastro/perfil/web/livre) | NENHUM |
| `PieceTaxonomyWriter` | 94 | variação/atributos com origem IA×pessoa e conversão de subcategoria legada | NENHUM |
| `PieceStudioHints` | 86 | regras puras do estúdio (tipo, dicas, transparência, versão do feed, fundos) | NENHUM |
| `StudioShots` | 123 | geração da foto de estúdio na governança de IA e arquivos/fonte no storage | NENHUM |
| `StudioVersionFlow` | 132 | versões da foto de estúdio na peça: aplicar, oferecer (pendente), aprovar, descartar | NENHUM (ver State abaixo) |
| `DefaultStudio` | 74 | estúdio da imagem padrão, gerado uma vez e reaproveitado | NENHUM |
| `WardrobeStudio` | 138 | orquestra estúdio do rascunho, da peça, do closet e o refresh após troca de imagem | NENHUM |
| `PieceImageEdits` | 99 | imagem editada, fundo removido sob demanda, recorte reprocessado | NENHUM |
| `FlatLayReprocessor` | 84 | job RF4.CA06 (reprocessa pendentes, até 3 tentativas) | NENHUM |
| `PieceCopy` | 44 | "Adicionar" peça pública ao próprio closet | **Prototype** |
| `PieceDetailView` | 61 | corpo do detalhe (retrato arquivado ou peça + looks de origem visíveis) | NENHUM |
| `PieceViewerState` | 44 | estado de quem vê e contagem de reações | NENHUM |
| `ClosetHype` | 52 | Hype v2 do closet (scores visíveis e faixa mínima) | NENHUM |
| `WardrobeTaxonomyCatalog` | 49 | vocabulário do formulário (taxonomia, imagens padrão, marcas) | NENHUM |

Todos os colaboradores ≤ 250 linhas. Testes novos: `WardrobeCollaboratorsTest` (176 linhas, 7 testes) e, na verificação,
`WardrobeAnalyzeSyntheticFlowTest` (3 testes do fluxo `analyze`/`analyzeForCapture` sem depender de `public/assets_pecas`).

## Como o Facade ficou

- `WardrobeService` continua o único bean e dono de `@Transactional` (28 anotações, nenhuma movida), `@Scheduled`,
  autorização (`guard.requireCanCreate`, `owned`, `ownedDraft`, `requireVisiblePiece`, `schemeVisible`), posse do
  rascunho, auditoria, eventos de domínio, projeções e notificações de criação.
- Os colaboradores com dependência são criados **a cada chamada** por fábricas privadas (`formWriter()`, `draftImport()`,
  `closetHype()`, `shots()`, `versions()`, `studios()`, `imageEdits()`), recebendo os campos do serviço por parâmetro de
  construtor. Assim leem o estado do serviço no momento da chamada: testes que trocam dependências por reflexão
  (`BackgroundStudioServiceTest` troca `guard`/`backgroundStudioAccess`) e os setters opcionais (`brandReader`,
  `sealBonds`, `conservation`) continuam valendo.
- Todos os métodos **públicos** continuam no serviço (assinaturas intactas; `WardrobeController`,
  `WardrobeStudioController`, `PhotoService`, `AuraMotionService` etc. não mudaram). Dos **package-private**:
  - continuam como delegações (formatação padrão, uma instrução por linha) os que têm chamador de produção
    (`MODERATION_SYSTEM`, `parseModeration`, `brandName`, `oneOf`, `strings`, `extractJson`, `str`, `label`, `humanize`,
    `requireVisiblePiece`, `schemeVisible`) e os que já eram delegações antes do R02 (`sealFilter`, `stateMatches`,
    `studioMeta/Version/Approved/Summary`, `taxonomyV2`), além dos utilitários originais (`blank`, `contains`, `enumMap`,
    `emptyReactions`, `ids`, `page`) e de `defaultStudio`, `offerStudio`, `hypeMinimum`;
  - saíram sem delegação, porque nenhum chamador restou no repositório: as constantes `ANALYZER_SYSTEM` e
    `BRAND_TILES_SYSTEM` (agora em `PieceAnalyzerPrompts`) e `WEB_BRAND_SOURCES` (agora privada em `PieceFormWriter`),
    a constante `UNUSED` (apagada) e os métodos de instância `studioHints(WardrobeItem)`, `refreshStudio(...)` e
    `studioShot(...)` (lógica em `PieceStudioHints.studioHints`, `WardrobeStudio.refresh` e `StudioShots.studioShot`);
  - saíram na verificação (ver abaixo) 30 delegações (29 métodos, contando sobrecargas, e a constante `ANALYZER_DIMENSIONS`) de regras movidas pelo R02 que só testes chamavam
    (`parseAnalysis`, `prefill`, `studioKind`, `rejection`, `logoBox`…): os testes passaram a chamar o dono
    (`PieceAnalysisParser`, `PiecePrefill`, `PieceStudioHints`, `DraftEvidence`, `AiResponseJson`, `PieceAnalyzerPrompts`,
    `PieceTaxonomyWriter`, `PieceFormWriter`), com as mesmas asserções.
  Os nomes de logger foram preservados (`LoggerFactory.getLogger(WardrobeService.class)` em `StudioShots`/`StudioVersionFlow`).
- Única duplicação removida: leitura do recorte do rascunho (`DraftRecorder.cutout`) e checagem de posse do rascunho
  (`ownedDraft`), idênticas em `retryBrand` e `studioDraft`.
- Imports sem uso removidos (inclusive os que já sobravam no original: `LocalAdvisors`, `ImageProviderPorts`,
  `Model3dStatus`, `Value`, `Comparator`) e a constante `UNUSED` (sem nenhuma referência no repositório).

## Padrões avaliados e não aplicados

- **State (versões do estúdio):** os estados (sem estúdio, aprovada, pendente, aguardando aprovação) vivem num mapa JSON
  em `flatLayMetadata.studio` e as transições são 4 (`apply/offer/approve/discard`); classes de estado exigiriam
  serializar/desserializar o mapa em objetos sem ganho — `StudioVersionFlow` deixa as transições explícitas.
- **Strategy (tipo de estúdio, material/estilo padrão, preço):** são `switch`/tabelas pequenas e puras, sem variação de
  algoritmo em tempo de execução.
- **Builder (`PieceForm`):** o record de 36 componentes com construtores de compatibilidade é contrato da API
  (`WardrobeController`, 35 usos de `WardrobeService.PieceForm`); trocar por builder mudaria o DTO.
- **Chain of Responsibility (validação do formulário):** as regras já vêm agregadas de `Taxonomy.pieceErrors/variationErrors`
  num único mapa de erros; não há sequência de handlers independentes no serviço.
- **Template Method (imagem editada × fundo removido × reprocessado):** os três fluxos gravam arquivos diferentes, em
  ordens diferentes e com metadados diferentes; um template forçaria ganchos artificiais.
- **Singleton:** nenhum; só beans Spring.

## Testes (executados)

Lista do lote (48 classes = `Wardrobe*Test`, `ClosetQuery*Test`, `StudioVersion*Test`, `PieceConservation*Test` e todo
teste de `fai-application` que referencia `WardrobeService`): AnatomicalTryOnServiceTest, AuraMotionServiceTest,
AutopilotScoresTest, BackgroundStudioArtworkContractTest, BackgroundStudioServiceTest, CatalogSearchResolveTest,
CatalogServiceTest, ClosetQueryTest, ClosetSealFilterTest, CopilotAnswerTest, FlairCollectionServicePreviaTest,
FlairCollectionServiceTest, HypeGlobeTest, HypeRegionalRankingTest, InsightNewContextsTest, InsightServiceTest,
LensScanProvenanceCharacterizationTest, LensServiceTest, LookbookClosetHypePrivacyTest, LookbookServiceTest,
MirrorScoresTest, MirrorServiceTest, MirrorWardrobePickerTest, MultiPieceServiceTest, PhotoEditServiceTest,
PhotoServiceTest, PieceConservationServiceTest, PieceRemixTest, PieceTaxonomyTest, SchemeFiltersTest,
SchemeRemixCharacterizationTest, SchemeServiceTest, SocialServiceTest, StudioVersionMetadataTest, StudioVersionsTest,
TryOnServiceTest, VisibilityRulesTest, WardrobeAnalysisTest, WardrobeAnalyzeFlowTest, WardrobeClosetCaracterizacaoTest,
WardrobeCreatorServiceTest, WardrobeEventListenersTest, WardrobePrefillTest, WardrobeServiceCadastroTest,
WardrobeServiceClosetTest, WardrobeServiceEstudioTest, WardrobeServiceParsersTest, WardrobeStateFilterTest.

```
mvn -B -o -pl fai-application -Dtest='<lista acima>' -Dsurefire.failIfNoSpecifiedTests=false test
```

| Etapa | Resultado |
|---|---|
| Código original (caracterização antes) | 408 testes, 0 falhas, 0 erros, 3 skipped (preexistentes) |
| Após cada etapa de extração, 11 rodadas (parsers/prompts/pré-preenchimento → estúdio → formulário → criação pelo rascunho → análise da foto → marca/estúdio do rascunho → edições de imagem/reprocessamento → cópia/taxonomia/estado de quem vê → compactação das delegações e imports (**compressão de formatação, desfeita na verificação**) → detalhe/Hype → reorganização) | 408 testes, 0 falhas, 3 skipped em todas |
| Final (+ `WardrobeCollaboratorsTest`, 7 testes novos: Prototype, Adapter, transparência/fundos, faixa de Hype, Hype sem config, subcategoria legada preservando os 32 demais campos do formulário) | **415 testes, 0 falhas, 0 erros, 3 skipped** |
| `fai-web` (compila contra o novo serviço; `WardrobeController`/`ServiceFakes`) `mvn -B -o -pl fai-web -am -Dtest='ControllerDelegacaoTest,SchemeFormPayloadTest' -Dsurefire.failIfNoSpecifiedTests=false test` | 699 testes, 0 falhas (não medido antes) |
| Verificação: rebase sobre `ed2458d`, antes das correções | 415 testes, 0 falhas, 3 skipped |
| Verificação: após as correções (+ `WardrobeAnalyzeSyntheticFlowTest`) | **418 testes, 0 falhas, 0 erros, 3 skipped** (os 3 de `WardrobeAnalyzeFlowTest`, que exige `public/assets_pecas`) |
| Verificação: `fai-web` após as correções, já com `WardrobeStudioController` da base (`mvn -B -o -pl fai-web -am -Dtest='ControllerDelegacaoTest,SchemeFormPayloadTest' …`) | 699 testes, 0 falhas |
| Catraca `python3 scripts/refactoring/line_ratchet.py` (após `--update`) | 0 violações; teto de `WardrobeService.java` 2730 → 1001 |

Sem banco, servidor, rede externa, IA paga, bucket, migration ou mudança de DTO/URL/i18n/autorização/transação.

## O que falta para o limite de 250 (e por quê não nesta sessão)

`WardrobeService.java` ficou com 1001 linhas, na formatação padrão (0 métodos com corpo e chaves numa linha). O que sobra
é, na maior parte, contrato que este lote não podia mexer:

- **Tipos aninhados públicos (~200 linhas):** `Prefill`, `Draft`, `CaptureAnalysis`, `PieceForm` (com 4 construtores de
  compatibilidade), `CatalogPick`, `ClosetFilter` são referenciados como `WardrobeService.X` em `fai-web`, em outros
  serviços e nos testes congelados. Movê-los para tipos de topo exige atualizar esses consumidores (inclusive os testes
  congelados, que o lote de divisão de testes vai reescrever).
- **Construtor e campos (~110 linhas):** 30 dependências injetadas; a assinatura do construtor é usada pelos testes.
- **41 métodos públicos (28 com `@Transactional`), ~420 linhas:** ficam aqui por regra (transação e autorização no
  bean); cada um já é curto e delega o trabalho.
- **Delegações e utilitários package-private (~95 linhas):** só os que têm chamador de produção
  (`MultiPieceService`, `CopilotService`, `SchemeService`, `AutopilotService`, `DnaService`, `MirrorService`,
  `RoomService`, `AuraMotionService`) ou que são anteriores ao R02. Apontar esses chamadores para os colaboradores fica
  para os lotes desses serviços (R12, R14, R15, R31…), para não disputar arquivos com eles.

Próximo passo sugerido: levar os records (`PieceForm`, `Draft`, `Prefill`, `CaptureAnalysis`…) para arquivos próprios
junto com a atualização de `fai-web` e dos testes congelados (lote R55), e mover `closet`/`delete` para colaboradores
com teste de caracterização.

## Verificação independente

Sete achados dos verificadores, conferidos no código e nos testes depois do rebase sobre `ed2458d`:

| # | Achado | Severidade | Veredito | Correção |
|---|---|---|---|---|
| 1 | Compressão de formatação em `WardrobeService`: 40 métodos com corpo e chaves numa linha (`{ return x(); }` em série), proibido por `LINE_RULES.md`; o original tinha 0. Expandidos, 1005 → 1119 linhas (reproduzido por script: 40 métodos, 1119 linhas), e a catraca em 1005 travava a compressão. | major | **Confirmado** | Os 40 métodos voltaram à formatação padrão (corpo em linha própria, linha em branco entre membros). O arquivo voltaria a 1119; a redução veio de remover as 30 delegações (29 métodos e `ANALYZER_DIMENSIONS`) de regras que o próprio R02 moveu e que **só testes** chamavam (6 classes de teste no mesmo pacote passaram a chamar o colaborador dono: troca mecânica `WardrobeService.X` → `Dono.X`, 136 linhas alteradas, nenhuma asserção removida, mesmo número de linhas por arquivo). `toggles` chama `PieceFormWriter.applyListing` direto; imports sem uso (`BrandRegions`, `SubtypeReferences`) saíram. Resultado: **1001 linhas, 0 corpos numa linha**, mesma contagem de `if` sem chaves do original (1, a linha de `requireBackgroundAuraAccess`, idêntica). |
| 2 | O relatório e o commit apresentavam 2730 → 1005 como extração e chamavam de "delegações de 1 linha" métodos que eram multilinha no original (alguns nem eram delegações: `blank`, `enumMap`, `emptyReactions`, `ids`). | minor | **Confirmado** | Relatório corrigido: a etapa "compactação das delegações e imports" está marcada como compressão desfeita; números atualizados para 1001 na formatação padrão. |
| 3 | O relatório dizia que todo método público e package-private foi mantido como delegação; 3 métodos de instância package-private (`refreshStudio`, `studioShot`, `studioHints(WardrobeItem)`) e 3 constantes (`ANALYZER_SYSTEM`, `BRAND_TILES_SYSTEM`, `WEB_BRAND_SOURCES`) saíram sem delegação, além de `UNUSED`. | minor | **Confirmado** (sem quebra: nenhum chamador no repositório, inclusive testes e `fai-web`) | Seção "Como o Facade ficou" reescrita listando o que ficou, o que saiu sem delegação e por quê. |
| 4 | Mesmo ponto do #3 (`WEB_BRAND_SOURCES`, `studioHints`, `refreshStudio`, `studioShot` sem delegação; relatório linhas 52–53). | minor | **Confirmado** (duplicata do #3) | Mesma correção do #3. |
| 5 | O fluxo `analyze`/`analyzeForCapture` (`PieceDraftAnalyzer.detect` + `DraftRecorder.record`, com `@Transactional(noRollbackFor = PhotoRejectedException.class)`) não tinha teste que rodasse: os 3 de `WardrobeAnalyzeFlowTest` são pulados sem `public/assets_pecas` (ausente na worktree e no checkout principal). | minor | **Confirmado** (lacuna de verificação; equivalência ao `analyzeInternal` original conferida pelo verificador) | Novo `WardrobeAnalyzeSyntheticFlowTest` (3 testes, foto sintética desenhada no teste, catálogo de referências vazio, pipeline local real, IA simulada): ordem usuário → Flat Lay → moderação → analisador → `jobs.save`; recusa da IA depois das 2 inferências e **sem** `jobs.save`; `noRollbackFor = PhotoRejectedException` em `analyze`, `analyzeForCapture` e `analyzeBatch`; modo lenient devolve `inteira_ia`/`frontal_ia` e grava o rascunho. Teste de mutação: três mutações temporárias (buscar o usuário depois do Flat Lay, tirar `noRollbackFor` de `analyze`, ignorar `lenient`) derrubaram cada uma o seu teste (3 de 3) e foram revertidas. |
| 6 | `docs/taxonomia/AUDITORIA_TAXONOMIA_PECAS.md` citava `WardrobeService.ANALYZER_SYSTEM`. | minor | **Confirmado** | Aponta para `PieceAnalyzerPrompts.ANALYZER_SYSTEM` e `PieceAnalysisParser.parseAnalysis()`. |
| 7 | `docs/novos-rf/RF4_Buscador_Web_Marcas.md` citava `WardrobeService.brandFromWebSearch`. | minor | **Confirmado** | Aponta para `PieceFormWriter.brandFromWebSearch` (chamado por `WardrobeService.create/update`). Checklists datados de 2026-09-27 que citam `WardrobeService.prefill/defaultStyle` ficaram como registro histórico. |

Nenhum achado foi rejeitado. Testes depois das correções: 418 testes da lista do lote (+ `WardrobeAnalyzeSyntheticFlowTest`),
0 falhas, 0 erros, 3 skipped (os de `WardrobeAnalyzeFlowTest`); `fai-web` 699 testes, 0 falhas.
