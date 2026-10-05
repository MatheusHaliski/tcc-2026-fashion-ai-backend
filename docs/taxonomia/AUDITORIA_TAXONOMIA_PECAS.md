# Auditoria da taxonomia de peças e proposta de variações

> **Status:** auditoria + proposta (RASCUNHO). Nenhum arquivo existente foi alterado, nenhuma migration foi criada no código, nada foi commitado.
> **Data:** 2026-10-05 · **Base:** branch `claude/adaptive-garment-capture` (= `main`), Flyway até V37, `normalization.json` 1.1.0.
> **Entregáveis:** este documento + `docs/taxonomia/proposta/` (`taxonomia_variacoes.csv`, `taxonomia_variacoes.json`, `seed_piece_variations.sql`).

## Resumo executivo

- **Taxonomia atual.** São **5 categorias e 78 subcategorias**, sem nenhum nível abaixo da subcategoria.
  - Está definida **duas vezes**: em `Taxonomy.java` e em `normalization.json → taxonomy`. O `CatalogNormalizerTest` mantém as duas iguais.
  - Os rótulos estão em **duas tabelas paralelas**: `messages*.properties` e `lib/api/labels-*.ts`.
- **Conceitos misturados dentro das subcategorias:**
  - comprimento: `crop_top`, `bermuda_shorts`, `culottes`/pantacourt;
  - cano: `high_top_sneakers`, `ankle_boots`, `long_boots`;
  - uso/esporte: `running_shoes`, `training_shoes`, `basketball_shoes`, `skate_shoes`;
  - material: `jeans`, `denim_shorts`;
  - salto: `heels`;
  - composição: `matching_set`.
- **Sinônimos que escondem variações.** "chelsea boot" → `ankle_boots`, "bomber" → `jacket`, "trench coat" → `coat`, "bucket hat" → `hat`. Já "bootcut" é **descartado** como modificador.
- **A proposta não cria taxonomia paralela.** Mantém os 78 códigos existentes (`lower_snake_case`) e acrescenta dois níveis:
  1. **VARIAÇÃO** — valor único, opcional (`null` = não informado) e restrito por subcategoria.
     - **394 variações únicas** e **541 vínculos** subcategoria × variação.
     - Por nível: **244 CORE / 216 EXTENDED / 81 NICHE**.
     - Uma mesma variação pode valer para várias subcategorias (relação N:N).
  2. **30 dimensões de atributo** com `appliesTo` (387 valores).
     - 9 já existem no código e são reaproveitadas com os mesmos códigos: cor, material, estampa, posição do logo, estilo, ocasião, gênero etc.
     - 21 são novas: caimento, cintura, comprimento, manga, decote, fechamento, acabamento, uso, cano, salto, bico, solado e outras.
- **Contrato de IA.**
  - Só vocabulário fechado. O texto livre é normalizado por alias dentro da subcategoria: "wide jeans" → `jeans.WIDE_LEG`.
  - Sem confiança suficiente, o resultado é `UNKNOWN` ou vai para revisão.
  - A cardinalidade atual não muda: peça ≤2 estilos e ≤2 ocasiões; esquema ≤3 e ≤3.
- **Backfill estimado no acervo real (9.573 produtos):**
  - 19,7% dos nomes já trazem a variação por alias (1.890 produtos);
  - somando a descrição, 29,5% (2.827), com confiança menor;
  - em `jeans`, 66% (486 de 733).
- **Validação do seed SQL.**
  - Rodado num schema descartável em **MySQL 8.0.46 local**, incluindo o bloco V40 (colunas + FK composta) e o rollback.
  - A FK recusou `casual_sneakers + CHELSEA`, como esperado.
  - O container `fai-mysql` não estava disponível (daemon Docker desligado).

---

## A. A taxonomia atual

### A.1 Árvore CATEGORY → SUBCATEGORY (oficial, 78 subcategorias)

| Categoria (código · rótulo pt-BR) | Nº | Subcategorias (código) | No acervo |
|---|---|---|---|
| `upper_piece` · Parte superior | 18 | t_shirt, shirt, blouse, tank_top, crop_top, polo_shirt, bodysuit, sweater, sweatshirt, hoodie, cardigan, vest, blazer, jacket, coat, parka, windbreaker, kimono | 3.769 |
| `lower_piece` · Parte inferior | 14 | jeans, tailored_pants, casual_pants, chino_pants, cargo_pants, jogger_pants, sweatpants, leggings, culottes, shorts, bermuda_shorts, denim_shorts, skirt, skort | 2.206 |
| `shoes_piece` · Calçados | 18 | casual_sneakers, running_shoes, training_shoes, basketball_shoes, skate_shoes, high_top_sneakers, loafers, moccasins, oxford_shoes, derby_shoes, ankle_boots, long_boots, combat_boots, sandals, flip_flops, heels, flats, espadrilles | 1.383 |
| `accessory_piece` · Acessórios | 23 | handbag, crossbody_bag, tote_bag, clutch, backpack, belt, cap, hat, beanie, scarf, tie, bow_tie, sunglasses, eyeglasses, necklace, bracelet, earrings, ring, watch, wallet, gloves, socks, hair_accessory | 1.784 |
| `full_body_piece` · Peça única | 5 | dress, jumpsuit, romper, matching_set, overalls | 431 |

Acervo oficial `data/catalog/acervo/acervo-oficial-2026-10-05.jsonl.gz`:
- 9.573 produtos de 45 marcas;
- **75 das 78 subcategorias** presentes; ausentes: `windbreaker`, `culottes`, `long_boots`;
- maiores: t_shirt (1.322), jeans (733), shirt (558), casual_pants (476), jacket (437).

### A.2 Onde vive cada parte

| Parte | Onde (arquivo) | Observação |
|---|---|---|
| Categorias, subcategorias, cores (59 + família + hex), materiais (7), tamanhos, sexos, ocasiões (20), estilos (25), mercado | `fai-application/.../taxonomy/Taxonomy.java` | Constantes estáticas. Não lê o `normalization.json`. |
| Validação da peça + cardinalidade (peça ≤2 / esquema ≤3) | `Taxonomy.pieceErrors`, `requireTags`, `MAX_PIECE_TAGS=2`, `MAX_SCHEME_TAGS=3` | Mensagens `taxonomy.peca.*` / `taxonomy.look.*`. |
| Ocasiões por categoria | `Taxonomy.WEARSTYLE_GROUPS` + `WEARSTYLES_BY_PART` → `allowedOccasions()` | Exposto como `allowedOccasionsByCategory` e `wearstylesByPart`. O próprio código diz "proposta a validar". |
| Conjuntos especiais | `Taxonomy.SNEAKERS`, `Taxonomy.RIGID_SUBCATEGORIES` (FASHN.ai × compositor) | Listas fixas no código. |
| Fonte compartilhada Java + Python | `fai-application/src/main/resources/catalog/normalization.json` | `taxonomy`, `categorySynonyms`, `subcategorySynonyms`, `colorSynonyms`, `materialSynonyms`, `genderSynonyms`, `brandAliases`, `stopwords`, `design` (patterns, placements, sizes, sides…). |
| Leitura Java do JSON | `catalog/CatalogNormalizer.java` (singleton), `CatalogDesignInterpreter.java` | `CatalogNormalizerTest` exige `taxonomy` == `Taxonomy.java`. |
| Leitura Python do JSON | `scripts/catalog/normalize_product.py`; `providers/official_sitemap.py` (`infer_subcategory`, `MODIFIERS`, `UNSUPPORTED`, `clean_title`) | O tipo vem do nome do produto, nunca da descrição. |
| API | `GET /api/taxonomy` (`WardrobeController` → `WardrobeService.taxonomy()`) | subcategories, colors, colorFamilies, materials, sizes, sexes, occasions, styles, marketSeasons/Genders, allowedOccasionsByCategory, wearstylesByPart, wearstyleGroups, defaultImages, defaultImagesBySubcategory, brands. |
| Banco: peça pessoal | `wardrobe_items` (V1; V2 `brand_id`, `tags`…; V30 `catalog_product_id`) | `category`, `subcategory`, `color`, `material`, `sex`, `size_label`, `style_tags`, `occasion_tags` (JSON em VARCHAR), `price` (sem moeda). |
| Banco: produto global | `catalog_products` (V30; V36 `description`, `design_json`) + `catalog_variants` (cor/SKU) | Sem estilo, ocasião ou preço. Estampa só dentro de `design_json`. |
| Outras colunas `subcategory` | `capture_sessions`, `piece_images.detected_subcategory`, `garment_embeddings.subcategory`, `kb_product_models.subcategory`, regras de selo (`SealPolicies`) | Todas VARCHAR livres, sem FK. |
| Enums de domínio | `fai-domain/.../model/enums/` | **Não há** enum de categoria/subcategoria/material/cor/estilo/ocasião. Só `IdentificationLevel` (CATEGORY, SUBCATEGORY, BRAND, PRODUCT_LINE, MODEL, **VARIANT**). |
| Front: dados | `lib/api/taxonomy.ts` (`useTaxonomy` → `/api/taxonomy`, `CATEGORY_KEYS`, `label()`), `lib/api/types.ts` | Não existe `lib/taxonomy.ts`, apesar de o javadoc de `Taxonomy.java` (linha 13) citá-lo. |
| Front: rótulos | `lib/api/labels-pt.ts`, `labels-en.ts`, `labels-es.ts` | Duplicam `taxonomy.*` de `fai-application/src/main/resources/i18n/messages*.properties` (254 chaves por idioma). |
| Front: formulário da peça | `components/piece-form.tsx` (selects categoria → subcategoria; ocasião filtrada por `allowedOccasionsByCategory`), `components/multi-piece-review.tsx` | Sem variação e sem atributos estruturais. |
| Front: busca catalogada | `components/catalog/catalog-search.tsx`, `category-cards.tsx`, `lib/capture/capture-guides.ts` (`CATEGORY_CARDS`) | Cards de categoria → chips de subcategoria → marca → texto → chips de cor/gênero (só sobre o resultado). |
| Front: filtros | `closet/page.tsx` (category, color, season, occasion, style, state, hypeLevel); `explorer/page.tsx` (category, color, season, hype); `try-on/page.tsx` (chips de categoria) | Nenhum filtra por subcategoria ou material. |
| IA de visão | `WardrobeService.ANALYZER_SYSTEM` + `analyzerPrompt()`; `parseAnalysis()` valida pela taxonomia; `imaging/LocalVision` (heurística local) | Folha de referência por subtipo: `fai-web/.../catalog/asset-manifest.json → defaultPieceImages.bySubcategory` (77/78; falta `wallet`), artes em `public/assets_pecas/`. |
| IA de texto | `catalog/CatalogTextInterpreter.SYSTEM` (só estampa/logo/lados/cores); `CopilotService.TYPE_WORDS` + `CopilotLexicon.TYPE_PREFIXES` | O Copilot tem **outra** lista de palavras → subcategoria. |
| Captura | `vision/capture/CaptureProfiles.java` | Agrupa subcategorias por perfil de foto (PANTS, BOOT…). |
| Ranking da busca | `CatalogMatchScorer` | Pesos: W_BRAND 0.25, W_CATEGORY 0.10, W_SUBCATEGORY 0.20, W_TEXT 0.35, W_COLOR 0.10, W_VISUAL 0.15, W_DESIGN 0.45. |
| Hype Score | `HypeSnapshotService` linha 132 | Chave do "modelo" = `category\|subcategory\|brand` (raridade e semelhantes). |

---

## B. Problemas encontrados (com evidência)

### B.1 Duplicidade de fontes e de rótulos

1. **Taxonomia definida duas vezes.** `Taxonomy.java` (estático) e `normalization.json → taxonomy` só ficam iguais porque um teste obriga (`CatalogNormalizerTest`). Qualquer expansão tem de ser escrita duas vezes.
2. **Rótulos em 3 lugares × 3 idiomas.** `messages*.properties` (`taxonomy.*`, 254 chaves) e `lib/api/labels-{pt,en,es}.ts`. Já há divergência: o front tem `linen: "Linho"`, mas `LINEN` não existe em `Taxonomy.MATERIALS` nem em `materialSynonyms`.
3. **Sinônimos de subcategoria em listas paralelas.** `normalization.json → subcategorySynonyms` convive com `CopilotService.TYPE_WORDS`, `CopilotLexicon.TYPE_PREFIXES` e os agrupamentos de `CaptureProfiles`.
4. **Documentação defasada.** O javadoc de `Taxonomy.java` diz "Espelhada no frontend em lib/taxonomy.ts", mas o arquivo não existe (o front consome `/api/taxonomy`).
5. **Alias repetido.** `subcategorySynonyms.loafers = ["loafer","loafers","mocassim social","loafer"]`.

