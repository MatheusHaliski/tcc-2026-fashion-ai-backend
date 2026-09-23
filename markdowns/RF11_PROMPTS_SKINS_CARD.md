# RF11 — Prompts de Geração: Skins de Card (Atelier, Spread, Índice, Trading, FAI Max, Stub, Specimen)

**Projeto:** FashionAI (SAI-TCC-2026)
**Escopo:** thumbnails de referência para os 7 skins de card já implementados em `app/components/outfit-card/skins/` (`CardSkinId`), calibrados pelas dimensões reais de `anatomias_card_v13.html` (ver seção 2).
**Fora de escopo por enquanto (por pedido explícito):** mesclagem com a Etapa 3 — Layout & Estilo (anatomias Passarela/Etiqueta/Raio-X/Bento/Espectro/Recibo). Este documento cobre só os **skins de card** (estilo/tipografia/decoração), que já são um sistema separado das **anatomias** (onde cada informação fica).

---

## 1. Por que "thumbnail estático", não "preview ao vivo"

Retomando a distinção da resposta anterior: o card ao vivo dentro do RF11 é sempre renderizado pelo componente React real do skin (`CardAtelier.tsx` etc.), com dados reais do usuário (fotos, nomes, preços, curtidas). Uma imagem gerada por IA **não substitui isso** — ela serve para:

1. **Thumbnail do seletor de skin** — uma imagem ilustrativa, gerada uma vez, cacheada, mostrando "o clima" de cada skin antes do usuário escolher. É isso que este documento produz.
2. (Fora de escopo aqui, já resolvido antes) — camada de atmosfera/textura injetada no card real via o mesmo pipeline de Arte com IA (Preset Aura/Material), reaproveitando os fragmentos deste documento como uma das direções de estilo possíveis.

---

## 2. Dimensões reais (fonte: `anatomias_card_v13.html`, documento oficial de modelagem de parâmetros de dimensões de card — agora importado para a raiz do repositório)

**Correção desta rodada.** Uma rodada anterior desta revisão havia marcado a citação a `anatomias_card_v12.html` como referência a um arquivo inexistente e substituído estas dimensões pelas do componente `OutfitCard.tsx` (canvas de textura, 820×980px). Isso estava errado: `anatomias_card_v13.html` é o documento oficial de modelagem de parâmetros de dimensões de card do projeto — só não estava, até esta rodada, commitado neste repositório (agora está, na raiz). As classes `.rail-passarela`, `.xray-*` e `.bento-*` citadas em outros documentos (ex.: `RF6_LOOK_DO_DIA_VERSOES_PAINEL.md`) também existem de fato neste arquivo — a correção anterior que as marcou como inexistentes também foi revertida lá.

`anatomias_card_v13.html` fixa a **largura em 90mm** para todo card "Ampliado" (rótulo `.dim-w` presente em cada variante — `Peça`, `Lista vertical`, `Grade de peças` etc., todas com `width:220px` no mockup e a legenda "90 mm"), mas **não fixa uma altura/proporção única** — a altura é orgânica, controlada pelo conteúdo (número de peças, tamanho da descrição), igual um card real. Medição direta do mockup renderizado (Chromium headless, os mesmos `220px` de largura do documento) para as variantes "Ampliado" mais relevantes ao contexto de Esquema (a mesma base usada pelos 7 skins, seção 6):

| Variante ("Ampliado") | Largura | Altura medida | Proporção (L:A) |
|---|---|---|---|
| Lista vertical (4 peças) | 220px (90mm) | 566px | ≈ 0,39 : 1 |
| Grade de peças (4 peças) | 220px (90mm) | 480px | ≈ 0,46 : 1 |
| Peça avulsa (1 item) | 220px (90mm) | 393px | ≈ 0,56 : 1 |

