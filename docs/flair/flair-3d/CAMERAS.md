# Câmeras dos jogos FLAIR 3D

Pedido da dona (15/11/2026): "Para todos os 15 tipos de jogos, estude câmeras convenientes. Não adote a câmera frontal
simplificada. Estude variações tais como RPG, exploração, orbital, lateral, aérea, etc. Adote câmeras que façam sentido:
para a passarela, por exemplo, poderiam coexistir um conjunto delas."

Este documento registra o estudo, o conjunto adotado em cada jogo e onde isso está no código. O estado de cada jogo
(o que já está na tela e o que foi visto) fica em `ESTADO_DOS_JOGOS.md`.

## 1. Estudo: que câmera serve a quê

O estudo parte dos gêneros, não de um jogo comercial. Nada de nome, tela ou enquadramento copiado de outro título.

| Câmera | O que mostra bem | O que mostra mal | Onde costuma aparecer |
| --- | --- | --- | --- |
| Frontal fixa (a do provador) | a roupa de frente, sem distração | profundidade do lugar, movimento, costas e lateral da roupa | provadores; fica chapada em jogo |
| Três quartos | corpo inteiro, volume da roupa e o fundo do lugar ao mesmo tempo | detalhe pequeno | retrato de moda, tela de personagem |
| Orbital | a roupa por todos os lados; o lugar inteiro | um ponto fixo de leitura (o texto do HUD precisa ficar fora) | vitrine giratória, apresentação de personagem |
| Lateral | duas pessoas frente a frente, deslocamento de um lado ao outro | profundidade | jogos de luta e de plataforma |
| Aérea (de cima) | posição de todos, caminhos, tática | a roupa (vira um ponto) | estratégia, mapas, labirintos |
| Diagonal de cima (RPG clássico) | a sala inteira, portas, obstáculos e personagens | detalhe da roupa | RPG tático, exploração de salas |
| Exploração por trás do ombro | para onde a pessoa anda, o que há à frente, as costas da roupa | a frente da roupa | aventura e exploração em terceira pessoa |
| Transmissão | um campo grande com a bola e os dois times | rosto e roupa de um jogador | esporte na TV |
| Travelling (trilho) | um desfile ou uma rua em movimento contínuo | um ponto fixo | cinema, desfile, vitrine |
| Grua | a revelação de um lugar (sobe e mostra a plateia, o palco, a cidade) | detalhe | show, final de cena, pódio |
| De baixo para cima | imponência (herói, estrela no tapete) | o chão e os pés | cinema de herói, fosso de fotógrafos |
| Close | a peça, o tecido, o rosto e a maquiagem | o lugar | editorial, replay |

Conclusões que valem para os 15 jogos:

1. **A roupa é o foco.** Todo jogo tem uma câmera que mostra o corpo inteiro e um close na roupa. A câmera de ação pode
   afastar (campo, labirinto), mas o jogo volta a uma câmera de roupa no replay ou no resultado.
2. **Um conjunto, não uma câmera.** Cada jogo tem de quatro a seis câmeras. A "automática" troca sozinha com o momento
   da partida (preparo, ação, resultado). A pessoa pode fixar qualquer uma no seletor do HUD.
3. **O preparo é em três quartos**, não frontal: a lente fica 24° para o lado, na altura do peito, com o corpo inteiro
   e o fundo do lugar. Trocar de roupa continua legível, e a cena ganha profundidade.
4. **A câmera nunca atravessa parede** nem sai pelo teto: o lugar limita a lente.
5. **Tela em pé (celular):** a câmera recua na mesma linha para caber a mesma largura. O close não recua.
6. **Reduzir movimento:** as câmeras que andam sozinhas (giro de 360°, travelling, grua) ficam paradas no ponto de
   partida, a troca de câmera é um salto e o seletor some (fica a automática).

## 2. Os rigs (biblioteca comum)

`lib/flair/nucleos/camera/rigs.ts`. Cada câmera é um rig com poucos números (distância, altura, ângulo, mira,
velocidade). A função `poseDoRig` devolve a posição, o ponto olhado e a abertura da lente em cada instante.