### B.2 Conceitos misturados na subcategoria (eixos que deveriam ser atributo)

| Subcategoria | Eixo misturado | Consequência | Proposta |
|---|---|---|---|
| `crop_top` | comprimento | "cropped" é alias de `crop_top`, mas o termo vale também para calça, jaqueta e moletom | Manter o código; `LENGTH=CROPPED` implícito. |
| `bermuda_shorts` | comprimento | Bermuda × short é só comprimento | Manter; `LENGTH=KNEE_LENGTH` implícito. |
| `culottes` (alias "pantacourt") | comprimento | — | Manter; `LENGTH=CAPRI` implícito. |
| `high_top_sneakers` | altura do cano | Um Chuck Taylor alto e um baixo caem em subcategorias diferentes | Manter; `SHAFT_HEIGHT=HIGH_TOP` implícito. Candidata a alias (decisão I-2). |
| `ankle_boots`, `long_boots` | altura do cano | Uma texana pode ser curta ou alta | Manter; `SHAFT_HEIGHT` implícito. COWBOY, ENGINEER, RAIN, SOCK_BOOT e SNOW valem para ambas (N:N). |
| `combat_boots` | estilo/construção | — | Manter; variações MILITARY/TACTICAL/JUNGLE; `SOLE_TYPE=LUG_SOLE` implícito. |
| `running_shoes`, `training_shoes`, `basketball_shoes`, `skate_shoes` | uso/esporte | Esporte virou subcategoria | Manter; `USAGE_TYPE` implícito. Nenhuma variação nova por esporte. |
| `jeans`, `denim_shorts` | material | `denim_shorts` sobrepõe `shorts`/`bermuda_shorts` | Manter; `MATERIAL_DETAIL=DENIM` implícito. |
| `heels` | altura/tipo de salto | Inclui sandália de salto (alias "sandalia de salto") | Manter. As variações descrevem o cabedal (PUMP, SLINGBACK, HEELED_SANDAL…); o salto vai para `HEEL_HEIGHT`/`HEEL_TYPE`. |
| `matching_set` | composição | Não é silhueta | Variações SUIT, TRACKSUIT, CO_ORD… |
| `scarf`, `hair_accessory` | pacote de tipos | "cachecol", "lenço" e "echarpe" juntos | As variações separam os tipos. |
| `flip_flops` × `sandals` | sobreposição | "chinelo slide" pode cair em qualquer uma | Variação `SLIDE` liga às duas; decidir a canônica (I-3). |
| `jogger_pants` × `sweatpants` | sobreposição | Calça de moletom com punho ≈ jogger | `sweatpants.CUFFED_JOGGER` documenta a sobreposição. |
| `loafers` × `moccasins` | nomenclatura | No varejo BR, "mocassim" quase sempre é loafer | Aliases; decisão I-4. |

### B.3 Sinônimos que escondem ou descartam variação (`normalization.json`, `official_sitemap.py`)

- **Variação usada como sinônimo de subcategoria** (a informação some na ingestão):
  - "chelsea boot" → `ankle_boots`;
  - "bomber", "trucker jacket", "track jacket", "track top" → `jacket`;
  - "trench coat" → `coat`;
  - "bucket hat" → `hat`;
  - "baseball cap" → `cap`;
  - "scarpin" → `heels`;
  - "rasteira" → `sandals`;
  - "quarter zip"/"half zip"/"1/4 zip" → `sweatshirt` (suéteres também têm meio zíper);
  - "sling bag" → `crossbody_bag`;
  - "ballet flat" → `flats`.
- **Variação descartada.** `MODIFIERS` em `official_sitemap.py` (linha 260) remove "boot cut"/"bootcut" para não confundir com bota. Com isso, a modelagem bootcut nunca é registrada.
- **Termos com várias leituras:**
  - "denim" = alias de `jeans` **e** sinônimo de material `COTTON` **e** código de **cor** `denim`;
  - "tricot"/"tricô" = `sweater` **e** material `WOOL` (tricô é técnica, não fibra);
  - "cropped" → `crop_top`; "running" → `running_shoes`; "body" → `bodysuit`.
- **Materiais grosseiros e trocados.** Só existem 7 famílias.
  - `metal`, `aço`, `acetato` e `borracha` viram `SYNTHETIC`;
  - `denim`, `sarja`, `canvas`, `jersey` e `piquet` viram `COTTON` (tecido ≠ fibra);
  - "linho" não tem destino.
- **Cores com outros eixos dentro:**
  - estampa: `print`, `multicolor`;
  - acabamento: `washed_black`, `metallic_gold`/`metallic_silver`.
  - A paleta tem 59 códigos; parte deles não tem nenhum sinônimo em `colorSynonyms` (`washed_black`, `rose`, `amber`, `apricot`, `butter`, `metallic_*`, `bronze`).
- **Catch-all.** "calça", "pants" e "trousers" → `casual_pants`. Por absorver as calças sem tipo, ela é a 4ª maior subcategoria do acervo (476).

### B.4 Ocasiões restritas por categoria (achado com impacto direto)

`Taxonomy.java` (linhas 66–70), em `WEARSTYLES_BY_PART`:

| Categoria | Grupos permitidos | Ocasiões **proibidas** pela validação |
|---|---|---|
| `accessory_piece` | casual, esporte, praia, festa | **social, formal, business, wedding, ceremony, work**. Uma **gravata** (`tie`), gravata-borboleta ou relógio social não pode ser marcada "formal" nem "trabalho". |
| `lower_piece` | casual, social, esporte, trabalho, praia | party, night_out, festival. Uma saia de paetê não pode ser "festa". |
| `shoes_piece` | casual, social, esporte, festa, praia | work. Um sapato oxford não pode ser "trabalho" (só "business", via social). |

O próprio código marca essa regra como "proposta a validar". Recomendação (decisão I-6): passar a regra para **subcategoria/variação**, por exemplo `tie`/`bow_tie` → social + trabalho. Assim a taxonomia nova não herda o bloqueio.

### B.5 Gaps front × back × banco × Python × IA

| Tema | Front | Back/API | Banco | Python | IA |
|---|---|---|---|---|---|
| Variação/modelagem | não existe | não existe | não existe | descarta (MODIFIERS) | não pede |
| Comprimento, cintura, manga, decote, fechamento, acabamento | não existe | não existe | não existe | `MODIFIERS` remove manga do nome | não pede |
| Estampa | não aparece na busca | `CatalogDesignInterpreter` (só catálogo) | `catalog_products.design_json` (V36); **ausente em `wardrobe_items`** | valida `design` | `CatalogTextInterpreter` (só texto da busca) |
| Estilo/ocasião | formulário e closet | validados | só `wardrobe_items` | — | analyzer (≤2) |
| Estilo/ocasião no catálogo | — | — | **ausentes** em `catalog_products` | — | — |
| Preço | campo livre na peça | `price` | `wardrobe_items.price` sem moeda; **ausente** em `catalog_products` | JSON-LD `offers` lido só para `url` (`official_sitemap.py` ~l.395) | — |
| Gênero | filtro **só no cliente** (`catalog-search.tsx` l.105) | `/api/catalog/search` **não recebe** gender | `catalog_products.gender` | `genderSynonyms` | `sex` |
| Material fino | — | 7 famílias | VARCHAR(40/80) | 7 famílias | 7 famílias |
| Subcategoria nos filtros | só na busca catalogada | — | indexada | — | ranking local de silhueta |

Outros pontos:
- **Colisão de nome.** `catalog_variants` e `IdentificationLevel.VARIANT` já usam "variant" para cor/SKU. O conceito novo deve se chamar **variation** (modelagem), nunca "variant".
- **Código morto.** `LocalVision.java` linha 105 compara `"jeans".equals(color)`, mas "jeans" não é código de cor (o código é `denim`). É inofensivo.
- **Prompt sem descrições.** `ANALYZER_SYSTEM` envia a lista de subtipos só como códigos, sem descrição nem exemplo. O modelo precisa adivinhar `loafers` × `moccasins`.
- **API de busca limitada.** `/api/catalog/search` só aceita `category, subcategory, brand, q, color, limit`.

### B.6 Atributos sem select (o que a pessoa não consegue filtrar hoje)

- **Busca catalogada:** sem variação, material, estampa, acabamento, comprimento, cintura, manga, decote, estilo, ocasião e preço. Gênero e cor só aparecem como chips extraídos do resultado atual, não como selects da consulta.
- **Closet:** sem subcategoria, material, marca, variação e preço.
- **Explorer:** sem subcategoria, material, estilo e ocasião.
- **Try-on:** só categoria.

---

## C. Nova taxonomia (CATEGORIA → SUBCATEGORIA → VARIAÇÃO)

### C.1 Princípios

1. **Códigos existentes intocados.** As 5 categorias e as 78 subcategorias continuam em `lower_snake_case` e viram chave natural das tabelas novas. `wardrobe_items.subcategory` e `catalog_products.subcategory` continuam válidos sem migração de dados.
2. **Variação = só estrutura** (corte, silhueta, modelagem, construção).
   - Uma por peça, opcional (`null`), sempre restrita à subcategoria pelo vínculo N:N.
   - Um mesmo código pode valer para várias subcategorias: `STRAIGHT` vale para jeans, alfaiataria, cargo e macacão; `MULE` para salto, sapatilha, loafer e alpargata.
   - Se o sentido muda, o código muda: `BIKER` (jaqueta perfecto) × `ENGINEER` (bota biker) × `BIKE_SHORT` (bermuda ciclista); `TRUCKER` (jaqueta) × `TRUCKER_CAP` (boné).
3. **Nunca são variação:** acabamento, comprimento, cintura, manga, decote, fechamento, uso/esporte, cor, material, estampa, estilo, ocasião e marca. Viram **dimensões de atributo** com `appliesTo` (seção D).
4. **Caimento.**
   - Em partes de baixo, o varejo nomeia a modelagem pelo caimento da perna (jeans SKINNY, SLIM, RELAXED…). Ali o caimento **é** a variação.
   - Em tops, outerwear e peças únicas, o caimento é ortogonal ao arquétipo (uma camisa western pode ser slim ou oversized). Por isso vira a dimensão `FIT` (SLIM_FIT, REGULAR_FIT, RELAXED_FIT, OVERSIZED_FIT, BOXY_FIT, MUSCLE_FIT).
   - Por isso camiseta e polo têm poucas variações: a diferença real delas está em FIT, NECKLINE, SLEEVE e PATTERN.
5. **Sem duplicidade semântica.** Um canônico, o resto vira alias:
   - WIDE / WIDE_LEG / WIDE_FIT → `WIDE_LEG`;
   - BARREL / HORSESHOE → `BARREL`;
   - FEDORA / PANAMÁ → `FEDORA` (panamá é fedora de palha toquilla; o material vai para `MATERIAL_DETAIL=STRAW`);
   - DROP / DANGLE → `DROP`;
   - CABLE / ARAN → `CABLE_KNIT`;
   - SLIP_ON é fechamento, não variação de tênis;
   - RAGLAN é manga; HENLEY e CAMP_COLLAR são decote/gola.
6. **Variação implica atributos.** O valor implícito é um padrão editável e nunca sobrescreve o que foi informado.
   - `sweatshirt.QUARTER_ZIP` → `CLOSURE=QUARTER_ZIP`, `NECKLINE=MOCK_NECK`;
   - `ankle_boots.CHELSEA` → `CLOSURE=SLIP_ON`;
   - `coat.TRENCH` → `CLOSURE=DOUBLE_BREASTED`.
   - Subcategorias legadas também implicam atributos: `high_top_sneakers` → `SHAFT_HEIGHT=HIGH_TOP`.
7. **Já são subcategoria (logo não viram variação):**
   - COMBAT (botas) = `combat_boots`;
   - CROSSBODY, TOTE, CLUTCH (bolsas) = `crossbody_bag`, `tote_bag`, `clutch`;
   - BACKPACK = `backpack`.
   - Variações de bolsa:
     - `crossbody_bag`: MESSENGER, CAMERA, BELT_BAG, SLING;
     - `handbag`: SHOULDER, HOBO, BUCKET, SATCHEL, BOWLING, BAGUETTE, SADDLE, BOX, DUFFEL, BRIEFCASE.
   - ANKLE, KNEE_HIGH e OVER_THE_KNEE (botas) viram valores de `SHAFT_HEIGHT`, porque `ankle_boots`/`long_boots` já codificam o cano.

