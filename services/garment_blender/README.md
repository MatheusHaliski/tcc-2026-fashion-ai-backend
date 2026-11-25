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
| `subcategoria` | sweater, sweatshirt, hoodie, t_shirt, long_sleeve, shirt, jacket; casual_pants, chino_pants, cargo_pants, jogger_pants, sweatpants, jeans | construtor da parte de cima ou da calça |
| `tamanho` | PP…XG (cima), 34…50 (calça) | medidas de `sizes.py` / `sizes_pants.py`, a mesma regra de corpo do provador |
| `caimento` | justo, regular, amplo, oversized | folga de tórax, barra e bíceps; ombro caído no amplo |
| `tecido` | tipo (malha_la, malha_algodao, jersey, moletom, sarja, denim), cor, gramatura | textura repetível em tamanho real (5 cm por repetição), espessura das bordas dobradas |
| `gola` | careca, alta, capuz, colarinho | ribana dobrada, gola alta, capuz com abertura do rosto e costura do meio, ou colarinho (pé + folha virada com pontas, `collars.py`) |
| `fechamento` | nenhum, ziper_inteiro, botoes, botao_ziper, cordao | frente aberta em dois painéis com vista dobrada; zíper com cadarço, dentes alternados, cursor, puxador e batentes (`closures.py`); vista transpassada com botões de quatro furos e casas bordadas (`buttons.py`); braguilha em J; cordão do elástico |
| `botoes`, `cor_botao`, `cor_linha` | 2–12; #rrggbb | quantos botões; cor do botão; linha do pesponto (padrão: um tom abaixo do tecido) |
| `bolsos` | canguru, peito, faca, traseiro, cargo, joelho_duplo | placas costuradas com saia e pesponto; boca aberta sem costura |
| `ribana`, `manga_curta`, `passantes`, `capuz_abaixado`, `angulo_manga` | | ribana na barra e no punho; manga curta com bainha; passantes no cós; capuz nas costas; queda da manga |
| `medidas_marca` | qualquer medida da tabela | a tabela da marca vale mais que a grade padrão |

## Como a peça é construída

- **Tronco:** anéis elípticos com o perímetro de cada medida (barra → tórax → ombro → decote); a cava fica aberta e a
  manga nasce dos mesmos vértices dela (`geometry.py`, `sleeves.py`).
- **Manga:** estações cava → bíceps → cotovelo → punho, com a transição da cava em 15 cm (sem degrau na axila).
  `angulo_manga` > 0 gira a manga em torno da axila depois de pronta (o tecido de baixo do braço se junta).
- **Calça:** tubo da cintura ao gancho, as pernas separadas por uma ponte de costura no gancho, coxa → joelho → barra;
  as costas sobem acima da frente; cós dobrado por dentro (`pants.py`, `lower.py`).
- **Costuras:** os vértices de costura (laterais, ombro, cava, debaixo da manga, entreperna, cós, emendas de ribana,
  pespontos dos bolsos e da braguilha) afundam 0,9 mm na direção de dentro: o vinco aparece na luz.
- **Frente aberta:** com zíper ou botões a coluna do meio da frente vira duas bordas, cada uma com a vista dobrada
  por dentro (a espessura aparece de frente); barra e decote ficam contornos abertos (`geometry.FrontOpening`).
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
