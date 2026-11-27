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
| `PERSONAGEM_FILME` | até 8 | 1 casaco, parte de cima ou peça inteira | +12,5 se bate o figurino do personagem |
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
- A definição do núcleo ganha `deck: {tamanhoMax, obrigatorias:[{posicao, quantidade}], semDeck, posicoes}`.
- `posicoes` são as posições de carta que o jogo usa (as vagas do look; vazio = qualquer uma). A carta de outra
  posição não teria onde vestir: a tela a mostra apagada e não a deixa entrar, e o servidor recusa o deck com 422
  `DECK_INVALIDO` e o detalhe `semVaga:[{cardId, posicao}]`. No `FASHION_SPORTS` toda carta entra (fora do uniforme,
  ela é jogada na mão). No `PERSONAGEM_FILME` a peça inteira (`VES`) veste e conta como a parte de cima e a de baixo
  que estiverem vazias (12,5 cada); o deck dele pede 1 parte de cima ou peça inteira.
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

**Orçamento por cena e qualidade que cai sozinha (19/11/2026).** Cada cena tem a conta própria de triângulos e de
chamadas de desenho por quadro (`lib/flair/nucleos/scene/orcamento-da-cena.ts`), com o teto de cada nível de qualidade
(`lib/flair/nucleos/scene/qualidade.ts`): ALTA 180 mil triângulos e 140 chamadas; MÉDIA 80 mil e 75; BAIXA 35 mil e 36.
Como não há placa de vídeo no ambiente, a conta é conferida por teste, que monta a sala, os objetos de cena e as pessoas
leves e conta a geometria de verdade, com a passada de sombra (`components/flair/nucleos/scene/orcamento.test.tsx`; o
corpo inteiro entra pela medida de cima: 20 mil triângulos e 13 chamadas, o dobro quando faz sombra).

- **Corpos inteiros por cena** (`CORPOS_CHEIOS_DA_CENA`): Passarela 2, Dress Fighter 1, Dress the Star 2, Fashion
  Detective 3, Boutique 2, Around the World 2, Fashion Sports (quadra) 3, Batalha 2; Filme e Labirinto, nenhum. Quem
  reage sozinho por roteiro (a cliente, a oponente) entra além do limite. O resto é corpo leve.
- **Corpo leve instanciado.** Todas as pessoas leves de uma cena são cinco malhas instanciadas
  (`components/flair/nucleos/gente/corpo-leve.ts`): cinco chamadas para a plateia inteira (antes, cinco por pessoa), sem
  sombra. A pessoa leve agora reage (palmas, braços para cima, cabeça baixa, senta e levanta) pela matriz dela
  (`lib/flair/nucleos/gente/leve.ts`), reposta a cada dois quadros só enquanto o gesto mexe.
- **A reação de grupo não promove a plateia.** Antes, quando o resultado mandava "a plateia aplaude", todos entravam
  "na jogada" e ganhavam corpo inteiro ao mesmo tempo (14 moldes montando no meio do resultado da Passarela). Agora só
  quem reage sozinho por roteiro é promovido.
- **Qualidade.** A cena mede os próprios quadros (`components/flair/nucleos/scene/scene-quality.tsx`): abaixo de 24
  quadros por segundo desce um nível, abaixo de 10 vai ao mais baixo; os 3 primeiros segundos (a carga) não contam; não
  volta a subir na mesma partida. Quando o navegador informa que desenha por software (SwiftShader, llvmpipe), já larga
  no nível baixo. MÉDIA: 1 ponto de tela por pixel, um corpo inteiro de figurante, só a avatar faz sombra. BAIXA: 0,75
  ponto por pixel (7 vezes menos pontos que a tela de 2), sem sombra, nenhum corpo inteiro de figurante. Na transmissão do
  Fashion Sports: todos os jogadores inteiros na ALTA, 6 na MÉDIA, 2 na BAIXA (quem está na jogada, sempre).
- **Carregamento adiado.** Quem está fora do quadro da câmera não monta corpo inteiro (o molde nem é carregado) e não
  anima o esqueleto; entra quando a câmera o mostra.
- **Sombra.** Figurante de corpo inteiro só faz sombra a até 7 m da câmera ou na jogada, e só na qualidade alta.

Conta por cena, em milhares de triângulos / chamadas de desenho por quadro (a avatar incluída). "Antes" = 15/11, com até
5 corpos inteiros, todos com sombra, e cinco chamadas por pessoa leve; "antes, no resultado" = a plateia inteira
promovida a corpo inteiro pela reação de grupo.

