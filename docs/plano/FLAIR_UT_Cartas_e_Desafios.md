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
- **Perfil → sub-aba "Minhas cartas FLAIR"**, ao lado de Closet, Looks, Publicações etc.
  - Separada por nível: Bronze, Prata, Ouro e Especial, com contagem.
  - Filtros por posição, marca, temporada e estado (disponível ou entregue).
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

**Painéis.**

- O admin cuida dos desafios, cenários, faixas de preço, revisão de Ouro com preço digitado e estoque de prêmios.
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
| **F7** | Cartas especiais e Loja FLAIR: programas, tiragem, compra direta, concessão por selo, aprovação do examinador | Tiragem nunca passa do máximo (teste de concorrência); nada aleatório pago |
| **F8** | Recompensas: digitais e cupons; prêmios físicos patrocinados (estoque, retirada); **dinheiro só depois de parecer** | Toda entrega auditada; prêmio físico com regulamento anexado |
| **F9** | Polimento: cenários em 3D (motor de cenas), animação de "abrir carta" (com redução de movimento), métricas, testes de ponta a ponta | Capturas e vídeo curto de cada cenário |

**Dependências.**

- F1–F5 não dependem do avatar nem do GARMENT: usam o Hype, os selos, a loja do guarda-roupa e os FAI Points que já
  existem.
- F7 conversa com o **LOJA-EXCLUSIVOS** (item 9 do plano): mesma loja e mesmo inventário.
- F9 usa o motor de cenas do **ENV3D** (item 6).
