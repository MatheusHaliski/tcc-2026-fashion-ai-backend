# Pipeline de vestimentas 3D — auditoria, contrato de dados e estado real (10/10/2026)

Este documento registra o que o provador 3D do FashionAI faz hoje para vestir uma peça no avatar, o que foi
corrigido nesta rodada, o contrato de dados que passa a acompanhar cada peça vestida e o que ainda depende de
trabalho futuro. Ele não descreve um sistema que não existe: onde o código é uma aproximação, está escrito
"aproximação".

## 1. Diagnóstico (antes)

Rastreio da peça cadastrada até o manequim (código em `lib/avatar3d/human/*`, `components/three/*`):

| Etapa | Onde | Como funciona |
|---|---|---|
| Entrada | `Look3dPiece` (`components/three/common.tsx`) | id, slot, categoria, subcategoria, `imageUrl`, `studioUrl`, `colorHex`, `model3dUrl` |
| Classificação | `kindOf` (`garments.ts`) | palavras da subcategoria → 17 tipos de molde; sem palavra conhecida, a categoria/lugar no look |
| Geometria | `garmentGeometry` | copia os triângulos da pele cobertos pela peça e empurra pela normal (folga do tipo); anel de busto, casco do peito, tubo de saia; pesos copiados da pele |
| Caimento | `garment-relax.ts`, `garment-trims.ts`, `collarBand` | relaxamento, dobras, barra/punho com espessura, gola 3D |
| Material | `texturedGeometry`, `garmentTexture`, `fabricColor` | foto projetada nas faces da frente; costas, laterais e mangas na cor mediana da foto |
| Calçado | `shoes.ts` | fôrma por estilo, sola, cadarço; cores da foto |
| Avatar | `three-human.ts`, `human-avatar.tsx` | corpo MakeHuman/MPFB2 (`public/avatar3d/body/fai-body-v1`), 52 ossos, material da pele próprio |

Constatações verificadas no código:

- **Não existe asset 3D de roupa no repositório** (nenhum `.glb/.gltf/.fbx` de peça). Toda roupa é um molde
  procedural nascido da pele do avatar. O `model3dUrl` (RF16, relevo inflado da foto) só é lido pelo manequim-cápsula
  de fallback; o avatar humano do Espelho, do provador e do quarto nunca o usa.
- **Sintoma "camiseta carimbada no peito, resto na cor da camiseta"**: `photoInfo` achava a caixa da peça pelo
  **alfa** da imagem. Com JPEG opaco — foto de estúdio com fundo colorido (`studioUrl`, que o provador preferia),
  `card.jpg` do catálogo, ou foto cuja remoção de fundo falhou — a caixa virava o quadro inteiro; a largura do quadro
  era casada com a largura do tronco, a camiseta encolhia para um "carimbo" no meio do peito, e `fabricColor`
  (mediana do centro do quadro) devolvia a cor do **fundo**, pintada nas costas, laterais e mangas.
- **A pele não é tingida pela roupa**: `skinMaterial()` cria um material por avatar; nenhum código de roupa toca
  nele (`traverse`/`color.set` só em `human-avatar.tsx`, para o tom de pele e o rosto). O que parecia "tingir o
  avatar" era o fundo da foto pintado como tecido ao redor do carimbo.
- **`crossbody_bag` virava regata**: a palavra `body` casava com `bodysuit`; uma bolsa seria vestida como top.
- **Precedência errada**: com subcategoria desconhecida, o lugar no look (`slot`) decidia antes da categoria
  gravada (`category`) — uma calça marcada no lugar errado virava camiseta.
- Comparações de cor (`trimColors`, `ribColor`) usavam `THREE.Color.r*255`, que é **linear** (de `#dc1e1e` saía
  183, não 220): a detecção "acabamento igual ao tecido" errava por dezenas de unidades.
- Acessórios (23 subcategorias) não são vestidos pelo avatar humano (só o manequim-cápsula os mostra como planos).
- Não há plano Unreal/MetaHuman no repositório: as únicas menções são tabelas comparativas
  (`docs/avatar3d/investigacao-pipeline-avatar.md`, `servicos-externos-avatar-provador.md`). O GLB exportado do
  avatar abre em Blender, Unity e Unreal; nada do provador depende de uma migração.

## 2. O que mudou nesta rodada (depois)

Arquivos: `lib/avatar3d/human/garments.ts`, `components/three/human-outfit.tsx`, `lib/avatar3d/garment-contract.ts`
(+ testes `lib/avatar3d/human/photo-mask.test.ts`, `lib/avatar3d/garment-contract.test.ts`,
`components/three/skin-isolation.test.tsx`).

