# Auditoria independente: FLAIR 3D (15 jogos) e FLAIR 3D MAKE UP

Data: 27/11/2026. Base: `origin/main` em `b19a35074` (checkout só lido, nada alterado). Auditor independente: as notas
"projetadas" de `ESTADO_DOS_JOGOS.md` e `REAUDITORIA_2026-11-25.md` foram tratadas como autoavaliação e **não** entram
como evidência. Evidência usada: código (servidor e tela), regras do servidor, testes e capturas reais
(`scratchpad/shots/jogos/**`, `docs/auditoria/evidencias/1xx-f3d-*.jpg`, `124-makeup-resultado-d.jpg`).
As branches `claude/flair3d-notas-8g` e `claude/flair3d-zonas-nota8` **não** estão na main e não entram na nota; o que
elas mudam é citado em cada jogo e encaixado no `PLANO.md`.

Limites desta auditoria: nenhuma partida foi jogada no navegador nesta rodada (sem GPU); as capturas são de rodadas
anteriores, com a bancada de tela (API simulada) ou o laboratório `/lab/jogo`. Desempenho (fps) não foi medido.

## 1. Rubrica (para a reauditoria ser comparável)

Escala 0–10, uma casa decimal. 10 = referência de jogo comercial do gênero; 8 = "bom jogo de navegador, que a dona
mostraria numa banca sem ressalva". Cada âncora exige a anterior. Nota entre âncoras = parte da âncora seguinte cumprida.

| # | Critério | 4 | 6 | 8 | 10 |
|---|---|---|---|---|---|
| 1 | Jogabilidade | há decisão, mas a ação é só "vestir e entregar" ou "ir à marca e apertar" | a habilidade muda o resultado (janela, distância, leitura) e há derrota possível | decisões táticas próprias do gênero em todo o loop (posicionar, arriscar, combinar), controle responsivo em teclado/toque, dificuldade que sobe | maestria: técnicas avançadas, contra-jogo, fluxo sem tempo morto |
| 2 | Entretenimento | joga-se uma vez por curiosidade | partida com começo/meio/fim e alguma tensão | vontade de "mais uma": tensão, surpresa, recompensa e variedade entre partidas | memorável, rejogável por semanas |
| 3 | Gráfico (cenário) | salas procedurais coerentes, materiais lisos | salas com props modelados e luz da sala, sem erros visíveis | cenário modelado (Blender) com texturas, luz assada/pós-processo, identidade de cada lugar, sem objetos flutuando | nível de vitrine (estilizado coeso, AAA-indie) |
| 4 | Efeito visual com imagem e vídeo | luz/halo de cor | partículas e animação de câmera nos momentos | imagens reais (foto da carta/peça) no cenário (telão, outdoor, vitrine) e clipes de vídeo (abertura, replay, finalização) ligados ao que aconteceu | vídeo/replay compartilhável gerado da partida, VFX autorais por carta |
| 5 | Criatividade | tema de moda aplicado a uma mecânica genérica | mecânica própria ligada à moda | ideia que só existe no FashionAI (a roupa é o golpe, a pista, o passe) e surpresas por rodada | conceito original premiável |
| 6 | Multiplayer | ranking ou nota de "casa" simulada | 1×1 assíncrono com convite por tag/código | **convite por busca na rede FAI com filtros** (seguindo, seguidores, nível, estilo, país, disponível), aceitar/recusar, notificação, partida contra pessoa real com resultado para os dois | tempo real, equipes, revanche, espectador |
| 7 | Single player | partidas avulsas | rodadas em sequência, estrelas, salvamento | campanha com história, dificuldade crescente, chefes/rivais, desafios diários, desbloqueios | campanha longa com ramificações |
| 8 | Carta de roupas no deck | peças viram vagas de um look | deck montado com regras e selo de efeito por jogo | cada carta tem papel tático (ação, custo, combo, raridade, Aura) e o deck pede escolha; arte da carta legível em jogo | sinergias profundas, construção de deck como meta-jogo |
| 9 | Efeito das cartas no cenário | luz/halo da cor | gesto do avatar/NPC e luz da sala | cada carta jogada muda visivelmente o cenário e o estado (objeto aparece, NPC reage, terreno/caminho muda) de forma legível | efeitos únicos por família/raridade, encadeados |
| 10 | Complexidade | 1 regra de pontuação | várias regras + recurso que se gasta | sistemas que interagem (recurso × carta × posição × adversário) sem confundir | profundidade estratégica de jogo de cartas sério |
| 11 | Personagens | figurantes sem papel | NPCs com papel e reação ao desfecho | elenco com nome, personalidade, falas e rival recorrente; protagonista com identidade | arco narrativo dos personagens |
| 12 | Gráfico dos personagens | bonecos/cápsulas | humanos de baixa resolução, manequim sem rosto | protagonista e NPCs estilizados coesos, rosto e cabelo, animação sem pés deslizando ou corpos flutuando | personagens de vitrine com expressão facial |
| 13 | Identidade FashionAI | usa o nome | usa as peças do guarda-roupa como cartas | Hype/Aura, marcas, Copilot, avatar 3D, looks e loja ligados ao jogo e o jogo devolvendo valor à rede (look salvo, post, conquista) | o jogo é vitrine da plataforma |
| 14 | Recursos do jogo | recursos só sobem | recurso que se gasta e pode derrotar | economia com escolhas (gastar agora × guardar), recursos visíveis na cena e no HUD, recompensa fora da partida | economia equilibrada e testada |
| 15 | Lógica do jogo | regras inconsistentes | servidor autoritativo e determinístico, testes | regras claras, sem estados contraditórios, explicadas na tela, equilibradas (medidas) | balanceamento por dados de jogo real |

