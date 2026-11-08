# FLAIR 3D MAKE UP: reuso das câmeras do provador, do avatar e do catálogo

Estudo do código (07/11/2026) para o FLAIR 3D MAKE UP, jogo de styling no estilo DREST (`ESTUDO_DREST.md`, nesta
pasta): a pessoa veste uma modelo ou o próprio avatar com itens do catálogo numa cena 3D que **reaproveita as câmeras do
provador**, num lugar coerente com o desafio (passarela com plateia, provador com uma amiga virtual). Nenhum código foi
alterado; cada afirmação cita o arquivo de origem; os números de linhas são de hoje.

## 0. Resumo

1. A câmera do provador já é quase um "camera rig": matemática pura e testada (`lib/scene3d/orbit-steps.ts`,
   `detail-camera.ts`, `wheel-intent.ts`) e a parte React/three num só arquivo (`components/three/fitting-camera.tsx`).
2. **Hoje as paradas não chegam ao rosto nem às mãos** (`STOP_KEYS`: gola → calçado, em `detail-camera.ts`). O asset
   já tem o necessário para paradas faciais: os 468 marcos ficam presos a triângulos do corpo (`landmark.tri/bary` em
   `lib/avatar3d/human/asset.ts`, `landmarksOn` em `compose.ts`).
3. O avatar real **não gera maquiagem**, só preserva a da foto (`lipProtection` em `lib/avatar3d/human/skin-bake.ts`).
4. **Já existe um protótipo**: `paintFace` (`lib/heist/looks-face.ts`) pinta lábios, delineado, sombra, blush e
   sobrancelhas no UV canônico do MediaPipe para os figurantes do Heist. É a semente do sistema de camadas.
5. A taxonomia e o catálogo **não têm produtos de beleza** (5 categorias, 80 subcategorias, 23 dimensões). O que a busca
   encontra são falsos positivos (§3.2).
6. Para reagir já existem a multidão clonada do Heist com 40 gestos, sem "aplaudir"
   (`lib/avatar3d/human/locomotion-model.ts`), a plateia instanciada da Passarela (`components/three/runway-scene.tsx`)
   e as coreografias de reação ao vestir (`lib/room3d/mirror-session.ts`).
7. A plateia mais barata que convence tem três camadas (silhuetas instanciadas que batem palma, primeira fila de
   humanos clonados, amiga como único humano completo), guiadas por uma nota de 0 a 1 via um controlador puro.
8. MVP de duas cenas: cerca de 4 a 5 semanas-pessoa. O maior risco são os arquivos congelados (`human-avatar.tsx`,
   `mirror-session.ts`, `three-human.ts`), dos quais é preciso extrair antes de acrescentar.

## 1. O sistema de câmeras do provador

### 1.1 Peças

| Arquivo | Linhas | Papel |
|---|---|---|
| `components/try-on/fitting-room.tsx` | 186 | Página do provador: estado, catálogo e abas. Passa `view="front"` ao palco |
| `components/try-on/fitting-stage.tsx` | 149 | Palco: carrega a cena 3D (`dynamic`, `ssr:false`), guarda a `FittingCameraApi` e monta botões, painel e rolagem inteligente |
| `components/three/fitting-room-scene.tsx` | 162 | `<Canvas>`: cabine, luzes, manequim/avatar, `<Rig>`, `<OrbitControls>` e `<CameraSteps>` |
| `components/three/fitting-camera.tsx` | 212 | `Rig` (vista inicial), `posedStops`, `humanStore` e `CameraSteps` (passos, deslize, detalhe e roda) |
| `lib/scene3d/orbit-steps.ts` | 65 | Funções puras: `orbitGoal` (giro de 30°, zoom ×1,2, "frente"), `approach` e os tipos `FittingCameraApi` e `FittingDetailApi` |
| `lib/scene3d/detail-camera.ts` | 108 | Funções puras: `surfaceStops`, `moveStop`, `travelPose`, `wheelTravel`, `wheelDolly` e `nearestStop` |
| `lib/scene3d/wheel-intent.ts` | 40 | Decide se a roda vai para a página ou para a câmera, com o relógio injetado |
| `components/try-on/use-smart-wheel.ts` | 71 | Hook que alimenta `wheel-intent` com eventos do palco |
| `components/try-on/fitting-orbit-buttons.tsx` | 55 | Botões girar ←/→, aproximar e afastar (`aria-disabled` no limite) |
| `components/try-on/fitting-detail-controls.tsx` | 62 | Painel "câmera de detalhe" com radiogroup corpo/calçado/percurso, deslizante e chips de parada |