### C.2 Árvore CORE / EXTENDED (NICHE só contado)

- **upper_piece** — Parte superior (18 subcategorias · 39 CORE / 41 EXTENDED / 16 NICHE)
  - `t_shirt` (Camiseta): CORE — · EXT BABY_TEE, POCKET_TEE · NICHE 1
  - `shirt` (Camisa): CORE DRESS_SHIRT, OVERSHIRT · EXT WESTERN, WORK_SHIRT · NICHE 4
  - `blouse` (Blusa): CORE PEASANT, WRAP, CAMISOLE · EXT TUNIC, CORSET, PEPLUM, RUFFLED, SMOCKED · NICHE 1
  - `tank_top` (Regata): CORE MUSCLE_TANK, RACERBACK, CAMISOLE · EXT — · NICHE 0
  - `crop_top` (Cropped): CORE BANDEAU, CORSET · EXT BABY_TEE, KNOT_FRONT, BRALETTE, WRAP · NICHE 0
  - `polo_shirt` (Camisa polo): CORE — · EXT KNIT_POLO, RUGBY · NICHE 1
  - `bodysuit` (Body): CORE — · EXT CORSET, WRAP, CUTOUT · NICHE 1
  - `sweater` (Suéter): CORE CHUNKY_KNIT, FINE_KNIT, CABLE_KNIT · EXT QUARTER_ZIP · NICHE 1
  - `sweatshirt` (Moletom): CORE CREWNECK, QUARTER_ZIP · EXT FULL_ZIP · NICHE 1
  - `hoodie` (Moletom com capuz): CORE FULL_ZIP, PULLOVER · EXT — · NICHE 1
  - `cardigan` (Cardigã): CORE CHUNKY_KNIT, FINE_KNIT, OPEN_FRONT · EXT CABLE_KNIT, BOLERO, WRAP · NICHE 0
  - `vest` (Colete): CORE PUFFER, WAISTCOAT, SWEATER_VEST · EXT UTILITY_VEST · NICHE 0
  - `blazer` (Blazer): CORE TAILORED, UNSTRUCTURED · EXT TUXEDO · NICHE 2
  - `jacket` (Jaqueta): CORE BIKER, BOMBER, PUFFER, TRUCKER, TRACK_JACKET · EXT QUILTED, VARSITY, CHORE, COACH, FIELD, HARRINGTON · NICHE 1
  - `coat` (Casaco): CORE OVERCOAT, PEACOAT, TRENCH, PUFFER, WRAP · EXT CAPE, CAR_COAT, COCOON, DUFFLE, RAINCOAT · NICHE 1
  - `parka` (Parka): CORE PUFFER, SNORKEL · EXT FISHTAIL, SHELL · NICHE 0
  - `windbreaker` (Corta-vento): CORE ANORAK · EXT SHELL, PACKABLE · NICHE 0
  - `kimono` (Quimono): CORE KIMONO_CARDIGAN · EXT ROBE_KIMONO · NICHE 1
- **lower_piece** — Parte inferior (14 subcategorias · 60 CORE / 47 EXTENDED / 17 NICHE)
  - `jeans` (Calça jeans): CORE REGULAR, SKINNY, SLIM, STRAIGHT, WIDE_LEG, BAGGY, BOOTCUT, BOYFRIEND, FLARE, LOOSE, MOM, RELAXED, TAPERED · EXT ATHLETIC, BARREL, CARPENTER, CARROT, CIGARETTE, DAD · NICHE 4
  - `tailored_pants` (Calça de alfaiataria): CORE SLIM, STRAIGHT, WIDE_LEG, CIGARETTE, PALAZZO, TAPERED · EXT BOOTCUT, CARROT, FLARE · NICHE 1
  - `casual_pants` (Calça casual): CORE SLIM, STRAIGHT, WIDE_LEG, PALAZZO, RELAXED, TAPERED · EXT BAGGY, FLARE, BARREL, CARPENTER, CARROT, CIGARETTE, LOOSE, PAPERBAG, PARACHUTE, SKINNY · NICHE 1
  - `chino_pants` (Calça chino): CORE SLIM, STRAIGHT, TAPERED · EXT RELAXED, WIDE_LEG · NICHE 1
  - `cargo_pants` (Calça cargo): CORE BAGGY, RELAXED, STRAIGHT, CUFFED_JOGGER, WIDE_LEG · EXT PARACHUTE, SLIM, TAPERED · NICHE 1
  - `jogger_pants` (Calça jogger): CORE RELAXED, SLIM · EXT CARGO_JOGGER · NICHE 0
  - `sweatpants` (Calça de moletom): CORE CUFFED_JOGGER, OPEN_HEM, WIDE_LEG · EXT BAGGY, TRACK_PANTS, FLARE · NICHE 0
  - `leggings` (Legging): CORE FLARE_LEGGING · EXT COMPRESSION, SEAMLESS, SCRUNCH · NICHE 1
  - `culottes` (Pantacourt): CORE WIDE_LEG · EXT PANTSKIRT · NICHE 1
  - `shorts` (Short): CORE BIKE_SHORT, CARGO, CHINO, TAILORED, VOLLEY · EXT BOARD, MOM, BOYFRIEND, PAPERBAG, RELAXED · NICHE 1
  - `bermuda_shorts` (Bermuda): CORE CARGO, CHINO, BIKE_SHORT, TAILORED · EXT BOARD, BAGGY, RELAXED · NICHE 0
  - `denim_shorts` (Short jeans): CORE MOM, BOYFRIEND, STRAIGHT · EXT BAGGY, RELAXED, CARGO · NICHE 1
  - `skirt` (Saia): CORE A_LINE, PENCIL, PLEATED, SLIP, STRAIGHT_SKIRT, WRAP · EXT CIRCLE, CARGO, TIERED · NICHE 5
  - `skort` (Short-saia): CORE A_LINE, PLEATED · EXT WRAP · NICHE 0
- **shoes_piece** — Calçados (18 subcategorias · 49 CORE / 41 EXTENDED / 15 NICHE)
  - `casual_sneakers` (Tênis casual): CORE COURT, LIFESTYLE_RUNNER, VULCANIZED, CHUNKY, TERRACE · EXT SOCK_SNEAKER, TRAIL_INSPIRED · NICHE 2
  - `running_shoes` (Tênis de corrida): CORE ROAD, TRAIL · EXT MAX_CUSHION, STABILITY, RACING · NICHE 1
  - `training_shoes` (Tênis de treino): CORE CROSS_TRAINING · EXT MINIMALIST, WEIGHTLIFTING · NICHE 0
  - `basketball_shoes` (Tênis de basquete): CORE PERFORMANCE, RETRO_HERITAGE · EXT — · NICHE 0
  - `skate_shoes` (Tênis de skate): CORE CUPSOLE, VULCANIZED · EXT PUFFY · NICHE 0
  - `high_top_sneakers` (Tênis cano alto): CORE COURT, VULCANIZED, RETRO_HERITAGE · EXT CHUNKY, SNEAKER_BOOT · NICHE 1
  - `loafers` (Mocassim loafer): CORE HORSEBIT, PENNY, TASSEL · EXT VENETIAN, MULE, SMOKING_SLIPPER · NICHE 2
  - `moccasins` (Mocassim): CORE BOAT_SHOE, DRIVING · EXT SOFT_SOLE_MOC · NICHE 1
  - `oxford_shoes` (Sapato oxford): CORE BROGUE, CAP_TOE, PLAIN_TOE · EXT WHOLECUT · NICHE 1
  - `derby_shoes` (Sapato derby): CORE BROGUE, PLAIN_TOE · EXT APRON_TOE, CAP_TOE, MONK_STRAP · NICHE 0
  - `ankle_boots` (Bota curta): CORE CHELSEA, CHUKKA, WORK, COWBOY, HIKING · EXT DESERT, LACE_UP_BOOT, ENGINEER, RAIN, SOCK_BOOT · NICHE 2
  - `long_boots` (Bota cano longo): CORE COWBOY, RIDING, SLOUCH · EXT LACE_UP_BOOT, RAIN, SOCK_BOOT, ENGINEER · NICHE 1
  - `combat_boots` (Coturno): CORE MILITARY · EXT TACTICAL · NICHE 1
  - `sandals` (Sandália): CORE FOOTBED, SLIDE, STRAPPY, SPORT_SANDAL · EXT ANKLE_STRAP, FISHERMAN, GLADIATOR, CLOG, TOE_POST, T_STRAP · NICHE 1
  - `flip_flops` (Chinelo): CORE SLIDE, THONG · EXT SLIM_STRAP · NICHE 0
  - `heels` (Salto): CORE HEELED_SANDAL, PUMP, SLINGBACK, ANKLE_STRAP, MARY_JANE, MULE · EXT D_ORSAY, T_STRAP · NICHE 1
  - `flats` (Sapatilha): CORE BALLET, MARY_JANE, MULE · EXT SLINGBACK · NICHE 1
  - `espadrilles` (Alpargata): CORE — · EXT ANKLE_TIE, MULE, SLINGBACK · NICHE 0
- **accessory_piece** — Acessórios (23 subcategorias · 79 CORE / 70 EXTENDED / 28 NICHE)
  - `handbag` (Bolsa de mão): CORE BUCKET, HOBO, SHOULDER, SATCHEL, TOP_HANDLE · EXT BAGUETTE, BOWLING, BOX, BRIEFCASE, DUFFEL, SADDLE · NICHE 2
  - `crossbody_bag` (Bolsa transversal): CORE BELT_BAG, CAMERA, MESSENGER, SLING · EXT SADDLE, BOX, PHONE_POUCH · NICHE 0
  - `tote_bag` (Bolsa tote): CORE SHOPPER, STRUCTURED_TOTE · EXT EAST_WEST, NORTH_SOUTH · NICHE 1
  - `clutch` (Clutch): CORE BOX_CLUTCH, ENVELOPE, POUCH · EXT WRISTLET · NICHE 1
  - `backpack` (Mochila): CORE DAYPACK, DRAWSTRING, LAPTOP · EXT RUCKSACK, HIKING_PACK, ROLLTOP · NICHE 1
  - `belt` (Cinto): CORE DRESS_BELT, PLATE_BUCKLE, BRAIDED, WEB · EXT REVERSIBLE, D_RING, WESTERN_BELT, WIDE_WAIST · NICHE 1
  - `cap` (Boné): CORE BASEBALL, DAD_CAP, TRUCKER_CAP, SNAPBACK · EXT FITTED, FIVE_PANEL, VISOR · NICHE 0
  - `hat` (Chapéu): CORE BUCKET_HAT, FEDORA, SUN_HAT, BERET · EXT FLAT_CAP, COWBOY_HAT, TRILBY · NICHE 4
  - `beanie` (Gorro): CORE CUFFED_BEANIE, SLOUCHY, POM_POM · EXT FISHERMAN_BEANIE, BALACLAVA · NICHE 1
  - `scarf` (Cachecol): CORE OBLONG, SQUARE_SCARF, STOLE · EXT BANDANA, INFINITY, SKINNY_SCARF · NICHE 1
  - `tie` (Gravata): CORE SKINNY_TIE · EXT KNIT_TIE · NICHE 3
  - `bow_tie` (Gravata-borboleta): CORE PRE_TIED, SELF_TIE · EXT BATWING, BUTTERFLY · NICHE 1
  - `sunglasses` (Óculos de sol): CORE AVIATOR, CAT_EYE, ROUND, SQUARE, WAYFARER · EXT BROWLINE, OVAL, RECTANGLE, GEOMETRIC, SHIELD, WRAPAROUND · NICHE 1
  - `eyeglasses` (Óculos de grau): CORE RECTANGLE, ROUND, SQUARE, CAT_EYE, OVAL · EXT BROWLINE, AVIATOR, GEOMETRIC, WAYFARER · NICHE 0
  - `necklace` (Colar): CORE CHAIN, CHOKER, PENDANT · EXT BEADED, LAYERED, BIB, LARIAT · NICHE 2
  - `bracelet` (Pulseira): CORE BANGLE, CHAIN, CUFF, BEADED, CHARM · EXT CORD, MULTI_WRAP, TENNIS · NICHE 0
  - `earrings` (Brincos): CORE DROP, HOOP, HUGGIE, STUD · EXT CHANDELIER, CLIP_ON, EAR_CUFF · NICHE 2
  - `ring` (Anel): CORE BAND, SIGNET, SOLITAIRE · EXT STACKABLE, COCKTAIL, ETERNITY, OPEN_RING · NICHE 0
  - `watch` (Relógio): CORE CHRONOGRAPH, DIVER, DRESS_WATCH, SMARTWATCH · EXT FIELD_WATCH, PILOT, GMT, INTEGRATED_BRACELET, RECTANGULAR_CASE · NICHE 1
  - `wallet` (Carteira): CORE BIFOLD, CARD_HOLDER, CONTINENTAL · EXT COIN_PURSE, MONEY_CLIP, TRIFOLD · NICHE 1
  - `gloves` (Luvas): CORE FINGERLESS · EXT MITTENS · NICHE 2
  - `socks` (Meias): CORE CUSHIONED, DRESS_SOCK · EXT COMPRESSION_SOCK · NICHE 2
  - `hair_accessory` (Acessório de cabelo): CORE CLAW_CLIP, HEADBAND, SCRUNCHIE, BARRETTE, HAIR_BOW, HAIR_TIE · EXT BOBBY_PIN, SNAP_CLIP, TURBAN · NICHE 1
