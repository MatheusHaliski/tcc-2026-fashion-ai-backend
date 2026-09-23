# RF11 — Proposta: Presets AURA e Materiais para "Arte com IA"

**Projeto:** FashionAI (SAI-TCC-2026)
**Requisito Funcional:** RF11 — Configurar o Visual do Card (Background Studio)
**Escopo:** Sub-fluxo **Arte com IA** → ramos `Direção visual recomendada → Preset Aura` e `Camada de material`
**Base analisada:** `RF11-atividades.pdf`, `RF11-classes.pdf`, `RF11-componentes.pdf`, `RF11-maquinadeestados.pdf`, `RF11-sequencia.pdf`

---

## 1. Contexto — por que este ramo é "lógica comum a todos os tipos de geração"

Os cinco diagramas descrevem **o mesmo Background Studio** sendo reutilizado para os três tipos de card (`TipoCard = PECA | ESQUEMA | DNA_ESTILO`). A ramificação por tipo acontece só na Etapa 1 (carregamento de conteúdo); a partir da Etapa 2 em diante — organizar conteúdo, configurar background, `Arte com IA`, cor do container, revisão e persistência — o fluxo é **idêntico e compartilhado**, e isso está explícito:

- **Diagrama de Atividades:** as três origens (Peça / Esquema / DNA de Estilo) convergem em "Etapa 2 — Organizar o conteúdo do card" antes de entrar em "Etapa 3 — Configurar os elementos visuais", onde vive `Arte com IA`.
- **Diagrama de Estados:** os estados `Configurando arte com IA`, `Configurando background` e `Configurando container` são regiões concorrentes, reaproveitadas independentemente de `Card de peça`, `Card de DNA de Estilo` ou `Card de esquema`.
- **Diagrama de Classes:** `ConfiguracaoArteIA` é um *value object* único, com `ModoArteIA = MATERIAL | PROMPT | DIRECAO_VISUAL | PRESET_AURA`, associado a `ConfiguracaoVisual`, que por sua vez está ligado a `Card` — não há uma classe de configuração por tipo de card.
- **Diagrama de Sequência:** `AIArtworkService.generateArtwork(configuration)` e `ContextAnalysisService` são chamados da mesma forma, independentemente da origem do conteúdo (`ConteudoDoCard`).

Logo, qualquer preset AURA ou material proposto aqui **precisa funcionar igualmente bem** sobre uma peça isolada, um esquema completo de vestimenta ou um registro de DNA de Estilo — a curadoria não pode assumir contexto de peça única.

Dentro de `ModoArteIA`, dois ramos concentram decisão de *conteúdo visual* (em vez de geração livre por prompt):

| Modo | Diagrama de Atividades | Papel |
|---|---|---|
| `MATERIAL` ("Camada de material") | "Selecionar uma camada de material" → "Enviar a seleção ao serviço de IA" | Textura/superfície aplicada ao background |
| `PRESET_AURA` ("Preset Aura") | Alternativa a "Direção recomendada": "Sistema apresenta os presets Aura" → "Usuário seleciona um preset" → "IA gera a arte de background" | Direção visual/cromática pronta, sem exigir prompt |

Este documento propõe o **catálogo de conteúdo** para esses dois ramos — hoje representados no código apenas como esqueleto genérico (`presetAura: String [0..1]`, `material: String [0..1]` em `ConfiguracaoArteIA`).

> **Importante — Material e Preset Aura NÃO são excludentes.** Ver seção 3.3: o usuário pode combinar livremente qualquer preset AURA com qualquer material, à sua escolha. A matriz da seção 5 é apenas a combinação **padrão sugerida pela IA**, não uma restrição de uso.

---

## 2. Fundamentação em teoria de moda e design

As escolhas abaixo não são arbitrárias; seguem três eixos de teoria de moda/design amplamente usados em curadoria visual e styling:

