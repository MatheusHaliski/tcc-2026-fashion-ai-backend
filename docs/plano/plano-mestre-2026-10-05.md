# Plano mestre — o que foi entregue, o que falta e em que ordem (05/10/2026)

Este documento junta os objetivos pedidos em abertos nas últimas rodadas. Ele vale até tudo estar entregue. Cada
entrega fecha com testes, métricas, documentação, commit e push no ramo `claude/fashion-ai-interfaces-config-id7naj`.

**Regras que valem para tudo:**

- **Privacidade:**
  - fotos de pessoas, renders de rostos e parâmetros individuais nunca vão para o repositório nem para log;
  - no repositório entram só agregados.
- **Ambiente:**
  - backend local só pelo lançador isolado (localhost, sem IA remota);
  - nenhuma mudança em Railway, Vercel, Resend, DNS ou CORS sem pedido explícito.
- **Imagem:**
  - nenhum embelezamento automático;
  - nenhuma imagem de pessoa sem roupa.

---

## 1. Já entregue nesta rodada

| Item | Entrega | Onde |
|---|---|---|
| HAIR-F2 | Cabelo em fios por padrão (Kajiya-Kay, níveis de detalhe) | commit 5178d1d |
| GARMENT-AUDIT | Diagnóstico do pipeline 3D de roupas (15 entregáveis) | `docs/avatar3d/auditoria-roupas-3d/` |
| AVATAR-ID-AUDIT | Diagnóstico de identidade do avatar (22 entregáveis) | `docs/avatar3d/auditoria-identidade-avatar/` |
| PROV-2D | Prévia 2D no Espelho e no Vista-me com o mesmo Avatar 3D; reflexo no vidro do espelho do quarto | `docs/novos-rf/RF28_Previa_2D_Espelho_Vista-me.md` |
| AVATAR-ID I0 | Métricas de fidelidade, gate de identidade, logs sem dado pessoal, linha de base no CI | seção 23 da auditoria de identidade |
| AVATAR-ID I1 | Identidade versionada: refazer não apaga a aprovada; aprovar, restaurar, histórico | V38 + `Avatar3dService` |
| AVATAR-ID I2 | Camada de resíduo assimétrico + medidas nomeadas: SFace de frente 0,369 → 0,476, top-1 15/15 | `face-residual.ts`, `face-profile.ts` |
| AVATAR-ID I3 | Pele com balanço de branco pela esclera, rosto casado com o corpo: erro de cor 0,2, sem costura, gate 14/15 | `skin-tone.ts` |

---

## 2. Ordem de execução do que falta

| # | Item | Por que nesta posição |
|---|---|---|
| 1 | **WARDROBE-FIX**: tirar a peça do guarda-roupa e provar no espelho (hoje não funciona) | Defeito funcional relatado em teste |
| 2 | **AVATAR-ID I4–I7**: olhos (cor da íris, shader, ossos), cabelo e barba, rig facial, revisão visual, níveis de detalhe | Continua a cadeia de identidade; o desfile e o quarto usam o mesmo avatar |
| 3 | **GARMENT F0–F6**: moldes paramétricos, passes com restrições, XPBD, camadas, detalhes | Base de "roupa que veste" e de "tecido com movimento natural" (itens 5 e 6) |
| 4 | **CATALOG-IMG V2**: pipeline profissional das fotos oficiais da Busca Catalogada (seção 4) | Alimenta cards, IA, 2D, 3D e Hype Score |
| 5 | **QUARTO-REAL**: quarto, guarda-roupa e espelho coerentes e realistas, avatar dentro do quarto, looks do Copilot (seção 3.5) | Depende de 2 e 3 |
| 6 | **PASSARELA-REAL**: plateia semi-realista e caminhada profissional do avatar da pessoa (seção 3.2) | Depende de 2 e 3 |
| 7 | **PROVADOR-MARCA**: provador 3D ultra-realista da marca escolhida (seção 3.1) | Depende de 3 e 4 |
| 8 | **PALCOS-ARTISTAS**: estudo a fundo + mini-palcos e mini-lojas únicos por artista ou marca (seção 3.3) | Estudo primeiro, depois implementação |
| 9 | **LOJA-EXCLUSIVOS**: itens, consumíveis, peças e looks exclusivos de celebridades, marcas e do FashionAI com FAI Points (seção 3.4) | Usa os itens 5 e 8 |

As decisões padrão das auditorias continuam valendo até a pessoa responsável pedir outra coisa:

- moldes procedurais em código;
- HIGH_QUALITY só no navegador;
- parâmetro de pescoço no corpo;
- limiares propostos no gate.

---

## 3. Itens novos (pedido de 05/10/2026)

### 3.1 Provador de marcas 3D ultra-realista

- **Só a marca escolhida:** o provador da Adidas mostra só a marca Adidas (logo, letreiro, materiais e detalhes da
  loja). Hoje há painéis de outras marcas vestidas e temas genéricos.
- **Ambiente da loja da marca:**
  - piso, paredes, iluminação de loja, araras, espelho, provador com cortina, vitrine e sinalização;
  - nada de cor aleatória.
- **Identidade visual da marca:**
  - logo e paleta vêm do cadastro da marca (perfil MARCA, selos, guarda-roupa da marca);
  - sem cadastro, só o nome da marca, com tipografia neutra e materiais neutros de loja premium.
- **Avatar:** o mesmo da pessoa, com as roupas vestidas pelo fitting novo (item 3 da ordem).

### 3.2 Passarela 3D profissional

- **Plateia:**
  - avatares semi-realistas coerentes (corpo humano do mesmo sistema, roupas padrão variadas, poses sentadas,
    reações discretas);
  - distribuídos em fileiras com escala e iluminação corretas;
  - níveis de detalhe para desempenho;
  - nunca bonecos genéricos desproporcionais.
- **Quem desfila:** é **exatamente** o avatar da foto de perfil (mesma versão aprovada da identidade).
- **Caminhada:**
  - ciclo de caminhada estilosa, humana e suave: passo cruzado de passarela, balanço de quadril e ombro, braços
    soltos, giro no fim, ritmo constante;
  - rig com pesos corretos;
  - roupa acompanhando o movimento.

### 3.3 Mini-palcos e mini-lojas 3D de artistas e marcas

- **Fim do genérico:**
  - nada de nomes genéricos estampados nem cores aleatórias;
  - cada palco tem nome, logo, selos, cortinas, fogos, confetes, luzes e plateia com características do artista.
- **Estudo a fundo (entregável antes da implementação):** como resolver a variedade, já que os artistas cadastrados são
  aleatórios. Alternativas a comparar:
  - (a) banco curado de mini-palcos dos principais artistas;
  - (b) personalização feita pelo próprio perfil após o cadastro (editor de palco com tema, paleta, logo, efeitos);
  - (c) geração por regras a partir dos dados do perfil (gênero musical, paleta da foto, selos, eras);
  - (d) híbrido: base por regras + editor + curadoria dos maiores.
- **Critérios do estudo:**
  - direitos de imagem e marca (sem usar marca de terceiros sem autorização);
  - custo;
  - qualidade;
  - moderação;
  - desempenho;
  - manutenção.

### 3.4 Exclusivos na loja, no quarto e no espelho

- **Exclusivos de celebridades e marcas, comprados com FAI Points:**
  - itens e consumíveis;
  - peças de roupa e looks;
  - personalização do quarto, do espelho e do guarda-roupa.
- **Itens únicos do FashionAI:**
  - mais peças e looks com o logo FashionAI (variações);
  - peças de guarda-roupa (portas, puxadores, cabideiros, iluminação, acabamentos) exclusivas.
- **Regras:** disponibilidade, expiração, selo da marca ou celebridade e moderação, como nos selos do RF25.

### 3.5 Quarto, guarda-roupa e espelho realistas (refatoração)

- **Defeito (prioridade 1):** não é possível tirar uma roupa do guarda-roupa e prová-la no espelho.
- **Roupas no guarda-roupa:**
  - cabide posicionado corretamente, espaço ao redor, dobra e caimento;
  - nada de peça renderizada como pedra ou sólido.
- **Tecido com movimento natural:**
  - simulação leve (XPBD da fase F4) ou animação de tecido pré-calculada para as peças penduradas e vestidas.
- **Avatar dentro do quarto:**
  - escolhe a peça, abre e fecha a porta, pega a peça e prova no espelho;
  - animações acionadas pelo comando da pessoa.
- **Ambiente coerente:**
  - piso, cadeiras, espelho e iluminação com escala real e materiais realistas;
  - nada de objeto sem sentido.
- **Looks completos:**
  - saem das "caixinhas" nas gavetas e viram sugestões do Copilot;
  - ao escolher uma, o quarto abre com o avatar vestindo as peças do look.

---

## 4. CATALOG-IMG V2 — pipeline das fotos oficiais da Busca Catalogada

