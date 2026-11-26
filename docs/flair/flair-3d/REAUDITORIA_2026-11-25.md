# Reauditoria das 15 modalidades FLAIR 3D (25/11/2026, depois das etapas 1-24)

Mesma escala da [auditoria anterior](AUDITORIA_2026-11-25.md) (10 = referência comercial de console; teto realista de gráficos no navegador 7-7,5). Cinco auditores independentes, só leitura, conferindo se o código novo está de fato ligado na tela.

## Notas

| Jogo | Jogab. | Recursos | Sentido | Gráficos | Roupas | Comandos | Cutscenes | Final | Antes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DRESS_FIGHTER | 5 | 6 | 7 | 5 | 6 | 5,5 | 6 | **5,8** | 4,6 |
| PASSARELA | 4 | 4 | 6 | 5,5 | 5,5 | 6,5 | 6 | **5,4** | 4 |
| DRESS_THE_STAR | 3,5 | 4 | 6,5 | 5,5 | 5 | 6,5 | 6 | **5,3** | 3,9 |
| PERSONAGEM_FILME | 4 | 3,5 | 6 | 5,5 | 5 | 6 | 5,5 | **5,1** | 3,6 |
| FASHION_DETECTIVE | 5,5 | 5,5 | 6 | 4,5 | 2,5 | 4,5 | 6,5 | **5,0** | 4,4 |
| AROUND_THE_WORLD | 3,5 | 4,5 | 5,5 | 4,5 | 5 | 6,5 | 5,5 | **5,0** | 3,4 |
| BOUTIQUE_3D | 3,5 | 3,5 | 5,5 | 6 | 4,5 | 6 | 5 | **4,9** | 3,5 |
| LABIRINTO | 3,5 | 4,5 | 5 | 4 | 5 | 6,5 | 5,5 | **4,9** | 3 |
| ROAD_TO_GLORY | 3,5 | 2,5 | 5,5 | 5,5 | 5,5 | 6 | 5 | **4,8** | 3,4 |
| FASHION_SPORTS | 3,5 | 5 | 6 | 4,5 | 4,5 | 5 | 4,5 | **4,7** | 4,3 |
| BATALHA_LOOKS | 3 | 2,5 | 6 | 5 | 4 | 6,5 | 5,5 | **4,6** | 3,4 |
| CLUBE_CORACAO | 2,5 | 2,5 | 5 | 4 | 3,5 | 6 | 5 | **4,1** | 2,5 |
| FAVORITE_SINGER | 2,5 | 2 | 5,5 | 4 | 3,5 | 5 | 5 | **3,9** | 2,6 |
| PILOTO_FAVORITO | 2,5 | 2 | 5 | 4,5 | 3 | 5 | 5 | **3,9** | 2,6 |
| SUPER_HEROI | 2,5 | 2 | 5 | 4 | 3 | 5 | 5 | **3,8** | 2,4 |

Média: 4,7 (antes: 3,4),

## Por que ainda não passa de 8

- **Habilidade não conta na nota.** A decisão em vigor (o que a pessoa faz muda só a cena) limita a jogabilidade: andar, desfilar, circular no ringue, levar a capitã e explorar não mudam o resultado, que já está decidido na entrega.
- **Recursos só sobem.** Vida, energia, foco e moedas sobem com o USAR, mas nada os gasta e não há derrota por falta deles; usar é sempre o certo.
- **Prévia exata e respostas fixas.** A prévia mostra a nota antes de entregar (DTS, Batalha, Filme), e há respostas fixas (culpado do detetive, título do filme), o que tira a decisão.
- **Jogos de zonas.** O avatar não veste a peça pintada (fica em faixas no manequim), e a fase de uso é andar ~0,5 m e posar.
- **Gráficos.** A maior parte das salas ainda é procedural; teto realista 7-7,5.

## Lacunas por jogo (as três de maior ganho)

### DRESS_FIGHTER

