# Design Schema — Piece Card

> **Projeto:** SAI · TCC 2026  
> **Última atualização:** 2026-05-27  
> **Componentes principais:**  
> - `app/components/wardrobe/PieceIdentityCard.tsx`  
> - `app/components/pieces/PieceDiscoveryCard.tsx`

---

## 1. Visão Geral

O **Piece Card** existe em duas variantes com propósitos distintos:

| Variante | Componente | Contexto de uso |
|----------|-----------|----------------|
| **Identity Card** | `PieceIdentityCard` | Guarda-roupa pessoal — detalhe completo gamificado da peça |
| **Discovery Card** | `PieceDiscoveryCard` | Feed de descoberta — apresentação rápida com abertura de detalhe |

Ambas compartilham o modelo de dados de peça, mas diferem radicalmente em densidade de informação, sistema visual e interatividade.

---

## 2. Schema de Dados — `PieceCardItem` (Identity Card)

```ts
// app/components/wardrobe/PieceIdentityCard.tsx
interface PieceCardItem {
  wardrobe_item_id: string;        // ID do item no guarda-roupa (usado como identificador único)
  name: string;                    // Nome da peça
  brand: string;                   // Marca
  piece_type: string;              // Tipo de peça (ex: jacket, pants, shoes)
  color?: string;                  // Cor principal
  material?: string;               // Material (ex: algodão, couro)
  style_tags?: string[];           // Tags de estilo (abilities)
  occasion_tags?: string[];        // Tags de ocasião (trabalho, casual, balada…)
  is_favorite?: boolean;           // Marcada como favorita pelo usuário
  image_url: string;               // URL da imagem principal
  isolated_piece_image_url?: string | null;  // Imagem isolada (fundo removido)
  image_assets?: {
    raw_upload_image_url?: string | null;       // Upload original
    normalized_2d_preview_url?: string | null;  // Preview normalizado 2D
    approved_catalog_2d_url?: string | null;    // Asset aprovado para catálogo
  };
}
```

### 2.1 Schema de Dados — `DiscoverablePiece` (Discovery Card)

```ts
// app/components/pieces/PieceDiscoveryCard.tsx
interface DiscoverablePiece {
  wardrobe_item_id: string;
  user_id: string;
  creator_name: string;
  name: string;
  image_url: string;
  piece_type: string;
  brand: string;
  color: string;
  material: string;
  rarity: string;               // Texto livre de raridade
  wearstyles: string[];
  style_tags: string[];
  occasion_tags: string[];
  season: string;               // Estação (ex: "Verão", "Inverno")
  gender: string;               // Gênero da peça
  model_3d_url?: string | null;           // URL do modelo 3D (GLTF/GLB)
  model_preview_url?: string | null;      // Preview do modelo 3D
  model_base_3d_url?: string | null;      // Modelo base sem branding
  model_branded_3d_url?: string | null;   // Modelo com aplicação de marca
  description?: string;
}
```

---

## 3. Sistema de Categoria e Progressão

### 3.1 Enum `PieceCategory`

```ts
type PieceCategory = 'Standard' | 'Premium' | 'Limited Edition' | 'Rare';
```

### 3.2 Derivação de Categoria — `deriveCategory()`

A categoria é derivada automaticamente a partir do comportamento de uso:

| Condição | Categoria resultante |
|----------|---------------------|
| `wearCount >= 30` ou (`isFavorite` + `wearCount >= 20` + `style_tags.length >= 3`) | **Rare** |
| `wearCount >= 15` | **Limited Edition** |
| `wearCount >= 5` ou (`isFavorite` + `wearCount >= 3`) | **Premium** |
| (padrão) | **Standard** |

### 3.3 Sistema de XP — Progressão de Tier

```ts
const XP_THRESHOLDS: Record<PieceCategory, number> = {
  Standard: 5,
  Premium: 15,
  'Limited Edition': 30,
  Rare: 50,
};

// Sequência de progressão
Standard → Premium → Limited Edition → Rare → MAX TIER
```

A barra de XP é renderizada como `width: (wearCount / xpNeeded) * 100%` com gradiente do `RARITY_TONE_MAP` da categoria atual.

---

## 4. Design Visual — `PieceIdentityCard`

### 4.1 Estrutura do Card

