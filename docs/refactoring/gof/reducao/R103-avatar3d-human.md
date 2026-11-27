# Lote R103-avatar3d-human — `lib/avatar3d/human/` (roupa, foto da peça, cabelo, humano 3D, olhos)

Base: `claude/relaxed-pasteur-5b5466` (`05c0189`). Objetivo: levar os oito módulos congelados do pacote
`lib/avatar3d/human/` (lib-ts, limite 250) e o teste congelado `garments.test.ts` (teste, limite 400) para dentro do
limite, por extração de responsabilidades, sem mudar nenhum número, nome exportado ou consumidor.

## Resultado por arquivo

| Arquivo | Antes | Depois | Arquivos novos (linhas) | Padrão GoF |
|---|---:|---:|---|---|
| `garments.ts` | 1205 | 17 | `garment-spec.ts` (180), `garment-body.ts` (126), `garment-size-relief.ts` (77), `garment-under-layer.ts` (52), `garment-geometry.ts` (153), `garment-photo-info.ts` (129), `garment-uv.ts` (204), `garment-texture.ts` (97), `garment-colors.ts` (111), `garment-material.ts` (46), `garment-collar.ts` (102) | NENHUM |
| `hair-strands.ts` | 714 | 82 | `strand-math.ts` (17), `strand-shell.ts` (120), `strand-context.ts` (62), `strand-groom.ts` (146), `strand-fringe.ts` (80), `strand-ribbons.ts` (143), `strand-shading.ts` (122) | NENHUM |
| `garment-photo.ts` | 428 | 105 | `fabric-sample.ts` (160), `garment-photo-cleanup.ts` (177) | NENHUM |
| `hair-geometry.ts` | 408 | 233 | `hair-math.ts` (8), `hair-scalp.ts` (87), `hair-material.ts` (72), `hair-buzz.ts` (35) | NENHUM |
| `three-human.ts` | 333 | 188 | `eye-opening.ts` (118), `skin-material.ts` (43) | NENHUM |
| `eyes.ts` | 259 | 181 | `eye-texture.ts` (85) | NENHUM |
| `garment-fit.ts` | 257 | 200 | `garment-dimensions.ts` (66) | NENHUM |
| `garment-trims.ts` | 257 | 180 | `garment-trim-band.ts` (16), `garment-hood.ts` (77) | NENHUM |
| `garments.test.ts` (teste) | 475 | 166 | `garments-collar.test.ts` (86), `garments-cargo-photo.test.ts` (78), `garments-size-sleeve.test.ts` (124), `test-utils/garments-kit.ts` (46) | — |

Testes de caracterização novos (categoria teste ≤ 400): `garments.snapshot.test.ts` (140), `garment-photo.snapshot.test.ts`
(117), `hair.snapshot.test.ts` (89), `three-human.snapshot.test.ts` (91), com `test-utils/snapshot-hash.ts` (38) e os
retratos em `__snapshots__/`.

## Como foi dividido

O código foi **movido por faixas de linhas, por script** (sem reescrita manual): mesmo nome, assinatura e corpo. As únicas
mudanças em linhas movidas são o prefixo `export ` onde outro módulo passou a usar o nome (`smooth`, `lerp`, `ring`,
`hullRing`, `looseFold`, `TUBE_NA`, `skirtTop`, `skirtTube`, `fitEyeOpening`, `first`, `SKIRT_LEN`, `LEG_LEN`,
`SLEEVE_LEN`, `NECKLINE`, `RISE`, `SHAFT`, `SHAFT_SUB`, `weightsNear`, `CANON_*`/`SKULL_TOP`, `scalpRegions`, `finish`,
`buzzShell`, `wobble`, `hash`, os vetores de `strand-math.ts`, `rng`, `Shell`) e as linhas de `import` de cada módulo.
Conferência por script: as 3644 linhas de código dos oito originais (fora `import` e o prefixo `export `) estão todas,
iguais, nos arquivos do lote.

Cada original continua sendo a porta de entrada e **reexporta todos os nomes de antes**; nenhum consumidor
(`components/three/*`, `lib/tryon/*`, `lib/room3d/*`, `components/heist/people/*`, `lib/avatar3d/matriz3d/*`, testes) mudou.

