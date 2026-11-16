# FLAIR 3D: a base dos 15 núcleos

O FLAIR 3D são os 15 núcleos (os jogos 1 a 15 de `JOGOS.md`), em `/flair/3d` sobre `/api/flair/3d/...`. Cada núcleo
ganha uma base que já joga a modalidade mais simples dele, para os jogos derivados copiarem o mesmo esqueleto. Este
documento é o contrato entre backend e frontend. A API antiga `/api/flair/games/...`, dos capítulos do desenho
anterior, saiu do app em 15/11/2026 (`../ENDPOINTS_FLAIR.md`).

## Camadas

| Camada | Arquivo | Uma por núcleo? |
| --- | --- | --- |
| Tabela | `V101__flair3d_partidas.sql`: `flair3d_matches` (status `ABERTA`, `EM_ACAO` ou `ENTREGUE`; `estado_json` com tentativas e acionamentos) | não, compartilhada |
| Entidade e repositório | `Flair3dMatch`, `Flair3dMatchRepository` | não |
| Núcleo (Strategy) | `fai-application/.../flair3d/nucleos/<Nome>Nucleo.java`, implementa `Flair3dNucleo` | **sim** |
| Service | `Flair3dNucleoService`: lista, detalhe, abre partida, prévia, entrega, acionamento e pontuação delegando ao núcleo | não |
| Controller e rota backend | `Flair3dNucleoController`, `/api/flair/3d/...` | rota com o código do núcleo |
| Rota frontend | `app/(site)/(app)/flair/3d/page.tsx` e `.../flair/3d/[nucleo]/page.tsx` | rota com o código do núcleo |
| Arquivo frontend do núcleo | `lib/flair/nucleos/<codigo>.ts`: cenário, personagens, recursos e ações | **sim** |
| Tela | `components/flair/nucleos/*`: tela, cenário 3D, janela de recursos, ícones, objetivo e controles | não |

Criar um jogo derivado = uma classe `Flair3dNucleo` nova (ou uma variante do objetivo dentro dela) + um arquivo de
cenário em `lib/flair/nucleos/`.

## Os 15 núcleos e o objetivo mais simples de cada um

Pontuação de 0 a 100; estrelas em 60, 80 e 100. Tudo calculado no servidor, de forma determinística (sorteio com
semente fixa por partida). A nota nunca usa pele, corpo ou rosto; errar nunca tira saldo.

| Nº | Código | Recursos | Objetivo mais simples | Regras (pontos) |
| --- | --- | --- | --- | --- |
| 1 | `PASSARELA` | cartas | Tema "Brasil": vestir marcas brasileiras | +10 por peça de marca com país BR; +20 se todas as vagas preenchidas são BR; máx. 70, normalizado para 100 |
| 2 | `DRESS_FIGHTER` | cartas | Vencer 2 de 3 rounds contra o oponente-padrão (velocidade, ataque e defesa 40) | Atributos das peças: calçado tênis +velocidade, salto −velocidade; couro, denim e lã +defesa; metal e couro +ataque; OVR soma; vence 2 rounds = 100, 1 = 50, 0 = 0. Em etapas: um round por vez, com 1 carta Especial do deck por luta (soma 20 + OVR/10 ao atributo do round seguinte) |
| 3 | `DRESS_THE_STAR` | cartas | Vestir a "Estrela Pop dos anos 2000" (estilos y2k ou glam; cores rosa ou prata) | 25 por peça que bate estilo ou cor (4 vagas) |
| 4 | `PERSONAGEM_FILME` | cartas + resposta | Vestir o "detetive noir" e acertar o filme entre 4 títulos inventados | 50 pelo título certo; 12,5 por peça que bate (casaco, cores preto, bege ou cinza) |
| 5 | `ROAD_TO_GLORY` | cartas + maquiagem | Brief "Ensaio de Verão" | 25 por regra: ocasião casual ou praia; material leve; batom da família coral; acabamento do batom gloss ou cetim |
| 6 | `FASHION_DETECTIVE` | cartas | O caso em 6 salões, um look por salão | Cada salão: acesso 40 (2 peças do código de vestimenta), desafio automático 40 (defesa + vida + dano no limite do salão, ou furtividade 40) e pista 20 (a peça que a carta aponta). Mercado depois do salão 3. Nota = média dos salões; 5 pistas resolvem o caso (`CORES_E_ACOES.md`) |
| 7 | `BOUTIQUE_3D` | cartas | Cliente 1 pede "festa à noite, em preto" | 33 por peça com ocasião festa e cor preta (3 vagas); 100 com as 3 |
| 8 | `CLUBE_CORACAO` | zonas do editor | Criar uma camisa do "Clube Atlântico" (azul e branco) | Modo artístico: sem placar; concluído quando todas as zonas usam as 2 cores do clube |
| 9 | `FAVORITE_SINGER` | zonas do editor | Peça da "Era Neon" | 25 por regra: rosa dominante; roxo em uma zona; 1 zona metálica; até 3 cores |
| 10 | `LABIRINTO` | cartas | Espelho 1: "3 peças da mesma família de cor" | Apresenta ao espelho quantas vezes quiser: não abriu, diz o que faltou e a partida segue aberta; abriu, vale 100 na 1ª apresentação, 80 na 2ª, 60 na 3ª e 0 daí em diante (a porta abre do mesmo jeito) |
| 11 | `PILOTO_FAVORITO` | zonas do editor | Capacete da "Equipe Aurora" (amarelo e verde) | 25 por regra: topo amarelo; laterais amarelas; faixa da viseira verde; viseira espelhada |
| 12 | `AROUND_THE_WORLD` | cartas | Região 1, Rio de Janeiro | 25 por regra: parte de cima leve; parte de baixo leve; cor quente; marca brasileira |
| 13 | `SUPER_HEROI` | zonas do editor | Arquétipo "armadura" | 25 por regra: peito metálico; até 2 cores; capa presente; nenhum emblema protegido |
| 14 | `FASHION_SPORTS` | cartas | Futebol de 5 jogado por cartas: o uniforme dá os atributos e cada jogada é uma carta da mão (definição de 15/11/2026, `JOGOS.md`, jogo 14) | Duelo de cada jogada: força do time × fôlego + poder da carta contra o adversário, mais sorte da semente; vitória = 100, empate = 60, derrota = 0. Seis modalidades, cada uma com as suas jogadas, relógio e placar |
| 15 | `BATALHA_LOOKS` | cartas | Rodada "Look Monocromático" em azul contra o adversário-padrão (75) | 25 por peça da família azul; vence com mais de 75 |

