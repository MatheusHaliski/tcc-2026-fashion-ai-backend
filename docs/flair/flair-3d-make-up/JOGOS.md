# FLAIR 3D: os jogos

Os jogos 1 a 5 foram definidos pela dona do projeto em 08/11/2026 e substituem os anteriores (Espelho Partido,
Prova com a Estrela, Rooftop ao Pôr do Sol, Cinco Clientes e Chefe: Vellard), que ainda estão nos dados do app até a
implementação destes. Depois ela pediu mais modos: o jogo 3 virou **Dress the Star**, com três variações, e entraram
**Fashion Detective** (jogo 6) e **Boutique Tycoon / Ateliê 3D** (jogo 7). Por último ela criou dois modos ligados ao
editor de peças 3D do FAI Atelier: **Clube do Coração** (8, um modo artístico com Copilot) e **My Favorite Singer** (9). Em cada jogo, **a definição da dona vem citada como ela escreveu**. O que vem depois, marcado
como **[proposta]**, é detalhe sugerido para ela aprovar ou mudar.

O **FLAIR 3D MAKE UP** é o jogo 5, Road to Glory: "na realidade, é justamente aqui que entra o tal do FLAIR 3D MAKE UP".
O plano dele está em `PLANO.md`. [decidir] O segmento volta a se chamar "FLAIR 3D" no app?

## Regras comuns

- **Tela, como no DREST.** O painel de cima mostra o avatar e o cenário em 3D. O painel de baixo mostra o deck ou o
  catálogo: peças, maquiagem, cabelo e acessórios. Tocar num item veste o avatar na hora.
- **Câmera.** A mesma do provador, com órbita e zoom em detalhes do corpo (`components/three/fitting-camera.tsx`,
  `lib/scene3d/detail-camera.ts`). Hoje ela vai da gola ao calçado; rosto e mãos entram como paradas novas
  (`REUSO_PROVADOR_E_AVATAR.md`).
- **A roupa é o foco.** O avatar fica de pé, posa, desfila ou caminha rápido. Painéis de LED, outdoors, plateia,
  flashes e fogos ficam atrás ou ao lado e nunca cobrem a roupa. A exceção de movimento é o jogo 2, que é luta.
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

## Jogo 2 · Street Fighter (nome de trabalho: Batalha de Rua)

**Definição da dona:** "diferentes tipos de roupa influenciam na velocidade, na combatividade, na defesa e no dano
gerado ao atacar e o dano recebido, além de roupas que concedem superpoderes."

- **Nome.** "Street Fighter" é marca registrada da Capcom e não pode ser o nome do jogo. "Batalha de Rua" é só um nome
  de trabalho até a dona escolher. [decidir]
- **Direção anterior.** Este é o único jogo com combate. A dona tinha dito que os jogos 3D não teriam combate; aqui a
  definição pede luta de forma explícita.
- **Atributos [proposta].** Derivados só de dados que a carta já tem: material, categoria, nível, os atributos FLAIR
  (EDGE, RANGE, CLOUT, GLOW, ART, SYNC) e a habilidade da carta (`FlairAbility`). A tabela de material está em
  `PROTAGONISTA_E_RECURSOS.md` §3.2.

  | Atributo | De onde vem |
  | --- | --- |
  | Velocidade | movimento do material e o calçado: tênis dá mais, salto alto dá menos |
  | Combatividade e dano ao atacar | EDGE da carta e acessórios rígidos, como metal e couro |
  | Defesa e dano recebido | resistência do material: couro, denim e casaco protegem mais |
  | Superpoder | carta Especial, habilidade da carta ou Aura Metamorfose |

- **Partida [proposta]:** luta 1 contra 1 em rounds, vista de lado, com impactos estilizados, sem sangue e adequada a
  13 anos ou mais. A câmera fica aberta para a roupa continuar visível.
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

- **Mini-jogos [proposta].** Os tipos de desafio do DREST, descritos no `ESTUDO_DREST.md` §5: ensaio de fotos, mood
  board, Beauty Mode (maquiagem), joias, missões de marca e eventos especiais. Em cada um há um brief, a pessoa veste a
  modelo da casa ou o próprio avatar, e o look é avaliado.
- **Temporada e níveis [proposta].** A Carreira do `PLANO.md`: 30 níveis, cada um com um desbloqueio permanente de
  técnica, acabamento, lugar ou item promocional. A temporada traz briefs e itens próprios.
- **A diferença.** A câmera 3D do provador, com zoom no rosto e nas mãos para a maquiagem. O DREST mostra uma imagem
  fixa por pose (`ESTUDO_DREST.md` §8).
- **Peças.** Aqui não há deck: vale o guarda-roupa da pessoa mais o catálogo já desbloqueado.

## Jogo 6 · Fashion Detective

**Modo pedido pela dona (texto que ela trouxe):** investigação urbana em que a roupa é o passe de acesso. Para entrar
num evento de gala de luxo, o avatar precisa vestir peças de alta-costura de determinado designer; para entrar num clube
underground, a estética streetwear ou alternativa. O jogador analisa cenas investigando tecidos, desgaste das roupas e
marcas deixadas nos suspeitos para descobrir a profissão e os hábitos de quem é investigado.

- **A porta [proposta]:** o código de vestimenta de cada lugar é a fechadura. O avatar caminha até a entrada; se o
  look cumpre o código (designer, estética, ocasião), a porta abre. Não há esconder, fugir nem lutar: a infiltração é
  só estar vestido certo, o que mantém a roupa como foco.
- **As pistas [proposta]:** a câmera de zoom do provador vira a lupa. A pessoa examina tecido, costura, desgaste e
  manchas nas peças de um manequim ou de um personagem parado e conclui profissão, rotina ou ocasião.
- **O caso [proposta]:** mistério sem violência, adequado a 13 anos ou mais, como uma peça de arquivo que sumiu, uma
  coleção vazada antes do desfile ou um designer anônimo. Sem crime de sangue nem vítima ferida.
- **Cuidado [proposta]:** a dedução usa profissão, rotina, ocasião e época. Não usa classe social, para não ensinar
  estereótipo a partir da roupa.
- **Direção anterior:** a dona tinha pedido que os jogos 3D não tivessem furtividade. Aqui a "camuflagem" é só o código
  de vestimenta na porta, sem mecânica de esconder.

## Jogo 7 · Boutique Tycoon / Ateliê 3D

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

## O editor de peças 3D que os jogos 8 e 9 usam

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

## O que ainda falta decidir

1. O segmento volta a se chamar "FLAIR 3D" no app, com Road to Glory como o modo FLAIR 3D MAKE UP?
2. O nome do jogo 2 no lugar de "Street Fighter".
3. Tamanho do deck (12 é a proposta) e se o jogo 2 também usa deck.
4. A fórmula de pontos da Passarela (+10 por peça no tema, +20 pelo look inteiro, máximo de 70).
5. Partidas ao vivo, contra desfiles gravados, ou os dois.
6. Quais marcas, celebridades e filmes procurar primeiro para licença.
7. Dress the Star: no ranqueado só com o deck, e na partida com amigos com o guarda-roupa inteiro?
8. Fashion Detective e Boutique Tycoon: confirmar o caso sem violência e o relógio opcional para menores.
9. Clube do Coração: a galeria pública entra já, ou fica só a peça salva no FAI Atelier?
10. My Favorite Singer: a peça criada vira carta para os outros jogos?
11. Qual jogo detalhar primeiro.