**Objetivo:** toda foto oficial (site da marca, página oficial do produto, varejista autorizado, loja oficial em
marketplace) vira uma **fotografia de catálogo FashionAI** antes de entrar no acervo. Ela é isolada, limpa, reenquadrada
pela semântica da peça, preserva os detalhes e é validada por métricas. Serve para:

- cards, busca e modal;
- IA de marca, subcategoria, cor e material;
- 2D, 3D, Hype Score, embeddings e comparação.

### 4.1 Entrada e regras gerais

- **Entrada (com o que houver):** `officialImageUrl`, `brand`, `productName`, `category`, `subcategory`, `pieceType`,
  `sourceUrl`, `imageUrl`.
- **A original nunca é usada direto nem sobrescrita:**
  - guarda `sourceImage`;
  - gera `catalogMasterImage` e, quando couber, `catalogThumbnail`, `catalogDetailImage` e `catalogAiAnalysisImage`;
  - o pipeline é reversível e auditável.
- **Fluxo:**
  1. validação;
  2. detecção do produto;
  3. segmentação;
  4. remoção de distratores;
  5. ROI por categoria;
  6. reenquadramento semântico;
  7. fundo normalizado;
  8. preservação de detalhes;
  9. QA;
  10. master.
- **O que nunca muda:** logo, costura, número de botões, geometria de bolso, cadarço, estampa ou cor. A saída é
  "representação normalizada do produto original", nunca "reinterpretação por IA" (§88–89).

### 4.2 Detecção, segmentação e limpeza

- **Detecção:**
  - acha o `primaryProduct` e a bounding box;
  - distingue peça de humano, manequim, cabide, móveis, caixa, props, fundo e outras peças.
- **Pessoas (§5):**
  - remove o humano, preservando a peça inteira (prioridade: peça > cena);
  - reconstrução só onde falta pouco, há simetria e a confiança é alta;
  - senão `REJECT_IMAGE` e procura outra foto oficial;
  - nunca alucinar geometria (§40–41).
- **Objetos irrelevantes (§6):** cadeiras, mesas, plantas, sacolas, caixas, mãos, celular, espelho, cabide e pedestal
  saem.
- **O que pertence à peça (§7):** botões, zíper, cadarço, fivela, alças, correntes, patches, logos, cordões, bolsos e
  costuras ficam.
- **Máscara (§8–9):**
  - `productMask` precisa, com bordas, mangas, golas, elementos finos, transparências e franjas;
  - refino de borda sem halo branco ou escuro nem serrilhado;
  - não pode faltar tecido nem cortar cadarço ou alça.

### 4.3 Reenquadramento semântico por `pieceType` (Strategy, §10–24, §77–79)

**Conceito:** `semanticFocusRegion` decide escala, crop, posição e zoom. "Foco" é enquadrar e escalar, nunca desfocar o
resto.

| pieceType | Região principal | Detalhes a preservar |
|---|---|---|
| UPPER_PIECE | Gola, decote e parte alta do peito (âncora visual, sem cortar a peça) | Polo e camisa: gola, carcela, botões de cima, logo bordado, costura do ombro. Moletom: capuz, cordões, zíper. Jaqueta: gola, lapela, zíper, bolsos de cima |
| LOWER_PIECE | Cós, bolso e costuras de cima (cós → bolso → coxa), sem perder a silhueta | Jeans: bolso da frente e moedeira, passantes, braguilha, pespontos. Vista de trás: bolso traseiro e pala |
| SHOES_PIECE | Cadarço, gáspea e lingueta; sem cadarço, a região equivalente | Mocassim: gáspea. Salto: cabedal e salto. Sandália: tiras. Bota: cano e fechamento. Largura útil ≈ 85–95% |
| ACCESSORY_PIECE | O acessório inteiro com ocupação máxima | Bolsa: fecho, alça e logo. Relógio: mostrador. Cinto: fivela. Óculos: armação. Boné: frente e logo. Colar: pingente. Anel: peça central |

**Registro de regiões semânticas** configurável por subcategoria (§79), por exemplo:

- POLO → `primaryFocus: [COLLAR, PLACKET]`, `secondaryFocus: [LOGO]`;
- JEANS → `[WAISTBAND, FRONT_POCKET]`, `[STITCHING]`.

### 4.4 Crop, escala e composição (§25–31, §50–52, §84–87)

- **Ocupação:** `frameOccupancyRatio` = área da máscara ÷ área do quadro, alvo inicial 0,70–0,90 por categoria
  (`Category Scale Profile`). Os paddings dos 4 lados são medidos e a margem de segurança é de 4–8%.
