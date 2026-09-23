# Análise de Impacto: Novas Entidades e Campos Necessários para RF4 e RF18

**Projeto:** FashionAI (SAI-TCC-2026)  
**Data:** 18 de setembro de 2026  
**Escopo:** Impacto das arquiteturas de pipeline (RF4 Flat Lay + RF18 Virtual Dressing) no diagrama UML atual

---

## 1. Resumo Executivo

Baseado na análise das abordagens propostas para **RF4 (Flat Lay Photo Standardization)** e **RF18 (Virtual 2D Dressing Room)**, identificam-se as seguintes necessidades de modificação no modelo de dados:

### Novas Entidades Necessárias:
1. `ProcessingJob` (Firestore) - rastreamento de jobs de processamento de imagens
2. `QualityScore` (Firestore) - registro de métricas de qualidade de fotos
3. `OutfitRenderJob` (Firestore) - rastreamento de renderizações 2D/3D
4. `RenderCache` (Redis) - cache de renderizações prontas

### Campos Novos em Entidades Existentes:
- `WardrobeItem`: photoProcessingStatus, qualityScores, processingTimeMs
- `Scheme`: renderingStatus, renderingQuality, virtualTryOnUrl
- `AIInference`: flatLayScore, compositionQuality

### Tabelas Novas (MySQL):
- `processing_jobs_log` - histórico de processamentos
- `quality_metrics` - métricas agregadas
- `render_jobs_log` - histórico de renderizações

---

## 2. Análise Detalhada por Requisito

### RF4: Flat Lay Photo Standardization Pipeline

#### Novo Fluxo de Dados:
```
WardrobeItem (upload bruto)
  ↓
ProcessingJob (rastreamento)
  ├─ Stage 1: BackgroundRemovalJob (Firestore subcoleção)
  ├─ Stage 2: PerspectiveCorrectionJob (Firestore subcoleção)
  ├─ Stage 3: ColorNormalizationJob (Firestore subcoleção)
  ├─ Stage 4: CompositionJob (Firestore subcoleção)
  └─ Stage 5: QualityValidation (QualityScore document)
  ↓
WardrobeItem (atualizado com campos de processamento)
  ├─ imageUrl (processada)
  ├─ imageOriginal (bruta)
  ├─ photoProcessingStatus: ENUM
  ├─ photoQualityScores: QualityScore (referência)
  └─ processingTimeMs: Integer
```

#### Entidade Nova: ProcessingJob (Firestore)
```firestore
processing_jobs/{id}
├─ wardrobeItemId: UUID (FK)
├─ userId: UUID (FK)
├─ jobType: String ("FLAT_LAY_STANDARDIZATION" | "OUTFIT_RENDER")
├─ status: ENUM ("QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED")
├─ stages: {
│   ├─ background_removal: {
│   │   ├─ provider: String ("REMBG" | "REMOVE_BG")
│   │   ├─ status: String
│   │   ├─ confidence: Float
│   │   ├─ processingTimeMs: Integer
│   │   └─ completedAt: Timestamp
│   ├─ perspective_correction: {
│   │   ├─ angleDetected: Float (degrees)
│   │   ├─ confidence: Float
│   │   ├─ processingTimeMs: Integer
│   │   └─ completedAt: Timestamp
│   ├─ color_normalization: {
│   │   ├─ provider: String ("CLOUDINARY" | "PIL")
│   │   ├─ colorShift: Float
│   │   ├─ brightness: Float
│   │   ├─ saturation: Float
│   │   └─ processingTimeMs: Integer
│   ├─ composition: {
│   │   ├─ templateUsed: String ("STANDARD" | "LIFESTYLE" | "DETAIL")
│   │   ├─ resolution: { width: 1024, height: 1024 }
│   │   ├─ backgroundColor: String
│   │   └─ processingTimeMs: Integer
│   └─ quality_validation: {
│       ├─ overallScore: Float (0-1)
│       ├─ blurDetection: Float
│       ├─ contrastScore: Float
│       ├─ colorShiftDetection: Float
│       ├─ issues: String[]
│       └─ recommendations: String[]
├─ totalProcessingTimeMs: Integer
├─ fallbackUsed: Boolean (se algum stage falhou e usou local fallback)
├─ retryCount: Integer
├─ maxRetries: Integer (default 3)
├─ createdAt: Timestamp
├─ updatedAt: Timestamp
└─ completedAt: Timestamp
```

