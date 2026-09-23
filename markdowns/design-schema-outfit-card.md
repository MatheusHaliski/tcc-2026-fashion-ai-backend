# Design Schema — Outfit Card

> **Projeto:** SAI · TCC 2026  
> **Última atualização:** 2026-05-27  
> **Arquivo principal:** `app/lib/outfit-card.ts`  
> **Componente principal:** `app/components/outfit-card/OutfitCard.tsx`

---

## 1. Visão Geral

O **Outfit Card** é o artefato visual central do SAI. Representa uma composição de moda completa — denominada *esquema* — composta por múltiplas peças curadas, imagem hero, identidade visual de fundo customizável e metadados editoriais. Suporta sete variações visuais (*skins*) e dois modos de layout (`default` / `compact`).

---

## 2. Schema de Dados — `OutfitCardData`

```ts
// app/lib/outfit-card.ts
type OutfitCardData = {
  outfitName: string;               // Nome do esquema (título principal)
  outfitStyleLine: string;          // Linha editorial (ex: "casual urbano")
  outfitDescription?: string;       // Descrição textual; gerada automaticamente se omitida
  heroImageUrl: string;             // URL da imagem hero do esquema
  outfitBackground?: OutfitBackgroundConfig | LegacyBackgroundConfig;
  metaBadges?: OutfitMetaBadge[];   // Badges de metadados livres
  brands?: string[];                // Lista de marcas presentes no esquema
  pieces: OutfitPiece[];            // Lista de peças que compõem o esquema
  schemeId?: string;                // ID persistido no Firestore
  creatorId?: string;               // UID do criador
  creatorName?: string;             // Nome de exibição do criador
  titleFontFamily?: string;         // Família tipográfica customizada do título
  score?: number;                   // Pontuação editorial (0–10)
  cardSkin?: CardSkinId;            // Variação visual ativa
};
```

### 2.1 Tipo `OutfitMetaBadge`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `label` | `string` | Texto do badge |
| `icon` | `string?` | Emoji ou URL de ícone |

---

## 3. Schema da Peça — `OutfitPiece`

Cada peça dentro de um Outfit Card é descrita pelo tipo `OutfitPiece`:

```ts
type OutfitPiece = {
  id: string;                   // ID único da peça
  wardrobeItemId?: string;      // Referência ao item no guarda-roupa do usuário
  name: string;                 // Nome da peça
  brand: string;                // Marca da peça
  brandLogoUrl?: string;        // URL do logo da marca (opcional)
  pieceType: string;            // Tipo de peça (ex: jacket, pants, shoes)
  pieceTypeIconUrl?: string;    // URL do ícone do tipo (opcional)
  category?: PieceCategory;     // Categoria de raridade
  wearstyles?: string[];        // Estilos de uso (máx. 3 exibidos)
  baseQuality?: number;         // Qualidade-base 0–5 (default por tier)
  likes?: number;               // Contagem de curtidas da comunidade
};
```

### 3.1 Enum `PieceCategory`

| Valor | Qualidade Padrão | Cor de Tema | Badge Fallback |
|-------|-----------------|-------------|----------------|
| `Standard` | 2.5 | Slate | ✨ |
| `Premium` | 3.5 | Âmbar/Dourado | 💎 |
| `Limited Edition` | 3.2 | Violeta | 🪄 |
| `Rare` | 3.0 | Ciano | ⭐ |

> Os valores padrão de `baseQuality` são aplicados via migration `migrations/20260527-piece-base-quality.ts`.

---

## 4. Schema de Fundo — `OutfitBackgroundConfig`

O fundo do card é totalmente customizável através de três modos principais e camadas de textura/forma sobrepostas.

```ts
type OutfitBackgroundMode = 'solid' | 'gradient' | 'ai_artwork';

type OutfitBackgroundConfig = {
  background_mode: OutfitBackgroundMode;
  solid_color?: string;          // Hex color (modo solid)
  opacity?: number;

  gradient?: {
    type: 'linear' | 'radial' | 'conic';
    angle?: number;              // Graus (padrão: 135)
    intensity?: number;          // 20–120, normalizado como saturate()
    stops: Array<{
      color: string;             // Hex color
      position: number;          // 0–100 (%)
    }>;
  };

  ai_artwork?: {
    prompt: string;
    style?: string;
    mood?: string;
    palette?: string;
    image_url?: string;
    generation_status?: 'idle' | 'loading' | 'done' | 'failed';
  };

  texture_overlay?: boolean;

  materialLayer?: {
    type: BackgroundMaterialType;  // 'none' | 'embroidered_fabric' | 'lego_material' | 'glass_material' | 'water_material'
    color?: string;
    density?: number;
    threadDirection?: 'diagonal' | 'cross' | 'horizontal' | 'vertical';
    threadThickness?: number;
    embossIntensity?: number;
    surfaceContrast?: number;
    finish?: 'matte' | 'satin';
    scope?: 'card' | 'hero_block' | 'content_block';
    premium?: boolean;
  };

  decorativeOverlayLayer?: {
    stitchBorder?: boolean;
    stitchColor?: string;
    opacity?: number;
  };

  shape?: ShapeOverlay;          // Padrão geométrico sobreposto
  studioStyleConfig?: BackgroundStudioStyleConfig;
};
```