## 2. Notas (main em 27/11/2026)
| Jogo | Jog | Ent | Gráf | FX img/víd | Criat | Multi | Single | Carta deck | Efeito cena | Complex | Pers | Gráf pers | Identid | Recursos | Lógica | **Média** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 Passarela | 5,0 | 4,5 | 5,5 | 3,5 | 5,0 | 1,0 | 5,5 | 5,5 | 3,5 | 4,5 | 5,0 | 4,5 | 7,0 | 5,0 | 6,0 | **4,7** |
| 2 Dress Fighter | 6,0 | 6,0 | 5,0 | 3,5 | 6,5 | 1,0 | 6,0 | 6,5 | 5,0 | 6,0 | 4,5 | 4,0 | 6,0 | 5,5 | 7,0 | **5,2** |
| 3 Dress the Star | 5,0 | 4,5 | 5,5 | 3,5 | 6,0 | 0,5 | 5,5 | 5,5 | 3,5 | 5,0 | 4,5 | 4,0 | 6,5 | 5,0 | 6,0 | **4,7** |
| 4 Personagem de Filme | 5,0 | 4,5 | 5,5 | 3,0 | 6,0 | 0,5 | 5,5 | 5,0 | 3,5 | 4,5 | 4,0 | 4,0 | 5,5 | 4,5 | 5,5 | **4,4** |
| 5 Road to Glory | 4,0 | 4,0 | 5,5 | 3,0 | 5,0 | 0,5 | 4,0 | 3,5 | 3,0 | 4,0 | 4,0 | 4,0 | 6,5 | 4,0 | 5,5 | **4,0** |
| 6 Fashion Detective | 5,5 | 5,5 | 4,0 | 4,0 | 7,0 | 0,5 | 6,5 | 6,5 | 5,0 | 6,5 | 5,5 | 4,0 | 6,0 | 5,5 | 6,0 | **5,2** |
| 7 Boutique 3D | 4,5 | 4,0 | 6,0 | 3,0 | 5,5 | 0,5 | 5,5 | 5,0 | 3,5 | 4,5 | 5,0 | 4,5 | 7,0 | 4,5 | 5,5 | **4,6** |
| 8 Clube do Coração | 4,5 | 4,0 | 4,5 | 2,5 | 4,5 | 0,5 | 4,0 | 1,0 | 1,5 | 3,5 | 3,5 | 4,0 | 4,0 | 4,5 | 5,0 | **3,4** |
| 9 My Favorite Singer | 4,5 | 4,0 | 4,5 | 2,5 | 5,0 | 0,5 | 4,0 | 1,0 | 1,5 | 3,5 | 3,5 | 4,0 | 4,5 | 4,5 | 5,0 | **3,5** |
| 10 O Labirinto | 3,5 | 3,5 | 4,0 | 3,0 | 5,0 | 0,5 | 5,0 | 5,0 | 3,0 | 4,0 | 3,0 | 4,0 | 5,0 | 4,5 | 5,5 | **3,9** |
| 11 Meu Piloto Favorito | 4,5 | 4,0 | 5,0 | 2,5 | 4,5 | 0,5 | 4,0 | 1,0 | 1,5 | 3,5 | 3,5 | 4,0 | 4,0 | 4,5 | 5,0 | **3,5** |
| 12 Around the World | 3,5 | 4,0 | 5,0 | 3,0 | 5,5 | 0,5 | 5,5 | 5,0 | 3,5 | 4,5 | 4,0 | 4,0 | 5,5 | 5,0 | 5,5 | **4,3** |
| 13 Meu Super-Herói | 4,5 | 4,0 | 4,5 | 2,5 | 4,5 | 0,5 | 4,0 | 1,0 | 1,5 | 3,5 | 3,0 | 4,0 | 4,0 | 4,5 | 5,0 | **3,4** |
| 14 Fashion Sports | 5,5 | 5,5 | 4,5 | 3,5 | 6,5 | 1,0 | 5,0 | 6,5 | 5,0 | 6,0 | 5,0 | 4,0 | 5,5 | 5,5 | 6,5 | **5,0** |
| 15 Batalha de Looks | 5,0 | 5,0 | 5,0 | 3,5 | 5,5 | 1,0 | 5,5 | 5,5 | 3,5 | 5,5 | 4,5 | 4,0 | 6,5 | 5,5 | 5,5 | **4,7** |
| MAKE UP (aba) | 2,5 | 2,5 | 4,0 | 1,5 | 4,0 | 0,0 | 3,5 | 2,0 | 0,5 | 2,5 | 2,0 | 3,0 | 6,0 | 1,5 | 5,0 | **2,7** |
| **Média do critério** | **4,6** | **4,3** | **4,9** | **3,0** | **5,4** | **0,6** | **4,9** | **4,1** | **3,0** | **4,5** | **4,0** | **4,0** | **5,6** | **4,6** | **5,6** | **4,2** |

