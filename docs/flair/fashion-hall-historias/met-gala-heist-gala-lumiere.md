# MET Gala Heist — *Gala Lumière*

> Portal 2 do Fashion Hall. Ação furtiva em terceira pessoa: o jogo que já existe em `components/heist` e `lib/heist`
> (Museu Vesper, Gala Lumière, 13 salas, 9 subobjetivos, 4 finais). Este documento dá a ele a história que a Noite Aurum
> planta, e roteiriza as cenas nos pontos onde o motor já dispara um `Beat`.

**Premissa em uma frase.** Oito semanas depois da Noite Aurum, a Estilista descobre que o diamante exposto na gala do
Museu Vesper é a Estrela do Norte, roubada do ateliê da mentora dela, e entra na festa mais vigiada do ano para
recuperá-lo, só para descobrir que Vellard planejou roubá-lo ele mesmo naquela noite e culpá-la.

| | |
|---|---|
| Protagonista | a Estilista, agora conhecida demais para passar despercebida (e isso é a regra do jogo) |
| Antagonista | Augusto Vellard (mente) e Marcos (braço), com os seguranças da casa |
| Aliados | Íris Monteiro, Lina Vale, Davi, Dona Celina (pelo rádio), a recepcionista (condicional) |
| Tema | a roupa esconde ou denuncia; procedência; quem conta a história do objeto é dono dele |
| Tom | thriller de gala: música ao fundo, veludo, luz baixa, humor no bar; violência opcional e sempre com custo |
| Onde | avenida, fachada, vestíbulo, Grande Salão, lounge e terraço, Instituto do Traje, Sala das Joias, bastidores, labirinto de serviço, sala de segurança, doca, beco, beiral |
| Duração alvo | 45 a 90 min por partida; 10 cenas de corte (≈ 10 min) e 1 cena jogada |

## Estrutura e mapeamento no motor

```
ATO 1 · Avenida                    ATO 2 · Museu                                  ATO 3 · Fuga
1 Situação inicial   CS-M-01        4 Ação crescente   CS-M-04 · CS-M-05 · CS-M-06  7 Ação decrescente  CS-M-09
2 Gatilho            CS-M-02        5 Ponto médio      CS-M-07                      8 Desfecho          CS-M-10 (4 variantes)
3 Virada             CS-M-03        6 Momento sombrio  CS-M-08 → clímax jogado
```

| Subobjetivo (`mission.ts`) | Cena | Formato |
|---|---|---|
| (prólogo, fora da partida) | CS-M-01 Bastidores do desfile | corte |
| (briefing) | CS-M-02 O catálogo aberto | corte |
| `arrive` chegar à escadaria | CS-M-03 Do outro lado da avenida | corte |
| `credential` conseguir um jeito de entrar | CS-M-04 Portaria (4 variantes) | corte |
| `getIn` entrar no museu | CS-M-05 O salão | corte |
| `findRoute` abrir um acesso à Sala das Joias | CS-M-06 O bar de Davi | corte |
| `reachVault` chegar à Sala das Joias | CS-M-07 Sala de segurança | corte |
| `lasers` cortar a energia ou atravessar os lasers | CS-M-08 Apagão no beiral | corte, depois clímax jogado |
| `diamond` abrir a vitrine e pegar o diamante | (cena longa já existente: comemoração e seguranças entrando) + livro-caixa | jogada |
| `leave` sair do prédio · `car` chegar ao carro | CS-M-09 O carro | corte |
| vitória (`endingOf`) | CS-M-10 Quatro manhãs | corte, 4 variantes |

---

## Ato 1 · Avenida

### 1. Situação inicial

**O que acontece.** A Estilista virou nome. Fotografam-na na rua. Para quem precisa passar despercebida, isso é um
problema, e o jogo começa mostrando a solução: roupa. A missão menor é uma infiltração silenciosa nos bastidores de um
desfile da semana de moda para trocar a etiqueta de uma peça que a Casa Vellard copiou de Dona Celina.

**O que a pessoa joga.** Tutorial de furtividade em cenário pequeno (uma arara, duas costureiras, um segurança): deck
escuro, tênis, capuz; agachar, caminhar discreta, trocar de roupa escondida, usar a garrafa para distrair. Sem armas.
Termina quando a etiqueta é trocada e ninguém viu.