- **gameplay** (G, +1,2): Andar no ringue não muda nada na luta. A leitura mostra o golpe exato da oponente sem limite de tempo, então a resposta ótima é uma consulta de tabela. *Fazer:* Mandar no AcionamentoPedido.alvo a faixa de distância PERTO/LONGE, calculada pela posição do jogador (jogador.current.pos) na hora de jogar a carta. Numa classe nova, DressFighterDistancia, fazer o forte e o básico só acertarem PERTO e o recuo evitar o rápido. Leitura parcial: mostrar só 'ataque'/'defesa' quando a velocidade do look for menor que a da oponente. Fechar a janela do lance em 5 s; se o tempo acabar, vale guarda básica. Antes disso, teste de caracterização.
- **comandos** (M, +0,9): O golpe ainda é escolhido navegando o foco pelos botões HTML. O □ tem o rótulo 'golpe' em mapa-por-jogo.ts, mas não está ligado (vira POSAR e é descartado na ACAO). *Fazer:* Num hook use-luta-comandos.ts, ativo só em ACAO do DRESS_FIGHTER, mapear △=forte(vermelho), □=rápido(amarelo), ✕=guarda(preto), ○=esquiva(verde), L1=fôlego(azul), R1=foco(branco), R2=Especial, e no teclado J/I/K/L/U/O/Espaço. Cada comando escolhe a primeira carta da mão com essa cor e chama o mesmo onAcionar. Mostrar o glifo em cada carta.
- **recursos** (M, +0,8): A vida máxima continua 100 para qualquer look. Não há fôlego por golpe e as cartas não são gastas: basta alternar duas. *Fazer:* Vida máxima = 80 + defesa/2. Criar uma barra de fôlego (forte 30, rápido 15, esquiva 10; guarda recupera 10); sem fôlego, o golpe sai básico. A carta jogada vai para o descarte até o round seguinte. Extrair DressFighterFolego e desenhar a segunda barra em nucleo-barras-de-vida.tsx.

### FASHION_SPORTS

- **gameplay** (G, +1,3): A capitã é decorativa: a posição não entra no lance, e o duelo continua sendo carta + sorte de ±8. *Fazer:* Ao jogar a carta, mandar em AcionamentoPedido.alvo a zona da capitã (desvio quantizado em 3 faixas, ex.: PERTO_DA_BOLA/APOIO/LONGE). No EsporteLance, a zona boa vale +4 e a ruim −4, e o servidor só aceita os valores do enum. Somar uma barra de tempo (QTE) no chute e no desarme, cujo acerto, enviado como faixa 0..2 e validado, reduz a sorte de ±8 para ±3.
- **cutscenes** (P, +0,9): O final de vitória/empate/derrota do cinema não é desenhado no EsportePalco, e a cutscene invisível ainda bloqueia o primeiro comando. O gol é só a vinheta de texto. *Fazer:* Passar o `cinema` de NucleoGame para useModoPorCartas, renderizar <CinemaOverlay cinema={...}/> dentro do EsportePalco e uma câmera de cinema na Transmissao3D (ou, no mínimo, não marcar cena.tocando quando o palco é próprio). Criar o gatilho GOL (grua de 2,5 s na comemoração) disparado por momentoDoLance === PONTO_NOS.
- **recursos** (M, +0,8): O fôlego, o embalo e o goleiro pronto existem no servidor, mas não aparecem. A ENERGIA usada recarrega um fôlego que a pessoa não vê. O baralho recicla de graça. *Fazer:* Mandar folego/embalo/goleiroPronto no evento SITUACAO e desenhar medidores no EsportePainel (ou como recurso na roda). Fazer o descarte voltar só no intervalo.

### FASHION_DETECTIVE

- **efeito_das_roupas** (M, +1,6): No caso COLECAO_MARE, o look vestido não muda vida, passo, cone nem tempo. A peça usada como recurso também não tem efeito nesse caso. *Fazer:* No início da DetetivePartida, ler o PerfilDoLook (Flair3dRecursoTabela) e guardar no estado: FURTIVIDADE reduz o alcance do cone (ex.: −10% por faixa), AGILIDADE reduz SEGUNDOS_POR_PASSO, VIDA dá +1 de vida máxima. Aplicar Flair3dRecursoNoMotor.noLance(usos, "VIDA"/"FOCO", passo) também em DetetivePartida. Mandar atributos/vidaMax no retrato e mostrar a NucleoRodaAtributos no DetetivePalco. Testes determinísticos com look neutro sem mudança.
- **comandos** (M, +1): Não há X contextual sobre o objeto mais próximo. WASD e o analógico andam e, ao mesmo tempo, movem o foco dos botões do painel (entrada duplicada). *Fazer:* Passar andar=true para useNucleoControls quando FASHION_DETECTIVE estiver em ACAO (o movimento PONTOS também anda), para WASD e o analógico ficarem só com o corpo. Criar lib/flair/detetive/interacao.ts, que escolhe em acoesPossiveis a ação do ponto atual, e mostrar a dica '✕ Abrir armário' na sala. ✕ dispara essa ação (o seletor de carta já vem filtrado pela cor) e ○ esconde.
- **sentido_e_objetivo** (M, +0,8): O culpado é fixo (CULPADO=2): quem rejoga já sabe a resposta. Com 0 vidas não há derrota real. *Fazer:* Sortear o culpado entre 2 e 9 com contexto.sorteio("culpado") e trocar as pistas decisivas conforme o culpado. Fechar o caso como CAPTURADO (derrota) com 0 vidas. Liberar a acusação só a partir de 6 pistas.