- **Máscara da peça na foto** (`photoMask`): PNG recortado → alfa; foto opaca → tudo que difere do fundo medido na
  borda (tolerância RGB 32). A caixa, a largura por altura, a gola, a cor do tecido, a textura (fundo pintado da cor
  do tecido), os acabamentos e as cores do calçado usam a mesma máscara. Sem fundo separável, vale o quadro inteiro,
  como antes.
- **Foto recortada antes da foto de estúdio** no avatar humano (`imageUrl ?? studioUrl`): o alfa é a caixa exata.
- **Cores em sRGB** (`srgbBytes`) nas comparações de tecido × acabamento.
- **Classificação**: bolsas/mochilas são acessórios; categoria do cadastro decide antes do lugar no look (a camada
  externa do look continua jaqueta, por ser informação de camada).
- **Contrato de dados** por peça vestida (`garmentContractOf`), exposto em `root.userData.garmentContracts`.
- **Teste de isolamento**: vermelho → branco → preto → estampado → remover roupa: a pele é a mesma instância, com a
  mesma cor e sem mapa; cada peça tem material próprio; os materiais da troca anterior são descartados; o corpo não
  é reconstruído ao trocar a peça.

O que **não** mudou (continua aproximação): a roupa continua um molde procedural com a foto só na frente; costas e
laterais na cor do tecido; sem simulação de tecido; mangas sem foto; acessórios fora do avatar humano.

## 3. Contrato de dados da vestimenta (`lib/avatar3d/garment-contract.ts`, versão 1.0.0)

Cada informação leva a origem: `CONFIRMED` (cadastro, catálogo, revisão da pessoa), `ESTIMATED` (inferida, com
fonte e confiança) ou `MISSING` (precisa de referência). Nada é inventado: medidas, composição e asset próprio ficam
`MISSING` até existirem.

| Grupo | Campos | Hoje |
|---|---|---|
| Identidade | pieceId, catalogProductId, variantId, category, subcategory, family | categoria/subcategoria do cadastro (CONFIRMED) |
| Corte | kind, length, sleeve, neckline, opening, silhouette | kind CONFIRMED pela subcategoria ou ESTIMATED pela categoria; demais ESTIMATED do molde (`SPECS`) |
| Dimensões | measurementsCm, commercialSize, referenceBody | medidas MISSING; tamanho do cadastro quando passado; corpo de referência `fai-body-v1` |
| Superfície | color, print, photo, uv, maps | cor do cadastro (CONFIRMED) ou mediana da foto (ESTIMATED); uv `FRONT_PROJECTION`; só mapa de cor |
| Tecido | material, physicalThicknessMm, visualThicknessMm, collisionMarginMm, behaviour | material do cadastro quando passado; **espessura física MISSING** (não há simulação); **espessura visual** = folga do molde (mm); **margem de colisão** = 2 mm (teste de penetração) |
| Ajuste | easeM, anchors, bodyCompatibility | folga do tipo; preso ao esqueleto com os pesos da pele |
| Asset | path, renderMesh, simulationMesh, rig, lods, assetVersion, mouldVersion | `PARAMETRIC_MOULD` (molde `fai-mould-skinwrap-v1`) ou `IMAGE_2D` (acessórios); `APPROVED_ASSET` reservado |
| Qualidade | origin, approximation, reviewed, confidence, tests, approved, notes | `approximation: true` para todo molde; `approved: false` (não há gate de aprovação por peça) |

Espessura física (simulação), espessura visual (malha) e margem de colisão são três campos distintos.

## 4. Pipeline modular e estados

Etapas e onde cada uma vive hoje; "—" = ainda não existe como etapa separada:

| Etapa | Entrada → saída | Hoje |
|---|---|---|
| validar dados | `Look3dPiece` → contrato com origens | `garmentContractOf` |
| classificar | categoria + subcategoria → família/molde | `kindOf` + `FAMILY` |
| selecionar asset ou molde | contrato → `APPROVED_ASSET` / `PARAMETRIC_MOULD` / `IMAGE_2D` | só molde ou 2D |
| parametrizar geometria | corpo + molde → malha presa ao esqueleto | `garmentGeometry`, relax, trims, gola |
| aplicar materiais | foto + cor → textura/material próprio | `photoMask`, `garmentTexture`, `garmentMaterial` |
| ajustar ao corpo | camadas, folga, braço aberto | `underLayer`, `armOutFor` |
| configurar movimento | — | só a pose parada (idle); sem simulação |
| validar | penetração ≤ 2 mm, 4 pesos somando 1 | testes de unidade; sem gate por peça |
| publicar versão aprovada | — | não existe versão por peça; o molde é refeito a cada montagem |

