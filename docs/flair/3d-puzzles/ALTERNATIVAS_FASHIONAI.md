# Cenários 3D com encaixe de cartas: o que o FashionAI já tem e como chegar lá

Data: 06/11/2026. Escopo: estudo do código e proposta. Nenhum código do app mudou. Este documento complementa o
estudo de design de puzzles da Insomniac (`docs/flair/3d-puzzles/ESTUDO_INSOMNIAC.md`, escrito em paralelo).

**Nomes usados.** Todo jogo do FashionAI é FLAIR, em dois segmentos. **FLAIR 3D** reúne os 100 jogos de ambiente (`scripts/flair-games/data/serie-{a..e}.json`, `docs/flair/flair-3d-make-up/`) e as aventuras 3D, como o Afterparty. **FLAIR Card Building Challenge** reúne os desafios de montagem (CBC) e os modos de batalha de cartas: duelo, equipes, arena e os 15 modos de look.

**Pedido do dono (resumo):** trocar as fotos e a inserção de cartas nos cenários por cenas 3D ultrarrealistas, no
estilo dos puzzles de Spider-Man 2 (Insomniac). As peças devem encaixar com efeito perfeito, num uso realista e útil,
com efeitos visuais e sonoros. Também pediu alternativas, dentro dos jogos FashionAI, em que o encaixe da carta no
cenário fique praticamente perfeito.

**Resposta curta.** O repositório já tem quase todos os blocos que isso exige: three r187, R3F 9, drei 10, avatar
humano vestido, manequim, roupa pendurada com física simples, pós-processamento, áudio por Web Audio e níveis de
qualidade. O que falta é a peça central: um **encaixe 3D** (socket) que receba uma carta e a mostre como um objeto real
do lugar, e **kits de cenário** com modelos e luz pré-calculada. O nível AAA de PS5 (ray tracing e streaming de
gigabytes) não roda no navegador de um celular médio. O que dá para entregar é o realismo de um diorama: uma sala
pequena e fechada, câmera controlada, PBR, iluminação pré-calculada e HDRI. É o mesmo recurso dos puzzles da Insomniac,
que travam a câmera num quadro fechado.

---

## 1. Inventário do 3D e do áudio que existem

Versões em `package.json`: `three ^0.187.0`, `@react-three/fiber ^9.8.2`, `@react-three/drei ^10.7.9`,
`@types/three ^0.186.0`, `@mediapipe/tasks-vision 1.2.0`, `sharp 0.35.5`. O projeto **não** usa
`@react-three/postprocessing`, `postprocessing`, Howler nem Tone.js. O pós-processamento vem de
`three/examples/jsm/postprocessing`. Em `node_modules` já estão `draco3d` e `meshoptimizer`. O three também traz
`KTX2Loader`, o transcodificador Basis (`three/examples/jsm/libs/basis`), `ProgressiveLightMap(GPU)` e `GTAOPass`, mas
nada disso está em uso.