A faixa **≈0,39–0,46:1** (retrato estreito e alto) das variantes de Esquema confirma — agora com medição real, não estimativa — a mesma ordem de grandeza da proporção ≈0,41:1 usada nas versões anteriores deste documento. As seções 5 e 6 abaixo foram recalibradas para a variante mais representativa medida (Lista vertical — Ampliado, 220×566px, ≈0,39:1), a mesma base de Esquema usada pelos 7 skins. Isso é **diferente e não conflitante** com as dimensões de `OutfitCard.tsx` (canvas de textura 820×980px, ≈0,84:1, `docs/design-schema-outfit-card.md` §6.1): aquele número descreve o buffer interno usado por `renderFabricTextureToCanvas()` para renderizar a *textura de material* sobre o card ao vivo (uma preocupação de implementação, câmera/canvas), enquanto `anatomias_card_v13.html` é o documento de modelagem que define a proporção *visual* pretendida do card em si — a referência correta para calibrar o formato destas thumbnails geradas por IA.

---

## 3. Fragmentos de estilo por skin (7 — `SKIN_STYLE_DIRECTIONS`)

Mesmo formato de `STYLE_DIRECTIONS` em `ArtworkStudioService.ts` — fragmentos em inglês, prontos para concatenar.

| ID | Skin (`thumbHint` atual) | Fragmento de prompt |
|---|---|---|
| `atelier` | Minimal refinado, branco puro | `pristine white minimalist atelier mockup, quiet-luxury product studio aesthetic, soft diffused light, generous negative space, fine hairline borders, restrained neutral palette, refined haute couture ambiance` |
| `spread` | Editorial de magazine | `high-fashion magazine editorial spread mockup, bold layout typography cues, glossy print aesthetic, dramatic studio lighting, campaign photography mood, confident asymmetric composition` |
| `index` | Cartão de referência | `reference index card mockup, archival catalog aesthetic, clean typographic grid, muted paper tones, labeled specimen-like structure, understated utilitarian clarity` |
| `trading` | Card colecionável | `collectible trading card mockup, holographic foil accents, bold border frame, vibrant saturated palette, stat-panel game card aesthetic, glossy protective-sleeve sheen` |
| `fai_max` | Maximalista laranja FAI | `maximalist bold mockup, vivid FashionAI orange brand palette, high-energy layered graphics, saturated high-contrast composition, loud confident streetwear-adjacent editorial energy` |
| `stub` | Recibo/ticket perfurado (não registrado ainda) | `perforated ticket-stub mockup, zigzag torn-edge divider, dashed rule lines, monospace label typography, raw paper receipt texture, retail ticket aesthetic` |
| `specimen` | Ficha de laboratório (não registrado ainda) | `scientific specimen card mockup, graph-paper grid background, dashed field-label rows, clinical archival aesthetic, muted laboratory tones, precise measured documentation feel` |

---

## 4. Fragmentos de contexto — peça vs. esquema (2 — `CARD_CONTEXT_DIRECTIONS`)

| ID | Fragmento |
|---|---|
| `peca` | `single garment product framing, one clothing item centered as hero subject, isolated product-shot styling` |
| `esquema` | `full outfit editorial framing, complete look composition with multiple garment pieces styled together, head-to-toe styling context` |

## 5. Fragmento de formato — Ampliado (único gerado por IA, ver seção 2)

| ID | Fragmento |
|---|---|
| `ampliado` | `tall vertical card mockup format, narrow portrait aspect ratio approximately 0.39:1 (220:566, measured from anatomias_card_v13.html "Lista vertical — Ampliado"), generous vertical space for a hero photo area plus stacked info rows below, mockup canvas 220x566` |

**Aviso operacional — "mockup canvas 220x566" não define a dimensão real da geração.** Este fragmento é só texto de prompt; o payload real enviado ao provedor (`ArtworkStudioService.ts`, `OpenAIArtworkProvider.generate()`) usa `width`/`height` derivados da env var `OPENAI_IMAGES_SIZE`, com fallback para **1536×1024 — paisagem**, não retrato. Sem ação adicional, a imagem gerada sai na orientação errada, e nenhum recorte recupera a composição alta e estreita pretendida (recortar uma imagem paisagem não produz um retrato 0,39:1). Para gerar de fato no formato Ampliado, é preciso **antes de rodar este pipeline**, configurar `OPENAI_IMAGES_SIZE` para um retrato suportado pelo provedor (ex.: `1024x1536`, ≈0,67:1 — o retrato mais próximo tipicamente disponível) — nenhum tamanho padrão de API chega a 0,39:1, então um recorte central ainda é necessário depois para aproximar a proporção final; ou, alternativamente, tratar a geração destas 7 thumbnails como uma etapa externa e manual (fora do pipeline padrão do RF11), documentada como tal.