**Recursos:**
- **Cartas:** as cartas FLAIR da pessoa (`/api/me/flair/cards`), por vaga: `SUP`, `INF`, `CAL`, `ACE`, `VES`.
- **Zonas:** do editor, cada uma com cor (hex) e acabamento (`FOSCO`, `BRILHANTE`, `METALICO`, `ESPELHADO`).
- **Maquiagem:** áreas `LABIOS`, `OLHOS`, `BOCHECHAS`, cada uma com família de cor e acabamento.

## O deck da partida

Antes de jogar, a pessoa monta o deck: escolhe quais cartas FLAIR do guarda-roupa leva para a partida. Durante a
partida, só as cartas do deck aparecem na janela de recursos e só elas podem ser entregues (o servidor confere).

| Código | Tamanho do deck | Cartas obrigatórias | Efeito de cada carta no jogo |
| --- | --- | --- | --- |
| `PASSARELA` | até 8 | 1 parte de cima, 1 parte de baixo, 1 calçado | +10 se a marca é brasileira |
| `DRESS_FIGHTER` | até 6 | 1 calçado | velocidade, ataque e defesa que a carta soma |
| `DRESS_THE_STAR` | até 8 | 1 parte de cima, 1 parte de baixo | +25 se bate estilo ou cor da estrela |
| `PERSONAGEM_FILME` | até 8 | 1 casaco ou parte de cima | +12,5 se bate o figurino do personagem |
| `ROAD_TO_GLORY` | sem deck: guarda-roupa e catálogo liberado | nenhuma | regras do brief que a carta cumpre |
| `FASHION_DETECTIVE` | até 12 | 1 parte de cima ou peça inteira | conta no acesso (ocasião), na defesa e na ação da cor |
| `BOUTIQUE_3D` | até 8 | 1 parte de cima, 1 parte de baixo | +33 se cumpre ocasião festa e cor preta |
| `CLUBE_CORACAO`, `FAVORITE_SINGER`, `PILOTO_FAVORITO`, `SUPER_HEROI` | sem deck: zonas do editor | nenhuma | — |
| `LABIRINTO` | até 8 | 3 cartas quaisquer | família de cor que a carta traz para o espelho |
| `AROUND_THE_WORLD` | até 8 | 1 parte de cima, 1 parte de baixo | regras da região que a carta cumpre |
| `FASHION_SPORTS` | até 15 | 1 camisa, 1 calção, 1 chuteira | o uniforme dá velocidade, técnica, resistência, defesa e físico; as outras cartas são a mão, e cada uma mostra a ação da cor e o poder |
| `BATALHA_LOOKS` | até 8 | 1 parte de cima, 1 parte de baixo, 1 calçado | +25 se é da família de cor da rodada |

**Na tela [frontend]:** antes da partida, a tela do deck mostra as cartas da pessoa com o efeito de cada uma neste
núcleo (selos como "+10 marca BR" ou "defesa +12"), o contador do deck, a lista de obrigatórias com o que falta e o
botão "Entrar na partida", que só fica ativo com o deck válido.

**Na API [backend]:**
- A definição do núcleo ganha `deck: {tamanhoMax, obrigatorias:[{posicao, quantidade}], semDeck}`.
- `POST /api/flair/3d/nucleos/{codigo}/efeitos` com `{cartas:[cardId]}` devolve `{efeitos:[{cardId, itens:[{codigo,
  valor, motivo}]}]}`: o efeito de cada carta da pessoa neste núcleo (logado; só cartas da própria pessoa). Carta que
  não pontua leva um item com `motivo: true`, valor 0 e o código do motivo (tabela na seção "API"), nunca a lista vazia.
