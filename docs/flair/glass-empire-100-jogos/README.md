# Glass Empire — 100 ideias de jogos FLAIR (pesquisa de design)

> Pedido de 05/11/2026. O **Meu Quarto** deixa de ser uma área própria do app e passa a ser um **componente** do jogo
> **Glass Empire**, continuação da franquia FashionAI. Este estudo levanta 100 ideias de jogos FLAIR para o Glass
> Empire, cada uma definida em uma frase por campo. É um documento de pesquisa e proposta: **nenhum jogo daqui está
> implementado**, e nada aqui cria RF numerado nem altera regras vigentes de Hype, FAI Points ou loja.

## 1. O que a pesquisa leu antes de propor

| Fonte | O que foi aproveitado |
|---|---|
| [Deck de cartas nos portais](../fashion-hall-historias/deck-de-cartas.md) | mala por peso (Bronze 1 · Prata 2 · Ouro 3 · Especial 4), deck válido (look completo + calçado + acessório com uso), cartas-chave por rota, papéis do Hype com teto, sintonia |
| [Fashion Hall, o saguão](../fashion-hall-historias/fashion-hall-o-saguao.md) | o quarto como gêmeo digital do guarda-roupa, corredor dos portais na parede leste, procedência só leitura, "do jogo nada volta para o Hype" |
| [FLAIR-UT §7, §8, §14](../../plano/FLAIR_UT_Cartas_e_Desafios.md) | Desafios de Montagem (3 a 11 vagas, requisitos, sintonia +1/+1/+1, cenário ilustrado que acende vaga a vaga), tipos de recompensa, tetos diários |
| [Metamorfose FLAIR, contrato dos cenários](../../design/FLAIR_METAMORFOSE_CENARIOS.md) e [RF FLAIR Metamorfose](../../novos-rf/PROPOSTA_FLAIR_METAMORFOSE.md) | efeitos locais à partida, animação como consequência (nunca prova), Conexão cromática, Ponto de ruptura, Metamorfose, Virada de palco |
| [FAI XP, níveis e Auras](../../design/FAI_XP_NIVEIS_FLAIR.md) | Básico 0 · Studio 300 · Loft 900; Metamorfose e Impersonation só no Loft; XP = pontos vitalícios |
| [Hype v2](../../hype/HYPESCORE_ARCHITECTURE.md) | faixas Sinal baixo (0–19) · Nicho (20–39) · Relevante (40–59) · Em alta (60–74) · Tendência (75–89) · Viral (90–100); o jogo nunca escreve sinal de Hype |
| [Elementos do quarto](../../meu-quarto/05-elementos-do-quarto.md) | espelho, maleiro, gavetas, poeira e teia, cesto, arara do desapego, cadeira, vitrine da peça ícone, interruptor, janela, caixa FAI, chave, quadro de cortiça, fita de alfaiate, calendário |
| [Momentos](../../momentos/MOMENTOS.md) | calendário da moda, Momentos de marca e de grupo, Hype contextual derivado, votação por dimensão |
| [Aurora CPS](../../aurora_cps/aurora-cps-fashion-gaming.md) | Biorhythm Quest, Pulse Wars, Chromacity, Urban Hunter e Health Sentinel como famílias de mecânica (sem hardware aqui) |
| Referências de gênero (fora do repositório) | construção de deck com sinergias e "mão por rodada" (*Slay the Spire*, *Balatro*, *Marvel Snap*), vestir por tema com júri e temporadas (*Covet Fashion*, *Drest*, *Infinity Nikki*, *Dress to Impress*), gestão e bastidores (*Style Savvy*, *Overcooked*), infiltração por disfarce (*Hitman*) |

As seis modalidades já propostas em Metamorfose FLAIR (Fashion Runway Battle, Red Carpet Showdown, Style Studio
Tycoon, Met Gala Heist: The Afterparty, Backstage Chaos, Cyber-Street Festival, Eco-Fashion Wilderness) e os dois
portais do Hall (Noite Aurum, Gala Lumière) **não são repetidos**: as 100 ideias abaixo são novas e, quando encostam
nesses mundos, dizem como.

## 2. Glass Empire: onde o quarto entra

O Glass Empire é uma **cidade de vidro** dividida em distritos; a pessoa tem uma **Suíte de Vidro**, que é o Meu Quarto
de hoje (móvel FAI Origem, espelho, maleiro, gavetas, cesto, arara, cadeira, vitrine, interruptor, janela, caixa FAI,
chave) convertido em componente jogável. A suíte continua sendo o gêmeo digital do guarda-roupa real e vira, ao mesmo
tempo, **mapa, saguão e cofre**:

| Papel da suíte no Glass Empire | Como aparece |
|---|---|
| **Mapa** | 20 jogos (série A) usam os próprios elementos do quarto como vagas do cenário |
| **Saguão** | o corredor dos portais (parede leste) leva aos distritos das séries B a E |
| **Cofre** | tudo o que a pessoa ganha volta para a suíte com ficha de procedência (só leitura) |

As cinco séries, com 20 jogos cada:

