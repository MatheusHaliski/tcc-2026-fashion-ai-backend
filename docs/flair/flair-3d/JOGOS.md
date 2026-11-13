# FLAIR 3D: os jogos

Os jogos 1 a 5 foram definidos pela dona do projeto em 08/11/2026 e substituem os anteriores (Espelho Partido,
Prova com a Estrela, Rooftop ao Pôr do Sol, Cinco Clientes e Chefe: Vellard), que ainda estão nos dados do app até a
implementação destes. Depois ela pediu mais modos: o jogo 3 virou **Dress the Star**, com três variações, e entraram
**Fashion Detective** (jogo 6) e **Boutique 3D** (jogo 7, antes Boutique Tycoon). Por último ela criou dois modos ligados ao
editor de peças 3D do FAI Atelier: **Clube do Coração** (8, um modo artístico com Copilot) e **My Favorite Singer** (9). Depois vieram **O Labirinto** (jogo 10),
**Meu Piloto Favorito** (11, também com o editor 3D e o Copilot), **Around the World** (jogo 12) , **Meu Super-Herói
Favorito** (13, editor 3D e Copilot), **Fashion Sports** (jogo 14, antes Fashion Football) e **Batalha de Looks** (jogo 15).

Os modos que usam o editor 3D (8, 9, 11 e 13) formam o **Grupo Ateliê 3D**, uma entrada só no menu. Os objetivos
simples de cada jogo, que antes eram propostas separadas, estão em `OBJETIVOS_POR_JOGO.md`. Em cada jogo, **a definição da dona vem citada como ela escreveu**. O que vem depois, marcado
como **[proposta]**, é detalhe sugerido para ela aprovar ou mudar.

O **FLAIR 3D MAKE UP** é o jogo 5, Road to Glory: "na realidade, é justamente aqui que entra o tal do FLAIR 3D MAKE UP".
O plano dele está em `../flair-3d-make-up/PLANO.md`.

**Estrutura final do FLAIR (definida pela dona):** FLAIR Card Building Challenge; FLAIR 3D, com as modalidades deste
documento; e FLAIR 3D MAKE UP, focado em vestimenta e maquiagem no estilo DREST, com níveis de desbloqueio. O resumo
está em `../ESTRUTURA_FLAIR.md`.

## Regras comuns

- **Tela, como no DREST.** O painel de cima mostra o avatar e o cenário em 3D. O painel de baixo mostra o deck ou o
  catálogo: peças, maquiagem, cabelo e acessórios. Tocar num item veste o avatar na hora.
- **Câmera.** A mesma do provador, com órbita e zoom em detalhes do corpo (`components/three/fitting-camera.tsx`,
  `lib/scene3d/detail-camera.ts`). Hoje ela vai da gola ao calçado; rosto e mãos entram como paradas novas
  (`../flair-3d-make-up/REUSO_PROVADOR_E_AVATAR.md`).
- **A roupa é o foco.** O avatar fica de pé, posa, desfila ou caminha rápido. Painéis de LED, outdoors, plateia,
  flashes e fogos ficam atrás ou ao lado e nunca cobrem a roupa. A exceção de movimento é o jogo 2, em que a luta
  roda sozinha e o jogador só escolhe a roupa.
- **Deck da partida (jogos 1, 3 e 4).** Antes de entrar, a pessoa escolhe as cartas do guarda-roupa que leva. Durante a
  partida, só essas cartas podem ser vestidas. [proposta] Deck de até 12 cartas, travado ao entrar, sem troca no meio.
- **Proteções.** Público a partir de 13 anos:
  - Numa passarela pública com outras pessoas, quem tem 13 a 17 anos desfila com dublê ou manequim, nunca com o rosto
    do próprio avatar.
  - A nota nunca depende de pele, corpo ou rosto.
  - Não há pacote aleatório pago.
  - O erro custa pontos da partida, nunca saldo da carteira.
- **Marcas, celebridades e filmes reais.** Nome e logo de marca, imagem de celebridade e cena de filme precisam de
  licença antes de ir para o público (Lei 9.279/96 e direitos de imagem e autorais). Até lá, o jogo usa os dados
  (marca, país, estilo) sem logos, fotos nem trechos de filmes.

## Jogo 1 · A Passarela

**Definição da dona:** "objetivo deve ser vestir seu avatar com roupas que atendam o tema. Por exemplo, se o tema for
Brasil, voce ganha pontos se vestir com marcas brasileiras. Só vale utilizar roupas que voce submeteu ao entrar na
partida (seu deck) e não roupas do seu guarda-roupa que não trouxe para ela. O objetivo só é revelado ao entrar na
partida." Antes ela também escreveu: "quanto mais pecas o avatar se vestir com as roupas que acertam objetivo, mais
pontos o jogador ganha".

- **Estratégia.** Como o tema só aparece depois que o deck trava, a pessoa leva um deck variado de marcas, cores,
  estilos e ocasiões.
- **Temas possíveis com dados que o app já tem [proposta]:**
  - "Brasil": a marca da carta tem país BR (`Brand.country`, `BrandProfile.country`).
  - "Nike": a marca é Nike (com licença, a passarela ganha os painéis de LED da marca).
  - "Noite": a ocasião é festa.
  - "Monocromático": todas as peças são da mesma família de cor.
  - "Clássico": a peça tem o estilo clássico.
- **Pontuação [proposta]:**
  - Cada peça vestida que atende o tema vale +10, contada por posição do corpo: parte de cima, parte de baixo,
    calçado, até 2 acessórios, ou peça inteira no lugar de cima e baixo.
  - Look inteiro dentro do tema ganha +20.
  - Peça fora do tema não tira ponto: só não soma.
  - Máximo de 70 pontos.
  - Empate: vence quem tem mais peças no tema; depois, o voto da plateia.
