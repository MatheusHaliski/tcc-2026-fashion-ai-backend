# FLAIR 3D: desenho da área de jogo, avatares e cenários

Definição visual dos jogos 3D, para a implementação seguir. Complementa `BASE_NUCLEOS.md` (regras e API) e `JOGOS.md`
(o que é cada jogo). Tudo aqui é proposta para a dona aprovar ou mudar.

## 1. A área de jogo

### O quadro da tela

| Parte | Celular (retrato) | Computador e tablet deitado |
| --- | --- | --- |
| Quadro do jogo | largura inteira, altura da tela menos a barra do app | até 1280 px de largura, centralizado, proporção 16:10 |
| Palco 3D (em cima) | 56% da altura | 62% da altura |
| Deck e recursos (embaixo) | 44% da altura | 38% da altura |
| Moldura | cantos de 16 px, borda de 1 px na cor da linha do tema | cantos de 20 px, sombra suave |

- **Zona da roupa.** A faixa central do palco, com 40% da largura e do topo da cabeça aos pés do avatar, fica sempre
  livre: nenhum painel, personagem, efeito ou texto entra nela.
- **Informações sobre o palco**, nos cantos, fora da zona da roupa:
  - em cima à esquerda: o nome do jogo e o objetivo em uma linha;
  - em cima à direita: os pontos e as estrelas;
  - embaixo à esquerda: quem está na partida;
  - embaixo à direita: os botões de câmera (girar, aproximar, posar).
- **Entregar** é o botão principal, fixo no canto direito da faixa do deck.

### O deck

- **Uma fileira de cartas** que rola para os lados, com as abas de recurso logo acima (Roupas, Maquiagem, Cabelo,
  Acessórios, ou as zonas do editor).
- **Vagas do look** numa régua fina entre o palco e o deck: uma casa por vaga (parte de cima, parte de baixo, calçado,
  acessório, peça inteira), com a miniatura da carta vestida. Tocar numa casa filtra o deck para aquela vaga.
- **Carta selecionada** sobe 12 px e ganha contorno na cor da marca; a carta já vestida mostra um selo "em uso".
- **Carta que não cabe** na vaga escolhida fica com 40% de opacidade, mas continua tocável para ver o motivo.

### O tamanho das cartas

Proporção fixa de 5 por 7, a mesma da carta FLAIR.

| Onde | Celular | Tablet | Computador |
| --- | --- | --- | --- |
| Carta no deck | 76 × 106 px | 92 × 129 px | 108 × 151 px |
| Espaço entre cartas | 8 px | 10 px | 12 px |
| Cartas visíveis sem rolar | 4 | 6 | 8 |
| Miniatura na régua de vagas | 44 × 62 px | 52 × 73 px | 60 × 84 px |
| Carta ampliada (toque longo ou tecla I) | 240 × 336 px | 280 × 392 px | 300 × 420 px |

- **Na carta do deck** cabem só a foto da peça, o nível (cor da moldura), a posição (ícone) e o efeito neste jogo (um
  selo curto, como "+10" ou "defesa +12"). Nome, marca e Hype aparecem na carta ampliada.
- **Área de toque mínima** de 44 × 44 px em tudo.

## 2. Avatares, animações e comandos de cada jogo

**Comuns a todos:** parado respirando, girar, posar (3 poses) e a reação ao resultado (comemora com 3 estrelas, acena
com 1 ou 2, encolhe os ombros com 0). Comandos manuais comuns: navegar, vestir, tirar, girar, aproximar, posar e
entregar. "Automático" é o que roda sozinho depois de entregar.

| Jogo | Avatares | Animações próprias | Manual | Automático |
| --- | --- | --- | --- | --- |
| 1 A Passarela | próprio; plateia e fotógrafos figurantes | caminhada de passarela, parada na ponta, meia-volta | desfilar | plateia aplaude pela nota; flashes |
| 2 Dress Fighter | próprio; oponente figurante | guarda, soco, chute, defesa, esquiva, golpe especial com rastro da peça, queda | nenhum na luta | a luta inteira, em 3 rounds |
| 3 Dress the Star | próprio; silhueta da estrela; plateia | entrada no palco, pose de estrela, reverência | desfilar | a silhueta se revela; plateia reage |
| 4 Personagem de Filme | próprio; equipe de filmagem figurante | pose de cena (3 por gênero), "ação" e "corta" | escolher o título | a claquete bate; as luzes do set acendem |
| 5 Road to Glory | próprio ou modelo da casa | pose de ensaio (5), virar o rosto, olhar para a câmera | aproximar o rosto | flash da fotógrafa |
| 6 Fashion Detective | próprio; segurança e convidados figurantes | caminhar até a porta, mostrar o look, examinar a pista | nenhum além de vestir | andar, entrar, confronto e cutscenes |
| 7 Boutique 3D | próprio; cliente figurante | entregar a peça, cliente prova e gira, cliente aprova ou devolve | nenhum além de vestir | a cliente prova e reage |
| 8 Clube do Coração | manequim com a peça; próprio opcional | giro lento do manequim; torcida ao fundo acena | pintar zonas | nenhum |
| 9 My Favorite Singer | manequim; próprio opcional | giro lento; luz de palco da era | pintar zonas | nenhum |
| 10 O Labirinto | próprio | caminhar, parar diante do espelho, apresentar o look, atravessar a porta | andar por toque na porta | o espelho acende ou ondula; a porta abre |
| 11 Meu Piloto Favorito | manequim de piloto; próprio opcional | pôr o capacete, baixar a viseira, braços cruzados | pintar zonas | nenhum |
| 12 Around the World | próprio; passantes figurantes | caminhada de rua, olhar a vitrine, acenar | caminhar | o mapa avança para a próxima região |
| 13 Meu Super-Herói Favorito | manequim; próprio opcional | pose de herói (3), capa ao vento | pintar zonas | nenhum |
| 14 Fashion Sports | próprio; 4 colegas e 5 adversários figurantes | correr, passar, chutar, defender, comemorar; passe errado por falta de coesão | trocar peça no intervalo | a partida inteira |
| 15 Batalha de Looks | próprio; adversário figurante; plateia | entrada, pose lado a lado, vencedor levanta o braço | desfilar | comparação dos looks; plateia reage |