**a) Teoria da cor aplicada a moda**
- **Roda de cores (Itten):** combinações **análogas** (harmonia, sofisticação), **complementares** (contraste, impacto editorial) e **monocromáticas** (minimalismo, luxo discreto) foram usadas deliberadamente em cada preset — nunca combinações aleatórias.
- **Paletas sazonais (color analysis / "estações" usadas em styling pessoal e moda):** *Spring* (quente, claro, vívido), *Summer* (frio, suave, empoeirado), *Autumn* (quente, terroso, profundo), *Winter* (frio, saturado, alto contraste). Cada AURA abaixo é ancorada em uma dessas famílias, o que garante coerência quando a IA cruzar a paleta do preset com a paleta das peças do usuário (`ConfiguracaoBackground`/`ContextAnalysisService.analisarCard`).

**b) Teoria têxtil (fibra, construção, caimento, acabamento)**
Cada material tem correspondência com uma **fibra e construção real** (tecido plano vs. malha, peso leve/médio/pesado, caimento estruturado vs. fluido, acabamento fosco vs. acetinado). Isso substitui nomes genéricos do catálogo atual (`lego_material`, `water_material`) por comportamento de tecido real, mapeável nos parâmetros já existentes em `FabricMaterialConfig` (`density`, `threadDirection`, `threadThickness`, `embossIntensity`, `surfaceContrast`, `finish`).

**c) Arquétipos de estilo (curadoria/visual merchandising)**
Cada preset e material é ancorado em um arquétipo de moda reconhecível — *Alfaiataria Clássica, Minimalismo Editorial, Romântico, Boêmio, Streetwear, Avant-garde, Esportivo/Athleisure, Glam de Noite, Dark Academia, Natural/Sustentável* — os mesmos vocabulários já usados no projeto (`ArtworkStylePreset`: `editorial_fashion`, `luxury_minimal`, `futuristic_sport`, `streetwear`, `monochrome_premium`; e `wearstyles`: `Statement Piece`, `Street Core`, `Trend Driver` etc.), garantindo que a proposta se encaixe no vocabulário estilístico que o sistema já usa para inferir estilo.

---

## 3. Proposta A — Presets AURA (com e sem GIF)

### 3.1 Relação com o sistema AURA existente

O código já possui um sistema chamado **Aura** (`app/lib/aura-system.ts`), mas com propósito de **gamificação por engajamento** (`RAW → NOTICED → RISING → HEAT → VIBRANT → ICONIC → LEGENDARY`, escalonado por número de likes) e presets de gradiente animado em `OutfitBackgroundStudioModal.tsx` (`GIF_GRADIENT_PRESETS`, categorias `aura / heat`, `aura / vibrant`, `aura / iconic`, `aura / legendary`).

Isso **não deve ser confundido** com o ramo `PRESET_AURA` do RF11, que é uma **escolha direta de direção visual de moda** feita pelo usuário — independente de likes — dentro de `Arte com IA`. A proposta abaixo:

- **Mantém** o sistema de engajamento (`aura-system.ts`) intocado — ele resolve outro problema (recompensa social).
- **Introduz** um catálogo próprio de `PRESET_AURA`, ancorado em arquétipo de moda + paleta sazonal, para o campo `presetAura` de `ConfiguracaoArteIA`.
- **Reaproveita a infraestrutura técnica** já pronta: os *keyframes* CSS (`aura-heat-pulse`, `aura-vibrant-rotate`, `aura-iconic-shimmer`, `aura-legendary-holo`, `aura-particle-float`) e o padrão `GifGradientPreset` (`type`, `angle`, `stops`, `image?`) já implementados — cada preset abaixo tem uma **versão estática** (aplicada direto ao `background_mode: 'gradient'`) e uma **versão GIF** (mesma paleta + animação), replicando exatamente o toggle que já existe (`dynamicBackground` / "Ative a Aura para animar como GIF").

### 3.2 Material e Preset Aura são combináveis, não alternativos

