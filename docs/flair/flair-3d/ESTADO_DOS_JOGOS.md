# FLAIR: estado de cada jogo

Este documento diz, jogo a jogo, o que o documento de desenho define, o que está no código, o que falta para chamar
o jogo de terminado e o que depende de decisão da dona. Ele é atualizado a cada jogo terminado.

Como ler:

- **Desenho:** o que `JOGOS.md`, `OBJETIVOS_POR_JOGO.md`, `BASE_NUCLEOS.md`, `DESENHO_DA_TELA.md` e
  `CORES_E_ACOES.md` definem.
- **No código:** o que existe, com o arquivo.
- **Lista de conferência:** o que um auditor verifica no navegador. Cada item está **feito**, **parcial** ou
  **pendente**. "Feito" quer dizer que está no código e passa nos testes automáticos; a coluna "Visto na tela" diz se
  alguém já viu rodando.
- **[proposta adotada]:** item que o desenho marcava como [decidir]. Segui a opção mais simples coerente com o
  documento. A dona pode trocar.

O que vale para todos os jogos e não se repete abaixo:

- Público a partir de 13 anos. Nada é apostado: errar custa pontos da partida, nunca saldo. Não há pacote pago.
- A nota nunca usa pele, corpo ou rosto. Marcas, celebridades, clubes e filmes reais só entram como dado, sem logo,
  foto ou cena.
