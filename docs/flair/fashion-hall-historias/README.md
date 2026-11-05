# Fashion Hall — as histórias dos dois primeiros portais

Documento de narrativa (sem código) para a evolução do Meu Quarto em **Fashion Hall & Runway**: o quarto deixa de ser
só uma vitrine de colecionáveis e passa a ser o saguão de onde a pessoa entra em portais de jogo. Os dois primeiros
portais, abertos no nível básico, são:

| Portal | Nome interno | Nome na tela | Gênero | Documento |
|---|---|---|---|---|
| 1 | Oscar Winner | **Noite Aurum** | drama de bastidores com infiltração leve, contra o relógio | [oscar-winner-noite-aurum.md](oscar-winner-noite-aurum.md) |
| 2 | MET Gala Heist | **Gala Lumière** | ação furtiva (o jogo que já existe em `components/heist` e `lib/heist`) | [met-gala-heist-gala-lumiere.md](met-gala-heist-gala-lumiere.md) |

As regras do deck nos dois portais (quantas cartas, orçamento de mala, requisitos mínimos, cartas-chave, momentos
críticos e o papel do Hype) estão em [deck-de-cartas.md](deck-de-cartas.md). O conceito do próprio Hall (o sentido do quarto além da decoração,
o corredor dos portais, a procedência dos itens, a ligação com o Aurora CPS, o rascunho do RF55 Smart Mirror em casa e a
decisão web × nativo) está em [fashion-hall-o-saguao.md](fashion-hall-o-saguao.md).

**Glass Empire (05/11/2026).** O Meu Quarto deixa de ser área própria e vira componente do jogo Glass Empire; o
estudo com 100 ideias de jogos FLAIR para esse mundo está em [`../glass-empire-100-jogos/`](../glass-empire-100-jogos/README.md).

Os Desafios de Montagem e as Partidas FLAIR continuam no sistema de cartas; os portais do Hall ficam com a parte de
ação. O deck de cartas é o mesmo nos dois mundos: o que a pessoa coleciona no app é o que ela veste e usa no jogo.

## Um universo, um arco

As duas histórias acontecem no mesmo ano e com os mesmos personagens; a segunda paga o que a primeira planta.

```
março · Noite Aurum                                  maio · Gala Lumière (Museu Vesper)
───────────────────────────────────────────────────  ───────────────────────────────────────────────────
Lina Vale indicada → vestido da Casa Vellard          Íris prova que o diamante exposto na gala é a
rasgado → a Estilista a veste em 72 h → o quarto      Estrela do Norte, tirada do ateliê de Celina na
é arrombado, somem a peça de arquivo de Dona           noite do arrombamento → a Estilista entra na gala
Celina e o caderno de medidas → o look nasce no        para recuperar o diamante e o livro-caixa que prova
espelho, ao vivo → Íris mostra o catálogo da           a fraude → Vellard cai; a peça de Celina volta ao
exposição com um diamante "de colecionador anônimo"   museu com o nome dela e vira a primeira carta do
                                                       Hall com procedência
```

**Antagonista único:** Augusto Vellard, dono da Casa Vellard, uma maison que perdeu relevância e tenta recuperá-la
com sabotagem, vazamento de dados e fraude de seguro. Ele nunca é um chefe de fase que se enfrenta à bala; é derrotado
por evidência, imagem e roupa, que é o que o produto FashionAI faz.

**Tema comum:** a roupa é interface. Na Noite Aurum ela mede a plateia e protege quem veste; na Gala Lumière ela
esconde ou denuncia. É a mesma ideia do [Aurora CPS](../../aurora_cps/aurora-cps-fashion-gaming.md), contada como
ficção.

## Personagens recorrentes

