# Fashion Detective: a história do caso "A Coleção Maré"

Pedido da dona (15/11/2026): refazer o Fashion Detective como um mundo interligado de pelo menos 8 salas, com história
original, elenco numerado, quatro atos, pistas em papel com texto exato, cadeia de dedução justa e finais completo e
parcial, sem beco sem saída. Este documento vem antes do código (o jogo é montado a partir dele). Todos os nomes, casas,
marcas e lugares são inventados; nenhuma pessoa, marca ou jogo real é retratado.

Público a partir de 13 anos: o crime é furto, falsificação e sabotagem. Não há assassinato, ferimento, sangue nem arma.
Ninguém é preso em cena: o desfecho é a verdade dita em público e a coleção devolvida a quem a criou.

## 1. A premissa

Noite de gala no **Palácio Lumen**, onde a **Maison Varela** apresenta a coleção **Maré**, a última da estilista
Iolanda Varela antes de passar a casa adiante. Às 21h40, uma hora antes do desfile, Iolanda descobre que o cofre do
arquivo foi aberto: sumiram o caderno de croquis da Maré e o jogo de moldes originais em papel kraft. No camarim, o
vestido que abre o desfile aparece com a barra descosturada. E uma jornalista recebe um certificado, assinado por
Iolanda, que licencia a Maré para outra marca.

Iolanda chama a pessoa do jogador: um(a) detetive de moda, que lê roupa como quem lê uma testemunha. O desfile começa
às 22h40. Até lá, é preciso descobrir quem levou a coleção, como a assinatura foi falsificada e por quê.

**A verdade (nunca vai ao cliente antes da acusação; está no servidor):** Bento Varela, sobrinho de Iolanda e diretor
comercial, negocia em segredo a venda da casa a um grupo de varejo. O grupo só compra se a Maré não for lançada (a casa
vale mais "sem dona criativa"). Bento pediu a Teo, o estagiário do arquivo, uma cópia da chave do cofre, prometendo-lhe
um emprego; aproveitou os vinte minutos em que o chefe da segurança saiu do posto, abriu o cofre às 21h38, vendeu os
croquis a Rafa Sion por meio de uma "consultoria" com as iniciais dele, falsificou o certificado de licença com a caneta
de tinta azul-real que leva no bolso e cortou a barra do vestido com a tesoura do kit do camarim, para atrasar o
desfile. Rafa comprou os croquis de boa-fé (achou que eram de um freelancer); Cléo guarda cópias de todos os moldes, o
que no fim prova a autoria de Iolanda.

## 2. Elenco numerado

Os números são os do quadro de suspeitos da acusação (o 1 não é suspeito: é quem pede ajuda).

| Nº | Nome | Papel | O visual (pela roupa) | Motivo aparente | Segredo | Salas |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Iolanda Varela | estilista da Maison Varela, quem contrata a detetive | terno de linho cru, broche em forma de agulha, sapatilha de couro gasta na ponta (anda muito pelo ateliê) | — | vai se aposentar e ainda não contou a ninguém | Salão principal, Ateliê, Passarela |
| 2 | Bento Varela | sobrinho, diretor comercial | blazer azul-marinho impecável, sapato novo de sola clara, relógio grande, caneta-tinteiro no bolso do peito | quer modernizar a casa | negocia a venda da Maison; deve dinheiro de uma linha de tênis que fracassou | Salão principal, Escritório, Passarela |
| 3 | Cléo Martins | chefe de ateliê, trinta anos de casa | avental de lona com alfineteira no pulso, cardigã cinza com fios soltos de tecido da Maré | nunca recebeu crédito pelas peças | guarda cópias de todos os moldes numa caixa de chapéu | Ateliê, Arquivo |
| 4 | Rafa Sion | estilista rival, dono do Sion Studio | jaqueta de náilon prata, tênis de cano alto, bolsa transversal | a coleção dele, "Ressaca", estreia hoje e parece demais com a Maré | comprou os croquis de um "freelancer" e pagou por transferência | Clube underground |
| 5 | Dália Prates | jornalista de moda | vestido preto midi, óculos de armação vermelha, caderno de couro | quer o furo da noite | recebeu às 21h05 um bilhete anônimo, no papel timbrado da própria Maison | Entrada da gala, Salão principal |
| 6 | Otto Brandt | chefe da segurança do Palácio | terno preto, ponto no ouvido, gravata cinza, lanterna no cinto | — | deixou o posto das 21h30 às 21h50 para atender uma ligação de família | Entrada, Sala de segurança |
| 7 | Nina Okafor | modelo que abre o desfile | robe de cetim marfim sobre o vestido da abertura, chinelo de hotel | medo de ser trocada por outra modelo | viu um homem de blazer escuro com uma capa de roupa no corredor de serviço | Camarim |
| 8 | Teo Albuquerque | estagiário do arquivo | camisa xadrez, colete de tricô, crachá pendurado | foi o último a sair do arquivo | fez uma cópia da chave do cofre para Bento | Arquivo |
| 9 | Lia Duarte | DJ e dona do clube underground | macacão preto de manga longa, fone no pescoço, unhas pintadas de prata | — (testemunha) | o clube serve de ponto de entrega para mensageiros da moda | Clube underground |

