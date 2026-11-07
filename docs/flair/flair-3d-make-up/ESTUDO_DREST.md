# Estudo de referência: DREST (jogo de styling de luxo), para o FLAIR 3D MAKE UP

Pesquisa web de 07/11/2026 para o FLAIR 3D MAKE UP (FashionAI, público 13+), um jogo de styling e maquiagem no estilo do
DREST, só que em cenas 3D. Nenhum código foi alterado. Complementa `REUSO_PROVADOR_E_AVATAR.md` (mesma pasta). A pedido
da dona do projeto, a **§4 (progressão por nível)** é a parte mais detalhada, a **§5** descreve o guarda-roupa de cada jogo e a **§6**
lista os tipos de maquiagem.

**Legenda.** **[D]** documentado ou oficial (lojas de apps, site, termos, notas de versão). **[P]** imprensa ou
entrevista. **[C]** comunidade: avaliações de loja, blogs, espelhos e agregadores, sempre anedóticos. **[I]** inferência
nossa. (S1) aponta para a lista de fontes no fim. Não existe wiki de fãs nem fórum no Reddit sobre o DREST (as buscas
voltaram vazias), então a parte [C] vem das avaliações da App Store (EUA, Reino Unido, Canadá, Austrália) e de
agregadores. Valores de XP, curva de níveis e árvore exata de categorias **não são públicos**, e o texto diz isso onde falta.

## 0. Resumo executivo

1. Quem joga é a **stylist**. Para cada **brief** (editorial, red carpet, Fashion Week), escolhe a modelo, veste com
   **peças reais de mais de 260 marcas**, faz cabelo e maquiagem, escolhe a locação e envia o "photoshoot" **[D]**(S1).
2. A **comunidade dá de 1 a 5 estrelas**, numa janela de algumas horas. A nota define a recompensa. A progressão passa
   por ranks ("Wardrobe Intern" → "Style Icon"), níveis com "Level Up rewards", ligas e rankings semanais
   **[D/P/C]**(S3, S7, S18, S47).
3. A receita principal é **B2B**: as marcas pagam por desafios, Quests e VIP Events. Somam-se compras no app (moedas,
   gems, boosters, passes de evento) e os links para comprar o produto real (Farfetch desde 2019, site da marca no 2.0)
   **[P]**(S17, S34, S40, S42).
4. O app original, "Drest: Fashion Styling Game", só existiu no iOS, de 2019 a 2024. O **DREST 2.0**, "DREST: Fashion
   Dress Up Game", foi refeito em Unity e lançado em **04/11/2024**, para iOS e Android **[D/P]**(S11, S13, S40).
5. No 2.0 a peça comprada **não é sua para sempre: vale 5 usos** e depois precisa ser renovada. Cabelo e maquiagem
   ficam travados atrás de tickets ou kits pagos. A queixa nº 1 dos jogadores é a economia **[C]**(S2, S6, S7, S8).
6. A maquiagem mistura troca peça a peça (olhos, sobrancelhas, lábios, pele, unhas) e looks prontos de 1 toque, com
   marcas reais por tempo limitado (Gucci Beauty, NARS, Lisa Eldridge, Bakeup). Base e corretivo não foram confirmados (§6).

## 1. Identificação e linha do tempo

- **Empresa:** Drest Limited, Londres.
- **Pessoas:** Lucy Yeomans é a fundadora (ex-editora-chefe da Harper's Bazaar UK por 12 ou 13 anos, ex-diretora
  global de conteúdo de Net-a-Porter e PORTER). Graham Edwards é cofundador e co-chair. Lisa Bridgett foi CEO desde
  2022, e de 2025 em diante Yeomans aparece como co-CEO ou CEO **[P]**(S14, S31, S33, S40, S43).
- **2019:** soft launch em 30/09 com mais de 100 marcas. Gucci foi a parceira exclusiva por 6 meses (desafios semanais
  e um avatar), e a Farfetch forneceu a maior parte do acervo **[P]**(S17, S18).
- **2020:** em 01/12 entram as supermodelos **Natalia Vodianova, Irina Shayk, Precious Lee, Imaan Hammam e Candice
  Huffine**, com cabelos de Sam McKnight e maquiagem de Mary Greenwell **[P]**(S22).
- **2021:** Jewellery & Watch Mode com a Cartier. **Beauty Mode** com a Gucci Beauty (01/10), seguida da NARS **[P]**(S26–S28).
- **2022:** Kate Moss vira a primeira "guest avatar", com joias Messika. Lisa Eldridge entra como maquiadora convidada
  **[P]**(S29, S30).
- **2023:** rodada de £15 milhões (cerca de £30 milhões no total); Bakeup e Copenhagen Fashion Week **[P]**(S32–S35).
  **2024:** pausa de cerca de 6 meses e relançamento em Unity com Versace, Manolo Blahnik e The Fashion Awards
  **[D/P]**(S38, S40). **2025–2026:** Artist Series (hairstylists), Josh Wood Colour, Ralph Lauren × Wimbledon e
  Cartier "Clash"; a empresa diz ter **mais de 500 mil MAU** **[D/P]**(S15, S39, S42, S43).
- **Aviso:** "Drest: Virtual Try-On" (Drest Inc.) é outro app. Não confirmamos relação entre as empresas **[I]**.

## 2. Como o jogo funciona

**Loop [D/P].** Brief no feed editorial (notícia do dia) → casting da modelo → look (roupa, sapato, bolsa, joias) →
cabelo e maquiagem → locação ou fundo e props → envio → nota da comunidade → recompensa → próximo brief. Em 2020 o
photoshoot tinha 4 elementos: **casting, locação, maquiagem e styling** (S18). O 2.0 acrescentou Quests de marca, VIP
Events e Narrative Quests (inspiradas nas viagens de imprensa das editoras), um feed com cara de revista e rankings
semanais (S38, S40).

**Briefs.** Partem de Fashion Weeks, Met Gala, estreias, red carpet e looks icônicos (S1). Trazem uma peça obrigatória e
bônus por condições opcionais. Em 2019, por exemplo: bolsa Gucci Sylvie obrigatória, bônus por mini-saia, vestido ou
short (S20). Os **Pro Challenges** (junho de 2026) dão multiplicador a quem usa os "finest items" **[D]**(S3).