| Bloco | Arquivos | O que já faz bem | Limites |
|---|---|---|---|
| Utilitários das vitrines 3D | `components/three/common.tsx` | `useWebGL` (cai para 2D sem WebGL), `useReducedMotion` (preferência do app e do sistema), `loadTexture`/`useTex` com cache e timeout, `useGlb`, `useCanvasTexture`, `StudioLight` (PMREM de `RoomEnvironment`, sem baixar HDR) | O `GLTFLoader` de `useGlb` não tem meshopt, Draco nem KTX2 |
| Manequim paramétrico | `components/three/mannequin.tsx`, `lib/avatar3d/body-spec.ts`, `lib/avatar3d/garment-geometry.ts` | Corpo nas proporções da pessoa. A foto sem fundo da peça é projetada sobre um molde com volume, sem atravessar a pele | O verso da roupa é inventado. Peças com transparência ou de perfil perdem leitura |
| Avatar humano vestido | `components/three/human-avatar.tsx`, `components/three/human-outfit.tsx`, `lib/avatar3d/human/garments.ts` (1205 linhas, congelado), `public/avatar3d/body/fai-body-v1.bin` (4,3 MB, MakeHuman CC0) | Esqueleto, roupa em camadas presa ao esqueleto, regra "nunca sem roupa", cabelo em fios com LOD por aparelho e vigia de quadro (`lib/avatar3d/human/hair-lod.ts`: `deviceInfo`, `chooseHairLod`, `HairFrameBudget`) | Pesado. Na auditoria do Afterparty, o avatar, as sombras e o `ContactShadows` levaram a 730–790 chamadas de desenho (`docs/flair/met-gala-heist-auditoria-2026-10-25/README.md`, item 16.4) |
| Busto do Avatar 3D (RF40) | `components/three/avatar-bust.tsx`, `avatar-viewer.tsx`, `avatar-still.tsx` | Rosto pelos 468 pontos com a textura assada no UV canônico. `AvatarStill` renderiza uma vez, vira `<img>` e libera o contexto WebGL. A foto fica só em memória | O rosto é dado sensível: não pode ir para log, servidor nem captura |
| Provador 3D | `components/three/fitting-room-scene.tsx`, `fitting-cabin.tsx` (congelado em 320), `fitting-camera.tsx`, `components/try-on/fitting-*.tsx`, `lib/scene3d/*` | Cabine com geometria fundida por material, um material por acabamento, descarte ao desmontar, câmera de detalhe a 12 cm da peça (`lib/scene3d/detail-camera.ts`), luz neutra que não altera a cor da roupa | A arquitetura é conceitual e as fotos do catálogo aparecem como referência, não como modelo |
| Meu Quarto 3D | `components/room3d/room-scene.tsx` (1005 linhas, congelado), `hung-garment.tsx`, `room-props.tsx`, `room-furniture.tsx`, `approved-asset.tsx`, `lib/room3d/interaction.ts`, `cloth-motion.ts`, `mirror-session.ts` | Pegar uma peça e pendurá-la de volta no varão (`RoomInteraction`, ação `hang`, `REACH_S = .45`). Balanço de pêndulo (`stepSwing`) e queda com arrasto de tecido (`stepFall`). `HungGarment` extruda a silhueta pelo tipo da peça. `ShelfPiece` cobre calçados e acessórios. `ApprovedAsset` encaixa um GLB numa caixa (`contain`/`fill`). `PerformanceMonitor` derruba o DPR | Arquivos legados grandes que não podem crescer. Os GLBs `public/models/fai-room/bed-fai.glb` (11 MB, 11 mil triângulos) e `rack-fai.glb` (9,9 MB, 10 mil triângulos) não têm compressão: o peso vem de PNG/JPEG embutidos |
| Cenário da série A | `components/flair/games/room-scenario.tsx` | **Único jogo de cartas que já altera uma cena 3D.** As vagas preenchidas acendem módulos do quarto (`litModules`). `SceneBoundary` cai para a cena 2D se o WebGL falhar | Só acende: a carta não vira objeto na cena |
| Vitrines, Passarela e Palco | `components/three/store-street-scene.tsx`, `store-fixtures.tsx`, `runway-scene.tsx`, `stage-scene.tsx`, `effects.tsx`, `look-viewer.tsx` | Plateia instanciada, canhões de luz, confete e fogos (`Fireworks`, `Confetti`) congelados com "reduzir movimento" | `ProductImage` mostra a peça como um plano chapado com alpha |
| Atelier 3D | `components/atelier3d/viewport.tsx`, `lib/atelier3d/*` | `TransformControls`, histórico de comandos, documento de cena | Ferramenta de edição. Serve para posicionar encaixes no laboratório, não para o jogador |
| Afterparty (Roubo ao Afterparty) | `components/flair/afterparty-scene.tsx`, `afterparty-adventure.tsx`, `lib/flair/afterparty.ts` | O servidor decide tudo (`AfterpartyMods`). O deck muda o salão (luz `PENUMBRA/SALAO/HOLOFOTES`, convidados, cordões) e o avatar. Reaproveita peças do quarto (`RoomDoor`, `Lamp`, `FaiRug`) | O visual é primitivo: pessoas são cápsulas, sem pós-processamento nem modelos. A ficha diz rooftop (`docs/flair/modos-flair/README.md`), mas a cena é um salão de gala |
| Motor do Heist (fora do menu) | `components/heist/**` (222 arquivos com three), `lib/heist/**` | O renderizador mais avançado do repo. Pós-processamento HDR com bloom, ACES, gradação, grão e letterbox (`components/heist/scene/sky.tsx`). Reflexo planar dos pisos (`interior-fx-mirror.ts`). Texturas PBR procedurais em escala de mundo (`exterior-tex-core.ts`, `exterior-tex-pbr.ts`). `MeshReflectorMaterial` só no "high" (`exterior.tsx`). GLB com meshopt (`components/heist/scene/models.tsx`). Qualidade `high/low`, FPS e "reduzir clarões" (`settings.ts`). Orçamentos medidos por sala (`docs/flair/met-gala-heist-v2-plano-construtivo/areas/*.md`) | Fora do menu. **Imagens, texturas e cenas dele não podem ser reaproveitadas** (`docs/flair/modos-flair/README.md`, HEIST). `public/heist/models/` tem só o README. O pipeline Meshy (`scripts/heist/meshy/run.mjs`) é IA paga |
| Áudio | `components/heist/audio.ts`, `audio-tables.ts`, `lib/sensory.ts` | Áudio 100% sintetizado. O Heist tem barramentos de música, efeitos e vozes, reverb por convolução por sala com impulso sintético, posicionamento e oclusão, multidão e acordes. `feel()` toca um ruído filtrado por tecido (jeans ≠ seda) e vibra no celular, com som desligado por padrão | Nenhum arquivo de áudio no repo. A síntese convence em UI e ambiente, mas não em impactos realistas (vidro, metal, cabide) |
| Modelos 3D das peças | `fai-application/.../service/Model3dService.java`, `.../imaging/ReliefModelGenerator.java`, `components/room3d/piece-model-viewer.tsx`, `components/catalog/catalog-model3d.tsx` | Job RF16: Meshy, depois Stable Fast 3D, depois relevo local. O relevo inflado é gratuito (~40 mil triângulos, ~1,5 MB) | Meshy e SF3D são IA paga, proibidos aqui (`CLAUDE.md`). Só dá para usar modelos que já existem ou o relevo local |
| Cenas 2D atuais | `components/flair/games/photo-scene*.tsx`, `app/(site)/_styles/26-flair-3d-photo.css`, `27-flair-3d-fx.css`, `lib/flair/match-scene.ts`, `match-stage.ts` | Dez tipos de luz por vaga (`SceneFx` em `lib/flair/games.ts`), Aura Hype por faixa, Metamorfose e Impersonation, região viva acessível e crédito da foto | A carta entra como recorte por cima da foto, sem perspectiva, escala nem luz coerentes. 15 dos 36 ambientes não têm foto. Só 2 jogos têm âncoras próprias (`scripts/flair-games/data/stages/serie-d.json` nº 79 e `serie-e.json` nº 93) |

