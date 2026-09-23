# Dimensões e metodologia

**Fonte:** `anatomias_card_v13.html` — documento oficial de modelagem de parâmetros de dimensões de card do projeto FashionAI (política vigente: sempre usar este documento como fonte de verdade para dimensões de card).

`anatomias_card_v13.html` fixa a **largura em 90mm** para todo card "Ampliado" (`width:220px` no mockup, rótulo `.dim-w`), mas **não fixa uma altura/proporção única** — a altura é orgânica, controlada pelo conteúdo (número de peças, tamanho da descrição), como um card real.

## Medição direta (Chromium headless, 220px de largura = documento original)

| Variante ("Ampliado") | Largura | Altura medida | Proporção (L:A) |
|---|---|---|---|
| Lista vertical (4 peças) | 220px (90mm) | 566px | ≈ 0,39 : 1 |
| Grade de peças (4 peças) | 220px (90mm) | 480px | ≈ 0,46 : 1 |
| Peça avulsa (1 item) | 220px (90mm) | 393px | ≈ 0,56 : 1 |

**Variante usada para as 7 thumbnails desta pasta:** "Lista vertical — Ampliado" (220×566px, ≈0,39:1) — a base de Esquema usada pelos 7 skins.

## Por que não usar as dimensões de `OutfitCard.tsx`

`OutfitCard.tsx` tem um canvas de textura de 820×980px (≈0,84:1, ver `docs/design-schema-outfit-card.md` §6.1), usado por `renderFabricTextureToCanvas()` para renderizar a *textura de material* sobre o card ao vivo — uma preocupação de implementação (buffer de canvas), não a proporção *visual* pretendida do card. `anatomias_card_v13.html` é o documento de modelagem que define o formato visual real — a referência correta para calibrar estas thumbnails.

## Fragmento de formato (usado em todos os 7 prompts finais)

```
tall vertical card mockup format, narrow portrait aspect ratio approximately 0.39:1 (220:566, measured from anatomias_card_v13.html "Lista vertical — Ampliado"), generous vertical space for a hero photo area plus stacked info rows below, mockup canvas 220x566
```

Ver avisos operacionais sobre geração real (tamanho de imagem por provedor de IA) em `08_negativo_e_geracao_tecnica.md`.