**Julgamento.** É comunitário, em estrelas (média de 1 a 5). O desafio fica aberto "algumas horas" para os outros
votarem **[D, resposta do dev]**(S7). Em 2020 contavam a **aderência ao brief e a nota dos pares** **[P]**(S18). Num
blog de 2020, a nota também premiava usar **peças ainda não usadas**, para desestimular repetir looks **[C]**(S52). Não
achamos confirmação de júri de IA. Queixas [C]: médias presas em 3,0–3,3 (S45); reenviar o mesmo look levou de menos
de 4 para 5 estrelas; suspeita de que pagar ajuda; um recurso pago "muda a nota" por 5 diamantes (S7).

**Social.** Votar, "Looks of the Day", seguir stylists, compartilhar nas redes e denunciar. Não há chat aberto, e
jogadores pedem "group chats" **[D/C]**(S2, S16, S18).

## 3. Objetivos

- **Em cada desafio:** cumprir o brief (peça ou marca obrigatória e extras), tirar a nota máxima (5★ paga mais) e,
  nos desafios de marca, concorrer a **prêmios reais** **[P/C]**(S20, S37, S46).
- **No longo prazo:** subir de rank e de nível, ir bem em ligas e rankings, aumentar a coleção (roupas, cabelos,
  locações, beleza), fechar Quests e eventos e ganhar "credibilidade" **[D]**(S1, S3). O lema é "Real-Virtual-Real":
  "style before they buy" **[P]**(S23, S38).

## 4. Progressão: níveis, XP, desbloqueios e retenção

### 4.1 Mapa do ciclo [D/P/C, montado por nós]

```
Brief diário ──► montar look (gasta moedas, usos de itens, tickets) ──► enviar ──► janela de votação (horas)
     ▲                                                                                   │
     │        estrelas 1–5 ──► recompensa (DD / Style Credits / prêmio) + XP/"influência" ◄┘
     │                               │                       │
     └── novos briefs/itens ◄── Level Up rewards ◄── nível/rank     liga/ranking semanal ──► gift boxes
                 em paralelo: eventos com catálogo próprio + Luxe Pass/Plus + Quests de marca
```

### 4.2 Como se ganha XP e "influência" em cada desafio

| Fase | O que se sabe | Fonte |
|---|---|---|
| 2019 | Recompensa **fixa** por desafio concluído (**2.500 Drest Dollars**) mais pontos por condições opcionais. Novos desafios abrem ao subir de nível. A jornalista chegou ao **nível 3** na primeira sessão | [P](S20) |
| 2019–2020 | "Reputation points" ou "fashion influence" vêm de jogar os desafios diários e compartilhar looks. Sobe-se de "Wardrobe Intern" até "Style Icon" | [P/C](S21, S47) |
| 2020 | A recompensa reflete o quanto o look cumpre o brief e como os outros o avaliam, e isso leva a "level unlocking" | [P](S18) |
| 2019–2024 | Existe XP: jogadores reclamam de "não receber EXP nem moeda" depois de enviar | [C](S45) |
| 2.0 (2025) | A recompensa sobe com as estrelas. O teto de 5★ caiu de **500 para 250 DD**. Desafios comuns pagam de 100 a 200 DD | [C](S6, S8, S46) |
| 2.0 (2026) | A **Bonus Bar** avisa quando há bônus disponível. Os **Pro Challenges** dão multiplicador "desde o primeiro toque" a quem usa itens top | [D](S3) |
| 2.0 | **Boosters** de 1h e 2h liberam categorias por tempo. Num relato, a 1h paga não contou estrelas porque o ranking virou no meio | [D/C](S1, S6) |
| 2.0 | Votar nos outros também rende: "precisa votar para ganhar cabelo e locações" | [C](S46) |

**Não é público:** o XP por estrela, se votar dá XP, a fórmula e se a posição na liga dá XP. O que se observa é que
**XP e moedas vêm do envio e escalam com a nota da comunidade**, com bônus por aderência ao brief, por itens "top" (Pro)
e por boosters pagos **[I]**.

### 4.3 Curva de níveis e ranks

- **Ranks:** "Wardrobe Intern" no início e "Style Icon" no topo. Os intermediários nunca aparecem nas fontes
  **[C]**(S47). A Globe and Mail (2025) fala em promoção a **"Styling Assistant"** dentro de uma "hierarquia de
  stylists" **[P]**(S41), e um agregador lista de "newbie" a "top stylist" **[C]**(S46).
- **Níveis numéricos:** existem (nível 3 em 2019, "Level Up rewards" em 2026), mas **o total de níveis e o XP de cada
  um não são publicados** **[P/D]**(S3, S20).
- **Formato da curva [C → I]:** o começo é rápido (tutorial, nível 3 no primeiro dia). Depois as recompensas "encolhem
  depois que você sobe", e "chegar ao topo exige gastar, e ficar lá também". Em 2021, só **cerca de 500 jogadores**
  tiravam 5★ com consistência. O padrão é uma curva crescente, em que o meio do jogo trava pela **moeda**, não pelo XP
  **[P/C]**(S6, S25).
- **Level Up rewards (fev. e abr. de 2026):** "toque na sua foto para ver o que vem a seguir: Level Up rewards,
  exclusive drops e fashion moments". O perfil vira o "front-row pass" **[D]**(S3).

### 4.4 O que cada nível destrava (não há tabela pública; segue a reconstrução)

| Desbloqueio | Depende de nível? | Evidência |
|---|---|---|
| Desafios novos e em maior número | **Sim** (2019) | "new challenges unlock as you reach new levels" **[P]**(S20) |
| Recompensas de nível e "exclusive drops" | **Sim** (2026) | notas das versões 1.69 e 1.71 **[D]**(S3) |
| Ligas mais altas | Não: dependem do desempenho nas rodadas | "four new leagues", "Between Rounds" **[D]**(S3) |
| Cabelos e maquiagens | **Não**: tickets, kits ou compra. Antes saíam de "style tickets" ganhos jogando | **[C]**(S6, S8) |
| Locações | Compradas ou ganhas em eventos (fundos dinamarqueses na CPHFW) | **[C/P]**(S36, S45) |
| Supermodelos | "Booking" pago, com 5% para caridade e um período inicial grátis | **[P/C]**(S22, S45) |
| Poses | São poucas. Um jogador pede para destravá-las por nível, sinal de que hoje não é assim | **[C]**(S2) |
| Roupas e marcas | O acervo é aberto, limitado por **preço e usos**, não por nível | **[I]**(S1, S6) |

