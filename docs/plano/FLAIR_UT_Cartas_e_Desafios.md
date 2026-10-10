# FLAIR-UT — refatoração do FLAIR: cartas por nível, Desafios de Montagem e cartas especiais

Pedido de 07/10/2026, que entra como **próximo item** do plano mestre (seção 10). Este documento é a especificação.
O plano mestre guarda a ordem e o resumo.

O pedido tem quatro partes:

1. **Anatomia.** Uma seção nova na prancha de anatomias de cards, "FLAIR game card design", com quatro conceitos de
   carta (bronze, prata, ouro e especial). A frente mostra os números do Hype em linha, como as cartas do FC UT, com a
   imagem, o nome e a marca da peça no centro.
2. **Navegação e modos.** Uma seção própria do FLAIR na barra lateral, com as modalidades separadas (batalhas,
   multijogador, momentos…) e um modo novo, **Card Building Challenges**, só com as cartas FLAIR. Cada desafio monta um
   **cenário FashionAI coerente com o título**, e cada carta entra contando uma parte da história.
3. **Recompensas.** De FAI Points a prêmios físicos de marca, cartas especiais, itens da loja do quarto e do
   guarda-roupa e, depois de estudo, dinheiro.
4. **Cartas especiais.** Vendidas na loja e ganhas nos jogos, nos momentos, nos desafios e nos perfis de celebridades e
   marcas, pela política de selos.

Um segundo pedido, também de 07/10, acrescenta três pontos, estudados nas seções 12 e 13:

5. **Carta com selo vira FLAIR Especial** pelo botão "Converter para FLAIR" (§12).
6. **Mercado de transferências** parecido com o do FC UT, mas pago só em **FAI Points**. No modal de detalhe da peça
   entra o botão "Inserir no mercado de transferência", com preço. Na prática, dá para comprar cartas FLAIR de outras
   pessoas (§13).
7. **Duas cartas.** Converter **duplica** a carta: a original fica no guarda-roupa e pode ser publicada no feed social
   do FashionAI; a cópia FLAIR vai para a sub-aba "Minhas cartas FLAIR" (§5 e D11). O botão Compartilhar, que não
   funcionava, foi corrigido no mesmo dia e publica no feed (item SHARE-FIX do plano mestre).

---

## 1. O que existe hoje (reconferência do código, 07/10)

| Peça | Onde | O que faz hoje |
|---|---|---|
| Tela do FLAIR | `app/(site)/(app)/flair/page.tsx` | Uma página com abas (modos, jogar, cartas, decks, lojas, carteira, quests) e um item "FLAIR" no grupo **Jogar** da barra lateral (`components/app-shell.tsx`) |
| Carta | `components/flair/flair-card.tsx` | Moldura pela **raridade** (STANDARD, PREMIUM, LIMITED, RARE), foto, poder, 6 atributos de jogo em **barras** (EDGE, RANGE, CLOUT, GLOW, ART, SYNC) e uma habilidade |
| Motor | `FlairEngine.java` | Atributos a partir de estilos, ocasiões, marca, selos, foto, 3D e estação. A raridade vem do **Hype v2 público** (dimensão RARITY e faixa). **O preço foi tirado de propósito (RF53 · P2-18, sem pay-to-win)** |
| Origem das cartas | `GET /api/flair/cards` | Toda peça do guarda-roupa vira carta automaticamente (sem gesto da pessoa) |
| Modos | `FlairModesService.java` | 15 modos: Battle of Looks, Squad, League, World Tour, Conquest, Deck Battle, Wardrobe Wars, Runway, Draft, Tag Team, Boss, Combo, Monopoly, Chess, Ultimate Team; e mais duelo 1×1, arena, treino e equipes 3×3 |
| Economia | `/api/flair/me` | Moedas, ranking, skins de carta, missões diárias e semanais, vouchers e combinações de marca que viram cupom |
| Hype | `lib/hype/model.ts` | O verso do card mostra **7 dimensões**: Popularidade, Engajamento, Trend, Originalidade, Raridade, Longevidade, Novidade (+ Velocidade e Influência na análise completa). Sem dado aparece "—", nunca 0 |
| Prancha de anatomias | `docs/anatomias/anatomias_card_v18.html` | Seções 0 (sistema), A (entidades e anatomias base), B (variações do look), **C (anatomias da peça)**, D (estados) |
| Selos | `Seal`, `SealBond`, `SealTier` | Selos de marca e celebridade com tiers, disponibilidade e validade |
| Loja do guarda-roupa | itens com preço, disponibilidade e validade | Armários, componentes e guarda-roupas inteiros de marca ou celebridade |
| Desafios (RF) | `/challenges` | Desafios de uso do guarda-roupa ("use X peças em 7 dias"). **Não confundir** com os Desafios de Montagem |

**Leitura do pedido sobre a "seção C".** Na prancha v18 a seção C já é "Anatomias da peça". A seção nova do FLAIR entra
como **seção E**. Entendi "somente estas cartas da seção C" como **somente as cartas FLAIR da seção nova**: os desafios
nunca aceitam outros cards. Se a intenção era limitar os desafios a **cartas de peças**, isso vira um requisito
configurável por desafio ("só cartas de peça"), sem mudar o resto.

---

## 2. Decisões de design (com o porquê)

| # | Decisão | Por quê |
|---|---|---|
| D1 | **Nível** (Bronze, Prata, Ouro, Especial) e **raridade** viram dois eixos. O nível vem do formulário, principalmente **preço e marca**, como pedido. A raridade continua vindo do Hype público e aparece como **acabamento "raro"** (brilho, ornamento) sobre o metal, como "ouro comum" × "ouro raro" | Atende ao pedido sem apagar a regra RF53 · P2-18: o **valor de coleção** (nível) pode vir do preço, mas a **raridade** continua sendo mérito (Hype) |
| D2 | **Nota FLAIR (OVR, 0–99)** na carta, que define o nível: **Bronze < 65 · Prata 65–74 · Ouro ≥ 75**. Especial: 80–99, só por programa | Os mesmos cortes que o público conhece das cartas de futebol; um número só para comparar |
| D3 | A frente mostra o **Hype em números em linha**: as 7 dimensões do verso (POP, ENG, TRD, ORI, RAR, LON, NOV) + **HYP** (o Hype Score), em 2 colunas de 4. Sem Hype público: "—", nunca 0 | É o pedido ("as mesmas stats do verso") e mantém a regra do Hype |
| D4 | Os **atributos de jogo** (EDGE, RANGE, CLOUT, GLOW, ART, SYNC) e a habilidade vão para o **verso da carta FLAIR**. As batalhas continuam usando esses atributos | As 15 modalidades não quebram. A frente vira "identidade e valor", o verso "como joga" |
| D5 | **Cartas só existem quando a pessoa gera**: "Gerar como FLAIR" no criador ou "Converter para FLAIR" no detalhe da peça ou do look. Quem já joga ganha a ação "Converter meu guarda-roupa", com limite diário | É o pedido; a carta passa a ser um objeto colecionável com data, temporada e número |
| D6 | **Uma carta por peça por temporada.** Gerar de novo na mesma temporada só atualiza o Hype; na temporada seguinte nasce uma edição nova | Evita imprimir cartas infinitas da mesma peça para gastar em desafios |
| D7 | Carta entregue num desafio **fica bloqueada** com o selo "Entregue em ‹desafio›": continua no perfil como memória, sai do uso. **A peça nunca é apagada** | O "consumo" das cartas do FC UT sem tirar nada do guarda-roupa da pessoa |
| D8 | **Preço verificado.** O preço que conta no nível vem da faixa do produto na Busca Catalogada ou da faixa da marca. Preço digitado fora da faixa é limitado ao teto da faixa, e preço sem confirmação **não passa de Prata** | O nível depende do preço, então o preço não pode ser só digitado; prêmio físico atrai fraude |
| D9 | **Nada de pacote aleatório pago.** Carta especial é vendida como **ela mesma** (vê o que compra), com tiragem numerada | Lei 15.211/2025 (ECA Digital) proíbe caixas de recompensa em jogos acessíveis a crianças e adolescentes. As lojas exigem chances publicadas. Ver §9 |
| D10 | **Nomes e arte próprios.** A inspiração é a estrutura das cartas do FC, mas sem os nomes "FC", "UT", "SBC" nem a arte da EA. O modo se chama **Desafios de Montagem** (CBC, de *Card Building Challenges*) | Marcas registradas de terceiros |
| D11 | **Duas cartas.** O **original** (o card da peça ou do look) fica no guarda-roupa: é o post social, publicado no feed, curtido e comentado, e **nunca** vai ao mercado. A **cópia FLAIR** é um objeto de jogo com foto, nome, marca, nota e nível congelados na geração: joga, entra em desafios e pode ser negociada | É o pedido ("a carta é duplicada"). Separa o que é da pessoa (a peça) do que circula (a carta) |
| D12 | **Mercado só em FAI Points.** Nada de dinheiro: não se compra ponto, não se saca ponto. Carta comprada com dinheiro na Loja FLAIR é **intransferível** | Mantém o RF35.CA08 ("FAI Points nunca são vendidos"); sem a regra, dinheiro → carta → pontos viraria venda de pontos |
| D13 | **Faixa de preço** por nível e nota e **taxa de 5 %** em cada venda, que sai de circulação. Opcional: 2 % dos 5 % vão para quem criou a carta | A faixa impede passar pontos de uma conta para outra com uma carta qualquer a preço absurdo. A taxa segura a inflação de pontos |
| D14 | **Vendedor anônimo, sem chat.** O anúncio só tem dados estruturados (carta, preço, prazo). A carta mostra quem a criou (perfil público) e quantos donos já teve | Evita assédio, combinação fora do app e golpe; protege menores |
| D15 | **Um selo, uma carta especial.** O vínculo de selo aprovado dá direito a **uma** carta Especial do programa daquele selo, com número da tiragem | O selo vira o "ingresso" da carta especial, sem imprimir cartas infinitas |
| D16 | **Trocas não sobem nível.** Débito e crédito do mercado entram no extrato com `counts_lifetime = false` | O nível de FAI Points mede uso do app; trocar entre contas próprias não pode subir de nível |