Inimigos de patrulha (sem arma, sem violência; ver seção 6): seguranças do Palácio (Entrada e Salão), porteiros do clube,
o assistente de Bento no Escritório e o vigia noturno do Arquivo. Alguns levam papéis do caso no bolso.

## 3. O mundo: nove salas interligadas

```
                [9 Passarela (final)]
                        |  porta 5 (chave do Escritório)
[2 Clube] --escada-- [5 Ateliê] --porta 4-- [6 Arquivo]
    |                    |
 rua (livre)          porta 2 (corredor de serviço)
    |                    |
[1 Entrada] ------ [3 Salão principal] ------ [4 Camarim]
                     |            |
                 porta 1       porta 3
                     |            |
          [7 Sala de segurança]  [8 Escritório da direção]
```

| Sala | Lugar | Nova ou atual |
| --- | --- | --- |
| 1 Entrada da gala | tapete vermelho, cordões, recepção com lista de convidados | atual (salão 1) |
| 2 Clube underground | pista com neon, cabine da DJ, depósito de caixas | atual (clube) |
| 3 Salão principal | mesas redondas, lustre, palco do brinde | atual (salão principal) |
| 4 Camarim | araras, espelhos de lâmpadas, kit de costura, penteadeiras | atual (camarim) |
| 5 Ateliê | mesas de corte, manequins, rolos de tecido | atual (ateliê) |
| 6 Arquivo | estantes de caixas, cofre, mapoteca de moldes | atual (arquivo) |
| 7 Sala de segurança | monitores, painel de chaves, livro de ponto | nova |
| 8 Escritório da direção | mesa de vidro, cofre pequeno, estante de troféus | nova |
| 9 Passarela | a passarela do desfile, plateia, telão; a sala final da revelação | nova (final) |

**Chaves (5, todas em armários; o jogo sempre se completa):**

| Chave | Escondida em | Abre | Como pegar |
| --- | --- | --- | --- |
| K1 Chave do posto | armário de casacos da recepção (Entrada) | porta 1: Sala de segurança | carta verde no armário |
| K2 Chave do corredor de serviço | gaveta da penteadeira de Nina (Camarim) | porta 2: corredor do Camarim ao Ateliê | carta verde na gaveta |
| K3 Cartão do cofre | painel de chaves (Sala de segurança) | porta 4: Arquivo | carta verde no painel |
| K4 Chave do escritório | armário de ferramentas do depósito (Clube) | porta 3: Escritório | carta verde no armário |
| K5 Chave da passarela | gaveta da mesa de Bento (Escritório) | porta 5: Passarela | carta verde na gaveta |

**Sem cartas verdes:** cada porta trancada tem uma pessoa da casa que abre por você depois de 60 segundos de espera no
relógio da partida (Otto nas portas 1 e 3, Cléo nas portas 2, 4 e 5). Ninguém fica preso.

## 4. Quatro atos

**Introdução (salas 1 e 3).** Abertura: o carro chega ao Palácio, a detetive desce, os flashes estouram. Na Entrada,
Iolanda puxa a detetive de lado e conta o furto. No Salão, a pessoa conhece Bento, Dália e o clima da festa. O ato
termina quando a detetive tem a primeira pista e a chave do posto.

