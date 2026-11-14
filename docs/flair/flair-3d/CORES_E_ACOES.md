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

### 1.3 Os outros esportes [proposta] [desenho]

A mesma cor mantém o mesmo papel em todo esporte, para a pessoa aprender uma vez só.

| Cor | Papel | Tênis | Basquete 3×3 | Vôlei de praia | Corrida e revezamento | Skate |
| --- | --- | --- | --- | --- | --- | --- |
| Preto | Defender | devolução defensiva | toco | bloqueio | segurar a posição | equilíbrio na aterrissagem |
| Verde | Finalizar | winner | arremesso | cortada | sprint final | manobra principal |
| Amarelo | Enganar | deixadinha | drible e crossover | largada | mudança de ritmo | flip |
| Azul | Deslocar | chegar na bola | infiltração | cobertura de quadra | ritmo de prova | velocidade na rampa |
| Vermelho | Ligar | saque | assistência | levantamento | passagem do bastão | linha entre manobras |
| Branco | Guardar | segundo saque seguro | rebote | defesa de manchete | largada segura | segurança |

Hoje o servidor só simula o futebol de 5; os outros esportes entram como rodadas (`OBJETIVOS_POR_JOGO.md`).

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

Os medidores entram no desafio do salão, que continua automático (decisão de 14/11/2026): o detetive passa quando
defesa + vida + dano somam 50, ou quando a furtividade chega a 40 e ele passa sem ser visto. A pessoa segue fazendo uma
coisa só: escolher a roupa. Não há combate nem movimentação comandados por ela.

### 2.2 Pistas

Exemplo da dona: o detetive lê a carta "Sua mãe costumava deixar a chave no armário com a blusa branca". A pessoa
entende que precisa da blusa branca para achar a chave que abre uma porta.

- [feito] Salão 1: o look rende a chave (evento `CHAVE`) quando tem uma peça branca na parte de cima (a blusa da carta)
  e uma peça verde, que abre o armário.
- [desenho] Cada salão traz uma carta de pista diferente, escrita com uma cor ou uma peça ("o recibo estava no bolso do
  casaco vinho"). A pista certa abre a porta, o cofre ou a gaveta do salão seguinte. A carta nunca diz a cor de forma
  direta em todos os casos: às vezes diz a peça, a ocasião ou o material.
- [desenho] Pista errada não trava o caso: o detetive entra por outro caminho e perde a metade da pista, como na tabela
  de acesso e desafio do jogo 6.

### 2.3 Roupa como moeda: estalecas e mercado

Exemplo da dona: o detetive vai ao mercado do mapa, troca 500 estalecas por uma peça vermelha e usa estalecas para
comprar equipamento e desbloquear recursos. Decisões de 14/11/2026: estaleca é moeda só do caso e o mercado não vende
arma.

- **Estaleca é moeda só do caso.** Começa em zero e some no fim. Não é o saldo da carteira do FashionAI, não se compra
  com dinheiro e não vira prêmio. [feito]
- **Ganhar estalecas:** acesso ao salão (+150) e gaveta aberta por peça verde (+50 cada). [feito]
- **Deixar uma carta no balcão:** uma carta do deck que não está no look vale estalecas pelo nível (Bronze 100,
  Prata 200, Ouro 350, Especial 500). A carta sai só do deck desta partida; a carta da coleção não é gasta nem
  transferida. Carta vestida é recusada. [feito]
- **Compras automáticas:** o detetive compra sozinho o que precisa, uma de cada no máximo. [feito]

  | Equipamento | Preço | Quando compra | Efeito |
  | --- | --- | --- | --- |
  | Chave mestra | 500 | falta a chave | rende a chave do salão |
  | Colete de proteção | 300 | o desafio não passa | +20 de defesa |
  | Lanterna | 150 | nenhuma gaveta abriu | abre 1 gaveta |

- **Como anda a partida:** a entrega mostra os medidores e para no mercado; a pessoa deixa uma carta no balcão ou
  segue; o salão fecha com o resultado. [feito]
- [desenho] Comprar uma peça de cor que falta para uma pista (a peça vermelha de 500 estalecas do exemplo) e o mercado
  como ponto do mapa entre o salão 3 e o salão 4. Hoje só existe o Salão 1, então o mercado fica dentro dele.

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
| Eventos e selos do detetive | `fai-application/.../flair3d/nucleos/FashionDetectiveNucleo.java` |
| Testes | `fai-application/src/test/.../flair3d/Flair3dCoresTest.java` |
| Rótulo da ação na troca | `components/flair/nucleos/nucleo-trigger.tsx` |
| Textos | `lib/i18n/messages/*.json`: `flair3d.ui.acaoCor.*`, `flair3d.ui.efeito.ACAO_*`, `flair3d.ui.efeito.COR_*` |