---

## 6. Prompts finais compostos (7 skins × Ampliado × Esquema — thumbnails de referência)

`finalPrompt` = `[SKIN_STYLE_DIRECTIONS[skin], CARD_CONTEXT_DIRECTIONS.esquema, ampliado, blocos fixos]`. Blocos fixos reaproveitados de `buildArtworkPrompt()`: `design asset oriented output, premium fashion/editorial background utility` + `clear text-safe area, controlled visual density, clean negative space for outfit presentation and typography`.

**Negativo comum a todas (`baseNegative` completo de `ArtworkStudioService.ts` + restrições específicas de thumbnail):**
`avoid faces, avoid people, avoid clutter, avoid chaotic scenery, avoid fantasy character focus, avoid unreadable typography collisions, avoid rendering small legible UI text or numbers, avoid literal price tags with readable digits, avoid stock photo watermark`

O `baseNegative` real (`buildArtworkPrompt()`, `ArtworkStudioService.ts`) é `avoid faces, avoid people, avoid clutter, avoid chaotic scenery, avoid fantasy character focus, avoid unreadable typography collisions` — as seis primeiras cláusulas acima. As três últimas (`avoid rendering small legible UI text or numbers`, `avoid literal price tags with readable digits`, `avoid stock photo watermark`) são acréscimos específicos deste documento, sempre **anexados**, nunca substituindo o base. "avoid clutter" e "avoid fantasy character focus" importam especialmente aqui: sem eles, os prompts Maximalista (FAI Max) e Trading — os dois mais densos visualmente da lista — perdem justamente a salvaguarda contra composições poluídas/com foco de personagem, o tipo de resultado que essas duas direções são mais propensas a gerar.

| Skin | Prompt final |
|---|---|
| **Atelier** | `pristine white minimalist atelier mockup, quiet-luxury product studio aesthetic, soft diffused light, generous negative space, fine hairline borders, restrained neutral palette, refined haute couture ambiance, full outfit editorial framing, complete look composition with multiple garment pieces styled together, head-to-toe styling context, tall vertical card mockup format, narrow portrait aspect ratio approximately 0.39:1 (220:566), generous vertical space for a hero photo area plus stacked info rows below, mockup canvas 220x566, design asset oriented output, premium fashion/editorial background utility, clear text-safe area, controlled visual density, clean negative space for outfit presentation and typography` |
| **Spread** | `high-fashion magazine editorial spread mockup, bold layout typography cues, glossy print aesthetic, dramatic studio lighting, campaign photography mood, confident asymmetric composition, full outfit editorial framing, complete look composition with multiple garment pieces styled together, head-to-toe styling context, tall vertical card mockup format, narrow portrait aspect ratio approximately 0.39:1 (220:566), generous vertical space for a hero photo area plus stacked info rows below, mockup canvas 220x566, design asset oriented output, premium fashion/editorial background utility, clear text-safe area, controlled visual density, clean negative space for outfit presentation and typography` |
| **Índice** | `reference index card mockup, archival catalog aesthetic, clean typographic grid, muted paper tones, labeled specimen-like structure, understated utilitarian clarity, full outfit editorial framing, complete look composition with multiple garment pieces styled together, head-to-toe styling context, tall vertical card mockup format, narrow portrait aspect ratio approximately 0.39:1 (220:566), generous vertical space for a hero photo area plus stacked info rows below, mockup canvas 220x566, design asset oriented output, premium fashion/editorial background utility, clear text-safe area, controlled visual density, clean negative space for outfit presentation and typography` |
| **Trading** | `collectible trading card mockup, holographic foil accents, bold border frame, vibrant saturated palette, stat-panel game card aesthetic, glossy protective-sleeve sheen, full outfit editorial framing, complete look composition with multiple garment pieces styled together, head-to-toe styling context, tall vertical card mockup format, narrow portrait aspect ratio approximately 0.39:1 (220:566), generous vertical space for a hero photo area plus stacked info rows below, mockup canvas 220x566, design asset oriented output, premium fashion/editorial background utility, clear text-safe area, controlled visual density, clean negative space for outfit presentation and typography` |
| **FAI Max** | `maximalist bold mockup, vivid FashionAI orange brand palette, high-energy layered graphics, saturated high-contrast composition, loud confident streetwear-adjacent editorial energy, full outfit editorial framing, complete look composition with multiple garment pieces styled together, head-to-toe styling context, tall vertical card mockup format, narrow portrait aspect ratio approximately 0.39:1 (220:566), generous vertical space for a hero photo area plus stacked info rows below, mockup canvas 220x566, design asset oriented output, premium fashion/editorial background utility, clear text-safe area, controlled visual density, clean negative space for outfit presentation and typography` |
| **Stub** | `perforated ticket-stub mockup, zigzag torn-edge divider, dashed rule lines, monospace label typography, raw paper receipt texture, retail ticket aesthetic, full outfit editorial framing, complete look composition with multiple garment pieces styled together, head-to-toe styling context, tall vertical card mockup format, narrow portrait aspect ratio approximately 0.39:1 (220:566), generous vertical space for a hero photo area plus stacked info rows below, mockup canvas 220x566, design asset oriented output, premium fashion/editorial background utility, clear text-safe area, controlled visual density, clean negative space for outfit presentation and typography` |
| **Specimen** | `scientific specimen card mockup, graph-paper grid background, dashed field-label rows, clinical archival aesthetic, muted laboratory tones, precise measured documentation feel, full outfit editorial framing, complete look composition with multiple garment pieces styled together, head-to-toe styling context, tall vertical card mockup format, narrow portrait aspect ratio approximately 0.39:1 (220:566), generous vertical space for a hero photo area plus stacked info rows below, mockup canvas 220x566, design asset oriented output, premium fashion/editorial background utility, clear text-safe area, controlled visual density, clean negative space for outfit presentation and typography` |

