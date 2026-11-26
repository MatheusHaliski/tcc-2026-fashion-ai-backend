# Estudo: ray tracing e materiais diferentes por tecido (lã, couro, impermeável…)

Pedido da dona (26/11/2026): estudar como incorporar efeito de ray tracing para que jaquetas, casacos e partes de cima
tenham materiais diferentes — um moletom de lã, uma jaqueta de couro ou de tecido impermeável. Este estudo olha como as
peças são desenhadas hoje, o que faz um tecido parecer diferente do outro, quais caminhos existem (no navegador e no
motor) e recomenda uma ordem de trabalho. Nada foi alterado no repositório; os testes ficaram em pastas temporárias.

Legenda usada no texto: **[medido]** = rodado nesta máquina (bpy 4.2.0, 4 núcleos, sem GPU, dividindo a CPU com um lote
em execução); **[lido]** = conferido lendo o código (arquivo e linha reconferidos na revisão final); **[web]** = página
consultada em 26/11/2026 por um dos levantamentos, não reconferida na revisão; **[estimado]** = de memória ou conta de
ordem de grandeza, ainda sem medição.

## 1. O que o pedido significa na prática

### 1.1 Ray tracing de verdade x aparência de ray tracing

- **Ray tracing de verdade** segue raios de luz pela cena: dá sombra suave, luz rebatida entre as dobras, escurecimento
  no fundo das costuras e reflexo correto. No projeto ele só existe **fora do navegador**, no Cycles do motor
  (`render_preview` em `services/garment_blender/garment_blender/blender_io.py:177-206`, CPU, 48 amostras, 900×640)
  [lido].
