# Preset — Show Notes (Conceito B do mockup "Quatro Conceitos")

**ID candidato:** `show_notes` (novo, ainda não implementado como componente React)
**Origem:** mockup enviado pelo usuário, "Quatro Conceitos — Dualidade de Cards", Conceito B — "Show Notes".
**Colisão de nome:** nenhuma com os 7 skins já registrados em `skinRegistry.ts`.

## Descrição visual (fonte: mockup)

Fundo preto quase puro `#0A0A0A`, com uma marca d'água numérica gigante (ex. "01") em opacidade quase invisível (`0.028`) atrás do conteúdo — referência de número do look/edição, estilo "nota de bastidor". Bloco de retrato no canto superior (grid `1fr 80px`). Nome em caixa alta, peso 900, letter-spacing negativo. Cards de peça aninhados com borda **superior** de 2px colorida por tipo de peça (não lateral, como no conceito A). Badges outline puro, sem preenchimento, `border-radius: 3px`. Botão de ação "Ver" outline-only, sem background, hover só muda opacidade da borda.

## Fragmento de estilo

```
deep black backstage show-notes mockup, oversized faint numeric watermark typography barely visible in the background, bold uppercase grotesque display type with tight negative letter-spacing, small portrait framing block set in a top corner grid, thin colored top-edge accent stripes by category on nested item rows, outline-only badge and button styling with no fill, austere backstage documentation aesthetic
```

## Prompt final (contexto Esquema, formato Ampliado)

```
deep black backstage show-notes mockup, oversized faint numeric watermark typography barely visible in the background, bold uppercase grotesque display type with tight negative letter-spacing, small portrait framing block set in a top corner grid, thin colored top-edge accent stripes by category on nested item rows, outline-only badge and button styling with no fill, austere backstage documentation aesthetic, full outfit editorial framing, complete look composition with multiple garment pieces styled together, head-to-toe styling context, tall vertical card mockup format, narrow portrait aspect ratio approximately 0.39:1 (220:566), generous vertical space for a hero photo area plus stacked info rows below, mockup canvas 220x566, design asset oriented output, premium fashion/editorial background utility, clear text-safe area, controlled visual density, clean negative space for outfit presentation and typography
```

**Variante "peça":** troque o bloco de contexto por `single garment product framing, one clothing item centered as hero subject, isolated product-shot styling`.

**Prompt negativo:** ver `08_negativo_e_geracao_tecnica.md` (comum a todos os presets) — **atenção especial:** a marca d'água numérica quase invisível deste conceito pode ser confundida por um modelo de geração com "texto de UI legível", que o negativo já proíbe (`avoid rendering small legible UI text or numbers`). Se o resultado gerar dígitos legíveis grandes, reforce no prompt positivo que o número deve estar "barely visible" / "almost imperceptible watermark".
