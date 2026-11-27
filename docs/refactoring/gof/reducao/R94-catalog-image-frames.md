# Lote R94-catalog-image-frames — `fai-application/.../application/catalog/image/`

Base: `claude/relaxed-pasteur-5b5466`. Branch: `worktree-agent-a68f09da88dcd224b`. Objetivo: os 4 algoritmos de imagem do
lote dentro de 250 linhas (`java-outro`, `docs/refactoring/LINE_RULES.md`), extraindo responsabilidades, sem mudar nenhum
pixel, número ou mapa de saída. `CatalogImagePipelineService`, `CatalogImagePipeline` e `CatalogImageBatchCli` não foram
tocados (outro lote).

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `ProductRuleFrame.java` | 757 | 223 | `UpperCoverFrame.java` (93): COVER/TOP da parte de cima e da peça inteira (`upper`); `LowerCoverFrame.java` (165): COVER/TOP da parte de baixo (`lower`) + geometria das pernas (`legGapCenter`, `crotchAlong`, `hemBelow`); `GarmentColorEdges.java` (119): bordas por cor (`waistEdge`, `abruptEdgeDown`, `meanColor`, `lowerColors`, `dominant`, `near`); `ObjectRuleFrame.java` (150): WIDTH/CONTAIN/COVER-FOCUS do objeto inteiro (`object`, `shiftInside`); `CoverSearch.java` (114): busca do quadro de cobertura (`Window`, `cover`, `inset`, `halfSpans`, `largest`, `firstFit`, `medianRowWidth`, `rowsBox`) | NENHUM |
| `FabricFrame.java` | 581 | 188 | `FabricColors.java` (142): fundo de estúdio, cores da peça, pele estranha, bordas de cor, abertura pela cor; `FabricMasks.java` (130): primeiro plano, componentes, erosão, cobertura, linha larga, centro, alfa; `FabricAnchor.java` (82): maior 3:4 em tecido com o ponto da categoria; `FabricPlanner.java` (115): região e âncora por categoria (`plan`, `clip`) | NENHUM |
| `SemanticCropper.java` | 296 | 215 | `ProductRuleCrop.java` (115): `ruleCrop` + `ruleScore` (cálculo e conformidade da Regra de Enquadramento) | NENHUM |
| `ProductSegmenter.java` | 253 | 211 | `ConnectedComponents.java` (55): rotulagem 4-conexa `components` | NENHUM |

Todas as classes novas são `final`, package-private, com construtor privado e métodos estáticos puros (sem Spring, I/O
ou estado). Os corpos foram movidos sem alteração: dentro dos colaboradores, as chamadas que eram locais continuam
sem qualificação graças a `import static` / import do tipo aninhado (`ProductRuleFrame.Result`/`Context`,
`CoverSearch.Window`, `FabricFrame.Plan`); só as chamadas antes qualificadas a `FabricFrame.x`/`ProductSegmenter.components`
passaram a apontar para o novo dono (`FabricMasks`, `FabricColors`, `ConnectedComponents`).

API mantida:
- `ProductRuleFrame`: `VERSION`, `ASPECT_W/H`, `Result` (+ `toMap`), os dois `find` e as constantes lidas por testes
  (`MIN_COVER_WIDTH_SHARE`, `MIN_PERSON_SKIN`, `OBJECT_PERSON_SKIN`, `MIN_WIDTH_PX`) ficam no dono. O record `Context`
  deixou de ser `private` (agora package-private) porque os três colaboradores de regra o recebem; `garmentResult`,
  `garmentMask`, `norm`, `erosion`, `hex` ficaram no dono (package-private) por serem compartilhados.
- `FabricFrame`: `VERSION`, `Result`, `Mask`, `find` (2), `mask`, `target`, `Plan`; `plan` e `erode` ficam como delegação
  de uma linha (usados por `FabricFrameTest`).
- `SemanticCropper`: `crop`, `registryRuleCrop`, `registryFocus`, `ruleCrop` (pública, delegação), `ruleScore`
  (delegação), `snapTruncated`, `keepCutSideInside`, `score`, `detail`.
- `ProductSegmenter`: `segment`, `Segmentation`, `alreadyCut`, `trimHanger`, `rowWidth`, `edgeQuality`, `foreignSkin`.

Métodos package-private que saíram do dono sem delegação (todos os chamadores eram os arquivos do lote e foram
redirecionados): `ProductSegmenter.components`; `FabricFrame.studioBackground`, `studioForeground`, `keepLarge`,
`largestComponent`, `anchored`, `colorEdge`, `openByColor`, `alphaOf`, `firstWideRow`, `centerX`, `garmentMedian`,
`foreignSkin` (2), `garmentColors`, `coverage`; `ProductRuleFrame.legGapCenter`, `crotchAlong`, `waistEdge`,
`abruptEdgeDown`, `hemBelow`, `lowerColors`, `dominant`, `shiftInside`, `Window`, `cover`, `inset`, `halfSpans`,
`largest`, `firstFit`, `medianRowWidth`, `rowsBox`. Nenhum consumidor fora do pacote usava esses membros
(`FeedFraming` usa só `SemanticCropper.registryRuleCrop`; `CatalogImagePipeline` usa só `FabricFrame.mask/find`,
`ProductRuleFrame.find`, `SemanticCropper.crop` e `ProductSegmenter.segment/foreignSkin`).