Testes que já caracterizam: `lib/scene3d/detail-camera.test.ts` (corpo real `public/avatar3d/body/fai-body-v1.*`),
`orbit-steps.test.ts`, `wheel-intent.test.ts` e os `.test.tsx` de botões, painel e roda em `components/try-on/`.

### 1.2 Órbita, zoom e enquadramento por estatura

- O OrbitControls do drei roda sem pan, com `minDistance 1.4`, `maxDistance = dist × 1.25` e `maxPolarAngle = 0.52π`.
  A lente é `fov 32` com `near .05` (`fitting-room-scene.tsx`).
- O enquadramento segue a estatura (`buildSpec(params).stature`): alvo em `[0, 0.60·altura, 0]` e distância
  `2.2·altura` (`0.52` e `1.55` no `closeUp` do laboratório). O alvo é memorizado para o Rig não desfazer o giro.
- `Rig` põe a câmera 12 cm acima do alvo, no ângulo da vista: frente 0°, ¾ ±35°, perfil 90°, costas 180°
  (`VIEW_ANGLE` em `fitting-camera.tsx`). Os botões giram 30° (`ORBIT_STEP_DEG`) e aproximam ×1,2 (`ZOOM_STEP`);
  "frente" volta pelo caminho mais curto (`shortest` em `orbit-steps.ts`).

### 1.3 Câmera de detalhe: zoom em regiões do corpo

- As paradas saem dos vértices do corpo composto, e não de alturas fixas. Para cada faixa de `group/h/leg`
  (`bodyParam` em `lib/avatar3d/human/garments.ts`), o algoritmo escolhe o vértice mais à frente ou mais de fora e põe a
  câmera a `DETAIL_DISTANCE = 0.34 m` com uma pequena elevação. A parada do calçado usa o centro do pé, visto de lado
  (`surfaceStops` em `detail-camera.ts`).
- Cada parada guarda um vértice-âncora. Na hora do foco, `posedStops` aplica a pele desse vértice no corpo posado e leva
  alvo e câmera juntos (`fitting-camera.tsx`).
- Há três modos (`DetailMode`): `corpo`, `calcado` (o alvo do OrbitControls vai para o tênis e arrastar gira em volta
  dele) e `percurso` (um `t` contínuo entre paradas, com `travelPose` interpolando por smoothstep). No detalhe, os
  limites passam para 0,12 a 1,2 m (`DETAIL_LIMITS`).
- **Rosto e mãos não estão cobertos.** Não há parada de olho, boca, bochecha, orelha, pulso nem unha (`STOP_KEYS`).

### 1.4 Transições, easing e movimento reduzido

- O deslize até uma parada usa aproximação exponencial, com `k = 1 − e^(−7·dt)` para alvo e câmera. Os passos dos
  botões usam `1 − e^(−9·dt)` em coordenadas esféricas (`useFrame` de `CameraSteps` e `approach` em `orbit-steps.ts`).
- No deslize os limites do OrbitControls ficam suspensos (sem saltos); arrastar cancela e mantém a distância
  (`cancel`); um clique de órbita no meio termina o deslize de uma vez (`settle`).
- Com "reduzir movimento", `k = 1` e a câmera corta sem voar (`useReducedMotion` em `components/three/common.tsx` lê
  `prefers-reduced-motion` e `data-reduce-motion`).

### 1.5 Entrada: mouse, trackpad, toque e teclado

- **Roda e trackpad.** O `wheel-intent.ts` entrega a roda à câmera em três casos: pinça (`ctrlKey`), interação recente
  (4 s, renovados por mais 1,5 s a cada uso) ou ponteiro parado sobre o palco por pelo menos 600 ms. A página fica com a
  roda se rolou há menos de 450 ms ou se o gesto é horizontal. No limite do zoom, a roda volta para a página
  (`wheelDolly`/`wheelTravel` devolvem `consumed`). No modo `percurso`, a roda anda pelo corpo
  (`use-smart-wheel.ts`, ganho de pinça ×10, dica por 1,8 s).
- **Toque.** Arrastar e pinçar ficam com o OrbitControls; o hook ignora toque na intenção de pairar.
- **Teclado.** Não há atalho sobre o canvas. Tudo passa por botões reais, chips e `<input type=range>` (setas). O
  `keydown` no palco só serve para "engajar" a roda. O Meu Quarto tem um modelo de teclado reaproveitável: V/Shift+V
  troca de vista, Q/E troca de canto e Shift+1–5 salva vistas (`lib/room3d/camera-views.ts`).

### 1.6 Limites para usar a câmera em outros lugares

1. **Alvo fixo na origem.** O avatar fica parado em `[0, y, 0]` e as paradas são calculadas só no foco (`posedStops`
   dentro de `focus`), então a câmera não acompanha um avatar que anda pela passarela.