**Conflito (salas 7, 4 e 2).** A Sala de segurança mostra o buraco de vinte minutos na vigilância; o Camarim, a
sabotagem do vestido e o depoimento de Nina; o Clube, a coleção de Rafa e o pagamento a "B. V. Consultoria". As
suspeitas se espalham: Rafa tem os croquis, Otto saiu do posto, Cléo tem cópias dos moldes.

**Clímax (salas 5, 6 e 8).** No Ateliê, Cléo mostra as cópias dos moldes; no Arquivo, Teo admite a cópia da chave; no
Escritório, a proposta de venda e a tesoura sumida aparecem. A pessoa junta tinta, giz e horário.

**Desfecho (sala 9).** Na Passarela, diante da plateia e de Iolanda, a pessoa aponta o suspeito pelo número. O servidor
decide e a cutscene final revela a verdade; a tela de fim mostra as pistas reunidas.

## 5. Sala a sala

Cada sala tem: cutscene de abertura, um desafio (a roupa ou um confronto), um quebra-cabeça próprio com dica depois de
um erro, inimigos de patrulha com cone de visão, esconderijos e cutscene de resolução. O progresso é salvo ao terminar
cada sala.

| Sala | Abertura | Desafio | Quebra-cabeça (dica depois do erro) | Pistas | Resolução |
| --- | --- | --- | --- | --- | --- |
| 1 Entrada | flashes, Iolanda chama a detetive | o código de vestimenta da gala (o look decide a entrada) | **Lista de convidados:** achar o nome que não bate com o crachá (dica: "olhe o horário de chegada") | P1 | Iolanda entrega o convite da Maison |
| 3 Salão | o brinde é adiado | confronto azul com o segurança que barra o acesso às portas | **Mapa de mesas:** quem estava sentado ao lado do lugar vazio (dica: "a mesa 7 tem um cartão a mais") | P2 (bolso de segurança) | Dália comenta o bilhete anônimo |
| 7 Segurança | Otto volta ao posto, sem jeito | ficar fora do cone do vigia ao ler o livro de ponto | **Linha do tempo:** pôr os quatro cortes de câmera na ordem certa (dica: "o relógio do corredor aparece em dois") | P3, K3 | Otto admite a saída de vinte minutos |
| 4 Camarim | Nina chora sobre a barra descosturada | código de vestimenta do backstage (preto discreto) | **Amostras de tecido:** casar o fio solto da barra com o rolo certo (dica: "o fio é de seda, não de poliéster") | P4, P5 | Nina conta o que viu no corredor |
| 2 Clube | a pista vibra; Rafa apresenta a "Ressaca" | código streetwear; confronto azul com o porteiro | **Setlist de neon:** acender as letras na ordem da música (dica: "a primeira faixa é a mais lenta") | P6 (bolso de Rafa) | Rafa mostra que pagou por desenhos que achava de outra pessoa |
| 5 Ateliê | Cléo corta tecido em silêncio | esconder-se dos assistentes ao abrir a caixa de chapéu | **Molde em peças:** montar o molde da frente do vestido Maré (dica: "a pence aponta para o busto") | P7 | Cléo entrega as cópias dos moldes |
| 6 Arquivo | o cofre aberto, o vigia na ronda | ficar fora do cone do vigia nas estantes | **Código do cofre:** a data das três coleções de Iolanda no catálogo (dica: "da mais antiga para a mais nova") | P8, P9 | Teo confessa a cópia da chave |
| 8 Escritório | a porta range; o assistente de Bento arruma papéis | carta preta para pegar o papel no bolso do assistente | **Tintas:** comparar a cor da assinatura com as canetas da mesa (dica: "Iolanda só assina de preto") | P10, P11, K5 | a gaveta guarda a tesoura do camarim |
| 9 Passarela | a plateia se acomoda; Iolanda sobe ao palco | a acusação | — (a acusação usa as pistas reunidas) | P12 (entregue por Iolanda ao entrar) | a cutscene final |

## 6. Cartas e ações (todas exigem carta)