- A roupa é o foco: nenhum painel, personagem ou efeito cobre a faixa central do palco.
- O servidor é a única fonte da nota. A prévia nunca gasta o sorteio: a partida inteira é recalculada da semente.
- **Fora desta entrega em todos os jogos:** partida online com outras pessoas (sala, fila, convite, voto da plateia de
  verdade). O desenho descreve essas variações, mas a base só abre partida solo (`BASE_NUCLEOS.md`, "Os avatares de
  cada partida"). Onde o jogo pede adversário ou plateia, entra um figurante com nota tirada da semente.
- **Fluidez do 3D:** não medida. O ambiente de desenvolvimento não tem placa de vídeo.

## Rodadas: o que mudou na base

Cada jogo passa a ter **rodadas**: o objetivo mais simples (o da base) e as rodadas do grupo dele em
`OBJETIVOS_POR_JOGO.md`. A pessoa escolhe a rodada antes de entrar; o servidor guarda a escolha na partida.

| O quê | Onde |
| --- | --- |
| Lista de rodadas de cada jogo, com objetivo, regras, zonas e opções próprias | `Definicao.rodadas` (`fai-application/.../flair3d/Definicao.java`) |
| Rodada da partida | `Andamento.rodada` (coluna `estado_json`; sem migração nova) |
| O que o jogo revela ao entrar (tema, pistas, cliente, adversário) | `Flair3dNucleo.abertura`, devolvido em `POST .../partidas` |
| Rodada em etapas (um look por etapa, a partida segue aberta) | `Flair3dPercurso` |
| Sorteio por nome a partir da semente (a prévia não gasta) | `Contexto.sorteio(nome)` |
| Escolha da rodada na tela | `components/flair/nucleos/nucleo-rounds.tsx` |

## Resumo

| Nº | Jogo | Estado ao escrever este documento | Mais incompleto primeiro (ordem de trabalho) |
| --- | --- | --- | --- |
| 1 | A Passarela | base: só o tema "Brasil", sem sala nem ranking | 3 |
| 2 | Dress Fighter | base com 3 rounds e carta Especial; um só oponente fixo | 9 |
| 3 | Dress the Star | base: uma estrela fixa, sem pistas | 5 |
| 4 | Personagem de Filme | base: um personagem, um título certo | 6 |
| 5 | Road to Glory (MAKE UP) | 3 briefs e carreira pela tela do MAKE UP | por último |
| 6 | Fashion Detective | caso de 6 salões e mercado (outro agente cuida) | não mexo |
| 7 | Boutique 3D | base: uma cliente fixa | 2 |
| 8 | Clube do Coração | base: um clube, sem placar | 10 |
| 9 | My Favorite Singer | base: uma era | 11 |
| 10 | O Labirinto | base: um espelho; a auditoria não conseguiu vencer | 1 |
| 11 | Meu Piloto Favorito | base: um capacete | 12 |
| 12 | Around the World | base: uma região | 4 |
| 13 | Meu Super-Herói Favorito | base: um arquétipo | 13 |
| 14 | Fashion Sports | 6 modalidades e lances por cor (outro agente cuida) | não mexo |
| 15 | Batalha de Looks | base: uma rodada contra nota fixa | 7 |
| — | FLAIR CBC | 5 elencos jogáveis | não mexo |

O Dress Fighter fica no fim da ordem dos jogos de cartas porque já tinha etapas e acionamento; os quatro modos do
Ateliê vêm depois porque dependem de uma peça que os jogos de cartas não usam (as zonas pintadas no manequim).

## 1 · A Passarela

**Desenho.** Vestir o avatar com roupas que atendem o tema, só com as cartas do deck. O tema só aparece depois de
entrar na partida. Quanto mais peças no tema, mais pontos: +10 por peça, +20 com o look inteiro, máximo de 70. Sala de
4 a 8 participantes, cada um desfila e sai o ranking; quem não acha sala joga contra desfiles gravados. Temas
propostos: Brasil, Noite, Monocromático, Clássico (e uma marca, com licença). Efeito de cor: a luz recorta a silhueta,
brisa, holofote dourado, flashes, aplausos, a passarela acende.

**No código hoje.** `PassarelaNucleo`: só o tema "Brasil", mostrado antes de entrar; sem sala e sem ranking.
Cena: `lib/flair/nucleos/scene/salas/passarela.ts` (passarela, plateia, fotógrafos); desfile manual e automático.

**[proposta adotada]**
- Deck de até 8 cartas (já era a base). Fórmula de pontos: a proposta do documento (+10, +20, máximo 70, que vira 100).
- Partida contra desfiles da casa: 3 figurantes com notas tiradas da semente. Ao vivo fica para o salão online.
- O tema "Nike" não entra: é marca real e pede licença.

**Lista de conferência**

| Item | Estado | Visto na tela |
| --- | --- | --- |
| Rodada "Tema surpresa": o tema só aparece depois de travar o deck, e muda de uma partida para outra | pendente | não |
| Rodadas de treino com tema fixo: Brasil, Noite, Monocromático, Clássico | pendente | não |
| A carta do deck mostra o selo do tema só depois de entrar (antes, "tema surpresa") | pendente | não |
| Resultado com a colocação na sala (você e 3 desfiles da casa) e a nota de cada um | pendente | não |
| Efeito de cor na cena 3D (flashes, aplausos, holofote, passarela acesa, silhueta, brisa) | pendente | não |
| Resultado diz o que pontuou, por quê e o que trocar | pendente | não |
| Sala com 4 a 8 pessoas, cada uma desfilando na vez | pendente (online) | não |

## 2 · Dress Fighter

**Desenho.** A pessoa só veste; a luta roda sozinha em 3 rounds, com atributos que vêm do material, do calçado, do
OVR e da carta Especial. O oponente aparece com o look dele e os atributos ficam lado a lado. O servidor calcula a
luta a partir dos atributos e de um sorteio com semente. Efeito de cor: guarda, esquiva, golpe rápido, fôlego, golpe
forte, foco.

**No código hoje.** `DressFighterNucleo`: 3 rounds em etapas contra o oponente-padrão (40 em tudo), uma carta
Especial por luta, prévia só com os atributos. Cena: `scene/salas/dress-fighter.ts`, `scene/sequences-match.ts`.

**[proposta adotada]**
- O jogo usa o deck da partida (até 6 cartas, 1 calçado), como já estava na base.
- Entre os rounds só vale a carta Especial; não há troca de peça (a opção mais simples do "se a regra permitir").

**Lista de conferência**

| Item | Estado | Visto na tela |
| --- | --- | --- |
| 3 rounds decididos pela roupa, com a carta Especial entre eles | feito | sim (auditoria de 14/11) |
| Três arenas escolhíveis, cada uma com um oponente de atributos próprios | pendente | não |
| O oponente e os atributos dele aparecem antes da luta, ao lado dos seus | pendente | não |
| Nas arenas 2 e 3 cada round tem um impulso tirado da semente (o mesmo na revisão) | pendente | não |
| Efeito de cor na cena 3D (guarda, esquiva, golpes no ar, fôlego, foco) | pendente | não |
| Resultado diz qual atributo perdeu cada round e o que vestir para subir | pendente | não |
| Luta contra o avatar de outra pessoa | pendente (online) | não |

## 3 · Dress the Star

**Desenho.** Registrar o deck; o jogo dá pistas (filmes, músicas, séries) e a pessoa monta o figurino. Três
variações: partida com amigos, duelo X1 e modo Stylist (sozinho; a nota soma a rapidez dos acertos e o quanto as peças
batem com o perfil de estilo). Rodadas do grupo: Para Onde Ela Vai? (40) e Look Relâmpago (41). Efeito de cor: luz de
gala, luz de jardim, chuva de brilho, luz azul suave, tapete vermelho, flashes dos fotógrafos.

**No código hoje.** `DressTheStarNucleo`: uma estrela fixa ("Estrela Pop dos anos 2000"), 25 por peça que bate
estilo ou cor. Cena: `scene/salas/dress-the-star.ts` (palco, telão, silhueta).

**[proposta adotada]**
- No ranqueado (modo Stylist) só vale o deck registrado. A partida com amigos fica para o salão online.
- Modo Stylist sozinho: a plateia da casa "adivinha" pelo figurino. Com as 4 peças no perfil ela acerta sem pista;
  cada peça fora do perfil abre uma pista. É a mesma conta de 25 por peça, dita como no pedido da dona.
- As estrelas são arquétipos inventados (época e estilo), sem nome nem imagem de pessoa real.

**Lista de conferência**

| Item | Estado | Visto na tela |
| --- | --- | --- |
| Rodada "Estrela Pop dos anos 2000" (a da base) | feito | sim (auditoria de 14/11) |
| Rodada "Modo Stylist": estrela sorteada entre 4 perfis, com 3 pistas de texto mostradas ao entrar | pendente | não |
| O resultado do Stylist diz quantas pistas a plateia precisou abrir | pendente | não |
| Rodada "Look Relâmpago": o look-alvo aparece por 10 segundos e some; 25 por vaga igual em tipo e cor | pendente | não |
| Efeito de cor na cena 3D | pendente | não |
| Resultado diz o que pontuou e o que trocar | pendente | não |
| Rodada "Para Onde Ela Vai?" (10 perguntas com personagens vestidas) | pendente | não |
| Partida com amigos e duelo X1 | pendente (online) | não |

## 4 · Personagem de Filme

**Desenho.** Escolher o deck; o jogo descreve a cena aos poucos; a pessoa veste o personagem e escolhe o título entre
4. Acertar o título vale a maior parte; as peças do figurino somam. Rodada do grupo: Adivinhe a Década (39). Efeito
de cor: luz de suspense, aventura, comédia, ficção científica, romance, a claquete bate.

**No código hoje.** `PersonagemFilmeNucleo`: um personagem (detetive noir), o título certo é sempre o mesmo.
Cena: `scene/salas/personagem-filme.ts` (set, claquete, refletores).

**[proposta adotada]**
- Títulos inventados, como na base: nenhum filme real é citado.
- Adivinhe a Década, sozinho: o jogo dá as pistas da década sorteada sem dizer qual é; a pessoa veste e escolhe a
  década entre 4. A versão em sala (cada um veste na sua vez) fica para o salão online.

**Lista de conferência**

| Item | Estado | Visto na tela |
| --- | --- | --- |
| Rodada "Detetive noir" (a da base) | feito | sim (auditoria de 14/11) |
| Rodada "Cena sorteada": 4 personagens, um por partida, com 3 pistas de cena | pendente | não |
| Rodada "Adivinhe a Década": 4 décadas, pistas de moda, resposta entre 4 | pendente | não |
| Efeito de cor na cena 3D (luz do gênero, claquete) | pendente | não |
| Resultado diz o título certo, as peças que bateram e o que trocar | pendente | não |
| Partida com 2 a 4 pessoas | pendente (online) | não |

## 5 · Road to Glory (FLAIR 3D MAKE UP)

**Desenho.** Vestimenta, maquiagem e cabelo como no DREST, com temporadas e 30 níveis; cada mini-jogo é um brief
avaliado. A diferença é a câmera 3D com zoom no rosto. Sem deck. Rodadas do grupo: 10 de maquiagem e cabelo (67 a 76)
e 5 de estilo e temporada (95 a 100).

**No código hoje.** `FlairMakeUpService`, 3 briefs (`makeup/briefs/`: Ensaio de Verão, Entrevista, Primeiro
Encontro), Prestígio e carreira, tela em `components/flair/make-up/`. O núcleo `ROAD_TO_GLORY` joga só o Ensaio de
Verão. Maquiagem em 3 áreas (lábios, bochechas, olhos); não há cabelo, unhas, joias nem zoom nas mãos.

**[proposta adotada]**
- Os briefs novos usam só o que a paleta de hoje tem (lábios, bochechas, olhos). Cabelo e unhas dependem de recursos
  que o provador ainda não tem (`REUSO_PROVADOR_E_AVATAR.md`).

**Lista de conferência**

| Item | Estado | Visto na tela |
| --- | --- | --- |
| 3 briefs com nível mínimo, Prestígio e subida de nível | feito | sim (auditoria de 14/11) |
| Briefs do grupo: Make Monocromática (72), Make Natural (73), Make que Conversa com a Roupa (74) | pendente | não |
| O núcleo Road to Glory oferece os briefs como rodadas | pendente | não |
| Resultado diz a regra que faltou e o que trocar | pendente | não |
| Celular: a cena e a barra de botões cabem na largura | pendente | não |
| Cabelo, unhas, joias, temporadas e os 30 níveis com desbloqueios | pendente | não |

## 6 · Fashion Detective

Outro agente cuida deste jogo nesta rodada (textos e celular). Só registro o estado.

**Desenho.** Caso de 6 salões, um look por salão; acesso, desafio automático e pista; mercado depois do salão 3;
final automático com 5 pistas. Rodadas do grupo (42 a 48): Verdadeiro ou Falso, Quem Mudou?, Detetive de Tecido, Peça
Intrusa, Quem é o Dono?.

**No código.** `FashionDetectiveNucleo`, `FashionDetectiveCaso`, `FashionDetectiveSalao`, `FashionDetectiveMercado`;
6 salões em 3D (`scene/salas/fashion-detective-saloes.ts`), cartão e câmera de abertura.

| Item | Estado | Visto na tela |
| --- | --- | --- |
| Caso de 6 salões com mercado e final pelo número de pistas | feito | sim (reauditoria) |
| Cutscene de resultado diferente por salão; mercado com cena própria | pendente | não |
| Rodadas de dedução do grupo (42 a 48) | pendente | não |
| Celular sem texto sobre a cena | com o outro agente | — |

## 7 · Boutique 3D

**Desenho.** Gestão de uma boutique: clientes chegam com pedidos e prazo; a pessoa veste, a cliente prova e reage; o
sucesso gera moedas para expandir a loja, contratar equipe e abrir coleções. Rodadas do grupo: Vitrine que Vende
(87), Pop-up de Fim de Semana (88), Personal Stylist (89), Arara Organizada (90), Provador Lotado (91) e outras.
Efeito de cor: vitrine em luz de noite, etiqueta, placa de destaque, a cliente olha, a cliente sorri, a vitrine acende.

**No código hoje.** `Boutique3dNucleo`: uma cliente fixa ("festa à noite, em preto"), 33 por peça.
Cena: `scene/salas/boutique-3d.ts` (arara, balcão, espelho, cliente).

**[proposta adotada]**
- Sem relógio em nenhuma rodada (o relógio era opcional para 13 a 17 anos; a opção mais simples é ninguém ter).
- As rodadas usam o deck da partida como estoque da loja.
- Moedas, expansão da loja e equipe não entram: pedem uma camada de gestão que o documento ainda marca como proposta.

**Lista de conferência**

| Item | Estado | Visto na tela |
| --- | --- | --- |
| Rodada "Festa em preto" (a da base) | feito | sim (auditoria de 14/11) |
| Rodada "Personal Stylist": 3 clientes sorteadas, um look para cada, 1 estrela por pedido (ocasião, cor, estilo) | pendente | não |
| Rodada "Vitrine que Vende": 3 manequins para o gosto do dia; cada um no gosto atrai 10 clientes | pendente | não |
| Rodada "Provador Lotado": 5 clientes devolvem uma peça com um motivo; 20 por substituta certa | pendente | não |
| Um cartão apresenta a cliente da vez e o pedido dela, sem cobrir a roupa | pendente | não |
| Efeito de cor na cena 3D (vitrine, espelho, cliente) | pendente | não |
| Resultado diz o pedido que faltou em cada cliente | pendente | não |
| Pop-up de Fim de Semana (pede estoque de 16 peças), moedas, expansão e equipe | pendente | não |

## 8 · Clube do Coração

**Desenho.** Modo artístico, sem placar: a pessoa escolhe qualquer clube e cria uma peça no editor 3D, com um Copilot
de conversa. Depois de criar, salva no FAI Atelier e pode publicar numa galeria. Desafios do Grupo Ateliê 3D (49 a
58), entre eles o Uniforme de E-sports (51).

**No código hoje.** `ClubeCoracaoNucleo`: um clube (Clube Atlântico, azul e branco), 4 zonas, sem placar.
As zonas pintadas não aparecem no manequim da cena. Sem Copilot.

**[proposta adotada]**
- A galeria pública não entra agora; a criação fica só na partida. Salvar no FAI Atelier e o Copilot dependem do
  editor de peças 3D, que outro agente está mexendo nesta rodada.
- Clubes inventados, só com as cores.

**Lista de conferência**

| Item | Estado | Visto na tela |
| --- | --- | --- |
| Rodada "Clube Atlântico" sem placar (a da base) | feito | sim (auditoria de 14/11) |
| Rodada "Clube Aurora" (vermelho e preto), sem placar | pendente | não |
| Rodada "Uniforme de E-sports" (51), com nota de 0 a 100 em 4 regras | pendente | não |
| As zonas pintadas aparecem no manequim na hora | pendente | não |
| Resultado diz a regra que faltou | pendente | não |
| Copilot, salvar no FAI Atelier e galeria | pendente | não |

## 9 · My Favorite Singer

**Desenho.** Escolher artista e era; o jogo mostra o perfil da era; a pessoa cria uma peça única; a nota mede quanto a
peça combina com a era. Vitrine "Eras" no perfil. Desafio do grupo: Jaqueta da Banda (50).

**No código hoje.** `FavoriteSingerNucleo`: uma era ("Era Neon"), 4 regras de 25.

**[proposta adotada]**
- A peça criada não vira carta para os outros jogos (ela ainda não veste o avatar).
- Eras de artistas inventados, sem nome real.

**Lista de conferência**

| Item | Estado | Visto na tela |
| --- | --- | --- |
| Rodada "Era Neon" (a da base) | feito | sim (auditoria de 14/11) |
| Rodada "Era Acústica" | pendente | não |
| Rodada "Jaqueta da Banda" (50) | pendente | não |
| As zonas pintadas aparecem no manequim na hora | pendente | não |
| Resultado diz a regra que faltou | pendente | não |
| Vitrine "Eras", voto da comunidade, Copilot | pendente | não |

## 10 · O Labirinto

**Desenho.** Um labirinto de 9 salas com 5 espelhos; cada espelho pede uma combinação de roupa; peças achadas pelo
caminho entram na mala da partida; menos tentativas erradas dão mais estrelas. Rodadas do grupo: Escada de Espelhos
(63), Três Portas (64), Corredor de Holofotes (65) e outras. Efeito de cor: sombras, trilha de luz, lanterna, reflexo
azul, os espelhos piscam, clarão.

**No código hoje.** `LabirintoNucleo`: um espelho ("3 peças da mesma família de cor"), apresentações repetidas com
100, 80, 60 e 0 pontos. A auditoria jogou 13 vezes sem abrir: o deck não tinha 3 cartas da mesma família, e nada
avisava disso. Cena: `scene/salas/labirinto.ts`.

**[proposta adotada]**
- A pessoa entra com o deck da partida (até 8 cartas).
- As peças achadas no labirinto valem só dentro da partida.
- A peça achada entra assim: depois de 2 apresentações sem abrir, a sala oferece a peça do manequim, na família de
  cor mais perto de fechar, e ela conta como uma peça no espelho.

**Lista de conferência**

| Item | Estado | Visto na tela |
| --- | --- | --- |
| A tela do deck avisa quando o deck não tem 3 cartas da mesma família de cor | pendente | não |
| Quando o espelho não abre, a tela diz a família mais perto e quantas peças faltam, em texto comum | pendente | não |
| Depois de 2 tentativas sem abrir, a peça achada na sala entra e o espelho pode abrir | pendente | não |
| Rodada "Escada de Espelhos": 5 espelhos, cada um soma uma regra; 20 por espelho de primeira | pendente | não |
| Rodada "Três Portas": 3 salas, porta fácil, média ou difícil; meta de 6 estrelas | pendente | não |
| Rodada "Corredor de Holofotes": um look para 5 condições; 20 por holofote | pendente | não |
| Efeito de cor na cena 3D (espelho e fechadura) | pendente | não |
| Grade de 9 salas com caminhada por toque, chaves e mala de 6 peças | pendente | não |

## 11 · Meu Piloto Favorito

**Desenho.** Customizar o macacão e o capacete de um piloto no editor 3D, com Copilot de vocabulário de corrida.
Bases novas: capacete e macacão por zonas. Desafio do grupo: Tênis dos Sonhos (49).

**No código hoje.** `PilotoFavoritoNucleo`: capacete da "Equipe Aurora", 4 regras de 25.

**[proposta adotada]**
- As bases de capacete e macacão entram como zonas pintadas na partida, não como malha nova no editor do FAI Atelier.
  Número e faixas dependem de estampa, que o editor não tem.

**Lista de conferência**

| Item | Estado | Visto na tela |
| --- | --- | --- |
| Rodada "Capacete da Equipe Aurora" (a da base) | feito | sim (auditoria de 14/11) |
| Rodada "Macacão da Equipe Boreal" (tronco, mangas, pernas, gola, cinto) | pendente | não |
| Rodada "Tênis dos Sonhos" (49) | pendente | não |
| As zonas pintadas aparecem no manequim na hora | pendente | não |
| Resultado diz a regra que faltou | pendente | não |
| Copilot de corrida, malha de capacete e macacão no editor, número e faixas | pendente | não |

## 12 · Around the World

**Desenho.** Um mapa com 8 regiões ligadas por caminhos; cada região tem uma vestimenta que a pessoa completa com o
deck; a região ganha de 1 a 3 estrelas e abre a seguinte; quem não cumpre tenta de novo. Rodadas do grupo: Elevador da
Torre (59), Metrô de Moda (60), Shopping de 4 Andares (61) e outras. Efeito de cor: noite na cidade, luz de parque,
sol da tarde, brisa do mar, festa de rua, luz de inverno.

**No código hoje.** `AroundTheWorldNucleo`: só a região 1 (Rio de Janeiro), 4 regras de 25.
Cena: `scene/salas/around-the-world.ts` (calçadão, vitrine, mapa).

**[proposta adotada]**
- As 8 regiões são as do exemplo do documento: Rio de Janeiro, Nova York, Paris, Milão, Lagos, Seul, Tóquio e Sydney.
- O look-guia usa só a estética (clima, estilo, paleta), sem marcas reais. O bônus de marca do país fica só no Rio.
- O percurso é uma rota fixa, na ordem acima. Escolher o caminho no mapa fica para depois.
- O deck sobe para até 12 cartas, porque a volta tem 8 looks.

**Lista de conferência**

| Item | Estado | Visto na tela |
| --- | --- | --- |
| Rodada "Rio de Janeiro" (a da base) | feito | sim (auditoria de 14/11) |
| Rodada "Volta ao mundo": 8 regiões em sequência; com 60 pontos a região abre a próxima; menos que isso, tenta de novo | pendente | não |
| Um cartão apresenta a região da vez, o clima, a estética e a paleta | pendente | não |
| Rodada "Elevador da Torre": 4 andares, até 2 trocas por andar, 25 por andar de primeira | pendente | não |
| Rodada "Metrô de Moda": 6 estações, exatamente 1 troca por estação | pendente | não |
| Rodada "Shopping de 4 Andares": 1 item por andar para o pedido sorteado | pendente | não |
| Efeito de cor na cena 3D | pendente | não |
| Resultado com as estrelas de cada região | pendente | não |
| Cenário próprio de cada região, mapa com escolha de caminho, selo do passaporte | pendente | não |

## 13 · Meu Super-Herói Favorito

**Desenho.** Editar peças de arquétipo (traje, armadura, capa, máscara) com um Copilot que traduz o nome do herói em
traços genéricos. Sem licença: nenhum uniforme, emblema ou nome protegido.

**No código hoje.** `SuperHeroiNucleo`: arquétipo "armadura", 4 regras de 25; o emblema protegido tira pontos.

**[proposta adotada]**
- Só arquétipos e heróis criados pela pessoa. Não se busca licença.
- Os dois emblemas que imitam heróis existentes saem da lista de opções; o servidor continua recusando os códigos
  antigos.

**Lista de conferência**

| Item | Estado | Visto na tela |
| --- | --- | --- |
| Rodada "Armadura" (a da base) | feito | sim (auditoria de 14/11) |
| Rodada "Traje colante" | pendente | não |
| Rodada "Vigilante da noite" | pendente | não |
| A lista de emblemas só tem emblemas próprios | pendente | não |
| As zonas pintadas aparecem no manequim na hora | pendente | não |
| Resultado diz a regra que faltou | pendente | não |
| Copilot de heróis, emblema desenhado pela pessoa | pendente | não |

## 14 · Fashion Sports

Outro agente cuida deste jogo nesta rodada (motor, quadras e legendas do placar). Só registro o estado.

**Desenho.** Futebol de 5 e outras modalidades que rodam sozinhas; a pessoa só veste o time; coesão do uniforme;
troca no intervalo; a cor da peça dispara o lance. Rodadas do grupo (27 a 38): tênis, basquete 3×3, vôlei, corrida,
skate, golfe, dança e revezamento.

**No código.** `FashionSportsNucleo`, `FashionSportsModalidade` (6 modalidades), `FashionSportsLances`; quadras em
`scene/salas/fashion-sports-quadras.ts`.

| Item | Estado | Visto na tela |
| --- | --- | --- |
| 6 modalidades escolhidas na aba Modalidade, dois tempos, até 3 lances por cor | feito | sim (reauditoria) |
| Placar coerente com o jogo e legenda de empate | com o outro agente | — |
| Quadra própria de cada modalidade (rede, raias), figurantes no número certo | com o outro agente | — |
| Vestir os 5 jogadores um a um, coesão abaixo de 100%, goleiro | pendente | não |
| Golfe, dança e revezamento como modalidades | pendente | não |

## 15 · Batalha de Looks

**Desenho.** Vencer a batalha: mais pontos que o adversário em 3 rodadas, cada uma com um objetivo de regra clara
sorteado; empate vai para o voto da plateia. Objetivos do grupo: Look Monocromático (15), Dress Code do Convite (16),
Vista o Clima (17) e outros. Efeito de cor: batida de impacto, a torcida vibra, faíscas, onda de luz azul, luz de
chamas, luz estroboscópica.

**No código hoje.** `BatalhaLooksNucleo`: uma rodada (monocromático em azul) contra nota fixa de 75.
Cena: `scene/salas/batalha-looks.ts` (passarela em Y, adversário, plateia, painel).

**[proposta adotada]**
- Formato sozinho contra o adversário da casa; a nota dele em cada rodada sai da semente. No empate, o "voto da
  plateia" também sai da semente.
- Vista o Clima usa um clima sorteado (calor, frio ou chuva), não a previsão real da cidade: o jogo não pede a
  localização da pessoa.

**Lista de conferência**

| Item | Estado | Visto na tela |
| --- | --- | --- |
| Rodada "Batalha": 3 rodadas com objetivo sorteado, soma contra o adversário, desempate pela plateia | pendente | não |
| Rodadas de treino: Look Monocromático em azul (a da base), Dress Code do Convite, Vista o Clima | pendente | não |
| Um cartão apresenta o objetivo de cada rodada | pendente | não |
| O painel da cena mostra a soma dos dois | pendente | não |
| Efeito de cor na cena 3D | pendente | não |
| Resultado com a nota de cada rodada, sua e do adversário | pendente | não |
| Duelo 1×1, sala de 4 e modos com amigos | pendente (online) | não |

## FLAIR Card Building Challenge

Outro agente cuida da confirmação de entrega do CBC nesta rodada. Só registro o estado.

**Desenho.** Elencos de cartas ligadas por linhas; química; 5 elencos com requisitos; arte exclusiva numerada por
edição; recompensas (itens, cupons, arte).

**No código.** `FlairCbcSquadService`, 5 elencos em `flair3d/cbc/elencos/`, tabuleiro e quebra-cabeça em
`components/flair/elencos/`.

| Item | Estado | Visto na tela |
| --- | --- | --- |
| 5 elencos com conferir, entregar e número da edição | feito | sim (auditoria de 14/11) |
| Confirmação antes de entregar | com o outro agente | — |
| Arte exclusiva da dona (hoje é arte provisória em SVG) | pendente (decisão da dona) | — |
| Recompensas reais (cupons, itens promocionais) | pendente (parcerias) | — |
