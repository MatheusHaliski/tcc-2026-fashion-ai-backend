# RF04 · Adaptive Garment Capture + Garment Computer Vision

Relatório técnico e plano de execução da refatoração do pipeline de imagens do cadastro de peças (RF04).
Data: 03/10/2026 · Branch: `claude/adaptive-garment-capture`.

O ponto de partida é uma auditoria do código real (backend Java, frontend Next.js, migrations e configuração). Cada
afirmação sobre o estado atual cita a classe ou o arquivo. A proposta é incremental: reaproveita o pipeline que já
funciona (Flat Lay, estúdio, OCR ONNX, AiEngine com fallback, fila de moderação) e acrescenta as camadas que faltam
(captura adaptativa, especificação fotográfica versionada, asset canônico determinístico, ensemble de marca,
landmarks, registro de modelos, revisão de IA, active learning e dataset com proveniência).

Princípio central: **o cadastro começa com UMA foto**. O FashionAI analisa essa foto e só pede outra quando ela
aumenta de fato a confiança em um atributo que importa, sempre com "Pular".

---

## Sumário

1. [Current Architecture](#1-current-architecture)
2. [Identified Problems](#2-identified-problems)
3. [Target Architecture](#3-target-architecture)
4. [Adaptive Capture Flow](#4-adaptive-capture-flow)
5. [Capture Guidance Architecture](#5-capture-guidance-architecture)
6. [Photography Specifications](#6-photography-specifications)
7. [Canonical Photography Architecture](#7-canonical-photography-architecture)
8. [Computer Vision Models](#8-computer-vision-models)
9. [Brand Recognition Strategy](#9-brand-recognition-strategy)
10. [AI Training Architecture](#10-ai-training-architecture)
11. [Dataset Strategy](#11-dataset-strategy)
12. [Active Learning Strategy](#12-active-learning-strategy)
13. [Database Changes](#13-database-changes)
14. [API Changes](#14-api-changes)
15. [Frontend Changes](#15-frontend-changes)
16. [Infrastructure Changes](#16-infrastructure-changes)
17. [Security Considerations](#17-security-considerations)
18. [Privacy Considerations](#18-privacy-considerations)
19. [Testing Strategy](#19-testing-strategy)
20. [Observability Strategy](#20-observability-strategy)
21. [Migration Strategy](#21-migration-strategy)
22. [Roboflow × YOLO e Cloudinary — avaliação](#22-roboflow--yolo-e-cloudinary--avaliação)

---

## 1. Current Architecture

### 1.1 Visão geral

Monólito modular hexagonal (Spring Boot 3.3, Java 21, MySQL 8 + Flyway) com frontend Next.js 15 que chama a API
direto do navegador. O RF04 hoje é um **formulário em etapas com análise síncrona de uma foto**.

```
Navegador (pieces/new/page.tsx)
  escolhe o tipo (obrigatório) → seleciona arquivo → stripPerson (MediaPipe, remove corpo humano)
  → POST /api/pieces/analysis (multipart file + category)            ← 1 requisição síncrona
        WardrobeService.analyze  (@Transactional, tudo dentro do request)
          1. FlatLayPipeline.run          validação → remoção de fundo (rembg → remove.bg → flood-fill local)
                                          → deskew PCA → normalização de cor → composição 1024 → QualityMetrics → thumb
          2. PhotoAcceptance.evaluate     critérios locais; falha = 422 FOTO_RECUSADA
          3. Silhouette + SubtypeReferences.rank + LocalVision (palpite local)
          4. BrandRegions.zones           zonas onde a marca costuma estar
          5. CONTENT_MODERATOR (IA)        moderação, nunca aprova por omissão
          6. PIECE_ANALYZER (Gemini → Claude → local)  categoria, subtipo, cor, material, marca, logoBox
          7. checagens dependentes da IA  → 422 se reprovar
          8. logo: IA → BrandRegions.detectLogo → OCR (BrandReader/ONNX PP-OCRv4)
          9. PipelineJob "rascunho" (status COMPLETED, targetType PIECE_DRAFT) + arquivos em users/{u}/drafts/{job}/
         10. StudioPipeline (foto de vitrine) se o fundo saiu
  → etapas Dados → Mais detalhes → Arte → Revisar
  → POST /api/pieces (PieceForm + draftId) → WardrobeService.create (trava o rascunho, idempotente)
```

### 1.2 Componentes existentes (reaproveitados)

| Área | Onde | Observação |
|---|---|---|
| Peça | `WardrobeItem` (`wardrobe_items`) | não existe `Piece`/`PieceImage`; variantes de imagem são colunas de URL (`imageUrl`, `originalImageUrl`, `thumbnailUrl`, `studioImageUrl`, `studioDetailUrl`…) + JSON em `flatLayMetadataJson` |
| Rascunho/job | `PipelineJob` (`pipeline_jobs`) | o rascunho da análise é um `PipelineJob` com `resultJson` completo; `provider` é texto livre (não há enum `PipelineProvider`) |
| Status | `PipelineJobStatus`, `PhotoProcessingStatus` | só PROCESSING/COMPLETED são usados de fato |
| Logs | `AiInferenceLog`, `ProcessingJobLog`, `QualityScore` | toda chamada do `AiEngine` grava inferência, consentimento e custo |
| Fila humana | `ModerationQueueItem` (`moderation_queue`) | alvo PIECE/UPLOAD/COMMENT; tela `admin/moderation` |
| Fotos (RF12) | `Photo` (`photos`, `PhotoOrigin`) | galeria do usuário; o original da peça vira um `Photo` WARDROBE_ITEM |
| Embeddings | `ItemEmbedding` (`item_embeddings`) | 1 vetor de atributos por peça/esquema (`local-attributes-v1`), para afinidade — não visual |
| Remoção de fundo | `RembgAdapter`, `RemoveBgAdapter`, `ImageOps.removeBackgroundLocal` | cadeia com fallback local |
| Estúdio | `StudioPipeline` | upscale (Stability), reiluminação, manequim invisível opcional, Photoroom, sombra — **foto de vitrine** |
| OCR | `BrandReader` + `OnnxTextReader` (PP-OCRv4 ONNX embarcado) | lê marca em zonas e em grade 3×3→5×5 |
| Segmentação de pessoa | `OnnxPersonSegmenter` (servidor) e `stripPerson` (MediaPipe, navegador) | |
| IA governada | `AiEngine` + `AiCatalog` + `AiBudget` | consentimento `AI_EXTERNAL_PHOTO_PROCESSING`, cota diária, orçamento, fallback local |
| 3D | `Model3dService` (Meshy → SF3D → relevo local) | único worker agendado de verdade |
| Armazenamento | `MediaStoragePort` (local / S3-MinIO-R2) | `put` sobrescreve chave repetida; chaves de rascunho são únicas por job |
| Frontend | `app/(site)/(app)/pieces/new/page.tsx` | 5 etapas (foto, dados, mais, arte, revisar), sem câmera, sem polling |

### 1.3 Providers de imagem efetivos

`rembg` (self-hosted, custo 0), `removebg` (US$ 0,20), `photoroom`, `stability-upscale`, `stability-sf3d`, `meshy`,
`gemini`/`claude` (visão via LLM), `gemini-image`/`replicate` (edição/geração — só no fluxo opcional "recriar com IA",
com selo), `fashn` (try-on), `google-vision-safesearch`, ONNX local (OCR e segmentação de pessoa) e motores `local-*`.

**Não existem no código**: YOLO / LOCAL_YOLO (só aparecem como "plano B" em `docs/novo-projeto/03-rf24-ia-e-servicos-externos.md`),
Blender (só docs) e Firebase. A porta `ColorNormalizationPort` (Cloudinary) não tem implementação.

### 1.4 Frontend de "Adicionar peça"

- Tipo obrigatório antes do upload; `<input type=file>` com arrastar-e-soltar; **nenhum `getUserMedia`**, e
  `next.config.ts` envia `Permissions-Policy: camera=()`, bloqueando a câmera no app.
- A orientação de fotografia é uma lista de texto ("Como fotografar") em `<details>`.
- Resultado da análise: subtipo + marca (lida/possível/não achada) com "Procurar a marca de novo".
- Não há tela de revisão administrativa da classificação da IA.

---

## 2. Identified Problems

| # | Problema | Evidência | Impacto |
|---|---|---|---|
| P1 | Cadastro tratado como "um upload": não há conceito de vista, propósito de captura nem foto complementar | `Draft` tem uma foto; `PieceForm` um `draftId` | marca/modelo de peças cuja identidade está atrás (calças) ou em etiquetas (tênis, relógios) nunca é lida |
| P2 | Foto ruim é **rejeitada** (422) em vez de orientada | `WardrobeService.analyze` → `rejection(...)` | atrito; o usuário não sabe como refazer além de uma lista de texto |
| P3 | A "foto de produto" atual (estúdio) **altera a aparência**: upscale generativo, reiluminação sintética, fundo/sombra por IA (Photoroom), manequim invisível | `StudioPipeline` | serve como vitrine, mas **não pode** ser o asset fiel usado por busca, provador e treinamento |
| P4 | Não existe asset canônico versionado por especificação (enquadramento, cobertura, âncoras) | composição 1024 fixa com margem 8% (`FlatLayPipeline`) | imagens heterogêneas entre categorias; nada garante "nenhuma barra cortada" |
| P5 | Sem landmarks | — | impossível validar regiões obrigatórias (cintura, barras, calcanhar) e enquadrar por âncoras |
| P6 | Marca decidida por cascata (IA → OCR) sem evidências combinadas nem alternativas | `analyze` linhas 304-331; `brandSearch` | "Lacoste 58% / Izod 21%" não é representável; incerteza escondida |
| P7 | Sem hierarquia de identificação (marca ≠ linha ≠ modelo ≠ variante) | `Prefill.confidence` só tem campos planos | risco de apresentar "Air Max 90 62%" como certeza |
| P8 | Correções do usuário não são registradas | só `InventoryScoreService.field()` compara em tempo de leitura | nenhum dado para active learning |
| P9 | Sem registro de modelos/versões por inferência de visão | `AiInferenceLog.model` é texto do LLM; heurísticas locais não têm versão | impossível comparar versões ou auditar regressões |
| P10 | Sem dataset, proveniência, licença ou consentimento para treinamento | `ConsentPurpose` não tem finalidade de treinamento | qualquer uso de fotos de usuários para treinar seria irregular (LGPD) |
| P11 | Análise 100% síncrona dentro do request e de uma transação (com chamadas HTTP de 30 s) | `analyze` `@Transactional`; Hikari 10 conexões | gargalo de conexões sob carga |
| P12 | **Bug**: `analyzeBatch` chama `this.analyze(...)` (auto-invocação → sem transação); os campos gravados depois de `jobs.save(job)` (resultJson, stages, custo) se perdem com `open-in-view: false` | `WardrobeService.analyzeBatch` | `POST /api/pieces/batch` pode criar peças com rascunho vazio |
| P13 | Reprocessamento do Flat Lay nunca roda (`reprocessPending` sem `@Scheduled` nem chamador; fila só enfileira) | `WardrobeService.reprocessPending`, `InMemoryJobQueue` | peças sem fundo removido ficam `PROCESSING` para sempre |
| P14 | Arquivos de rascunhos abandonados nunca são apagados | só `pending/` do cadastro é purgado | acúmulo de fotos pessoais sem finalidade (minimização LGPD) |
| P15 | Câmera bloqueada por `Permissions-Policy: camera=()` | `next.config.ts` | impossível overlay/feedback em tempo real |
| P16 | `wallet` (carteira) não existe na taxonomia, embora seja um acessório comum | `Taxonomy.SUBCATEGORIES` | carteiras caem em outro subtipo |
| P17 | OCR roda em zonas fixas da foto principal; etiquetas internas, línguas de tênis, versos de relógio e hastes de óculos nunca são fotografados | — | OCR de alto valor (modelo, SKU, composição) não acontece |

---

## 3. Target Architecture

### 3.1 Camadas

```
┌──────────────────────────── Frontend (assistente de fotografia) ─────────────────────────────┐
│ CaptureGuidance (animações SVG por perfil) · CameraCapture (overlay + feedback em tempo real) │
│ CaptureRequestCard ("Só mais um detalhe", Pular) · IdentificationSummary · Revisão · Confirmar │
└───────────────┬───────────────────────────────────────────────────────────────────────────────┘
                │ /api/capture/**                                   /api/pieces (captureSessionId)
┌───────────────▼──────────────────── Capture orchestration (fai-application) ──────────────────┐
│ CaptureSessionService — sessão progressiva; persiste originais imutáveis e derivados          │
│   ├─ WardrobeService.analyzeForCapture (pipeline existente em modo "orientar, não recusar")  │
│   ├─ VisionPipeline: Detector → Classifier → Segmenter → LandmarkDetector → LogoDetector     │
│   │                  → OCR estratégico → Material/Pattern → Embedding                       │
│   ├─ BrandEnsembleResolver + IdentificationHierarchy (níveis com confiança independente)     │
│   ├─ PhotographyQualityGate (PhotographyQualityScore 0–100, orientação antes de recusar)    │
│   ├─ AdaptiveCaptureEngine (próxima foto mais informativa, por ganho esperado)              │
│   └─ CanonicalPhotographer (asset canônico determinístico por PhotographySpec versionada)   │
├────────────────────────────── Learning loop ──────────────────────────────────────────────────┤
│ AiReviewService (AI decision / user correction / admin decision / final value)               │
│ TrainingCandidates (Garment Vision Dataset + Hard Examples) · DatasetSources (licença)       │
│ ModelRegistry + ModelInference · DatasetExport (COCO) · VisionMetrics                        │
├────────────────────────────── Knowledge ──────────────────────────────────────────────────────┤
│ ProductKnowledgeBase (assinaturas de marca, linhas, modelos, tokens de OCR) · EmbeddingIndex │
└───────────────┬──────────────────────────────────────────────────────────────────────────────┘
                │ portas
┌───────────────▼──────────── Adapters (fai-infrastructure) ─────────────┐
│ ONNX local (OCR, pessoa; futuro YOLO) · Roboflow Inference (HTTP) ·     │
│ rembg/remove.bg · Gemini/Claude visão · Cloudinary (só entrega) · S3/R2 │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Decisões principais

1. **Incremental, sem big-bang.** `POST /api/pieces/analysis` (lote, várias peças numa foto) continua funcionando.
   O novo fluxo usa `/api/capture/**` e reaproveita a mesma análise por dentro.
2. **Estúdio ≠ Canônico.** O estúdio continua sendo a foto de vitrine (pode embelezar, com etapas generativas
   rotuladas). O **asset canônico** é um pipeline separado, determinístico, sem geração: segmentação, rotação
   limitada, recorte, escala uniforme, padding, centralização e normalização de cor controlada. É ele que alimenta
   busca, embeddings, provador futuro e dataset.
3. **Original imutável.** Cada foto vira uma linha `piece_images` tipo ORIGINAL com chave única
   (`users/{u}/capture/{sessão}/{imagem}/piece_original_{vista}.jpg`); nenhuma operação regrava essa chave.
4. **Modelos pequenos e separados**, cada um com nome/versão no registro; o ensemble combina sinais com evidências.
5. **Incerteza sempre visível**: toda predição devolve confiança, evidências e alternativas.
6. **Correções viram dados só depois de validação** (admin) e **só com consentimento** específico de treinamento.

---

## 4. Adaptive Capture Flow

### 4.1 Fluxo

```
Capture Guidance → Primary Photo → Image Validation → Garment Detection → Category/Subcategory
→ Segmentation → Landmarks → Brand Recognition → OCR → Material → Pattern → Confidence Evaluation
→ Adaptive Capture Decision ──(pede vista complementar? sim)──► CaptureRequest (Pular sempre disponível)
                             └─(não)──► Canonical Photography → Quality Gate → User Review → Persistence
```

### 4.2 Tipos de captura (semânticos, nunca "upload2")

`CaptureView`: FRONT_VIEW, BACK_VIEW, LEFT_SIDE, RIGHT_SIDE, THREE_QUARTER, TOP_VIEW, WATCH_FACE, LOGO_DETAIL,
BRAND_DETAIL, TEXTURE_DETAIL, LABEL_DETAIL, INNER_LABEL, INNER_VIEW, SOLE_VIEW, TONGUE_LABEL, SERIAL_DETAIL,
CLASP_DETAIL, HARDWARE_DETAIL, BUCKLE_DETAIL, WATCH_BACK, TEMPLE_DETAIL, ENGRAVING_DETAIL.

`CaptureRole`: PRIMARY (a "PRIMARY_PRODUCT") ou COMPLEMENTARY. A foto principal tem papel PRIMARY **e** uma vista
real (ex.: PRIMARY + FRONT_VIEW).

`CapturePurpose` (por que pedimos): PRIMARY_IDENTIFICATION, BRAND_DISAMBIGUATION, MODEL_IDENTIFICATION,
MATERIAL_IDENTIFICATION, PATTERN_IDENTIFICATION, QUALITY_RETAKE, COVERAGE_COMPLETION, DETAIL_RECORD.

`CaptureNeed`: STRONGLY_RECOMMENDED (antes chamado REQUIRED: a informação provavelmente só existe nessa vista),
RECOMMENDED, OPTIONAL. **Nenhum bloqueia o cadastro**: toda solicitação tem Pular.

### 4.3 AdaptiveCaptureEngine — decisão por ganho esperado

Entrada (`CaptureContext`): categoria, subcategoria, perfil de captura, confianças por sinal (category, subcategory,
brand, logo, productLine, model, material, pattern, ocr), vistas já capturadas, vistas puladas, regiões visíveis,
visibilidade do logo, qualidade (score, blur, luz, cobertura, cortes, oclusão) e o desejo de identificar o modelo
(`identifyModel`, padrão falso).

Para cada vista complementar útil do perfil ainda não capturada/pulada:

```
gain(v) = Σ_sinal importance(sinal) × uncertainty(sinal) × informs(v, sinal) × visibilityModifier(v, sinal)
uncertainty(s) = max(0, alvo(s) − confiança(s)) / alvo(s)        (alvo da marca = 0,90 → marca ≥ 0,90 zera o ganho)
```

- `informs(v, s)`: quanto a vista resolve aquele sinal para aquele perfil (ex.: calça BACK_VIEW → brand 0,85,
  logo 0,85; tênis TONGUE_LABEL → model 0,9, brand 0,6; relógio WATCH_BACK → model 0,9, brand 0,7).
- `importance`: brand 1,0; subcategory 0,7; material 0,45; pattern 0,25; model 0 (ou 0,8 com `identifyModel`).
- Regras determinísticas de borda: marca ≥ 0,90 não gera pedido por marca; marca < 0,60 com vista útil →
  STRONGLY_RECOMMENDED; material só pede textura/etiqueta se < 0,50; sola nunca por padrão (só com modelo
  desejado e incerto, ou subcategoria em que a sola é assinatura — salto alto); outro lado do tênis só quando a
  visibilidade do logo lateral é baixa.
- Qualidade ruim da principal (gate < 50 ou corte em região obrigatória) → QUALITY_RETAKE da própria vista
  principal, com as dicas do gate, **antes** de qualquer complementar (uma principal melhor melhora tudo).
- Limite de 3 complementares por sessão; uma de cada vez (progressivo). A resposta traz a próxima recomendação e
  as alternativas ranqueadas, com `reasonCode` e o ganho esperado (explicável).
- Pular marca o pedido como SKIPPED: o atributo fica com a confiança atual/desconhecido, editável à mão e revisável.

Os pesos `informs` são heurísticos na v1. Cada pedido grava `confidenceBefore` e `confidenceAfter`; a métrica
"ganho realizado por (perfil, vista)" permite recalibrá-los com dados reais (o próprio motor de captura entra no
ciclo de aprendizado).

### 4.4 Exemplos (implementados como testes)

| Caso | Entrada | Decisão |
|---|---|---|
| Jeans | PANTS/JEANS, brand 0,31, logo não detectado, sem traseira | BACK_VIEW, BRAND_DISAMBIGUATION, STRONGLY_RECOMMENDED; depois do patch + OCR → brand 0,94 → fim |
| Jeans ainda incerto depois da traseira | brand 0,55 | LABEL_DETAIL (etiqueta interna do cós) |
| Tênis | SNEAKER/THREE_QUARTER, Nike 0,98, modelo 0,44, `identifyModel=false` | nenhum pedido → fim |
| Tênis, modelo desejado | idem + `identifyModel=true` | TONGUE_LABEL, MODEL_IDENTIFICATION |
| Tênis, marca incerta e logo lateral pouco visível | brand 0,5, LEFT_SIDE | RIGHT_SIDE (o branding muda de lado) |
| Relógio | WATCH_FACE, Tissot 0,71, modelo desconhecido | WATCH_BACK; com OCR da referência → brand 0,97, modelo 0,91 |
| Óculos | GLASSES, marca 0,4 | TEMPLE_DETAIL ("a marca e o código do modelo podem estar na haste") |
| Camiseta | TSHIRT, marca 0,93, material 0,8 | nenhum pedido |
| Foto tremida | gate 38 | QUALITY_RETAKE da FRONT_VIEW com "apoie o celular" |

---

## 5. Capture Guidance Architecture

- **Perfis de captura** (`CaptureProfiles`, versão `CAPTURE_PROFILES_V1`) cobrem todas as 83+ subcategorias da
  taxonomia em ~30 perfis (PANTS, SHORTS, SKIRT, TSHIRT, SHIRT, POLO, KNITWEAR, OUTERWEAR, DRESS, SNEAKER, BOOT,
  FORMAL_SHOE, SANDAL, HEEL, FLAT, BAG, BACKPACK, WALLET, BELT, WATCH, GLASSES, CAP, HAT, SCARF, NECKWEAR, JEWELRY,
  SMALL_ACCESSORY…). Cada perfil define: vista principal preferida (e alternativas), landmarks obrigatórios, regiões
  visíveis exigidas, vistas secundárias úteis (com `informs`), regiões de detecção de marca, distância/orientação da
  câmera, fundo e iluminação recomendados, overlay e animação.
- **Animações** (`components/capture/capture-guidance.tsx`): SVG + CSS (sem biblioteca nova; `prefers-reduced-motion`
  respeitado) com uma **peça genérica em traço** (não é foto e leva o selo "Animação ilustrativa", para nunca ser
  confundida com a foto real). Cada animação mostra: moldura com cantos pulsando, a peça entrando no quadro, ícone do
  celular perpendicular, indicação de distância, luz, regiões importantes destacadas e um par correto × incorreto
  (barra cortada, objeto em cima, fundo poluído). Variantes por vista: frente; **calça virando** (scaleX) e zoom suave
  em cós e bolsos para BACK_VIEW; lateral e 3/4 do tênis; zoom na língua (TONGUE_LABEL); verso do relógio; haste dos
  óculos; etiqueta interna.
- **Overlay da câmera** (`components/capture/camera-capture.tsx`): silhueta translúcida do perfil + linhas guia
  (cintura e limites das pernas na calça; ombros e barra na camiseta; bico e calcanhar no tênis; corpo e alças na
  bolsa; mostrador no relógio; armação nos óculos).
- **Feedback em tempo real** (`lib/capture/frame-feedback.ts`, função pura testável): a ~4 quadros/s o vídeo é
  reduzido a 160 px e medido — luz (luminância média), nitidez (variância do laplaciano), caixa do objeto contra o
  fundo (diferença para a cor da borda), centralização e encostar nas bordas. Mensagens por perfil: "Afaste um pouco",
  "Aproxime", "Centralize", "Mova a peça para a esquerda", "A cintura está fora do quadro" (calça encostando em cima),
  "O calcanhar ou o bico está fora do quadro", "Uma das alças está cortada", "A iluminação está baixa", "Agora está
  bom". Sem câmera (permissão negada, desktop), cai para galeria/arquivo com a mesma animação.

---

## 6. Photography Specifications

Especificações determinísticas e versionadas (`PhotographySpecs`, id `<PERFIL>_<VISTA>_V<n>`). Cada spec define:

| Campo | Significado |
|---|---|
| `preferredAspectRatio`, `canvasWidth`, `canvasHeight` | quadro final (ex.: calça 4:5, 1600×2000; tênis 1:1, 1600×1600) |
| `garmentCoverageTarget` | fração do lado limitante ocupada pela peça (maximiza ocupação útil) |
| `anchorLandmarks` | âncoras de enquadramento (cintura e barras na calça; sola no tênis) |
| `mandatoryLandmarks` | se faltar, o asset sai marcado "precisa de revisão" (nunca inventado) |
| `requiredVisibleRegions` | regiões que não podem estar cortadas |
| `allowedRotationDeg` | correção máxima de rotação (pequenas rotações) |
| `allowedPerspectiveDeg` | correção de perspectiva moderada permitida (v1 registra; só aplica com referência de 4 pontos) |
| `padding` | margem mínima |
| `backgroundMode` | TRANSPARENT (master PNG) / WHITE / NEUTRAL |
| `alignment` | CENTER ou BASELINE (calçados alinhados pela sola) |
| `composition` | SINGLE ou PAIR (calçados) |

Specs v1: PANTS_FRONT_V1, PANTS_BACK_V1, PANTS_DETAIL_V1, SHORTS_FRONT_V1, SKIRT_FRONT_V1, TSHIRT_FRONT_V1,
SHIRT_FRONT_V1, POLO_FRONT_V1, KNITWEAR_FRONT_V1, OUTERWEAR_FRONT_V1, DRESS_FRONT_V1, UPPER_BACK_V1,
SNEAKER_SIDE_V1, SNEAKER_THREE_QUARTER_V1, SNEAKER_SOLE_V1, SHOE_SINGLE_CANONICAL_V1, SHOE_PAIR_CANONICAL_V1,
BOOT_SIDE_V1, SANDAL_TOP_V1, HEEL_SIDE_V1, BAG_FRONT_V1, BACKPACK_FRONT_V1, WALLET_FRONT_V1, BELT_FRONT_V1,
WATCH_FACE_V1, WATCH_BACK_V1, GLASSES_FRONT_V1, CAP_FRONT_V1, HAT_FRONT_V1, SCARF_FLAT_V1, JEWELRY_MACRO_V1,
GENERIC_FRONT_V1, LOGO_DETAIL_V1, TEXTURE_DETAIL_V1, LABEL_DETAIL_V1.

Exemplo — **PANTS_FRONT_V1**: 4:5, 1600×2000, cobertura 0,88 da altura, âncoras `waistband_center`, `left_hem`,
`right_hem`; obrigatórios `waistband_center`, `crotch`, `left_hem`, `right_hem`; regiões `waistband`, `legs`, `hems`
sem corte; rotação ≤ 8°; fundo transparente; centralizado.
**PANTS_BACK_V1**: idem + prioridade de preservação de `waistband + back pockets + logo/patch` (o detalhe
`PANTS_DETAIL_V1` recorta a faixa superior: cós, bolsos traseiros, patch, etiqueta).

**Calçados — SINGLE × PAIR**: regra única do FashionAI: o canônico principal é **um pé** (o da foto, sem espelhar),
alinhado pela sola numa linha de base fixa; se a foto tiver o par lado a lado (dois componentes grandes), o canônico
usa SHOE_PAIR_CANONICAL_V1 (par lado a lado, mesma base). Nunca "um sobre o outro" e nunca espelhamento (inverteria
logos e textos).

---

## 7. Canonical Photography Architecture

```
original imutável ─► recorte (pipeline existente: rembg → remove.bg → local) ─► fonte hi-res endireitada (≤ 2400 px)
                 ─► landmarks ─► CanonicalPhotographer(spec)
                                   1. rotação por landmarks (|θ| ≤ allowedRotationDeg)
                                   2. recorte justo no alfa
                                   3. escala UNIFORME (proporção real) até a cobertura alvo, ampliação ≤ 2×
                                   4. posição pela regra da spec (centro / base da sola) + padding
                                   5. fundo da spec (master PNG transparente; variante branca para entrega)
                                   6. relatório: transformações, cobertura obtida, landmarks presentes, conformidade
                 ─► detalhes: LOGO_DETAIL (caixa do logo + margem), TEXTURE_DETAIL (maior quadrado interno sem borda
                    nem logo), PANTS_DETAIL (faixa do cós/bolsos), LABEL (foto de etiqueta endireitada)
```

**Proibido** em qualquer asset canônico: inpainting, geração, super-resolução generativa, reiluminação sintética,
manequim invisível, espelhamento. Permitido: segmentação, remoção de fundo, rotação, centralização, crop, padding,
resize (com limite de ampliação), perspectiva moderada, normalização de cor controlada (o `ImageFilters.normalize`
existente já não aplica gray-world em recortes sem fundo; só estica contraste 1–99%).

O teste `CanonicalPhotographerTest` prova a propriedade "sem pixel inventado": uma peça sintética de cor única só
produz pixels opacos daquela cor e mantém a proporção do contorno.

Nomes dos derivados (por sessão/imagem, nunca sobrescritos): `piece_product_front.png`, `piece_product_back.png`,
`piece_product_side.png`, `piece_detail.png`, `piece_logo_detail.png`, `piece_texture_detail.png`. O usuário nunca
envia esses arquivos: ele envia fotos; o FashionAI produz os canônicos.

---

## 8. Computer Vision Models

Sem modelo monolítico. Cada responsabilidade é uma porta com implementação local hoje e adaptador treinado depois:

| Responsabilidade | v1 (nesta entrega) | Próxima versão (treinada) | Nome no registro |
|---|---|---|---|
| GarmentDetector | caixa do alfa do recorte + componentes (`PhotoAcceptance`) | YOLO11-det "garment" | `garment-detector` |
| GarmentClassifier | `PIECE_ANALYZER` (Gemini → Claude) + silhueta × referências | classificador fine-tuned (ViT/ConvNeXt) | `garment-classifier` |
| GarmentSegmenter | rembg / remove.bg / flood-fill local | YOLO11-seg / SAM2 fine-tuned | `garment-segmenter` |
| GarmentLandmarkDetector | geométrico sobre a máscara (cintura, gancho, barras, ombros, decote, mangas) | YOLO11-pose por família | `pants-landmarks`, `upper-landmarks` |
| FootwearLandmarkDetector | geométrico (bico, calcanhar, sola, abertura; lado do bico) | YOLO11-pose calçados | `footwear-landmarks` |
| AccessoryLandmarkDetector | geométrico (alça, corpo, centro do mostrador) | YOLO11-pose acessórios | `accessory-landmarks` |
| LogoDetector | caixa da IA → `BrandRegions.detectLogo`/`LogoFinder` | YOLO11-det "logo" (+ classe de marca) | `logo-detector` |
| OCRService | PP-OCRv4 ONNX, **estratégico** (zonas, etiquetas, língua, verso, haste) | — | `ocr-ppocrv4` |
| LabelTextParser | regras: composição (100% algodão → COTTON), tamanho, país, códigos (Nike `AB1234-001`, Tissot `T137.407.11.041.00`, óculos `52□18 145`) | — | `label-parser` |
| BrandClassifier | `BrandEnsembleResolver` (seção 9) | + classificador de marca por recorte de logo | `brand-ensemble` |
| MaterialClassifier | IA de visão + composição lida na etiqueta | classificador de textura | `material-classifier` |
| PatternClassifier | heurística (variância + autocorrelação: liso, listrado, xadrez, estampado) | classificador treinado | `pattern-classifier` |
| GarmentEmbeddingModel | descritor local (histograma HSV + silhueta + gradientes, L2) | FashionCLIP/DINOv2 fine-tuned | `garment-embedding` |
| EnsembleResolver | combinação ponderada com evidências | pesos calibrados por regressão logística | `brand-ensemble` |
| PhotographyQualityGate | heurístico 0–100 | — | `photography-quality-gate` |
| AdaptiveCaptureEngine | ganho esperado com pesos heurísticos | pesos calibrados pelo ganho realizado | `adaptive-capture` |

OCR estratégico: roda em zonas de marca da principal só quando a marca não saiu da IA (como hoje) e **sempre** nas
vistas de texto (LABEL_DETAIL, INNER_LABEL, TONGUE_LABEL, WATCH_BACK, TEMPLE_DETAIL, SERIAL_DETAIL, BUCKLE/CLASP/
HARDWARE/ENGRAVING), onde o custo traz benefício.

---

## 9. Brand Recognition Strategy

### 9.1 Sinais

| Sinal | Origem | Peso de confiabilidade |
|---|---|---|
| LOGO_DETECTION | caixa + marca do detector de logo / IA de visão | 0,85 × confiança |
| OCR (confirmado no catálogo) | `BrandReader` | 0,80 |
| OCR (parcial / possível) | `BrandReader` | 0,45 |
| LABEL_RECOGNITION | OCR em etiqueta/língua/verso/haste | 0,85 |
| VISION_MODEL | `PIECE_ANALYZER` (marca + confiança) | 0,70 × confiança |
| VISUAL_EMBEDDING | k vizinhos com marca verificada (similaridade ≥ 0,9) | 0,30 × fração ponderada |
| SIGNATURE_PATTERN | base de conhecimento: posição típica do logo, elemento assinatura citado | 0,20 |
| CATEGORY_CONTEXT | a marca produz essa categoria? (sim: +0,05; desconhecida: neutro) | 0,05 |
| HARDWARE_RECOGNITION | OCR/IA em fivela, zíper, fecho, gravação | 0,60 |

### 9.2 Combinação

Por marca candidata, `score(b) = 1 − Π(1 − sᵢ)` (noisy-OR das evidências a favor). A confiança final reparte a massa
entre as candidatas e "outra": `other = Π_c (1 − score(c))`, `conf(b) = score(b) / (Σ score + other)`. Uma evidência
forte isolada dá ~0,96; duas candidatas com 0,6 e 0,3 dão ~51% / 25% / outra 24% — exatamente o caso
"Lacoste 58% · Izod 21% · Outra 21%".

Saída (`BrandPrediction`): `brand`, `confidence`, `evidence[]` (sinal, detalhe, vista, força, modelo/versão),
`alternatives[]` (top 5), `otherMass`, `level` e `resolverVersion`. Exemplo:

```json
{ "brand": "Lacoste", "confidence": 0.96,
  "evidence": [ {"signal":"LOGO_DETECTION","detail":"crocodilo no peito esquerdo","strength":0.81},
                {"signal":"SIGNATURE_PATTERN","detail":"posição do logo consistente (chest_left)","strength":0.20},
                {"signal":"VISUAL_EMBEDDING","detail":"3 de 5 vizinhos verificados","strength":0.21},
                {"signal":"OCR","detail":"leitura parcial \"LACOS\"","strength":0.45} ],
  "alternatives": [] }
```

### 9.3 Hierarquia de identificação

`category → subcategory → brand → productLine → model → variant`, cada nível com confiança **independente**.
Política de exibição: ≥ 0,90 "identificado"; 0,60–0,90 "provável"; < 0,60 "possível" com alternativas e pedido de
revisão/foto. Consistência: confiança da marca ≥ 0,98 × confiança do modelo quando o modelo implica a marca.
"Nike 95%" com "Air Max 90 62%" aparece como "Nike · modelo provável: Air Max 90 (62%)", nunca como certeza.

### 9.4 Base de conhecimento de produtos

`kb_brand_signatures` (marca, tipo de sinal: LOGO, WORDMARK, MONOGRAM, SIGNATURE_PATTERN, PATCH, LABEL, HARDWARE,
EMBROIDERY, SIDE_LOGO, TONGUE_LABEL, HEEL_BRANDING, SOLE_PATTERN, ENGRAVING, TEMPLE_MARKING, WATCH_DIAL; regiões
típicas; categorias; tokens de OCR), `kb_product_lines` e `kb_product_models` (tokens e padrões de código, cores e
materiais conhecidos). Semente v1 com conhecimento público de trade dress (Lacoste/crocodilo no peito, Nike/Swoosh
lateral, Adidas/três listras + Trefoil, Levi's/patch de dois cavalos + Red Tab + arcuate, Tissot/referência no
verso, Ray-Ban/haste, Louboutin/sola vermelha, Vans/jazz stripe, Dr. Martens/costura amarela…). A KB é evidência
complementar, nunca prova; não há imagens de terceiros na semente.

---

## 10. AI Training Architecture

```
Production inference ─► incerteza (conf < 0,80, alternativas próximas, pedidos pulados)
   ─► correção do usuário (evento) ─► revisão admin (AI decision · user correction · admin decision · final value)
   ─► anotação (Roboflow / CVAT, COCO) ─► Training dataset (versão) ─► retraining ─► avaliação (UGC × catálogo)
   ─► Model Registry (CANDIDATE → SHADOW → CANARY → PRODUCTION) ─► deployment (ONNX local ou Roboflow Inference)
```

- Treino fora da API (notebooks/Roboflow Train/Ultralytics), nunca no servidor de produção.
- Todo modelo tem `modelVersion`, `datasetVersion`, `trainingDate`, `evaluationMetrics`, `deploymentStatus`.
- Toda inferência de visão grava qual modelo/versão produziu o resultado (`model_inferences`), além do
  `ai_inference_log` já existente para chamadas de LLM.
- Promoção exige métricas por fatia (UGC separado de catálogo) iguais ou melhores que a versão em produção.

## 11. Dataset Strategy

**FashionAI Garment Vision Dataset** (roupas, calçados, acessórios) e **FashionAI Hard Examples** (casos difíceis
priorizados). Fontes permitidas, cada uma registrada em `dataset_sources` com tipo, licença, permissão de uso
(TRAINING, EVALUATION_ONLY, DISPLAY_ONLY), uso comercial, atribuição e exigência de consentimento:
datasets próprios; fotos de usuários **com consentimento AI_MODEL_TRAINING**; datasets licenciados; acadêmicos com
licença compatível (ex.: DeepFashion2 é só pesquisa → EVALUATION_ONLY, nunca produto comercial); parcerias e
assets de fabricantes; catálogos autorizados; dados internos.

Anotações suportadas (schema `training_candidates.annotations_json`, exportado como COCO):
GARMENT_BOUNDING_BOX, GARMENT_MASK, LOGO_BOUNDING_BOX, LOGO_MASK, BRAND_LABEL, CATEGORY, SUBCATEGORY, MATERIAL,
COLOR, PATTERN, STYLE, OCCASION, VIEW_TYPE e landmarks por família (calça: waistband_center, left/right_front_pocket,
left/right_back_pocket, brand_patch, crotch, left_hem, right_hem; parte de cima: neckline_center, shoulders,
sleeve ends, armpits, hem; calçado: toe, heel, collar, sole_front/back; acessórios: handle_top, body, clasp…).

Diversidade alvo: ângulos, luz, fundos (cama, chão, mesa), qualidade de câmera, peças dobradas/penduradas/sobre
superfície, amassadas, desgastadas, logos parciais, UGC × catálogo. Validação **sempre** com fatia UGC própria.

Hard examples: marcados automaticamente na análise — lowConfidenceBrand, partialLogo, complexBackground,
poorLighting, extremeAngle, lookalikeBranding (duas marcas próximas), obscuredLabel (etiqueta pedida e ilegível),
rareBrand (marca fora da KB) — e manualmente pelo admin (vintageItem, damagedGarment, counterfeitLookalike).

## 12. Active Learning Strategy

1. Na criação da peça a partir de uma sessão, cada campo previsto (categoria, subcategoria, marca, cor, material) é
   comparado com o valor final salvo: diferente → `ai_review_items` tipo CORRECTION; igual mas com confiança < 0,80 →
   LOW_CONFIDENCE.
2. **Correção do usuário não entra no treino automaticamente**: o admin decide (confirma usuário, confirma IA,
   sobrescreve, descarta). O valor final do registro é o rótulo; a peça do usuário não é alterada pelo admin.
3. Com decisão confirmada **e** consentimento AI_MODEL_TRAINING vigente, a imagem vira `training_candidates`
   (dataset GARMENT_VISION ou HARD_EXAMPLES), com snapshot do consentimento, fonte e licença.
4. Revogação do consentimento → candidatos e embeddings do usuário saem (status REVOKED, exportação ignora).
5. Exportação COCO só inclui candidatos APPROVED cuja fonte permite TRAINING.

## 13. Database Changes

Migration **V29__adaptive_garment_capture.sql** (aditiva; nenhuma coluna existente muda):

| Tabela | Papel |
|---|---|
| `capture_sessions` | sessão progressiva (usuário, rascunho principal, perfil, status, decisão, identificação JSON, peça) |
| `piece_images` | todas as imagens: ORIGINAL / CANONICAL / LOGO_DETAIL / TEXTURE_DETAIL / DETAIL / SEGMENTATION_MASK × vista; papel, propósito, origem, dimensões, orientação, scores (qualidade, blur, luz, cobertura), categoria detectada, spec, `derived_from_id`, modelo, status |
| `capture_requests` | pedidos de foto complementar (vista, propósito, necessidade, motivo, ganho esperado, status, confiança antes/depois) |
| `garment_landmarks` | landmarks normalizados por imagem (nome, x, y, confiança, visível, modelo) |
| `brand_predictions` | saída do ensemble por sessão/nível (marca, confiança, evidências, alternativas, versão) |
| `model_registry` | modelos versionados (tarefa, dataset, data de treino, métricas, status de deploy, provedor, artefato) — semente com os componentes atuais |
| `model_inferences` | qual modelo/versão produziu cada resultado (sessão, imagem, latência, confiança, ligação opcional ao `ai_inference_log`) |
| `ai_review_items` | AI decision / user correction / admin decision / final value |
| `dataset_sources` | proveniência e licença (semente: fonte UGC consentida, fonte interna) |
| `training_candidates` | fila de active learning e Hard Examples (anotações, tags, consentimento, licença, versão de anotação) |
| `kb_brand_signatures`, `kb_product_lines`, `kb_product_models` | base de conhecimento de produtos (semente) |
| `garment_embeddings` | vetores visuais por imagem e versão do modelo, com rótulo verificado |
| `wardrobe_items.canonical_image_url` | o canônico frontal da peça (colunas novas, nulas) |

Avaliação das entidades sugeridas: `PieceImage` (nova, o registro de assets de visão — não reaproveita `Photo`, que é
a galeria do RF12); `PieceImageAnalysis` e `GarmentVisionResult` ficam como `analysis_json` em `piece_images` e
`identification_json` em `capture_sessions` (evita 1:1 sem consulta própria); `GarmentLandmark`, `BrandPrediction`,
`ModelInference`, `CaptureRequest` ganham tabela (são consultados/agregados); `CaptureRecommendation` é a saída
calculada do motor (persistida como `capture_requests` quando oferecida); `ProcessingJob` = `PipelineJob` existente.
`ConsentPurpose` ganha `AI_MODEL_TRAINING`; `Taxonomy` ganha `wallet`.

## 14. API Changes

Novos (autenticados; donos verificados; multipart passa pelo `UploadSafetyInterceptor` existente):

| Método e rota | Função |
|---|---|
| `GET /api/capture/profiles` | perfis, vistas úteis, specs (para a orientação) |
| `POST /api/capture/sessions` | foto principal (`file`, `category?`, `subcategory?`, `viewType?`, `captureSource?`, `identifyModel?`, `personRemovedPct?`) → sessão com identificação, qualidade, canônicos e próxima recomendação |
| `GET /api/capture/sessions/{id}` | estado da sessão |
| `POST /api/capture/sessions/{id}/images` | foto complementar (`file`, `viewType`, `requestId?`, `captureSource?`) → identificação atualizada |
| `POST /api/capture/sessions/{id}/requests/{requestId}/skip` | pular |
| `POST /api/pieces` | `PieceForm.captureSessionId` (opcional) liga a sessão à peça, grava correções e o canônico |
| `GET /api/admin/ai-review` · `POST /api/admin/ai-review/{id}` | fila de revisão de IA e decisão |
| `GET/POST /api/admin/vision/models` · `POST /api/admin/vision/models/{id}/status` | registro de modelos |
| `GET /api/admin/vision/metrics` | métricas online (acurácia por campo, top-1/top-5 de marca, pulos, ganho realizado por vista) |
| `GET /api/admin/vision/datasets` · `GET /api/admin/vision/datasets/export` | fontes e exportação COCO com licença |

Sem quebra: `/api/pieces/analysis`, lote, várias peças numa foto, estúdio e marca continuam iguais.

## 15. Frontend Changes

- `pieces/new/page.tsx` vira assistente: **1. Captura → 2. Análise → 3. Detalhe opcional → 4. Revisão →
  5. Confirmação**. Começa com "Adicione uma foto da sua peça" — o tipo é opcional (escolher o tipo só refina a
  animação de orientação). Nada de campos "foto frontal/traseira/etiqueta" na tela inicial.
- Componentes novos em `components/capture/`: `capture-guidance.tsx`, `garment-glyphs.tsx`, `camera-capture.tsx`,
  `capture-request-card.tsx`, `identification-summary.tsx`, `quality-guidance.tsx`. Lógica pura em `lib/capture/`.
- Revisão mostra a hierarquia com confiança, evidências e alternativas ("Possíveis marcas: …"), os campos editáveis
  existentes (`PieceFields`), "Mais detalhes" e "Arte do card" como seções opcionais.
- Admin: `admin/ai-review` (fila de revisão de IA) no menu do admin.
- `next.config.ts`: `camera=(self)`.
- Textos em pt-BR, en e es (o `i18n:check`/`i18n:scan` do build exige paridade e proíbe texto fixo).

## 16. Infrastructure Changes

- Nenhuma infraestrutura nova obrigatória: tudo roda local (Railway atual).
- Opcionais por configuração (desligados sem chave): `fashionai.vision.roboflow.*` (Roboflow Inference hospedado ou o
  container `roboflow/roboflow-inference-server-cpu` como serviço Railway), `fashionai.vision.onnx.*` (modelos YOLO
  exportados em ONNX, mesmo padrão do OCR embarcado), `fashionai.delivery.cloudinary.*` (só entrega/transformação).
- Escala: busca vetorial começa em MySQL (força bruta por categoria e versão); o caminho é o OpenSearch k-NN
  (módulo `search-opensearch` já existe e é opcional).
- Fase 2: tirar a análise do request (fila Redis existente + consumidor + polling/SSE), consertar P13.

## 17. Security Considerations

- Sessões, imagens e pedidos verificam o dono em toda operação; rotas `/api/admin/**` com `Guard.requireAdmin`.
- Uploads: mesmo limite de tamanho/píxeis, interceptor de segurança de imagem e quarentena existentes; máximo de 6
  imagens complementares por sessão; vista e origem validadas contra os enums.
- Chamadas externas (Roboflow, LLM) só pelo `AiEngine`/consentimento; chaves só por variável de ambiente.
- Nenhum asset canônico é gerado por IA: evita "evidência fabricada" (logos/etiquetas inventados) — relevante para
  revenda (RF de loja) e para não induzir terceiros a erro sobre autenticidade.
- A IA nunca afirma autenticidade; "produto semelhante/falsificado" só aparece como tag interna de Hard Example.
- Exportação de dataset só para admin, sem e-mail/username, sem números de série.

## 18. Privacy Considerations

- Nova finalidade **AI_MODEL_TRAINING** (opt-in, nunca pré-marcada, revogável com o mesmo esforço; aparece na seção
  Privacidade pelo registro `AccountService.PURPOSES`).
- Sem consentimento: a foto serve só ao cadastro da própria pessoa — nada vai para dataset nem para o índice vetorial
  compartilhado.
- O original guardado é a foto **decodificada e reorientada, sem EXIF** (GPS removido); o hash SHA-256 dos bytes
  enviados fica para proveniência.
- Corpo humano removido no navegador antes do upload (`stripPerson`) e medido no gate (`personPresence`).
- Números de série lidos por OCR ficam só na análise visível ao dono e nunca são exportados.
- Minimização: sessões abandonadas são purgadas (arquivos + linhas) após `fashionai.capture.purge-abandoned-days`
  (padrão 30); exclusão de conta remove sessões e imagens (FK com cascata).

## 19. Testing Strategy

- **Unitários (JUnit 5 + AssertJ, padrão do projeto)**: `AdaptiveCaptureEngineTest` (todos os exemplos da seção 4.4),
  `BrandEnsembleResolverTest` (Lacoste com evidências; Lacoste × Izod com alternativas; OCR de etiqueta vence
  embedding), `IdentificationHierarchyTest`, `PhotographyQualityGateTest`, `LandmarkDetectorTest` (máscaras sintéticas
  de calça, camiseta e tênis), `CanonicalPhotographerTest` (cobertura, centro, base, sem pixel inventado, proporção),
  `PatternAnalyzerTest`, `LabelTextParserTest`, `CaptureProfilesTest` (toda subcategoria tem perfil; toda spec
  referenciada existe), `CaptureSessionServiceTest` (sessão, complementar, pular, ligação à peça e correções com
  mocks), `AiReviewServiceTest` (sem consentimento não vira candidato), `DatasetExportServiceTest` (licença),
  adaptadores (Roboflow, decodificação YOLO ONNX, URL Cloudinary).
- **Frontend (vitest + Testing Library)**: `frame-feedback.test.ts` (quadros sintéticos), guia animada, cartão de
  pedido com Pular, resumo de identificação ("Possíveis marcas"), fluxo do assistente, tela de revisão de IA.
- **Contrato**: rotas novas na tabela de endpoints; `lib/routes.test.ts` valida links.
- **Avaliação de modelos**: métricas offline por fatia (UGC × catálogo) no registro antes de promover.

## 20. Observability Strategy

- Cada sessão registra estágios e tempos; `model_inferences` registra modelo, versão, latência e confiança.
- `GET /api/admin/vision/metrics`: acurácia online por campo (valor final como verdade), marca top-1 e top-5
  (alternativas), taxa de pedidos por vista, taxa de pulo, ganho realizado por (perfil, vista), distribuição do
  PhotographyQualityScore, fração de canônicos "precisa de revisão", fila de revisão pendente, por fonte (UGC).
- Logs estruturados com `X-Correlation-Id` já existentes; custos de chamadas externas continuam no `ai_inference_log`.

## 21. Migration Strategy

| Fase | Entrega | Reversível? |
|---|---|---|
| 0 (esta) | V29 aditiva; engines; API de captura; assistente; revisão admin; registro; export; câmera | sim — o fluxo antigo continua; o frontend pode voltar a `/api/pieces/analysis` |
| 1 | Coleta com consentimento; projeto Roboflow; rotulagem dos Hard Examples; treino YOLO11-seg (peça + logo) e pose por família; registro como SHADOW; comparação lado a lado com a heurística | sim (SHADOW não decide) |
| 2 | Análise assíncrona (fila + SSE), embedding aprendido + OpenSearch k-NN, Cloudinary para variantes, backfill de canônicos das peças existentes, conserto do reprocessamento (P13) | sim, por feature flag |
| 3 | Linha/modelo/variante com KB ampliada por parcerias; calibração dos pesos do ensemble e do motor de captura | — |

Correções incluídas nesta entrega: P12 (`analyzeBatch` transacional), P15 (câmera), P16 (`wallet`), P2 (modo
orientar na sessão de captura), P14 (purga de sessões abandonadas).

## 22. Roboflow × YOLO e Cloudinary — avaliação

Não existe pipeline YOLO no código para "substituir"; a comparação é entre caminhos para os modelos treinados:

| Critério | Ultralytics YOLO self-hosted (ONNX na JVM) | Roboflow (dataset + treino + inferência) |
|---|---|---|
| Dataset e anotação | ferramenta à parte (CVAT/Label Studio) | nativo (anotação, auto-label, versões, health check, active learning) |
| Treino | GPU própria/Colab; controle total | gerenciado; rápido para iterar |
| Inferência | ONNX Runtime já usado no projeto (OCR, pessoa); custo zero por chamada; latência baixa | API hospedada (custo por chamada) ou servidor de inferência self-hosted |
| Lock-in | nenhum | mitigado exportando pesos YOLO/ONNX (verificar plano) |
| Encaixe na arquitetura | `OnnxYoloDetector` atrás da porta | `RoboflowVisionAdapter` atrás da mesma porta |

**Recomendação**: Roboflow para dataset, anotação, treino e avaliação (com o MCP do Roboflow no desenvolvimento);
pesos exportados em ONNX servidos localmente pelo adaptador ONNX (custo zero, mesmo padrão do OCR); o adaptador
HTTP do Roboflow fica como alternativa/shadow. **Cloudinary** só para entrega: o master canônico fica no storage do
FashionAI; variantes (thumb, card, feed) por named transformations com cache/CDN — visão computacional nunca depende
da transformação de entrega.
