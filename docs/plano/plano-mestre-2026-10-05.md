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
| AVATAR-ID I1 | Identidade versionada: refazer não apaga a aprovada; aprovar, restaurar, histórico | V42 + `Avatar3dService` |
| AVATAR-ID I2 | Camada de resíduo assimétrico + medidas nomeadas: SFace de frente 0,369 → 0,476, top-1 15/15 | `face-residual.ts`, `face-profile.ts` |
| AVATAR-ID I3 | Pele com balanço de branco pela esclera, rosto casado com o corpo: erro de cor 0,2, sem costura, gate 14/15 | `skin-tone.ts` |

---

## 2. Ordem de execução do que falta

| # | Item | Por que nesta posição |
|---|---|---|
| 1 | **WARDROBE-FIX**: tirar a peça do guarda-roupa e provar no espelho (hoje não funciona) | Defeito funcional relatado em teste |
| 2 | **AVATAR-ID I4–I7**: olhos (cor da íris, shader, ossos), cabelo e barba, rig facial, revisão visual, níveis de detalhe — **mais os itens de rosto e cabelo da lista de 29/09 (seção 5.2) e os acréscimos da especificação completa (seção 6)** | Continua a cadeia de identidade; o desfile e o quarto usam o mesmo avatar |
| 3 | **GARMENT F0–F6**: moldes paramétricos, passes com restrições, XPBD, camadas, detalhes — **mais os itens de roupa da lista de 29/09 (seção 5.2) e o PROV-3D (seção 5.1)** | Base de "roupa que veste" e de "tecido com movimento natural" (itens 5 e 6) |
| 4 | **CATALOG-IMG V2**: pipeline profissional das fotos oficiais da Busca Catalogada (seção 4) — **com o FRAME e o relatório de 79 perguntas (seção 5.1)** | Alimenta cards, IA, 2D, 3D e Hype Score |
| 4b | **RF4-FOTO**: etapa opcional "Fotografia" no criador de peça (seção 5.1) | Definição nova do RF4 no Trello; o editor completo é o RF15 (Tema Futuro) |
| 5 | **QUARTO-REAL**: quarto, guarda-roupa e espelho coerentes e realistas, avatar dentro do quarto, looks do Copilot (seção 3.5) | Depende de 2 e 3 |
| 6 | **PASSARELA-REAL**: plateia semi-realista e caminhada profissional do avatar da pessoa (seção 3.2) | Depende de 2 e 3 |
| 7 | **PROVADOR-MARCA**: provador 3D ultra-realista da marca escolhida (seção 3.1) | Depende de 3 e 4 |
| 8 | **PALCOS-ARTISTAS**: estudo a fundo + mini-palcos e mini-lojas únicos por artista ou marca (seção 3.3) | Estudo primeiro, depois implementação |
| 9 | **LOJA-EXCLUSIVOS**: itens, consumíveis, peças e looks exclusivos de celebridades, marcas e do FashionAI com FAI Points (seção 3.4) | Usa os itens 5 e 8 |
| 10 | **SEC-A** e **SEC-B**: auditoria do gate de desenvolvedor e planilha RF × entidade × banco calculada das fontes (seção 5.1) | Pedidos anteriores ainda abertos; o SEC-A protege a produção pública |
| 11 | **MOD-1**: plano estratégico de moderação das imagens enviadas (seção 5.1) | A fila de moderação já existe; falta o plano e a verificação central |
| 12 | **FRONT-10**: telas, imagens, desempenho, qualidade do código e medição; listas; marca por logo no card (seção 5.1) | Fecha o "Frontend nota 10" |
| 13 | **VISÃO-RF**: melhorias de visão de produto nos RF1–RF39 com relatório do que mudou e por quê (seção 5.1) | Revisão final, depois que as telas estiverem estáveis |

O **RF15** (Editor de Fotografia da Peça, fases E0–E7) é Tema Futuro: está estudado e planejado em
[RF15_Editor_de_Fotografia_da_Peca.md](../novos-rf/RF15_Editor_de_Fotografia_da_Peca.md) e entra na ordem quando o
time o tirar do Tema Futuro no Trello.

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

---

## 5. Pendências anteriores (revisão de todo o histórico, 05/10/2026)

Os 287 pedidos da conversa, desde 23/09, foram relidos e conferidos com o git e os documentos. As seções 1–4 cobriam só
a rodada de 05/10. Abaixo está o que tinha ficado de fora, com o estado conferido e o lugar na ordem da seção 2.

### 5.1 Itens abertos ou parciais

