# Jogos FLAIR fora do FLAIR 3D MAKE UP: fichas

Gerado por `python3 scripts/flair-modes/sheets.py` a partir de `fichas.json` (não edite à mão).
A planilha `modos-flair.xlsx` tem o mesmo conteúdo, com a miniatura da foto do cenário.

**Segmentos.** Todo jogo do FashionAI se chama FLAIR, em dois segmentos: FLAIR 3D MAKE UP (os 100 jogos de cenário e as aventuras 3D) e FLAIR Card Building Challenge (desafios de links entre cartas e as batalhas com elencos montados; ver docs/flair/cbc/FLAIR_CBC.md).

**Regra comum.** Todo jogo tem cenário fotográfico real e, a cada carta inserida, um efeito visual na cena: clarão, a luz do lugar acende sobre o objeto onde a carta entra, Aura Hype pela faixa da carta e, quando houver, Metamorfose ou Impersonation. Sem permissão Loft, o efeito é o comum; a Aura Hype aparece sempre.

**Faixas de Hype.** Faixas de Hype (as mesmas do FLAIR 3D MAKE UP): Sinal baixo 0–19 · Nicho 20–39 · Relevante 40–59 · Em alta 60–74 · Em tendência 75–89 · Viral 90–100.

| Código | Jogo | Segmento | Grupo | Participantes | Cartas mínimas | Hype mínimo |
| --- | --- | --- | --- | --- | --- | --- |
| DUEL | Duelo de Estilo 1×1 | FLAIR CBC | Partidas clássicas | 2 jogadores (1×1); contra outra pessoa ou contra a Casa. | Deck com 5 cartas FLAIR (uma carta destaque por rodada). | Média do deck ≥ Nicho (20). |
| TREINO | Treino com a Casa | FLAIR CBC | Partidas clássicas | 1 jogador contra a Casa (IA). | Deck com 5 cartas FLAIR. | Sem mínimo (Sinal baixo aceito): é treino. |
| ARENA | Batalha de Ocasião do dia | FLAIR CBC | Partidas clássicas | Todos os jogadores do dia (placar aberto); um deck por pessoa. | Deck com 5 cartas FLAIR, ao menos 2 com estilo ou cor do tema. | Média do deck ≥ Nicho (20). |
| TEAM | Equipes 3×3 e Liga | FLAIR CBC | Partidas clássicas | 2 equipes de 3 a 5 integrantes; 3 pares duelam. | 3 decks de 5 cartas (um por titular). | Cada deck ≥ Nicho (20) e média da equipe ≥ Relevante (40). |
| BATTLE | Battle of Looks | FLAIR CBC | Modos de look | 2 jogadores (look × look) ou contra a Casa. | 1 look com ao menos 3 peças (parte de cima, parte de baixo e calçado). | Hype do look ≥ Nicho (20). |
| SQUAD | FLAIR Squad | FLAIR CBC | Modos de look | 2 jogadores (5 looks × 5 looks). | 5 looks com ao menos 3 peças cada (15 cartas). | Cada look ≥ Nicho (20). |
| LEAGUE | Fashion League | FLAIR CBC | Modos de look | Liga com todos os jogadores da divisão; rodadas 1×1. | 5 looks titulares e 3 reservas (8 looks) e até 5 cartas especiais. | Média dos titulares ≥ Relevante (40). |
| TOUR | Fashion World Tour | FLAIR CBC | Modos de look | 1 jogador contra os desafios do tabuleiro. | 3 looks prontos (um por rolagem do dia), com ao menos 3 peças. | Hype do look ≥ Nicho (20); casas de gala pedem Relevante (40). |
| CONQUEST | FLAIR Conquest | FLAIR CBC | Modos de look | 2 jogadores (atacante × defensor). | 3 looks com ao menos 3 peças. | Atacar uma região dominada exige média ≥ Relevante (40). |
| DECK | Deck Battle | FLAIR CBC | Modos de look | 2 jogadores. | 12 cartas: 4 partes de cima, 3 de baixo, 2 calçados, 2 acessórios e 1 curinga. | Média do deck ≥ Nicho (20). |
| WARDROBE | Wardrobe Wars | FLAIR CBC | Modos de look | 2 jogadores (guarda-roupa × guarda-roupa). | 12 cartas FLAIR no guarda-roupa (o modo mede o conjunto). | Sem mínimo por carta; a rodada de comunidade usa a média de Hype. |
| RUNWAY | FLAIR Runway | FLAIR CBC | Modos de look | Até 8 looks na competição. | 1 look com ao menos 4 peças. | Hype do look ≥ Relevante (40). |
| DRAFT | FLAIR Draft | FLAIR CBC | Modos de look | 2 jogadores. | Nenhuma carta própria: todos escolhem do mesmo monte de 20 peças (9 escolhas por lado). | Sem mínimo: o monte é comum. |
| TAG_TEAM | FLAIR Tag Team | FLAIR CBC | Modos de look | 4 jogadores (2 duplas). | 1 look por pessoa com ao menos 3 peças. | Média da dupla ≥ Nicho (20). |
| BOSS | Fashion Boss | FLAIR CBC | Modos de look | 1 jogador contra o chefe (IA). | 1 look com ao menos 4 peças. | Cresce por chefe: Nicho (20) no primeiro até Em tendência (75) no último. |
| COMBO | Combo Battle | FLAIR CBC | Modos de look | 2 jogadores. | 1 look com ao menos 4 peças (para ativar combos). | Hype do look ≥ Nicho (20). |
| MONOPOLY | Fashion Monopoly | FLAIR CBC | Modos de look | 2 jogadores. | 3 looks com ao menos 3 peças. | Comprar uma boutique exige look ≥ Relevante (40). |
| CHESS | FLAIR Chess | FLAIR CBC | Modos de look | 2 jogadores. | 9 cartas (tabuleiro 3×3), com 1 HERO. | A carta HERO precisa de Hype ≥ Em alta (60). |
| ULTIMATE | FLAIR Ultimate Team | FLAIR CBC | Modos de look | 2 jogadores. | 7 looks titulares com ao menos 3 peças. | ICON ≥ Em tendência (75), TREND ≥ Em alta (60) e média ≥ Relevante (40). |
| CBC | Desafios de Montagem | FLAIR CBC | Montagem | 1 jogador. | As vagas obrigatórias do desafio (3 a 6 cartas). | Definido por desafio; padrão Nicho (20). |
| AFTERPARTY | Roubo ao Afterparty | fora do FashionAI | Metamorfose | 1 jogador. | 1 deck de 3 cartas para as transformações do avatar. | Hype do deck ≥ Relevante (40); exige nível Loft. |
| HEIST | Met Gala Heist | fora do FashionAI | Metamorfose | Em produção. | Em produção. | Em produção. |