- `POST .../partidas` passa a receber `{deck:[cardId]}`: o servidor confere tamanho, obrigatórias e dono (422 com o
  que falta) e guarda o deck na partida (coluna `deck_json`).
- A entrega recusa carta fora do deck (422).

## Cenário e personagens (arquivo do núcleo no frontend)

| Código | Cenário | Personagens além do avatar |
| --- | --- | --- |
| `PASSARELA` | passarela com plateia dos dois lados | plateia, fotógrafos |
| `DRESS_FIGHTER` | arena de rua com luzes de neon ao fundo | oponente |
| `DRESS_THE_STAR` | palco com telão | silhueta da estrela, plateia |
| `PERSONAGEM_FILME` | set de filmagem | claquete, câmera |
| `ROAD_TO_GLORY` | estúdio de foto | fotógrafa |
| `FASHION_DETECTIVE` | entrada de gala | segurança |
| `BOUTIQUE_3D` | boutique com arara e balcão | cliente |
| `CLUBE_CORACAO` | ateliê com manequim | nenhum |
| `FAVORITE_SINGER` | ateliê com manequim | nenhum |
| `LABIRINTO` | sala do labirinto com espelho | nenhum |
| `PILOTO_FAVORITO` | box de corrida com capacete no suporte | nenhum |
| `AROUND_THE_WORLD` | calçadão do Rio | passantes |
| `SUPER_HEROI` | terraço à noite | nenhum |
| `FASHION_SPORTS` | quadra de futebol de 5 | 4 colegas de time, 5 adversários |
| `BATALHA_LOOKS` | passarela curta | adversário, plateia |

Os personagens são manequins ou silhuetas simples nesta base (sem rosto), posicionados atrás ou ao lado do avatar,
nunca na frente da roupa.

## Os avatares de cada partida

Os avatares são os mesmos que cada pessoa cria no perfil do FashionAI (`/api/me/avatar3d`, `UserAvatar3d`). Cada
núcleo e cada variação diz quais avatares entram na partida. Ninguém precisa criar avatar novo para jogar.

**Tipos de avatar na cena:**
- `PROPRIO`: o avatar do perfil de quem joga.
- `MODELO_CASA`: uma modelo da casa, para quem não tem avatar ou não quer usá-lo.
- `OUTRO_JOGADOR`: o avatar do perfil de outra pessoa, nas partidas online.
- `FIGURANTE`: manequim ou silhueta sem rosto (plateia, oponente-padrão, cliente, colegas de time da Casa).

| Código | Solo (esta base) | Online (variações futuras) |
| --- | --- | --- |
| `PASSARELA` | `PROPRIO` + figurantes na plateia | 4 a 8 `OUTRO_JOGADOR` desfilando na mesma sala |
| `DRESS_FIGHTER` | `PROPRIO` contra um figurante | 1 `OUTRO_JOGADOR` como oponente |
| `DRESS_THE_STAR` | `PROPRIO` | 3 a 8 `OUTRO_JOGADOR` (stylist e quem adivinha) |
| `PERSONAGEM_FILME` | `PROPRIO` | 2 a 4 `OUTRO_JOGADOR` |
| `ROAD_TO_GLORY` | `PROPRIO` ou `MODELO_CASA` | não tem |
| `FASHION_DETECTIVE` | `PROPRIO` + figurantes | não tem |
| `BOUTIQUE_3D` | `PROPRIO` + cliente figurante | não tem |
| `CLUBE_CORACAO`, `FAVORITE_SINGER`, `PILOTO_FAVORITO`, `SUPER_HEROI` | manequim com a peça criada; `PROPRIO` opcional | não tem |
| `LABIRINTO` | `PROPRIO` | não tem |
| `AROUND_THE_WORLD` | `PROPRIO` + passantes figurantes | não tem |
| `FASHION_SPORTS` | `PROPRIO` + 4 colegas e 5 adversários figurantes | até 10 `OUTRO_JOGADOR`: cada pessoa entra com o próprio avatar, 5 por time |
| `BATALHA_LOOKS` | `PROPRIO` contra um figurante | 1 `OUTRO_JOGADOR` no duelo ou 3 na sala de 4 |

**Privacidade (regra que vale sempre):**
- Numa partida online, o avatar de outra pessoa só aparece se ela deixou o avatar público
  (`UserAvatar3d.publicOnRunway`); sem isso, entra um figurante com o nome dela.
- Quem tem 13 a 17 anos entra em partida online com dublê ou manequim, nunca com o próprio rosto.
- O avatar só veste as cartas do deck de quem joga; a nota nunca usa pele, corpo ou rosto.

**Na API:** a definição do núcleo ganha `avatares: {solo:[{tipo, papel, quantidade}], online:{min, max, porTime}}`, e
a partida guarda `participantes:[{tipo, papel, time, userId}]`. Esta base só abre partidas solo; o salão online
(convite, fila e sincronização) é a próxima etapa.

