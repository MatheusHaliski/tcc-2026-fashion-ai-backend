# FLAIR 3D: a base dos 15 núcleos

Os 100 jogos do FLAIR 3D derivam de 15 núcleos (os jogos 1 a 15 de `JOGOS.md`). Cada núcleo ganha uma base que já
joga a modalidade mais simples dele, para os jogos derivados copiarem o mesmo esqueleto. Este documento é o contrato
entre backend e frontend.

## Camadas

| Camada | Arquivo | Uma por núcleo? |
| --- | --- | --- |
| Tabela | `V99__flair3d_partidas.sql`: `flair3d_matches` | não, compartilhada |
| Entidade e repositório | `Flair3dMatch`, `Flair3dMatchRepository` | não |
| Núcleo (Strategy) | `fai-application/.../flair3d/nucleos/<Nome>Nucleo.java`, implementa `Flair3dNucleo` | **sim** |
| Service | `Flair3dNucleoService`: lista, detalhe, abre partida, entrega e pontua delegando ao núcleo | não |
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
| 2 | `DRESS_FIGHTER` | cartas | Vencer 2 de 3 rounds contra o oponente-padrão (velocidade, ataque e defesa 40) | Atributos das peças: calçado tênis +velocidade, salto −velocidade; couro, denim e lã +defesa; metal e couro +ataque; OVR soma; vence 2 rounds = 100, 1 = 50, 0 = 0 |
| 3 | `DRESS_THE_STAR` | cartas | Vestir a "Estrela Pop dos anos 2000" (estilos y2k ou glam; cores rosa ou prata) | 25 por peça que bate estilo ou cor (4 vagas) |
| 4 | `PERSONAGEM_FILME` | cartas + resposta | Vestir o "detetive noir" e acertar o filme entre 4 títulos inventados | 50 pelo título certo; 12,5 por peça que bate (casaco, cores preto, bege ou cinza) |
| 5 | `ROAD_TO_GLORY` | cartas + maquiagem | Brief "Ensaio de Verão" | 25 por regra: ocasião casual ou praia; material leve; batom da família coral; acabamento do batom gloss ou cetim |
| 6 | `FASHION_DETECTIVE` | cartas | Salão 1, "Entrada da gala" | Acesso: 2 peças ou mais de ocasião formal ou festa; desafio: defesa ≥ 50. Os dois = favorável (100); um = parcial (50); nenhum = desfavorável (0) |
| 7 | `BOUTIQUE_3D` | cartas | Cliente 1 pede "festa à noite, em preto" | 33 por peça com ocasião festa e cor preta (3 vagas); 100 com as 3 |
| 8 | `CLUBE_CORACAO` | zonas do editor | Criar uma camisa do "Clube Atlântico" (azul e branco) | Modo artístico: sem placar; concluído quando todas as zonas usam as 2 cores do clube |
| 9 | `FAVORITE_SINGER` | zonas do editor | Peça da "Era Neon" | 25 por regra: rosa dominante; roxo em uma zona; 1 zona metálica; até 3 cores |
| 10 | `LABIRINTO` | cartas | Espelho 1: "3 peças da mesma família de cor" | Abre (100) ou não abre (0), dizendo o que faltou |
| 11 | `PILOTO_FAVORITO` | zonas do editor | Capacete da "Equipe Aurora" (amarelo e verde) | 25 por regra: topo amarelo; laterais amarelas; faixa da viseira verde; viseira espelhada |
| 12 | `AROUND_THE_WORLD` | cartas | Região 1, Rio de Janeiro | 25 por regra: parte de cima leve; parte de baixo leve; cor quente; marca brasileira |
| 13 | `SUPER_HEROI` | zonas do editor | Arquétipo "armadura" | 25 por regra: peito metálico; até 2 cores; capa presente; nenhum emblema protegido |
| 14 | `FASHION_SPORTS` | cartas | Futebol de 5: um uniforme para os 4 de linha contra o time-padrão | Atributos de chuteira e camisa; coesão 100% (uniforme único); vitória = 100, empate = 60, derrota = 0 |
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
| `FASHION_DETECTIVE` | até 6 | 1 parte de cima ou peça inteira | conta no acesso (ocasião) e na defesa |
| `BOUTIQUE_3D` | até 8 | 1 parte de cima, 1 parte de baixo | +33 se cumpre ocasião festa e cor preta |
| `CLUBE_CORACAO`, `FAVORITE_SINGER`, `PILOTO_FAVORITO`, `SUPER_HEROI` | sem deck: zonas do editor | nenhuma | — |
| `LABIRINTO` | até 8 | 3 cartas quaisquer | família de cor que a carta traz para o espelho |
| `AROUND_THE_WORLD` | até 8 | 1 parte de cima, 1 parte de baixo | regras da região que a carta cumpre |
| `FASHION_SPORTS` | até 6 | 1 camisa, 1 calção, 1 chuteira | velocidade, técnica, resistência e defesa do uniforme |
| `BATALHA_LOOKS` | até 8 | 1 parte de cima, 1 parte de baixo, 1 calçado | +25 se é da família de cor da rodada |

**Na tela [frontend]:** antes da partida, a tela do deck mostra as cartas da pessoa com o efeito de cada uma neste
núcleo (selos como "+10 marca BR" ou "defesa +12"), o contador do deck, a lista de obrigatórias com o que falta e o
botão "Entrar na partida", que só fica ativo com o deck válido.

**Na API [backend]:**
- A definição do núcleo ganha `deck: {tamanhoMax, obrigatorias:[{posicao, quantidade}], semDeck}`.
- `POST /api/flair/3d/nucleos/{codigo}/efeitos` com `{cartas:[cardId]}` devolve `{efeitos:[{cardId, itens:[{codigo,
  valor}]}]}`: o efeito de cada carta da pessoa neste núcleo (logado; só cartas da própria pessoa).
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

Nos núcleos que rodam sozinhos (DRESS_FIGHTER e FASHION_SPORTS), a luta e a partida não têm comando: depois de
entregar, a cena mostra o resultado.

## API

- `GET /api/flair/3d/nucleos`: lista `{nucleos:[{codigo, numero, recursos[], acoes[]}]}` (pública).
- `GET /api/flair/3d/nucleos/{codigo}`: definição `{codigo, numero, objetivo:{codigo, regras:[{codigo, pontos}]}, recursos[], vagas[], zonas[], areas[], opcoes[], acoes[]}` (pública).
- `POST /api/flair/3d/nucleos/{codigo}/partidas`: abre a partida `{id, nucleo, status:"ABERTA", semente}` (logado).
- `POST /api/flair/3d/partidas/{id}/entrega`: corpo `{cartas:{vaga:cardId}, zonas:{zona:{cor, acabamento}}, maquiagem:{area:{familia, acabamento}}, resposta}`; resposta `{pontos, estrelas, resultado, regras:[{codigo, ok, pontos}], eventos:[...]}` (logado, só o dono; entrega uma vez).

Textos de interface ficam nos catálogos de i18n (`flair3d.nucleo.<CODIGO>.*`); a API devolve só códigos.
