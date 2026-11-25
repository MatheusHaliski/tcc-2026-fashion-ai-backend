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

## Partes de cima: uma por subcategoria (19)

| Arquivo | O que mostra |
|---|---|
| `cima-previas-20.jpg` | prévias do motor das fichas de cima (as 19 subcategorias de `upper_piece` + o moletom fechado) |
| `cima-provador.jpg` | as peças de cima no provador, frente e ¾ (corpo do sexo da ficha) |
| `cima-v-antes-depois.jpg` | blazer, casaco, cardigã e colete: antes (dobra no V, remendo cinza) e depois (V aberto pelas bordas, lapela) |

Construções novas no motor: sem manga (alça e cava curva), V aberto com lapela, vista curta da polo, frente aberta do
quimono e body fechado no gancho. Fichas de produtos do catálogo (cores não conferidas marcadas na `observacao`).

Provador: a pele vista por uma abertura da peça (decote V, cava, frente aberta) contava como "furo" e virava forro —
o pano mais à frente ali é o das costas. Agora, onde há uma camada só e ela está atrás da pele, a pele fica à mostra
(`glb-garment/cover.ts`, `ONE_LAYER`). Aceite offline: as 20 de cima e as 14 de baixo passam em P/M/GG. No V do
blazer, do casaco e do cardigã aparece a peça de baixo padrão do laboratório (cinza), não a pele: a cena completa o
look com ela.

## Golas por peça e regatas (25/11, fim do dia)

| Arquivo | O que mostra |
|---|---|
| `golas-previas.jpg` | top, regata e body com viés; polo com gola de malha; cardigã com ribana no V e na nuca; quimono com faixa na frente toda; camiseta com careca baixa; blusa com viés |
| `golas-e-regatas-provador.jpg` | as mesmas no provador |
| `regatas-cava-baixa.jpg` | top, body e colete com a alça baixa (1,5 cm) e a cava 3 cm abaixo da axila |

Ainda aparecem: pequenas abas na axila do top cropped e pontinhas no alto das alças, onde a alça encontra o decote
(top, body, colete).

## Peças de baixo: forma e acabamento (25/11, noite)

| Arquivo | O que mostra |
|---|---|
| `jeans-detalhes.jpg` | jeans de perto (frente, ¾, costas): J da braguilha, boca curva do bolso com rebites, bolsinho de moeda, cós e pala com pesponto, bolsos de trás com arcos, linha dourada (o tom ciano é da importação no render de detalhe) |
| `baixo-provador-acabamento.jpg` | as 14 de baixo no provador, frente, ¾ e costas |
| `shorts-barra.jpg` | short, bermuda e short jeans com a barra a 88–90 % da coxa |

Forma: a seção da calça vai para trás (frente mais reta, assento mais cheio) e a curva cintura → quadril → gancho não
tem quina — a frente deixou de parecer estufada. Acabamento em todas: pesponto no cós, barra com pesponto duplo, J da
braguilha e boca do bolso; jeans com o kit de cinco bolsos; alfaiataria com o vinco da perna.

Ainda não está bom: short e bermuda ficam folgados e com volume no quadril no corpo, e a barra amassa de um lado.
