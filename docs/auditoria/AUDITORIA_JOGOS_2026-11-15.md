# Auditoria dos jogos do FLAIR (15/11/2026)

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
sequências de quadros gravadas como o navegador as pinta (pedidas a cada 100 ms, mas sem GPU os quadros saíram de 0,4 a 4 s um do outro), tempo até a cena jogável; a medida com a CPU 4× mais lenta não foi feita, ver seção 5), mas a nota
de fluidez é **provisória**: num aparelho com GPU o número será outro. Os quadros servem principalmente para comparar
os jogos entre si e para achar saltos e teletransportes, que não dependem da GPU.

**Escala das notas.** 0 a 10 por dimensão; "não se aplica" só quando o desenho do jogo não tem aquilo (com o motivo).
A nota final do jogo é a média simples das dimensões que se aplicam, com uma casa decimal. Severidade dos defeitos:
**bloqueia** (impede de terminar ou dá resultado errado), **atrapalha** (dá para seguir, mas engana ou cansa),
**detalhe**.

**Duas sessões e troca de código.** A primeira sessão (15/11, 19:23 a 20:30 UTC) jogou o commit `e87e8f4e`. A máquina foi
reiniciada e a segunda sessão (16/11, a partir de 12:52 UTC) reconstruiu backend e frontend no commit `b6d26431`, que
trouxe "Continuar partida", abertura e final por jogo e reação das pessoas de cena; o Flyway aplicou a V103 só no banco
local. Onde a nota mudou com o código novo, a seção do jogo diz. O Dress Fighter foi jogado nos dois códigos.

**Falta de memória.** A máquina tem 16 GB divididos com três outras pilhas (servidores Next de 2,5 a 4 GB cada, testes
Maven). O sistema matou por falta de memória o renderizador do navegador da auditoria mais de dez vezes, o servidor
Next da auditoria duas vezes e, uma vez, o backend da auditoria foi desligado por fora. Cada queda custou a partida em
curso e um novo login. Por isso nem todos os jogos foram jogados: o que ficou de fora está na seção 5, com o motivo.

## 2. Resumo

Notas de 0 a 10. Dimensões: **Cam** câmera, **Car** gameplay com cartas, **Flu** fluidez (medido sem GPU,
provisório), **Rec** recursos, **Deck** cartas do deck, **Lóg** lógica, **Enr** enredo, **Est** estrutura da partida,
**Sal** salvamento, **NPC** NPCs. "n/a" = não se aplica (motivo na seção do jogo). Dez dos quinze jogos do FLAIR 3D
receberam nota; os outros cinco, o MAKE UP, os desafios e elencos do CBC e os modos clássicos ficaram de fora (seção 5).

| Jogo | Cam | Car | Flu | Rec | Deck | Lóg | Enr | Est | Sal | NPC | Zerado? | Final |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 Passarela | 5 | 4 | 1 | 5 | 6 | 6 | 3 | 5 | 5 | 2 | sim (5 de 5) | **4,2** |
| 2 Dress Fighter | 4 | 2 | 2 | 4 | 4 | 5 | 3 | 4 | 6 | 3 | parcial (3 arenas jogadas; vitória impossível com as cartas da conta) | **3,7** |
| 3 Dress the Star | 5 | 4 | 2 | 5 | 5 | 4 | 4 | 5 | 5 | 1 | sim (3 de 3) | **4,0** |
| 4 Personagem de Filme | 4 | 4 | 1 | 5 | 5 | 6 | 5 | 4 | 5 | 1 | parcial (2 de 3) | **4,0** |
| 6 Fashion Detective | 5 | 8 | 2 | 8 | 6 | 5 | 8 | 7 | 7 | 4 | parcial (caso até o final completo, 9 de 12 pistas; outros finais e "Seis salões" não) | **6,0** |
| 7 Boutique 3D | 5 | 4 | 2 | 5 | 5 | 5 | 4 | 5 | 5 | 4 | parcial (1 de 4) | **4,4** |
| 10 O Labirinto | 4 | 4 | 2 | 5 | 5 | 4 | 3 | 4 | 5 | n/a | parcial (2 de 4) | **4,0** |
| 12 Around the World | 3 | 4 | 2 | 5 | 5 | 5 | 4 | 5 | 5 | 3 | parcial (1 de 5) | **4,1** |
| 14 Fashion Sports | 7 | 7 | 2 | 7 | 6 | 6 | 4 | 7 | 5 | 6 | parcial (futebol completo; 5 modalidades não) | **5,7** |
| 15 Batalha de Looks | 5 | 4 | 2 | 5 | 5 | 5 | 4 | 6 | 5 | 4 | parcial (1 de 4 e meia) | **4,5** |
| 5 Road to Glory, 8 Clube do Coração, 9 Favorite Singer, 11 Piloto Favorito, 13 Super-Herói | — | — | — | — | — | — | — | — | — | — | não jogados | — |
| **Média** | **4,7** | **4,5** | **1,8** | **5,4** | **5,2** | **5,1** | **4,2** | **5,2** | **5,3** | **3,1** | | **4,5** |

**Nota geral dos jogos auditados: 4,5** (média das dez notas finais). A média de NPCs usa nove jogos (o Labirinto não tem
personagens no desenho).

## 3. Jogo a jogo

Ordem: o Dress Fighter primeiro (a dona pediu uma auditoria própria dele), depois os outros na ordem da lista.

### 3.2 Dress Fighter (núcleo 2)

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

### 3.1 A Passarela (núcleo 1)

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

### 3.3 Dress the Star (núcleo 3)

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

### 3.4 Personagem de Filme (núcleo 4)

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

### 3.7 Boutique 3D (núcleo 7)

**O que joguei.** Só a rodada "Festa em preto" até o resultado (0 pontos: nenhuma peça de festa em preto). Personal
Stylist, Vitrine que Vende e Provador Lotado não foram jogadas (seção 5). **Zerado?** Parcial (1 de 4).