Ferramentas de verificação que já existem: Playwright com SwiftShader (`scripts/tryon/capture-scenes.mjs`, rota
`/lab/scenes`, inventário em `window.__sceneInventory`), auditoria quadro a quadro com `requestAnimationFrame`
(`scripts/avatar3d/nunca-sem-roupa-e2e.mjs`) e testes de snapshot do grafo de cena
(`components/heist/scene/interior.snapshot.test.ts`).

## 2. O que mais se aproxima do "encaixe perfeito" hoje

1. **Meu Quarto 3D: pendurar no varão.** É o único lugar com encaixe físico de verdade. A peça vai da mão ao varão em
   `REACH_S`, balança como pêndulo amortecido e assenta (`lib/room3d/interaction.ts`, `lib/room3d/cloth-motion.ts`,
   `components/room3d/hung-garment.tsx`). **Reaproveitar** `hungKindOf`/`hungShape`/`HungGarment`/`ShelfPiece`,
   `stepSwing` (balanço ao encaixar) e `ApprovedAsset` (GLB na caixa do encaixe).
2. **Provador 3D e avatar vestido.** Encaixar a peça no corpo é o caso mais realista que existe, com esqueleto,
   camadas e cor medida (`human-outfit.tsx`, `lib/avatar3d/human/garments.ts`). **Reaproveitar** na Impersonation (o
   avatar veste a carta) e nos encaixes de manequim (`mannequin.tsx`, que é mais leve).
3. **Série A em 3D** (`room-scenario.tsx`). Já liga o estado das vagas a uma cena 3D e cai para 2D com segurança.
   **Reaproveitar** o padrão: import dinâmico `ssr:false`, `SceneBoundary` e dados sob demanda.
4. **Motor do Heist.** É o melhor pipeline visual (pós-processamento, PBR procedural, reflexos, níveis de qualidade,
   orçamentos medidos). **Reaproveitar as técnicas, não os arquivos.** Copiar para um módulo neutro o compositor de
   `sky.tsx`, o reflexo planar e o padrão de `models.tsx`/`settings.ts`, sem importar `components/heist/**`. Assim o
   Heist fica intocado e nenhuma imagem dele aparece nos novos cenários.
5. **Afterparty.** O padrão de regras é o certo: o servidor calcula o efeito do deck e a cena só desenha. Mas o
   visual é o mais fraco e não serve de base gráfica.
6. **Passarela, Palco e Mini lojas.** Servem para plateia instanciada, canhões e fogos. A peça como plano chapado é
   justamente o que o pedido quer eliminar.

**Base proposta do motor:** `components/three/common.tsx` (texturas, WebGL, movimento reduzido, StudioLight), mais o
manequim e o avatar, mais as peças penduradas do quarto, mais um compositor de pós-processamento e um carregador GLB
(meshopt + KTX2) novos e neutros. O resultado é uma pasta nova `components/flair/venue3d/` com lógica pura em
`lib/venue3d/`.

## 3. Arquitetura proposta: cenário 3D com encaixe de cartas

### 3.1 Princípios

- **Mesmo contrato do jogo.** O servidor continua decidindo tudo (`/api/flair/games/{slug}/check` e `/submit` em
  `components/flair/games/use-game-play.ts`). O 3D só apresenta `CbcSlotResult` (`positionOk`, `neighbor`, `theme`,
  `sintonia`) e `Flair3dSlot`/`Flair3dResult` (`hypeBand`, `effect.kind`, `matchBand`, `perfect`) de `lib/flair/games.ts`
  e `lib/flair/cbc.ts`. Não muda API, DTO, i18n nem migração na fase 1.
- **Acessibilidade fica no DOM.** O canvas é `aria-hidden`, como `PhotoSceneArt` já faz. As vagas continuam como
  botões do `CbcScene` (`components/flair/cbc-scene.tsx`), o `Picker` continua no `Dialog` e o anúncio continua na
  região viva.
- **A foto 2D vira o modo de reserva.** Nunca há tela vazia, e o fallback já existe.

### 3.2 Kits de cenário (Abstract Factory)

Cada kit é um GLB com encaixes nomeados (`socket_<tipo>_<n>`, vazios com a orientação de frente em +Z), mais luz
pré-calculada (lightmap no UV2), um HDRI de ambiente, um perfil de reverb e um enquadramento de câmera. As variações
(`loja-boutique` × `showroom` × `vitrine` × `feira`) trocam materiais e props sobre a mesma geometria base. São 11 kits
para os 36 ambientes (tabela na seção 5).

### 3.3 Tipos de encaixe e posições aceitas

| Encaixe | Objeto real | Aceita | Como a carta vira objeto |
|---|---|---|---|
| `MANEQUIM` | manequim inteiro de vitrine | SUP, INF, VES, LOOK, ANY | Peça projetada no molde (`garment-geometry.ts`/`Mannequin`). LOOK veste todas as peças de `/api/schemes/{id}/look3d` |
| `BUSTO` | busto de costura | SUP, VES, ACE (colar) | Mesmo molde, só tronco. Reaproveita `DressForm` (`room-props.tsx`) |
| `CABIDE` | cabide no varão da arara | SUP, INF, VES | `HungGarment` (silhueta extrudada pelo tipo, com a foto nas duas faces) e balanço `stepSwing` no encaixe |
| `PRATELEIRA` | prateleira e mesa de dobrados | SUP, INF | Proxy dobrado com a foto como decalque na face de cima |
| `SAPATEIRA` | pedestal e degrau de sapatos | CAL | `ShelfPiece`, ou GLB do RF16 se existir (`model3dUrl`), ou relevo inflado |
| `JOALHEIRO` | caixa de vidro com veludo | ACE | Recorte em relevo raso sob vidro com transmissão. O vidro esconde a falta de volume |
| `PODIO` | plinto giratório | ANY | Escolhe a representação acima pela `position`/`category` da carta (`hungKindOf`) |
| `ESPELHO` | espelho de camarim ou provador | Impersonation | Reflexo com o avatar vestindo a peça (`AvatarStill` como textura, padrão `mirror-session.ts`) |
| `TELA` | telão, projetor, monitor | ANY | Peça projetada como vídeo/imagem emissiva. Impersonation = avatar na tela |
| `QUADRO` | moldura de galeria | ANY | Foto de estúdio (`studioUrl`) emoldurada, com luz de museu |
| `MESA` | mesa posta, balcão, cadeira | ANY | Peça dobrada ou pendurada no espaldar (proxy de tecido) |
| `MARCA` | X no piso da passarela ou do tapete | LOOK, ANY | Manequim (ou avatar na Impersonation) parado na marca |

