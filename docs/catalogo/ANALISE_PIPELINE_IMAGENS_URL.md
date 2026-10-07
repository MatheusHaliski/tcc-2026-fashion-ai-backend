# Análise do motor de filtro e segmentação das imagens vindas de URL (CATALOG_IMAGE_PIPELINE_V2)

> 06/10/2026 · Teste real: 80 fotos oficiais sorteadas do acervo (`data/catalog/acervo`), 31 marcas, as 5 categorias,
> baixadas das URLs oficiais e passadas pelo `CatalogImagePipeline` (nível A, metadados). Mais os 9 casos sintéticos dos
> testes automatizados. Resultados brutos: `analise-pipeline-imagens/resultados-80-fotos.json`; pranchas visuais na mesma
> pasta (azul = caixa da peça, vermelho = distrator, verde = foco, laranja tracejado = regiões críticas, preto = recorte
> 4:5 escolhido; à direita, o card como a pessoa vê).

## 1. Números

| Resultado | Fotos | % |
|---|---|---|
| APPROVED | 20 | 25% |
| NEEDS_REPROCESSING (fila de revisão) | 44 | 55% |
| REJECTED | 14 | 18% |
| Download falhou (só no script da análise — o adaptador Java baixa) | 2 | 2% |

| Motivo | Ocorrências | Leitura |
|---|---|---|
| HUMAN_PRESENT | 39 | **acertos**: as fotos são de modelo vestindo (conferido nas pranchas) |
| PRODUCT_TRUNCATED_IN_SOURCE | 31 | quase sempre a mesma foto de modelo (peça cortada pela borda) |
| LOW_SEGMENTATION | 18 | recorte local falhou (ver §3.1) |
| IMAGE_TOO_SMALL | 11 | 6 são **miniaturas de CDN** (100×100, 270×392…) e 2 são falhas de segmentação (§3.3) |
| DISTRACTOR_IN_FRAME | 4 | meias em kit, tênis da modelo, calça junto do moletom |
| NO_PRODUCT | 3 | peça branca em fundo branco (§3.1) |

Por categoria: calçados 7/16 aprovados, partes de baixo 5/20, acessórios 3/12, corpo inteiro 2/8, partes de cima 3/24
(as partes de cima são quase todas foto de modelo). Tempo: mediana **1,0 s** por foto, p90 1,9 s (servidor local) —
um lote de 8 por tick leva ~10 s: desempenho não é gargalo.

## 2. O que funciona

- **Packshot de estúdio** (peça sozinha, fundo claro): enquadramento 4:5 correto, ocupação média 0,84, foco no lugar
  certo — gola/peito (camisetas), cós/bolsos (shorts, calças), cadarço/cabedal (tênis), mostrador (relógio), frente da
  bolsa. Ver `aprovadas-1.png` e `aprovadas-3.png`.
- **Detecção de pessoa** sem segmentador ONNX: 39 de 39 fotos marcadas eram de fato de modelo (sem falso positivo visto).
- **Distratores separados** (tênis da modelo, rosto destacado do corpo, adereço) vão para fora da caixa da peça.
- **Gate conservador**: nenhuma foto ruim foi aprovada na amostra; o erro é sempre para o lado da revisão/rejeição.
- **Segurança de URL**: o `JdkWebFetchAdapter` baixou também as URLs com acento (Valentino), que quebraram o `urllib`
  do script da análise.

## 3. Problemas encontrados (com causa)