## Pessoas de cena: gente humana com níveis de detalhe

Pedido da dona (15/11/2026): os NPCs passam a ser avatares humanos do mesmo tipo do avatar da pessoa, variados, vestidos
pelo papel e animados, com níveis de detalhe; de longe continuam gente, nunca pinos. Primeiro jogo com isso: Fashion
Sports (os jogadores dos dois times e a torcida do estádio).

| Peça | Onde |
| --- | --- |
| Pessoa do elenco (sexo, corpo, altura, pele, cabelo, rosto sintético, roupa do papel) e sorteio pela semente | `lib/flair/nucleos/gente/elenco.ts` |
| Elenco do Fashion Sports (uniformes, goleiro de manga longa, o gesto da linha do tempo na locomoção) | `lib/flair/esporte/elenco.ts` |
| Níveis de detalhe e triângulos por pessoa | `lib/flair/nucleos/gente/detalhe.ts` |
| Molde: o corpo humano do avatar (`HumanAvatar`) vestido uma vez, escondido | `components/flair/nucleos/gente/molde-humano.tsx` |
| Clones na cena (SkeletonUtils), locomoção procedural do avatar, nível pela distância da câmera | `components/flair/nucleos/gente/elenco-3d.tsx` |
| Torcida em humanos leves instanciados | `lib/flair/nucleos/gente/torcida.ts`, `components/flair/nucleos/gente/torcida-3d.tsx` |

**Determinismo.** O elenco sai da semente da partida (`NucleoPartida.semente`): a mesma partida tem sempre os mesmos
jogadores. Os dois times têm o mesmo sexo, sorteado pela semente; pele, altura, compleição, corte e cor de cabelo variam
por jogador. Nada disto entra na nota. Os rostos são pintados por regras (sem foto de ninguém).

**Níveis.** COMPLETO (até 16 m da câmera, ou quem está na jogada a qualquer distância): corpo inteiro, acabamentos,
sombra, animação a cada quadro. LEVE (16 a 26 m): sem os acabamentos de poucos pixels e sem sombra, animado a cada dois
quadros. LONGE (além de 26 m): o corpo leve (`components/flair/nucleos/gente/corpo-leve.ts`), o humano leve da torcida
com as cores da roupa, da pele e do cabelo da pessoa e a altura dela, sem esqueleto para animar. TORCIDA: humano leve instanciado (cabeça,
pescoço, cabelo, tronco, braços e pernas, 364 triângulos), cinco chamadas de desenho por setor de arquibancada, um terço
acenando de braços para cima. Enquanto o molde de um jogador monta (dois por vez, o mais perto da câmera primeiro), a
figura articulada antiga dele aparece no lugar.

**Orçamento medido** (transmissão do futebol, `renderer.info` no navegador sem placa de vídeo, swiftshader):

| Cena | Triângulos por quadro | Chamadas de desenho |
| --- | --- | --- |
| Estádio com 10 jogadores humanos e a torcida em blocos | 596 mil | 530 |
| Estádio com 10 jogadores humanos e a torcida em humanos leves (cerca de 490 pessoas) | 618 mil a 769 mil, conforme a câmera | 160 a 204 |

**Figurantes das salas dos outros jogos** (`lib/flair/nucleos/gente/figurantes.ts`,
`components/flair/nucleos/gente/figurantes-humanos.tsx`): cada personagem do arquivo do núcleo que é gente (não o
manequim, a câmera nem a claquete) vira uma pessoa do elenco, com a roupa do papel na cor do arquivo, o corpo tirado
da semente da partida (sem partida aberta, da semente do jogo) e o movimento do papel
(sentada, torcendo, fotografando, conversando, parada). Medido na Passarela com as 14 pessoas (12 na plateia e 2
fotógrafos): 1,44 milhão de triângulos e 399 chamadas por quadro; na Boutique (1 cliente), 179 mil e 63.

**Passe de desempenho da Passarela (16/11/2026).** Nas salas com figurantes, no máximo `CORPOS_CHEIOS` (5) pessoas
têm o corpo inteiro ao mesmo tempo: quem está na jogada e as mais perto da câmera (`corposCheios` em
`lib/flair/nucleos/gente/detalhe.ts`); as outras ficam no corpo leve, que agora também senta (pernas encolhidas e o
corpo de cima no assento) e não monta o molde do corpo inteiro (sem esqueleto, sem roupa costurada, sem o custo da
montagem). O estádio e o Fashion Detective seguem sem limite. Na Passarela, isso tira 9 dos 14 corpos inteiros.
**Estimativa, não medida:** pelos números medidos acima (cerca de 40 mil triângulos e 26 chamadas por corpo inteiro,
364 triângulos e 5 chamadas por corpo leve), a Passarela cai de 1,44 milhão de triângulos e 399 chamadas para cerca
de 0,52 milhão e 210 chamadas por quadro. A medida no navegador sem placa de vídeo não pôde ser refeita: a máquina
compartilhada estava sem memória e o renderizador de software caiu em todas as salas, inclusive na Boutique, que
antes rodava.