## Duelo de Estilo 1×1 (DUEL)

- **Segmento:** FLAIR CBC. **Na lista:** na lista. **Foto:** passarela (foto pendente).
- **Cenário:** Passarela de desfile com plateia dos dois lados; cada jogador ocupa uma ponta.
- **Objetivo:** Vencer 3 das 5 rodadas de atributo (EDGE, RANGE, CLOUT, GLOW, ART) com a média do deck.
- **Participantes:** 2 jogadores (1×1); contra outra pessoa ou contra a Casa.
- **Cartas mínimas obrigatórias:** Deck com 5 cartas FLAIR (uma carta destaque por rodada).
- **Hype mínimo obrigatório:** Média do deck ≥ Nicho (20).
- **Efeito visual ao inserir uma carta:** A carta da rodada entra na ponta do jogador: holofote desce na passarela, clarão de flash da plateia e o cartão acende no piso espelhado.
- **Aura Hype:** Anéis e raios na cor da faixa da carta; quem vence a rodada sobe uma faixa de partida e a luz da sua metade da passarela fica mais forte.
- **Aura Metamorfose:** Com sinergia ou habilidade ativa, a carta se transforma no palco: varredura de cor, brilhos e um circuito de luz liga as cartas do mesmo lado.
- **Aura Impersonation:** Os avatares dos dois jogadores trocam de roupa a cada rodada com rajada de flashes, giro e silhueta de aura; a variação da roupa muda o humor e a expressão do avatar.
- **Hoje → depois:** Hoje mostra as rodadas em texto; passa a ter o palco fotográfico, os avatares e o deck mínimo validado.

## Treino com a Casa (TREINO)

