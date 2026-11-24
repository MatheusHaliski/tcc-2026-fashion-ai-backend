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
| `subcategoria` | sweater, sweatshirt, hoodie, t_shirt, long_sleeve; casual_pants, chino_pants, cargo_pants, jogger_pants, sweatpants, jeans | construtor da parte de cima ou da calça |
| `tamanho` | PP…XG (cima), 34…50 (calça) | medidas de `sizes.py` / `sizes_pants.py`, a mesma regra de corpo do provador |
| `caimento` | justo, regular, amplo, oversized | folga de tórax, barra e bíceps; ombro caído no amplo |
| `tecido` | tipo (malha_la, malha_algodao, jersey, moletom, sarja, denim), cor, gramatura | textura repetível em tamanho real (5 cm por repetição), espessura das bordas dobradas |
| `gola` | careca, alta, capuz | ribana dobrada, gola alta ou capuz com abertura do rosto e costura do meio |
| `fechamento` | nenhum, ziper_inteiro, botao_ziper, cordao | zíper com cadarço, dentes e cursor; braguilha em J com botão de metal; cordão do elástico |
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
- **Conferência:** `measure.py` corta a malha por planos e mede os perímetros; o relatório traz ficha × malha.

## Estado no provador (24/11/2026, corpo padrão, manga gerada na horizontal)

Com `medidaReal`, o provador usa escala 1 e não estica a peça em profundidade por faixa (o passo feito para a Meshy
rasa estufava o tronco em faixas); só a colisão a tira de dentro da pele. Medido offline (`meshy-real.test.ts`):

| Peça | P / 36 | M / 40 | GG / 46 |
|---|---|---|---|
| Calça cargo, calça joelho duplo | veste | veste | veste |
| Moletom careca (Script) | veste | veste | veste |
| Suéter (Stockton) | veste | veste | furos 3,3 % (limite 3 %) |
| Camiseta (sacai) | veste | furos 3,3 % | furos 3,2 % |
| Moletom com capuz | recusado: o capuz é furado pela cabeça (5–15 %) e estica | | |

No laboratório (corpo de referência), as cinco capturas de cima vestiram. O que ainda está errado: o giro da manga
feito pelo provador deixa a ponta do ombro em bico e a manga larga. A manga caída feita no Blender (`--angulo 80`)
fica certa na prévia, mas no provador fura na axila (5–7 %) e, com o aceite afrouxado, a tela mostrou a peça
deformada: o aceite não foi afrouxado. Evidências em `docs/provador/garment-blender/2026-11-24/`.