#### CS-M-01 · "Bastidores do desfile" (cena de corte, 60 s)

- **Local:** bastidores de um desfile, araras, vapor de ferro, uma TV de bastidor ligada no noticiário. **Câmera:** por
  trás do ombro; termina na TV.
- **Roteiro.** A Estilista, de capuz, costura a etiqueta "Celina Rocha · 1987" por cima da etiqueta Vellard. Uma
  costureira passa; ela abaixa; a costureira não vê. Na TV: *"...o roubo levou sete minutos. A polícia acredita que
  os ladrões conheciam a rotina da galeria."* Imagens de arquivo de uma galeria de museu com vitrines quebradas. A
  Estilista olha a TV por um segundo a mais do que devia. O segurança se vira; ela já não está lá. Última imagem: a
  peça na arara com a etiqueta certa.
- **O que conta.** Mostra a habilidade da heroína (furtividade e disfarce) numa missão pequena. A TV ancora o tom no
  mundo real (roubos de museu recentes, ver "Âncoras") e planta a ideia de que roubo bem feito é conhecer a rotina, que
  é o que o jogador vai fazer com os seguranças.
- **Gancho.** Volta ao Hall com o portal vermelho pulsando. Abre o briefing.

### 2. Incidente incitante

**O que acontece.** Íris confirma, com os papéis de empréstimo, que o diamante da exposição *O Fio e a Luz* é a Estrela
do Norte: saiu do ateliê de Celina na noite do arrombamento de 2015, passou por dois "colecionadores" e chegou ao
museu com procedência limpa, assinada pela Casa Vellard. A gala é em três noites. Marcos é o chefe de segurança
contratado por Vellard. Lina, grata, oferece colocar a Estilista na lista.

#### CS-M-02 · "O catálogo aberto" (cena de corte, 80 s)

- **Local:** sala de Íris no Museu Vesper, à noite, o catálogo da gala aberto. **Câmera:** sobre a mesa; close nos
  documentos; termina na janela com a fachada iluminada para o ensaio da gala.
- **Roteiro.** *ÍRIS:* "Dois donos em onze anos, nenhum com rosto. O último laudo de autenticidade tem o carimbo da
  Vellard." *ESTILISTA:* "Ele pôs o diamante no museu para lavar." *ÍRIS:* "E para me fazer expor a prova do crime dele
  como se fosse favor." Lina entra, ainda com a estatueta da Noite Aurum no bolso do casaco, ou sem ela, conforme a
  resposta dada a Bia no jogo 1. *LINA:* "Eu estou na lista. Posso levar alguém." *ÍRIS:* "O chefe de segurança se
  chama Marcos. Ele conhece você da imprensa." *ESTILISTA:* "Então eu não vou como eu." Corte para a janela: a
  escadaria do Vesper com o tapete sendo desenrolado para o ensaio.
- **O que conta.** O gatilho com a prova nas mãos (documento, não suspeita) e a ameaça concreta (Marcos reconhece o
  rosto famoso). A fala final estabelece a mecânica do disfarce como decisão narrativa.
- **Gancho.** Abre a tela de briefing já existente (história, objetivo, dificuldade, desafio da semana, deck) com o
  texto desta cena.

### 3. Primeiro ponto de virada

**O que acontece.** A escolha do deck é a escolha da história. Deck de gala: entrar pela porta da frente com prestígio e
rota VIP, visível e carismática. Deck furtivo: doca, uniforme de equipe, penumbra. A Estilista decide do outro lado da
avenida, onde a partida começa; atravessar a rua é o sem-volta.

**O que a pessoa joga.** A tela "O que o seu deck muda" (já existente), a escolha de dificuldade e desafio, e os
primeiros passos na avenida: o revendedor da rua, a fila do tapete, o beco. O `Beat` de `arrive` dispara ao chegar à
escadaria.

#### CS-M-03 · "Do outro lado da avenida" (cena de corte, 45 s)

- **Local:** calçada em frente ao Museu Vesper, noite da gala. **Câmera:** plano aberto da fachada neoclássica, flashes,
  fila; depois por trás do ombro da Estilista atravessando.