- **No navegador não existe ray tracing por hardware.** A proposta para o WebGPU (gpuweb PR #11054 e #11056) continua
  aberta, sem data [web]. O que existe é path tracing por software (`three-gpu-pathtracer`), que leva de segundos a
  minutos por imagem e recomeça a cada movimento de câmera [estimado].
- **O que faz couro parecer couro e lã parecer lã não é o ray tracing, é o material**: quanto a superfície brilha, se
  tem verniz por cima, se tem penugem que acende na borda, se o brilho estica numa direção, e o relevo fino (grão,
  ponto, trama). Tudo isso o desenho em tempo real já calcula, desde que (a) o `.glb` traga esses parâmetros e (b) a
  cena tenha luzes e ambiente para refletir. O ray tracing acrescenta profundidade (sombra nas dobras, entre os gomos do
  acolchoado), não identidade do tecido.

Conclusão prática: o pedido se atende em duas frentes — **materiais diferentes por tecido** (motor + visualizadores, em
tempo real, em qualquer aparelho) e **ray tracing onde ele cabe** (assado no `.glb` e em imagens/giros renderizados pelo
Cycles; no navegador, só como modo opcional de imagem parada).

### 1.2 Estado atual

| Ponto | Situação | Fonte |
|---|---|---|
| Material do motor | `_material` define só Roughness, Metallic, textura de cor e mapa de normal. A rugosidade vem de um dicionário de três entradas (denim 0,82; sarja 0,75; tricoline 0,7; o resto 0,9) e a ribana usa a mesma do corpo | [lido] `blender_io.py:30-46`, `:57`, `:64-65` |
| Tecidos do motor | `fabric.py` e `spec.py:20` (`FABRICS`) têm malha_la, malha_algodao, jersey, moletom, sarja, denim, tricoline. Couro, nylon, acolchoado, veludo, cetim e la_plana estão em andamento por outro agente e **não estão nesta árvore** (árvore sem alterações pendentes na revisão) | [lido] |
| Exemplo concreto | a `nike-sportswear-windrunner` (corta-vento) sai hoje com texturas de **sarja** — um impermeável é construído como sarja fosca | [medido] nomes das imagens no `.glb` de teste |
| Exportador do Blender 4.2 | escreve `KHR_materials_sheen`, `_clearcoat`, `_specular`, `_anisotropy`, `_ior` direto das entradas do Principled; nunca escreve `extensionsRequired` | [medido] 28 materiais de sonda |
| Carregador do app | three 0.187.0: o `GLTFLoader` registra clearcoat, sheen, specular, anisotropy, ior, transmission, volume, iridescence, dispersion e diffuse_roughness | [lido] `GLTFLoader.js:642-665`; **não testado em navegador** |
| Provador (GLB vestido no avatar) | `wearMaterials` clona o material (classe e campos físicos preservados); `wearGlb` força `metalness = 0` em **todos** os materiais — inclusive `dentes`, que o motor exporta com metal 0,85 | [lido] `lib/avatar3d/human/glb-garment/index.ts:150-157`, `components/three/outfit-glb.ts:69-71`, `blender_io.py:71` |
| Ambiente (IBL) | provador, avatar, look, passarela e palco: `RoomEnvironment` gerado no navegador, intensidade 0,35–0,8. Visualizador da peça, Atelier, Acervo e rua das lojas: **sem ambiente** | [lido] `components/three/common.tsx:121-132` e cada cena |
| Campo `material` do catálogo | só chega ao molde paramétrico (`fabricSurface`, 5 casos, roughness + sheen); o caminho do GLB não o consulta | [lido] `lib/avatar3d/human/garments.ts:1050-1059`, `garment-fit.ts:221` |
| Ray tracing no app | nenhum: tudo é rasterização WebGL, sem pós-processamento; `three-gpu-pathtracer` e `postprocessing` não estão em `package.json` | [lido] |
| Máquina | 4 núcleos, sem GPU, carga 4–11 durante o estudo | [medido] |

Ou seja: **pelo que o código mostra, a cadeia já comporta materiais por tecido; o que falta é o motor escrevê-los e os
visualizadores terem luz para mostrá-los.** Isso ainda não foi visto em tela (ver §6).

## 2. O que diferencia cada material

### 2.1 Os "botões" que separam os tecidos

| Parâmetro (Principled 4.2) | O que faz | Sai no `.glb` como [medido] | Cuidado |
|---|---|---|---|
| Roughness | brilho largo e fosco x estreito e vivo | `roughnessFactor` | textura × fator também exporta |
| Specular IOR Level | quanto do brilho sobrevive (penugem apaga o brilho) | `KHR_materials_specular.specularFactor = 2 × valor` | só para valor < 0,5; 0,5 não escreve nada; acima de 0,5 vira `specularColorFactor` — **manter ≤ 0,5** |
| Sheen Tint + Sheen Roughness | véu claro na borda (lã, veludo, camurça) | `sheenColorFactor`, `sheenRoughnessFactor` | **o Sheen Weight não é exportado** (só liga a extensão): usar Weight = 1 e pôr a intensidade no Tint; o Tint branco padrão sai [1,1,1], forte demais |
| Coat Weight + Coat Roughness | camada de verniz (couro acabado, nylon com PU) | `clearcoatFactor`, `clearcoatRoughnessFactor` | Coat IOR e Coat Tint são descartados; normal do verniz exporta |
| Anisotropic + Rotation | brilho esticado ao longo do fio (cetim) | `anisotropyStrength`, `anisotropyRotation` (× 2π) | depende de tangentes; o motor não usa `export_tangents`; o three deriva a tangente do UV quando falta (conferido no shader, não em tela) |
| IOR | pouco efeito em tecido | só é escrito junto de specular/transmission e ≠ 1,5 | deixar em 1,5 |
| Subsurface, Thin Film | translucidez, furta-cor | **descartados** | só valem na imagem do Cycles |
| Oclusão (AO) | escurece fendas e fundo de ponto | `occlusionTexture` via grupo `glTF Material Output` | empacota com roughness numa só imagem (ORM) |

Todos os tecidos são dielétricos com F0 ≈ 0,04–0,05 [estimado, de memória da literatura]; a diferença não está no F0,
e sim em quanto do brilho sobra (Specular), na penugem (Sheen), no verniz (Coat) e no relevo.

### 2.2 Receitas por tipo de tecido

Valores de partida, com Metallic = 0 em todos. Foi **medida só a exportação** de 12 receitas (couro liso, camurça,
nylon impermeável, puffer, lã tricô, lã plana, moletom/fleece, jersey, denim, cetim, veludo, tricoline): as extensões
saem como esperado. As demais linhas (envernizado, taslan, ripstop, encerado, sherpa, sarja, cotelê) **não foram
exportadas**. Nenhum número foi afinado a olho — esperar ajuste de ±0,1 por classe depois de comparar Cycles e three.js
lado a lado. As faixas juntam dois levantamentos independentes. "Sheen" é a intensidade posta no Tint (com Weight = 1),
multiplicada pela cor do tecido clareada.

| Tecido | Roughness | Specular | Sheen (tint / rough.) | Coat (peso / rough.) | Aniso | Relevo (padrão e período) | Mapas que importam |
|---|---|---|---|---|---|---|---|
| Couro liso | 0,42–0,45 | 0,5 | — | 0,15–0,25 / 0,25 | 0 | grão em células 0,5–1,2 mm, força média | **roughness** (vincos +0,15), normal |
| Couro envernizado | 0,10 | 0,5 | — | 1,0 / 0,05 | 0 | quase liso | — |
| Camurça / nobuck | 0,88–0,95 | 0,2–0,25 | 0,45–0,7 / 0,6 | — | 0 | ruído fino, força muito baixa | **cor** com manchas de pelo (2–10 cm, ±12 %) |
| Nylon impermeável brilhante | 0,35–0,45 | 0,5 | — | 0,3–0,4 / 0,15–0,35 | 0–0,2 | trama invisível; amassado de 5–20 mm | normal de amassado (ladrilho grande) |
| Nylon fosco (taslan) | 0,60 | 0,5 | — | — | 0–0,2 | idem | idem |
| Ripstop | como nylon | 0,5 | — | como nylon | 0,1 | grade quadrada 5–8 mm, fio de 0,3 mm | normal da grade; roughness +0,05 na grade |
| Algodão encerado | 0,5 (mapa) | 0,45 | — | 0,25 / 0,4 | 0 | trama 0,4–0,7 mm; manchas de cera 1–5 cm | **roughness essencial**; cor 15–30 % mais escura |
| Acolchoado (puffer) | 0,32–0,45 | 0,5 | 0–0,2 / 0,3 | 0,15–0,3 / 0,15–0,2 | 0,1–0,25 | gomos 4–8 cm (geometria); franzido 3–8 mm na costura | **AO nas costuras**, normal do franzido |
| Lã tricô (malha_la) | 0,95–1,0 | 0,15–0,35 | 0,45–0,6 / 0,6–0,8 | — | 0 | ponto em V 4,5 mm, força alta | normal, **AO entre pontos**, mescla ±8 % |
| Lã plana / feltro (la_plana) | 0,95 | 0,2–0,3 | 0,35–0,6 / 0,6–0,8 | — | 0 | sem trama; ruído 0,2–1 mm, força muito baixa | **cor mesclada** |
| Fleece / sherpa | 1,0 | 0,2 | 0,8 / 0,85 | — | 0 | tufos 1–2 mm (sherpa 4–10 mm), força alta | normal, **AO fundo** |
| Moletom | 0,90–0,95 | 0,2–0,35 | 0,2–0,3 / 0,7–0,9 | — | 0 | malha fina, força baixa | normal, mescla leve |
| Jersey / malha de algodão | 0,85–0,90 | 0,25–0,4 | 0,12–0,15 / 0,6–0,9 | — | 0 | malha fina, força baixa | normal |
| Denim | 0,82–0,85 | 0,3–0,4 | 0,08–0,15 azulado / 0,6–0,8 | — | 0 | sarja diagonal 0,83 mm; flamê ao longo do urdume | **cor em dois tons**, normal |
| Sarja / chino | 0,75 | 0,45 | 0,1 / 0,5 | — | 0 | diagonal 0,71 mm | normal |
| Tricoline | 0,68–0,75 | 0,35–0,5 | — | — | 0 | trama quase lisa | quase nenhum |
| Cetim / seda | 0,28–0,30 | 0,5 | 0,2–0,25 × cor / 0,25–0,3 | — | **0,6–0,65** | nenhum | a direção da tangente, não mapas |
| Veludo | 0,95–1,0 | 0,05–0,1 | **0,9–1,0 × cor saturada / 0,35** | — | 0 | pelo sem estrutura | cor-base ~30 % mais escura; manchas de pelo |
| Cotelê | 0,90 | 0,25 | 0,55 / 0,5 | — | 0 | canaletas verticais 1,8–2,3 mm, força alta | normal, **AO nos sulcos** |

Como ler a tabela no caso do pedido: o **moletom/lã** fica fosco, sem brilho direto, com um véu claro na borda; o
**couro** tem um brilho largo e contínuo quebrado pelo grão, com verniz leve; o **impermeável** tem brilho vivo de
verniz sobre base lisa, com vincos secos. São três respostas à luz bem distintas mesmo com a mesma cor.

### 2.3 O que as texturas em numpy do motor conseguem gerar

`fabric.py` desenha 512 px por 5 cm (0,098 mm por pixel): períodos abaixo de ~0,4 mm não cabem; tudo precisa ladrilhar
[lido]. Viável com o método atual [estimado, não implementado]: grão de couro (Voronoi ladrilhável, ~25 linhas), grade
de ripstop, canaletas de cotelê, piquet, feltro, manchas de camurça/veludo, flamê de linho e denim, e um **terceiro
mapa ORM** (R = AO local, G = roughness) derivado da mesma altura. Viável só em parte: amassado de nylon e gomos de
acolchoado, porque o ladrilho de 5 cm se repete à vista — usar `uv_scale` (ladrilho de 20–30 cm) ou geometria. Inviável
com mapas 2D: silhueta felpuda de sherpa e profundidade de veludo (pediriam cascas ou deslocamento).

Onde isso encosta no código [lido]:

- `blender_io.py` está com 206 das 250 linhas e `fabric.py` com 108: a tabela de receitas e a fiação dos nós devem ir
  para um módulo novo (por exemplo `fabric_brdf.py`), não para dentro de `_material` (regra de `LINE_RULES.md`).
- `spec.py:20` valida `tecido.tipo` contra a tupla `FABRICS`: cada tipo novo precisa entrar ali também, senão a ficha é
  recusada.
- A ribana de uma jaqueta de couro ou nylon continua sendo malha: o tipo já cai em `malha_algodao`
  (`blender_io.py:64`), mas a rugosidade passada é a do corpo (`:65`). Com receitas, a ribana precisa da receita de
  malha, não a do corpo. O mesmo vale para `cadarco`, `linha`, `botao` e `dentes`, que têm material próprio.

## 3. Opções comparadas

| Opção | Ganho em "tecido diferente" | Ganho em realismo | Custo no aparelho | Aparelhos | Esforço | Risco principal |
|---|---|---|---|---|---|---|
| 1. PBR + extensões KHR + ambiente (IBL) | **alto** | médio | muito baixo (só shader) | todos os que rodam o app hoje | baixo | sheen do Cycles ≠ sheen do three; tangentes para cetim |
| 2. Path tracing progressivo (`three-gpu-pathtracer`) | nenhum além da 1 | alto, em imagem parada | alto; segundos a minutos | desktop com WebGPU; celular não | médio–alto | API instável; cena com malha animada e camadas |
| 3. `WebGPURenderer` / ray tracing por hardware | nenhum | baixo–médio (SSGI) | médio | WebGPU com recuo para WebGL2 | alto | hardware RT não existe no navegador; reescrever shaders |
| 4. Oclusão em tela (GTAO) | nenhum | médio (profundidade) | baixo–médio | todos, com trava no celular | baixo–médio | muda tone mapping/anti-serrilhado; halos entre camadas; captura de foto do provador a reconferir |
| 5a. Imagem/giro em Cycles | **alto** (ray tracing real) | o mais alto | nenhum | todos | médio | não é no avatar; armazenamento; tempo de CPU por peça |
| 5b. AO assada no `.glb` | nenhum | médio–alto | nenhum | todos | médio | segundo UV; errada quando a peça deforma |
| 6. Render Cycles sob demanda no servidor | alto | o mais alto | nenhum | todos | alto | fila, partida a frio, controle de custo |

As colunas de custo no aparelho e de ganho são avaliação [estimado]; nenhuma foi medida em navegador.

Notas:

- **Opção 2** [web, não reconferido]: versão 0.0.28 (02/11/2026) exige `three >= 0.187` (o projeto tem 0.187.0 [lido])
  e `three-mesh-bvh >= 0.9.17` (o projeto tem 0.8.3, transitiva [lido] — atualizar e conferir o drei). O traçador WebGL
  foi marcado como obsoleto em 0.0.25; o WebGPU é o caminho atual e o próprio README o diz instável. Suporte a sheen,
  clearcoat e anisotropia no traçador WebGPU **não foi confirmado**.
- **Opção 3**: migrar todos os visualizadores e os shaders injetados (cabelo, trama de denim, mistura do molde) para
  TSL, sem ganho específico para tecido. Não se justifica para este pedido.
- **Opção 4**: o three já traz `GTAOPass` em `node_modules` (segundo o levantamento; não reconferido). Não foi testado.
- **Opção 6**: cabe na regra do projeto (GPU alugada é permitida), mas a infraestrutura é grande para um trabalho
  acadêmico. A mesma GPU rende mais pré-renderizando os giros da opção 5a em lote.
- **Mapa de luz assado** (variante de 5b): o glTF não tem campo para ele e ele congela a iluminação, enquanto o
  provador troca de ambiente. Não recomendado.

## 4. Recomendação em camadas

Cada camada funciona sozinha e a seguinte só acrescenta. A camada **a** responde ao pedido; **b** e **c** são o ray
tracing de verdade; **d** é opcional.

### Camada a — materiais PBR com extensões KHR + ambiente nos visualizadores

**Motor** (`services/garment_blender/garment_blender/`):

- Módulo novo com a tabela de receitas da §2.2 por tipo de tecido e a função que aplica nas entradas do Principled;
  `_material` (`blender_io.py:30-46`) e `fabric_materials` (`:54`) passam a delegar. Regras medidas: Sheen Weight = 1
  com a intensidade no Tint; Specular IOR Level ≤ 0,5; IOR em 1,5; Coat só com peso e roughness.
- `fabric.py` e `spec.py:20`: os tipos novos (couro, nylon, acolchoado, veludo, cetim, la_plana — em andamento) e,
  depois, o terceiro mapa ORM (roughness + AO local) para couro, encerado, tricô e cotelê.
- `export_glb` (`blender_io.py:172-174`): avaliar `export_tangents=True` só se o cetim precisar.
- `render_preview` (`blender_io.py:182-184`): o mundo é uma cor uniforme com força 0,35 e a vista é `Standard`; trocar
  por um HDRI de estúdio. Com três luzes de área de 2,5 m e mundo chapado, o verniz tende a sair apagado mesmo no
  Cycles [estimado, não renderizado].

**`.glb`**: passa a trazer `KHR_materials_sheen`, `_clearcoat`, `_specular` e, no cetim, `_anisotropy`. Sem
`extensionsRequired` [medido], então um leitor antigo ainda abre o arquivo. O peso extra é de bytes (só números), até
entrar o mapa ORM. Conferência: `scripts/catalog/glb_quality.py:103` e `scripts/avatar3d/glb-report.mjs:57` já listam
`extensionsUsed` [lido].

**Visualizadores** (app Next.js):

| Onde | Arquivo | O que muda |
|---|---|---|
| Ambiente comum | `components/three/common.tsx:121-132` (`StudioLight`) | ambiente com fontes pequenas e fortes (HDRI de estúdio de 1k, ~1–2 MB [estimado], ou `RoomEnvironment` com painéis mais contrastados); o mesmo HDRI no Cycles. Hoje o comentário do código diz que a sala é gerada no navegador de propósito, "sem baixar HDR" |
| Provador e avatar | `components/three/fitting-room-scene.tsx:100`, `avatar-lighting.tsx:9` | não subir `scene.environmentIntensity` (clarearia a pele da foto); usar `envMapIntensity` **por material da roupa** |
| Vestir o GLB | `components/three/outfit-glb.ts:69-71` | manter `metalness = 0` no tecido e liberar no material `dentes` (o único que o motor exporta metálico; o clone se chama `glb-dentes`); aplicar o `envMapIntensity` da roupa. O zero existe por causa dos GLBs da Meshy — a exceção deve valer só para o GLB do motor |
| Embrulho no corpo | `lib/avatar3d/human/glb-garment/index.ts:150-178` | nada para sheen/coat; para cetim, conferir as tangentes derivadas do UV depois do embrulho (**não testado**) |
| Orçamento de textura | `lib/avatar3d/meshy/texture-budget.ts:9` | incluir `sheenColorMap`, `sheenRoughnessMap`, `clearcoatMap`, `clearcoatRoughnessMap`, `clearcoatNormalMap`, `specularIntensityMap`, `specularColorMap`, `anisotropyMap` no limite de 1024 px (só importa quando houver mapas, não fatores) |
| Molde paramétrico | `lib/avatar3d/human/garments.ts:1050-1087` (`fabricSurface`, `garmentMaterial`) | mesma tabela da §2.2 (nylon, veludo, acolchoado, coat, specular), para peça sem GLB não destoar. **`garments.ts` está congelado no baseline (1204 de 1205 linhas): extrair `fabricSurface` para um arquivo próprio antes de crescer a tabela** |
| Visualizador da peça | `components/piece3d/piece-model-viewer.tsx:15-31` | **adicionar ambiente** (hoje só hemisfério + uma direcional) e tone mapping Neutral |
| Atelier | `components/atelier3d/viewport.tsx:113-115`, `lib/atelier3d/document.ts:14-20` | adicionar ambiente; `MaterialEdit` ganhar sheen, coat e specular. Carga e exportação já preservam, e as listas do cliente (`document.ts:57-66`) e de `GlbInspector.java:12` já permitem sheen, clearcoat, specular, ior e anisotropy. **`document.ts` está congelado (356 de 356): extrair antes de acrescentar campos** |
| Manequim reserva e cenas | `mannequin.tsx:63-83`, `look-viewer.tsx`, `runway-scene.tsx`, `stage-scene.tsx`, `store-street-scene.tsx:176-181` | materiais intactos; rua ganha ambiente; unificar tone mapping (Neutral no provador, avatar e look; ACES padrão do R3F nos demais: a mesma peça muda de cor entre telas) |
| Acervo | `components/acervo/espaco/cena-conteudo.tsx:94-96` | roupas aqui são foto, não GLB: fora do escopo até o Acervo usar o GLB do motor |

Ligação com o catálogo: o motor recebe o tecido pela ficha (`tecido.tipo`). O campo `material` do produto deveria
escolher o tipo da ficha (LEATHER → couro, WOOL → malha_la ou la_plana, etc.), para a peça já nascer com o material
certo no `.glb`. **Não foi levantado** quem gera a ficha a partir do produto hoje nem se o campo `material` chega até
lá — conferir antes da fase 3.

### Camada b — oclusão assada pelo Cycles no `.glb`

**Motor**: passo novo depois da construção — segundo UV sem sobreposição, bake `AO` do Cycles, imagem ligada ao grupo
`glTF Material Output` (soquete `Occlusion`) com um nó `UVMap` do segundo canal. Tudo isso foi **medido** na
`nike-sportswear-windrunner` tamanho M (12.803 vértices):

| Bake AO | Tempo do bake (CPU dividida) | Acréscimo no `.glb` (base 1,41 MB) | Qualidade |
|---|---|---|---|
| 512 px, 16 amostras | 2,1 s | não exportado (imagem JPEG 17 KB maior que a de 64) | ruído visível |
| 512 px, 64 amostras | 7,1 s | +385 KB em JPEG (+27 %) | aceitável |
| 1024 px, 64 amostras | 28,8 s | +690 KB em JPEG (+49 %) | aceitável |

Do acréscimo, 265 KB são só do segundo UV (vértices divididos nas costuras novas, +14 %). O desdobramento
(`smart_project`) levou 0,09 s. Sem redutor de ruído (não testado).

**`.glb`**: `TEXCOORD_1` + uma imagem de AO compartilhada por todos os materiais, `occlusionTexture.texCoord = 1`;
nenhuma extensão. O estudo irmão (`docs/fai-reconstruction-engine/estudo-base-por-subcategoria.md`, §4, linha 52) já
pede um `TEXCOORD_1` por regiões para decalques; se esse atlas não tiver sobreposição, **o mesmo canal serve às duas
coisas** (hipótese, não testada).

**Visualizadores**: `sourceOf` (`glb-garment/index.ts:160-178`) hoje guarda só `position`, `uv` e `color` — precisa
carregar `uv1` pelo embrulho, senão o AO quebra no provador. `aoMap` já está na lista do `texture-budget.ts`.
`aoMapIntensity` em 0,6–0,8 [estimado]. O three aplica o AO só na luz indireta (ambiente, luz de hemisfério/ambiente e
reflexo do ambiente — conferido em `aomap_fragment.glsl.js`), não nas direcionais nem nos spots: o efeito aparece já
com as luzes de hemisfério atuais e cresce com o ambiente da camada a. Visualizador da peça, Atelier e manequim reserva
não precisam de código (não mexem em material nem em UV).

Problemas vistos no bake [medido]: (1) o atlas do `smart_project` desperdiça área com centenas de ilhas minúsculas
(dentes do zíper, pontos); (2) as faces internas saem quase pretas, porque a peça é uma casca fechada sem corpo dentro,
e o provador mostra o avesso na gola e na barra; (3) o bake é na pose de descanso — a sombra da axila e do capuz fica
"impressa" quando o avatar mexe os braços. Alternativa mais barata, não testada: AO por vértice num canal livre de
`COLOR_0` (o R é o rótulo da parte, `blender_io.py:21-23`), sem segundo UV, com resolução limitada pela malha e um
gancho de shader no app.

### Camada c — imagem e giro renderizados em Cycles (vitrine)

**Motor**: estender `render_preview` — HDRI de estúdio, redutor de ruído (OpenImageDenoise), câmera em órbita, 24–36
quadros. É o único lugar onde entram o que o `.glb` não carrega: translucidez (Subsurface), sheen de microfibra do
Cycles, deslocamento real.

**`.glb`**: nada. O resultado é um arquivo ao lado da peça no bucket: folha de quadros WebP/AVIF a 768 px (~1–3 MB) ou
vídeo curto (< 1 MB) [estimado].

**Visualizadores**: componente novo e pequeno de "arrastar para girar" no cartão do catálogo e na página da peça
(`components/catalog/catalog-model3d.tsx`, `components/expanded-card/expanded-piece.tsx`), com o visualizador 3D atual
como segunda opção. O provador continua em tempo real.

Limite: luz fixa, não é no corpo da pessoa, e o armazenamento cresce por peça e por cor.

### Camada d — path tracing progressivo no navegador (opcional)

Só no **visualizador da peça** (`components/piece3d/piece-model-viewer.tsx`: GLB parado, sem avatar), como botão "alta
qualidade" em desktop com WebGPU. Exige a dependência `three-gpu-pathtracer`, subir `three-mesh-bvh`, e um canvas
separado (o traçador roda em `three/webgpu`, não no canvas WebGL do R3F) [web]. **Não recomendado no provador**: a malha
vestida é animada (teria de ser congelada a cada pose), as camadas de roupa usam `polygonOffset` (que um traçador de
raios ignora — as camadas brigariam) e os shaders próprios (cabelo, denim, mistura do molde) não seriam reproduzidos.
Motor e `.glb`: nada além da camada a.

## 5. Fases propostas

| Fase | Entrega | Critério de aceite | Custo/tempo por peça |
|---|---|---|---|
| 0. Régua de calibração | cena fixa (esfera + dobra de pano) com as 6 classes do pedido (moletom, lã tricô, lã plana, couro, nylon, acolchoado), em Cycles e no three com o mesmo HDRI | 6 imagens pareadas guardadas; uma pessoa que não conhece o projeto nomeia o tecido certo em ≥ 5 de 6, só pela imagem, com todas na mesma cor | uma vez; nenhum por peça |
| 1. Receitas no motor (camada a, motor) | tabela por tipo + exportação KHR; ribana e aviamentos com receita própria | `glb_quality.py` mostra em cada peça de cima as extensões esperadas para o seu tecido (couro: clearcoat; lã: sheen + specular); `line_ratchet` sem violações; testes do motor verdes | 0 s a mais esperado (o motor mede 1,5 s por peça e tamanho, `piloto-e-decisoes.md:221`); + bytes |
| 2. Ambiente nos visualizadores (camada a, app) | IBL em peça, Atelier e rua; `envMapIntensity` da roupa; tone mapping único; metal de volta nos `dentes` | mesma peça de couro e de lã, na mesma cor, distinguíveis em captura de tela no provador, no visualizador da peça e no Atelier; pele do avatar sem mudança visível (comparar captura antes/depois); quadros por segundo do provador sem queda > 10 % num celular de referência | nenhum |
| 3. Catálogo → tecido | `material` do produto escolhe o tipo da ficha; `fabricSurface` (extraído) com a mesma tabela | toda peça de cima do catálogo com `material` preenchido gera GLB com a receita correspondente | nenhum |
| 4. Mapas novos | ORM (roughness + AO local), grão de couro, ripstop, feltro | de perto (peça ocupando a tela), o couro mostra o grão quebrando o brilho; acréscimo por mapa **medido e registrado** — referência: o normal de sarja a 512 px pesa 178 KB em JPEG [medido], então esperar ~100–200 KB por mapa ORM, por material que o usar [estimado] | < 1 s [estimado] |
| 5. AO assada (camada b) | segundo UV + bake 512/64 + `uv1` no embrulho | AO visível em axila, gola e costuras do acolchoado no visualizador da peça e no provador; avesso sem ficar preto; GLB ≤ +30 % | **+7 s e +385 KB** [medido numa peça, CPU dividida] |
| 6. Giro em Cycles (camada c) | 24–36 quadros com HDRI e redutor de ruído, componente de giro | giro carregando em < 3 MB; tempo por peça **medido e registrado** em `piloto-e-decisoes.md` | 3–15 min em 4 núcleos; 10–40 s em GPU alugada [estimado, sem medição] |
| 7. Alta qualidade no navegador (camada d, opcional) | botão no visualizador da peça | imagem limpa em ≤ 30 s num desktop com GPU dedicada; some sem erro onde não há WebGPU | nenhum no servidor |

Ordem sugerida: 0 → 1 → 2 respondem ao pedido e são baratas; 3 e 4 consolidam; 5 e 6 trazem o ray tracing de verdade; 7
só se sobrar prazo. Se a fase 6 usar GPU alugada (RunPod), valem as regras do projeto: chave só em variável de ambiente,
nada de id ou URL do pod versionados, provedor, modelo e custo medido em `piloto-e-decisoes.md`. Os preços vistos em
26/11 divergem entre as páginas da própria RunPod (RTX 4090 entre US$ 0,34 e 0,89/h) [web] — conferir antes de usar.

## 6. Limites e riscos

- **Nada foi visto em navegador.** A leitura das extensões pelo three 0.187 e a preservação no embrulho vêm de leitura
  de código. A fase 0 existe para trocar essa suposição por imagem.
- **Os números da §2.2 são pontos de partida**, verificados só quanto à exportação (12 de 19 linhas). Parte das
  referências (F0 das fibras, modelos de sheen, contagem de fios) é de memória.
- **Sheen diferente nos dois renderizadores**: o three usa o modelo "Charlie" (conferido no código por um dos
  levantamentos); o Cycles 4.x usa, até onde se lembra, um modelo de microfibra. O mesmo número não dá a mesma imagem —
  calibrar cada classe nos dois. Sheen forte escurece a base em 10–20 % [estimado] (compensar na cor) e, com roughness
  de sheen abaixo de ~0,3, pode dar faixas no three (incerto): manter ≥ 0,3 no veludo.
- **Com luz chapada, a diferença encolhe.** Sheen e verniz respondem também às luzes diretas, mas com uma direcional e
  um hemisfério sobra um único brilho; entregar a fase 1 sem a 2 pode parecer que "quase não mudou" no visualizador da
  peça e no Atelier.
- **Pele x roupa**: o ambiente do provador é fraco de propósito, para não dobrar a luz já assada na foto da pele
  (`avatar-lighting.tsx:4-6`). A saída é intensidade por material; se não bastar, o couro e o nylon ficam menos vivos
  no provador do que na página da peça.
- **Cetim** depende de tangentes alinhadas ao fio depois do embrulho no corpo; mangas podem girar o brilho. Tratar como
  último da fila.
- **Dupla face com verniz**: todos os materiais do motor saem `doubleSided` [medido] e o provador força `DoubleSide`;
  clearcoat no avesso pode dar artefato (não testado).
- **AO assada** erra onde a peça deforma ou se sobrepõe a outra; manter intensidade moderada. O atlas automático e o
  avesso preto precisam de solução antes da fase 5.
- **Acolchoado e sherpa** dependem de geometria (gomos, felpa): material e AO ajudam, mas não substituem o volume.
- **Tamanho do `.glb`**: o orçamento de textura do provador hoje não cobre os mapas das extensões; e nenhum carregador
  tem Draco, meshopt ou KTX2 configurado, então comprimir para compensar os mapas novos exigiria mexer em todos os
  pontos de carga (e nas listas de extensões aceitas pelo Atelier, no cliente e no servidor, que hoje recusam Draco,
  meshopt, basisu e `KHR_mesh_quantization`). O Atelier também recusa arquivo acima de 8 MB.
- **Arquivos congelados**: `garments.ts` e `lib/atelier3d/document.ts` estão no baseline de linhas e não podem crescer;
  as mudanças neles começam por uma extração.
- **Tempos do Cycles**: só o bake foi medido, com a CPU dividida (valores pessimistas). Os tempos de imagem e giro são
  estimativas e devem ser medidos na fase 6 antes de qualquer promessa de volume.
- **Dados de terceiros não reconferidos**: versões e avisos do `three-gpu-pathtracer`, estado das propostas do WebGPU e
  preços da RunPod vêm de consulta na web em 26/11 por um dos levantamentos.
- **Trabalho em paralelo**: os tipos novos de tecido e o especular/sheen estão sendo feitos por outro agente e não
  estavam na árvore na data da revisão; este estudo deve ser reconciliado com o que ele entregar (nomes dos tipos, onde
  fica a tabela) antes da fase 1.
- **Path tracing no navegador** tem API instável, traçador WebGL em desativação e suporte incerto a sheen/coat no
  traçador novo: por isso é a última camada e fica fora do provador.

## 7. Partes de baixo (jeans, cargo, alfaiataria, moletom, legging, saia)

Extensão do estudo de materiais às 14 subcategorias de baixo do motor (`services/garment_blender`). Fontes lidas:
`fabric.py`, `blender_io.py`, `spec.py`, `sizes_pants.py`, `pants_finish.py`, `pants_pockets.py`, `pants_details.py`,
`lower.py`, as 14 fichas de baixo em `specs/` e os 72 arquivos de `data/catalog/expansion/products/*.jsonl`
(4 387 produtos de baixo). Nada foi alterado no repositório; o contador usado está em `/tmp/estudo-baixo/count2.py`.

### 7.1 Estado atual

O motor aceita 7 tecidos (`spec.FABRICS`): `malha_la`, `malha_algodao`, `jersey`, `moletom`, `sarja`, `denim`,
`tricoline`. As partes de baixo usam só 4 deles:

| Subcategoria | Ficha em `specs/` | Tecido hoje | g/m² | Cor |
|---|---|---|---|---|
| `jeans` | abercrombie-high-rise-bootcut-jean | `denim` | 340 | `#4a6a93` |
| `denim_shorts` | g-star-3301-slim-denim-shorts | `denim` | 340 | `#3d5f8c` |
| `culottes` | le-lis-pantacourt-lydia-jeans | `denim` | 320 | `#8fa8c4` |
| `chino_pants` | everlane-straight-fit-performance-chino | `sarja` | 280 | `#b49a74` |
| `cargo_pants` | nicholas-daley-cargo | `sarja` | 330 | `#313442` |
| `casual_pants` | nicholas-daley-double-knee | `sarja` | 400 | `#1f2130` |
| `tailored_pants` | zara-calca-wide-leg-alfaiataria | `sarja` | 260 | `#1d1d20` |
| `bermuda_shorts` | baw-bermuda-cargo-classics | `sarja` | 240 | `#1b1b1e` |
| `skirt` | allsaints-jax-pleated-midi-skirt | `sarja` | 200 | `#3a3f4a` |
| `jogger_pants` | napapijri-malis-summer-joggers | `moletom` | 300 | `#1c1c1f` |
| `sweatpants` | champion-powerblend-oversized-sweatpants | `moletom` | 380 | `#9a9a9d` |
| `shorts` | asics-shorts-french-terry-5in | `moletom` | 280 | `#18181b` |
| `leggings` | amaro-legging-cos-alto-poliamida | `jersey` | 220 | `#141416` |
| `skort` | skechers-ace-14-pleated-skort | `jersey` | 200 | `#f0efeb` |

Seis subcategorias diferentes (chino, cargo, casual, alfaiataria, bermuda, saia plissada) saem com o mesmo material
`sarja`; a legging de poliamida e a saia-short esportiva saem com o `jersey` da camiseta.

O que o material tem hoje (`blender_io._material` e `fabric_materials`):

- Principled BSDF com 3 entradas: textura de cor, normal map e **um número** de rugosidade por tecido — `denim` 0,82,
  `sarja` 0,75, `tricoline` 0,70, todos os outros 0,90. Metallic 0.
- Nenhum outro lobo: sheen, coat, anisotropia, Specular IOR Level e IOR ficam no padrão do Blender (sheen 0, coat 0,
  F0 4 %). Não há mapa de rugosidade, de AO nem de alfa no tecido.
- A textura (`fabric.write_maps`) é uma repetição de 5 cm em 512 px (0,098 mm por pixel): cor base × sombra do relevo
  (0,78–1,08) × ruído suave de ±6 %. O denim soma 15 % de "trama branca" nos vales da diagonal.
- O relevo: denim 60 diagonais por repetição (passo de 0,83 mm na horizontal, 0,59 mm perpendicular à diagonal); sarja
  70 (0,71 / 0,51 mm); moletom 30 colunas × 40 carreiras (laçada de 1,67 × 1,25 mm); jersey 34 × 46 (1,47 × 1,09 mm).

Por que as peças parecem iguais:

1. **A diferença entre os tecidos está abaixo do pixel.** A prévia (`render_preview`, ortográfica, 900 × 640) mostra
   uma calça de 1 m a ~1,8 mm por pixel; a diagonal de 0,6 mm do denim e a de 0,5 mm da sarja viram média. No provador,
   a peça de corpo inteiro fica na mesma ordem de grandeza. O normal map só aparece em close.
2. **A resposta à luz é a mesma.** Rugosidade entre 0,75 e 0,90 sem sheen, coat nem anisotropia dá o mesmo lobo difuso
   com especular largo: o que separa cetim de moletom de couro (forma do brilho, véu rasante, reflexo nítido) não
   existe no material.
3. **O albedo é chapado.** Só a cor da ficha com ±6 % de ruído; sem variação por região (lavagem), por fio (mescla,
   linho) ou por estrutura (canaleta do cotelê, grade do ripstop).
4. **Os materiais que faltam nem têm nome na ficha.** `FABRICS` não tem couro, cetim, veludo, cotelê, ripstop, lona,
   linho, crepe, lã fria, poliamida, tactel nem tule; a ficha da legging "de poliamida" já teve de declarar `jersey`.
5. O que hoje distingue as peças de baixo é só a **construção** (corte de `CUTS`, bolsos, pesponto, vinco da
   alfaiataria, rebites do jeans), não o tecido.

Observação: o provador sem o motor tem outra tabela, mais pobre (`lib/avatar3d/human/garments.ts`, `fabricSurface`:
`DENIM`/`CANVAS` 0,94 de rugosidade e sheen 0,08; `SILK`/`SATIN` 0,4 e 0,65; `LEATHER` 0,55 e 0,08). As receitas abaixo
substituem as duas se forem adotadas.

### 7.2 Receitas por material

Convenções: parâmetros do Principled BSDF do Blender 4.2. F0 4 % = Specular IOR Level 0,5 com IOR 1,5 (padrão também
do glTF). Sheen = peso / rugosidade / tinta. "—" = zero ou padrão. Período do relevo medido perpendicular à linha.

**Origem dos valores.** São de referência publicada (R): o modelo de sheen e sheen tint para tecido do Disney
Principled (Burley, 2012); o sheen de microfibra do Principled do Blender 4.x (Zeltner, Burley e Chiang, 2022); o sheen
"Charlie" do `KHR_materials_sheen` (Estevez e Kulla, 2017), com `sheenColorFactor` e `sheenRoughnessFactor`; o F0 de
4 % para dielétricos e o intervalo de IOR das fibras têxteis (algodão, lã, seda, poliamida e poliéster entre ~1,5 e
~1,6, ou seja, F0 de 4 a 5,5 % — diferença invisível, por isso a tabela não mexe no F0 do tecido); as extensões
`KHR_materials_clearcoat`, `_anisotropy`, `_specular` e `_ior`; e as medidas têxteis (ligamento 3×1 do denim, canaletas
por polegada do cotelê, grade do ripstop). **Todos os números de rugosidade, peso de sheen, coat e anisotropia da tabela
são estimativa (E)** dentro das faixas usuais de bibliotecas de material (Substance, tipos de tecido do Marvelous
Designer — fosco, brilhante, cetim, veludo, couro): não copiei valor de preset nenhum e não há medição. Servem de ponto
de partida para calibrar olhando a prévia do Cycles ao lado da foto do produto.

**2a. Lobos do BSDF**

| Material | Rugos. | Sheen (peso / rug. / tinta) | Coat (peso / rug.) | Anisotropia | Observação |
|---|---|---|---|---|---|
| Denim cru / rígido | 0,78 | 0,15 / 0,6 / índigo claro | — | — | goma dá brilho leve; cor funda e uniforme |
| Denim lavado / estonado | 0,90 (0,95 no desgaste) | 0,25 / 0,7 / azul-cinza claro | — | — | superfície felpuda; o albedo por região é o que manda |
| Denim preto | 0,85 | 0,20 / 0,6 / cinza neutro | — | — | sem sheen vira silhueta preta; trama cinza, não branca |
| Denim com elastano | 0,75 | 0,10 / 0,5 / cor do tecido | — | — | mais liso e fino; relevo pela metade |
| Sarja de chino (peletizada) | 0,80 | 0,20 / 0,5 / cor clara | — | — | toque de pêssego: véu rasante suave |
| Ripstop de algodão | 0,75 | 0,05 / 0,5 / — | — | — | seco, quase sem véu |
| Ripstop de nylon | 0,55 | 0,10 / 0,3 / branco | — | 0,1 | brilho de fio sintético |
| Lona / sarja pesada (cargo, workwear) | 0,92 | 0,10 / 0,8 / — | — | — | o mais fosco da lista |
| Lã fria (alfaiataria) | 0,65 | 0,30 / 0,4 / cor do tecido | — | — | brilho baixo e limpo; superfície quase lisa |
| Crepe | 0,80 | 0,10 / 0,6 / — | — | — | fosco granulado; o caimento é o sinal principal |
| Gabardine | 0,58 | 0,20 / 0,35 / cor do tecido | — | 0,15 | sarja fechada e íngreme, lustro discreto |
| Moletom / french terry (face) | 0,95 | 0,50 / 0,8 / cor clara | — | — | felpa: véu largo na borda da perna |
| Malha técnica de poliamida (legging) | 0,52 | 0,30 / 0,3 / branco | — (0,4 / 0,25 no "wet look") | 0,25 | brilho leve em faixa ao longo da perna |
| Linho | 0,85 | 0,10 / 0,6 / — | — | — | seco; fio irregular e amassado |
| Veludo cotelê | 0,90 | 0,90 / 0,5 / cor clara | — | 0,2 (ao longo da canaleta) | cor base escurecida ×0,7; o sheen devolve a cor |
| Veludo liso | 1,00 | 1,00 / 0,3 / cor clara | — | — | cor base ×0,6; quase só sheen |
| Couro (napa de calça / saia) | 0,45 | — | 0,20 / 0,30 | — | especular nítido; sem trama |
| Couro sintético (PU) | 0,35 | — | 0,40 / 0,20 | — | mais uniforme e mais brilhante que o couro |
| Vinil / verniz | 0,15 | — | 1,00 / 0,05 | — | reflexo de espelho; depende do ambiente |
| Camurça / suede | 1,00 | 0,80 / 0,6 / cor clara | — | — | como veludo curto |
| Cetim | 0,30 | 0,20 / 0,25 / branco | — | 0,55 (no sentido do urdume) | faixa de brilho que corre pela dobra |
| Tule | 0,60 | 0,20 / 0,4 / — | — | — | alfa 0,25–0,4; várias camadas |
| Plissado (chiffon / poliéster) | 0,50 | 0,15 / 0,4 / — | — | 0,2 | a prega é o relevo; leve translucidez |
| Nylon / tactel (short) | 0,55 | 0,15 / 0,3 / branco | — (0,15 / 0,3 no nylon resinado) | 0,1 | liso; o amassado é que aparece |

**2b. Relevo e mapas**

| Material | Estrutura e período (mm) | Profundidade (mm) | Mapas que importam |
|---|---|---|---|
| Denim cru | sarja 3×1, diagonal a ~1,0–1,2 (R); hoje 0,59 | 0,15–0,25 | albedo (fio índigo + ponto de trama branca), normal |
| Denim lavado | a mesma, mais gasta | 0,10–0,20 | **albedo por região**, normal, rugosidade (desgaste mais fosco) |
| Denim preto | a mesma | 0,15–0,25 | albedo com trama cinza, normal |
| Denim com elastano | diagonal a ~0,7–0,9 | 0,08–0,12 | albedo, normal fraco |
| Sarja de chino | sarja 2×1 ou 3×1 a ~0,5–0,7; hoje 0,51 | 0,05–0,10 | normal fraco; albedo quase liso |
| Ripstop | tela fina (~0,3) + grade de fio grosso a cada 5–8 (R) | 0,10 na grade | normal da grade; albedo com a grade um tom acima |
| Lona | tela a ~0,8–1,0 | 0,20 | normal forte, albedo com variação de fio |
| Lã fria | tela ou sarja a ~0,3–0,4 | < 0,05 | quase nenhum; o vinco é geometria (já existe) |
| Crepe | grão irregular, 0,2–0,4, sem direção | 0,05 | normal de ruído fino |
| Gabardine | sarja íngreme (~63°) a ~0,4–0,5 | 0,05 | normal fraco e direcional |
| Moletom | ponto de meia, coluna a ~0,8–1,2 (hoje 1,67) | 0,15 | normal, albedo **mescla** (fibras claras e escuras) |
| Poliamida de legging | malha fina, coluna a ~0,5 (hoje 1,47) | 0,03 | normal quase plano; albedo que clareia onde estica |
| Linho | tela a ~0,5–0,7 com fios grossos ("slub") de 5–30 de comprimento | 0,10–0,15 | albedo fio a fio (±8 %), normal, amassado de baixa frequência |
| Cotelê | canaletas a ~1,8–2,3 (11–14 por polegada, R); fino ~1,2–1,6; largo ~3,2 | 0,5–1,0 | normal, AO/albedo escuro no fundo da canaleta |
| Veludo liso | sem estrutura visível | — | nenhum (é o sheen); ruído de "pelo deitado" em baixa frequência |
| Couro | grão em células de 0,3–0,8 | 0,03–0,06 | normal do grão, **rugosidade** (vinco e uso mais lisos) |
| Couro sintético | grão regular de 0,3–0,5 | 0,02–0,04 | normal; rugosidade uniforme |
| Camurça | fibra curta, sem estrutura | — | ruído de albedo em manchas de 5–20 |
| Cetim | flutuações de fio a ~0,1–0,2 (abaixo da textura) | ~0 | nenhum: normal plano; tangente/UV coerente para a anisotropia |
| Tule | malha hexagonal a ~1,0–1,5 | — | **alfa** (furo da malha) |
| Plissado | pregas a 3–10 | 1–3 | geometria (pregas faca já existem) ou normal em dente de serra |
| Nylon / tactel | tela a ~0,15–0,2 (abaixo da textura) | ~0 | normal de amassado (rugas de 5–15), não de trama |

Três leituras da tabela:

- **O que mais separa os materiais é a combinação rugosidade + sheen + coat + anisotropia**, não o normal map. São
  quatro a seis números por material no BSDF, sem textura nova.
- O relevo só precisa ser fiel onde é **maior que ~1 mm**: canaleta do cotelê, grade do ripstop, ponto do moletom,
  grão do couro em close, pregas. Trama de cetim, tactel e lã fria é invisível: normal plano é o correto.
- Albedo estruturado importa em quatro casos: denim (trama e lavagem), moletom mescla, linho e cotelê.

Ressalva de exportação: o sheen do Blender 4.x (microfibra) não é o Charlie do glTF; o exportador grava peso × tinta em
`sheenColorFactor` e a rugosidade em `sheenRoughnessFactor`, e o three.js (`MeshPhysicalMaterial`, three 0.187 no
projeto) desenha com Charlie. A prévia do Cycles e o provador não ficam idênticos: calibrar no provador. Falta
confirmar num teste que o exportador do 4.2 grava `KHR_materials_anisotropy` e que o provador mantém o material do
.glb em vez de trocá-lo pelo próprio; a anisotropia exige ainda exportar tangentes (`export_tangents`, hoje desligado).

### 7.3 O que é específico do jeans além do BSDF

| Elemento | Motor hoje | Falta |
|---|---|---|
| Pesponto contrastante | **tem**: linha `#c58a3b` automática no denim (`fabric_materials`), `cor_linha` na ficha; pesponto duplo na pala e no bolso de trás, J da braguilha, arcos do bolso, travetas | linha mais grossa do jeans (hoje 0,8 mm para tudo); costura rebatida dupla na entreperna/lateral |
| Cinco bolsos, pala em V, bolsinho de moeda, passantes | **tem** (`jeans_extras`, `back_patch`, `belt_loops`) | — |
| Rebites | **tem**, nas pontas da boca do bolso da frente: caixa de 6 × 6 × 2,2 mm no material `dentes` | forma redonda; cor de cobre própria (usa `cor_ziper`, prata `#a7a9ac` por padrão, e herda o normal map dos dentes do zíper); rebite no bolsinho de moeda |
| Botão de metal do cós | **tem**: cilindro de 12 lados, 17 mm, material `dentes` (metal 0,85, rugosidade 0,35) | cor própria (`cor_ferragem`), relevo do botão (aro e centro) |
| Etiqueta de couro no cós | **não tem** | retalho de ~6 × 4,5 cm nas costas do cós, à direita, material `couro` (receita da §2), pesponto em volta; `patch()` já faz a peça |
| Lavagem (bigodes, coxa e joelho claros, costura escura, barra gasta) | **não tem**: o albedo é uma repetição de 5 cm igual na peça inteira | mapa por região — ver abaixo |
| Avesso claro (barra dobrada mostra a trama branca) | **não tem**: a dobra da barra usa `corpo` | material `corpo_avesso` (mesma textura com a proporção de fio invertida) |
| Rasgos / destroyed | **não tem** | alfa + fios soltos; fora do alcance imediato |

Detalhe de regra: os extras de jeans só saem quando `tecido.tipo == "denim"` **e** a subcategoria é `jeans`,
`denim_shorts` ou `culottes` (`pants_finish.finish`). Uma calça jeans cadastrada como `casual_pants` (206 produtos do
catálogo, §4) ou uma bermuda jeans (30) recebe textura de denim e linha dourada, mas não a pala, o bolsinho nem os
rebites. A regra deveria olhar só o tecido.

**Lavagem: por que o motor não consegue hoje e as duas saídas.** O UV (`TEXCOORD_0`) é métrico e repetido (5 cm por
volta da textura): não existe "a coxa" na textura. As opções:

1. **Cor por vértice** (mais barata): o motor conhece a posição de cada vértice em (theta, y) e pode gravar um fator
   de desgaste 0–1 calculado por fórmula — claro na frente da coxa e no joelho, atrás no assento, escuro junto às
   costuras e ao cós, claro na aresta da barra e na borda dos bolsos. O material multiplica/mistura o albedo por esse
   fator. Limites: a resolução é a da malha (bigodes finos de 3–5 mm não saem; degradês de coxa e joelho saem bem) e o
   `COLOR_0` já está ocupado pelo rótulo de parte no canal R (`PART_CODE`); os canais G e B estão livres (hoje 1,0),
   mas o provador precisa passar a lê-los como desgaste em vez de cor — ou usa-se um segundo atributo.
2. **UV por regiões** (`TEXCOORD_1`, já previsto na §4 do estudo-base para os decalques): um atlas com perna d/e,
   frente e costas em retângulos fixos e uma textura de lavagem em tons de cinza (512–1024 px) gerada em numpy por
   posição: bigodes como arcos a partir do gancho, "favo" atrás do joelho, desgaste do assento, linhas escuras nas
   costuras. Resolve os bigodes e serve também aos decalques; custo: o segundo canal de UV e um nó de mistura a mais.

Recomendação: (1) primeiro, porque dá 80 % do efeito de "jeans lavado" sem mexer no contrato do GLB; (2) quando o
atlas de regiões for feito para os decalques.

No catálogo, das 878 peças `jeans`: 147 descrições citam cinco bolsos, 147 zíper, 137 botão, 46 bigode/desgaste/fade,
32 etiqueta ou patch, 18 rebites, 7 pesponto; "couro" aparece em 13, quase sempre a etiqueta do cós.

### 7.4 Subcategoria → material padrão e palavras do catálogo

Contagem em nome + descrição (sem acento, minúsculas; um produto conta uma vez por palavra; sinônimos em inglês e
português agrupados: denim/jeans, sarja/twill, linho/linen, couro/leather, moletom/fleece/terry, poliamida/nylon,
cetim/satin/seda, stretch/elastano/spandex/lycra, lavado/wash/stone/destroyed/faded, alfaiataria/tailored/suiting). São
menções, não composição: cerca de 12 % dos produtos não têm descrição, e palavras como "alfaiataria" às vezes descrevem
o corte, não o tecido.

| Subcategoria | n | Palavras de tecido mais frequentes (produtos) |
|---|---|---|
| `jeans` | 878 | denim 874 · stretch 290 · algodão 219 · lavado 177 · cru/rigid/selvedge 37 · preto (no nome) 19 · poliéster 15 · viscose 13 |
| `casual_pants` | 1 259 | **denim 237** (206 no nome) · stretch 218 · algodão 171 · lavado 162 · malha 116 · sarja 108 · alfaiataria 106 · moletom 71 · lã 64 · poliéster 48 · plissado 42 · viscose 40 · poliamida 37 · cetim 35 · couro 33 · linho 33 · cargo 31 · crepe 20 · paetê 12 · cotelê 4 · veludo 2 |
| `chino_pants` | 191 | stretch 130 · algodão 85 · sarja/twill 71 · alfaiataria 70 · lavado 23 · denim 14 · cetim 11 |
| `cargo_pants` | 63 | algodão 16 · stretch 12 · **ripstop 11** · sarja 8 · lona 4 · lã 4 · lavado 4 · moletom 3 · denim 2 · poliamida 1 |
| `jogger_pants` | 82 | algodão 36 · stretch 20 · moletom 16 · poliéster 9 · poliamida 8 · viscose 7 |
| `sweatpants` | 31 | moletom 20 · algodão 20 · lavado 4 |
| `leggings` | 173 | stretch 52 · malha 31 · **poliamida 31** · algodão 10 · poliéster 2 |
| `tailored_pants` | 6 | alfaiataria 6 · crepe 2 |
| `culottes` | 0 | (nenhum produto no catálogo) |
| `shorts` | 758 | algodão 105 · stretch 105 · poliamida 56 · malha 42 · sarja 41 · alfaiataria 38 · lavado 37 · poliéster 36 · cetim 32 · viscose 28 · linho 27 · crepe 24 · moletom 24 · lã 20 · renda 20 · denim 18 · tule/chiffon 11 · couro 10 · ripstop 6 · tactel 2 |
| `bermuda_shorts` | 371 | algodão 87 · chino 81 · stretch 61 · sarja 36 · denim 31 · alfaiataria 28 · cargo 22 · poliéster 22 · lavado 21 · poliamida 20 · moletom 20 · linho 11 |
| `denim_shorts` | 23 | denim 23 · stretch 8 · algodão 6 · lavado 3 |
| `skirt` | 514 | alfaiataria 39 · **cetim 36** · malha 32 · stretch 29 · **couro 24** · plissado 23 · algodão 19 · crepe 16 · poliamida 16 · paetê 14 · viscose 13 · lã 13 · sarja 13 · tule/chiffon 11 · linho 10 · denim 8 · renda 7 · veludo 4 |
| `skort` | 38 | alfaiataria 7 · stretch 5 · poliéster 4 · malha 4 · sarja 2 · plissado 2 |

O que os números dizem:

- **Jeans é o maior grupo com material próprio**: 874 em `jeans`, mais 237 em `casual_pants`, 31 em bermuda, 23 em
  `denim_shorts`, 18 em short e 8 em saia — cerca de 1 190 peças de baixo (27 %). Um terço do `jeans` cita elastano e
  um quinto cita lavagem; "cru/rígido" é raro (37).
- Sarja/chino é o segundo (chino 191, bermuda chino 81, sarja em casual 108).
- Couro pesa em saia (24) e em `casual_pants` (33); cetim em saia (36), casual (35) e short (32).
- Ripstop: 21 no total (11 em cargo); cotelê 10; veludo 9; **tactel 4** — a palavra quase não aparece: o short de
  praia e esportivo vem como "poliamida/nylon" (56) ou "poliéster" (36).
- `casual_pants` e `shorts` são baldes: o padrão da subcategoria acerta pouco e a palavra do produto precisa decidir.

Mapa proposto (padrão da subcategoria e palavras que o trocam; a primeira palavra encontrada no nome vale mais que a
da descrição):

| Subcategoria | Material padrão | Palavras que mudam o material |
|---|---|---|
| `jeans`, `denim_shorts` | denim lavado (azul médio) | raw/rigid/selvedge/cru → denim cru · black/preto → denim preto · stretch/elastano/skinny → denim com elastano · wash/stone/destroyed/delavê → intensidade da lavagem |
| `chino_pants` | sarja de chino | linho → linho · cetim/sateen → sarja acetinada (rugosidade 0,6) · alfaiataria → gabardine |
| `cargo_pants` | sarja pesada / lona | ripstop → ripstop · nylon/poliamida → ripstop de nylon · moletom/fleece → moletom · denim/jeans → denim |
| `casual_pants` | sarja de chino | jeans/denim → denim (e os extras de jeans) · alfaiataria/tailored → lã fria · crepe → crepe · moletom/fleece → moletom · linho → linho · couro/leather → couro · cetim/satin → cetim · cotelê/corduroy → cotelê · veludo → veludo · malha/knit/jersey → malha |
| `tailored_pants`, `culottes` | lã fria | crepe → crepe · gabardine → gabardine · linho → linho · jeans → denim · cetim → cetim |
| `jogger_pants` | moletom | nylon/poliamida/poliéster → nylon/tactel · sarja/twill → sarja · viscose → crepe leve |
| `sweatpants` | moletom (mescla se a cor for cinza) | — |
| `leggings` | malha de poliamida | algodão/cotton → jersey de algodão (fosco) · couro/leather/wet/shine → coat da variante "wet look" |
| `shorts` | sarja de chino | poliamida/nylon/tactel/poliéster/swim → nylon/tactel · moletom/terry → moletom · linho → linho · alfaiataria/crepe → crepe · cetim → cetim · jeans → denim · couro → couro |
| `bermuda_shorts` | sarja de chino | jeans/denim → denim · cargo/ripstop → sarja pesada / ripstop · linho → linho · moletom → moletom · nylon/poliamida → tactel |
| `skirt` | crepe | cetim/satin/seda → cetim · couro/leather → couro · plissado/pleated → plissado · tule/chiffon/georgette → tule · jeans → denim · malha/knit → malha · veludo → veludo · linho → linho · paetê/sequin → fora desta lista (precisa de material próprio) |
| `skort` | malha de poliamida | alfaiataria → crepe · sarja/twill → sarja · jeans → denim |

### 7.5 O que as texturas procedurais de `fabric.py` conseguem gerar

Os limites vêm de três fatos do desenho atual: repetição de 5 cm (`TILE`), 512 px (0,1 mm por pixel, logo nada menor
que ~0,2 mm) e a exigência de fechar na borda (contagem inteira por repetição). Só numpy e Pillow (não há scipy no
ambiente).

| Efeito | Dá em numpy? | Como | Limite |
|---|---|---|---|
| Diagonal do denim com fio branco | **sim, melhor que hoje** | trocar o seno por matriz de ligamento 3×1: cada célula é urdume (índigo) ou trama (branca), 75 % / 25 % na face; ~44 diagonais por repetição (passo de 1,1 mm); ruído 1D esticado no sentido do urdume para o fio irregular ("slub") | slub mais longo que 5 cm repete; hoje a face sai 50/50 e fina demais (0,59 mm) |
| Denim preto / com elastano | sim | mesma função: trama cinza em vez de branca; relevo ×0,5 e passo menor | — |
| Avesso do denim | sim | mesma matriz com a proporção invertida | precisa de material separado na dobra |
| Sarja de chino, gabardine | sim (já existe) | parâmetros: passo, ângulo (45° ou 63°), força | ângulo de 63° só fecha na borda com contagens inteiras nos dois eixos (ex.: 2:1) |
| Grade do ripstop | **sim** | tela fina de fundo + linhas mais altas e mais claras a cada 1/8 ou 1/10 da repetição (6,25 ou 5 mm), nos dois sentidos | o passo tem de dividir 50 mm |
| Lona | sim | a tela de `WEAVES` com ~55 fios e força maior | — |
| Canaletas do cotelê | **sim** | perfil arredondado em função só de x, 22–28 canaletas por repetição (2,3–1,8 mm); albedo escurecido no fundo; ruído de pelo | a canaleta precisa correr na vertical da perna: depende da orientação do UV (u em volta, v para cima — é o caso) |
| Ponto do moletom e mescla | sim | `_stitch` já existe; mescla = ruído de fibras alongadas claro/escuro no albedo | felpa de verdade (pelo saindo da silhueta) não: só o sheen imita |
| Linho | sim | tela + espessura de fio variando por linha e por coluna (ruído 1D) + variação de cor fio a fio | amassado grande (> 5 cm) não cabe na repetição |
| Grão do couro | **sim** | células de Worley/Voronoi com pontos repetidos nas 9 vizinhanças para fechar na borda (força bruta em numpy, ~1 s) ou ruído em duas escalas com limiar | poro e ruga de uso por região, não |
| Mapa de rugosidade | **sim** | terceiro JPEG em tons de cinza derivado do relevo (vale mais fosco, crista mais lisa; no couro, o inverso nas rugas); ligar ao `Roughness` do BSDF — o exportador empacota no canal G da textura metal-rugosidade do glTF | + ~100–200 kB por material; `_material` e `_save` ganham um mapa |
| Amassado do nylon / tactel | parcial | normal de ruído em baixa frequência (4–8 células por repetição) | repete a cada 5 cm, visível em área lisa grande; melhor um segundo UV com escala maior |
| Cetim, lã fria, veludo liso | não precisa | normal plano; o efeito é do BSDF (anisotropia, sheen) | anisotropia pede tangentes exportadas |
| Tule | parcial | alfa em PNG com a malha hexagonal | PNG pesa mais; ordenação de transparência no provador; uma camada só fica rala |
| Plissado | parcial | normal em dente de serra para microprega (3–5 mm); pregas maiores já são geometria (`pregas`) | sem a sombra própria da prega funda |
| Lavagem do jeans (bigodes, coxa, joelho) | **não** na textura repetida | precisa de cor por vértice ou do UV por regiões (§3) | — |
| Costura franzida ("roping") na barra, desgaste ao longo das costuras | **não** | a textura não sabe onde está a costura; cor por vértice resolve o desgaste, não o franzido | — |
| Rasgos, fios soltos, pelo de verdade | **não** | exigem alfa por região ou geometria de fibra | fora do alcance |

Mudanças de código implicadas (nenhuma feita; todas cabem no limite de 250 linhas se `fabric.py`, hoje com 108, ganhar
um módulo irmão por família — por exemplo `fabric_weaves.py` para ligamentos e `fabric_surfaces.py` para couro e
cotelê — e a tabela de receitas for um módulo de dados separado de `blender_io.py`, hoje com 206):

1. `spec.FABRICS`: acrescentar os materiais novos (`ripstop`, `lona`, `la_fria`, `crepe`, `gabardine`, `linho`,
   `cotele`, `veludo`, `couro`, `couro_sintetico`, `cetim`, `poliamida`, `tactel`, `tule`) e um campo de acabamento do
   denim (`lavagem`: cru, média, clara, preta).
2. `blender_io._material`: receber a receita inteira (rugosidade, sheen, coat, anisotropia, mapa de rugosidade) em vez
   de um número; hoje é o dicionário de três entradas em `fabric_materials`.
3. `fabric.py`: ligamento 3×1 do denim, ripstop, cotelê, grão de couro, mescla e mapa de rugosidade.
4. Jeans: regra pelos tecido e não pela subcategoria; etiqueta de couro; cor própria da ferragem; fator de desgaste
   por vértice.
5. Registrar a decisão e o tempo medido em `docs/fai-reconstruction-engine/piloto-e-decisoes.md` quando for
   implementado; nada aqui usa GPU, modelo externo ou API paga.