## Por que NENHUM padrão GoF

- **ProductRuleFrame**: `find` escolhe entre três algoritmos (parte de cima, parte de baixo, objeto) por tipo e regra,
  o que lembra Strategy. Mas os três têm entradas diferentes (o objeto precisa da segmentação e do foco detectado), saem
  de um `if` de duas linhas e não variam em tempo de execução. A estrutura não era de Strategy e criar uma interface só
  para "ter o padrão" não resolveria nenhum problema. Por isso viraram funções estáticas em classes coesas.
- **FabricFrame**: `plan` é um `switch` por categoria que monta região e âncora com variáveis compartilhadas (centro,
  ombros, cós). Separá-lo em uma Strategy por categoria espalharia 10 a 30 linhas acopladas aos mesmos utilitários de
  cor e máscara. Foi extraído inteiro (`FabricPlanner`), junto com os algoritmos puros de cor, máscara e ancoragem.
- **SemanticCropper / ProductSegmenter**: extrações de cálculo puro (regra de recorte e conformidade; rotulagem de
  componentes). Não há família de variações nem estado.

Sem padrão aplicado, nenhuma linha foi acrescentada em `PATTERN_DECISIONS.md`.

## Testes e equivalência

`CatalogImageFramesCharacterizationTest` (novo, 231 linhas) e `CatalogImageFramesExpected` (189 linhas, digests) geram
imagens sintéticas em memória: as fixtures de `CatalogPhotos` (camiseta packshot, com cabide, com adereço, vestida,
cortada; jeans; calça em modelo com e sem a mão no quadril; tênis; relógio) e mais três criadas no teste (camisa sobre
jeans num modelo, bolsa sozinha encostada na borda, bolsa carregada com braço). Para cada foto o teste compara:
segmentação (pixels, máscara, caixas e números), `FabricFrame.Mask` (todas as máscaras, caixa, pele, fundo),
`FabricFrame.find` com e sem foco de landmark, `ProductRuleFrame.find` em 3:4 e em 4:5 com três focos, e
`SemanticCropper.crop` (melhor recorte, 5 candidatos, detalhe, análise, conformidade) em 1 a 4 subcategorias por foto.
Também compara funções puras com máscara aleatória semeada (`components`, `erode`, `halfSpans`, `cover`,
`medianRowWidth`, `rowsBox`), as 18 combinações de `ruleCrop`/`ruleScore` e `snapTruncated`/`keepCutSideInside`/`detail`.
São 177 digests SHA-256 do texto canônico. Mapas são ordenados por chave porque `Map.of` em
`FramingRule.toMap`, `FabricFrame.Result.toMap` (`anchor`) e `ruleScore` (`focusCenter`) muda a ordem de iteração por
JVM. Conjuntos também são ordenados.
Os digests foram capturados no código original e conferidos em uma segunda JVM antes da extração (commit `test(...)`
separado). Depois da extração só mudaram, no teste, os nomes das classes chamadas diretamente (`CoverSearch.*`,
`ConnectedComponents.components`). As chaves e os valores esperados continuam os mesmos.

| Etapa | Comando | Resultado |
|---|---|---|
| Antes (original + caracterização) | `mvn -B -q -o -pl fai-application -Djacoco.skip=true -Dsurefire.failIfNoSpecifiedTests=false -Dtest='CatalogImageFramesCharacterizationTest,ProductRuleFrameTest,FabricFrameTest,CatalogImagePipelineTest,CatalogPreviewRendererTest,CatalogImagePipelineServiceTest,ImageCandidateRankerTest,SemanticRegionRegistryTest,GarmentCropTest,CatalogImageIdentityTest' test` | 109 testes, 0 falhas, 0 skipped |
| Depois da extração | mesmo comando | 109 testes, 0 falhas; os 177 digests idênticos |
| Compilação dos dependentes | `mvn -B -q -o -pl fai-web -am -Djacoco.skip=true -DskipTests install` | OK |
| Suíte do módulo | `mvn -B -o -pl fai-application -Djacoco.skip=true test` | 2059 testes, 0 falhas, 0 erros, 27 skipped (`assumeTrue` preexistentes) |
| Catraca | `python3 scripts/refactoring/line_ratchet.py` | os 4 arquivos só como `APERTAR` (757→223, 581→188, 296→215, 253→211); 0 violações |

O lote não usa banco, servidor, rede, IA paga, GPU ou bucket. Nenhum DTO, URL, schema, i18n, visual, autorização ou
transação mudou.

## Pendências

- O integrador deve rodar `python -m scripts.refactoring.line_ratchet --update` para tirar as 4 entradas do baseline.
- Algumas linhas longas que já existiam (mais de 150 colunas) foram movidas como estavam. Não foram reformatadas.