| Rig | Comportamento |
| --- | --- |
| `ORBITAL` | fica a uma distância e a um ângulo do assunto; com velocidade, gira em volta dele |
| `SEGUE` | atrás de quem anda, acima do ombro, olhando para onde ele vai (exploração) |
| `TRILHO` | vai e volta entre dois ângulos em volta do assunto (travelling) |
| `GRUA` | sobe e desce entre duas alturas, aproximando um pouco no alto |
| `TRANSMISSAO` | do alto da lateral, presa ao centro do lugar, acompanhando o assunto em parte |
| `LATERAL` | de lado, na altura do corpo |
| `AEREA` | de cima, olhando o piso |
| `CLOSE` | perto, em um ângulo e uma altura dados (close na roupa, no rosto, de baixo para cima) |

O zoom da tela vale para qualquer câmera (`lib/flair/nucleos/camera/sala.ts`): aproxima um quinto da distância por
passo e sobe a mira até o rosto.

## 3. O conjunto de cada jogo

`lib/flair/nucleos/camera/jogos.ts`. A primeira coluna é a câmera da automática em cada momento.

| Jogo | Preparo → ação → resultado (automática) | Outras câmeras do seletor | Por quê |
| --- | --- | --- | --- |
| 1 Passarela | três quartos → travelling → grua | fosso dos fotógrafos, giro de 360°, close na roupa | o desfile pede movimento contínuo ao lado da passarela; a grua mostra a plateia no fim |
| 2 Dress Fighter | três quartos → lateral em diagonal → giro de 360° | aérea, close na roupa | o duelo se lê de lado, com os dois no quadro; a câmera fica do lado oposto ao adversário |
| 3 Dress the Star | três quartos → fosso dos fotógrafos → giro de 360° | travelling, grua, close na roupa | tapete vermelho: de baixo, como as lentes dos fotógrafos |
| 4 Personagem de Filme | três quartos → travelling → grua | lateral, close na roupa | set de filmagem: trilho e grua são as câmeras do próprio cenário |
| 5 Road to Glory | três quartos → close no rosto → giro de 360° | lateral, close na roupa | a maquiagem pede o rosto de perto |
| 6 Fashion Detective | três quartos → exploração → close na roupa | diagonal de cima, aérea | exploração de salas: atrás do ombro para andar, diagonal para ler a sala, aérea como mapa |
| 7 Boutique 3D | três quartos → travelling → giro de 360° | lateral, aérea, close na roupa | a loja se percorre: o travelling passa pela vitrine e pelas araras |
| 8 Clube do Coração | três quartos → giro de 360° → grua | lateral, close na roupa | uniforme criado: mostrar por todos os lados |
| 9 Favorite Singer | três quartos → grua → da plateia | giro de 360°, lateral, close na roupa | show: a grua varre o palco, e o resultado é visto de onde o público vê |
| 10 O Labirinto | três quartos → exploração → giro de 360° | aérea, diagonal de cima, close na roupa | andar pelo labirinto por trás do ombro; a aérea mostra o desenho dele |
| 11 Piloto Favorito | três quartos → giro de 360° → grua | lateral baixa, aérea, close na roupa | o piloto e o carro no box, por todos os lados; a grua no pódio |
| 12 Around the World | três quartos → exploração → giro de 360° | travelling, aérea, close na roupa | bairros para percorrer; a aérea mostra o bairro |
| 13 Super-Herói | três quartos → de baixo para cima → grua | giro de 360°, lateral, close na roupa | o ângulo de herói; a grua sobe e mostra a cidade |
| 14 Fashion Sports (preparo do uniforme) | três quartos → giro de 360° → grua | lateral, close na roupa | vestiário |
| 14 Fashion Sports (partida) | transmissão com cortes para o lance e o replay | lateral baixa, aérea tática, atrás do gol, giro do estádio | esporte na TV; a aérea mostra a posição dos dez jogadores |
| 15 Batalha de Looks | três quartos → lateral em diagonal → giro de 360° | da plateia, grua, close na roupa | dois looks lado a lado, com os dois no quadro |

## 3a. Jogo a jogo: o que a pessoa precisa ver, o que foi considerado e o que ficou