Média geral: **4,2** (16 jogos × 15 critérios). Nenhum jogo chega a 8 em nenhum critério; o maior valor isolado é 7,0 (lógica do Dress Fighter,
identidade da Passarela e da Boutique, criatividade do Fashion Detective). Abaixo de 4 na média: os quatro jogos de
zonas, o Labirinto e a aba MAKE UP.

Comparação com a reauditoria de 25/11 (média 4,7, escala de 7 critérios técnicos): esta rubrica inclui critérios que a
anterior não media (multiplayer, efeito com imagem/vídeo, personagens, efeito das cartas no cenário), e eles puxam a
média para baixo. Nos critérios que se sobrepõem (jogabilidade, recursos, gráfico), as notas aqui ficam 0,5 a 1,0
acima da reauditoria, o que reconhece desgaste de recurso, fase de uso e campanha que entraram depois dela.

## 3. Achados transversais (valem para todos ou quase todos)

**T1. Multiplayer inexistente nos 16.** Nenhum jogo do FLAIR 3D abre partida contra outra pessoa: o próprio documento
de estado diz "Fora desta entrega em todos os jogos: partida online com outras pessoas (sala, fila, convite...)"
(`docs/flair/flair-3d/ESTADO_DOS_JOGOS.md:24`). Os adversários são da semente: os 3 desfiles da casa da Passarela com
notas 20–60 (`PassarelaNucleo.java:48-52`), o look da casa da Batalha (`BatalhaLooksAdversario.java`), o time rival do
Fashion Sports (`EsportePartida.java:63-66`), a oponente do Dress Fighter. Os endpoints do FLAIR 3D
(`Flair3dNucleoController.java:47-107`, `FlairMakeUpController.java:26-44`) não têm nenhum conceito de segundo jogador.
O que existe para reaproveitar:
- FLAIR 2D duelo 1×1: **digita-se a tag** (`components/flair/classic-modes.tsx:85-94`, placeholder "@paris_lea"), e o
  servidor faz `users.findByUsernameIgnoreCase(opponent)` contra o melhor deck público dela, sem convite nem aceite
  (`FlairService.java:429-446`, arquivo congelado no baseline). É exatamente o que a dona não quer.
- Equipes FLAIR 2D: código de convite (`classic-modes.tsx:159`).
- Desafios (`ChallengeService.java:254-335`): convite com aceitar/recusar, prazo de aceite, só para quem a pessoa segue
  (`follows...ACEITO`), notificação; mas a tela pede IDs separados por vírgula (`challenge-start-dialog.tsx:32-62`).
- Busca de pessoas com bloqueio e conta de teste: `GET /api/search?tab=PESSOAS` (`SearchService.java:624-637`,
  `DiscoveryController.java:47-56`); conexões: `GET /api/users/{id}/connections` (`ProfileController.java:63`);
  notificações: `NotificationService.notify` (`NotificationService.java:55`).
- O motor do FLAIR 3D já é determinístico por semente e refaz a partida dos acionamentos (`Flair3dRetomada`,
  `Contexto.sorteio`): duas partidas com a mesma semente são um duelo justo assíncrono sem mudar as regras.

**T2. Efeito das cartas no cenário é quase só luz.** Fora do Fashion Sports, Detective e Dress Fighter, a cor da carta
dispara um efeito "sem mudar a nota" (`Flair3dCores.java:29-40`); na cena, o efeito é uma luz pontual atrás do avatar e
um anel no piso (`components/flair/nucleos/scene/effects-3d.tsx:20-45`) e, em parte das cores, acender um grupo de luz
da sala (`lib/flair/nucleos/scene/sequences-color.ts:22-69`: `luz()`, `daSala("spots")`). Só 6 famílias de cor por
jogo: duas cartas azuis de raridade, marca e Hype diferentes fazem o mesmo efeito. A "jogada de cena" (+10 pela cor
pedida, `Flair3dJogadaDeCena`) é o único lugar em que isso conta.

**T3. Imagem e vídeo: não há vídeo em nenhum jogo do FLAIR 3D.** Busca por `<video`, `.mp4`, `.webm` e
`VideoTexture` em `components/flair/nucleos`, `lib/flair/nucleos`, `components/flair/make-up`, `esporte`, `detetive`:
zero ocorrências (só o FLAIR 2D/Elencos e o `demo-player` têm vídeo). Imagem real aparece só na carta (foto da peça)
fora da cena 3D; telões e painéis de LED mostram texto/placar (captura `8g/batalha_looks-b8-execucao.png`: "114 × 54"),
nunca a foto da peça ou um clipe. O replay do Fashion Sports é câmera 3D (`transmissao-3d.tsx:116`), não vídeo.