- **Segmento:** FLAIR CBC. **Na lista:** na lista. **Foto:** estudio-foto.
- **Cenário:** Estúdio fotográfico com fundo infinito, softboxes e tochas.
- **Objetivo:** Testar um deck contra a Casa nas 5 rodadas de atributo sem risco no ranking.
- **Participantes:** 1 jogador contra a Casa (IA).
- **Cartas mínimas obrigatórias:** Deck com 5 cartas FLAIR.
- **Hype mínimo obrigatório:** Sem mínimo (Sinal baixo aceito): é treino.
- **Efeito visual ao inserir uma carta:** A tocha do estúdio dispara sobre o fundo infinito e a carta aparece no centro como numa sessão de fotos.
- **Aura Hype:** A faixa da carta acende anéis em volta do softbox; mostra ao jogador quanto a faixa pesaria numa partida real.
- **Aura Metamorfose:** Prévia da Metamorfose: o fundo muda de cor no tom da sinergia por uma rodada.
- **Aura Impersonation:** Só o avatar do jogador troca de roupa (a Casa usa um manequim), com flash de estúdio e pose de ensaio.
- **Hoje → depois:** Hoje usa o mesmo painel do duelo; passa a ter o estúdio como cenário próprio.

## Batalha de Ocasião do dia (ARENA)

- **Segmento:** FLAIR CBC. **Na lista:** na lista. **Foto:** tapete-vermelho (foto pendente).
- **Cenário:** Tapete vermelho de estreia com parede de imprensa; o tema do dia muda a decoração.
- **Objetivo:** Inscrever um deck no tema do dia e subir no placar diário de todos os jogadores.
- **Participantes:** Todos os jogadores do dia (placar aberto); um deck por pessoa.
- **Cartas mínimas obrigatórias:** Deck com 5 cartas FLAIR, ao menos 2 com estilo ou cor do tema.
- **Hype mínimo obrigatório:** Média do deck ≥ Nicho (20).
- **Efeito visual ao inserir uma carta:** Cada carta entra caminhando no tapete: flashes da imprensa estouram em sequência e a carta para em frente à parede de imprensa.
- **Aura Hype:** A faixa da carta define quantos flashes disparam; a posição no placar acende os holofotes do tapete.
- **Aura Metamorfose:** Carta casada com o tema transforma a parede de imprensa na cor do tema e libera bônus de nota.
- **Aura Impersonation:** O avatar do jogador desfila no tapete vestindo o look inscrito, com pose para a imprensa.
- **Hoje → depois:** Hoje é um placar em lista; passa a ter o tapete vermelho com a inscrição como evento visual.

## Equipes 3×3 e Liga (TEAM)

- **Segmento:** FLAIR CBC. **Na lista:** na lista. **Foto:** backstage (foto pendente).
- **Cenário:** Backstage de desfile com dois corredores de araras e espelhos, um por equipe.
- **Objetivo:** Vencer 2 dos 3 duelos entre os pares das equipes e somar pontos na liga semanal.
- **Participantes:** 2 equipes de 3 a 5 integrantes; 3 pares duelam.
- **Cartas mínimas obrigatórias:** 3 decks de 5 cartas (um por titular).
- **Hype mínimo obrigatório:** Cada deck ≥ Nicho (20) e média da equipe ≥ Relevante (40).
- **Efeito visual ao inserir uma carta:** A carta do par entra na arara da sua equipe: luz de camarim acende no espelho e a carta é pendurada com um clarão.
- **Aura Hype:** A faixa de cada carta aquece a luz da arara da equipe; a equipe à frente no placar ganha contorno de luz na sua cor.
- **Aura Metamorfose:** Sinergia entre cartas da mesma equipe liga as araras por um fio de luz que pulsa.
- **Aura Impersonation:** Impersonation de time: corrente de flash que salta do jogador do duelo para cada colega na cor da equipe, pose de formação sincronizada e desfile do time no par decisivo.
- **Hoje → depois:** Hoje é um diálogo com o resultado em texto; passa a ter o backstage com os avatares das equipes.

## Battle of Looks (BATTLE)