### 4.5 Moedas e "energia" em cada versão

| Versão | Moedas | O que limita o jogo | Fonte |
|---|---|---|---|
| 2019 | **Drest Dollars**: 10 ou 15 mil no início, pacote de 5 mil por US$ 3,99. **Photoshoot Hours**: 60 no início | As horas funcionam como **energia**, e cada desafio consome horas. Ganha-se DD convidando amigos e vendo vídeos | [P](S19–S21) |
| 2020–2023 | Moeda do jogo e "Drest Credits". Havia um **premium com desafios ilimitados e avatar próprio** | Se o premium dava "ilimitado", a versão grátis tinha teto | [P](S34) |
| 2.0 | **DD**, **Style Credits**, **Gems/Diamonds** (premium, as "red gems"), coins, **tickets** e um "vault" | Peça = **5 usos**, renovados com gems. Alguns desafios custam milhares de DD para entrar. Gems "para cada desafio". Boosters por tempo | [C](S6–S8, S46) |

Outros relatos do 2.0 **[C]**: o bônus diário de Style Credits acabou; as recompensas diárias e semanais caíram para
"uma grátis"; saldos de prêmio somem em bugs (S8); as vantagens do Luxe acabam com o evento ("£7 por evento") (S6). Na
prática, o **custo e a renovação dos itens freiam o meio do jogo mais que o XP** **[I]**.

### 4.6 Loops diário e semanal

- **Diário:** desafios novos vindos da notícia do dia. A meta diária é de **10 looks**, mas há relato de só **8
  desafios novos por dia** **[C]**(S2). Há alertas de tarefa diária **[D]**(S3) e créditos de login **[C]**(S46).
- **Janela de votação:** algumas horas, em que a pessoa vota nos outros e espera a própria nota **[D]**(S7).
- **Semanal:** rankings semanais **[P]**(S40). Ligas em rodadas, com contagem "Between Rounds" e "your fate being
  calculated", o que sugere promoção e rebaixamento **[D/I]**(S3). Em 2026 chegaram **4 ligas e "gift boxes"**
  **[D]**(S3). Queixas: ligas "impossíveis de ganhar" e prêmio de "stylist race" que não chega **[C]**(S2, S6).
- **Engajamento (números da empresa, sem auditoria):** 33 min/dia (2020); 12–15 min por sessão, 3 vezes ao dia
  (2023); 37 min por sessão (2023); 50 min/dia (2026); **1 a 4 h** nas ativações de marca **[P/D]**(S14, S18, S24, S31, S34, S39).

### 4.7 Temporadas, eventos e trilhas

- **Calendário:** Fashion Weeks, Met Gala, The Fashion Awards e Wimbledon. Na Copenhagen Fashion Week de 2023 foram 6
  dias de desafios, com fundos temáticos de prêmio **[P/D]**(S15, S35, S36).
- **Special events:** cada um traz um catálogo próprio ("new catalog drops") e recompensas **[D]**(S3). Dois passes por
  evento: **Luxe Pass** (US$ 3,99 / R$ 24,90) e **Luxe Plus** (US$ 6,99 / R$ 49,90), com temas como "The Art of the
  Gentleman" e "Twenties-Maxxing" **[D]**(S4, S5). Como funciona por dentro (marcos, trilha grátis × paga) **não é
  público**. Parece um passe de evento em duas camadas **[I]**. Em abril de 2025 um jogador ainda pedia um "season
  pass" **[C]**(S7).
- **Quest de marca (Manolo Blahnik, 2025):** começa com um presente digital, depois traz uma seleção curada e 6
  penteados e 5 locações exclusivos. Compartilhar nas redes concorre a £950. Quests "destravam produtos exclusivos"
  **[P]**(S38).
- **Prêmios reais:** viagem ao British Fashion Awards (Pandora), bolsa Versace e ingressos, produtos NARS para 15
  vencedores, batons Lisa Eldridge e um kit Polo Ralph Lauren × Wimbledon (cerca de US$ 1.200, **só maiores de 18**)
  **[P/D]**(S15, S27, S30, S40, S41).

### 4.8 Como a maquiagem entra na progressão

- **Beauty Mode:** close no rosto, com desafios de "beauty shoot" e "mood board". Seguem o mesmo ciclo de envio, nota e
  recompensa **[P]**(S26). A maquiagem também é um dos 4 elementos de todo photoshoot **[P]**(S18).
- **Desafios de beleza patrocinados:** duram de 1 a 4 semanas e dão prêmio físico. Gucci Beauty (29 itens, S53); NARS (30
  produtos e 62 variantes de intensidade, 15 vencedores escolhidos pela diretora artística); Lisa Eldridge (12 tons de
  batom); Bakeup (7 looks e mais 2 de Pride) **[P]**(S26, S27, S30, S32).
- **Beleza é consumível ou travada:** kits, presets e boosters pagos, nenhum destravado por nível. Ver §6.4
  **[D/C]**(S4, S5, S46).
- **Não encontramos XP próprio de maquiagem** nem nível de maquiadora **[não confirmado]**. Jogadores desconfiam que
  maquiagem e acessórios **não sobem a nota** **[C]**(S7). Lição para o FLAIR: o brief precisa **pontuar a maquiagem
  explicitamente**. Produtos, menu e preços de beleza estão na §6.

### 4.9 O que faz voltar e o que afasta

- **Faz voltar:** a notícia do dia vira desafio; a nota sai em poucas horas; ligas; eventos com prazo e catálogo
  exclusivo; prêmios reais; colecionar marcas reais; a sensação de "aprender a vestir como editora" **[D/C]**(S2, S8).
- **Afasta:** recompensas que encolhem; renovar itens; desafios repetidos (vestido vermelho, terno); poucas poses; bugs
  em compras **[C]**(S2, S6).

## 5. Guarda-roupa e catálogo em cada jogo

### 5.1 O que o guarda-roupa mostra em cada tipo de jogo