2. **Acoplamento ao corpo.** `CameraSteps` depende de `HumanStore`/`HumanParts`, de `bodyParam` (`garments.ts`,
   congelado) e de índices de vértice do MakeHuman, que não valem para outra topologia (MetaHuman/Unreal).
3. **Nomes e i18n "do provador".** Os tipos se chamam `FittingCameraApi`, as chaves são `tryOn.detalhe.*` (20 chaves em
   `lib/i18n/messages/pt-BR.json`) e o CSS fica em `app/(site)/_styles/15-provador-espelho.css`.
4. **Contrato fechado.** O teste exige `stops == STOP_KEYS` (`detail-camera.test.ts`): o rosto deve ser família nova.
5. **Pontas soltas.** `CameraPreset` (FULL/SHOES/DETAIL) é resolvido por zona em `lib/scene3d/scene.ts`, mas nenhuma
   cena o consome. `lib/scene3d/fitting-walk.ts` (andar até o espelho) só é importado pelo próprio teste.
   `maxPolarAngle 0.52π` impede o contra-plongée de passarela.

### 1.7 Extração proposta: o "camera rig"

- **`lib/scene3d/face-stops.ts`** (nova, pura, ~100 linhas). Paradas `testa`, `olhos`, `palpebra`, `bochecha`,
  `labios`, `queixo`, `orelha` (para o brinco) e `pescoco` (para o colar), calculadas a partir de `landmarksOn`. A
  âncora é o vértice dominante de `landmark.tri`. A distância fica entre 0,16 e 0,22 m, contra 0,34 no corpo. Os
  índices vêm dos que o código já usa: lábios 13/14/61/291 (`components/heist/people/mouth.ts`), bochechas 50/280,
  pálpebras e `EYES` (`looks-face.ts`, `lib/avatar3d/iris.ts`), sobrancelhas (`BROW_LINES` em
  `lib/avatar3d/identity/brows.ts`).
- **`lib/scene3d/hand-stops.ts`** (~50 linhas). Centro de `group === 5` (mão) de cada lado, como a parada do calçado,
  para mostrar unhas, anel e pulseira.
- **`components/three/camera-rig/subject-camera.tsx`** (~200 linhas). Generaliza `CameraSteps` com uma **Strategy**
  `StopSource` (corpo, rosto, mãos) e com `follow`, que reaplica `posedStops` a cada quadro, ou a cada N quadros, para
  sujeitos que andam. `fitting-camera.tsx` passa a reexportar o rig com a fonte "corpo" e mantém a mesma
  `FittingCameraApi`.
- **`components/three/camera-rig/camera-rig.tsx`** (~80 linhas). Junta `<Rig>`, `<OrbitControls>` e
  `<SubjectCamera>` com parâmetros de lugar (`maxPolar`, `minDistance`, `fov`), para o provador e para as cenas novas.
- **UI.** `FittingDetailControls` recebe a lista de modos e o prefixo i18n. Os modos novos são `rosto` (percurso testa
  → lábios) e `maos`, nos três idiomas.

## 2. O avatar e a modelo

### 2.1 Corpo, rosto, cabelo, pele, olhos e óculos

- **Corpo.** Malha MakeHuman CC0 (`SkinnedMesh`, 4 ossos por vértice, nomes do Mixamo, repouso em "A") em
  `lib/avatar3d/human/three-human.ts`; forma por `compose`/`fitBody` (`compose.ts`); pose em `pose.ts`. O componente
  `HumanAvatar` (`components/three/human-avatar.tsx`) só mostra o corpo com as três zonas vestidas.
- **Rosto.** É o modelo canônico do MediaPipe Face Mesh: 468 vértices, UV canônico e 898 triângulos
  (`lib/avatar3d/canonical-face.ts`). `fitFace` ajusta o rosto do corpo aos pontos da pessoa, com resíduo opcional
  (`face-residual.ts`). O busto 2.5D desenha os 468 pontos com a textura no UV canônico
  (`components/three/avatar-bust.tsx`).
- **Pele.** `bakeSkin` (`lib/avatar3d/human/skin-bake.ts`) cria uma textura de 2048² no UV do MakeHuman com o tom
  medido e microvariação. Copia o atlas do rosto triângulo a triângulo, por afim, para os triângulos com
  `faceWeight ≥ 40`, depois de igualar a luz (`evenShading`) e o tom (`matchFaceToBody`). O material é
  `MeshPhysicalMaterial` com `roughness 0.55` uniforme e `sheen 0.22` (`skinMaterial` em `three-human.ts`). Não há
  `roughnessMap` nem `clearcoatMap`.