#### Entidade Nova: QualityScore (Firestore)
```firestore
quality_scores/{id}
├─ wardrobeItemId: UUID (FK)
├─ processingJobId: UUID (FK)
├─ metrics: {
│   ├─ background_removal: Float (0-1)
│   ├─ perspective_correction: Float (0-1)
│   ├─ color_normalization: Float (0-1)
│   ├─ composition: Float (0-1)
│   ├─ blur_detection: Float (0-1)
│   ├─ contrast: Float (0-1)
│   ├─ color_shift: Float (0-1)
│   └─ overall: Float (0-1)
├─ acceptanceThreshold: Float (default 0.6)
├─ isAccepted: Boolean
├─ feedbackFromUser: String (opcional, se rejeitado)
├─ recommendations: String[]
├─ createdAt: Timestamp
└─ expiresAt: Timestamp (30 dias)
```

#### Modificações em WardrobeItem (Firestore)
**Campos Novos:**
```firestore
wardrobe_items/{id}
├─ [NOVO] imageProcessingStatus: ENUM 
│   ("PENDING" | "PROCESSING" | "SUCCESS" | "FAILED" | "NEEDS_REUPLOAD")
├─ [NOVO] photoQualityScores: {
│   ├─ scoreDocId: UUID (referência a quality_scores/{id})
│   ├─ overallScore: Float
│   ├─ lastUpdated: Timestamp
│   └─ isAccepted: Boolean
├─ [NOVO] processingTimeMs: Integer
├─ [NOVO] processingJobId: UUID (FK para ProcessingJob)
├─ [NOVO] processingHistory: Array<{
│   ├─ jobId: UUID
│   ├─ timestamp: Timestamp
│   ├─ status: String
│   ├─ score: Float
│   └─ provider: String
│ > (últimas 5 tentativas)
├─ [NOVO] flatLayMetadata: {
│   ├─ templateUsed: String
│   ├─ backgroundColor: String
│   ├─ perspectiveAngle: Float
│   └─ normalizationApplied: Boolean
└─ [EXISTENTE] imageUrl: String (agora aponta para foto processada)
```

**Impacto em Índices OpenSearch:**
```json
{
  "pieces_index": {
    "mappings": {
      "properties": {
        "photoQualityScore": { "type": "float" },
        "processingStatus": { "type": "keyword" },
        "flatLayTemplate": { "type": "keyword" }
      }
    }
  }
}
```

#### Nova Tabela MySQL: processing_jobs_log
```sql
CREATE TABLE processing_jobs_log (
  id UUID PRIMARY KEY,
  wardrobe_item_id UUID NOT NULL REFERENCES wardrobe_items(id),
  user_id UUID NOT NULL REFERENCES users(id),
  job_type VARCHAR(50),
  status VARCHAR(50),
  total_processing_time_ms INTEGER,
  stage_times JSON, -- { "bg_removal": 400, "perspective": 200, ... }
  final_quality_score FLOAT,
  was_accepted BOOLEAN,
  retry_count INTEGER,
  fallback_used BOOLEAN,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  
  INDEX idx_user_status (user_id, status),
  INDEX idx_created_at (created_at)
);
```

#### Nova Tabela MySQL: quality_metrics
```sql
CREATE TABLE quality_metrics (
  id UUID PRIMARY KEY,
  period_start TIMESTAMP,
  period_end TIMESTAMP,
  total_processed INTEGER,
  total_accepted INTEGER,
  acceptance_rate FLOAT,
  avg_processing_time_ms FLOAT,
  avg_quality_score FLOAT,
  common_issues JSON, -- { "blur": 0.15, "low_contrast": 0.10, ... }
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### RF18: Virtual 2D Dressing Room with Cleanup.ai + Canvas

#### Novo Fluxo de Dados:
```
Scheme (look compilado)
  ↓
OutfitRenderJob (rastreamento)
  ├─ Stage 1: Fashn.ai Rendering (4 peças principais)
  ├─ Stage 2: Cleanup.ai Enhancement (remoção de distorções)
  ├─ Stage 3: Canvas 2D Compositor (shoes + accessories)
  └─ Stage 4: RenderCache (cache Redis)
  ↓
Scheme (atualizado com URL de renderização)
  ├─ virtualTryOnUrl: String
  ├─ renderingStatus: ENUM
  ├─ renderingQuality: QualityScore
  └─ cachedUntil: Timestamp