| Cor | Ação no mundo |
| --- | --- |
| Verde | abre gaveta, armário e porta (as chaves estão nos armários) |
| Preto | esconde-se, anda sem ser notado e tira papel do bolso de alguém |
| Amarelo | barra de vida (três marcas); ser visto custa uma marca |
| Azul | vence o confronto automático e estilizado (sem golpe, sem sangue: uma disputa de pose e argumento) |
| Branco | peça de pista: revela o texto inteiro de uma pista achada pela metade |
| Vermelho | moeda do mercado (troca por cartas das outras cores entre as salas) |

**Furtar do bolso (só papéis do caso):** chegar por fora do cone de visão, até 1,5 m, e jogar a carta preta. Deu certo:
o papel vem sem ninguém notar. Deu errado: o inimigo se vira, a sala entra em alerta e a pessoa volta ao último
esconderijo, perdendo tempo. Nunca se pega dinheiro, joia ou objeto pessoal: só a evidência do caso.

**Ser visto:** custa 30 segundos, uma marca de vida (amarelo) e pontos da partida, e a pessoa volta ao último
esconderijo. Com as três marcas gastas, Iolanda chama a detetive de volta à entrada da sala (sem fim de jogo).

## 7. As doze pistas (texto exato)

| Nº | Onde | Texto |
| --- | --- | --- |
| P1 | recepção da Entrada (mesa) | "Lista da recepção — 21h05: entregue à imprensa um envelope sem remetente, em papel timbrado da Maison Varela." |
| P2 | bolso de um segurança do Salão | "Ronda do corredor de serviço: sem vigia das 21h30 às 21h50 (posto vago)." |
| P3 | livro de ponto (Segurança) | "Otto Brandt — saída 21h30, volta 21h50. Motivo: ligação de família. Chaves do painel conferidas às 21h55: todas no lugar." |
| P4 | kit de costura (Camarim) | "Inventário do kit do camarim: 2 carretéis, 1 fita métrica, 40 alfinetes. Falta: 1 tesoura de arremate." |
| P5 | bilhete de Nina (Camarim) | "Vi um homem de blazer escuro e sapato novo, de sola clara, levando uma capa de roupa pelo corredor de serviço. Eram umas 21h45." |
| P6 | bolso de Rafa (Clube) | "Comprovante: transferência de Sion Studio para B. V. Consultoria — referência: croquis de coleção, 20 desenhos." |
| P7 | caixa de chapéu de Cléo (Ateliê) | "Cópias dos moldes da coleção Maré, riscadas por Cléo Martins em março. Cada folha tem o carimbo do ateliê e a data." |
| P8 | registro do cofre (Arquivo) | "Cofre do arquivo: aberto às 21h38 com uma chave; a original estava no painel da segurança." |
| P9 | recibo no avental de Teo (Arquivo) | "Chaveiro Ponto Certo — 1 cópia de chave tetra nº 47. Pedido e pago por: B.V." |
| P10 | bolso do assistente (Escritório) | "Proposta de compra da Maison Varela, válida só se a coleção Maré não for lançada. Para: Bento Varela." |
| P11 | gaveta da mesa de Bento (Escritório) | "Tesoura de arremate com a etiqueta 'Kit do camarim', com pó de giz de alfaiate azul nas lâminas." |
| P12 | entregue por Iolanda (Passarela) | "Bilhete de Cléo: 'Iolanda só assina de tinta preta. O certificado da licença está em azul-real.'" |

## 8. A cadeia de dedução (justa: tudo está nas pistas)

1. **Quem tinha a chave:** o cofre foi aberto com chave enquanto a original estava no painel (P8, P3): existe uma
   cópia. O recibo da cópia foi pedido por "B.V." (P9).
2. **Quando:** o corredor ficou sem vigia das 21h30 às 21h50 (P2, P3), e o cofre abriu às 21h38 (P8), dentro do buraco.
3. **Quem andou pelo corredor:** um homem de blazer escuro e sapato novo de sola clara com uma capa de roupa às 21h45
   (P5). Bento veste blazer azul-marinho e sapato novo de sola clara (o visual do elenco, visto em cena).