- **Olhos, sobrancelhas, cabelo e óculos.** Íris recolorida, esclera, córnea e linha d'água (`eyes.ts`, `iris.ts`,
  `three-human.ts`); fibras de sobrancelha (`brows.ts`); casca e fios com nível por aparelho (`hair-strands.ts`,
  `hair-lod.ts`); óculos da foto removidos da textura (`lib/avatar3d/glasses.ts`) e refeitos em 3D no osso `Head`
  (`glasses-3d.ts`). **Lacunas:** não há geometria de cílios nem de unhas em `lib/avatar3d`.

### 2.2 Como as roupas vestem

Cada peça vira uma malha presa ao mesmo esqueleto, em camadas. O molde vem de `kindOf(subcategoria)` e o caimento de
`GarmentSpec` (`lib/avatar3d/human/garments.ts`). A montagem fica em `components/three/human-outfit.tsx`. O material é
`garmentMaterial`, e a superfície pelo tecido sai de `fabricSurface(material)` (roughness e sheen). A zona sem peça
recebe camiseta, jeans e tênis padrão (`default-outfit.ts`). Bolsas e outros "acessórios" sem molde retornam `null` em
`kindOf` e não entram no corpo 3D. No provador 2D, os acessórios são sobrepostos por marcos de rosto e pose
(`lib/tryon/accessory-2d.ts` e `components/try-on/accessory-overlay.tsx`).

### 2.3 Maquiagem: o que existe hoje

| Onde | O que faz | Limite |
|---|---|---|
| `lib/avatar3d/human/skin-bake.ts` | Protege o polígono dos lábios (`OUTER_LIPS`) e mantém batom e maquiagem da foto ao igualar a luz e o tom | Não gera cor. É preservação, não aplicação |
| `lib/heist/looks-face.ts` (`paintFace`) | Pinta em canvas 1024² no UV canônico: pele, sombreado do nariz, **blush** (elipses em 50/280), **sombra** (polígonos de pálpebra), barba, **sobrancelhas**, **delineado** (0, 1 ou gatinho, sobre `EYES`), **lábios** (cor, linha entre eles e brilho) | Rosto sintético. Os parâmetros ficam em `FaceStyle` (`lib/heist/looks.ts`). A saída é protegida por SHA-256 em `looks.snapshot.test.ts` |
| `components/heist/people/template-builder.tsx`, `player-body.tsx` | Passam o canvas de `paintFace` como `atlas` do `HumanAvatar`, e `bakeSkin` o assa como se fosse a foto | Trocar a maquiagem obriga a reassar a pele inteira (2048²) |

### 2.4 Camadas de maquiagem: o que falta construir

1. **Regiões no UV canônico.** Lábios internos e externos, pálpebra, linha dos cílios, bochecha, maçã do rosto, zona T,
   oval do rosto (`FACE_OVAL`) e sobrancelhas. Hoje os mesmos polígonos estão duplicados em `skin-bake.ts` e
   `looks-face.ts`. A proposta é consolidá-los em `lib/avatar3d/makeup/regions.ts`.
2. **Modelo de camada.** `{região, produto, hex, acabamento, opacidade, mistura}` empilhados na ordem de aplicação:
   base, corretivo, blush/bronzer, iluminador, sombra, delineado, máscara, batom e gloss.
3. **Duas texturas por look no UV canônico.** Uma de cor RGBA transparente e uma de acabamento em cinza (mate, cetim,
   gloss, cintilante). São pintadas como `paintFace` faz, mas sem pele de fundo.
4. **Warp reaproveitável.** Extrair de `bakeSkin` o laço afim (UV canônico → UV MakeHuman) para
   `lib/avatar3d/human/face-warp.ts`. A mesma função passa a assar a pele e a camada de maquiagem, só nos triângulos do
   rosto, sem reassar a pele toda.
5. **Material.** Compor a cor sobre a cópia da `map` e usar mapas nativos do `MeshPhysicalMaterial`: `roughnessMap`
   para mate ou brilhante, `clearcoatMap` para gloss e `iridescenceMap` para metálico ou duocromo. O `roughness` final
   é `roughness × mapa`, então a base precisa subir (≈ 0,7) para o mate ficar mais áspero que a pele.
6. **Batom fotografado.** O atlas real já traz o batom da pessoa (§2.3). Aplicar cor por cima exige uma etapa
   opcional que neutraliza os lábios para o tom natural antes da camada.
7. **Unhas e máscara.** Exigem geometria nova: tampas de unha presas aos ossos das pontas dos dedos e cards de cílio na
   borda superior de `EYES`, no mesmo padrão das fibras de `brows.ts`.
