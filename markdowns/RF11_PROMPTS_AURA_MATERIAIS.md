# RF11 — Prompts de Geração: Presets AURA, Materiais e Combinações

**Projeto:** FashionAI (SAI-TCC-2026)
**Complementa:** `RF11_PROPOSTA_PRESETS_AURA_E_MATERIAIS.md`
**Formato:** segue exatamente a convenção já usada em produção em `app/backend/services/ArtworkStudioService.ts` (`STYLE_DIRECTIONS`, `PALETTE_DIRECTIONS`, `COLOR_INTENT_DIRECTIONS`) — fragmentos em inglês, concatenados por vírgula em `buildArtworkPrompt()`.

---

## 1. Como isto se encaixa no gerador já existente

Hoje `buildArtworkPrompt(input)` monta o `finalPrompt` assim:

```ts
const finalPrompt = [
  STYLE_DIRECTIONS[input.stylePreset],
  COMPOSITION_DIRECTIONS[input.compositionType],
  SHAPE_DIRECTIONS[input.shapeLanguage],
  PALETTE_DIRECTIONS[input.paletteMode],
  input.colorIntent ? COLOR_INTENT_DIRECTIONS[input.colorIntent] : null,
  safeAreaText,
  'design asset oriented output, premium fashion/editorial background utility',
  controlText,
  userPrompt,
].filter(Boolean).join(', ');
```

A proposta é adicionar **dois novos dicionários de fragmento**, no mesmo padrão:

```ts
const AURA_PRESET_DIRECTIONS: Record<AuraPresetId, string> = { /* seção 2 */ };
const MATERIAL_DIRECTIONS: Record<MaterialId, string> = { /* seção 3 */ };
```

E incluí-los no array do `finalPrompt`:

```ts
const finalPrompt = [
  STYLE_DIRECTIONS[input.stylePreset],
  input.presetAura ? AURA_PRESET_DIRECTIONS[input.presetAura] : null,
  input.material ? MATERIAL_DIRECTIONS[input.material] : null,
  COMPOSITION_DIRECTIONS[input.compositionType],
  ...
].filter(Boolean).join(', ');
```

**Isso é o que torna a combinação livre (seção 3.2 do documento principal) tecnicamente trivial**: como o preset AURA e o material são dois fragmentos independentes no mesmo array, qualquer um dos 10 presets pode se combinar com qualquer um dos 10 materiais sem precisar de um prompt escrito à mão para cada par — são **20 prompts necessários** (10 + 10), não 100. As combinações nascem da concatenação, exatamente como hoje `stylePreset` já se combina livremente com `paletteMode`.

A seção 4 traz, como referência, os 10 prompts **já compostos** (fragmento AURA + fragmento material) para os pares que a matriz de coerência recomenda como padrão — prontos para copiar/colar ou usar como teste de regressão visual.

---

## 2. Prompts necessários — Presets AURA (10 fragmentos)

| ID | Nome | Fragmento de prompt (inglês, pronto para `AURA_PRESET_DIRECTIONS`) |
|---|---|---|
| `aura_alfaiataria` | Tailored Steel | `tailored classic menswear-inspired background, cold monochrome palette from deep navy to soft steel grey, quiet-luxury studio lighting, sharp low-contrast linear gradient, refined tailored art direction` |
| `aura_editorial_mono` | Editorial Ivory | `minimalist editorial fashion background, warm-neutral monochrome palette from ivory to soft taupe, ultra-low saturation, clean campaign lighting, generous negative space for typography` |
| `aura_romantico_petala` | Petal Bloom | `romantic feminine fashion background, soft analogous warm palette from blush pink to dusty rose, radial soft-focus glow, delicate floating petal-like bokeh accents` |
| `aura_boemio_terracota` | Terracotta Dune | `bohemian fashion background, warm analogous autumn palette from burnt terracotta to golden ochre, radial sunset glow, organic desert-dune gradient movement` |
| `aura_streetwear_neon` | Concrete Neon | `urban streetwear fashion background, high-contrast complementary palette of deep asphalt grey with electric cyan and magenta neon accents, hard diagonal graphic blocks, bold contemporary street energy` |
| `aura_avantgarde_cromo` | Chrome Iridescent | `avant-garde futuristic fashion background, cool iridescent palette from deep indigo to pale lavender chrome, holographic conic gradient, high-contrast vanguard editorial lighting` |
| `aura_esportivo_performance` | Performance Pulse | `sporty athleisure fashion background, energetic complementary palette of deep petrol blue with electric sky-blue and lime accents, diagonal motion-blur beams, dynamic performance-driven composition` |
| `aura_glam_noite` | Midnight Spotlight | `evening glam red-carpet fashion background, dark monochrome palette with warm bronze-gold jewel-tone spotlight accent, radial stage-spotlight glow, dramatic high-contrast luxury lighting` |
| `aura_dark_academia` | Ivy Library | `dark academia fashion background, warm analogous palette from deep espresso brown to aged brass, muted forest-green accent, low-key library lighting, intellectual editorial mood` |
| `aura_natural_organico` | Raw Linen | `natural sustainable fashion background, neutral cool-toned earthy palette from raw linen grey to bone white, minimal saturation, soft breathable organic lighting` |