4. **Para onde foram os croquis:** Rafa pagou a "B. V. Consultoria" (P6); as iniciais repetem as do recibo (P9). Rafa
   comprou, não furtou.
5. **A falsificação:** Iolanda só assina de preto e o certificado é azul-real (P12); Bento leva caneta-tinteiro no bolso
   (visto em cena; no Escritório, a única caneta azul-real da mesa é a dele).
6. **A sabotagem:** a tesoura que falta no camarim (P4) está na gaveta de Bento, com giz azul do ateliê nas lâminas
   (P11).
7. **O porquê:** a venda só vale se a Maré não for lançada (P10).
8. **A autoria:** as cópias de Cléo, datadas de março (P7), provam que a Maré é de Iolanda; o bilhete à imprensa saiu do
   próprio papel timbrado da casa (P1), de alguém de dentro.

Suspeitos que parecem culpados e não são: Rafa (tem os croquis, mas pagou por eles: P6), Otto (saiu do posto, mas não
tinha a cópia: P3), Cléo (tem cópias dos moldes, mas elas são a prova da autoria: P7), Teo (fez a cópia, mas a pedido
de B.V.: P9).

## 9. Finais (nenhum é beco sem saída)

A acusação escolhe um dos suspeitos numerados (2 a 9) e é decidida no servidor, que só então manda a resposta.

| Final | Condição | O que a cutscene mostra |
| --- | --- | --- |
| Completo | aponta Bento (2) com 8 pistas ou mais | a detetive lê a cadeia em voz alta; Bento admite; Cléo mostra as cópias; Rafa retira a "Ressaca"; o vestido, consertado por Cléo, abre o desfile; Iolanda anuncia Cléo como a nova diretora criativa |
| Parcial (culpado certo, poucas provas) | aponta Bento com menos de 8 pistas | Bento nega e deixa o palco; o desfile acontece, mas a autoria fica em dúvida; a tela de fim mostra as pistas que faltaram |
| Parcial (suspeito errado) | aponta outro número | a pessoa apontada mostra o álibi (a pista que a livra); Iolanda pede para revisar o caso; a partida volta à Passarela com as pistas já achadas, para uma nova acusação (uma vez), e depois revela a verdade |

A tela de fim mostra o final, as pistas achadas ("Pistas 9 de 12"), o tempo e os pontos. Os pontos nunca dependem de
pele, corpo ou rosto.

## 10. Limites e acessibilidade

- No máximo 45 minutos de partida; o progresso é salvo ao fim de cada sala.
- Legendas em pt-BR, en e es; cutscenes com pular e rever; "reduzir movimento" troca as câmeras que andam por quadros
  parados.
- Celular 390×844: o caderno do caso, o mapa e o inventário abrem em folhas por cima da cena, sem cobrir o avatar.
- Câmera de exploração em terceira pessoa, por trás do ombro (`CAMERAS.md`, jogo 6), e diagonal de cima para ler a
  sala e os cones de visão.

## 11. Onde está no código

- O mapa (salas, portas, chaves, quem abre sem carta verde): `fai-application/.../flair3d/nucleos/FashionDetectiveMundo.java`;
  a acusação, com o culpado só no servidor: `FashionDetectiveAcusacao.java`.
- As salas (pontos, esconderijos, armários, vigias e rondas, enigmas e a pista de cada resolução):
  `flair3d/detetive/DetetiveSalas.java`; a investigação passo a passo: `DetetivePartida.java` e `DetetiveAcoes.java`; o
  cone de visão: `DetetiveVigias.java` (alcance 3,8 m, meia abertura 30°); a mão: `DetetiveMao.java`; a nota:
  `DetetiveCaso.java`.
- A tela: `components/flair/detetive` e `lib/flair/detetive`; textos `flair3d.detetive.*` (as pistas com o texto da seção 7).
- Diferenças em relação ao texto acima: o enigma do Ateliê é o molde, o do Arquivo é o código do cofre e o do
  Escritório é a cor da tinta (as respostas ficam no servidor); a pista P5 (bilhete de Nina) vem da resolução do enigma
  do Camarim; a ação "trocar carta" (qualquer cor, 15 s) foi acrescentada para a mão nunca travar.