8. **Base inclusiva.** As cores de base precisam ser filtradas pelo tom medido (`lib/avatar3d/skin-tone.ts`). A nota
   do jogo nunca pode depender do tom de pele.

### 2.5 Pontos de fixação de acessórios (já usados)

| Ponto | Uso hoje | Arquivo |
|---|---|---|
| Osso `Head` | Óculos 3D, ponto de rádio, touca de chef, brincos nos lóbulos a ±6,9 cm no quadro da cabeça, fibras de sobrancelha | `glasses-3d.ts`, `components/heist/people/jewelry.ts`, `accessories.ts`, `holds.ts`, `human-avatar.tsx` |
| Osso `Neck` | Colar com a medida do pescoço de cada corpo, gravata-borboleta | `components/heist/people/accessories.ts` |
| Osso `Spine2` | Lenço de bolso (`frontOf`) | `components/heist/people/template-builder.tsx` |
| `LeftHand`/`RightHand` | Objeto na mão orientado pela palma (`placeInHand`) | `components/heist/people/holds.ts` |
| Âncoras 2D | eyes, head, ears, neck, wrist, hip, hand para 17 subcategorias | `lib/tryon/accessory-2d.ts` |

Ainda faltam âncoras 3D de **pulso**, para relógio e pulseira, e de **dedo**, para anel e unha. As referências para
criá-las são `rig.hand` (palma e dedos, tipo `Rig` em `lib/avatar3d/human/locomotion-model.ts`) e os ossos
de dedo (`FINGERS`, no mesmo arquivo).

## 3. O catálogo

### 3.1 Como o FashionAI obtém peças, marcas e lojas

- **Produto global.** `catalog_products` guarda marca, categoria, subcategoria, cor, material, GTIN/EAN e uma
  `dedup_key` idempotente (`V30__catalogo_global.sql`). As marcas têm apelidos (`brand_aliases`) e fontes oficiais
  (`catalog_sources`). Variações, atributos e preço estão em `V49__catalogo_variacao_atributos_preco.sql`, e a tabela
  `catalog_product_attributes` tem chave estrangeira para `taxonomy_values`.
- **Marca.** `Brand` (logo, faixa de preço, país) e `BrandProfile` (perfil empresarial aprovado por administrador) ficam
  em `fai-domain/.../model/Brand.java` e `BrandProfile.java`.
- **No provador.** `GET /api/catalog/stores` (`CatalogController.java`) alimenta o `StoreBrowser`
  (`components/try-on/store-browser.tsx`: grade de marcas, chips de categoria e `CatalogSearch`). A marca vira o
  ambiente da cabine (`lib/scene3d/scene.ts` → `fitting-studio.ts`).
- **3D de vitrine.** `catalog_product_models_3d` (`V97`) guarda GLBs sem esqueleto que **nunca vestem o avatar**. O
  visualizador é `components/catalog/catalog-model3d.tsx`.
- **FLAIR.** `V98__flair_3d_jogos.sql` já usa o nome "FLAIR 3D MAKE UP" nos 100 jogos e nas regras de pontos.

### 3.2 Taxonomia: não há beleza

`fai-application/src/main/resources/taxonomy/taxonomy.json` é gerado por `scripts/taxonomy/build_taxonomy.py` e tem
5 categorias (`upper_piece`, `lower_piece`, `full_body_piece`, `shoes_piece`, `accessory_piece`), 80 subcategorias (23
de acessório: bolsas, chapéus, óculos, joias, relógio, meias…) e 23 dimensões. COLOR tem 59 valores com hex. FINISH é
de tecido (lavagens, `SATIN_FINISH`, `METALLIC`, `SEQUINED`…). A busca por termos de beleza só encontra falsos
positivos: "rouge" como apelido de vermelho (`taxonomy.json`), "máscara" como variação SHIELD de óculos de sol
(`V47__taxonomia_seed_variacoes.sql`), "maquiagem" como lugar do cenário 2D "desfile" do CBC (`lib/flair/cbc.ts`) e
"cosmético" no sentido de skin de carta (`FlairService.java`).

### 3.3 O que um catálogo de maquiagem precisa

