# HU-RF5 – Criar Esquema de Vestimenta (Look)

**Como**: usuário autenticado no sistema  
**Posso**: criar um esquema de vestimenta selecionando peças do meu guarda-roupa na aba "Criar Look"  
**Para**: montar combinações de roupa personalizadas de acordo com meu estilo

---

## 📋 Campos de Esquema & Composição Visual

### **CAMPOS DO FORMULÁRIO (Entrada do Usuário)**

**Identificação e Contextualização:**
- `title` (string, obrigatório) – Nome do look (ex: "Look de trabalho elegante")
- `description` (string, opcional) – Descrição ou contexto
- `occasion` (string[], obrigatório, máx 3) – Ocasião(ões) do esquema (casual, work, business, formal, party, night_out, date, wedding, ceremony, sport, gym, travel, beach, vacation, school, university, social, home, outdoor, festival) [IA a partir das peças ou edição manual - valores ranqueados/sintetizados]
- `style` (string[], obrigatório, máx 3) – Estilo(s) do esquema (classic, minimalist, modern, chic, streetwear, sporty, athleisure, preppy, romantic, boho, vintage, grunge, edgy, glam, luxury, avant_garde, y2k, utility, techwear, tailored, urban, resort, basic, statement, futuristic) [IA a partir das peças ou edição manual - valores ranqueados/sintetizados]
- `season` (string, opcional) – Estação (primavera, verão, outono, inverno)
- `mood` (string, opcional) – Clima/humor (energético, elegante, confortável, sofisticado)

