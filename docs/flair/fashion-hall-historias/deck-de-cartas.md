# O deck de cartas dentro dos portais do Fashion Hall

> Regras de produto para o deck FLAIR nos dois primeiros portais (Noite Aurum e Gala Lumière). Construído sobre o que o
> motor já faz: `lib/heist/cards.ts` (8 cartas, kit inicial, níveis, valor, usos, cargas), `lib/heist/state.ts`
> (prestígio VIP = 70), `AfterpartyMods.java` (agilidade, furtividade, carisma, fôlego, luz, convidados, rota VIP) e
> o Hype v2 (`docs/hype/HYPESCORE_ARCHITECTURE.md`). O que já existe está marcado **[existe]**; o resto é proposta.

## 0. Princípios

1. **A carta é a peça.** Cada carta tem um papel que vem do que a peça é (categoria, subcategoria, cor, material,
   estilo, ocasião, nível, Hype). Nada de "carta de +10 de dano": o jogo lê a roupa. **[existe]**
2. **Sem pay-to-win.** O preço da peça não entra em nenhum efeito (regra RF53 · P2-18). O nível (Bronze a Especial)
   entra, mas com teto, e o Hype entra só como mérito público da peça, nunca como Hype da pessoa.
3. **A missão sempre tem saída.** Nenhum deck trava a história; um deck fraco muda o caminho e o custo, não a
   possibilidade de terminar. **[existe para o kit inicial]**
4. **Tudo no servidor.** O que a carta vale, o que ela faz e o que o Hype muda são calculados na prévia
   (`POST /api/flair/adventure/preview`, com as mesmas regras da partida) e gravados no estado da partida; o cliente só
   mostra. **[existe]**
5. **Efeitos valem só na partida.** Usar ou trocar uma carta não mexe na peça, no Hype nem nos FAI Points. **[existe]**

## 1. Quantas cartas vão para o jogo

### 1.1 Gala Lumière (heist)

| Regra | Fácil | Médio | Difícil | Lenda |
|---|---|---|---|---|
| Cartas levadas | 8 **[existe]** | 8 **[existe]** | 6 | 5 |
| Orçamento de mala (soma dos pesos por nível: Bronze 1 · Prata 2 · Ouro 3 · Especial 4) | sem limite | 18 | 13 | 10 |
| Kit inicial (lenço, clutch, brincos Bronze) | sempre, além das 8 | só se o deck tiver menos de 4 cartas **[existe]** | nunca | nunca |
| Seleção automática | as mais valiosas primeiro **[existe]** | a pessoa escolhe; "sugerir" preenche pelas mais valiosas | escolha manual obrigatória | escolha manual obrigatória |

O **orçamento de mala** é o que cria decisão: em Médio, oito cartas Ouro (peso 24) não cabem; cabem, por exemplo, duas
Ouro, três Prata e três Bronze. Em Difícil, uma Especial custa quase um terço do orçamento. É a versão de deck da
frase "então eu não vou como eu": levar o melhor de tudo não é opção.

### 1.2 Noite Aurum

| Regra | Fácil | Médio | Difícil |
|---|---|---|---|
| Cartas levadas | 10 | 8 | 7 |
| Orçamento de mala | sem limite | 18 | 13 |
| Peça fixa | a **bata de trabalho** (não conta, não troca, não some no arrombamento) | idem | idem |
| Carta única | o *Estrela do Norte* entra em CS-O-04 como carta extra, fora do limite, não troca no revendedor | idem | idem |

A Noite Aurum leva mais cartas porque não há armas: o deck é o único recurso da heroína, e o arrombamento (CS-O-07) vai
tirar parte dele.

## 2. Requisitos mínimos

### 2.1 O deck válido (os dois jogos)

Um deck só atravessa o portal se tiver:

| Requisito | Por quê | Se faltar |
|---|---|---|
| **1 look completo**: (parte de cima + parte de baixo) ou corpo inteiro | a Estilista precisa de algo para vestir além da base | o kit inicial ganha um look casual Bronze ("conjunto da Estilista"), que vale 0 no revendedor |
| **1 calçado** | calçado define barulho, velocidade e escalada **[existe: salto, rasteiro, tênis, bota]** | a base da partida usa salto (gala) ou rasteiro (uniforme) **[existe]** |
| **1 acessório com uso** (óculos, joia, bolsa, cinto, relógio, lenço, chapéu) | garante ao menos um recurso ativo | kit inicial (lenço, clutch, brincos) **[existe]** |

Nada mais é obrigatório. Convite, uniforme, arma e colete se compram no revendedor com as cartas que sobram.