- **Roteiro.** Mensagem de Lina no celular: *"Você está na lista. Ou não precisa estar."* A Estilista guarda o
  celular. A câmera percorre a fachada e mostra, sem legenda, os três caminhos: o tapete com a recepcionista, a rampa
  da doca à direita com um caminhão de bufê, a boca do beco à esquerda. Uma pessoa sai do estande do revendedor
  ajeitando o paletó. *ESTILISTA (para si):* "Sete minutos. Eles conheciam a rotina." Ela desce da calçada.
- **O que conta.** A decisão irreversível, e o cenário ensinando as três rotas sem tutorial. A fala paga a TV de
  CS-M-01.
- **Gancho.** HUD completo (vida, munição, suspeita, objetivo "conseguir um jeito de entrar").

---

## Ato 2 · Museu

### 4. Ação crescente

**O que acontece.** A credencial (convite comprado, prestígio do look, nome de Lina, uniforme pela doca ou blefe). O
Grande Salão com a festa. Davi no bar com a dica da chave de Marcos e da caixa de fusíveis. Íris, no Instituto do Traje,
conta a ordem das vitrines só depois de ganhar confiança. O labirinto de serviço. Derrota parcial: um fotógrafo publica a
Estilista na gala, o Hype sobe e a suspeita dos seguranças sobe junto.

**O que a pessoa joga.** O jogo que já existe: diálogos com condição e consequência, troca de roupa pelo caminho,
esconderijos, pistas físicas (o pôster Aurora, a ordem do dia, o placar da Estrela do Norte), três joias opcionais, o
revendedor do bar, o detector de metal do salão.

#### CS-M-04 · "Portaria" (cena de corte, 30 s, 4 variantes)

- **Local:** portão do tapete, cordão de veludo, a recepcionista. **Câmera:** contra-plongée leve da escadaria; a
  Estilista de costas.
- **Variante convite.** A recepcionista lê o nome falso, olha a foto, olha a Estilista. *RECEPCIONISTA:* "Bem-vinda à
  Gala Lumière." Pulseira. Nada acontece. É a entrada mais fria, e o jogo a recompensa com silêncio.
- **Variante prestígio (deck de gala, rota VIP).** Holofote segue o look. Dois convidados viram a cabeça. A
  recepcionista nem pede nome. *RECEPCIONISTA:* "Área VIP à esquerda." Ao fundo, um flash: o fotógrafo que vai publicar
  depois. A cena planta a derrota parcial.
- **Variante Lina.** Lina chega ao mesmo tempo, enlaça o braço. *LINA (à recepcionista):* "Ela está comigo." *(à
  Estilista, baixo):* "Se der errado, eu nunca te vi." A recepcionista sorri para Lina e não olha para a Estilista.
- **Variante uniforme (doca).** Sem portaria: a cena mostra a Estilista de uniforme empurrando um carrinho pela rampa,
  o leitor de crachá piscando verde, e Marcos de costas falando ao rádio. Ele não se vira.
- **O que conta.** O jogador sente que a roupa decidiu a cena. Cada variante planta um custo: prestígio planta o
  fotógrafo; Lina planta a culpa dela; uniforme planta a proximidade de Marcos.
- **Gancho.** `credential` cumprido; o objetivo passa a "entrar no museu".

#### CS-M-05 · "O salão" (cena de corte, 50 s)

- **Local:** Grande Salão: lustres, DJ, pista, mesa de doces, o arranjo floral. **Câmera:** um travelling lento pela
  festa, da porta ao fundo; termina no telão.
- **Roteiro.** Música. Convidados dançando. O telão exibe o tema da exposição, *"O Fio e a Luz: o traje como
  arquitetura"*, e, entre as imagens de arquivo, fotos de galas históricas de museus reais (ver "Âncoras"). Um
  garçom passa com taças. No canto, Marcos, com o rádio, olha a pista como quem conta pessoas. A câmera para no
  telão: a foto do diamante, *"Estrela do Norte, 4,2 ct, coleção particular"*. Som de uma câmera: o fotógrafo da
  variante prestígio, se houve, ou um convidado qualquer.
- **O que conta.** Apresenta o lugar como personagem e mostra Marcos trabalhando (ele conta pessoas, por isso os
  convidados a mais do deck de gala ajudam). Reforça a procedência mentirosa na frente de todos.
