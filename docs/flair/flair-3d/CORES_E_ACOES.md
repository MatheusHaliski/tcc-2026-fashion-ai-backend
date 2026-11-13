# FLAIR 3D: a cor da peça decide a ação

Definição da dona (13/11/2026): no Fashion Sports e no Fashion Detective, cada cor de roupa corresponde a uma mecânica do
jogo. Este documento registra o mapa, o que já está no servidor e o que ainda é desenho.

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
| Vermelho | Passe | +3 de força do time no segundo tempo | [proposta] [feito] |
| Branco | Defesa do goleiro | tira 1 gol do adversário no segundo tempo | [proposta] [feito] |
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
| Vermelho | Moeda de troca no mercado | só o selo na carta (ver 2.3) | [dona] [desenho] |

Os eventos aparecem na ação do Salão 1 e o selo aparece em cada carta do deck. **A nota do salão ainda é a de antes**
(acesso de gala + defesa): furtividade, vida e dano ainda não mudam o resultado. Isso depende da decisão do item 3.

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

### 2.3 Roupa como moeda: estalecas e mercado [desenho]

Exemplo da dona: o detetive vai ao mercado do mapa, troca 500 estalecas por uma peça vermelha e usa estalecas para
comprar uma arma nova e desbloquear recursos.

- **Estaleca é moeda só do caso.** Começa em zero a cada caso e some no fim. Não é o saldo da carteira do FashionAI,
  não se compra com dinheiro e não vira prêmio. Assim seguem valendo as regras do FLAIR: o erro nunca tira saldo e não
  há compra paga de vantagem.
- **Ganhar estalecas:** pista inteira (+200), salão favorável (+150), gaveta aberta por peça verde (+50).
- **Trocar no mercado:** uma peça do deck que a pessoa escolhe deixar no balcão vale estalecas pelo nível da carta
  (Bronze 100, Prata 200, Ouro 350, Especial 500). A carta sai só do deck desta partida; a carta da coleção da pessoa
  não é gasta nem transferida.
- **Comprar no mercado:** uma peça de cor que falta para uma pista (a peça vermelha de 500 estalecas do exemplo), um
  recurso do caso (lanterna, chave mestra, mapa do salão) ou um equipamento.
- **Mapa:** o mercado é um ponto fixo entre o salão 3 e o salão 4, visitado uma vez por caso, para o jogo caber nos 45
  minutos.

## 3. O que precisa da decisão da dona

O pedido novo muda três regras que ela mesma tinha escrito para o Fashion Detective. Segui o pedido novo no mapa de
cores, mas não construí as partes abaixo sem a confirmação dela:

1. **Furtividade, barra de vida e dano.** A regra anterior (JOGOS.md, jogo 6, e a diretriz geral do FLAIR 3D) dizia: sem
   mecânica de furtividade, combate e busca por recursos; o usuário "não realiza combate, não realiza movimentação".
   Proposta que respeita as duas: as cores só alimentam medidores, e o confronto e a caminhada continuam automáticos, em
   cutscene. A pessoa segue fazendo uma coisa só: escolher a roupa.
2. **Comprar arma.** A regra anterior dizia que o detetive "não empunha a arma, aponta a arma, não realiza nenhuma ação
   de combate com arma", e o app é para 13 anos ou mais. Proposta: o mercado vende equipamento de investigação e
   proteção (lanterna, lupa, colete, chave mestra) e o dano continua vindo só da roupa azul. Se a dona quiser arma
   mesmo, ela entra só na cutscene automática e a classificação etária precisa ser revista.
3. **Fashion Sports deixou de ser 100% automático.** Antes a pessoa só trocava peça no intervalo, uma vez. Agora cada
   troca do segundo tempo é um lance com ação imediata (até 3). Confirmar se 3 lances é o número certo e se o primeiro
   tempo também deve ter lances.
4. **Cores que completei** (vermelho = passe e branco = goleiro no esporte): manter ou trocar.

## 4. Onde está no código

| O quê | Arquivo |
| --- | --- |
| Tabelas cor → ação | `fai-application/.../flair3d/Flair3dCores.java` |
| Lances do segundo tempo | `fai-application/.../flair3d/nucleos/FashionSportsLances.java` |
| Eventos e selos do detetive | `fai-application/.../flair3d/nucleos/FashionDetectiveNucleo.java` |
| Testes | `fai-application/src/test/.../flair3d/Flair3dCoresTest.java` |
| Rótulo da ação na troca | `components/flair/nucleos/nucleo-trigger.tsx` |
| Textos | `lib/i18n/messages/*.json`: `flair3d.ui.acaoCor.*`, `flair3d.ui.efeito.ACAO_*`, `flair3d.ui.efeito.COR_*` |
