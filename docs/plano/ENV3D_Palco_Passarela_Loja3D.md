# ENV3D — Ecossistema de ambientes 3D: Palco, Passarela e Loja 3D

Pedido de 05/10/2026, registrado no [plano mestre](plano-mestre-2026-10-05.md) (seção 7). Este documento guarda a
especificação inteira, agrupada, para que nada se perca. A execução começa pela **auditoria**: nenhuma tela ou objeto
novo antes dela.

**Princípio:** os três espaços são experiências diferentes, porém ligadas.

| Espaço | Papel | Frase-guia |
|---|---|---|
| PALCO | Apresentação, performance, destaque, evento | "onde eu apresento" |
| PASSARELA | Exibir looks em movimento, desfile, comparação, showcase fashion | "onde eu avalio e exibo looks em movimento" |
| LOJA 3D | Descoberta, preview, compra, customização, comercialização | "onde eu descubro, experimento e compro" |

Os três usam o mesmo **avatar canônico**, o mesmo **catálogo/inventário**, a mesma **linguagem visual** e a mesma
**arquitetura de produto**. O resultado precisa parecer uma plataforma madura, não uma coleção de cenas 3D soltas.

**Regra fundamental (req. 57):** antes de "como deixar bonito?", responder "por que existe? como é usado? o que resolve?
vale o custo?".

---

## 1. Ponto de partida conferido no código (05/10/2026)

| Área | O que existe | Observação inicial (a confirmar na auditoria) |
|---|---|---|
| Passarela | `components/three/runway-scene.tsx` (120 linhas) em `components/showcase/runway-panel.tsx`; rota `GET /api/explorer/runway` (`ShowcaseController.runway`), aba no Explorador | Usa `mannequin.tsx`, não o avatar canônico; sem caminhada, comparação nem snapshot |
| Palco | `components/three/stage-scene.tsx` (110 linhas) em `components/showcase/showcase-tabs.tsx`; "My Stage 3D" (`GET /api/institutional/{slug}/stage`) | Usa o manequim genérico; palco por celebridade (Eras) |
| Loja 3D | `components/three/store-street-scene.tsx` (153 linhas) nas Coleções da marca (`showcase-tabs.tsx`) | Sem avatar e sem compra; mini lojas como cenografia |
| Loja do quarto | `components/room3d/room-store.tsx` (lista 2D): `/api/points/shop`, `.../try-on`, `.../purchase`, `/api/me/room-inventory/{id}/apply` | Já separa prova, compra e aplicação (base para PREVIEW × OWNED × EQUIPPED) |
| Provador | `/try-on`: `fitting-room-scene.tsx` + `avatar-viewer.tsx` + `components/catalog/catalog-search` | Avatar real; base da Loja 3D com prova (ver [PROVADOR-BUSCA](PROVADOR_Busca_Catalogada_Embarcada.md)) |
| Avatar canônico | `human-avatar.tsx`, `avatar-viewer.tsx`, identidade versionada (AVATAR-ID I1, V42) | O mesmo avatar ainda não chega ao palco, à passarela nem à loja de rua |
| Espelho e quarto | `/mirror`, `/room` (`room-scene.tsx`) | Fora do escopo direto; compartilham câmera, luz e avatar |

**Reconferência de 06/10/2026** (detalhes no [plano mestre, seção 9](plano-mestre-2026-10-05.md)):

- A passarela e o palco **já mostram o avatar canônico** do dono do look quando quem vê tem permissão: `Mannequin`
  desenha o `HumanAvatar`, e `ShowcaseService` só envia o avatar nesse caso. O que falta na passarela é a caminhada: o
  corpo desliza (o grupo só translada e gira), e cada um dos 12 do lote monta um avatar completo.
- A plateia é cápsula + esfera instanciadas na passarela, no palco e na rua das lojas; a plateia comum (`CrowdKit`)
  substitui as três.
