# FLAIR 3D: os cinco jogos

Os cinco jogos abaixo foram definidos pela dona do projeto em 08/11/2026 e substituem os anteriores (Espelho Partido,
Prova com a Estrela, Rooftop ao Pôr do Sol, Cinco Clientes e Chefe: Vellard), que ainda estão nos dados do app até a
implementação destes. Em cada jogo, **a definição da dona vem citada como ela escreveu**. O que vem depois, marcado
como **[proposta]**, é detalhe sugerido para ela aprovar ou mudar.

O **FLAIR 3D MAKE UP** é o jogo 5, Road to Glory: "na realidade, é justamente aqui que entra o tal do FLAIR 3D MAKE UP".
O plano dele está em `PLANO.md`. [decidir] O segmento dos cinco volta a se chamar "FLAIR 3D" no app?

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

## Jogo 3 · Vista a Celebridade

**Definição da dona:** "Semelhante ao jogo da passarela, neste voce também deve registrar seu deck inicial e o jogo da
dicas de filmes, musicas, series para que os usuarios submetam pecas de roupa para tentar adivinhar."

- **Partida [proposta]:**
  1. Registrar o deck.
  2. O jogo mostra uma pista de cada vez: um filme, uma música ou uma série ligados à celebridade.
  3. Depois de cada pista, a pessoa veste peças do deck que lembrem o estilo dela.
  4. No fim, a celebridade é revelada.
- **Pontuação [proposta]:** pontos pelas peças que batem com o perfil de estilo da celebridade, que nós escrevemos
  (estilos, cores, ocasiões e marcas típicas). Quem acerta com menos pistas ganha mais. Um palpite opcional do nome
  vale bônus.
- **Imagem e nome.** As pistas são texto e a revelação mostra o nome e o perfil de estilo, sem foto e sem sugerir
  apoio da celebridade. Foto, voz ou rosto só com licença.

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

## O que ainda falta decidir

1. O segmento dos cinco jogos volta a se chamar "FLAIR 3D" no app, com Road to Glory como o modo FLAIR 3D MAKE UP?
2. O nome do jogo 2 no lugar de "Street Fighter".
3. Tamanho do deck (12 é a proposta) e se o jogo 2 também usa deck.
4. A fórmula de pontos da Passarela (+10 por peça no tema, +20 pelo look inteiro, máximo de 70).
5. Partidas ao vivo, contra desfiles gravados, ou os dois.
6. Quais marcas, celebridades e filmes procurar primeiro para licença.