| Dimensão | Nota | Por quê |
| --- | --- | --- |
| Câmera | 5 | três quartos com leve travelling pela loja; arara, espelho e cliente no quadro ([quadros](evidencias/jogos/bou-01-cliente.jpg)) |
| Gameplay com cartas | 4 | só vestir; 33 por peça |
| Fluidez (sem GPU, provisório) | 2 | cerca de 1 a 2 quadros/s nos quadros gravados |
| Recursos | 5 | pedido da cliente, aviso por vaga ("A peça volta para o balcão"), resultado com o que faltou |
| Cartas do deck | 5 | como nos outros jogos |
| Lógica | 5 | coerente; o pedido não é cumprível com as cartas da conta e o deck não avisa |
| Enredo | 4 | cliente com pedido e prazo, frase de desfecho ("A cliente devolve as peças no balcão") |
| Estrutura da partida | 5 | cartão de começo, cliente que se aproxima, desfecho |
| Salvamento | 5 | "Continuar partida" do código atual (visto no Dress Fighter e no Detective) |
| NPCs | 4 | a cliente (gente, vestido lilás) anda até perto e reage com as mãos na cintura quando o look não serve |
| **Final** | **4,4** | |

### 3.15 Batalha de Looks (núcleo 15)

**O que joguei.** Treino Look Monocromático até o resultado (100 × 75 do adversário: vitória) e a Batalha de 3
rodadas até a rodada 3 (100 × 25 na rodada 2; a rodada 3, "Convite black tie", ficou aberta quando o roteiro de teste
parou). Dress Code e Vista o Clima não foram jogados. **Zerado?** Parcial (1 de 4 completo, 1 pela metade).

| Dimensão | Nota | Por quê |
| --- | --- | --- |
| Câmera | 5 | os dois looks lado a lado, troca para frente no resultado ([quadros](evidencias/jogos/bat-01-monocromatico-placar-cortado.jpg)) |
| Gameplay com cartas | 4 | vestir por etapa; a carta mostra "+1 família azul" |
| Fluidez (sem GPU, provisório) | 2 | cerca de 1 a 2 quadros/s |
| Recursos | 5 | objetivo da rodada, "Etapa 3 de 3", placar no painel |
| Cartas do deck | 5 | como nos outros jogos |
| Lógica | 5 | soma por rodada coerente; o painel de LED mostra "00 × 7" para um placar de 100 × 75 (dígitos cortados) |
| Enredo | 4 | duelo contra o adversário da casa, convites sorteados |
| Estrutura da partida | 6 | etapas com objetivo, frase de vitória ("A plateia escolhe você: o braço sobe") e o adversário ergue o braço |
| Salvamento | 5 | retomada pelo mecanismo comum |
| NPCs | 4 | o adversário (gente) gesticula e ergue o braço; ergueu o braço mesmo quando a pessoa venceu |
| **Final** | **4,5** | |

### 3.10 O Labirinto (núcleo 10)

**O que joguei.** Espelho 1 (abriu de primeira: 100) e Corredor de Holofotes (3 de 5 holofotes: 60). Escada de Espelhos e
Três Portas não foram jogadas. **Zerado?** Parcial (2 de 4).

| Dimensão | Nota | Por quê |
| --- | --- | --- |
| Câmera | 4 | sala com portas vista de trás e do alto; a avatar dá poucos passos ([quadros](evidencias/jogos/lab-01-espelho1.jpg)) |
| Gameplay com cartas | 4 | só vestir; a carta diz a família de cor |
| Fluidez (sem GPU, provisório) | 2 | cerca de 1 a 2 quadros/s |
| Recursos | 5 | regra do espelho e "família mais forte" na legenda |
| Cartas do deck | 5 | como nos outros jogos |
| Lógica | 4 | pontos certos, mas o Corredor de Holofotes, entregue na primeira vez, termina com "O espelho cede depois de muitas tentativas" |
| Enredo | 3 | espelhos e portas, sem história |
| Estrutura da partida | 4 | começo e desfecho em frase; o "labirinto" ainda é uma sala |
| Salvamento | 5 | retomada pelo mecanismo comum |
| NPCs | não se aplica | o desenho do jogo não tem personagens |
| **Final** | **4,0** | média das 9 que se aplicam |

### 3.12 Around the World (núcleo 12)

**O que joguei.** Só a rodada Rio de Janeiro (75 pontos, aprovado: a regra da marca brasileira não é cumprível). Volta ao
mundo (8 regiões), Elevador da Torre, Metrô de Moda e Shopping não foram jogados. **Zerado?** Parcial (1 de 5).

| Dimensão | Nota | Por quê |
| --- | --- | --- |
| Câmera | 3 | exploração por trás da avatar no calçadão; durante vários segundos a lente fica colada no tronco dela e corta o corpo ([quadros 012 a 030](evidencias/jogos/atw-01-rio-camera-colada.jpg)) |
| Gameplay com cartas | 4 | só vestir; 25 por regra |
| Fluidez (sem GPU, provisório) | 2 | cerca de 1 a 2 quadros/s |
| Recursos | 5 | região, clima, paleta, legenda por regra cumprida |
| Cartas do deck | 5 | como nos outros jogos |
| Lógica | 5 | coerente; a regra da marca brasileira não tem como ser cumprida com peças sem marca |
| Enredo | 4 | região com clima e estética; "o caminho para a próxima região se desenha no mapa" |
| Estrutura da partida | 5 | começo, caminhada e desfecho com o passaporte |
| Salvamento | 5 | retomada pelo mecanismo comum |
| NPCs | 3 | seis passantes (gente); um acena no fim; os outros ficam parados |
| **Final** | **4,1** | |

### 3.14 Fashion Sports (núcleo 14)

**O que joguei.** Uma partida completa de futebol de 5 jogada por cartas, do apito inicial ao apito final: 16 jogadas,
uma carta em cada (deck com as 13 cartas da conta, uniforme Blusa + Calça azul + Tênis azul). Resultado 0 × 1, derrota,
0 pontos; intervalo 0 × 0; posse 75 %. As outras cinco modalidades (basquete, vôlei, tênis, corrida, skate) não foram
jogadas (seção 5). **Zerado?** Parcial (1 de 6 modalidades). Tempo da partida: cerca de 20 minutos sem GPU.

