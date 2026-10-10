# PROVADOR-BUSCA — Provador com a Busca Catalogada embarcada controlando a Loja 3D

Pedido de 05/10/2026, registrado no [plano mestre](plano-mestre-2026-10-05.md) (seção 8). Este documento guarda a
especificação inteira, agrupada, e **absorve o PROVADOR-MARCA** (seção 3.1 do plano). A loja que aparece aqui é a
mesma Loja 3D do [ENV3D](ENV3D_Palco_Passarela_Loja3D.md).

**Mudança central:** o formulário da Busca Catalogada fica **dentro** do Provador, e o que a pessoa escolhe muda a
cena da Loja 3D. Não é um filtro visual: é **busca espacial e contextual**.

```
BUSCAR → DESCOBRIR → ENTRAR NO CONTEXTO DA MARCA/CATEGORIA → EXPERIMENTAR → COMPARAR → DECIDIR
FORM → SEARCH INTENT → CATALOG CONTEXT → STORE CONTEXT → SCENE → PRODUCT → TRY-ON
```

Exemplo: Marca Nike, categoria Calçados, subcategoria Sneakers e produto Air Max não viram só "lista de resultados
Nike". Viram: contexto Nike → área de sneakers → produtos compatíveis → Air Max em destaque → Vista-me disponível.

**Cinco camadas, uma experiência (req. 108):**

| Camada | Significado |
|---|---|
| BUSCA | o que estou procurando |
| LOJA 3D | onde isso é apresentado |
| PRODUTO | o que selecionei |
| VISTA-ME | como eu experimento |
| AVATAR | como eu vejo o resultado |

---

## 1. Ponto de partida conferido no código (05/10/2026)

| Parte | O que existe | Observação inicial (a confirmar na auditoria) |
|---|---|---|
| Página | `app/(site)/(app)/try-on/page.tsx` (326 linhas), abas `stores \| wardrobe \| saved` | A busca já está embutida (`components/catalog/catalog-search.tsx`, 270 linhas) na aba "stores" |
| Cena | `components/three/fitting-room-scene.tsx` + `avatar-viewer.tsx` | Avatar real; luz `store \| daylight \| night`; vistas frente/lado/costas |
| Ambiente de marca | `lib/tryon/fitting-room.ts`: `BrandEnvironment`, `NEUTRAL_ENVIRONMENT`, `environmentFor(brand)`, `resolveEnvironment(items, mode)` | O ambiente segue as **peças vestidas**, não a **busca**; o perfil é escolhido por nome de marca (`brandKey`); conferir se há regra por marca espalhada (req. 21) |
| Slots | `FITTING_SLOTS`: `upper_piece`, `lower_piece`, `shoes_piece`, `accessory_piece` | Já é o modelo pedido (req. 39) |
| Catálogo | `GET /api/catalog/stores`, `CatalogController.search/product/brands/stores`, `POST /api/pieces/from-catalog` | Base do `CatalogSearchService` (reaproveitar, não duplicar) |
| Provas salvas | `localStorage` (`SAVED_KEY`) | Histórico da sessão (req. 60) sem duplicar o histórico global |
| Posse | mapa `owned` na página; "Já tenho esta peça" | Base para "Você já possui este item" (req. 57), mas o matching precisa ser confiável |
| Imagens | Pipeline CATALOG-IMG V2 (seção 4 do plano) | A loja só usa imagens normalizadas (req. 48) |

**Reconferência de 06/10/2026** (detalhes no [plano mestre, seção 9.3](plano-mestre-2026-10-05.md)):

- `CatalogSearch` é montado com `key={store}`: trocar de loja **remonta** a busca e perde o estado. A loja escolhida
  passa a ser o campo marca da busca, e o estado vai para a URL (`/try-on?brand=&category=&subcategory=&product=`).
- "Provadores dinâmicos": cada combinação de busca gera o seu provador (neutro, marca, zona da categoria, zona da
  categoria na marca, Hero Product). O `resolveEnvironment` atual vira o caso "busca vazia".
- As mini lojas das Coleções viram a porta de entrada: a vitrine abre o provador já com marca e coleção na busca.
- P1 a P5 não dependem do GARMENT; só P6 (Vista-me integrado) espera o GARMENT F0–F3.

---

## 2. Requisitos, agrupados (1–108)