**Regras das animações:**
- Curtas (até 4 segundos), sem cobrir a roupa, e sempre voltam à pose parada.
- Com "reduzir movimento" ligado, o avatar troca de pose sem transição e as partidas automáticas mostram só o placar.
- Na luta e nos esportes, os impactos são estilizados, sem sangue nem ferimento.
- Figurantes não têm rosto e ficam atrás ou ao lado do avatar.

## 3. O cenário de cada jogo

**Padrão de acabamento para todos:**
- **Sala delimitada:** piso, três paredes ou um fundo fechado, e teto ou céu; a câmera nunca vê o vazio.
- **Zonas marcadas:** a zona do avatar (um tablado, tapete ou marca no piso), a zona dos personagens e a zona de
  decoração, que nunca invadem a zona da roupa.
- **Materiais:** piso, parede e móveis com textura, relevo e brilho coerentes (madeira, mármore, metal escovado,
  veludo, vidro), sem cor chapada.
- **Luz:** uma luz principal de frente para a roupa, uma de recorte por trás e a luz própria do lugar (neon, lustre,
  spots); sombras suaves no piso.
- **Móveis:** poucos e bem acabados, com cantos chanfrados e escala real.

| Jogo | Sala e zonas | Móveis e objetos | Materiais |
| --- | --- | --- | --- |
| 1 A Passarela | salão comprido; passarela elevada no centro; duas fileiras de plateia; fosso de fotógrafos na ponta | cadeiras em fileira, painel de LED ao fundo, trilho de spots no teto | passarela em laca branca brilhante, piso escuro fosco, cortina de veludo |
| 2 Dress Fighter | beco fechado entre dois prédios; ringue marcado no asfalto; calçada dos dois lados | letreiros de neon, grade metálica, caixotes | asfalto molhado com reflexo, tijolo, metal pintado |
| 3 Dress the Star | palco de teatro; ponto central marcado; plateia na penumbra | telão, cortina, dois canhões de luz | piso de madeira encerada, veludo vermelho, metal dourado |
| 4 Personagem de Filme | set de filmagem dentro de um estúdio; cenário de três paredes; área da equipe atrás da câmera | câmera no tripé, refletores, cadeira de diretor, claquete | piso de cimento polido, paredes de cenário pintadas, tecido preto |
| 5 Road to Glory | o provador 3D com o logo e as cores do FashionAI; ponto do avatar diante do espelho | espelho com lâmpadas, banco estofado, arara | paredes rosa-claro, móveis magenta, tecidos verde-petróleo, piso de madeira clara |
| 6 Fashion Detective | hall de entrada de gala; porta dupla ao fundo; cordão de isolamento | cordões com pedestal dourado, tapete, dois vasos altos, lustre | mármore, latão, veludo vinho |
| 7 Boutique 3D | loja de um ambiente; balcão à direita; provador à esquerda; vitrine ao fundo | arara, balcão, espelho de corpo inteiro, poltrona | madeira clara, vidro, metal preto fosco, tapete de lã |
| 8 a 13, Grupo Ateliê 3D | ateliê de um ambiente; bancada à esquerda; manequim no tablado giratório ao centro | bancada com amostras, rolo de tecido, luminária de braço; o fundo muda por modo: arquibancada (clube), palco (cantor), box de corrida (piloto), terraço à noite (herói) | concreto claro, madeira, metal escovado |
| 10 O Labirinto | sala quadrada de quatro paredes; um espelho alto em cada parede com porta; o centro é a zona do avatar | espelhos com moldura, portas com fechadura luminosa, manequim com a peça da sala | parede de pedra clara, piso de ladrilho xadrez, moldura dourada |
| 12 Around the World | trecho de calçada fechado por fachadas; a faixa de caminhada no centro | bancos, postes, vitrines, uma placa da região | pedra portuguesa (Rio), fachadas com reboco, vidro de vitrine |
| 14 Fashion Sports | quadra coberta de futebol de 5; arquibancada de um lado; banco de reservas | traves, placar, redes de proteção | piso emborrachado com linhas, metal das traves, concreto da arquibancada |
| 15 Batalha de Looks | passarela curta em Y; dois pontos de pose lado a lado; plateia em meia-lua | painel de LED com o placar, spots | laca preta brilhante, piso fosco, cortina cinza |