| Dimensão | Nota | Por quê |
| --- | --- | --- |
| Câmera | 7 | transmissão de TV do alto da lateral com cortes para perto no lance; seletor com as câmeras do campo ([telas](evidencias/jogos/esp-01-futebol-apitos-transmissao.jpg)) |
| Gameplay com cartas | 7 | toda jogada pede carta; a situação diz o que cada cor faz ("É a hora de finalizar (verde)"); a cor decide a ação e a narração diz qual peça fez cada lance; com a mão sem verde a pessoa fica cinco jogadas na área sem poder chutar |
| Fluidez (sem GPU, provisório) | 2 | 10 a 15 s de tela vazia enquanto o estádio carrega (só o placar e "APITO INICIAL" aparecem); depois cerca de 1 quadro/s |
| Recursos | 7 | placar de TV com tempo e relógio, situação, janela de 30 s, mão com ação e poder, narração, resumo final completo |
| Cartas do deck | 6 | deck de até 15, regra do uniforme clara, carta com ação e poder na partida |
| Lógica | 6 | placar, posse e resumo batem com os lances; "Coesão: uniforme único — cumprida — 0 pts" confunde |
| Enredo | 4 | times inventados, sem campanha nem rivalidade |
| Estrutura da partida | 7 | apito inicial, saída de bola, intervalo, apito final com "DERROTA" na tela; o gol do adversário não foi capturado |
| Salvamento | 5 | retomada pelo mecanismo comum (não testada nesta partida) |
| NPCs | 6 | 10 jogadores humanos se posicionam a cada lance, torcida na arquibancada; nos cortes para perto os jogadores ficam parados ao lado da bola |
| **Final** | **5,7** | |

**Defeitos.** ESP-1 (atrapalha): tela vazia de 10 a 15 s entre o preparo e o estádio. ESP-2 (detalhe): regra
"Coesão" cumprida com 0 pontos.

### 3.6 Fashion Detective (núcleo 6)

**O que joguei.** O caso "A Coleção Maré" do começo à acusação, na tela: deck de 12 cartas, look da investigação
(Blusa, Calça azul, Tênis azul, Cinto azul), cutscene de abertura com legenda ("Iolanda Varela puxa você de lado..."),
e cerca de 90 ações clicadas no painel (andar ponto a ponto, abrir armários com a carta verde, tirar papel do bolso com
a preta, confronto com a azul, completar pista com a branca, vida com a amarela, trocar carta, pedir ajuda da casa na
porta trancada), os enigmas de 6 salas, e a acusação do suspeito 2 (Bento) na Passarela. Para andar mais depressa usei
um roteiro que lê o estado devolvido pelo servidor e clica nos mesmos botões que a pessoa clicaria; as respostas dos
enigmas foram as que as dicas e a história indicam. Fui visto por um vigia uma vez (perdi uma marca de vida e voltei ao
esconderijo). Tempo de jogo no relógio do caso: 25:25 de 45:00.

**Zerado?** Parcial. O caso terminou no **final completo** ("Caso resolvido: a coleção volta para Iolanda e a gala
aplaude o detetive"), com 9 de 12 pistas (fiquei sem P4, P5 e P6: o roteiro não passou pelo Clube nem resolveu o
Camarim), 75 pontos e 1 estrela. O final parcial e o final com suspeito errado não foram tentados; a rodada "Seis
salões" não foi jogada.

| Dimensão | Nota | Por quê |
| --- | --- | --- |
| Câmera | 5 | exploração em diagonal de cima, que mostra a sala, os pontos e os cones; as cutscenes usam faixas de cinema e legenda, sem câmera própria ([abertura](evidencias/jogos/dtv-01-entrada-cutscene.jpg)) |
| Gameplay com cartas | 8 | toda ação pede a carta da cor certa e o botão diz qual; a mão gira (trocar carta, 15 s); a carta errada não serve e a tela avisa |
| Fluidez (sem GPU, provisório) | 2 | cerca de 1 a 2 quadros/s; a ação responde em 1 a 3 s |
| Recursos | 8 | vida (três marcas), relógio do caso, "Pistas N de 12", mapa, inventário, enigma com dica, "Rever a cena" |
| Cartas do deck | 6 | a mão mostra nome, cor e ação ("azul (confronto)"); o deck mostra "defesa +5" em todas, o que não diz nada sobre a cor |
| Lógica | 5 | o caso é completável e o servidor decide o final; mas o resultado soma 45 + 18 + 26 = 89 e mostra **75 pontos** sem explicar, e a seção "O que aconteceu" despeja o estado bruto do jogo em JSON na tela ([tela](evidencias/jogos/dtv-02-fim-json-na-tela.jpg)) |
| Enredo | 8 | história original com elenco numerado, pistas com texto exato, motivo e cadeia de dedução justa |
| Estrutura da partida | 7 | cutscene de abertura, cutscene ao entrar nas salas, acusação e cutscene final; as salas são caixas simples e a Passarela final é uma prancha cinza no escuro |
| Salvamento | 7 | ao voltar à página a tela oferece "Continuar desta sala" (havia uma partida de 15/11 guardada) |
| NPCs | 4 | vigias de ronda com cone de visão e uma captura de verdade; Iolanda, Bento e o elenco aparecem como gente, mas parados; ninguém reage à acusação na cena |
| **Final** | **6,0** | |

**Defeitos.** DTV-1 (atrapalha): JSON do estado na tela de resultado — terminar o caso e rolar até "O que aconteceu".
DTV-2 (atrapalha): soma das regras (89) diferente do total (75). DTV-3 (detalhe): cenários das salas muito simples.

## 4. Visão geral

**Os defeitos mais graves.**

| # | Defeito | Jogo | Severidade |
| --- | --- | --- | --- |
| 1 | A cena contradiz o resultado: a avatar cai depois de todo round, inclusive do round que venceu (o roteiro monta a queda sempre que o resultado não é VITORIA; no meio da luta é `EM_ACAO`) | Dress Fighter | bloqueia |
| 2 | O estado bruto do jogo aparece em JSON na tela de resultado | Fashion Detective | atrapalha |
| 3 | Soma das regras diferente do total sem explicação (Detective 89 → 75; Passarela 60 → 86) | Detective, Passarela | atrapalha |
| 4 | Rodadas impossíveis com as cartas da conta e nenhum aviso antes de entrar (duas arenas do Dress Fighter, temas Brasil, Noite e Clássico, marca brasileira do Rio, pedido da Boutique) | vários | atrapalha |
| 5 | Pessoas de cena que não fazem o que a legenda diz ("a plateia levanta" com a plateia sentada; adversário erguendo o braço quando a pessoa venceu) | Passarela, Batalha | atrapalha |
| 6 | Oponente sem mecânica de luta: não ataca, não defende, não recua; não há barra de vida | Dress Fighter | atrapalha |
| 7 | Câmera dentro do corpo ou do piso (fim da luta no Dress Fighter; calçadão do Rio) | Dress Fighter, Around the World | atrapalha |
| 8 | Peça inteira aceita no deck e ausente na mão da partida | Dress Fighter, Personagem de Filme | atrapalha |
| 9 | Frase de final que não combina com a rodada ("o perfil dela pedia outra coisa" no Look Relâmpago; "depois de muitas tentativas" na primeira tentativa) | Dress the Star, Labirinto | atrapalha |
| 10 | 10 a 15 s de tela vazia entre o vestiário e o estádio; Passarela a 0,2 quadro/s sem GPU | Fashion Sports, Passarela | atrapalha |
| 11 | Placar de LED com dígitos cortados ("00 × 7" para 100 × 75) | Batalha de Looks | detalhe |
| 12 | Botão de câmera e cartões de texto cobrindo a avatar em 390×844 | Dress Fighter (e o HUD comum) | atrapalha |