| Arquivo | Responsabilidade |
|---|---|
| `garment-spec.ts` | Tipos de molde, `GarmentSpec`, `SPECS`, `SUBCATEGORY_KINDS`, `kindOf`, `specOf`, `armOutFor`, `sleeveEase`, `legFlareOffset`. |
| `garment-body.ts` | Corpo medido para vestir: `BodyParam`/`bodyParam`, `necklineH`, `frontPanelCoverage`, cobertura por vértice, anéis do tronco, `GarmentGeometry`. |
| `garment-size-relief.ts` | Tamanho × corpo por região: `sizeExtra`, `sizeStepsAt`, `sizeRelief` (pregas, tensão, barra acumulada). |
| `garment-under-layer.ts` | Camadas de dentro: tubos de saia/barra (`skirtTube`, `tubeRadius`) e `underLayer`. |
| `garment-geometry.ts` | O molde vira malha (`garmentGeometry`) e a pose dessa malha (`posedPositions`). |
| `garment-photo-info.ts` | Leitura da foto da peça: máscara, `photoInfo`, fundo (`isBackdrop`, `srgbBytes`), `photoSleeves`. |
| `garment-uv.ts` | Malha final com UV da foto/tecido e peso da foto (`texturedGeometry`). |
| `garment-texture.ts` | Atlas foto + tecido com cache (`garmentTexture`). |
| `garment-colors.ts` | Cores lidas da foto: `shoeColors`, `trimColors`, `fabricColor`, `ribColor`. |
| `garment-material.ts` | `fabricSurface` e `garmentMaterial` (shader de mistura foto × tecido, denim). |
| `garment-collar.ts` | Gola 3D: `HAS_COLLAR_BAND`, `CollarBand`, `collarBand`. |
| `fabric-sample.ts` / `garment-photo-cleanup.ts` | Amostras de tecido (`fabricTile`, `fabricPatch`, `fabricRows`, `medoid`) / limpeza do raster (`cutoutGarment`, `fillInteriorHoles`, `splitByHem`). `garment-photo.ts` fica com o preparo assíncrono da foto (`prepareGarmentPhoto`, `prepareOutfitPhoto`, `canUseOutfitPhoto`). |
| `hair-scalp.ts` / `hair-material.ts` / `hair-buzz.ts` / `hair-math.ts` | Quadro da cabeça, couro cabeludo e linha do cabelo / `HairBuild`, textura de fios e `finish` / cabelo raspado / interpolação e ruídos. `hair-geometry.ts` fica com `buildHair` (calota + cortina + mechas). |
| `strand-*.ts` | Fios: vetores e `rng`; colisão (`Shell`); contexto; penteado + JSON; franja escolhida + tipos de guia; fitas por nível; atlas de fibras + Kajiya-Kay. `hair-strands.ts` fica com `strandGeometry` e `withStrands`. |
| `eye-opening.ts` / `skin-material.ts` | Abertura medida do olho (shader e recorte para o GLB) / material da pele e espalhamento da orelha. `three-human.ts` fica com `buildHuman`, `buildSkeleton`, `baseNormals`. |
| `eye-texture.ts` | Textura do olho em pixels (`EYE_TEX`, `IRIS_CIRCLES`, `uvToTex`), `recolorIris`, `shadeSclera`. |
| `garment-dimensions.ts` | Dimensões da taxonomia: comprimento, manga, decote, rise, cano (tabelas + `sleeveLengthOf`, `necklineOf`, `riseOf`). |
| `garment-trim-band.ts` / `garment-hood.ts` | `TrimBand` e pesos do vértice mais próximo / capuz abaixado (`loweredHood`). |

Sem ciclos em tempo de execução: os módulos auxiliares só importam **tipos** dos originais (`import type`), e os
originais importam os auxiliares. `garments.test.ts` foi dividido por tema (moldes e camadas / gola / cargo e foto /
tamanho e manga), com o asset, `inside` e `dressed` num kit de teste comum; nenhum teste ou asserção foi apagado
(31 testes antes, 31 depois, mesmos nomes completos).

`lib/avatar3d/matriz3d/registry.ts` (rastreabilidade MATRIZ-3D, que procura cada símbolo/título no arquivo citado) teve
25 referências reapontadas para o arquivo que agora define o símbolo ou o teste — só o caminho mudou, mesma contagem de
linhas (555, teto congelado).

## Por que NENHUM

- **Facade**: os originais agora só compõem/reexportam, mas já eram a porta de entrada pública; não surgiu camada nova,
  nem interface simplificada sobre subsistemas — os nomes reexportados são os mesmos de antes. Não se registra padrão.
- **Strategy** (estilos de franja, formas de decote, tipos de peça): são `switch`/ternários de dados sobre um mesmo
  cálculo, com assinaturas diferentes e acoplados ao laço por vértice; virar classes mudaria o custo por vértice e o
  contrato interno sem problema concreto a resolver.
- **Builder** (`garmentGeometry`, `buildHair`, `strandsFromGroom`): montam buffers num único passo, sem variantes de
  montagem nem diretor; o código foi movido sem alterar o corpo.
- **Template Method / Composite**: não há esqueleto com passos variáveis nem árvore recursiva nesses módulos.

## Testes e equivalência

Caracterização capturada no código **original** (commit `26bdbac`, antes da extração): cada cenário vira um retrato
SHA-256 (números arredondados a 6 casas, arrays tipados, `BufferGeometry` = atributos + índice + grupos + userData):