### PASSARELA

- **gameplay** (M, +1): O desfile não pede habilidade: 3 marcas em 2 m, alcance de 0,5 m, sem tempo, sem erro e sem efeito na nota. A partida ainda é montar o look e assistir. *Fazer:* Em cada marca, abrir uma janela de pose de cerca de 0,8 s (perfeito, bom ou errou) com o glifo do botão pedido. Enviar os acertos como acionamento pelo mesmo canal da jogada de cena e somar até +15 no PassarelaNucleo; sair da faixa ou errar o ritmo custa pontos. A largura da janela sai do calçado (AGILIDADE).
- **recursos** (M, +0,6): Vida, energia, foco e moedas só sobem com o USAR. Nada drena, usar não custa nada (o certo é sempre usar tudo) e não há derrota por recurso. *Fazer:* Fazer o FOCO (Confiança) cair a cada pose errada e a cada peça fora do tema. Com zero, a partida fecha REPROVADO (regra no servidor a partir dos acionamentos). Usar uma peça como recurso passa a custar a vaga dela na jogada de cena.
- **gameplay** (P, +0,3): O percurso usa só 2 m de uma passarela de 10,6 m (z de -8 a 2,6), porque naFrente(2.0) parte da marca 0. *Fazer:* Começar a ação no arco do backstage (z -7,5), pondo jogador.current nessa posição ao entrar na ACAO, e espalhar as 3 marcas até a ponta (2,3). Assim o desfile dura de 4 a 5 s e a câmera SEGUE tem o que mostrar.

### DRESS_THE_STAR

- **gameplay** (M, +0,8): Não há dedução nem risco: o perfil da estrela vem escrito no briefing e a prévia mostra a nota antes de entregar. *Fazer:* Tirar do briefing o texto 'Perfil: estilos..., cor...' e entregar pistas parciais. A peça vale 25 com estilo E cor, 10 com só um. Mostrar a prévia só depois de gastar FOCO, numa ação de consultar a estrela.
- **gameplay** (M, +0,8): O desfile no palco tem 0,9 m e a primeira marca já está alcançada no início; o show não pede nenhuma habilidade. *Fazer:* Trocar naFrente por 3 marcas espalhadas pelo palco (esquerda, direita, frente), que acendem em ordem com um prazo antes do holofote apagar. Errar o prazo tira FOCO da estrela; os acertos vão ao servidor como acionamento.
- **recursos** (M, +0,6): FOCO (confiança da estrela) só sobe com o USAR; não cai com peça fora do perfil e não há derrota. *Fazer:* Cada peça fora do perfil e cada marca perdida reduzem o FOCO no andamento; com zero, a noite termina REPROVADO com a cutscene de DERROTA. Usar uma peça como recurso a tira do look possível.

### BATALHA_LOOKS

- **gameplay** (M, +0,9): A nota do adversário é sorteada e não depende do look dele. Com a prévia exata, não há risco nem decisão. *Fazer:* Sortear pela semente um look da casa (cartas do catálogo) avaliado pelas mesmas regras da rodada. Mandar as peças no evento RODADA_DA_BATALHA e vestir o figurante ADVERSARIO com elas. Esconder a nota dele até a entrega, mostrando só a família de cor.
- **recursos** (M, +0,9): A Batalha está fora da regra peça-recurso na nota; o USAR e os atributos não mudam o resultado, e as cartas não se gastam entre rodadas. *Fazer:* Incluir BATALHA_LOOKS no perfil (CARISMA e AGILIDADE, recurso-vida ENERGIA) aplicado por rodada antes de comparar com o adversário. Marcar como cansada, inválida na rodada seguinte, a carta usada numa rodada; o servidor recusa com CARTA_CANSADA.
- **gameplay** (M, +0,6): O desfile da Batalha é um passo: 2 das 3 marcas são alcançadas parado. *Fazer:* Fazer o percurso pela passarela em Y (do braço do jogador até o centro e a ponta), ampliar a zona do avatar para o perfilEmY e pôr a última marca no pontoDePose central, onde se faz um duelo de pose com janela de tempo contra o adversário.