| Item | Pedido (data) | Estado conferido | Entra em |
|---|---|---|---|
| **RF4-FOTO** | Trello, 05/10: RF4 = busca catalogada, formulário & fotografia, com foto opcional | Parcial: dá para trocar a foto depois (`/api/pieces/{id}/image`), mas o criador força a imagem padrão (`useDefaultImage: true`) e não tem a etapa "Fotografia" | 4b |
| **FRAME** | 27/09: enquadramento por subcategoria (camiseta com foco no peito, gola, ombros e mangas; jeans do cós até perto do joelho), pranchas antes/depois de 5 camisetas e 5 jeans, ajuste pela pessoa | Parcial: há `PhotographySpecs` e o enquadramento por categoria; faltam os gabaritos por subcategoria, as pranchas e o ajuste manual | 4 (§4.3 e §4.4) |
| **Relatório de imagens** | 27/09: 40 perguntas de qualidade + 39 de isolamento e enquadramento | Aberto: as respostas estão espalhadas (auditoria de captura adaptativa, RF15, seção 4); falta o relatório que responde pergunta por pergunta | 4 (entregáveis 1–3 do §4.10) |
| **SEC-A** | 27/09: auditoria do gate de desenvolvedor (Google + PIN) | Aberto: o gate existe (`middleware.ts`, `app/(gate)/gate/*`, `lib/gate/token.ts`) e há `SEGURANCA_PRODUCAO.md`, mas não há a auditoria pedida (mapa de superfícies, identidade, PIN e bloqueio, cookie, `next`, CSRF, cache, UI e logs, tabela de achados, testes negativos e positivos, plano de correção) | 10 |
| **SEC-B** | 27/09: planilha própria RF × entidade × banco gerada das fontes do projeto | Aberto: `docs/planilhas/Entidades_BD_por_RF_RNF.xlsx` existe, mas foi escrita à mão; falta a versão calculada do código (entidades JPA, repositórios, Flyway, adaptadores), com contagens e "não verificado" onde faltar prova | 10 |
| **MOD-1** | 27/09: moderação das imagens enviadas | Parcial: `ModerationQueueItem` e a fila existem; faltam o plano estratégico, a verificação central única para todo upload e a política de retenção para revisão | 11 |
| **FRONT-10** | 25/09: "Frontend nota 10" | Fundação, navegação e cards feitos; faltam as telas restantes (perfil, social, 3D, pontos, admin, cadastro, notificações) e o bloco de imagens, desempenho, qualidade do código e medição | 12 |
| **LISTAS** | 27/09: padrão FashionAI dos campos de lista (única, múltipla, pesquisável) | Parcial: checklist feito, migração incompleta | 12 |
| **PEÇA-P1/P2** | 27/09: marca por logo, anatomia e artes do card de peça, variações da Seção C, controles de lista | Parcial: marca pelo logo com "É essa a marca?" e sub-retângulos (25737e0); faltam as variações da Seção C e os controles de lista | 12 |
| **A6–A8** | 27/09: analisador que sempre preenche; estados da marca pelo logo (confirmada, possível, logo sem marca, sem logo) | Parcial: `BrandEnsembleResolver` e `IdentificationHierarchy` (IDENTIFIED, LIKELY, POSSIBLE, UNKNOWN) existem; falta o estado "logo sem marca" ponta a ponta e a verificação com capturas | 12 |
| **VISÃO-RF** | 24/09: melhorias de visão de produto nos RF1–RF39, simulando usuários reais, com relatório | Aberto | 13 |
| **PROV-3D** | 02/10: roupa vestida de verdade no provador (não imagem colada sobre casca justa) | Aberto; é o objetivo da GARMENT F0–F6 | 3 |

### 5.2 Lista de problemas do avatar (29/09) → fases