**Representação (Strategy).** A ordem é: GLB aprovado da peça (`model3dUrl`, já gerado), depois o proxy por
tipo (manequim, cabide, dobrado ou relevo), depois o plano com alpha atrás de vidro (último recurso). Faltam ao
`FlairCollectionCard` (`components/flair/flair-game-card.tsx`) os campos `colorHex`, `studioUrl` e `model3dUrl`. Na
fase 1, busca-se `/api/pieces/{originId}/look3d` (`ShowcaseController`) só para as no máximo 11 cartas colocadas. Um
endpoint em lote fica para depois, aditivo e com teste de caracterização.

### 3.4 Encaixe, tolerância e retorno

- **Arrastar** a carta da bandeja (DOM) para o canvas, com raycast nos colisores dos encaixes. Tocar ou dar Enter numa
  vaga continua abrindo o `Picker`.
- **Ímã.** Dentro de 0,25 m do encaixe (ou 12% da largura projetada), o fantasma da peça é puxado por uma mola
  criticamente amortecida. O giro corrige até ±15°, a altura assenta pela base do encaixe e a escala vem do tamanho
  real da peça (`HUNG_LENGTH`/`hungProfile`).
- **Assentamento** em 0,3–0,4 s: curva com 2% de ultrapassagem, clique de trava, pó ou fiapos e o balanço do cabide.
  Com "reduzir movimento" o assentamento é instantâneo.
- **Fora de posição.** Hoje o `Picker` aceita carta fora de posição (`is-off`) e o servidor marca
  `positionOk=false`. Para manter o contrato, isso **não** bloqueia: a peça fica num **encaixe frouxo** (torta,
  luz âmbar, sem trava) até a conferência. Quando o servidor confirma, a peça encaixa ou fica frouxa de vez.
- **Sintonia de 0 a 3** = 0 a 3 "dentes" de luz na base do encaixe. `neighbor` = filamento de luz até a vaga
  vizinha (versão 3D de `PhotoSceneLinks`). `theme` = luz de destaque do ambiente.
- **`perfect`** dispara a hora dourada global: troca de HDRI e luz, um empurrão lento da câmera e o stinger musical.
- **Estados do encaixe (State):** `vazio`, `mira`, `frouxo`, `travado`, `aura`, `perfeito`.

### 3.5 Aura Hype, Metamorfose e Impersonation em 3D

- **Aura Hype** (faixa 0–5, de `LOW_SIGNAL` a `VIRAL`): número de luzes práticas do encaixe, segundo a mesma
  tabela `COUNT` de `photo-scene-fx.tsx`. Também controla a intensidade do bloom e as partículas instanciadas
  (≤ 300 no low, ≤ 2000 no high). As luzes são emissivas com cones aditivos falsos. Luz dinâmica real, no máximo 4.
- **Metamorfose:** troca de material no encaixe. Vidro ganha iridescência (`MeshPhysicalMaterial.iridescence`), tecido
  ganha `sheen` na cor da faixa e vitrine ganha transmissão prismática. O ambiente é tingido por um uniform de
  gradação, sem trocar geometria.
- **Impersonation:** o avatar entra no encaixe. No espelho aparece o reflexo; na tela, a projeção; em manequim ou
  marca, o avatar substitui o manequim com poucos quadros de transição. Usa o mesmo `HumanOutfit`, só no high. No
  low entra uma imagem do `AvatarStill`.

**Os 10 `SceneFx` em 3D:**

| `SceneFx` | Implementação 3D |
|---|---|
| `spot` | Spot real com gobo projetado e névoa volumétrica falsa a partir de Em alta |
| `flash` | Rajadas de luz pontual de 1 quadro com bloom, travadas por "reduzir clarões" |
| `neon` | Tubo emissivo com bloom e feixes de laser aditivos. A Metamorfose troca a cor |
| `candle` | Chamas em shader com luz piscando suave e bokeh na profundidade de campo do high |
| `vitrine` | Fileira de spots de trilho e vidro com reflexo de ambiente. A Metamorfose deixa o vidro iridescente |
| `mirror` | Reflexo planar (técnica de `interior-fx-mirror.ts`) com anel de lâmpadas de camarim |
| `rack` | Fita de LED na arara com brilho nos cabides. A Metamorfose tinge as peças |
| `daylight` | Luz direcional do sol com poeira em partículas e feixes. A Metamorfose leva à hora dourada |
| `screen` | Plano emissivo com textura de vídeo ou canvas |
| `lamp` | Halo de abajur ou lustre com cristais em `MeshPhysicalMaterial` com transmissão |

### 3.6 Som

- **Grafo Web Audio** (padrão de `components/heist/audio.ts`): barramentos de ambiente, efeitos, UI e stingers, mais
  um `ConvolverNode` por kit (tabela como `REVERB` em `audio-tables.ts`) e um `PannerNode` HRTF por encaixe.
