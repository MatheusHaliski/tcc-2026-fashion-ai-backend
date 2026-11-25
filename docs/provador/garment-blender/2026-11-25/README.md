# Motor Blender no provador — deformações corrigidas (25/11/2026)

Laboratório (`/lab/scenes?s=fitting-neutral`, `sizes=letter:P|GG`), corpos de referência masculino e feminino.

| Arquivo | O que mostra |
|---|---|
| `antes-pontas-axila.jpg` | antes: camiseta em P e GG com pontas horizontais na lateral do peito, na altura da axila |
| `tamanhos-p-gg.jpg` | depois: camiseta GG/P (masc.), P (fem.), suéter GG (fem.), moletom P (masc.); frente e ¾ |

Causas e correções:

1. **Tamanho diferente do gerado** mudava tronco e manga separados, depois do encaixe: a parede do tronco atravessava a
   cabeça da manga. Agora o tamanho muda a própria peça antes do encaixe (`sizedGarment`, `lib/avatar3d/meshy/size.ts`).
2. **Alargamento do tronco** (`width.ts`) cobria os braços da axila para cima e tratava a faixa que só tinha o detalhe do
   peito como um tronco estreito (escala 1,6×). Na peça do motor (mangas rotuladas) o tronco não alarga acima da axila e
   faixas com menos da metade da largura do corpo são ignoradas.
3. **Axila da manga** sai na direção do braço, rente ao tronco (motor: `sleeves.py`).

Aceite offline (`meshy-real.test.ts`): camiseta, suéter, moletom, cargo e calça passam em P/M/GG (36/40/46); o
esticamento caiu de 1,30–1,52 para 1,10–1,33. Limite conhecido: a camiseta de corte masculino em P num corpo feminino
fica larga nos ombros (a peça tem 16 cm a mais de tórax que o corpo) — é tamanho, não defeito de malha.

## Frente aberta, zíper, botões, pesponto e colarinho

| Arquivo | O que mostra |
|---|---|
| `previas-blender.jpg` | prévias do motor (Cycles): camisa-jaqueta Chambray (Alexander McQueen) e moletom sacai com zíper |
| `ziper-botao-closeup.jpg` | detalhe: dentes alternados encaixados, cadarço, vista dobrada e pesponto dos dois lados; botão de quatro furos com linha em X e as pontas da casa (o tom ciano é só da importação no render de detalhe, que lê o rótulo de parte como cor; o provador ignora) |
| `colarinho-pontas.jpg` | colarinho final: pé, folha virada por fora e pontas retas que abrem de cada lado da vista |
| `antes-aba-na-barra-e-moletom-ziper.jpg` | antes: aba horizontal na barra da camisa-jaqueta (faixa só com vista e botões alargada 1,6×); moletom com zíper vestido |
| `camisa-jaqueta-provador.jpg` | depois: camisa-jaqueta no corpo feminino (M) e masculino (G), frente e ¾ |

A camisa-jaqueta é curta como na foto do catálogo; a faixa de pele entre a barra e a calça é do corte, não um furo.

## Peças de baixo: uma por subcategoria (14)

| Arquivo | O que mostra |
|---|---|
| `baixo-previas-14.jpg` | prévias do motor das 14 fichas (uma por subcategoria de `lower_piece` da taxonomia) |
| `baixo-provador-14.jpg` | as 14 no provador, frente e ¾ (corpo do sexo da ficha). O short aparece cinza: foi recusado por 3,0 % de furos e caiu no molde |
| `baixo-shorts-aceito.jpg` | o short depois do aceite de perna curta (4 %, como a manga curta), nos corpos F e M |

Fichas (produto do catálogo, `specs/`): jeans (Abercrombie High Rise Bootcut), tailored_pants (Zara Wide Leg de
Alfaiataria), casual_pants e cargo_pants (Carhartt WIP x Nicholas Daley), chino_pants (Everlane Straight Fit
Performance Chino), jogger_pants (Napapijri Malis Summer Joggers), sweatpants (Champion Powerblend Oversized),
leggings (Amaro Legging de Cós Alto), culottes (Le Lis Blanc Pantacourt Lydia Jeans), shorts (ASICS French Terry 5In),
bermuda_shorts (Baw Bermuda Cargo Classics, tabela de medidas da marca), denim_shorts (G-Star 3301 Slim Denim Shorts),
skirt (AllSaints Jax Pleated Midi, 24 pregas), skort (Skechers Ace 14" Pleated Skort). Cores não conferidas na foto
estão marcadas na `observacao` de cada ficha.

Aceite offline (`meshy-real.test.ts`): as 14 passam em 36/40/46. Na tela: a cintura de várias calças fica serrilhada
onde a camiseta padrão do laboratório encontra o cós (camadas, não a calça); jeans e legging ficam um pouco folgados no
quadril e no joelho; a costura do gancho mostra uma pequena fresta entre as pernas na prévia.
