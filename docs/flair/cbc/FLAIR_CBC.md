# FLAIR: os dois segmentos e o desenho do FLAIR Card Building Challenge

Todo jogo do FashionAI se chama **FLAIR**. Há dois segmentos:

- **FLAIR 3D**: jogos em cenário 3D, com encaixe de cartas em objetos reais da cena (estudo em `docs/flair/3d-puzzles/`).
- **FLAIR Card Building Challenge (FLAIR CBC)**: montar um conjunto de cartas cujas **linhas de conexão** acendem quando
  duas cartas vizinhas têm algo em comum, no espírito do antigo SBC do FIFA 21 (jogadores da mesma liga, clube ou
  nacionalidade formavam links completos). A diferença: aqui a recompensa vai além do jogo.

Marcações: **[existe]** já está no código; **[novo]** é proposta deste desenho; **[decidir]** precisa da sua confirmação.

## 1. Onde cada jogo fica

| Segmento | Jogos | Observação |
| --- | --- | --- |
| FLAIR 3D | os cinco jogos, um por capítulo (`docs/flair/flair-3d/JOGOS.md`) | cenário 3D por ambiente; vagas viram encaixes em objetos |
| fora do FashionAI | Roubo ao Afterparty | fora da lista; código mantido para o futuro jogo de PlayStation Glass Empire |
| fora do FashionAI | Met Gala Heist | fora da lista; código mantido para o futuro jogo de PlayStation Glass Empire |
| FLAIR CBC | os cinco elencos oficiais (`CINCO_ELENCOS.md`) | substituem os 16 Desafios de Montagem oficiais, que ficam arquivados |
| FLAIR CBC | Combinações das lojas de marca | já trocam um conjunto por cupom [existe]; ganham links e o quebra-cabeça |
| FLAIR CBC | Duelo 1×1, Treino, Batalha de Ocasião, Equipes 3×3 e os 15 modos de look | [decidir] proposta: o elenco ou o look que entra na batalha é montado como um CBC, e a química dos links vira bônus na partida, como os elencos do FIFA |

## 2. A mecânica de links

**Tabuleiro.** Cada desafio tem uma formação: vagas com posição (parte de cima, parte de baixo, calçado, acessório,
peça inteira ou livre) e **linhas** que ligam vagas vizinhas, desenhadas como na formação do FIFA. [novo] Hoje a
vizinhança é só a sequência das vagas (`CbcRules.harmonious`, vaga anterior e seguinte) [existe].

**O que acende uma linha.** Seis atributos comparados entre as duas cartas da linha:

| Atributo | Igualdade que conta | Peso |
| --- | --- | --- |
| Marca | mesma marca | 2 |
| Subcategoria | mesma subcategoria (ex.: blazer com blazer) | 2 |
| Categoria | mesma categoria | 1 |
| Estilo | ao menos um estilo em comum | 1 |
| Cor | mesma família de cor ou cores em harmonia (`CbcRules.colorHarmony`) [existe] | 1 |
| Ocasião | ao menos uma ocasião em comum | 1 |

**Força da linha** pela soma dos pesos: 0 = **vermelha** (apagada), 1 = **laranja** (link parcial), 2 ou mais =
**verde** (link completo). A linha mostra quais atributos ligaram, com um ícone por atributo.

**Química da carta** de 0 a 3: cada linha verde vale 1 e cada laranja vale 0,5, arredondado para baixo e limitado a 3.
Carta **fora da posição** da vaga fica com química 0, e todas as linhas dela apagam. **Química do conjunto**: a soma das
cartas, mostrada de 0 a 100.

**Requisitos** do desafio, combinando os tipos que o motor já conhece (nível, Hype, marca, estilo, cor, posição,
quantidade de cartas) [existe] com tipos novos de link [novo]: química mínima do conjunto, química mínima por carta,
número mínimo de linhas verdes e número mínimo de linhas ligadas por um atributo (ex.: 3 linhas por marca).

## 3. Efeitos de cada entrada de carta

- **Linha verde**: a luz corre de uma carta à outra, com acorde curto; com 3 de química a carta ganha contorno aceso.
- **Linha laranja**: luz pela metade, com pulso fraco e nota única.
- **Linha vermelha**: a linha pisca vermelho e apaga, com som abafado. Erro, não punição de saldo.
- **Circuito completo** (todas as linhas verdes): pulso que percorre o conjunto inteiro e libera a peça do quebra-cabeça
  (seção 4).