```
┌────────────────────────────────────────┐
│  HEADER: [CATEGORIA] [SAI-XXXX] [TIPO] │  ← bg-neutral-900, border-b
├────────────────────────────────────────┤
│                                        │
│         CARD ART (aspect 3:4)          │  ← bg rarity gradient (opacity 0.18)
│         Imagem da peça (object-contain)│
│         [Rare: inner cyan glow]        │
│                                        │
├────────────────────────────────────────┤
│  NOME                                  │  ← text-15px font-black text-white
│  marca · cor · material                │  ← mono 9px text-neutral-500
├────────────────────────────────────────┤
│  — Atributos —                         │
│  Versatility  ████░ 4/5               │
│  Style Power  ███░░ 3/5               │
│  Presence     ██░░░ 2/5               │
│  AI Affinity  ███░░ 3/5               │
├────────────────────────────────────────┤
│  — Abilities —  (style_tags)           │  ← VisualToken chips
├────────────────────────────────────────┤
│  — Ocasiões —  (occasion_tags)         │  ← emoji + tag chips
├────────────────────────────────────────┤
│  ⚡ N usos   N/threshold → NextTier    │
│  [████░░░░░░░░░░░░░░░░] XP bar         │
│  [🏆 Veteran] [⭐ Star] [🎯 Versatile] │
├────────────────────────────────────────┤
│  — Community —                         │
│  👥 N owners  ❤️ N curtidas  ⭐ X.X(N)  │
│  [♡ Curtir]  [★★★★☆ Avaliar]           │
├────────────────────────────────────────┤
│  SAI · Piece Identity Card · XXXXXXXX  │  ← mono 8px text-neutral-700
└────────────────────────────────────────┘
```

### 4.2 Dimensões e Tipografia

| Propriedade | Valor |
|------------|-------|
| Largura máxima | `max-w-[340px]` |
| Border radius | `rounded-2xl` |
| Fundo base | `bg-neutral-950` |
| Fonte base | `Inter, "Segoe UI", Arial, sans-serif` |
| Aspect ratio da imagem | `3/4` |

### 4.3 Estilos por Categoria

| Categoria | Borda do Card | Glow Externo | Label | ID |
|-----------|:-------------:|:------------:|:-----:|:--:|
| `Standard` | `border-slate-500/60` | — | `text-slate-400 border-slate-600` | SAI-XXXX |
| `Premium` | `border-amber-500/70` | `shadow-[0_0_28px_rgba(251,191,36,0.28)]` | `text-amber-400 border-amber-700` | SAI-XXXX |
| `Limited Edition` | `border-purple-500/70` | `shadow-[0_0_28px_rgba(168,85,247,0.32)]` | `text-purple-400 border-purple-700` | SAI-XXXX |
| `Rare` | `border-cyan-400/80` | `shadow-[0_0_32px_rgba(34,211,238,0.38)]` | `text-cyan-400 border-cyan-700` | SAI-XXXX |

**Efeito inner glow na imagem (Rare):** `inset 0 0 24px rgba(34,211,238,0.18)`  
**Efeito inner glow na imagem (Limited Edition):** `inset 0 0 24px rgba(168,85,247,0.18)`

---

## 5. Sistema de Atributos — `deriveAttributes()`

Os 4 atributos são derivados dos dados disponíveis da peça (escala 0–5):

| Atributo | Fonte | Cálculo |
|----------|-------|---------|
| `Versatility` | `occasion_tags.length` | `min(5, occasion_tags.length)` |
| `Style Power` | `style_tags.length` | `min(5, style_tags.length)` |
| `Presence` | `category` → `deriveCategory()` | Standard=1, Premium=2, LimitedEd=3, Rare=4 |
| `AI Affinity` | `aiAffinity` (0–1) | `round(min(5, aiAffinity * 5))` (padrão: 0.5 → 2/3) |

> **TODO pendente:** `aiAffinity` será alimentado por `OutfitPreferences.piece_weights`. `wearCount` será alimentado pela API de DailyLooks.

---

## 6. Sistema de Conquistas — Achievements

Badges desbloqueadas dinamicamente conforme o estado da peça:

| Ícone | Label | Condição |
|-------|-------|----------|
| 🏆 | Veteran | `wearCount >= 10` |
| ⭐ | Collection Star | `is_favorite === true` |
| 🎯 | Versatile | `occasion_tags.length >= 3` |
| ❤️ | Liked | `stats.user_has_liked === true` |

---

## 7. Dados de Comunidade — `PieceStats`

```ts
interface PieceStats {
  like_count: number;          // Total de curtidas
  avg_rating: number;          // Média de avaliações (0–5)
  rating_count: number;        // Quantidade de avaliações
  owner_count: number;         // Usuários que possuem a peça
  user_has_liked: boolean;     // O usuário atual curtiu?
  user_rating: number | null;  // Nota do usuário atual (1–5 stars)
}
```

**Endpoint de leitura:** `GET /api/piece-stats/:wardrobe_item_id[?userId=…]`  
**Endpoint de like:** `POST /api/piece-likes/:wardrobe_item_id` — `{ userId, liked: boolean }`  
**Endpoint de rating:** `POST /api/piece-ratings/:wardrobe_item_id` — `{ userId, stars: 1-5 }`

