# Peças do catálogo modeladas do zero no motor Blender (24/11/2026)

Sete produtos do catálogo modelados pelo `services/garment_blender` a partir das fichas em
`services/garment_blender/specs/`: medidas da grade padrão do tamanho, tecido, cor (amostrada da foto ou da textura do
produto quando havia) e detalhes de construção.

| Peça | Marca | Construção | Tecido | Medido na malha (ficha) |
|---|---|---|---|---|
| Stockton Sweater | Carhartt WIP | gola careca, barra e punho em ribana | malha de lã | tórax 110 (110), punho 20,9 (21), manga 63 (63) |
| sacai x Carhartt WIP Cotton Jersey Hoodie | Carhartt WIP | capuz, zíper inteiro dourado, bolso canguru dividido | moletom | tórax 118 (118), bíceps 42,6 (42,8) |
| Script Embroidery Sweatshirt | Carhartt WIP | gola careca, ribanas | moletom | tórax 110 (110) — o bordado ainda não é modelado |
| Hooded World Tour Sweatshirt | Carhartt WIP | capuz, bolso canguru | moletom | tórax 110 (110) |
| sacai x Carhartt WIP Cotton Jersey T-Shirt | Carhartt WIP | manga curta, bainhas dobradas, gola em ribana | jersey | tórax 118 (118), manga 22,1 |
| Carhartt WIP x Nicholas Daley Cargo Pant | Carhartt WIP | cós com passantes, braguilha em J e botão, bolsos faca, traseiros e cargo com lapela | sarja | quadril 107,3 (108), coxa 69,5 (69,6), entreperna 81 (81) |
| Carhartt WIP x Nicholas Daley OG Double Knee Pant | Carhartt WIP | cós com passantes, braguilha, bolsos faca e traseiros, joelho duplo | sarja | quadril 103,4 (104), coxa 65,5 (65,6) |

- `00-pecas-geradas-frente.jpg` e `<peça>-frente.jpg` / `<peça>-tres-quartos.jpg`: prévias em Cycles, com a manga caída
  a 80° em torno da articulação do ombro (o mesmo `.glb` que vai ao provador).
- `01-provador-folha.jpg` e `provador-*.jpg`: a prévia do suéter e as peças de cima vestidas no laboratório do provador
  (corpo de referência), em escala real, tamanho M.
- `02-provador-manga-caida-recusada-na-tela.jpg`: a primeira manga caída (pivô na ponta do ombro) com o aceite de furos
  afrouxado para 8 %: passava no número, mas a tela mostrou o tronco estufado — o aceite não foi afrouxado.
- `03-provador-antes-manga-horizontal.jpg`: antes, com a manga gerada na horizontal e girada pelo provador: ombro em
  bico e manga em "asa".

O que ainda está errado: os moletons com capuz são recusados (o capuz precisa de encaixe próprio no provador); a ponta
do ombro da camiseta fica em bico; o bordado e as etiquetas não são modelados.