- **Gancho.** Abre os diálogos de Davi (bar) e Íris (Instituto do Traje).

#### CS-M-06 · "O bar de Davi" (cena de corte, 55 s)

- **Local:** bar do Grande Salão. **Câmera:** começa na taça sendo servida; passa pela pista; acha Marcos; volta ao
  balcão.
- **Roteiro.** *DAVI:* "Champanhe, martini seco... ou outra coisa?" *ESTILISTA:* "O que você ouviu." *DAVI:* "Que o
  Marcos repete que a chave da equipe nunca sai do bolso dele." A câmera encontra Marcos tocando o bolso do paletó.
  *DAVI:* "E que a caixa de fusíveis da Sala das Joias fica ao lado da porta. Coisa que ninguém diz à toa duas vezes
  na mesma noite." *ESTILISTA:* "Quem disse?" *DAVI:* "Um homem de gravata cinza que paga em dinheiro." A câmera
  acha, no lounge, Vellard de gravata cinza, pela primeira vez neste jogo, de costas. *DAVI:* "Com uma taça na mão
  você é só mais um rosto no bar."
- **O que conta.** A dica que já está no diálogo vira imagem (a chave no bolso) e ganha um segundo sentido: alguém
  quer que a caixa de fusíveis seja encontrada. Planta o autorroubo sem revelar.
- **Gancho.** `findRoute` cumprido por pista; marcador da chave de Marcos e da sala de segurança.

### 5. Ponto médio

**O que acontece.** Na sala de segurança (pelo labirinto de serviço, pelo cartão reserva ou pelo código da ordem do
dia), a Estilista encontra, no monitor, o plano de Vellard: às 23h a energia será cortada pela própria equipe, dois
seguranças "levam" o diamante pela doca, e a culpada já tem nome: *"a estilista sem convite que apareceu na gala"*,
com a foto do fotógrafo, se houve, ou uma foto de arquivo da Noite Aurum. É fraude de seguro com bode expiatório. A
Estilista deixa de ser ladra e vira alvo; o objetivo muda: pegar o diamante **antes** dele e levar junto o livro-caixa.

**O que a pessoa joga.** A sala de segurança já existe como sala do labirinto; ganha um terminal interativo (o monitor) e
um objeto novo no cofre: o **livro-caixa** (carta única, não troca). Se a Estilista já tiver sido vista, a cena mostra a
foto dela; se não, a de arquivo. Pequena diferença, grande efeito.

#### CS-M-07 · "Sala de segurança" (cena de corte, 85 s)

- **Local:** sala de segurança, monitores, a parede de fusíveis. **Câmera:** no reflexo dos monitores; depois no
  rosto da Estilista iluminado por eles; termina no relógio da parede: 22h41.
- **Roteiro.** Monitor 1: planta da Sala das Joias com um horário, *23:00 · corte*. Monitor 2: escala de dois
  seguranças, *R2, R3 · doca · 23:04*. Monitor 3: um boletim pronto para enviar à imprensa: *"Roubo na Gala Lumière.
  Suspeita: estilista que entrou sem convite."* A foto. Áudio do rádio interno, voz de Vellard: *"Se ela não vier,
  usem a de arquivo. Ela esteve aqui em março, ninguém vai conferir a data."* A Estilista abre o cofre da sala: cartão
  reserva e um livro-caixa encadernado em couro cinza. Folheia: *"2015 · aquisição · C. Rocha · 0."* Zero. Ela fecha o
  livro. *ESTILISTA (para si):* "Você não vai roubar nada hoje. Eu vou." Relógio: 22h41.
- **O que conta.** O ponto médio: a identidade do verdadeiro plano, a virada de reativo para proativo e o revés
  (ela já é a culpada). O "0" ao lado do nome de Celina diz tudo sobre a procedência sem exposição.
- **Gancho.** Novo objetivo principal com relógio: *"Antes das 23h: Sala das Joias"*. O livro-caixa entra no inventário.
  A partir daqui, a suspeita de Marcos sobe sozinha com o tempo.

### 6. Momento mais sombrio