**T4. Personagens sem identidade e protagonista sem rosto.** Sem avatar no perfil, a protagonista é "a modelo da casa",
manequim de vitrine sem rosto (`nucleo-avatar.tsx:24,69`), ao lado de figurantes humanos realistas — contraste visível em
todas as capturas (`8g/passarela-a1-aura-preparo.png`, `around_the_world-regiao_nova_york.png`). NPCs não têm nome,
fala nem rival recorrente (exceto o elenco do Detective). Erros de pose: torcedor sentado no ar sobre a arquibancada
(`clube_coracao-uso-2-deixa.png`, canto inferior direito). As capturas antigas de fim de partida ainda mostram
bonecos-cápsula (`docs/auditoria/evidencias/116-f3d-fashion-sports-fim-d.jpg`, `116-f3d-dress-fighter-fim-d.jpg`).

**T5. Gráfico procedural com props do motor Blender em parte.** O próprio plano diz que 70 dos 88 tipos de móvel não
estão no manifesto GLB (`docs/flair/flair-3d/PLANO_MOTOR_BLENDER.md`, seção 1). Capturas: piso, paredes e caixas de
material liso; Nova York com o calçadão ondulado do Rio (`around_the_world-regiao_nova_york.png`); terraço do Super-Herói
com caixas e esferas flutuantes como alvos (`zonas/lab-heroi-uso.png`).

**T6. A jogabilidade de execução é a mesma em 12 jogos.** "Vá até a marca acesa e aperte o botão" (`Flair3dExecucao`,
`Flair3dFaseDeUso`; capturas `piloto_favorito-partida-1-fase-de-uso.png`, `clube_coracao-uso-2-deixa.png`). Os jogos de
zonas ganharam lance seguro × ousado, mas o cone não é driblado, o drone não atira, o carro não corre
(`ESTADO_DOS_JOGOS.md:259-261`).

**T7. Single player: campanha em 9, não nos outros.** `Flair3dCampanha.EM_SEQUENCIA` liga a sequência de rodadas só em
9 jogos (`Flair3dCampanha.java:33-34`); Road to Glory, os 4 de zonas e o Fashion Sports ficam "tudo aberto", sem
dificuldade crescente nem chefe. Não há desafio diário nem rival recorrente em nenhum.

**T8. Arquivos-gargalo.** `components/flair/nucleos/nucleo-game.tsx` (240/250 linhas) e
`flair3d/Flair3dNucleoService.java` (242/250) estão no limite do `LINE_RULES.md`; qualquer frente que os toque precisa
extrair antes. `FlairService.java` está congelado no baseline: o duelo 2D não pode crescer ali.

**T9. Tela de jogo pequena e poluída; controle e roda de recursos fora do padrão (achado da dona jogando o Fashion
Detective; verificado e vale para os 16).** (a) O palco 3D fica dentro da casca do app (menu lateral do site, barra de
busca) e ocupa só a metade de cima: nas capturas de 1360×860 a cena tem ~410 px de altura e o resto é deck, textos e
painéis empilhados embaixo (`8g/batalha_looks-b8-execucao.png`, `8g/passarela-a1-aura-preparo.png`,
`piloto_favorito-partida-1-fase-de-uso.png`); não há modo tela cheia (`app/(site)/_styles/33-flair3d-quadro.css:46-58`,
`.n3d-stage` sem altura própria). (b) Informação sobre a cena: objetivo, percurso, atributos (radar), "A modelo da casa",
barras de vida/energia/foco/moedas e a lista de peças-recurso ficam **por cima do 3D**, nos quatro cantos, e o texto da
ação ("Esse ponto do placar fica apagado...", 9 linhas) embaixo — tudo ao mesmo tempo. (c) **Setas não andam no
ambiente**: o andar só aceita WASD (`components/flair/nucleos/use-eixo-de-andar.ts:14`, `TECLAS_DE_ANDAR` =
KeyW/A/S/D); as setas são "NAVEGAR" entre cartas e abas (`lib/flair/nucleos/controls.ts:21-29`). (d) **Não há roda de
recursos e armas aberta por ✕**: a "roda" é uma janela fixa sempre visível à direita
(`nucleo-resource-window.tsx`, `detetive-palco.tsx:34`), e ✕ (Espaço/E) é VESTIR/confirmar (`controls.ts:30-31`); não
existe seleção radial com pausa/câmera lenta. Pesa em Jogabilidade (controle), Entretenimento (leitura da cena),
Recursos (acesso ao recurso na hora) e Gráfico (a cena aparece pequena e coberta). Notas já descontadas: −0,5 em
Jogabilidade, Entretenimento e Recursos do Detective e em Jogabilidade do Labirinto e do Around the World (jogos de
exploração, onde andar é o núcleo); −0,5 no Gráfico do Detective. Nos outros jogos o efeito já está dentro das notas
de Jogabilidade e Gráfico (nenhum passa de 6 nelas).

**Positivo (sustenta as notas de lógica e identidade).** Servidor autoritativo, determinístico e testado; a prévia não
gasta sorteio; salvamento e "Continuar partida" nos 15; cartas são as peças reais do guarda-roupa da pessoa, com
nível, Hype e Aura (identidade 5,5–7); desgaste de recurso com derrota possível (`recurso/Flair3dDesgaste`).