- **Encaixe em camadas:** transiente (clique ou trava), corpo pelo material e cauda pelo reverb do ambiente.
  O corpo varia: tecido via `fabricOf`/`feel` de `lib/sensory.ts`, cabide metálico, vidro do joalheiro, salto em
  madeira.
- **Camadas extras:** Aura soma um brilho tonal afinado pela faixa. Metamorfose soma um riser e um acorde.
  Impersonation soma obturador e murmúrio. Frouxo toca um "toc" surdo, e `perfect` toca o stinger de 3–4 s.
- **Fontes, nesta ordem:** síntese (já existe, sem licença), Freesound filtrado por CC0, CC0 do Kenney (UI) e pacote
  Sonniss GDC (livre de royalties; revisar a cláusula de redistribuição). **Nunca** CC-BY-NC. Créditos num JSON igual a
  `public/flair/games/scenes/credits/*.json`. Formato AAC `.m4a` (abre em qualquer navegador), de 48 a 96 kb/s.
- **Comportamento:** o som fica desligado por padrão (regra de `lib/sensory.ts`) e começa só depois de um gesto. Há
  legenda opcional, como "[clique de encaixe]", e háptico curto no celular.

### 3.7 Câmera em modo puzzle

O plano de abertura é fixo, como um diorama (fov 35–45°). A paralaxe é limitada (±12° de giro, ±6° de inclinação,
pelo ponteiro ou giroscópio). Ao escolher uma vaga, a câmera faz um dolly de 0,6 s até o encaixe e depois volta.
Isso reduz o custo, porque o que fica fora de quadro não precisa de detalhe. É o recurso que a Insomniac usa nos
puzzles (ver ESTUDO_INSOMNIAC.md). Os limites e passos podem vir de `lib/scene3d/orbit-steps.ts` e
`detail-camera.ts`. Com "reduzir movimento", a câmera corta sem voar.

### 3.8 Acessibilidade e movimento reduzido

- Teclado e leitor de tela usam as vagas do DOM; o foco numa vaga destaca o encaixe 3D.
- O certo e o errado nunca dependem só de cor: há dentes de luz, ícone de trava e texto na região viva, que já existe.
- "Reduzir movimento" congela partículas, câmera e balanço.
- "Reduzir clarões" (padrão de `components/heist/settings.ts`) limita os flashes a menos de 3 por segundo (WCAG
  2.3.1).

### 3.9 Aparelhos fracos (níveis)

| Nível | Quando | O que roda |
|---|---|---|
| T0 | Sem WebGL, erro ou contexto perdido | A cena fotográfica 2D atual (`PhotoSceneArt`) ou o `CbcScene`. Já funciona |
| T1 low | Celular com `deviceMemory < 4` ou `< 6` núcleos (`deviceInfo`), ou `PerformanceMonitor` em queda | Só luz pré-calculada, sem sombra dinâmica nem pós-processamento, DPR 1, texturas de 512–1024, manequim no lugar do avatar |
| T2 high | Desktop e celulares fortes | Bloom e gradação (técnica de `sky.tsx`), GTAO opcional, reflexo planar, uma sombra de spot no encaixe ativo, texturas de 2048 |

Rebaixa durante o jogo sem recarregar, como `room-scene.tsx` faz com `PerformanceMonitor`. Tudo é descartado ao
desmontar, como em `fitting-cabin.tsx`.

### 3.10 Módulos novos (dentro de `docs/refactoring/LINE_RULES.md`)

- **Lógica pura** em `lib/venue3d/`: `kits.ts` (registro), `sockets.ts` (aceite por posição e matemática do ímã),
  `socket-state.ts`, `slot-sockets.ts` (vaga → encaixe), `quality.ts` (nível) e `audio-events.ts`.
- **Componentes** em `components/flair/venue3d/`:
  - `venue-canvas.tsx` (Canvas, nível, Boundary) e `venue-kit.tsx`.
  - `socket.tsx` e `card-object.tsx` (Strategy).
  - `fx-layer.tsx` (os 10 SceneFx), `puzzle-camera.tsx` e `drag-layer.tsx`.
  - `post-fx.tsx` e `glb-loader.ts` (meshopt + KTX2), ambos neutros.
- **Áudio:** `lib/venue3d/venue-audio.ts`.
- **Mapa por jogo:** `scripts/flair-games/data/stages3d/serie-{a..e}.json`, validado por `build.mjs` como em
  `scripts/flair-games/lib/stages.mjs`/`stageErrors`, e gerado para `lib/flair/venue3d-sockets.json`. Assim não há migração nem mudança
  em `scene_json`.
- **Padrões GoF** (Abstract Factory, Strategy, State e Observer para som e efeitos a partir do estado): cada decisão
  é registrada em `docs/refactoring/gof/` ao implementar.

## 4. Pipeline de assets, licenças, orçamento e carga

**Fontes de modelo e textura**

- **Preferir CC0:** Poly Haven (HDRIs, texturas, modelos) e ambientCG (texturas, HDRIs).
- **Sketchfab CC-BY**, com ressalvas:
  - Crédito obrigatório em cada modelo.
  - Evitar NC e ND (ND não deixa decimar nem retexturizar).
  - Recusar modelos com logos ou marcas reais.
  - A licença vale por modelo e o autor pode mudá-la: guardar uma cópia da página no momento do download.
- **Fab/Megascans:** a licença padrão proíbe redistribuir o arquivo cru, e um GLB num app web é baixável. Não usar
  sem parecer.