### 4.1 Modos de Fundo

| Modo | Descrição | CSS Gerado |
|------|-----------|-----------|
| `solid` | Cor sólida única | `background: <color>` |
| `gradient` | Gradiente linear, radial ou cônico | `backgroundImage: <gradient>` + `filter: saturate()` |
| `ai_artwork` | Imagem gerada por IA | `backgroundImage: url(...)` + cover/center |

**Fallback padrão** (quando `outfitBackground` é omitido):
```
Gradiente linear 145° · #0f172a → #312e81
```

### 4.2 Formas de Overlay (`shape`)

| Valor | Visual |
|-------|--------|
| `none` | Sem overlay |
| `orb` | Orbs radiais coloridos (indigo/ciano/rosa) |
| `diamond` | Grade de losangos em SVG |
| `mesh` | Grade cruzada com nós circulares |
| `stars` | Estrelas poligonais repetidas |
| `circles` | Círculos concêntricos estilo alvo |
| `triangles` | Triângulos sobrepostos |
| `waves` | Linhas onduladas horizontais |
| `beams` | Feixes diagonais em degradê |
| `flowers` | Padrão floral octopétalo |
| `arrows` | Padrão de setas em zigzag |

### 4.3 Background Studio — `BackgroundStudioStyleConfig`

```ts
type BackgroundStudioStyleConfig = {
  presetId?: string | null;
  family?: 'pattern_surface' | 'minimal_luxury' | 'editorial_branding' | 'geometry' | 'custom';
  styleMode?: string | null;
  material?: string | null;
  paletteMode?: string | null;
  gradient?: { colors: string[]; angle?: number } | null;
  overlays?: Array<{
    type: 'monogram' | 'glass_reflection' | 'linework' | 'glow' | 'gradient_sweep';
    opacity?: number;
    density?: string;
    blendMode?: string;
  }>;
  referenceImageUrl?: string | null;
  shapeMode?: string | null;
  metadata?: Record<string, unknown>;
};
```

---

## 5. Skins (Variações Visuais)

O Outfit Card suporta sete skins intercambiáveis registradas em `app/components/outfit-card/skins/skinRegistry.ts`.

| `CardSkinId` | Label PT | Descrição Visual | Base Background |
|-------------|----------|-----------------|-----------------|
| `atelier` | Atelier | Minimalismo refinado, tipografia limpa | `bg-white` |
| `spread` | Spread | Editorial de revista, drop-cap, título empilhado | `bg-neutral-50` |
| `index` | Índice | Cartão de referência com data rows pontilhadas | `bg-white` + borda cinza |
| `trading` | Trading | Card colecionável estilo trading card, moldura dupla | `bg-neutral-900` |
| `fai_max` | FAI Max | Maximalista laranja, identidade FAI | Customizável |
| `stub` | Stub | Variante de esboço/rascunho | — |
| `specimen` | Specimen | Variante de espécime/arquivo | — |

### 5.1 Props Compartilhadas dos Skins

```ts
interface SkinProps {
  data: OutfitCardData;
  showHero?: boolean;   // Exibe/oculta a imagem hero (padrão: true)
}
```

### 5.2 Campos Utilizados por Skin

| Campo | atelier | spread | index | trading | fai_max |
|-------|:-------:|:------:|:-----:|:-------:|:-------:|
| `outfitName` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `outfitStyleLine` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `outfitDescription` | ✓ | ✓ | — | — | — |
| `heroImageUrl` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `creatorName` | ✓ | ✓ | ✓ | ✓ | — |
| `brands` | ✓ | ✓ | ✓ | ✓ | — |
| `pieces` | ✓ (4) | ✓ (3) | ✓ (5) | ✓ (4) | — |
| `score` | ✓ | ✓ | ✓ | ✓ | — |
| `schemeId` | — | — | ✓ | ✓ | — |

---

## 6. Componente `OutfitCard` — Props

