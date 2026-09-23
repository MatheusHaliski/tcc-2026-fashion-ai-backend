# Preset — Editorial Ivory Paper (Conceito A do mockup "Quatro Conceitos")

**ID candidato:** `editorial_ivory` (novo, ainda não implementado como componente React)
**Origem:** mockup enviado pelo usuário, "Quatro Conceitos — Dualidade de Cards", Conceito A — "Editorial Spread".

> **Aviso de nomenclatura.** O título original deste conceito no mockup é "Editorial Spread" — o termo "Spread" colide parcialmente com o skin já implementado `spread` (`CardSpread.tsx`, "Editorial de magazine": glossy print, dramatic studio lighting). São estéticas diferentes (esta é papel ivory fosco/zero-glassmorphism; a existente é glossy/dramática) — por isso o ID candidato aqui usa "Ivory" em vez de "Spread" puro, para não colidir. Confirme o nome final antes de registrar em `skinRegistry.ts`.

## Descrição visual (fonte: mockup)

Fundo ivory `#F7F4EE` como "palco de papel", tipografia Georgia serifada para nome e legenda (legenda em itálico), cards de peça aninhados em branco puro com uma faixa colorida lateral de 3px identificando o tipo de peça (jaqueta/top/bottom) por cor. Badges neutros `#F0EDE8` com borda `#D4CEC4`, sem gradiente, `border-radius: 3px`. Hover nos cards de peça: `translateY(-2px)` + sombra suave `rgba(26,20,16,0.10)`. Zero glassmorphism — é a estética mais "papel/impresso" das quatro.

## Fragmento de estilo

```
ivory paper editorial mockup, warm off-white stage background, Georgia serif typography accents with italic caption line, crisp white product cards with a thin colored side-stripe accent by category, soft matte styling, zero glassmorphism, gentle diffused daylight, quiet paper-stage minimalism, understated neutral badges
```

## Prompt final (contexto Esquema, formato Ampliado)

```
ivory paper editorial mockup, warm off-white stage background, Georgia serif typography accents with italic caption line, crisp white product cards with a thin colored side-stripe accent by category, soft matte styling, zero glassmorphism, gentle diffused daylight, quiet paper-stage minimalism, understated neutral badges, full outfit editorial framing, complete look composition with multiple garment pieces styled together, head-to-toe styling context, tall vertical card mockup format, narrow portrait aspect ratio approximately 0.39:1 (220:566), generous vertical space for a hero photo area plus stacked info rows below, mockup canvas 220x566, design asset oriented output, premium fashion/editorial background utility, clear text-safe area, controlled visual density, clean negative space for outfit presentation and typography
```

**Variante "peça":** troque o bloco de contexto por `single garment product framing, one clothing item centered as hero subject, isolated product-shot styling`.

**Prompt negativo:** ver `08_negativo_e_geracao_tecnica.md` (comum a todos os presets).