| # | Problema relatado | Estado | Fase |
|---|---|---|---|
| 1 | Cabelo sempre com o mesmo formato e a mesma franja | Parcial: fios por padrão (HAIR-F2), volume pela foto; falta variedade de forma e franja | AVATAR-ID I5 |
| 2 | Orelhas quebradas | Aberto: orelha genérica do MakeHuman, a malha do MediaPipe não cobre orelha | AVATAR-ID I6 (detalhes individuais; acréscimo à fase) e I7 (revisão visual) |
| 3 | Óculos escuros devem ser removidos; óculos de grau ficam | Aberto | AVATAR-ID I4 (junto dos olhos; acréscimo à fase: detectar o tipo de óculos na foto) |
| 4 | Cabelo parece capacete, sem movimento | Parcial: fios com volume; falta o movimento (física leve do cabelo) | AVATAR-ID I5 + GARMENT F4 (XPBD) |
| 5 | Braços travados | Parcial: pose de repouso e respiração (A2); falta movimento natural dos braços | PASSARELA-REAL (ciclo de caminhada) e QUARTO-REAL (animações por comando) |
| 6 | Golas e mangas sem polimento | Medido na auditoria de roupas (P4) | GARMENT F2–F3 |
| 7 | Óculos grudados no rosto | Aberto | AVATAR-ID I4 (armação com afastamento do rosto; acréscimo à fase) |
| 8 | Rostos parecidos demais | Melhorou: SFace 0,369 → 0,476, top-1 15/15 (I2) | AVATAR-ID I4–I7 (gate continua medindo) |
| 9 | Bochechas no mesmo padrão | Parcial: medidas nomeadas (I2), cor da bochecha (I3) | AVATAR-ID I6 (detalhes individuais por máscara) |
| 10 | Pouca variação de olhos e cor de olhos | Aberto | AVATAR-ID I4 (íris, shader, ossos) |
| 11 | Pouca variação de nariz | Parcial: `NOSE_WIDTH`, `NOSE_LENGTH`, `NOSE_PROJECTION` (I2) | AVATAR-ID I6 |
| 11b | Detecção automática de cor e tipo de olhos, tipo de rosto, tipo e cor de cabelo, franja | Parcial: sexo, cabelo, pele, altura, peso e volume já detectados | AVATAR-ID I4–I5 |
| 12 | Moletons e casacos estufados, como armadura | Medido: folga de 13–18 mm (auditoria de roupas) | GARMENT F2–F3 |
| 13 | Avatar descalço | Feito: tênis 3D de verdade (7d3d83f); conferir em todos os ambientes | GARMENT F0 (teste de regressão) |

### 5.3 Feitos, mas com status desatualizado na lista de tarefas

| Item | Prova |
|---|---|
| RF5-ART (Criar Look com a mesma estrutura da Arte de fundo) | 5a87c99 — Background Studio no mesmo padrão (look, peça, DNA) |
| CARDS (card e detalhe com leitura de rede social) | `docs/checklist/CARDS_DETALHE_2026-09-27.md`, 0faa450 |
| Eras, Coleções, My Stage, Gerar 3D, Foto com meu manequim | a1e4d51 |
| Animação da arte na prévia e asset por subcategoria | bbb3e44 |
| Editar perfil com "+" e caixa 3D | 25d3766 |
| Deploy (Vercel + backend + domínio) | domínio em uso; deploy de produção pelo `main` |

Os documentos de diagnóstico (auditorias de roupa e de identidade) e as decisões da seção 2 continuam valendo para
estes itens.

---

## 6. AVATAR-ID: especificação completa do digital double (reafirmada em 05/10/2026)