| Jogo ou desafio | O que se monta | Catálogo exibido | Fonte |
|---|---|---|---|
| Photoshoot (desafio diário) | Modelo, look completo, cabelo, maquiagem, locação e às vezes pose | **Todo o acervo**. A peça exigida pelo brief precisa ser achada à mão (pedem "ordenar por requisito") | [P/C](S18, S45) |
| Mood Board | Composição sem modelo: fundo, stickers e produtos | Produtos, fundos, stickers e props | [P/C](S18, S47) |
| Beauty Mode | Close no rosto, com produto, tom e intensidade | Linha da marca patrocinadora mais a maquiagem geral | [P](S26, S27) |
| Jewellery & Watch Mode | Close em joias e relógios | Anéis, brincos, pulseiras, colares e relógios (Cartier) | [P](S28, S43) |
| Quest, VIP Event, Narrative | Série de desafios contando uma história | **Seleção curada da marca**. Manolo Blahnik: 18 sapatos, 2 bolsas, 1 sacola-presente, 6 penteados, 5 locações, além de um presente inicial | [P](S38) |
| Special event | Desafios temáticos | "Catalog drop" do evento. As vantagens do Luxe acabam junto com o evento | [D/C](S3, S6) |
| Pro Challenge, liga, stylist race | O mesmo do photoshoot | Acervo normal. Itens "top" rendem multiplicador | [D/C](S3, S6) |

### 5.2 Navegação: busca, filtros e marcas

- **2019:** o guarda-roupa tinha **barra de busca**, e as peças vinham da Farfetch **[P]**(S20).
- **App original, segundo avaliações:** "só três itens na tela por vez"; filtro lento; "sem busca avançada"; sem divisão
  por categoria; sem separar "usadas/não usadas"; não dá para abrir o próprio closet no meio do desafio; pedidos de
  filtro por atributo ("todo o denim", "cropped rosa") **[C]**(S45).
- **2.0:** as versões 1.68 e 1.72 trazem "refined filters", e a 1.69 traz ícones de tranças, rabos de cavalo e chapéus
  na aba de cabelo **[D]**(S3). Mesmo assim, jogadores ainda pedem busca, ordenação, filtros, fixar peças e "a volta da
  lista de favoritos" (ou seja, ela existia e saiu). Há queixa de rolar "o guarda-roupa inteiro de novo"
  **[C]**(S1, S2).
- **Páginas de marca:** **não confirmamos** que existam. A marca aparece como **seleção de Quest**, e cada item leva
  ao site da marca (NARS em 2021, todas no 2.0) **[P]**(S27, S38, S42).

### 5.3 Árvore de categorias (reconstruída; a árvore oficial não é pública)

```
Casting ........ modelos: supermodelos (booking pago) e avatares de vários corpos e etnias      [P]
Roupas ......... vestidos; tops/cropped [C]; malhas e casacos (casaco Alaïa) [P]; alfaiataria e ternos [C];
                 jeans/denim [C]; saias e shorts [P]; por ocasião: dia, noite, férias, editorial  [D]
Sapatos ........ (Manolo Blahnik: 18 pares na Quest)                                             [D/P]
Bolsas ......... (Gucci Sylvie em 2019)                                                          [D/P]
Joias/relógios . anéis, brincos, pulseiras, colares, relógios                                    [P]
Cabelo ......... penteados: rabo de cavalo, ondas, "editorial edge", tranças; chapéus (ícone na aba
                 de cabelo); cor e gloss (Josh Wood: tom, brilho, glitter); assinados (McKnight: 9 por
                 supermodelo; Artist Series)                                                      [D/P]
Maquiagem ...... olhos (sombra, delineado, máscara, cor dos olhos [C]); sobrancelhas; lábios (batom,
                 gloss, kits); pele (iluminador, contorno, blush); unhas (esmalte); presets/"looks"
                 (glam, edgy, clean, creative)                                                    [D/P]
Cena ........... locações, fundos, stickers, props e poses (poucas)                              [D/P/C]
```

Os nomes das abas e das subcategorias de roupa **não foram confirmados**: não há captura de tela legível nem wiki.
A divisão por tipo de peça acima é o padrão observado em avaliações e na imprensa.

### 5.4 Grátis, por nível, por compra; é seu ou é aluguel?

| Situação | Exemplos | Moeda ou preço | Fonte |
|---|---|---|---|
| **Grátis** | Presente de marca na Quest, recompensas de evento e de nível ("exclusive drops"), fundos de evento, supermodelos grátis de 1 a 9/12/2020, gems iniciais | — | [P/D/C](S3, S22, S36, S38) |
| **Travado por nível** | Só "Level Up rewards/exclusive drops" e desafios novos. **Não há confirmação** de roupa travada por nível | — | [D/P](S3, S20) |
| **Compra com moeda do jogo** | Roupas, sapatos, bolsas. Em 2019, a Gucci Sylvie custava 3.500 DD (orçamento inicial de 10 a 15 mil). No 2.0, "milhares" por peça | DD e Style Credits | [P/C](S1, S6, S20) |
| **Compra com moeda premium** | Peças premium (vestido de 15 diamantes), renovação de usos, "vault" | Gems/Diamonds (dinheiro real ou ranking) | [C](S2, S7, S8) |
| **Cabelo e maquiagem** | Looks travados, liberados com tickets ou kits: cabelo US$ 15 por 3, presets US$ 9,99 por 5, Brown Lip Kit | Tickets ou dinheiro real | [D/C](S5, S6, S46) |
| **Acesso temporário** | Booster 1h ou 2h ("unlock all categories for 2 hours"); boosters Hair, Jewellery, Props e Halloween | US$ 0,99 a 4,99 | [D](S1, S5) |
| **Evento** | Itens do Luxe Pass/Plus, que somem no fim do evento | US$ 3,99 ou 6,99 | [D/C](S5, S6) |
| **Supermodelo** | Booking (ex.: US$ 3,99) | Dinheiro real | [C](S45) |

**Posse ao longo do tempo:**

- **No começo, a compra era permanente:** "depois de comprada, você pode usar de novo, mas é difícil achar"
  **[C]**(S45).
- **No app original, mais tarde, veio o "renew"** dos itens que a pessoa já tinha: "agora dá para usar 5 vezes até
  destravar mais usos", e "os looks de maquiagem ilimitados acabaram" **[C]**(S45).
- **No 2.0, cada compra vale 5 usos** ("temos cinco de cada item"). Depois é preciso pagar de novo. Há bug de item de
  15 diamantes que entregou 2 usos em vez de 5 **[C]**(S2, S8). Na prática é **aluguel por uso** **[I]**. O "vault"
  aparece como compra que some depois de duas vezes, e não confirmamos para que serve **[C]**(S6).