| Campo | Valores | Observação |
|---|---|---|
| Categoria | `beauty_piece` (nova) | Separada de `accessory_piece`: o pipeline de imagem trata categoria desconhecida como "objeto inteiro" (`PieceType.java`) |
| Subcategoria (tipo) | `lipstick`, `lip_gloss`, `lip_liner`, `foundation`, `concealer`, `blush`, `bronzer`, `highlighter`, `eyeshadow`, `eyeliner`, `mascara`, `brow_pencil`, `nail_polish` | Cada uma aponta para uma região padrão |
| SHADE | Nome do tom + **hex** + subtom (frio, neutro, quente) | Tom = variante (`catalog_variants` em `V30`: `color`, `color_name`, `sku`, `gtin`) |
| FINISH_BEAUTY | `MATTE`, `SATIN`, `CREAM`, `GLOSS`, `SHIMMER`, `METALLIC`, `GLITTER` | Vira o mapa de acabamento (§2.4.5) |
| COVERAGE | `SHEER`, `MEDIUM`, `FULL` | Vira a opacidade da camada |
| FACE_REGION | `LIPS`, `EYELID`, `LASH_LINE`, `LASHES`, `BROWS`, `CHEEKS`, `CHEEKBONES`, `T_ZONE`, `FULL_FACE`, `NAILS` | Região que a camada usa no UV canônico |
| Marca, GTIN/EAN, preço, URL oficial | Igual às peças | A `dedup_key` já prioriza GTIN |

Encaixe sem quebrar nada:

- Gerar as dimensões novas no `scripts/taxonomy/*.py` e semear `taxonomy_values` numa migração nova, criada e
  versionada mas nunca aplicada em produção pelo agente.
- Mapear `beauty_piece` para um modo de vestir próprio (`MAKEUP`) e **fora** de `TryOnSlot`, `ShoppingPlanRules.SLOTS`
  e `kindOf`.
- Para o protótipo, usar uma marca própria fictícia ("FashionAI Beauty") com tons gerados, sem dados reais de marca. As
  marcas reais entram depois, pelas fontes oficiais, como nas peças.

## 4. Cenas e personagens para os palcos interativos

### 4.1 Inventário

| Recurso | Arquivo | Serve para |
|---|---|---|
| Multidão humana clonada: modelo montado uma vez e clones via SkeletonUtils; frustum, LOD de animação (1, 2 ou 4 quadros por distância) e sombra só perto; 2 montagens em paralelo e 3 clones por quadro | `components/heist/people/people.tsx`, `person.ts`, `template-builder.tsx` | Primeira fila e amiga |
| Aparências com rosto sintético (`FaceStyle`) | `lib/heist/looks.ts`, `looks-face.ts` | NPCs sem semelhança com pessoas reais |
| 40 gestos procedurais: `cheer`, `wave`, `celebrate`, `photo`, `talk`, `look`, `point`, `dance`… **sem `clap`**; um gesto por pessoa e mistura de 0,2 s; `look` vira a cabeça para um ponto | `lib/avatar3d/human/locomotion*.ts` | Reações da plateia |
| Boca que fala (morph) | `components/heist/people/mouth.ts` | Fala da amiga |
| Fãs na rua com `cheer/phone/wave` | `lib/heist/level-people.ts` | Referência de mistura de gestos |
| Plateia instanciada (cápsula + esfera, 2 lados × 3 fileiras × 22, cerca de 116), passarela com LED, painel de fundo, desfile com "reduzir movimento" | `components/three/runway-scene.tsx` | Base da passarela |
| Convidados em cápsula | `components/flair/afterparty-scene.tsx` | Figurantes de custo mínimo |
| Reações ao vestir (`alivio`, `alegria`, `ajuste`, `conferir`), 2,2 s ou 0,6 s com movimento reduzido, "sem julgamento" | `lib/room3d/mirror-session.ts` (`reactionChoreo`) e `components/room3d/room-avatar-controller.tsx` | Coreografia da amiga |
| Espelho (RF28): reflexo do avatar vestido | `components/mirror/mirror-stage.tsx`, `lib/scene3d/mirror-camera.ts` | Provador com espelho |
| Áudio sintetizado (murmúrio da multidão, ruído filtrado, reverb; voz opcional e desligada) | `components/heist/audio.ts`, `audio-tables.ts` | Aplauso por ruído |
| Laboratório de cenas | `app/(site)/lab/scenes/page.tsx`, `components/lab/scenes-lab.tsx` | Banco de testes visual |

### 4.2 A plateia que aplaude mais ou menos: a opção mais barata que ainda convence

1. **Fundo: silhuetas instanciadas.** A `Audience` da Passarela ganha duas `InstancedMesh` de mãos que batem palma,
   quique e "levantar" (escala Y): cerca de 350 matrizes por quadro, custo desprezível. Cada assento recebe gesto,
   intensidade e atraso do controlador; o atraso cresce da frente para trás, como uma onda.