- **Partida [proposta]:**
  1. Escolher o deck.
  2. Entrar na sala, de 4 a 8 participantes.
  3. O tema é revelado.
  4. Vestir no painel de baixo, só com cartas do deck, com 2 minutos e contagem visível.
  5. Cada um desfila na sua vez, e a plateia reage pela nota.
  6. Ranking final.
- **Partida sem esperar [proposta]:** quem não acha sala joga contra desfiles gravados de outras pessoas.
- **Cenário [proposta]:** uma passarela real por tema, como uma inspirada na São Paulo Fashion Week para "Brasil", ou a
  passarela com LED da Nike, com licença.
- **Recompensa [proposta]:** FAI Points pela colocação e itens do jogo. Cupom de marca só com parceria assinada.

## Jogo 2 · Dress Fighter

**Definição da dona:** "diferentes tipos de roupa influenciam na velocidade, na combatividade, na defesa e no dano
gerado ao atacar e o dano recebido, além de roupas que concedem superpoderes." Depois: "Mude o nome para Dress Fighter.
Jogo semelhante ao Street Fight, só vou mudar o nome porque não posso copiar o nome de outra empresa [...]. Aqui neste
jogo você não pode atacar o seu oponente como é no Street Fighter. Na realidade, o jogo realiza o ataque. Você só
escolhe as roupas. As vestimentas causam algum tipo de aumento na sua combatividade, defesa e superpoderes e efeitos
especiais."

- **Nome.** Dress Fighter. Antes de lançar, vale uma busca de marca no INPI para confirmar que o nome está livre.
- **O papel do jogador.** Só vestir. A luta acontece sozinha, como um autobattler: o jogador não aperta botão de
  ataque, não esquiva e não controla o personagem durante o combate.
- **Partida [proposta]:**
  1. Escolher as peças no painel de baixo, vendo os atributos do avatar mudarem a cada peça.
  2. O oponente aparece com o look dele, e os dois atributos ficam lado a lado.
  3. A luta roda sozinha em 3 rounds, com impactos estilizados, sem sangue e adequada a 13 anos ou mais.
  4. Resultado, e entre um round e outro a pessoa pode trocar uma peça, se a regra da partida permitir [decidir].
- **Atributos [proposta].** Derivados só de dados que a carta já tem: material, categoria, nível, os atributos FLAIR
  (EDGE, RANGE, CLOUT, GLOW, ART, SYNC) e a habilidade da carta (`FlairAbility`). A tabela de material está em
  `PROTAGONISTA_E_RECURSOS.md` §3.2.

  | Atributo | De onde vem |
  | --- | --- |
  | Velocidade, quem ataca primeiro | movimento do material e o calçado: tênis dá mais, salto alto dá menos |
  | Combatividade e dano ao atacar | EDGE da carta e acessórios rígidos, como metal e couro |
  | Defesa e dano recebido | resistência do material: couro, denim e casaco protegem mais |
  | Superpoder e efeito especial | carta Especial, habilidade da carta ou Aura Metamorfose |

- **A luta mostra a roupa [proposta].** A câmera fica aberta e de lado, para as duas roupas aparecerem inteiras. Os
  efeitos especiais e os superpoderes saem da peça que os concede (um brilho na jaqueta, um rastro no tênis) e nunca
  cobrem o look.
- **Justiça [proposta].** O servidor calcula a luta a partir dos atributos e de um sorteio com semente, e a mesma
  partida sempre dá o mesmo resultado na revisão. Nada é pago para ganhar atributo, e a derrota não tira saldo.
- [decidir] Este jogo também usa o deck da partida?

## Jogo 3 · Dress the Star (Vista a Celebridade)

**Definição da dona (jogo 3):** "Semelhante ao jogo da passarela, neste voce também deve registrar seu deck inicial e o
jogo da dicas de filmes, musicas, series para que os usuarios submetam pecas de roupa para tentar adivinhar."

**Modo pedido depois (texto que a dona trouxe):** um jogador é o Stylist e recebe o nome de uma celebridade, cantora
ou personagem icônico, com pistas progressivas (trecho de música, filme famoso, ano de destaque). Ele tem tempo limite
para montar no guarda-roupa 3D o figurino mais representativo, sem usar textos nem nomes das peças. A plateia ou os
adversários assistem ao desfile e tentam adivinhar quem é. "Quanto mais rápido a plateia adivinhar apenas olhando a
combinação de roupas (sem precisar liberar pistas extras de áudio/texto), mais pontos o Stylist e quem acertou ganham."

**Variações pedidas pela dona:** partida com amigos, duelo X1 e modo Stylist.

- **Partida com amigos [proposta]:** sala de 3 a 8 pessoas. A vez de Stylist passa de um em um. Quem está na vez monta
  o figurino e desfila; os outros tentam adivinhar. Pontos para o Stylist e para quem acertou primeiro, maiores quanto
  menos pistas foram abertas.
- **Duelo X1 [proposta]:** dois jogadores. Em cada round, cada um veste uma celebridade sorteada para o outro adivinhar.
  Vence quem fizer o outro acertar mais rápido, somando os rounds (proposta: 3 rounds).
- **Modo Stylist [proposta]:** sozinho e ranqueado. O desfile vai para uma fila e outros jogadores tentam adivinhar
  depois. A nota soma a rapidez dos acertos e o quanto as peças batem com o perfil de estilo da celebridade, que nós
  escrevemos (estilos, cores, ocasiões, marcas e época).