```ts
interface GeneratedOutfitCardProps {
  data: OutfitCardData;
  variant?: 'default' | 'compact';
  actions?: Array<{
    label: string;
    onClick?: () => void;
    tone?: 'default' | 'danger' | 'accent';
  }>;
  onOpenInDressTester?: (wardrobeItemId: string) => void;
}
```

### 6.1 Dimensões por Variante

| Variante | Largura Canvas (Textura) | Altura Canvas | Hero | Padding |
|----------|------------------------|---------------|------|---------|
| `default` | 820px | 980px | `h-44` | `p-3 sm:p-4` |
| `compact` | 540px | 700px | `h-24` | `p-2.5` |

---

## 7. Subcomponentes

| Componente | Arquivo | Responsabilidade |
|-----------|---------|-----------------|
| `OutfitHeroImage` | `outfit-card/OutfitHeroImage.tsx` | Imagem hero com alt text |
| `OutfitHeader` | `outfit-card/OutfitHeader.tsx` | Título, style line, descrição, badges, brand badges |
| `OutfitPieceList` | `outfit-card/OutfitPieceList.tsx` | Grid de peças com layout responsivo |
| `OutfitPieceCard` | `outfit-card/OutfitPieceCard.tsx` | Card individual de peça (cyan/teal) |
| `OutfitMetaBadge` | `outfit-card/OutfitMetaBadge.tsx` | Badges de metadados livres |
| `BrandBadge` | `outfit-card/BrandBadge.tsx` | Exibição de marca com logo ou iniciais |
| `SemanticGlowBadge` | `outfit-card/SemanticGlowBadge.tsx` | Badge com gradiente semântico e glow |
| `VisualToken` | `outfit-card/VisualToken.tsx` | Token visual para categoria/raridade/wearstyle |
| `WearstyleChips` | `outfit-card/WearstyleChips.tsx` | Chips de estilo de uso |
| `CollapsibleOutfitCard` | `outfit-card/CollapsibleOutfitCard.tsx` | Wrapper colapsável com action bar |

---

## 8. Sistema de Tokens Semânticos

Definido em `app/lib/semantic-badge-tokens.ts`. Cada token é um objeto `SemanticTone`:

```ts
type SemanticTone = {
  gradient: string;    // CSS linear-gradient com rgba
  border: string;      // Classe Tailwind de borda (ex: 'border-white/30')
  glow: string;        // Classe Tailwind de box-shadow
  text: string;        // Classe Tailwind de cor de texto (ex: 'text-white')
};
```

### 8.1 Mapa de Wearstyles — `WEARSTYLE_TONE_MAP`

| Wearstyle | Gradiente Principal | Glow |
|-----------|--------------------|----|
| `statement piece` | Âmbar/Dourado (120°) | `rgba(251,191,36,0.35)` 24px |
| `visual anchor` | Roxo profundo → Violeta (120°) | `rgba(167,139,250,0.34)` 24px |
| `street energy` | Rosa quente (120°) | `rgba(244,114,182,0.33)` 24px |
| `style accent` | Ciano → Azul (120°) | `rgba(34,211,238,0.33)` 24px |
| `quiet luxury` | Slate escuro → Branco suave (120°) | `rgba(203,213,225,0.25)` 24px |
| `minimal core` | Branco/Slate suave (120°) | `rgba(226,232,240,0.28)` 20px |
| `sport utility` | Verde lima → Teal (120°) | `rgba(45,212,191,0.33)` 24px |
| `creative layering` | Laranja → Roxo (120°) | `rgba(251,146,60,0.35)` 24px |

### 8.2 Mapa de Raridade — `RARITY_TONE_MAP`

| Categoria | Gradiente | Glow |
|-----------|-----------|------|
| `premium` | Marrom/Ouro | `rgba(251,191,36,0.36)` 26px |
| `standard` | Slate médio | `rgba(148,163,184,0.32)` 22px |
| `limited edition` | Roxo → Âmbar leve | `rgba(168,85,247,0.35)` 26px |
| `rare` | Ciano profundo | `rgba(34,211,238,0.35)` 24px |

### 8.3 Mapa de Tipo de Peça — `PIECE_TYPE_TONE_MAP`

| Tipo | Gradiente | Glow |
|------|-----------|------|
| `jacket` | Âmbar quente | 22px amarelo |
| `pants` | Vermelho/Rosa | 22px rosa |
| `footwear` | Rosa → Violeta | 18px rosa |
| `accessory` | Dourado quente | 18px âmbar |
| `top` | Teal/Ciano | 18px ciano |
| `bottom` | Azul profundo | 18px azul |
| `outerwear` | Roxo/Dark slate | 18px violeta |
| `bag` | Laranja suave | 18px laranja |