### PERSONAGEM_FILME

- **gameplay** (P, +1,2): A prévia da rodada base revela o título certo, e o título é sempre o mesmo (CERTO). Basta trocar de opção e olhar o placar ao vivo. Isso anula a única decisão real da partida. *Fazer:* Em previa(), remover o atalho 'if (contexto.rodada() == null) return pontuar(...)' e devolver só o FIGURINO em todas as rodadas. Na base, sortear a cena pela semente como no CENA_SORTEADA (contexto.sortear("cena", CENAS)). Antes, escrever um teste de caracterização que garanta que a prévia nunca tem a regra TITULO.
- **gameplay** (M, +1): O andar livre do preparo não tem objetivo: nenhum objeto do set é interagível (monitor, cadeira do diretor, claquete, arara). A ação é andar 1,2 m em linha reta e apertar □, sem falha, tempo nem escolha. *Fazer:* Criar lib/flair/nucleos/movimento/interagiveis.ts (puro), com pontos por sala: monitor = pista 1, claquete = pista 2, cadeira do diretor = pista 3. Quando a personagem está perto, ✕ revela a pista no HUD (reaproveitar o 'perto' de desfile.ts). A marca no piso só libera o 'gravar' depois de 2 pistas. Na ação, montar um percurso com 3 marcas espalhadas pelo set (câmera, cenário, marca) e uma janela de tempo para o □ (por exemplo, 1,2 s depois de 'ação'), com o atraso visível no HUD.
- **recursos** (M, +0,9): FOCO só sobe: usar peça é grátis e sempre rende bônus, nada gasta o recurso e não existe derrota por falta dele. *Fazer:* Dar custo no servidor: cada troca de título na prévia (ou cada pista aberta) registra um uso negativo de FOCO (-10) em Andamento.usos. Com FOCO em 0, a entrega fecha como REPROVADO 'o diretor cortou'. Assim a peça usada como recurso devolve o que se gastou. Cobrir com teste em Flair3dRecursoUsoTest.

### BOUTIQUE_3D

- **gameplay** (M, +1,1): A loja é andável, mas nada nela responde. A arara não abre o estoque, o provador não leva o look à cliente e o balcão não fecha a venda. A ação são 2 pontos a menos de 1,5 m, sem falha. *Fazer:* Criar lib/flair/nucleos/movimento/interagiveis.ts com os pontos arara (-3,2; -1,3), provador (-3,1; -3,9) e balcão (3,1; -1,6). Perto da arara, ✕ abre a faixa do deck filtrada pela vaga. No provador, ✕ pede a prévia ('a cliente prova'). No balcão, ✕ entrega. Na ação, trocar PERCURSOS.BOUTIQUE_3D por arara, provador e cliente, com a dica de botão no HUD (DesfileHud). O hook novo fica fora de nucleo-game.tsx, que tem 245 linhas.
- **recursos** (M, +1): Não existe recurso que se perca: MOEDAS só sobe com o uso das peças, a paciência da cliente não existe e errar só custa nota. *Fazer:* Usar VIDA como 'paciência da cliente' (começa em 60). Cada prévia pedida no provador com peça fora do pedido registra um uso de -15 VIDA no servidor. Com VIDA em 0, a cliente vai embora e a partida fecha REPROVADO com final próprio. A peça do deck usada como recurso devolve paciência (+25), e as MOEDAS da venda certa ficam como pontuação. Mostrar a barra já existente com o rótulo 'Paciência'.
- **efeito_das_roupas** (P, +0,7): Vestir muda a roda de atributos e a velocidade de andar, mas a cliente não reage na hora, e as ações destravadas são só texto. *Fazer:* Ao vestir, quando o efeito do servidor para a carta é positivo (efeitos.itens com PEDIDO), tocar F_ACENA na fig('CLIENTE'), e F_LAMENTA quando a carta está fora do pedido. Isso reaproveita assinarFx com o evento de entrada que use-card-fx já emite, e cabe num componente novo de cena com cerca de 40 linhas.