### 2.2 Cartas-chave por caminho (Gala Lumière)

Não são obrigatórias, mas cada rota da história tem a sua chave; sem ela, a rota fecha e outra abre:

| Caminho | Carta-chave | Sem ela |
|---|---|---|
| Portaria pela **rota VIP** | 1 peça vestida com valor ≥ 70 **[existe]** (na prática: Ouro com marca, ou Especial) | convite (70 créditos no revendedor), nome de Lina (pista), uniforme pela doca ou blefe |
| **Rota VIP aberta** (cordão nos 8 primeiros segundos) | 3 ou mais peças de alta-cultura LIMITED ou RARE **[existe]** | o cordão abre pela conversa com a curadora ou pelo labirinto |
| **Doca** | tênis ou bota (empurrar o carrinho, escalar depois) | compra do uniforme (30) e entrada pela rampa, sem escalada |
| **Beiral e escada de incêndio** | tênis ou bota **[existe: salto não escala]** | não existe rota alta; a Sala das Joias só pelo labirinto ou pelo cartão |
| **Vitrine sem código** | joia (grampo) **[existe]** | o código da ordem do dia ou o decodificador do bar (35) |
| **Lasers** | relógio (cronômetro) ou óculos (visão) **[existe]** | cortar os fusíveis, o que dispara o relógio do boletim (ver §3) |
| Desafio **Social Chameleon** | 2 peças de vestir com `dress` diferente (gala e casual) | o desafio aparece bloqueado na tela de briefing com o motivo |
| Desafio **Ghost Heist** | chapéu/boné (capuz) ou parte de cima escura | permitido, mas o briefing avisa: "sem capuz, Marcos reconhece a 6 m" |
| **Trocar a maleta** (sabotagem nova, §3) | bolsa ou clutch de nível Prata ou acima | a maleta não pode ser trocada; só roubo direto |

### 2.3 Cartas-chave por ato (Noite Aurum)

| Momento | Carta-chave | Sem ela |
|---|---|---|
| Ateliês (Ato 2) | 1 peça de gala vestida com valor ≥ 60 | o fornecedor cobra o dobro de créditos e horas |
| Bastidores do ensaio | look de equipe (uniforme comprado) ou peça escura + tênis | o segurança barra; só se entra com créditos (suborno = 40) |
| Showroom Vellard (ponto médio) | gala ≥ 70 **ou** uniforme | não entra; a cena CS-O-06 acontece pelo broche de escuta plantado em Marcos no hotel (variante curta, sem a visão do manequim) |
| Arrombamento (CS-O-07) | o que está **vestido** não é levado | ver §3.2: o ladrão leva as cartas de maior valor **não vestidas** |
| Clímax no espelho (CS-O-08) | 3 ou mais peças de vestir restantes | Davi entra com o tecido de última hora (precisa de uma troca feita antes com ele) ou o look sai com duas peças e a rede começa em desvantagem |

## 3. Como as cartas agem nos momentos críticos

### 3.1 Gala Lumière, momento a momento

| Momento | O que decide | Cartas e atributos envolvidos |
|---|---|---|
| **Avenida e revendedor** | quanto crédito a pessoa tem para convite, kit, faca, pistola | valor da carta = nível + CLOUT + Hype + marca **[existe]**; armas exigem peça mínima (30/55/75) **[existe]** |
| **Portaria** (CS-M-04) | qual das 4 variantes toca | prestígio vestido ≥ 70 → VIP; capuz reduz reconhecimento; blefe passa com gala ≥ 50 **[existe]** |
| **Detector do salão** | arma à mostra dispara | qualquer arma; a bolsa (munição) passa **[existe]** |
| **Grande Salão** | quantos convidados em cena e como é a luz | ocasiões variadas → mais convidados; deck escuro → penumbra (−18 % de visão), deck claro e statement → holofotes (+15 %) **[existe]** |
| **Bar de Davi** | o que ele vende e por quanto | peça mais cara entregue destrava a silenciada e o colete **[existe]** |
| **Instituto do Traje** (Íris) | se ela conta a ordem da vitrine | carisma do deck (CLOUT, GLOW, EDGE) encurta a confiança necessária; uma peça de alta-cultura vestida conta como "você entende de traje" |
| **Labirinto de serviço** | ser ouvida e vista | calçado (salto é ouvido a 2 salas em Difícil); óculos mostram seguranças pela parede **[existe]**; agilidade do deck muda a velocidade (−15 % a +25 %) **[existe]** |
| **Sala de segurança** (CS-M-07) | entrar e abrir o cofre | cartão reserva (pista), código (pista) ou grampo (joia) **[existe]**; o broche de escuta (novo) adianta o horário do corte em tela |
| **Lasers** (CS-M-08) | atravessar ou cortar | cronômetro (4 a 8 s por carga) ou visão (8 a 15 s) **[existe]**; cortar os fusíveis dispara o relógio do boletim de 23h30 |
| **Vitrine** | tempo de abertura | grampo: Bronze 6 s, Prata 4 s, Ouro 3 s, Especial 2 s (hoje o grampo é binário; a proposta gradua o tempo pelo nível) |
| **Trocar a maleta** (novo) | roubo invisível | bolsa/clutch Prata ou acima vestida: a Estilista deixa a bolsa com peso na maleta de R2/R3; exige chegar antes das 23h; é o único jeito de obter o final Fantasma em Difícil |
| **Boletim das 23h30** | se a foto do boletim é dela | se a Estilista estava de capuz ou em penumbra quando o fotógrafo disparou, o boletim sai com a foto de arquivo (fraca) e Lina é liberada antes |
| **Fuga** | escalar, correr, aguentar | tênis/bota escalam **[existe]**; fôlego (material confortável, peça da estação) muda a energia −30 % a +50 % **[existe]**; colete absorve |

