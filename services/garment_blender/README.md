# FAI Garment Blender

Motor próprio que **modela a peça do zero em Blender** a partir de uma ficha técnica: medidas reais por tamanho,
tecido e detalhes de construção. Substitui a geração paga na Meshy (decisão de 24/11/2026, ver
`docs/fai-reconstruction-engine/piloto-e-decisoes.md`). Sem rede, sem IA e sem custo: o mesmo `.glb` sai igual em
qualquer máquina.

```bash
uv venv -p python3.11 ~/.venv-blender && uv pip install -p ~/.venv-blender/bin/python bpy==4.2.0 numpy pillow
cd services/garment_blender
~/.venv-blender/bin/python -m garment_blender.cli specs/stockton-sweater.json --out saida --tamanhos P M GG --previa
python -m pytest tests          # sem Blender: tabelas, ficha e medidas conferidas na malha
```

Cada tamanho gera, em `saida/<tamanho>/`: o `modelo.glb` (metros, Y para cima, frente +Z), o `modelo.fit.json`
(manifesto de encaixe do provador, com `medidaReal`: o provador não reescala a peça pelo corpo) e o `medidas.json`
(o que a ficha pediu e o que a malha mede). `--previa` renderiza frente e ¾ em Cycles na CPU.

## O que a ficha descreve

| Campo | Valores | O que vira na malha |
|---|---|---|
| `subcategoria` | as 19 de cima da taxonomia (t_shirt, shirt, blouse, tank_top, top, crop_top, polo_shirt, bodysuit, sweater, sweatshirt, hoodie, cardigan, vest, blazer, jacket, coat, parka, windbreaker, kimono) e long_sleeve; jeans, tailored_pants, casual_pants, chino_pants, cargo_pants, jogger_pants, sweatpants, leggings, culottes, shorts, bermuda_shorts, denim_shorts, skirt, skort | construtor da parte de cima ou da calça |
| `tamanho` | PP…XG (cima), 34…50 (calça) | medidas de `sizes.py` / `sizes_pants.py`, a mesma regra de corpo do provador |
| `caimento` | justo, regular, amplo, oversized | folga de tórax, barra e bíceps; ombro caído no amplo |
| `tecido` | tipo (malha_la, malha_algodao, jersey, moletom, sarja, denim, tricoline), cor, gramatura | textura repetível em tamanho real (5 cm por repetição), espessura das bordas dobradas; tricoline é o tecido plano (camisa, blusa, quimono) |
| `gola` | careca, alta, capuz, colarinho, v, lapela | ribana dobrada, gola alta, capuz com abertura do rosto e costura do meio, ou colarinho (pé + folha virada com pontas, `collars.py`), V ou lapela (V aberto pelas bordas da frente + colarinho atrás) |
| `fechamento` | nenhum, ziper_inteiro, botoes, polo, aberto, botao_ziper, cordao | frente aberta em dois painéis com vista dobrada; zíper com cadarço, dentes alternados, cursor, puxador e batentes (`closures.py`); vista transpassada com botões de quatro furos e casas bordadas (`buttons.py`); braguilha em J; cordão do elástico |
| `botoes`, `cor_botao`, `cor_linha` | 2–12; #rrggbb | quantos botões; cor do botão; linha do pesponto (padrão: um tom abaixo do tecido) |
| `bolsos` | canguru, peito, faca, traseiro, cargo, joelho_duplo | placas costuradas com saia e pesponto; boca aberta sem costura |
| `sem_manga` | true/false | regata, top, colete, body: alça do decote + 4,5 cm e cava curva acabada com viés (`armhole.py`) |
| `pregas` | 0 ou divisor de 96 (12, 16, 24, 32) | saia: pregas faca, fundas na barra e sumindo no quadril (`skirt.py`) |
| `ribana`, `manga_curta`, `passantes`, `capuz_abaixado`, `angulo_manga` | | ribana na barra e no punho; manga curta com bainha; passantes no cós; capuz nas costas; queda da manga |
| `medidas_marca` | qualquer medida da tabela | a tabela da marca vale mais que a grade padrão |
| `estampas` | lista de {`imagem` PNG com alfa, `x`, `abaixo_do_ombro`, `largura`} (m) | desenho colado na frente do tronco, 0,7 mm acima do pano, largura medida ao longo do pano; fora do decote e do vão de uma frente que abre (`decals.py`); material com recorte (`alphaMode: MASK`) |
| `listras` | {`direcao` horizontal/vertical, `fundo`, `listra`, `periodo` (m), `fracao`} | a cor do corpo vira as listras, nítidas, com o relevo do tecido por cima; o período fecha num número inteiro de repetições (`pattern.py`) |
| `estampa_corrida` | {`imagem`, `lado` (m)} | um pedaço da estampa repetido no corpo todo, espelhado para não ter emenda |
| `origem` | livre | de onde a ficha veio (produto, foto, o que a análise leu); não muda a malha |