| Personagem | Quem é | Jogo 1 | Jogo 2 |
|---|---|---|---|
| **A Estilista** (protagonista jogável) | o avatar da pessoa, saído do Meu Quarto; estilista independente, ex-aprendiz de Dona Celina | veste Lina em 72 h | invade a gala para recuperar a Estrela do Norte |
| **Lina Vale** | atriz fictícia (já existe em `lib/heist/dialogue.ts`), indicada à Noite Aurum por *A Costura do Silêncio* | cliente e amiga | coloca a Estilista na lista da gala; é detida no apagão |
| **Íris Monteiro** | curadora do Instituto do Traje do Museu Vesper | empresta a peça de arquivo de Celina | revela a procedência do diamante; recebe o livro-caixa |
| **Davi** | bartender; no hotel em março, no Grande Salão em maio; "revendedor por baixo do balcão" | ouve e conta quem está pagando os fornecedores | dica da chave de Marcos e da caixa de fusíveis (já no jogo) |
| **Augusto Vellard** | dono da Casa Vellard | sabota o vestido, compra fornecedores, rouba a peça | expõe o diamante lavado, planeja o autorroubo |
| **Marcos** | chefe de segurança contratado por Vellard (já no jogo) | aparece uma vez, escoltando Vellard | antagonista físico da gala |
| **Dona Celina Rocha** | costureira, mentora da Estilista; autora do vestido *Estrela do Norte* (1987), com um diamante no engaste do decote | aparece em fotos e numa ligação | o ateliê dela pega fogo no apagão; recebe a peça de volta |
| **Bia** | amiga da Estilista, da cena de abertura | a "missão menor" | manda a mensagem final |
| **Tomás Reis** | repórter de moda | publica as manchetes que derrubam e depois levantam o Hype de Lina | publica a fraude de Vellard |

## Convenções das cutscenes

- **Numeração:** `CS-O-nn` (Oscar Winner) e `CS-M-nn` (MET Gala Heist). Cada ficha traz local, duração, câmera, roteiro,
  **o que conta** (o que a cena revela, planta ou paga) e **gancho** (o que muda no jogo ao terminar).
- **Dois formatos:** *cena de corte* (jogador assiste; sempre pulável com Esc/B, com legendas e faixas de cinema, como
  já faz `mission.ts` com os `Beat`) e *cena jogada* (o controle continua com a pessoa, a história acontece em volta).
  As cenas jogadas estão marcadas.
- **Variantes:** algumas cenas têm versões conforme a escolha do jogador (credencial, deck, final). Mesmo custo de
  produção: trocam falas e um ou dois enquadramentos, não o cenário.
- **O rosto da pessoa nunca aparece.** O avatar aparece de costas, no reflexo do espelho ou com a câmera por trás do
  ombro, coerente com a Prévia 2D do Espelho e com a regra de que a imagem no espelho é projeção, não foto.
- **Duração total:** até 12 minutos de cenas por jogo, nenhuma acima de 90 s, exceto a cena jogada do clímax.

## Pessoas e fatos reais

Regra herdada do que o heist já faz (Lina Vale é fictícia; o placar da Sala das Joias cita uma pessoa real como fato):
**pessoas reais aparecem apenas como fatos de arquivo** (manchetes, capas, placas de museu, telões, falas de rádio),
nunca como personagens com diálogo, alvos ou vilões. Isso respeita o direito de imagem (art. 20 do Código Civil) e dá
autenticidade. Cada documento lista as âncoras reais usadas e onde entram; **datas e nomes devem ser conferidos antes
de virar texto de jogo**.

## Como isso encosta no código que existe

- O heist já tem objetivos em 4 blocos e 9 subobjetivos (`lib/heist/mission.ts`), uma cena curta por subobjetivo e
  a cena longa do diamante; as fichas `CS-M` mapeiam uma a uma nesses pontos.
- Os quatro finais (`endingOf` em `lib/heist/goals.ts`) ganham consequência narrativa própria na `CS-M-10`.
- Os efeitos do deck (`AfterpartyMods.java`) e os usos das cartas (`lib/heist/cards.ts`) são a base da seção
  "Recursos e roupas" de cada documento; nada ali exige mudar o motor, só textos e cenas.
- A Noite Aurum é um jogo novo; o documento dele descreve mecânicas em termos de produto, não de implementação.
