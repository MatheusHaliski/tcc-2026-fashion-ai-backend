# Pipeline de imagens da Busca Catalogada — CATALOG_IMAGE_PIPELINE_V2

> 05/10/2026 · RF47 (Acervo & Busca Catalogada). Transforma cada foto oficial (marca, loja oficial, página oficial do
> produto) numa foto de catálogo consistente e **validada por métricas automáticas**, ou a recusa com motivo.
> Código: `fai-application/.../catalog/image/` · Registro: `catalog/semantic-regions.json` · Migração: `V38`.

## 1. Decisão de licenciamento: dois níveis

| Nível | Quando | O que se grava | O que o card mostra |
|---|---|---|---|
| **A — metadados** | toda fonte (hoje: todas) | recorte semântico 4:5, região de foco, métricas, veredito, pHash, dimensões | a **URL original** da marca com o recorte aplicado na exibição (nada é copiado; RN47.03 intacta) |
| **B — master** | fonte com `catalog_sources.allows_image_persistence = true` (parceria) | tudo do nível A + master PNG transparente e variantes branco/neutro/card/thumb no storage | o master processado (`stored_url` / `assets_json`) |

Remover pessoa ou objeto da foto **sem copiar a foto** é impossível; por isso, no nível A, a foto com pessoa vai para
revisão (ou cede a vez a outra foto oficial), e o distrator separado da peça fica **fora do recorte**.

## 2. Auditoria do fluxo anterior (antes desta mudança)

1. O coletor gravava só a URL (`catalog_images`, `REFERENCE_ONLY`); nenhuma análise da foto.
2. `CatalogService.card()` devolvia sempre a `image_url` original da foto principal.
3. O card do front (`CatalogResultCard`) era 1:1, `object-fit: contain`: peça pequena no canto ficava pequena no canto;
   foto com modelo mostrava o modelo; pacote com adereço mostrava o adereço.
4. `catalog_images` não tinha dimensões, MIME, hash de conteúdo, pHash, qualidade nem estado de processamento.
5. Os motores de visão do RF4 (recorte local, landmarks, enquadramento do feed, métricas) não eram usados no catálogo.
6. `JdkWebFetchAdapter` liberava o host quando o DNS falhava (brecha de SSRF sem proxy).
7. `OfficialCatalogDiscovery.imageAllowed` não aceitava os CDNs de plataforma de loja que o coletor Python aceita.

## 3. Problemas → o que resolve

| Problema | Resolução |
|---|---|
| peça pequena/descentralizada | SEMANTIC REFRAMING com ocupação 0,70–0,90 e âncora por categoria |
| modelo/pessoa na foto | evidência de pessoa → nível A: revisão; nível B: REJECT_IMAGE (sem reconstrução) |
| adereço/outra peça | componentes conexos; distrator sai da máscara e o CropScore penaliza recorte que o inclua |
| cabide | gancho estreito no topo de peça de cima sai da máscara |
| foto de detalhe como principal | `detailView` → papel DETAIL (catalogDetailImage), nunca canônica |
| mesma foto em várias URLs | cache por `source_sha256` + duplicata por pHash (distância ≤ 6) |
| foto pequena | IMAGE_TOO_SMALL (lado < 320 px ou peça < 200 px); nunca upscale |
| sem métricas | 14 métricas + Quality Gate |
| SSRF | fetch só https/porta 443/IP público, redirecionamento revalidado, DNS que falha = recusa sem proxy |

## 4. Arquitetura