## 4. Jogo a jogo

Formato: achados com evidência; depois "para passar de 8", por critério abaixo de 8. Os critérios que dependem só
das frentes transversais aparecem agrupados com a frente do `PLANO.md` que os resolve (A0 tela de jogo e controle, A1 multiplayer, A2 efeitos de
carta/VFX, A3 personagens, A4 cenários Blender, A5 campanha, A6 deck e cartas, A7 vídeo/imagem).

### 1 · A Passarela — média 4,7
1. Adversário fraco e invisível: 3 desfiles da casa com notas de 20 a 60 (`PassarelaNucleo.java:48-52`); um look com 70
   no tema já vence sempre. Não há pessoa real nem júri que delibere.
2. A jogada é vestir o tema (+10 por peça, `PassarelaNucleo.java:30-36`) e depois a execução comum de 3 marcas; decisão
   espacial nenhuma no desfile.
3. Aura muda a partida só na branch 8g (plateia pela faixa de Hype, trunfo do Hype); na main, a faixa é só leitura.
4. Cenário bom para o padrão do projeto (painel LED, arco do backstage, plateia sentada humana) — `8g/passarela-a1-aura-preparo.png`;
   protagonista manequim sem rosto destoa da plateia.
5. Efeito da carta: SILHUETA/BRISA/HOLOFOTE/FLASHES... são luzes; só APLAUSOS move NPC (`sequences-color.ts:23-29`).

Para passar de 8: Jog/Complex — desfile com escolhas de pose/tempo por segmento da passarela, pontuação do júri com 3
jurados de gostos diferentes (sorteados), confiança que oscila por pose; Ent — tema surpresa no meio do desfile, ranking
da semana; Multi (A1) — duelo assíncrono por semente contra pessoa convidada e desfile lado a lado; Single (A5) — temporada
de semanas de moda com chefe "campeã da casa" nomeada; Carta/Efeito (A2/A6) — carta abre efeito próprio no palco (chuva de
pétalas, passarela que acende por segmento, foto da peça no telão); FX (A7) — telão com a foto da peça e clipe de abertura;
Pers/GrafPers (A3); Gráf (A4) — passarela e plateia do motor Blender com pós-processo; Recursos — confiança visível
na cena (luz da passarela); Lógica — casa com notas calibradas pela dificuldade da rodada.

### 2 · Dress Fighter — média 5,2 (o mais completo)
1. Luta lance a lance com leitura do golpe seguinte, distância PERTO/LONGE, combos por sequência de cor e Especial
   uma vez por luta (`DressFighterLuta.java`, `DressFighterGolpes.java:12-27`, `DressFighterDistancia.java`): é o único
   jogo cuja lógica chega a 7.
2. Uma oponente por arena, sem nome nem estilo de luta descrito na tela; nenhum chefe; IA = pesos fixos por arena
   (`DressFighterGolpes.java:29-30`).
3. Recursos: falta vida máxima por look, fôlego por golpe e descarte até o round seguinte (`ESTADO_DOS_JOGOS.md:204`).
4. Efeito da carta no cenário existe (avatar faz GUARDA/SOCO/CHUTE, rastro de luz, `sequences-color.ts:31-37`), sem
   partícula de impacto nem câmera de impacto.
5. Captura de fim de luta antiga mostra a oponente como cápsula roxa (`docs/auditoria/evidencias/116-f3d-dress-fighter-fim-d.jpg`);
   hoje é humana de baixa resolução.

Para passar de 8: Jog — barra de fôlego, guarda que quebra, contra-ataque com janela; Ent/Single — torneio de 4 lutadoras
nomeadas com estilos (veloz, blindada, contra-golpista) e chefe; Multi (A1) — **1×1 por turnos contra pessoa convidada**
(cada lance é um acionamento já guardado; basta trocar a semente da oponente pela mão da outra pessoa); Carta (A6) —
custo de fôlego por carta e raridade mudando o golpe; Efeito/FX (A2/A7) — impacto com partículas, câmera lenta no
nocaute, clipe de vitória; Pers/GrafPers (A3); Gráf (A4) — beco do Blender; Recursos — os 3 itens do achado 3.

### 3 · Dress the Star — média 4,7
1. Modo Stylist com dedução de perfil por pistas (25 com estilo e cor, 10 com um; a prévia não dá a nota) —
   ideia boa (`DressTheStarNucleo.java` cabeçalho); Look Relâmpago de memória.
2. A "estrela" é perfil inventado, sem personagem 3D com personalidade nem fala; a reação é aplaudir/lamentar.
3. A decisão termina na entrega; o desfile depois é a execução comum.
4. Efeitos de cor: canhões e telão acendem (`sequences-color.ts:39-46`), sem imagem nem vídeo no telão.

Para passar de 8: Jog/Complex — rodada de "entrevista" em que a estrela pede ajuste e a pessoa troca 1 carta com custo;
Pers (A3) — 4 estrelas nomeadas e modeladas com fala e humor; Ent — reviravolta (a estrela muda de ideia); Multi (A1) —
dois stylists para a mesma estrela, plateia vota; FX (A7) — telão com a foto das peças e clipe do tapete vermelho;
demais critérios pelas frentes A2–A6.