---

## 3. Seção E da prancha — "FLAIR game card design"

### 3.1 Anatomia da frente (os quatro níveis compartilham)

```
┌──────────────────────────────┐
│ 82   [logo da marca]   ☀︎     │  ← OVR (nota FLAIR) · marca · estação
│ CAL                          │  ← posição: SUP / INF / CAL / ACE / VES / LOOK
│                              │
│        [ foto da peça ]      │  ← recorte de estúdio, centro, 55% da altura
│                              │
│      TÊNIS CASUAL AERO       │  ← nome (caixa alta condensada)
│         Norte Sport          │  ← marca (texto, além do logo)
│ ──────────────────────────── │
│ 84 POP   77 RAR              │  ← Hype em números em linha, 2 colunas × 4
│ 81 ENG   72 LON              │
│ 88 TRD   69 NOV              │
│ 64 ORI   83 HYP              │
│ ───── OURO · RARA ·  FAI ─── │  ← nível + acabamento + marca FashionAI
└──────────────────────────────┘
```

- Proporção 5:7, com a mesma escala de densidade da prancha: compacto (grade, 160 px), padrão (240 px) e ampliado
  (detalhe, 360 px).
- **Posição** (como a posição do jogador): SUP superior, INF inferior, CAL calçado, ACE acessório, VES peça inteira,
  LOOK look. Na carta de look, a foto é a arte do look (AURA) e a posição é "LOOK".
- Números tabulares, com a sigla depois do número. Cada sigla tem `title` e rótulo para leitor de tela com o nome
  inteiro ("Popularidade 84").
- **Acessibilidade.** O nível também vem escrito (nunca só pela cor); contraste mínimo 4,5:1 entre os números e o metal.
  O texto alternativo completo fica assim: "Carta FLAIR Ouro rara, nota 82, Tênis Casual Aero, Norte Sport".
- **Verso** (o botão ↻, mesmo padrão do FashionCard): atributos de jogo em barras, habilidade, temporada, origem
  ("Gerada no criador · 07/10/2026"), número da edição, estado ("Disponível", "Entregue em ‹desafio›").

### 3.2 Os quatro conceitos

