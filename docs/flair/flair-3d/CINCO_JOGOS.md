# FLAIR 3D: os cinco jogos

O FLAIR 3D tem cinco jogos, um por capítulo, para que cada um ganhe cenário 3D, protagonistas e objetivo trabalhados a
fundo. As regras de vaga, requisito, Hype e recompensa de cada jogo estão em `scripts/flair-games/data/serie-*.json`
e valem no servidor; este documento descreve a experiência 3D por cima delas. Base técnica e de linguagem:
`docs/flair/3d-puzzles/ESTUDO_INSOMNIAC.md` (princípios) e `ALTERNATIVAS_FASHIONAI.md` (kits, encaixes e orçamento).

Regras comuns aos cinco:

- **Protagonista do jogador**: o avatar 3D da pessoa (busto do rosto + corpo) entra em cena e veste as cartas quando a
  Aura Impersonation é permitida (nível Loft). Sem a permissão, um manequim veste as peças no lugar do avatar.
- **Encaixe**: cada vaga é um encaixe 3D num objeto real do cenário. A carta arrastada é atraída quando chega perto, e o
  encaixe mostra antes de soltar se a posição serve. Soltar confirma com um clique de som, uma pausa de um quadro e a luz
  do objeto acendendo.
- **Efeitos**: Aura Hype com anéis e partículas pela faixa; Metamorfose transforma o material do objeto na paleta da
  carta; Impersonation veste o avatar com a peça.
- **Erros** (já no servidor, `Flair3dPenalties`): vaga que recusa a carta −2; fora da posição −1 e sem efeito de Aura;
  sem sintonia −1; Hype acima do máximo −1. A luz do objeto falha em vermelho e o placar mostra os pontos perdidos;
  nada sai da carteira.
- **Vitória**: entregar com todas as vagas obrigatórias preenchidas, cada carta aceita pela vaga e os requisitos
  cumpridos. **Montagem perfeita**: sintonia de pelo menos 2 por vaga obrigatória, o que paga +10 FAI Points e a
  carta especial do jogo, quando houver.

## Capítulo A · 1 · Espelho Partido (a suíte)

- **Protagonistas**: o avatar do jogador e o Smart Mirror da suíte, rachado em sete cacos, que fala pela legenda.
- **Objetivo**: recompor o espelho com peças cuja cor dominante combine com a paleta de cada caco.
- **Cenário 3D**: a suíte à noite, só o abajur aceso. Cama, closet entreaberto e o espelho de corpo inteiro no centro,
  com os sete cacos soltos no ar diante da moldura.
- **Encaixes**: o caco central (peça inteira), os cacos esquerdo e direito (parte de cima e parte de baixo), o caco do
  chão (calçado), dois cacos do topo (acessórios) e um caco livre.
- **Entrada da carta**: o caco gira até alinhar e cola na moldura com um estalo de vidro. O reflexo do caco passa a
  mostrar a peça, e o quarto ganha um pouco mais de luz a cada caco.
- **Aura**: Hype acima de Relevante dá brilho ao caco (até +3); Metamorfose deixa o caco espelhado com a cor da carta;
  Impersonation põe o avatar diante do espelho vestindo a peça.
- **Requisitos**: três famílias de cor diferentes, uma peça de metal, quatro cartas com Hype de Nicho ou mais e cinco
  cartas no mínimo.
- **Erro visível**: caco fora de tom racha de novo e escurece o canto do quarto.
- **Recompensa**: 25 FAI Points, a moldura Prisma para o quarto e, com o espelho inteiro em harmonia, a carta
  especial Espelho Inteiro.

## Capítulo B · 31 · Prova com a Estrela (o camarim)

- **Protagonistas**: Lina Vale, estrela fictícia, com DNA de Estilo próprio; o avatar do jogador como stylist.
- **Objetivo**: vestir Lina para três eventos (coletiva, estreia e after), respeitando o DNA dela a cada prova.
- **Cenário 3D**: camarim com espelho de lâmpadas, arara, três cabides vazios e o manequim de Lina no centro.
- **Encaixes**: coletiva (parte de cima e de baixo, sóbrias), estreia (vestido), after (parte de cima, de baixo e
  acessório) e cabides extras opcionais.
- **Entrada da carta**: a peça pousa no cabide e Lina experimenta: troca de roupa atrás do biombo, volta com a peça e
  reage com expressão de aprovação ou recusa, conforme a prova.
- **Aura**: peça Viral rouba a cena (−5 de confiança, exceto no after); peças discretas ganham +1. Metamorfose
  transforma o espelho de lâmpadas na cor da peça; Impersonation põe o avatar ao lado de Lina com a mesma peça.