- **Sem IA paga:** nada de Meshy ou SF3D. O caminho é modelagem própria no Blender com CC0, e o relevo local para
  as peças.
- **Créditos:** em `public/venue3d/<kit>/credits.json`, igual às fotos.

**Formato**

- **Geometria:** glTF 2.0 binário com meshopt (EXT_meshopt_compression, já decodificado em
  `components/heist/scene/models.tsx`). Escolhemos meshopt em vez de Draco porque decodifica mais rápido e o repo já o
  usa.
- **Texturas:** KTX2/Basis, com UASTC para normal e ORM e ETC1S para cor. Exige o `toktx` (KTX-Software), que **não
  está instalado** no ambiente, mais o `@gltf-transform/cli@4` via npx (como o script do Meshy) e a cópia do
  transcodificador Basis para `public/`.
- **Luz:** lightmap e AO pré-calculados no Blender (Cycles, gratuito) no UV2. `ProgressiveLightMap` serve só para
  pré-visualização.
- **Ambiente:** HDRI de 1k em `.hdr` (RGBELoader) ou PMREM de `StudioLight` no low.
- **Lição dos GLBs atuais:** só 10–11 mil triângulos ocupam 10–11 MB por causa das imagens embutidas. Com KTX2 e
  meshopt devem cair para menos de 2 MB.

**Orçamento por cena** (alvo de celular médio, como Adreno 6xx / A13–A14, de 4 a 6 GB):

| Métrica | T1 low | T2 high | Referência medida no repo |
|---|---|---|---|
| FPS alvo | 30 estável (33 ms) | 60 no desktop, 30–45 no celular | `HairFrameBudget`: 22/33 ms |
| Chamadas de desenho | ≤ 120 | ≤ 250 | Galeria do Heist: 131 no low. Salão: 199 no low e 201 no high. Afterparty: 730–790 (ruim) |
| Triângulos visíveis | ≤ 250 mil | ≤ 600 mil | Galeria: 208 mil. Salão: 689 mil no low e 1,16 mi no high |
| Memória de textura na GPU | ≤ 96 MB | ≤ 192 MB | 2048² RGBA sem compressão ≈ 21 MB com mips; em KTX2 ≈ 5,6 MB |
| Luzes dinâmicas | 2, sem sombra | 4, uma com sombra de 1024 | — |
| Download do kit | ≤ 6 MB | ≤ 12 MB (texturas de 2k em lote extra) | GLBs do quarto: 10–11 MB cada (sem compressão) |
| Peças | 512 px | 1024 px | — |

**Ordem de carga**

1. A foto 2D aparece de imediato (T0).
2. O kit é importado e baixado em segundo plano (`dynamic(..., {ssr:false})`, como `room-scenario.tsx`).
3. Os shaders compilam antes do primeiro quadro (`renderer.compileAsync`).
4. A cena 3D entra com crossfade sobre a foto.
5. As texturas de 2k chegam depois.
6. As peças carregam conforme são colocadas.

O kit pode ser pré-carregado ao passar o mouse sobre o cartão no catálogo (`games-catalog.tsx`), com cache imutável
por hash no nome do arquivo.

## 5. Mapeamento: ambientes e jogos para kits e encaixes

**36 ambientes de `scripts/flair-games/lib/venues.mjs`** (o número de jogos vem de
`scripts/flair-games/lib/venue-map.mjs`; "sem foto" = falta o `.webp` em `public/flair/games/scenes/`):