Lidos ao pé da letra, os diagramas de Atividades e de Máquina de Estados modelam `ModoArteIA` como **uma escolha única** por geração: "Qual recurso de IA?" abre um leque de ramos mutuamente exclusivos (`Camada de material` **|** `Prompt` **|** `Direção visual` **|** `Preset Aura`), todos convergindo no mesmo `Gerando arte` → `Arte aplicada`. Interpretado assim, escolher `Preset Aura` e escolher `Camada de material` seriam de fato alternativas — como a pergunta original aponta.

**Isso não é como o material já funciona na implementação atual**, e não é como material e cor/mood funcionam em moda real:

- **No código (`app/lib/outfit-card.ts`):** `materialLayer` é um campo **independente** de `background_mode`. `applyFabricMaterialToCard()` só *adiciona* `materialLayer` à config existente — nunca substitui `ai_artwork`, `gradient` ou `solid_color`. Ou seja, hoje já é tecnicamente possível aplicar um material por cima de um artwork gerado por IA (incluindo um preset Aura).
- **Em teoria têxtil/design de moda:** tecido e direção cromática nunca são "ou/ou" — toda peça tem simultaneamente um tecido (linho, cetim, veludo...) **e** uma paleta/mood. Tratar "Camada de material" como alternativa a "Preset Aura" no seletor de recurso da IA contraria a própria lógica de design que este documento usa para justificar os presets.

**Recomendação:** desacoplar `material` das demais opções de `ModoArteIA` no seletor de "Qual recurso de IA?" — ele deixa de ser um ramo alternativo e passa a ser uma **camada sempre disponível**, aplicável em cima de qualquer resultado de `Prompt`, `Direção visual recomendada` ou `Preset Aura`, exatamente como `materialLayer` já se comporta hoje. Na prática:

- O usuário escolhe **um** preset AURA (ou prompt, ou direção recomendada) para a *cor/gradiente/textura de base* do background.
- Em seguida, **opcionalmente**, escolhe **um** material da tabela da seção 4 para aplicar como *acabamento de superfície* sobre esse background — combinação livre, sem restrição.
- A matriz da seção 5 permanece útil, mas só como **sugestão automática** (o que a IA pré-seleciona ao recomendar uma direção visual) — nunca como bloqueio à escolha manual.

Isso não exige nenhuma classe nova: `ConfiguracaoVisual` já tem `ConfiguracaoArteIA` (para o preset/prompt/direção) e `ConfiguracaoContainer`/`materialLayer` como campos irmãos dentro do mesmo agregado — a mudança é apenas de **UX/fluxo** (material sai de dentro do seletor de recurso e vira um passo adicional, sempre visível), não de modelo de dados.

### 3.3 Catálogo proposto (10 presets)