### 4 · Personagem de Filme — média 4,4
1. Núcleo = figurino (12,5 por parte) + adivinhar o título entre 4 (`PersonagemFilmeNucleo.java` cabeçalho; título
   certo fixo `CERTO = "FILME_SOMBRAS_NA_CHUVA"`, linha 40, na rodada base).
2. Set sem interagíveis (monitor, claquete, braço de claquete: `ESTADO_DOS_JOGOS.md:212`); o quiz é texto.
3. A paciência do diretor (FOCO) é o único recurso; nenhum NPC "diretor" com fala.
4. Efeitos de cor: luz de gênero e claquete (`sequences-color.ts:47-54`).

Para passar de 8: Jog/Complex — gravar 3 tomadas (enquadramento, marca no chão, fala) em que a carta muda o gênero da
cena; Pers — diretor e coestrela nomeados; FX (A7) — **a tomada vira um clipe curto** (renderizado da cena com filtro do
gênero) que a pessoa assiste e pode salvar; Multi — "casting": duas pessoas vestem o mesmo personagem e o diretor escolhe;
demais pelas frentes.

### 5 · Road to Glory (núcleo) — média 4,0
1. Sem deck: usa o guarda-roupa liberado (`RoadToGloryNucleo.java` cabeçalho) — carta no deck fica em 3,5.
2. Regras = as 4 do brief (ocasião, material leve, batom coral, acabamento) (`EnsaioVeraoBrief.java`, mesmas regras):
   checklist, não jogo.
3. Sessão de fotos = execução comum + carta fora do look acende a luz pedida (+10).
4. Maquiagem aparece no rosto do manequim nesta cena (`nucleo-scene-3d.tsx:92,118`), ao contrário da aba MAKE UP.

Para passar de 8: Jog — sessão de fotos real (enquadrar, escolher a luz, a pose e o momento do clique; a foto sai da cena
e é avaliada por composição/cor); Carta (A6) — deck com cartas de roupa **e** de beleza; FX (A7) — a foto final vira
imagem salva no perfil/look; Single (A5) — carreira com fotógrafos e revistas como chefes; Multi — ensaio lado a lado
votado; Pers — fotógrafa nomeada com pedidos e humor.

### 6 · Fashion Detective — média 5,2 (o mais criativo)
1. Caso "A Coleção Maré" em 9 salas com vigias de cone, bolso, 5 chaves, 12 pistas, caderno, mapa, cutscenes com
   legenda e acusação; cada ação é uma carta da cor certa (`Flair3dCores.java:21-22`, `detetive/*.java`).
2. O culpado é fixo (`ESTADO_DOS_JOGOS.md:208`): rejogar perde o mistério (entretenimento e lógica limitados).
3. Cenários das salas novas simples; sala própria escrita à mão em three.js, fora do motor (`PLANO_MOTOR_BLENDER.md`,
   família B); captura `112-f3d-fashion-detective-partida-m.jpg`.
4. Sem ✕ contextual sobre o objeto mais próximo; andar só por WASD, setas não movem (`use-eixo-de-andar.ts:14`);
   tela de jogo na metade de cima com o caderno, mapa e painéis por cima/abaixo da cena e roda de recursos fixa, sem
   abertura por ✕ (achado da dona; T9).

Para passar de 8: Jog/Ent/Recursos/Gráf — frente A0 (tela de jogo, já iniciada por outro agente neste jogo):
palco em tela cheia, HUD em painéis laterais recolhíveis, setas + WASD + gamepad + toque para andar, roda radial de
recursos e armas no ✕ segurado; Lógica/Ent — culpado sorteado entre 3 com pistas decisivas parametrizadas (texto nos 3 idiomas por
variante); Multi (A1) — **modo cooperativo de 2 detetives** (cada um com o próprio deck, pistas compartilhadas) ou
corrida assíncrona pela mesma semente; Gráf (A4) — salas pelo motor Blender; Pers/GrafPers (A3) — suspeitos modelados
com retrato e fala; FX (A7) — fotos das pistas como imagem no caderno e cutscene final em vídeo; Efeito (A2) — gaveta abre,
vigia distrai, luz apaga pela carta.

### 7 · Boutique 3D — média 4,6
1. Cliente com paciência (VIDA 60, −15 por peça fora do pedido) e rodadas Personal Stylist / Vitrine / Provador Lotado
   (`Boutique3dNucleo.java`, `Boutique3dRodadas.java:21-24`).
2. Loja sem interagíveis (arara, provador, balcão: `ESTADO_DOS_JOGOS.md:212`): a pessoa não atende, só entrega.
3. A cliente prova e comemora/devolve (visto), sem fala nem nome.
4. Identidade forte (peças reais do guarda-roupa como estoque) — melhor ponto de partida para ligar à loja/FAI Store.

Para passar de 8: Jog/Complex — fila de clientes em tempo, cada uma com humor e orçamento; arara/provador/balcão
interagíveis; venda com margem (moedas) e reputação da loja; Multi — duas boutiques disputando a mesma cliente;
FX (A7) — vitrine mostra a foto das peças; Pers (A3) — clientes recorrentes nomeadas; demais pelas frentes.

