# Cenas dinâmicas dos elencos e dos Desafios de Montagem

O desenho de cada elenco e de cada Desafio de Montagem é uma **cena 2D animada** (canvas), e essa cena **é o
quebra-cabeça**: cada peça é uma janela para a mesma animação, com uma só base de tempo. O elemento que sai de uma
peça encaixada entra na vizinha sem emenda e some onde a peça falta.

Direção de arte pedida pelo dono: "simples, porém ultra sofisticados e tecnológicos". Por isso: poucas formas,
espaço negativo, geometria precisa, linhas finas de luz, vidro com brilho suave, paleta contida (uma luz e um ou dois
acentos), movimento liso e com propósito (deslizar por túneis, pulsos de luz pelos trilhos). Nada de traço infantil:
o elenco é facetado e geométrico (`lib/flair/cenas/formas*.ts`), e as marcas do FashionAI vêm dos próprios ícones do
app (`/icons/fai`), sem emoji de terceiros nem marca real.

## Motor

`lib/flair/cenas/` (cada arquivo dentro do limite de linhas):

| Arquivo | Papel |
| --- | --- |
| `tipos.ts` | o que é uma cena: paleta, trilhos (túnel de vidro, fio, pontes, mangas, pulsos), elenco por grupo, giros, enfeites |
| `caminho.ts` | geometria pura: lê o caminho SVG (M L H V C Q Z), amostra e dá posição e direção em qualquer fração |
| `motor.ts` | onde está cada viajante, pulso e giro no instante t; pontes automáticas onde um trilho passa por cima de outro |
| `pintura.ts` | pintor: o que é parado vira camadas pintadas uma vez; a cada quadro só empilha camadas e carimba o elenco |
| `sprites.ts` | carimbos do elenco (formas e ícones do app) pintados uma vez por tamanho |
| `pecas.ts` | recorte das peças, contorno, folga (solta, quase, encaixada) e véu por estado; cada peça copia só a caixa dela |
| `tons.ts` | o quadro sem cor e com meia cor, pintados uma vez por quadro (meia resolução) para as peças soltas e quase no lugar |
| `palco.ts` | junta pintor e peças, com a mola das peças e o floreio da arte completa |
| `relogio.ts`, `batida.ts` | base de tempo única (o relógio do navegador) e uma só batida de quadros para todas as cenas da página |
| `variante.ts` | a mesma cena com o matiz girado e espelhada (ver "Quem usa cada cena") |
| `cenas/*.ts` | **um arquivo de definição por cena** (só dados) |

Ligação com a tela: `components/flair/cenas/use-cena-viva.ts` e `cena-viva.tsx` (com a taxa adaptativa: se pintar
custa em média mais de 9 ms no aparelho, a cena pinta a ~30 qps, sempre no instante do relógio; miniaturas na
densidade 1).

- **Laço sem emenda**: todo grupo anda em fração do trilho com período próprio; em trilho fechado dá a volta, em
  trilho aberto o viajante surge e some em fade nas pontas (nunca aparece de repente). Fases escalonadas por grupo.
- **Por cima e por baixo**: trilhos com `sobre` ganham pontes nos cruzamentos; `mangas` cobrem o viajante (portal
  da máquina, por trás do lustre). O viajante sobe de nível junto com a ponte.
- **Movimento reduzido** (sistema ou app): um quadro parado rico (`Cena.quadro`), sem batida; as peças mudam de lugar
  na hora.
- **Pausa**: fora da tela (IntersectionObserver) ou com a aba escondida, a cena sai da batida; ao voltar, retoma no
  tempo certo (o relógio é o do navegador).