### 2.1 Auditoria e conceito (1, 2, 87–91)

- **Levantar antes de mudar código:** Provador 2D e 3D, TryOn, FittingRoom, Mirror, Vista-me, Catalog Search,
  CatalogProduct, Brand, Piece, CanonicalAvatar, Store3D, Room, Scene, SearchForm e Filters. Também rotas, sub-abas,
  formulários, componentes, APIs, serviços, estado global, assets 3D, pipelines, jobs, IA, catálogo, banco, modelos,
  animações e cenário.
- **Entregar nesta ordem:** ARQUITETURA ATUAL → PROBLEMAS → ARQUITETURA PROPOSTA.
- **Conceito:** o Provador deixa de ser "selecionar peça → vestir avatar". Passa a ser descoberta + Busca Catalogada +
  Loja 3D + prova no avatar: pesquisar, descobrir marcas, filtrar, entrar em contextos de categoria, navegar, selecionar,
  vestir, comparar e voltar à busca sem perder o contexto.
- **Nota de UX de cada parte atual (0–5):** Utility, Clarity, Consistency, Immersion, Performance, Polish.
- **Decisão por componente:** KEEP, IMPROVE, MERGE, MOVE, RENAME, REDESIGN ou REMOVE.
- **Sub-abas:** questionar se continuam fazendo sentido com Search, Store e Try-On juntos. Podem virar modos, painéis
  ou estados contextuais. Se a arquitetura nova tornar uma sub-aba redundante, propor merge ou remoção. Não preservar
  fragmentação antiga.

### 2.2 Busca embarcada e estado (3, 16–18, 26–31, 34)

- **Reaproveitar o serviço central de busca** (`CatalogSearchService` ou o equivalente que já existe). Campos: marca,
  categoria, subcategoria, nome do produto e os filtros que já existem.
- **Níveis de especificidade:** só marca, só categoria (ambiente neutro multimarca), só subcategoria e combinações.
  O formulário completo não é obrigatório.
- **`CatalogSearchState`:** `{ brand, category, subcategory, query, selectedProductId, results }`.
- **Estado de busca separado do estado de cena:** filtros não se misturam com câmera, assets carregados ou zona ativa.
  `CatalogSearchState` ≠ `StoreSceneState`.
- **Fontes da verdade:**
  - marca: a marca catalogada, com busca enquanto digita e seleção da marca oficial (nunca texto livre como verdade);
  - subcategoria: a taxonomia canônica, nunca gravar valor fora dela;
  - nome do produto: autocomplete, texto completo ou busca semântica, conforme a arquitetura atual.
- **Formulário:** padronizado com o Design System FashionAI, sem selects nativos inconsistentes.
- **Debounce no texto.** Requisições antigas não sobrescrevem as novas (Nike → Adidas → Puma rápido): cancelamento ou
  versão de requisição.
- **Durante a busca, a loja não é desmontada:** mostra "Buscando…" e mantém a cena anterior até o novo contexto ficar
  pronto.

### 2.3 O formulário controla a cena (4–15, 19–21, 49–53, 61–63, 97–99)

- **`sceneContext`:** `{ brand, category, subcategory, productId, collectionId }`. Influencia a loja carregada, o setor,
  os produtos, o destaque, as câmeras, os displays, os manequins, os pedestais, as araras, as cores, o branding e a luz.
- **Cena persistente com módulos dinâmicos:**
  - ficam carregados: shell da loja, luz base, navegação, câmera;
  - mudam com a busca: sinalização da marca, produtos, araras, manequins, pedestais, zona da categoria, produto hero;
  - nunca destruir e recarregar tudo a cada mudança do formulário.
- **`BrandSceneProfile`:** logo, cores aprovadas, materiais, sinalização, estilo de display, luz de destaque. Só assets
  aprovados e disponíveis: **nunca inventar a identidade de uma marca**. A marca muda arranjo, sinalização, luz de
  destaque e estilo de display, não só o logo.
- **Não é a loja física da marca:** é o ambiente de varejo virtual FashionAI com contexto da marca. A pessoa sempre
  percebe "estou dentro do FashionAI".
- **Sem marca:** "FashionAI Multi-Brand Store" (modo neutro). Categoria sem marca, por exemplo jeans, abre uma Denim
  Zone multimarca.