| Ambiente | Jogos | Foto | Kit | Encaixes principais |
|---|---|---|---|---|
| loja-boutique | 4 | sem foto | BOUTIQUE | MANEQUIM×5, CABIDE, PRATELEIRA, SAPATEIRA, JOALHEIRO, PODIO |
| showroom | 7 | tem | BOUTIQUE (showroom) | CABIDE (araras de marca), MANEQUIM, MESA (balcão), PODIO |
| vitrine | 2 | sem foto | BOUTIQUE (vitrine de rua) | MANEQUIM atrás do vidro, PODIO, JOALHEIRO |
| feira | 3 | sem foto | BOUTIQUE (barraca) | CABIDE em arara de feira, MESA, SAPATEIRA em caixote |
| closet-luxo | 6 | tem | SUITE (Meu Quarto) | CABIDE, PRATELEIRA, SAPATEIRA, JOALHEIRO (gaveta de vidro) |
| suite-espelho | 2 | tem | SUITE | ESPELHO, BUSTO, MESA (penteadeira) |
| quarto-noite | 4 | tem | SUITE | CABIDE (cadeira e cabide de porta), MESA, ESPELHO |
| corredor-hotel | 3 | tem | SUITE (corredor) | CABIDE no carrinho de bagagem, ESPELHO do elevador, MARCA |
| camarim | 3 | sem foto | CAMARIM | ESPELHO com lâmpadas, CABIDE, BUSTO, SAPATEIRA |
| backstage | 3 | sem foto | CAMARIM (backstage) | CABIDE (4 araras), MANEQUIM, ESPELHO, MESA |
| atelier | 6 | sem foto | CAMARIM (ateliê) | BUSTO×3, MESA de corte, CABIDE, QUADRO (croqui) |
| passarela | 6 | sem foto | PASSARELA | MARCA×n, TELA (telão), ESPELHO-piso |
| tapete-vermelho | 2 | sem foto | PASSARELA (tapete) | MARCA, QUADRO (painel), flash |
| parede-imprensa | 1 | sem foto | PASSARELA (imprensa) | MARCA na frente do painel, flash |
| auditorio | 2 | tem | PASSARELA (auditório) | MARCA no palco, camarotes como PODIO |
| estudio-foto | 5 | tem | ESTUDIO | MARCA no fundo infinito, MANEQUIM, TELA (monitor), PODIO |
| redacao | 2 | tem | ESTUDIO (redação) | MESA, QUADRO (mural de capas), TELA |
| cinema-ar-livre | 1 | tem | ESTUDIO (cinema) | TELA, MESA (cadeiras), MARCA |
| palco-show | 3 | tem | PALCO | MARCA, TELA, PODIO (riser) |
| boate | 1 | tem | PALCO (boate) | MARCA na pista, MESA (bar), PODIO (globo) |
| festival | 4 | tem | PALCO (festival) | MARCA, TELA, MESA (barraca) |
| camarote | 1 | tem | LOUNGE (camarote) | MESA×2, MANEQUIM, ESPELHO |
| restaurante | 1 | tem | LOUNGE (restaurante) | MESA (cadeira e mesa posta), CABIDE (chapeleiro) |
| salao-gala | 1 | tem | LOUNGE (gala) | MARCA (escadaria), MESA, QUADRO |
| rooftop | 1 | sem foto | LOUNGE (rooftop) | MESA (bar), MARCA, PODIO |
| torre-vidro | 2 | tem | LOUNGE (lobby de vidro) | PODIO, JOALHEIRO, MARCA |
| galeria-arte | 4 | tem | GALERIA | QUADRO×n, PODIO, JOALHEIRO |
| leilao | 1 | sem foto | GALERIA (leilão) | PODIO (púlpito), QUADRO, JOALHEIRO |
| cofre | 2 | sem foto | GALERIA (cofre) | JOALHEIRO (gavetas), PODIO, QUADRO |
| rua-neon | 5 | tem | RUA | MANEQUIM em vitrine de loja, MARCA, TELA (letreiro) |
| metro | 1 | tem | RUA (metrô) | MARCA na plataforma, QUADRO (cartaz) |
| cidade-historica | 2 | sem foto | RUA (histórica) | MARCA, MANEQUIM em vitrine antiga, MESA (café) |
| aeroporto | 1 | tem | RUA (terminal) | MARCA, CABIDE no carrinho de mala, TELA (painel) |
| praia | 3 | sem foto | NATURAL (praia) | MESA (espreguiçadeira), CABIDE (quiosque), MARCA |
| serra | 3 | sem foto | NATURAL (serra) | CABIDE (cabana), MESA, MARCA na trilha |
| lavanderia | 2 | tem | LAVANDERIA | CABIDE, PRATELEIRA (dobrados), TELA (porta da máquina) |

Jogos por kit: BOUTIQUE 16, SUITE 15, CAMARIM 12, PASSARELA 11, RUA 9, ESTUDIO 8, PALCO 8, GALERIA 7, LOUNGE 6,
NATURAL 6, LAVANDERIA 2. Total: 100.

Nas 825 vagas, a contagem por posição é: ANY 245, SUP 167, ACE 145, INF 134, CAL 106, VES 28. Como 30% das vagas são
ANY, todo kit precisa de PODIO ou MANEQUIM com representação adaptativa.

**22 jogos fora dos 100** (FLAIR Card Building Challenge, mais as aventuras FLAIR 3D Afterparty e Heist; `docs/flair/modos-flair/README.md`; a lógica de palco está em `lib/flair/match-stage.ts`/`match-scene.ts`):

| Jogo | Ambiente | Kit | Encaixes (lado A e lado B) |
|---|---|---|---|
| DUEL | passarela | PASSARELA | MARCA em cada ponta, TELA |
| TREINO | estudio-foto | ESTUDIO | MARCA (A) e MANEQUIM da Casa (B) |
| ARENA | tapete-vermelho | PASSARELA (tapete) | MARCA×5 em sequência, flash |
| TEAM | backstage | CAMARIM (backstage) | CABIDE: uma arara por equipe |
| BATTLE | boate | PALCO (boate) | MARCA na pista, A e B |
| SQUAD | restaurante, redacao, festival, praia, tapete | LOUNGE, ESTUDIO, PALCO, NATURAL, PASSARELA | MESA, MESA, MARCA, MESA, MARCA (uma por situação) |
| LEAGUE | palco-show | PALCO | MARCA e TELA |
| TOUR | aeroporto, rua-neon, cidade-historica | RUA | MARCA por casa do tabuleiro |
| CONQUEST | torre-vidro | LOUNGE (lobby) | PODIO por andar |
| DECK | showroom | BOUTIQUE (showroom) | MANEQUIM montado no balcão (SUP×4, INF×3, CAL×2, ACE×2, curinga em PODIO) |
| WARDROBE | closet-luxo | SUITE | CABIDE e PRATELEIRA, um lado por guarda-roupa |
| RUNWAY | passarela | PASSARELA | MARCA×8 |
| DRAFT | showroom | BOUTIQUE (showroom) | 20 PODIO no centro, dois balcões |
| TAG_TEAM | camarote | LOUNGE (camarote) | MESA por dupla |
| BOSS | salao-gala | LOUNGE (gala) | MARCA (jogador) e PODIO do chefe |
| COMBO | estudio-foto | ESTUDIO | MANEQUIM com uma luz por combo |
| MONOPOLY | rua-neon | RUA | MANEQUIM em vitrine por quarteirão |
| CHESS | galeria-arte | GALERIA | QUADRO 3×3 na parede |
| ULTIMATE | auditorio | PASSARELA (auditório) | PODIO×7 nos camarotes |
| CBC | showroom e outros por desafio | conforme o ambiente do desafio | Iguais aos dos 100 jogos FLAIR 3D |
| AFTERPARTY | rooftop (3D próprio) | LOUNGE (rooftop) | Migrar o salão de cápsulas para o kit, mantendo as regras do servidor |
| HEIST | fora da lista | não se aplica | Não é alterado nem usado como imagem ou kit |