Um jogador humano custa cerca de 40 mil triângulos por quadro com a passada de sombra (de 6 para 10 jogadores: +162 mil).
O orçamento de 60 mil triângulos das salas não vale para o estádio: a gente tem conta própria
(`triangulosComGente`, `triangulosDaSalaComGente` em `lib/flair/nucleos/scene/budget.ts`). A fluidez num celular não foi
medida (o ambiente não tem placa de vídeo). Com o corpo leve no nível LONGE, a transmissão automática do futebol (câmera
alta da lateral, os 10 jogadores além de 26 m) caiu para 181 mil triângulos e 166 chamadas por quadro (antes, 769 mil).

## Ações do personagem e comandos do controle

O personagem só faz movimentos simples. Toda ação tem teclado, toque (botão na tela) e gamepad (Gamepad API, layout
padrão).

| Ação | Teclado | Gamepad | Onde vale |
| --- | --- | --- | --- |
| Navegar nos recursos | setas | direcional | todos |
| Trocar a aba de recursos | Q / E | LB / RB | todos |
| Vestir ou aplicar o recurso selecionado | Espaço | A | todos |
| Tirar a peça da vaga selecionada | Backspace | B | núcleos de cartas |
| Girar o avatar | Z / C | analógico direito | todos |
| Aproximar e afastar a câmera | + / − | RT / LT | todos |
| Posar | P | X | todos |
| Desfilar ou caminhar | W | Y | PASSARELA, BATALHA_LOOKS, AROUND_THE_WORLD, LABIRINTO, DRESS_THE_STAR |
| Entregar o look | Enter | Start | todos |
| Ver o objetivo | O | Select | todos |

Nos núcleos que rodam sozinhos (DRESS_FIGHTER e FASHION_SPORTS), a luta e a partida não têm comando de movimento:
depois de entregar, a cena mostra cada etapa, e a pessoa só decide o acionamento entre elas (a carta Especial entre os
rounds; a troca de peça no intervalo).

## API

- `GET /api/flair/3d/nucleos`: lista `{nucleos:[{codigo, numero, recursos[], acoes[]}]}` (pública).
- `GET /api/flair/3d/nucleos/{codigo}`: definição `{codigo, numero, objetivo:{codigo, regras:[{codigo, pontos}]}, recursos[], vagas[], zonas[], areas[], opcoes[], acoes[]}` (pública).
- `POST /api/flair/3d/nucleos/{codigo}/efeitos`: corpo `{cartas:[cardId]}`; resposta `{efeitos:[{cardId,
  itens:[{codigo, valor, motivo}]}]}` (logado; só cartas da própria pessoa, 422).
- `POST /api/flair/3d/nucleos/{codigo}/partidas`: abre a partida `{id, nucleo, status:"ABERTA", semente, deck,
  participantes}` (logado).
- `POST /api/flair/3d/partidas/{id}/previa`: o mesmo corpo da entrega; devolve o resultado de agora (pontos, estrelas,
  regras, `cartas`) com `status:"ABERTA"`, sem gravar nada e sem contar tentativa. Só com a partida `ABERTA` (409 fora
  dela); mesmas conferências da entrega (403, 422). Em `DRESS_FIGHTER` e `FASHION_SPORTS` devolve só os atributos, nunca
  o desfecho: `resultado:"PREVIA"`, sem regras, e os eventos `VELOCIDADE`, `ATAQUE`, `DEFESA` (luta) ou `VELOCIDADE`,
  `TECNICA`, `RESISTENCIA`, `DEFESA`, `FORCA_TIME`, `COESAO` (futebol).
- `POST /api/flair/3d/partidas/{id}/entrega`: corpo `{cartas:{vaga:cardId}, zonas:{zona:{cor, acabamento}},
  maquiagem:{area:{familia, acabamento}}, resposta}`; resposta `{pontos, estrelas, resultado, regras:[{codigo, ok,
  pontos}], eventos:[{codigo, valor}], cartas:[{vaga, cardId, pontos}], status}` (logado, só o dono; só com a partida
  `ABERTA`, 409 fora dela).
- `POST /api/flair/3d/partidas/{id}/acionar`: corpo `{carta?: cardId, troca?: {vaga, carta}}` (tudo opcional: sem
  nada, a partida só avança); resposta igual à da entrega. Só com a partida `EM_ACAO` (409 `PARTIDA_SEM_ACAO` fora
  dela); só o dono (403); carta alheia ou fora do deck, 422 (`CARTA_ALHEIA`, `CARTA_FORA_DO_DECK`).

**Campos do resultado.**
- `status`: como a partida fica. `ENTREGUE` fecha (o resultado é o final); `EM_ACAO` espera um acionamento (pontos e
  regras ainda vazios, `resultado:"EM_ACAO"`); `ABERTA` aceita outra entrega (só no `LABIRINTO`).