## Como a peça é construída

- **Tronco:** anéis elípticos com o perímetro de cada medida (barra → tórax → ombro → decote); a cava fica aberta e a
  manga nasce dos mesmos vértices dela (`geometry.py`, `sleeves.py`).
- **Manga:** estações cava → bíceps → cotovelo → punho, com a transição da cava em 15 cm (sem degrau na axila).
  `angulo_manga` > 0 gira a manga em torno da axila depois de pronta (o tecido de baixo do braço se junta).
- **Calça:** tubo da cintura ao gancho, as pernas separadas por uma ponte de costura no gancho, coxa → joelho → barra;
  as costas sobem acima da frente; cós dobrado por dentro (`pants.py`, `lower.py`).
- **Short, bermuda, saia:** cada modelo de `sizes_pants.CUTS` pode ter a própria entreperna (perna curta sem joelho,
  boca da perna pela coxa) e uma saia (comprimento e roda); a saia-short é o short com a saia por cima (`skirt.py`).
- **Costuras:** os vértices de costura (laterais, ombro, cava, debaixo da manga, entreperna, cós, emendas de ribana,
  pespontos dos bolsos e da braguilha) afundam 0,9 mm na direção de dentro: o vinco aparece na luz.
- **Frente aberta:** com zíper ou botões a coluna do meio da frente vira duas bordas, cada uma com a vista dobrada
  por dentro (a espessura aparece de frente); barra e decote ficam contornos abertos (`geometry.FrontOpening`).
- **V aberto e lapela:** com a frente aberta, o V é feito pelas próprias bordas, que se afastam do fundo do V até o
  decote (as colunas vão junto, `geometry.v_thetas`); a lapela é a borda virada sobre o peito, larga em cima.
- **Vista curta (polo), frente aberta (quimono), body:** a vista abre só os 14 cm de cima; a frente aberta deixa 10 cm
  entre as bordas; o body sobe a blusa e costura a calcinha no anel da barra (`bodysuit.py`).
- **Pesponto à vista:** traços de linha de 3 mm a cada 4,5 mm, 0,7 mm acima do tecido, na barra e na manga dobradas,
  ao lado do zíper, na vista, nos bolsos e na borda do colarinho (`stitches.py`).
- **Conferência:** `measure.py` corta a malha por planos e mede os perímetros; o relatório traz ficha × malha.

## Estado no provador (24/11/2026, corpo padrão, manga caída a 80°)

Com `medidaReal`, o provador usa escala 1, conta o tamanho escolhido a partir do tamanho gerado (não do corpo) e não
estica a peça em profundidade por faixa (o passo feito para a Meshy rasa estufava o tronco); só a colisão a tira de
dentro da pele. A manga cai até o ângulo do braço do avatar girando em torno da articulação do ombro (5 cm para dentro
da ponta do ombro, 12 cm abaixo; `JOINT_IN`, `JOINT_DOWN`, `DROP_RAMP` em `sleeves.py`). Medido offline
(`meshy-real.test.ts`):