```
CatalogImagePipelineService (@Scheduled, desligado por padrão)
  ├─ WebFetchPort ............ OfficialImageFetcher (download seguro, limite 10 MB, MIME por magic bytes)
  ├─ CatalogImagePipeline .... orquestrador puro (sem rede/banco/disco)
  │    ├─ ProductSegmenter ........ ProductDetector + ProductSegmenter + HumanRemover/DistractorRemover (máscara)
  │    ├─ LandmarkDetector ........ GarmentRegionDetector (landmarks da máscara)
  │    ├─ FramingStrategy ×4 ...... SemanticFocusAnalyzer (Upper/Lower/Shoes/Accessory) + SemanticRegionRegistry
  │    ├─ SemanticCropper ......... semanticCrop + CropScore + smartPadding + visualCenter
  │    ├─ BackgroundNormalizer .... fundo transparente/branco/neutro/card (só nível B)
  │    ├─ DetailPreserver ......... só reduz, em passos de 2×, bicúbico; nunca amplia
  │    ├─ ImageQualityAnalyzer .... métricas
  │    └─ CatalogImageValidator ... Quality Gate
  ├─ ImageCandidateRanker .... ImageCandidateScore + canônica por produto
  └─ MediaStoragePort ........ master do nível B
AdminCatalogImageController  /api/admin/catalog-images  (fila, decisão, métricas, depuração)
CatalogService.card()        → catalogImage { url, mode, crop, background }
CatalogPhoto (front)         → recorte 4:5 sobre a URL original, ou master processado
```

Estágios e logs (cada um registra duração e nota em `metrics_json.stages`):
`VALIDATION → SEGMENTATION → DISTRACTOR_REMOVAL → ROI → REFRAMING → [BACKGROUND_NORMALIZATION] → VALIDATING`.

## 5. Estratégias por piece_type (Strategy)

| piece_type | Estratégia | Foco padrão (registro) | Landmarks que ajustam |
|---|---|---|---|
| UPPER_PIECE / FULL_BODY_PIECE | `UpperPieceFramingStrategy` | gola/decote + parte alta do peito; camisa: gola + carcela; blazer: lapela + botões | `neckline_center`, ombros |
| LOWER_PIECE | `LowerPieceFramingStrategy` | cós + bolsos; jeans: cós, bolso frontal, bolso relógio | `waistband_center` |
| SHOES_PIECE | `ShoesFramingStrategy` | cadarço/lingueta/cabedal; sem cadarço (`laceless`): gáspea, tiras, cano | `collar_top`, `toe` |
| ACCESSORY_PIECE | `AccessoryFramingStrategy` | objeto inteiro + assinatura (mostrador, fivela, fecho, ponte) | `dial_center`, `bridge_center` |

Subcategoria nova = uma entrada em `catalog/semantic-regions.json` (teste garante que toda subcategoria do registro
existe na taxonomia, no mesmo piece_type).

## 6. Algoritmos

- **Máscara**: PNG/WebP oficial já recortado (≥ 5% transparente) usa o alfa da marca (confiança 0,95); senão
  `ImageOps.removeBackgroundLocal` (k-means Lab na borda + crescimento que não atravessa contorno).
- **Distratores**: rotulagem 4-conexa; maior componente = produto; par de calçado (≥ 25%) fica; componente que toca a
  caixa do produto e é menor que metade dele fica (alça, manga solta); manchas < 0,5% são ruído; o resto é distrator.
- **Cabide**: linhas do topo com largura < 8% da peça, até 25% da altura, saem da máscara.
- **Pessoa**: pele (YCbCr) cuja cor está a > 70 de distância RGB da cor mediana da peça ÷ área da peça
  (couro caramelo não conta; braço sobre camiseta azul conta) + segmentador de pessoa ONNX quando disponível. ≥ 0,06 = pessoa.
- **visualCenter**: centróide da máscara.
- **semanticCrop**: para cada ocupação f ∈ [mín, máx] (passo 0,02): altura = max(ph/f, pw/(f·a)), largura = a·altura
  (a = 4/5, em pixels — nunca estica); posições x ∈ {centro da caixa, centróide, foco na âncora}, y ∈ {centro, foco na
  âncora, topo com margem, base com margem}; lado em que a peça já vem cortada encosta na borda.
- **CropScore** = 0,30 peça inteira + 0,15 regiões críticas + 0,15 foco na âncora + 0,15 ocupação + 0,10 margem
  (≥ 4–8%) + 0,05 pouco padding + 0,10 sem distrator; recorte que corta peça que veio inteira vale metade.