A especificação de 76 requisitos ("representação 3D reconhecível daquela pessoa específica, e não um avatar humano
parecido") continua valendo na íntegra. Os 22 entregáveis técnicos dela estão em
[`docs/avatar3d/auditoria-identidade-avatar/`](../avatar3d/auditoria-identidade-avatar/README.md) (seções 1–22). A tabela
liga cada grupo de requisitos à seção da auditoria, à fase e ao estado conferido **no código** (não só no documento).

| Req. | Tema | Auditoria | Fase | Estado no código |
|---|---|---|---|---|
| 1 | Auditoria do pipeline e ponto de perda de identidade | §1 | — | Entregue (c15f507) |
| 2–3, 36–37 | Identidade separada do estilo; perfil persistente; identidade canônica única; versões sem sobrescrever a aprovada | §2, §4 | I1 | Versões, aprovação e histórico entregues (V42). **Falta** o campo `renderStyle` separado da identidade |
| 4–6, 62–63 | Formato do rosto com medidas contínuas, assimetria preservada, estrutura craniofacial, topologia canônica e morphs nomeados | §5, §9 | I2 | Entregue (resíduo assimétrico, 19 morphs nomeados) |
| 7–9, 44 | Olhos: forma, medidas, diferença entre os dois, cor detalhada e contínua, shader com córnea, ossos dos olhos | §6 | I4 | Aberto |
| 10 | Sobrancelhas: espessura, curvatura, densidade, cor | §5 | I4 | Parcial (medidas de posição no I2; falta a forma própria da sobrancelha) |
| 11–13 | Nariz, boca e lábios, mandíbula e queixo, sem embelezar | §5, §9 | I2 | Entregue nas medidas e morphs; o gate mede a boca (1 retrato reprova na reprojeção da boca) |
| 14 | Orelhas | §5 | I6 | Aberto (genéricas; ver 5.2, item 2) |
| 15–17 | Pele: tom, subtom, melanina, rugosidade, subsuperfície; luz separada da cor | §7 | I3 | Entregue (balanço pela esclera, ΔE 0,2, sem costura) |
| 18–21, 56 | Sardas, pintas, acne, cicatrizes, rugas estáticas e de expressão, olheiras, nos três níveis (textura, superfície, geometria), sem exagero e sem remover | §12 | I6 | Aberto (`DistinctiveFeature` ainda não existe) |
| 22–30, 64 | Cabelo como identidade: comprimento medido, curvatura 1A–4C só com confiança, densidade × volume × espessura, linha do cabelo, risca, franja, silhueta primeiro, níveis de geometria | §8, §13 | I5 | Parcial: silhueta, volume, curvatura e níveis de fios (HAIR-F2) existem; faltam linha do cabelo, risca, franja tipada e variedade de forma |
| 31–32 | Barba e bigode; cor base, mecha e raiz | §8, §13 | I5 | Aberto |
| 33–34, 67, 70 | Não alucinar; `value` + `confidence` + `source`; oclusão; nada além do visual | §11 | I1 + cada fase | Confiança por característica entregue no I1; cada fase nova grava a sua |
| 35 | Várias fotos quando houver; uma foto continua funcionando, com incerteza maior | §11 | I7 | Parcial (uma foto: confiança de profundidade limitada a 0,6) |
| 38–39, 57 | Revisão visual simples, correção localizada sem refazer o resto, refazer/editar/aprovar/apagar | §4 | I7 | Parcial (aprovar, restaurar e refazer existem; faltam os cartões de revisão e a correção localizada) |
| 40–41 | Cabelo desacoplado da cabeça; penteado, maquiagem, idade e styling como **modificadores** que nunca gravam na identidade | §8 | I5 (cabelo), I7 (modificadores) | Cabelo já é malha separada; a camada de modificadores não existe (**acréscimo ao I7**) |
| 42–43, 45 | Rig facial (piscar, sorrir, abrir a boca, sobrancelhas, olhar), blendshapes no padrão ARKit sem amarrar a uma plataforma, dentes e boca | §14 | I6 | Aberto |
| 46–48 | LOD 0–3, mapas separados (cor, normal, rugosidade, subsuperfície, deslocamento, AO), microdetalhe por normal | §7, §18 | I3 (mapas), I7 (LOD) | Mapas de pele no I3; LOD só no cabelo (`hair-lod.ts`) |
| 49–54 | Métricas, reprojeção de pontos, silhueta, validação em vários ângulos, gate, não depender só de embedding | §15, §16 | I0 | Entregue (gate 14/15); a renderização automática em 6 vistas para o gate é **acréscimo ao I7** |
| 55 | Sem embelezamento automático | §2 | todas | Regra ativa; teste de regressão no gate (assimetria preservada) |
| 58 | Dados derivados sensíveis fora dos logs | §21 | I0 | Entregue (`privacy.ts` e teste de privacidade dos logs) |
| 59 | Modo de depuração visual (pontos, malha, máscaras, confiança) só para desenvolvimento autorizado | §21 | I7 | Aberto (**acréscimo ao I7**, atrás do gate de desenvolvedor) |
| 60–61 | Módulos separados (`FaceAnalyzer` … `AvatarAssembler`) e pipeline recomendado | §2, §3 | I1–I7 | Parcial (`face-profile`, `face-residual`, `skin-tone`, `identity/*` separados; `pipeline.ts` ainda concentra etapas) |
| 65 | Passes progressivos 1–11, cada um preservando os anteriores | §22 | I2–I7 | Seguido na ordem das fases; **acréscimo**: o gate roda depois de cada passe e a regressão não pode piorar mais que 0,03 |
| 66 | Casos de teste obrigatórios (tipos de cabelo, tons de pele, detalhes, barba, óculos) | §17 | I0 + cada fase | Parcial (15 retratos autorizados, só agregados no repositório) |
| 66, 3 do 29/09 | Óculos como acessório externo, nunca parte do rosto; óculos escuros removidos, de grau mantidos | §5 | I4 | Aberto (**acréscimo ao I4**) |
| 68–69 | Qualidade da foto antes do pipeline e captura guiada (olhar para a câmera, expressão neutra, luz frontal, sem filtro, sem mão no rosto) | §1, §11 | I7 | Aberto (**acréscimo ao I7**: `ImageQualityGate` + instruções visuais na tela Meu Avatar 3D) |
| 71 | Mesmo `CanonicalAvatar` no FashionAI e no Scores, com perfil de render, LOD e rig próprios | §20 | I7 | Aberto |
| 72–74 | Esqueleto, medidas e âncoras compatíveis com o provador; cabeça e corpo da mesma pessoa; pescoço sem costura | §19 | I3 + GARMENT F1 | Costura resolvida no I3; âncoras do pescoço na GARMENT F1 |
| 75–76 | Aceite: reconhecível por quem conhece a pessoa e mensurável | §16, §23 | I7 | O aceite final exige o gate nas 6 vistas e a revisão humana |

**Aceite (requisito 76):** a fase I7 só fecha quando o sistema produz "uma representação 3D reconhecível daquela pessoa
específica", e não "um avatar humano parecido". Isso vale nas métricas do gate, nas 6 vistas e na revisão da própria
pessoa.