## 6. Tipos de maquiagem e beleza

### 6.1 Como a beleza evoluiu

- **2020: maquiagem da casa.** Mary Greenwell desenhou "todo o portfólio de maquiagem digital". Havia dois jeitos de
  maquiar:
  - **elemento por elemento** ("trocar o delineado num instante", "mudar a cor do lábio", cílios);
  - **looks prontos de 1 toque**, em edição limitada: "Fashion Fantasy", "Verdant Summer" (paleta verde), "Summer
    Sunset" (olho amarelo e laranja, pele e boca mínimas).

  Valiam para os 12 avatares, e o app trazia tutoriais da própria Greenwell **[P]**(S54–S56).
- **2021: Beauty Mode.** Close no rosto e no tronco, com poses novas. A "Variant technology" deixa escolher **como**
  aplicar cada produto. Gucci Beauty (29 itens, mais de 40 looks), depois NARS. Desafios de beleza sem marca previstos
  para janeiro de 2022 **[P]**(S26, S27, S53, S57).
- **2022–2023:** Lisa Eldridge (12 tons de batom e filtro de prova no Instagram) e Bakeup (7 looks e mais 2 de Pride)
  **[P]**(S30, S32, S58).
- **2.0 (2024–2026):** a descrição fala em "iluminar e contornar" e em olhos, sobrancelhas e lábios. Os looks seguem
  as estéticas **glam, edgy, clean, creative** e "polished, contemporary, timeless". Há kits pagos **[D/C]**(S1, S5, S10, S46).

### 6.2 Tipos de produto

| Tipo | Situação | Marcas reais e exemplos | Fonte |
|---|---|---|---|
| Base, pele, corretivo | **Não confirmado.** O tom de pele vem do avatar; Greenwell ajustou cada produto a cada tom | — | [P/I](S26, S53) |
| Contorno e iluminador | Citados na descrição do 2.0 ("highlight, contour"). Bronzer não confirmado | — | [D](S10) |
| Blush | Sim | NARS | [P](S27) |
| Sombra | Sim | Gucci Palette Beauté des Yeux Floral (9 tons), NARS, paletas dos looks Greenwell | [P](S26, S27, S56) |
| Delineado | Sim. O 2.0 vende estilos (6 por US$ 1,99) | Gucci, NARS | [P/C](S26, S27, S46, S55) |
| Máscara e cílios | Sim | Gucci, NARS, "lashes" (2020) | [P](S26, S27, S55) |
| Sobrancelhas | Sim (descrição do 2.0) | — | [D](S10) |
| Cor dos olhos | Vendida no 2.0 (5 por US$ 15) | — | [C](S46) |
| Batom, gloss, cor de lábio | Sim | Gucci Rouge de Beauté Brillant, NARS Air Matte, Lisa Eldridge (linhas Luxuriously Lucent e Insanely Saturated), "Brown Lip Kit" (2.0) | [P/D](S5, S27, S30, S57) |
| Lápis de boca | **Não confirmado** (o conteúdo do "Lip Kit" não é descrito) | — | [D](S5) |
| Unhas | Sim | Gucci Vernis à Ongles | [P](S57) |
| Adornos e arte facial | Sim, em evento | Bakeup: Disco Veiler (malha e microcristais) e Playbox (gemas, de um ponto no olho a um raio no rosto inteiro) | [P](S32, S58) |
| Cabelo (junto com a beleza) | Sim | Penteados Sam McKnight e Artist Series, cor e gloss Josh Wood, Booster Hair (R$ 6,90) | [P/D](S4, S39, S42) |

### 6.3 Como o menu de beleza é organizado

- **Dois caminhos** **[P]**(S54, S55):
  - montar **produto a produto**, por área do rosto: olhos, sobrancelhas, lábios, pele (iluminar e contornar) e unhas;
  - aplicar um **look pronto** com 1 toque.
- **Variações:** cada produto tem tom e intensidade. A Gucci tinha 29 itens que geravam mais de 40 looks; a NARS, 30
  produtos com 62 variantes **[P]**(S27, S57).
- **Looks prontos:** agrupados por estética (glam, edgy, clean, creative) **[D]**(S10). O cabelo tem aba própria, com
  ícones de tranças, rabos de cavalo e chapéus **[D]**(S3).
- **Não confirmado:** os nomes exatos das abas e se existe algum pincel ou aplicação livre. Ao que tudo indica, tudo é
  escolhido em lista **[I]**.

### 6.4 Marcas reais ou genéricas; grátis, por nível ou pago

- **Marcas reais, sempre por tempo limitado:** Gucci Beauty (72 h para a WWD, até 08/10 para a FashionUnited), NARS
  (9 dias), Lisa Eldridge (1 mês) e Bakeup (cerca de 1 mês). Depois disso o produto só aparece nos looks já enviados
  por outros jogadores. Há link para comprar no site da marca **[P]**(S27, S30, S32, S53, S57).
- **Genéricos:** a maquiagem da casa (Greenwell), os desafios de beleza sem marca de 2022 e, no 2.0, os presets e kits,
  que não citam marca **[P/D/I]**(S5, S53, S55).
- **Grátis:** os desafios de beleza de 2021 eram gratuitos, e quem jogava ganhava um produto digital para usar depois
  **[P]**(S53). As fontes não dizem se os elementos básicos eram grátis.
- **Pago ou travado:**
  - No app original, os "looks de maquiagem ilimitados" acabaram, dando lugar a usos limitados **[C]**(S45).
  - No 2.0, os looks de maquiagem ficam travados atrás de tickets (antes ganhos jogando, hoje pagos) ou de kits:
    Brown Lip Kit (US$ 2,99 ou 4,99), presets (US$ 9,99 por 5), cores de olho, estilos de delineado
    **[D/C]**(S5, S6, S46).
  - Os boosters liberam "todas as categorias" por 1 ou 2 horas **[D]**(S1).
- **Por nível:** nenhuma fonte diz que maquiagem se destrava por nível **[não confirmado]**.

### 6.5 Como a maquiagem pesa na nota

- **Desafio comum:** quem dá a nota é a comunidade, em estrelas. A maquiagem é um dos 4 elementos do photoshoot, mas
  nenhuma fonte documenta quanto ela pesa **[P]**(S18).