**As dez mudanças que mais subiriam as notas.**

1. **Corrigir o roteiro da luta** (queda e comemoração só no fim, e de acordo com quem venceu cada round) e dar ao
   oponente os movimentos de luta no corpo humano: guarda, golpe, recuo ao apanhar, queda. Sobe Lógica, NPCs e Estrutura
   do Dress Fighter.
2. **Uma decisão por carta dentro do round no Dress Fighter**, como o Fashion Sports já faz: a cor vira a ação
   (guarda, esquiva, golpe rápido, golpe forte, fôlego, foco), o poder decide o duelo, com barra de vida que desce no
   contato. É o que transforma o jogo em jogo de luta.
3. **Avisar no deck quando a rodada não é cumprível** com as cartas escolhidas (sem marca, sem festa, sem couro) e dizer o
   que falta; hoje a pessoa só descobre no resultado.
4. **Explicar a nota final**: mostrar a conta (60 de 70 vira 86; 89 menos o desconto vira 75) e nunca mostrar o estado
   em JSON.
5. **Fazer as pessoas de cena cumprirem a legenda** em todos os jogos (plateia que levanta, fotógrafos que disparam,
   adversário que lamenta), já que o diretor de cena agora chega aos corpos humanos.
6. **Câmera que não entra no corpo nem no piso** (limite de distância e colisão) e uma vista lateral de luta no Dress
   Fighter.
7. **Nível de detalhe menor para a plateia** (a Passarela roda a 0,2 quadro/s sem GPU) e uma tela de carga com imagem
   no lugar dos 10 a 15 s vazios do estádio.
8. **Recusar no deck a peça que o jogo não deixa vestir** (peça inteira) e mostrar na carta todos os efeitos dela, não só
   o primeiro.
9. **Marcar as rodadas já vencidas** na escolha de rodada e dar uma progressão entre elas (desbloqueio, estrelas
   somadas), o que sobe Enredo e Estrutura dos jogos sem história.
10. **Revisar as frases de final por rodada** e o placar de LED, para o texto sempre bater com o que aconteceu.

## 5. O que não foi auditado e por quê

A máquina da auditoria não tem GPU e, na segunda sessão, dividiu 16 GB de memória com três outras pilhas em uso. O
navegador da auditoria foi derrubado por falta de memória mais de dez vezes (cada vez perdendo a partida em curso e a
sessão), o servidor Next da auditoria caiu duas vezes e a sala mais leve rodou a 1 ou 2 quadros por segundo. Com isso,
cada rodada levou de 1,5 a 3 minutos e uma partida de futebol cerca de 20 minutos. Ficou de fora:

| O quê | Motivo |
| --- | --- |
| Road to Glory (núcleo 5) e FLAIR 3D MAKE UP (`/flair/make-up`) | não houve tempo de máquina; ficaram por último na ordem pedida |
| Clube do Coração, My Favorite Singer, Meu Piloto Favorito, Meu Super-Herói Favorito (jogos de zonas) | não houve tempo; nenhuma rodada jogada, sem nota |
| Fashion Sports: basquete, vôlei, tênis, corrida e skate | só o futebol foi jogado |
| Rodadas restantes: Personagem de Filme (Década), Boutique (3), Batalha (2 e meia), Labirinto (2), Around the World (4) | tempo e quedas do navegador |
| FLAIR Card Building Challenges (`/flair/desafios`, `/flair/elencos`) e modos clássicos (`/flair/partidas`) | não alcançados nesta auditoria |
| Fluidez com CPU 4× mais lenta | não medida; a 390×844 só o Dress Fighter foi medido (1,8 a 2,3 quadros/s); a 1440×900 a cena já estava entre 0,2 e 2,4 quadros/s |
| Vitória no Dress Fighter, carta Especial, temas Brasil/Noite/Clássico com nota | impossíveis com as cartas da única conta com cartas (todas Bronze, sem marca, sem couro, jeans ou metal) |

Os jogos sem nota não entram nas médias da seção 2.

Em 19/11/2026 o Road to Glory / MAKE UP e os quatro jogos de zonas foram auditados por código e por partidas simuladas
em teste (sem tela): seção 7. As notas de lá não entram nas médias da seção 2.

## 6. Correções da auditoria dos jogos

As correções depois desta auditoria (16/11/2026). Nenhuma foi vista na tela: a máquina não tinha memória para o navegador
com renderização de software. Todas têm teste do servidor ou da tela.