| ID proposto | Nome | Arquétipo de moda | Paleta (teoria) | Estação/ocasião | Versão estática | Versão GIF |
|---|---|---|---|---|---|---|
| `aura_alfaiataria` | **Tailored Steel** | Alfaiataria clássica / quiet luxury | Monocromática fria: `#0f172a → #334155 → #cbd5e1` | Inverno · formal/corporate | Linear 135°, baixo contraste | Sweep de luz fina (reflexo de lã fria sob luz de estúdio) — amplitude baixa, 8s |
| `aura_editorial_mono` | **Editorial Ivory** | Minimalismo editorial | Monocromática quente-neutra: `#f5f2ea → #d8d0c0 → #a8977c` | Verão suave · editorial/campanha | Linear 120°, baixíssima saturação | "Respiração" de brilho (±4% de luminosidade), 6s — reforça leiturabilidade em vez de chamar atenção |
| `aura_romantico_petala` | **Petal Bloom** | Romântico/feminino | Análoga quente-suave: `#fbe7ea → #f5c9d6 → #e9a6c2` | Primavera · ocasião social/romântica | Radial, foco suave | Reaproveita `aura-particle-float`: partículas subindo como pétalas |
| `aura_boemio_terracota` | **Terracotta Dune** | Boêmio | Análoga terrosa quente (outono): `#7c2d12 → #c2703d → #e8b06a` | Outono · casual/festival | Radial (sunset), alta intensidade | Drift horizontal lento, como calor sobre areia |
| `aura_streetwear_neon` | **Concrete Neon** | Streetwear/urbano | Complementar de alto contraste: `#0f172a → #06b6d4 / #ec4899` | Todo o ano · rua/urbano | Linear diagonal 115°, blocos duros (`shape: beams`) | Scan-line neon (pulso rápido, 2.5s) |
| `aura_avantgarde_cromo` | **Chrome Iridescent** | Avant-garde / futurista | Fria iridescente: `#1e1b4b → #6366f1 → #a5b4fc → #e0e7ff` | Inverno · editorial/vanguarda | Cônica, alto contraste | `hue-rotate` contínuo (holográfico frio, distinto do dourado "Legendary" já existente) |
| `aura_esportivo_performance` | **Performance Pulse** | Esportivo/athleisure | Complementar energética: `#082f49 → #0ea5e9 / #a3e635` | Todo o ano · sport/ativewear | Linear diagonal, `shape: beams` | Sweep diagonal rápido (simula movimento/velocidade) |
| `aura_glam_noite` | **Midnight Spotlight** | Glam de noite / red carpet | Monocromática escura + acento joia: `#020617 → #78350f → #d97706` (ou acento `#7f1d1d` para versão "ruby") | Inverno · evento/noite | Radial (spotlight), alto contraste | Reaproveita `aura-iconic-shimmer`, mas paleta redirecionada para "spotlight de passarela" |
| `aura_dark_academia` | **Ivy Library** | Dark academia | Análoga quente-escura: `#1c1917 → #451a03 → #78350f` com acento verde-floresta `#14532d` | Outono/inverno · editorial intelectual | Linear 140°, baixa luminosidade | Flicker suave (like vela), amplitude muito baixa, 5s |
| `aura_natural_organico` | **Raw Linen** | Natural / sustentável | Neutra fria-terrosa (linho cru): `#78716c → #a8a29e → #e7e5e4` | Primavera/verão · casual consciente | Linear 150°, saturação mínima | "Respiração" muito sutil — evoca tecido ao vento |

**Notas de implementação (não bloqueantes para esta proposta, apenas mapeamento):**
- Cada linha acima vira um `GifGradientPreset` (para a versão GIF) **e** uma entrada equivalente em `GRADIENT_PRESETS`/`presetAura` estático — reaproveitando os tipos já existentes em `OutfitBackgroundStudioModal.tsx`, sem quebrar `BackgroundStudioFamily` (`pattern_surface | minimal_luxury | editorial_branding | geometry | custom`).
- O campo `ConfiguracaoArteIA.presetAura` recebe o `id` da tabela; `ConfiguracaoArteIA.status` controla `NAO_INICIADA → GERANDO → APLICADA` como já modelado.
- "Com ou sem GIF" = um único booleano por preset (equivalente ao `dynamicBackground` que já existe), não exige novo modo em `ModoArteIA`.

---

## 4. Proposta B — Materiais (Camada de material)

### 4.1 Problema do catálogo atual

`app/lib/materialPresets.ts` define hoje: `none`, `embroidered_fabric`, `lego_material`, `glass_material`, `water_material`. Dois desses nomes (`lego_material`, `water_material`) não correspondem a nenhum tecido real — quebram a coerência de moda pedida (não existe "material lego" em teoria têxtil) e limitam a curadoria da IA, que precisa justificar a escolha do material a partir do estilo das peças (`ContextAnalysisService`).

### 4.2 Catálogo proposto (10 materiais, com parâmetros sugeridos para `FabricMaterialConfig`)