- `cartas:[{vaga, cardId, pontos}]`: quanto cada carta vestida rendeu na nota, com duas casas. Regra por peça dá o
  valor inteiro à carta que a cumpre; regra do look inteiro é dividida entre as cartas que a cumprem; nos jogos
  automáticos e na defesa do `FASHION_DETECTIVE`, a nota é dividida na proporção dos atributos de cada carta. Vazio nos
  núcleos de zonas e nos resultados `EM_ACAO`.

**Partidas em etapas.** O servidor guarda a entrega e os acionamentos (`estado_json`) e recalcula a partida inteira a
partir da semente a cada etapa, então repetir uma etapa dá sempre o mesmo resultado.

| Núcleo | Entrega | Acionar | Eventos |
| --- | --- | --- | --- |
| `DRESS_FIGHTER` | joga o round 1 e devolve `EM_ACAO` | cada chamada joga o round seguinte; a 2ª fecha a luta. `carta` é a carta Especial (nível `ESPECIAL`, do deck), uma por luta: soma 20 + OVR/10 ao atributo do round que vem. 422 `CARTA_NAO_ESPECIAL` ou `ESPECIAL_JA_USADA` | `ROUND {round, atributo, voce, oponente, atacante, valorAtacante, valorDefensor, venceu}`; `ESPECIAL {round, carta, atributo, poder}` antes do round em que entra |
| `FASHION_SPORTS` | veste o uniforme, joga a saída de bola e devolve `EM_ACAO` | cada chamada é uma jogada: `carta` é a carta jogada da mão (ou nada: o time não faz nada de útil); 422 `CARTA_FORA_DA_MAO`; a 16ª jogada fecha | `JOGADA {n, jogada, tempo, relogio, tipo, time, ok, jogador, alvo, de, para, placar, carta?, acao?}`, `SITUACAO {jogada, total, tempo, relogio, posse, zona, goleiroPronto, mao, baralho, placar}`, `INTERVALO`, `RESUMO` e `PLACAR` |
| `LABIRINTO` | apresenta ao espelho: se não abre, devolve `ABERTA` com `resultado:"NAO_ABRE"` e a partida aceita outra entrega; se abre, fecha com os pontos da tentativa | não tem | `FAMILIA`, `TENTATIVA` (1 na primeira apresentação) e, sem abrir, `FALTAM_PECAS` |

No `ROUND`, `atacante` é `VOCE` ou `OPONENTE` (no round 1, o mais veloz; no 2, a pessoa; no 3, o oponente), com o valor
de quem ataca e de quem defende. No `FASHION_SPORTS` o `PLACAR` é a soma dos gols dos dois tempos, e `cartas` traz o
uniforme do segundo tempo.

**Motivos de uma carta não pontuar** (itens com `motivo: true` em `.../efeitos`): `MARCA_NAO_BR` (PASSARELA),
`FORA_DO_FIGURINO` (DRESS_THE_STAR, PERSONAGEM_FILME), `FORA_DO_PEDIDO` (BOUTIQUE_3D), `FORA_DA_FAMILIA`
(BATALHA_LOOKS), `SEM_FAMILIA_DE_COR` (LABIRINTO) e `SEM_BONUS` (os demais núcleos de cartas). No `DRESS_FIGHTER`, a
carta Especial ganha o item `PODER_ESPECIAL` com o que ela soma quando acionada.

**Material da carta.** `GET /api/me/flair/cards` já devolve o material principal em `tags.materials[0]` (minúsculo, o
mesmo valor que o servidor usa nos atributos), junto de `tags.colors`, `tags.styles` e `tags.occasions`.

Textos de interface ficam nos catálogos de i18n (`flair3d.nucleo.<CODIGO>.*`); a API devolve só códigos.

## FLAIR 3D MAKE UP: a mesma base, mais simples

O FLAIR 3D MAKE UP (Road to Glory) ganha a mesma estrutura, com duas simplificações pedidas pela dona: o efeito de uma
carta é sempre **vestir** ou **maquiar**, e o cenário é o **provador 3D** reaproveitado.

| Camada | Arquivo |
| --- | --- |
| Tabela | na mesma `V101__flair3d_partidas.sql`: `flair_makeup_looks` (id, user_id, brief, look_json, pontos, estrelas, prestigio, created_at) |
| Entidade e repositório | `FlairMakeUpLook`, `FlairMakeUpLookRepository` |
| Brief (Strategy) | `fai-application/.../flair3d/makeup/briefs/<Nome>Brief.java`, implementa `FlairMakeUpBrief` |
| Service | `FlairMakeUpService`: carreira, briefs, entrega e Prestígio |
| Controller e rota backend | `FlairMakeUpController`, `/api/flair/make-up/...` |
| Rotas frontend | `app/(site)/(app)/flair/make-up/page.tsx` (carreira e briefs) e `.../make-up/[brief]/page.tsx` (o jogo) |
| Arquivos frontend | `lib/flair/make-up/` (tipos, API, briefs, paleta) e `components/flair/make-up/` (tela, cenário, recursos) |