- **Requisitos**: dois estilos entre alfaiataria, minimalista, clássico e chique; uma cor neutra ou vermelho; todas as
  cartas com Hype de Nicho ou mais; mala de no máximo 20 pontos de peso.
- **Erro visível**: prova recusada faz Lina devolver a peça ao cabide, e as lâmpadas da metade dela apagam.
- **Recompensa**: 45 FAI Points, XP e a carta especial Prova com Lina Vale, numerada.

## Capítulo C · 43 · Rooftop ao Pôr do Sol (a cidade)

- **Protagonistas**: o avatar do jogador e o vento, que cresce a cada momento da luz.
- **Objetivo**: chegar ao rooftop com um look que funcione na luz dourada e sobreviva ao vento do anoitecer.
- **Cenário 3D**: rooftop com guarda-corpo de vidro, bar e lounge. A luz muda em três momentos (dourada, azul e noite),
  com iluminação pré-calculada para cada um, como Spider-Man 2 faz por hora do dia.
- **Encaixes**: a peça com brilho na luz dourada, a camada na luz azul, o acessório que reflete à noite, a parte de
  baixo e o calçado da foto final, e o acessório do vento e o brinde opcionais.
- **Entrada da carta**: a peça entra no avatar, e o céu avança para o próximo momento; o vento mexe a peça leve.
- **Aura**: peça em tendência brilha mais na luz dourada (até +2) e some à noite; Metamorfose tinge o céu com a paleta
  da carta; Impersonation faz o avatar posar para a foto final.
- **Requisitos**: uma parte de cima, um acessório, todas as cartas com Hype de Nicho ou mais e cinco cartas.
- **Erro visível**: a camada fora de posição voa com o vento, e a luz do bar pisca.
- **Recompensa**: 30 FAI Points, XP e a luminária Pôr do Sol.

## Capítulo D · 70 · Cinco Clientes (a boutique)

- **Protagonistas**: cinco clientes com DNA, ocasião e orçamento próprios, entre elas uma influenciadora; o avatar do
  jogador como vendedor.
- **Objetivo**: vestir as cinco com um único deck de 11 cartas, sem repetir peça entre elas.
- **Cenário 3D**: boutique com cinco provadores, araras, sapateira e balcão. É o protótipo recomendado pelo estudo de
  alternativas, porque usa todas as posições de carta.
- **Encaixes**: um manequim por cliente, com cabide, sapateira e vitrine de acessórios conforme as peças pedidas.
- **Entrada da carta**: a peça vai da arara ao manequim da cliente; ela sai do provador vestindo e reage.
- **Aura**: a faixa só importa para a influenciadora (até +2); Metamorfose acende a vitrine do provador; Impersonation
  faz o avatar apresentar o look ao lado da cliente.
- **Requisitos**: três partes de cima, três de baixo, dois calçados, um acessório e as 11 cartas.
- **Erro visível**: cliente insatisfeita devolve a peça ao balcão, e o provador dela apaga.
- **Recompensa**: 60 FAI Points e o espelho de atendimento.

## Capítulo E · 96 · Chefe: Vellard (o salão de gala)

- **Protagonistas**: Augusto Vellard, antagonista fictício que sabotou um manequim, e o avatar do jogador.
- **Objetivo**: vencer Vellard em três confrontos (imagem, evidência e roupa), sempre por estilo, nunca por força.
- **Cenário 3D**: o salão de gala e o showroom da Casa Vellard, com lustres, o manequim sabotado e o livro-caixa sobre
  a mesa.
- **Encaixes**: confronto de imagem (look de gala, calçado e acessório), de evidência (peça de arquivo e acessório com
  uso) e de roupa (a peça do DNA, o que a defende e o reforço), mais o livro-caixa opcional.
- **Entrada da carta**: cada peça entra no manequim do confronto, e Vellard responde com a dele. O lustre acima de quem
  vence a rodada acende.
- **Aura**: Vellard sabota uma carta Viral antes de entrar, salvo com Metamorfose; Impersonation põe o avatar frente a
  frente com Vellard no confronto final.
- **Requisitos**: um look de gala, uma ocasião formal ou de festa, um estilo vintage, clássico, glam, y2k, romântico ou
  grunge, todas as cartas com Hype de Nicho ou mais e mala de no máximo 20.
- **Erro visível**: carta sabotada racha no manequim, e os lustres do lado do jogador piscam.
- **Recompensa**: 80 FAI Points, XP, o monograma Vellard riscado para a vitrine e a carta especial Queda de Vellard.