- **Segmento:** FLAIR CBC. **Na lista:** na lista. **Foto:** boate.
- **Cenário:** Boate com pista, bar iluminado e lustres; o tema sorteado muda a luz da pista.
- **Objetivo:** Vencer um look contra outro num tema sorteado que muda os pesos dos 10 atributos.
- **Participantes:** 2 jogadores (look × look) ou contra a Casa.
- **Cartas mínimas obrigatórias:** 1 look com ao menos 3 peças (parte de cima, parte de baixo e calçado).
- **Hype mínimo obrigatório:** Hype do look ≥ Nicho (20).
- **Efeito visual ao inserir uma carta:** Cada peça do look entra na pista com um canhão de luz e o globo espalha reflexos sobre a carta.
- **Aura Hype:** A faixa do look controla a intensidade dos canhões e dos anéis na pista.
- **Aura Metamorfose:** Look casado com o tema transforma a pista inteira na cor do tema.
- **Aura Impersonation:** Os avatares entram na pista vestindo os looks, com troca de roupa a cada atributo decisivo.
- **Hoje → depois:** Hoje mostra o resultado em painel; passa a ter a boate como palco.

## FLAIR Squad (SQUAD)

- **Segmento:** FLAIR CBC. **Na lista:** na lista. **Foto:** restaurante.
- **Cenário:** Cinco ambientes em sequência, um por situação: restaurante (Date Night), redação (Business Meeting), festival, praia (Beach Club) e tapete vermelho.
- **Objetivo:** Vencer 3 das 5 situações com 5 looks diferentes: diversidade vence especialização.
- **Participantes:** 2 jogadores (5 looks × 5 looks).
- **Cartas mínimas obrigatórias:** 5 looks com ao menos 3 peças cada (15 cartas).
- **Hype mínimo obrigatório:** Cada look ≥ Nicho (20).
- **Efeito visual ao inserir uma carta:** A cada situação o cenário troca de foto e o look entra no objeto da cena (mesa, mesa de reunião, palco, deck da praia, tapete).
- **Aura Hype:** A faixa do look acende a luz própria de cada ambiente (velas, luminárias, palco, sol, flashes).
- **Aura Metamorfose:** Looks bem diferentes entre si ganham bônus de diversidade: a cena guarda um rastro de cor de cada situação vencida.
- **Aura Impersonation:** O avatar troca de roupa a cada situação, com humor que muda pela adequação do look ao lugar.
- **Hoje → depois:** Hoje é texto por rodada; passa a ter os cinco ambientes fotográficos.

## Fashion League (LEAGUE)

- **Segmento:** FLAIR CBC. **Na lista:** na lista. **Foto:** palco-show.
- **Cenário:** Palco de show com telão e plateia: cada rodada da liga é uma apresentação.
- **Objetivo:** Somar pontos na temporada (vitória 3, empate 1) e subir de divisão até FLAIR Elite.
- **Participantes:** Liga com todos os jogadores da divisão; rodadas 1×1.
- **Cartas mínimas obrigatórias:** 5 looks titulares e 3 reservas (8 looks) e até 5 cartas especiais.
- **Hype mínimo obrigatório:** Média dos titulares ≥ Relevante (40).
- **Efeito visual ao inserir uma carta:** O titular entra no palco com canhões de luz e o telão mostra a carta.
- **Aura Hype:** A faixa do titular define quantos canhões acendem; a divisão muda a cor do telão.
- **Aura Metamorfose:** Carta especial ativada transforma o telão e o palco na cor da sinergia.
- **Aura Impersonation:** O avatar do jogador entra como capitão do elenco e troca de roupa a cada titular escalado.
- **Hoje → depois:** Hoje é tabela e escalação; passa a ter o palco da rodada.

## Fashion World Tour (TOUR)

- **Segmento:** FLAIR CBC. **Na lista:** na lista. **Foto:** aeroporto.
- **Cenário:** Tabuleiro Paris → São Paulo: a casa sorteada abre a foto da cidade (aeroporto, rua neon, cidade histórica).
- **Objetivo:** Rolar o dado, cair numa casa de evento e cumprir o desafio com um look.
- **Participantes:** 1 jogador contra os desafios do tabuleiro.
- **Cartas mínimas obrigatórias:** 3 looks prontos (um por rolagem do dia), com ao menos 3 peças.
- **Hype mínimo obrigatório:** Hype do look ≥ Nicho (20); casas de gala pedem Relevante (40).
- **Efeito visual ao inserir uma carta:** O look embarca no painel de partidas do aeroporto e reaparece na foto da cidade com o letreiro acendendo.
- **Aura Hype:** A faixa do look acende os letreiros da cidade e define o bônus da casa.
- **Aura Metamorfose:** Look casado com o estilo da cidade transforma a foto na paleta local.
- **Aura Impersonation:** O avatar viaja vestindo o look e muda de roupa ao chegar em cada cidade.
- **Hoje → depois:** Hoje é um tabuleiro em lista; passa a abrir a foto de cada cidade.