```

#### Entidade Nova: OutfitRenderJob (Firestore)
```firestore
outfit_render_jobs/{id}
├─ schemeId: UUID (FK)
├─ userId: UUID (FK)
├─ renderingType: String ("FASHN_AI" | "CUSTOM_FINE_TUNED")
├─ status: ENUM ("QUEUED" | "RENDERING" | "ENHANCING" | "COMPOSITING" | "COMPLETED" | "FAILED")
├─ stages: {
│   ├─ fashn_ai_rendering: {
│   │   ├─ requestPayload: JSON (peças enviadas)
│   │   ├─ responseUrl: URL
│   │   ├─ distortionDetected: Float (0-1)
│   │   ├─ processingTimeMs: Integer
│   │   ├─ cost: Float (USD)
│   │   └─ completedAt: Timestamp
│   ├─ cleanup_enhancement: {
│   │   ├─ inputUrl: URL (resultado Fashn.ai)
│   │   ├─ outputUrl: URL (com correções)
│   │   ├─ distortionsRemoved: String[] (["hands", "anatomy", "fitting"])
│   │   ├─ qualityImprovement: Float (0-1)
│   │   ├─ processingTimeMs: Integer
│   │   ├─ cost: Float (USD)
│   │   └─ completedAt: Timestamp
│   ├─ canvas_compositor: {
│   │   ├─ shoesAdded: Boolean
│   │   ├─ accessoriesAdded: Boolean
│   │   ├─ positioningAccuracy: Float (0-1)
│   │   ├─ processingTimeMs: Integer
│   │   ├─ cost: Float (USD) [negligível, local]
│   │   └─ completedAt: Timestamp
│   └─ quality_validation: {
│       ├─ overallQuality: Float (0-1)
│       ├─ anatomyAccuracy: Float (0-1)
│       ├─ fittingRealism: Float (0-1)
│       ├─ colorConsistency: Float (0-1)
│       ├─ accessoryCoverage: Float (0-1)
│       └─ recommendations: String[]
├─ finalRenderUrl: URL (imagem final)
├─ cacheKey: String (redis_cache:{schemeId}:{renderType})
├─ cacheTtl: Integer (3600 segundos, 1 hora)
├─ totalProcessingTimeMs: Integer
├─ totalCost: Float (USD, sum of all stages)
├─ retryCount: Integer
├─ maxRetries: Integer (default 2)
├─ createdAt: Timestamp
├─ updatedAt: Timestamp
└─ completedAt: Timestamp
```

#### Entidade Nova em Redis: RenderCache
```redis
render_cache:{schemeId}:{renderType}
├─ renderUrl: URL
├─ thumbnailUrl: URL
├─ quality: Float
├─ generatedAt: Timestamp
├─ ttl: 3600 (segundos)
├─ accessCount: Integer
└─ lastAccessed: Timestamp
```

#### Modificações em Scheme (Firestore)
**Campos Novos:**
```firestore
schemes/{id}
├─ [NOVO] renderingStatus: ENUM 
│   ("PENDING" | "RENDERING" | "ENHANCING" | "CACHED" | "FAILED")
├─ [NOVO] virtualTryOnUrl: String (URL da imagem renderizada)
├─ [NOVO] renderingJobId: UUID (FK para OutfitRenderJob)
├─ [NOVO] renderingQuality: {
│   ├─ overallScore: Float (0-1)
│   ├─ anatomyAccuracy: Float (0-1)
│   ├─ fittingRealism: Float (0-1)
│   ├─ colorConsistency: Float (0-1)
│   ├─ accessoryCoverage: Float (0-1)
│   └─ lastUpdated: Timestamp
├─ [NOVO] renderingCost: Float (USD, histórico de custos)
├─ [NOVO] renderingHistory: Array<{
│   ├─ jobId: UUID
│   ├─ timestamp: Timestamp
│   ├─ url: URL
│   ├─ quality: Float
│   └─ cost: Float
│ > (últimas 3 renderizações)
├─ [NOVO] cachedUntil: Timestamp (quando cache expira)
└─ [NOVO] renderingMetadata: {
    ├─ shoesIncluded: Boolean
    ├─ accessoriesIncluded: Boolean
    ├─ piecesCount: Integer
    └─ hasCleanupEnhancement: Boolean
```

**Impacto em Índices OpenSearch:**
```json
{
  "looks_index": {
    "mappings": {
      "properties": {
        "renderingQuality": { "type": "float" },
        "renderingStatus": { "type": "keyword" },
        "virtualTryOnUrl": { "type": "keyword" },
        "hasShoesAndAccessories": { "type": "boolean" }
      }
    }
  }
}
```

#### Nova Tabela MySQL: render_jobs_log
```sql
CREATE TABLE render_jobs_log (
  id UUID PRIMARY KEY,
  scheme_id UUID NOT NULL REFERENCES schemes(id),
  user_id UUID NOT NULL REFERENCES users(id),
  rendering_type VARCHAR(50),
  status VARCHAR(50),
  total_processing_time_ms INTEGER,
  stage_times JSON, -- { "fashn_ai": 2000, "cleanup": 800, "compositor": 100 }
  final_quality_score FLOAT,
  total_cost FLOAT,
  retry_count INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  
  INDEX idx_user_status (user_id, status),
  INDEX idx_created_at (created_at),
  INDEX idx_quality (final_quality_score)
);
```

#### Nova Tabela MySQL: rendering_costs
```sql
CREATE TABLE rendering_costs (
  id UUID PRIMARY KEY,
  period_start TIMESTAMP,
  period_end TIMESTAMP,
  total_renders INTEGER,
  total_cost_fashn_ai FLOAT,
  total_cost_cleanup_ai FLOAT,
  total_cost_rembg FLOAT,
  total_cost FLOAT,
  avg_cost_per_render FLOAT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. Diagrama UML Atualizado - Estrutura de Dados Completa

```
[RF4 - FLAT LAY PIPELINE]
WardrobeItem
├─ imageProcessingStatus: ENUM (NEW)
├─ photoQualityScores: Reference to QualityScore (NEW)
├─ processingJobId: Reference to ProcessingJob (NEW)
└─ flatLayMetadata: JSON (NEW)
  ↓
ProcessingJob (Firestore) (NEW ENTITY)
├─ stages: BackgroundRemovalJob + PerspectiveCorrectionJob + ...
├─ status: ENUM
└─ retryCount: Integer
  ↓
QualityScore (Firestore) (NEW ENTITY)
├─ metrics: { background_removal, perspective, color, composition, blur, contrast }
├─ isAccepted: Boolean
└─ recommendations: String[]

MySQL Tables (NEW):
├─ processing_jobs_log
└─ quality_metrics


[RF18 - VIRTUAL DRESSING ROOM]
Scheme
├─ renderingStatus: ENUM (NEW)
├─ virtualTryOnUrl: String (NEW)
├─ renderingJobId: Reference to OutfitRenderJob (NEW)
├─ renderingQuality: JSON (NEW)
├─ cachedUntil: Timestamp (NEW)
└─ renderingMetadata: JSON (NEW)
  ↓
OutfitRenderJob (Firestore) (NEW ENTITY)
├─ stages: FashnAiRendering + CleanupEnhancement + CanvasComposition
├─ status: ENUM
├─ finalRenderUrl: URL
└─ totalCost: Float
  ↓
RenderCache (Redis) (NEW)
├─ renderUrl: URL
├─ quality: Float
└─ ttl: 3600

MySQL Tables (NEW):
├─ render_jobs_log
└─ rendering_costs
```

---

## 4. Tabela de Mudanças por Entidade

| Entidade | Tipo | Ação | Impacto |
|----------|------|------|--------|
| **WardrobeItem** | Firestore | Adicionar 5 campos | Médio - quebra compatibilidade se app não fizer tratamento de defaults |
| **Scheme** | Firestore | Adicionar 6 campos | Médio - importante para renderização virtual |
| **ProcessingJob** | Firestore | ✨ **NOVA** | Alto - core para RF4 |
| **QualityScore** | Firestore | ✨ **NOVA** | Alto - rastreamento de qualidade |
| **OutfitRenderJob** | Firestore | ✨ **NOVA** | Alto - core para RF18 |
| **RenderCache** | Redis | ✨ **NOVA** | Médio - performance, não crítico |
| **processing_jobs_log** | MySQL | ✨ **NOVA** | Baixo - apenas auditoria |
| **quality_metrics** | MySQL | ✨ **NOVA** | Baixo - apenas analytics |
| **render_jobs_log** | MySQL | ✨ **NOVA** | Baixo - apenas auditoria |
| **rendering_costs** | MySQL | ✨ **NOVA** | Baixo - apenas analytics |

---

## 5. Diagrama ER Atualizado

```
┌─────────────────────────────────────────────────────────────┐
│                    FIRESTORE (NoSQL)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  WardrobeItem (MODIFICADO)                                  │
│  ├─ + photoQualityScores (FK → QualityScore)               │
│  ├─ + processingJobId (FK → ProcessingJob)                 │
│  └─ + flatLayMetadata                                      │
│       ↓ 1..N                                               │
│       ProcessingJob (NOVO) ──┐                              │
│       ├─ stages: {...}       │                              │
│       ├─ status              │                              │
│       └─ retryCount          │                              │
│            ↓ 1               │                              │
│       QualityScore (NOVO) ←──┘                              │
│       ├─ metrics: {...}                                     │
│       └─ isAccepted                                         │
│                                                              │
│  Scheme (MODIFICADO)                                        │
│  ├─ + virtualTryOnUrl                                       │
│  ├─ + renderingJobId (FK → OutfitRenderJob)                │
│  ├─ + renderingQuality                                      │
│  └─ + cachedUntil                                           │
│       ↓ 1..N                                               │
│       OutfitRenderJob (NOVO) ──┐                            │
│       ├─ stages: {...}          │                           │
│       ├─ status                 │                           │
│       └─ totalCost              │                           │
│            ↓                    │                           │
│       RenderCache (REDIS) ← ────┘                           │
│       ├─ renderUrl                                          │
│       ├─ quality                                            │
│       └─ ttl                                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    MYSQL (Relacional)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  processing_jobs_log (NOVO)                                 │
│  ├─ wardrobe_item_id (FK → wardrobe_items)                 │
│  ├─ user_id (FK → users)                                   │
│  ├─ final_quality_score                                    │
│  └─ completed_at                                            │
│                                                              │
│  quality_metrics (NOVO)                                     │
│  ├─ total_processed                                         │
│  ├─ acceptance_rate                                         │
│  └─ common_issues (JSON)                                    │
│                                                              │
│  render_jobs_log (NOVO)                                     │
│  ├─ scheme_id (FK → schemes)                                │
│  ├─ user_id (FK → users)                                   │
│  ├─ final_quality_score                                    │
│  └─ total_cost                                              │
│                                                              │
│  rendering_costs (NOVO)                                     │
│  ├─ period_start                                            │
│  ├─ total_cost_fashn_ai                                     │
│  ├─ total_cost_cleanup_ai                                   │
│  └─ total_cost                                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Recomendações de Implementação

### Fase 1: Preparar Schema (Semana 1)
- [ ] Criar migrações Firestore para novos campos em WardrobeItem
- [ ] Criar coleção ProcessingJob (Firestore)
- [ ] Criar coleção QualityScore (Firestore)
- [ ] Criar tabelas MySQL: processing_jobs_log, quality_metrics
- [ ] Criar índices em MySQL para queries de auditoria

### Fase 2: Implementar RF4 (Semana 2-3)
- [ ] Implementar ProcessingJob service
- [ ] Integrar Rembg + Cloudinary
- [ ] Implementar QualityScore validator
- [ ] Atualizar WardrobeItem schema com novos campos
- [ ] Criar logs em MySQL

### Fase 3: Implementar RF18 (Semana 3-4)
- [ ] Criar coleção OutfitRenderJob (Firestore)
- [ ] Criar estrutura RenderCache (Redis)
- [ ] Integrar Fashn.ai + Cleanup.ai
- [ ] Atualizar Scheme schema com novos campos
- [ ] Criar render cache invalidation policy

### Fase 4: Analytics & Monitoring (Semana 4-5)
- [ ] Dashboard de quality metrics
- [ ] Dashboard de rendering costs
- [ ] Alertas para taxa de sucesso < 90%
- [ ] Relatório mensal de ROI

---

## 7. Impacto de Compatibilidade

### Breaking Changes
- ❌ **Médio:** WardrobeItem e Scheme ganham novos campos obrigatórios
  - **Mitigação:** App deve usar valores default (null, "PENDING", etc.)
  
### Non-Breaking Changes
- ✅ Novas coleções Firestore (ProcessingJob, QualityScore, OutfitRenderJob)
- ✅ Novas tabelas MySQL (logging tables apenas)
- ✅ Novos campos Redis (cache)

### Estratégia de Deploy
1. Criar campos com valores default/nullable
2. Deploy app que consegue ler novos campos
3. Deploy pipelines de processamento (RF4, RF18)
4. Migrar dados históricos (backfill)

---

## 8. Conclusão

As abordagens propostas para RF4 e RF18 requerem **8 novas entidades/estruturas** e **modificações em 2 entidades existentes**, totalizando **~15 campos novos**.

**Recomendação:** Implementar mudanças de schema em paralelo com desenvolvimento de pipelines. A arquitetura é escalável e não compromete entidades core (User, Brand, Market, Schemes base).

O impacto é **Médio-Alto** na complexidade, mas **Baixo** em breaking changes se handled corretamente.