- **full_body_piece** — Peça única (5 subcategorias · 17 CORE / 17 EXTENDED / 5 NICHE)
  - `dress` (Vestido): CORE A_LINE, BODYCON, FIT_AND_FLARE, SHEATH, SHIFT, SHIRT_DRESS, SLIP, WRAP · EXT CORSET, TIERED, T_SHIRT_DRESS, BABYDOLL, EMPIRE, KAFTAN, MERMAID, SMOCKED · NICHE 2
  - `jumpsuit` (Macacão): CORE BOILERSUIT, STRAIGHT, WIDE_LEG · EXT FLARE, WRAP · NICHE 1
  - `romper` (Macaquinho): CORE WRAP · EXT SMOCKED, TAILORED · NICHE 1
  - `matching_set` (Conjunto): CORE CO_ORD, SUIT, TRACKSUIT · EXT SKIRT_SUIT, RESORT_SET · NICHE 1
  - `overalls` (Jardineira): CORE RELAXED, SKIRTALL · EXT SLIM, WIDE_LEG, CARPENTER · NICHE 0

Totais: **541 vínculos** (244 CORE · 216 EXTENDED · 81 NICHE) e **394 variações únicas**.
- Média de 6,9 variações por subcategoria.
- Máximo: `jeans`, com 23 (19 sem NICHE).
- Mínimo: `basketball_shoes`, com 2 (cano e uso cobrem o resto).

Lista completa, com descrição e aliases: `proposta/taxonomia_variacoes.csv`.

### C.3 Subcategorias candidatas (não incluídas no CSV — decisão do fundador)

| Código sugerido | Categoria | Motivo |
|---|---|---|
| `swimwear` | full_body_piece (ou separado) | Biquíni, maiô e sunga hoje caem em `shorts` ("swim", "volley") ou ficam de fora. Exige política de moderação. |
| `boots` | shoes_piece | Unificar `ankle_boots`/`long_boots`/`combat_boots` + `SHAFT_HEIGHT`. |
| `travel_bag` | accessory_piece | Duffel/weekender hoje entra como `handbag.DUFFEL`. |
| `anklet` | accessory_piece | Tornozeleira, hoje sem lugar. |
| `mules_clogs` | shoes_piece | Hoje resolvido pelas variações `MULE`/`CLOG` em N:N. |

### C.4 Fontes consultadas (convergência entre varejistas, guias de marca e glossários)