| ID proposto | Nome / fibra-construção real | Caimento & acabamento (teoria têxtil) | `density` | `threadDirection` | `threadThickness` | `embossIntensity` | `finish` | Arquétipo / ocasião |
|---|---|---|---|---|---|---|---|---|
| `linho_natural` | Linho natural (tecido plano, fibra vegetal) | Leve, respirável, leve irregularidade de fio (slub) | 35 | horizontal | 2.0 | 30 | matte | Natural, verão, casual consciente |
| `la_fria_alfaiataria` | Lã fria / worsted (twill fino) | Estruturado, caimento firme, superfície lisa | 70 | diagonal | 1.6 | 20 | matte | Alfaiataria clássica, corporate |
| `cetim_liquido` | Cetim / satin weave | Fluido, brilho direcional, altíssimo caimento | 90 | horizontal | 0.8 | 15 | satin | Glam de noite, editorial |
| `veludo_profundo` | Veludo (pile weave) | Pelo denso, sombra direcional, textura tátil | 120 | vertical | 3.4 | 85 | satin | Dark academia, luxo noturno |
| `denim_selvagem` | Denim selvedge (twill grosso) | Rígido, textura diagonal marcada, robusto | 100 | diagonal | 3.8 | 55 | matte | Streetwear, casual urbano |
| `tweed_boucle` | Tweed bouclé (fio laçado) | Textura irregular em loops, volumoso | 115 | cross | 3.0 | 70 | matte | Dark academia, clássico editorial |
| `organza_translucida` | Organza (tecido plano, fio fino, sheer) | Rígido porém transparente, brilho sutil | 20 | horizontal | 0.5 | 10 | satin | Romântico, noiva, editorial leve |
| `couro_nappa` | Couro nappa (curtimento macio) | Superfície lisa, reflexo controlado, estrutura firme | 80 | cross | 1.2 | 40 | satin | Streetwear premium, avant-garde |
| `malha_canelada` | Malha canelada / rib knit | Elástica, linhas verticais regulares, tátil suave | 60 | vertical | 1.8 | 35 | matte | Esportivo/athleisure, natural |
| `laminado_metalico` | Lamê / laminado metálico | Reflexivo, rígido, alto brilho | 95 | diagonal | 1.0 | 60 | satin | Glam, Y2K, futurista |

**Compatibilidade com o catálogo atual:**
- `embroidered_fabric` **permanece** (já é coerente: tecido bordado real) e passa a ser reclassificado como uma variação de `tweed_boucle`/`linho_natural` com bordado sobreposto (`decorativeOverlayLayer.stitchBorder`), sem quebrar cards já salvos.
- `glass_material` é **reinterpretado** como `organza_translucida` (o comportamento visual — translucidez, brilho satin, baixa densidade — já é o mesmo; só o nome deixa de ser fantasioso).
- `lego_material` e `water_material` são **descontinuados em favor de** `couro_nappa`/`denim_selvagem` (estrutura/contraste) e `cetim_liquido` (fluidez), respectivamente — mantendo os `id`s antigos como *alias* de compatibilidade retroativa (nenhum card existente quebra).

---

## 5. Matriz de coerência AURA × Material × Arquétipo

Para a etapa "IA analisa: Histórico do usuário / Tendências / Popularidade / Opções mais utilizadas" (Diagrama de Atividades) e `ContextAnalysisService.analisarCard` (Diagrama de Sequência) recomendarem uma combinação **visualmente coerente**, propõe-se esta matriz como **default sugerido pela IA** — não como restrição. O usuário pode escolher qualquer preset AURA e qualquer material da seção 4 de forma independente, em qualquer combinação; a IA só usa esta matriz para pré-selecionar algo coerente quando ele não escolhe manualmente.

