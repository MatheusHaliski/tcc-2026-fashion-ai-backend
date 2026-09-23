# Preset — Atelier Terracota (Conceito C do mockup "Quatro Conceitos")

**ID candidato:** `atelier_terracotta` (novo, ainda não implementado como componente React)
**Origem:** mockup enviado pelo usuário, "Quatro Conceitos — Dualidade de Cards", Conceito C — "Atelier".

> **⚠️ Colisão de nome — ação necessária antes de registrar.** O mockup nomeia este conceito literalmente **"Atelier"**, mas o ID `atelier` já está ocupado em `skinRegistry.ts` por `CardAtelier.tsx` ("Minimal refinado, branco puro" — estética oposta: branco puro, minimalista, sem textura). São duas propostas visuais completamente diferentes disputando o mesmo nome. **Não registre este conceito como `atelier`** — use um ID distinto (proposto aqui: `atelier_terracotta`) ou decida com o time qual dos dois deve manter o nome "Atelier" puro e renomeie o outro antes de subir ao novo repositório.

## Descrição visual (fonte: mockup)

Fundo terracota escuro `#3A2416`, com textura sutil de linho em crosshatch diagonal (dois `repeating-linear-gradient` cruzados, opacidade `0.022`). Nome do look em Georgia peso-300 itálico, precedido por um ícone de agulha (⌇). Cards de peça aninhados com gradiente "couro" (`#3D2B1F` → `#261A11`), canto superior-direito recortado (simulação de dobra/etiqueta de alfaiate via `clip-path`), `border-radius: 7px 0 7px 7px`. Borda tracejada inset na área de foto-hero, simulando linha de giz de alfaiate. Paleta geral terrosa/artesanal.

## Fragmento de estilo

```
warm terracotta leather atelier mockup, deep rust-brown tone with a subtle diagonal linen crosshatch texture, Georgia italic light-weight serif typography with a needle-icon accent, leather-gradient product cards with a folded cut top-right corner, dashed tailoring-chalk inset border on the hero area, artisanal tailor-shop ambiance, handcrafted earthy palette
```

## Prompt final (contexto Esquema, formato Ampliado)

```
warm terracotta leather atelier mockup, deep rust-brown tone with a subtle diagonal linen crosshatch texture, Georgia italic light-weight serif typography with a needle-icon accent, leather-gradient product cards with a folded cut top-right corner, dashed tailoring-chalk inset border on the hero area, artisanal tailor-shop ambiance, handcrafted earthy palette, full outfit editorial framing, complete look composition with multiple garment pieces styled together, head-to-toe styling context, tall vertical card mockup format, narrow portrait aspect ratio approximately 0.39:1 (220:566), generous vertical space for a hero photo area plus stacked info rows below, mockup canvas 220x566, design asset oriented output, premium fashion/editorial background utility, clear text-safe area, controlled visual density, clean negative space for outfit presentation and typography
```

**Variante "peça":** troque o bloco de contexto por `single garment product framing, one clothing item centered as hero subject, isolated product-shot styling`.

**Prompt negativo:** ver `08_negativo_e_geracao_tecnica.md` (comum a todos os presets).