- **Jeans e calças:**
  - Levi's: [guia 505 vs outros fits](https://www.levi.com/US/en_US/blog/article/505-vs-500-mens), [loose](https://www.levi.com/US/en_US/clothing/men/jeans/c/levi_clothing_men_jeans/facets/feature-fit/loose), [athletic](https://www.levi.com/CA/en_CA/clothing/men/jeans/c/levi_clothing_men_jeans/facets/feature-fit/athletic); [The Modest Man — Levi's fits](https://www.themodestman.com/levis-fits-explained/).
  - Guias femininos: [H&M bootcut](https://www2.hm.com/en_us/women/guides/denim/bootcut-jeans.html), [Diesel denim guide](https://diesel.com/en-us/woman/denim-guide/), [rag & bone](https://www.rag-bone.com/womens/denim/fit-guide/), [DL1961](https://dl1961.com/pages/womens-fit-guide), [FatFace](https://www.fatface.com/guides/womens-jeans-fit-guide).
  - Brasil: [Dafiti — tipos de calça jeans](https://www.dafiti.com.br/moda/tipos-de-calca-jeans-feminina/), [Riachuelo](https://www.riachuelo.com.br/jeans/feminino/calca-jeans), [Zattini — modelagens](https://www.zattini.com.br/blog/como-usar/post/conheca-as-diferentes-modelagens-de-jeans-e-veja-dicas-para-usar), [Steal the Look](https://stealthelook.com.br/tipos-de-calca-jeans/).
  - Alfaiataria: [Minerva — trouser silhouettes](https://minervapatterns.com/blog/types-of-trousers-and-pant-silhouettes), [MasterClass — types of pants](https://www.masterclass.com/articles/types-of-pants).
- **Tops e outerwear:**
  - Camisas: [MasterClass — shirts](https://www.masterclass.com/articles/types-of-shirts), [Nimble Made — oxford/OCBD](https://www.nimble-made.com/blogs/news/what-is-an-oxford-shirt).
  - T-shirt fits: [The Litt](https://thelitt.com/blogs/articles/the-ultimate-men-s-t-shirt-fit-guide-oversized-vs-relaxed-vs-regular), [Garment Printing](https://blog.garmentprinting.com.au/t-shirt-fit-guide/).
  - Jaquetas: [MasterClass — jackets](https://www.masterclass.com/articles/types-of-jackets-guide), [Man Collected](https://mancollected.com/guides/types-of-jackets-for-men/).
  - Casacos: [Hockerty — coats](https://www.hockerty.com/en-us/blog/types-mens-coats), [Peacoat × trench × overcoat × duffle](https://anahiv.com/blogs/the-journal/peacoat-vs-trench-coat-vs-overcoat-vs-duffle-coat-which-is-which).
- **Saias e vestidos:**
  - [MasterClass — skirts](https://www.masterclass.com/articles/types-of-skirts), [Treasurie — 21 skirts](https://blog.treasurie.com/types-of-skirts-illustrated-guide/).
  - [Fashion Informed — dress silhouettes](https://fashioninformed.com/dresses/silhouettes/), [Minerva — dress silhouettes](https://minervapatterns.com/blog/types-of-dresses-and-their-silhouettes).
- **Calçados:**
  - Botas: [Charles & Keith — boots](https://www.charleskeith.com/us/guides/types-of-boots.html), [Heddels — boot types](https://www.heddels.com/2017/12/know-your-boots-the-most-common-boot-types-2/), [Gentleman's Gazette — chukka](https://www.gentlemansgazette.com/the-chukka-boots-guide/).
  - Saltos: [Charles & Keith — heels](https://www.charleskeith.com/us/guides/types-of-heels.html), [Clarks — heels](https://www.clarks.com/en-us/editorial/four-essential-types-of-heels).
  - Sandálias: [Charles & Keith — sandals](https://www.charleskeith.com/us/guides/types-of-sandals.html), [WWD/Footwear News — sandals](https://wwd.com/footwear-news/shoe-trends/sandals-types-guide-1237702106/).
  - Tênis: [Clarks — sneakers](https://www.clarks.com/en-us/editorial/types-of-sneakers), [The Modest Man — sneakers](https://www.themodestman.com/types-of-sneakers/), [retro-athletic: terrace × dad shoe](https://www.shoestation.com/blog/retro-sneaker-trend).
- **Acessórios:**
  - Bolsas: [Foley + Corinna — handbag types](https://www.foleyandcorinna.com/types-of-handbags/), [Jing Sourcing — 30 handbags](https://jingsourcing.com/p/b10-handbag-styles/).
  - Chapéus/bonés: [Nimble Made — hats](https://www.nimble-made.com/blogs/news/types-of-hats-for-men), [evo — hat guide](https://www.evo.com/blogs/guides/how-to-buy-hats-types-styles-materials).
  - Óculos: [FramesDirect — sunglasses](https://www.framesdirect.com/knowledge-center/types-sunglasses), [Heddels — sunglasses](https://www.heddels.com/2019/07/know-sunglasses-aviator-p3-wayfarer/).
  - Relógios: [Vaer — field/dive/chrono](https://www.vaerwatches.com/blogs/journal/the-watch-as-wardrobe-a-style-guide-to-field-dive-and-chronograph-watches), [Unfinished Man](https://www.unfinishedman.com/essential-watch-types-dive-chronograph-pilot-dress-gmt/).
  - Joias: [Angara — necklaces](https://www.angara.com/blog/what-are-the-different-types-of-necklaces/), [AJ Luxe — earrings](https://ajluxe.com/blogs/jewelry-guide/types-of-earrings).
- **Dados estruturados de preço:** [Google — merchant listing structured data](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing).
- **Calibração no acervo real** (contagem de termos nos 9.573 nomes):
  - jeans: skinny 133, slim 119, regular 55, straight 49, relaxed 34, boyfriend 27, loose 17, baggy 16, tapered 13, bootcut 11, wide 10, flare 7, barrel 4;
  - sandals: rasteira 95;
  - heels: scarpin 37, slingback 8;
  - sunglasses: aviator 25;
  - jacket: bomber 30, trucker 14, puffer 13, track 13;
  - coat: trench 11.
  - Linhas de modelo de marca ("501", Havaianas "Slim/Top/Brasil") **não** viram variação; ficam como `model_name`/`catalog_product_aliases`.

---

## D. Tabela mestre e dimensões de atributo

### D.1 Tabela mestre por subcategoria

Dimensões universais, omitidas na coluna: COLOR, MATERIAL, MATERIAL_DETAIL, PATTERN, CLOSURE, STYLE, OCCASION, GENDER, PRICE_RANGE. A última coluna conta quantos produtos do acervo têm a variação reconhecida já pelo nome.

| Categoria | Subcategoria | Nº var. (C/E/N) | Variações CORE (amostra) | Dimensões aplicáveis além das universais | Acervo (peças · com variação pelo nome) |
|---|---|---|---|---|---|
| upper_piece | `t_shirt` | 3 (0/2/1) | — | LOGO_PLACEMENT, FIT, LENGTH, SLEEVE_LENGTH, SLEEVE_STYLE, NECKLINE, FINISH, USAGE_TYPE | 1322 · 97 |
| upper_piece | `shirt` | 8 (2/2/4) | DRESS_SHIRT, OVERSHIRT | LOGO_PLACEMENT, FIT, LENGTH, SLEEVE_LENGTH, SLEEVE_STYLE, NECKLINE, FINISH, USAGE_TYPE | 558 · 53 |
| upper_piece | `blouse` | 9 (3/5/1) | PEASANT, WRAP, CAMISOLE | LOGO_PLACEMENT, FIT, LENGTH, SLEEVE_LENGTH, SLEEVE_STYLE, NECKLINE, FINISH, USAGE_TYPE | 82 · 4 |
| upper_piece | `tank_top` | 3 (3/0/0) | MUSCLE_TANK, RACERBACK, CAMISOLE | LOGO_PLACEMENT, FIT, LENGTH, SLEEVE_LENGTH, SLEEVE_STYLE, NECKLINE, FINISH, USAGE_TYPE | 116 · 14 |
| upper_piece | `crop_top` | 6 (2/4/0) | BANDEAU, CORSET | LOGO_PLACEMENT, FIT, LENGTH, SLEEVE_LENGTH, SLEEVE_STYLE, NECKLINE, FINISH, USAGE_TYPE | 46 · 0 |
| upper_piece | `polo_shirt` | 3 (0/2/1) | — | LOGO_PLACEMENT, FIT, LENGTH, SLEEVE_LENGTH, SLEEVE_STYLE, NECKLINE, FINISH, USAGE_TYPE | 377 · 2 |
| upper_piece | `bodysuit` | 4 (0/3/1) | — | LOGO_PLACEMENT, FIT, LENGTH, SLEEVE_LENGTH, SLEEVE_STYLE, NECKLINE, FINISH, USAGE_TYPE | 23 · 1 |
| upper_piece | `sweater` | 5 (3/1/1) | CHUNKY_KNIT, FINE_KNIT, CABLE_KNIT | LOGO_PLACEMENT, FIT, LENGTH, SLEEVE_LENGTH, SLEEVE_STYLE, NECKLINE, FINISH, USAGE_TYPE | 179 · 11 |
| upper_piece | `sweatshirt` | 4 (2/1/1) | CREWNECK, QUARTER_ZIP | LOGO_PLACEMENT, FIT, LENGTH, SLEEVE_LENGTH, SLEEVE_STYLE, NECKLINE, FINISH, USAGE_TYPE | 180 · 93 |
| upper_piece | `hoodie` | 3 (2/0/1) | FULL_ZIP, PULLOVER | LOGO_PLACEMENT, FIT, LENGTH, SLEEVE_LENGTH, SLEEVE_STYLE, NECKLINE, FINISH, USAGE_TYPE | 152 · 33 |
| upper_piece | `cardigan` | 6 (3/3/0) | CHUNKY_KNIT, FINE_KNIT, OPEN_FRONT | LOGO_PLACEMENT, FIT, LENGTH, SLEEVE_LENGTH, SLEEVE_STYLE, NECKLINE, FINISH, USAGE_TYPE | 61 · 1 |
| upper_piece | `vest` | 4 (3/1/0) | PUFFER, WAISTCOAT, SWEATER_VEST | LOGO_PLACEMENT, FIT, LENGTH, SLEEVE_LENGTH, SLEEVE_STYLE, NECKLINE, FINISH, USAGE_TYPE | 53 · 5 |
| upper_piece | `blazer` | 5 (2/1/2) | TAILORED, UNSTRUCTURED | LOGO_PLACEMENT, FIT, LENGTH, SLEEVE_LENGTH, SLEEVE_STYLE, NECKLINE, FINISH, USAGE_TYPE | 76 · 5 |
| upper_piece | `jacket` | 12 (5/6/1) | BIKER, BOMBER, PUFFER, TRUCKER, TRACK_JACKET | LOGO_PLACEMENT, FIT, LENGTH, SLEEVE_LENGTH, SLEEVE_STYLE, NECKLINE, FINISH, USAGE_TYPE | 437 · 113 |
| upper_piece | `coat` | 11 (5/5/1) | OVERCOAT, PEACOAT, TRENCH, PUFFER, WRAP | LOGO_PLACEMENT, FIT, LENGTH, SLEEVE_LENGTH, SLEEVE_STYLE, NECKLINE, FINISH, USAGE_TYPE | 86 · 28 |
| upper_piece | `parka` | 4 (2/2/0) | PUFFER, SNORKEL | LOGO_PLACEMENT, FIT, LENGTH, SLEEVE_LENGTH, SLEEVE_STYLE, NECKLINE, FINISH, USAGE_TYPE | 17 · 0 |
| upper_piece | `windbreaker` | 3 (1/2/0) | ANORAK | LOGO_PLACEMENT, FIT, LENGTH, SLEEVE_LENGTH, SLEEVE_STYLE, NECKLINE, FINISH, USAGE_TYPE | 0 · 0 |
| upper_piece | `kimono` | 3 (1/1/1) | KIMONO_CARDIGAN | LOGO_PLACEMENT, FIT, LENGTH, SLEEVE_LENGTH, SLEEVE_STYLE, NECKLINE, FINISH, USAGE_TYPE | 4 · 0 |
| lower_piece | `jeans` | 23 (13/6/4) | REGULAR, SKINNY, SLIM, STRAIGHT, WIDE_LEG, BAGGY, BOOTCUT, BOYFRIEND, FLARE, LOOSE, MOM, R | LOGO_PLACEMENT, WAIST_RISE, LENGTH, FINISH, USAGE_TYPE | 733 · 486 |
| lower_piece | `tailored_pants` | 10 (6/3/1) | SLIM, STRAIGHT, WIDE_LEG, CIGARETTE, PALAZZO, TAPERED | LOGO_PLACEMENT, WAIST_RISE, LENGTH, FINISH, FRONT_PLEAT, USAGE_TYPE | 5 · 3 |
| lower_piece | `casual_pants` | 17 (6/10/1) | SLIM, STRAIGHT, WIDE_LEG, PALAZZO, RELAXED, TAPERED | LOGO_PLACEMENT, WAIST_RISE, LENGTH, FINISH, FRONT_PLEAT, USAGE_TYPE | 476 · 159 |
| lower_piece | `chino_pants` | 6 (3/2/1) | SLIM, STRAIGHT, TAPERED | LOGO_PLACEMENT, WAIST_RISE, LENGTH, FINISH, FRONT_PLEAT, USAGE_TYPE | 83 · 31 |
| lower_piece | `cargo_pants` | 9 (5/3/1) | BAGGY, RELAXED, STRAIGHT, CUFFED_JOGGER, WIDE_LEG | LOGO_PLACEMENT, WAIST_RISE, LENGTH, FINISH, USAGE_TYPE | 75 · 29 |
| lower_piece | `jogger_pants` | 3 (2/1/0) | RELAXED, SLIM | LOGO_PLACEMENT, WAIST_RISE, LENGTH, FINISH, USAGE_TYPE | 73 · 15 |
| lower_piece | `sweatpants` | 6 (3/3/0) | CUFFED_JOGGER, OPEN_HEM, WIDE_LEG | LOGO_PLACEMENT, WAIST_RISE, LENGTH, FINISH, USAGE_TYPE | 34 · 11 |
| lower_piece | `leggings` | 5 (1/3/1) | FLARE_LEGGING | LOGO_PLACEMENT, WAIST_RISE, LENGTH, FINISH, USAGE_TYPE | 63 · 4 |
| lower_piece | `culottes` | 3 (1/1/1) | WIDE_LEG | LOGO_PLACEMENT, WAIST_RISE, LENGTH, FINISH, FRONT_PLEAT, USAGE_TYPE | 0 · 0 |
| lower_piece | `shorts` | 11 (5/5/1) | BIKE_SHORT, CARGO, CHINO, TAILORED, VOLLEY | LOGO_PLACEMENT, WAIST_RISE, LENGTH, FINISH, FRONT_PLEAT, USAGE_TYPE | 391 · 43 |
| lower_piece | `bermuda_shorts` | 7 (4/3/0) | CARGO, CHINO, BIKE_SHORT, TAILORED | LOGO_PLACEMENT, WAIST_RISE, LENGTH, FINISH, FRONT_PLEAT, USAGE_TYPE | 92 · 45 |
| lower_piece | `denim_shorts` | 7 (3/3/1) | MOM, BOYFRIEND, STRAIGHT | LOGO_PLACEMENT, WAIST_RISE, LENGTH, FINISH, USAGE_TYPE | 16 · 0 |
| lower_piece | `skirt` | 14 (6/3/5) | A_LINE, PENCIL, PLEATED, SLIP, STRAIGHT_SKIRT, WRAP | LOGO_PLACEMENT, WAIST_RISE, LENGTH, FINISH, USAGE_TYPE | 150 · 39 |
| lower_piece | `skort` | 3 (2/1/0) | A_LINE, PLEATED | LOGO_PLACEMENT, WAIST_RISE, LENGTH, FINISH, USAGE_TYPE | 15 · 2 |
| shoes_piece | `casual_sneakers` | 9 (5/2/2) | COURT, LIFESTYLE_RUNNER, VULCANIZED, CHUNKY, TERRACE | FINISH, USAGE_TYPE, SHAFT_HEIGHT, SOLE_TYPE | 360 · 3 |
| shoes_piece | `running_shoes` | 6 (2/3/1) | ROAD, TRAIL | FINISH, USAGE_TYPE, SHAFT_HEIGHT, SOLE_TYPE | 30 · 9 |
| shoes_piece | `training_shoes` | 3 (1/2/0) | CROSS_TRAINING | FINISH, USAGE_TYPE, SHAFT_HEIGHT, SOLE_TYPE | 56 · 0 |
| shoes_piece | `basketball_shoes` | 2 (2/0/0) | PERFORMANCE, RETRO_HERITAGE | FINISH, USAGE_TYPE, SHAFT_HEIGHT, SOLE_TYPE | 10 · 1 |
| shoes_piece | `skate_shoes` | 3 (2/1/0) | CUPSOLE, VULCANIZED | FINISH, USAGE_TYPE, SHAFT_HEIGHT, SOLE_TYPE | 1 · 0 |
| shoes_piece | `high_top_sneakers` | 6 (3/2/1) | COURT, VULCANIZED, RETRO_HERITAGE | FINISH, USAGE_TYPE, SHAFT_HEIGHT, SOLE_TYPE | 9 · 0 |
| shoes_piece | `loafers` | 8 (3/3/2) | HORSEBIT, PENNY, TASSEL | FINISH, USAGE_TYPE, HEEL_HEIGHT, HEEL_TYPE, TOE_SHAPE, SOLE_TYPE | 20 · 3 |
| shoes_piece | `moccasins` | 4 (2/1/1) | BOAT_SHOE, DRIVING | FINISH, USAGE_TYPE, TOE_SHAPE, SOLE_TYPE | 24 · 0 |
| shoes_piece | `oxford_shoes` | 5 (3/1/1) | BROGUE, CAP_TOE, PLAIN_TOE | FINISH, USAGE_TYPE, HEEL_HEIGHT, TOE_SHAPE, SOLE_TYPE | 40 · 0 |
| shoes_piece | `derby_shoes` | 5 (2/3/0) | BROGUE, PLAIN_TOE | FINISH, USAGE_TYPE, HEEL_HEIGHT, TOE_SHAPE, SOLE_TYPE | 1 · 0 |
| shoes_piece | `ankle_boots` | 12 (5/5/2) | CHELSEA, CHUKKA, WORK, COWBOY, HIKING | FINISH, USAGE_TYPE, SHAFT_HEIGHT, HEEL_HEIGHT, HEEL_TYPE, TOE_SHAPE, SOLE_TYPE | 11 · 3 |
| shoes_piece | `long_boots` | 8 (3/4/1) | COWBOY, RIDING, SLOUCH | FINISH, USAGE_TYPE, SHAFT_HEIGHT, HEEL_HEIGHT, HEEL_TYPE, TOE_SHAPE, SOLE_TYPE | 0 · 0 |
| shoes_piece | `combat_boots` | 3 (1/1/1) | MILITARY | FINISH, USAGE_TYPE, SHAFT_HEIGHT, HEEL_HEIGHT, HEEL_TYPE, TOE_SHAPE, SOLE_TYPE | 15 · 0 |
| shoes_piece | `sandals` | 11 (4/6/1) | FOOTBED, SLIDE, STRAPPY, SPORT_SANDAL | FINISH, USAGE_TYPE, HEEL_HEIGHT, HEEL_TYPE, TOE_SHAPE, SOLE_TYPE | 338 · 139 |
| shoes_piece | `flip_flops` | 3 (2/1/0) | SLIDE, THONG | FINISH, USAGE_TYPE, HEEL_TYPE, SOLE_TYPE | 369 · 51 |
| shoes_piece | `heels` | 9 (6/2/1) | HEELED_SANDAL, PUMP, SLINGBACK, ANKLE_STRAP, MARY_JANE, MULE | FINISH, USAGE_TYPE, HEEL_HEIGHT, HEEL_TYPE, TOE_SHAPE, SOLE_TYPE | 66 · 41 |
| shoes_piece | `flats` | 5 (3/1/1) | BALLET, MARY_JANE, MULE | FINISH, USAGE_TYPE, HEEL_HEIGHT, TOE_SHAPE, SOLE_TYPE | 32 · 9 |
| shoes_piece | `espadrilles` | 3 (0/3/0) | — | FINISH, USAGE_TYPE, HEEL_HEIGHT, HEEL_TYPE, TOE_SHAPE, SOLE_TYPE | 1 · 0 |
| accessory_piece | `handbag` | 13 (5/6/2) | BUCKET, HOBO, SHOULDER, SATCHEL, TOP_HANDLE | LOGO_PLACEMENT, FINISH, SIZE_CLASS | 102 · 14 |
| accessory_piece | `crossbody_bag` | 7 (4/3/0) | BELT_BAG, CAMERA, MESSENGER, SLING | LOGO_PLACEMENT, FINISH, SIZE_CLASS | 69 · 8 |
| accessory_piece | `tote_bag` | 5 (2/2/1) | SHOPPER, STRUCTURED_TOTE | LOGO_PLACEMENT, FINISH, SIZE_CLASS | 250 · 4 |
| accessory_piece | `clutch` | 5 (3/1/1) | BOX_CLUTCH, ENVELOPE, POUCH | LOGO_PLACEMENT, FINISH, SIZE_CLASS | 12 · 0 |
| accessory_piece | `backpack` | 7 (3/3/1) | DAYPACK, DRAWSTRING, LAPTOP | LOGO_PLACEMENT, FINISH, USAGE_TYPE, SIZE_CLASS | 107 · 1 |
| accessory_piece | `belt` | 9 (4/4/1) | DRESS_BELT, PLATE_BUCKLE, BRAIDED, WEB | LOGO_PLACEMENT, FINISH | 96 · 15 |
| accessory_piece | `cap` | 7 (4/3/0) | BASEBALL, DAD_CAP, TRUCKER_CAP, SNAPBACK | LOGO_PLACEMENT, FINISH, USAGE_TYPE | 182 · 61 |
| accessory_piece | `hat` | 11 (4/3/4) | BUCKET_HAT, FEDORA, SUN_HAT, BERET | LOGO_PLACEMENT | 114 · 15 |
| accessory_piece | `beanie` | 6 (3/2/1) | CUFFED_BEANIE, SLOUCHY, POM_POM | LOGO_PLACEMENT | 37 · 3 |
| accessory_piece | `scarf` | 7 (3/3/1) | OBLONG, SQUARE_SCARF, STOLE | LOGO_PLACEMENT | 97 · 0 |
| accessory_piece | `tie` | 5 (1/1/3) | SKINNY_TIE | LOGO_PLACEMENT | 124 · 3 |
| accessory_piece | `bow_tie` | 5 (2/2/1) | PRE_TIED, SELF_TIE | LOGO_PLACEMENT | 23 · 4 |
| accessory_piece | `sunglasses` | 12 (5/6/1) | AVIATOR, CAT_EYE, ROUND, SQUARE, WAYFARER | LOGO_PLACEMENT, USAGE_TYPE, SIZE_CLASS, FRAME_RIM, LENS_TYPE | 101 · 46 |
| accessory_piece | `eyeglasses` | 9 (5/4/0) | RECTANGLE, ROUND, SQUARE, CAT_EYE, OVAL | LOGO_PLACEMENT, SIZE_CLASS, FRAME_RIM, LENS_TYPE | 1 · 0 |
| accessory_piece | `necklace` | 9 (3/4/2) | CHAIN, CHOKER, PENDANT | LOGO_PLACEMENT, FINISH, CHAIN_LINK | 63 · 11 |
| accessory_piece | `bracelet` | 8 (5/3/0) | BANGLE, CHAIN, CUFF, BEADED, CHARM | LOGO_PLACEMENT, FINISH, CHAIN_LINK | 31 · 10 |
| accessory_piece | `earrings` | 9 (4/3/2) | DROP, HOOP, HUGGIE, STUD | LOGO_PLACEMENT, FINISH, SIZE_CLASS | 48 · 19 |
| accessory_piece | `ring` | 7 (3/4/0) | BAND, SIGNET, SOLITAIRE | LOGO_PLACEMENT, FINISH | 37 · 1 |
| accessory_piece | `watch` | 10 (4/5/1) | CHRONOGRAPH, DIVER, DRESS_WATCH, SMARTWATCH | LOGO_PLACEMENT, FINISH, USAGE_TYPE, SIZE_CLASS, WATCH_DISPLAY, WATCH_STRAP | 80 · 1 |
| accessory_piece | `wallet` | 7 (3/3/1) | BIFOLD, CARD_HOLDER, CONTINENTAL | LOGO_PLACEMENT, FINISH | 86 · 32 |
| accessory_piece | `gloves` | 4 (1/1/2) | FINGERLESS | LOGO_PLACEMENT, USAGE_TYPE | 12 · 0 |
| accessory_piece | `socks` | 5 (2/1/2) | CUSHIONED, DRESS_SOCK | LOGO_PLACEMENT, USAGE_TYPE, SHAFT_HEIGHT | 106 · 3 |
| accessory_piece | `hair_accessory` | 10 (6/3/1) | CLAW_CLIP, HEADBAND, SCRUNCHIE, BARRETTE, HAIR_BOW, HAIR_TIE | LOGO_PLACEMENT | 6 · 6 |
| full_body_piece | `dress` | 18 (8/8/2) | A_LINE, BODYCON, FIT_AND_FLARE, SHEATH, SHIFT, SHIRT_DRESS, SLIP, WRAP | LOGO_PLACEMENT, FIT, LENGTH, SLEEVE_LENGTH, SLEEVE_STYLE, NECKLINE, FINISH, USAGE_TYPE | 339 · 38 |
| full_body_piece | `jumpsuit` | 6 (3/2/1) | BOILERSUIT, STRAIGHT, WIDE_LEG | LOGO_PLACEMENT, FIT, LENGTH, SLEEVE_LENGTH, SLEEVE_STYLE, NECKLINE, FINISH, USAGE_TYPE | 23 · 1 |
| full_body_piece | `romper` | 4 (1/2/1) | WRAP | LOGO_PLACEMENT, FIT, LENGTH, SLEEVE_LENGTH, SLEEVE_STYLE, NECKLINE, FINISH, USAGE_TYPE | 12 · 1 |
| full_body_piece | `matching_set` | 6 (3/2/1) | CO_ORD, SUIT, TRACKSUIT | LOGO_PLACEMENT, FIT, LENGTH, FINISH, USAGE_TYPE | 22 · 0 |
| full_body_piece | `overalls` | 5 (2/3/0) | RELAXED, SKIRTALL | LOGO_PLACEMENT, LENGTH, FINISH, USAGE_TYPE | 35 · 7 |

### D.2 Dimensões de atributo

| Dimensão | Origem | Cardinalidade | Valores (C/E/N) | Aplica-se a | Exemplos de valores |
|---|---|---|---|---|---|
| `COLOR` Cor | EXISTING | SINGLE | 59 (54/5/0) | categorias: upper_piece, lower_piece, shoes_piece, accessory_piece, full_body_piece | black, charcoal, washed_black, white, off_white, ivory, cream … |
| `MATERIAL` Material (família) | EXISTING | SINGLE | 10 (10/0/0) | categorias: upper_piece, lower_piece, shoes_piece, accessory_piece, full_body_piece | COTTON, POLYESTER, WOOL, SILK, LEATHER, SYNTHETIC, BLEND … |
| `MATERIAL_DETAIL` Tecido / matéria-prima | NEW | MULTI ≤3 | 43 (20/20/3) | categorias: upper_piece, lower_piece, shoes_piece, accessory_piece, full_body_piece | DENIM, CHAMBRAY, JERSEY, PIQUE, TWILL, CANVAS, CORDUROY … |
| `PATTERN` Estampa | EXISTING | SINGLE | 21 (12/8/1) | categorias: upper_piece, lower_piece, full_body_piece, accessory_piece, shoes_piece | ALLOVER_LOGO, SINGLE_LOGO, STRIPES, PLAID, FLORAL, CAMO, TIE_DYE … |
| `LOGO_PLACEMENT` Posição do logo | EXISTING | SINGLE | 5 (0/5/0) | categorias: upper_piece, lower_piece, full_body_piece, accessory_piece | ALLOVER, CENTER_CHEST, LEFT_CHEST, BACK, SLEEVE |
| `STYLE` Estilo | EXISTING | MULTI ≤2 (esquema ≤3) | 25 (25/0/0) | categorias: upper_piece, lower_piece, shoes_piece, accessory_piece, full_body_piece | classic, minimalist, modern, chic, streetwear, sporty, athleisure … |
| `OCCASION` Ocasião | EXISTING | MULTI ≤2 (esquema ≤3) | 20 (20/0/0) | categorias: upper_piece, lower_piece, shoes_piece, accessory_piece, full_body_piece | casual, work, business, formal, party, night_out, date … |
| `GENDER` Gênero | EXISTING | SINGLE | 3 (3/0/0) | categorias: upper_piece, lower_piece, shoes_piece, accessory_piece, full_body_piece | MASCULINO, FEMININO, UNISSEX |
| `PRICE_RANGE` Faixa de preço | NEW | SINGLE | 4 (4/0/0) | categorias: upper_piece, lower_piece, shoes_piece, accessory_piece, full_body_piece | BUDGET, MID, PREMIUM, LUXURY |
| `FIT` Caimento | NEW | SINGLE | 6 (5/1/0) | 22 subcategorias | SLIM_FIT, REGULAR_FIT, RELAXED_FIT, OVERSIZED_FIT, BOXY_FIT, MUSCLE_FIT |
| `WAIST_RISE` Cintura (altura) | NEW | SINGLE | 4 (3/1/0) | 14 subcategorias | LOW_RISE, MID_RISE, HIGH_RISE, ULTRA_HIGH_RISE |
| `LENGTH` Comprimento | NEW | SINGLE | 16 (10/4/2) | 38 subcategorias | CROPPED, REGULAR_LENGTH, LONGLINE, WAIST_LENGTH, HIP_LENGTH, MICRO, MINI … |
| `SLEEVE_LENGTH` Manga (comprimento) | NEW | SINGLE | 6 (4/2/0) | 21 subcategorias | SLEEVELESS, CAP_SLEEVE, SHORT_SLEEVE, ELBOW_SLEEVE, THREE_QUARTER_SLEEVE, LONG_SLEEVE |
| `SLEEVE_STYLE` Manga (modelo) | NEW | MULTI ≤2 | 10 (3/6/1) | 21 subcategorias | SET_IN, RAGLAN, DROP_SHOULDER, PUFF, BALLOON_SLEEVE, BELL_SLEEVE, BISHOP … |
| `NECKLINE` Decote / gola | NEW | SINGLE | 30 (15/13/2) | 21 subcategorias | CREW_NECK, V_NECK, SCOOP, BOAT, SQUARE_NECK, SWEETHEART, HALTER … |
| `CLOSURE` Fechamento | NEW | MULTI ≤2 | 18 (13/5/0) | categorias: upper_piece, lower_piece, shoes_piece, accessory_piece, full_body_piece | BUTTON, ZIPPER, SNAP, HOOK_AND_LOOP, DRAWSTRING, ELASTIC, LACE_UP … |
| `FINISH` Acabamento / lavagem | NEW | MULTI ≤3 | 21 (11/7/3) | categorias: upper_piece, lower_piece, full_body_piece, shoes_piece + 13 subcategorias | RAW, RINSE, LIGHT_WASH, MEDIUM_WASH, DARK_WASH, STONE_WASH, ACID_WASH … |
| `FRONT_PLEAT` Pregas frontais | NEW | SINGLE | 3 (2/1/0) | 6 subcategorias | FLAT_FRONT, SINGLE_PLEAT, DOUBLE_PLEAT |
| `USAGE_TYPE` Uso / esporte | NEW | MULTI ≤2 | 16 (10/4/2) | categorias: shoes_piece, upper_piece, lower_piece, full_body_piece + 6 subcategorias | LIFESTYLE, RUNNING, TRAINING, BASKETBALL, SKATE, TENNIS, FOOTBALL … |
| `SHAFT_HEIGHT` Altura do cano | NEW | SINGLE | 12 (10/1/1) | 10 subcategorias | LOW_TOP, MID_TOP, HIGH_TOP, ANKLE_HEIGHT, MID_CALF, KNEE_HIGH, OVER_THE_KNEE … |
| `HEEL_HEIGHT` Altura do salto | NEW | SINGLE | 5 (4/1/0) | 10 subcategorias | FLAT, LOW_HEEL, MID_HEEL, HIGH_HEEL, VERY_HIGH_HEEL |
| `HEEL_TYPE` Tipo de salto | NEW | SINGLE | 8 (4/2/2) | 8 subcategorias | STILETTO, BLOCK, KITTEN, WEDGE, CONE, CUBAN, SCULPTURAL … |
| `TOE_SHAPE` Bico | NEW | SINGLE | 6 (5/1/0) | 11 subcategorias | ROUND_TOE, POINTED_TOE, ALMOND_TOE, SQUARE_TOE, OPEN_TOE, PEEP_TOE |
| `SOLE_TYPE` Solado | NEW | SINGLE | 6 (4/2/0) | categorias: shoes_piece | RUBBER_SOLE, LEATHER_SOLE, LUG_SOLE, CREPE_SOLE, PLATFORM, GUM_SOLE |
| `SIZE_CLASS` Tamanho (escala) | NEW | SINGLE | 5 (5/0/0) | 9 subcategorias | MINI, SMALL, MEDIUM, LARGE, OVERSIZED |
| `FRAME_RIM` Aro | NEW | SINGLE | 3 (2/1/0) | 2 subcategorias | FULL_RIM, SEMI_RIMLESS, RIMLESS |
| `LENS_TYPE` Lente | NEW | MULTI ≤2 | 5 (3/2/0) | 2 subcategorias | POLARIZED, MIRRORED, GRADIENT, PHOTOCHROMIC, BLUE_LIGHT |
| `CHAIN_LINK` Tipo de elo | NEW | SINGLE | 9 (5/4/0) | 2 subcategorias | CABLE, CURB, ROPE, BOX, SNAKE, FIGARO, BALL … |
| `WATCH_DISPLAY` Mostrador | NEW | SINGLE | 3 (2/1/0) | 1 subcategorias | ANALOG, DIGITAL, ANA_DIGI |
| `WATCH_STRAP` Pulseira do relógio | NEW | SINGLE | 5 (3/2/0) | 1 subcategorias | METAL_BRACELET, LEATHER_STRAP, RUBBER_STRAP, NATO_STRAP, MESH_STRAP |

Regras:
- **Códigos existentes preservados.**
  - Cores, estilos e ocasiões continuam em `lower_snake`; materiais e gênero em `UPPER`.
  - Estampa e logo reaproveitam `normalization.json → design` (`ALLOVER_LOGO`, `STRIPES`…).
  - Valores novos ficam com `status=PROPOSED`: materiais `LINEN`, `VISCOSE`, `METAL`; estampas `POLKA_DOT`, `ANIMAL_PRINT`, `PAISLEY`, `GINGHAM`…
- **`MATERIAL_DETAIL`** (tecido/matéria-prima) aponta para a família `MATERIAL`. Os aliases "metal" e "aço" saem de `SYNTHETIC` e passam para `METAL`.
- **`appliesTo` em dois níveis:**
  - dimensão: ex. `WAIST_RISE` só em partes de baixo;
  - valor: ex. `LOW_TOP` só em tênis, `OVER_THE_KNEE` só em `long_boots`, `RAW` só em peças de jeans, `POLARIZED` só em óculos de sol.
- **Cardinalidade.**
  - `STYLE`/`OCCASION` continuam ≤2 na peça e ≤3 no esquema (`MAX_PIECE_TAGS`/`MAX_SCHEME_TAGS`).
  - Tetos das MULTI novas: CLOSURE ≤2, FINISH ≤3, SLEEVE_STYLE ≤2, USAGE_TYPE ≤2, LENS_TYPE ≤2, MATERIAL_DETAIL ≤3.
- **`PRICE_RANGE`** é derivada de `price_brl`; nunca é digitada.

### D.3 Exemplo composicional

```json
{
  "category": "lower_piece",
  "subcategory": "jeans",
  "variation": "WIDE_LEG",
  "waistRise": "HIGH_RISE",
  "length": "FULL_LENGTH",
  "finish": ["LIGHT_WASH", "FRAYED_HEM"],
  "material": "COTTON",
  "materialDetail": ["DENIM", "ELASTANE_BLEND"],
  "color": "light_blue",
  "pattern": "PLAIN",
  "closure": ["BUTTON"],
  "style": ["streetwear", "vintage"],
  "occasion": ["casual", "travel"],
  "gender": "FEMININO",
  "priceRange": "MID",
  "brand": "levis"
}
```

Texto livre equivalente: "calça jeans pantalona cintura alta clara barra desfiada Levi's".
- `pantalona` → `WIDE_LEG` (alias com escopo `jeans`);
- `cintura alta` → `HIGH_RISE`;
- `clara` → `LIGHT_WASH`;
- `barra desfiada` → `FRAYED_HEM`;
- `Levi's` → `brandAliases`.

Outros exemplos:
- `{"category":"shoes_piece","subcategory":"ankle_boots","variation":"CHELSEA","shaftHeight":"ANKLE_HEIGHT","closure":["SLIP_ON"],"soleType":"LUG_SOLE","materialDetail":["SUEDE"],"color":"tan"}`
- `{"category":"accessory_piece","subcategory":"handbag","variation":"BAGUETTE","sizeClass":"SMALL","finish":["PATENT"],"materialDetail":["FAUX_LEATHER"],"color":"black"}`

### D.4 Contrato de IA (vocabulário fechado)

1. **Entrada do modelo.** Para a subcategoria escolhida ou detectada, o prompt envia:
   - só as variações vinculadas (código + `descriptionPtBr`, CORE e EXTENDED primeiro);
   - só as dimensões e valores do `appliesTo` daquela subcategoria.
   - Isso substitui a lista crua de códigos do `ANALYZER_SYSTEM`.
2. **Saída.**
   - Campos: `variation` (código da lista ou `"UNKNOWN"`), `variationConfidence` 0–1, `attributes` (`{DIM: código | [códigos]}`) e `confidence` por dimensão.
   - Códigos fora do vocabulário são **descartados**, como `Taxonomy.keepAllowed` já faz com estilo e ocasião.
3. **Normalização de texto livre** (busca, Copilot, títulos do catálogo):
   1. `CatalogNormalizer.key`;
   2. resolve a subcategoria pelo núcleo do nome (regra atual de `infer_subcategory`);
   3. no texto restante, casa os aliases das variações **vinculadas** àquela subcategoria (frase mais longa primeiro).
   - Assim "cargo" em "bermuda cargo" vira `bermuda_shorts.CARGO`, não `cargo_pants`.
   - Há 21 aliases que coincidem com sinônimo de outra subcategoria (`chino`, `cargo`, `alfaiataria`, `quarter zip`, `tank`…). Estão listados na validação e seguem essa precedência.
   - `MODIFIERS` deixa de descartar "bootcut": o termo passa a ser lido como variação depois que a subcategoria é fixada.
4. **Limiares propostos:**
   - ≥ 0,6: aceita, `source=AI`;
   - 0,4–0,6: sugestão para o usuário ("Parece wide leg — confirmar?");
   - < 0,4: `UNKNOWN`, gravado como `NULL`.
   - O usuário corrige a qualquer momento (`source=USER`). O catálogo oficial vale `source=CATALOG/OFFICIAL`.
5. **Proibido:**
   - variação de outra subcategoria (a FK composta recusa `casual_sneakers + CHELSEA`);
   - mais de 2 estilos ou ocasiões na peça (3 no esquema);
   - ocasião fora de `allowedOccasions`;
   - inventar marca.

---

## E. Modelo de dados

### E.1 Tabelas de referência (por que tabelas, e não ENUM nem só JSON)

| Opção | Prós | Contras | Veredito |
|---|---|---|---|
| `ENUM` MySQL nas colunas | Validação no banco | Cada valor novo exige `ALTER TABLE` em tabela grande; não guarda rótulo, alias, tier nem `appliesTo`; não expressa N:N | ❌ |
| Só JSON (`attributes_json` na peça) | Flexível | Sem FK; facetas com contagem exigem colunas geradas por atributo; validação só na aplicação | ❌ como fonte (pode existir como cache) |
| **Tabelas de referência + vínculo N:N + EAV tipado** | FK real; N:N subcategoria×variação; aliases indexados; `appliesTo` consultável; facetas por `GROUP BY` em índice; tudo aditivo | Mais tabelas e joins | ✅ |

Tabelas (DDL completo em `proposta/seed_piece_variations.sql`):
- **`piece_category`** (code PK) e **`piece_subcategory`** (code PK, category_code FK, status, concept_issue, implied_attributes_json). Os códigos são os existentes; usa-se `status=DEPRECATED` em vez de apagar.
- **`piece_variation`** (code PK, rótulos, description_pt, status): catálogo global.
- **`piece_subcategory_variation`** ((subcategory_code, variation_code) PK, tier, priority, sort_order, implied_attributes_json): é a **aplicabilidade**. CHELSEA nunca entra em sneakers porque o vínculo não existe.
- **`piece_variation_alias`** (variation_code, scope_subcategory `'*'` ou código, alias, alias_norm). O escopo resolve "pantalona" = WIDE_LEG em jeans e PALAZZO em calça casual.
- **`attribute_dimension`**, **`attribute_value`** ((dimension_code, code) PK), **`attribute_value_alias`** e **`attribute_applicability`** (dimension, value ou `'*'`, subcategory): `appliesTo` materializado.
- **`catalog_product_attribute`** e **`wardrobe_item_attribute`** ((item, dimension, value) PK, source, confidence), com índice `(dimension, value, item)` para facetas.

### E.2 Relação com WardrobeItem, CatalogProduct e Brand

- **Colunas novas.** `wardrobe_items` e `catalog_products` ganham `variation_code VARCHAR(60) NULL`, `variation_source` e `variation_confidence`. Tudo nullable: peças antigas e peças sem variação continuam válidas.
- **FK composta** `(subcategory, variation_code) → piece_subcategory_variation`. O MySQL ignora a FK quando `variation_code` é NULL. Testado: aceita `jeans/WIDE_LEG` e `t_shirt/NULL`; recusa `casual_sneakers/CHELSEA`.
- **Atributos** multi e de baixa cardinalidade ficam nas tabelas EAV.
  - As colunas legadas `color`, `material`, `style_tags`, `occasion_tags` e `sex` **continuam sendo a fonte da verdade** desses 5 campos durante a transição.
  - O EAV recebe um espelho (dupla escrita) para servir facetas. Nada é removido.
- **WardrobeItem ← CatalogProduct.** Quando a peça vem do catálogo (`catalog_product_id`), herda `variation_code` e os atributos com `source=CATALOG`. O usuário pode sobrescrever.
- **Brand** continua em `brands` + `brand_aliases` (V30). A marca é FK, não valor de dimensão.
- **Preço.** `catalog_products` ganha `price_amount`, `price_currency`, `price_brl` e `price_observed_at`; `wardrobe_items` ganha `price_currency`.

### E.3 Fonte da verdade e geração

- **Proposta: um único arquivo versionado como fonte.** O `normalization.json` ganha as seções `variations`, `subcategoryVariations` e `attributeDimensions` (formato em `proposta/taxonomia_variacoes.json`). Ele já é lido por Java e Python, o que evita um 3º arquivo.
- **Gerado a partir dele:**
  - o **seed SQL** da migration, por script de build. Um teste compara banco × JSON, como o `CatalogNormalizerTest` já faz;
  - as constantes de `Taxonomy.java`, que **passam a ser lidas** do JSON via `CatalogNormalizer` (fim da duplicação B.1-1);
  - os rótulos pt/en/es do front, servidos por `/api/taxonomy` e substituindo `labels-*.ts` aos poucos.
- **`/api/taxonomy`** recebe só acréscimos, sem mudar nenhum campo atual:
  - `taxonomyVersion`;
  - `variationsBySubcategory` (`{sub: [{code, tier, priority, labelPt, labelEn, description}]}`);
  - `attributeDimensions` (com `appliesTo` por subcategoria);
  - `impliedAttributes`.
  - Os aliases vão para `GET /api/taxonomy/aliases` (pesado, com cache e ETag).

### E.4 Compatibilidade

- Nenhum código existente é renomeado, apagado ou muda de caixa. Os novos seguem UPPER_SNAKE_CASE, como já fazem `MATERIALS`, `SEXES` e `design.patterns`.
- Os consumidores de `subcategory` não mudam: `capture_sessions`, `piece_images`, `garment_embeddings`, `kb_product_models`, regras de selo, `CaptureProfiles`, `SNEAKERS`, `RIGID_SUBCATEGORIES`.
- Variação ausente = `NULL`; a UI mostra "Não informado".

---

## F. Plano de migration e impacto por módulo

### F.1 Migrations (só aditivas, a partir da V39 — a V38 é o pipeline de imagens do catálogo)

| Versão | Conteúdo | Rollback |
|---|---|---|
| **V39** `taxonomia_variacoes_referencia.sql` | `CREATE TABLE` das 9 tabelas de referência + 2 EAV; seed gerado: categorias, subcategorias, 394 variações, 541 vínculos, ~1,9 mil aliases, 30 dimensões, 387 valores, ~1,4 mil aliases de valor, ~1,65 mil linhas de aplicabilidade | `DROP` das tabelas novas (nenhum dado legado envolvido) |
| **V40** `variacao_e_preco_nas_pecas.sql` | `ALTER TABLE ... ADD COLUMN` NULL em `wardrobe_items` e `catalog_products` (variação, origem, confiança, preço); índices; FKs compostas; FKs das tabelas EAV | `DROP FOREIGN KEY` + `DROP COLUMN` (testado no schema descartável) |
| **Backfill** (job idempotente, **fora** do Flyway) | Ver passos abaixo | `UPDATE ... SET variation_code=NULL WHERE variation_source='ALIAS'` + `DELETE FROM *_attribute WHERE source IN ('ALIAS','RULE')` |

Passos do backfill:
1. **`catalog_products`.** Aplica os aliases da subcategoria primeiro em `product_name` (`source=ALIAS`, confiança 0,8) e depois em `description` (0,6).
2. **Implícitos.** Aplica os atributos implícitos de subcategoria e variação (`source=RULE`).
3. **`wardrobe_items`.** Itens vindos do catálogo herdam do produto; os demais recebem os aliases sobre `name`.
4. **Execução** em lote, com relatório em `catalog_ingestion_runs.report_json`.

Estimativa no acervo atual:
- **Variação:** 1.890 produtos pelo nome (19,7%) + 937 pela descrição (29,5% no total).
- **Nomes ambíguos:** 98 (ex.: "mom slim"). Resolvidos pela frase mais longa ou enviados para revisão.
- **Atributos casados só pelo nome:** MATERIAL_DETAIL ~2.400 · PATTERN ~1.050 · SLEEVE_LENGTH ~740 · FIT ~710 · CLOSURE ~600 · USAGE_TYPE ~530 · LENGTH ~520.

### F.2 Impacto por módulo

| Módulo | Mudança |
|---|---|
| **Backend (domínio/aplicação)** | Entidades de referência + repositórios. `Taxonomy` lê do JSON. `pieceErrors` valida `variation` (opcional, vinculada) e atributos (`appliesTo` + cardinalidade). `WardrobeService.taxonomy()` ganha os campos novos. `PieceView`/`CatalogProductView` expõem `variation` + `attributes`. |
| **Selects do front** | `piece-form.tsx`: select **Variação** dependente da subcategoria (CORE primeiro; "Ver mais" para EXTENDED/NICHE) e bloco "Detalhes" com as dimensões aplicáveis, pré-preenchidas por implícitos e IA. `multi-piece-review.tsx` idem. Closet/explorer ganham subcategoria, variação, material e marca. Rótulos passam a vir da API. |
| **Pipeline Python** | `normalize_product.py` lê `variations`/`attributeDimensions`. `infer_subcategory` mantém a regra e chama `infer_variation(sub, texto_restante)`. `MODIFIERS` passa a **capturar** manga/comprimento em vez de descartar. `structured_product` lê `offers.price/priceCurrency/priceSpecification` e `audience/suggestedGender`. Testes em `scripts/catalog/tests/`. |
| **Prompts de IA** | `ANALYZER_SYSTEM`: campos `variation`, `variationConfidence`, `attributes`; `analyzerPrompt` envia só o vocabulário da subcategoria, com descrição. `CatalogTextInterpreter.SYSTEM` estende o JSON com `variation` e atributos estruturais (mesmo descarte). A médio prazo, a folha de referência ganha referência por variação CORE (artes em `public/assets_pecas/`). `CopilotLexicon.TYPE_PREFIXES` passa a derivar de `subcategorySynonyms` + aliases (fim da lista paralela). |
| **Ranking da busca** (`CatalogMatchScorer`) | Novo componente `W_VARIATION` (sugestão 0,15) quando a intenção tem variação: 1 se igual, 0,3 se o produto tem `null`, 0 se diferente. Atributos estruturais entram em `W_DESIGN` (que já pesa estampa/logo). `search_text` inclui rótulos e aliases da variação para o FULLTEXT ngram. |
| **Hype Score** | Com variação, a chave do "modelo" em `HypeSnapshotService` (l.132) passa a `category\|subcategory\|variation\|brand`, deixando a raridade mais fina ("jeans barrel" ≠ "jeans skinny"). Requer recálculo do snapshot e período de convivência para não mexer em todos os níveis de uma vez. |
| **Datasets / embeddings** | `garment_embeddings` e `piece_images` ganham `variation` como rótulo de treino. `DatasetSource`/`VisionDataset` podem filtrar por variação. Os embeddings não mudam; os rótulos novos só ampliam a avaliação. |
| **i18n** | Chaves `taxonomy.var.<CODE>` e `taxonomy.attr.<DIM>.<CODE>` geradas do JSON (pt/en/es). |

---

## G. Seed

`proposta/seed_piece_variations.sql`:
- **Natureza:** rascunho, **não** Flyway.
- **Sintaxe:** MySQL 8/9, InnoDB, `utf8mb4_0900_ai_ci`, CHECKs de tier e prioridade, FKs entre as tabelas de referência.

**Execução no MySQL.**
- Rodado no MySQL 8.0.46, instalado no container da sessão (datadir temporário, fora do repositório), num schema descartável `tax_scratch`.
- Contagens após a carga: 5 categorias, 78 subcategorias, 394 variações, 541 vínculos (244/216/81), 1.892 aliases de variação, 30 dimensões, 387 valores, 1.356 aliases de valor, 1.650 linhas de aplicabilidade.
- Consultas de resolução:
  - alias `wide` em `jeans` → `WIDE_LEG`;
  - `pantalona` em `casual_pants` → `PALAZZO`;
  - zero vínculos `casual_sneakers × CHELSEA`.
- Bloco V40 (comentado no fim do arquivo), aplicado sobre `wardrobe_items`/`catalog_products` simuladas:
  - a FK composta aceitou `jeans/WIDE_LEG` e `t_shirt/NULL` e recusou `casual_sneakers/CHELSEA`;
  - o rollback devolveu as tabelas ao estado original.
- O container `fai-mysql` **não** foi usado: o daemon Docker não estava rodando.

**Validação dos arquivos (python3):**
- linhas do CSV (541) = vínculos no JSON (541), mesmos pares;
- 0 pares (subcategory, variation) duplicados;
- 78/78 subcategorias existentes cobertas;
- 394 variações no JSON, todas usadas;
- CSV ordenado: categoria → subcategoria (ordem oficial) → tier → prioridade → código;
- nenhum alias ambíguo dentro de uma subcategoria nem dentro de uma dimensão com escopos sobrepostos;
- todos os códigos de variação em UPPER_SNAKE_CASE.

---

## H. Filtros da busca catalogada (pedido do fundador)

### H.1 Selects e de onde vem cada dado

| Select | Fonte no banco | Como obter |
|---|---|---|
| Categoria / Subcategoria | `catalog_products.category/subcategory` | Já existe. |
| Variação | `catalog_products.variation_code` (V40) | Alias no nome → alias na descrição → IA (vocabulário fechado) → usuário/admin. |
| Cor | `catalog_products.color` + `catalog_variants.color` | Já existe (paleta). |
| Material (família) / Tecido | `material` + `catalog_product_attribute(MATERIAL_DETAIL)` | JSON-LD `material`; alias na descrição oficial; IA. |
| Estampa | `design_json.pattern` → espelho em `catalog_product_attribute(PATTERN)` | `CatalogDesignInterpreter` (já existe). |
| Acabamento, comprimento, cintura, manga, decote, fechamento, cano, salto… | `catalog_product_attribute` | Aliases no nome e na descrição (com `MODIFIERS` capturando) + implícitos + IA. |
| Estilo (≤2) / Ocasião (≤2) | `catalog_product_attribute(STYLE/OCCASION)`, `source=RULE\|AI` | Ver "Estilo e ocasião", abaixo da tabela. |
| Gênero | `catalog_products.gender` | JSON-LD `audience.suggestedGender`; URL/segmento ("/feminino/", "- Women", que `clean_title` hoje remove); `genderSynonyms`. |
| Faixa de preço | `price_brl` → `PRICE_RANGE` | Ver H.2. |
| Marca | `brand_id` → `brands` | Já existe (autocomplete). |

Estilo e ocasião são obtidos em três camadas, nesta ordem:
1. **Regras** subcategoria/variação/material → estilo e ocasião padrão, respeitando `allowedOccasions`:
   - `blazer.TAILORED` → tailored/classic, work/business;
   - `jeans.BAGGY` → streetwear, casual;
   - `sandals.FOOTBED` → casual, travel;
   - `heels.PUMP` → classic/chic, work/party.
2. **IA** com vocabulário fechado sobre nome + descrição + imagem, só quando a regra não decide.
3. **Voto dos donos** (`wardrobe_items` ligados ao produto), que refina com o tempo.

### H.2 Preço

1. **Coleta.** Em `structured_product` (`official_sitemap.py`), ler `offers.price` + `offers.priceCurrency`.
   - Na falta deles: `offers.lowPrice`/`highPrice` (AggregateOffer), `priceSpecification.price` ou `og:price:amount` + `og:price:currency`.
   - Gravar `price_amount`, `price_currency` e `price_observed_at`.
2. **Conversão.** `price_brl` é calculado na ingestão (câmbio do dia, registrado no relatório do run). O valor original nunca é sobrescrito.
3. **Faixas.**
   - Absolutas no seed (BRL): BUDGET < 150 · MID 150–400 · PREMIUM 400–1.200 · LUXURY > 1.200.
   - Alternativa: percentis por subcategoria (decisão I-7).
   - O preço é exibido como "informativo, coletado em <data>". **Não** é oferta e é revalidado junto com `last_verified_at`.

### H.3 Regras de UX dos filtros

- **Selects dependentes da subcategoria.**
  - Sem subcategoria: categoria, subcategoria, cor, gênero, estilo, ocasião, preço e marca.
  - Com subcategoria: entram a variação e só as dimensões do `appliesTo` (WAIST_RISE só em partes de baixo, SHAFT_HEIGHT só em tênis e botas…).
- **Ordem dos valores.** CORE primeiro, por prioridade. EXTENDED e NICHE ficam atrás de **"Ver mais"**. NICHE só aparece se a contagem for > 0.
- **Contagem por opção** ("Wide leg (42)"):
  - vem de `GROUP BY value_code` em `catalog_product_attribute` (índice `idx_cpa_facet`);
  - é calculada sobre o resultado filtrado pelos **outros** filtros (facetas disjuntivas);
  - opções com 0 ficam desabilitadas, mas não somem, para a lista não "pular".
- **Combinação.** Vários valores no mesmo select = OU; selects diferentes = E.
- **"Não informado"** aparece como opção quando > 0, para não esconder os ~70% sem variação no início do backfill.
- **Chips do texto livre.** O que o texto livre reconhece vira chip removível ("wide" → Variação: Wide leg), pelo contrato de alias de D.4.
- **API.**
  - `/api/catalog/search` recebe `variation`, `attr[DIM]=CODE` (repetível), `style`, `occasion`, `gender`, `priceMin`/`priceMax` ou `priceRange` e `brand`.
  - A resposta traz `facets: {DIM: [{code, label, count, tier}]}`.
  - O filtro de gênero, hoje feito no cliente (`catalog-search.tsx` l.105), passa para o servidor.

---

## I. Decisões em aberto para o fundador

1. **Caimento em tops.** Confirmar `FIT` como dimensão separada em tops e outerwear, enquanto nas partes de baixo o caimento é a variação.
2. **Botas e cano alto.** Manter `ankle_boots`, `long_boots`, `combat_boots` e `high_top_sneakers` (proposta atual, com implícitos) ou unificar em `boots`/`casual_sneakers` + `SHAFT_HEIGHT`. Unificar exige mapear dados antigos e mudar as artes por subtipo.
3. **SLIDE.** A canônica é `sandals` ou `flip_flops`? Hoje a variação liga às duas.
4. **loafers × moccasins.** Manter os dois ou fundir? No varejo BR, "mocassim" ≈ loafer.
5. **Esporte como subcategoria.** Manter `running_shoes`, `training_shoes`, `basketball_shoes` e `skate_shoes` (com `USAGE_TYPE` implícito) ou rebaixá-las a `USAGE_TYPE` de `casual_sneakers`.
6. **Ocasiões por categoria (B.4).** Liberar social/trabalho em acessórios (gravata, relógio), festa em partes de baixo e trabalho em calçados — ou passar a regra para subcategoria.
7. **Faixas de preço.** Absolutas em BRL (seed) ou percentis por subcategoria? Com quais limites?
8. **Novas subcategorias (C.3).** `swimwear`, `travel_bag` e `anklet` entram? Moda praia exige política de moderação.
9. **Materiais.** Adicionar as famílias `LINEN`, `VISCOSE`, `METAL` e mover "metal/aço" de `SYNTHETIC` para `METAL`?
10. **Cores que são estampa ou acabamento.** Deprecar `print`, `multicolor`, `washed_black` e `metallic_*` em favor de `PATTERN`/`FINISH`, ou manter e mapear?
11. **Fonte única.** Estender o `normalization.json` (recomendado) ou criar um `taxonomy.json` irmão? Nos dois casos, `Taxonomy.java` passa a ler do arquivo.
12. **Hype Score.** Incluir a variação na chave de raridade já, ou só quando o backfill passar de X% de cobertura?
13. **Atributos obrigatórios.** A proposta deixa todos os novos opcionais. Algum deve ser obrigatório em alguma subcategoria (ex.: `WAIST_RISE` em jeans)?
14. **Limiares de confiança da IA (0,4/0,6).** Calibrar com amostra rotulada do acervo antes de ativar.