## FLAIR Conquest (CONQUEST)

- **Segmento:** FLAIR CBC. **Na lista:** na lista. **Foto:** torre-vidro.
- **Cenário:** Torre de vidro com vista da cidade: cada região de estilo é um andar iluminado.
- **Objetivo:** Conquistar regiões de estilo vencendo 2 de 3 confrontos como atacante ou defensor.
- **Participantes:** 2 jogadores (atacante × defensor).
- **Cartas mínimas obrigatórias:** 3 looks com ao menos 3 peças.
- **Hype mínimo obrigatório:** Atacar uma região dominada exige média ≥ Relevante (40).
- **Efeito visual ao inserir uma carta:** O look sobe pelo elevador de vidro e acende o andar da região disputada.
- **Aura Hype:** A faixa do look define a altura da luz no andar; região conquistada fica com a cor do dono.
- **Aura Metamorfose:** Look do estilo da região transforma a fachada inteira na cor do estilo.
- **Aura Impersonation:** Os avatares do atacante e do defensor se encaram no andar e trocam de roupa a cada confronto.
- **Hoje → depois:** Hoje é mapa em texto; passa a ter a torre como cenário.

## Deck Battle (DECK)

- **Segmento:** FLAIR CBC. **Na lista:** na lista. **Foto:** showroom.
- **Cenário:** Showroom de marca com araras e balcões: a mão de cartas vira o look montado no balcão.
- **Objetivo:** Receber 7 das 12 cartas do deck e montar o melhor look para o desafio.
- **Participantes:** 2 jogadores.
- **Cartas mínimas obrigatórias:** 12 cartas: 4 partes de cima, 3 de baixo, 2 calçados, 2 acessórios e 1 curinga.
- **Hype mínimo obrigatório:** Média do deck ≥ Nicho (20).
- **Efeito visual ao inserir uma carta:** A carta escolhida sai da arara e pousa no balcão com um feixe de luz de vitrine.
- **Aura Hype:** A faixa da carta define a força do feixe e os anéis no balcão.
- **Aura Metamorfose:** O curinga em sinergia transforma o balcão inteiro e completa o look com brilho.
- **Aura Impersonation:** O avatar veste as cartas à medida que entram no balcão.
- **Hoje → depois:** Hoje é painel de cartas; passa a ter o showroom.

## Wardrobe Wars (WARDROBE)

- **Segmento:** FLAIR CBC. **Na lista:** na lista. **Foto:** closet-luxo.
- **Cenário:** Closet de luxo com nichos iluminados, um lado para cada guarda-roupa.
- **Objetivo:** Vencer 4 das 7 rodadas: qualidade, diversidade, versatilidade, originalidade, coleção, sustentabilidade e comunidade.
- **Participantes:** 2 jogadores (guarda-roupa × guarda-roupa).
- **Cartas mínimas obrigatórias:** 12 cartas FLAIR no guarda-roupa (o modo mede o conjunto).
- **Hype mínimo obrigatório:** Sem mínimo por carta; a rodada de comunidade usa a média de Hype.
- **Efeito visual ao inserir uma carta:** A cada rodada a peça destaque acende o nicho do closet com luz quente.
- **Aura Hype:** A faixa da peça destaque define quantos nichos acendem na prateleira.
- **Aura Metamorfose:** Guarda-roupa diverso transforma as prateleiras num degradê de cores.
- **Aura Impersonation:** O avatar troca de roupa usando a peça destaque de cada rodada.
- **Hoje → depois:** Hoje é texto por rodada; passa a ter o closet.

## FLAIR Runway (RUNWAY)

