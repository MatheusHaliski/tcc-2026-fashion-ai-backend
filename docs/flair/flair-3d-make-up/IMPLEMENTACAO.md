# FLAIR 3D MAKE UP: como implementar a maquiagem, o júri e o palco que reage

Data: 07/11/2026. Pesquisa técnica com leitura do código; nenhum código mudou. Complementa `ESTUDO_DREST.md`,
`REUSO_PROVADOR_E_AVATAR.md` (câmeras, avatar, catálogo e módulos de reuso, cujas tabelas este documento **não repete**),
`JOGOS.md`, `PROTAGONISTA_E_RECURSOS.md` e `docs/plataforma/APP_NATIVO_UNREAL.md`.

**Legenda:** **[D]** documentado (código do repositório com caminho, documentação oficial, texto de lei); **[P]**
imprensa, comunidade ou material de fornecedor; **[I]** inferência e proposta deste estudo. **[decidir]** marca escolha
da dona. Números entre colchetes, como [8], remetem às fontes no fim.

**Pedido da dona (literal):** "Pesquise como implementar o novo: FASHION AI FLAIR 3D MAKE UP GAMES".

## 0. Resposta curta [I]

1. **Maquiagem = pilha de camadas no UV canônico do MediaPipe**, igual para qualquer rosto (avatar, modelo da casa,
   amiga): uma textura de cor e duas de acabamento, compostas na GPU só quando o look muda e lidas pelo rosto por um
   segundo UV (`uv1`). Sem decal e sem reassar a pele 2048² a cada clique.
2. **Cada camada mistura absorção (multiplica) e cobertura (substitui)**, à maneira de Kubelka-Munk [5][6][7]: o mesmo
   blush aparece em pele clara e retinta sem "pintura chapada". Acabamento vira parâmetro PBR do
   `MeshPhysicalMaterial` que a pele já usa: rugosidade, especular tingido, clearcoat, iridescência e brilho [1][2].
3. **Unreal**: o MetaHuman já expõe base, olhos com duas cores, blush, lábios e unhas como parâmetros [8][9][10]; o
   avatar próprio usa Material Layers sobre um render target no UV canônico [11][12]. Decal não serve [13].
4. **Try-on comercial** (Perfect Corp, ModiFace, Banuba) é pago, fechado ou manda foto à nuvem; a base é o MediaPipe
   já usado (Apache-2.0, no aparelho) [16][17]. **Catálogo**: tom = variante, com Lab, subtom, acabamento e cobertura
   numa tabela nova `catalog_shades`, vinda de feed da marca, nunca de raspagem [31].
5. **Júri sem IA paga**: regras determinísticas no servidor (tema, harmonia em LCh/ΔE00, intensidade, ponto focal,
   acabamento, base relativa ao melhor tom do catálogo) mais voto às cegas da comunidade, como o DREST [25]. **A nota
   nunca depende do tom de pele**, e um teste com 10 tons (escala Monk [27]) garante o mesmo máximo para todos.
6. **O palco reage à nota**: close-up no rosto na ponta da passarela, plateia em três níveis de custo, palmas
   sintetizadas por Web Audio [39]; a amiga reage com morphs feitos dos 468 pontos, como a boca do Heist já faz.
7. **Plano**: ≈ 8 semanas-pessoa além do MVP de reuso (`REUSO_PROVADOR_E_AVATAR.md` §5.1), em cinco fases jogáveis.

## 1. Renderizar maquiagem num rosto 3D

### 1.1 Ponto de partida no código [D]

- O corpo MakeHuman sabe, por vértice, onde cai no rosto canônico do MediaPipe (`lib/avatar3d/canonical-face.ts`):
  `faceUv` e `faceWeight` em `BodyAsset.body` (`human/asset.ts`), usados por `bakeSkin` (`human/skin-bake.ts`). A pele
  é `MeshPhysicalMaterial` (`roughness 0.55`, `sheen 0.22`) com patch por `onBeforeCompile` (`installEarScattering`)
  em `human/three-human.ts`, **congelado** (333 linhas): extrair uma responsabilidade antes de acrescentar.
- Tom de pele em CIELAB com subtom (`skin-tone.ts`), ΔE2000 em TS (`identity/metrics.ts`) e proibição de registrar cor
  de pele (`identity/privacy.ts`). O que falta (regiões, batom fotografado, unhas, cílios) está em REUSO §2.3–2.4.

### 1.2 Pipeline recomendado no web [I]

| Etapa | Como | Por quê |
|---|---|---|
| Máscaras | Polígonos dos marcos no UV canônico (lábios, pálpebra, côncavo, linha dos cílios, maçã, contorno, zona T, olheira, arco do cupido) viram SDF suavizadas, geradas uma vez e versionadas como textura KTX2 | O UV canônico é igual para toda pessoa: a máscara segue o rosto deformado sem cálculo por usuário |
| Composição | `WebGLRenderTarget` 1024² (2048² no close-up do desktop), um quad por camada na ordem da §1.3, só quando o look muda [3][4] | Trocar tom ou opacidade custa milissegundos; o laço afim de `bakeSkin` em Canvas 2D custa décimos de segundo |
| Leitura | `faceUv` vira o atributo `uv1`; `roughnessMap` (G), `clearcoatMap` (R), `specularIntensityMap` (A) e, numa segunda textura, `iridescenceMap` com `texture.channel = 1` [1][2]; a cor entra por patch em `map_fragment`, ponderada por `faceWeight` | Mapas nativos dispensam shader para o acabamento; o patch segue o padrão de `installEarScattering` |
| Grupo do rosto | Triângulos com `faceWeight ≥ 40` num material próprio (`roughness = 1`, o mapa guarda a rugosidade absoluta; pele nua = 0,55), com clearcoat e iridescência | O custo extra do material físico fica só nos pixels do rosto [1]; custa +1 chamada de desenho |
| Exportação | Para GLB, foto e Unreal, assar a camada no UV MakeHuman com o warp extraído de `bakeSkin` (`face-warp.ts`, REUSO §2.4) | glTF não guarda `onBeforeCompile`, limitação já anotada para os olhos em `three-human.ts` |