### 3.1 Recorte local falha em dois cenários comuns (causa da maioria dos LOW_SEGMENTATION/NO_PRODUCT)
- **Peça clara em fundo claro** (#51 tênis branco, #62 boné branco, #58 sandália creme, #61 gravata bege): o recorte por
  cor só isola a parte contrastante (logo, sola, aplique) — o quadro dá zoom no logo e a foto é rejeitada.
- **Peça que encosta na borda** (toda foto de modelo; teste sintético `cortada-na-origem`): a cor do fundo é amostrada
  nas bordas; com a peça na borda, a cor dela entra como "fundo" e o preenchimento apaga a peça (solidez 0,03, centro
  removido 100%).
Causa: `ImageOps.removeBackgroundLocal` é um modelo de cor (k-means Lab + crescimento de região), sem semântica.

### 3.2 Foto de modelo: a "peça" vira a pessoa inteira (50% da amostra)
A máscara junta pessoa + roupa; a caixa da peça é a pessoa, então o foco de gola/peito cai no **rosto** e o card mostra a
modelo inteira (`pessoa-1.png`). O gate manda corretamente para revisão, mas no nível A não há como melhorar a foto —
e o acervo raramente tem alternativa: **61% dos produtos têm 1 foto só**, e **todas** as 18.336 fotos vêm marcadas como
`PACKSHOT` (o coletor não identifica frente/costas/modelo), o que anula a preferência por vista do ranqueamento.

### 3.3 Limite de "foto pequena"
- 6 das 11 são miniaturas que a própria CDN entrega em tamanho maior: Shopify `_small.jpg` (Dickies, 100×100),
  Thron `/std/500x0/` (Valentino), SAP Hybris `Thumbnail-…`/`HEADLESS-…` (Schutz, Arezzo), Scene7 sem `wid` (Burberry).
- `MIN_PRODUCT_PX` usa o **lado menor** da peça: objeto estreito (gravata, cinto, pulseira) é rejeitado mesmo em foto
  grande.

### 3.4 Padding com faixa visível
56 de 67 recortes usam padding (o quadro 4:5 passa da foto). A cor do padding é a mediana da borda; em fundo com
degradê ou cinza diferente, aparece uma **faixa** no card (#0, #3, #9 em `pessoa-1.png`; #48 fica com faixa escura).

### 3.5 Casos específicos
- **Par/kit em acessório** (#64 meias): a regra de "par" só existe para calçado — a segunda meia é cortada.
- **Foto de detalhe** (#48 Fila, macro do logo): cortada nos 4 lados; recebe padding em vez de ser tratada como detalhe.
- **Cabide no nível A**: o gancho sai da máscara, mas continua visível no card (a foto original é mostrada e o quadro
  pega a área acima da peça).
- **Dado do acervo**: boné da Reebok classificado como `running_shoes` (#53) — erro de tipo na coleta, não do pipeline.

## 4. Recomendações (por impacto ÷ esforço)

| # | Mudança | Resolve | Esforço |
|---|---|---|---|
| 1 | **Pedir a versão grande nas CDNs conhecidas** (coletor e fetch): Shopify sem `_small`/`width=1600`, Thron `/std/1600x0/`, Scene7 `?wid=1600`, Hybris trocar o formato de miniatura | ~6 de 11 IMAGE_TOO_SMALL | baixo |
| 2 | `MIN_PRODUCT_PX` pelo **lado maior** + área mínima | gravata, cinto, pulseira | baixo |
| 3 | Padding só com **fundo uniforme** (variância da borda baixa); senão, recorte dentro da foto (sem padding) ou cor medida lado a lado | faixas no card | baixo |
| 4 | Regra de **par/kit** também para meias, luvas, brincos | #64 | baixo |
| 5 | Cortada em ≥3 lados = **detalhe**: sem padding, papel DETAIL direto | #48 | baixo |
| 6 | Com cabide detectado, o topo do quadro começa abaixo do gancho | cabide no card | baixo |
| 7 | **Segmentação por IA no `ProductSegmenter`**: usar a `BackgroundRemovalPort` já existente (rembg/BiRefNet via `REMBG_URL`, remove.bg, Photoroom) e o recorte local só como reserva | §3.1 inteiro — maior ganho de qualidade | médio |
| 8 | **Peça na modelo**: segmentação de roupa sobre a pessoa (classe "clothes" do MediaPipe multiclasse já usado na moderação, ou human parsing tipo SCHP/LIP) → caixa e foco na roupa, não na pessoa | 50% da amostra | médio |
| 9 | **Coletor**: guardar todas as fotos do produto e classificar a vista (frente/costas/modelo/detalhe) | ranqueamento passa a ter escolha | médio |
| 10 | Rodar esta análise como **regressão** (amostra fixa + pranchas) a cada mudança de limiar, e versionar como V3 se o veredito mudar | calibração contínua | baixo |

Com 1–6 a taxa de aprovação de packshots sobe e as faixas somem sem mudar a arquitetura; 7–9 atacam a causa principal
(segmentação por cor e foto de modelo) e são o que separa "aprova 25%" de um catálogo majoritariamente padronizado.

## 5. Como reproduzir

Amostra: `sample.py` (semente 7, até 2 produtos por marca por categoria) → download → `Run.java` (roda o pipeline e
desenha a depuração) → pranchas. Scripts em `scripts/catalog/image_analysis/` (rodar da raiz do repositório, com a pasta de trabalho como argumento); resultados e pranchas em
`docs/catalogo/analise-pipeline-imagens/`.