### ROAD_TO_GLORY

- **recursos** (P, +0,8): Usar peça como recurso não funciona no RTG. O jogo é sem deck, o servidor recusa toda carta (CARTA_FORA_DO_DECK) e a tela oferece o guarda-roupa inteiro como botões 'Usar' que sempre dão erro. *Fazer:* No servidor, quando a definição é semDeck, aceitar como usável a carta da pessoa que está entre as vestidas da partida ou do rascunho (a validação de dono continua em cartas.daPessoa). Na tela, filtrar pecas para as cartas vestidas quando definicao.deck.semDeck. Acrescentar um caso RTG em Flair3dRecursoUsoTest.
- **gameplay** (G, +1,2): A sessão de fotos continua sendo um clique numa carta mais 2 pontos a 1,2 m e □. Não há pedidos da fotógrafa, janela de tempo nem erro possível. O camarim é andável, mas a penteadeira e a arara não são interagíveis. *Fazer:* Criar lib/flair/nucleos/movimento/sessao-de-fotos.ts (puro): 4 pedidos sorteados pela semente (□ pose, △ virar o rosto, ✕ olhar para a câmera, ○ mão no quadril), cada um com janela de 1,5 s e uma marca do camarim. Acerto acende o flash, erro gasta 15 de ENERGIA, e o resultado entra como evento validado no servidor por acionamento JOGADA, como o LANCE do Dress Fighter. No preparo, ✕ na penteadeira abre a aba de maquiagem e ✕ na arara abre as cartas.
- **recursos** (M, +0,7): ENERGIA (o recurso-vida do RTG no Flair3dRecursoPerfil) não tem gasto nem derrota. Mesmo corrigido o uso, ela só serve de bônus. *Fazer:* Fazer cada flash da sessão (jogada de cena ou pedido) gastar ENERGIA no servidor. Com ENERGIA em 0, a sessão cai como REPROVADO 'a fotógrafa encerrou'. O banco estofado do camarim (interagível) recupera 20 uma vez por partida.

### LABIRINTO

- **gameplay** (G, +1,5): Não há labirinto nem decisão durante o andar. O percurso tem 2 pontos fixos na mesma sala e o resultado é calculado pelo servidor antes de a pessoa andar. Andar livre na preparação não tem objetivo. *Fazer:* Montar o percurso a partir dos nós de JARDIM_DOS_ESPELHOS: gerar a sala com 3 ou 4 corredores de sebe como caixas de colisão (areaDeAndar já aceita caixas) e ter 3 espelhos/portas como interagíveis. Inverter a ordem, de modo que ✕ diante de um espelho dispare a entrega daquele espelho (POST entrega) e a porta abra ou não ali mesmo. Assim o andar vira o lugar da decisão, e não um passeio depois do resultado.
- **sentido_e_objetivo** (M, +1,2): Continua sem derrota: o espelho cede na 4ª tentativa e a peça achada é dada pelo número da tentativa. *Fazer:* Tornar ENERGIA (o recurso-vida do perfil) o 'Reflexo': cada apresentação errada tira 15 de energia, gravada como uso negativo no Andamento. Com 0, a partida fecha em DERROTA. Remover achadas() e CEDE_NA e mostrar no HUD 'Reflexo: N' com a roda de recursos que já existe. Escrever um teste do núcleo com vitória e com derrota.
- **efeito_das_roupas** (P, +0,8): Os atributos mudam só a velocidade de andar e a nota. As ações destravadas (chips) não fazem nada no Labirinto. *Fazer:* Dar efeito no cenário a 2 ações destravadas: FURTIVIDADE alta (ou o chip ESCONDER) abre uma porta lateral de atalho, ou seja, remove uma caixa de colisão da área. A família de cor com 3 peças acende uma trilha no piso até o espelho certo (reaproveitar a TRILHA de sequences-color). É só cliente e não muda a nota.

### AROUND_THE_WORLD