- **Acessibilidade**: `role="img"` com rótulo que descreve a cena e o andamento ("Quebra-cabeça de 9 peças: 4
  encaixadas, 2 quase no lugar, 1 solta e 2 faltando"); miniaturas são decorativas (o texto do cartão já diz).

## O quebra-cabeça

Uma peça por vaga (desafios) ou por linha (elencos), como antes:

| Estado | Na tela |
| --- | --- |
| vaga vazia (`coberta`) | sem peça: contorno tracejado no escuro, a cena não aparece ali |
| carta posta, servidor ainda não julgou (`chegando`) | a peça entra de fora e fica perto, cinza e escura |
| link fraco / sintonia 0–1 (`vermelha`) | peça solta, torta, cinza e escura, contorno vermelho |
| link médio / sintonia 2 (`laranja`) | quase no lugar, com parte da cor, contorno laranja |
| link forte / sintonia 3 (`verde`) | encaixada, cor inteira |
| entrega completa | as linhas de corte somem, os túneis acendem e o elenco acelera e assenta (floreio de 2,8 s) |

O servidor continua juiz: a peça fica `chegando` até o `/conferir` (elencos) ou o `/check` (desafios) responder para
as cartas de agora.

## As dez cenas

| Cena | Conceito | Elenco em movimento | Paleta | Quadros |
| --- | --- | --- | --- | --- |
| Túneis de cor (`tuneis-de-cor`) | três túneis de vidro que se trançam, cada um por cima de um e por baixo do outro | batons, perfumes, esmaltes, pincéis, pós, rímeis | rosa `#ff5c9f`, lilás `#9a86ff`, água `#4fe0d2`, ouro | `cenas/tuneis-de-cor-1.jpg`, `-2.jpg` |
| Zigue-zague FashionAI (`zigue-zague`) | três trilhos de luz em zigue-zague, cada um num ritmo e num sentido | as marcas do app (curtir, favoritar, reações, FAI Points) em medalhões | magenta, turquesa, âmbar sobre quase preto | `cenas/zigue-zague-*.jpg` |
| Túneis de moda (`tuneis-de-moda`) | túneis feitos de moda: zíper, cinto com fivelas, fita de cetim em laço | raposa de lenço, cisne de colar, gato de gravata-borboleta, garça com bolsa | esmeralda, ouro, coral | `cenas/tuneis-de-moda-*.jpg` |
| Linha de cabides (`linha-de-cabides`) | mapa de metrô: linhas retas e viradas de 45°, estações em anel | cabides pendurados com blusa, vestido e calça | céu, coral, areia | `cenas/linha-de-cabides-*.jpg` |
| Relojoaria do ateliê (`relojoaria`) | engrenagens e carretéis engatados, órbitas de luz e uma correia | tesouras, dedais, agulhas, botões | ouro, violeta, gelo | `cenas/relojoaria-*.jpg` |
| Rio de tecido (`rio-de-tecido`) | três rolos de tecido que se desenrolam em faixas, em ondas | contas e botões rolando na correnteza | água, areia, rosa | `cenas/rio-de-tecido-*.jpg` |
| Tear de luz (`tear`) | urdidura reta e trama em ondas, ora pela frente, ora por trás | agulhas levando a trama | rosê, gelo, índigo | `cenas/tear-*.jpg` |
| Escadaria de saltos (`escadaria`) | três lances de escada de luz sob lustres | sapatos de salto subindo degrau a degrau | ouro, rubi | `cenas/escadaria-*.jpg` |
| Esteira de costura (`esteira`) | três esteiras de vidro com portais de máquina de costura e pesponto | camisetas e vestidos que somem no portal e saem do outro lado | lima, branco, azul | `cenas/esteira-*.jpg` |
| Corrida de contas (`corrida-de-contas`) | pista de bolinhas: rampas de vidro em zigue-zague e um laço | botões e contas rolando | violeta, rosa, sol | `cenas/corrida-de-contas-*.jpg` |

Cada par `-1`/`-2` são dois instantes da mesma cena (1,2 s de diferença): o script de conferência verifica que os
quadros 0, 1,2 e 2,4 s são diferentes (movimento) e os testes verificam que o laço fecha sem salto.

## Quem usa cada cena (nenhum uso repete o desenho)

São vinte usos: os cinco elencos e os quinze cenários dos desafios. Cada cena aparece uma vez como é e uma vez como
**variante** (`variante.ts`: matiz girado e espelhada na horizontal; o elenco continua de pé e legível, só anda para o
outro lado). O teste `variante.test.ts` garante que os vinte desenhos são diferentes.

| Cena | Como é | Variante |
| --- | --- | --- |
| Túneis de cor | elenco Paleta do Ateliê | cenário `semana` (matiz +200°) |
| Zigue-zague FashionAI | elenco Casa da Marca | cenário `festival` (+70°) |
| Túneis de moda | cenário `casamento` | cenário `primavera` (−60°) |
| Linha de cabides | elenco Primeiro Elenco | cenário `brecho` (+35°) |
| Relojoaria do ateliê | elenco Elenco Lendário | cenário `halloween` (+150°) |
| Rio de tecido | cenário `ipanema` | cenário `armario` (+190°) |
| Tear de luz | cenário `paris` | cenário `serra` (+90°) |
| Escadaria de saltos | elenco Noite de Estreia | cenário `gala` (+200°) |
| Esteira de costura | cenário `estagio` | cenário `desfile` (+160°) |
| Corrida de contas | cenário `carnaval` | cenário `popup` (−45°) |

As vinte lado a lado: `cenas/variantes-1.jpg` e `cenas/variantes-2.jpg` (à esquerda como é, à direita a variante).
Onde aparece: tela do elenco (`components/flair/elencos`), tela do desafio (`components/flair/cbc-play.tsx`, no lugar
da antiga `cbc-scene.tsx`) e miniaturas animadas nas listas de elencos e de desafios (`cenas/tela-lista-desafios.jpg`).

## Pôr carta: simples, fluido e direto

A bandeja de cartas (`components/flair/montagem/bandeja.tsx`) fica presa embaixo da tela, ao alcance do polegar, e
mostra as cartas da **vaga em destaque**. A primeira vaga vazia já começa em destaque.

- **Um toque põe**: tocar numa carta põe na vaga e o destaque passa para a próxima vaga vazia.
- **Outra vaga**: tocar na vaga (a bandeja troca para as cartas dela) e tocar na carta; ou arrastar a carta da
  bandeja até qualquer vaga.
- **Trocar**: arrastar a carta de uma vaga para outra (as duas trocam); na bandeja, a carta que está em outra vaga diz
  "em outra vaga: troca".
- **Tirar**: arrastar a carta da vaga para a bandeja, ou o botão Tirar.
- **Desfazer** a última jogada: botão ou tecla Z. A montagem fica guardada no aparelho entre visitas.
- **Cartas que não cabem** ficam apagadas com o motivo numa linha ("É Acessório; a vaga pede Parte de cima").
- **Teclado e controle** (elencos e desafios, `use-cbc-controle.ts` nos desafios): setas ou direcional escolhem a
  vaga, Espaço ou A entra na bandeja, setas escolhem a carta, Espaço ou A põe (o destaque segue para a próxima vaga
  vazia), Backspace ou B sai da bandeja ou tira a carta; Z desfaz. Tab e Enter também funcionam (tudo é botão).
- Sem confirmação, sem gaveta abaixo da dobra, sem salto de layout. Quando o destaque passa para uma vaga que ficaria
  atrás da bandeja, a página rola só o que falta para ela aparecer (`use-vaga-a-vista.ts`; imediato com movimento
  reduzido).
- A carta entra com transição, as linhas acendem na cor do link e a peça do quebra-cabeça reage na hora (entra como
  `chegando` e assenta quando o servidor responde).

**Interações para pôr uma carta** (medido com o app rodando sobre a API simulada, Playwright, 390×844):

| | Antes | Agora |
| --- | --- | --- |
| Desafio, próxima vaga | 2 toques (vaga, depois a carta num diálogo que cobria o tabuleiro) | **1 toque** (a vaga já está em destaque) |
| Desafio, 5 vagas | 10 toques, tabuleiro escondido a cada escolha | **5 toques**, tabuleiro e peças à vista o tempo todo |
| Elenco, próxima vaga | 2 toques e 2 rolagens (a gaveta abria abaixo do tabuleiro, fora da tela no celular) | **1 toque** |
| Qualquer vaga | 2 toques + rolagem | 2 toques (vaga, carta) ou 1 arrasto |

Telas: `cenas/tela-desafio-celular-inicio.jpg`, `-2-cartas.jpg`, `-5-cartas.jpg`, `cenas/tela-desafio-computador.jpg`
(1440×900), `cenas/tela-elenco-celular-inicio.jpg`, `-completo.jpg`, `cenas/tela-elenco-computador.jpg`, `cenas/tela-desafio-tema-escuro.jpg`,
`cenas/tela-desafio-alto-contraste.jpg`. Quebra-cabeça: `cenas/quebra-cabeca-vazio.jpg`, `-parcial.jpg`,
`-completo.jpg`.

## Desempenho

Duas medições, ambas no Chromium headless (Playwright), sem GPU (rasterização em software, o caso pessimista):

**1. O app de verdade** (`next dev`, API simulada, 390×844, densidade 2), quadros por segundo da página medidos por
`requestAnimationFrame` durante 4 s, com a CPU desacelerada pelo DevTools (4× ≈ celular médio, 6× ≈ celular fraco):

| Tela | CPU 1× | CPU 4× | CPU 6× |
| --- | --- | --- | --- |
| Lista de desafios (2 miniaturas animando na tela) | 60 qps | 60 qps (era 28 antes das miniaturas na densidade 1 e da taxa adaptativa) | — |
| Desafio com 3 cartas postas (quebra-cabeça) | 60 qps | 43 qps (era 37), cena a ~30 qps | 20 qps |

**2. O motor sozinho** (página isolada, tela de 672 px, ms por quadro com leitura forçada do canvas a cada quadro,
que obriga a rasterizar tudo): cena inteira / quebra-cabeça de 9 peças / de 17 peças, em estados misturados.

| Cena | CPU 1× | CPU 4× | CPU 6× |
| --- | --- | --- | --- |
| Túneis de cor | 1,8 / 7,5 / 8,4 | 9,7 / 26,9 / 30,3 | 12,6 / 60,1 / 65,3 |
| Zigue-zague | 4,7 / 10,9 / 8,8 | 5,2 / 32,6 / 35,8 | 10,3 / 47,6 / 63,1 |
| Túneis de moda | 1,6 / 6,9 / 9,8 | 6,5 / 27,1 / 31,5 | 9,7 / 56,0 / 80,5 |
| Linha de cabides | 1,3 / 7,6 / 9,0 | 6,0 / 37,6 / 43,9 | 16,7 / 64,8 / 55,7 |
| Relojoaria | 2,5 / 7,8 / 9,0 | 16,8 / 53,7 / 60,0 | 21,0 / 64,0 / 77,0 |
| Rio de tecido | 1,6 / 7,6 / 9,2 | 6,8 / 35,8 / 50,7 | 12,7 / 56,9 / 64,3 |
| Tear | 2,3 / 7,9 / 10,2 | 8,8 / 34,6 / 41,2 | 15,5 / 61,8 / 66,7 |
| Escadaria | 1,3 / 6,8 / 9,8 | 7,1 / 31,8 / 37,6 | 6,0 / 51,2 / 55,0 |
| Esteira | 1,7 / 7,8 / 7,6 | 6,3 / 34,6 / 35,9 | 9,7 / 46,5 / 67,8 |
| Corrida de contas | 1,5 / 11,4 / 8,7 | 7,6 / 36,3 / 38,7 | 10,9 / 54,9 / 63,6 |

Leitura: a cena inteira (miniaturas, arte completa) é barata; o quebra-cabeça custa de 7 a 11 ms por quadro sem
desaceleração e passa de 30 ms a 4×, por isso a taxa adaptativa leva a cena a ~30 qps nesses aparelhos. As
variantes custam o mesmo que a cena de origem (só mudam cores e coordenadas). Num celular de verdade o canvas 2D é
acelerado pela GPU e o custo de pixel cai; essa medição não foi feita num aparelho físico.

Por que é barato: fundo, túneis e enfeites são pintados uma vez em camadas; cada quadro só empilha camadas e carimba
o elenco já pintado (`drawImage`). Todas as cenas da página dividem uma só batida de `requestAnimationFrame`, e a cena
fora da tela ou com a aba escondida não pinta.

## O que ainda fica abaixo do padrão

- A variante é a mesma coreografia com outra luz e espelhada: os vinte usos são diferentes, mas há dez coreografias.
  Uma cena própria para cada cenário dos desafios seria o passo seguinte.
- Esteira de costura e Escadaria de saltos são as composições mais retas; funcionam como miniatura, mas têm menos
  profundidade (por cima e por baixo) que as cenas de túneis.
- O rótulo de leitura usa o nome da cena base também na variante.
- O desempenho foi medido com CPU desacelerada no computador, não num celular de verdade. A 6× (celular fraco) a
  tela do desafio fica em ~20 qps; o próximo passo seria baixar a densidade do quebra-cabeça nesses aparelhos.
- Os tons sem cor ficam em meia resolução: a peça solta fica levemente mais suave que a encaixada (de propósito, mas
  vale olhar num aparelho).
- Os quadros das telas foram tirados com a API simulada (`scripts` de conferência fora do repositório), não com dados
  reais.