- **Marca sem perfil:** "FashionAI Neutral Brand Profile", sem quebrar. Logo ou material ausente não impede os produtos.
- **`CategorySceneProfile`:**

  | Categoria | Prioriza |
  |---|---|
  | `UPPER_PIECE` | araras, manequins, displays de tronco |
  | `LOWER_PIECE` | displays de calças, manequins de perna, inspeção na altura da cintura |
  | `SHOES_PIECE` | parede de calçados, pedestais, prateleiras baixas |
  | `ACCESSORY_PIECE` | vitrines de vidro, suportes, pedestais de detalhe |

- **Subcategoria refina:** SNEAKERS abre a Sneaker Zone; BOOTS usa outro conjunto de expositores.
- **Produto escolhido vira Hero Product:** pedestal central ou equivalente, com girar, zoom, inspecionar, Vista-me,
  Detalhes, Comparar, Salvar e Ver similares.
- **Busca incremental:** marca → a loja assume o contexto; categoria → vai à área; subcategoria → a área ganha
  prioridade; produto → foco.
- **Transições curtas e elegantes** (Nike → Adidas, Sneakers → Boots): fade, troca de asset, movimento de câmera,
  transição de luz, reconfiguração de displays. Sequência: CENA ANTERIOR → TRANSIÇÃO → CENA NOVA, nunca cena quebrada no
  meio.
- **`StoreSceneResolver`:** converte o estado de busca na configuração da cena, por exemplo Nike + Sneakers →
  `NikeSneakerSceneProfile`, sem hardcode espalhado. Sem `if brand === "nike"` em componentes: tudo centralizado.
  Exemplo de Scene Profile:
  `{ brand, category, subcategory, layout: SHOE_WALL, heroZone: CENTER, cameraPreset: SHOES_DISCOVERY, productDisplayType: PEDESTAL }`.
- **Regras determinísticas antes de IA:** categoria → zona da loja. IA só em ambiguidade real. No futuro, ocasião e
  estilo (`ScenePresentationResolver`) podem influenciar a apresentação, sem substituir a taxonomia.
- **Coleção** só com suporte real do domínio.
- **Separação de camadas:**
  - backend: devolve dados de catálogo e comércio (`{ products, context: { brand, category, subcategory } }`) e não
    conhece câmera;
  - frontend ou serviço de configuração: resolve câmera, luz e layout;
  - não acoplar o backend ao layout 3D.

### 2.4 Produtos na cena e resultados (22–25, 65–69, 74, 93, 94)

- **Na cena:** produtos como objetos (item na arara, display de calçado, pedestal, peça no manequim, suporte de
  acessório), nunca centenas ao mesmo tempo. Carregar só os visíveis, os selecionados e os próximos.
- **2D + 3D juntos:** UI 2D = precisão; cena 3D = descoberta, preview e imersão. A pessoa não precisa "caminhar" para
  achar os produtos; a lista continua eficiente.
- **Painel de resultados compacto:** resultados, filtros, ordenação, produto selecionado. Painel lateral no desktop,
  bottom sheet no mobile. Progressive disclosure: nada de formulário, resultados, chat, detalhes, filtros, controles
  3D, Vista-me e breadcrumbs abertos ao mesmo tempo.
- **Loja com cara de loja** (varejo, curadoria, hierarquia de produto, nunca produtos flutuando), mas sem a fricção da
  loja física: sem longas distâncias nem corredores para procurar. Usar transições de câmera, zonas e ações de foco.
- **LOD de produto:** LOD2 longe, LOD1 perto, LOD0 no hero. Miniatura normalizada enquanto o 3D não carrega. Pooling
  de assets recentes; instancing de mobiliário e expositores.

### 2.5 Avatar, Vista-me e sessão (35–47, 54–60, 75, 76)

- **`CanonicalAvatar` sempre disponível:** não é preciso sair da loja para o Vista-me.
- **Vista-me:** Produto → Vista-me → resolve o slot → carrega o asset → veste o avatar → quality gate → preview.
  - experimentar não apaga a busca (Nike + Sneakers continua);
  - é **temporário**: não é adicionar ao guarda-roupa, comprar nem salvar look sem ação explícita.
- **`TryOnSession`:** `currentUpper`, `currentLower`, `currentShoes`, `currentAccessory`, `searchContext`,
  `selectedProducts`.