**O que acontece.** 23h. Os fusíveis caem, mas não pela mão dela. No escuro, os seguranças de Vellard entram na Sala das
Joias; Lina é detida no salão como cúmplice ("ela trouxe a estilista"); a Estilista, que tentava a rota alta, fica
presa no beiral externo com os lasers religando atrás do vidro. Pelo rádio de um segurança, a notícia: o ateliê de
Celina está pegando fogo. Tudo o que ela veio defender está sendo destruído enquanto ela se segura numa cornija.

**O que a pessoa joga.** O clímax é jogado: voltar do beiral pela janela, atravessar a Sala das Joias com os lasers
(cronômetro do relógio, óculos para ver o feixe, ou cortar os fusíveis de novo), abrir a vitrine (grampo ou código),
pegar a Estrela do Norte antes de R2 e R3, e sair com o diamante e o livro-caixa com Marcos entre ela e a porta. A cena
longa já existente (comemoração curta, seguranças entrando) encerra o bloco. Nos desafios Midnight Escape e Diamond Run
o jogo já começa ou termina por aqui, e o roteiro respeita isso: CS-M-08 é a primeira cena desses desafios.

#### CS-M-08 · "Apagão no beiral" (cena de corte, 70 s)

- **Local:** beiral externo do Museu Vesper, a avenida lá embaixo. **Câmera:** a única cena em que a câmera sai do
  avatar e olha a cidade: plano aberto da fachada apagando andar por andar; depois de cima, a Estilista agarrada à
  cornija; depois, pelo vidro, os lasers religando em vermelho.
- **Roteiro.** O museu apaga. Grito abafado da festa; depois o gerador, e as luzes de emergência. Pelo vidro, dois
  seguranças entram na Sala das Joias com uma maleta. Rádio no cinto de um deles, vazando: *"...a atriz está com a
  gente no salão. Ela trouxe a estilista. Boletim às onze e meia."* Outro canal, chiado: *"...incêndio na rua das
  Oficinas, ateliê, bombeiros a caminho..."* A Estilista fecha os olhos por um segundo. Abre. Olha o relógio no pulso
  (a carta cronômetro, se tiver, pulsa). *ESTILISTA:* "Celina. Eu volto com ele." Ela se vira para a janela.
- **O que conta.** O ponto mais baixo: a aliada presa, a mentora atingida, a heroína pendurada do lado de fora da
  própria missão. A câmera olhando a cidade dá escala à queda.
- **Gancho.** Começa o clímax jogado com o relógio de boletim: 23h30.

---

## Ato 3 · Fuga

### 7. Ação decrescente

**O que acontece.** A fuga pela escada de incêndio, pela doca ou pelo beco; o carro na avenida. O silêncio depois. O
livro-caixa vai para Íris. Lina é liberada ao amanhecer quando o boletim não bate com o que a imprensa viu.

**O que a pessoa joga.** `leave` e `car`, como hoje. A diferença é só de texto: a cena do carro varia conforme Lina foi
detida (sempre) e conforme o estilo de golpe até aqui.

#### CS-M-09 · "O carro" (cena de corte, 50 s)

- **Local:** banco de trás do carro de fuga, avenida, museu ficando para trás. **Câmera:** pela janela traseira; depois
  no colo da Estilista.
- **Roteiro.** O Vesper se afasta, meio apagado, meio aceso, luzes de polícia chegando. No colo: a Estrela do Norte
  numa mão, o livro-caixa na outra. Nenhuma fala por 10 s. O rádio do carro: *"...confusão na Gala Lumière; a atriz
  Lina Vale foi levada para prestar esclarecimentos..."* A Estilista tira uma foto do livro-caixa aberto na página de
  2015 e manda para Íris e para Tomás Reis ao mesmo tempo. Mensagem de Íris, imediata: *"Recebido. Vai para a polícia
  e para a imprensa, nessa ordem."* A Estilista encosta a cabeça no vidro. Fim.
- **O que conta.** O rescaldo: a tensão cai, a consequência da escolha de Lina é mostrada e o livro-caixa começa a
  trabalhar sozinho.
- **Gancho.** Abre a tela de vitória já existente (estilo do golpe, opcionais, números) e, depois dela, a cena final.

### 8. Desfecho