| Defeito | Correção | Commit |
| --- | --- | --- |
| DF-1: a avatar cai depois de um round vencido | no meio da luta a cena mostra só o lance novo, sem queda nem reação; a queda é de quem perdeu a luta | `439f4b7a` |
| DTV-1: o estado do caso em JSON na tela de resultado | um evento com valor de estrutura e sem frase não vira texto | `439f4b7a` |
| DTV-2 e PAS-3: soma das regras diferente do total (89 → 75; 60 → 86) | regra PENALIDADES (−2 por captura) no Detective; a Passarela manda a conta (60 de 70 vira 86) e a tela a explica | `439f4b7a` |
| PAS-1: "a plateia levanta" com a plateia sentada | a legenda diz "aplaude"; com 3 estrelas a plateia se levanta | `439f4b7a` |
| Batalha: o adversário ergue o braço quando a pessoa vence | o adversário lamenta e a pose dele não acena mais | `439f4b7a` |
| DTS-1 e Labirinto: final que não combina com a rodada | final próprio do Look Relâmpago e do Corredor de Holofotes; o final médio do Labirinto sem "muitas tentativas" | `439f4b7a` |
| Placar de LED "00 × 7" para 100 × 75 | a fonte diminui até o placar caber | `439f4b7a` |
| DF-6 e Around the World: câmera dentro do corpo | quando a parede traz a lente para perto, ela sobe em vez de entrar no corpo (o close e o zoom continuam perto) | `439f4b7a` |
| DF-7: botão de câmera cobrindo a avatar em 390 px | no celular a câmera e os controles dela ficam numa coluna estreita na borda direita | `439f4b7a` |
| Dress Fighter, perguntas 1 a 7, DF-2, DF-4, DF-8 | luta lance a lance: vida 100 das duas com barras na tela, a cor da carta jogada é o golpe (vermelho forte, amarelo rápido, preto guarda, verde esquiva, azul fôlego, branco foco), a oponente ataca, guarda, esquiva e recua, leitura do próximo golpe dela, combos (Relâmpago, Contragolpe, Muralha), nocaute, câmeras "Luta de lado" (arcade) e "Por trás do ombro", peça inteira no look e na mão; tudo no servidor, da semente | `acb1ecaa` |
| DF-3, PAS-2 e o defeito 4: rodadas impossíveis sem aviso | aviso na escolha do deck e no começo da partida quando nenhuma carta pontua ou uma regra de peça não tem carta; as arenas do Dress Fighter ficaram vencíveis jogando bem com cartas Bronze (14, 12 e 13 vitórias em 20 sementes) | `be68234e`, `acb1ecaa` |
| NPCs (média 3,1): reação que não bate com o desfecho | fotógrafos da Passarela, estrela do Dress the Star, equipe do set do Filme e passantes do Around the World reagem pela nota | `97f4ff80` |
| PF-1: o vestido entra no deck e some da mão no Personagem de Filme | a peça inteira veste e conta como a parte de cima e a de baixo do figurino (25); o deck aceita o vestido no lugar da parte de cima | `546e19b4`, `d1a80473` |
| Mudança 8 (deck): peça que o jogo não deixa vestir aceita no deck | a carta sem vaga no jogo fica apagada, não entra no deck e o toque diz por quê; o servidor recusa o deck dizendo a posição (no Fashion Sports toda carta entra: fora do uniforme ela é jogada na mão) | `546e19b4`, `d1a80473` |
| Mudança 8 (carta): a carta só mostrava o primeiro efeito | a carta do deck e da mão mostra todos os efeitos, um por linha, com o da cor no fim; o rótulo de leitura de tela lê todos | `d1a80473` |
| PF-2: o refletor do set tapa um terço do quadro | o objeto do refletor era ajustado à altura de um tripé e ficava com 2 m de largura; agora tem o tamanho de um canhão de chão (75 cm) | `98f55a9e` |
| ESP-1: 10 a 15 s de tela vazia antes do estádio | tela de carga com a arte do campo nas cores dos dois times e a lista do que está sendo carregado, até o primeiro quadro da partida | `d1a80473` |
| ESP-2: "Coesão" cumprida com 0 pontos | a Coesão saiu das regras da nota (era sempre cumprida e valia 0); continua como atributo do time no preparo. A nota é só o placar | `546e19b4`, `d1a80473` |
| DF-9: o contador conta eventos, não rounds | na luta o contador mostra "Round 2 · lance 4 de 9" | `d1a80473` |
| Fashion Detective: ninguém reage à acusação | na passarela Iolanda e Bento reagem pelo final (comemora, baixa a cabeça, nega e recua, aponta); na acusação errada o acusado entra em cena com o álibi | `95d78c12` |
| Mudança 9 e "marcar a arena já vencida" (Estrutura, média 5,2): rodadas sem marca nem progressão | campanha por pessoa e por jogo no servidor, lida das partidas fechadas (sem tabela nova): a escolha de rodada marca as vencidas, mostra as estrelas e a melhor nota de cada uma e o total do jogo; a primeira rodada sempre aberta, a seguinte abre ao vencer a anterior (422 `RODADA_BLOQUEADA` no servidor), nada pago; no Fashion Sports a trilha são as modalidades, todas abertas (núcleos 1, 2, 3, 4, 6, 7, 10, 12, 14 e 15) | `535324e0`, `66a1ced8` |
| Enredo (média 4,2): jogos sem história nem progressão entre as rodadas | cada um dos dez jogos tem abertura (quem a pessoa é e o que está em jogo), transição entre rodadas e fecho, nos três idiomas; a transição cita a última rodada jogada com os pontos e as estrelas que o servidor gravou (vitória e derrota têm frases próprias) e o fecho só aparece com tudo vencido | `66a1ced8` |
| Salvamento (média 5,3): a tela não dizia o que estava salvo; o look da preparação ficava só no navegador | o look em montagem vai para o servidor e volta às vagas na retomada, em qualquer aparelho; "Continuar partida" lista o que está guardado (deck, look entregue, look em montagem, etapas, jogadas) e quando; na partida e no resultado a linha "Salvo no servidor às HH:MM" diz o que foi salvo; a retomada na preparação foi testada nos dez jogos | `535324e0`, `66a1ced8` |
| NPCs (mudança 5): bonecos sincronizados e papéis que faltavam | cada pessoa reage no próprio instante, com a própria força e ritmo (tirados do id dela e da partida); quem tem pouca força aplaude de pé em vez de pular. A pessoa de corpo leve (a maior parte da plateia) agora também reage; antes ficava parada. Papéis novos: vendedora e outra cliente na Boutique; três jurados na Batalha, e plateia e jurados seguem quem venceu; torcida do beco no Dress Fighter, reagindo a cada lance e ao fim; reservas no banco do Fashion Sports (quadra e estádio), e a torcida e os bancos do estádio reagem ao gol, à bola na trave e ao apito final | `3e43e008` |
| Câmera (mudança 6, média 4,7; Around the World 3) | a lente desvia das pessoas de cena e dos móveis (o giro de 360° entrava em painel, portal, vitrine, provador e trave); na troca de câmera ela contorna a avatar em vez de atravessá-la (a lente colada no tronco no calçadão do Rio) e a troca dura o mesmo tempo em qualquer máquina; no Dress Fighter e na Batalha o preparo mostra os dois inteiros; teste por jogo: avatar inteira no preparo, na ação e no resultado, limites de distância e de ângulo, nenhuma câmera dentro de corpo, móvel, piso ou parede, e pelo menos duas vistas com nome | `b5149791` |
| Fluidez (mudança 7, média 1,8; PAS-4) | orçamento de triângulos e de chamadas de desenho por cena, conferido por teste que monta e conta a geometria; corpos inteiros por cena (Passarela: 2 em vez de 5) e o resto em gente leve instanciada (5 chamadas para a plateia inteira); a reação de grupo não põe mais a plateia inteira de corpo inteiro no resultado; a cena mede os quadros e desce de qualidade sozinha (menos pontos por pixel, sem sombra, sem corpo inteiro de figurante), e sem placa de vídeo já larga no nível baixo; quem está fora do quadro não é carregado; figurante distante não faz sombra. Passarela: de 253 mil triângulos e 214 chamadas por quadro (610 mil e 403 no resultado) para 134 mil e 96 na qualidade alta e 30 mil e 27 na baixa (tabela em `docs/flair/flair-3d/BASE_NUCLEOS.md`) | `3efe67e7` |

