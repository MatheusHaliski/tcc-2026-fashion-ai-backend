# FLAIR 3D: a cor da peça decide a ação

Definição da dona (13/11/2026, com as decisões de 14/11/2026 na seção 3): no Fashion Sports e no Fashion Detective, cada
cor de roupa corresponde a uma mecânica do jogo. Este documento registra o mapa, o que já está no servidor e o que ainda
é desenho.

Marcações: **[dona]** é o que ela definiu; **[proposta]** é o que completei para o mapa fechar e ela pode trocar;
**[feito]** está no código; **[desenho]** ainda não está.

A cor vem da família de cor da taxonomia (`Taxonomy.COLOR_FAMILY`): "verde" cobre verde, oliva, esmeralda, menta e os
outros tons da família. Quando a peça tem mais de uma cor, vale a primeira com ação, em ordem alfabética do código, para
o resultado ser sempre o mesmo. Peça sem família mapeada não tem ação. A cor da roupa nunca tem relação com pele, corpo
ou rosto.

## 1. Fashion Sports (vale para todos os esportes)

### 1.1 Mapa de cores

| Cor | Ação no futebol de 5 | Efeito no servidor | Origem |
| --- | --- | --- | --- |
| Preto | Defesa: desarme e carrinho | tira 1 gol do adversário no segundo tempo | [dona] [feito] |
| Verde | Chute a gol | gol se a técnica do uniforme + 5 alcança a força do adversário; senão o chute não entra | [dona] [feito] |
| Amarelo | Drible | +6 de força do time no segundo tempo | [dona] [feito] |
| Azul | Corrida | +4 de força do time no segundo tempo | [dona] [feito] |
| Vermelho | Passe | +3 de força do time no segundo tempo | [dona, 14/11] [feito] |
| Branco | Defesa do goleiro | tira 1 gol do adversário no segundo tempo | [dona, 14/11] [feito] |
| Outras | Sem ação | a troca só muda os atributos do uniforme | [feito] |

### 1.2 Quando a ação dispara

A dona pediu "uma ação imediata ao ser acionada na partida". A definição anterior do jogo dizia que a pessoa só troca a
vestimenta. As duas regras cabem juntas assim: **acionar uma carta é vestir a peça no time, e a peça que entra dispara
na hora a ação da cor dela.** A pessoa continua sem controlar jogador nenhum.

1. A entrega joga o primeiro tempo e a partida para no intervalo.
2. No segundo tempo, cada troca de peça é um lance: a ação da cor acontece na hora (evento `LANCE`) e a partida espera
   o lance seguinte.
3. São no máximo 3 lances. Seguir sem trocar, trocar por uma peça sem cor de ação ou o terceiro lance apita o fim e sai
   o placar.
4. A peça que entra fica vestida: os atributos dela também contam no resto do segundo tempo.

Na tela, cada opção de troca mostra a ação: "Parte de cima: Regata cinza no lugar de Camisa verde · chute a gol". A
carta no deck mostra o mesmo selo.

### 1.3 Os outros esportes [feito]

A mesma cor mantém o mesmo papel em todo esporte, para a pessoa aprender uma vez só. A pessoa escolhe a modalidade na
aba Modalidade antes de entregar; sem escolha, vale o futebol de 5.

| Cor | Papel | Tênis | Basquete 3×3 | Vôlei de praia | Corrida e revezamento | Skate |
| --- | --- | --- | --- | --- | --- | --- |
| Preto | Defender | devolução defensiva | toco | bloqueio | segurar a posição | equilíbrio na aterrissagem |
| Verde | Finalizar | winner | arremesso | cortada | sprint final | manobra principal |
| Amarelo | Enganar | deixadinha | drible e crossover | largada | mudança de ritmo | flip |
| Azul | Deslocar | chegada na bola | infiltração | cobertura de quadra | ritmo de prova | velocidade na rampa |
| Vermelho | Ligar | saque | assistência | levantamento | passagem do bastão | linha entre manobras |
| Branco | Guardar | segundo saque seguro | rebote | defesa de manchete | largada segura | aterrissagem segura |

O que muda de um esporte para outro é o peso de cada atributo do uniforme na força do time:

| Modalidade | Velocidade | Técnica | Resistência | Defesa |
| --- | --- | --- | --- | --- |
| Futebol de 5 | 1 | 1 | 1 | 1 |
| Basquete 3×3 | 1 | 2 | 0 | 1 |
| Vôlei de praia | 0 | 2 | 1 | 1 |
| Tênis | 1 | 2 | 1 | 0 |
| Corrida e revezamento | 2 | 0 | 2 | 0 |
| Skate | 1 | 2 | 1 | 0 |

Cada modalidade tem o placar no jeito dela e a própria quadra [feito]:

| Modalidade | Placar | Quadra |
| --- | --- | --- |
| Futebol de 5 | gols | piso emborrachado azul, duas traves |
| Basquete 3×3 | pontos (12 de base e 3 por lance convertido) | piso de madeira, tabela na linha de fundo |
| Vôlei de praia | sets (2 para quem vence, no máximo 1 para o outro; 1 a 1 no empate) | piso cor de areia, rede alta |
| Tênis | sets, como no vôlei | piso verde, rede baixa |
| Corrida e revezamento | chegadas | pista vermelha, barreira na linha de fundo |
| Skate | nota (60 de base e 10 por lance convertido) | concreto, corrimão na linha de fundo |

**O que ainda é igual em todos:** a partida continua em dois tempos, o ginásio (arquibancada, banco e luzes) é o mesmo,
os figurantes são os do futebol e a bola continua em cena também na corrida e no skate. As quadras novas passam nas
regras automáticas das salas, mas ainda não foram vistas na tela.

## 2. Fashion Detective

### 2.1 Mapa de cores

| Cor | Ação do detetive | No servidor hoje | Origem |
| --- | --- | --- | --- |
| Verde | Abre gavetas e armários | evento `GAVETAS`: quantas peças verdes o look tem | [dona] [feito] |
| Preto | Furtividade ao andar e correr | evento `FURTIVIDADE`: 20 por peça | [dona] [feito] |
| Amarelo | Aumenta a barra de vida | evento `VIDA`: 20 por peça | [dona] [feito] |
| Azul | Aumenta o dano no confronto | evento `DANO`: 20 por peça | [dona] [feito] |
| Branco | Peça de pista | evento `CHAVE` (ver 2.2) | [dona] [feito] |
| Vermelho | Moeda de troca no mercado | selo na carta; qualquer carta fora do look pode ir ao balcão (ver 2.3) | [dona] [feito em parte] |

Os medidores entram no desafio de cada salão, que continua automático (decisão de 14/11/2026): o detetive passa quando
defesa + vida + dano alcançam o limite do salão, ou quando a furtividade chega a 40 e ele passa sem ser visto. A pessoa
segue fazendo uma coisa só: escolher a roupa. Não há combate nem movimentação comandados por ela.

### 2.2 O caso em 6 salões e as cartas de pista [feito]

A pessoa veste um look por salão. Cada salão vale 100: acesso 40 (2 peças ou mais do código de vestimenta), desafio 40 e
pista 20. A pista é a peça que a carta aponta, na cor e no lugar certos; quando ela está guardada num móvel, o look
precisa também de uma peça verde (ou da lanterna do mercado) para abrir. A pista só conta para quem entrou ou passou no
desafio.

| # | Salão | Código de vestimenta | Limite do desafio | Carta de pista | Peça pedida | Num móvel |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Entrada da gala | formal ou festa | 50 | "Sua mãe costumava deixar a chave no armário com a blusa branca." | branca, em cima | sim |
| 2 | Salão principal | formal, festa ou cerimônia | 55 | "Quem derrubou a taça saiu com um lenço vermelho na mão." | vermelha, qualquer lugar | não |
| 3 | Camarim | trabalho ou casual | 50 | "O recibo ficou na caixa dos sapatos amarelos." | amarela, calçado | sim |
| — | Mercado | | | | | |
| 4 | Clube underground | balada, festa ou festival | 60 | "Na porta do clube só passa despercebido quem veste preto em cima." | preta, em cima | não |
| 5 | Ateliê | trabalho ou casual | 55 | "O molde está na gaveta, junto da calça azul." | azul, parte de baixo | sim |
| 6 | Arquivo | formal ou trabalho | 65 | "A resposta está na pasta de capa verde, no fundo do arquivo." | verde, qualquer lugar | sim |

- A nota do caso é a média dos 6 salões. Com 5 pistas ou mais o caso é resolvido; com 3 ou 4, resolvido em parte.
- Salão sem acesso e sem desafio não trava o caso: o detetive segue para o próximo, sem a pista.
- O deck do caso passou de 6 para até 12 cartas, porque são 6 looks.
- Na tela, a dica da preparação mostra o salão da vez, o código de vestimenta e a carta de pista.

**Cenário e abertura de cada salão [feito]:** os 6 salões dividem a mesma planta (passadeira até a porta dupla do
fundo) e cada um tem os próprios materiais, móveis e luz: mármore e veludo na entrada, bancos e dois lustres no salão
principal, araras e cadeiras no camarim, tijolo, néon e caixotes no clube, bancadas e rolos de tecido no ateliê,
gaveteiros de metal no arquivo. Antes de escolher o look, um cartão de abertura apresenta o salão, o código de
vestimenta e a carta de pista; ele fica sobre a faixa do deck, nunca sobre a roupa, e fecha sozinho ou no botão.