| Peça | P / 36 | M / 40 | GG / 46 |
|---|---|---|---|
| Calça cargo, calça joelho duplo | veste | veste | veste |
| Suéter (Stockton) | veste (esticada 1,12, furos 1,3 %) | veste | veste |
| Moletom careca (Script) | veste | veste | veste |
| Camiseta (sacai) | veste | veste | veste |
| Moletom com zíper e capuz (sacai, 25/11) | veste (esticada 1,43) | veste | veste |
| Camisa-jaqueta com botões e colarinho (Alexander McQueen, 25/11) | veste (esticada 1,10) | veste | veste |
| Moletom com capuz, sem zíper (Hooded World Tour) | não conferido de novo depois do 24/11 | | |

O que ainda está errado: o capuz veste levantado e fica volumoso na cabeça (falta encaixe próprio, preso à nuca); a
manga comprida no corpo feminino forma pregas no antebraço (manga mais longa que o braço); a camiseta de corte
masculino em P no corpo feminino fica larga nos ombros; bordados, etiquetas, punho com botão e as tiras laterais da
camisa-jaqueta não são modelados. Evidências em `docs/provador/garment-blender/2026-11-24/` e `2026-11-25/`.

## Peças do catálogo em lote (`catalogo/`, 25/11/2026)

A forma da peça nunca vem da foto: cada produto usa **a base da subcategoria** (a construção que o motor já monta,
`catalogo/ficha.py` e `catalogo/forma.py`: o V fundo do blazer, o casaco longo, a manga larga do quimono) com os
detalhes que o nome e a descrição confirmam (`catalogo/texto.py`, português e inglês: gola, fecho, bolsos, manga,
caimento, tecido, cropped). Da foto do produto saem só a pintura e o desenho (`catalogo/analise.py`):

- **Peça na foto:** o segmentador de pessoas fashn-ai/fashn-human-parser (CPU, `segmentador.py`) dá a máscara da
  blusa (rótulos blusa ∪ vestido) e as referências: linha do ombro, barra, eixo do centro da frente e a escala (pela
  altura da peça ou, em modelo, pela altura do rosto) (`mascara.py`).
- **Cor:** o pico do histograma em Lab dos pixels da peça, com o branco do fundo do estúdio corrigido.
- **Desenho e logo:** o pixel que foge da cor do tecido *com a sombra do lugar* (a dobra muda devagar, a estampa de
  repente); saem o fino e comprido (costura, vinco, zíper), a sombra rente à borda, a dobra, a gola por dentro e a
  fila de botões; o resto é juntado letra com letra e recortado em RGBA com a sombra tirada, com o lugar em metros a
  partir do ombro e do centro da frente (`estampa.py`). Na foto em modelo de frente aberta, o que cruza o meio é a
  roupa de baixo e fica de fora.
- **Padronagem:** listras pelo período do perfil de cor (redesenhadas nítidas) e estampa corrida (um pedaço espelhado)
  (`padrao.py`); nome "listrada" sem listra visível vira listra fina.
- **Recorte:** em modelo, o comprimento medido pela altura do rosto encurta a base só quando a barriga aparece logo
  abaixo da barra (cropped de verdade, não para dentro da calça) e alonga o casaco longo; a manga, quando o texto não
  diz, sai da pele do braço à mostra.

Três etapas, retomáveis (a pasta de cada produto guarda o que já foi feito):

```bash
cd services/garment_blender
# A: fotos → ficha + imagens da pintura (venv do segmentador: torch, fashn-human-parser, scipy)
~/.venv-catalogo/bin/python -m catalogo.lote --saida ~/catalogo-3d --threads 3
# B: ficha → .glb no tamanho M, um processo do Blender para centenas de peças (reaberto pelo laço)
until ~/.venv-blender/bin/python -m catalogo.construir --pasta ~/catalogo-3d --seguir; do :; done
# C: bucket, prefixo novo do lote (nada é sobrescrito) + selecao.csv para o meshy_lote_download.py
python3 -m catalogo.publicar --pasta ~/catalogo-3d --lote motor-blender-2026-11-25 --seguir
```

Onde o banco é alcançável, a ligação ao produto é a mesma dos lotes da Meshy: `meshy_lote_download.py --selecao
<selecao.csv do lote>` e `import_meshy_glbs.py ... --generator garment-blender-1 --origin local` (ensaio; `--apply` só
com autorização — publicar aposenta o modelo publicado antes do produto).