- Os quatro ambientes (provador, mini loja, mini palco e passarela) passam a usar um motor de cenas só
  (`lib/scene3d/`): contexto → resolvedor puro → perfil de cena → cena persistente com módulos.
- Fases: E1 vira o passo 6.1 e **não depende mais do GARMENT** para a cena. E2 (Passarela) anda com o avatar atual e
  ganha tecido com movimento quando o GARMENT F4 chegar.

---

## 2. Requisitos, agrupados (1–59)

### 2.1 Auditoria inicial (1, 20, 53, 54)

- **Levantar tudo antes de mudar código:** cena 3D, avatar e avatar canônico, quarto, loja, palco, passarela, scene
  viewer, preview 3D, showcase, ambiente, catálogo, inventário, preview de produto, câmera, luz, animações, objetos
  interativos, assets GLB/GLTF e o motor (Three.js / React Three Fiber).
- **Mapear:** páginas, rotas, componentes, sub-abas, modais, estados globais, entidades, APIs, preview, personalização,
  compra, integração com catálogo, inventário, avatar 3D, outfit/look/scheme, social, analytics e assets 3D.
- **Panorama primeiro**, sem estruturas paralelas.
- **Para cada área atual:** utilidade real, coerência, acabamento, lugar certo, concorrência com outra área, se deveria
  ser cena própria, sub-aba, modo ou painel contextual, fragmentação e redundância. Decisão: KEEP, IMPROVE, MERGE, MOVE,
  RENAME, REDESIGN ou REMOVE.
- **Análise crítica sem complacência:** para cada problema, o impacto no usuário, no produto e técnico, além da
  severidade, da prioridade e da solução. Escala: P0 bloqueia, P1 quebra o fluxo principal, P2 prejudica muito a UX,
  P3 polimento importante, P4 futuro.
- **Matriz de decisão final:** Área | Estado atual | Problema | Severidade | Decisão | Solução.

### 2.2 Por que cada ambiente existe (2, 3, 4)

- Para cada ambiente: que problema resolve, que objetivo de produto atende, que ação principal facilita, se é necessário
  e se agrega valor ou é só cenografia. Nada fica só porque "fica bonito".
- **Papéis:**
  - **Palco:** apresentações, performance do avatar, lançamentos, eventos, destaque de coleção ou do usuário, exibição
    heroica de item/look/avatar, momentos promocionais, sociais e de celebração.
  - **Passarela:** desfile, comparação, outfit em movimento, leitura em vários ângulos, storytelling, editorial,
    showcase de coleção, feed social premium em 3D.
  - **Loja 3D:** descoberta, preview imersivo, prova visual, interação com produtos, compra, equipar, categorias e
    coleções, experimentar no avatar.
- **Matriz de utilidade:** Área | Objetivo | Ação principal | Integração com avatar | Integração com catálogo/loja |
  Valor real. Precisa responder o que se faz no palco e não na passarela, na passarela e não na loja, e na loja e em
  nenhum outro. Resposta vaga = arquitetura errada.

### 2.3 Avatar, identidade visual e ecossistema (5, 6, 19, 33–35)

- **Um só `CanonicalAvatar`** (AVATAR-ID) para palco, passarela, loja, prova, demonstração, animações, preview e social:
  USER → CANONICAL AVATAR → STAGE / RUNWAY / STORE.
- **Mesma plataforma, mesma linguagem visual, intenções diferentes:** nada de palco parecendo outro app, loja parecendo
  demo de engine, materiais ou luz desconexos, escala inconsistente ou overlay fora do design system.
- **Fluxo do ecossistema:** LOJA 3D (descubro) → PREVIEW (visto no avatar) → PASSARELA (vejo em movimento) → PALCO
  (apresento, registro, compartilho).
- **Looks:** palco e passarela usam o look atual, os salvos, as recomendações, as combinações, as coleções e as
  variações; nada é refeito do zero ao trocar de ambiente.