### 8 · Clube do Coração — média 3,4
1. Jogo de zonas: **sem cartas** (`ESTADO_DOS_JOGOS.md`, tabela "Cartas como ação": "pintar zonas (sem cartas)"); nota
   50 pelas zonas + 50 pelas cores (`ClubeCoracaoNucleo.java:24`).
2. Fase de uso de 5 marcas com lance seguro/ousado (`Flair3dFaseDeUso`), cones fixos, sem goleiro nem defensor
   (captura `clube_coracao-uso-2-deixa.png`).
3. Avatar veste só a cor dominante na main; o uniforme pintado (escudo, número, gola) está na branch `zonas-nota8`.
4. Torcedor sentado no ar na arquibancada (mesma captura).

Para passar de 8: Carta (A6) — **cartas de roupa entram**: a peça do guarda-roupa vira tinta/padrão/escudo (a cor da
carta é a tinta, a raridade o acabamento) e cartas de jogada na fase de uso; Jog/Complex — mini-partida (driblar
defensor que reage, finalizar contra goleiro) com a camisa dando atributos; Multi — clássico contra o clube de outra
pessoa; Single — campeonato de clubes; demais pelas frentes.

### 9 · My Favorite Singer — média 3,5
1. Pintar zonas por era (25 por regra, `FavoriteSingerNucleo.java:17`); sem cartas.
2. Fase de uso "show" = marcas no palco com lance seguro/ousado (captura `favorite_singer-uso-2-deixa.png`).
3. Sem cantora/banda com personalidade; plateia genérica.

Para passar de 8: Jog — show em ritmo (setlist de 3 músicas, notas no tempo, lance ousado = agudo); Carta — figurino
por cartas e cartas de efeito de palco (pirotecnia, telão com a foto da peça); FX (A7) — telão em vídeo do show; Pers —
banda e fãs nomeados; Multi — batalha de bandas; demais pelas frentes.

### 10 · O Labirinto — média 3,9
1. Espelho abre só com o look da família de cor certa; Reflexo (ENERGIA) −15 por tentativa errada
   (`LabirintoNucleo.java` cabeçalho); a decisão é um quiz de cor.
2. Sem corredores nem ramos (`ESTADO_DOS_JOGOS.md:214`); o Jardim dos Espelhos existe só como dado
   (`lib/flair/mundos`), não como lugar andável.
3. Ninguém no labirinto (personagens 3,0); gráfico 4,0.

Para passar de 8: Jog/Complex/Ent — labirinto andável gerado da semente com portas-espelho por família, atalhos que a
carta abre e uma "sombra" que persegue; Efeito (A2) — carta ilumina caminho, abre parede, revela reflexo; Multi — corrida
pelo mesmo labirinto (semente) contra convidado; Gráf (A4) — jardim do motor Blender; Pers — guardiã do espelho com
enigmas.

### 11 · Meu Piloto Favorito — média 3,5
1. Pintar capacete (25 por regra, `PilotoFavoritoNucleo.java:17`); sem cartas.
2. "Volta de classificação" = andar até 5 marcas numa reta com pórticos (captura `piloto_favorito-partida-1-fase-de-uso.png`);
   o carro está parado ao fundo; não há pilotagem.
3. Combustível como recurso funciona (roda "50 −30").

Para passar de 8: Jog — volta pilotada (traçado, frenagem por janela, ultrapassagem), capacete e macacão dando
atributos; Carta — cartas de roupa como peças do macacão e de jogada (box, vácuo); Multi — tempo de volta contra
convidado (fantasma da mesma semente); Gráf (A4) — pista e carro do Blender; demais pelas frentes.

### 12 · Around the World — média 4,3
1. Sete regiões com cenário próprio por variante (`scene/salas/around-the-world-regioes.ts`), mas Nova York usa o
   calçadão ondulado do Rio e vitrines vazias (captura `around_the_world-regiao_nova_york.png`).
2. Caminho reto sem ramos; moedas não pagam para pular região (`ESTADO_DOS_JOGOS.md:214-215`, item 2 da rodada de 26/11).
3. Regras de look por região (Rio: parte de cima leve, baixo leve, cor quente, marca brasileira:
   `AroundTheWorldNucleo.java` cabeçalho) — checklist.

Para passar de 8: Jog/Complex — mapa com rotas (custo de moedas/energia, clima sorteado que pede troca de peça),
interagíveis por cidade; Ent/Single — passaporte com carimbos e evento surpresa por cidade; Multi — corrida ao redor do
mundo contra convidado; FX (A7) — cartão-postal (imagem) da cidade com o look; Gráf (A4) — marcos de cada cidade
(Blender); Pers — guia local nomeado por cidade.

### 13 · Meu Super-Herói — média 3,4
1. Pintar traje, emblema da lista, capa (25 por regra, `SuperHeroiNucleo.java` cabeçalho); sem cartas.
2. "Missão no terraço" = 5 marcas com esferas vermelhas paradas como alvos (`zonas/lab-heroi-uso.png`); drone não atira.
3. Capa e traje pintados aparecem na captura do laboratório (branch `zonas-nota8`), não na main.