- **Peças [decidir]:** no ranqueado, só o deck registrado ao entrar, como na definição do jogo 3; na partida com amigos,
  o guarda-roupa inteiro ou o catálogo, para ser mais leve.
- **Palpite seguro [proposta]:** o palpite é escolhido numa lista de nomes que se completa ao digitar, sem chat livre,
  para proteger quem tem 13 a 17 anos. Entre adultos e amigos confirmados, o chat pode ser liberado.
- **Imagem e nome:** as pistas são texto e a revelação mostra o nome e o perfil de estilo, sem foto e sem sugerir apoio
  da celebridade. Trecho de música ou foto só com licença; até lá, a pista cita o título da música ou do filme.

## Jogo 4 · Personagem de Filme

**Definição da dona:** "voce deve escolher seu deck inicial. O jogo mostra da dicas da cena do filme e os usuarios
devem tentar adivinhar qual filme/serie está sendo exibido no objetivo."

- **Partida [proposta]:**
  1. Escolher o deck.
  2. O jogo descreve a cena aos poucos, por texto e por um cenário 3D nosso que lembra a cena sem copiar o filme.
  3. A pessoa veste o personagem com peças do deck e escolhe o título entre 4 opções.
- **Pontuação [proposta]:** acertar o título vale a maior parte. As peças que batem com o figurino do personagem somam
  pontos.
- **Direito autoral.** Nada de imagens, trechos ou trilhas dos filmes. O título pode ser citado como referência.

## Jogo 5 · Road to Glory (FLAIR 3D MAKE UP)

**Definição da dona:** "semelhante ao DREST, este jogo foca pura e simplesmente em vestimenta, make up e cabelo (na
realidade, é justamente aqui que entra o tal do FLAIR 3D MAKE UP). Onde voce tem varios níveis de temporada e, apos
completar mini-jogos, os quais são exatamente iguais ao sentido e objetivo do DREST, aumenta seu nivel desbloqueando
recursos e itens promocionais (a unica diferença do meu app para o DREST é justamente a questao da camera)".

- **Mini-jogos [proposta].** Os tipos de desafio do DREST, descritos no `../flair-3d-make-up/ESTUDO_DREST.md` §5: ensaio de fotos, mood
  board, Beauty Mode (maquiagem), joias, missões de marca e eventos especiais. Em cada um há um brief, a pessoa veste a
  modelo da casa ou o próprio avatar, e o look é avaliado.
- **Temporada e níveis [proposta].** A Carreira do `../flair-3d-make-up/PLANO.md`: 30 níveis, cada um com um desbloqueio permanente de
  técnica, acabamento, lugar ou item promocional. A temporada traz briefs e itens próprios.
- **A diferença.** A câmera 3D do provador, com zoom no rosto e nas mãos para a maquiagem. O DREST mostra uma imagem
  fixa por pose (`../flair-3d-make-up/ESTUDO_DREST.md` §8).
- **Peças.** Aqui não há deck: vale o guarda-roupa da pessoa mais o catálogo já desbloqueado.

## Jogo 6 · Fashion Detective

**Modo pedido pela dona (texto que ela trouxe):** investigação urbana em que a roupa é o passe de acesso. Para entrar
num evento de gala de luxo, o avatar precisa vestir peças de alta-costura de determinado designer; para entrar num clube
underground, a estética streetwear ou alternativa. O jogador analisa tecidos, desgaste das roupas e marcas deixadas nos
suspeitos para descobrir a profissão e os hábitos de quem é investigado.

**Regras da dona:** "crie uma série de salões limitados do jogo, cenas cutscenes limitadas e ações do usuário limitadas.
O usuário não realiza combate, não realiza movimentação e não empunha a arma, aponta a arma, não realiza nenhuma ação de
combate com arma. Ele apenas escolhe roupas que são usadas para aumentar a sua defesa e combatividade automática. [...]
E as cutscenes, movimentações através das salas, vão acontecendo naturalmente, automaticamente, através do jogo,
dependendo da escolha da vestimenta. Você pode ter um resultado dentro da cutscene, dentro do jogo, favorável ou não.
[...] O jogo deve durar no máximo 45 minutos para ser zerado, completado."

- **A única ação do jogador.** Escolher a roupa no painel de baixo. Andar entre salas, entrar, conversar, examinar
  pistas, defender-se e reagir a um confronto acontecem sozinhos, nas cutscenes. Ninguém comandado pelo jogador empunha
  ou aponta arma.
- **O caso [proposta].** Um caso por partida, em 6 salões fixos, por exemplo: a entrada da gala, o salão principal, o
  camarim, o clube underground, o ateliê e o arquivo. Cada salão tem um código de vestimenta e um desafio.
- **Cada salão em 4 passos [proposta]:**
  1. Uma cutscene curta apresenta o salão, o código de vestimenta e quem está ali (até 40 segundos).
  2. A pessoa escolhe o look (até 2 minutos, com o relógio opcional para quem tem 13 a 17 anos).
  3. O jogo calcula o resultado a partir do look.
  4. A cutscene do resultado roda: favorável ou desfavorável (até 60 segundos), e o personagem segue sozinho para o
     próximo salão.