- **Segmento:** FLAIR CBC. **Na lista:** na lista. **Foto:** passarela (foto pendente).
- **Cenário:** Passarela de desfile com júri e imprensa nas laterais.
- **Objetivo:** Passar da qualificação à final com o look mais bem avaliado (40% IA, 30% tema, 20% comunidade, 10% originalidade).
- **Participantes:** Até 8 looks na competição.
- **Cartas mínimas obrigatórias:** 1 look com ao menos 4 peças.
- **Hype mínimo obrigatório:** Hype do look ≥ Relevante (40).
- **Efeito visual ao inserir uma carta:** O look entra na passarela com sequência de flashes e holofote que acompanha o passo.
- **Aura Hype:** A faixa do look define a intensidade dos flashes e o rastro de luz na passarela.
- **Aura Metamorfose:** Look casado com o tema transforma o piso da passarela na cor do tema.
- **Aura Impersonation:** O avatar desfila com o look, troca de roupa entre as fases e faz pose final no fim da passarela.
- **Hoje → depois:** Hoje são fases em texto; passa a ter a passarela com o desfile.

## FLAIR Draft (DRAFT)

- **Segmento:** FLAIR CBC. **Na lista:** na lista. **Foto:** showroom.
- **Cenário:** Showroom com 20 peças expostas no meio, dois lados escolhendo em turnos.
- **Objetivo:** Escolher peças em turnos de um monte comum de 20 e vencer 2 de 3 looks.
- **Participantes:** 2 jogadores.
- **Cartas mínimas obrigatórias:** Nenhuma carta própria: todos escolhem do mesmo monte de 20 peças (9 escolhas por lado).
- **Hype mínimo obrigatório:** Sem mínimo: o monte é comum.
- **Efeito visual ao inserir uma carta:** A peça escolhida sai do expositor central e voa para o lado de quem escolheu, com clarão.
- **Aura Hype:** A faixa da peça escolhida acende o expositor do lado do jogador.
- **Aura Metamorfose:** Três peças em sinergia no mesmo look transformam o expositor daquele lado.
- **Aura Impersonation:** O avatar veste cada peça draftada na hora.
- **Hoje → depois:** Hoje é lista de escolhas; passa a ter o showroom com o monte visível.

## FLAIR Tag Team (TAG_TEAM)

- **Segmento:** FLAIR CBC. **Na lista:** na lista. **Foto:** camarote.
- **Cenário:** Camarote de festa com duas mesas, uma por dupla.
- **Objetivo:** Vencer com a dupla somando os looks e o Team Harmony entre eles.
- **Participantes:** 4 jogadores (2 duplas).
- **Cartas mínimas obrigatórias:** 1 look por pessoa com ao menos 3 peças.
- **Hype mínimo obrigatório:** Média da dupla ≥ Nicho (20).
- **Efeito visual ao inserir uma carta:** O look de cada pessoa entra na mesa da dupla com luz de vela e reflexo nas taças.
- **Aura Hype:** A faixa de cada look aquece a luz da mesa; harmonia alta liga as duas cartas com luz.
- **Aura Metamorfose:** Team Harmony alto transforma a mesa da dupla na cor comum dos looks.
- **Aura Impersonation:** Impersonation de dupla: os dois avatares trocam de roupa juntos com flash espelhado.
- **Hoje → depois:** Hoje é resultado em painel; passa a ter o camarote.

## Fashion Boss (BOSS)

- **Segmento:** FLAIR CBC. **Na lista:** na lista. **Foto:** salao-gala.
- **Cenário:** Salão de gala com lustres; cada chefe ocupa o fundo do salão.
- **Objetivo:** Vencer os chefes da IA (The Minimalist, Street King, Luxury Queen, Color Master, Vintage Collector, Avant-Garde AI), cada um com uma regra de moda.
- **Participantes:** 1 jogador contra o chefe (IA).
- **Cartas mínimas obrigatórias:** 1 look com ao menos 4 peças.
- **Hype mínimo obrigatório:** Cresce por chefe: Nicho (20) no primeiro até Em tendência (75) no último.
- **Efeito visual ao inserir uma carta:** O look entra pela escadaria do salão e os lustres acendem sobre a carta.
- **Aura Hype:** A faixa do look define quantos lustres acendem; contra chefes difíceis a luz precisa vencer a do chefe.
- **Aura Metamorfose:** Look que cumpre a regra do chefe transforma o salão na paleta da regra.
- **Aura Impersonation:** O avatar encara o chefe e troca de roupa a cada rodada, com humor que muda pela regra cumprida.
- **Hoje → depois:** Hoje é resultado em painel; passa a ter o salão de gala.