- **Loja e inventário:** catálogo, inventário, itens possuídos, wishlist, preview, compra e equipar. Os estados
  `OWNED`, `PREVIEWED`, `PURCHASED` e `EQUIPPED` são distintos (**Preview ≠ Ownership ≠ Equipped**).

### 2.4 Palco (7–9, 30)

- **Ao entrar no palco, o usuário vai fazer o quê?** Resposta objetiva. Usos possíveis: apresentar o avatar, destacar
  um look, entrada heroica, coleção, lançamento, seasonal drop, premiação ou conquista, evento promocional, showcase
  social, experiência de marca.
- **Fluxos com hierarquia, sem misturar tudo numa interface:**
  - entrar → escolher avatar/look → pose/animação → exibir → snapshot/vídeo/compartilhar;
  - entrar → lançamento/coleção/evento → interagir com itens → ir à loja/catálogo.
- **Cenografia com função:** luz cênica, telões, painéis, pedestais, fundo dinâmico, branding, transições, efeitos
  discretos. Cada elemento responde "isso apresenta melhor o avatar/look/produto?".
- **Stage Mode:** interface com menos ruído, foco no avatar, no look, na animação e no momento.

### 2.5 Passarela (10–13, 31)

- Especializada em roupa em movimento: caimento, look completo, comparação, frente/lado/costas, editorial. Não é um
  palco comprido. Otimizada para WALK, TURN, STOP, POSE, RETURN, COMPARE e SHOWCASE.
- **Movimento:** entra → caminha → ponto focal → pose → gira e mostra ângulos → retorna ou segue para o próximo look.
- **Comparação:** A × B ou 1/2/3, com troca rápida, lado a lado, sequencial, replay de caminhada e snapshots
  comparativos.
- **Showcase editorial:** campanha, coleção, lookbook, lançamento, conteúdo compartilhável. Temas controlados
  (minimalista, editorial, futurista, clean, neon, luxury, monochrome) sem perder a identidade da plataforma.
- **Runway Mode:** troca de looks, caminhada, poses, comparação, snapshots, lookbook.

### 2.6 Loja 3D (14–18, 27, 32)

- Descobrir, navegar por coleções, interagir, fazer preview, experimentar, comprar, equipar, entender o item. Não é um
  grid 2D com fundo 3D nem produtos espalhados ao acaso.
- **Princípio:** discoverability + clarity + navigation + commerce + preview, nunca só espetáculo visual.
- **Objetos interativos com função (OBJECT → INTERACTION → ACTION):** vitrine, pedestal, arara, manequim, expositor,
  sapateira, estante, painel de coleção, destaque premium, balcão virtual, zona de promoção, item hero. Exemplo:
  MANNEQUIN → clique → detalhe/preview do produto.
- **Sem menu confuso:** foco claro, poucos CTAs, descoberta progressiva, hierarquia visual, categorias compreensíveis.
- **Preview no avatar ligado à compra:** selecionar → preview no avatar canônico → girar/aproximar → comparar → comprar
  → equipar.
- **Organização comercial:** destaques, categorias, coleções, promoções, novidades, possuídos, experimentáveis e
  compráveis, com clareza.
- **Store Mode:** produto, preço, preview, aquisição, equipar.

### 2.7 Direção visual, escala, câmera, luz, materiais e assets (21–26, 37, 44)

- **Direção visual premium:** sofisticação, moda, tecnologia, clareza, qualidade, presença de marca. Nada de demo
  técnica, showroom barato, jogo casual desconexo, mockup provisório ou layout desproporcional.
- **Escala plausível:** avatar, móveis e expositores, altura da passarela e do palco, largura de circulação, câmera,
  distância de vitrine, tamanho dos produtos, zonas de interação.