- **Como o look decide [proposta]:**
  - **Acesso:** o look cumpre o código de vestimenta do salão (designer, estética, ocasião).
  - **Desafio:** a defesa ou a combatividade automáticas passam do limite do salão. Esses atributos vêm das mesmas regras
    do Dress Fighter (material, calçado, EDGE, habilidade e carta Especial).

  | Acesso | Desafio | Resultado |
  | --- | --- | --- |
  | cumpre | passa | favorável: a pista inteira e um atalho para o próximo salão |
  | cumpre | não passa | favorável em parte: metade da pista |
  | não cumpre | passa | favorável em parte: entra por outro caminho, metade da pista |
  | não cumpre | não passa | desfavorável: sem pista, segue mesmo assim |

  O desfavorável nunca encerra a partida: o personagem sempre segue para o próximo salão, para o jogo terminar no tempo.
- **Confronto automático [proposta].** Quando o salão tem um desafio de combatividade (um segurança que barra a porta,
  um rival que tenta sabotar), o confronto é uma cutscene estilizada, sem sangue e adequada a 13 anos ou mais. A roupa
  continua visível, e o resultado vem dos atributos.
- **O final [proposta].** Depois do sexto salão, a solução é automática: com 5 pistas ou mais, o detetive revela o caso
  inteiro (final favorável); com menos, revela parte e mostra o que faltou (final parcial), para a pessoa tentar de novo.
  [decidir] Ou a pessoa escolhe o suspeito no fim, como uma única ação além de vestir.
- **Limites [proposta].**

  | Item | Limite |
  | --- | --- |
  | Salões por caso | 6 |
  | Cutscenes | 1 de abertura, 2 por salão (apresentação e resultado), 2 finais: 15 no total |
  | Ações do jogador | 1 look por salão: 6 escolhas no caso |
  | Duração | cerca de 4 a 6 minutos por salão, mais abertura e final: entre 30 e 40 minutos, nunca acima de 45 |

  As cutscenes podem ser aceleradas ou puladas, e a partida salva a cada salão para continuar depois.
- **Pistas no tecido [proposta].** Na cutscene de resultado favorável, a câmera de zoom do provador aproxima o tecido,
  a costura ou o desgaste da peça examinada, e a pista aparece escrita. A pessoa só assiste; não precisa procurar.
- **Cuidado [proposta].** A dedução usa profissão, rotina, ocasião e época. Não usa classe social, para não ensinar
  estereótipo a partir da roupa.
- **Cores e ações (13/11/2026).** A dona definiu que cada cor de roupa é uma ação do detetive: verde abre gavetas e
  armários, preto dá furtividade, amarelo aumenta a barra de vida, azul aumenta o dano, e outras cores servem de pista
  ("a chave está no armário com a blusa branca") ou de moeda de troca no mercado do mapa (estalecas). O mapa, o que já
  está no servidor e os pontos em que isso muda as regras acima (furtividade, combate, compra de arma) estão em
  `CORES_E_ACOES.md`.
- [decidir] As roupas vêm do deck da partida ou do guarda-roupa inteiro?

## Jogo 7 · Boutique 3D