- **sentido_e_objetivo** (M, +1,3): O cenário contradiz a etapa: Nova York, Paris, Tóquio, o elevador e o metrô aparecem todos na calçada do Rio. *Fazer:* Criar uma variante de sala por etapa (fábrica que recebe a paleta, a placa e o céu da região e reusa fachadaVitrine, poste e bancoRua, mudando cores, toldo e placaRegiao). Escolhê-la em salaDe(codigo, variante) pelo código da etapa que o servidor já devolve em abertura/percurso. Começar pelas 8 regiões só trocando materiais, céu e placa (pequeno) e depois pelo elevador e o metrô.
- **gameplay** (G, +1,3): O caminho é uma reta de 3 pontos, sem escolha, risco ou interação, e o resultado já está decidido antes. *Fazer:* Usar os nós de ORLA_DO_MIRANTE como interagíveis na calçada: banca (✕ compra ou troca peça gastando MOEDAS), ateliê do beco (dá uma carta) e vitrine do mirante. A entrega do look passa a acontecer ao apertar ✕ na vitrine. O percurso ganha um ramo opcional, por onde se vai até a banca ou não.
- **recursos** (M, +1): A ENERGIA só sobe (USAR carta) e nunca é gasta; MOEDAS não existem no jogo; CEDE_NA tira o risco. *Fazer:* Cada tentativa reprovada gasta 15 de ENERGIA e cada troca de peça numa etapa (trocas() já existe) gasta 1 moeda; energia 0 dá DERROTA. Trocar CEDE_NA por 'pagar 3 moedas para pular a região'. Escrever o teste no núcleo.

### CLUBE_CORACAO

- **efeito_das_roupas** (M, +1,4): O avatar não veste a camisa pintada: ela fica em faixas cilíndricas no manequim. Por isso a estreia mostra a personagem com a roupa antiga. *Fazer:* Passar 'zonas' ao NucleoAvatar e, na ação (estreia), trocar a peça SUP do avatar por uma Look3dPiece de camiseta com a cor da FRENTE e o material de ACABAMENTO_3D. Pintar mangas e gola com a cor das zonas, se o corpo humano já separa material por região; se não, aplicar só a cor dominante. É pequeno porque o avatar já aceita 'pecas'.
- **gameplay** (G, +1,3): A 'fase de uso' é andar 2 pontos dentro de um tablado de 1,9 m e apertar □. Não há lance, risco, tempo nem habilidade, e o andar na preparação fica preso ao tablado. *Fazer:* Na estreia, trocar o percurso ATELIE por um mini-lance: 3 cones no piso à frente da arquibancada, com o andar liberado na sala inteira durante a ação (areaDeAndar com a zona do piso). Um tempo de 10 s mostrado no HUD; chegar ao último cone e apertar □ no tempo faz a torcida comemorar, senão lamentar. A pontuação por tempo vai no acionamento validado no servidor (como o LANCE do Fighter, que já existe).
- **recursos** (M, +1,2): Não há recurso de jogo: a paleta é infinita, repintar é de graça e a roda de recursos fica vazia (sem cartas). O bônus do look não vale nas rodadas dos clubes. *Fazer:* Ter um orçamento de tinta (ex.: 8 latas) contado no servidor a partir das prévias/zonas repintadas, guardado no Andamento (sem migration), e mostrado na roda de recursos como ENERGIA. Acabamento metálico ou espelhado custa 2. Tinta zerada dá INCOMPLETO. Dar nota às rodadas dos clubes (50 por regra) para o bônus do look valer.

### FAVORITE_SINGER

- **gameplay** (G, +1,5): A fase de uso é um passeio de cerca de 0,5 m até o manequim seguido de uma pose. Não há show, ritmo, tempo nem erro possível, e a nota já está fechada antes da ação. *Fazer:* Dar ao Singer um percurso próprio no palco (3 a 4 marcas de luz no palcoPequeno em z≈-4, em vez de ATELIE) e um acionamento JOGADA em ACIONAMENTOS. A cada refrão (timer de 3 a 4 s), a cena pede uma família de cor e a pessoa precisa chegar à marca dessa cor e apertar □ dentro da janela. Acerto ou erro vai ao servidor como Flair3dJogadaDeCena (+10 por pedido certo, como nos jogos de deck). Isso dá risco e decisão sem IA paga.
- **recursos** (M, +1,2): Não há recurso para gastar. A paleta é infinita, o FOCO do perfil nunca muda (nenhum uso), então REGRA_RECURSO é sempre 0, e a roda de recursos, quando aparece, fica parada. *Fazer:* Criar um orçamento de tinta validado no servidor: 10 unidades, com fosco 1, brilhante 2 e metálico/espelhado 3. Entrega acima do orçamento vira REPROVADO, e a sobra vira o recurso FOCO que alimenta peloRecurso. Mostrar o orçamento na roda de recursos. Cobrar 1 'ensaio' por prévia (3 por partida). Na fase de show, usar FOCO como hype: cai com erro e, em 0, a cutscene de DERROTA começa mais cedo.
- **efeito_das_roupas** (M, +1,1): A peça pintada continua em cilindros no busto (PecaPintada) e o avatar nunca a veste. O efeito no jogo se resume à roda de atributos, à velocidade de andar e ao bônus na nota. *Fazer:* No momento ACAO, passar zonas e escolhas ao NucleoAvatar e pintar os materiais do corpo do avatar por zona (FRENTE/COSTAS → tronco, MANGAS → braços, GOLA → pescoço) com ACABAMENTO_3D. Já é um ganho grande o avatar sair do ateliê com as cores escolhidas, mesmo sem GLB novo. Ligar CARISMA à janela de acerto do show (mais carisma, janela maior).