**Fragmento negativo adicional (aplicar a todos os presets AURA):**
`avoid gamified badge icons, avoid game UI elements, avoid achievement/level-up graphics, avoid text overlays` — evita que a IA misture o vocabulário de gamificação do sistema Aura de engajamento (RAW→LEGENDARY) com a direção de moda deste catálogo.

---

## 3. Prompts necessários — Materiais (10 fragmentos)

| ID | Nome / fibra real | Fragmento de prompt (inglês, pronto para `MATERIAL_DIRECTIONS`) |
|---|---|---|
| `linho_natural` | Linho natural | `natural linen woven textile surface, light plain weave with subtle irregular slub texture, breathable matte finish, soft fabric grain` |
| `la_fria_alfaiataria` | Lã fria / worsted | `cold wool suiting fabric surface, fine worsted twill weave, structured firm drape, smooth matte tailored finish` |
| `cetim_liquido` | Cetim / satin | `liquid satin fabric surface, fluid high-sheen weave, directional light reflection, smooth glossy drape` |
| `veludo_profundo` | Veludo | `deep velvet pile fabric surface, dense directional nap, soft shadow depth between fibers, rich satin-matte duotone sheen` |
| `denim_selvagem` | Denim selvedge | `selvedge denim fabric surface, coarse diagonal twill weave, rigid robust texture, matte indigo-toned grain` |
| `tweed_boucle` | Tweed bouclé | `bouclé tweed fabric surface, irregular looped yarn texture, voluminous cross-hatched weave, matte tactile bumpy surface` |
| `organza_translucida` | Organza | `sheer organza fabric surface, crisp fine plain weave, translucent light-catching texture, subtle satin glow` |
| `couro_nappa` | Couro nappa | `nappa leather surface, smooth supple grain, controlled satin-matte reflection, structured premium hide texture` |
| `malha_canelada` | Malha canelada / rib knit | `ribbed knit fabric surface, regular vertical rib lines, soft stretch texture, matte tactile knit finish` |
| `laminado_metalico` | Lamê / laminado metálico | `metallic laminated fabric surface, reflective foil-coated weave, rigid high-shine texture, futuristic lamé finish` |

**Fragmento negativo adicional (aplicar a todos os materiais):**
`avoid literal clothing garment silhouette, avoid stock photo watermark, avoid plastic 3D render look, avoid visible stitched text or logos` — impede que a IA renderize uma peça de roupa inteira (o material deve ficar como *superfície/textura de fundo*, não como uma roupa fotografada).

---

## 4. Combinações de referência (10 pares da matriz de coerência)

Cada linha já é o `finalPrompt` completo (fragmento AURA + fragmento material + blocos fixos do gerador), pronto para envio ao serviço de IA generativa.

**Blocos fixos reaproveitados de `buildArtworkPrompt()`:**
`full background composition for outfit card design`, `clear text-safe area, controlled visual density, clean negative space for outfit presentation and typography`, `design asset oriented output, premium fashion/editorial background utility`.

**Negativo fixo (`baseNegative`):**
`avoid faces, avoid people, avoid clutter, avoid chaotic scenery, avoid fantasy character focus, avoid unreadable typography collisions`.

