# 📊 Listagem de Entidades de RF4 e RF5

## RF4 - Adicionar Peça ao Guarda-Roupa
**Diagrama de Classes PDF:** 18410a81-RF4-classes.pdf

### Classe Principal: **ClothingPiece** (WardrobeItem - Firestore)

#### Campos de Identificação
- `id`: UUID [PK]
- `userId`: UUID [FK → User]
- `name`: String (nome descritivo da peça)
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

#### Campos de Categorização
- `category`: Enum (TOPS, BOTTOMS, SHOES, ACCESSORIES, FULL_BODY, DRESS)
- `subcategory`: String (parte do corpo: cabeça, superior, inferior, calçado)
- `brandId`: UUID [FK → Brand]
- `marketId`: UUID [FK → Market]
- `occasion`: String (ocasião: casual, formal, esportiva, praia)
- `wearstyles`: String[] (estilo: clássico, moderno, minimalista, descontraído)

#### Campos de Atributos Visuais
- `color`: String (cor dominante - hex #RRGGBB)
- `colorSecondary`: String[] (cores secundárias)
- `material`: Enum (COTTON, POLYESTER, WOOL, SILK, LEATHER, SYNTHETIC, BLEND)
- `texture`: String (textura: liso, amassado, padrão)
- `pattern`: String (padrão: sólido, listrado, xadrez, floral, geométrico)
- `size`: String (tamanho: XS, S, M, L, XL, XXL ou numérico)
- `sizeLength`: Float (cm - comprimento)
- `sizeWidth`: Float (cm - largura)

#### Campos de Informações Comerciais
- `price`: Float (USD)
- `purchaseDate`: Timestamp
- `purchaseLocation`: String (loja/e-commerce onde foi comprado)
- `condition`: Enum (NEW, GOOD, WORN, DAMAGED)
- `sku`: String (código de produto)

#### Campos de Mídia
- `imageUrl`: URL (foto principal - Vercel Blob ou S3)
- `imagePath`: String (storage path completo)
- `imageMimetype`: String (image/jpeg, image/png, image/webp)
- `imageFileSize`: Long (bytes)
- `imageHash`: String (para deduplicação)
- `thumbnailUrl`: URL (thumbnail 300x300)

#### Campos de Disponibilidade e Estado
- `availability_status`: Enum (AVAILABLE, UNAVAILABLE, ARCHIVED)
- `is_favorite`: Boolean (marcado como favorito)
- `for_sale`: Boolean (disponível para venda)
- `sex`: Enum (MASCULINO, FEMININO, UNISSEX) [NOVO - CA07]

#### Campos de Processamento de Foto (RF4 - Flat Lay)
- `photoProcessingStatus`: Enum (NEW, PROCESSING, COMPLETED, FAILED) [NOVO - RF4]
- `photoQualityScores`: Reference → QualityScore [NOVO - RF4]
- `processingJobId`: UUID [NOVO - RF4]
- `processingTimeMs`: Integer [NOVO - RF4]
- `flatLayMetadata`: JSON {
    - `background_removal_confidence`: Float (0-1)
    - `perspective_correction_applied`: Boolean
    - `color_normalization_score`: Float (0-1)
    - `composition_quality`: Float (0-1)
    - `failed_stages`: String[]
    - `retry_count`: Integer
    - `fallback_used`: Boolean
  } [NOVO - RF4]

#### Campos de Rastreamento
- `tags`: String[] (busca/organização pessoal)
- `notes`: String (anotações pessoais)
- `wear_count`: Integer (número de vezes usado)
- `last_worn_date`: Timestamp
- `care_instructions`: String (cuidados especiais)

### Entidades Relacionadas a RF4
- **User**: proprietário da peça (1:N relação inversa)
- **Brand**: marca/fabricante (N:1)
- **Market**: mercado/coleção (N:1)
- **QualityScore** (NOVO): avaliação de qualidade da foto (1:N) [RF4]
- **ProcessingJob** (NOVO): histórico de processamentos (1:N) [RF4]
- **SchemeItem**: item usado em esquemas (0:N)

---

## RF5 - Criar Esquema de Vestimenta (Look)
**Diagrama de Classes PDF:** 12aaca26-RF5-classes.pdf

### Classe Principal: **Scheme** (Vestimenta/Look - Firestore)

#### Campos de Identificação
- `id`: UUID [PK]
- `userId`: UUID [FK → User]
- `title`: String (nome do look)
- `description`: String (opcional - descrição do look)
- `createdAt`: Timestamp
- `updatedAt`: Timestamp
- `publishedAt`: Timestamp [DERIVADO - quando foi publicado]

#### Campos de Contextualização
- `occasion`: String (ocasião: casual, formal, esportiva, trabalho, noite)
- `style`: String[] (estilos: minimalista, clássico, moderno, boho, punk)
- `season`: String (estação: primavera, verão, outono, inverno)
- `mood`: String (clima: energético, elegante, confortável, sofisticado)
- `weather`: String (clima: quente, moderado, frio, chuvoso)

#### Campos de Status e Visibilidade
- `creationMode`: Enum (MANUAL, AI_ASSISTED)
- `status`: Enum (DRAFT, PUBLISHED, ARCHIVED, DELETED)
- `visibility`: Enum (PRIVATE, FOLLOWERS, PUBLIC)

#### Campos de Composição Visual
- `backgroundColor`: String (cor de fundo #RRGGBB)
- `backgroundGradient`: String (gradiente CSS: linear-gradient(...))
- `backgroundImageUrl`: URL (imagem de fundo) [NOVO - RF11]
- `backgroundImagePath`: String (storage path)
- `displayMode`: String (layout: carousel, grid, stacked)

#### Campos de Renderização (RF18 - Provador 2D)
- `renderingStatus`: Enum (PENDING, RENDERING, ENHANCING, COMPOSITING, COMPLETED, FAILED) [NOVO - RF18]
- `virtualTryOnUrl`: URL (imagem renderizada do provador) [NOVO - RF18]
- `renderingJobId`: UUID (FK → OutfitRenderJob) [NOVO - RF18]
- `renderingQuality`: JSON {
    - `overall_score`: Float (0-1)
    - `dimensions`: {width: Integer, height: Integer}
    - `colors_matched`: Float (0-1)
    - `fabric_realism`: Float (0-1)
    - `composition_score`: Float (0-1)
  } [NOVO - RF18]
- `cachedUntil`: Timestamp (até quando está em cache) [NOVO - RF18]
- `renderingMetadata`: JSON {
    - `model_type`: String (manequim 2D type)
    - `rendering_provider`: String (Fashn.ai, Custom)
    - `total_processing_time_ms`: Integer
    - `cost_usd`: Float
    - `stages_completed`: String[]
  } [NOVO - RF18]

#### Campos de Engajamento
- `likes`: Integer
- `shares`: Integer
- `remixes`: Integer
- `view_count`: Integer
- `save_count`: Integer

#### Campos de Rastreamento
- `tags`: String[] (hashtags e keywords de busca)
- `is_remixed_from`: UUID (FK → Scheme original, se for remix)

### Subconstruto: **SchemeItem** (Item dentro do Scheme)

#### Campos de Referência
- `id`: UUID [PK]
- `schemeId`: UUID [FK → Scheme]
- `wardrobeItemId`: UUID [FK → ClothingPiece]

#### Campos de Posicionamento Visual
- `slot`: Enum (TOP, BOTTOM, SHOES, ACCESSORIES, DRESS, FULL_BODY)
- `zIndex`: Integer (ordem visual de sobreposição)
- `sortOrder`: Integer (ordem na lista de items)
- `positionX`: Float (posição horizontal em %)
- `positionY`: Float (posição vertical em %)
- `scale`: Float (escala 0.5-2.0)
- `rotation`: Float (rotação em graus 0-360)
- `opacity`: Float (transparência 0-1)

#### Campos de Efeitos
- `filters`: JSON {
    - `blur`: Float (0-100)
    - `saturation`: Float (-100 a 100)
    - `brightness`: Float (-100 a 100)
    - `contrast`: Float (-100 a 100)
    - `hue_shift`: Float (0-360)
  }

#### Campos de Estado
- `visibility`: Enum (VISIBLE, HIDDEN) (para ocultar peças na composição)
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

### Subconstruto: **SchemeBackground** (Configuração de Fundo)

#### Campos de Identificação
- `id`: UUID [PK]
- `schemeId`: UUID [FK → Scheme]

#### Campos de Estilo
- `backgroundColor`: String (cor sólida #RRGGBB)
- `backgroundGradient`: String (CSS gradient)
- `backgroundImageUrl`: URL (imagem de fundo)
- `backgroundImagePath`: String
- `colorStartHex`: String (cor inicial do gradiente)
- `colorEndHex`: String (cor final do gradiente)
- `gradientAngle`: Integer (ângulo 0-360)
- `displayMode`: String (SOLID, GRADIENT, IMAGE)
- `opacity`: Float (0-1)
- `blurBackground`: Float (0-100)
- `patternOverlay`: String (opcional: padrão adicional)

#### Campos de Metadata
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

### Subconstruto: **AIAssistance** (Geração com IA)

#### Campos de Configuração
- `id`: UUID [PK]
- `schemeId`: UUID [FK → Scheme]
- `userDescription`: String (prompt do usuário)
- `occasion`: String (ocasião desejada)
- `mood`: String (clima desejado)
- `style_preferences`: String[] (preferências de estilo)

#### Campos de Resultado
- `suggestedItems`: SchemeItem[] (itens sugeridos)
- `confidenceScores`: Float[] (confiança por item)
- `generationAttempts`: Integer (quantas tentativas foram feitas)
- `createdAt`: Timestamp

### Entidades Relacionadas a RF5
- **User**: proprietário do esquema (1:N relação inversa)
- **SchemeItem**: itens que compõem o look (1:N) → referencia ClothingPiece
- **SchemeBackground**: configuração de fundo (0..1)
- **AIAssistance**: dados da geração com IA (0..1)
- **OutfitRenderJob** (NOVO): renderização 2D do provador (0:N) [RF18]
- **RenderCache** (NOVO): cache de renderizações (0:N) [RF18]
- **SchemeComment**: comentários de usuários (0:N)
- **SchemeLike**: likes de usuários (0:N)

---

## Mapeamento de Persistência

### Firestore Collections
- `/users/{userId}/wardrobeItems` → ClothingPiece
- `/wardrobeItems` (índice global)
- `/users/{userId}/schemes` → Scheme
- `/schemes` (índice global)
- `/processingJobs` → ProcessingJob [RF4]
- `/qualityScores` → QualityScore [RF4]
- `/outfitRenderJobs` → OutfitRenderJob [RF18]

### MySQL Audit Tables
- `processing_jobs_log` (log de processamentos RF4)
- `quality_metrics` (métricas de qualidade)
- `render_jobs_log` (log de renderizações RF18)
- `rendering_costs` (custos de renderização)

### Redis Cache
- `wardrobe:{userId}:summary` → estatísticas do guarda-roupa
- `scheme:{schemeId}:preview` → preview renderizado [RF18]
- `render_cache:{schemeId}:{renderType}` → cache de renderizações [RF18]

### OpenSearch Indices
- `pieces_index` → indexação de ClothingPiece (busca full-text)
- `schemes_index` → indexação de Scheme com campos de renderização [RF18]

### S3/Vercel Blob Storage
- `/fashion-ai-assets/{userId}/clothing/{itemId}/original.{ext}`
- `/fashion-ai-assets/{userId}/clothing/{itemId}/thumbnail.{ext}`
- `/fashion-ai-assets/{userId}/schemes/{schemeId}/preview.{ext}` [RF18]
- `/fashion-ai-assets/{userId}/schemes/{schemeId}/renders/` [RF18]

---

## Notas de Implementação

### RF4 Considerações Especiais
1. **Campos de Foto (RF4)**: Os campos `photoProcessingStatus`, `photoQualityScores`, `processingJobId` e `flatLayMetadata` são específicos do pipeline de padronização de fotos flat lay (Rembg + OpenCV + Cloudinary + Canvas 2D)
2. **Deduplicação**: Usar `imageHash` para evitar múltiplas cópias da mesma foto
3. **Processamento Assíncrono**: As fotos são processadas em background; o campo `photoProcessingStatus` rastreia o progresso
4. **Fallback**: Se o processamento falhar, a peça é salva com a foto original em `imageUrl`

### RF5 Considerações Especiais
1. **Aninhamento**: `SchemeItem`, `SchemeBackground` e `AIAssistance` são subdocumentos (não coleções separadas)
2. **Imutabilidade de Items**: Uma vez adicionada uma peça ao look, seu referencial não muda (mesmo que a peça seja editada depois)
3. **Remixagem (RF19)**: Ao remixar, cria-se um novo Scheme com `is_remixed_from` apontando para o original
4. **Visibilidade Herdada**: Ao salvar, se o usuário não especificar visibilidade, herda do perfil

### Integração entre RF4 e RF5
1. RF5 só mostra peças com `availability_status = AVAILABLE` e `photoProcessingStatus = COMPLETED`
2. Peças com `photoProcessingStatus = FAILED` aparecem com aviso visual em RF6 (Guarda-roupa)
3. O campo `sex` da peça é usado para filtrar opções no Provador 2D (RF18)

---

**Última atualização**: 2026-09-18  
**Versão do Diagrama**: RF4-classes.pdf, RF5-classes.pdf  
**Status**: ✅ Completo (baseado em análise dos diagramas de classes)