### 3.2 Noite Aurum, momento a momento

| Momento | O que decide | Cartas e atributos envolvidos |
|---|---|---|
| **Portal** (CS-O-03) | quantas horas cada ação custa | fôlego do deck: −30 % a +50 % no custo em horas (a tradução do `stamina` do heist) |
| **Ateliês** | o fornecedor cede | carisma (CLOUT, GLOW, EDGE das peças vestidas); óculos leem a etiqueta à distância e pulam a conversa |
| **Paparazzi** | sair sem foto | capuz, cores escuras, tênis; salto e brilho geram manchete |
| **Prova com Lina** | confiança sobe ou cai | **sintonia** entre as peças oferecidas e o DNA de Estilo de Lina (ver §4.3); peça de alta-cultura vestida pela Estilista dá +5 de confiança inicial ("ela sabe o que faz") |
| **Showroom** | entrar e copiar o tablet | gala ≥ 70 ou uniforme; óculos (foto do tablet) ou decodificador (cópia completa, abre a variante longa de CS-O-06) |
| **Arrombamento** (CS-O-07) | o que sobra | o ladrão leva as **duas cartas de maior valor não vestidas** (três em Difícil). Vestir a carta valiosa antes de dormir é a decisão estratégica do Ato 2; o *Estrela do Norte* é sempre levado (é história) |
| **Clímax** (CS-O-08) | as três barras | **carro**: fôlego; **confiança**: sintonia com o DNA de Lina; **rede**: Hype médio das peças vestidas no início + reações a cada troca coerente |
| **Tapete** (CS-O-09) | variante A ou B | rede final ≥ 60 → A; GLOW e ART das peças pesam no rumor da plateia |

## 4. Como o Hype entra no desempenho

O Hype v2 é público, por peça e por look, com faixas: Sinal baixo (0–19), Nicho (20–39), Relevante (40–59), Em alta
(60–74), Tendência (75–89), Viral (90–100). Ele já entra em dois lugares: no valor de revenda da carta (até +10) e na
**raridade** do nível FLAIR (acabamento "raro"). A proposta dá a ele quatro papéis claros, todos com teto, para que a
habilidade da pessoa continue mandando.

### 4.1 Hype é visibilidade, e visibilidade corta dos dois lados

| Faixa de Hype da peça vestida | Carisma | Reconhecimento |
|---|---|---|
| Sinal baixo e Nicho | 0 | 0 |
| Relevante | +3 | 0 |
| Em alta | +6 | +5 % na distância em que seguranças reconhecem |
| Tendência | +10 | +10 % |
| Viral | +15 e conta como prestígio ≥ 70 na portaria mesmo sendo Prata | +15 % e o fotógrafo do salão dispara 30 s antes |

Uma peça Viral abre a porta da frente e faz a Estilista ser fotografada. É o mesmo conflito carisma × furtividade do
deck de gala, agora vindo da comunidade, não da etiqueta. Só o Hype da **peça** conta; o Hype da **pessoa** nunca
entra (o jogo não pode premiar quem tem mais seguidores).

### 4.2 Momento (trend e velocidade) vira carga

A dimensão **Trend** e a **Velocidade** medem se a peça está subindo. Peça em "momento" (trend ≥ 60 ou velocidade
≥ 70) ganha **+1 carga** em óculos, relógio e lenço, e os seguranças distraídos olham para ela por mais tempo (a
distração do carisma dura +20 %). Peça que está caindo não perde nada: o Hype nunca pune.