Em cada jogo: o que a pessoa precisa ver em cada momento (preparo, ação, resultado), as câmeras consideradas e
recusadas (com o motivo) e o conjunto adotado. O conjunto é o da tabela acima; a frontal fixa foi recusada em todos.

### 1. A Passarela
- **Precisa ver:** no preparo, o look inteiro e a passarela atrás; na ação, o andar e o caimento em movimento; no
  resultado, a modelo no fim da passarela com a plateia.
- **Consideradas e recusadas:** exploração por trás do ombro (mostra as costas o desfile inteiro); aérea (a roupa vira
  um ponto); lateral fixa (a modelo sai do quadro ao andar).
- **Adotado:** três quartos, travelling ao lado da passarela, grua no fim; fosso dos fotógrafos, giro de 360° e close
  na roupa no seletor.

### 2. Dress Fighter
- **Precisa ver:** os dois lutadores no mesmo quadro, quem ataca e o efeito da carta; o look inteiro no fim do round.
- **Consideradas e recusadas:** por trás do ombro (o adversário tapa a pessoa); close (perde o adversário); grua
  (lenta para um duelo).
- **Adotado:** três quartos, lateral em diagonal do lado oposto ao adversário, giro de 360° no resultado; aérea e
  close na roupa no seletor.

### 3. Dress the Star
- **Precisa ver:** a estrela no tapete vermelho, de corpo inteiro, como os fotógrafos a veem; o painel de fundo.
- **Consideradas e recusadas:** aérea (sem sentido em tapete); exploração (não há para onde andar); lateral (mostra o
  perfil, que esconde metade do look).
- **Adotado:** três quartos, fosso dos fotógrafos de baixo para cima, giro de 360°; travelling, grua e close.

### 4. Personagem de Filme
- **Precisa ver:** o figurino inteiro dentro do set; a relação com o cenário do filme.
- **Consideradas e recusadas:** close no rosto (o jogo é de figurino, não de maquiagem); aérea (perde o figurino).
- **Adotado:** três quartos, travelling, grua no resultado; lateral e close na roupa.

### 5. Road to Glory (MAKE UP)
- **Precisa ver:** o rosto de perto ao aplicar a maquiagem; o look inteiro com a maquiagem no resultado.
- **Consideradas e recusadas:** travelling e grua (o rosto sai do quadro); aérea (inútil para maquiagem).
- **Adotado:** três quartos, close no rosto na ação, giro de 360° no resultado; lateral perto e close na roupa.

### 6. Fashion Detective
- **Precisa ver:** para onde anda, as portas, armários, esconderijos e os cones de visão dos guardas; a sala inteira
  ao entrar; o mapa.
- **Consideradas e recusadas:** frontal (não deixa ver o caminho); close (perde a sala); transmissão (feita para
  campo aberto).
- **Adotado:** três quartos, exploração por trás do ombro na ação, close na roupa no desfecho; diagonal de cima (ler a
  sala e os cones) e aérea (mapa) no seletor.

### 7. Boutique 3D
- **Precisa ver:** a cliente, a arara e a vitrine; o look montado de todos os lados.
- **Consideradas e recusadas:** exploração (a loja é pequena: a câmera bate nas paredes); contra-plongée (deforma
  a roupa de perto).
- **Adotado:** três quartos, travelling pela loja, giro de 360°; lateral, aérea e close na roupa.

### 8. Clube do Coração
- **Precisa ver:** o uniforme criado de frente, de costas (número e nome) e de lado.
- **Consideradas e recusadas:** aérea e exploração (não mostram o uniforme); travelling (o vestiário é estreito).
- **Adotado:** três quartos, giro de 360° na ação, grua no resultado; lateral e close na roupa.

### 9. My Favorite Singer
- **Precisa ver:** o figurino no palco, com as luzes; o palco visto do público no resultado.
- **Consideradas e recusadas:** por trás do ombro (de costas para a plateia o tempo todo); aérea.
- **Adotado:** três quartos, grua varrendo o palco, da plateia no resultado; giro de 360°, lateral e close.