- **Câmera própria por ambiente:**
  - palco: enquadramento heroico, transições suaves, close;
  - passarela: câmera de desfile, frente, laterais, detalhe, 360° ou semi-360°;
  - loja: navegação clara, foco no produto, zoom contextual, rota de descoberta.
- **Iluminação:**
  - palco: mais dramático, mas legível;
  - passarela: leitura de tecido, silhueta, cor e movimento;
  - loja: produto sem ambiguidade;
  - nunca luz bonita e inútil, reflexo excessivo, sombra dura que esconde detalhe ou cena escura.
- **Materiais auditados:** piso, parede, metal, vidro, espelho, tecido, expositores, displays, painéis e pedestais.
  Nunca material padrão de engine.
- **Assets validados:** escala, orientação, UV, materiais, pivot, LOD, colisão, silhueta, peso e compatibilidade.
- **Temas** (luxury, pop, editorial, futuristic, urban, minimal, monochrome, event stage, premium boutique, sneaker
  room, gallery store) só com valor de produto e depois que o básico estiver bom.
- **Microinterações com propósito:** transições de câmera, foco de produto, highlight, entrada, confirmação, troca de
  look. Sem motion gratuito.

### 2.8 Navegação, hotspots, mobile e acessibilidade (28, 29, 42, 43)

- **Navegação:**
  - responder como se entra e se sai de cada ambiente, como a pessoa sabe onde está e como alterna entre os três;
  - decidir entre abas, hotspots, menus, rotas ou modos;
  - evitar excesso de sub-abas e fragmentação.
- **Hotspots só quando ajudam:** hover discreto, highlight contextual, painel lateral, um CTA principal por contexto.
  Nada de cenário cheio de ícones flutuantes.
- **Desktop × mobile:**
  - desktop: navegação mais livre, hover, câmeras elaboradas, painéis laterais;
  - mobile: bottom sheets, toques claros, menos ruído, rotas simplificadas;
  - o mobile não é a cena desktop encolhida.
- **Acessibilidade:**
  - toda ação importante tem equivalente em UI tradicional: abrir cada ambiente, experimentar, comprar, equipar,
    apresentar, voltar;
  - teclado, foco visível, rótulos, contraste e alvos de toque adequados.

### 2.9 Social (36)

- Snapshots, vídeos curtos, cards sociais e imagens promocionais a partir de palco e passarela, sem virar feed antes da
  utilidade central.

### 2.10 Performance, LOD e carregamento (38–41)

- **Metas reais:** FPS, draw calls, memória, texturas, reflexos, sombras, pós-processamento, assets do avatar, carga
  inicial e troca de look/item.
- **LOD** para avatar, produtos, manequins, móveis, cenário, plateia e decoração, preservando a leitura visual.
- **Carregamento progressivo:** shell da cena → avatar → objetos principais → detalhes → assets de alta qualidade.
- **Lazy loading na loja:** miniaturas e dados primeiro, preview sob demanda, asset 3D completo só quando necessário.

### 2.11 Estado, arquitetura, analytics e métricas (45–48)

- **Estados separados:** cena, avatar, preview, loja, sessão de passarela, sessão de palco, câmera e interação. Nada de
  um componente monolítico.
- **Módulos conceituais, adaptados ao projeto:**
  - cena e avatar: `Environment3DManager`, `AvatarSceneController`;
  - um por ambiente: `StageSceneController`, `RunwaySceneController`, `Store3DSceneController`;
  - transversais: `SceneCameraController`, `SceneLightingController`, `SceneInteractionManager`;
  - fluxos: `ProductPreviewController`, `RunwayPresentationController`, `StagePresentationController`,
    `Store3DCommerceController`, `SceneAnalyticsController`.
- **Eventos:**
  - aberturas: `stage_opened`, `runway_opened`, `store3d_opened`;
  - preview: `product_preview_started`, `product_preview_completed`;
  - passarela: `look_shown_on_runway`, `look_compared`, `snapshot_created`;
  - compra e saída: `purchase_started`, `purchase_completed`, `item_equipped`, `scene_exit`.