### 4.3 Sintonia: o deck como conjunto

A **sintonia** (o "entrosamento" do FLAIR-UT, atributo SYNC) mede se as cartas combinam entre si: estilo, ocasião,
paleta e material coerentes. No Hall ela passa a ter efeito próprio:

| Sintonia do deck | Gala Lumière | Noite Aurum |
|---|---|---|
| Alta (≥ 70) | disfarce "convincente": o troco de roupa não gera suspeita se a nova peça combina com a anterior | confiança de Lina começa em 70; cada troca coerente sobe +8 |
| Média | regras normais | confiança começa em 50 |
| Baixa (< 40, deck "dividido") | o disfarce leva 2 s a mais e gera suspeita, **mas** é o único deck que cumpre Social Chameleon com folga | confiança começa em 35; trocas sobem +4 |

Na Noite Aurum a sintonia que importa no clímax é entre o deck e o **DNA de Estilo de Lina** (fictício e fixo no jogo:
alfaiataria, minimalismo, cor sólida, nada de brilho). O mesmo motor de compatibilidade do Copilot (`StyleCompatibility`)
pode calcular isso no servidor.

### 4.4 Hype do look e carta de look

Uma carta de **look** (não de peça) traz o Hype do look inteiro e a dimensão Influência (remixes). Ela ocupa dois
espaços de mala, veste tudo de uma vez (uma troca só, mais rápida) e, se o look for Tendência ou Viral, abre a rota VIP
sozinha. Em troca, é a carta que o fotógrafo mais reconhece e, no arrombamento da Noite Aurum, é sempre a primeira a
sumir se não estiver vestida.

### 4.5 O que o Hype nunca faz

- Não muda vida, dano, munição nem tempo de laser.
- Não substitui a carta-chave: uma peça Viral sem grampo não abre vitrine.
- Não cria pontuação de fim de partida: os finais dependem do que a pessoa fez, não do que vestiu.
- Não é alterado pela partida (nenhum sinal de Hype é emitido ao jogar; a política de integridade do Hype v2 continua
  valendo).

## 5. Tela de prévia: o que a pessoa vê antes de atravessar

A tela "O que o seu deck muda" **[existe]** ganha quatro blocos:

1. **Mala:** cartas levadas / limite, peso usado / orçamento, e o que ficou de fora.
2. **Requisitos:** look completo, calçado e acessório com uso (verde), e as cartas-chave por caminho com o sinal de
   aberto, alternativo ou fechado, com o motivo ("sem tênis ou bota: rota alta fechada; labirinto e cartão continuam").
3. **Efeitos:** os sete efeitos do servidor **[existe]** mais Hype (carisma e reconhecimento) e sintonia.
4. **Aviso de dificuldade:** em Difícil e Lenda, a frase fixa: "cada carta tem uma carga; escolha dois papéis".

Tudo isso vem da prévia no servidor, que já exige o nível LOFT da pessoa no FLAIR e recusa look de outra conta
**[existe]**.

## 6. Exemplos de deck (Médio, orçamento 18, 8 cartas)

| Deck | Cartas | Peso | O que abre | O que custa |
|---|---|---|---|---|
| **Gala** | vestido longo Ouro de marca (Tendência), scarpin Prata, colar Ouro, clutch Prata, óculos Bronze, brinco Bronze, relógio Prata, blazer Bronze | 3+2+3+2+1+1+2+1 = 15 | rota VIP, portaria sem convite, Íris cede rápido, grampo e cronômetro | holofotes, salto não escala, fotógrafo cedo (Tendência), Marcos reconhece a 7 m |
| **Furtivo** | moletom preto Bronze, calça cargo Prata, tênis Prata (Em alta), boné Bronze, bolsa Prata, lenço Bronze, óculos Ouro, cinto Bronze | 1+2+2+1+2+1+3+1 = 13 | doca, beiral, penumbra, faca no cinto, visão com 2 cargas, Ghost Heist viável | sem portaria (precisa do uniforme ou do nome de Lina), Íris desconfia, sem rota VIP |
| **Camaleão** | vestido midi Prata, tênis Bronze, blazer Ouro, calça preta Bronze, boné Bronze, colar Prata, clutch Prata, relógio Prata | 2+1+3+1+1+2+2+2 = 14 | entra de gala, troca para escuro no banheiro, Social Chameleon | sintonia baixa: troca mais lenta e com suspeita; nenhum papel no máximo |

Em Difícil (6 cartas, orçamento 13) nenhum dos três cabe inteiro: o jogador tira o relógio do Gala, o cinto do
Furtivo ou o boné do Camaleão, e sente a escolha.