2. **Primeira fila: 4 a 8 humanos clonados** de 2 ou 3 aparências do Heist, com o gesto novo `clap`, mais `cheer`,
   `photo` (flash) e `look` seguindo a modelo. `clap` é um gesto de tronco de ~15 linhas em `locomotion-social.ts`,
   incluído em `UPPER`, em `Motion` e no espelho `Anim` (`lib/heist/types-people.ts`).
3. **Som.** Palmas como rajadas curtas de ruído com passa-alta, em taxa proporcional à nota, sobre o murmúrio do
   Heist, só depois do primeiro gesto da pessoa (`audio.ts`).
4. **Faixas com histerese.** Abaixo de 0,35: poucas palmas, celulares, olhares para o lado. De 0,35 a 0,7: palmas
   educadas. Acima de 0,7: palmas fortes, "cheer", gente de pé e flashes, respeitando `reduceFlashes`
   (`components/heist/settings.ts`; menos de 3 por segundo, WCAG 2.3.1). Com movimento reduzido, sem quique nem onda:
   a reação aparece no som, na legenda e no medidor.

### 4.3 A amiga virtual no provador

Um único `HumanAvatar` com rosto sintético (`paintFace`), boca em morph e uma máquina de estados: `observa` (`look` no
avatar), `reage` e `comenta`. A reação reaproveita a forma de `reactionChoreo` (canais de braço, tronco, cabeça, pulo e
giro em `t ∈ [0,1)`, versão reduzida). Para isso, a coreografia precisa sair do arquivo congelado
`mirror-session.ts` para `lib/avatar3d/human/reaction-choreo.ts`, e os tipos novos são `uau`, `pensativa`,
`aprova` e `sugere`. As falas usam chaves i18n numa região `aria-live`. A voz sintetizada fica opcional e desligada,
como no Heist. A amiga comenta a **escolha** (combina com o tema, a paleta, o acabamento), nunca o rosto da pessoa.

### 4.4 Do placar à reação, e o Unreal

- **Nota.** Vem do servidor (`Flair3dPenalties.score(sintonia, hype, efeitos, penalidades)` em
  `fai-application/.../flair/Flair3dPenalties.java`); o cliente só mostra prévia.
- **Controlador puro e guiado por dados.** Recebe a nota, a semente e o número de agentes e devolve um plano
  `{gesto, intensidade, atraso, duração}` por agente. A tabela de faixas fica num JSON compartilhado. Assim o Unreal
  implementa o mesmo contrato com AnimBP e blendspace por intensidade (`docs/plataforma/APP_NATIVO_UNREAL.md` §4.4:
  "as regras e o manifesto têm de ser os mesmos").
- **Portabilidade.** Paradas de câmera descritas em **marcos e ossos**, não em índices de vértice; maquiagem no UV
  canônico do MediaPipe. Se o app usar MetaHuman (§1.4 do mesmo documento), será preciso remapear o UV canônico para o
  UV do rosto dele ou projetar por decal.

## 5. Plano de reuso

### 5.1 Módulos

O plano segue a árvore já proposta em `docs/flair/3d-puzzles/ALTERNATIVAS_FASHIONAI.md` §3.10 (`lib/venue3d/`,
`components/flair/venue3d/`).

| Módulo | Caminho | Tipo e limite | Linhas (est.) | Esforço |
|---|---|---|---|---|
| Paradas do rosto e das mãos | `lib/scene3d/face-stops.ts`, `hand-stops.ts` | lib-ts 250 | 100 + 50 | 2 d |
| Rig de câmera genérico (Strategy de paradas + `follow`) | `components/three/camera-rig/subject-camera.tsx`, `camera-rig.tsx` | componente 250 | 200 + 80 | 3–4 d |
| Painel de detalhe parametrizado e i18n (3 idiomas) | `components/try-on/fitting-detail-controls.tsx` (+20) | componente 250 | 85 | 1 d |
| Carregador de lugar (Canvas, nível de aparelho, kit) | `components/flair/venue3d/venue-canvas.tsx`, `venue-kit.tsx`, `lib/venue3d/kits.ts` | componente/lib 250 | 120 + 100 + 80 | 3 d |
| Kits: passarela (extraída de `runway-scene.tsx`) e provador com amiga (cabine de `fitting-room-scene.tsx`) | `components/flair/venue3d/kits/*.tsx` | componente 250 | 2 × 150 | 3–4 d |
| Regiões, modelo e pintura de maquiagem | `lib/avatar3d/makeup/regions.ts`, `model.ts`, `paint.ts` | lib-ts 250 | 120 + 80 + 150 | 4 d |
| Warp do rosto (extraído de `bakeSkin`) | `lib/avatar3d/human/face-warp.ts` | lib-ts 250 | 60 | 1 d |
| Aplicação no material (map, roughness, clearcoat) | `components/three/makeup-layer.ts`, `lib/hooks/use-skin-bake.ts` | lib/hook 250/150 | 120 + 60 | 3 d |
| Unhas e cílios (fase 2) | `lib/avatar3d/human/nails.ts`, `lashes.ts` | lib-ts 250 | 2 × 120 | 4 d |
| Controlador de reação (State, com Observer para som e FX) | `lib/venue3d/reactions.ts` | lib-ts 250 | 120 | 2 d |
| Gesto `clap` | `lib/avatar3d/human/locomotion-social.ts` (144 → 160), `locomotion-model.ts`, `lib/heist/types-people.ts` | lib-ts 250 | +20 | 1 d |
| Plateia instanciada e primeira fila | `components/flair/venue3d/audience.tsx`, `front-row.tsx` | componente 250 | 150 + 120 | 3 d |
| Amiga e coreografias extraídas | `components/flair/venue3d/friend.tsx`, `lib/avatar3d/human/reaction-choreo.ts` | componente/lib 250 | 150 + 90 | 3 d |
| Aplauso sintetizado | `lib/venue3d/applause-audio.ts` | lib-ts 250 | 80 | 1 d |
| Catálogo de beleza (taxonomia, migração não aplicada, seed fictício) | `scripts/taxonomy/*.py`, nova `V__`, `scripts/flair-games/data` | python/sql | — | 3–4 d |