| Cena | Pessoas (antes → agora) | Antes | Antes, no resultado | Agora, ALTA | MÉDIA | BAIXA |
| --- | --- | --- | --- | --- | --- | --- |
| Passarela | 14 → 14 | 253 mil / 214 | 610 mil / 403 | 134 mil / 96 | 75 mil / 57 | 30 mil / 27 |
| Dress Fighter | 1 → 7 | 88 mil / 67 | 88 mil / 67 | 90 mil / 72 | 70 mil / 59 | 27 mil / 28 |
| Dress the Star | 7 → 7 | 247 mil / 180 | 326 mil / 222 | 128 mil / 97 | 68 mil / 58 | 26 mil / 27 |
| Personagem de Filme | 0 → 0 | 46 mil / 56 | 46 mil / 56 | 46 mil / 56 | 46 mil / 56 | 23 mil / 30 |
| Fashion Detective (porta da gala) | 4 → 4 | 212 mil / 157 | 212 mil / 157 | 172 mil / 136 | 73 mil / 71 | 28 mil / 34 |
| Boutique 3D | 1 → 3 | 86 mil / 71 | 86 mil / 71 | 126 mil / 102 | 66 mil / 63 | 24 mil / 30 |
| O Labirinto | 0 → 0 | 46 mil / 43 | 46 mil / 43 | 46 mil / 43 | 46 mil / 43 | 23 mil / 24 |
| Around the World | 3 → 3 | 165 mil / 122 | 165 mil / 122 | 125 mil / 101 | 66 mil / 62 | 24 mil / 30 |
| Fashion Sports (quadra) | 15 → 18 | 255 mil / 223 | 652 mil / 433 | 177 mil / 126 | 78 mil / 61 | 32 mil / 29 |
| Batalha de Looks | 7 → 10 | 246 mil / 176 | 325 mil / 218 | 128 mil / 93 | 68 mil / 54 | 27 mil / 25 |

A Boutique e o Dress Fighter sobem um pouco na qualidade alta porque ganharam gente (vendedora e outra cliente; a
torcida do beco); nas outras duas qualidades caem. O campo da transmissão do Fashion Sports, sem os jogadores
(`components/flair/esporte/estadio.test.tsx`): futebol 180 mil triângulos e 112 chamadas (488 pessoas na arquibancada e
nos bancos); basquete 52 mil / 24, vôlei 40 mil / 19, tênis 57 mil / 19, corrida 129 mil / 22, skate 67 mil / 19 — nestas
cinco a torcida era um bloco por pessoa (de 46 a 166 malhas) e agora é gente leve instanciada.

**Não medido na tela.** Estes números são a geometria que a cena manda por quadro, contada por teste. Os quadros por
segundo de verdade (com e sem placa de vídeo) não foram medidos nesta rodada: a máquina não tem placa de vídeo nem
memória para o navegador com desenho por software.

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

## FLAIR Card Building Challenge: elencos em quebra-cabeça

Os elencos de `../cbc/CINCO_ELENCOS.md` seguem a mesma estrutura, sem cenário 3D: a imagem do elenco é cortada em
peças, uma por vaga; a carta da pessoa que cumpre o que a vaga pede encaixa a peça e o deck inteiro completa o
quebra-cabeça. Catálogo, recortes, requisitos, API e o modal de conclusão estão naquele documento.

| Camada | Arquivo |
| --- | --- |
| Tabela | na mesma `V101__flair3d_partidas.sql`: `flair_cbc_squad_entregas` (id, user_id, elenco, cartas_json, quimica, ok, edicao, created_at) e `flair_cbc_squad_edicoes` (elenco, ultima), o contador de edições; a coluna `quimica` guarda a porcentagem de peças encaixadas |
| Entidade e repositório | `FlairCbcSquadEntrega`, `FlairCbcSquadEntregaRepository`; `FlairCbcSquadEdicao`, `FlairCbcSquadEdicaoRepository` |
| Elenco (Strategy) | `FlairCbcElenco`, com a estratégia concreta por dados `cbc/elencos/QuebraCabeca` e o registro `FlairCbcElencos` |
| Avaliação | `FlairCbcAvaliacao`, pelo motor `CbcRules` (vaga com `accepts`, requisitos na DSL) |
| Service | `FlairCbcSquadService`: lista, formação, conferir, entregar e numerar a edição |
| Controller e rota backend | `FlairCbcSquadController`, `/api/flair/elencos/...` |
| Rotas frontend | `app/(site)/(app)/flair/elencos/page.tsx` e `.../elencos/[elenco]/page.tsx` |
| Arquivos frontend | `lib/flair/elencos/` (tipos, API, formações, recortes, catálogo e progresso) e `components/flair/elencos/` (quebra-cabeça, vagas, requisitos e modal) |