- **Slots:** `UPPER_PIECE`, `LOWER_PIECE`, `SHOES_PIECE` e `ACCESSORY_PIECE`, nunca "Base/Intermediária/Externa".
- **Troca e comparação:**
  - troca rápida: depois de vestir um tênis, os similares da busca aparecem com ← anterior / próximo →;
  - comparação A × B sem perder o contexto: troca, antes/depois ou lado a lado, conforme o custo visual.
- **Câmera semântica pelo tipo de peça:** UPPER → tronco, LOWER → cintura e pernas, SHOES → pés, ACCESSORY → local do
  acessório.
- **"Voltar à loja"** restaura câmera, resultados, filtros e posição contextual. A navegação para o preview nunca limpa
  busca, filtros, página de resultados ou marca.
- **Produto sem asset 3D** aparece na busca, e o Vista-me mostra "Preparando 3D" ou "Preview 3D indisponível". Imagem
  oficial → normalização → pipeline 3D → validação → disponível para prova. Reaproveitar o pipeline existente.
- **Imagem oficial sempre normalizada** (remove humano, remove objetos, isola a peça, enquadramento semântico, imagem
  de catálogo: CATALOG-IMG V2). Nunca foto bruta como material de interface.
- **Copilot integrado:** recebe `searchContext` + `currentTryOnSession` + guarda-roupa ("qual destes combina com minha
  calça?"). Recomenda looks, similares e peças que combinam, sem substituir os resultados.
- **Catálogo × posse:**
  - `CATALOG PRODUCT` ≠ `OWNED PIECE`; o produto só pertence à pessoa depois de aquisição ou adição explícita;
  - "Você já possui este item" só com matching confiável, nunca por nome parecido.
- **Compra futura:** Busca → Vista-me → Gostei → Comprar, sem misturar compra com prova.
- **Salvar, wishlist e favoritos** onde as estruturas já existirem.
- **Histórico da sessão:** vistos e provados recentemente, dentro do Provador, sem duplicar o histórico global.
- **Modos de foco:**
  - Product Focus Mode: a loja reduz distrações;
  - Try-On Focus Mode: avatar, produto, controles de slot e comparação.

### 2.6 Interface, estados e falhas (70–80, 92)

- **Mapa mental em segundos:** Search → Store Context → Product → Try-On.
- **Layout por dispositivo** (seguindo o design system):
  - mobile: formulário em bottom sheet com a cena visível ao fundo;
  - desktop: busca à esquerda, cena no centro, contexto e detalhe à direita.
- **Estados:** default, searching, results, loading scene, product selected, try-on processing, try-on ready, empty,
  error.
- **Vazio:** "Nenhum produto encontrado", com remover filtros, buscar similares e voltar à categoria.
- **Acabamento 3D:** caçar z-fighting, popping, clipping, textura faltando, produto flutuando, escala errada, sombra
  ruim e colisão de câmera.
- **Acabamento de UI:** espaçamento, tipografia, botões, listas, cards, transições, loading, overlays 3D, movimento de
  câmera, materiais, luz e escala dos produtos.

### 2.7 Performance, segurança e cache (32, 33, 64, 81, 82)

- **Medir:** FPS, draw calls, memória de textura, tempo de carga de asset, tempo de transição de cena, memória do
  avatar.
- **Prefetch** dos próximos assets prováveis depois de marca e categoria.
- **URL oficial validada:** esquema, domínio, redirecionamentos, MIME, tamanho e SSRF.
- **Cache:** resultados catalogados podem ser cacheados; a sessão é por usuário e tratada à parte.

### 2.8 Analytics, métricas e quality gates (83–86)

- **Eventos:**
  - busca: `fitting_room_opened`, `catalog_search_started`, `brand_selected`, `category_selected`,
    `subcategory_selected`;
  - cena e produto: `store_scene_changed`, `product_selected`;
  - prova: `try_on_started`, `try_on_completed`, `try_on_failed`, `product_compared`.
- **Métricas:** `searchToProduct`, `productToTryOn`, `tryOnSuccessRate`, `sceneChangeLatency`, `assetFailureRate`,
  `searchAbandonment`.
- **Quality gate do cenário:** assets da marca, scene profile, câmera, luz, zona de produto, fallback, performance.
- **Quality gate do produto para Vista-me:** categoria válida, slot válido, asset 3D válido (ou estado de
  processamento) e rig compatível com o avatar.

### 2.9 Arquitetura sugerida (95, 96)

- **Módulos, adaptados ao projeto:**
  - página e busca: `FittingRoomPage`, `CatalogSearchPanel`, `CatalogSearchController`;
  - cena: `StoreSceneController`, `StoreSceneResolver`, `BrandSceneProfileRegistry`, `CategorySceneProfileRegistry`;
  - produto: `ProductDisplayController`, `ProductFocusController`;
  - prova e avatar: `TryOnSessionController`, `CanonicalAvatarController`;
  - transversais: `SemanticCameraController`, `SceneTransitionController`.
- **Backend auditado:** Brand, CatalogProduct, ProductImage, Product3DAsset e Search, sem duplicar regras no frontend.

### 2.10 Testes obrigatórios (100–102)

- **Busca:** só marca, só categoria, só subcategoria, marca + categoria, marca + subcategoria, produto completo, zero
  resultados.
- **Cena:** neutra → marca, marca → marca, categoria → subcategoria, fallback de cena.
- **Provador:** selecionar, Vista-me, trocar, comparar, remover, voltar à busca.
- **Performance:** mudanças rápidas de busca, muitos resultados, falha de asset, rede lenta, mobile.
- **Teste crítico de estado:** Nike → Sneakers → Air Max → Vista-me → Voltar retorna **exatamente** a Nike + Sneakers +
  resultados Air Max, sem resetar o Provador.
- **Teste de troca de contexto:** Nike sneakers → Adidas sneakers sem o avatar sumir, sem a tela piscar, sem quebrar
  filtros e sem câmera inválida.

---

## 3. Entregáveis (104)

1. Auditoria do Provador atual.
2. Auditoria da Busca Catalogada.
3. Auditoria das sub-abas.
4. Análise crítica de redundâncias.
5. Arquitetura unificada.
6. Fluxo de busca embarcada.
7. `CatalogSearchState`.
8. `StoreSceneState`.
9. Scene Resolver.
10. `BrandSceneProfile`.
11. `CategorySceneProfile`.
12. Integração com o `CanonicalAvatar`.
13. Integração com o Vista-me.
14. Câmera semântica.
15. Product Focus Mode.
16. Try-On Focus Mode.
17. Estratégia de performance.
18. Fallback.
19. Analytics.
20. Testes.
21. Backlog (P0 fluxo quebrado, P1 busca/prova/cena principal, P2 UX, P3 acabamento, P4 futuro).
22. Plano incremental.

## 4. Fases (105), adaptadas ao projeto

| Fase | Entrega | Depende de |
|---|---|---|
| P1 | Auditoria + arquitetura de estado (`CatalogSearchState`, `StoreSceneState`, `TryOnSession`) | — |
| P2 | Busca Catalogada embarcada como controle (sem sub-abas redundantes), estado preservado no Vista-me e no "Voltar" | P1 |
| P3 | `StoreSceneResolver` (no motor de cenas `lib/scene3d/`) + loja neutra multimarca (cena persistente com módulos dinâmicos) | P2, ENV3D E1 (passo 6.1) |
| P4 | `BrandSceneProfile` e `CategorySceneProfile` (zonas, expositores, sinalização com assets aprovados) | P3, CATALOG-IMG V2 |
| P5 | Product Focus (Hero Product) | P4 |
| P6 | Vista-me integrado (câmera semântica, Try-On Focus, troca rápida) | P5, GARMENT F0–F3 |
| P7 | Comparação + recomendações do Copilot | P6 |
| P8 | Performance (LOD, prefetch, pooling, instancing) + polimento + analytics | P7 |

## 5. Aceite (106–107)

**Regra:** o formulário não pode parecer algo "em cima" da cena 3D. Ele é o **controle semântico do ambiente**.

Não basta "a Busca Catalogada está visível dentro do Provador". O trabalho fecha quando:

- a busca controla a experiência;
- a marca muda o contexto da loja, a categoria muda a área, a subcategoria muda os expositores e o produto muda o foco;
- o Vista-me acontece sem sair da experiência, e o avatar continua presente;
- a busca não se perde e a troca de cenário é suave;
- a lista 2D e o espaço 3D trabalham juntos;
- a navegação é clara e a performance é adequada.