**O que acontece.** A Estrela do Norte volta ao engaste do *Estrela do Norte* e a peça volta ao Museu Vesper com a
procedência correta, exposta com o nome de Celina Rocha. Vellard cai, de um jeito diferente em cada final. A Estilista
volta ao Hall e, pela primeira vez, o quarto tem um item que não é decorativo: a carta do diamante com a história de quem
fez a peça. Um terceiro portal, ainda apagado, aparece.

#### CS-M-10 · "Quatro manhãs" (cena de corte, 60 s, 4 variantes pelo final)

- **Local:** três planos fixos: a vitrine do Instituto do Traje com o vestido completo e a plaqueta nova; uma manchete;
  o Hall. **Câmera:** fixa em cada plano.
- **Comum a todas.** Plaqueta: *"Estrela do Norte · Celina Rocha, 1987 · doação da autora"*. Celina, de costas, na
  frente da vitrine; a Estilista ao lado dela. *CELINA:* "Você demorou." *ESTILISTA:* "Fiz do zero. Na frente de todo
  mundo." No Hall, a carta "Estrela do Norte (procedência: Celina Rocha)" substitui a antiga; o portal 3 aparece
  apagado.
- **Fantasma** (nunca detectada, sem abates). Manchete de Tomás Reis: *"Livro-caixa derruba a Casa Vellard; ninguém viu
  quem o levou."* Vellard preso pela imprensa e pela polícia, a Estilista invisível. Lina liberada com um pedido de
  desculpas público. É o final mais limpo e o único em que Marcos aparece sendo demitido, não preso: ele não sabia.
- **Profissional** (sem abates, mas vista). Manchete: *"Estilista é investigada e inocentada no mesmo dia."* Vellard
  preso. Lina liberada, mas o nome dela ficou numa manchete. Na vitrine, um segurança novo. A Estilista ganha a carta
  com uma rasura: a procedência está certa, mas a história dela ficou pública.
- **Implacável** (até quatro abates). Manchete: *"Noite de violência na Gala Lumière; a fraude veio à tona depois."*
  Vellard preso, mas a notícia é a violência, não a fraude. Lina responde a processo por ter colocado a Estilista na
  lista e não atende às mensagens. Celina olha a vitrine e não diz "você demorou"; só olha. É o final em que a roupa
  deixou de ser a arma.
- **Barulhenta** (mais de quatro abates ou alarme geral). Manchete: *"Caos na gala; o diamante sumiu."* Vellard foge
  antes da prisão e o terceiro portal do Hall aparece com o monograma dele. Lina responde a processo. A peça de Celina
  volta ao museu, mas sem plaqueta de doação: a procedência ficou sub judice. O jogo convida, sem punir, a tentar de
  novo com outro deck.
- **O que conta.** O novo equilíbrio e a transformação da protagonista, e o preço de como ela jogou. O estilo de jogo
  muda o destino de dois personagens (Lina, Marcos) e o estado do mundo (o terceiro portal).
- **Gancho.** Carta colecionável com procedência; selo do Hall; portal 3.

---

## Recursos e roupas na Gala Lumière

O motor já tem a base (`lib/heist/state.ts`, `cards.ts`, `level.ts`): vida 100 com cansaço abaixo de 30, kits de 50 e
100, pentes de 10/12/8 e pacote de 20, faca, pistola, pistola silenciada, dois revendedores, cartas com usos, e a
tabela `DIFFICULTY` (fácil, normal, difícil, lenda). Abaixo, o que se propõe por cima, sem mudar a estrutura; Médio é o
`normal` atual, Lenda continua como quarto nível opcional.