## 6. Plano em fases, riscos, esforço e verificação

**Escolha do protótipo: BOUTIQUE (`loja-boutique`) com o jogo 70, "Cinco Clientes".** A boutique cobre 16 jogos mais
DECK, DRAFT e CBC. Não tem foto hoje, então o 3D preenche uma lacuna real. E o jogo 70 tem 11 vagas com todas as
posições (SUP, INF, CAL, ACE, ANY): cinco clientes viram cinco manequins, mais sapateira, joalheiro e pódio. O camarim
(jogos 31, 32 e 91) seria um protótipo menor e mostra bem o espelho e a Impersonation; fica como o segundo kit.

| Fase | Entrega | Esforço honesto |
|---|---|---|
| F0 | Ferramentas: `glb-loader` com meshopt e KTX2, `toktx` no ambiente, script `scripts/venue3d/optimize.mjs`, rota `/lab/venue3d?kit=&jogo=&estado=` com `window.__sceneInventory` e `renderer.info`, orçamentos como testes | 1–1,5 semana de dev |
| F1 | Protótipo completo: kit BOUTIQUE com luz pré-calculada, encaixes MANEQUIM, CABIDE, SAPATEIRA, JOALHEIRO e PODIO, ímã e encaixe frouxo, os 10 SceneFx com foco em `vitrine`, `spot` e `mirror`, Aura, Metamorfose e Impersonation, áudio em camadas, câmera de puzzle, T0/T1/T2, só no jogo 70 atrás de uma flag | 6–8 semanas de calendário: dev 3D (~5 semanas) e artista 3D (~3 semanas para o kit e o bake) |
| F2 | Variações de BOUTIQUE (showroom, vitrine, feira), kit CAMARIM (backstage, ateliê), SUITE reaproveitando o Meu Quarto em modo encaixe, mapa vaga → encaixe para cerca de 45 jogos | 5–7 semanas |
| F3 | Os outros 7 kits e o mapa dos 100 jogos (de 20 a 30 minutos por jogo no laboratório, cerca de 45 h no total) | 2–3 semanas de artista por kit: 4–5 meses |
| F4 | 22 jogos fora dos 100 (FLAIR Card Building Challenge e Afterparty): palco 3D de dois lados no `match-stage`, SQUAD e TOUR com troca de kit, Afterparty no LOUNGE | 4–6 semanas |

**Total realista: 7 a 10 meses** com um dev 3D e um artista. Só com dev e assets CC0 prontos, o prazo dobra e o
resultado fica menos coeso.

**Riscos**

1. **Expectativa.** Spider-Man 2 não é alcançável em WebGL num celular médio. Promessa honesta: diorama fotorrealista
   com luz pré-calculada.
2. **Fotos das peças.** Recortes ruins viram proxies ruins. O verso e a lateral são inventados. O GLB do RF16 só
   existe para algumas peças e gerar mais exige IA paga, que é proibida.
3. **Memória no iOS Safari.** Há risco de perder o contexto. É preciso descartar recursos de forma agressiva e ter o
   fallback T0.
4. **Licenças.** CC-BY exige crédito por modelo, e assets do Sketchfab podem ter logos de marcas.
5. **Peso do avatar.** O orçamento do Afterparty estourou (790 chamadas). A Impersonation deve usar o avatar só no
   T2, e no T1 uma imagem do `AvatarStill`.
6. **Arquivos congelados.** `room-scene.tsx`, `hung-garment.tsx` e `garments.ts` não podem crescer. Para reaproveitar,
   é preciso importar ou extrair primeiro, com teste de caracterização.
7. **Isolamento do Heist.** Copiar técnicas e não importar `components/heist/**`, para não acoplar o jogo nem expor
   material dele.
8. **Fotossensibilidade** dos efeitos `flash` e `neon`.
9. **WebGPU** (o `WebGPURenderer` do three r187) fica para depois. A base é WebGL2.

**Verificação automática possível**

- **Vitest com lógica pura:**
  - Aceite por posição e matemática do ímã e da tolerância.
  - Cobertura do mapa: toda vaga dos 100 jogos tem encaixe compatível e todo ambiente tem kit.
  - Escolha de nível por `DeviceInfo`.
  - Tabela de eventos de som e efeito por `EffectKind` e faixa de Hype.
- **`node --test scripts/flair-games/build.test.mjs`:** validação de `stages3d`, no modelo de `stageErrors`.
- **Snapshot do grafo de cena** (padrão de `interior.snapshot.test.ts`): encaixes nomeados, luzes e materiais.
- **Playwright com SwiftShader** (padrão de `scripts/tryon/capture-scenes.mjs`):
  - Capturas do canvas nos estados vazio, parcial, frouxo e perfeito, nos níveis T1 e T2.
  - Comparação de pixels com tolerância.
  - Asserções sobre `renderer.info.render.calls`/`triangles` e `memory.textures` contra o orçamento.
- **FPS:** amostragem por `requestAnimationFrame` durante 10 s no laboratório. No SwiftShader o número só serve para
  regressão relativa, porque roda na CPU. O FPS real exige medição manual num Android médio pela depuração remota do
  Chrome, registrada no laboratório.
- **Regras do repo:** `python -m scripts.refactoring.line_ratchet` antes de cada commit.

**Fora do alcance da verificação automática:** a percepção de "realismo", a mixagem do som e a sensação do ímã.
Isso exige revisão humana com as capturas e um vídeo por kit.