- **Detalhe**: foco ampliado 15% em 4:5 dentro da foto, só se a região tem ≥ 240 px (catalogDetailImage).
- **pHash**: dHash 64 bits sobre médias de blocos 9×8 com tolerância de 2 níveis (fundo liso não gera bits aleatórios).

## 7. Métricas (0–1, 1 = melhor)

`segmentationConfidence`, `productVisibility`, `garmentCompleteness`, `occupancyScore`, `emptySpace`/`emptySpaceScore`,
`focusScore`, `cropScore`, `edgeQuality`, `colorPreservationScore` (ΔE76 médio em Lab antes/depois; 1 no nível A),
`logoPreservationScore` (logo detectado dentro do recorte), `reconstructionConfidence` (0 quando seria preciso
reconstruir pixels), `sourceQuality` (resolução + nitidez), `humanResidueScore`, `objectResidueScore`.
`qualityScore` = média ponderada (`ImageQualityAnalyzer.WEIGHTS`).

## 8. Quality Gate

| Saída | Regra |
|---|---|
| **REJECTED** | UNSUPPORTED_MIME, IMAGE_TOO_LARGE, UNREADABLE_IMAGE, IMAGE_TOO_SMALL, NO_PRODUCT, HUMAN_OCCLUSION_REJECT_IMAGE (nível B), ou qualidade < 0,50 |
| **NEEDS_REPROCESSING** (fila do admin, `manualReview`) | HUMAN_PRESENT (nível A), LOW_SEGMENTATION, PRODUCT_TRUNCATED_IN_SOURCE, DISTRACTOR_IN_FRAME, WEAK_CROP, ROUGH_EDGES, IMAGE_TOO_SMALL_FOR_MASTER, ou qualidade < 0,70 |
| **APPROVED** | nenhum motivo e qualidade ≥ 0,70 |

## 9. Fallback e multi-imagem

Ordem: **outra foto oficial → outra vista → revisão manual → rejeição**. `ImageCandidateRanker`:
score = 0,6 qualidade + 0,3 vista (FRONT/PACKSHOT 1,0 › TOP 0,8 › SIDE 0,7 › OTHER 0,6 › BACK 0,5 › SOLE 0,3 › DETAIL 0,1)
+ 0,1 aprovada. Papéis: CANONICAL (CANONICAL_PRODUCT_IMAGE), ALTERNATE, DETAIL, DUPLICATE, REVIEW, REJECTED. Sem
aprovada, não há canônica e o card segue com a foto principal inteira. Escolha manual do admin prevalece.
`GET /api/catalog/products/{id}` lista cada foto como CatalogProductImage (viewType, qualityScore, sourceUrl,
processedUrl, viewRole, canonical).

## 10. Modelo de dados (V38, sem duplicar estrutura)

`catalog_images` + `width, height, mime, source_sha256, phash, processing_status, pipeline_version, quality_score,
gate_reasons, view_role, is_canonical, review_status, crop_json, metrics_json, assets_json, attempts, processed_at`.
O produto **não** ganha colunas: `canonicalImageUrl` = imagem com `is_canonical`; `sourceImageUrl` = `image_url`;
`imageProcessingStatus`/`imageQualityScore`/`imagePipelineVersion` vêm dela. Proveniência já existia
(`source_type`, `source_url`, `source_domain`, `retrieved_at`).

`crop_json`: `{aspect:"4:5", crop, focus{name,rect,source}, product, analysis, detail?, background, padding}` — todos os
retângulos normalizados na foto original.

## 11. Worker e estados