**Cenário.** O provador 3D do app (`components/three/fitting-room-scene.tsx` e o palco de `components/try-on/`), com:
- o logo do FashionAI (`/brand/fai-logo.png`) na parede do fundo, pelo `env.logoUrl` que a cena já aceita;
- as paredes nas cores do FashionAI: magenta `#C6275E` e verde-petróleo `#1F7A76`, com o tom claro `#FBE7EE` de base.

**Personagens.** Só a protagonista: o próprio avatar ou a modelo da casa. Sem outros personagens nesta base.

**Recursos e efeito de cada carta.**

| Aba | Recurso | Efeito |
| --- | --- | --- |
| Roupas | cartas FLAIR do guarda-roupa, por vaga (`SUP`, `INF`, `CAL`, `ACE`, `VES`) | vestir a vaga |
| Maquiagem | paleta inicial FashionAI Beauty: lábios (nude, rosa, coral, vermelho, vinho), bochechas (pêssego, rosa, bronze), olhos (marrom, dourado, preto), com acabamento fosco, cetim ou gloss | maquiar a área |

Não há deck: valem o guarda-roupa e a paleta liberada no nível.

**Ações e comandos.** Os mesmos da tabela de ações, menos "desfilar ou caminhar": navegar, trocar a aba, vestir ou
maquiar (Espaço / A), tirar (Backspace / B), girar, aproximar (inclusive no rosto, para a maquiagem), posar, entregar e
ver o objetivo.

**Os três briefs da base (nível 1 e 2).** Pontos de 0 a 100, 25 por regra; estrelas em 60, 80 e 100.

| Código | Nível | Regras |
| --- | --- | --- |
| `ENSAIO_VERAO` | 1 | ocasião casual ou praia; material leve; lábios na família coral; acabamento dos lábios gloss ou cetim |
| `ENTREVISTA` | 1 | ocasião trabalho ou formal; calçado fechado; lábios nude ou rosa; acabamento fosco |
| `PRIMEIRO_ENCONTRO` | 2 | ocasião festa ou noite; 1 acessório; lábios vermelho ou vinho; bochechas rosa |

**Carreira e Prestígio** (regras do `../flair-3d-make-up/PLANO.md`):
- Cada estrela nova num brief vale 0,2 × a base do brief (base 100); repetir o brief só paga as estrelas novas.
- Prestígio para sair do nível n: 60, 90, 120, 150 e 180 nos níveis 1 a 5; do 6 em diante, round(15 · n^1,5).
- Cada brief tem um nível mínimo; abaixo dele, a API devolve 403.

**API.**
- `GET /api/flair/make-up/carreira`: `{nivel, prestigio, faltaParaProximo, desbloqueios[]}` (logado).
- `GET /api/flair/make-up/briefs`: `{briefs:[{codigo, nivelMin, liberado, melhoresEstrelas}]}` (logado).
- `GET /api/flair/make-up/briefs/{codigo}`: `{codigo, nivelMin, regras:[{codigo, pontos}], vagas[], areas[], paleta}`.
- `POST /api/flair/make-up/briefs/{codigo}/entrega`: corpo `{cartas:{vaga:cardId}, maquiagem:{area:{familia,
  acabamento}}}`; resposta `{pontos, estrelas, regras:[{codigo, ok, pontos}], prestigioGanho, carreira}`. Só cartas da
  própria pessoa (422); nota nunca usa pele nem rosto.

## FLAIR Card Building Challenge: a mesma base, sem cenário 3D

Os cinco elencos de `../cbc/CINCO_ELENCOS.md` ganham a mesma estrutura. Não há cenário 3D: a tela tem o **tabuleiro do
elenco embaixo** (cartas ligadas por linhas que mudam de cor pela força do link) e a **imagem exclusiva do FashionAI em
cima**, que se monta como um quebra-cabeça à medida que as linhas acendem.

| Camada | Arquivo |
| --- | --- |
| Tabela | na mesma `V101__flair3d_partidas.sql`: `flair_cbc_squad_entregas` (id, user_id, elenco, cartas_json, quimica, ok, edicao, created_at) e `flair_cbc_squad_edicoes` (elenco, ultima), o contador de edições |
| Entidade e repositório | `FlairCbcSquadEntrega`, `FlairCbcSquadEntregaRepository`; `FlairCbcSquadEdicao`, `FlairCbcSquadEdicaoRepository` |
| Elenco (Strategy) | `fai-application/.../flair3d/cbc/elencos/<Nome>Elenco.java`, implementa `FlairCbcElenco`, usando `CbcLinks` |
| Service | `FlairCbcSquadService`: lista, formação, conferir, entregar e numerar a edição |
| Controller e rota backend | `FlairCbcSquadController`, `/api/flair/elencos/...` |
| Rotas frontend | `app/(site)/(app)/flair/elencos/page.tsx` e `.../elencos/[elenco]/page.tsx` |
| Arquivos frontend | `lib/flair/elencos/` (tipos, API, formações) e `components/flair/elencos/` (tabuleiro, linhas, quebra-cabeça) |

**As formações.** Vagas com posição e coordenada (coluna, linha) e as linhas entre vagas.