- **Desafio de maquiador ou de marca:** quem escolhe o vencedor é um especialista. Greenwell julgou o "Summer Sunset"
  (bônus de 2.500 DD), e a diretora artística da NARS escolheu 15 vencedores **[P]**(S27, S56). Nos desafios
  patrocinados, o brief pede os produtos da marca **[P/I]**(S53, S57).
- **Percepção dos jogadores:** desconfiam que looks **sem** acessórios, maquiagem ou props tiram nota maior
  **[C]**(S7).
- **Para o FLAIR [I]:** a nota deve ter critérios de maquiagem explícitos e verificáveis (técnica, paleta, área do
  rosto), tanto no checklist do brief quanto no júri.

## 7. Monetização

- **Grátis:** baixar, desafios diários, votar e moedas ganhas jogando **[D/C]**(S1).
- **IAP (EUA e Brasil) [D](S1, S4, S5):** Gem Offer e Gem Packs de US$ 1,99 a 9,99 (no Brasil, R$ 12,90 e R$ 29,90 nos itens listados); Drest Dollar e Style
  Credit Offer por US$ 1,79 (R$ 6,90); Boosters de 1h a US$ 2,99 (R$ 19,90) e de 2h a US$ 4,99 (R$ 29,90); boosters de
  joias e props a US$ 0,99; starter pack e Fashion Fund a US$ 0,99; Luxe Pass/Plus; kits de beleza; "A Cafe Rendezvous"
  a US$ 4,99.
- **Assinatura:** nenhuma aparece na loja. Houve um relato de cobrança mensal depois de comprar starter packs
  **[D/C]**(S1, S7).
- **Anúncios:** a loja declara "Contains Advertising", e o AppGoblin detecta SDKs (Google, AppLovin, ironSource, Unity
  Ads). A estimativa é de 100% da receita vinda de IAP no iOS e 39% de anúncios no Android. Jogadores do iOS elogiam a
  ausência de anúncios **[D/C]**(S1, S8, S11, S12).