`processing_status` é o estado do job: `PENDING → DOWNLOADING → APPROVED | NEEDS_REPROCESSING | REJECTED | FAILED`
(ANALYZING/SEGMENTING/CLEANING/REFRAMING/VALIDATING ficam no log de estágios, sem uma escrita no banco por estágio).
`@Scheduled` a cada 15 s, lote de 8, até 3 tentativas. Idempotência: `image_url_hash` + `pipeline_version` — subir a
versão do pipeline reprocessa tudo sozinho. Configuração: `CATALOG_IMAGE_PIPELINE_ENABLED` (padrão **false**),
`_BATCH`, `_POLL_MS`, `_MAX_ATTEMPTS`. Log estruturado: `event=catalog_image_processed imageId productId status quality
reasons persisted cached ms version` e `event=catalog_image_review imageId action admin`.

## 12. Segurança das URLs

`JdkWebFetchAdapter`: só `https`, porta 443, sem userinfo, todos os IPs resolvidos públicos (sem loopback, privada,
link-local, CGNAT, ULA, multicast), até 3 redirecionamentos revalidados um a um, timeout 5 s/8 s, corte em 10 MB.
**Novo**: nome que não resolve só passa atrás de proxy de saída; sem proxy é recusa. MIME aceito pelo conteúdo
(jpeg/png/webp), limite de pixels/lado do `ImageOps`. Resta: a revalidação de DNS no momento da conexão (rebinding)
depende do proxy de saída — risco residual documentado.

## 13. Admin

`/admin/catalog-images`: painel (por status, canônicas, fila, qualidade média, motivos), fila
(CatalogImageReviewQueue) com **antes** (foto oficial + depuração visual: bbox, distratores, foco, regiões críticas,
candidatos, recorte final) e **depois** (card 4:5), ações APPROVE / REPROCESS / SELECT_ALTERNATE_IMAGE / REJECT.
Antes/depois só no admin; a pessoa usuária vê só o card final.

## 14. Front

`CatalogPhoto` + `semanticCropStyle`: quadro 4:5 (igual aos cards de peça), a foto original posicionada para mostrar
exatamente o recorte (largura 1/w, deslocamento −x/w, −y/h); recorte além da borda mostra a cor do fundo da foto.
A canônica também alimenta a peça criada do catálogo (`from-catalog`) e, por ela, o analisador de IA.

## 15. Testes e fixtures

- `CatalogPhotos` (fixtures visuais sintéticas): packshot, peça pequena no canto, jeans, tênis, relógio, cabide,
  adereço, pessoa vestindo, peça cortada na origem, foto pequena, fundo vazio, PNG já recortado.
- `CatalogImagePipelineTest` (14): aprovação + 4:5 sem esticar + ocupação; reenquadramento; foco por categoria
  (jeans, tênis × mocassim, relógio); cabide; distrator; pessoa (A revisão, B rejeição); peça cortada; foto pequena e
  MIME inválido; fundo vazio; master nível B (transparência, variantes, cor); alfa da marca; pHash.
- `SemanticRegionRegistryTest`, `ImageCandidateRankerTest`, `CatalogImagePipelineServiceTest` (nível A só metadados,
  nível B grava master, falha de download, cache por hash/duplicata, fila + escolha de alternativa, ações, só admin,
  worker desligado), `WebFetchSafetyTest` (DNS que falha), `OfficialCatalogDiscoveryTest` (CDN de loja),
  `catalog-photo.test.tsx`.
- **Regressão visual**: as fixtures são determinísticas (semente fixa); mudança de algoritmo que altere veredito,
  foco ou ocupação quebra o teste.

## 16. Plano incremental

1. ✅ Núcleo puro + registro + estratégias + gate + ranker + testes.
2. ✅ V38, worker desligado por padrão, endpoints admin, card 4:5 com recorte, fix de SSRF.
3. Importar o acervo no MySQL do Railway; ligar `CATALOG_IMAGE_PIPELINE_ENABLED` em homologação; acompanhar o painel.
4. Calibrar limiares com uma amostra real rotulada (100 fotos por piece_type) e versionar como V3 se mudar o veredito.
5. Fixtures reais de marcas parceiras (nível B) quando houver contrato de persistência.
6. Segmentador semântico de peça (ONNX) no lugar do recorte por cor, para fotos com fundo texturizado.
