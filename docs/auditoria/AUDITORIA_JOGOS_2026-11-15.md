# Auditoria dos jogos do FLAIR (15/11/2026)

> **Relatório parcial, atualizado às 13:36 UTC.** A auditoria ainda está em andamento; jogos sem seção ainda não foram jogados.

## 1. Como a auditoria foi feita

**Pedido da dona.** Jogar cada jogo do FLAIR até o fim ("zerar" cada conjunto: rodadas, níveis, modalidades, o caso
inteiro, cada desafio) e dar nota a cada um em dez dimensões: câmera, gameplay com cartas, fluidez da cena, recursos,
cartas do deck, lógica, enredo, estrutura da partida, salvamento e NPCs. A dona pediu ainda uma seção própria do
Dress Fighter (que ela chamou de "Fashion Fighter") com seis perguntas sobre combate, cartas, NPCs, barra de vida e
câmera.

**Quem auditou.** Um auditor que não escreveu nenhuma linha dos jogos. As notas valem pelo que funcionou na tela, não
pelo que os documentos ou os commits prometem. Onde o documento promete algo que não apareceu, isso está dito.

**Código auditado.** Ramo `claude/adoring-davinci-mufbri`, commit `e87e8f4e` ("Jogos: tema surpresa sem Brasil, dica
do Around the World, pontos por carta nas etapas, cor do cadastro nas cartas e no corpo 3D", 15/11/2026 19:19 UTC),
numa cópia de trabalho própria.

**Pilha própria, separada da principal.** Backend construído desse commit (`mvn -o -q -Djacoco.skip=true -DskipTests
package`) e ligado na porta 8099 com no máximo 1 GB de memória; frontend do mesmo commit com `next dev --webpack` na
porta 3005, apontado para esse backend. Banco: o MySQL 8.0 **local** da máquina (banco `fashionai`, pelo socket local),
o mesmo das auditorias anteriores, com as contas de demonstração; o Flyway não tinha migração nova a aplicar (V102 no
banco e no código). Armazenamento de mídia local. As variáveis `MYSQL_*`, `S3_*` e `AWS_*` que apontam para um servidor
externo foram tiradas de todos os processos; nenhum servidor externo foi acessado.

**Conta.** @lia.demo (fictícia), a única conta de demonstração com cartas FLAIR no banco local: 13 cartas, todas Bronze,
OVR 52 a 57. Nenhuma conta tem carta Especial, Prata ou Ouro, então nada que dependa desses níveis pôde ser jogado
(dito em cada jogo). As partidas jogadas ficaram nesse banco de teste.

**Ficou desligado.** IA paga e remota (`AI_REMOTE_ENABLED=false`, nenhuma chave de provedor). Nenhum código do
aplicativo foi alterado; nenhum dado de produção, conta real ou deploy.

**Navegador.** Chromium pelo Playwright, com renderização de software (SwiftShader), em 1440×900 e 390×844 (toque),
idioma pt-BR. Cada jogo foi jogado na tela, clicando como uma pessoa; as respostas do servidor de cada passo foram
lidas na rede do navegador para conferir a lógica.

**Limitação: não há placa de vídeo.** A máquina não tem GPU e divide 4 núcleos de CPU com outras três pilhas em uso.
A fluidez foi medida mesmo assim (quadros por segundo com `requestAnimationFrame` durante a jogada, quadros longos,
sequências de quadros a cada 100 ms para ver saltos, tempo até a cena jogável, e com a CPU 4× mais lenta), mas a nota
de fluidez é **provisória**: num aparelho com GPU o número será outro. Os quadros servem principalmente para comparar
os jogos entre si e para achar saltos e teletransportes, que não dependem da GPU.

**Escala das notas.** 0 a 10 por dimensão; "não se aplica" só quando o desenho do jogo não tem aquilo (com o motivo).
A nota final do jogo é a média simples das dimensões que se aplicam, com uma casa decimal. Severidade dos defeitos:
**bloqueia** (impede de terminar ou dá resultado errado), **atrapalha** (dá para seguir, mas engana ou cansa),
**detalhe**.

## 2. Resumo

Notas de 0 a 10. Dimensões: **Cam** câmera, **Car** gameplay com cartas, **Flu** fluidez (medido sem GPU,
provisório), **Rec** recursos, **Deck** cartas do deck, **Lóg** lógica, **Enr** enredo, **Est** estrutura da partida,
**Sal** salvamento, **NPC** NPCs. "n/a" = não se aplica (motivo na seção do jogo).

| Jogo | Cam | Car | Flu | Rec | Deck | Lóg | Enr | Est | Sal | NPC | Zerado? | Final |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Passarela | 5 | 4 | 1 | 5 | 6 | 6 | 3 | 5 | 5 | 2 | sim (5 de 5) | **4,2** |
| Dress Fighter | 4 | 2 | 2 | 4 | 4 | 5 | 3 | 4 | 6 | 3 | parcial (3 arenas jogadas; vitória impossível com as cartas da conta) | **3,7** |
| Dress the Star | 5 | 4 | 2 | 5 | 5 | 4 | 4 | 5 | 5 | 1 | sim (3 de 3) | **4,0** |
| Personagem de Filme | 4 | 4 | 1 | 5 | 5 | 6 | 5 | 4 | 5 | 1 | parcial (2 de 3) | **4,0** |

## 4. Jogo a jogo

Ordem: o Dress Fighter primeiro (a dona pediu uma auditoria própria dele), depois os outros na ordem da lista.

### 4.2 Dress Fighter (núcleo 2)

**O que joguei.** As três arenas até o resultado: Arena do bairro (oponente 40/40/40), Arena veloz (60/35/45, com
impulso sorteado) e Arena blindada (40/50/65, com impulso), com quatro decks diferentes e peças das seis famílias de cor
(vermelho, verde, amarelo/dourado, azul, preto e branco). Cinco lutas começadas, quatro levadas até o fim (uma em
390×844); uma foi interrompida de propósito com recarga da página no meio. Tempo de uma luta completa: 2 a 4 minutos.

**Zerado?** Parcial. As três arenas foram jogadas até o resultado, mas nenhuma pode ser vencida com as cartas da conta:
todas são Bronze (+5 em cada atributo) e nenhuma é de couro, jeans, lã ou metal, então o melhor look possível dá
velocidade 40, ataque 20 e defesa 20. No empate o round é do oponente. Resultado: Arena do bairro sempre 0 pontos (40 ×
40 no round 1 perde), Arena veloz sempre 0, Arena blindada no máximo 50 (só o round 1, e só quando o impulso sorteado é
positivo). A vitória e a animação de vitória nunca aparecem. Não há carta Especial em nenhuma conta, então a única ação
entre os rounds nunca pôde ser usada.

**Refeito no código atual (16/11, commit `b6d26431`).** Depois da troca de código (abertura e final por jogo,
"Continuar partida", pessoas de cena seguindo o diretor) voltei ao Dress Fighter: a tela abriu com **"Partida em
andamento · Arena blindada · Continuar partida / Começar outra partida"**, retomei a luta da véspera do ponto em que ela
parou (round 2 já jogado) e terminei com 50 pontos, igual ao que o servidor gravou. Agora a oponente anda até a avatar no
começo, faz gestos e **comemora com o braço erguido** quando a avatar cai no fim; enquanto os corpos carregam aparecem
uma cápsula branca e um boneco roxo no lugar das duas ([quadros](evidencias/jogos/df-11-continuar-partida.jpg),
[fim](evidencias/jogos/df-10-codigo-novo-round3-oponente-comemora.jpg)). O roteiro da luta continua montando a queda da
avatar sempre que o resultado não é VITORIA (`sequences-match.ts`, sem mudança nessa parte), então o defeito DF-1 segue
no código atual. As notas abaixo já contam o código atual: salvamento e NPCs subiram.

#### Dress Fighter: mecânica de combate e cartas

**1. Mecânicas de combate: não.** O que a pessoa faz de fato:

| Ação | Quem decide | Quando |
| --- | --- | --- |
| Escolher até 6 cartas para o deck (1 calçado obrigatório) | a pessoa | antes de entrar |
| Vestir uma carta por vaga (cima, baixo, calçado, acessório) | a pessoa | no preparo, antes de "Entregar o look" |
| Atacar, defender, esquivar, golpe especial, combo, tempo do golpe | ninguém: o servidor só compara números | — |
| Jogar a carta Especial (+20 + OVR/10 no round seguinte, uma por luta) | a pessoa | entre os rounds 1→2 e 2→3 |
| "Seguir sem acionar" | a pessoa | entre os rounds |

Dentro do round a pessoa não controla nada: o round é a comparação de um atributo (round 1 velocidade, round 2 ataque,
round 3 defesa). Entre os rounds só existe a carta Especial, que nenhuma conta tem; sem ela, o único botão é "Seguir
sem acionar". Isso segue a definição da dona ("o jogo realiza o ataque, você só escolhe as roupas"), mas, como jogo de
luta, não há mecânica de combate que a pessoa execute. Evidência: [round 2 quadro a quadro](evidencias/jogos/df-04-round2-oponente-parado.jpg).

**2. Efeito imediato das cartas: parcial.** No preparo, vestir uma carta muda na hora os atributos do canto de cima
(a prévia do servidor confere: 40/20/20 com quatro peças) e mostra o nome do efeito da cor ("Camiseta Vermelha: golpe
forte no ar") e um pulso de luz. Durante a luta nenhuma carta pode ser vestida nem trocada: as vagas ficam
desligadas. A cor não muda o resultado: a resposta do servidor de cada round só usa velocidade, ataque e defesa somados
(conferido nas respostas de `/entrega` e `/acionar`); os efeitos `COR_*` da lista de efeitos não entram na conta. O que
`CORES_E_ACOES.md` 2-A diz ("só efeito de cena, não muda a nota") continua verdade. Nenhuma carta muda o desfecho
durante a luta; a Especial mudaria um round, mas não pôde ser testada.

**3. Coerência carta → mecânica: não.**

| Peça (tipo, cor, nível) | O jogo diz | O que vi | Coerente? |
| --- | --- | --- | --- |
| Camiseta Vermelha (cima, vermelho, Bronze 52) | "velocidade +5" na carta; "golpe forte no ar" ao vestir | +5 em velocidade, ataque e defesa; nenhum efeito na luta | não: a carta só mostra velocidade, e o "golpe forte" não aparece no combate |
| Saia verde (baixo, verde) | "velocidade +5"; "passo de esquiva" | +5 em tudo; nenhuma esquiva na luta | não |
| Acessório dourado (acessório, amarelo) | "golpe rápido no ar" | +5 em tudo; a bolsa não aparece no corpo | parcial |
| Cinto azul / Calça azul / Camisa Hype Baixo (azul) | "fôlego: respiração funda" | +5 em tudo; pulso de luz | não há fôlego na luta |
| Bota preta (calçado, preto) | "velocidade +25"; "postura de guarda" | +25 em velocidade (a bota conta como tênis) | parcial |
| Tênis branco (calçado, branco) | "velocidade +25"; "foco: o ringue escurece" | +25 em velocidade; o neon muda | parcial |
| Vestido preto (peça inteira, preto) | aceito no deck | **some da mão na partida**: não pode ser vestido | não |
| Jaqueta Hype Alto (cima, azul-marinho) | "fôlego" | +5 em tudo | não |

A tabela de cores do documento (preto guarda, verde esquiva, amarelo golpe rápido, azul fôlego, vermelho golpe forte,
branco foco) aparece só como texto e gesto no preparo; na luta o golpe depende do atributo do round (velocidade = soco,
ataque = chute, defesa = golpe especial), não da cor.

**4. NPCs no combate.** A única NPC é a oponente (corpo humano, vestido roxo); não há juiz, plateia nem córner.

| Item | Resposta | O que vi |
| --- | --- | --- |
| Movimento de lutadora | parcial | no código de 15/11 ficava parada; no atual ela anda até a avatar no começo e gesticula, mas fica ao lado dela, de frente para a câmera, sem guarda de luta, sem circular nem recuar |
| Mecânica de combate | não | ela nunca ataca nem defende: o roteiro pede "guarda", "soco", "recuo" e "comemora", mas o corpo humano não toca nenhum desses movimentos (o próprio `ESTADO_DOS_JOGOS.md` admite que as sequências só animam as silhuetas antigas) |
| Furtividade/esquiva | não | nada |
| Reação | parcial | no código atual ela comemora (braço erguido) quando a avatar cai no fim; não reage ao round que perde |
| Dano | não | não há barra, número de dano, clarão nem recuo no contato; não existe contato |

Evidência: [round 2 quadro a quadro](evidencias/jogos/df-04-round2-oponente-parado.jpg) e [round 1 vencido](evidencias/jogos/df-03-round1-vencido-avatar-cai.jpg).

**5. Barra de vida: não existe.** Nem da oponente nem da avatar, em 1440×900 ou 390×844. O jogo usa, no lugar dela, a
linha de texto "Round 1, Velocidade: você 44 × oponente 40", os três atributos da pessoa no canto de cima (letra
pequena) e os da oponente numa linha de texto abaixo das cartas. Dá para saber quem ganhou o round pelo número, mas não
durante o round (o número aparece de uma vez) e nada na cena confirma: **a avatar cai no chão depois de todo round,
inclusive depois de vencer** (round 1 da Arena blindada, 44 × 40, `venceu: true`, e mesmo assim a avatar cai e a
oponente fica de pé). A causa está no roteiro da cena: ele monta o final "perdeu a luta" sempre que o resultado não é
VITORIA, e no meio da luta o resultado é `EM_ACAO`. [Quadros](evidencias/jogos/df-03-round1-vencido-avatar-cai.jpg).

**6. Câmera: parcial.** O seletor tem seis opções: Automática, Três quartos, Lateral, Giro de 360°, Aérea e Close na
roupa ([as seis](evidencias/jogos/df-06-seis-cameras.jpg)).

| Câmera | Tipo | Serve para a luta? |
| --- | --- | --- |
| Três quartos | retrato em diagonal, avatar no centro | mostra o look; a oponente fica na borda |
| Lateral | plano aberto em diagonal, as duas no quadro | é o mais perto de uma vista de luta, mas as duas olham para a câmera, não uma para a outra; não é a vista lateral 2D de arcade |
| Giro de 360° | órbita | em vários momentos fica a poucos centímetros do corpo (quadro só com o tronco) |
| Aérea | de cima | a roupa vira um ponto |
| Close na roupa | plano médio do look | bom para a roupa, perde a oponente |
| Automática | três quartos no preparo, diagonal na ação, órbita no resultado | troca no momento certo, mas na queda e na órbita final a lente entra no corpo e no piso e chegou a mostrar a saia de baixo para cima ([quadros 052 a 060](evidencias/jogos/df-05-camera-atravessa-no-fim.jpg)) |

Não há vista lateral 2D de arcade (as duas de perfil num plano, câmera correndo de lado, barras em cima) nem vista em
terceira pessoa por trás do ombro. Dá para trocar de câmera durante a luta pelo botão (cada toque passa para a próxima),
sem tecla nem controle. Não há corte no impacto, na Especial ou no fim do round; o único corte é para a órbita do
resultado. No celular o botão da câmera tem um fundo escuro grande que cobre as pernas da avatar no meio da cena
([390×844](evidencias/jogos/df-08-celular-390.jpg)).

**7. Combos: não.** Não há sequência de golpes que se encadeie: cada round é uma comparação isolada, sem bônus por
ordem de cartas, por cor, por rounds seguidos ou por tempo. A oponente também nunca encadeia golpes. O mais perto disso
é o "impulso" sorteado de cada round nas arenas 2 e 3 (−5 a +5), que a pessoa não controla e não perceberia como combo.

**O que falta para as respostas virarem "sim" (do ponto de vista de quem joga).**
1. Uma decisão dentro do round: escolher o golpe ou a defesa jogando uma carta da mão (como o Fashion Sports já faz),
   com a cor da carta virando a ação (preto guarda, verde esquiva, amarelo golpe rápido, vermelho golpe forte, azul
   fôlego, branco foco) e o poder da carta decidindo o duelo.
2. Carta mostrando os três atributos (não só velocidade) e o efeito da cor, na carta e no rótulo de leitura de tela.
3. Barra de vida das duas, com moldura e nome, que perde valor no contato, no mesmo número que o servidor devolve, e
   nocaute no zero.
4. Oponente que anda, gira para a avatar, ataca, defende, recua quando apanha e comemora ou cai no fim (os movimentos
   do roteiro tocados no corpo humano, não só nas silhuetas).
5. Corrigir o roteiro: a queda e a comemoração só no fim da luta, e de acordo com quem venceu cada round.
6. Uma vista lateral de luta de verdade (as duas de perfil, câmera acompanhando de lado), cortes no impacto, e a
   câmera nunca dentro do corpo nem do piso.
7. Combos: bônus por sequência de cores ou de rounds ganhos, com contador na tela.
8. Marcar a arena já vencida (a retomada já existe no código atual).
9. Recusar no deck a peça que o jogo não deixa vestir (peça inteira).
10. Equilíbrio: com cartas Bronze sem couro, jeans ou metal a luta não pode ser vencida em duas das três arenas, e o
    jogo não avisa isso antes de entrar.

#### Notas do Dress Fighter

| Dimensão | Nota | Por quê |
| --- | --- | --- |
| Câmera | 4 | seis câmeras e troca automática por momento; nenhuma vista de luta de verdade; lente dentro do corpo e do piso no fim; o botão cobre a cena no celular |
| Gameplay com cartas | 2 | as cartas só montam atributos antes da luta; dentro dela não há ação; a Especial não existe nas contas |
| Fluidez (medido sem GPU, provisório) | 2 | 2,2 quadros/s em 1440×900 e 1,8 a 2,3 em 390×844 durante os rounds (todos os quadros acima de 400 ms); a queda vai de pé a deitada entre dois quadros; cena jogável em 27 a 92 s depois de entrar |
| Recursos | 4 | atributos da pessoa e da oponente, histórico dos rounds, estrelas, câmera, zoom e giro; sem barra de vida nem placar de rounds; o contador "A ação 4 de 4" conta eventos, não rounds; no celular os cartões de texto cobrem a cena |
| Cartas do deck | 4 | regra do calçado clara, cor do cadastro certa na carta; a carta só mostra "velocidade" e nunca o nome da peça; peça inteira aceita no deck e ausente na mão |
| Lógica | 5 | o servidor é coerente e determinístico (refiz o sorteio do impulso fora do jogo e bateu); o texto do resultado bate com a resposta; mas a cena contradiz o resultado (quem vence cai) e duas arenas são impossíveis com as cartas da conta |
| Enredo | 3 | três arenas com uma frase cada; nenhuma progressão entre elas |
| Estrutura da partida | 4 | preparo, três rounds e resultado com frase de desfecho ("O oponente leva a luta..."); sem anúncio de round nem nocaute; o final de derrota toca depois de cada round |
| Salvamento | 6 | no código de 15/11 recarregar perdia a luta ([tela](evidencias/jogos/df-09-recarregar-perde-luta.jpg)); no atual "Continuar partida" retomou a luta do round em que parou, com o mesmo resultado no servidor; a arena já jogada ainda não fica marcada e a retomada mostra corpos provisórios e um 409 na prévia |
| NPCs | 3 | a oponente agora anda até a avatar, gesticula e comemora no fim; não ataca, não defende, não recua; não há juiz nem plateia |
| **Final** | **3,7** | média das dez |

**Defeitos.**

| # | Defeito | Como reproduzir | Severidade |
| --- | --- | --- | --- |
| DF-1 | A avatar cai no chão depois de todo round, inclusive do round que venceu | Arena blindada, look com 40 de velocidade; entregar; quando o impulso do round 1 é positivo (44 × 40, `venceu: true`) a avatar faz a guarda e cai | bloqueia (a cena diz o contrário do resultado) |
| DF-2 | A oponente não se mexe em nenhum round | qualquer luta; observar a oponente durante os três rounds | atrapalha |
| DF-3 | Duas arenas impossíveis com cartas Bronze sem couro, jeans, lã ou metal, sem aviso | @lia.demo, qualquer deck: Arena do bairro e Arena veloz sempre 0 | atrapalha |
| DF-4 | Peça inteira entra no deck mas não aparece na mão da partida | deck com "Vestido preto"; entrar: a mão tem 5 cartas | atrapalha |
| DF-5 | (corrigido no código atual) Recarregar a página no meio da luta perdia a luta; agora há "Continuar partida" | entregar o look, recarregar | — |
| DF-6 | A câmera do fim entra no corpo e no piso e mostra a saia de baixo | luta com saia; câmera Automática; fim do round 3 | atrapalha |
| DF-7 | No celular o botão de câmera cobre as pernas da avatar e os cartões de texto cobrem a esquerda da cena | 390×844, qualquer momento da partida | atrapalha |
| DF-8 | A carta do deck mostra só "velocidade +N"; ataque, defesa e a cor só aparecem ao vestir | tela do deck | detalhe |
| DF-9 | "A ação 2 de 2", "4 de 4": o contador conta eventos (impulso e round), não rounds | Arena veloz, depois do round 2 | detalhe |

### 4.1 A Passarela (núcleo 1)

**O que joguei.** As cinco rodadas até o resultado, com deck de 8 cartas: Tema surpresa (o tema sorteado foi
Monocromático), Treino Brasil, Treino Noite, Treino Monocromático e Treino Clássico. Cerca de 2,5 a 3 minutos por rodada.

**Zerado?** Sim, as cinco rodadas foram até o resultado. Pontos: Surpresa 86 (1º de 4), Brasil 0 (4º), Noite 0 (4º),
Monocromático 86 (1º), Clássico 0 (4º). Brasil, Noite e Clássico não têm como pontuar com as cartas da conta (nenhuma
peça tem marca brasileira, ocasião festa ou estilo clássico), e o jogo não avisa isso antes.

| Dimensão | Nota | Por quê |
| --- | --- | --- |
| Câmera | 5 | três quartos no preparo e vista do fim da passarela no resultado, seletor no HUD; com 0,2 quadro/s não deu para ver o travelling e a grua em movimento |
| Gameplay com cartas | 4 | a carta é a peça vestida; depois de entrar a carta mostra o efeito no tema ("+1 família azul"); não há ação de carta durante o desfile, e o contador "A ação 0 de 8" não leva a nada |
| Fluidez (sem GPU, provisório) | 1 | 0,3 quadro/s no preparo e 0,2 no desfile (2,4 a 4,4 s entre quadros): a sala mais pesada dos jogos; cena jogável 70 s depois de entrar ([quadros](evidencias/jogos/pas-01-desfile-0-2-qps.jpg)) |
| Recursos | 5 | painel do tema, efeito por carta, pontos por carta, estrelas, colocação na sala |
| Cartas do deck | 6 | tema escondido até travar o deck e revelado na carta; cor do cadastro certa; o vestido (peça inteira) aparece na mão |
| Lógica | 6 | servidor coerente (prévia 71 com 3 peças, final 86 com 4); mas o resultado mostra "40 pts + 20 pts" e o total "86" sem dizer que 60 de 70 vira 86 de 100 |
| Enredo | 3 | tema e três desfiles da casa com nota; nenhuma história |
| Estrutura da partida | 5 | preparo, desfile até a ponta, telão com a nota, legenda de reação e colocação |
| Salvamento | 5 | não testado nesta sala; a retomada "Continuar partida" do código atual foi conferida no Dress Fighter |
| NPCs | 2 | 12 pessoas sentadas e 2 fotógrafos, parados; a legenda diz "a plateia levanta" e a plateia continua sentada ([resultado](evidencias/jogos/pas-02-resultado-plateia-sentada.jpg)) |
| **Final** | **4,2** | |

**Defeitos.** PAS-1 (atrapalha): legenda "Flashes dos fotógrafos e a plateia levanta" com a plateia sentada — tema
Monocromático, entregar 4 peças azuis. PAS-2 (atrapalha): três temas impossíveis com cartas sem marca, festa ou clássico,
sem aviso no deck. PAS-3 (detalhe): soma das regras (60) diferente do total (86) sem explicação. PAS-4 (atrapalha):
0,2 quadro/s sem GPU — a sala pede um nível de detalhe menor para a plateia.

### 4.3 Dress the Star (núcleo 3)

**O que joguei.** As três rodadas até o resultado: Estrela Pop dos anos 2000 (0 pontos: nenhuma peça rosa, prata, y2k ou
glam), Modo Stylist (sorteou "Estrela do Rock dos anos 80", 25 pontos, 3 pistas abertas) e Look Relâmpago (o look-alvo
aparece e some; 50 pontos com 2 vagas iguais). Cerca de 1,5 a 2 minutos por rodada.

**Zerado?** Sim (as três rodadas até o resultado, nenhuma aprovada com as cartas da conta).

| Dimensão | Nota | Por quê |
| --- | --- | --- |
| Câmera | 5 | palco visto um pouco de baixo, a avatar posa; sem cortes durante a apresentação ([quadros](evidencias/jogos/dts-01-palco.jpg)) |
| Gameplay com cartas | 4 | só vestir; a carta diz "+25 figurino" ou "sem efeito aqui" conforme a estrela |
| Fluidez (sem GPU, provisório) | 2 | 0,7 quadro/s no preparo e 1,3 na apresentação; cena jogável 73 s depois de entrar |
| Recursos | 5 | perfil da estrela, pistas, aviso por vaga ("Essa parte da silhueta fica escura") |
| Cartas do deck | 5 | efeito certo por estrela; a carta não mostra o nome da peça |
| Lógica | 4 | pontos coerentes; o Look Relâmpago termina com a frase do perfil da estrela ("o perfil dela pedia outra coisa"), que não existe nessa rodada, e 50 pontos saem "Reprovado" sem dizer o mínimo |
| Enredo | 4 | arquétipos de estrela com pistas e época; o Stylist tem um mistério pequeno |
| Estrutura da partida | 5 | cartão de começo ("COMEÇO DA PARTIDA"), look-alvo por 10 s, desfecho em frase |
| Salvamento | 5 | igual ao Dress Fighter (não testado nesta sala) |
| NPCs | 1 | não vi plateia nem fotógrafos se mexendo no palco |
| **Final** | **4,0** | |

**Defeitos.** DTS-1 (atrapalha): frase de final errada no Look Relâmpago. DTS-2 (detalhe): sem nota mínima dita para
"Aprovado".

### 4.4 Personagem de Filme (núcleo 4)

**O que joguei.** Detetive noir até o resultado (título certo "Sombras na Chuva": 63 pontos, 50 do título e 12,5 da
bota preta), Cena sorteada até o resultado (sorteou a cena 4, do salão com flores; título errado: 13 pontos) e Adivinhe a
Década (pistas dos anos 80) só até o preparo: a página caiu por falta de memória da máquina duas vezes e a rodada ficou
aberta no servidor.

**Zerado?** Parcial (2 de 3).

| Dimensão | Nota | Por quê |
| --- | --- | --- |
| Câmera | 4 | três quartos; um refletor do cenário ocupa o terço esquerdo do quadro em todo o preparo ([quadro](evidencias/jogos/pf-01-set.jpg)) |
| Gameplay com cartas | 4 | vestir mais a resposta numa aba ("Resposta"); a carta mostra "+12,5 figurino" quando bate |
| Fluidez (sem GPU, provisório) | 1 | 6 quadros em 18 s gravados (cerca de 0,3 quadro/s) |
| Recursos | 5 | cena descrita, figurino pedido, aba de resposta, aviso "Escolha o título antes de entregar" |
| Cartas do deck | 5 | como nos outros; o vestido não aparece na mão (7 de 8 cartas) |
| Lógica | 6 | título 50 e 12,5 por peça, coerente com o servidor |
| Enredo | 5 | cenas curtas e boas de ler, gênero e figurino |
| Estrutura da partida | 4 | claquete e cena no começo; final em texto; nenhum momento de filmagem |
| Salvamento | 5 | as rodadas que caíram ficaram "abertas" no servidor e a tela oferece continuar |
| NPCs | 1 | set sem equipe nem elenco |
| **Final** | **4,0** | |

**Defeitos.** PF-1 (atrapalha): o vestido entra no deck e some da mão. PF-2 (detalhe): refletor tapa parte do quadro.