| Série | Distrito | Arquivo |
|---|---|---|
| A | Suíte de Vidro (o quarto como componente) | [serie-a-suite-de-vidro.md](serie-a-suite-de-vidro.md) |
| B | Passarela, tapete e imprensa | [serie-b-passarela-e-imprensa.md](serie-b-passarela-e-imprensa.md) |
| C | Ruas, viagens e estações da cidade de vidro | [serie-c-cidade-de-vidro.md](serie-c-cidade-de-vidro.md) |
| D | Bastidores, ateliês, negócios e infiltração | [serie-d-bastidores-e-negocios.md](serie-d-bastidores-e-negocios.md) |
| E | Comunidade, duelos, Momentos, marcas e celebridades | [serie-e-comunidade-e-marcas.md](serie-e-comunidade-e-marcas.md) |

## 3. Regras compartilhadas (valem para os 100 jogos)

Os campos de cada jogo usam o vocabulário abaixo; o que está aqui não se repete nas fichas.

### 3.1 Deck e cartas

- **Carta = peça.** Só cartas FLAIR disponíveis (não entregues), com posição SUP, INF, CAL, ACE, VES ou LOOK, nível
  Bronze, Prata, Ouro ou Especial e nota OVR.
- **Mala.** Quando a ficha diz "mala N", a soma dos pesos por nível (1·2·3·4) não passa de N; sem menção, não há mala.
- **Deck válido** é sempre o do Hall (1 look completo, 1 calçado, 1 acessório com uso), e cada ficha só lista as
  **peças obrigatórias adicionais**.
- **Cartas mínimas e máximas** são por partida; o kit inicial Bronze do Hall nunca conta.

### 3.2 Hype

- "Hype" nas fichas é sempre o **Hype v2 público da peça**, nunca o da pessoa; sem Hype público, a carta conta como
  Sinal baixo e nunca como 0.
- **Hype mínimo do deck** é o piso de qualquer carta; **Hype mínimo e máximo das obrigatórias** delimitam a faixa das
  peças obrigatórias daquele jogo (o teto existe para que o jogo não seja vencido só por quem tem peças Virais).
- Uma carta acima do teto **pode entrar**, mas conta como se estivesse no teto (regra "curinga rebaixado").
- **Hype de partida.** Cada carta entra com a sua faixa real e ganha uma cópia local chamada *Hype de partida*, que os
  resultados parciais (rodadas, vagas, votos) movem no máximo **uma faixa para cima ou para baixo** por partida; ela
  nunca é gravada, nunca vira sinal de Hype e expira ao sair. Quando a ficha diz "sobe" ou "desce", é dela que fala.
- O Hype nunca muda vida, tempo ou dano; só carisma, visibilidade, cargas e desempates, sempre com teto.

### 3.3 Os três tipos de efeito ao inserir a carta

| Efeito | Quem vê | O que é |
|---|---|---|
| **Comum** | todos os níveis | a vaga acende, a carta escreve uma linha da história e aplica o efeito mecânico da ficha |
| **Aura Metamorfose** | nível Loft | a moldura da carta e o cenário se transformam (luz, material, paleta, clima) e o efeito mecânico ganha o bônus da ficha; é consequência de sinergia calculada no servidor, nunca prova dela |
| **Aura Impersonation** | nível Loft, com render pronto e consentimento | o avatar da pessoa aparece **vestindo a peça** dentro do cenário (o render de 5 s do Atelier), e o efeito mecânico ganha o bônus da ficha; sem render pronto, cai para o efeito comum |

Os três são locais à partida, respeitam redução de movimento (versão estática) e expiram ao encerrar.

### 3.4 Recompensas

| Sigla | O que é | Regra fixa |
|---|---|---|
| **P** | FAI Points no extrato | teto diário por jogo (5 partidas pontuadas) e idempotência por partida |
| **XP** | FAI XP (os mesmos pontos, no vitalício) | só as ações marcadas "conta no vitalício"; mercado e trocas nunca |
| **Item** | colecionável da loja do quarto ou do guarda-roupa | entra na suíte com procedência; não vai ao mercado |
| **Peça exclusiva** | carta Especial de marca ou celebridade, tiragem numerada | só pela política de selos do emissor e com estoque; nunca pacote aleatório |

Os valores em P são indicativos e seguem a escala dos Desafios de Montagem (15 a 150).

### 3.5 Leitura dos campos de cada ficha

| Campo | Significado |
|---|---|
| Objetivo | o que vence a partida |
| Cenário | o lugar e o que muda nele |
| Peças obrigatórias | além do deck válido |
| Hype mínimo do deck | piso de qualquer carta |
| Cartas mínimas / máximas | tamanho do deck na partida |
| Sequência do mapa | a ordem das vagas que a pessoa preenche |
| Efeito ao inserir | Comum · Metamorfose · Impersonation |
| Recompensa do conjunto | o que o conjunto completo paga (P, XP, Item, Peça exclusiva) |
| Hype mínimo / máximo das obrigatórias | faixa exigida das peças obrigatórias |
| Hype na jogada | o que a faixa da carta muda numa jogada |
| Parciais → Hype do deck | como os resultados parciais movem o Hype de partida |