### 7.1 Comportamento do Like Button

| Estado | Visual |
|--------|--------|
| Não curtido (hover) | `border-neutral-700 bg-neutral-800/60 text-neutral-400` |
| Não curtido (hover) | Transição para `hover:border-rose-600/50 hover:text-rose-400` |
| Curtido | `border-rose-500/60 bg-rose-950/40 text-rose-400` |

Usa optimistic update com rollback em caso de erro.

---

## 8. Identificador de Peça — `pieceId`

Gerado como `SAI-` + 4 últimos caracteres do `wardrobe_item_id` em maiúsculas:
```ts
const pieceId = `SAI-${item.wardrobe_item_id.slice(-4).toUpperCase()}`;
// ex: "SAI-A3F2"
```

---

## 9. Resolução de Imagem 2D — `getBest2DAssetForWardrobeItem()`

Hierarquia de seleção do asset de imagem:

```
1. image_assets.approved_catalog_2d_url
2. image_assets.normalized_2d_preview_url
3. isolated_piece_image_url
4. image_assets.raw_upload_image_url
5. image_url (fallback final)
```

---

## 10. Design Visual — `PieceDiscoveryCard`

### 10.1 Estrutura do Card

```
┌────────────────────────────────────────┐
│  [Imagem h-44, object-cover]           │
│                       [3D Ready badge] │  ← visível se has3D
├────────────────────────────────────────┤
│  Nome da Peça                          │  ← text-base font-semibold text-white
│  Marca • Tipo                          │  ← text-xs text-white/75
│  Raridade • Creator Name               │  ← text-xs text-fuchsia-200/85
│  [wearstyle] [wearstyle] [wearstyle]  │  ← chips border-white/25 (máx. 3)
└────────────────────────────────────────┘
```

### 10.2 Estilos do Card

| Propriedade | Valor |
|------------|-------|
| Border radius | `rounded-2xl` |
| Background | `bg-white/10` (glassmorphism) |
| Borda padrão | `border border-white/20` |
| Borda hover | `hover:border-cyan-300/60` |
| Shadow | `shadow-[0_12px_30px_rgba(0,0,0,0.25)]` |
| Backdrop blur | `backdrop-blur-md` |
| Hover transform | `hover:-translate-y-1` |

### 10.3 Badge "3D Ready"

Exibido quando `model_3d_url || model_base_3d_url || model_branded_3d_url` está presente:
- Estilo: `rounded-full border border-cyan-200/60 bg-cyan-500/25 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-cyan-100`
- Posição: `absolute right-2 top-2`

---

## 11. Tokens de Ícone por Ocasião

```ts
const OCCASION_ICONS: Record<string, string> = {
  trabalho: '💼',
  casual:   '👕',
  balada:   '🎉',
  academia: '🏋️',
  evento:   '✨',
};
// Padrão para ocasiões não mapeadas: '📌'
```

---

## 12. Integração com `VisualToken`

O `PieceIdentityCard` usa `VisualToken` (de `app/components/outfit-card/VisualToken.tsx`) para renderizar os `style_tags` como abilities:

```tsx
<VisualToken type="wearstyle" value={tag} compact />
```

O token resolve o tom via `resolveSemanticTone(tag, WEARSTYLE_TONE_MAP)` e aplica gradiente + glow inline.

---

## 13. Relação Entre os Dois Cards

```
DiscoverablePiece (feed público)
        │
        │ onOpen(piece) → Modal / rota de detalhe
        ▼
PieceCardItem (guarda-roupa pessoal)
        │
        │ enriquecido com: stats, ratings, achievements, XP
        ▼
PieceIdentityCard (visão completa)
```

O `DiscoverablePiece` é o subset público de dados. O `PieceCardItem` é o modelo interno com acesso a assets, favoritos e metadados completos.

---

## 14. Comparativo: Identity Card vs Discovery Card

| Aspecto | Identity Card | Discovery Card |
|---------|:-------------:|:--------------:|
| Fundo | `bg-neutral-950` (escuro) | `bg-white/10` (glass) |
| Tema de cor | Dinâmico por categoria | Cyan/White fixo |
| Tamanho imagem | Aspect 3:4, `object-contain` | h-44, `object-cover` |
| Atributos | ✓ (4 barras) | — |
| Comunidade | ✓ (likes + rating) | — |
| Progressão XP | ✓ | — |
| Conquistas | ✓ | — |
| Badge 3D | — | ✓ |
| Interativo | ✓ (curtir, avaliar) | ✓ (click → open) |
| Densidade | Alta | Baixa |
| Largura | max 340px | Responsivo (grid) |