As linhas de 19/11/2026 (as oito das pendências e as três de campanha, enredo e salvamento) também não foram vistas na
tela; cada uma tem teste. O tempo da tela de carga do estádio não foi medido: ela cobre a espera, não a encurta. Para a
trava em sequência não deixar parada a conta sem carta para vencer uma rodada, três partidas na mesma rodada abrem a
seguinte (`9e751513`).

As três linhas de pessoas de cena, câmera e fluidez também não foram vistas na tela: os números de fluidez são a
geometria contada por teste, não quadros por segundo medidos. O Labirinto continua sem personagens: um porteiro ou guia
foi avaliado e não entrou (o jogo é a pessoa sozinha diante dos espelhos); se o enredo ganhar uma voz que apresenta cada
espelho, ela cabe melhor como legenda do que como corpo na sala.

Ficou para depois: a medida da fluidez com GPU.

## 7. Jogos de zonas e MAKE UP (auditoria por código, 19/11/2026)

**O que é esta seção.** Os cinco jogos que a seção 5 deixou sem nota: Road to Glory / FLAIR 3D MAKE UP (núcleo 5),
Clube do Coração (8), My Favorite Singer (9), Meu Piloto Favorito (11) e Meu Super-Herói Favorito (13). Ramo
`claude/adoring-davinci-mufbri`, commit `321b22c5`.

**Como foi feita, e o que ela não é.** Não é uma auditoria na tela: a máquina continua sem GPU e sem memória para o
navegador. Li o código do servidor e da tela e joguei **partidas simuladas em teste do servidor**, com a regra de
verdade (`AtelieZonasPartidasTest`, `RoadToGloryPartidasTest`): 20 sementes por rodada, com um guarda-roupa só de cartas
Bronze (13 cartas de OVR 52 a 57 como as da @lia.demo: sem marca, sem festa, sem couro), com o pior guarda-roupa Bronze
(sem etiqueta nenhuma de ocasião ou material) e com um guarda-roupa bom (Ouro). Nos jogos de zonas só usei o que a tela
oferece: as 10 cores e os 4 acabamentos de `lib/flair/nucleos/palette.ts`. **Nada aqui foi visto na tela.**

**O que muda nas notas por causa disso.** Câmera e fluidez não têm nota: estão descritas pelo código e marcadas "não
visto na tela". A nota final é a média das dimensões com nota. Uma nota desta seção vale menos que uma nota da seção 3:
ela diz que a regra está certa e explicada, não que a partida é boa de jogar.

**Duas coisas que valem para os quatro jogos de zonas.**
- **Não há cartas.** O desenho da dona é o editor de peças ("todos criam peças no mesmo editor", `docs/JOGOS.md`): a
  pessoa pinta zonas com cor e acabamento, sem deck. Por isso "gameplay com cartas" e "cartas do deck" são "não se
  aplica", e "vencível com cartas Bronze" vira "a paleta da tela chega a 100 em toda rodada". A decisão dentro da
  rodada é a cor e o acabamento de cada zona. Pôr carta nesses jogos mudaria o desenho: ficou para a dona decidir.
- **Não há sorteio.** A semente não muda nada nesses jogos: a mesma pintura dá sempre a mesma nota. As "20 sementes"
  do teste são 20 pinturas ao acaso, para mostrar que a rodada não passa sozinha.

### 7.1 Notas antes e depois

"Antes" é o commit `321b22c5`; "depois" é o código com as correções da seção 7.3. **n.v.** = não visto na tela (sem
nota); **n/a** = não se aplica.

| Jogo | | Cam | Car | Flu | Rec | Deck | Lóg | Enr | Est | Sal | NPC | Final |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5 Road to Glory / MAKE UP | antes | n.v. | 3 | n.v. | 5 | 4 | 4 | 4 | 4 | 6 | 3 | **4,1** |
| | depois | n.v. | 7 | n.v. | 7 | 6 | 8 | 5 | 6 | 6 | 3 | **6,0** |
| 8 Clube do Coração | antes | n.v. | n/a | n.v. | 5 | n/a | 6 | 4 | 4 | 6 | n/a | **5,0** |
| | depois | n.v. | n/a | n.v. | 6 | n/a | 8 | 5 | 4 | 6 | n/a | **5,8** |
| 9 My Favorite Singer | antes | n.v. | n/a | n.v. | 5 | n/a | 4 | 4 | 4 | 6 | n/a | **4,6** |
| | depois | n.v. | n/a | n.v. | 6 | n/a | 8 | 5 | 4 | 6 | n/a | **5,8** |
| 11 Meu Piloto Favorito | antes | n.v. | n/a | n.v. | 5 | n/a | 3 | 3 | 3 | 6 | n/a | **4,0** |
| | depois | n.v. | n/a | n.v. | 6 | n/a | 8 | 5 | 3 | 6 | n/a | **5,6** |
| 13 Meu Super-Herói Favorito | antes | n.v. | n/a | n.v. | 5 | n/a | 3 | 5 | 4 | 6 | n/a | **4,6** |
| | depois | n.v. | n/a | n.v. | 6 | n/a | 7 | 5 | 4 | 6 | n/a | **5,6** |

