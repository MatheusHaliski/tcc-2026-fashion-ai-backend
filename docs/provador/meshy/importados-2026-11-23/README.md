# Registro em fotos: as 17 peças da Meshy importadas em 23/11/2026

Os 17 `.glb` gravados em produção (`import_meshy_glbs.py --apply`), vestidos no avatar padrão do laboratório do
provador (`/lab/scenes?s=fitting-neutral`, corpo `F-ref`): o mesmo código de encaixe do provador do app, com os `.glb` e
os manifestos `.fit.json` servidos de uma pasta local (`preparar-glb.mjs --midia`). Não é captura do site
fai-network.com: o site exige login (Google + PIN). Roteiro: `scripts/meshy/capturar-provador.mjs` com os casos abaixo.

## As peças

| # | Subcategoria | Peça | Marca | Lote | No avatar |
|---|---|---|---|---|---|
| 1 | blazer | Madelyn blazer in velvet | J.Crew | pose T | veste; linha fina em arco na barra, pontos claros na barra |
| 2 | blouse | Shoulder Bow Blouse | Alexander McQueen | pose T | veste; riscos verticais do laço e pontas na barra |
| 3 | hoodie | sacai x Carhartt WIP Cotton Jersey Hoodie | Carhartt WIP | pose T | veste; volumoso, barra serrilhada sobre a calça cargo (P e M) |
| 4 | parka | Parka | Jack & Jones | pose T | veste limpo |
| 5 | sweater | Stockton Sweater | Carhartt WIP | pose T | **recusado** (FURADA: 5,9 % de furos): o provador mostra o molde cinza |
| 6 | bermuda_shorts | Bermuda Color Twill Power Verde Escuro | Ellus | 18/11 | veste; barra rasgada com pontas soltas |
| 7 | cargo_pants | Carhartt WIP x Nicholas Daley Cargo Pant | Carhartt WIP | 18/11 | veste; larga, cobre quase todo o tênis |
| 8 | casual_pants | Carhartt WIP x Nicholas Daley OG Double Knee Pant | Carhartt WIP | 18/11 | veste |
| 9 | jogger_pants | KID by Crewcuts garment-dyed slim-slouchy jogger pant | J.Crew | 18/11 | veste limpo |
| 10 | basketball_shoes | Pump Omni Zone II Retro Basketball Shoes | Reebok | 18/11 | calça; pouco visível sob a cargo |
| 11 | espadrilles | Made-in-Spain Sophie strappy espadrilles | J.Crew | 18/11 | calça |
| 12 | loafers | Loafer Trevira Realex Cafe | Richards | 18/11 | calça |
| 13 | running_shoes | Women's FloatZig 2 Running Shoes | Reebok | 18/11 | calça; pouco visível sob a cargo |
| 14 | skate_shoes | Nike SB PS8 Skate Shoes | Nike | 18/11 | calça |
| 15 | training_shoes | Women's Nano X5 Training Shoes | Reebok | 18/11 | calça |
| 16 | bow_tie | Kids' velvet bow tie | J.Crew | 18/11 | no pescoço |
| 17 | clutch | Play - Clutch in perforated and quilted PU | Diesel | 18/11 | na mão |

## As fotos (frente e ¾)

| Caso | Peças |
|---|---|
| 01 | moletom + calça cargo + tênis de corrida |
| 02 | blazer + calça casual + mocassim + gravata-borboleta |
| 03 | parka + jogger + tênis de skate |
| 04 | blusa + bermuda + alpargata + clutch |
| 05 | suéter + calça cargo + tênis de basquete |
| 06 | moletom + jogger + tênis de treino |
| 07 / 08 | caso 01 nos tamanhos P (36, 35) e GG (46, 41) |

`00-folha-de-contato.jpg` junta as oito frentes.

## No site

- Escolher uma dessas peças no provador mostrava "As fotos disponíveis não permitem o enquadramento desta categoria"
  (Madelyn blazer, 23/11): antes de vestir, a escolha pedia a prévia enquadrada da foto do card e abortava quando a
  foto não enquadra, mesmo com modelo 3D publicado. Correção em `components/catalog/use-catalog-preview.ts`: com
  `model3dUrl`, só essa falha deixa de bloquear (a peça entra e o provador veste o `.glb`); vale depois do deploy do front.
- O importador não envia o `.fit.json` ao bucket: no site o provador mede o `.glb` na hora, sem os ajustes manuais de
  aceite do blazer e da blusa (ver `../../MESHY_GLB.md`).