- **`semanticCrop()` em vez de `centerCrop()`:** considera bbox, região de foco, detalhes críticos (`mustPreserve`),
  orientação, categoria, proporção e margem.
- **`CropScore`** = cobertura do produto + visibilidade do foco + visibilidade dos detalhes críticos + simetria −
  penalidade de espaço vazio − penalidade de corte. Vence o crop com maior score.
- **`productPreservationScore`:** quanto da peça original continua visível.
- **Proporção oficial do card** (4:5 ou a do frontend):
  - adaptação por escala, crop semântico e smart padding;
  - **nunca esticar** (aspecto original preservado);
  - centro visual calculado pelo foco, não pelo centro da bbox.
- **Consistência da coleção:** peças parecidas com escala parecida (10 camisetas não podem variar de tamanho).

### 4.5 Fundo, cor e detalhe (§32–39, §49)

- **Fundo:** master transparente, com versões branca, neutra e de card FashionAI. O fundo nunca contamina cor, borda,
  transparência, renda ou tela.
- **Cor:**
  - preservação com `colorPreservationScore`;
  - sem saturação, contraste ou filtro;
  - balanço de branco só quando necessário;
  - guarda `sourceImageColorProfile`.
- **Logos, bordados e patches:**
  - preservados por inteiro;
  - detecção de logo (`logoDetected`, `logoConfidence`, `logoRegion`) com `preservePriority = HIGH`;
  - sem borrar nem reconstruir.
- **Costuras:** gola, ombro, bolso, cós, pesponto de jeans e cabedal preservados.
- **Nitidez e resolução:**
  - sharpening só leve, sem textura, costura ou logo falsos;
  - sem upscale destrutivo: resolução baixa dá `IMAGE_TOO_SMALL` e procura outra fonte.

### 4.6 Várias imagens, ranking e vistas (§42–47)

- **Processamento:** todas as fotos oficiais da página viram `CatalogProductImage` (`viewType`, `qualityScore`,
  `sourceUrl`, `processedUrl`).
- **`ImageCandidateScore`:**
  - entram visibilidade do produto, resolução, oclusão, vista de frente, complexidade do fundo, presença de humano e
    de objetos, e visibilidade de detalhes;
  - preferência: só o produto, frente, alta resolução, fundo neutro, sem oclusão, peça completa.
- **Vistas:** FRONT, BACK, LEFT, RIGHT e DETAIL.
- **Imagem canônica:** `CANONICAL_PRODUCT_IMAGE` para cards, busca, grids e recomendações.
- **Foto de detalhe:** uma foto só do logo ou do bolso nunca vira master; vira `catalogDetailImage`.

### 4.7 Métricas, gate e fallback (§57–63, §90)

- **Métricas:**
  - segmentação: `segmentationScore`, `edgeQualityScore`;
  - presença e preservação do produto: `productVisibilityScore`, `productPreservationScore`, `garmentCompletenessScore`;
  - enquadramento: `frameOccupancyRatio`, `emptySpaceRatio`, `focusRegionVisibility`;
  - logo e cor: `logoPreservationScore`, `colorPreservationScore`;
  - reconstrução e origem: `reconstructionConfidence`, `sourceImageQuality`.
- **Gate:**
  - exige produto detectado, segmentação aceitável e detalhes críticos preservados;
  - exige ocupação aceitável, cor preservada e nenhum corte grave;
  - exige nenhum resto de humano (`humanPixelRatio ≈ 0`, nova detecção depois do processamento) e nenhum objeto
    alheio (nova detecção de objetos);
  - senão `NEEDS_REPROCESSING` ou `REJECTED`.
- **QA por categoria:**

  | pieceType | Precisa ficar visível |
  |---|---|
  | UPPER | gola, decote e construção de cima |
  | LOWER | cós, região do bolso e costuras de cima |
  | SHOES | cabedal, fechamento e parte da sola |
  | ACCESSORY | o objeto completo e o detalhe de assinatura |

- **Fallback, nesta ordem:**
  1. outra foto oficial;
  2. outra vista oficial;
  3. exigência de reconstrução menor;
  4. revisão manual;
  5. rejeitar.

  Nunca aceitar foto ruim só porque é oficial.
- **Confiança:** toda decisão de visão computacional tem `confidence`; se baixa, `manualReview = true`.

### 4.8 Arquitetura, jobs e dados (§64–80)