Total do MVP (sem unhas e cílios): cerca de 4 a 5 semanas-pessoa.

### 5.2 Ordem

(1) Caracterizar `CameraSteps` com o renderizador de teste do R3F (padrão de `components/three/scenes.test.tsx`);
(2) extrair o rig com a mesma `FittingCameraApi` e as mesmas paradas; (3) família rosto/mãos; (4) extrair `face-warp`
e o efeito de pele de `human-avatar.tsx` (no teto de 295); (5) maquiagem primeiro no busto 2.5D (`avatar-bust.tsx` usa
o UV canônico direto) e depois no corpo; (6) passarela com reação e plateia; (7) provador com a amiga; (8) catálogo.

### 5.3 Regras do repositório

- **Linhas** (`docs/refactoring/LINE_RULES.md`). Congelados em `scripts/refactoring/line_baseline.json`, sem poder
  crescer: `human-avatar.tsx` (295), `three-human.ts` (333), `garments.ts` (1204), `mirror-session.ts` (297),
  `room-avatar-controller.tsx` (292), `fitting-cabin.tsx` (320). Extrair antes; rodar `line_ratchet` no fim.
- **i18n.** Paradas, modos, falas e faixas de plateia em `pt-BR`, `en` e `es` (`lib/i18n/messages/`).
- **Testes.** Caracterização antes de extrair. Paradas faciais testadas com o corpo real, como em
  `detail-camera.test.ts`. Controlador de reação puro com semente. Snapshots (`looks.snapshot.test.ts`,
  `locomotion.snapshot.test.ts`) sem mudança: `paintFace` não deve ser refatorado antes de as camadas novas existirem.
- **GoF.** Strategy (fonte de paradas), State (faixas de reação) e Observer (som e efeitos), registrados em
  `docs/refactoring/gof/PATTERN_DECISIONS.md`.

### 5.4 Riscos

| Risco | Mitigação |
|---|---|
| Custo de montar humanos (cada modelo trava a página por "alguns décimos de segundo", `people.tsx`) e de reassar 2048² a cada troca de maquiagem | No máximo avatar + amiga + 6 clones. Camada de maquiagem separada só nos triângulos do rosto. Nível de aparelho por `hair-lod.ts` |
| Câmera parada num sujeito que anda (passarela) | Modo `follow` que reaplica as paradas a cada N quadros, ou câmera de detalhe só com a modelo parada na ponta da passarela |
| Pálpebra e linha dos cílios parcialmente fora de `faceWeight ≥ 40` ou dentro das órbitas (`eye-sockets.ts`) | Medir a cobertura das regiões no corpo real antes de prometer sombra e máscara |
| Privacidade e ética: maquiagem sobre o rosto real; público a partir de 13 anos (`FlairService.java`) | Usar o avatar real só com a Aura Impersonation (nível Loft, `JOGOS.md`). Processar no navegador. Nota sobre a escolha, nunca sobre traços ou tom de pele. Bases inclusivas |
| Paridade com o Unreal (topologia, UV) | Paradas por marco e osso, maquiagem no UV canônico com remapeamento, tabelas de reação em JSON comum |
| Taxonomia e chave estrangeira de atributos | Valores novos semeados por migração versionada, nunca aplicada em produção pelo agente |