## 4. Índice dos 100 jogos

| # | Jogo | Série | # | Jogo | Série |
|---|---|---|---|---|---|
| 01 | Espelho Partido | A | 51 | Bloco de Vidro | C |
| 02 | Maleiro Secreto | A | 52 | Vila Olímpica | C |
| 03 | Gaveta 25 | A | 53 | Estufa de Vidro | C |
| 04 | Poeira e Teia | A | 54 | Ciclovia da Orla | C |
| 05 | Dia de Lavar | A | 55 | Cinema ao Ar Livre | C |
| 06 | Caixa FAI Encadeada | A | 56 | Feriadão de Três Dias | C |
| 07 | Chave do Quarto | A | 57 | Bairro Histórico | C |
| 08 | Interruptor | A | 58 | Neve na Capital | C |
| 09 | Janela Leste | A | 59 | Réveillon de Branco | C |
| 10 | O Busto Pergunta | A | 60 | Cidade Fantasma | C |
| 11 | Arara do Desapego | A | 61 | Ateliê de Celina | D |
| 12 | Vitrine da Peça Ícone | A | 62 | Costura Contra o Relógio | D |
| 13 | Monograma | A | 63 | Pop-up Tycoon | D |
| 14 | Luzes do Closet | A | 64 | Leilão de Arquivo | D |
| 15 | Calendário de Parede | A | 65 | Cofre de Vidro | D |
| 16 | Corredor dos Portais | A | 66 | Entrega Expressa | D |
| 17 | Quadro de Cortiça | A | 67 | Inventário da Maison | D |
| 18 | Fita de Alfaiate | A | 68 | Estúdio de Foto | D |
| 19 | Elevador da Torre | A | 69 | Fábrica de Molduras | D |
| 20 | A Mudança | A | 70 | Cinco Clientes | D |
| 21 | Passarela Espelhada | B | 71 | Aluguel de Looks | D |
| 22 | Parede de Flashes | B | 72 | Laboratório de Tingimento | D |
| 23 | Primeira Fila | B | 73 | Restauro de Arquivo | D |
| 24 | Noventa Segundos | B | 74 | Fila do Provador | D |
| 25 | Capa de Revista | B | 75 | Troca de Identidade | D |
| 26 | Street Style | B | 76 | Semana de Moda Secreta | D |
| 27 | Desfile na Chuva | B | 77 | Vernissage | D |
| 28 | Lookbook de Doze Páginas | B | 78 | Fechamento da Edição | D |
| 29 | Prêmio da Crítica | B | 79 | Lavanderia 24h | D |
| 30 | Tapete de Vidro | B | 80 | Feira de Negócios | D |
| 31 | Prova com a Estrela | B | 81 | Duelo de Espelhos | E |
| 32 | Camarim Lotado | B | 82 | Liga dos Distritos | E |
| 33 | Última Volta | B | 83 | Drop da Marca | E |
| 34 | Casting Aberto | B | 84 | Era da Celebridade | E |
| 35 | Passarela Invertida | B | 85 | Clube de Quatro | E |
| 36 | Desfile Sem Logo | B | 86 | Remix Colab | E |
| 37 | Hora da Alta-Costura | B | 87 | Votação Cega | E |
| 38 | Passarela de Gelo | B | 88 | Torneio das Estações | E |
| 39 | Showroom de Vidro | B | 89 | Lenda Viva | E |
| 40 | Quatro Blocos | B | 90 | Corrente de Vidro | E |
| 41 | Metrô das Oito | C | 91 | Mentoria | E |
| 42 | Feira de Domingo | C | 92 | Convidado Surpresa | E |
| 43 | Rooftop ao Pôr do Sol | C | 93 | Rival de Estilo | E |
| 44 | Chuva de Verão | C | 94 | Embaixadores | E |
| 45 | Trilha na Serra | C | 95 | Semana Sem Compras em Dupla | E |
| 46 | Praia de Vidro | C | 96 | Chefe: Vellard | E |
| 47 | Festival de Inverno | C | 97 | Festival das Marcas | E |
| 48 | Avenida LED | C | 98 | Tapete do Bairro | E |
| 49 | Mercado de Pulgas | C | 99 | Capítulo Final: Império de Vidro | E |
| 50 | Conexão em Lisboa | C | 100 | Herança | E |

## 5. O que fica explícito como limite

- Pessoas reais só como fato de arquivo (manchete, placa, telão), nunca como personagem; marcas e celebridades entram
  pela política de selos e pelas licenças de preset que já existem.
- Nenhum jogo altera o Hype real, o nível FLAIR ou a peça; a única coisa que volta para a suíte é procedência.
- Impersonation exige render pronto, consentimento e Loft; a ficha sempre tem o efeito comum como piso.
- Recompensa em dinheiro e prêmio físico ficam fora deste estudo (dependem do parecer do FLAIR-UT §9).
- Sem pacote aleatório pago e sem Hype da pessoa em nenhum cálculo.