Nenhum dos cinco chega a 8,0 na média. O que subiu foi o que um teste consegue provar (lógica, conta da nota, aviso,
decisão por carta no Road to Glory). O que segura as notas está na seção 7.4.

**Por que cada nota (depois).**

| Dimensão | Road to Glory / MAKE UP | Jogos de zonas (8, 9, 11, 13) |
| --- | --- | --- |
| Câmera (n.v.) | pelo código: três quartos no preparo, close no rosto na ação e giro de 360° no resultado; lateral e close na roupa no seletor | pelo código: três quartos no preparo, giro de 360° na ação (grua na Cantora, contra-plongée no Super-Herói) e grua no resultado; não sei se a peça pintada fica bem no quadro |
| Gameplay com cartas | 7: a carta veste e, na sessão de fotos, uma carta fora do look acende a luz da cor dela (a cor pedida soma 10). É uma jogada por partida, não uma por carta; a tela do MAKE UP (a carreira) não tem a sessão | n/a: o desenho não tem cartas |
| Fluidez (n.v.) | não medida | não medida |
| Recursos | 7: objetivo, prévia da nota, selo de cada carta, aviso da regra sem carta, dica por regra, explicação da peça que derrubou a regra | 6: objetivo, 10 cores e 4 acabamentos por zona, prévia, dica por regra e o aviso de zonas sem pintar; só as 10 cores da paleta |
| Cartas do deck | 6: sem deck (guarda-roupa liberado); o selo agora é o do brief da rodada, no núcleo e na tela do MAKE UP | n/a |
| Lógica | 8: a nota é a soma das regras, cada regra perdida tem motivo dito, e 110 vira 100 com explicação; 2 estrelas só saem com a sessão de fotos (75 + 10) | 8 (7 no Super-Herói): toda rodada chega a 100 com a paleta, peça pela metade não leva 3 estrelas e o resultado diz o que faltou; no Super-Herói o emblema vale 25 só por ser escolhido |
| Enredo | 5: premissa e três finais; a carreira com Prestígio só existe na tela do MAKE UP, e os dois caminhos não se falam | 5 (cada jogo): premissa e final por desfecho, agora com o final da rodada jogada; não há progressão entre as rodadas |
| Estrutura | 6: preparo, flashes, pedido da fotógrafa, carta, resultado | 4 (3 no Piloto): preparo e resultado; não há meio de partida, e a peça aparece como faixas de cor num busto, seja camisa, jaqueta, capacete ou tênis |
| Salvamento | 6: rascunho do look no navegador e "Continuar partida" na sessão de fotos (teste do servidor); na retomada o servidor devolve só as cartas do look (a maquiagem volta se o rascunho do navegador ainda existir) | 6: rascunho por jogo e rodada no navegador; a partida só existe no servidor depois da primeira prévia |
| NPCs | 3: uma fotógrafa parada; ela não reage à nota | n/a: a sala só tem o manequim ("Ninguém além de você") |

### 7.2 Defeitos achados

Classes procuradas: rodada impossível sem aviso; soma diferente do total; frase de final que não bate; carta que é só
soma; estado bruto na tela; pessoas de cena que contradizem o resultado; peça aceita e ausente.

| # | Defeito | Como aparece (teste) | Severidade | Situação |
| --- | --- | --- | --- | --- |
| RTG-1 | O selo da carta era sempre o do Ensaio de Verão: na Entrevista e no Primeiro Encontro a carta casual mostrava "+25 ocasião do brief" e, vestida, tirava os pontos da regra | `oSeloDaCartaEhODoBriefDaRodada` | bloqueia (a tela manda fazer o contrário) | corrigido |
| RTG-2 | A carta só vestia: nenhuma decisão de carta depois de entregar | `todaRodadaEhVencivel...`: só seguindo, o Ensaio reprova | atrapalha | corrigido (sessão de fotos) |
| RTG-3 | As regras "todas as peças" caem por causa de uma peça só e o resultado não dizia qual; sem peça nenhuma, também não dizia | `oResultadoDizQualPeca...` | atrapalha | corrigido |
| RTG-4 | Guarda-roupa sem carta para uma regra de roupa: nenhum aviso (o aviso geral diria "a nota vai sair 0", que é falso aqui, porque a maquiagem vale 50) | `viabilidade.test.ts` | atrapalha | corrigido |
| RTG-5 | O final bom dizia "o Prestígio sobe e o próximo brief se abre", mas o núcleo 5 não dá Prestígio nem trava brief | leitura do código | atrapalha | corrigido (texto) |
| RTG-6 | Na Entrevista e no Primeiro Encontro o resultado não dizia quanto cada carta rendeu | `oResultadoDizQualPeca...` | detalhe | corrigido |
| MK-1 | Tela do MAKE UP: as cartas não tinham selo, não havia aviso e o resultado não explicava a regra perdida | `makeup.test.tsx` | atrapalha | corrigido |
| MK-2 | Com regras de 25, a nota é 0, 25, 50, 75 ou 100: 2 estrelas (80) nunca saem. Na carreira do MAKE UP o nível 2 pede 60 de Prestígio (3 estrelas): só com um brief em 100, ou seja, com pelo menos uma carta que cumpra todas as regras de roupa | conta das regras | atrapalha | **aberto** (ver 7.4) |
| ZON-1 | Peça pela metade aprovada: capa preta e peito amarelo davam **100** no Vigilante com braços e pernas sem pintar; uma zona rosa metálica dava 75 na Era Neon; uma sola branca espelhada, 75 no Tênis | `pecaPelaMetade...` | bloqueia (resultado errado) | corrigido |
| ZON-2 | Acabamento sem cor contava: "peito metálico" e "viseira espelhada" cumpridos numa zona sem pintar | `acabamentoSemCor...` | atrapalha | corrigido |
| ZON-3 | Tênis dos Sonhos: "até 3 cores" numa peça de 3 zonas saía cumprida sempre; pintando ao acaso a rodada dava 76 de média e 100 em 4 de 20 | `pintarAoAcaso...` | atrapalha (regra que é só soma) | corrigido (até 2 cores) |
| ZON-4 | Super-Herói: a regra do emblema dava 25 sem emblema nenhum (e com qualquer código); nas rodadas Traje e Vigilante a aba do emblema aparecia sem ser pedida | `oEmblemaSoPontua...` | atrapalha | corrigido em parte: o emblema é pedido nas 3 rodadas e só pontua (na Armadura) se for da lista; continua valendo 25 só por ser escolhido |
| ZON-5 | Final que não bate com a rodada: o Macacão e o Tênis terminavam com "O capacete vai para a pista"; a Jaqueta da Banda, com "o público reconhece a era"; a premissa do Piloto só falava do capacete | `nucleo-zonas-makeup.test.tsx` | atrapalha | corrigido |
| ZON-6 | Os finais falam de torcida, público, equipe e cidade, e a sala só tem o manequim | leitura do código | detalhe | **aberto** |
| ZON-7 | A peça pintada aparece como faixas de cor num busto, igual para camisa, jaqueta, capacete, macacão e tênis | `effects-3d.tsx` (`PecaPintada`) | atrapalha | **aberto** |