Estados para a interface (preparando, ajustando, aguardando revisão, concluído, falhou): hoje o `HumanOutfit`
expõe `root.userData.dressed` (concluído/falhou) e `outfitReady` (fotos carregadas). Os estados intermediários
dependem de um pipeline assíncrono por peça, que não existe (ver §8).

## 5. Estratégias por família — o que cada uma controla

`FAMILY_PARAMETERS` em `garment-contract.ts`. Inventário das subcategorias reais da taxonomia (teste
`garment-contract.test.ts` percorre todas): parte de cima 19 → TOPS/OUTERWEAR; parte de baixo 14 → BOTTOMS/SKIRTS
(as 7 calças usam o mesmo molde `pants`); corpo inteiro 5 → FULL_BODY; calçados 19 → SHOES; acessórios 23 →
`IMAGE_2D` (estado explícito: sem molde).

| Família | Ajustes exigidos | Suportado hoje | Não suportado |
|---|---|---|---|
| Camisetas, camisas, regatas | ombros, mangas, gola, busto, barra, folga | todos, de forma paramétrica por tipo | comprimento real da peça (vem do tipo, não da medida) |
| Calças e shorts | cós, quadril, entrepernas, pernas, abertura, comprimento | cós, quadril, pernas, comprimento por tipo | abertura (zíper/botão), modelagem (skinny × wide) |
| Saias | cintura, volume, abertura, comprimento, barra | cintura, volume (flare), comprimento | barra em movimento (sem simulação) |
| Vestidos e macacões | continuidade, proporções, cobertura | continuidade e cobertura | proporções da peça real |
| Jaquetas e casacos | estrutura, espessura, fechamento, sobreposição | camada/folga, sobreposição | fechamento (botões/zíper), lapela 3D |
| Calçados | forma, tamanho, orientação, chão, material | fôrma por estilo, sola, chão, cores | tamanho real, material próprio |
| Acessórios | fixação, escala, rigidez, movimento | — (só prévia 2D) | tudo |

## 6. Materiais, textura e cor — regras em vigor

- Pele e roupa têm materiais separados; a roupa nunca escreve no material da pele (teste de isolamento).
- Cada peça cria os próprios materiais (`garmentMaterial`, acabamentos, gola, partes do calçado) e os descarta ao
  sair; nada é reaproveitado entre peças.
- Recolorir usa a textura própria da peça: foto por cima da cor do tecido; o fundo da foto opaca é pintado da cor do
  tecido; o canto 3×3 liso alimenta costas e laterais.
- Preservação de estampa/logo ao recolorir regiões por máscara: **não existe** (não há recoloração por região; a
  cor vem da foto ou do cadastro).
- UVs: projeção frontal da foto (pela caixa da peça); mapas normal/rugosidade: não há; tecidos foscos × brilhantes:
  só rugosidade por tipo (jaqueta/casaco 0.7, demais 0.85) e sheen fixo.

## 7. Manutenção e rastreabilidade

- Versões no contrato: `GARMENT_CONTRACT_VERSION`, `MOULD_VERSION` (`fai-mould-skinwrap-v1`), `BODY_RIG`
  (`fai-body-v1`). Mudar molde ou corpo = revalidar todas as combinações (hoje: rodar a suíte 3D).
- Não há versão persistida por peça vestida nem reprocessamento por etapa: o molde é refeito a cada montagem, em
  memória. Diagnóstico técnico por peça: `root.userData.garmentContracts` + `garments` (nomes das malhas).

## 8. Limitações e o que fica para depois

- Molde ≠ asset fiel: nenhuma peça é "reprodução fiel"; o contrato declara `approximation: true`.
- Sem moldes de painéis costurados, sem simulação (XPBD/SDF), sem LODs de roupa, sem acessórios no avatar humano.
  O plano em `docs/avatar3d/auditoria-roupas-3d/README.md` (moldes paramétricos por família + ajuste com colisões +
  gate de qualidade) continua sendo o caminho; é trabalho de várias semanas, fora desta rodada.
- Migração Unreal: não planejada no repositório; nada aqui depende dela.
- Validação visual (frontal/lateral/traseira, wireframe, vídeos) exige GPU; nesta sessão só rodou a suíte em memória
  (React Three test renderer): corpo + roupa montam para 10 looks × 2 sexos, penetração ≤ 2 mm e isolamento da pele.

## 9. Testes executados

```bash
npx vitest run lib/avatar3d/human/photo-mask.test.ts lib/avatar3d/garment-contract.test.ts \
  components/three/skin-isolation.test.tsx lib/avatar3d/human/garments.test.ts components/three/human-avatar.test.tsx
```