### 1.3 Camadas, ordem e mistura

| # | Camada | Máscara | Mistura [I] | Parâmetros do produto |
|---|---|---|---|---|
| 0 | Lábio neutro (opcional) | lábios | Puxa o lábio fotografado para um tom natural derivado da pele, na força da cobertura do batom | — (resolve o batom real que `lipProtection` preserva) |
| 1–2 | Base e corretivo | oval sem olhos e boca; olheira e laterais do nariz | Duas parcelas (§1.4) com preservação de detalhe | tom Lab, subtom, cobertura |
| 3 | Contorno / bronzer | faixa sob o malar, têmporas, mandíbula | Absorção forte, cobertura baixa | tom, intensidade |
| 4 | Blush | maçã do rosto | Absorção + cobertura conforme a textura (pó, creme) | tom, intensidade |
| 5 | Iluminador | malar alto, ponte do nariz, arco do cupido, arcada | Aditivo leve + rugosidade baixa + especular tingido | tom, acabamento |
| 6 | Sombra (2 cores) | pálpebra móvel e côncavo, em gradiente | Primária e secundária, como `PrimaryColor`/`SecondaryColor` do MetaHuman [9] | 2 tons, acabamento |
| 7 | Delineador | linha dos cílios + "gatinho" opcional | Cobertura ≈ 1, borda SDF antisserrilhada | tom, estilo |
| 8 | Máscara / cílios | geometria (§1.6) | Cor e escala dos cards | comprimento, volume |
| 9 | Sobrancelha | fibras de `human/brows.ts` + mancha no atlas | Tinge as fibras e preenche falhas | tom, densidade |
| 10–11 | Lápis, batom, tinta | contorno externo; lábios | Lápis: faixa fina de cobertura alta. Batom: duas parcelas, preservando as linhas do lábio | tom, acabamento, cobertura |
| 12 | Gloss | lábios | Sem cor ou tinta leve; só clearcoat | brilho, tinta |
| 13 | Glitter | qualquer máscara | Brilho por célula (§1.5) | densidade, tamanho, cor |

### 1.4 Mistura sensível ao tom de pele [I]

Compor em sRGB **linear**; Lab só no júri. Para cada camada com máscara `m`, opacidade `α`, cor do produto `S` e
cobertura `c` (sheer ≈ 0,3; média 0,6; total 0,9):

```text
tinta     = S / max(S.r, S.g, S.b)                     // pigmento que absorve: escurece e tinge
detalhe   = (pele / pele_borrada) ^ (1 - 0,75·c)       // sardas e poros somem só com cobertura alta
resultado = mix(pele, mix(pele·tinta, S·detalhe, c), α·m)
```

- A parcela multiplicativa explica por que um rosa translúcido quase some na pele retinta; a de cobertura, por que um
  blush pigmentado continua visível nela. É o que Kubelka-Munk modela com absorção e espalhamento, medido em bases,
  blushes e batons reais por Huang et al. [5]; Li, Zhou e Lin simulam base, blush, batom e sombra em camadas
  intrínsecas [6]; e um trabalho de 2025 aproxima KM direto de sRGB [7], que é o que cabe num shader de celular.
- Base: o tom sugerido é o de menor ΔE00 ao Lab da pele medida (`skin-tone.ts`), com h°ab desempatando o subtom,
  calculado **no aparelho**. Contorno e iluminador mudam valor, não matiz: contorno com tinta neutra-fria e `c` baixo;
  iluminador soma até 15% de `S` e mexe no acabamento. `pele_borrada` é uma cópia 128² do atlas, feita uma vez.

### 1.5 Acabamentos como parâmetros PBR

| Acabamento | `roughness` absoluta | Especular | Clearcoat | Outros [I] |
|---|---|---|---|---|
| Matte | 0,85–0,9 | `specularIntensity` 0,3 | 0 | — |
| Satin / cream | 0,5–0,6 | 0,6 | 0 | — |
| Dewy (base luminosa) | 0,4 | 0,8 | 0 | — |
| Gloss | a da pele | 1,0 | 1, `clearcoatRoughness` 0,05–0,15 | tinta opcional |
| Shimmer | 0,45 | 0,7 | 0 | brilho fino, densidade alta |
| Metálico | 0,3 | `specularColor` tingido pelo tom | 0 | `iridescence` 0,3–0,6 para duocromo |
| Glitter | 0,5 | 0,6 | 0,3 | brilho grosso, densidade baixa |
| Velvet / blur | 0,9 | 0,2 | 0 | `sheen` 0,3 |

- O `MeshPhysicalMaterial` tem `clearcoat` e `clearcoatMap`, `sheen`, `iridescence`, `specularIntensity` e
  `specularColor`, que tinge o especular de não-metais; cada efeito ligado aumenta o custo por pixel [D][1]. No web, o
  metálico sai melhor como especular tingido mais iridescência do que com `metalness` alto, que apaga o difuso da
  pele [I]; no MetaHuman ele vira o parâmetro `Metalness` de olhos e lábios [9].
- **Brilho (glitter, shimmer)**: no patch, dividir `uv1` em células, sortear uma normal por célula (hash) e somar
  `pow(max(dot(reflect(-V, n), L), 0), 200)` × máscara. Depende do ângulo, não do tempo: com a câmera parada não
  pisca, o que respeita o limite de três flashes por segundo da WCAG 2.3.1 [D][45].

### 1.6 Unhas, cílios e sobrancelhas [I]

- **Unhas**: 10 tampas finas numa malha presa aos ossos distais (o rig Mixamo tem `HandIndex3` e afins), com material
  físico próprio, para o esmalte usar a §1.5 sem tocar a pele. O exportador (`body-export/export_body.py`) já lê os
  grupos de vértices do MPFB; sem grupo de unha, selecionar a ponta dorsal da falange distal.