- **Marcas pagam:** desafios patrocinados, Quests, VIP Events, conteúdo para lançamentos e dados ("testar antes de
  produzir"). Os valores **não são públicos**, e a BeautyMatter chama as marcas de "licensing partners"
  **[P]**(S23, S31, S34, S40, S42).
- **Compra real:** afiliação Farfetch com comissão (2019) e link para o site da marca no 2.0. Exemplo: um casaco Alaïa
  de US$ 16.940 na SSENSE **[P]**(S17, S33, S41, S42). Não confirmamos se a Farfetch continua no 2.0.
- **A escala é incerta:** a empresa diz ter mais de 500 mil MAU; a data.ai/Naavik mediu ~150 mil MAU no pico
  (ago/2021), ~29 mil MAU em out/2024 e ~4 mil DAU em nov/2024; o AppGoblin estima ~26 mil MAU e menos de US$ 10 mil/mês
  de IAP **[D/P/C]**(S11, S12, S37, S43). Os "£72,5 mi de receita em 2022" da BeautyMatter são **pouco confiáveis**:
  batem com o mercado mobile global citado pela Glossy **[I]**(S34, S42).

## 8. Visual e tecnologia

- **Motor:** Unity no 2.0, com Braze, Singular, Firebase e HelpShift **[D/P]**(S11, S12, S40).
- **Avatares:** as supermodelos foram capturadas em **estúdio de fotografia 3D** e refinadas por uma equipe interna
  **[P]**(S23, S51). Para o close de beleza foram feitas mais de 4.000 imagens e sessões técnicas (S26). Há corpos de
  vários tamanhos e etnias (com a Fashion Minority Alliance) (S41). O avatar próprio ou selfie foi prometido, mas não
  confirmamos que exista **[P]**(S27, S35).
- **Peças:** recriadas com "**AI retouch**" a partir de imagens do produto e renderizadas em vários corpos. Os batons
  são calibrados por cor **[P]**(S23, S30).
- **2D ou 3D:** a estética é "real fashion photography" **[P]**(S37), e jogadores pedem modelo que gire, zoom, mais
  poses e mais expressões **[C]**(S2, S6, S8). Ou seja, a captura é 3D, mas a exibição é uma **imagem fixa por pose**,
  sem câmera livre **[I]**. É aqui que o FLAIR 3D se diferencia.
- **Maquiagem:** escolhe-se produto, tom, intensidade ou um preset. Não há pincel livre **[P/I]**(S26, S27, S32).
- **Foto:** o "photoshoot" fica salvo no perfil e pode ser compartilhado. As locações recriam lugares reais (lojas
  Manolo Blahnik, sala anos 70, capa de revista). O app vibra a cada troca de item **[P/C]**(S7, S17, S38).

## 9. Avaliações, classificação etária e controvérsias

- **Notas:** iOS nos EUA 4,5 (4,9 mil avaliações), no Reino Unido 4,3 e no Brasil 4,5 (663); Android ~4,1 (3,7 mil)
  **[D/C]**(S1, S4, S6, S12).
- **Classificação:** **13+** nos EUA (com Age Assurance, "Contests: Frequent" e "Advertising") e **A12** no Brasil. Os
  termos pedem 13 anos, exigem permissão dos pais para compras de menores de 18 e restringem concursos a maiores de 18
  **[D]**(S1, S4, S15).
- **Elogios [C]:** peças reais da temporada, modelos diversas, valor "educativo", poucos anúncios, links de compra,
  "melhor que o Covet" (S2, S6, S8).
- **Críticas [C]:** "money hungry" (um 5★ completo pode custar £50 por dia); itens de 5 usos; cabelo e maquiagem pagos;
  desafios repetidos; notas inconsistentes; boosters e prêmios que não chegam; cobrança em dobro; progresso perdido no
  login; suporte em até 72 h (S2, S6–S8).
- **Controvérsias:** nenhum escândalo na imprensa. Pontos sensíveis: a BoF (2019) citou o "compulsion loop"
  **[P]**(S19); em 2023 falava-se de "metaverso", mas o produto "não é Web3" **[P]**(S35); há rastreamento declarado
  num app 13+ **[D]**(S1); os termos se contradizem sobre a idade nos concursos **[D]**(S15); as métricas da empresa
  divergem das de terceiros (§7).

## 10. Lições para o FLAIR 3D MAKE UP

- **Copiar [I]:** brief curto ligado ao calendário (o Momento do FashionAI); envio, janela de votação e estrelas; ranks
  com nome de carreira (de estagiária de beleza a ícone); eventos com catálogo temático; close de beleza com produto,
  tom e intensidade; locações e props como recompensa; ligas semanais; "Level Up rewards" no perfil; seleção curada
  por Quest.
- **Evitar [I]:** itens de uso limitado com renovação paga; boosters com relógio; multiplicador para item premium
  (pay-to-win); pagar para "mudar a nota"; recompensas que encolhem; guarda-roupa sem busca nem filtro; maquiagem que
  não pesa na nota.

**Lógica proposta para o FLAIR (rascunho [I], a validar com a dona):**

1. **XP por desafio = base (dificuldade) + aderência ao brief + nota + bônus de primeira vez.** A aderência é um
   checklist verificado no servidor (técnica, paleta, área do rosto). A nota vem da comunidade ou de regra. **Nunca dar
   bônus por gasto.**
2. **Curva:** rápida nos níveis 1–5, com uma técnica por nível (base, sobrancelha, olho, delineado, lábio, contorno).
   Depois, moderada: `XP(n) ≈ 100·n^1.5`.
3. **Desbloqueio por nível, não por compra:** técnicas, paletas, poses, ângulos de câmera, cenas 3D (camarim,
   backstage, passarela) e tipos de desafio.
4. **Guarda-roupa:** o que foi conquistado é **permanente**. Busca, filtro por categoria, cor e marca, e favoritos
   desde o início. A peça exigida pelo brief aparece em destaque.
5. **Ritmo:** três desafios por dia, sem energia punitiva. Liga semanal sem vantagem paga. Evento como temporada, com
   trilha **gratuita e determinística**: sem caixa aleatória.
6. **No TCC, só moeda fictícia ganha jogando** (sem compra real, como diz o `CLAUDE.md`). O FLAIR já tem Carteira e
   Missões (`docs/flair/CENTRAL_FLAIR.md`).

**Brasil: notas legais.** Os itens com "(validar)" vêm de conhecimento geral e precisam passar pelo jurídico.

- **ECA Digital (Lei 15.211/2025, em vigor desde 17/03/2026) [P](S48–S50):** **proíbe loot boxes** em jogos para
  menores ou de provável acesso por eles (gift box só determinística e sem compra); exige supervisão parental e limites
  a recursos que estimulam uso excessivo (timers e streaks punitivos) e verificação de idade confiável para conteúdo
  impróprio; proíbe perfilar menores para publicidade (segundo escritórios); multa de até 10% do faturamento, ou de
  R$ 10 a R$ 1.000 por usuário, limitada a R$ 50 milhões.
- **Marcas e pessoas reais:** uso comercial de marca exige licença (LPI, Lei 9.279/1996, validar); no TCC, **marcas
  fictícias** ou autorizadas por escrito, sem logotipos. Imagem e nome têm proteção (CF art. 5º, X e XXVIII "a";
  Código Civil, arts. 18 e 20, validar): nada de semelhança com celebridades. Biometria facial é dado sensível (LGPD
  art. 11), e dados de adolescentes seguem o melhor interesse (LGPD art. 14).
- **Beleza:** avisar que o tom virtual não é igual ao real. Não alegar efeito sem prova (CDC art. 37; normas de
  cosméticos da ANVISA, validar).
- **Publicidade e afiliados:** identificar todo link pago (CDC art. 36, CONAR, validar). Não incentivar o consumo de
  menores (CDC art. 37 §2º; Resolução CONANDA 163/2014, validar). Nenhum anúncio comportamental.
- **Prêmios reais:** sorteio depende de autorização, mas concurso **exclusivamente cultural**, sem compra nem sorte, é
  dispensado (Lei 5.768/1971, validar). O DREST também exclui países e limita a maiores de 18.

## 11. O que não foi possível confirmar

- **Progressão:** XP por estrela ou por voto, número de níveis, ranks intermediários, tabela de desbloqueio por nível,
  estrutura do Luxe Pass e do Luxe Plus, e se as gift boxes são aleatórias.
- **Guarda-roupa:** nomes oficiais das abas e subcategorias, existência de páginas de marca, função do "vault", lista
  exata do que é grátis, preço de cada peça no 2.0.
- **Maquiagem:** base, corretivo, bronzer e lápis de boca; nomes das abas de beleza; existência de aplicação livre;
  peso da maquiagem na nota; qualquer desbloqueio por nível.
- **Avatares e marcas:** **Adriana Lima** não aparece em nenhuma fonte (Irina Shayk está confirmada); se há modelos
  masculinos (jogadores pedem); se a Farfetch segue no 2.0; termos financeiros com as marcas.
- **Fora de alcance:** textos completos de Vogue Business, WWD (S44), BoF e Fast Company (paywall ou bloqueio); nada
  encontrado no The Guardian, no TechCrunch ou na Forbes; o Google Play (S9) não carregou, e usamos espelhos (S10, S12).

## Fontes

- S1 App Store EUA: https://apps.apple.com/us/app/-/id1630969055
- S2 Avaliações (EUA): https://apps.apple.com/us/app/drest-fashion-dress-up-game/id1630969055?see-all=reviews&platform=iphone
- S3 Histórico de versões: https://apps.apple.com/us/app/drest-fashion-dress-up-game/id1630969055?see-all=version-history
- S4 App Store Brasil: https://apps.apple.com/BR/app/id1630969055
- S5 App Store (Butão, lista de IAP): https://apps.apple.com/bt/app/drest-fashion-dress-up-game/id1630969055
- S6 Avaliações (Reino Unido): https://apps.apple.com/gb/app/drest-fashion-dress-up-game/id1630969055?see-all=reviews&platform=iphone
- S7 Avaliações (Canadá): https://apps.apple.com/ca/app/drest-fashion-dress-up-game/id1630969055?see-all=reviews&platform=iphone
- S8 Avaliações (Austrália): https://apps.apple.com/au/app/drest-fashion-dress-up-game/id1630969055?see-all=reviews&platform=iphone
- S9 Google Play (não carregou): https://play.google.com/store/apps/details?id=com.drest.drestpro
- S10 Espelho do Google Play [C]: https://drest-style-the-latest-fashion.apps112.com/
- S11 AppGoblin iOS [C]: https://appgoblin.info/apps/1630969055
- S12 AppGoblin Android [C]: https://appgoblin.info/apps/com.drest.drestpro
- S13 MWM [C]: https://mwm.ai/apps/drest-fashion-dress-up-game/1630969055
- S14 Site oficial: https://drest.com
- S15 Termos: https://drest.com/terms
- S16 Diretrizes da comunidade: https://drest.com/community-guidelines
- S17 TheIndustry (2019): https://www.theindustry.fashion/drest-the-worlds-first-interactive-luxury-styling-game-launches/
- S18 Entrevista com Yeomans (2020): https://theindustry.beauty/the-interview-lucy-yeomans-founder-and-ceo-at-drest/
- S19 BoF (2019, só trecho): https://www.businessoffashion.com/articles/technology/a-new-game-could-be-fashions-farmville-will-people-pay-to-play
- S20 The Blueprint (2019): https://theblueprint.ru/fashion/phenomenon/modnaya-igra-drest
- S21 Culture Whisper (só trecho): https://culturewhisper.com/r/fashion/new_fashion_app_game_dress_up/14685
- S22 FashionUnited, supermodelos: https://fashionunited.com/news/fashion/drest-adds-supermodel-line-up-to-fashion-styling-game/2020120136806
- S23 Luxury Briefing: https://www.luxury-briefing.com/2021/02/lucy-yeomans-ceo-founder-drest-luxury-fashion-gaming/
- S24 Soho House: https://www.sohohouse.com/projects/press-play/drest
- S25 Glossy (2021): https://www.glossy.co/fashion/drest-founder-lucy-yeomans
- S26 Cosmetics Business, Gucci Beauty: https://cosmeticsbusiness.com/gucci-beauty-enters-gaming-in-exclusive-partnership-with-styling-app-drest-179606
- S27 Glossy, NARS: https://www.glossy.co/beauty/nars-cosmetics-launches-on-drest-app
- S28 FashionUnited, Cartier (2021): https://fashionunited.com/news/fashion/drest-partners-with-cartier-and-adds-jewellery-and-watch-mode/2021091442109
- S29 FashionNetwork, Kate Moss: https://us.fashionnetwork.com/news/Kate-moss-is-drest-s-first-ever-guest-avatar,1391623.html
- S30 Cosmetics Business, Lisa Eldridge: https://cosmeticsbusiness.com/lisa-eldridge-joins-drest-as-guest-make-up-artist-with-new-lip-collection--202130
- S31 PocketGamer.biz, Bridgett: https://www.pocketgamer.biz/lisa-bridgett-on-the-creation-and-evolution-of-drest/
- S32 Cosmetics Business, Bakeup: https://cosmeticsbusiness.com/drest-collaborates-with-experimental-beauty-brand-bakeup-on-avatar-make-up-looks-208869
- S33 FashionNetwork, rodada de 2023: https://us.fashionnetwork.com/news/Drest-raises-more-funding-to-develop-metaverse-enabled-version-2-0,1529118.html
- S34 Glossy (2023): https://www.glossy.co/fashion/mobile-fashion-gaming-is-gaining-traction/
- S35 Decrypt, Copenhagen Fashion Week: https://decrypt.co/151520/copenhagen-fashion-week-drest-game
- S36 PocketGamer.biz, Copenhagen Fashion Week: https://www.pocketgamer.biz/drest-announces-new-collaboration-with-copenhagen-fashion-week
- S37 Naavik (2024): https://naavik.co/digest/a-new-line-of-fashion-games/
- S38 Walpole, Manolo Blahnik: https://www.thewalpole.co.uk/news/game-on-for-manolo-blahnik
- S39 Cosmetics Business, Sam McKnight: https://cosmeticsbusiness.com/drest-partners-with-sam-mcknight-to-bring-luxury-beauty-to-mobile-gaming
- S40 PocketGamer.biz, Unity: https://www.pocketgamer.biz/how-drest-relaunched-on-unity-to-merge-fashion-with-gaming/
- S41 The Globe and Mail: https://www.theglobeandmail.com/life/style-advisor/article-virtual-style-with-real-impact-is-drawing-designers-in/
- S42 BeautyMatter (2025): https://www.beautymatter.com/articles/drest-where-luxury-beauty-meets-the-grown-up-gamer
- S43 FashionUnited, Cartier (2026): https://fashionunited.com/news/fashion/drest-continues-expansion-into-luxury-jewellery-with-cartier/2026031171088
- S44 WWD (não lido, paywall): https://wwd.com/business-news/technology/drest-takes-fashion-gaming-new-level-immersive-luxury-experiences-1236718415/
- S45 JustUseApp, avaliações do app original [C]: https://justuseapp.com/en/app/1477620933/drest-fashion-styling-game/reviews
- S46 Game-Solver [C]: https://game-solver.com/drest-dress-up-fashion-game/
- S47 GamersUnite [C]: https://www.gamersunite.com/drest
- S48 Agência Senado, ECA Digital: https://www12.senado.leg.br/noticias/materias/2026/03/17/eca-digital-para-protecao-on-line-de-criancas-e-adolescentes-entra-em-vigor
- S49 Congresso em Foco, ECA Digital: https://www.congressoemfoco.com.br/noticia/117235/eca-digital-entra-em-vigor-o-que-muda-com-a-nova-lei
- S50 Lei 15.211/2025 (Planalto, bloqueado daqui): https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/L15211.htm
- S51 Vaga de "Avatar production intern": https://hitmarker.net/jobs/into-games-avatar-production-intern-drest-kickstart-scheme-900239
- S52 Blog ha-na (2020) [C]: https://ha-na.nl/2020/05/drest-app/
- S53 FashionUnited, Beauty Mode: https://fashionunited.com/news/fashion/drest-adds-beauty-mode-with-gucci-partnership/2021100442559
- S54 PAPER, Mary Greenwell (2020): https://www.papermag.com/drest-makeup-filters-mary-greenwell
- S55 Cosmetics Business, Greenwell (2020): https://cosmeticsbusiness.com/drest-the-high-fashion-gaming-app-breaks-into-beauty-164685
- S56 TheIndustry.beauty, "Summer Sunset": https://theindustry.beauty/mary-greenwell-launches-summer-sunset-makeup-look-within-drest/
- S57 WWD via Yahoo, Gucci Beauty: https://www.yahoo.com/lifestyle/drest-launches-beauty-mode-gucci-215104095.html
- S58 FashionUnited, Bakeup: https://fashionunited.com/news/fashion/drest-teams-up-with-experimental-beauty-brand-bakeup/2023051653907
