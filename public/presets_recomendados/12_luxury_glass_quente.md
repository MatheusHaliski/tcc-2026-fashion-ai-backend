# Preset — Luxury Glass Quente (Conceito D do mockup "Quatro Conceitos")

**ID candidato:** `luxury_glass_warm` (novo, ainda não implementado como componente React)
**Origem:** mockup enviado pelo usuário, "Quatro Conceitos — Dualidade de Cards", Conceito D — "Luxury Glass Quente".
**Colisão de nome:** nenhuma com os 7 skins já registrados em `skinRegistry.ts`.

## Descrição visual (fonte: mockup)

Fundo "vidro" azul-marinho quase opaco `rgba(13,27,42,0.97)`, borda geral em rose-gold a 22% de opacidade. Fio de luz (hairline) de 2px no topo do card com gradiente horizontal `transparent → #C4956A (rose-gold) → #7C5FC0 (violeta) → transparent`. Glow externo duplo: violeta suave (24px) + sombra escura (4px), dando profundidade sem parecer neon. Cards de peça aninhados com gradiente diagonal misturando navy + violeta (10%) + rose-gold (7%); no hover, brilho dourado sutil na borda e sombra. Badges em dois tons: dourado para "Statement", violeta para "Visual Anchor". Tipografia do nome em caixa alta, peso 200 (fino), letter-spacing largo — contraste deliberado com o peso 900 do Conceito B.

## Fragmento de estilo

```
warm luxury glass mockup, deep near-opaque navy glass background, thin rose-gold-to-violet gradient hairline accent along the top edge, soft violet ambient glow surrounding the frame paired with a deeper grounding shadow, gradient product cards blending navy, violet, and rose-gold tones with a warm golden glow on hover, refined uppercase wide-tracked light-weight typography, opulent evening editorial mood
```

## Prompt final (contexto Esquema, formato Ampliado)

```
warm luxury glass mockup, deep near-opaque navy glass background, thin rose-gold-to-violet gradient hairline accent along the top edge, soft violet ambient glow surrounding the frame paired with a deeper grounding shadow, gradient product cards blending navy, violet, and rose-gold tones with a warm golden glow on hover, refined uppercase wide-tracked light-weight typography, opulent evening editorial mood, full outfit editorial framing, complete look composition with multiple garment pieces styled together, head-to-toe styling context, tall vertical card mockup format, narrow portrait aspect ratio approximately 0.39:1 (220:566), generous vertical space for a hero photo area plus stacked info rows below, mockup canvas 220x566, design asset oriented output, premium fashion/editorial background utility, clear text-safe area, controlled visual density, clean negative space for outfit presentation and typography
```

**Variante "peça":** troque o bloco de contexto por `single garment product framing, one clothing item centered as hero subject, isolated product-shot styling`.

**Prompt negativo:** ver `08_negativo_e_geracao_tecnica.md` (comum a todos os presets).

**Nota de proximidade com RF23.** A combinação hairline rose-gold + glow violeta deste conceito é a mais próxima, entre os quatro, de um acabamento "metálico" — mas usa paleta quente (rose-gold/violeta), diferente da paleta fria Prata/Platina definida em `RF23/00_vocabulario_base_gradiente.md` para o chrome do app. Trate como paletas de **domínios distintos**: esta é uma opção de skin de conteúdo (card), a de RF23 é do chrome fixo da interface — não misture as duas ao implementar.