- **Cílios**: cards com alfa na pálpebra superior (marcos 246, 161–157, 173 e o espelho), como as fibras de
  `brows.ts`; máscara = comprimento, curvatura e espessura. **Sobrancelha**: o produto tinge as fibras e preenche
  falhas no atlas, sem formato genérico (cabeçalho de `brows.ts`) [D].

### 1.7 No Unreal Engine 5

- **Elenco fictício em MetaHuman** (Lina Vale, a amiga): base e corretivo (intensidade, cor, rugosidade), olhos (tipo,
  cor primária e secundária, rugosidade, opacidade, metalicidade), blush (tipo, cor, intensidade, rugosidade) e lábios
  (tipo, cor, rugosidade, opacidade, metalicidade) [D][8][9]; unhas têm cor própria na pele e a montagem "unbaked"
  expõe todo o material [D][10]. O JSON da §3 mapeia para esses campos via `UMaterialInstanceDynamic`; contorno,
  iluminador e glitter, fora da estrutura, vão numa camada própria [I].
- **Avatar do jogador** (corpo MPFB2 importado, caminho (a) de `APP_NATIVO_UNREAL.md` §1.4): pele com **Material
  Layers** (pele + maquiagem, com Layer Blend por máscara) [D][11] lendo um render target no UV canônico, exportado como
  segundo canal de UV. Compor com `DrawMaterialToRenderTarget` por camada, ou `Begin/End Draw Canvas` para várias, porque
  cada chamada isolada redefine o alvo e custa caro [D][12].
- **Decal não**: no renderizador móvel, decal iluminado exige o caminho deferred, não funciona com luz estática e não
  mistura normais [D][13]; em malha animada o decal "escorrega" [I]. **Runtime Virtual Texture também não**: no máximo
  3 camadas [D][14] e feito para cenário estático [I].

**Desempenho no celular** [I]:

- Memória: cor 1024² RGBA8 (4 MiB), acabamento 2 × 512² (2 MiB), pele borrada 128²; 2048² só no close-up do desktop.
  Render target não se comprime em tempo real; as máscaras estáticas vão em KTX2 [P][15].
- Compor só na mudança, aquecer o shader com `renderer.compile` ao abrir o lugar e fixar a chave de cache por
  combinação de recursos. Medir em aparelho real: o tamanho máximo de textura relatado engana [P][15].

## 2. Tecnologias de try-on e licenças