### 8.4 Resolução de Tom — `resolveSemanticTone()`

Busca no mapa por correspondência exata → correspondência parcial → fallback gerado por hash HSL da string:
```
hueA = charCodeSum % 360
hueB = (charCodeSum + 80) % 360
gradient: hsla(hueA, 70%, 60%, 0.35) → hsla(hueB, 70%, 52%, 0.24)
```

---

## 9. Sistema de Inferência de Wearstyle

Quando `wearstyles` não é fornecido, `inferWearstylesByPieceType(pieceType)` aplica fallbacks por tipo:

| Tipos correspondentes | Wearstyles inferidos |
|----------------------|---------------------|
| jacket, coat, blazer | Statement Piece, Visual Anchor |
| hoodie, sweatshirt, sweater | Street Core, Balanced Fit |
| shirt, tee, top, blouse | Visual Anchor, Balanced Fit |
| dress | Visual Highlight, Statement Piece |
| pants, trouser, jeans, skirt, shorts | Base Structure, Balanced Fit |
| shoes, boots, sneakers, heels, loafers | Trend Driver, Street Energy |
| accessory, bag, watch, belt, hat | Style Accent, Attention Grabber |

---

## 10. Resolução de Logo de Marca

`resolveBrandLogoUrlByName(brandName)` mapeia nomes de marca para assets locais em `/public/`:

| Marca | Asset |
|-------|-------|
| adidas | `/adidas.png` |
| nike | `/nike.png` |
| zara | `/zara.jpg` |
| puma | `/puma.jpg` |
| lacoste | `/lacoste.jpg` |
| levis | `/levis.jpg` |
| c&a / cea | `/cea.jpg` |

---

## 11. Geração de Descrição

Dois mecanismos de fallback constroem a descrição quando `outfitDescription` é omitido:

### `buildOutfitDescriptionFallback({ pieces, outfitStyleLine, outfitName })`
Prioridade: wearstyle dominante → style line com ≥3 peças → name + style line → style line solo → hash estático.

### `buildOutfitDescriptionRich(input)`
Usa 6 templates com seed determinístico gerado pelo hash dos IDs das peças + metadados. Templates combinam `mood`, `palette`, `occasion`, `styleLine` e `heroPiece`.

---

## 12. Tokens de UI — Glass Morphism

Definidos em `app/lib/uiToken.ts`:

| Token | Classe Tailwind | Descrição |
|-------|----------------|-----------|
| `GLASS` | `border border-white/20 bg-white/10` | Glass básico |
| `GLASS_DEEP` | `border border-white/18 bg-white/8 backdrop-blur-2xl` | Glass profundo |
| `CARD_GLASS` | `rounded-3xl border border-white/14 bg-white/[0.08] backdrop-blur-2xl shadow-[0_18px_60px_rgba(0,0,0,0.30)]` | Glass de card |
| `GLASS_PANEL` | `relative rounded-3xl border border-white/15 bg-white/[0.08] backdrop-blur-2xl shadow-[0_18px_60px_rgba(0,0,0,0.35)]` | Painel glass |
| `GLOW_LINE` | Pseudo-elemento `after`, gradiente ciano/teal/esmeralda blur | Linha de glow inferior |
| `TEXT_GLOW` | `text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.25)]` | Glow em texto |

---

## 13. Ícones Fallback de Tipo de Peça

```
jacket → 🧥    shirt/top → 👕    pants/trouser → 👖
shoes/footwear → 👟    accessory/bag → 👜    watch → ⌚
(padrão) → 👗
```

---

## 14. Fluxo de Renderização

```
OutfitCardData
      │
      ▼
resolveOutfitBackgroundForRender()
      │ (normaliza formato legado → OutfitBackgroundConfig)
      ▼
buildBackgroundCssStyle()
      │ (gera CSS style object)
      ▼
renderFabricTextureToCanvas() [se materialLayer presente]
      │ (canvas 2D → dataURL)
      ▼
OutfitCard (section)
  ├── [materialLayer texture div] z-0
  ├── [shapeOverlay div]          z-0
  ├── [decorativeOverlay div]     z-0
  └── [content div]               z-1
        ├── OutfitHeroImage
        ├── OutfitHeader
        │     ├── título + styleLine
        │     ├── descrição
        │     ├── OutfitMetaBadge[]
        │     └── BrandBadge[]
        ├── OutfitPieceList
        │     └── OutfitPieceCard[] (grid)
        └── CompactCardActionBar [se actions.length > 0]
```