### PILOTO_FAVORITO

- **gameplay** (G, +1,5): A fase de uso é andar cerca de 0,5 m e posar. Não há pista, volta, tempo nem adversário, e a nota já está decidida na entrega. *Fazer:* Criar uma 'volta de classificação' curta e pura: uma sala variante de pit lane (reta com 4 cones ou portões) onde a personagem passa pelos portões dentro de um tempo-alvo. A velocidade já vem da AGILIDADE (velocidadeDaAgilidade), e o tempo da volta vai ao servidor como acionamento (bônus por tempo). Reaproveitar Andarilho, as marcas do desfile e uma contagem regressiva no DesfileHud.
- **efeito_das_roupas** (M, +1,3): O capacete pintado não aparece. O suporte continua 'lacaAmarela' e o busto mostra faixas no tronco (BASE 0,93 a 1,5 m), não um capacete. *Fazer:* Ligar as escolhas de zona aos materiais do capaceteNoSuporte (casco = TOPO/LATERAIS, viseira = VISEIRA com ACABAMENTO_3D) em vez de 'lacaAmarela' fixo, por exemplo com override do material do móvel quando zonasDaPeca existir. Na ação, pôr o capacete pintado na cabeça do avatar (esfera ou GLB do capacete preso ao osso da cabeça) no gesto BAIXAR_A_VISEIRA.
- **recursos** (M, +1,1): ENERGIA é o recurso do perfil, mas nada a gasta nem a recarrega, então REGRA_RECURSO é sempre 0. *Fazer:* Criar o orçamento de tinta no servidor (como no Singer) e, na volta, combustível e pneus: ENERGIA cai por segundo e RESISTENCIA reduz o gasto. Acabar o combustível dispara a cutscene de DERROTA. Mostrar os dois medidores na roda de recursos.

### SUPER_HEROI

- **gameplay** (G, +1,6): Não há ação de herói. A fase de uso é andar cerca de 0,5 m e posar, sem inimigo, risco ou tempo. *Fazer:* Criar uma 'missão no terraço' curta: 3 alvos (drones como esferas emissivas) em pontos do terraço entre z -1 e -3.5. A personagem anda até cada um e aperta □ dentro de uma janela; FORCA aumenta a janela e AGILIDADE a velocidade. Os drones que escapam tiram VIDA. O resultado (alvos acertados) vai ao servidor como acionamento, com bônus. Reaproveitar Andarilho, as marcas do desfile e o DesfileHud com contagem.
- **efeito_das_roupas** (M, +1,4): O emblema não aparece, o avatar não veste o traje e a capa pendurada não usa a cor da zona CAPA. *Fazer:* (1) Desenhar o emblema escolhido (RESPOSTA) num plano com textura de canvas no peito do manequim e do avatar. (2) Trocar o material 'capa' pela cor e acabamento da zona CAPA quando houver escolha. (3) Na ação, pintar tronco, braços e pernas do avatar com as zonas. Os itens 1 e 2 são pequenos e visíveis na hora.
- **recursos** (M, +1,1): VIDA é o recurso do perfil, mas nada a gasta, então REGRA_RECURSO é sempre 0 e a roda de recursos não tem o que usar. *Fazer:* Criar o orçamento de tinta no ateliê (validado no servidor) e, na missão, VIDA e ENERGIA (o golpe □ gasta ENERGIA; acabamento metálico no PEITO reduz o dano). VIDA 0 dispara DERROTA. Mostrar os dois medidores na roda.