| Tecnologia | O que é | Onde processa | Licença / custo | Para um app 13+ com LGPD [I] |
|---|---|---|---|---|
| MediaPipe Face Landmarker | 478 pontos + 52 blendshapes, npm `@mediapipe/tasks-vision` [D][16] | No aparelho; envia só métricas de uso [D][17] | Apache-2.0 [D][17] | **Base**: já no repositório (`package.json`, 1.2.0) |
| Perfect Corp / YouCam | API REST e módulo web; 350+ looks por chamada [P][18] | API sobre foto enviada | Assinatura e chave de API [P][18] | Só parceria de dados ou de marca: rosto de menor na nuvem fere a minimização |
| ModiFace (L'Oréal) | SDK, API e miniprograma; TF.js no navegador [P][19] | Navegador ou app | Só parceiros corporativos [P][19] | Parceria com marcas do grupo, sem dependência |
| Banuba | SDK de maquiagem AR, web em WebAssembly [P][20] | No aparelho (alegação do fornecedor) | Pago por plataforma e mês; teste de 14 dias [P][20] | Fora: o projeto não paga licença |
| Snap Camera Kit | Lentes AR em app e site próprios | Lente no aparelho | Gratuito e monetizável; termos de 13/02/2026 pedem conteúdo 13+, atribuição e aceite dos termos da Snap [D][21] | Fora do núcleo: rosto real na câmera e terceiro no fluxo |
| Meta Spark; Jeeliz FaceFilter | Plataforma AR; rastreamento de rosto WebGL | —; no aparelho | Spark encerrado em 14/01/2025 [P][22]; Jeeliz Apache-2.0 segundo espelhos, demos com licença própria [P][24] | Descartar; redundante com o MediaPipe |
| BeautyGAN, PSGAN, EleGANt | Transferência de maquiagem foto → foto | GPU | EleGANt: CC BY-NC-SA 4.0 [D][23] | Fora: não comercial, GPU e foto de rosto |
| Huang 2013; Li 2015; KM 2025 | Modelos físicos de cosmético [5][6][7] | — | Artigos | **Ideias** para a mistura da §1.4 |

Conclusão [I]: o FashionAI maquia **avatares**, não o vídeo do rosto, e não precisa de try-on de terceiro. O atlas do
avatar já é dado biométrico em chave privada (`V25__avatar_3d.sql`) [D], sensível pela LGPD (art. 5º, II; bases do
art. 11; melhor interesse do adolescente no art. 14) [D][32]: a maquiagem é composta no navegador e o servidor recebe
só ids de produto e parâmetros. O **Beauty Mode** do DREST (2021, com Gucci Beauty) confirma o desenho: close-up do
rosto do modelo, tons e intensidade de marcas reais e compra do produto [P][25].

## 3. Modelo de dados do produto de maquiagem

Categoria `beauty_piece`, subcategorias e dimensões seguem REUSO §3.3. Este estudo acrescenta o **nível do tom**, numa
tabela 1:1 com `catalog_variants`, que já tem `color`, `color_name`, `sku`, `gtin` e preço [D]:

```json
{ "variantId": "…", "productId": "…", "brand": "FashionAI Beauty", "product": "Batom Veludo", "type": "lipstick",
  "region": "LIPS", "shade": { "name": "Rubi 04", "hex": "#9B1B30", "lab": [32.1, 48.7, 20.3], "undertone": "COOL",
  "depth": null }, "finish": "MATTE", "coverage": 0.9, "sparkle": null, "duochromeHex": null,
  "tags": ["festa", "classico", "statement"], "gtin": "…", "offer": { "url": "…", "affiliate": true },
  "source": "BRAND_FEED", "measured": "D65_SPECTRO", "verified": true }
```

| Campo de `catalog_shades` [I] | Regra |
|---|---|
| `lab_l`, `lab_a`, `lab_b` | Lab D65 medido em espectrofotômetro sobre esfregaço da marca (preferido) ou derivado do hex oficial, com `measured = DERIVED_HEX` |
| `undertone` | `COOL`, `NEUTRAL`, `WARM`, `OLIVE`: da marca; se faltar, pelo h°ab, marcado como inferido |
| `depth` | 1–10 só para base e corretivo, por faixa de L*; serve a filtros e ao teste de equidade (escala Monk, CC BY 4.0, com crédito [27]) |
| `finish`, `coverage` | Enum da §1.5 e 0–1 (a cobertura é o `c` da §1.4) |
| `sparkle_density`, `sparkle_size`, `sparkle_hex`, `duochrome_hex` | Só para shimmer, glitter e metálico |
| `source`, `verified`, `swatch_image_id` | Origem e confirmação, como o `priceVerified` das peças |

**Como as marcas fornecem** [I]: planilha ou feed (marca, produto, tipo, nome do tom, Lab ou hex, subtom, acabamento,
cobertura, GTIN, URL oficial, foto do esfregaço com licença) pela ingestão de catálogo existente (`CatalogIngestionRun`).
O protótipo usa a marca fictícia "FashionAI Beauty" (REUSO §3.3) com 60 tons gerados em Lab, L* de 15 a 90 × três
subtons, porque catálogos reais se concentram nos tons claros e poucas marcas cobrem L* 10–20 [P][26].

**Limites legais** [D/I]:

- **Nada de raspagem.** A Lei 9.610/98 protege bases de dados pela seleção e organização (art. 7º, XIII, e art. 87),
  fotos de esfregaço são obras, e há termos de uso e concorrência desleal [D][31]. Vale feed licenciado, página oficial
  com autorização ou medição própria do produto comprado.
- **Open Beauty Facts** (ODbL) serve à identidade do produto (GTIN, marca, nome), mas misturá-lo à base própria impõe
  compartilhar a derivada: fica separado e atribuído [P][28]. A The Pudding tem licença não confirmada: não importar
  [P][26]. **ANVISA**: só o que a marca fornece, sem alegações (RDC 752/2022) [D][35].
- **Afiliado**: comissão por link é publicidade para o CONAR (guia de 2026), com identificação clara e imediata [P][34].
  Para 13–17, nada de recomendar compra a partir do tom do avatar (a sugestão de tom é informativa) nem oferta com
  prazo; a ECA Digital proíbe caixa de recompensa (art. 20) [D][33]. [decidir] esconder a compra para menores ou só
  rotular.

## 4. Julgar o look com maquiagem sem IA paga

### 4.1 Briefing do desafio

Campo novo `makeupBrief` em `scripts/flair-games/data/serie-*.json`, que já têm `themeTags` e vagas por posição; as
palavras do tema viram tags por dicionário estático em pt-BR, en e es, sem modelo de linguagem [D/I]:

```json
"makeupBrief": { "occasion": "PASSARELA_EDITORIAL", "palette": ["#1B1B1B", "#C0C0C0"], "harmony": "ECO_OU_ANALOGA",
  "intensity": [0.55, 0.9], "focus": "OLHOS", "finishes": { "prefer": ["METALLIC", "GLOSS"], "avoid": ["GLITTER"] },
  "tags": { "want": ["futurista", "prata"], "avoid": ["romantico"] }, "base": "OPCIONAL", "nails": "COMBINAR" }
```

### 4.2 Regras (100 pontos) [I]

| Regra | Pontos | Como medir |
|---|---|---|
| R1 Tema | 20 | Tags dos produtos ∩ `tags.want`, menos `tags.avoid` |
| R2 Paleta | 25 | Cada acento (lábios, olhos, blush, unhas) em LCh contra as cores do look (peso por área: VES > SUP > INF > CAL > ACE) e a paleta do briefing: **eco** (ΔE00 ≤ 12 com um acento da roupa), **análoga** (Δh ≤ 30°), **complementar** (Δh 155–205°, se o briefing aceita contraste), **neutra** (C* < 12); **choque**: dois acentos com C* > 35 e Δh entre 30° e 150° sem pedido de maximalismo |
| R3 Intensidade | 15 | Σ peso da região × opacidade × (C*/60 + fator do acabamento), calculada no **produto**, dentro da faixa do briefing |
| R4 Ponto focal | 10 | A região pedida (`focus`) tem o maior contraste ΔE00 com a pele **do mesmo rosto**: comparação interna, justa para qualquer tom |
| R5 Acabamento | 10 | Preferidos somam, evitados subtraem |
| R6 Base | 10 | Cheia se o tom está a ΔE00 ≤ 2 do **melhor tom disponível no catálogo** para aquela pele; sem base, cheia salvo briefing que exija |
| R7 Unhas e detalhes | 10 | Esmalte em eco com um acessório ou com o batom; metálico com metal |

- **Cor**: hex → Lab D65 → LCh; ΔE00 de Sharma, Wu e Dalal, conferido com os 34 pares de teste deles [D][29]. Em Java,
  `ColorMath.deltaE` é CIE76 [D]: não mudar (outros usos dependem dele) e criar `ColorDifference` portando o
  `deltaE2000` de `identity/metrics.ts`. Os setores de matiz simplificam os modelos de Matsuda usados por Cohen-Or et
  al. [D][30]; o projeto já faz harmonia por família em `LocalSchemeComposer.harmony` e `CbcRules.harmonious` [D].
- **Equidade**: a pele só entra em R4 (dentro do rosto) e R6 (relativa ao catálogo), então uma pele retinta não perde
  ponto porque a marca não fez o tom dela [P][26]. R6 lê o `skin` de `user_avatars_3d.model_json` [D] só quando a
  protagonista é o avatar, reduz a Lab e nunca o registra em log; com a modelo da casa, a pele é a da personagem.
- **Integração**: o juiz devolve 0–100 e a converte em sintonia por vaga de maquiagem (0–3), que entra no placar
  existente; produto vetado segue `Flair3dPenalties` (REFUSED −2) e nada sai da carteira [D]. A montagem perfeita
  (sintonia ≥ 2 por vaga obrigatória) continua pagando +10 FAI Points [D: `JOGOS.md`].
- **O júri nunca comenta rosto, corpo ou tom**: julga a escolha frente ao briefing. Não existe "nota de beleza".

### 4.3 Voto da comunidade, como o DREST [I]

- O modo `COMUNIDADE` de `ChallengeService` já tem voto às cegas até o resultado, reações por emoji e frases prontas,
  sem texto livre [D]; como o arquivo está congelado (1.852 linhas), o voto no look entra num colaborador novo
  (`FlairLookVoting`) que reusa `ChallengeVoteRepository`.
- Ranking = 0,6 júri + 0,4 comunidade (média bayesiana, mínimo de 20 votos, peso por conta limitado); a reação ao vivo
  usa só o júri. Look público de menor de 18 sai na **modelo da casa**; o avatar próprio, só para amigos (o rosto de
  13–17 já é privado por padrão em `PROTAGONISTA_E_RECURSOS.md` §6) [decidir].

### 4.4 Da nota à reação

`s = nota/100`, com as faixas e a histerese de REUSO §4.2 (< 0,35; 0,35–0,7; > 0,7) mais a **montagem perfeita**, que
pede bis e confete (sem confete com movimento reduzido). O servidor devolve `tier`, `perfect` e `cues`: ids da regra
mais forte e da mais fraca ("o batom conversa com a bolsa", "o briefing pedia algo mais sóbrio"), que viram falas da
amiga e gritos da plateia em pt-BR, en e es.

## 5. Reações interativas no lugar

### 5.1 A passarela (web) [I]

- **Roteiro**: entrada (murmúrio) → caminhada (olhares seguem a modelo) → pose na ponta com **close-up no rosto**
  (paradas do rosto, REUSO §5.1) → pico da reação → giro e saída. O close-up antes do aplauso liga a maquiagem à
  resposta. **Dinâmica** (função pura, `lib/venue3d/crowd-dynamics.ts`): alvo pela faixa, suavizado (τ ≈ 0,4 s), com
  contágio: cada assento atrasa pela distância à modelo mais um sorteio, e 10% de "puxadores" começam antes.
- **Plateia, do mais barato ao mais rico**: (a) silhuetas instanciadas com mãos (REUSO §4.2) sobre a `Audience` de
  `components/three/runway-scene.tsx` [D]; (b) uma `InstancedMesh` de pessoa low-poly com 2–3 morphs (mãos juntas,
  mãos separadas, de pé) por instância, via `setMorphAt` e `morphTexture` [D][36]; (c) skinning instanciado ou textura
  de animação de vértices, que a comunidade leva a dezenas de milhares de instâncias em poucas chamadas [P][38], só no
  desktop. Primeira fila: 4–8 humanos com `cheer`, `photo` e o `clap` novo.
- **Flashes**: sprites aditivos instanciados, pela faixa, nunca mais de 3 por segundo (WCAG 2.3.1 [D][45];
  `reduceFlashes` em `components/heist/settings.ts`). **Som**: cada palma é uma rajada de ruído de 10–30 ms num
  passa-banda de 1–2,5 kHz; quatro camadas (esparsa, média, densa, gritos e assobios) pré-renderizadas em
  `OfflineAudioContext` como laços de 4 s, misturadas por `GainNode` com `setTargetAtTime` e espalhadas por
  `StereoPannerNode` [D][39], como as camadas e o murmúrio de `components/heist/audio.ts`, com som desligado por
  padrão (`lib/sensory.ts`, ETI-06) [D] e nenhum arquivo de áudio.

### 5.2 A amiga no provador (web) [I]

- **Expressões por morph**, geradas dos marcos sobre o corpo (`landmarksOn`), como `components/heist/people/mouth.ts`
  faz com a boca [D]: sorriso (cantos 61/291 sobem e abrem), sobrancelhas (105/334 e vizinhos), surpresa (sobrancelha,
  mandíbula e olho aberto pela abertura das pálpebras), cética (uma sobrancelha, lábios 13/14 apertados) e "uau" (boca
  em O). Os nomes seguem as 52 blendshapes do Face Landmarker (`mouthSmileLeft`, `browInnerUp`, `jawOpen`…) [16], no
  padrão ARKit, para o Unreal mapear sem tradução.
- **Corpo**: gestos procedurais existentes (`talk`, `wave`, `point`, `cheer` em `locomotion-social.ts`; `clap` em
  `locomotion-dance-moves.ts`) [D], ou clipes GLB misturados por `crossFadeTo` [D][37]; o olhar segue a parada de câmera
  ativa. **Máquina de estados** (redutor puro): `observa` → `micro` (a cada produto, debounce de 600 ms; o delta da regra
  decide aceno, sobrancelha ou "hmm") → `veredito` (no "pronto", pela faixa do servidor) → `sugere` (a regra mais
  fraca, em tom construtivo) → `observa`. Falas por chave i18n em `aria-live`; voz do navegador opcional e desligada.

### 5.3 No Unreal

| Peça | Recurso | Nota [I] |
|---|---|---|
| Plateia (PC, console) | Mass Entity, Mass Spawner e StateTree; **MetaHuman Crowds**, experimental na 5.8, simplifica cabelo, LOD e animação ao longe [D][40] | Rosto de plateia não precisa de maquiagem |
| Plateia (celular) | AnimToTexture (VAT) em malha estática instanciada; a comunidade relata quadros "picados" com R8G8B8A8 e usa FloatRGBA [P][41] | Mesma tabela de faixas do web |
| Som | MetaSounds com entrada `Intensidade` e gatilhos de palma, ligados por parâmetro do Audio Component [D][42] | Camadas iguais às do web |
| Amiga | Animation Blueprint com máquina de estados e Control Rig [D][43]; pose asset com curvas no padrão ARKit [I] | Mesmos ids de cue |
| Fala da amiga | Animação por áudio do MetaHuman Animator, em tempo real ou offline, local [D][44] | Falas gravadas ou voz local; nada pago |

## 6. Plano de implementação

### 6.1 Fases [I]

| Fase | Entrega jogável | Semanas-pessoa |
|---|---|---|
| F0 Dados e júri | `beauty_piece`, `catalog_shades`, 60 tons fictícios, `makeupBrief`, juiz com testes de cor e equidade | 2 |
| F1 Maquiagem no rosto | Compositor no UV canônico, material do rosto, 7 camadas (base, corretivo, blush, iluminador, sombra, delineador, batom/gloss), painel e câmera no rosto; cenas de laboratório em 10 tons | 3,5 |
| F2 Desafio 1: passarela | Briefing, envio, nota, faixa, plateia, som, close-up na ponta | 2,5 |
| F3 Amiga no provador | Morphs, gestos, máquina de estados, falas | 2 |
| F4 Completar | Unhas, cílios, contorno, glitter, voto da comunidade | 2,5 |
| F5 Unreal | Fatia vertical depois da Fase 0 de `APP_NATIVO_UNREAL.md` §4.3 | — |

F0–F4 somam ≈ 12,5 semanas-pessoa, das quais ≈ 4,5 já estão no MVP de reuso: o acréscimo deste estudo é ≈ 8 (os ≈ 40
dias da tabela abaixo).

### 6.2 Módulos novos (os de reuso estão em REUSO §5.1)

| Módulo | Tipo e limite (`LINE_RULES.md`) | Linhas | Esforço |
|---|---|---|---|
| `lib/avatar3d/makeup/compositor.ts`: render target canônico, passes, reserva em Canvas 2D | lib-ts 250 | 200 | 3 d |
| `lib/avatar3d/makeup/blend.ts` (fórmulas da §1.4 em GLSL e em TS, para teste) e `finish.ts` (tabela da §1.5) | lib-ts 250 | 180 + 90 | 3 d |
| `lib/avatar3d/makeup/face-material.ts`: grupo do rosto, `uv1`, mapas `channel = 1`, brilho. Antes, extrair `installEarScattering` de `three-human.ts` | lib-ts 250 | 180 | 3 d |
| `components/flair/makeup/makeup-panel.tsx`, `shade-grid.tsx`, `lib/hooks/use-makeup-look.ts` e `lib/avatar3d/makeup/shade-match.ts` (ΔE00 no aparelho) | componente 250, hook 150, lib-ts 250 | 220 + 150 + 140 + 80 | 5 d |
| `lib/venue3d/crowd-dynamics.ts`, `lib/venue3d/applause-synth.ts` | lib-ts 250 | 120 + 150 | 3 d |
| `lib/avatar3d/human/face-expressions.ts`, `lib/venue3d/friend-machine.ts` | lib-ts 250 | 200 + 140 | 4,5 d |
| `V99__beauty_catalog_e_maquiagem.sql` (`catalog_shades`, `catalog_offers`, `flair_makeup_looks`; versionada, nunca aplicada em produção), entidade `CatalogShade` e `CatalogShadeRepository` | sql, entidade 250, repositório 120 | 90 + 30 | 2 d |
| `flair/makeup/ColorDifference`, `MakeupPalette`, `MakeupJudge`, `ReactionTiers`, records `MakeupBrief` e `MakeupLook`; `FlairGameService` (212 → ≈ 222) só delega ao juiz | service 250, DTO 120 | 110 + 150 + 220 + 60 + 2 × 60 + 10 | 6,5 d |
| `MakeupCatalogService` e `FlairMakeupController` com DTOs | service 250, controller 200, DTO 120 | 180 + 120 + 3 × 60 | 4 d |
| `FlairLookVoting` (reusa `ChallengeVoteRepository`) | service 250 | 180 | 3 d |
| i18n pt-BR/en/es (tipos, acabamentos, regras, falas, rótulo de publicidade) e `makeupBrief` em `build.mjs` | json, script | — | 3 d |

### 6.3 Mudanças no backend [I]

- `GET /api/beauty/shades?type=&region=&undertone=&depth=&page=`: público, sem dado pessoal.
- `GET /api/flair/games/{slug}` passa a trazer `makeupBrief` (`FlairGameController`, 66 linhas) [D].
- `POST /api/flair/games/{slug}/check` e `/submit` ganham `makeup: [{variantId, region, opacity, placement}]` e
  `nails: {variantId}`: opacidade cortada em 0–1, `placement` em enum (`PADRAO`, `ESFUMADO`, `GATINHO`…), variante
  desconhecida = REFUSED, e nenhuma imagem, marco ou pele no corpo. Resposta: `{score, parts[{rule, points, basis}],
  tier, perfect, cues[]}`, com `basis` explicando cada número, como `FlairTier.Result.basis()` [D].
- `POST /api/flair/makeup/looks/{id}/votes` e `GET /api/flair/makeup/looks/{id}`, com resultado às cegas até o fim. O
  servidor recalcula tudo; nota mandada pelo cliente é ignorada.

### 6.4 Testes

- **Java**: `ColorDifferenceTest` com os 34 pares de Sharma [29]; caracterização de cada regra; **equidade** com 10
  peles sintéticas (Monk 1–10), catálogo completo e enviesado, máximo igual ±1 ponto; carteira intacta em toda
  penalidade; validação de payload; log sem Lab nem hex de pele.
- **Vitest**: máscaras (área e simetria com `mirrorIndex`), mistura (cobertura 0 = identidade; total a ΔE00 ≤ 2 do tom
  no albedo), acabamentos, redutor da amiga, plateia monótona na nota e com histerese, flashes ≤ 3/s.
- **Cena e aparelho**: renderizador de teste do R3F como em `components/three/scenes.test.tsx` (material compila, `uv1`
  presente, chamadas no orçamento); laboratório `/lab/scenes?s=makeup-…` com ganchos `__lab` nos 10 tons; iPhone 11
  (mínimo da UE 5.8) e um Android médio com `renderer.info`. Antes de commitar:
  `python -m scripts.refactoring.line_ratchet`.

### 6.5 Riscos (os de câmera e reuso estão em REUSO §5.4)

| Risco [I] | Mitigação |
|---|---|
| Colorismo: catálogo real concentrado em tons claros [26] | R6 relativa ao catálogo; seed fictício de L* 15 a 90; teste de equidade no CI |
| Pressão estética sobre adolescentes | Sem nota de beleza; júri e amiga falam da escolha; maquiagem opcional e para qualquer gênero; desafios sem maquiagem continuam valendo |
| Maquiagem "pintada" ou estranha | Preservação de detalhe, duas parcelas, revisão visual nos 10 tons a cada fase |
| Rosto de menor em voto público | Modelo da casa por padrão no público; composição só no aparelho |
| Dados de marca, raspagem e afiliado para 13–17 | Só feed licenciado ou medição própria (`source`); rótulo de publicidade claro, sem urgência |
| Celular e fotossensibilidade | Material físico só no rosto, desligado no nível baixo; brilho sem tempo; flashes ≤ 3/s |
| Diferença web × Unreal | Mesmo JSON de produto e de faixas; imagens de referência por plataforma |
| Voto manipulado | Peso por conta limitado, mínimo de votos, só reações prontas |

### 6.6 Decisões para a dona [decidir]

1. Desafio 1 na passarela (proposto) ou direto no provador com a amiga? 2. Produto de catálogo jogável por todos
(proposto, sem pay-to-win) e "nécessaire" própria como bônus de reuso? 3. Para 13–17, link de compra escondido ou só
rotulado? 4. Ranking 0,6 júri + 0,4 comunidade? 5. Voto público com o avatar próprio só para maiores de 18? 6. Qual
marca real convidar a mandar feed depois da "FashionAI Beauty"?

## Fontes

1. three.js, MeshPhysicalMaterial. https://threejs.org/docs/pages/MeshPhysicalMaterial.html
2. three.js, Texture (`channel`, `needsUpdate`). https://threejs.org/docs/pages/Texture.html
3. three.js, Material (`onBeforeCompile`) e WebGLRenderTarget. https://threejs.org/docs/pages/Material.html · https://threejs.org/docs/pages/WebGLRenderTarget.html
4. drei 10.7.7, `useFBO` (código-fonte). https://app.unpkg.com/@react-three/drei@10.7.7/files/core/Fbo.js
5. Huang et al., Physically based cosmetic rendering (2013). https://people.cs.nycu.edu.tw/~wclin/cosmetics.html
6. Li, Zhou e Lin, Simulating Makeup through Physics-based Manipulation of Intrinsic Image Layers (CVPR 2015). https://openaccess.thecvf.com/content_cvpr_2015/html/Li_Simulating_Makeup_Through_2015_CVPR_paper.html
7. Prova virtual de base com Kubelka-Munk a partir de sRGB (arXiv 2507.07333, 2025). https://arxiv.org/abs/2507.07333
8. Epic, MetaHuman: Makeup Material Controls. https://dev.epicgames.com/documentation/metahuman/makeup-material-controls
9. Epic, `FMetaHumanCharacterMakeupSettings` e nós Make de olhos e lábios. https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Plugins/MetaHumanCharacter/FMetaHumanCharacterMakeupSetting- · https://dev.epicgames.com/documentation/unreal-engine/BlueprintAPI/Utilities/Struct/MakeMetaHumanCharacterEyeMakeupP- · https://dev.epicgames.com/documentation/unreal-engine/BlueprintAPI/Utilities/Struct/MakeMetaHumanCharacterLipsMakeup-
10. Epic, MetaHuman: Skin Material Controls e Unbaked Assembly. https://dev.epicgames.com/documentation/metahuman/skin-material-controls · https://dev.epicgames.com/documentation/metahuman/metahuman-creator-unbaked-assembly-in-unreal-engine
11. Epic, Using Material Layers. https://dev.epicgames.com/documentation/en-us/unreal-engine/using-material-layers-in-unreal-engine
12. Epic, `DrawMaterialToRenderTarget`. https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/UKismetRenderingLibrary/DrawMaterialToRenderTarget
13. Epic, Mobile Rendering and Shading Modes. https://dev.epicgames.com/documentation/en-us/unreal-engine/mobile-rendering-and-shading-modes-for-unreal-engine
14. Epic, `URuntimeVirtualTexture` (API). https://dev.epicgames.com/documentation/en-us/unreal-engine/API/Runtime/Engine/URuntimeVirtualTexture
15. Fórum three.js: texturas pretas no iOS e KTX2; 8K falha e 4K funciona. https://discourse.threejs.org/t/textures-in-gltf-sometimes-display-black-but-only-on-ios/30520 · https://discourse.threejs.org/t/8k-basis-texture-not-loading-on-mobile-4k-works-fine/26425
16. Google, Face Landmarker para Web. https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js
17. MediaPipe no GitHub (Apache-2.0; processamento no aparelho). https://github.com/google-ai-edge/mediapipe
18. Perfect Corp, YouCam API e Virtual Makeup Try-On API. https://yce.perfectcorp.com/document/index.html · https://yce.perfectcorp.com/ja/ai-api/products/virtual-makeup-try-on-api
19. ModiFace, Makeup; TensorFlow Blog sobre ModiFace no navegador. https://modiface.com/products-makeup.html · https://blog.tensorflow.org/2020/02/how-modiface-utilized-tensorflowjs-in-ar-makeup-in-browser.html
20. Banuba (material do fornecedor). https://www.banuba.com/blog/best-makeup-virtual-try-on-sdks-compared-and-tested · https://www.banuba.com/blog/shopify-virtual-try-on-app-pricing
21. Snap, Camera Kit Terms; guia WebAR; Lens Fest 2025. https://www.snap.com/terms/snap-camera-kit · https://ar.snap.com/blog/guide-web-ar-camera-kit · https://newsroom.snap.com/lens-fest-2025
22. Neowin, encerramento do Meta Spark. https://www.neowin.net/news/meta-is-shutting-down-spark-ar-effects-platform/
23. EleGANt (ECCV 2022), repositório e licença. https://github.com/Chenyu-Yang-2000/EleGANt
24. Jeeliz FaceFilter. https://github.com/jeeliz/jeelizFaceFilter
25. DREST Beauty Mode com Gucci Beauty; Bakeup; NARS. https://fashionunited.com/news/fashion/drest-adds-beauty-mode-with-gucci-partnership/2021100442559 · https://cosmeticsbusiness.com/drest-collaborates-with-experimental-beauty-brand-bakeup-on-avatar-make-up-looks-208869 · https://www.glossy.co/beauty/nars-cosmetics-launches-on-drest-app
26. The Pudding, Beauty Brawl (2018) e dados. https://pudding.cool/2018/06/makeup-shades/ · https://github.com/the-pudding/data/tree/master/makeup-shades
27. Monk Skin Tone Scale (CC BY 4.0). https://skintone.google/ · https://en.wikipedia.org/wiki/Monk_Skin_Tone_Scale
28. Open Beauty Facts, dados (ODbL). https://world.openbeautyfacts.org/data
29. Sharma, Wu e Dalal, CIEDE2000: notas de implementação e dados de teste. https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/
30. Cohen-Or et al., Color Harmonization (SIGGRAPH 2006). https://www.microsoft.com/en-us/research/wp-content/uploads/2006/07/harmonization.pdf
31. Lei 9.610/1998; Demarest, "Web scraping: legal ou ilegal?". https://www.planalto.gov.br/ccivil_03/leis/l9610.htm · https://www.demarest.com.br/wp-content/uploads/2022/01/Web-scraping-legal-ou-ilegal-1.pdf
32. Lei 13.709/2018 (LGPD). https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
33. Lei 15.211/2025 (ECA Digital); Nota Técnica do MJSP sobre caixas de recompensa. https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm · https://www.gov.br/mj/pt-br/assuntos/noticias-1/mjsp-pede-a-anpd-que-monitore-jogos-eletronicos-com-caixas-de-recompensa-que-nao-implementaram-verificacao-de-idade/NotaTcnican55.pdf
34. Cescon Barrieu e Uai sobre o guia do CONAR (2026) e links de afiliado. https://cesconbarrieu.com.br/novas-diretrizes-do-conar-para-marketing-de-influencia-o-que-muda/ · https://www.uai.com.br/networking-e-negocios/2026/09/23/ganha-comissao-com-link-de-afiliado-para-o-conar-isso-ja-e-publicidade/
35. ANVISA, RDC 752/2022. https://antigo.anvisa.gov.br/documents/10181/5738443/RDC_752_2022_COMP.pdf/439ec340-390a-4920-8e32-14863cffdaf4
36. three.js, InstancedMesh (`setMorphAt`, `morphTexture`). https://threejs.org/docs/pages/InstancedMesh.html
37. three.js, AnimationAction (`crossFadeTo`, pesos). https://threejs.org/docs/pages/AnimationAction.html
38. Fórum three.js, skinning instanciado; Babylon.js, textura de animação de vértices. https://discourse.threejs.org/t/animated-instanced-skinned-meshes-gltf/41958 · https://doc.babylonjs.com/lite/architecture/15-vertex-animation-texture
39. MDN, Web Audio API e `AudioParam.setTargetAtTime`. https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API · https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/setTargetAtTime
40. Epic, Mass Gameplay; MetaHuman Crowds; City Sample. https://dev.epicgames.com/documentation/en-us/unreal-engine/overview-of-mass-gameplay-in-unreal-engine · https://dev.epicgames.com/documentation/metahuman/metahuman-crowds-in-unreal-engine · https://dev.epicgames.com/documentation/unreal-engine/city-sample-project-unreal-engine-demonstration
41. Fórum Unreal, tutorial do AnimToTexture para multidões. https://forums.unrealengine.com/t/community-tutorial-animtotexture-plugin-how-to-use-it-to-make-vertex-animation-textures-for-crowds/746648
42. Epic, MetaSounds. https://dev.epicgames.com/documentation/en-us/unreal-engine/metasounds-the-next-generation-sound-sources-in-unreal-engine
43. Epic, State Machines; Control Rig (4.27). https://dev.epicgames.com/documentation/en-us/unreal-engine/state-machines-in-unreal-engine · https://dev.epicgames.com/documentation/unreal-engine/control-rig?application_version=4.27
44. Epic, Audio Driven Animation; MetaHuman 5.6. https://dev.epicgames.com/documentation/en-us/metahuman/audio-driven-animation · https://metahuman.com/news/metahuman-leaves-early-access-with-a-feature-packed-new-release
45. W3C, WCAG 2.1, critério 2.3.1 (três flashes). https://www.w3.org/WAI/WCAG21/Understanding/three-flashes-or-below-threshold.html
