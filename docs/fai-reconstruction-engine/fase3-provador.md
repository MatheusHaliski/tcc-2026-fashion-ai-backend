# Fase 3 — vestir a peça no avatar do provador

Estudo do código existente (01/11/2026) e o plano que decorre dele. Nada desta fase foi implementado ainda.

## Como o avatar e o provador funcionam hoje

- **Avatar:** corpo MakeHuman/MPFB2 (CC0) em formato próprio (`public/avatar3d/body/fai-body-v1.{json,bin}`), com
  malha, **esqueleto de 52 ossos** (nomes Mixamo), pesos de pele e espaços de forma ajustados às medidas da pessoa
  (`lib/avatar3d/human/compose.ts`, `fitBody`). As medidas vêm do usuário ou da foto (SAM 3D Body em
  `services/anatomical_vton/sam3d_runtime.py`).
- **Roupa no avatar:** não existe malha de peça. Cada roupa é um **molde paramétrico**: os triângulos da pele que a
  peça cobre, copiados e empurrados pela normal (folga), com gola, barra e punhos, presos ao mesmo esqueleto
  (`components/three/human-outfit.tsx` → `dress`; `lib/avatar3d/human/garments.ts`). São 21 tipos de molde por
  subcategoria. Não há simulação de tecido.
- **Foto da peça no 3D:** o provador busca `photoSet.wholeUrl` (recorte RGBA) e **projeta só na frente**
  (`texturedGeometry`); costas e laterais recebem a cor mediana ou um ladrilho; mangas só ganham foto quando
  aparecem separadas do tronco.
- **`.glb` de peça (RF16):** gerados por Meshy, Stable Fast 3D ou relevo local, **sem esqueleto**. Aparecem no
  manequim, no quarto e no visualizador da peça — nunca no avatar humano.
- **Provador 2D (VTON):** `services/anatomical_vton` (FASHN) gera uma imagem da pessoa vestida; não é 3D.

## Caminho escolhido: o flat lay vira a textura dos moldes

| Opção | Situação no código | Esforço |
|---|---|---|
| **(a) Flat lay como textura do molde já riggado** | moldes, esqueleto e carregamento da foto já existem | médio |
| (b) Gerar malha `.glb` e ajustar ao corpo | só o contrato (`GarmentAsset3d`, `APPROVED_ASSET`) existe; nenhum consumidor | alto: retopologia, pesos de pele, colisão |

O flat lay da Fase 2 é exatamente a entrada que o molde espera, e melhor que a foto atual: a peça está esticada,
de frente, com as **mangas abertas**, o que resolve o caso em que hoje as mangas ficam sem foto.

## Plano

1. **Vista de costas na Fase 2:** gerar uma segunda imagem com as costas da peça (mesma instrução de flat lay), com
   aviso de que é reconstrução quando as costas não aparecem em nenhuma foto.
2. **Gravar no catálogo:** o resultado aprovado entra no `photoSet` da imagem do catálogo (`wholeUrl` e a nova
   vista de costas), de onde o provador já lê. Script com ensaio por padrão e `--apply` explícito.
3. **Mapeamento por painéis no avatar:** trocar a projeção só frontal por frente, costas e mangas, usando os pontos
   da peça no flat lay (ombros, cava, barra) para casar com o molde.
4. **SAM 3D Body na análise:** corpo da modelo em 3D projetado na foto → máscara exata de mãos, braços e cabeça,
   com profundidade (o que está na frente da peça). Substitui a heurística de cor de pele da Fase 1 e dá os pontos
   do corpo para o passo 3.
5. **Malha própria (opção b), depois:** para peças em que o molde paramétrico não serve (casacos com capuz, volume),
   avaliar geração de malha com transferência de pesos do corpo (`nearestSkinWeights` já existe).

## Riscos

- A vista de costas é gerada pela IA quando não há foto das costas: precisa de revisão e de selo de IA.
- Projeção por painéis exige pontos confiáveis no flat lay; peças fora do padrão (assimétricas, transparentes)
  continuarão aproximadas.
- O avatar continua sem simulação de tecido: o caimento é aproximado (ver `docs/avatar3d/PIPELINE_VESTIMENTAS_3D.md`).
