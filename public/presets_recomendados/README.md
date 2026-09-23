# Presets Recomendados — Thumbnails dos Skins Editoriais de Card

**Projeto:** FashionAI — nova interface
**Fonte de verdade:** `app/components/outfit-card/skins/skinRegistry.ts` (repositório principal, `matheushaliski/sai-tcc-2026`) — os 7 skins já implementados como componentes React (`CardSkinId`). Esta pasta traz a especificação completa para gerar (ou recriar do zero, na nova interface) as **thumbnails estáticas** que representam cada skin no seletor, calibradas por `anatomias_card_v13.html` — documento oficial de modelagem de dimensões de card do projeto.

**Adição desta rodada:** mais 4 presets candidatos (09–12), extraídos do mockup enviado pelo usuário "Quatro Conceitos — Dualidade de Cards" — ainda **não implementados** como componentes React (sem entrada em `skinRegistry.ts`), tratados aqui como propostas de skin adicionais ao catálogo de 7 já existente.

> **⚠️ Aviso de colisão de nomenclatura.** O mockup nomeia dois de seus quatro conceitos com termos que já pertencem a skins implementados: o Conceito C se chama literalmente **"Atelier"**, mesmo nome exato do skin já existente `atelier` (branco minimalista) — mas com estética oposta (terracota/couro). O Conceito A se chama "Editorial **Spread**", parcialmente sobreposto ao nome do skin existente `spread` (editorial de magazine glossy) — estética também diferente (papel ivory fosco). Os arquivos `09_editorial_ivory_paper.md` e `11_atelier_terracota.md` já usam IDs candidatos sem colisão (`editorial_ivory`, `atelier_terracotta`), mas a decisão final de nomenclatura (manter, renomear um dos dois lados, ou descartar um) cabe ao time antes de registrar qualquer um em `skinRegistry.ts` do novo repositório.

## O que é "thumbnail de preset editorial"

Cada skin de card (Atelier, Spread, Índice, Trading, FAI Max, Stub, Specimen) é um "preset editorial" — uma combinação fixa de estilo/tipografia/decoração para o card de esquema/peça. A **thumbnail** é uma imagem ilustrativa (gerada uma vez, cacheada) mostrada no seletor de skin, para o usuário entender "o clima" de cada opção antes de escolher — **não substitui** o card ao vivo, que continua sendo sempre renderizado pelo componente React real com dados reais do usuário.

## Índice de arquivos

| Arquivo | Conteúdo |
|---|---|
| `00_dimensoes_e_metodologia.md` | Proporção/dimensão oficial das thumbnails, fonte de medição, e por que ela difere do canvas de textura do `OutfitCard.tsx` |
| `01_atelier.md` | Preset "Atelier" — minimal refinado, branco puro |
| `02_spread.md` | Preset "Spread" — editorial de magazine |
| `03_index.md` | Preset "Índice" — cartão de referência/catálogo |
| `04_trading.md` | Preset "Trading" — card colecionável |
| `05_fai_max.md` | Preset "FAI Max" — maximalista laranja FAI |
| `06_stub.md` | Preset "Stub" — recibo/ticket perfurado |
| `07_specimen.md` | Preset "Specimen" — ficha de laboratório/catalogação |
| `08_negativo_e_geracao_tecnica.md` | Prompt negativo comum a todos + avisos operacionais de geração (tamanho de imagem, provedor) |
| `09_editorial_ivory_paper.md` | **Novo (candidato)** — "Editorial Ivory Paper" — papel ivory fosco, zero glassmorphism (mockup, Conceito A) |
| `10_show_notes.md` | **Novo (candidato)** — "Show Notes" — preto backstage, watermark numérica, outline-only (mockup, Conceito B) |
| `11_atelier_terracota.md` | **Novo (candidato)** — "Atelier Terracota" — couro/terracota, canto recortado (mockup, Conceito C — ⚠️ colide de nome com `atelier` já existente) |
| `12_luxury_glass_quente.md` | **Novo (candidato)** — "Luxury Glass Quente" — vidro navy, hairline rose-gold/violeta (mockup, Conceito D) |

## Regra de composição de cada preset

`prompt final = [fragmento de estilo do skin] + [fragmento de contexto: peça ou esquema] + [fragmento de formato: Ampliado] + [blocos fixos de asset de design]`

Cada arquivo `0X_<skin>.md` já traz o `prompt final` composto e pronto para uso — não é necessário montar manualmente.