**Orçamento de cada cenário no navegador:** até 60 mil triângulos, até 12 materiais, texturas de 1024 px comprimidas
e luz pré-calculada onde der, para rodar em celular intermediário.

## 4. O efeito de cada carta no cenário

### Os momentos da partida

Toda partida tem os mesmos quatro momentos. A carta faz uma coisa diferente em cada um.

| Momento | O que a pessoa pode fazer com a carta | O que a carta faz no cenário |
| --- | --- | --- |
| 1. Deck | escolher as cartas que leva | a carta mostra o selo do efeito dela neste jogo |
| 2. Preparação | vestir, trocar e tirar cartas, quantas vezes quiser | a peça aparece no avatar na hora, com o efeito de entrada |
| 3. Ação | nada, salvo o **acionamento** que o jogo permitir (tabela abaixo) | a carta age sozinha: pontua, protege, acelera, abre a porta |
| 4. Resultado | nada | as cartas que pontuaram brilham uma a uma, com os pontos de cada uma |

### O efeito de entrada, em todos os jogos

Ao vestir uma carta na preparação, em até 1 segundo:
- um clarão curto na cor do nível da carta (bronze, prata, ouro ou violeta do Especial), vindo de trás do avatar;
- a peça aparece no corpo, com um som de tecido ou de metal conforme o material;
- o selo do efeito sobe da peça até o placar (por exemplo, "+10");
- **carta que não pontua** entra sem clarão, com um som abafado, e o selo aparece cinza com o motivo;
- **Aura Hype:** carta com Hype alto ganha anéis de luz no piso, em volta dos pés, nunca sobre a roupa;
- **Aura Metamorfose** (nível Loft): a luz do cenário muda para a paleta da carta por 2 segundos.

### O que cada carta faz na ação, e quando pode ser acionada

| Jogo | O que a carta faz sozinha na ação | Acionamento pela pessoa | Efeito especial |
| --- | --- | --- | --- |
| 1 A Passarela | a peça no tema acende a faixa de LED da passarela por onde o avatar passa | nenhum | flashes dos fotógrafos por peça no tema; com o look inteiro no tema, a plateia levanta |
| 2 Dress Fighter | calçado decide quem bate primeiro; peças de ataque somam dano; peças de defesa absorvem | **1 carta Especial por luta**, acionada entre os rounds | golpe com rastro de luz na cor da peça; escudo de luz na peça de defesa |
| 3 Dress the Star | cada peça que bate com a estrela acende uma parte da silhueta dela no telão | nenhum | com as 4 peças certas, a silhueta se completa e o telão mostra o nome |
| 4 Personagem de Filme | cada peça do figurino acende um refletor do set | a resposta do título, antes de entregar | com o título certo, a claquete bate e a cena ganha a cor do gênero |
| 5 Road to Glory | cada regra cumprida acende uma lâmpada do espelho | nenhum | com as 4 regras, o flash da fotógrafa e o logo do FashionAI pulsam |
| 6 Fashion Detective | peças de ocasião abrem o cordão; peças de defesa seguram o confronto | nenhum | porta dupla abre com luz dourada (favorável) ou o cordão fecha (desfavorável) |
| 7 Boutique 3D | cada peça certa vai da arara para a cliente | nenhum | a cliente gira e o espelho acende; peça errada volta para o balcão |
| 10 O Labirinto | as peças da mesma família de cor tingem o espelho com aquela cor | **apresentar ao espelho**, quando a pessoa quiser | o espelho acende e a fechadura da porta gira; se falha, o espelho ondula em vermelho |
| 12 Around the World | cada regra da região cumprida acende um ponto no mapa | nenhum | o caminho para a próxima região se desenha no mapa |
| 14 Fashion Sports | chuteira dá velocidade e técnica; camisa, resistência; meias, defesa; uniforme igual dá entrosamento | **trocar 1 peça no intervalo** | chute com rastro na cor da chuteira; passe errado destaca os dois uniformes diferentes |
| 15 Batalha de Looks | cada peça na regra da rodada acende um ponto do placar de LED | nenhum | os dois looks ficam lado a lado e o painel conta os pontos |

Nos modos do Grupo Ateliê 3D (8, 9, 11 e 13) não há cartas: cada zona pintada muda a peça no manequim na hora, e a
regra cumprida acende um spot do ateliê.

### Regras dos efeitos

- Todo efeito nasce atrás, ao lado ou no piso; nada passa na frente da roupa.
- Cada efeito dura no máximo 2 segundos e tem som próprio; os dois podem ser desligados nas preferências.
- Efeito especial nunca muda a nota: ele só mostra o que o servidor já calculou.
- Com "reduzir movimento" ligado, o clarão vira uma mudança de cor sem piscar, e nenhum efeito pisca mais de 3 vezes
  por segundo.