### 10. O Labirinto
- **Precisa ver:** o corredor à frente, as bifurcações e o espelho; o desenho do labirinto quando se perde.
- **Consideradas e recusadas:** frontal e lateral (não mostram o caminho); grua (sem uso).
- **Adotado:** três quartos, exploração por trás do ombro, giro de 360° no resultado; aérea (o desenho), diagonal de
  cima e close na roupa.

### 11. Meu Piloto Favorito
- **Precisa ver:** o macacão e o capacete com o carro no box; o pódio no fim.
- **Consideradas e recusadas:** exploração (o box não se percorre); travelling (o carro tapa a roupa em metade do
  trilho).
- **Adotado:** três quartos, giro de 360°, grua no pódio; lateral baixa, aérea e close.

### 12. Around the World
- **Precisa ver:** o bairro, para onde ir e a roupa no lugar de cada região.
- **Consideradas e recusadas:** frontal fixa (o lugar fica atrás do avatar, sem caminho); close (perde o lugar).
- **Adotado:** três quartos, exploração, giro de 360° no resultado; travelling, aérea e close.

### 13. Meu Super-Herói Favorito
- **Precisa ver:** o traje inteiro com a cidade atrás, no ângulo de herói; a capa.
- **Consideradas e recusadas:** aérea (o herói visto de cima perde a imponência); close no rosto (o rosto não é
  avaliado).
- **Adotado:** três quartos, de baixo para cima (com os pés no quadro), grua mostrando a cidade; giro de 360°, lateral
  e close.

### 14. Fashion Sports
- **Precisa ver:** na partida, a bola, os dez jogadores e os gols; no lance, quem joga; no replay, a roupa do autor.
- **Consideradas e recusadas:** por trás do ombro de um jogador (perde o resto do time); frontal (não existe no campo).
- **Adotado:** transmissão com cortes para o lance e o replay; lateral baixa, aérea tática, atrás do gol e giro do
  estádio no seletor. No preparo do uniforme (vestiário), o conjunto do Clube do Coração.

### 15. Batalha de Looks
- **Precisa ver:** os dois looks lado a lado, com a mesma escala; o vencedor de todos os lados.
- **Consideradas e recusadas:** close (um look só); exploração e aérea (sem uso num palco).
- **Adotado:** três quartos, lateral em diagonal com os dois no quadro, giro de 360°; da plateia, grua e close.

## 4. Onde está no código

- Rigs: `lib/flair/nucleos/camera/rigs.ts`. Conjuntos: `lib/flair/nucleos/camera/jogos.ts`. Sala e zoom:
  `lib/flair/nucleos/camera/sala.ts`.
- Cena dos jogos: `components/flair/nucleos/scene/game-camera.tsx` (lê o lugar do avatar no diretor de cena a cada
  quadro, então a câmera acompanha quem desfila ou anda).
- Seletor no HUD: `components/flair/nucleos/nucleo-camera-selector.tsx` (canto de baixo à direita, junto dos botões de
  girar e de zoom; na partida do Fashion Sports, no canto de cima à direita).
- Fashion Sports: `lib/flair/esporte/camera.ts` (a transmissão com cortes e as câmeras do campo).
- Textos: `flair3d.camera.*` em pt-BR, en e es.
- Testes: `lib/flair/nucleos/camera/camera.test.ts`.

## 5. O que falta

- Fashion Detective, O Labirinto e Around the World usam a câmera de exploração, mas ainda sobre as salas antigas, em
  que o avatar não anda: a câmera fica atrás do avatar parado. Ela passa a fazer sentido quando esses jogos virarem
  lugares por onde se anda (`MUNDOS.md`).
- A câmera não desvia de móveis: um móvel alto entre a lente e o avatar pode cobrir a roupa em algumas câmeras de
  algumas salas. Só a câmera do preparo foi conferida sala a sala (por teste: dentro das paredes e de corpo inteiro).
- Nas salas com teto (todas menos as de céu aberto), a câmera aérea fica presa abaixo do teto e vira um close de cima
  do avatar (visto em foto no Piloto Favorito e na Boutique). Ela só mostra o lugar inteiro no estádio e nas salas de
  céu aberto; nas outras, falta abrir a lente (campo de visão maior) quando o teto limita a altura.