## Combo Battle (COMBO)

- **Segmento:** FLAIR CBC. **Na lista:** na lista. **Foto:** estudio-foto.
- **Cenário:** Estúdio fotográfico onde cada combo ativa uma luz diferente.
- **Objetivo:** Vencer ativando sinergias entre peças (Streetwear, Classic Formal, Monochrome, Brand Loyalty, Mix & Match, Vintage Revival).
- **Participantes:** 2 jogadores.
- **Cartas mínimas obrigatórias:** 1 look com ao menos 4 peças (para ativar combos).
- **Hype mínimo obrigatório:** Hype do look ≥ Nicho (20).
- **Efeito visual ao inserir uma carta:** Cada peça entra com o disparo de uma tocha; peças em combo disparam juntas.
- **Aura Hype:** A faixa de cada peça define a potência da tocha.
- **Aura Metamorfose:** É o centro do modo: cada combo ativado é uma Metamorfose visível, com o fundo do estúdio na cor do combo.
- **Aura Impersonation:** O avatar posa no estúdio e troca de roupa a cada combo ativado.
- **Hoje → depois:** Hoje é lista de combos; passa a ter o estúdio.

## Fashion Monopoly (MONOPOLY)

- **Segmento:** FLAIR CBC. **Na lista:** na lista. **Foto:** rua-neon.
- **Cenário:** Rua de compras com letreiros de neon: cada distrito é um quarteirão.
- **Objetivo:** Conquistar distritos e boutiques; o dono recebe bônus com cartas do estilo do território.
- **Participantes:** 2 jogadores.
- **Cartas mínimas obrigatórias:** 3 looks com ao menos 3 peças.
- **Hype mínimo obrigatório:** Comprar uma boutique exige look ≥ Relevante (40).
- **Efeito visual ao inserir uma carta:** O look entra na vitrine da boutique disputada e o letreiro de neon acende.
- **Aura Hype:** A faixa do look define a cor e o brilho do neon do distrito.
- **Aura Metamorfose:** Look do estilo do território transforma todos os letreiros do quarteirão.
- **Aura Impersonation:** O avatar passeia pela rua e troca de roupa em cada boutique conquistada.
- **Hoje → depois:** Hoje é tabuleiro em texto; passa a ter a rua de neon.

## FLAIR Chess (CHESS)

- **Segmento:** FLAIR CBC. **Na lista:** na lista. **Foto:** galeria-arte.
- **Cenário:** Galeria de arte: o tabuleiro 3×3 fica nas paredes, cada quadro uma casa.
- **Objetivo:** Vencer pela posição: cartas vizinhas se influenciam, HERO vale ×1,25 e SUPPORT reforça as vizinhas.
- **Participantes:** 2 jogadores.
- **Cartas mínimas obrigatórias:** 9 cartas (tabuleiro 3×3), com 1 HERO.
- **Hype mínimo obrigatório:** A carta HERO precisa de Hype ≥ Em alta (60).
- **Efeito visual ao inserir uma carta:** A carta entra no quadro da casa escolhida e o trilho de luz da galeria acende sobre ela.
- **Aura Hype:** A faixa da carta define o foco do trilho; vizinhas reforçadas ganham luz também.
- **Aura Metamorfose:** SUPPORT em sinergia liga as casas vizinhas com fio de luz pela parede.
- **Aura Impersonation:** O avatar caminha pela galeria e troca de roupa ao posicionar o HERO.
- **Hoje → depois:** Hoje é tabuleiro em grade; passa a ter a galeria.

## FLAIR Ultimate Team (ULTIMATE)

- **Segmento:** FLAIR CBC. **Na lista:** na lista. **Foto:** auditorio.
- **Cenário:** Auditório de teatro: os 7 titulares ocupam os camarotes iluminados.
- **Objetivo:** Vencer com 7 looks em funções (ICON, TREND, SOCIAL, CREATIVE, CLASSIC, WILD CARD, SPECIAL) somando Team Rating, Chemistry e Diversity.
- **Participantes:** 2 jogadores.
- **Cartas mínimas obrigatórias:** 7 looks titulares com ao menos 3 peças.
- **Hype mínimo obrigatório:** ICON ≥ Em tendência (75), TREND ≥ Em alta (60) e média ≥ Relevante (40).
- **Efeito visual ao inserir uma carta:** Cada titular acende o seu camarote e o palco projeta a função da carta.
- **Aura Hype:** A faixa de cada titular define a luz do camarote; Chemistry alto liga camarotes vizinhos.
- **Aura Metamorfose:** WILD CARD em sinergia transforma a cortina do palco na cor do time.
- **Aura Impersonation:** O avatar do jogador sobe ao palco e troca de roupa a cada função revelada.
- **Hoje → depois:** Hoje é escalação em lista; passa a ter o auditório.