| Código | Vagas (fileiras de cima para baixo) | Linhas | Requisitos |
| --- | --- | --- | --- |
| `PRIMEIRO_ELENCO` | `acessorio` (ACE) · `cima` (SUP) e `bolsa` (ACE) · `baixo` (INF) · `calcado` (CAL) | 5: acessorio–cima, cima–bolsa, cima–baixo, bolsa–baixo, baixo–calcado | química ≥ 40; 2 linhas verdes |
| `PALETA_ATELIE` | `ace1`, `ace2` · `sup1`, `sup2` · `inf1`, `inf2` · `cal` | 9: ace1–ace2, ace1–sup1, ace2–sup2, sup1–sup2, sup1–inf1, sup2–inf2, inf1–inf2, inf1–cal, inf2–cal | química ≥ 60; 4 linhas por cor; 7 cartas |
| `CASA_MARCA` | `ace1`–`ace3` · `sup1`–`sup3` · `inf1`, `inf2` · `cal` | 12: ace1–ace2, ace2–ace3, sup1–sup2, sup2–sup3, inf1–inf2, ace1–sup1, ace2–sup2, ace3–sup3, sup1–inf1, sup3–inf2, inf1–cal, inf2–cal | química ≥ 70; 3 linhas por marca; 2 marcas ou mais; 1 carta Ouro ou Especial |
| `NOITE_ESTREIA` | `ace1`, `ace2` · `sup1`, `ves` (VES), `sup2` · `inf1`, `inf2` · `cal1`, `cal2` | 13: ace1–ace2, ace1–sup1, ace2–sup2, sup1–ves, ves–sup2, ves–inf1, ves–inf2, sup1–inf1, sup2–inf2, inf1–inf2, inf1–cal1, inf2–cal2, cal1–cal2 | química ≥ 80; 5 linhas por ocasião; nenhuma linha vermelha na `ves` |
| `ELENCO_LENDARIO` | `ace1`–`ace3` · `sup1`–`sup3` · `inf1`–`inf3` · `cal1`, `cal2` | 17: as 7 horizontais de cada fileira, ace1–sup1, ace2–sup2, ace3–sup3, sup1–inf1, sup2–inf2, sup3–inf3, inf1–cal1, inf2–cal1, inf2–cal2, inf3–cal2 | química 100; nenhuma linha vermelha; 2 cartas Especial; 4 marcas ou mais |

**O tabuleiro (embaixo).** Cada vaga mostra a carta escolhida; a janela de cartas da pessoa abre por vaga, filtrada
pela posição. Cada linha é desenhada entre as duas vagas, com a cor do nível que o servidor devolve (vermelha,
laranja ou verde) e ícones dos atributos que ligaram (marca, subcategoria, categoria, estilo, cor, ocasião). A química
de cada carta (0 a 3) aparece na vaga, e a do elenco (0 a 100) num medidor, junto com a lista de requisitos.

**O quebra-cabeça (em cima).** A imagem do elenco é cortada em tantas peças quanto o número de linhas, na ordem da
lista de linhas. Peça de linha verde aparece em cor; de linha laranja, só em traço (tons de cinza); de linha vermelha,
escura; de linha que ainda não existe (vaga vazia), coberta. Ao entregar com todos os requisitos, a imagem se revela
inteira, com as fotos das peças da pessoa nas posições da formação e a legenda "edição N".

**A imagem.** A arte exclusiva do FashionAI é da dona [decidir]. Até ela chegar, cada elenco usa uma arte provisória em
SVG feita com as cores da marca (`#C6275E`, `#1F7A76`, `#FBE7EE`) e o logo `/brand/fai-logo.png`, em
`public/flair/elencos/<codigo>.svg`.

**Comandos.** Setas ou direcional para escolher a vaga; Espaço ou A para abrir as cartas da vaga e pôr a carta;
Backspace ou B para tirar; Enter ou Start para entregar; O ou Select para ver os requisitos. Toque e mouse em tudo.

**API.**
- `GET /api/flair/elencos`: `{elencos:[{codigo, vagas, linhas, concluido, edicao}]}` (logado).
- `GET /api/flair/elencos/{codigo}`: `{codigo, vagas:[{chave, posicao, coluna, linha}], linhas:[{a, b}], requisitos:[{tipo, alvo, ...}]}`.
- `POST /api/flair/elencos/{codigo}/conferir` com `{cartas:{vaga:cardId}}`: `{links:[{a, b, forca, nivel, atributos}],
  quimicaCartas:{vaga:0..3}, quimica, requisitos:[{tipo, ok, valor, alvo}], ok}`. Só cartas da própria pessoa (422).
- `POST /api/flair/elencos/{codigo}/entrega`: o mesmo corpo; recusa se algum requisito falha (422); grava a entrega
  e devolve o mesmo resultado mais `{edicao}` (ordem de conclusão daquele elenco). Repetir não cria nova edição. A
  edição sai do contador do elenco (`flair_cbc_squad_edicoes`), lido com bloqueio de escrita dentro da transação da
  entrega: duas primeiras conclusões simultâneas nunca levam o mesmo número.