- **Métricas de produto:**
  - o palco é usado?
  - a passarela ajuda a decidir o look?
  - a loja 3D converte melhor que a 2D?
  - o preview aumenta a confiança?
  - onde há fricção?
  - quais ambientes justificam o custo técnico?

### 2.12 Qualidade, testes, estados vazios e falhas (49–52)

- **Quality gate por cena:**
  - propósito, navegação, consistência visual, legibilidade do avatar/look/produto;
  - sem clipping grave, câmeras usáveis, performance;
  - UI compreensível, estados vazios e de erro, fallback de asset, loading elegante.
- **Testes obrigatórios:**
  - palco: abrir, carregar avatar, trocar look, apresentar, snapshot, sair;
  - passarela: vestir look, caminhar, trocar, comparar, câmera de frente/lado/costas, snapshot;
  - loja: categoria, produto, preview no avatar, comprar, equipar, falha de preview, falha de asset, item já possuído.
- **Estados vazios claros:** sem avatar, sem looks, sem itens, sem produtos, sem coleção, sem itens compatíveis, sem
  conexão.
- **Falha de asset:** a cena não quebra, nunca mostra textura rosa, usa fallback, registra o erro e permite recarregar.

---

## 3. Entregáveis (55)

1. Auditoria completa do que existe.
2. Papel funcional de palco, passarela e loja 3D.
3. Mapa das áreas atuais.
4. Análise crítica de coerência.
5. Análise crítica de utilidade.
6. Análise crítica de acabamento.
7. Arquitetura nova.
8. Navegação.
9. Experiência do usuário por ambiente.
10. UI overlay.
11. Câmera por ambiente.
12. Iluminação por ambiente.
13. Integração com o avatar.
14. Integração com catálogo, inventário e loja.
15. Interação com produtos e looks.
16. Snapshots e social.
17. Analytics.
18. Plano de performance.
19. Quality gates.
20. Testes.
21. Backlog priorizado.
22. Plano de implementação incremental.

## 4. Fases (56), adaptadas ao projeto

| Fase | Entrega | Depende de |
|---|---|---|
| E0 | Auditoria + papéis + matriz de utilidade + arquitetura (entregáveis 1–7) | — |
| E1 | Base comum de cena: shell, avatar canônico nos três ambientes, câmera e luz por modo, navegação, estados vazios e fallback; motor de cenas `lib/scene3d/` e plateia comum (revisão de 06/10, plano seção 9.2) | E0 (a cena não espera o GARMENT; as roupas entram com o que houver) |
| E2 | Passarela funcional: caminhada (WALK→STOP→POSE→TURN→RETURN), cena configurada pelos filtros do RF33, comparação A×B, câmeras, snapshot (absorve PASSARELA-REAL; revista no plano, seção 9.5) | E1 |
| E3 | Loja 3D com preview e compra: objetos interativos, PREVIEW/OWNED/EQUIPPED, ligação com a loja de FAI Points e com o Provador (seção 8 do plano) | E1, PROVADOR-BUSCA |
| E4 | Palco: Stage Mode, apresentação, snapshots e social; palcos por artista (absorve PALCOS-ARTISTAS, seção 3.3) | E1 |
| E5 | Polimento visual, temas controlados, LOD, metas de performance e analytics | E2–E4 |

## 5. Aceite (58–59)

Não basta "três cenários 3D visualmente interessantes". O trabalho fecha quando:

- cada ambiente tem propósito claro e o usuário entende para que serve;
- o avatar está integrado corretamente;
- os fluxos são simples e a navegação é coerente;
- há valor real de produto: a loja 3D funciona comercialmente, a passarela ajuda a avaliar looks e o palco serve para
  apresentação/showcase;
- o acabamento é premium e a performance é adequada;
- o sistema está preparado para crescer.