| Nível | Material e cor | Acabamento "raro" (Hype) | Quando aparece |
|---|---|---|---|
| **Bronze** (OVR < 65) | Cobre fosco escovado (#8C5A3C → #C58A5A), tinta escura | Filete de cobre polido nas bordas e um brilho discreto no topo | Peças de entrada, sem marca ou com preço baixo |
| **Prata** (65–74) | Prata escovada fria (#9DA3AA → #E3E6EA), tinta grafite | Reflexo em faixa diagonal e cantos gravados | Marcas de varejo e preço médio |
| **Ouro** (≥ 75) | Ouro (#B8860B → #F2C94C → #FFF3C4), tinta quase preta | Brilho que corre a carta (parado com "reduzir movimento") e moldura ornamentada | Marcas premium ou preço alto, verificado |
| **Especial** (80–99, só por programa) | Arte do programa: evento (pôr do sol holográfico no "Verão Solar"), celebridade (preto + dourado + cor da era), marca (paleta da marca), momento (moldura de foto) | Sempre: folha holográfica, número da tiragem ("0137/1000") e selo do programa | Loja, jogos, momentos, desafios e selos de celebridade ou marca (§7) |

A seção E da prancha mostra, para cada nível, os estados abaixo, com os mesmos dados de exemplo (marcas fictícias e
foto de produto, nunca rosto de pessoa):

- frente e verso;
- compacto, padrão e ampliado;
- sem Hype público ("—");
- preço não verificado ("Prata máx." com ícone);
- entregue em desafio (dessaturada, com o selo);
- celular.

---

## 4. Nota FLAIR e nível (motor puro, testável)

`lib/flair/tier.ts` no cliente (prévia no criador) e `FlairTier.java` no backend (fonte da verdade), com o mesmo
conjunto de testes nos dois:

```
OVR = 45 + 30·preço + 18·marca + 6·acabamento        (arredondado, limitado a 45–92 para cartas geradas)
```

- **preço (0–1).** Posição do preço **verificado** na faixa da subcategoria (p25, p50, p75, p95 da tabela
  `price_band`, alimentada pela Busca Catalogada), em escala log: abaixo do p25 vale 0, no p95 ou acima vale 1.
- **marca (0–1).** Tier da marca no cadastro de marcas: luxo 1,0 · premium 0,75 · contemporânea 0,5 · varejo 0,25 · sem
  marca ou desconhecida 0,1. Marca verificada na plataforma ganha +0,05.
- **acabamento (0–1).** Campos completos (estilos, ocasiões, cor, material), foto de estúdio aprovada, modelo 3D. É um
  peso pequeno de propósito: nunca leva sozinho a peça de um nível ao outro.
- **Look.** Média ponderada das notas das peças + bônus de sintonia (até +4).
- **Antifraude (D8).** Preço sem confirmação fica limitado ao p75 e a carta fica no máximo Prata. Ouro com preço
  digitado vai para revisão (fila do admin). Há também limite de gerações por dia.
- **Exemplos para os testes.**
  - Camiseta sem marca a R$ 39: Bronze ~52.
  - Tênis de varejo a R$ 399 com preço confirmado: Prata ~68.
  - Bolsa premium a R$ 1.900 com preço confirmado: Ouro ~80.
  - Bolsa premium a R$ 1.900 com preço digitado e sem confirmação: Prata 74 + aviso.

---

## 5. Onde a pessoa gera e guarda as cartas

- **Criadores** (peça, look e DNA de estilo). Na etapa final ("Revisar e salvar") entra o interruptor **"Gerar como
  carta FLAIR"**. Ele mostra a **prévia da carta** com nível e nota em tempo real, e uma linha "o que decide o nível:
  preço R$ 399 (confirmado no catálogo) · marca Norte Sport (varejo)". A carta nasce junto com o item salvo.
- **Detalhe ampliado** da peça ou do look (o modal). O botão **"Converter para FLAIR"** abre a mesma prévia. Se a carta
  já existe na temporada, ele vira **"Ver carta FLAIR"**.
- **Converter duplica (D11).** O card do guarda-roupa continua onde está, com as curtidas, os comentários e o botão
  Compartilhar (publica no feed social do FashionAI). A carta FLAIR é uma **cópia** e vai para "Minhas cartas FLAIR".
  - A cópia guarda a origem (peça ou look) e quem a criou ("criada por @ana"). Ela mostra o Hype **ao vivo** do original
    (se o original for público) e, no verso, os números do dia da geração.
  - Apagar a peça não apaga cartas já geradas: elas passam a mostrar "peça original removida" e perdem o link.
  - Vender a carta não mexe na peça: ela continua no guarda-roupa de quem a criou.
  - A regra D6 vale para a peça, não para a dona: vendida a carta da temporada, a mesma peça só gera outra na
    temporada seguinte.
- **Bloco FLAIR no detalhe** (só para a dona), abaixo das ações do post:

  | Estado da carta da peça | O que o bloco mostra |
  |---|---|
  | Sem carta na temporada | "Converter para FLAIR" e "Converter e anunciar" |
  | Carta disponível | "Ver carta FLAIR" e **"Inserir no mercado de transferência"** (§13.2) |
  | Carta anunciada | "No mercado · 2.400 pts · termina em 3 h" e "Retirar do mercado" (só sem lance) |
  | Carta entregue em desafio | "Entregue em ‹desafio›", sem mercado (D7) |
  | Carta vendida | "Carta vendida em 07/10 · a peça continua com você" |
  | Selo aprovado sem carta especial emitida | "Converter para FLAIR Especial" em destaque (§12) |
- **Perfil → sub-aba "Minhas cartas FLAIR"**, ao lado de Closet, Looks, Publicações etc.
  - Separada por nível: Bronze, Prata, Ouro e Especial, com contagem.
  - Filtros por posição, marca, temporada, estado (disponível, entregue, no mercado) e origem (gerada por mim,
    comprada, ganha).
  - Álbum da temporada e progresso.
  - Visitantes veem as cartas públicas; as de itens privados aparecem só para o dono.
- O hub do FLAIR também tem "Minhas cartas", com o mesmo componente.

---

## 6. FLAIR na barra lateral

O FLAIR sai do grupo "Jogar" e ganha **grupo próprio** na barra lateral (no celular, um grupo que abre e fecha; a barra
inferior não muda):

| Item | Rota | Conteúdo |
|---|---|---|
| Início | `/flair` | Temporada, eventos ativos, missões do dia, cartas novas, atalhos |
| Batalhas | `/flair/batalhas` | 1×1, Arena (ocasião), Treino, Boss, Combo, Chess, Draft, Deck Battle, Battle of Looks |
| Multijogador | `/flair/multijogador` | Equipes 3×3, Liga, Squad, Tag Team, Wardrobe Wars, Conquest, World Tour, Monopoly, Runway, Ultimate Team |
| Momentos | `/flair/momentos` | Modo novo (§6.1) |
| Desafios de Montagem | `/flair/desafios` | Modo novo (§7) |
| Minhas cartas | `/flair/cartas` | Coleção por nível (o mesmo componente da sub-aba do perfil) |
| Decks | `/flair/decks` | Como hoje |
| Mercado | `/flair/mercado` | Mercado de transferências (§13): buscar, meus anúncios, lances, observando e histórico |
| Loja FLAIR | `/flair/loja` | Cartas especiais, skins e combinações de marca |
| Recompensas | `/flair/recompensas` | Carteira, vouchers, cupons, prêmios físicos e histórico de entregas |
| Missões | `/flair/missoes` | Diárias, semanais e de evento |

Os links antigos (`/flair?tab=…`) redirecionam. O grupo "Jogar" fica com Desafios (os de uso do guarda-roupa), Pontos,
Destaques e Cupons.

### 6.1 Momentos (modo novo)

Cada momento recria um **momento de moda**: o look de uma era de celebridade, o desfile de uma coleção de marca, um
"look do dia" que viralizou. A pessoa recebe um **objetivo curto com as próprias cartas**, por exemplo "Recrie a Era
Neon com 3 cartas rosas e ENG ≥ 70", e ganha a **carta especial daquele momento** ou pontos. Os momentos saem das Eras
(celebridades) e das Coleções (marcas) que já existem, com aprovação do examinador quando usam arte de terceiros.

---

## 7. Desafios de Montagem (CBC)

### 7.1 Regras

- **Só cartas FLAIR**, disponíveis (D7). Cada desafio tem de 3 a 11 **vagas** e requisitos.
- **Requisitos** (uma pequena linguagem validada no servidor):
  - quantidade de cartas;
  - nível mínimo, máximo ou exato (por vaga ou no total, como "exatamente 2 Ouro" ou "só Bronze");
  - nota mínima ou média;
  - **sintonia** mínima (§7.2);
  - mesma marca (n cartas) ou n marcas diferentes;
  - posição por vaga;
  - cor, estilo, ocasião ou estação (taxonomia);
  - número de Hype ("TRD ≥ 80 em 2 cartas");
  - origem (só peças, só looks, especiais aceitas ou não).
- **Dificuldade.**
  - Fácil: 3–4 cartas, sem nível.
  - Médio: 5–6 cartas, nota mínima.
  - Difícil: 7–8 cartas, sintonia e níveis.
  - Lendário: 11 cartas, vários requisitos; costuma ser um grupo de desafios.
- **Tipos.**
  - Avulso.
  - Repetível, com limite.
  - **Grupo**: vários desafios cujo conjunto dá a recompensa grande.
  - **Sazonal ou evento**: janela de datas, tema e itens de edição limitada.
- **Entrega.** O servidor valida tudo de novo, bloqueia as cartas (D7), gera a **história** e concede as recompensas
  numa transação só. Se algo falhar, nada é aplicado.

### 7.2 Sintonia (o "entrosamento" do FLAIR)

Cada carta soma de 0 a 3 pontos de sintonia (total máximo = 3 × vagas):

- **+1 posição certa.** A posição da carta é a que a vaga pede ("o calçado no calçadão").
- **+1 vizinhança.** Ela combina com uma carta vizinha no cenário: mesma marca, mesma família de estilo ou cores em
  harmonia (a paleta do motor de combinações).
- **+1 tema.** Ela combina com o tema do desafio (estação, ocasião ou estilo do título).

Os combos e a sinergia de estilo do `FlairEngine` são reaproveitados; o desafio só muda os pesos.

### 7.3 Cenários com história

Diferente do campo de futebol do FC, cada desafio é um **cenário FashionAI ilustrado**, com as vagas posicionadas onde
a cena acontece. Cada carta colocada acende a sua parte do cenário e escreve uma linha da história, a partir de modelos
por vaga, preenchidos com os dados da carta. Os modelos são determinísticos e traduzidos; a IA só entra depois, como
polimento opcional.

| Cenário | Dificuldade | Vagas (posição pedida) | Linha de exemplo |
|---|---|---|---|
| **Verão em Ipanema** | Fácil · 3 | Calçadão (CAL), Guarda-sol (ACE), Quiosque (SUP) | "No calçadão, o ‹Tênis Aero› da ‹Norte Sport› aguenta o sol do meio-dia." |
| **Primeiro dia de estágio** | Fácil · 4 | Recepção (SUP), Elevador (INF), Mesa (ACE), Reunião (CAL) | "Na reunião das 10h, ninguém tirou o olho do ‹mocassim›." |
| **Brechó de tesouros** | Fácil · 5 · **só Bronze** | Arara, Provador, Espelho, Caixa, Sacola | "Na arara do fundo, a ‹camiseta› de R$ 39 vira a peça da semana." |
| **Festival de música** | Médio · 5 · 2 da mesma marca | Portão, Palco, Food truck, Área VIP, Saída | "Na frente do palco, a ‹jaqueta› brilha com as luzes." |
| **Casamento no campo** | Médio · 5 · nota ≥ 68 | Cerimônia, Fotos, Jantar, Pista, Despedida | — |
| **Viagem a Paris** | Médio · 6 · 3 marcas diferentes | Aeroporto, Café, Museu, Margem do Sena, Metrô, Terraço | — |
| **Inverno na serra** | Médio · 5 · sazonal (inverno) | Estrada, Lareira, Trilha, Fondue, Mirante | — |
| **Carnaval** | Médio · 6 · evento | Concentração, Bloco, Bateria, Camarote, Dispersão, Ressaca | — |
| **Noite de gala no tapete vermelho** | Difícil · 7 · 3 Ouro · sintonia ≥ 15 | Chegada, Tapete, Parede de fotos, Escadaria, Salão, Camarim, After | "Na parede de fotos, os flashes param na ‹bolsa› da ‹Atelier Lumi›." |
| **Desfile da coleção cápsula** | Difícil · 8 · mesma marca ≥ 4 | Backstage, Maquiagem, Passarela 1–4, Final, Imprensa | (cenário em 3D na fase F9, com o motor de cenas da Passarela) |
| **Loja pop-up de bairro** | Difícil · 7 · sintonia ≥ 14 · só peças | Vitrine, Balcão, Arara, Provador, Caixa, Calçada, Vizinhança | — |
| **Lenda do estilo** | Lendário · grupo de 4 desafios | — | Recompensa: carta **Especial** da temporada |

A primeira versão dos cenários é **2D em camadas SVG**: fundo, objetos e vagas com coordenadas, com o mesmo cuidado de
contraste e redução de movimento do resto do app. O cenário em 3D usa o motor de cenas
(`lib/scene3d/`, seção 9 do plano) e entra na fase F9.

---

## 8. Recompensas

| Tipo | Exemplos | Como é entregue |
|---|---|---|
| **FAI Points** | por desafio, momento, missão | crédito imediato no extrato de pontos |
| **Cartas especiais** | carta do evento, da celebridade, do momento | entram em "Minhas cartas" com número da tiragem |
| **Itens da loja do guarda-roupa e do quarto** | armários, cadeiras, espelhos, cabides, tapetes, **ambientes únicos** do FashionAI, de marcas ou de celebridades | entram no inventário do quarto e do guarda-roupa (o mesmo da loja do guarda-roupa) |
| **Skins e molduras** | moldura de evento, verso animado | inventário do FLAIR |
| **Cupons de marca** | desconto na coleção de verão | carteira de cupons (o fluxo do RF25 que já existe) |
| **Prêmios físicos de marca** | camiseta, bolsa, mochila, óculos, **retirados em loja** | estoque por prêmio, código de retirada com validade, loja de retirada, confirmação pela marca. **Só com patrocínio da marca e o regulamento da promoção (§9)** |
| **Dinheiro** | — | **Em estudo (§9). Não entra na implementação antes do parecer** |

Toda recompensa vira um registro de **entrega** com tipo, estado (pendente, entregue, retirada, expirada, cancelada) e
trilha de auditoria. O prêmio físico tem ainda estoque e prazo.

---

## 9. Cartas especiais, selos e o que precisa de estudo

### 9.1 Canais das cartas especiais

- **Loja FLAIR.** Compra direta da carta escolhida (D9), com FAI Points ou dinheiro, pela política de compras do app.
- **Jogos FLAIR.** Recompensa de temporada, de liga ou de chefe (todos os modos).
- **Momentos.** A carta do momento recriado.
- **Desafios de Montagem.** Grupos e desafios lendários.
- **Perfis de celebridades e marcas, pela política de selos.** O selo, além da visibilidade no perfil, pode **conceder a
  carta especial** da cantora, do cantor ou da marca. Exemplo: o look que ganha o selo da Era Neon recebe a carta
  especial "Luma Vale · Era Neon · 0042/500".
  - O programa nasce no painel da marca ou celebridade, com arte, tiragem, janela e regra de concessão.
  - Passa pelo **examinador** (EXAM-1) antes de publicar.
  - Usa o `SealBond` como gatilho.

### 9.2 Pontos que exigem estudo antes de implementar

São itens de produto e jurídicos, não de código. Os textos abaixo são o mapa do que perguntar, **não parecer
jurídico**.

- **Dinheiro como prêmio.**
  - Prêmio em dinheiro de jogo em que se paga para participar (carta comprada) e há sorte envolvida pode ser enquadrado
    como **aposta** (Lei 14.790/2023).
  - A distribuição gratuita de prêmios como promoção comercial depende de **autorização prévia do Ministério da
    Fazenda** (Lei 5.768/1971).
  - As lojas de aplicativos têm regras próprias para jogos com dinheiro real.
  - Exige ainda verificação de identidade, impostos sobre prêmio e prevenção à lavagem de dinheiro.
  - **Recomendação:** começar por cupom de marca e prêmio físico patrocinado. Dinheiro só depois de parecer jurídico e
    da política de transações financeiras do FashionAI.
- **Prêmios físicos.** Regulamento por promoção, com período, critérios, estoque e retirada, e a autorização quando a
  modalidade exigir. Desafio que depende só de habilidade e não exige compra é mais simples de enquadrar.
- **Menores de idade.**
  - A Lei 15.211/2025 (ECA Digital) proíbe caixas de recompensa (loot boxes) em jogos para crianças e adolescentes ou de
    acesso provável por eles. Daí a D9: venda só da carta escolhida, nada aleatório pago.
  - Compras e prêmios precisam de verificação de idade e de controle parental onde se aplicar.
- **Imagem de celebridades e marcas.** Carta especial com foto ou nome de artista ou marca exige **licença de uso de
  imagem e de marca** do titular. Até lá, no TCC, só marcas e artistas fictícios.
- **Loja de aplicativo.**
  - Item digital vendido no app (carta especial, FAI Points) usa a cobrança da loja, com regras e taxas que mudam por
    região.
  - Prêmio físico e cupom de produto real podem seguir fora dela.
  - Conferir as regras vigentes antes de publicar.
- **Equilíbrio (pay-to-win).**
  - Nível por preço dá vantagem a quem tem peça cara. Por isso:
    - as batalhas ranqueadas usam **chaves por nota** (Bronze contra Bronze…) ou teto de nota por modo;
    - parte dos desafios é **só Bronze** ou mistura níveis, então toda peça tem valor;
    - a raridade por Hype (mérito) continua dando o acabamento e as habilidades.

---

## 10. Dados e API

**Entidades novas** (Flyway):

| Entidade | Campos principais |
|---|---|
| `flair_card_instance` | dono, origem (PIECE, LOOK, SPECIAL) e id da origem, nível, nota, raro (sim/não), números de Hype congelados na geração e atualizados por evento, atributos de jogo, temporada, programa e número da tiragem, estado (AVAILABLE, LOCKED_CHALLENGE), preço verificado (sim/não), datas |
| `flair_special_program` | tipo (EVENT, MOMENT, CELEBRITY, BRAND, STORE, CHALLENGE), título, arte, perfil dono, selo ligado, janela, tiragem máxima e emitida, preço em pontos e em dinheiro, estado de aprovação |
| `flair_challenge` | grupo, título, cenário, dificuldade, vagas (posição pedida, coordenadas, modelo de história), requisitos (JSON validado), recompensas, repetível, janela, temporada |
| `flair_challenge_submission` | quem, desafio, cartas por vaga, sintonia, história gerada, recompensas concedidas, data |
| `reward_grant` | tipo, conteúdo, estado, estoque e retirada (físico), auditoria |
| `price_band` e `brand.tier` | faixas de preço por subcategoria e tier da marca, que alimentam a nota |
| `flair_card_instance` (campos do §12–§13) | + criador original, `tradeable` e motivo quando não é, origem da posse (GERADA, MERCADO, RECOMPENSA, LOJA_PONTOS, LOJA_DINHEIRO, SELO), data da posse, estado de mercado (NENHUM, ANUNCIADA) |
| `seal_bond.special_card_id` | a carta Especial emitida por aquele vínculo (no máximo uma, D15) |
| `flair_market_listing` | carta, vendedor, lance inicial, "compre já", lance atual e quem deu, prazo, estado (ATIVO, VENDIDO, EXPIRADO, RETIRADO, CANCELADO), versão (trava otimista) |
| `flair_market_bid` | anúncio, quem deu o lance, valor, reserva de pontos, estado (ATIVO, SUPERADO, VENCEU, LIBERADO) |
| `fai_points_hold` | reserva de pontos de um lance ou compra: pessoa, valor, referência, estado (RESERVADO, CAPTURADO, LIBERADO). Saldo disponível = saldo − reservas |
| `flair_card_transfer` | a procedência: carta, de quem, para quem, preço, taxa, parte de quem criou, anúncio, data |
| `flair_price_range` | faixa mínima e máxima por nível, faixa de nota e programa especial, recalculada pelas vendas |

**API.** As existentes continuam valendo; os endpoints novos são:

| Método | Endpoint | Para quê |
|---|---|---|
| POST | `/api/flair/cards/preview` | Gera a prévia da carta, sem gravar |
| POST | `/api/flair/cards` | Gera a carta (peça ou look) |
| GET | `/api/me/flair/cards?tier=&state=` | Lista as cartas da pessoa |
| GET | `/api/flair/challenges` | Lista os desafios |
| GET | `/api/flair/challenges/{id}` | Detalhe do desafio |
| POST | `/api/flair/challenges/{id}/check` | Verifica a montagem, sem gravar |
| POST | `/api/flair/challenges/{id}/submit` | Entrega a montagem |
| GET | `/api/flair/moments` | Lista os momentos |
| POST | `/api/flair/moments/{id}/play` | Joga um momento |
| GET | `/api/flair/specials` | Lista as cartas especiais |
| POST | `/api/flair/specials/{id}/acquire` | Adquire uma carta especial |
| GET | `/api/me/rewards` | Lista as recompensas da pessoa |
| POST | `/api/me/rewards/{id}/pickup` | Gera o código de retirada de um prêmio físico |
| POST | `/api/flair/cards/convert-preview` | Opções da conversão: carta comum e, com selo aprovado, a Especial (§12) |
| GET | `/api/flair/market?level=&ovrMin=&ovrMax=&position=&brand=&season=&program=&priceMin=&priceMax=&sort=` | Busca no mercado |
| GET | `/api/flair/market/price-range?cardId=` | Faixa permitida e média das últimas vendas da carta |
| POST | `/api/flair/market/listings` | Anuncia uma carta (`cardId`, "compre já", lance inicial opcional, duração) |
| DELETE | `/api/flair/market/listings/{id}` | Retira o anúncio (só sem lance) |
| POST | `/api/flair/market/listings/{id}/bids` | Dá um lance (reserva os pontos) |
| POST | `/api/flair/market/listings/{id}/buy` | Compra já |
| GET | `/api/me/flair/market` | Meus anúncios, lances, lista de observação e cartas para anunciar de novo |
| PUT/DELETE | `/api/me/flair/watchlist/{listingId}` | Observar ou deixar de observar |
| GET | `/api/flair/cards/{id}/history` | Procedência da carta (criação, donos, vendas) |

**Painéis.**

- O admin cuida dos desafios, cenários, faixas de preço, revisão de Ouro com preço digitado e estoque de prêmios. No
  mercado: faixas por nível, contas sinalizadas pelo antifraude (§13.5), bloqueio de anúncio e estorno de venda
  fraudulenta.
- A marca ou celebridade cuida dos programas de cartas especiais, prêmios patrocinados e relatório de entregas.

---

## 11. Fases e aceite

| Fase | Entrega | Aceite |
|---|---|---|
| **F0** | Decisões D1–D10 confirmadas com a pessoa responsável; regras de economia (limites diários, chaves, tiragens) | Este documento revisado |
| **F1** | **Seção E da prancha** (v18 → v21) com os 4 conceitos em todos os estados de §3.2 e o componente `FlairGameCard` (frente e verso) com fotos | Prancha e capturas nos três tamanhos, claro e escuro, celular; leitura por leitor de tela; contraste ≥ 4,5:1 |
| **F2** | Motor da nota e do nível (cliente + servidor, mesmos testes), `price_band`, `brand.tier`, antifraude | Os exemplos de §4 passam; preço digitado nunca dá Ouro sem revisão |
| **F3** | "Gerar como FLAIR" nos 3 criadores, "Converter para FLAIR" no detalhe, sub-aba "Minhas cartas FLAIR" e conversão em lote para quem já joga | Fluxo de ponta a ponta com banco: criar peça → carta → perfil; uma carta por peça por temporada |
| **F4** | Grupo FLAIR na barra lateral, hub e rotas por categoria; os 15 modos e os de hoje nos lugares novos; redirecionamentos | Nenhum modo some; links antigos funcionam; testes de rotas |
| **F5** | Desafios de Montagem: requisitos, sintonia, validação no servidor, bloqueio das cartas, 12 cenários 2D com história, grupos e sazonais | Entrega atômica; cartas bloqueadas; história nos 3 idiomas; desafio "só Bronze" possível com guarda-roupa simples |
| **F6** | Momentos, a partir de Eras e Coleções | Momento recriado concede a carta do momento |
| **F7** | Cartas especiais e Loja FLAIR: programas, tiragem, compra direta, **conversão de carta com selo em Especial (§12)**, aprovação do examinador | Tiragem nunca passa do máximo (teste de concorrência); nada aleatório pago; um vínculo de selo emite no máximo uma Especial |
| **F8** | Recompensas: digitais e cupons; prêmios físicos patrocinados (estoque, retirada); **dinheiro só depois de parecer** | Toda entrega auditada; prêmio físico com regulamento anexado |
| **F9** | Polimento: cenários em 3D (motor de cenas), animação de "abrir carta" (com redução de movimento), métricas, testes de ponta a ponta | Capturas e vídeo curto de cada cenário |
| **F10** | **Mercado de transferências (§13)**: anúncio, lance, compre já, reservas de pontos, taxa, faixas, liquidação dos leilões vencidos, procedência, lista de observação, antifraude; botão "Inserir no mercado de transferência" no detalhe da peça | Ver §13.7 |

**Dependências.**

- F1–F5 não dependem do avatar nem do GARMENT: usam o Hype, os selos, a loja do guarda-roupa e os FAI Points que já
  existem.
- F7 conversa com o **LOJA-EXCLUSIVOS** (item 9 do plano): mesma loja e mesmo inventário.
- F9 usa o motor de cenas do **ENV3D** (item 6).
- F10 depende de F3 (cartas geradas) e das reservas no `FaiPointsService`. Não depende de F5–F9 e pode vir logo
  depois de F3 se a pessoa responsável quiser o mercado antes dos desafios.

---

## 11.1 Estado da implementação (07/10)

O pedido de 07/10 acrescentou uma regra de produto: **nada vai ao feed sem a opção Compartilhar ligada**. Sem ela, a
peça (e a carta) fica só no perfil. No criador de peças a opção já vem ligada, e a pessoa desliga se quiser guardar a
peça só para o perfil. O post do FashionAI não tem descrição. A primeira versão de F1–F3 entrou junto:

| Parte | O que já funciona | O que falta |
|---|---|---|
| Criador de peças | Etapa final com **"Depois de salvar"**: "Compartilhar no feed do FashionAI" vem **ligado** por padrão (peça privada vira pública só com esta opção ligada; desligado, a peça fica só no perfil) e "Converter para FLAIR" vem desligado (com prévia da carta, nível e nota). Ao lado, a **prévia do post** | Os criadores de look e de DNA |
| Post do FashionAI | O post é o **próprio card, sem descrição** (diferente de redes como o Facebook): o diálogo Compartilhar mostra a prévia do post com "@pessoa compartilhou" e não tem campo de texto; a API não grava legenda e o feed e a Passarela não mostram as antigas | — |
| Regra do feed | Auditoria: peças só chegam ao feed por um compartilhamento explícito; looks, só por "Publicar". Converter para FLAIR não publica nada (teste) | — |
| F2 (nota e nível) | `FlairTier` com a fórmula do §4: faixas de preço iniciais fixas por categoria (bolsas com faixa própria), tier da marca pelo `Brand.priceTier`, preço confirmado pela faixa do produto da Busca Catalogada, teto em Prata sem confirmação. Os exemplos do §4 viraram testes | Tabela `price_band` alimentada pela Busca Catalogada; revisão de Ouro com preço digitado |
| F3 (gerar e guardar) | `flair_card_instance` (V55), uma carta por peça por temporada (chave única), "Converter para FLAIR" no detalhe da peça (com prévia), **"Minhas cartas FLAIR"** no perfil, por nível; visitante vê só cartas de peças que pode abrir | Conversão de looks e DNA; "Converter meu guarda-roupa" |
| F1 (carta) | `FlairGameCard`: frente com nota e posição por cima da foto, nome, marca, os 8 números do Hype em linha ("—" sem Hype público) e o nível escrito no rodapé; verso com os atributos de jogo e o porquê do nível; os 4 metais e o acabamento raro | Seção E da prancha (v21) com todos os estados |
| F7 / F10 | — | Selo → Especial (§12) e mercado de transferências (§13) |

---

## 12. Carta com selo vira FLAIR Especial ("Converter para FLAIR")

### 12.1 O que existe hoje

- O selo é de uma marca ou de uma celebridade (`Seal`: dono, tier PECA ou LOOK, política, janela de disponibilidade,
  limite de uso).
- O selo chega ao look por um **vínculo** (`SealBond`), sugerido pela IA ou pedido à mão. O vínculo passa por
  SUGGESTED → ACCEPTED → PENDING_REVIEW → **APPROVED** (ou REFUSED, REJECTED, REVOKED) e guarda as peças ligadas
  (`linkedPieceIds`), a base (BRAND_MATCH ou STYLE_SIGNATURE), o código do selo e a data de emissão.
- O card mostra o selo como medalha. Hoje o selo não dá nada no FLAIR.

### 12.2 Regra da troca

O selo aprovado funciona como **ingresso** de uma carta Especial (D15):

1. No detalhe do look (ou de uma peça ligada ao vínculo), o bloco FLAIR mostra **"Converter para FLAIR Especial"**
   quando há vínculo **APPROVED**, dentro da janela do selo, ainda sem carta especial emitida, e o selo tem um
   **programa especial** aprovado pelo examinador (`flair_special_program` com `seal_id`).
2. A prévia mostra as duas opções lado a lado: a carta comum (pelo nível de §4, por exemplo "Ouro 78") e a **Especial do
   selo** ("Atelier Lumi · Coleção Verão · nº 0042/500"). Embaixo, as regras em uma linha: o selo emite uma carta só; o
   card do look e o selo continuam no perfil.
3. Ao confirmar, numa transação:
   - reserva o próximo número da tiragem com trava de linha (`SELECT … FOR UPDATE` no programa); esgotada a tiragem, a
     conversão sai como carta comum, com o aviso "tiragem esgotada";
   - cria a carta com nível **Especial** e nota entre 80 e 99: `max(80, nota de §4) + bônus do programa`, limitada a 99.
     O bônus vem do tier do selo (LOOK +4, PECA +2) e do que o programa definir;
   - grava `seal_bond.special_card_id`, para o mesmo vínculo nunca emitir outra;
   - registra a procedência: origem SELO, programa, número e vínculo.

| Situação | Resultado |
|---|---|
| Vínculo ainda não aprovado (SUGGESTED, ACCEPTED, PENDING_REVIEW) | Só a carta comum. A Especial aparece como "liberada quando o selo for aprovado" |
| Selo sem programa especial | Carta comum com o **selo na moldura** (ornamento). Não vira Especial |
| Programa fora da janela ou tiragem esgotada | Carta comum, com o motivo |
| Vínculo revogado **depois** da emissão | A carta fica com a dona, marcada "selo revogado", e sai do mercado (§13.4). Se a revogação for por fraude, o admin pode anular a carta |
| Celebridade | Exige o consentimento de imagem do vínculo (`imageRightsConsent`) e a licença do §9.2. No TCC, só artistas fictícios |

### 12.3 Painel da marca ou celebridade

O programa nasce no painel do selo: arte da moldura, tiragem, janela, bônus de nota, se a carta pode ir ao mercado
(e depois de quantas horas) e relatório de emissões. Passa pelo examinador (EXAM-1) antes de valer.

---

## 13. Mercado de transferências (FAI Points)

### 13.1 Como funciona (o modelo do FC UT, com as regras do FashionAI)

- **O que se vende é a cópia FLAIR**, nunca a peça nem o card do guarda-roupa (D11).
- **Anúncio.** Preço de **"compre já"** (obrigatório), **lance inicial** (opcional) e **duração**: 1 h, 3 h, 6 h, 12 h,
  24 h ou 3 dias.
- **Lance.** Cada lance precisa superar o anterior em pelo menos 5 % (mínimo de 10 pontos) e **reserva** os pontos de
  quem deu. Quem é superado recebe a reserva de volta na hora. Sem prorrogação no último minuto, como no FC.
- **Compre já** encerra o anúncio na hora, mesmo com lances (os lances são liberados).
- **Fim do prazo.** Com lance, vende para o maior. Sem lance, a carta volta para "Para anunciar de novo" e pode ser
  anunciada de novo ou retirada.
- **Liquidação.** Débito de quem compra, crédito de quem vende (95 %), taxa de 5 % que sai de circulação e troca de
  dona da carta, **tudo numa transação só**, com chave de idempotência no extrato. Débito e crédito entram com
  `counts_lifetime = false` (D16).
- **Busca.** Filtros por nível, nota (de–até), posição, marca, temporada, programa especial e preço; ordem por "termina
  antes", menor preço ou maior nota.
- **Lista de observação** (até 50 anúncios), **meus lances** e **meus anúncios**, com aviso quando alguém supera o
  lance, quando a carta vende e quando o anúncio expira.
- **Procedência.** Cada carta tem histórico: criação (criada por @ana em 07/10), número de donos e vendas, com preço e
  data. Os donos intermediários aparecem só como "dona 2", "dona 3" (D14).

### 13.2 Botão "Inserir no mercado de transferência" (detalhe da peça)

Fica no bloco FLAIR do detalhe (§5), só para a dona. Se a peça ainda não tem carta na temporada, o botão vira
**"Converter e anunciar"**: primeiro a prévia da carta, depois o formulário abaixo.

```
┌ Inserir no mercado de transferência ─────────────────┐
│ [carta Ouro 78 · Tênis Aero · Norte Sport]           │
│ Compre já *       [ 2.400 ] pts                      │
│ Lance inicial     [ 1.800 ] pts   (opcional)         │
│ Duração           ( 1 h | 3 h | 6 h | 12 h | 24 h | 3 d ) │
│ Faixa permitida: 1.500 a 6.000 pts                   │
│ Média das últimas 20 vendas: 2.150 pts               │
│ Taxa do mercado (5 %): −120 · você recebe 2.280      │
│ A peça continua no seu guarda-roupa. Vai a carta.    │
│                          [Cancelar]  [Anunciar]      │
└──────────────────────────────────────────────────────┘
```

- Os campos validam a faixa em tempo real; o servidor valida de novo.
- **Peça privada.** A foto da carta apareceria para estranhos, então o anúncio pede antes "Tornar pública e
  anunciar", a mesma regra do Compartilhar (a dona confirma).
- O mesmo formulário abre em "Minhas cartas FLAIR" (para cartas compradas ou ganhas) e no hub `/flair/mercado`.

### 13.3 Faixas de preço, taxa e economia

- **Faixa por nível** (valores iniciais, a calibrar na F0):

  | Nível | Mínimo | Máximo |
  |---|---|---|
  | Bronze | 150 | 5.000 |
  | Prata | 300 | 15.000 |
  | Ouro | 1.000 | 50.000 |
  | Especial | 2.000 | 200.000 |

  Dentro do nível, a faixa se estreita pela nota e, depois de 20 vendas parecidas, pela mediana ± 60 %. A
  recalculação roda uma vez por hora e nunca passa dos limites da tabela.
- **Taxa de 5 %** em toda venda, retirada de circulação. Opcional (decidir na F0): 2 dos 5 pontos percentuais vão para
  quem **criou** a carta, um incentivo para cadastrar peças boas.
- **Economia.** Os pontos entram pelo uso, com limites diários (RF35). Saem pela loja do quarto, pela Loja FLAIR e pela
  taxa do mercado. O painel do admin acompanha os pontos em circulação por semana e a mediana de preço por nível, para
  ajustar a taxa e as faixas se houver inflação.

### 13.4 O que não vai ao mercado

| Carta | Por quê |
|---|---|
| Card do guarda-roupa (original) | É a peça da pessoa (D11) |
| Carta entregue em desafio | Fica bloqueada (D7) |
| Carta em deck de partida em andamento ou em fila ranqueada | Está em uso; sai do deck antes |
| Carta **comprada com dinheiro** na Loja FLAIR | D12: senão, dinheiro viraria pontos |
| Recompensa marcada "intransferível" pelo desafio ou programa | Regra do programa |
| Carta Especial antes do prazo do programa (padrão: 7 dias) | Evita revenda imediata de lançamento |
| Carta comprada há menos de 24 h | Freia robôs de revenda |
| Carta com selo revogado ou em revisão | Procedência contestada |
| Carta de peça privada, até a dona publicar | A foto apareceria para estranhos |

### 13.5 Antifraude e lavagem de pontos

O risco clássico do mercado do FC UT é a **venda de moedas por dinheiro fora do jogo**: alguém anuncia uma carta
qualquer a preço alto, e o comprador "paga" assim pontos que comprou por fora. As defesas:

- **Faixas de preço** (§13.3) limitam o valor que passa numa venda.
- **Limites:**
  - até 30 anúncios ativos;
  - até 50 compras e 100 lances por dia;
  - conta nova (menos de 7 dias) ou sem e-mail verificado não negocia;
  - para vender, a conta precisa do nível Studio dos FAI Points (uso real do app).
- **Sinais para o admin:**
  - o mesmo par de contas negociando várias vezes;
  - compras repetidas perto do teto da faixa;
  - vendedor e comprador no mesmo dispositivo;
  - conta nova que compra muito acima da mediana;
  - pontos que vão e voltam entre duas contas.
- **Ação.** Venda suspeita fica **retida** (a carta e os pontos ficam parados) até a revisão do admin, que pode
  liberar ou estornar. Os termos de uso proíbem vender cartas ou pontos por dinheiro, com perda dos itens e banimento.
- **Sem chat e sem texto livre no anúncio** (D14): não há como combinar pagamento pelo próprio mercado.
- **Conservação.** Teste de propriedade: em qualquer sequência de anúncios, lances, compras e expirações, a soma dos
  saldos + reservas + taxas retiradas fica constante, e nenhuma carta tem duas donas.

### 13.6 Menores e lei (mapa de perguntas, não parecer)

- **Sem dinheiro, sem aposta.** Ninguém compra ponto nem saca ponto, e o mercado não tem sorte envolvida (o comprador
  vê a carta que compra). Por isso, em princípio, o mercado fica fora das apostas de quota fixa (Lei 14.790/2023) e
  das promoções com prêmio (Lei 5.768/1971). Confirmar com o jurídico antes de publicar.
- **ECA Digital (Lei 15.211/2025).** Não há caixa de recompensa: o mercado vende cartas escolhidas. Para menores de 18:
  - o mercado vem desligado e a pessoa responsável liga no controle parental;
  - os limites diários são menores (10 compras, 20 lances);
  - nunca há chat nem perfil do vendedor (D14).
- **Lojas de aplicativo.** Conferir as regras vigentes sobre troca de itens digitais entre pessoas e sobre moedas
  virtuais antes de publicar a versão de loja.
- **LGPD.**
  - A procedência guarda só o necessário: quem criou (perfil público) e números de donos, sem expor os outros.
  - Ao excluir a conta, as cartas com outras pessoas ficam com "ex-membro" no lugar do criador. A foto da carta é de
    produto (sem rosto, pela regra das fotos de peça).
- **Consumidor.** Termos claros: FAI Points e cartas não têm valor em dinheiro, o FashionAI pode ajustar faixas e
  taxas com aviso prévio, e venda fraudulenta pode ser estornada.

### 13.7 Aceite da F10

- Concorrência: dois compradores no mesmo "compre já" → exatamente um compra, o outro recebe 409 e a reserva volta.
- Lance abaixo do mínimo, preço fora da faixa e carta intransferível → 400 ou 409 com o motivo.
- Ninguém compra o próprio anúncio nem dá lance nele.
- Leilão vencido é liquidado uma vez só, mesmo se a liquidação rodar duas vezes (idempotência).
- O teste de conservação de §13.5 passa com sequências aleatórias.
- Trocas não mexem nos pontos vitalícios (D16).
- De ponta a ponta com banco: converter a peça → anunciar pelo detalhe → outra conta compra → a carta muda de dona, a
  peça continua no guarda-roupa de quem a criou e o extrato das duas contas mostra débito, crédito e taxa.
- Telas em claro e escuro, celular, leitor de tela: o formulário anuncia a faixa e a taxa, e o aviso de lance superado
  chega pela central de notificações.

---

## 14. Desafios de Montagem dentro dos Momentos (leitura de *O Império do Efêmero*)

Pedido de 07/10: criar os jogos de **Card Building Challenge** (os Desafios de Montagem da §7) levando em conta o livro
*O Império do Efêmero*, de Gilles Lipovetsky, e a camada **Momentos** (moda + tempo + ocasião + expressão individual +
participação social). Este capítulo é a especificação da F5 e prevalece sobre a §7 onde as duas divergirem.

### 14.1 Auditoria: os Momentos já existem

A camada Momentos dos 61 pontos foi implementada em 06/10 (PR #151, `docs/momentos/MOMENTOS.md`). Reconferência:

| Pontos do pedido | Onde está | Situação |
|---|---|---|
| 1–9 (Momentos no lugar de Desafios, princípio, calendário, região, entidade, tipos, home, Agora, contagem) | `Moment`, `MomentType`, `MomentNature`, `/moments`, `MomentTime` | Feito. "Desafio" é um tipo de Momento; a área antiga continua em `/challenges` |
| 10–15 (pontos sazonais, reutilização, desafios do Momento, sem "certo/errado", MomentMatch) | `MomentPointsPolicy`, `MomentChallenge`, `MomentMatch` | Feito, determinístico, ledger idempotente |
| 16–18 (verso do card, Copilot, descoberta × identidade) | `hype-card-back`, `CopilotService` | Feito |
| 19–25 (calendário visual, temporadas, eventos reais com fonte, Momentos FashionAI, No-Buy, Rediscovery, One piece) | `/moments` (ano, mês, semana, linha do tempo), V53 | Feito; eventos externos só com fonte |
| 26–34 (FLAIR privado, criação, privacidade, modos, cooperativo, votação, calendário e memória do grupo) | `createGroupMoment`, `FlairMomentMode`, `MomentVote`, `memory_json` | Feito |
| 35–42 (Hype contextual, trend por Momento, histórico, ledger, anti-farming, insígnias, perfil, Replay) | `contextualHype`, `/trending`, `moment_participations`, `fai_points_ledger` | Feito |
| 43–61 (home, notificações, passados e futuros, marcas, acessibilidade, mobile, tema, abstração, API, tempo, status, admin, IA) | banner do feed, 4 tipos de notificação, `MomentPage`, `/admin/moments` | Feito |
| **Lacunas** | — | Clima no Copilot; Brand Moments com fluxo comercial; exportação LGPD das participações; comentários dentro do Momento; recorrência anual automática. E faltava o que este capítulo entrega: **jogos de montagem de cartas dentro dos Momentos** |

### 14.2 O que o livro diz e o que vira regra

Referência: LIPOVETSKY, Gilles. *O Império do Efêmero: a moda e seu destino nas sociedades modernas*. Tradução de
Maria Lucia Machado. São Paulo: Companhia das Letras, 1989 (original *L'Empire de l'éphémère*, Gallimard, 1987). As
ideias abaixo são **paráfrases**; antes de citar no texto do TCC, conferir página e redação no exemplar.

| # | Ideia do livro (paráfrase) | O que significa no jogo | Regras (código) |
|---|---|---|---|
| L1 | **Efêmero.** A moda é o reino da mudança rápida e do presente: o novo vale porque é novo e passa | O desafio vive na janela do Momento. Quando acaba, não some: vira **Memória** | **E1** a janela do desafio é a do Momento (ou a própria, sem Momento). **E2** desafio encerrado não recebe entrega e mostra a Memória. **E3** a reedição é um desafio novo na temporada seguinte; um desafio encerrado nunca reabre |
| L2 | **Sedução.** A moda moderna convence pelo prazer e pela escolha, não pela imposição | O desafio convida (cenário, história), nunca pressiona | **S1** contagem informativa ("termina em 3 dias"), nunca "última chance". **S2** não participar não custa nada: sem sequência que se perde, sem multa. **S3** os pontos previstos aparecem antes de entregar |
| L3 | **Diferenciação marginal.** As versões se distinguem por pequenas diferenças | A mesma cena aceita muitas montagens, e cada carta muda a história | **D1** a história é escrita carta a carta: duas montagens diferentes nunca contam a mesma história. **D2** a Memória mostra a **variedade de leituras**, não um vencedor |
| L4 | **Moda aberta.** Depois da "moda de cem anos" (alta-costura ditando uma linha por estação), vários estilos convivem e a aparência fica mais pessoal | Nenhum desafio de Momento tem um jeito certo de cumprir | **P1** o requisito de tema aceita **qualquer interpretação** do Momento. **P2** desafio ligado a Momento com requisito de tema exige um Momento com ≥ 2 interpretações (validado ao salvar). **P3** a pessoa escolhe uma interpretação ou **"Minha leitura"**; a escolha não muda os pontos |
| L5 | **Imitar os contemporâneos e se distinguir.** Na moda, o modelo é o presente (os outros de agora), não a tradição, e ao mesmo tempo cada pessoa quer se diferenciar | Ver o que os outros montaram inspira, mas depois de a pessoa se expressar | **I1** montagens da comunidade só aparecem depois da sua entrega ou depois do fim. **I2** a Memória separa "leituras mais usadas" e "leituras raras" (< 15 % das entregas) |
| L6 | **Moda consumada.** A lógica da moda (efêmero, sedução, diferenciação) se espalha para o consumo e para a obsolescência planejada | O novo vem da **recombinação**, não da compra | **C1** nenhuma regra premia compra. **C2** requisito **"Sem compras"**: só cartas de peças que já estavam no guarda-roupa antes do início. **C3** bônus **Redescoberta** (+10) por carta de peça sem uso há ≥ 60 dias. **C4** "Brechó de tesouros" é só Bronze |
| L7 | **Moda e autonomia.** O livro lê a moda também como motor de autonomia individual e pluralismo, não só como marcação de classe | O nível vem do preço (D1), então o preço não pode ser a porta de entrada | **A1** todo Momento com desafios tem pelo menos um **aberto a qualquer nível**. **A2** existem desafios "só Bronze". **A3** a sintonia (combinar bem) conta mais que o nível na maioria dos desafios |
| L8 | **Tradição × moda.** Nas sociedades da tradição, repete-se o passado; a moda valoriza o presente | O FashionAI respeita o que é rito e usa a tradição como fonte de estilo | **R1** Momento RELIGIOUS nunca tem desafio de montagem (validado). **R2** a tradição entra como interpretação (retrô, vintage), nunca como regra ("use fantasia") |
| L9 | **O ritmo das estações** das coleções | A temporada FLAIR (D6) dá a edição da carta | **T1** desafios sazonais aceitam cartas de qualquer temporada: ninguém precisa gerar carta nova para jogar. **T2** a Memória guarda a temporada |

### 14.3 Como funciona

1. A pessoa abre um Momento (ou FLAIR → Desafios de Montagem) e vê os desafios: **Agora**, **Em breve** (pode montar e
   conferir, mas só entrega quando abrir), **Sempre disponíveis**, **Grupos** e **Memórias**.
2. Escolhe a leitura: uma interpretação do Momento ou "Minha leitura". O app sugere a interpretação que mais combina com
   as cartas que a pessoa já tem (sem IA, por sobreposição de tags).
3. Monta no cenário: cada vaga pede uma posição (SUP, INF, CAL, ACE, VES ou qualquer). Cada carta colocada acende a vaga
   e escreve uma linha da história. A lista de requisitos e a sintonia vêm do servidor (`/check`), que é a fonte da
   verdade.
4. Entrega: o servidor valida de novo, bloqueia as cartas ("Entregue em ‹desafio›", D7), grava a história e lança os
   pontos numa transação só. Se algo falhar, nada é aplicado. Desafio de Momento também registra a participação no
   Momento (aparece em "Meus Momentos").
5. Depois: a pessoa vê as montagens da comunidade (I1). Quando o Momento termina, o desafio vira Memória (E2, D2, I2).

### 14.4 Modelo (V56)

| Tabela | Campos |
|---|---|
| `flair_challenge_groups` | código, nome (i18n), pontos do grupo, insígnia |
| `flair_challenges` | slug, nome e descrição (i18n), cenário, dificuldade (EASY, MEDIUM, HARD, LEGENDARY), Momento (opcional), janela própria (opcional), vagas (`[{key, position, label?, story?}]`), requisitos (JSON validado), pontos, limite de entregas por pessoa, grupo, bloqueia cartas (sim/não), estado (ACTIVE, DRAFT, ARCHIVED), oficial, quem criou, ordem |
| `flair_challenge_submissions` | desafio, pessoa, tentativa, cartas por vaga (retrato), leitura escolhida, sintonia, história (chaves e variáveis, não texto: vale nos 3 idiomas), pontos, bônus |
| `flair_card_instance` | + `tags_json` (estilos, ocasiões, cor e material da peça no dia da geração), `locked_challenge_id`, `locked_at` |

### 14.5 Requisitos

Todos verificados no servidor (`CbcRules`), cada um com estado e "tem / precisa" para a lista da tela:

| Tipo | Exemplo | Regra do livro |
|---|---|---|
| `tier` | `{"type":"tier","min":"OURO","count":3}`, `{"type":"tier","only":"BRONZE"}`, `{"type":"tier","max":"PRATA"}` | A2, C4 |
| `ovrAvg` / `ovrMin` | `{"type":"ovrAvg","min":68}` | — |
| `sintonia` | `{"type":"sintonia","min":15}` | A3 |
| `sameBrand` / `distinctBrands` | `{"type":"sameBrand","count":2}` | — |
| `tag` | `{"type":"tag","field":"color","anyOf":["white"],"count":2}` (cor, estilo, ocasião ou material) | — |
| `theme` | `{"type":"theme","count":3}`: cartas que combinam com **qualquer** interpretação do Momento (ou com a escolhida) | P1 |
| `hype` | `{"type":"hype","dim":"TRD","min":80,"count":2}` | — |
| `origin` | `{"type":"origin","only":"PIECE"}` | — |
| `noBuy` | `{"type":"noBuy"}`: peça no guarda-roupa antes do início do desafio | C2 |
| `rediscovery` | `{"type":"rediscovery","count":1,"idleDays":60}` | C3 |
| `strictPosition` | `{"type":"strictPosition"}`: toda vaga com posição exige a posição certa | — |

### 14.6 Sintonia e história

- **Sintonia** (0 a 3 por carta, como §7.2): +1 posição certa (vaga "qualquer" conta); +1 vizinhança (mesma marca, um
  estilo em comum ou cores em harmonia com uma vizinha); +1 tema (combina com a leitura escolhida ou, em "Minha
  leitura", com qualquer interpretação ou tag do Momento e do desafio).
- **História:** uma linha de abertura, uma por vaga (`cbc.scenario.<cenário>.<vaga>.story` com nome, marca e cor da
  carta) e um fecho pela faixa de sintonia. Fica gravada como chaves e variáveis, então aparece no idioma de quem lê.
  A IA não escreve a história nem decide pontos.

### 14.7 Pontos

| Ação | Pontos | Referência (1×) |
|---|---|---|
| `FLAIR_CBC` | valor do desafio × multiplicador do Momento quando ele está ativo | desafio (ou desafio:tentativa nos repetíveis) |
| `FLAIR_CBC_REDISCOVERY` | +10 | desafio |
| `FLAIR_CBC_GROUP` | valor do grupo, ao completar todos os desafios dele | grupo |

Tetos diários seguram a repetição (5 desafios/dia). Desafio de Momento privado de grupo vale no máximo 15.

### 14.8 Desafios semeados (V56)

| Desafio | Cenário | Momento | Nível | Requisitos | Pontos |
|---|---|---|---|---|---|
| Verão em Ipanema | ipanema · 3 | — | Fácil | — | 15 |
| Primeiro dia de estágio | estagio · 4 | — | Fácil | — | 15 |
| Brechó de tesouros | brecho · 5 | — | Fácil | só Bronze (C4) | 20 |
| Festival de música | festival · 5 | — | Médio | 2 da mesma marca | 25 |
| Casamento no campo | casamento · 5 | — | Médio | nota média ≥ 68 | 25 |
| Viagem a Paris | paris · 6 | — | Médio | 3 marcas diferentes | 30 |
| Noite de gala | gala · 7 | — | Difícil | 3 Ouro, sintonia ≥ 15 | 50 |
| Desfile da coleção cápsula | desfile · 8 | — | Difícil | 4 da mesma marca | 50 |
| Loja pop-up de bairro | popup · 7 | — | Difícil | sintonia ≥ 14, só peças | 45 |
| Primavera no jardim | primavera · 4 | Primavera 2026 | Fácil | tema em 2 cartas | 20 |
| De volta do armário | armario · 3 | Primavera 2026 | Fácil | redescoberta em 1 carta | 25 |
| Noite de Halloween | halloween · 6 | Halloween 2026 | Médio | tema em 3 cartas | 30 |
| Halloween sem compras | halloween · 4 | Halloween 2026 | Fácil | sem compras, tema em 2 | 40 |
| Carnaval no bloco | carnaval · 6 | Carnaval 2027 | Médio | tema em 3 | 30 |
| Inverno na serra | serra · 5 | Inverno 2027 | Médio | tema em 3 | 30 |
| Uma semana, um guarda-roupa | semana · 7 | No-Buy Week | Difícil | sem compras | 60 |
| **Lenda do estilo** (grupo) | — | — | Lendário | Casamento + Paris + Gala + Desfile | 150 + insígnia |

Natal e Festas (RELIGIOUS) não ganha desafio (R1). Cada Momento com desafio tem um aberto a qualquer nível (A1).

### 14.9 API

| Método | Rota | Para quê |
|---|---|---|
| GET | `/api/flair/challenges?moment=` | Agora, Em breve, Sempre, Grupos, Memórias (ou só os de um Momento) |
| GET | `/api/flair/challenges/{id ou slug}` | Detalhe: cenário, vagas, requisitos, leituras, janela, pontos, minhas entregas, comunidade (I1) e Memória |
| POST | `/api/flair/challenges/{id}/check` | Confere a montagem sem gravar |
| POST | `/api/flair/challenges/{id}/submit` | Entrega (atômica) |
| POST | `/api/flair/moments/{momentId}/challenges` | Dono de Momento privado de grupo adiciona um desafio a partir de um modelo |
| GET/POST/PUT | `/api/admin/flair/challenges` | Administração sem deploy, com as validações R1, P2 e A1 |

### 14.10 Fora deste lote

- Carta Especial como prêmio da Lenda do estilo: depende da F7 (programas de cartas especiais). Por ora, pontos e
  insígnia.
- Cenários em 3D (F9) e mercado (F10).
- Cenários novos com arte própria exigem deploy. Desafios novos em cenários existentes, ou no cenário **livre** (vagas
  e textos definidos na administração), não exigem.