Não achei: estado bruto ou JSON na tela (os eventos novos têm frase nos 3 idiomas; teste), peça aceita e ausente (no
servidor as cinco vagas, com a peça inteira, valem no Road to Glory), nem rodada impossível com a paleta da tela (as 10
amostras caem nas famílias que as regras esperam: `cadaAmostraDaTela...`).

### 7.3 Correções e commits

| Defeito | Correção | Commit |
| --- | --- | --- |
| ZON-1, ZON-2 | regras da peça inteira (quantas cores, cor dominante, tudo fosco, sem metal, uma só zona de alerta) só valem com todas as zonas pintadas; acabamento só conta em zona com cor; o resultado traz "Faltou pintar N de M zonas" | `d4f2a8da` (servidor), `cb189970` (texto) |
| ZON-3 | Tênis dos Sonhos com até 2 cores | `d4f2a8da` |
| ZON-4 | emblema pedido nas 3 rodadas; a regra só pontua com emblema da lista | `d4f2a8da` |
| ZON-5 | finais próprios do Macacão, do Tênis, da Jaqueta e do Uniforme de E-sports; premissas do Piloto e da Cantora que valem para todas as rodadas | `cb189970` |
| RTG-1, RTG-6 | o selo e os pontos por carta vêm do brief da rodada | `131db2e1` |
| RTG-2 | sessão de fotos: a fotógrafa pede uma luz (da semente), a carta do guarda-roupa fora do look acende a cor dela e a cor pedida soma 10; quando as regras passam de 100 o resultado diz | `131db2e1` (servidor), `cb189970` (tela), `92036db3` (retomada) |
| RTG-3 | o resultado diz a vaga da peça fora da ocasião ou que não é leve, e quando não há peça vestida; dica por regra | `131db2e1`, `cb189970` |
| RTG-4 | aviso das regras de roupa sem carta, no começo da partida | `cb189970` |
| RTG-5 | premissa e final sem a promessa de Prestígio | `cb189970` |
| MK-1 | selo de cada carta no brief, aviso da regra sem carta e explicação no resultado do MAKE UP | `131db2e1` (servidor), `cb189970` (tela) |

**As provas pedidas.**
- **Vencível com cartas Bronze, jogando bem, em 20 sementes** (`RoadToGloryPartidasTest`): com o guarda-roupa Bronze,
  as 3 rodadas saem aprovadas com 85 ou mais nas 20 sementes (o Ensaio de Verão chega a 100); com o pior guarda-roupa
  Bronze (sem etiqueta de ocasião nem de material) ainda saem aprovadas nas 20, pela sessão de fotos; com o guarda-roupa
  bom, 100 nas 20. Só seguindo (a primeira peça de cada vaga, sem carta na sessão), a nota fica sempre abaixo, e o
  Ensaio reprova com 50.
- **Jogos de zonas** (`AtelieZonasPartidasTest`): as 10 rodadas com nota chegam a 100 só com a paleta da tela; pintando
  ao acaso em 20 sementes a média de cada rodada fica abaixo de 60 e no máximo uma pintura chega a 100.
- Testes rodados: servidor (`fai-application` e `fai-web`, pacotes do FLAIR 3D, do MAKE UP, do esporte, do detetive e
  do CBC) 162 testes, 0 falhas; tela (`components/flair/make-up`, `components/flair/nucleos`, `lib/flair`) 361 testes,
  0 falhas.

**Código comum tocado (o mínimo).** `lib/flair/nucleos/moments.ts` (uma linha: o Road to Glory entra na lista da jogada
de cena), `lib/flair/nucleos/viabilidade.ts` (quatro códigos de regra de roupa e um parâmetro opcional para os jogos em
que a nota não vem só das cartas) e `components/flair/nucleos/nucleo-apresentacao.tsx` (passa esse parâmetro).
`Flair3dJogadaDeCena` e `Flair3dNucleos` não mudaram: o Road to Glory compõe o decorator por dentro.

### 7.4 O que ficou aberto e por quê

| O quê | Por quê |
| --- | --- |
| Câmera e fluidez dos cinco jogos | não vistas na tela (sem GPU); precisam da mesma medição da seção 3 |
| Carta nos jogos de zonas | o desenho da dona não tem cartas nesses modos; uma jogada de carta ali é decisão dela |
| MK-2: 2 estrelas impossíveis com regras de 25, e a carreira do MAKE UP presa no nível 1 sem um brief em 100 | mexe na escala de estrelas comum a todos os jogos (`Resultado.estrelas`) ou na curva de Prestígio do plano da dona; a tela do MAKE UP também não tem a sessão de fotos, que no núcleo dá os 85 |
| ZON-4: o emblema vale 25 só por ser escolhido | falta uma regra em que o emblema importe (por exemplo, ligado ao arquétipo) |
| ZON-6 e NPCs: sala sem gente, final que fala de torcida e público; fotógrafa que não reage | pessoas de cena são de outra frente (NPCs, câmera e LOD) |
| ZON-7 e a estrutura: peça como faixas num busto, sem meio de partida | pede modelo 3D por tipo de peça (capacete, tênis, jaqueta) e uma sequência de apresentação |
| Enredo: os dois caminhos do Road to Glory (núcleo 5 sem Prestígio, MAKE UP com carreira) e as rodadas dos jogos de zonas sem progressão | progressão e enredo são de outra frente |
| Na retomada do Road to Glory o servidor devolve só as cartas do look, não a maquiagem | a retomada comum é assim; a nota não muda (o servidor guarda a entrega inteira) e não conferi na tela o que aparece |