**Abertura animada [feito]:** a cada salão, a câmera começa alta e aberta, mostrando o salão e a porta do fundo, passa
pela lateral e assenta no enquadramento normal do avatar, em 6 segundos. Enquanto isso o detetive entra andando pela
passadeira, de costas para a câmera, vira e posa; os convidados acenam, o segurança se posiciona e a luz do lugar
acende. Com "reduzir movimento" ligado não há travelling nem entrada: a cena já aparece no enquadramento normal.

**O que ainda não existe:** falas, legendas dentro da cena 3D e cutscene do resultado diferente por salão (o resultado
usa a mesma sequência nos 6: o detetive vai até a porta e ela abre ou não). Os salões novos e a abertura passam nos
testes automáticos, mas ainda não foram vistos na tela.

### 2.3 Roupa como moeda: estalecas e mercado [feito]

Exemplo da dona: o detetive vai ao mercado do mapa, troca 500 estalecas por uma peça vermelha e usa estalecas para
comprar equipamento e desbloquear recursos. Decisões de 14/11/2026: estaleca é moeda só do caso e o mercado não vende
arma.

- **Estaleca é moeda só do caso.** Começa em zero e some no fim. Não é o saldo da carteira do FashionAI, não se compra
  com dinheiro e não vira prêmio.
- **Ganhar estalecas:** acesso ao salão (+150), pista do salão (+200) e gaveta aberta por peça verde (+50 cada).
- **O mercado fica no mapa entre o salão 3 e o salão 4.** A partida para ali uma vez por caso.
- **Deixar uma carta no balcão:** uma carta do deck que não está no look vale estalecas pelo nível (Bronze 100,
  Prata 200, Ouro 350, Especial 500). A carta sai só do deck desta partida; a carta da coleção não é gasta nem
  transferida. Carta vestida é recusada.
- **Compras automáticas:** o detetive compra sozinho o que precisa, uma de cada no máximo.

  | Compra | Preço | Quando compra | Efeito |
  | --- | --- | --- | --- |
  | Peça da cor da próxima pista | 500 | o deck não tem peça preta de cima para a pista do salão 4 | vale como a peça da pista no salão 4 |
  | Colete de proteção | 300 | o desafio do salão 3 não passou | +20 de defesa nos salões seguintes |
  | Lanterna | 150 | o móvel do salão 3 não abriu | abre os móveis dos salões seguintes sem peça verde |

  A peça comprada é do caso: não vira carta da coleção.

## 3. Decisões da dona (14/11/2026: "siga o recomendado")

1. **Furtividade, vida e dano** só alimentam medidores. O confronto e a caminhada continuam automáticos, em cutscene.
2. **Sem arma no mercado.** O mercado vende equipamento de investigação e proteção. O dano vem só da roupa azul.
3. **Estalecas** são moeda só do caso: zeram no fim, não tocam a carteira e não gastam a carta da coleção.
4. **Fashion Sports** fica com até 3 lances no segundo tempo; o primeiro tempo roda sem lances.
5. **Vermelho é passe e branco é goleiro** nos esportes.

Com isso, as regras antigas do jogo 6 em `JOGOS.md` (sem combate, sem movimentação e sem arma na mão do usuário)
continuam valendo.

## 4. Onde está no código

| O quê | Arquivo |
| --- | --- |
| Tabelas cor → ação | `fai-application/.../flair3d/Flair3dCores.java` |
| Lances do segundo tempo | `fai-application/.../flair3d/nucleos/FashionSportsLances.java` |
| Mercado e estalecas | `fai-application/.../flair3d/nucleos/FashionDetectiveMercado.java` |
| Os 6 salões e um salão jogado | `.../nucleos/FashionDetectiveCaso.java`, `.../nucleos/FashionDetectiveSalao.java` |
| Modalidades do esporte | `.../nucleos/FashionSportsModalidade.java` |
| Salões e quadras em 3D | `lib/flair/nucleos/scene/salas/fashion-detective-saloes.ts`, `fashion-sports-quadras.ts`, `scene/registry.ts` (`salaDe`) |
| Abertura do salão | cartão: `components/flair/nucleos/nucleo-cutscene.tsx`; câmera e personagens: `lib/flair/nucleos/scene/opening.ts`, `components/flair/nucleos/scene/opening-camera.tsx` |
| Salões já jogados da partida | `fai-application/.../flair3d/Andamento.java` (`anteriores`) |
| Eventos e selos do detetive | `fai-application/.../flair3d/nucleos/FashionDetectiveNucleo.java` |
| Testes | `fai-application/src/test/.../flair3d/Flair3dCoresTest.java`, `FashionDetectiveCasoTest.java` |
| Rótulo da ação na troca | `components/flair/nucleos/nucleo-trigger.tsx` |
| Textos | `lib/i18n/messages/*.json`: `flair3d.ui.acaoCor.*`, `flair3d.ui.efeito.ACAO_*`, `flair3d.ui.efeito.COR_*` |
