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

- `00-pecas-geradas-frente.jpg` e `<peça>-frente.jpg` / `<peça>-tres-quartos.jpg`: prévias em Cycles com a manga caída
  (`--angulo 80`).
- `01-provador-folha.jpg` e `provador-*.jpg`: as peças vestidas no laboratório do provador (corpo padrão), em escala
  real, nos tamanhos indicados no nome. O `.glb` do provador sai com a manga na horizontal: com ela caída, o provador
  recusa as peças de cima (furos na axila).

O que ainda está errado: nas peças de cima o giro da manga do provador deixa o ombro quadrado e a manga larga (a
camiseta fica com a manga em aba); os moletons com capuz são recusados (o capuz é furado pela cabeça); o bordado e as
etiquetas não são modelados.