**Variante "peça" (opcional, sob demanda):** troque o fragmento `CARD_CONTEXT_DIRECTIONS.esquema` por `CARD_CONTEXT_DIRECTIONS.peca` em qualquer uma das 7 linhas acima — mesma fórmula, sem reescrever nada.

---

## 7. Onde isso entra hoje

O seletor de skin (`PremiumSelections.tsx`, props `selectedSkin`/`onSelectSkin`) e o preview ao vivo (seção 1 acima) dependem de três pontos de wiring que **não bastava documentar como pendentes** — sem eles, adicionar só as thumbnails deste documento ao seletor não entrega o preview ao vivo prometido na seção 1:

1. **`CreateMySchemeView.tsx`** precisa manter o estado `selectedCardSkin` e passar `selectedCardSkin`/`onSelectSkin` para `OutfitBackgroundStudioModal` — sem isso, `PremiumSelections` nunca renderiza (ela só aparece quando `onSelectSkin` existe) e o seletor fica invisível, mesmo com as thumbnails prontas.
2. **`OutfitBackgroundStudioModal.tsx`** precisa ler `selectedCardSkin` e, quando definido, resolver o componente do skin via `getSkinById()` (`skinRegistry.ts`) para renderizar o preview — sem isso, o preview ao vivo usa sempre o `OutfitCard` genérico, que não lê `cardSkin`, e a promessa da seção 1 ("o card ao vivo é sempre renderizado pelo componente React real do skin") fica falsa na prática.
3. **`skinRegistry.ts`** precisa registrar os 7 skins (`atelier`/`spread`/`index`/`trading`/`fai_max`/`stub`/`specimen`) — faltavam `stub` e `specimen` apesar de `CardStub.tsx`/`CardSpecimen.tsx` já existirem e `PremiumSelections` já oferecê-los como opção.

Esses três pontos foram corrigidos no código nesta rodada (2026-09-22) — a documentação anterior desta seção tratava "só adicionar as thumbnails, sem mudar o fluxo" como suficiente, o que descrevia errado o estado do sistema: as thumbnails deste documento são um ativo visual (imagem cacheada no seletor), mas o preview ao vivo em si — o que a seção 1 promete — sempre dependeu deste wiring de código, independente de existir thumbnail ou não. Modelar formalmente a escolha de skin no `.puml` do RF11 (opção "b" original) continua fora de escopo aqui, sem mudança nessa decisão.