- **Aura Hype**: a faixa de Hype da carta dá brilho e partículas à carta, como no FLAIR 3D.
- **Aura Metamorfose**: carta com química 3 e permissão Loft transforma a cor das linhas dela na paleta da carta.
- **Aura Impersonation**: com o conjunto completo e a permissão, o avatar veste o look montado.

## 4. Recompensas

O FIFA dava pacotes do próprio jogo. O FLAIR CBC dá cinco tipos de recompensa:

1. **Itens do FashionAI**: decoração, colecionáveis e cartas especiais. A entrega já é idempotente (`Flair3dRewards`) [existe].
2. **Cupons de desconto em lojas de marca**: o modelo de combinação já tem cupom, percentual ou valor, compra mínima,
   validade, estoque e "um por pessoa" (`FlairCombination` e `FlairRedemption`) [existe]. O desafio CBC aponta para a
   combinação, e completar o desafio emite o cupom.
3. **Itens promocionais de marcas e celebridades** [novo]: ingresso para show, meet and greet, roupa ou acessório exclusivo.
   Cada prêmio tem estoque, validade, quem entrega (marca ou celebridade validada pela administração, como os selos)
   [existe a validação], regras de elegibilidade e o estado da entrega (reservado, confirmado, entregue, expirado).
4. **Quebra-cabeça da arte exclusiva** [novo]: cada conjunto de desafios (o grupo que já existe, `FlairChallengeGroup`)
   tem uma fotografia de arte exclusiva do FashionAI, cortada em peças. Cada desafio concluído revela a sua peça no lugar
   certo, com a mesma luz das linhas. Fechar o conjunto completa a fotografia, que vira uma obra numerada no perfil
   (edição N de M). As peças não se compram nem se trocam.
5. **FAI Points e FAI XP** pelo desafio e pelo conjunto (`FLAIR_CBC_GROUP`) [existe].

**Cuidados com os prêmios reais** [decidir]:

- O público começa aos 13 anos (regra ética já escrita no FLAIR). Meet and greet e show pedem 18 anos ou consentimento
  do responsável, com conferência de idade antes de reservar.
- Prêmio distribuído por sorteio é promoção comercial e, no Brasil, pede autorização prévia (Lei 5.768/1971). A
  proposta é distribuir por mérito, por ordem de conclusão enquanto houver estoque, e não por sorteio.
- Nada é comprado para jogar: o desafio nunca pede pagamento nem aposta de coins.
- Dados de entrega (endereço, documento para ingresso) são pedidos só na hora de resgatar e só para quem ganhou.

## 5. Erros do jogador e o que custam

O erro custa química, linha e recompensa, nunca saldo da carteira (regra ética do FLAIR):

- **Carta fora da posição**: química 0 e linhas vermelhas; o requisito de química pode cair.
- **Troca que quebra um link**: a linha pisca vermelho, e a química do conjunto cai na hora.
- **Requisito não cumprido**: a entrega fica bloqueada, e a lista mostra o que falta.
- **Conjunto entregue sem circuito completo**: completa o desafio, mas não revela a peça do quebra-cabeça.
- **Posse** [decidir]: no FIFA, os jogadores entregues eram consumidos. Aqui as cartas representam peças reais do
  guarda-roupa, então a proposta é travar as cartas entregues por 72 horas naquele conjunto, sem apagar nada.
- **Ranking** [decidir]: um ranking semanal de química dos conjuntos, em que entregas com química baixa não pontuam.

## 6. Dados [novo]

- Formação do desafio: vagas com `x`, `y` e posição, e linhas `[vagaA, vagaB]`, guardadas no JSON do desafio.
- Requisitos novos: `chemistry`, `cardChemistry`, `greenLinks` e `linksBy` (atributo).
- Recompensas: os tipos `ITEM` e `SPECIAL_CARD` [existe] ganham `COUPON` (aponta para a combinação), `PROMO`
  (estoque, elegibilidade e estado da entrega) e `ART_PIECE` (peça do quebra-cabeça do grupo).
- Grupo: a arte do quebra-cabeça, o número de peças (um por desafio) e a edição.

## 7. Plano

1. Motor de links puro no servidor (`CbcLinks`): força por linha, química por carta e do conjunto, requisitos novos,
   com testes. Cópia em JS para o modo de simulação.
2. Tela do desafio: formação com linhas acesas e ícones dos atributos, painel de química e lista de requisitos.
3. Recompensas: `COUPON` ligado às combinações, `PROMO` com estoque e elegibilidade, e quebra-cabeça do grupo.
4. Conversão dos Desafios de Montagem atuais para formações com linhas.
5. Se aprovado, a química do elenco entra nas batalhas.