- `garments.snapshot.test.ts`: `kindOf`/`specOf`/`specFor` e leituras da taxonomia em ~80 entradas; `necklineH`,
  `frontPanelCoverage`, `sleeveEase`, `legFlareOffset`, `armOutFor`; material (propriedades + shader) e `fabricSurface`;
  nos dois corpos: `bodyParam`, cobertura e molde de cada um dos 21 tipos, 6 pilhas de camadas (`underLayer`, molde de
  fora, gola, tubos), a gola de cada tipo com faixa, 40 moldes de `specFor` com o relevo de tamanho, acabamentos
  (barra, punho, carcela, capuz) e `posedPositions` + `texturedGeometry` parado e em movimento.
- `garment-photo.snapshot.test.ts`: 8 rasters sintéticos em `fabricTile`, `fabricPatch`, `fabricRows`, `cutoutGarment`,
  `fillInteriorHoles`, `splitByHem`, `fullBodyUpperPhoto`, `medoid`, `canUseOutfitPhoto`; `texturedGeometry` com 6 fotos
  sintéticas (gola, mangas, marcos, costas, pernas) numa malha sintética × 5 tipos e em 5 moldes reais.
- `hair.snapshot.test.ts`: nos dois corpos, quadro da cabeça, linha do cabelo e máscara da orelha; `buildHair` de 14
  cabelos × (base, volume); contexto, penteado, JSON, fitas nos níveis 0/1/2, `strandGeometry` e `withStrands`;
  `strandMaterial` (uniformes, chave, shader).
- `three-human.snapshot.test.ts`: `buildHuman` (árvore, materiais, ossos, repouso, shaders) sem e com abertura medida,
  `clipEyeGeometryForExport`, `baseNormals`, `buildSkeleton`, pele/orelha; `eyeRig`, `eyeApertures`, `isCorneaCap`,
  `lowerLidLine`, `recolorIris` (padrões) e `shadeSclera`.

| Etapa | Comando | Resultado |
|---|---|---|
| Antes (original) | `npx vitest run lib/avatar3d/human/*.snapshot.test.ts` (4 arquivos novos) | 27/27, 27 retratos gravados; 2ª execução idêntica |
| Antes (original) | `npx vitest run lib/avatar3d components/avatar3d components/three` | 72 arquivos; 809 testes: 791 ok, 16 falham, 2 skipped |
| Depois | os 4 arquivos de caracterização | 27/27; `__snapshots__/` idêntico byte a byte ao capturado antes |
| Depois | `npx vitest run lib/avatar3d components/avatar3d components/three` | 79 arquivos; 836 testes: 819 ok, 15 falham, 2 skipped |
| Depois | `npx vitest run lib/tryon lib/room3d lib/scene3d components/heist components/lab` (consumidores) | 263 testes, 262 ok; 1 falha por tempo sob carga (`areas-galeria-…-tex.snapshot`), que passa sozinha |
| Depois | `npx tsc --noEmit` | sem erros (`--noUnusedLocals` só aponta o `t` sem uso já existente no corpo de `garmentGeometry`) |
| Depois | `python3 scripts/refactoring/line_ratchet.py` | os 9 arquivos do lote só como `APERTAR`; 0 violações |

Falhas preexistentes (as mesmas antes e depois, com a mesma mensagem; não corrigidas):
`garment-layers.test.ts` (4: blazer MASCULINO/FEMININO, decote/barra/mangas expostos, punhos/barra sob casaco),
`garments.test.ts` → "shirts and jackets have a continuous hip-bound hem…", gola "MASCULINO/shirt" e "FEMININO/shirt:
contorno suave e fechado…" (agora em `garments-collar.test.ts`), "manga: … sem manga separada do tronco na foto…" (agora em
`garments-size-sleeve.test.ts`), `mould-library.test.ts` (2: polo F/M), `shirt-placket.test.ts` (2: sete botões; preserva
botões fotografados), `shoulder-texture-seam.test.ts` (1: gola fina da camisa), `matriz3d.test.ts` (2: "o que não se aplica
nunca é Ausente…", "a assinatura … bate com a matriz versionada"). Na execução "antes", a 16ª falha foi
`hair-strands.test.ts` → "uma fita sempre amostra uma coluna inteira do atlas…" por tempo (5 s) sob carga; passou na
execução "depois" e sozinha (20/20). O `pipeline` (timeout conhecido) passou nas duas execuções. O teste MATRIZ-3D
"todo arquivo, símbolo e teste citado existe" passou antes e depois (após reapontar as referências).

## Pendências

- O integrador roda `python -m scripts.refactoring.line_ratchet --update` para baixar/retirar os nove tetos do baseline.
- As tabelas geradas em `docs/avatar3d/matriz-3d/` (com `MATRIZ3D_WRITE=1`) citam os caminhos antigos nas referências;
  regenerá-las é tarefa de quem já precisa reconciliar a assinatura da matriz (falha preexistente).
- `hair-geometry.ts` ficou em 233 linhas: `buildHair` (≈ 190 linhas, calota + cortina + mechas num só fluxo de buffers)
  foi mantido inteiro, sem dividir o corpo.
