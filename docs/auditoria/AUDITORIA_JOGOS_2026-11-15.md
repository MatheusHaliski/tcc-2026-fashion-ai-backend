# Auditoria dos jogos do FLAIR (15/11/2026)

> **Relatório parcial, atualizado às 20:12 UTC.** A auditoria ainda está em andamento; jogos sem seção ainda não foram jogados.

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
| Dress Fighter | 4 | 2 | 2 | 4 | 4 | 5 | 3 | 3 | 1 | 1 | parcial (3 arenas jogadas; vitória impossível com as cartas da conta) | **2,9** |

Os outros jogos ainda estão sendo jogados.

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
| Movimento de lutadora | não | em todos os rounds de todas as lutas ela fica parada de frente para a câmera, braços para baixo; não gira para a avatar, não se aproxima, não recua |
| Mecânica de combate | não | ela nunca ataca nem defende: o roteiro pede "guarda", "soco", "recuo" e "comemora", mas o corpo humano não toca nenhum desses movimentos (o próprio `ESTADO_DOS_JOGOS.md` admite que as sequências só animam as silhuetas antigas) |
| Furtividade/esquiva | não | nada |
| Reação | não | não reage ao round ganho pela pessoa nem à derrota dela; a legenda "O oponente fica de pé" é a única reação |
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
8. Retomar a luta depois de recarregar a página; marcar a arena já vencida.
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
| Estrutura da partida | 3 | preparo, três rounds e resultado; sem apresentação, sem anúncio de round, sem nocaute; o final de derrota toca depois de cada round |
| Salvamento | 1 | recarregar no meio da luta volta à escolha da arena e a luta fica aberta para sempre no servidor ([tela](evidencias/jogos/df-09-recarregar-perde-luta.jpg)); arena vencida não fica marcada |
| NPCs | 1 | a oponente fica parada em todas as lutas; não há outros NPCs |
| **Final** | **2,9** | |

**Defeitos.**

| # | Defeito | Como reproduzir | Severidade |
| --- | --- | --- | --- |
| DF-1 | A avatar cai no chão depois de todo round, inclusive do round que venceu | Arena blindada, look com 40 de velocidade; entregar; quando o impulso do round 1 é positivo (44 × 40, `venceu: true`) a avatar faz a guarda e cai | bloqueia (a cena diz o contrário do resultado) |
| DF-2 | A oponente não se mexe em nenhum round | qualquer luta; observar a oponente durante os três rounds | atrapalha |
| DF-3 | Duas arenas impossíveis com cartas Bronze sem couro, jeans, lã ou metal, sem aviso | @lia.demo, qualquer deck: Arena do bairro e Arena veloz sempre 0 | atrapalha |
| DF-4 | Peça inteira entra no deck mas não aparece na mão da partida | deck com "Vestido preto"; entrar: a mão tem 5 cartas | atrapalha |
| DF-5 | Recarregar a página no meio da luta perde a luta | entregar o look, recarregar | atrapalha |
| DF-6 | A câmera do fim entra no corpo e no piso e mostra a saia de baixo | luta com saia; câmera Automática; fim do round 3 | atrapalha |
| DF-7 | No celular o botão de câmera cobre as pernas da avatar e os cartões de texto cobrem a esquerda da cena | 390×844, qualquer momento da partida | atrapalha |
| DF-8 | A carta do deck mostra só "velocidade +N"; ataque, defesa e a cor só aparecem ao vestir | tela do deck | detalhe |
| DF-9 | "A ação 2 de 2", "4 de 4": o contador conta eventos (impulso e round), não rounds | Arena veloz, depois do round 2 | detalhe |