| # | Arquétipo | Preset AURA + Material | Prompt final composto |
|---|---|---|---|
| 1 | Alfaiataria clássica | `aura_alfaiataria` + `la_fria_alfaiataria` | `tailored classic menswear-inspired background, cold monochrome palette from deep navy to soft steel grey, quiet-luxury studio lighting, sharp low-contrast linear gradient, refined tailored art direction, cold wool suiting fabric surface, fine worsted twill weave, structured firm drape, smooth matte tailored finish, full background composition for outfit card design, clear text-safe area, controlled visual density, clean negative space for outfit presentation and typography, design asset oriented output, premium fashion/editorial background utility` |
| 2 | Minimalismo editorial | `aura_editorial_mono` + `organza_translucida` | `minimalist editorial fashion background, warm-neutral monochrome palette from ivory to soft taupe, ultra-low saturation, clean campaign lighting, generous negative space for typography, sheer organza fabric surface, crisp fine plain weave, translucent light-catching texture, subtle satin glow, full background composition for outfit card design, clear text-safe area, controlled visual density, clean negative space for outfit presentation and typography, design asset oriented output, premium fashion/editorial background utility` |
| 3 | Romântico/feminino | `aura_romantico_petala` + `organza_translucida` | `romantic feminine fashion background, soft analogous warm palette from blush pink to dusty rose, radial soft-focus glow, delicate floating petal-like bokeh accents, sheer organza fabric surface, crisp fine plain weave, translucent light-catching texture, subtle satin glow, full background composition for outfit card design, clear text-safe area, controlled visual density, clean negative space for outfit presentation and typography, design asset oriented output, premium fashion/editorial background utility` |
| 4 | Boêmio | `aura_boemio_terracota` + `linho_natural` | `bohemian fashion background, warm analogous autumn palette from burnt terracotta to golden ochre, radial sunset glow, organic desert-dune gradient movement, natural linen woven textile surface, light plain weave with subtle irregular slub texture, breathable matte finish, soft fabric grain, full background composition for outfit card design, clear text-safe area, controlled visual density, clean negative space for outfit presentation and typography, design asset oriented output, premium fashion/editorial background utility` |
| 5 | Streetwear | `aura_streetwear_neon` + `denim_selvagem` | `urban streetwear fashion background, high-contrast complementary palette of deep asphalt grey with electric cyan and magenta neon accents, hard diagonal graphic blocks, bold contemporary street energy, selvedge denim fabric surface, coarse diagonal twill weave, rigid robust texture, matte indigo-toned grain, full background composition for outfit card design, clear text-safe area, controlled visual density, clean negative space for outfit presentation and typography, design asset oriented output, premium fashion/editorial background utility` |
| 6 | Avant-garde/futurista | `aura_avantgarde_cromo` + `laminado_metalico` | `avant-garde futuristic fashion background, cool iridescent palette from deep indigo to pale lavender chrome, holographic conic gradient, high-contrast vanguard editorial lighting, metallic laminated fabric surface, reflective foil-coated weave, rigid high-shine texture, futuristic lamé finish, full background composition for outfit card design, clear text-safe area, controlled visual density, clean negative space for outfit presentation and typography, design asset oriented output, premium fashion/editorial background utility` |
| 7 | Esportivo/athleisure | `aura_esportivo_performance` + `malha_canelada` | `sporty athleisure fashion background, energetic complementary palette of deep petrol blue with electric sky-blue and lime accents, diagonal motion-blur beams, dynamic performance-driven composition, ribbed knit fabric surface, regular vertical rib lines, soft stretch texture, matte tactile knit finish, full background composition for outfit card design, clear text-safe area, controlled visual density, clean negative space for outfit presentation and typography, design asset oriented output, premium fashion/editorial background utility` |
| 8 | Glam de noite | `aura_glam_noite` + `veludo_profundo` | `evening glam red-carpet fashion background, dark monochrome palette with warm bronze-gold jewel-tone spotlight accent, radial stage-spotlight glow, dramatic high-contrast luxury lighting, deep velvet pile fabric surface, dense directional nap, soft shadow depth between fibers, rich satin-matte duotone sheen, full background composition for outfit card design, clear text-safe area, controlled visual density, clean negative space for outfit presentation and typography, design asset oriented output, premium fashion/editorial background utility` |
| 9 | Dark academia | `aura_dark_academia` + `tweed_boucle` | `dark academia fashion background, warm analogous palette from deep espresso brown to aged brass, muted forest-green accent, low-key library lighting, intellectual editorial mood, bouclé tweed fabric surface, irregular looped yarn texture, voluminous cross-hatched weave, matte tactile bumpy surface, full background composition for outfit card design, clear text-safe area, controlled visual density, clean negative space for outfit presentation and typography, design asset oriented output, premium fashion/editorial background utility` |
| 10 | Natural/sustentável | `aura_natural_organico` + `linho_natural` | `natural sustainable fashion background, neutral cool-toned earthy palette from raw linen grey to bone white, minimal saturation, soft breathable organic lighting, natural linen woven textile surface, light plain weave with subtle irregular slub texture, breathable matte finish, soft fabric grain, full background composition for outfit card design, clear text-safe area, controlled visual density, clean negative space for outfit presentation and typography, design asset oriented output, premium fashion/editorial background utility` |

**Negativo composto para as 10 linhas acima:**
`avoid faces, avoid people, avoid clutter, avoid chaotic scenery, avoid fantasy character focus, avoid unreadable typography collisions, avoid gamified badge icons, avoid game UI elements, avoid achievement/level-up graphics, avoid text overlays, avoid literal clothing garment silhouette, avoid stock photo watermark, avoid plastic 3D render look, avoid visible stitched text or logos`

---

## 5. Combinações fora da matriz padrão

Qualquer um dos outros 90 pares possíveis (10 AURA × 10 materiais, menos os 10 já listados) é gerado com a **mesma fórmula**: `[fragmento AURA] + [fragmento material] + blocos fixos`, sem necessidade de escrever um prompt novo — é só trocar as duas entradas nos dicionários das seções 2 e 3. Isso é o que a seção 3.2 do documento principal chama de "combinação livre, sem restrição": tecnicamente, a lista de prompts *necessários* é só a de 20 fragmentos — o resto é composição automática do `buildArtworkPrompt()`.