Para passar de 8: Jog — missão com inimigos que se movem e poder com recarga (carta Especial = superpoder); Carta — peças
do guarda-roupa como partes do traje com atributo; Multi — dupla de heróis (co-op) ou duelo; Pers — vilão recorrente
nomeado; Gráf/FX — cidade noturna do Blender, clipe da missão; demais pelas frentes.

### 14 · Fashion Sports — média 5,0
1. Partida por cartas de verdade: cor = ação, poder = duelo, barra de tempo no chute/desarme, 6 modalidades
   (`EsporteRegras.java:19-25`, `FashionSportsNucleo.java` cabeçalho); transmissão com cortes e replay em câmera 3D.
2. Fôlego, embalo e goleiro pronto não aparecem na tela; descarte volta de graça (`ESTADO_DOS_JOGOS.md:206`).
3. Rival = 4 números da semente (`EsportePartida.java:63-66`): sem time nomeado, sem tática.
4. Estádio/quadras escritos à mão em three.js, fora do motor (`PLANO_MOTOR_BLENDER.md`, família C); captura antiga com
   bonecos-cápsula (`116-f3d-fashion-sports-fim-d.jpg`).
5. Campanha: uma rodada só, modalidades todas abertas (`Flair3dCampanha.java:36`).

Para passar de 8: Multi (A1) — **partida por turnos contra pessoa convidada** e 2×2 com as Equipes FLAIR 2D; Single —
liga com 5 times nomeados; Recursos — HUD de fôlego/embalo, descarte com custo; FX (A7) — telão com replay em vídeo do
gol e a foto da carta que decidiu; Gráf (A4) — estádio pelo motor; Pers — capitã rival recorrente.

### 15 · Batalha de Looks — média 4,7
1. Três rodadas contra o look da casa, mesmas regras para os dois lados, carta cansada, foco gasto como recurso
   (`BatalhaLooksPlacar.java`, `BatalhaLooksRodadas.java`) — é o jogo cujo conceito é **naturalmente multiplayer**, e
   o adversário ainda é a casa.
2. Bug na main: "30 pontos, nenhuma estrela, Vitória" (média das rodadas + execução × desfecho pela soma). Corrigido
   **só na branch 8g** (`BatalhaLooksFecho`, captura `8g/batalha_looks-b9-tabela.png`).
3. LED mostra o placar em texto (captura `8g/batalha_looks-b8-execucao.png`); deck band na execução com 4 cartas em
   branco (bancada sem foto).
4. Selos de carta idênticos ("vale conforme o pedido da vez" + nome da luz) em 24 cartas do deck
   (`8g/batalha_looks-b0-deck.png`): a escolha de carta é ilegível na montagem.

Para passar de 8: Multi (A1) — **a Batalha é o piloto do multiplayer**: convite por busca, as 3 rodadas com o mesmo
desafio para os dois, votação da plateia; Carta — selo que diz o valor provável da carta no desafio; FX (A7) — telão
com as fotos dos dois looks lado a lado; Pers — jurados nomeados que comentam; demais pelas frentes.

### MAKE UP (aba) — média 2,7
1. **A maquiagem não aparece no 3D da aba**: `MakeUpScene3D` recebe avatar, corpo, peças, giro e zoom, mas não recebe
   `maquiagem` (`components/flair/make-up/makeup-scene-3d.tsx:15-45`); só o fallback 2D mostra amostras de cor
   (`makeup-scene.tsx`, `Cena2D`). No núcleo Road to Glory a mesma maquiagem é desenhada no rosto
   (`nucleo-scene-3d.tsx:92,118`).
2. Conteúdo mínimo: 3 briefs (`flair3d/makeup/briefs/`), paleta de 11 famílias e 3 acabamentos
   (`FlairMakeUpPaleta.java:15-27`), nota = checklist de 4 regras de 25 (captura `124-makeup-resultado-d.jpg`).
3. Sem deck, sem execução, sem NPC, sem multiplayer; a tela de resultado é uma tabela (mesma captura).
4. Identidade razoável: provador do app com o logo FashionAI (`makeup-scene-3d.tsx:2-6`), carreira com Prestígio no
   servidor (`FlairMakeUpService.java`, `FlairMakeUpCarreira`).
5. Rascunho só no navegador (`ESTADO_DOS_JOGOS.md`, "Limites conhecidos").

Para passar de 8: Gráf/GrafPers — **ligar a maquiagem ao rosto 3D** (reaproveitar `maquiagemNoRosto`) e close de rosto
com luz de estúdio; Jog/Complex — maquiagem por camadas (base, olhos, lábios, bochecha) com pincel/ferramenta e mistura,
tom pela iluminação do brief; Carta (A6) — deck de cartas de beleza (produtos/paletas como cartas com raridade) e de
roupa; Single — 12 briefs em carreira com clientes nomeadas; Multi — desafio "mesmo brief" contra convidado com voto;
FX (A7) — foto de capa de revista gerada da cena; Recursos — orçamento de produtos.