- **Serviços modulares:**
  - entrada: `OfficialImageFetcher`, `ImageCandidateRanker`;
  - detecção e limpeza: `ProductDetector`, `ProductSegmenter`, `HumanRemover`, `DistractorRemover`;
  - enquadramento: `GarmentRegionDetector`, `SemanticFocusAnalyzer`, `SemanticCropper`;
  - acabamento e QA: `BackgroundNormalizer`, `DetailPreserver`, `ImageQualityAnalyzer`, `CatalogImageValidator`;
  - estratégias `Upper`, `Lower`, `Shoes` e `AccessoryFramingStrategy`.
- **Jobs assíncronos:**
  - estados PENDING, DOWNLOADING, ANALYZING, SEGMENTING, CLEANING, REFRAMING, VALIDATING, APPROVED, REJECTED;
  - idempotência por `imageUrl + pipelineVersion`;
  - `imagePipelineVersion = CATALOG_IMAGE_PIPELINE_V2`, para reprocessar quando o algoritmo melhorar;
  - cache por `sourceImageHash` e deduplicação por `perceptualHash`.
- **Proveniência:** `sourceType = BRAND_OFFICIAL`, `sourceUrl`, `retrievedAt`.
- **Segurança da URL:**
  - proteção contra SSRF, URL malformada, redirecionamento abusivo e arquivo grande demais;
  - só `image/jpeg`, `image/png` e `image/webp`;
  - limite de tamanho configurável, sem carregar arquivo arbitrário na memória.
- **`CatalogProduct`:** `sourceImageUrl`, `canonicalImageUrl`, `imageProcessingStatus`, `imagePipelineVersion` e
  `imageQualityScore`, sem duplicar o que já existe em `CatalogImage`.
- **Logs estruturados:** `catalogProductId`, `pieceType`, scores, `humanDetectedAfterProcessing`, `qualityStatus`.
- **Depuração e admin:**
  - modo de depuração com cores para bbox, máscara, foco, regiões críticas, crop candidato e crop final;
  - comparação original | processada só no admin e no dev, nunca na navegação do usuário.
- **Integração:**
  - a Busca Catalogada mostra a imagem canônica processada;
  - a imagem limpa alimenta o analisador (marca, cor, material, caimento, subcategoria, variação).

### 4.9 Testes, revisão e painel (§91–96)

- **Conjunto de validação:**
  - peças de cima e de baixo, no modelo e sem modelo, calçados, bolsas, cintos, relógios, bonés e óculos;
  - fotos limpas, complexas, de fundo escuro ou branco, com vários objetos, oclusão parcial, humano e manequim.
- **Testes obrigatórios:**
  - remover humano não remove a peça;
  - o crop não corta detalhe crítico;
  - o logo continua visível;
  - o aspecto não muda;
  - o espaço vazio diminui;
  - o fundo fica normalizado.
- **Regressão:** cada defeito visual corrigido vira fixture; as aprovadas não podem regredir.
- **Painel de qualidade (admin):** ocupação média, taxa de rejeição, falhas de remoção de humano, de segmentação e de
  crop por categoria.
- **Revisão manual:**
  - fila `CatalogImageReviewQueue`: original, processada, foco e avisos;
  - ações APPROVE, REPROCESS, SELECT_ALTERNATE_IMAGE e REJECT.

### 4.10 Entregáveis (§99) e aceite (§100)

**Entregáveis:**

1. auditoria do pipeline atual;
2. fluxo de imagens atual;
3. problemas encontrados;
4. arquitetura proposta;
5. estratégia por pieceType;
6. estratégia por subcategoria;
7. modelo de SemanticFocusRegion;
8. algoritmo de SemanticCrop;
9. ranking de imagens oficiais;
10. remoção de humanos;
11. remoção de objetos;
12. preservação de logos e costuras;
13. normalização de fundo;
14. normalização de escala;
15. métricas;
16. quality gate;
17. fallback;
18. multi-imagem;
19. modelagem em CatalogProduct;
20. workers e jobs;
21. segurança de URLs;
22. testes;
23. fixtures visuais;
24. plano incremental.

**Aceite:** não basta "o fundo foi removido". Está pronto quando cada foto oficial vira uma foto de catálogo que:

- isola o produto;
- remove humanos e objetos;
- preserva design, logos, costuras e cores;
- identifica a região semântica;
- reenquadra pelo tipo de peça;
- maximiza a ocupação útil;
- é consistente com o resto do catálogo;
- passa nas métricas automáticas.