**Composição Visual:**
- `backgroundColor` (string, obrigatório) – Cor de fundo (hex #RRGGBB ou nome: white, black, navy, etc.)
- `backgroundGradient` (string, opcional) – Gradiente CSS (ex: "linear-gradient(45deg, #fff 0%, #000 100%)")
- `backgroundImageUrl` (URL, opcional - NOVO RF11) – Imagem de fundo (upload ou URL)
- `displayMode` (string, obrigatório) – Modo de visualização (CAROUSEL, GRID, STACKED)

**Itens do Look (SchemeItem):**
- `items` (array de SchemeItem, obrigatório ≥1) – Peças que compõem o look:
  ```
  [{
    wardrobeItemId: UUID,
    slot: "TOP" | "BOTTOM" | "SHOES" | "ACCESSORIES",
    zIndex: number,
    positionX: float (0-100%),
    positionY: float (0-100%),
    scale: float (0.5-2.0),
    rotation: float (0-360°),
    opacity: float (0-1),
    filters: {
      blur: float (0-100),
      saturation: float (-100 to 100),
      brightness: float (-100 to 100),
      contrast: float (-100 to 100),
      hue_shift: float (0-360)
    }
  }, ...]
  ```

**Estado e Publicação:**
- `visibility` (enum, obrigatório) – Visibilidade (PRIVATE, FOLLOWERS, PUBLIC) [herdado do perfil se não especificado]
- `status` (enum) – Estado (DRAFT, PUBLISHED, ARCHIVED)

### **CAMPOS DO SISTEMA (Gerenciados Automaticamente)**

**Identificação e Rastreamento:**
- `id` (UUID) – Identificador único
- `userId` (UUID) – ID do proprietário (FK → User)
- `createdAt` (timestamp) – Data/hora de criação
- `updatedAt` (timestamp) – Data/hora da última atualização
- `publishedAt` (timestamp) – Data/hora da publicação (derivado, preenchido ao publicar)

**Geração com IA (RF24 + RF5):**
- `creationMode` (enum) – Como foi criado (MANUAL, AI_ASSISTED)
- `aiAssistance` (subconstruto, opcional) – Dados da IA:
  - `userDescription`: String (prompt do usuário)
  - `suggestedItems`: SchemeItem[] (itens sugeridos)
  - `confidenceScores`: Float[] (confiança por item)
  - `generationAttempts`: Integer (tentativas)

### **CAMPOS DE RENDERIZAÇÃO 2D (RF18 - Provador Virtual - NOVO)**

- `renderingStatus` (enum) – Status de renderização:
  - PENDING (aguardando fila)
  - RENDERING (em processamento Fashn.ai)
  - ENHANCING (limpeza com Cleanup.ai)
  - COMPOSITING (composição no Canvas 2D)
  - COMPLETED (sucesso)
  - FAILED (erro)

- `virtualTryOnUrl` (URL, opcional) – Link da renderização do provador 2D

- `renderingJobId` (UUID, opcional) – FK → OutfitRenderJob (histórico)

- `renderingQuality` (JSON, opcional) – Métricas de qualidade:
  ```
  {
    overall_score: float (0-1),
    dimensions: {width: integer, height: integer},
    colors_matched: float (0-1),
    fabric_realism: float (0-1),
    composition_score: float (0-1)
  }
  ```

- `cachedUntil` (timestamp, opcional) – Até quando está em cache (TTL 1h)

- `renderingMetadata` (JSON, opcional) – Metadados de renderização:
  ```
  {
    model_type: string (manequim 2D type),
    rendering_provider: string (Fashn.ai | Custom),
    total_processing_time_ms: integer,
    cost_usd: float,
    stages_completed: string[]
  }
  ```

### **CAMPOS DE ENGAJAMENTO & MONITORAMENTO**

- `likes` (integer) – Contagem de curtidas (atualizado por RF19)
- `shares` (integer) – Contagem de compartilhamentos
- `remixes` (integer) – Contagem de remixagens (RF19.CA16)
- `view_count` (integer) – Visualizações (monitoramento)
- `save_count` (integer) – Salvamentos (monitoramento)

- `tags` (string[]) – Hashtags e keywords de busca
- `is_remixed_from` (UUID, opcional) – FK → Scheme original se for remix (RF19.CA13)

---

## 📊 Estrutura de Persistência

### Firestore Collection Structure
```
/users/{userId}/schemes
  ├── {schemeId}
  │   ├── (campos acima)
  │   └── items (subcoleção ou array aninhado)
  │       ├── {itemId}
  │       │   ├── wardrobeItemId
  │       │   ├── slot
  │       │   ├── positionX, positionY, scale, rotation
  │       │   └── filters
  │       └── ...
  │
  └── ...

/outfitRenderJobs (coleção global para RF18)
  ├── {renderJobId}
  │   ├── schemeId
  │   ├── status, stages, results
  │   └── metadata
  └── ...

/aiAssistances (coleção global, opcional)
  └── {schemeId}
      ├── userDescription, occasion, mood
      ├── suggestedItems, confidenceScores
      └── generationAttempts
```

### MySQL Audit Table
- **Table**: `render_jobs_log` (RF18)
  - `scheme_id`, `user_id`, `rendering_type`, `status`, `total_processing_time_ms`, `stage_times`, `final_quality_score`, `total_cost`, `retry_count`, `created_at`, `completed_at`

### Redis Cache
- **Key**: `scheme:{userId}:summary` – Resumo dos looks do usuário
- **Key**: `scheme:{schemeId}:preview` – Preview renderizado [RF18]
- **Key**: `render_cache:{schemeId}:{renderType}` – Cache de renderizações
  - Value: `{renderUrl, thumbnailUrl, quality, generatedAt, accessCount, lastAccessed}`
  - **TTL**: 3600s (1 hora) [RF18]

### OpenSearch Index
- **Index**: `schemes_index`
- **Fields**: title, description, author_id, occasion_tags, style_tags, visibility, published_at, renderingQuality, virtualTryOnUrl
- **Allows**: full-text search de looks com filtros

### S3/Vercel Blob Storage
- **Path**: `/fashion-ai-assets/{userId}/schemes/{schemeId}/preview.{ext}` [RF18]
- **Path**: `/fashion-ai-assets/{userId}/schemes/{schemeId}/renders/`
- **Path**: `/fashion-ai-assets/{userId}/schemes/{schemeId}/background.{ext}`

---

## 🔄 Fluxo de Criação de Look (RF5)

### 5 Etapas (conforme HU-RF5 Product Backlog)

**Etapa 1**: Escolher modo de geração (com ou sem IA)
- Navegador visual entre as etapas 2 e 3
- Não bloqueia nenhuma opção

**Etapa 2**: Preencher prompt da IA (RF24.CA02)
- `userDescription`: String (input do usuário)
- Resultado: sugere 3 composições do acervo
- Estado: acumula em `aiAssistance`

**Etapa 3**: Preencher formulário de geração manual (Build Outfit)
- Seleção de peças por slot (TOP, BOTTOM, SHOES, etc.)
- Posicionamento visual (x, y, escala, rotação)
- Efeitos (blur, saturação, etc.)
- Estado: acumula em `items` array

**Etapa 4**: Editar arte de fundo (RF11 - Background Studio)
- 4.1: Background do esquema de vestimenta (card maior)
  - Cor, gradiente ou imagem de fundo
  - Tamanho e posição
- 4.2: Background de peças individuais (opcional)
  - Overlays de padrão ou efeito

**Etapa 5**: Visualizar preview, revisar slots e salvar
- Preview renderizado (RF18)
- Revisão de cada item
- Confirmar visibilidade
- **Persistência**: tudo aplicado APENAS ao clicar "Salvar"

### Regra Crítica (CA6)
- Etapas 2 e 3 **NÃO são excludentes**
- Usuário pode:
  1. Gerar com IA → refinar no formulário
  2. Usar formulário → pedir sugestões da IA
  3. Alternar quantas vezes quiser
- Todos os resultados **se acumulam** até salvar
- Nada é persistido até etapa 5

---

## 🎨 Campos de Posicionamento (SchemeItem)

Cada item dentro do look possui:

| Campo | Tipo | Range | Descrição |
|-------|------|-------|-----------|
| `slot` | enum | - | Posição: TOP (parte cima), BOTTOM (parte baixo), SHOES (tênis), ACCESSORIES (acessório) |
| `zIndex` | int | 0-1000 | Ordem de sobreposição (peça aparece à frente ou atrás) |
| `positionX` | float | 0-100 | Posição horizontal em % (0=esquerda, 100=direita) |
| `positionY` | float | 0-100 | Posição vertical em % (0=topo, 100=base) |
| `scale` | float | 0.5-2.0 | Tamanho da peça (0.5=metade, 2.0=dobro) |
| `rotation` | float | 0-360 | Rotação em graus |
| `opacity` | float | 0-1 | Transparência (0=invisível, 1=opaco) |
| `visibility` | enum | VISIBLE/HIDDEN | Oculta peça na composição (para testes) |

---

## ⚠️ Validações & Regras de Negócio

| Regra | Descrição | Erro |
|-------|-----------|------|
| Mínimo de peças | CA01: ≥2 peças para abrir compositor | "Você precisa de ≥2 peças" |
| Máximo de peças | Limite por slot (ex: 1 TOP, 1 BOTTOM, etc.) | "Apenas 1 peça por slot" |
| Nenhuma peça | CA06: Recusa salvar sem itens | "O look precisa de ≥1 peça" |
| Visibilidade herdada | CA03: Herda do perfil do usuário | - |
| Renderização| Processamento assíncrono (RF18) | Tempo: 3-5s |
| Cache | TTL 1h em Redis (RF18) | Melhora UX |

---

## 📝 Notas Importantes

1. **Etapas Acumulativas**: Mudanças na etapa 2 (IA) e 3 (manual) se acumulam até salvar
2. **Preview Renderizado**: Etapa 5 mostra visualização 2D do provador (RF18)
3. **Remix**: Ao remixar (RF19.CA13), `is_remixed_from` aponta para o look original
4. **Visibilidade**: PRIVATE (só você), FOLLOWERS (seguidores), PUBLIC (todos)
5. **Cache Renderização**: Uma renderização é cache por 1h; acessos subsequentes são rápidos
6. **Monitoramento**: `view_count` rastreia popularidade; `save_count` rastreia salvamentos
7. **Style & Occasion Sintetizados**: Quando a IA gera `style` e `occasion` a partir das peças inseridas, deve ranquear e sintetizar os valores. NÃO deve simplesmente concatenar todas as tags das peças quando ultrapassar o limite de 3. O esquema descreve o efeito visual/uso do *conjunto completo*, não apenas a soma de suas partes.

---

**Convenção de Área**: `[BE]` backend (Fastify) · `[DB]` Firestore · `[FE]` frontend (Next.js) · `[INT]` integração com API externa · `[IA]` inteligência artificial · `[QA]` testes/validação