| Arquétipo | Preset AURA | Material recomendado | Racional |
|---|---|---|---|
| Alfaiataria clássica | `aura_alfaiataria` | `la_fria_alfaiataria` | Mesma família cromática fria monocromática + tecido estruturado |
| Minimalismo editorial | `aura_editorial_mono` | `organza_translucida` ou nenhum material | Prioriza legibilidade; material só se não competir com o conteúdo |
| Romântico/feminino | `aura_romantico_petala` | `organza_translucida` ou `cetim_liquido` | Fluidez + luminosidade suave, paleta análoga quente |
| Boêmio | `aura_boemio_terracota` | `linho_natural` ou `tweed_boucle` | Textura orgânica, paleta terrosa outonal |
| Streetwear | `aura_streetwear_neon` | `denim_selvagem` ou `couro_nappa` | Alto contraste + textura robusta urbana |
| Avant-garde/futurista | `aura_avantgarde_cromo` | `laminado_metalico` | Reflexo e frieza cromática reforçam o mesmo eixo |
| Esportivo/athleisure | `aura_esportivo_performance` | `malha_canelada` | Elasticidade visual + energia cromática |
| Glam de noite | `aura_glam_noite` | `cetim_liquido` ou `veludo_profundo` | Brilho/drama compatível com spotlight |
| Dark academia | `aura_dark_academia` | `tweed_boucle` ou `veludo_profundo` | Paleta quente-escura + textura tátil clássica |
| Natural/sustentável | `aura_natural_organico` | `linho_natural` | Mesma família neutra-terrosa, coerência total |

Essa matriz também resolve a regra de negócio já anotada no diagrama de classes ("Background é a camada externa. A cor do container interno é mantida separadamente") — o material/AURA atua **apenas no background externo**, nunca no `ConfiguracaoContainer`, preservando a separação de camadas já modelada.

---

## 6. Como isso se encaixa no fluxo sem alterar a lógica existente

1. **Diagrama de Atividades / Sequência:** as etapas `Selecionar uma camada de material` e `Sistema apresenta os presets Aura` continuam existindo; o **conteúdo das listas** exibidas passa a vir deste catálogo. A única mudança de fluxo (seção 3.2) é que material deixa de ser um ramo alternativo dentro de "Qual recurso de IA?" e passa a ser um passo adicional/opcional, aplicável depois de qualquer recurso escolhido (material + preset Aura, material + prompt, etc.).
2. **Diagrama de Classes:** nenhum atributo novo é necessário — `ConfiguracaoArteIA.material` e `ConfiguracaoArteIA.presetAura` já são `String [0..1]` cada, ou seja, já são campos independentes e podem estar preenchidos ao mesmo tempo; recebem os `id`s propostos.
3. **Diagrama de Estados:** os estados `Camada de material` e `Preset Aura selecionado` deixam de ser mutuamente exclusivos sob "Selecionando recurso da IA" — material passa a ser alcançável a partir de qualquer um dos outros ramos, todos ainda convergindo em `Gerando arte` → `Arte aplicada`.
4. **Diagrama de Componentes:** `AIArtworkService.gerarArte(config)` e `ContextAnalysisService` continuam sendo os únicos pontos de integração; o catálogo pode viver como dado estático (similar a `MATERIAL_PRESETS` e `GIF_GRADIENT_PRESETS` hoje) sem exigir novo componente.

---

## 7. Resumo executivo

- **10 presets AURA** (estático + GIF cada), ancorados em arquétipos de moda reais e paletas sazonais de teoria da cor — substituindo o vazio atual do campo `presetAura`.
- **10 materiais** ancorados em fibra/construção têxtil real — substituindo nomes não-têxteis (`lego_material`, `water_material`) por tecidos existentes na indústria da moda, com parâmetros técnicos prontos para os campos já existentes em `FabricMaterialConfig`.
- **Matriz de coerência** ligando arquétipo → preset → material, usada apenas como **sugestão padrão da IA** (`recommendVisualDirection`) — o usuário sempre pode combinar qualquer preset AURA com qualquer material manualmente (seção 3.2).
- **Mudança mínima de fluxo:** material deixa de ser alternativa a Preset Aura/Prompt/Direção recomendada dentro de "Qual recurso de IA?" e passa a ser uma camada adicional aplicável por cima de qualquer um deles — sem novos atributos ou classes, só desacoplando uma decisão de UX.