## Desafios de Montagem (CBC)

- **Segmento:** FLAIR CBC. **Na lista:** na lista. **Foto:** showroom.
- **Cenário:** Foto de ambiente por desafio (como no FLAIR 3D MAKE UP): cada vaga do mini mapa fica sobre um objeto real da foto.
- **Objetivo:** Completar o mini mapa do desafio com cartas FLAIR; posição certa, vizinhança e tema dão sintonia.
- **Participantes:** 1 jogador.
- **Cartas mínimas obrigatórias:** As vagas obrigatórias do desafio (3 a 6 cartas).
- **Hype mínimo obrigatório:** Definido por desafio; padrão Nicho (20).
- **Efeito visual ao inserir uma carta:** Mesma inserção do FLAIR 3D MAKE UP: clarão, a luz do lugar acende sobre o objeto, a foto reacende e a legenda conta o efeito.
- **Aura Hype:** Anéis, raios e partículas pela faixa de partida da carta, na escala do objeto da foto.
- **Aura Metamorfose:** Varredura de cor, brilhos e circuito de luz entre cartas vizinhas em harmonia.
- **Aura Impersonation:** A peça aparece no lugar real da foto (de pé, pendurada, exposta ou refletida no espelho).
- **Hoje → depois:** Hoje usa o mapa desenhado; passa a usar foto real com a mesma inserção do FLAIR 3D MAKE UP.

## Roubo ao Afterparty (AFTERPARTY)

- **Segmento:** fora do FashionAI. **Na lista:** fora da lista; código mantido para o futuro jogo de PlayStation Glass Empire (fora do escopo do FashionAI). **Foto:** rooftop (foto pendente).
- **Cenário:** Rooftop de festa em 3D ao anoitecer, com bar, pista e área VIP.
- **Objetivo:** Explorar o rooftop, transformar o avatar com looks e recuperar o item VIP sem ser notado.
- **Participantes:** 1 jogador.
- **Cartas mínimas obrigatórias:** 1 deck de 3 cartas para as transformações do avatar.
- **Hype mínimo obrigatório:** Hype do deck ≥ Relevante (40); exige nível Loft.
- **Efeito visual ao inserir uma carta:** Ao ativar uma carta, um clarão envolve o avatar e a luz do salão muda na cor da carta.
- **Aura Hype:** A faixa da carta define carisma e furtividade, mostrados como halo em volta do avatar.
- **Aura Metamorfose:** As cartas mudam o avatar e o salão: atributos sobem ou descem com efeito de transformação.
- **Aura Impersonation:** O avatar assume o look da carta para se misturar aos convidados, com troca completa de roupa.
- **Hoje → depois:** Retirado da lista de jogos FLAIR (é furtividade, contra a direção do FLAIR 3D MAKE UP); a rota e o código ficam para o futuro Glass Empire.

## Met Gala Heist (HEIST)

- **Segmento:** fora do FashionAI. **Na lista:** fora da lista; código mantido para o futuro jogo de PlayStation Glass Empire (fora do escopo do FashionAI). **Foto:** sem foto (fora da lista).
- **Cenário:** Cenário 3D próprio em produção; não é alterado nem usado como imagem de outros jogos.
- **Objetivo:** Em produção para o novo FLAIR 3D MAKE UP.
- **Participantes:** Em produção.
- **Cartas mínimas obrigatórias:** Em produção.
- **Hype mínimo obrigatório:** Em produção.
- **Efeito visual ao inserir uma carta:** Em produção.
- **Aura Hype:** Em produção.
- **Aura Metamorfose:** Em produção.
- **Aura Impersonation:** Em produção.
- **Hoje → depois:** Removido da lista de opções por pedido do usuário; código mantido sem mudanças.