**Modo pedido pela dona (texto que ela trouxe):** gestão de uma maison ou boutique conceito, do corte do tecido ao
desfile. Clientes virtuais chegam com pedidos sob medida e prazos curtos (por exemplo, "preciso de um vestido
sustentável para um show pop em 3 minutos"). O jogador escolhe moldes, ajusta o caimento 3D no manequim, gerencia
costureiras e equilibra luxo e popularidade da loja. O sucesso da cliente no evento e a avaliação do público geram
moedas para expandir a loja, contratar assistentes e desbloquear coleções raras.

- **Base que já existe:** o editor 3D de peças do ateliê (`lib/atelier3d`, `components/atelier3d`) e o manequim do
  provador servem para escolher o molde e ajustar o caimento.
- **Cliente [proposta]:** cada pedido tem ocasião, estilo, cor e prazo. A cliente veste o resultado e caminha até o
  espelho ou numa mini passarela; a reação dela e a do público dão a nota.
- **Loja [proposta]:** as moedas são as moedas do jogo (FLAIR Coins), nunca dinheiro real, e não se compram pacotes
  aleatórios. Expandir a loja abre novos tipos de pedido e coleções.
- **Equipe [proposta]:** costureiras e assistentes são personagens da loja com tempo de trabalho e especialidade, sem
  punição por erro delas e sem tratar o trabalho delas como descartável.
- **Prazo [proposta]:** o relógio é opcional para quem tem 13 a 17 anos; quem joga sem relógio ganha um pouco menos.

## Grupo Ateliê 3D (modos 8, 9, 11 e 13)

Clube do Coração, My Favorite Singer, Meu Piloto Favorito e Meu Super-Herói Favorito aparecem no menu como uma
entrada só, o Ateliê 3D, porque todos criam peças no mesmo editor com o mesmo Copilot. Dentro dele a pessoa escolhe o
modo ou um dos desafios de criação de `OBJETIVOS_POR_JOGO.md` (tênis, jaqueta, bolsa, óculos e outros).

## O editor de peças 3D que o Grupo Ateliê 3D usa

O editor fica no FAI Atelier, em `/atelier/projects/{id}/editor` (`components/atelier3d/editor.tsx`,
`lib/atelier3d/document.ts`, serviços `Atelier3dService` e `GlbInspector`). Ele roda no navegador com three.js. O
Blender 4.3.2 só foi usado numa auditoria fora do app em 05/11, que listou operadores sem executar nenhum
(`docs/atelier3d/auditoria-2026-11-05/blender-report.md`).

**O que o editor já faz:**

- Criar uma base de camiseta, saia ou calça.
- Mudar cor e material (roughness, metalness) e mover, girar e escalar partes.
- Editar vértices, desfazer e refazer, salvar versões e exportar o GLB.

**O que ainda não faz, e os dois jogos vão precisar:**

- Estampa, listras, escudo ou logo, e mapas de textura novos.
- Peça pronta para vestir o avatar: hoje a peça sai estática, sem rig.
- Arquivos acima de 8 MiB.

[proposta] Até o editor ganhar estampa e peça vestível, a peça criada aparece num manequim no palco do jogo.

## Modo 8 · Clube do Coração (modo artístico)

**Definição da dona:** "O clube do coração não precisa ser realmente o clube que a pessoa torce. Pode ser qualquer
clube. O que acontece é que este modo, na realidade, não é exatamente um jogo, mas será inserido na aba Flare de
qualquer forma e conecta com o editor de peças 3D. Na realidade, é um jogo artístico, onde existe Copilot, que você
pode conversar". Antes ela tinha escrito que ele "conecta com o criador e editor de peças .glb".

- **O que é.** Um ateliê criativo dentro da aba FLAIR, sem placar, sem vencedor e sem relógio. A pessoa escolhe
  qualquer clube e cria uma peça para ele no editor 3D: camisa, jaqueta, cachecol ou acessório.
- **O Copilot [proposta].** Um painel de conversa ao lado do editor, reaproveitando a conversa que o app já tem
  (`components/copilot-chat.tsx`) e o motor local do Copilot (`CopilotService` e `CopilotLexicon`), que entende cores,
  materiais, tipos de peça, estilos e ocasiões em português, inglês e espanhol, sem IA paga.
  - A pessoa escreve, por exemplo, "camisa retrô anos 80 em vermelho e preto, de algodão".
  - O Copilot propõe passos com um botão "Aplicar": a base de camiseta, as cores em cada parte da peça e o material
    fosco do algodão. Cada passo usa um comando que o editor já tem e entra no desfazer.
  - Quando não entende a frase, o Copilot mostra sugestões de palavras que conhece, em vez de inventar.
  - As cores de cada clube vêm de uma tabela que nós escrevemos, só com as cores, sem escudo.
- **Depois de criar [proposta].** A peça pode ser salva no FAI Atelier, mostrada num manequim no palco do modo e, se a
  pessoa quiser, publicada numa galeria. A galeria tem curtidas, sem ranking.
- **Licença.** Nome, escudo, mascote e camisa oficial dos clubes são marcas. Sem licença, o modo usa só as cores e o
  nome em texto, e a peça é uma criação da pessoa, não um produto oficial do clube.

## Jogo 9 · My Favorite Singer

**Definição da dona:** "My Favorite Singer, que você criaria uma peça única de uma cantora ou de um cantor com base em
uma era ou período da carreira dela, coleção da carreira dela."

- **Partida [proposta]:**
  1. Escolher uma cantora ou um cantor e uma era da carreira, pelo nome e ano do álbum ou da turnê.
  2. O jogo mostra o perfil da era, que nós escrevemos: paleta, materiais, silhuetas e símbolos marcantes.
  3. Criar no editor 3D uma peça única daquela era.
  4. A peça desfila num palco que lembra a era, sem copiar cenário de show.
- **Nota [proposta]:**
  - Quanto a peça combina com o perfil da era: cor, material e silhueta.
  - Voto da comunidade na criatividade.
  - A nota nunca depende de pele, corpo ou rosto.
- **Coleção [proposta]:** cada peça criada entra numa vitrine "Eras" no perfil. Com uma peça de cada era de um mesmo
  artista, a pessoa completa a "coleção da carreira", que rende um selo.
- **Uso nos outros jogos [proposta, decidir]:** a peça criada vira uma carta e pode entrar no deck da Passarela ou no
  Dress the Star, quando ela puder vestir o avatar.
- **Licença:** nome do artista e título do álbum podem ser citados como referência. Foto, voz, rosto, música e nome de
  turnê registrado como marca só com licença. A peça é homenagem, não produto oficial do artista.

## Jogo 10 · O Labirinto

**Definição da dona:** "É, obviamente, um labirinto onde você entra e você destrava portas e passagens através de
espelhos que exigem que você tenha uma certa combinação de roupa. Irão existir peças de roupa através do cenário,
através do labirinto, e chaves que só são abertas ou liberadas quando você apresenta ao espelho uma combinação de roupa
permitida."

- **Direção anterior.** A dona tinha pedido jogos sem coleta de recursos e sem o jogador se mover. Aqui a definição pede
  andar pelo labirinto e pegar peças pelo caminho, então isso vale para este jogo. Para manter a simplicidade, a
  proposta é andar por toque, sem controle livre.
- **Andar [proposta].** O labirinto é uma grade de salas. A pessoa toca na porta ou no corredor e o avatar caminha
  sozinho até lá, numa caminhada simples, com a roupa sempre visível.
- **Espelhos [proposta].** Cada espelho mostra, em texto, a combinação que aceita. Ao chegar, a pessoa veste o look no
  painel de baixo e apresenta ao espelho:
  - Se a combinação for permitida, o espelho acende e abre a passagem ou libera uma chave.
  - Se não for, o espelho ondula em vermelho e diz o que faltou. Pode tentar de novo, sem perder saldo.
- **Combinações [proposta].** Regras que usam dados que as cartas já têm e os mesmos links do FLAIR CBC, por exemplo:
  - "Três peças da mesma família de cor."
  - "Um calçado de couro e um acessório de metal."
  - "Um look inteiro de festa."
  - "Duas peças da mesma marca."
  - "Nenhuma linha vermelha entre as peças", contada com o motor de links do CBC (`CbcLinks`).
- **Peças pelo caminho [proposta].** Algumas salas têm uma peça num manequim ou numa arara. Com um toque, ela entra
  na mala do labirinto, que vale só nesta partida e soma às peças que a pessoa trouxe. A peça encontrada costuma ser a
  que falta para um espelho adiante.
- **Chaves [proposta].** Cada chave abre uma porta trancada. Só sai de um espelho, nunca está solta no chão.
- **Tamanho [proposta].**

  | Item | Limite |
  | --- | --- |
  | Salas | 9, numa grade de 3 por 3 |
  | Espelhos | 5, dos quais 3 liberam chaves |
  | Peças pelo caminho | 6 |
  | Duração | 20 a 30 minutos, com a partida salva a cada espelho |

- **Fim [proposta].** O último espelho abre a saída. Menos tentativas erradas dão mais estrelas, e as estrelas viram
  pontos. Não há tempo limite para quem tem 13 a 17 anos.
- [decidir] A pessoa entra com o deck da partida ou com o guarda-roupa inteiro? As peças achadas no labirinto ficam para
  depois do jogo ou só valem dentro dele?

## Modo 11 · Meu Piloto Favorito

**Definição da dona:** "meu piloto favorito, onde você pode customizar a roupa e o capacete de um piloto da Fórmula 1.
E o Copilot deve ser adequado para receber inputs do usuário, prompts, e dar respostas válidas para esse contexto,
assim como as opções, sugestões e modos de edição devem ser adaptados a isso."

- **O que se cria.** O macacão e o capacete de um piloto, no editor de peças 3D do FAI Atelier, com o mesmo painel de
  conversa do Clube do Coração.
- **Bases novas [proposta].** O editor hoje cria camiseta, saia e calça. Este modo precisa de duas bases novas:
  - **Capacete**, dividido em zonas que se pintam separadas: topo, laterais, queixo, faixa da viseira e viseira.
  - **Macacão**, dividido em tronco, mangas, pernas, gola e cinto.
- **Modos de edição do modo [proposta].**
  - Cor por zona, com acabamento fosco, brilhante, metálico ou cromado; a viseira pode ser transparente, fumê ou
    espelhada.
  - Degradê entre duas zonas.
  - Número do piloto e faixas: dependem da estampa, que o editor ainda não tem (ver "O editor de peças 3D").
- **O Copilot do modo [proposta].** O motor local do Copilot (`CopilotLexicon`) ganha um vocabulário de automobilismo:
  capacete, viseira, macacão, faixa, número, degradê, cromado, fosco, cores de equipe.
  - Exemplo: "capacete amarelo com faixa verde e viseira espelhada" vira três passos com botão "Aplicar": topo e
    laterais amarelos, faixa da viseira verde, viseira espelhada.
  - Toda resposta é uma ação que o editor sabe fazer neste modo. Pedido fora do contexto, como "deixa o capacete
    voando", recebe um aviso curto e sugestões do que dá para pedir.
  - As cores de cada equipe vêm de uma tabela que nós escrevemos, só com as cores.
- **Depois de criar [proposta].** O capacete e o macacão aparecem num manequim no grid de largada ou no pódio, sem
  corrida. Podem ser salvos no FAI Atelier e, se a pessoa quiser, publicados na galeria.
- **Licença.** "Fórmula 1", "F1", nomes e logos de equipes, patrocinadores, nome e rosto dos pilotos e os desenhos de
  capacete deles são marcas ou direitos de imagem. Sem licença, o modo usa só as cores e o nome em texto, e a criação é
  uma homenagem da pessoa, não um produto oficial.

## Jogo 12 · Around the World

**Definição da dona:** "você vai desbloqueando caminhos através de um mapa do mundo que vai passando por diferentes
regiões do mundo. Cada região do mundo possui uma vestimenta única. Você deve, então, completar a vestimenta com o seu
deck de cartas em que você entrou na partida."

- **Deck.** Só as cartas do deck com que a pessoa entrou na partida.
- **O mapa [proposta].** Um mapa-múndi com 8 regiões ligadas por caminhos, por exemplo: Rio de Janeiro, Nova York,
  Paris, Milão, Lagos, Seul, Tóquio e Sydney. Completar uma região acende os caminhos para as vizinhas, e a pessoa
  escolhe por onde seguir.
- **A vestimenta de cada região [proposta].** É a identidade de moda contemporânea do lugar, nunca roupa tradicional
  ou sagrada usada como fantasia. A região mostra um look-guia, com uma ou duas peças já vestidas pelo jogo, e pede que
  a pessoa complete o restante com o deck, cumprindo regras com dados que as cartas já têm:
  - **Clima:** materiais leves no verão do Rio, materiais quentes no inverno de Seul (tabela de material de
    `PROTAGONISTA_E_RECURSOS.md` §3.2).
  - **Estética:** alfaiataria em Milão, streetwear em Tóquio.
  - **Paleta de cores** da região.
  - **Bônus:** marcas do próprio país da região, pelo país da marca (`Brand.country`).
- **Cena [proposta].** Em cada região, o avatar caminha por uma rua ou um ponto da cidade, com a roupa sempre visível e
  o cenário atrás.
- **Completar [proposta].** O look cumpre as regras da região: o caminho seguinte abre e a região ganha de 1 a 3
  estrelas pelo quanto cumpriu. Não cumpre: a pessoa tenta de novo com outras cartas do deck, sem perder saldo.
- **Duração [proposta].** Cerca de 3 minutos por região, uns 25 minutos para a volta inteira, com a partida salva a cada
  região. A volta completa rende um selo do passaporte no perfil.
- **Cuidado.** As regiões são descritas com pessoas de moda locais ou pesquisa, sem estereótipo nem caricatura.
- [decidir] Quais 8 regiões entram, e se o look-guia de cada uma usa marcas reais (com licença) ou só a estética.

## Modo 13 · Meu Super-Herói Favorito

**Definição da dona:** "meu super-herói favorito, semelhante aos outros modos que editam peças de roupa GLB. Este aqui
foca nos universos de super-heróis de Marvel e DC, de uma forma em que você pode conversar com o Copilot dentro deste
contexto, sugerir peças, ter opções de peças reais de super-heróis, tais como Homem-Aranha, Homem de Ferro, etc."

- **Licença, antes de tudo.** Personagens, uniformes, nomes, emblemas e logos da Marvel (Disney) e da DC (Warner Bros.
  Discovery) são protegidos por direito autoral e marca. Oferecer o uniforme real do Homem-Aranha ou a armadura do
  Homem de Ferro como peça editável copia um desenho protegido e precisa de licença, mesmo num app gratuito. Por isso o
  modo tem duas camadas:
  - **Sem licença (a que dá para construir agora):** o Copilot entende o nome do herói que a pessoa escreve e traduz em
    traços genéricos de arquétipo, sem copiar o uniforme oficial, sem emblema e sem nome na peça.
  - **Com licença (depende de contrato com a Disney ou a Warner):** as peças oficiais entram como opções prontas, com
    as regras do licenciador.
- **Peças de arquétipo [proposta].** Bases novas no editor 3D, cada uma dividida em zonas que se pintam separadas:
  - Traje colante, com tronco, braços, pernas, luvas e botas.
  - Armadura, com placas de peito, ombros, braços e pernas, em acabamento metálico ou fosco.
  - Capa, máscara, cinto de utilidades e luvas.
  - Emblema próprio, desenhado pela pessoa, no lugar do símbolo de um herói existente. Depende da estampa, que o editor
    ainda não tem.
- **O Copilot do modo [proposta].** O motor local do Copilot ganha vocabulário de super-herói: traje, armadura, capa,
  máscara, emblema, cinto, metálico, brilho de energia. Também ganha os nomes dos heróis mais conhecidos, ligados a
  traços genéricos.
  - Exemplo: "quero algo no estilo do Homem de Ferro" vira a sugestão de base de armadura, acabamento metálico em
    vermelho e dourado e um brilho no peito. A resposta diz que é uma criação inspirada, não o uniforme oficial.
  - Toda resposta é uma ação que o editor sabe fazer neste modo; pedido fora do contexto recebe sugestões do que dá
    para pedir.
- **Depois de criar [proposta].** O traje aparece num manequim ou no avatar, numa cena de cidade à noite ou num terraço,
  com uma pose de herói e sem luta. Pode ser salvo no FAI Atelier e, se a pessoa quiser, publicado na galeria, que
  recusa nome e emblema de personagem protegido.
- [decidir] Buscar licença com a Disney ou a Warner, ou ficar só nos arquétipos e em heróis criados pela pessoa.

## Jogo 14 · Fashion Sports

**Nome.** A dona mudou o nome de Fashion Football para Fashion Sports. O futebol de 5 abaixo é o esporte principal;
tênis, basquete 3×3, vôlei de praia, corrida, skate, golfe, dança e revezamento entram como rodadas, descritas em
`OBJETIVOS_POR_JOGO.md`. Em todos, o jogo roda sozinho e o jogador só veste.

**Definição da dona:** "um jogo de futebol em que os jogadores jogam automaticamente, ou seja, você não controla eles. A
única coisa que você faz é mudar a vestimenta deles. Ou seja, você pode mudar chuteiras, calções, camisas, meias do
jogador de futebol para melhorar o desempenho dele na partida, surtir um efeito especial, melhorar a defesa do time, a
qualidade técnica e ganhar o jogo. Você não controla os jogadores ativamente, como é no FC27. Você apenas muda a
vestimenta e isso causa um efeito dentro da partida."

- **O papel do jogador.** Só vestir o time. A partida roda sozinha, como no Dress Fighter: ninguém passa, chuta nem
  corre comandado pelo jogador.
- **O time [proposta].** 5 jogadores, como no futsal, para a câmera mostrar os uniformes inteiros e a partida ser
  curta. Cada jogador tem 4 vagas: camisa, calção, meias e chuteira.
- **Atributos [proposta].** Derivados de dados que as cartas já têm, com as mesmas regras do Dress Fighter:

  | Peça | Pesa em |
  | --- | --- |
  | Chuteira | velocidade e técnica: chuteira leve dá velocidade; de couro ou travas firmes dá técnica |
  | Camisa | resistência: tecido respirável cansa menos no segundo tempo |
  | Calção | agilidade: tecido leve e com elasticidade |
  | Meias | defesa: meias grossas protegem e firmam a marcação |
  | Carta Especial ou habilidade | um efeito especial, como um chute com rastro de luz ou um goleiro que defende mais |

- **Uniforme do time.** Regra da dona: "os jogadores do time, todos eles, devem vestir o mesmo uniforme. [...] é
  possível você variar o uniforme do jogador? Sim, porém, se você variar demais o uniforme dos jogadores do seu time,
  você vai notar um efeito negativo, ou seja, o time vai começar a jogar pior, já que os jogadores vão ter mais problema
  em se reconhecer."
  - **Coesão [proposta].** Para cada vaga (camisa, calção, meias e chuteira), o jogo compara as peças dos 4 jogadores
    de linha. Peça igual à da maioria conta como coesa. A coesão do time vai de 0 a 100% (16 peças comparadas).
  - **Efeito [proposta].**

    | Coesão | Efeito na partida |
    | --- | --- |
    | 100% | bônus de entrosamento: passes mais certos |
    | 75% a 99% | sem efeito: uma ou duas peças diferentes, para ajustar um jogador |
    | 50% a 74% | os jogadores se reconhecem pior: mais passes errados |
    | abaixo de 50% | o time se perde em campo: muitos passes errados e menos chances de gol |

    Variar uma peça pode compensar, por exemplo uma chuteira mais rápida só no atacante. Variar demais custa mais do que
    rende.
  - **O goleiro [proposta].** Como no futebol de verdade, o goleiro veste um uniforme diferente sem perder coesão.
  - **Na tela [proposta].** Um medidor de coesão no painel de baixo muda a cada peça trocada. Na partida, um passe
    errado por falta de coesão mostra os dois jogadores com uniformes diferentes em destaque.
  - Dentro de cada jogador, as peças que combinam por cor ou marca ainda somam um bônus pequeno, pelo motor de links do
    FLAIR CBC (`CbcLinks`).
- **Partida [proposta].**
  1. Vestir os 5 jogadores no painel de baixo, vendo os atributos do time mudarem.
  2. O adversário aparece com o uniforme dele.
  3. O primeiro tempo roda sozinho em cerca de 2 minutos, com os lances principais em destaque.
  4. No intervalo, a pessoa pode trocar peças de qualquer jogador.
  5. O segundo tempo roda, e sai o placar.
- **Justiça [proposta].** O servidor simula a partida a partir dos atributos e de um sorteio com semente, e a mesma
  partida sempre dá o mesmo resultado na revisão. Nada é pago para ganhar atributo, e a derrota não tira saldo.
- **A roupa aparece [proposta].** A câmera fica aberta sobre a quadra. Os efeitos especiais saem da peça que os
  concede e nunca cobrem o uniforme. Nos lances em destaque, a câmera aproxima o jogador e a peça que fez a diferença.
- **Licença.** Escudos, uniformes e nomes de clubes, seleções e campeonatos reais são marcas. Sem licença, os times
  usam só cores e nomes inventados.
- **Cores e ações (13/11/2026).** A dona definiu que cada cor dispara uma ação imediata ao ser acionada: preto defende
  com desarme e carrinho, verde chuta, amarelo dribla, azul corre, em todos os esportes. Acionar é vestir a peça no
  time; a peça que entra dispara a ação da cor dela. O segundo tempo passou a ter até 3 lances
  (`CORES_E_ACOES.md`).
- [decidir] As peças vêm do deck da partida? O primeiro tempo também deve ter lances?

## Jogo 15 · Batalha de Looks

**Pedido da dona:** um jogo que agrupe os objetivos de "vestir por regra clara".

- **Objetivo.** Vencer a batalha: fazer mais pontos que o adversário em 3 rodadas, cada rodada com um objetivo de
  regra clara sorteado (por exemplo, look monocromático, dress code do convite, vista o clima ou mala de 5 peças).
- **Você faz.** Só monta o look no painel de baixo, para o objetivo da rodada.
- **Pontos.** O servidor confere as regras do objetivo e dá de 0 a 100 por rodada (as tabelas estão em
  `OBJETIVOS_POR_JOGO.md`). Vence quem somar mais nas 3 rodadas; empate vai para o voto da plateia.
- **Formatos [proposta]:**
  - **Duelo 1×1:** os dois recebem o mesmo objetivo ao mesmo tempo.
  - **Sala de 4:** o mesmo objetivo para todos; vale também a Corrida do Tema (o primeiro a chegar a 100% leva mais).
  - **Sozinho:** o Look em 60 Segundos do dia e o Bingo Fashion.
  - **Semanal:** a Votação Cega, com os looks em manequins sem nome.
  - **Com amigos:** Look em Dupla, Estilista do Amigo, Troca de Uma Carta, Desafio da Turma, Telefone sem Fio
    Fashion e Foto da Turma.
- **Cena [proposta].** Uma passarela curta, com os dois looks lado a lado no fim de cada rodada; a plateia reage à nota,
  e a roupa sempre fica visível.

## O que ainda falta decidir

1. Tamanho do deck (12 é a proposta) e se o jogo 2 também usa deck.
2. A fórmula de pontos da Passarela (+10 por peça no tema, +20 pelo look inteiro, máximo de 70).
3. Partidas ao vivo, contra desfiles gravados, ou os dois.
4. Quais marcas, celebridades e filmes procurar primeiro para licença.
5. Dress the Star: no ranqueado só com o deck, e na partida com amigos com o guarda-roupa inteiro?
6. Fashion Detective: solução automática no fim ou escolha do suspeito; roupas do deck ou do guarda-roupa.
   Boutique 3D: relógio opcional para menores.
7. Clube do Coração: a galeria pública entra já, ou fica só a peça salva no FAI Atelier?
8. My Favorite Singer: a peça criada vira carta para os outros jogos?
9. O Labirinto: entrar com o deck ou o guarda-roupa, e se as peças achadas ficam depois do jogo.
10. Meu Piloto Favorito: construir as bases de capacete e macacão e a estampa (número e faixas) no editor.
11. Around the World: as 8 regiões e se o look-guia usa marcas reais.
12. Meu Super-Herói Favorito: licença com Disney ou Warner, ou só arquétipos e heróis próprios.
13. Fashion Sports: deck da partida, e quantos lances por tempo. Fashion Detective: furtividade, vida, dano, mercado e
    compra de arma (`CORES_E_ACOES.md`, seção 3).
14. Qual jogo detalhar primeiro.
