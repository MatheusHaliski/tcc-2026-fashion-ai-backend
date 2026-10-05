# Pipeline de imagens oficiais do catálogo — `CATALOG_IMAGE_PIPELINE_V2`

> RF47 · Busca Catalogada de Peças. Toda foto oficial (URL de marca, loja oficial ou página oficial de produto) passa
> por **fonte → validação → detecção → segmentação → remoção de distratores → ROI por categoria → reenquadramento
> semântico → normalização de fundo → preservação de detalhe → quality gate** antes de virar a foto do produto no acervo.
>
> Código: `fai-application/.../catalog/image/**` (pipeline), `fai-infrastructure/.../catalog/image/**` (download seguro),
> `fai-web/.../CatalogImageAdminController` (fila e painel), `components/catalog/official-image.tsx` (exibição),
> `app/(site)/(app)/admin/catalog-images` (admin). Migration `V44__pipeline_imagens_oficiais.sql`.
> Levantamento que embasa este documento: workflow *Understand* de 05/10/2026 (6 mapas + 8 perguntas críticas, com
> amostra rotulada de 682 fotos reais do acervo).

Índice dos 24 entregáveis: [1 Auditoria](#1-auditoria-do-pipeline-atual) · [2 Fluxo atual](#2-fluxo-atual) ·
[3 Problemas](#3-problemas-encontrados) · [4 Arquitetura](#4-arquitetura-nova) · [5 Estratégia por piece_type](#5-estratégia-por-piece_type) ·
[6 Estratégia por subcategoria](#6-estratégia-por-subcategoria-semantic-region-registry) · [7 SemanticFocusRegion](#7-modelo-semanticfocusregion) ·
[8 SemanticCrop](#8-algoritmo-de-semanticcrop) · [9 Ranking](#9-ranking-de-imagens-imagecandidatescore) ·
[10 Remoção de humanos](#10-remoção-de-humanos) · [11 Remoção de objetos](#11-remoção-de-objetos-e-distratores) ·
[12 Preservação de logos e costuras](#12-preservação-de-logos-costuras-e-cor) · [13 Normalização de fundo](#13-normalização-de-fundo) ·
[14 Normalização de escala](#14-normalização-de-escala-perfis-por-categoria) · [15 Métricas](#15-métricas-de-qualidade) ·
[16 Quality Gate](#16-quality-gate) · [17 Fallback](#17-fallback) · [18 Múltiplas imagens](#18-múltiplas-imagens-e-canonical_product_image) ·
[19 Modelagem do CatalogProduct](#19-modelagem-catalogproduct-catalogimage-jobs-assets-revisão) · [20 Workers/jobs](#20-workers-e-jobs) ·
[21 Segurança de URL](#21-segurança-de-url-ssrf-e-afins) · [22 Testes](#22-testes) · [23 Fixtures](#23-fixtures-e-dataset-de-regressão) ·
[24 Plano incremental](#24-plano-de-implementação-incremental)

---

## 0. A restrição que decide o desenho: direito de uso das fotos

O pedido é guardar `sourceImage` + `catalogMasterImage` (+ variantes). O próprio projeto proíbe isso hoje:

- **RN47.03** (`RF47_ACERVO_BUSCA_CATALOGADA.md`): sem licença de persistência a imagem fica `REFERENCE_ONLY` — *só a URL*.
- `catalog_sources.allows_image_persistence` é `FALSE` nas **112 fontes** (default da V30, seed da V30, `brands.json` não
  tem a chave, `ingest.py` assume `False`). Nada no código liga essa flag.
- Termos de Uso 6.1: as fotos do catálogo pertencem às marcas e aparecem "como referências às fontes oficiais". A licença
  que inclui "recortar, remover fundo" (5.2) cobre só o conteúdo do próprio usuário. Lei 9.610/1998, art. 29, exige
  autorização para reprodução, adaptação e "quaisquer outras transformações". Recortar ou trocar o fundo de uma foto de
  produto é uma cópia mais uma transformação.

Por isso o pipeline tem um **gate de licença fail-closed** (`ImageRightsPolicy`), com dois modos de saída:

| Direito da fonte (`catalog_sources.image_rights`) | Modo | O que é gravado | Como o card mostra |
|---|---|---|---|
| `REFERENCE_ONLY` (padrão, 112/112 hoje) | **PARAMETRIC** | só números: janela de recorte por aspecto, cor de fundo, métricas, hashes, decisão | a URL oficial, com o enquadramento aplicado na tela (CSS) |
| `STORE` | PARAMETRIC (+ cópia fiel da fonte em `restricted/`, para a equipe) | idem + `SOURCE_COPY` | idem |
| `DERIVE_PUBLISH` | **MATERIALIZED** | master transparente, branco, neutro, card 4:5, quadrado 1:1, thumb, detalhe, entrada da IA | as variantes no nosso storage (`/media/catalog/...`) |

- **Análise transitória.** No modo PARAMETRIC a foto é baixada só para a memória do worker, analisada **apenas por
  processadores locais** (nada de remove.bg, Photoroom ou Gemini com a foto de uma marca sem autorização) e descartada.
  O RF47 ganha a **RN47.11** com esta regra e a **RN47.12** (derivado publicado exige `DERIVE_PUBLISH` com evidência);
  as duas estão marcadas *[validar com jurídico]*.
- **Concessão de direito.** O direito é dado por fonte no admin, com evidência obrigatória (contrato, termo ou e-mail),
  responsável, data e validade. Vencida a validade, a fonte volta a ser tratada como `REFERENCE_ONLY` (fail-closed).
- **O que isto significa para o critério 100.** "A foto oficial vira uma foto de catálogo FashionAI que cumpre todos os
  critérios" só é atingível de fato no modo MATERIALIZED. No PARAMETRIC o pipeline entrega o melhor resultado
  **legalmente possível**, em dois níveis:
  - `FRAMED_PACKSHOT`: packshot de fundo liso, sem pessoa, reenquadrado. Na tela é equivalente ao master.
  - `FRAMED_REFERENCE`: foto com modelo ou cena, enquadrada na peça. Aparece abaixo dos packshots e nunca é chamada de
    master.

  O nível fica gravado (`catalog_images.quality_tier`) e aparece no painel.

---

## 1. Auditoria do pipeline atual

| Etapa pedida | Situação em 05/10/2026 | Evidência |
|---|---|---|
| Fonte | Ninguém baixa foto oficial. O coletor grava a URL; a busca e o guarda-roupa fazem hotlink. | `official_sitemap.py:415`, `ingest.py:286-309`, `CatalogService.java:337`, `WardrobeService.java:1208-1221` |
| Validação | Nenhuma. Passam 6 `.mp4`, 847 URLs `.json` da AllSaints (as únicas fotos dos 298 produtos da marca) e 1 placeholder "image-unavailable". | acervo `acervo-oficial-2026-10-05.jsonl.gz` |
| Detecção de produto | Nenhuma no catálogo. Nas fotos do usuário, `LocalVision` só chuta pela proporção da caixa. | `LocalVision.java:108-129` |
| Segmentação | Só nas fotos do usuário: flood fill Lab local, ou rembg/remove.bg. Em produção nenhum provedor está configurado. | `ImageOps.java:421-524`, variáveis do Railway |
| Remoção de humanos/objetos | Inexistente no servidor. A segmentação de pessoa (ONNX, 6 classes) calcula a máscara e só devolve frações. | `OnnxPersonSegmenter.java:73-86` |
| ROI por categoria | Peças soltas: zonas `BrandRegions`, `LandmarkDetector`, templates do `FeedFraming`. Nenhum objeto ROI, e nada para cadarço ou detalhe-assinatura. | `BrandRegions.java:32-80`, `FeedFraming.java:251-463` |
| Reenquadramento | `FeedFraming` 4:5 corta a barra da calça e o joelho; `StudioFraming` força 1:1; `CanonicalPhotographer` é fiel mas não tem ROI e só roda em testes. | `StudioPipeline.java:262`, `CanonicalPhotographer.java:59-112` |
| Fundo | Só para fotos do usuário (PNG transparente 1024 e JPEG branco com sombra). | `FlatLayPipeline.java:164-165` |
| Detalhe | Nenhuma checagem de fidelidade. O estúdio altera pixels: denoise, sharpen, relight e ghost fill. | `StudioPipeline.java:130-353` |
| Quality gate | Três avaliadores sem coordenação: `QualityMetrics` mede cobertura depois de centralizar, `PhotoAcceptance`, e `PhotographyQualityGate`, que não está ligado a nada. | — |
| Jobs | Nenhum job de catálogo. `pipeline_jobs.user_id` é NOT NULL. A fila Redis nunca é consumida. Os workers `@Scheduled` dividem uma única thread. | `PipelineJob.java:32-34`, `FashionAiApplication.java:8` |
| Hash e dedupe | Só SHA-256 da **string** da URL. Não há hash perceptual. A Farm repete o mesmo arquivo em 277 produtos e a Bottega usa 8 URLs para 221 produtos. | `image_metadata.py:14-15` |
| Exibição | Busca em 1:1 com `contain`. A peça do catálogo aparece em 4:5 com `contain` e 9% de padding. Não há `onError`. CSP com `img-src https:`. | `globals.css:1520,1987`, `middleware.ts:31` |

**Composição real do acervo**, numa amostra de 682 fotos rotuladas, 8 produtos por host nos 45 hosts:

- **61% das URLs mostram uma pessoa.** Quase tudo é modelo em estúdio; cenas de lifestyle são raras.
- 37% são packshots limpos e 2% são detalhes ou amostras.
- Na foto principal, **50,4%** têm pessoa.
- **47,3%** dos produtos não têm nenhuma foto sem pessoa entre as 4 coletadas.
- Escolher outra foto resolve só **4,3%** dos produtos.

## 2. Fluxo atual

```
brands.json ─► collect_official (JSON-LD / og:image, ≤4 imagens, todas "PACKSHOT")
           ─► acervo .jsonl.gz ─► import_products/ingest (sha256(URL), REFERENCE_ONLY, 1ª = primária)
           ─► catalog_images ─► CatalogService.card(imageUrl = URL crua) ─► <img src=CDN da marca> 1:1 contain
           ─► addToWardrobe (storedUrl ?? imageUrl) ─► wardrobe_items.image_url = URL da marca (hotlink, sem estúdio)
```

As fotos do usuário seguem outro caminho, síncrono e dentro da requisição: `FlatLayPipeline → PhotoAcceptance → StudioPipeline`.

## 3. Problemas encontrados

1. Não existe estágio de imagem para o catálogo. A "foto do acervo" é a primeira URL que o coletor viu.
2. Em 61% dos casos há modelo, e em parte deles também roupa de outro produto (sapato e camisa num resultado de jeans).
   O card 1:1 com `contain` mostra a pessoa inteira e a peça pequena.
3. Foto errada. Variantes de cor fundidas (meia cinza com foto preta); a Bottega usa a mesma foto em 28 produtos; uma
   página "Tabby Denim Short" mostra uma regata.
4. Não-imagens e baixa resolução: `.mp4`, `.json`, thumbnails Hybris de 234 px e transformações de CDN como
   `wid=400&bgc=f0f0f0`.
5. Hotlink. A foto quebra quando a URL muda, a marca vê o IP de quem usa o app, o CORS quebra exportações, o 3D e o
   estúdio, e a CSP fica aberta.
6. Ninguém julga a qualidade, `REJECTED` nunca é atribuído e a foto primária nunca muda.
7. As peças criadas do catálogo herdam tudo isso, e estúdio, remoção de fundo e editor falham nelas.
8. Segurança. O `JdkWebFetchAdapter` tem janela de DNS rebinding e aceita qualquer host quando o DNS falha. A
   allowlist "o host contém o nome da marca" deixa passar `nike.attacker.tld`.

## 4. Arquitetura nova

```
                ┌──────────────────── CatalogImageWorker (pool próprio, SKIP LOCKED, lease) ────────────────────┐
catalog_image_jobs ─► CatalogImageJobService ─► CatalogImagePipeline.process(ProductContext, candidatos)        │
                                                    │                                                            │
  por candidata: OfficialImageFetcher ── OfficialImageUrlResolver (alta resolução por CDN)                     │
                   │  ImageSourcePolicy (host da marca/CDN, sufixo exato) · OfficialImageFetchPort (SSRF-safe)  │
                   ▼                                                                                            │
               VALIDAÇÃO (mime + mágicos + tamanho + dimensões + decode-bomb) → SourceImage (sha256, pHash, dHash)│
                   ▼                                                                                            │
               ProductSegmenter [NATIVE_ALPHA → STUDIO_BACKDROP → REMBG_SELF_HOSTED → LOCAL_FLOOD (→ THIRD_PARTY)]│
               PersonMaskProvider (ONNX selfie_multiclass, classes por pixel)                                   │
               ProductDetector (componentes + prior de categoria + pessoa)                                      │
               HumanRemover → DistractorRemover → Isolation (buracos transparentes; reconstruction = 0)         │
               ViewClassifier (ângulo + apresentação) ───► ImageCandidateRanker (ImageCandidateScore, dedupe)   │
                   ▼  (em ordem de ranking, até aprovar)                                                       │
               GarmentRegionDetector (landmarks + zonas + logo) → SemanticFocusAnalyzer (registry)              │
               FramingStrategy[Upper|Lower|Shoes|Accessory] → SemanticCropper (MASTER 4:5, CARD 4:5, SQUARE 1:1, DETAIL)
                   ▼                                                                                            │
               [MATERIALIZED] BackgroundNormalizer → DetailPreserver (ΔE, nitidez, halo)                       │
                   ▼                                                                                            │
               ImageQualityAnalyzer → CatalogImageValidator (Quality Gate) → FallbackPolicy                     │
                   ▼                                                                                            │
  persistência: catalog_images (análise, frames, métricas, decisão) · catalog_products (canonical_image_id…)    │
                catalog_image_assets (só MATERIALIZED) · catalog_image_reviews (NEEDS_REVIEW) · stages_json       │
                └──────────────────────────────────────────────────────────────────────────────────────────────┘
exibição: CatalogImageSelector (um só lugar para card/rank/product/addToWardrobe) → imageUrl + imageFrame + imageVariants
```

O código fica em `br.com.fashionai.application.catalog.image`, com a mesma divisão pedida:

| Serviço | Pacote | Responsabilidade |
|---|---|---|
| `OfficialImageFetcher` | `source` | resolver URL → política de host → download seguro → validação → `SourceImage` |
| `OfficialImageUrlResolver` | `source` | regras por CDN (Shopify, Scene7, Cloudinary, Thron, SFCC, Bynder, MK, A&F, AllSaints, VTEX…) |
| `ImageSourcePolicy` · `ImageRightsPolicy` | `source` | host permitido (sufixo exato de domínio) · modo PARAMETRIC/MATERIALIZED e terceiros |
| `ImageCandidateRanker` · `ViewClassifier` · `PerceptualHash` | `analysis` | ranking, ângulo/apresentação, pHash/dHash |
| `ProductDetector` | `analysis` | objetos: produto alvo, pessoa, outras peças, props, texto sobreposto |
| `ProductSegmenter` (+ providers) | `analysis` | cadeia de segmentação |
| `HumanRemover` · `DistractorRemover` | `analysis` | tirar pessoa e distratores sem inventar pixel |
| `GarmentRegionDetector` · `SemanticFocusAnalyzer` | `framing` | regiões semânticas e foco |
| `SemanticRegionRegistry` | `framing` | `catalog/semantic-regions.json` (configurável, versionado) |
| `UpperPieceFramingStrategy` · `LowerPieceFramingStrategy` · `ShoesFramingStrategy` · `AccessoryFramingStrategy` | `framing` | parâmetros e candidatos por tipo |
| `SemanticCropper` | `framing` | otimizador determinístico com `CropScore` |
| `BackgroundNormalizer` · `DetailPreserver` · `DebugOverlayRenderer` | `render` | variantes, fidelidade, overlay de debug |
| `ImageQualityAnalyzer` · `CatalogImageValidator` · `FallbackPolicy` | `quality` | métricas, Quality Gate, próximo passo |
| `CatalogImagePipeline` | raiz | orquestra (puro: sem banco) |
| `CatalogImageJobService` · `CatalogImageWorker` · `CatalogImageSelector` · `CatalogImageAdminService` | raiz | jobs, worker, exibição, admin |

Os princípios estão no código:

- A fonte nunca é sobrescrita (o hash é dos bytes originais).
- A escala é sempre uniforme (a janela tem a proporção do quadro).
- Nenhum pixel é gerado (`reconstructionConfidence = 0`; um buraco fica transparente).
- Espelhamento é proibido, porque inverteria logos.
- Toda decisão vem com motivo em código estável (`reasons`).

## 5. Estratégia por piece_type

| piece_type | Estratégia | Foco | Âncora | Card pode cortar | Ocupação (lado limitante) | Margem |
|---|---|---|---|---|---|---|
| UPPER (camiseta, polo, camisa, malha, agasalho, jaqueta) | `UpperPieceFramingStrategy` | gola/decote + parte alta do peito; polo/camisa: gola + carcela + logo; moletom: capuz + cordões; jaqueta: lapela/zíper | `neckline_center`, ombros | `BOTTOM` (barra), no máx. 25% da altura | 0.78–0.88 | 4–8% |
| FULL_BODY (vestido, macacão) | `UpperPieceFramingStrategy` (variante longa) | decote + cintura | `neckline_center` | `BOTTOM`, no máx. 35% | 0.80–0.90 (altura) | 4–6% |
| LOWER (calça, jeans, short, saia) | `LowerPieceFramingStrategy` | cós + bolso + costuras superiores; jeans: bolso frontal + relojinho | `waistband_center` | `BOTTOM` (pernas), no máx. 40% | 0.80–0.90 (altura) | 4–6% |
| SHOES | `ShoesFramingStrategy` | cadarço/língua, ou o equivalente (gáspea do mocassim, tira da sandália, salto, cano da bota) | `BASELINE` (sola numa linha fixa) | nunca | largura 0.85–0.92 | 4–8% |
| ACCESSORY | `AccessoryFramingStrategy` | objeto inteiro + detalhe-assinatura (mostrador, fivela, ferragem, lentes, aba) | centro | nunca | 0.72–0.88 | 6–8% |

- **O master (`Purpose.MASTER`) nunca corta a peça** (`productPreservation = 1`).
- **O card (`Purpose.CARD`) pode fazer o recorte semântico** pela borda permitida, mantendo a região de foco dentro da
  área segura e a fração mínima da peça.
- **O detalhe (`Purpose.DETAIL`) é um close da região-assinatura** e nunca substitui o master.

## 6. Estratégia por subcategoria (Semantic Region Registry)

O registro fica em `fai-application/src/main/resources/catalog/semantic-regions.json`. É dado, não código: cobre as **72
subcategorias ativas e as 8 LEGACY** (estas resolvidas para a ativa) e é versionado (`"version": "SEMANTIC_REGIONS_V1"`).

- **Base.** Os perfis partem do `CaptureProfiles` (família, `requiredVisibleRegions`, `brandRegions`).
- **Vocabulário de regiões.** Foi unificado, corrigindo as divergências entre `BrandRegions`, `ProductKnowledgeBase`,
  `CaptureProfiles` e `PhotographySpecs`. Exemplo: `toe_or_heel` virou `TOE` e `HEEL`, o que corrige o bug do
  CanonicalPhotographer que ignorava bico ou calcanhar cortado.
- **Formato de cada regra.** `code`, `weight`, `mustBeVisible`, `signature`, `anchorLandmark` e `relativeBox` (caixa
  relativa à caixa do produto).

| Perfil (exemplos de subcategoria) | Regiões de foco (peso) | Detalhe |
|---|---|---|
| `TSHIRT` (t_shirt, top, tank_top…) | COLLAR 1.0, UPPER_CHEST 0.8, CHEST_LOGO 0.6 | CHEST_LOGO |
| `POLO` (polo_shirt) | COLLAR 1.0, PLACKET 0.9, CHEST_LOGO 0.9 | CHEST_LOGO |
| `SHIRT` (dress_shirt, casual_shirt…) | COLLAR 1.0, PLACKET 0.8, CUFF 0.3 | COLLAR |
| `HOODIE` (hoodie, sweatshirt com capuz) | HOOD 1.0, DRAWSTRINGS 0.8, CHEST_LOGO 0.6 | DRAWSTRINGS |
| `JACKET` (jacket, blazer, coat…) | LAPEL 1.0, ZIPPER/CLOSURE 0.8, COLLAR 0.7 | CLOSURE |
| `KNITWEAR` (sweater, cardigan) | NECKLINE 1.0, KNIT_TEXTURE 0.6 | KNIT_TEXTURE |
| `JEANS` (jeans) | WAISTBAND 1.0, FRONT_POCKET 0.9, COIN_POCKET 0.7, UPPER_SEAMS 0.5 | COIN_POCKET |
| `PANTS` (tailored/chino/cargo/jogger…) | WAISTBAND 1.0, FRONT_POCKET 0.7, UPPER_SEAMS 0.5 | WAISTBAND |
| `SHORTS` · `SKIRT` | WAISTBAND 1.0, FRONT_POCKET 0.6 · WAISTBAND 1.0, HEM 0.4 | WAISTBAND |
| `DRESS` · `JUMPSUIT` | NECKLINE 1.0, WAIST 0.7 | NECKLINE |
| `SNEAKER` (casual/running/…) | LACES 1.0, TONGUE 0.9, SIDE_LOGO 0.7, TOE 0.4 | TONGUE |
| `LOAFER` · `MULE` | VAMP 1.0, BIT/ORNAMENT 0.8 · VAMP 1.0, HEEL_OPENING 0.5 | VAMP |
| `HEELS` · `SANDAL` | HEEL 0.9, TOE 0.8, STRAPS 0.7 · STRAPS 1.0, FOOTBED 0.5 | STRAPS |
| `BOOTS` | SHAFT 0.9, VAMP 0.8, LACES 0.6 | SHAFT |
| `WATCH` | DIAL 1.0, CASE 0.7, STRAP 0.4 | DIAL |
| `BAG` (handbag, backpack, tote…) | WHOLE_OBJECT 1.0, HARDWARE 0.8, HANDLE 0.6 | HARDWARE |
| `BELT` · `GLASSES` · `CAP/HAT` · `JEWELRY` · `SCARF` | BUCKLE · LENSES+BRIDGE · FRONT_PANEL+BRIM · CLASP/STONE · PATTERN | idem |

**Prioridade de marca.** As regiões típicas da base de conhecimento (`typical_regions` da V29: Lacoste `chest_left`,
Levi's `back_waistband_patch`, Nike `side_panel`/`tongue`…) somam +0.2 de peso quando a marca do produto bate.

## 7. Modelo SemanticFocusRegion

`ImageModel.SemanticFocusRegion(pieceType, subcategory, primary, regions[], visualCenterX, visualCenterY, profileId)`

- **Regiões.** `regions[]` são `SemanticRegion(code, box, weight, confidence, mustBeVisible, signature, source)`.
  `source` vale LANDMARK (ancorada num ponto do `LandmarkDetector`), RULE (caixa relativa do registro), LOGO_FINDER
  (`LogoFinder`/`BrandRegions.detectLogo`) ou BRAND_KB.
- **`primary`.** É a união das regiões com peso ≥ 0.7 e confiança ≥ 0.4. Sem nenhuma, é a faixa superior de 35% do
  produto (UPPER/LOWER/FULL_BODY), a metade superior (SHOES) ou o objeto inteiro (ACCESSORY).
- **`visualCenter`.** É onde o centro do `primary` deve cair no card, por padrão: UPPER (0.50, 0.38), LOWER (0.50,
  0.34), FULL_BODY (0.50, 0.36), SHOES (0.50, 0.45) e ACCESSORY (0.50, 0.48). O perfil pode sobrescrever.
- **Persistência.** Vai como JSON em `catalog_images.focus_json`, para o overlay de debug e para recalcular o
  enquadramento sem reprocessar.

## 8. Algoritmo de SemanticCrop

Entrada (`FramingInput`):

- caixa do produto e máscara na imagem de trabalho;
- foco;
- perfil;
- bordas da foto que cortam a peça.

Saída: `CropPlan` com:

- a **janela** na imagem de trabalho, da mesma proporção do quadro (em pixels), podendo passar de 0–1 (o fundo
  completa: *smart padding*);
- escala da fonte;
- ocupação (lado limitante, área e largura);
- margens por borda;
- preservação;
- visibilidade do foco;
- `CropScore`.

1. **Restrições duras.**
   - Escala uniforme.
   - `scale ≤ maxUpscale` (2.0) sobre a fonte em resolução cheia.
   - No MASTER: produto inteiro dentro do quadro e margem ≥ `marginMin` em toda borda.
   - No CARD: as bordas que cortam a peça são só as `cuttableEdges`, a fração visível fica ≥ `minCardPreservation` e
     o `primary` fica inteiro dentro da área segura (quadro menos `marginMin`).
2. **Candidatos.** É uma busca determinística em grade:
   - ocupação alvo de `occupancyMin` a `occupancyMax`, em 9 passos (shoes: largura alvo);
   - deslocamento vertical que leva o centro do foco ao `visualCenterY`, ±3 passos de 2% do quadro;
   - deslocamento horizontal centrado no produto (ou no foco, quando o card corta), ±2 passos.

   Cada candidato é ajustado às restrições: a janela é "empurrada" para dentro, nunca deformada.
3. **Nota.** `CropScore.total = 0.30·occupancy + 0.25·preservation + 0.20·focus + 0.15·centering + 0.10·margin −
   penalidades`.
   - **occupancy:** 1 dentro da faixa, queda linear até 0 a ±0.15 fora dela.
   - **preservation:** fração visível da máscara; no MASTER, < 0.995 elimina o candidato.
   - **focus:** fração do `primary` na área segura vezes o tamanho relativo do foco no quadro, saturando em 0.35.
   - **centering:** 1 − distância do centro do foco ao `visualCenter`, normalizada.
   - **margin:** 1 se todas as margens estão em [`marginMin`, `marginMax`] no eixo limitante e ≥ `marginMin` no outro.
   - **Penalidades:**
     - `UPSCALE_LIMITED` (−0.10) quando a resolução impede a ocupação mínima;
     - `PADDING_BEYOND_PHOTO` (−0.05 por lado) quando a janela sai da foto num lado em que a peça encosta na borda,
       porque esse corte da foto ficaria visível;
     - `BASELINE_OFF` (shoes, −0.10).
4. **Desempate** por ordem fixa: maior total, depois menor escala (menos ampliação), depois a janela mais alta. É
   determinístico.
5. O `SQUARE` 1:1 usa o mesmo otimizador com `Purpose.SQUARE`. Ele não corta a peça; as exceções são UPPER e LOWER,
   que podem cortar pela borda inferior até a preservação do card.
6. O `DETAIL` é a região de `detailRegion` expandida em 60% (mínimo de 12% do lado menor), em 4:5, com no máximo 2× de
   ampliação. Abaixo de 320 px úteis ele não existe.

**Frames para o modo PARAMETRIC.** A janela, normalizada na imagem de trabalho, é a mesma na fonte (a imagem de
trabalho é uma redução uniforme). O `frames["4:5"]` e o `frames["1:1"]` levam a janela e a cor de fundo amostrada da
borda (packshot) ou o fundo do card. O frontend posiciona a `<img>` dentro de um contêiner `overflow:hidden` com aquela
cor de fundo: largura `100/w %`, altura `100/h %`, `left = −x/w·100 %`, `top = −y/h·100 %`.

## 9. Ranking de imagens (ImageCandidateScore)

`ImageCandidateRanker.rank(analyses, ctx)` monta para cada candidata uma `CandidateScore(score, view, parts,
disqualifiers, duplicateOfBetter)`. A nota é a soma ponderada:

| Parte | Peso | Valores |
|---|---|---|
| presentation | 0.30 | PACKSHOT 1 · GHOST_MANNEQUIN 0.95 · FLAT_LAY 0.90 · ON_MODEL 0.45 · LIFESTYLE 0.10 · DETAIL_SHOT/SWATCH 0 |
| angle | 0.20 | FRONT 1, BACK 0.4, SIDE 0.6. Shoes: SIDE ou THREE_QUARTER 1, FRONT 0.7, SOLE/TOP 0.2 |
| resolution | 0.15 | lado maior do produto na fonte: 1 a partir de 1400 px, 0 em 400 px |
| background | 0.10 | `backgroundUniformity` |
| isolation | 0.10 | `garmentCompleteness × (1 − humanResidue)` |
| colorMatch | 0.10 | 1 − ΔE76(cor dominante da peça, cor do produto/variante)/50 |
| position | 0.05 | 1/(1+posição) |

**Desclassificam** (não podem ser master): não é imagem; decodificação falhou; DETAIL_SHOT ou SWATCH; produto não
encontrado; duplicata (pHash a distância ≤ 6 de uma candidata melhor, ou mesmo `sha256`).

Uma DETAIL_SHOT pode alimentar a variante DETAIL quando a origem é o mesmo produto.

## 10. Remoção de humanos

**Decisão: remoção por segmentação, sem reconstrução.**

**O que o `HumanRemover` faz:**

1. Obtém a máscara de pessoa pelo `PersonSegmentationPort.segmentClasses`: ONNX `selfie_multiclass_256x256`, local,
   Apache-2.0, cerca de 80 ms, já em produção.
2. Usa como pessoa as classes cabelo, pele do corpo e pele do rosto, com dilatação de 2 px, e como roupa a classe 4.
3. Tira a pessoa da máscara de primeiro plano. O que ela cobria vira buraco **transparente**.
4. Quando a roupa vestida tem vários componentes, o `DistractorRemover` escolhe o alvo (seção 11).

**Métricas que ele produz:**

- `humanResidue` = pixels de pessoa dentro do produto final;
- `occludedFraction` = pixels de pessoa dentro do casco convexo do produto, que vão virar buraco;
- `garmentCompleteness` = 1 − occluded − penalidade por borda da foto cortando uma região obrigatória.

**Por que não inpainting:** braços sobre a peça, mãos no bolso e peça cortada no peito exigiriam inventar tecido, o que
viola a RN47.06 ("nunca inventa").

**Consequências:**

- `reconstructionConfidence` é sempre 0.
- Se `occludedFraction > 3%`, o candidato **não vira master**: ou cai no ranking, ou fica como `FRAMED_REFERENCE` no
  modo PARAMETRIC (com o modelo visível, enquadrado na peça).
- A remoção completa só vale como master quando a peça fica íntegra. Exemplo: um vestido em modelo com braços para
  trás, `occludedFraction` ≤ 3%.

**Limite conhecido.** O modelo foi treinado com selfies, a 256 px. Em corpo inteiro ele erra mãos pequenas, então a
dilatação e o limiar de resíduo são conservadores. O teste de regressão usa máscaras sintéticas exatas.

## 11. Remoção de objetos e distratores

O `ProductDetector` produz `DetectedObject`s a partir de três fontes:

- os componentes conexos do primeiro plano;
- a pessoa;
- texto sobreposto (OCR ONNX quando disponível, ou faixas de alto contraste nos cantos).

O `DistractorRemover` escolhe o componente alvo por **prior de categoria** e aplica as regras abaixo:

- **Prior de posição por categoria** (UPPER: terço superior do corpo; LOWER: meio; SHOES: base; ACCESSORY: maior objeto
  isolado), combinado com **compatibilidade de forma** (proporção da caixa por piece_type) e **cor** (ΔE para a cor do
  produto).
- **O que sai:** os outros componentes ≥ 0.5% da imagem, como a outra peça do look, o sapato numa foto de calça ou a
  bolsa na mão. Componentes < 0.5% saem como ruído.
- **Pares.** Shoes e brincos ficam como um par: dois componentes de forma parecida lado a lado são o mesmo produto.
- **`objectResidue`:** pixels do produto final que o detector atribui a outro objeto.
- **Texto sobreposto ou marca d'água** sobre o produto: flag `TEXT_OVERLAY`, que leva à revisão.

## 12. Preservação de logos, costuras e cor

- O master é feito **só** com operações geométricas e reamostragem bilinear em espaço pré-multiplicado (sem halo):
  recorte, escala uniforme e translação. **Não há** denoise, sharpen, relight, ghost fill, upscale por IA, Photoroom ou
  espelhamento.
- O `DetailPreserver.verify` reamostra a fonte pelo mesmo plano e compara, dentro da máscara erodida em 2 px, com estes
  limites:
  - ΔE76 médio ≤ 2.0 e p95 ≤ 6.0, contra o cálculo de cor ou correção indevida;
  - razão de nitidez (variância do Laplaciano na máscara, corrigida pela escala) ≥ 0.90;
  - logo: a mesma razão dentro da caixa do `LogoFinder` ≥ 0.90;
  - halo de borda: diferença de luminância entre o anel de 2 px da borda do alfa e o interior adjacente ≤ 0.08.

  Falha leva à revisão (`DETAIL_LOSS`).
- A borda do alfa recebe refinamento, nunca o interior. São duas operações: suavização de 1 px no alfa e
  descontaminação de cor nos pixels de borda (a cor do fundo é removida pela fórmula de matting com o fundo amostrado).
- `generative` sai `false` no relatório. O selo "sem IA generativa" do `CanonicalPhotographer` vale para o master.

## 13. Normalização de fundo

O `BackgroundNormalizer.render`, só no modo MATERIALIZED, gera a partir do mesmo plano:

| Variante | Quadro | Fundo | Formato | Onde |
|---|---|---|---|---|
| `MASTER_TRANSPARENT` | 1600×2000 (4:5) | transparente | PNG | `restricted/` (equipe; fonte de verdade das variantes) |
| `MASTER_WHITE` | 1600×2000 | #FFFFFF | JPEG q0.92 | público |
| `MASTER_NEUTRAL` | 1600×2000 | #F2F2F2 | JPEG q0.92 | público |
| `CARD` | 800×1000 (4:5) | cor do card (`#F1F0EA` claro), pode ter recorte semântico | JPEG q0.88 | público |
| `SQUARE` | 800×800 (1:1) | branco | JPEG q0.88 | público (busca, pick) |
| `THUMBNAIL` | 320×320 | branco | JPEG q0.85 | público |
| `DETAIL` | 1200×1500 | branco | JPEG q0.90 | público |
| `AI_ANALYSIS` | 768×768, margem 6% | branco | PNG | `restricted/` (entrada do analisador de IA) |

Não há sombra sintética no master: sombra é estilo, e estilo fica no CSS do card. O card usa `object-fit: cover` no 4:5
sem os 9% de padding, porque a margem já está na imagem e não deve contar duas vezes.

No modo PARAMETRIC o fundo é a **cor amostrada da borda da foto oficial**. Assim um packshot branco aparece branco, sem a
caixa clara sobre o fundo do tema que se vê hoje no tema escuro.

## 14. Normalização de escala (perfis por categoria)

A "mesma escala visual" entre produtos de uma categoria vem de três coisas:

- a ocupação alvo por perfil;
- o lado limitante coerente por tipo;
- a âncora fixa: sola na linha de base nos calçados, gola em `visualCenterY` nas peças de cima.

| Perfil de escala | Medida | Alvo | Faixa aceita |
|---|---|---|---|
| UPPER / KNITWEAR / OUTERWEAR | altura ou largura (limitante) | 0.84 | 0.78–0.88 |
| FULL_BODY | altura | 0.86 | 0.80–0.90 |
| LOWER (calça) | altura | 0.86 | 0.80–0.90 |
| LOWER (short/saia) | limitante | 0.82 | 0.76–0.88 |
| SHOES | largura | 0.88 | 0.85–0.92 (margem 4%) |
| ACCESSORY (bolsa, mochila) | limitante | 0.80 | 0.72–0.88 |
| ACCESSORY (relógio, óculos, joia) | limitante | 0.76 | 0.70–0.84 |

## 15. Métricas de qualidade

O `ImageQualityAnalyzer.analyze` produz um `QualityReport.metrics`. Os nomes são estáveis, porque viram o
`metrics_json`, o painel e a regressão.

| Métrica | Definição |
|---|---|
| `source.width`, `source.height`, `source.bytes` | da fonte |
| `product.longSidePx` | lado maior do produto na fonte em resolução cheia |
| `resolution` | `min(1, longSidePx/1400)` |
| `upscale` | escala do master (> 1 = ampliação) |
| `sharpness` | variância do Laplaciano dentro da máscara / 300, saturada em 1 |
| `exposure.clippedHigh` / `exposure.clippedLow` | fração da peça em 255 ou 0 nos três canais |
| `background.uniformity` | 1 − desvio da cor da borda / 40 |
| `segmentation.confidence` | do provedor |
| `occupancy` / `occupancy.area` / `occupancy.width` | do plano MASTER |
| `margin.top/right/bottom/left` | do plano MASTER |
| `preservation.master` / `preservation.card` | fração da peça visível |
| `focus.visibility` / `focus.size` | foco dentro da área segura · área do foco no card |
| `human.fraction` / `human.residue` | pessoa na foto · pessoa dentro do produto final |
| `object.residue` | outros objetos dentro do produto final |
| `occlusion` / `completeness` | ver seção 10 |
| `color.match` | 1 − ΔE76(cor dominante, cor do produto)/50 |
| `detail.deltaE.mean` / `.p95`, `detail.sharpnessRatio`, `detail.logoSharpnessRatio`, `edge.halo` | MATERIALIZED |
| `aspect.exact` | 1 se a janela tem a proporção do quadro (tolerância 0.5%); nunca estica |
| `duplicate.minHamming` | menor distância pHash para outra foto do produto |
| `view.confidence` | do classificador |

## 16. Quality Gate

O `CatalogImageValidator.decide(report, profile, mode, view)` devolve `GateDecision(decision, tier, score 0–100,
reasons, warnings)`. Os limiares padrão estão abaixo; o perfil pode sobrescrever em `gate`.

**REJECTED** (hard). Basta uma condição:

| Código | Condição |
|---|---|
| `NOT_AN_IMAGE` / `DECODE_FAILED` | não é imagem, ou a decodificação falhou |
| `PRODUCT_NOT_FOUND` | não achou o produto |
| `LOW_RESOLUTION` | `product.longSidePx < 360` |
| `LIFESTYLE_SCENE` | presentation LIFESTYLE com produto < 15% da foto |
| `DETAIL_AS_MASTER` | detalhe ou amostra usado como master |
| `INCOMPLETE_GARMENT` | `completeness < 0.85` (MATERIALIZED) |
| `HUMAN_RESIDUE` | `human.residue > 0.02` (MATERIALIZED) |
| `STRETCHED` | `aspect.exact = 0` |
| `CROPPED_PRODUCT` | `preservation.master < 0.995` |
| `FOCUS_CLIPPED` | `focus.visibility < 0.9` |

**NEEDS_REVIEW.** Basta uma condição:

| Código | Condição |
|---|---|
| `WRONG_PRODUCT_OR_COLOR` | `color.match < 0.35` |
| `TEXT_OVERLAY` | texto ou marca d'água sobre o produto |
| `LOW_SEGMENTATION_CONFIDENCE` | `segmentation.confidence < 0.6` (MATERIALIZED) |
| `DETAIL_LOSS` | ΔE ou nitidez fora do limite |
| `EDGE_HALO` | `edge.halo > 0.08` |
| `OCCUPANCY_OUT_OF_RANGE` | ocupação fora da faixa do perfil por mais de 0.05 |
| `SOFT_IMAGE` | `sharpness < 0.20` |
| `UPSCALE_LIMITED` | resolução não chega à ocupação mínima com `upscale ≤ 2` |
| `LOW_SCORE` | score < 70 |
| `UNCERTAIN_VIEW` | `view.confidence < 0.4` |

**APPROVED.** Todo o resto. O nível sai assim:

| Nível | Quando |
|---|---|
| `MASTER` | MATERIALIZED, `human.residue ≤ 0.005`, `object.residue ≤ 0.01`, `completeness ≥ 0.97` |
| `FRAMED_PACKSHOT` | PARAMETRIC, sem pessoa (`human.fraction < 0.01`) e `background.uniformity ≥ 0.85` |
| `FRAMED_REFERENCE` | PARAMETRIC, com pessoa ou fundo não liso (warning `HUMAN_VISIBLE` ou `BUSY_BACKGROUND`) |

**Score.** `score = 100 · (0.20·resolution + 0.15·sharpness + 0.15·occupancyFit + 0.10·marginFit + 0.10·focus +
0.10·isolation + 0.10·colorMatch + 0.10·background)`, com teto de 65 quando há alguma flag de revisão e de 40 quando
alguma condição dura falha.

**Critérios por categoria:**

- SHOES exige `occupancy.width` dentro de 0.85–0.92 e que as regiões `TOE` e `HEEL` não estejam cortadas.
- ACCESSORY exige `preservation.card = 1` e a região-assinatura visível.
- LOWER exige `WAISTBAND` visível no card.
- UPPER exige `COLLAR` ou `NECKLINE` visível no card.

## 17. Fallback

O `FallbackPolicy.next(decision, view, restantes, outraVista)` segue esta ordem fixa:

1. **ALTERNATE_IMAGE**: a próxima candidata elegível do ranking (mesma vista preferida).
2. **ALTERNATE_VIEW**: uma candidata de outro ângulo aceitável. Para calçado, SIDE e THREE_QUARTER contam como
   principais; para os outros tipos, BACK só quando não há FRONT.
3. **MANUAL_REVIEW**: se alguma candidata ficou em NEEDS_REVIEW, o produto vai para a fila com todas as candidatas e
   métricas.
4. **REJECT**: nenhuma serve. O produto fica sem foto, aparece a ilustração da categoria (RN47.09) e a penalidade
   `NO_PHOTO_PENALTY` é aplicada.

Enquanto o produto não foi processado (`PENDING`), a exibição continua como hoje, com a URL primária, para não apagar
metade do acervo de uma vez. `REJECTED` nunca volta ao hotlink cru.

## 18. Múltiplas imagens e CANONICAL_PRODUCT_IMAGE

- **O job é por produto.** Busca todas as candidatas, até 8, e as analisa (cerca de 0,3–1 s cada, local).
- **Ranking e processamento.** O job rankeia as candidatas e processa o enquadramento e o gate em ordem até a primeira
  APPROVED. Ela vira `catalog_products.canonical_image_id` (**CANONICAL_PRODUCT_IMAGE**) e `catalog_images.is_primary`
  passa para ela.
- **Foto de detalhe.** Uma foto de detalhe do mesmo produto nunca é master: ela alimenta a variante DETAIL quando a
  região-assinatura da master é pequena demais.
- **Dedupe:**
  - `content_sha256` igual: a mesma imagem;
  - pHash a distância ≤ 6: quase igual;
  - em ambos os casos fica só a de maior resolução.
  - Também há um relatório admin de URLs compartilhadas entre produtos diferentes (caso Bottega).
- **Variante de cor.** A chave é (produto, cor). Quando a candidata tem `variant_id` ou a cor da variante, ela só vira
  canônica da variante correspondente. A canônica do produto é a da cor do produto. O `color.match` evita foto preta
  numa meia cinza.

## 19. Modelagem (CatalogProduct, CatalogImage, jobs, assets, revisão)

A migration `V44__pipeline_imagens_oficiais.sql` é aditiva.

**`catalog_sources`** ganha `image_rights` (`REFERENCE_ONLY`|`STORE`|`DERIVE_PUBLISH`, default `REFERENCE_ONLY`; quem
tinha `allows_image_persistence` vira `STORE`), `image_rights_evidence`, `image_rights_granted_by`,
`image_rights_granted_at`, `image_rights_expires_at` e `third_party_processing_allowed` (default FALSE).

**`catalog_images`** ganha as colunas abaixo:

| Coluna | Conteúdo |
|---|---|
| `view_angle`, `presentation` | ângulo e apresentação estimados |
| `content_sha256`, `perceptual_hash`, `difference_hash` | hashes da fonte |
| `width`, `height`, `mime`, `byte_size` | dados da fonte |
| `fetched_url` | URL de alta resolução realmente analisada |
| `display_url` | mesma composição, ≤ 1200 px, quando a CDN permite |
| `candidate_score` | nota do ranking |
| `processing_status` | `CatalogImageProcessingStatus` |
| `processing_mode` | PARAMETRIC ou MATERIALIZED |
| `quality_tier`, `quality_score` | nível e nota do gate |
| `decision_reasons` | motivos |
| `frames_json` | aspecto → janela + fundo |
| `focus_json`, `metrics_json` | foco e métricas |
| `pipeline_version` | versão do pipeline |
| `processed_at`, `source_checked_at` | datas |

**`catalog_products`** ganha:

| Coluna | Conteúdo |
|---|---|
| `canonical_image_id` | FK SET NULL |
| `source_image_url` | URL oficial da canônica |
| `canonical_image_key` | chave do CARD no storage; só MATERIALIZED, nunca URL absoluta |
| `image_processing_status` | estado do produto no pipeline |
| `image_pipeline_version` | versão do pipeline |
| `image_quality_score` | nota da canônica |
| `image_processed_at` | data |

**Tabelas novas.** Nenhuma tem `user_id`: são do sistema, e apagar uma conta não apaga histórico do catálogo.

- **`catalog_image_jobs`**: id, `product_id` (CASCADE), `idempotency_key` UNIQUE, `reason` (BACKFILL, NEW_IMAGE,
  REPROCESS, ADMIN, SOURCE_CHANGED), `status`, `priority`, `attempts`, `max_attempts`, `next_attempt_at`,
  `locked_by`, `locked_until`, `requested_by`, `stages_json`, `result_json`, `error_code`, `error_message`,
  `queued_at`, `started_at`, `finished_at`, auditoria e versão.
- **`catalog_image_assets`**: id, `catalog_image_id` (CASCADE), `job_id` (SET NULL), `kind`, `storage_key` UNIQUE,
  `mime`, `width`, `height`, `byte_size`, `sha256`, `pipeline_version`, `superseded`, `created_at`.
- **`catalog_image_reviews`**: id, `product_id` (CASCADE), `catalog_image_id` (SET NULL), `job_id` (SET NULL),
  `status` (OPEN|RESOLVED), `reasons`, `action`, `alternate_image_id`, `note`, `decided_by`, `decided_at`, auditoria.
  Esta é a **CatalogImageReviewQueue**.

**Idempotência:**

- **Job:** `idempotency_key = sha256(productId | PIPELINE_VERSION | hashes das URLs candidatas ordenadas | nonce)`. O
  nonce é `auto` no automático e o id da revisão no reprocessamento.
- **Por imagem:** com o mesmo `content_sha256` e o mesmo `pipeline_version`, a análise salva é reaproveitada (**imageUrl
  + pipelineVersion**, e o hash protege contra a CDN trocar o arquivo debaixo da mesma URL).
- **Chaves de asset:** `catalog/{productId}/{imageId}/{sha12}-v2/{variante}.{ext}`, com o master transparente e a
  entrada da IA sob `restricted/`. São derivadas do conteúdo, então nunca sobrescrevem outra coisa, e o cache é
  `immutable`.

**Proveniência.** Toda imagem guarda `source_type`, `source_url` (página do produto), `image_url` (como coletada),
`fetched_url`, `retrieved_at`, `source_checked_at`, `content_sha256` e `pipeline_version`. Todo asset aponta para a
imagem e para o job.

**A API (`CatalogImageSelector`)** é o único lugar que decide o que o front recebe:

- `imageUrl`: o CARD se MATERIALIZED e APPROVED; a `display_url`/URL oficial se PARAMETRIC e APPROVED, ou se ainda
  `PENDING`; `null` se REJECTED.
- `imageFrame`: os frames PARAMETRIC.
- `imageVariants`: card, square, thumb e detail, quando MATERIALIZED.
- `imageStatus`, `imageTier`, `imagePresentation`.
- `imageSource`: a proveniência, como hoje.

Quem usa: `card`, `rank`, `product` e `addToWardrobe`. O `addToWardrobe` grava o DETAIL/CARD e o THUMB quando
MATERIALIZED.

**A IA** (analisador da peça vinda do catálogo) recebe `AI_ANALYSIS` quando ela existe, nunca a foto com modelo.

## 20. Workers e jobs

**`CatalogImageWorker`** fica desligado por padrão (`fashionai.catalog-images.worker.enabled=false`):

- **Execução.** Tem pool próprio (`ScheduledExecutorService`, `threads=2`), fora da única thread do `@Scheduled`, e
  um semáforo de decodificação (`decode-concurrency=2`) contra estouro de heap.
- **Claim.** `SELECT id … WHERE status='PENDING' AND (next_attempt_at IS NULL OR next_attempt_at <= NOW(6)) ORDER BY
  priority DESC, queued_at LIMIT :n FOR UPDATE SKIP LOCKED`, numa transação curta que marca `FETCHING`,
  `locked_by` (host:pid:thread) e `locked_until = now + lease`. O MySQL de produção é 9.7 e o de dev 8.4; os dois
  suportam `SKIP LOCKED`.
- **Processamento** fora de transação. A gravação do resultado é uma transação curta por produto.
- **Recuperação.** Um job com lease vencido volta a `PENDING`, com `attempts+1`.
- **Retry.** Backoff de 1 min, depois 10 min, depois 1 h. Ao chegar em `max_attempts=3`, o job vai para `FAILED`
  (erro técnico, diferente de REJECTED).
- **Estados do job:** `PENDING → FETCHING → VALIDATING → ANALYZING → FRAMING → RENDERING → QUALITY_CHECK →
  APPROVED | NEEDS_REVIEW | REJECTED | FAILED`. Cada etapa grava um `StageRecord` com `millis`. O log estruturado é
  `catalog-image stage=… product=… image=… status=… ms=…`, com `correlationId` no MDC do job.
- **Enfileiramento:**
  - backfill admin, por marca, produto ou "todos sem processar";
  - imagem nova na ingestão (`CatalogIngestService.upsertImage` cria o job, que é idempotente);
  - reprocessamento da revisão;
  - mudança detectada na fonte (`content_sha256` diferente na revalidação).
- **Implantação.**
  - **Fase 1:** a própria API com o worker ligado e `threads=1`.
  - **Fase 2:** um serviço `catalog-worker` no Railway com a mesma imagem, `FAI_CATALOG_IMAGES_WORKER=true` e o web
    desligado. Ver `DEPLOY.md`.
- **Custo e vazão.** O caminho padrão é local, a US$ 0 por imagem.
  - Vazão: cerca de 1–2 s por produto com 4 candidatas num core, o que dá ~9,5 mil produtos em 3–5 h com 1 thread.
  - Orçamento separado: o detector VLM opcional (Gemini `box_2d`) só roda quando a fonte autoriza terceiros e tem
    teto próprio (`catalog-images.vlm-daily-budget-usd`), fora do teto global da IA dos usuários.

## 21. Segurança de URL (SSRF e afins)

**`PinnedHttpsImageFetchAdapter`** (infra) implementa o `OfficialImageFetchPort`:

| Ameaça | Defesa |
|---|---|
| URL malformada, esquema não-https, porta ≠ 443, userinfo, IP literal | `REJECTED_URL` |
| `localhost`, `*.local`, `*.internal`, nomes sem ponto, `*.localhost`, `*.arpa` | `REJECTED_HOST` |
| IP privado/reservado em **qualquer** resposta do DNS: 0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.0.0/24, 192.0.2/24, 192.168/16, 198.18/15, 198.51.100/24, 203.0.113/24, 224/4, 240/4, 255.255.255.255; IPv6 ::, ::1, fc00::/7, fe80::/10, ff00::/8, 2001:db8::/32, 64:ff9b::/96 e ::ffff:0:0/96 (IPv4 embutido checado) e 2002::/16 (6to4 embutido) | `REJECTED_ADDRESS` |
| DNS que falha | `REJECTED_ADDRESS` (**fail-closed**; o adaptador antigo aceitava) |
| DNS rebinding (TOCTOU) | o IP validado é o IP conectado: socket para o `InetAddress` resolvido e TLS com SNI e verificação de hostname (`HTTPS` endpoint identification) do nome original |
| Redirect para interno / em loop | redirect manual; cada salto passa pelas mesmas checagens; máximo 3 |
| Resposta gigante, gzip bomb | `Accept-Encoding: identity`, teto de bytes (25 MB) durante a leitura, sem descompressão |
| Slow-loris | prazo total de 20 s sobre a resposta inteira, mais um timeout por leitura |
| Content smuggling | `Content-Type` ∈ {image/jpeg, image/png, image/webp} **e** bytes mágicos correspondentes (o tipo efetivo vem dos bytes); SVG, GIF, vídeo e HTML são recusados |
| Bomba de descompressão de pixels | dimensões lidas do cabeçalho antes de alocar (`ImageOps.requireDecodableSize`), teto de 40 MP e 12000 px, semáforo de decodificação |
| Host fora da marca | `ImageSourcePolicy`: o host é o domínio oficial ou subdomínio (sufixo exato **com ponto**) ou uma CDN registrada da marca; CDN compartilhada (shopify, cloudinary, imgix, akamaized, ctfassets) só quando a página do produto é de um domínio oficial da marca |

**Proxy.** Atrás de um proxy de saída, o DNS é responsabilidade do proxy. O adaptador então pula a fixação de IP e
mantém as outras checagens. Isso é declarado em `fashionai.catalog-images.fetch.via-proxy`, para não acontecer sem
querer. Em produção o tráfego é direto.

**Outras correções:**

- A allowlist "contém o nome da marca" vira sufixo exato tanto no Java (`OfficialCatalogDiscovery.imageAllowed`) quanto
  no Python (`brand_cdn_ok`).
- Com variantes servidas por nós, a CSP `img-src https:` pode ser fechada (fase 4). Antes é preciso auditar
  `InstitutionalService` (logo e capa livres).

## 22. Testes

| Camada | Testes |
|---|---|
| Fonte | `PinnedHttpsImageFetchAdapterTest`: loopback recusado, DNS de IP privado recusado, IPv4 embutido em IPv6, redirect para interno, mime e mágicos, teto de bytes, prazo total. `OfficialImageUrlResolverTest`: uma regra por CDN com as URLs reais do acervo. `ImageSourcePolicyTest`: `nike.attacker.tld` recusado, sufixo exato. `ImageRightsPolicyTest`: validade vencida leva a PARAMETRIC. |
| Análise | `PerceptualHashTest`: mesma imagem reescalada ou recomprimida dá distância ≤ 6; imagens diferentes dão > 20. Segmentação: packshot branco, peça branca em branco, alfa nativo. `HumanRemoverTest`: buraco transparente, `reconstructionConfidence = 0`, oclusão medida. `DistractorRemoverTest`: sapato saindo da foto de calça, par de calçados mantido. `ViewClassifierTest` e `ImageCandidateRankerTest`: packshot > modelo > detalhe, duplicata. |
| Enquadramento | `SemanticRegionRegistryTest`: todas as 72+8 subcategorias têm perfil, a ocupação está em [0.70, 0.90], a margem em [0.04, 0.08], os códigos de região estão no vocabulário. `SemanticCropperTest`: nunca estica, master preserva 1.0, card corta só pela borda permitida, foco dentro da área segura, teto de ampliação, determinismo. Por estratégia: gola em `visualCenterY` ±0.03, sola na linha de base, largura do calçado em 0.85–0.92. |
| Render/qualidade | `BackgroundNormalizerTest`: variantes com tamanho e fundo certos, PNG transparente fora da peça, pixels internos idênticos à fonte reamostrada (ΔE ≈ 0). `DetailPreserverTest`: detecta blur e mudança de cor injetados. `CatalogImageValidatorTest`: cada motivo e cada nível. `FallbackPolicyTest`: a ordem. |
| Orquestração | `CatalogImagePipelineTest`: produto com 3 candidatas (modelo, packshot, detalhe) escolhe o packshot, PARAMETRIC sem nenhum asset, MATERIALIZED com 8 variantes. `CatalogImageJobServiceTest`: idempotência, retry com backoff, lease vencido, NEEDS_REVIEW cria revisão. `CatalogImageSelectorTest`: PENDING faz hotlink, APPROVED parametric devolve frame, REJECTED devolve null, materialized devolve variantes. Claim `SKIP LOCKED`: teste opcional contra MySQL local (`-Dfai.mysql.it=true`). |
| Web | `CatalogImageAdminControllerTest`: 403 para não-admin; ações APPROVE, REPROCESS, SELECT_ALTERNATE_IMAGE e REJECT. |
| Frontend (vitest) | `official-image.test.tsx`: frame aplicado (estilos), `onError` mostra ilustração, cover sem padding. Admin: fila e ações. |
| Python | `test_official_sitemap.py`: `.mp4`, `.json` não transformável e placeholder fora; sufixo exato de CDN; limite de 8. |

## 23. Fixtures e dataset de regressão

Como não há licença para versionar fotos de marcas, o dataset é **sintético e determinístico**, gerado em código por
`CatalogImageFixtures`. Ele cobre:

1. packshot branco de cada piece_type: camiseta, polo, camisa, moletom com capuz, jaqueta, jeans, short, saia,
   vestido, tênis, mocassim, sandália, bota, relógio, bolsa, cinto e óculos;
2. peça branca em fundo branco;
3. PNG com alfa nativo;
4. ghost mannequin;
5. modelo vestindo a peça (pessoa sintética com pele, cabelo e rosto), com braço sobre a peça (oclusão) e sem oclusão;
6. look com distrator (calça com tênis e camisa);
7. lifestyle com props e fundo texturizado;
8. vários produtos;
9. baixa resolução (300 px);
10. marca d'água ou texto;
11. foto de detalhe;
12. duplicata reescalada;
13. par de calçados;
14. produto cortado pela borda da foto.

Cada fixture tem a verdade em `src/test/resources/catalog-image/fixtures.json`:

- caixa do produto, máscara de pessoa exata (o teste usa um `PersonMaskProvider` falso que devolve a verdade);
- apresentação e ângulo esperados, decisão e nível esperados;
- região de foco esperada.

A **regressão** (`CatalogImageRegressionTest`) roda o pipeline inteiro em todas as fixtures e compara com
`regression-baseline.json`:

- decisão e nível exatos;
- ocupação, margens e preservação com tolerância de ±0.02.

Mudou de propósito? Regere com `-Dcatalog.image.rebaseline=true`. A diferença aparece no PR.

**Dados reais (manual).** `scripts/catalog/image_sample.py` sorteia N produtos por host do acervo (seed fixa) e gera
`data/catalog/image-sample/` (fora do git), que pode ser rodado pelo endpoint admin de backfill em modo dry-run.

## 24. Plano de implementação incremental

| Fase | Entrega | Risco controlado |
|---|---|---|
| **1 · Fundação** | V44, entidades e repositórios; `PinnedHttpsImageFetchAdapter`; resolver de CDN; políticas de fonte e direitos; pHash | nada muda para o usuário |
| **2 · Análise e enquadramento** | segmentação, pessoa, distratores, ranking, registry, estratégias, cropper, métricas, gate, fallback; dataset sintético e regressão | puro e testável, sem rede |
| **3 · Jobs e exibição PARAMETRIC** | worker (desligado por padrão), `CatalogImageSelector` com `imageFrame`, componente `OfficialImage` na busca e no pick, `onError` | ligar com `threads=1` e acompanhar o painel |
| **4 · Admin** | fila de revisão (APPROVE / REPROCESS / SELECT_ALTERNATE_IMAGE / REJECT), detalhe com antes/depois e overlay de debug (renderizado sob demanda, `no-store`, nunca gravado), painel de qualidade, direitos por fonte com evidência | — |
| **5 · MATERIALIZED** | para fontes com `DERIVE_PUBLISH`: variantes no storage, cache `immutable`, peça do catálogo com variante (cover, sem padding), backfill das peças que fazem hotlink, entrada de IA limpa | só com licença registrada |
| **6 · Endurecimento** | CSP sem `https:`, coletor com regras de CDN e sem `.mp4`/`.json`, cap 8, vínculo cor↔imagem no coletor, serviço `catalog-worker`, detector VLM opcional com orçamento próprio | — |

**Pendências declaradas:**

- RN47.11 e RN47.12 precisam de validação jurídica.
- Remover a pessoa sem inventar tecido só gera master quando a peça está íntegra. Os 47% de produtos sem nenhuma foto
  limpa ficam como `FRAMED_REFERENCE` até a marca fornecer packshots (feed `PARTNER_API`) ou licença.
- Hybris (Arezzo, Schutz, Vans) e Gap não têm reescrita de alta resolução. Precisam de re-leitura da página.