| Recurso | Fácil | Médio | Difícil |
|---|---|---|---|
| Vida | 100, regenera até 50 fora de combate, cansaço só abaixo de 20 | 100, sem regeneração, cansaço abaixo de 30 | 100, sem regeneração, cansaço abaixo de 40; colete absorve metade e quebra |
| Kits iniciais | 2 kits de 50 + 1 de 100 | 1 kit de 50 | nenhum; só lenço (carta) e revendedor |
| Munição | pistola vem com 2 pentes; pacote dá 20 | sem pente extra; pacote dá 20 | pacote dá 12; estoque de munição do bar cai de 4 para 2 |
| Armas e exigência de peça | faca e pistola sem exigência | faca 30, pistola 55, silenciada 75 (atuais) | silenciada só no bar e exige 90; detector do salão sempre ligado |
| Preço do revendedor | 0,8× | 1× | 1,1× (1,25× em Lenda) |
| Reconhecimento | 0,6× | 1× | 1,3×; e após 90 s no salão um fotógrafo publica a Estilista, elevando o reconhecimento de todos os seguranças |
| Relógio do autorroubo (CS-M-07 em diante) | 23h chega em 12 min de jogo | 8 min | 6 min; em Lenda, 5 |
| Checkpoint | em todo subobjetivo, vida volta a 60 | em todo subobjetivo, vida mantida | só em `getIn`, `reachVault` e `leave` |
| Cargas das cartas | ilimitadas | por raridade (regra atual de `charges`) | uma carga por carta; carta comum não tem uso, só troca |

**Roupas agem** em quatro papéis. A carta recebe o papel pelo que a peça é, com a leitura de `AfterpartyMods` e
`cards.ts`; a dificuldade muda a força e o risco de cada papel.

| Papel | O que a roupa faz | Peças | Fácil → Médio → Difícil |
|---|---|---|---|
| **Furtividade** | esconder, passar despercebida, mudar de disfarce; a penumbra do deck escuro | cores escuras, tênis, capuz, boné, uniforme de equipe | suspeita sobe 30 % mais devagar e a troca pode ser à vista → valores atuais → trocar à vista é flagrante; salto é ouvido a duas salas |
| **Espionagem** | ver e ouvir o escondido: seguranças e lasers através das paredes, o rádio dos seguranças, a combinação da vitrine | óculos (visão), relógio (tempo lento), broche ou brinco (escuta do rádio: antecipa o boletim e a escala de R2/R3), bolsa com decodificador | visão 12 s ilimitada → 6 s por raridade → 4 s uma carga; escuta exige ficar parada |
| **Sabotagem** | atrapalhar sem combate: grampo no teclado, cofre e vitrine; lenço no alarme; garrafa para desviar; **trocar a maleta de R2/R3 por uma vazia** (novo: só possível se a Estilista chegar à Sala das Joias antes das 23h) | joias, lenço, garrafa, bolsa | nunca falha → 15 % de disparar o alarme → 30 %, e a falha chama Marcos direto; a troca da maleta bem feita é o que desbloqueia o final Fantasma no Difícil |
| **Defesa** | aguentar e sair viva | colete sob o blazer, casaco pesado (menos dano, menos velocidade), lenço como curativo, bota para escalar a escada de incêndio | colete 70 % → 50 % → 35 % e quebra após 3 tiros; casaco pesado tira 20 % da velocidade |

O conflito entre papéis já está no jogo: o deck de gala que dá carisma e abre a rota VIP é o pior em furtividade, e em
Difícil o fotógrafo transforma carisma em risco. Em Fácil dá para acumular os quatro papéis; em Difícil a pessoa escolhe
dois antes de atravessar a avenida, porque cada carta tem uma carga só. A regra narrativa é a mesma de CS-M-02: "então
eu não vou como eu".

## Âncoras no mundo real da moda

Entram como fatos de arquivo (TV de bastidor, telão do salão, rádio), nunca como personagens:

- **Roubo da Galeria de Apolo do Louvre (outubro de 2025)**, em poucos minutos e com elevador de mudança, e o **Cofre
  Verde de Dresden (2019)**: a TV de CS-M-01 e a fala "sete minutos, eles conheciam a rotina" de CS-M-03. Dão
  verossimilhança ao labirinto de serviço e à doca.
- **Temas reais da Met Gala** nas imagens de arquivo do telão em CS-M-05: *Sleeping Beauties* (2024), *Superfine:
  Tailoring Black Style* (2025) e *Costume Art* (2026, com a abertura das novas galerias do Costume Institute). A Gala
  Lumière "segue a tradição" sem usar a marca.
- **O placar da Estrela do Norte** já cita uma pessoa real como dona anterior do diamante (texto atual em
  `heist.clue.placardStars.text`); manter como fato de placa, sem diálogo.
- **Semana de moda de São Paulo** como o desfile de CS-M-01.

Datas e nomes devem ser conferidos no momento de escrever os textos finais.
