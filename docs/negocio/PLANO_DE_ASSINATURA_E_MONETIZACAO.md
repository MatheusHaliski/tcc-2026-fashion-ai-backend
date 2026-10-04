# FashionAI como empresa: plano de assinatura e monetização

> Estudo de negócio · versão 1 · 04/10/2026
> Pedido do fundador: *"estudar como criar um plano de assinatura do FashionAI, projetando o app como empresa, onde o
> faturamento vem das assinaturas + microtransações dentro do app (por exemplo na loja)"*.
>
> **Como ler os números.** Tudo o que vem de fonte pública tem link na seção [Fontes](#fontes). Tudo o que é
> **estimativa** (uso médio, conversão, churn, custos de equipe, cenários) está marcado como tal. Câmbio usado:
> **US$ 1 = R$ 5,30** (o dólar fechou em R$ 5,22 em 03/10/2026; a margem cobre a oscilação). Os preços de IA vêm da
> tabela oficial da Anthropic e do catálogo de provedores do próprio código (`AiCatalog`). Este documento **não é
> parecer jurídico nem contábil**: os pontos legais e tributários estão marcados como "confirmar com advogado/contador".
>
> Documentos relacionados: [RF35 FAI Points](../meu_guarda_roupa/01-especificacao-meu-quarto.md#5-rf35--fai-points-e-progressão-do-quarto),
> [RF18 Provador](../novos-rf/RF18_Provador_Virtual_Lojas.md), [RF36–RF39](../novos-rf/RF36-RF39.md),
> [RF40–RF41](../novos-rf/RF40-RF41.md), [RF47 Catálogo](../catalogo/RF47_ACERVO_BUSCA_CATALOGADA.md),
> [Termos de Uso v1](../legal/TERMOS_DE_USO_v1.md), [Política de Privacidade v1](../legal/POLITICA_DE_PRIVACIDADE_v1.md),
> [RF48 — resgate e doações de FAI Points / Fundo de Criadores](../novos-rf/RF48_FAI_Points_Resgate_e_Doacoes.md).

---

## Sumário

1. [Resumo executivo](#1-resumo-executivo)
2. [Proposta de valor e público](#2-proposta-de-valor-e-público)
3. [Planos de assinatura B2C](#3-planos-de-assinatura-b2c)
4. [Planos B2B: marcas e celebridades](#4-planos-b2b-marcas-e-celebridades)
5. [Microtransações](#5-microtransações)
6. [Economia unitária](#6-economia-unitária)
7. [Projeção de 36 meses](#7-projeção-de-36-meses)
8. [Fundo de Criadores (RF48)](#8-fundo-de-criadores-rf48)
9. [Implementação da cobrança no app](#9-implementação-da-cobrança-no-app)
10. [A empresa: estrutura legal, tributos e documentos](#10-a-empresa-estrutura-legal-tributos-e-documentos)
11. [Roadmap de lançamento e KPIs](#11-roadmap-de-lançamento-e-kpis)
12. [Riscos e decisões em aberto](#12-riscos-e-decisões-em-aberto)
13. [Fontes](#fontes)

---

## 1. Resumo executivo

**Modelo recomendado: freemium com quatro fontes de receita.**

| Fonte | O que é | Peso no cenário base, ano 3 (estimativa) |
|---|---|---|
| Assinaturas B2C | **Free** (grátis), **Plus** R$ 19,90/mês ou R$ 179/ano, **Pro** R$ 39,90/mês ou R$ 359/ano; Plus Estudante R$ 11,90/mês | ~50% |
| B2B (marcas e celebridades) | planos **Vitrine** R$ 390/mês, **Studio** R$ 1.290/mês, **Maison** sob consulta (a partir de R$ 4.900); **Celebridade Pro** R$ 190/mês; mais receita por desempenho (clique "Ver na loja", cupom validado, desafio patrocinado) | ~36% |
| Microtransações | itens digitais **cosméticos** com **preço direto em reais** (quarto, provador, avatar, molduras de carta do FLAIR, Passe de Temporada determinístico) e **pacotes de créditos de IA** | ~14% |
| *(saída)* Fundo de Criadores | **10% da receita líquida B2C** (assinaturas + microtransações, mesma base do RF48 §7.1) separados todo mês para o resgate de FAI Points por adultos verificados | custo, não receita (≈ 6% da receita líquida total) |

**Cinco decisões que sustentam o plano:**

1. **O que é básico continua grátis para sempre**: guarda-roupa sem limite de peças, busca no catálogo, Criar Look
   manual, Smart Mirror/Vista-me, Meu Quarto, FAI Points, FLAIR, Desafios, Passarela, Provador 3D, Meu Avatar 3D e
   todos os direitos da LGPD (exportar e excluir). A assinatura vende **mais IA e ferramentas de criador**, nunca
   progressão, FAI Points, posição em ranking ou privacidade.
2. **Microtransações em reais, sem moeda premium no lançamento.** Preço direto é mais transparente (CDC), mais simples
   de reembolsar e contabilizar, e não cria saldo que pareça dinheiro. Se os dados mostrarem atrito, existe um plano B
   documentado: a moeda **Paetês**, que nunca vira FAI Points nem dinheiro e não pode ser transferida (§5.4).
3. **Nada aleatório pago.** Sem loot box, sem pacote surpresa, sem "gacha". Todo item pago mostra exatamente o que
   entrega antes da compra (ECA Digital, Lei 15.211/2025, em vigor desde 17/03/2026; confirmar com advogado).
4. **O custo de IA é a variável que decide o negócio.** O plano Free precisa custar perto de **US$ 0,04 por usuário
   ativo por mês** (modelo leve, cache e processamento local) e cada plano pago tem um **teto mensal de gasto de IA**
   por pessoa; acima dele, a IA cai para o modelo leve, sem bloquear a função. Sem isso, nenhum cenário fecha (§7.3).
5. **Web primeiro (Pix Automático + cartão)**, com lojas de apps depois. Desde junho/2026 a Apple aceita pagamento
   externo e link para a web no Brasil (acordo com o CADE), e a taxa de pagamento na web fica em ~1% a 5%, contra 15%
   a 30% numa loja de apps.

**Resultado esperado (estimativa):** no cenário base, a operação chega ao **equilíbrio mensal por volta do mês 36**,
com ~70 mil usuários ativos/mês, ~2,1 mil assinantes e ~35 marcas pagantes. Até lá, precisa de **~R$ 275 mil** de
caixa acumulado (capital próprio, edital de fomento ou investidor-anjo). O cenário otimista tem resultado positivo a partir do
**mês 7**. O pessimista não se paga em 36 meses e serve de gatilho de revisão (§7). A alavanca mais forte é a
conversão para pagante: subir de 3% para 4% antecipa o equilíbrio para o **mês ~23** e reduz a necessidade de caixa para ~R$ 180 mil.

---

## 2. Proposta de valor e público

### 2.1 O que o FashionAI tem que os concorrentes não têm

| Concorrente | Modelo de cobrança (2026) | O que o FashionAI faz a mais |
|---|---|---|
| **Whering** (Reino Unido) | app grátis sem limite de peças; extras avulsos: créditos de IA a partir de £ 1,99 / US$ 2,99, Outfit Maker US$ 4,99, "Supporter" até US$ 49,99. O plano Premium de £ 9,99/mês foi abandonado | provador multimarca em 3D, avatar fiel ao rosto, jogo de cartas, quarto 3D, cupons de marca |
| **Acloset** (Coreia) | grátis até 100 peças, com anúncios; Basic US$ 3,99/mês (US$ 27,99/ano), Premium US$ 9,99 (US$ 59,99/ano), Expert US$ 24,99 (US$ 147,99/ano) | sem limite de peças no grátis e sem anúncios de terceiros |
| **Indyx** (EUA/Austrália) | quase tudo grátis; Insider A$ 18,99/mês ou A$ 119,99/ano; lookbook com stylist humano a partir de US$ 50–150; catalogação por "Archivist" US$ 295 até 100 peças | IA de composição e DNA de estilo em vez de serviço humano caro; gamificação |
| **Stylebook** (iOS) | compra única de US$ 4,99 | IA, multiplataforma, social e B2B |

**Leitura do mercado:** o mercado de guarda-roupa digital caminha para **núcleo grátis + IA paga por uso ou por
assinatura** (Whering tirou a assinatura e foi para créditos; Acloset cobra para passar de 100 peças). O FashionAI
combina os dois: assinatura para quem usa IA com frequência e créditos avulsos para quem usa de vez em quando. O
diferencial competitivo, que nenhum dos quatro tem, é o **lado B2B**: provador 3D com ambiente da marca, cupons
ganhos por jogo e insights de coleção.

### 2.2 Personas B2C (estimativa qualitativa)

| Persona | Perfil | Dor | O que paga | Plano provável |
|---|---|---|---|---|
| **Organizada** | 22–40 anos, guarda-roupa grande, quer usar o que já tem | "não sei o que vestir", compra repetida | composições ilimitadas, Copilot, DNA de estilo | Free → Plus |
| **Jogadora** | 13–25 anos, chega pelo FLAIR e pelos Desafios | quer competir e mostrar estilo | cosméticos (molduras, ambientes), Passe de Temporada | Free + microtransações (com autorização do responsável se menor) |
| **Criadora de conteúdo** | influenciadora, stylist, personal shopper | produzir looks e fotos para redes; atender clientes | imagens de estúdio, prova 2D, 3D, modo consultoria | Pro |
| **Compradora consciente** | quer testar antes de comprar | devolução, compra por impulso | Provador multimarca (grátis) e cupons | Free (gera receita B2B) |
| **Estudante de moda** | universitária | portfólio e referência | Plus Estudante | Plus Estudante |

### 2.3 Público B2B

| Cliente | O que o app oferece | Por que paga |
|---|---|---|
| **Marca/loja** (perfil `MARCA`) | presença no catálogo (RF47), ambiente próprio no Provador (RF18), selos e cupons (RF25/RF38), Combinações das lojas no FLAIR (RF37), Desafios patrocinados (RF32), Collections Insights e mini lojas 3D (RF35 do Trello), guarda-roupa 3D na loja (RF39/RF44) | prova virtual antes da compra, tráfego qualificado para a loja oficial, dados agregados de intenção (o que é provado, em que cor, com o quê) |
| **Celebridade/influenciador** (perfil `CELEBRIDADE`) | selos, Eras e My Stage 3D (RF34), itens únicos na loja (RF44), cupons de parceiros | monetizar a audiência dentro do app e medir o efeito das "eras" |

---

## 3. Planos de assinatura B2C

### 3.1 Princípios (não negociáveis)

1. **Grátis para sempre:** cadastrar e organizar peças sem limite, busca catalogada local, Criar Look manual, Smart
   Mirror e Vista-me (RF35.CA05 já exige isso), Meu Quarto, FAI Points e loja do quarto em pontos, FLAIR (os 15 modos),
   Desafios, Passarela 3D, Explorador, Provador virtual de lojas, Meu Avatar 3D, cupons e **exportação/exclusão de
   dados (LGPD, arts. 18 e 19)**.
2. **A assinatura nunca compra progressão:** não dá FAI Points, não acelera nível do quarto, não muda Inventory Score,
   não melhora posição em ranking nem atributos de carta no FLAIR (princípio do RF35 §5.1).
3. **Quem cancela não perde nada que criou:** peças, looks, quarto e itens comprados ficam. Só voltam as cotas do Free.
4. **IA nunca "quebra":** quando a cota ou o teto de gasto acaba, a função continua com o modelo leve ou com o
   processamento local que já existe no `AiEngine` (fallback do RF24). O usuário vê um aviso e a opção de comprar
   créditos ou assinar.
5. **Sem anúncios de terceiros.** Conteúdo de marca aparece só em blocos rotulados "Patrocinado" e nunca dentro da
   resposta do Copilot (regra 4 do §3.3 do documento do Meu Quarto). Anúncio programático com dados de adolescentes é
   arriscado sob o ECA Digital e a LGPD, e paga pouco.

### 3.2 Os três planos

| | **Free** | **Plus** | **Pro** (Criador) |
|---|---|---|---|
| Preço mensal | R$ 0 | **R$ 19,90** | **R$ 39,90** |
| Preço anual | — | **R$ 179** (equivale a R$ 14,92/mês, −25%) | **R$ 359** (R$ 29,92/mês, −25%) |
| Plus Estudante | — | **R$ 11,90/mês** (verificação de matrícula) | — |
| Teste grátis | — | 7 dias (cartão ou Pix Automático) | 7 dias |
| Modelo de IA principal | Gemini Flash / Claude Haiku 4.5 + local | **Claude Sonnet 5.5** | Sonnet 5.5 + **Claude Opus 5.5** em "Análise profunda" |
| Teto de gasto de IA por pessoa (interno, invisível) | US$ 0,30/mês | US$ 2,50/mês | US$ 5,00/mês |
| Público | todos | quem usa IA toda semana | criadores, stylists, influenciadores |

**Por que esses preços (estimativa fundamentada):** o Plus fica abaixo do Spotify Premium Individual no Brasil
(R$ 23,90) e o Estudante fica perto do Spotify Universitário (R$ 12,90), referências de "quanto um jovem brasileiro
paga por mês por um app". Em dólar, o Plus (~US$ 3,75) fica no nível do Acloset Basic (US$ 3,99) e bem abaixo do Premium
(US$ 9,99), coerente com o poder de compra local. No Pro, R$ 39,90 é menos que um único lookbook de stylist humano no
Indyx (US$ 50+). A âncora anual "R$ 14,92 por mês" segue a recomendação do RevenueCat para a América Latina (mostrar o
anual pelo equivalente mensal aumentou em 30% o início de testes).

### 3.3 Matriz de funcionalidades (mapeada às funções reais do app)

Legenda: ✓ incluído · cota = limite mensal · — não incluído.

| Área | Função (RF) | Free | Plus | Pro |
|---|---|---|---|---|
| Guarda-roupa | Cadastrar, editar e organizar peças, sem limite (RF4/RF47) | ✓ | ✓ | ✓ |
| | Busca catalogada local por marca e modelo (RF47) | ✓ | ✓ | ✓ |
| | Pesquisar em lojas oficiais (IA `CATALOG_DISCOVERY`) | 3/mês | 15/mês | 40/mês |
| | Interpretação de texto da busca (`CATALOG_TEXT_INTERPRETER`) | ✓ (cache) | ✓ | ✓ |
| | Análise de foto e detecção de várias peças (`PIECE_ANALYZER`, `MULTI_PIECE_DETECTOR`) | 10 fotos/mês | 60 | 200 |
| | Foto de estúdio, fundo e recriação da imagem (`STUDIO_ENHANCER`, `BACKGROUND_GENERATOR`, `PIECE_IMAGE_RECREATOR`) | galeria local de fundos | 20 imagens/mês | 60 imagens/mês, uso comercial |
| | Modelo 3D da peça (`THREE_D_GENERATOR`, RF16, sob feature flag) | — | 2/mês | 10/mês |
| Looks | Criar Look manual, esquemas, remix (RF5) | ✓ | ✓ | ✓ |
| | Composição por IA (`SCHEME_COMPOSER`) | 5/mês (modelo leve) | 60/mês | 150/mês + 30 "Análise profunda" (Opus 5.5) |
| | "Melhorar com IA" (`EDIT_ASSISTANT`) | 5/mês | 40/mês | 120/mês |
| | Smart Mirror e Vista-me (RF28) | ✓ (regras + modelo leve) | ✓ com IA completa | ✓ |
| Estilo | DNA de Estilo (`DNA_SYNTHESIZER`, RF13) | 1 síntese/mês | 4/mês + histórico do DNA | ilimitado razoável (10/mês) |
| | Copilot contextual (`COPILOT`, RF10) | 20 mensagens/mês | 150/mês | 400/mês |
| | Dica de estilo e narrativa de padrões (`STYLE_ADVISOR`, `STYLE_INSIGHT`) | dica por regra | ✓ IA | ✓ IA |
| | Destaques e Inventory Score (RF29) | ✓ | ✓ + histórico completo e comparação mensal | ✓ |
| Provador | Provador virtual de lojas 3D, todas as marcas (RF18) | ✓ | ✓ | ✓ |
| | Provas salvas | 8 (no navegador, como hoje) | ilimitadas, na nuvem | ilimitadas |
| | Foto da prova | com marca d'água discreta | HD sem marca d'água | HD + fundo de estúdio |
| | Prova fotorrealista 2D no servidor (`TRY_ON` + `TRY_ON_POLISH`) | — | 5/mês | 30/mês |
| | Ambientes temáticos extras (não patrocinados) | compra avulsa | 1 por mês incluído | todos os do mês |
| Avatar | Meu Avatar 3D (RF40, processado no aparelho) | ✓ | ✓ | ✓ |
| Jogo | FLAIR, 15 modos, FLAIR Coins, troféus (RF37) | ✓ | ✓ | ✓ |
| | Passe de Temporada FLAIR (cosmético, determinístico) | compra avulsa | −20% | incluído |
| | Desafios, Passarela 3D, Explorador (RF32/RF33/RF26) | ✓ | ✓ | ✓ |
| Quarto | Meu Quarto 3D, níveis, loja em FAI Points (RF27/RF30/RF39) | ✓ | ✓ | ✓ |
| | Item cosmético exclusivo do mês (não vale pontos nem nível) | — | 1/mês | 1/mês + ambiente |
| Criador | Painel do criador: visualizações na Passarela, remixes, origem dos seguidores | — | — | ✓ |
| | **Modo Consultoria** (*novo, a construir*): gerenciar até 5 guarda-roupas de clientes com consentimento | — | — | ✓ |
| | Exportar looks em alta resolução e kit para redes | — | ✓ | ✓ + modelos de post |
| Privacidade | Exportar dados, excluir conta, consentimentos (LGPD) | ✓ | ✓ | ✓ |
| Social | Cupons de marca (RF38), selos (RF25) | ✓ | ✓ | ✓ |

**Uso justo:** os tetos diários que já existem no `AiCatalog` (`dailyQuotaPerUser`) continuam como antiabuso. A cota
mensal passa a depender do plano (§9.4). O teto de gasto em dólar por pessoa (`AiBudget`) passa de diário fixo
(hoje US$ 0,50/dia) para **mensal por plano**.

### 3.4 Preço internacional (para quando houver expansão; estimativa)

| Mercado | Plus mensal | Pro mensal | Critério |
|---|---|---|---|
| Brasil | R$ 19,90 | R$ 39,90 | base |
| Portugal / zona do euro | € 4,99 | € 9,99 | paridade de poder de compra + referência Acloset |
| América Latina hispânica | US$ 2,99 | US$ 5,99 | conversão a pagante mais baixa na região (1,5% segundo o RevenueCat) |
| EUA / Reino Unido | US$ 5,99 / £ 4,99 | US$ 11,99 / £ 9,99 | abaixo do Acloset Premium |

---

## 4. Planos B2B: marcas e celebridades

### 4.1 Regra de neutralidade

A busca do catálogo (RF47), a ordem dos resultados, o "% compatível" e as respostas do Copilot **não são vendidos**.
A marca paga por **superfícies próprias e rotuladas** (ambiente no provador, vitrine "Patrocinado", desafios, cupons,
dados agregados), nunca para aparecer antes na busca orgânica. Isso protege a confiança do usuário, o CDC (art. 36,
publicidade identificável) e o Guia de Publicidade por Influenciadores do CONAR.

### 4.2 Planos para marcas (preço mensal, sem fidelidade; anual com −15%)

| | **Básico** | **Vitrine** | **Studio** | **Maison** |
|---|---|---|---|---|
| Preço | grátis | **R$ 390/mês** | **R$ 1.290/mês** | **a partir de R$ 4.900/mês** (contrato) |
| Perfil `MARCA` verificado | ✓ | ✓ | ✓ | ✓ |
| Presença orgânica no catálogo (RF47) e na vitrine "Lojas em destaque" do Provador | ✓ (ordem orgânica) | ✓ | ✓ | ✓ |
| Ambiente do provador (RF18) | tema derivado do nome (automático, como hoje) | **tema escolhido** pela marca: cores, padrão, piso, luz e logo autorizado | **cenografia exclusiva** (props 3D, arara, vitrine, letreiro animado) | cenografia sob medida + lançamentos de coleção |
| Selo de marca (RF25) | 1 selo | até 5 selos | ilimitado | ilimitado + Selo Premium (RF21) |
| Cupons e promoções (RF25/RF38) | 1 promoção ativa | até 5 ativas | ilimitadas | ilimitadas |
| Combinações das lojas no FLAIR (RF37) | — | 1 ativa | até 5 | ilimitadas |
| Desafio patrocinado (RF32) | — | — | 1/mês incluído | 3/mês |
| Guarda-roupa 3D e itens na loja do quarto (RF39/RF44) | — | até 10 itens | até 50 | ilimitado + Colab Maison |
| Slot "Patrocinado" rotativo no Explorador e no Provador | — | 1 semana/mês | 2 semanas/mês | contínuo |
| **Collections Insights** (agregado e anônimo) | visualizações do perfil | provas por produto e cor, "Já tenho esta peça", cliques "Ver na loja", cupons resgatados | + combinações mais provadas com cada peça, funil prova → clique → cupom validado, comparação com a categoria | + tendências por região e faixa etária, exportação, reunião trimestral |
| Atualização do catálogo | manual / coleta oficial (RF47) | importação de planilha | feed por API/arquivo | integração dedicada |
| Suporte | e-mail | e-mail | prioritário | gerente de conta, SLA |

**Dados agregados, nunca pessoais.** Nenhum plano entrega dado pessoal de usuário à marca. Os insights mostram só
grupos com **pelo menos 50 pessoas** (anonimização por agregação; LGPD art. 12). Isso precisa estar no contrato
B2B, com um acordo de tratamento de dados (DPA).

**Logo e identidade visual.** Hoje os temas são "inspirados" e o logo vem da URL do catálogo (RF18 §3). Para vender
ambiente "oficial", o contrato precisa da **licença de uso de marca**, o que é também argumento de venda: a marca
aprova o próprio provador.

### 4.3 Planos para celebridades

| | **Criador** | **Celebridade Pro** |
|---|---|---|
| Preço | grátis | **R$ 190/mês** |
| Perfil `CELEBRIDADE` com selo de verificação | ✓ | ✓ |
| Eras e Insights de Eras (RF34) | 2 eras | ilimitadas + My Stage 3D |
| Itens únicos na loja do quarto em FAI Points (RF44) | até 5 | ilimitados |
| Itens cosméticos vendidos em reais (fase 2, §5.5) | — | ✓ com divisão de receita |
| Cupons de parceiros e selos | 1 | ilimitados |
| Painel de audiência | básico | completo (agregado) |

### 4.4 Receita por desempenho (pay-per-performance)

| Evento | Preço sugerido (estimativa) | Fonte do dado no app |
|---|---|---|
| Clique "Ver em <loja oficial>" (RF18) vindo de prova | **R$ 0,60 por clique** (teto mensal definido pela marca) | evento de clique no Provador |
| Cupom resgatado e **validado no caixa** (`POST /api/me/coupons/validate`) | **R$ 3,00 por cupom** ou **5% do valor da compra** | `promotion_redemptions` / `flair_redemptions` com status "usado" |
| Desafio patrocinado avulso | **R$ 2.500 por desafio** (2 semanas) | RF32 |
| Lançamento de coleção na Passarela 3D | R$ 5.000 a R$ 15.000 por campanha | RF33 |
| Afiliação de marcas não parceiras | comissão de 3% a 10% via redes de afiliados (estimativa de mercado) | link "Ver na loja" com parâmetro de afiliado |

Para comparar: o CPM mediano da Meta no Brasil ficou em ~US$ 3,46 (jul/2025–jul/2026, subindo para US$ 6,76). Um
clique de alguém que **acabou de provar a peça** vale bem mais que uma impressão de anúncio, o que sustenta os
R$ 0,60 por clique.

---

## 5. Microtransações

### 5.1 Regras

| # | Regra | Por quê |
|---|---|---|
| M1 | **FAI Points nunca são vendidos** e nenhum item pago dá FAI Points | RF35.CA08 e RF48 (o ponto vira dinheiro para adultos; vender ponto criaria um ciclo dinheiro → ponto → dinheiro) |
| M2 | **FLAIR Coins nunca são vendidas** | regra atual do RF37 ("Coins são moeda do jogo e não se compram com dinheiro") |
| M3 | Item pago é **cosmético** ou **crédito de IA**: não muda nível, Inventory Score, ranking, atributos de carta nem chance de vitória | RF35 §5.1 (trilha comercial separada) e equilíbrio competitivo |
| M4 | **Nada aleatório pago**: sem caixa surpresa, sem pacote com raridade sorteada, sem roleta | ECA Digital (Lei 15.211/2025) proíbe caixas de recompensa em jogos para crianças e adolescentes ou de acesso provável por eles; o app aceita usuários a partir de 13 anos. Confirmar com advogado o enquadramento do FLAIR |
| M5 | Itens comprados **não são transferíveis** nem revendáveis entre usuários | evita lavagem de dinheiro e mercado paralelo |
| M6 | Preço final em reais, com impostos, mostrado antes da compra, com "Provar no meu quarto/provador" antes | CDC art. 6º III e art. 31; RF35.CA06 |
| M7 | **Menores de 18:** compras desligadas por padrão; o responsável autoriza e define limite mensal (sugestão: R$ 50) | Código Civil (capacidade), ECA Digital (supervisão parental), Termos de Uso v1 §12 |
| M8 | Preço mínimo de **R$ 4,90** por item | as taxas fixas por transação (R$ 0,39 a R$ 0,49) comem itens de R$ 1,90 |
| M9 | Reembolso integral em 7 dias (CDC art. 49), com o item ou os créditos revogados | §9.7 |
| M10 | Sem urgência artificial para menores: sem contagem regressiva e sem notificação de oferta | ECA Digital (proteção contra práticas manipulativas; confirmar com advogado) |

### 5.2 Catálogo inicial e preços (estimativa de preço; validar com teste A/B)

| Categoria | Item | Preço | Observação |
|---|---|---|---|
| **Créditos de IA** | 30 créditos | **R$ 9,90** | consumidos só depois da cota do plano; validade de 12 meses |
| | 100 créditos | **R$ 24,90** | −25% por crédito |
| | 300 créditos | **R$ 59,90** | −40% por crédito |
| **Meu Quarto** (coleção "Atelier", só em reais, separada da loja em pontos) | Acabamento avulso (ex.: laca perolada, mármore Calacatta) | R$ 4,90 | não substitui nem acelera os acabamentos por nível |
| | Pacote de tema (5 acabamentos + iluminação) | R$ 14,90 | |
| | Ambiente completo (paredes, piso, janela com vista) | R$ 19,90 | |
| **Provador** (RF18) | Ambiente temático (ex.: Passarela Paris, Loja Neon, Praia) | R$ 6,90 | ambientes de marca são grátis para o usuário (a marca paga) |
| | Pacote com 4 ambientes | R$ 19,90 | |
| **Meu Avatar / fotos** (RF36/RF40) | Pacote de poses e molduras para foto | R$ 4,90 | |
| | Fundos de estúdio premium (Background Studio) | R$ 7,90 | |
| **FLAIR** (RF37) | Moldura de carta (visual, sem mudar atributos) | R$ 4,90 | |
| | Tema de álbum / verso de deck | R$ 9,90 | |
| | **Passe de Temporada** (~8 semanas) | R$ 14,90 | todas as recompensas visíveis antes, desbloqueadas por jogar; sem Coins, sem FAI Points, sem vantagem |

**Peso dos créditos de IA** (proposta, ajustável na tabela do plano):

| Ação | Créditos | Custo direto estimado por ação |
|---|---|---|
| Mensagem do Copilot | 0,2 | ~US$ 0,010 (Sonnet 5.5 com cache) |
| Composição de look por IA | 1 | ~US$ 0,020 (Sonnet 5.5) |
| Pesquisa em lojas oficiais | 1 | ~US$ 0,04 (inclui busca na web a US$ 10/1.000) |
| DNA de estilo | 2 | ~US$ 0,012 |
| Imagem de estúdio, fundo ou recriação | 2 | US$ 0,02 a 0,10 |
| Prova fotorrealista 2D | 3 | ~US$ 0,095 (FASHN + polimento) |
| Análise profunda (Opus 5.5) | 3 | ~US$ 0,04 |
| Modelo 3D da peça | 15 | ~US$ 0,40 (Meshy) |

No pacote menor (R$ 0,33 por crédito), mesmo a ação mais cara por crédito (prova 2D, ~R$ 0,17 por crédito) deixa margem
depois de taxas e impostos.

### 5.3 Recomendação: preço direto em reais (sem moeda premium no lançamento)

| Critério | Preço direto em R$ | Moeda premium ("Paetês") |
|---|---|---|
| Transparência ao consumidor (CDC art. 6º III) | **alta**: o item custa R$ 6,90 | menor: "650 Paetês" esconde o preço |
| Risco com menores (ECA Digital) | **baixo** | maior: moeda intermediária é vista como prática que dificulta perceber o gasto |
| Reembolso de 7 dias | **simples**: estorna o item | complexo: estornar Paetês já gastos? |
| Contabilidade e tributos | **simples**: receita reconhecida na entrega | saldo não gasto vira passivo (receita diferida) e exige política de expiração |
| Risco regulatório de "moeda eletrônica" (Lei 12.865/2013) | nenhum | baixo se não for conversível nem transferível, mas exige cuidado |
| Taxa por transação | pior em itens baratos | melhor (um pagamento compra vários itens) |
| Hábito em jogos | menor | maior |

**Decisão recomendada:** lançar com **preço direto em reais** e mitigar a taxa fixa com **preço mínimo de R$ 4,90**,
pacotes e **carrinho** (vários itens num único pagamento Pix). Reavaliar a moeda premium depois de 6 meses com dados
de conversão de microtransações.

### 5.4 Plano B: a moeda "Paetês" (só se for adotada)

Nome: **Paetês** (lantejoulas: brilho, moda, fácil de dizer). Não colide com **FAI Points** nem com **FLAIR Coins**.

| Regra | Detalhe |
|---|---|
| P1 | Compra só com dinheiro, em pacotes fixos (ex.: 500 Paetês = R$ 9,90) |
| P2 | **Nunca** se convertem em FAI Points, FLAIR Coins ou dinheiro, e o RF48 não aceita Paetês |
| P3 | **Intransferíveis** entre usuários; sem presente, troca ou mercado |
| P4 | Todo item mostra o preço em Paetês **e o equivalente em reais** |
| P5 | Reembolso de 7 dias para Paetês não gastos |
| P6 | Menores: mesmo limite mensal do responsável (M7) |
| P7 | Saldo contabilizado como receita diferida; reconhecido quando gasto |

### 5.5 Fase 2: marcas e celebridades vendendo em reais

Hoje o RF39/RF44 vende itens de marca **em FAI Points**. Vender em reais com repasse para a marca transforma o
FashionAI em **intermediário de pagamento** (marketplace). Isso exige split de pagamento (Asaas e Pagar.me oferecem),
nota fiscal de intermediação e contrato. Proposta: **70% para a marca/celebridade e 30% para o FashionAI**, só depois
do mês 9. Antes disso, a via simples é o **drop patrocinado**: a marca paga para distribuir itens cosméticos grátis
(ou em pontos) aos usuários.

---

## 6. Economia unitária

### 6.1 Preços de referência usados

| Item | Valor | Fonte |
|---|---|---|
| Claude Opus 5.5 | US$ 4 / US$ 20 por milhão de tokens (entrada/saída); leitura de cache a US$ 0,20 | tabela oficial Anthropic |
| Claude Sonnet 5.5 | US$ 2 / US$ 10; cache a US$ 0,20 | idem |
| Claude Haiku 4.5 | US$ 1 / US$ 5; cache a US$ 0,10 | idem |
| Batch API | −50% em entrada e saída (serve para DNA, insights e tarefas sem pressa) | idem |
| Busca na web (Claude) | US$ 10 por 1.000 buscas | idem |
| Gemini Flash, FASHN, Meshy, Photoroom, Stability, Replicate | custos por chamada do `AiCatalog` (estimativas do código, set/2026) | `fai-application/.../ai/AiCatalog.java` |

> O `AiCatalog` estima custos com o Opus 5 (US$ 5/US$ 25). Com o **Opus 5.5** (US$ 4/US$ 20) o custo cai 20%. Com o
> **Sonnet 5.5** cai 60%. A primeira ação técnica do plano é trocar o modelo padrão por capacidade e por plano (§9.4).

### 6.2 Custo de IA por usuário ativo por mês (estimativa)

| Capacidade | Free: modelo / custo por chamada | Plus: modelo / custo | Pro: modelo / custo |
|---|---|---|---|
| Composição (`SCHEME_COMPOSER`) | Gemini Flash / US$ 0,0042 | Sonnet 5.5 / US$ 0,020 | Sonnet 5.5 / US$ 0,020; Opus 5.5 / US$ 0,040 |
| Copilot (`COPILOT`) | Gemini Flash / US$ 0,0031 | Sonnet 5.5 com cache / ~US$ 0,010 | idem |
| DNA (`DNA_SYNTHESIZER`) | Gemini / US$ 0,0025 | Sonnet 5.5 em lote / ~US$ 0,006–0,012 | idem |
| Pesquisa em lojas oficiais | Claude com busca na web / ~US$ 0,04 | idem | idem |
| Imagens (estúdio, fundo, recriação) | galeria local / US$ 0 | US$ 0,02–0,04 | US$ 0,04–0,10 |
| Prova 2D (`TRY_ON` + polimento) | — | US$ 0,095 | US$ 0,095 |
| 3D (`THREE_D_GENERATOR`) | — | US$ 0,40 | US$ 0,40 |

| Plano | Custo de IA **no teto da cota** | Teto de gasto aplicado (`AiBudget`) | **Custo médio esperado** (estimativa: a maioria usa 10–20% da cota) |
|---|---|---|---|
| Free | ~US$ 0,24 | US$ 0,30 | **US$ 0,04** (R$ 0,21) |
| Plus | ~US$ 4,90 | **US$ 2,50** (R$ 13,25) | **US$ 0,75** (R$ 3,98) |
| Pro | ~US$ 17 | **US$ 5,00** (R$ 26,50) | **US$ 2,00** (R$ 10,60) |

O teto existe para que o **pior caso** (usuário que consome tudo) ainda dê margem positiva (§6.4).

### 6.3 Infraestrutura (estimativa)

| Item | Custo | Base |
|---|---|---|
| Railway Pro (API Java, MySQL, OpenSearch, bucket) | US$ 20/mês + uso (US$ 20 por vCPU/mês, US$ 10 por GB de RAM/mês, US$ 0,15/GB de volume) | preços públicos do Railway |
| Vercel Pro (frontend Next.js) | US$ 20/mês por membro, com US$ 20 de uso incluído | preços públicos da Vercel |
| Domínio, e-mail transacional, monitoramento, backups | ~R$ 200/mês | estimativa |
| **Total fixo considerado** | **R$ 1.500/mês** | estimativa (API com 2 vCPU/4 GB, MySQL, OpenSearch com 1 GB) |
| **Variável** | **R$ 0,08 por usuário ativo/mês** | armazenamento de mídia, tráfego, crescimento de banco (estimativa) |

O Provador 3D e o Meu Avatar 3D rodam **no aparelho** (Three.js, MediaPipe), o que mantém o custo de servidor baixo.
É uma vantagem estrutural do projeto.

### 6.4 Taxas de pagamento, lojas de apps e tributos

| Canal | Taxa | Fonte |
|---|---|---|
| **Pix Automático** (recorrência, BCB, obrigatório nos bancos desde out/2025) | 0,22% a 0,35% no mercado; **Asaas cobra R$ 1,99 por Pix** (R$ 0,99 nos 3 primeiros meses) | BCB; comparativos 2026; Asaas |
| Pix avulso | ~0% a 1,99% (Mercado Pago ~0,99%; Stripe ~1,19%) | comparativos 2026 |
| Cartão de crédito à vista | Asaas 2,99% + R$ 0,49 (assinatura: 1,99% + R$ 0,49); Pagar.me ~3,19%; Stripe 3,99% + R$ 0,39; Mercado Pago ~4,99% | sites e comparativos (confirmar no contrato) |
| **App Store no Brasil** (após acordo com o CADE, jun/2026) | comissão de 25% (ou **10%** no Small Business Program e após o 1º ano de assinatura) **+ 5%** se usar o pagamento da Apple; link para compra na web: 15% (10% no programa); distribuição fora da App Store: 5% | Apple/MacRumors/Mobile Time |
| **Google Play** | 15% em assinaturas (e no primeiro US$ 1 milhão por ano); faturamento alternativo reduz a taxa | Google/RevenueCat |
| **Simples Nacional, Anexo III** (com Fator R ≥ 28%) | alíquota efetiva a partir de **6%** (até R$ 180 mil/ano), 11,2% nominal na 2ª faixa | LC 123/2006 |
| Simples Nacional, Anexo V (Fator R < 28%) | a partir de **15,5%** | LC 123/2006 |

Na projeção uso **6,5% de taxa média** sobre a receita B2C (mistura de Pix, cartão e uma parcela via lojas de apps) e
**1,5%** sobre o B2B (boleto/Pix). O imposto é calculado faixa a faixa do Anexo III sobre a receita dos últimos 12
meses (RBT12).

### 6.5 Margem por assinante (web, cartão; estimativa)

| Linha (R$/mês) | Plus mensal | Plus no pior caso (teto de IA) | Pro mensal | Pro no pior caso |
|---|---|---|---|---|
| Preço | 19,90 | 19,90 | 39,90 | 39,90 |
| Taxa de pagamento (~4% + R$ 0,49) | −1,29 | −1,29 | −2,09 | −2,09 |
| Simples Anexo III (6%) | −1,19 | −1,19 | −2,39 | −2,39 |
| IA | −3,98 | −13,25 | −10,60 | −26,50 |
| Infraestrutura | −0,40 | −0,40 | −0,60 | −0,60 |
| Fundo de Criadores (10% da receita líquida) | −1,74 | −1,74 | −3,54 | −3,54 |
| **Margem de contribuição** | **11,30 (57%)** | **2,03 (10%)** | **20,68 (52%)** | **4,78 (12%)** |

Pela App Store com pagamento da Apple (15%), a margem do Plus cai para ~R$ 9,80. Por isso o caminho preferido é a
web, inclusive com o link externo agora permitido no iOS brasileiro.

Usuário **Free** custa ~**R$ 0,29/mês** (IA R$ 0,21 + infraestrutura R$ 0,08). A receita B2B e de microtransações por
usuário ativo (~R$ 0,60/mês no cenário base, ano 3) cobre esse custo.

### 6.6 ARPU, conversão, churn, LTV e CAC (estimativas com referência)

| Métrica | Premissa base | Referência |
|---|---|---|
| Conversão de ativo mensal para pagante | **3%** (pessimista 1,5%, otimista 4,5%) | RevenueCat 2026: freemium tem mediana de **2,1%** de conversão em 35 dias; a América Latina tem **1,5%** de "conversão a pagante". 3% exige paywall bem desenhado e teste grátis |
| Teste grátis → pago | 25% | mediana da América Latina no RevenueCat (melhores: 53%) |
| Mistura de planos | 80% Plus, 20% Pro; 35% anuais | estimativa |
| **ARPPU** (receita média por pagante) | **R$ 21,81/mês** (Plus R$ 18,16; Pro R$ 36,41, já com anuais) | cálculo |
| Churn mensal combinado | **6%** (8% nos mensais; anuais renovam ~45%) | estimativa conservadora para apps de estilo de vida |
| Margem de contribuição | ~55% | §6.5 |
| **LTV por pagante** | 21,81 × 55% ÷ 6% ≈ **R$ 200** | cálculo |
| CPM da Meta no Brasil | US$ 3,46 (mediana jul/2025–jul/2026), subindo para US$ 6,76 | benchmarks Meta 2026 |
| CPI pago estimado | R$ 5 a R$ 10 por instalação/cadastro | estimativa a partir do CPM |
| CAC por **pagante** só com mídia paga | R$ 5–10 ÷ 3% = **R$ 170 a R$ 330** | cálculo |
| **LTV/CAC só com mídia paga** | **0,6 a 1,2** (insuficiente) | — |

**Conclusão importante:** mídia paga sozinha **não fecha a conta** do B2C no Brasil. Para LTV/CAC ≥ 3, o CAC
combinado precisa ficar abaixo de **R$ 70**, ou seja, **pelo menos ~75% dos usuários precisam chegar de forma
orgânica**. O app tem os mecanismos certos para isso: duelos do FLAIR contra @usuário, link da prova
(`/try-on?provar=…`), Passarela 3D, Desafios em grupo, cupons e as próprias marcas divulgando o provador delas. A mídia
paga vai para retargeting e para captar marcas (B2B).

---

## 7. Projeção de 36 meses

### 7.1 Premissas (todas estimativas)

| Premissa | Pessimista | Base | Otimista |
|---|---|---|---|
| Usuários ativos/mês no lançamento | 1.500 | 3.000 | 5.000 |
| Crescimento mensal (ano 1 / 2 / 3) | 10% / 6% / 3% | 15% / 9% / 5% | 20% / 11% / 6% |
| Conversão a pagante (atinge o valor cheio em 6 meses) | 1,5% | 3,0% | 4,5% |
| % de ativos que compram item no mês × tíquete médio | 0,8% × R$ 12 | 1,5% × R$ 12 | 2,5% × R$ 12 |
| Marcas pagantes no fim do ano 1 / 2 / 3 | 1 / 4 / 8 | 4 / 15 / 35 | 8 / 35 / 90 |
| Tíquete B2B médio | R$ 700 | R$ 900 | R$ 1.100 |
| Receita por desempenho por ativo/mês | R$ 0,02 | R$ 0,05 | R$ 0,08 |
| IA por usuário/mês (Free / Plus / Pro) | US$ 0,04 / 0,75 / 2,00 | idem | idem |
| Equipe (R$/mês, anos 1 / 2 / 3) | 4,5 mil / 6 mil / 9 mil | 4,5 mil / 14 mil / 26 mil | 6 mil / 22 mil / 45 mil |
| Marketing (R$/mês, anos 1 / 2 / 3) | 1,5 mil / 2,5 mil / 3,5 mil | 2,5 mil / 6 mil / 12 mil | 4 mil / 12 mil / 25 mil |
| Contador, jurídico e ferramentas | R$ 1.200/mês | R$ 1.200/mês | R$ 1.200/mês |
| Fundo de Criadores | 10% da receita líquida B2C | 10% | 10% |

Equipe no ano 1 = pró-labore do fundador (que também ajuda a manter o Fator R ≥ 28% no Anexo III). No cenário base,
o ano 2 inclui 1 desenvolvedor e o ano 3, mais uma pessoa de design/atendimento e vendas B2B.

### 7.2 Resultado mensal (R$, arredondado)

**Cenário pessimista**

| Mês | Ativos | Pagantes | Assinaturas | Microtransações | B2B | **Receita** | IA | **Resultado do mês** | **Acumulado** |
|---|---|---|---|---|---|---|---|---|---|
| 6 | 2,4 mil | 36 | 790 | 230 | 400 | **1,4 mil** | 700 | −8,4 mil | −51,8 mil |
| 12 | 4,3 mil | 64 | 1,4 mil | 410 | 790 | **2,6 mil** | 1,2 mil | −8,1 mil | −101,3 mil |
| 24 | 8,6 mil | 129 | 2,8 mil | 830 | 3,0 mil | **6,6 mil** | 2,5 mil | −8,8 mil | −216,6 mil |
| 36 | 12,3 mil | 184 | 4,0 mil | 1,2 mil | 5,8 mil | **11,0 mil** | 3,5 mil | −10,2 mil | **−353,1 mil** |

**Cenário base**

| Mês | Ativos | Pagantes | Assinaturas | Microtransações | B2B | **Receita** | IA | **Resultado do mês** | **Acumulado** |
|---|---|---|---|---|---|---|---|---|---|
| 6 | 6,0 mil | 181 | 3,9 mil | 1,1 mil | 2,1 mil | **7,1 mil** | 2,2 mil | −6,5 mil | −47,9 mil |
| 12 | 14,0 mil | 419 | 9,1 mil | 2,5 mil | 4,3 mil | **15,9 mil** | 5,1 mil | −2,8 mil | −74,6 mil |
| 18 | 23,4 mil | 702 | 15,3 mil | 4,2 mil | 9,7 mil | **29,2 mil** | 8,5 mil | −8,9 mil | −145,5 mil |
| 24 | 39,3 mil | 1.178 | 25,7 mil | 7,1 mil | 15,5 mil | **48,2 mil** | 14,3 mil | −1,3 mil | −173,3 mil |
| 30 | 52,6 mil | 1.578 | 34,4 mil | 9,5 mil | 25,1 mil | **69,0 mil** | 19,2 mil | −9,2 mil | −254,4 mil |
| 36 | 70,5 mil | 2.115 | 46,1 mil | 12,7 mil | 35,0 mil | **93,8 mil** | 25,7 mil | **+1,5 mil** | **−272,2 mil** |

**Cenário otimista**

| Mês | Ativos | Pagantes | Assinaturas | Microtransações | B2B | **Receita** | IA | **Resultado do mês** | **Acumulado** |
|---|---|---|---|---|---|---|---|---|---|
| 6 | 12,4 mil | 560 | 12,2 mil | 3,7 mil | 5,4 mil | **21,3 mil** | 5,5 mil | −1,6 mil | −40,4 mil |
| 12 | 37,2 mil | 1.672 | 36,5 mil | 11,1 mil | 11,8 mil | **59,4 mil** | 16,4 mil | +15,1 mil | +3,1 mil |
| 24 | 130,0 mil | 5.849 | 127,5 mil | 39,0 mil | 48,9 mil | **215,4 mil** | 57,3 mil | +56,6 mil | +276,1 mil |
| 36 | 261,5 mil | 11.769 | 256,6 mil | 78,5 mil | 119,9 mil | **455,0 mil** | 115,3 mil | +120,0 mil | **+1,12 milhão** |

**Totais anuais**

| Cenário | Receita ano 1 | Receita ano 2 | Receita ano 3 | Resultado ano 1 | Resultado ano 2 | Resultado ano 3 | Equilíbrio mensal | Pior caixa acumulado |
|---|---|---|---|---|---|---|---|---|
| Pessimista | R$ 17,9 mil | R$ 56,0 mil | R$ 107,6 mil | −R$ 101,3 mil | −R$ 115,3 mil | −R$ 136,6 mil | não ocorre em 36 meses | −R$ 353,1 mil |
| **Base** | **R$ 96,5 mil** | **R$ 378,5 mil** | **R$ 859,1 mil** | −R$ 74,6 mil | −R$ 98,7 mil | −R$ 98,9 mil | **mês ~36** | **−R$ 274 mil** |
| Otimista | R$ 316,1 mil | R$ 1,57 milhão | R$ 4,02 milhões | +R$ 3,1 mil | +R$ 272,9 mil | +R$ 846,0 mil | mês 7 | −R$ 40,4 mil |

> No otimista, a receita do ano 3 se aproxima do teto do Simples Nacional (R$ 4,8 milhões em 12 meses). No ano 4 a
> empresa precisaria migrar para Lucro Presumido ou Lucro Real, e o planejamento tributário entra no orçamento.

**Ponto de equilíbrio em uma frase:** com a estrutura do ano 3 do cenário base (~R$ 40 mil/mês de custo fixo), cada
usuário ativo deixa ~R$ 0,60/mês de contribuição. O equilíbrio exige **~68 mil usuários ativos**, ou seja, ~2 mil
assinantes e ~30 a 35 marcas pagantes.

### 7.3 Sensibilidade (cenário base, mudando uma premissa por vez)

| Mudança | Equilíbrio mensal | Pior caixa acumulado | Resultado do ano 3 |
|---|---|---|---|
| Base (fundo 10% da receita líquida B2C) | mês ~36 | −R$ 274 mil | −R$ 98,9 mil |
| Conversão 4% (em vez de 3%) | **mês ~23** | −R$ 182 mil | −R$ 31,1 mil |
| Conversão 2% | não ocorre | −R$ 385 mil | −R$ 167,5 mil |
| IA 50% a 100% mais cara (Free US$ 0,08; Plus 1,10; Pro 2,80) | não ocorre | **−R$ 561 mil** | −R$ 279,7 mil |
| Fundo de Criadores em 5% da receita líquida B2C | mês ~24 (instável: volta ao negativo quando a equipe cresce) | −R$ 242 mil | −R$ 76,2 mil |
| Fundo de Criadores em 15% da receita líquida B2C | não ocorre em 36 meses | −R$ 309 mil | −R$ 121,5 mil |
| Todo o B2C via loja de apps (15% de taxa) | não ocorre em 36 meses | −R$ 339 mil | −R$ 140,8 mil |

**Leitura:** as três alavancas que mais pesam são (1) **conversão a pagante**, (2) **custo de IA por usuário** e
(3) **canal de pagamento**. O Fundo de Criadores pesa menos: entre 5% e 10% da receita líquida B2C, a diferença é de
~R$ 32 mil de caixa em 36 meses. Por isso dá para seguir os 10% do piloto do RF48. Já 15% desde o início empurra o
equilíbrio para depois do mês 36. Daí a escada no §8.

**Gatilhos de decisão (sugestão):** se no **mês 12** a operação estiver abaixo do pessimista (menos de 4 mil ativos ou
conversão abaixo de 1,5%), rever o posicionamento. Opções: foco B2B (provador como serviço para lojas) ou licenciar o
motor de provador e catálogo.

---

## 8. Fundo de Criadores (RF48)

### 8.1 O que é (resumo; a regra completa está no RF48)

FAI Points continuam **só conquistados**, nunca vendidos (RF35.CA08). O
[RF48](../novos-rf/RF48_FAI_Points_Resgate_e_Doacoes.md) permite que **adultos (18+) com identidade verificada (KYC)**
resgatem pontos sacáveis e maturados em reais, por Pix. O dinheiro sai de um **Fundo de Criadores** abastecido com uma
porcentagem fixa da receita líquida. Por isso a taxa de conversão "flutua": `taxa = fundo do mês ÷ pontos pedidos`,
limitada por piso e teto, com reserva para meses fracos (RF48 §7).

### 8.2 Proposta de tamanho (orçamento deste estudo)

| Item | Proposta |
|---|---|
| **Porcentagem** | **10% da receita líquida B2C** no piloto, o mesmo valor da decisão D1 do RF48, com revisão trimestral |
| Base de cálculo | **assinaturas + microtransações** (como no RF48 §7.1) − tributos sobre a receita (DAS) − comissões de lojas de apps e taxas de pagamento − reembolsos e chargebacks. **A receita B2B fica fora da base**: ela paga a operação e a equipe comercial |
| Peso sobre a receita total | ~6% da receita líquida total no cenário base (o B2C é ~64% da receita) |
| Apuração | mensal, sobre o mês fechado, **paga no mês seguinte** (depois da janela de 7 dias de arrependimento) |
| Escada | **10%** no piloto → até **15%** (teto) só depois de 2 trimestres seguidos com margem operacional acima de 20%. **Nunca reduzir** a porcentagem já anunciada para o trimestre em curso (confiança e CDC) |
| Sobra | o que não for pago fica na **reserva do fundo** (RF48 §7.1), não volta para o caixa da empresa |
| Piso, teto, mínimo | definidos no RF48 (exemplo: R$ 0,002 a R$ 0,010 por ponto; resgate mínimo de R$ 20; 1 pedido por mês no piloto) |

### 8.3 Quanto o fundo vale nos cenários (estimativa)

| Cenário | Fundo ano 1 | Fundo ano 2 | Fundo ano 3 | Fundo no mês 36 |
|---|---|---|---|---|
| Pessimista | R$ 1,1 mil | R$ 2,8 mil | R$ 4,7 mil | R$ 0,5 mil |
| **Base** | **R$ 6,0 mil** | **R$ 22,0 mil** | **R$ 45,3 mil** | **R$ 4,8 mil** |
| Otimista | R$ 21,1 mil | R$ 97,6 mil | R$ 230,3 mil | R$ 25,7 mil |

**Ilustração (base, mês 36):** fundo de R$ 4,8 mil e 2.000 adultos pedindo 2.000 pontos cada (4 milhões de pontos). A
taxa bruta seria R$ 0,0012 por ponto, **abaixo do piso de exemplo do RF48** (R$ 0,002). Pela regra de rateio
(RN48.28), paga-se pelo piso até o fundo acabar: ~2,4 milhões de pontos pagos (~R$ 2,40 por mil) e o resto volta para o
saldo. Duas conclusões para o RF48:

1. Nos primeiros anos o resgate é **simbólico** (poucos reais por pessoa por mês). A comunicação precisa deixar claro
   que "o valor do ponto depende da receita do mês", para não criar expectativa de renda.
2. **O piso precisa ser calibrado pelo tamanho real do fundo** no piloto (ou o piloto começa só com uma parte dos
   usuários, por convite). Um piso alto com fundo pequeno faz muitos pedidos voltarem todo mês, o que frustra.

### 8.4 Por que o desenho é seguro

- O dinheiro do fundo vem da **receita da empresa**, nunca da venda de pontos. Não existe ciclo dinheiro → ponto →
  dinheiro.
- Itens pagos e Paetês (se existirem) **nunca** viram pontos. FLAIR Coins também não.
- O resgate exige KYC, é limitado por CPF e é pago por Pix para conta da mesma titularidade (prevenção à lavagem de
  dinheiro), via parceiro licenciado (RF48).
- **A confirmar com contador e advogado:** a natureza do pagamento à pessoa física (prêmio, cessão de conteúdo ou
  serviço), a retenção de IR e INSS, a emissão de recibo e o informe anual. É o principal ponto jurídico em aberto do
  RF48.

---

## 9. Implementação da cobrança no app

### 9.1 Provedor de pagamento (comparativo; taxas a confirmar em contrato)

| Provedor | Recorrência | Pix / Pix Automático | Cartão | Pontos fortes | Pontos fracos |
|---|---|---|---|---|---|
| **Asaas** | assinaturas nativas | Pix R$ 1,99 (R$ 0,99 nos 3 primeiros meses); confirmar o Pix Automático no contrato | 2,99% + R$ 0,49; assinatura 1,99% + R$ 0,49 | sem mensalidade, emite NFS-e, split, saque via Pix (útil no RF48), régua de cobrança pronta | taxa fixa por Pix pesa em itens baratos |
| **Pagar.me** (Stone) | assinaturas | Pix | ~3,19% | split robusto para marketplace, antifraude | negociação comercial para tarifas melhores |
| **Mercado Pago** | assinaturas (preapproval) | Pix ~0,99% | ~4,99% | marca conhecida, checkout simples | cartão caro, API de assinatura menos flexível |
| **Stripe** | Stripe Billing (cobra à parte) | Pix ~1,19% | 3,99% + R$ 0,39 | melhor API e documentação, teste fácil | cartão mais caro; recorrência via Pix limitada |

**Recomendação:** **Asaas** no MVP (recorrência, NFS-e, split e saque Pix no mesmo provedor, sem mensalidade), atrás
de uma porta de pagamento (`PaymentGatewayPort`) para trocar ou somar o Pagar.me/Stripe sem mexer no domínio. Itens
avulsos baratos devem usar **carrinho** para diluir a taxa fixa do Pix. Para apps nativos no futuro: **RevenueCat**
(ou equivalente) para validar recibos da App Store e do Google Play e unificar o direito de acesso com a web.

### 9.2 Arquitetura (segue a arquitetura hexagonal do repositório)

```
fai-web          BillingController, CheckoutController, WebhookController (/api/billing/webhooks/{provider})
                 EntitlementsController (GET /api/me/entitlements), B2bBillingController
fai-application  EntitlementService     → plano + cotas + itens do usuário (com cache)
                 SubscriptionService    → criar, trocar, cancelar, régua de cobrança
                 PurchaseService        → carrinho, itens digitais, créditos de IA, reembolso
                 AiQuotaPolicy          → cota por (capacidade × plano) + créditos; usada pelo AiEngine
                 CreatorFundService     → apuração mensal do fundo (RF48)
                 ports: PaymentGatewayPort, StoreReceiptPort, InvoicePort (NFS-e)
fai-infrastructure adapters: AsaasGateway, (StripeGateway), RevenueCatReceipts, persistência MySQL
frontend (Next.js) useEntitlements(), <Paywall/>, /planos, /conta/assinatura, /loja, /conta/compras
```

### 9.3 Tabelas novas (migrações Flyway depois da V32; a numeração deve considerar a do RF48)

| Tabela | Conteúdo |
|---|---|
| `billing_plans` | `FREE`, `PLUS`, `PLUS_STUDENT`, `PRO`, `BRAND_VITRINE`, `BRAND_STUDIO`, `BRAND_MAISON`, `CELEB_PRO` |
| `billing_prices` | preço por plano × período (mensal/anual) × moeda × canal (web, App Store, Play), com vigência |
| `plan_entitlements` | plano → recurso/capacidade → cota mensal, modelo de IA, teto de gasto (US$) |
| `subscriptions` | usuário ou conta B2B, plano, status (`TRIALING`, `ACTIVE`, `PAST_DUE`, `GRACE`, `CANCELED`, `EXPIRED`), período atual, canal, id externo, `cancel_at_period_end` |
| `subscription_events` | histórico append-only (criada, renovada, falhou, trocou de plano, cancelada, reembolsada) |
| `payment_customers` | id do cliente no provedor, sem guardar dados de cartão (o provedor tokeniza) |
| `payments` | cobranças: valor, método (Pix, Pix Automático, cartão, boleto), status, taxa cobrada, id externo |
| `fiscal_invoices` | NFS-e emitida por pagamento (número, status, XML/PDF) |
| `digital_products` | SKU, tipo (`COSMETIC_ROOM`, `COSMETIC_FITTING_ROOM`, `COSMETIC_AVATAR`, `COSMETIC_FLAIR`, `SEASON_PASS`, `AI_CREDITS`), preço em R$, `cosmetic_only=true`, `random=false` (restrição de banco), faixa etária |
| `purchases` / `purchase_items` | carrinho pago, itens, status, janela de arrependimento |
| `user_digital_inventory` | itens pagos de cada usuário, separados do `room_inventory` (que é da loja em pontos), com origem `PURCHASE`, `SUBSCRIPTION_PERK` ou `SPONSORED_DROP` |
| `ai_credit_ledger` | extrato append-only de créditos de IA, com chave de idempotência (mesmo padrão do `fai_points_ledger`) e validade |
| `refunds` | reembolsos e chargebacks, motivo, item revogado |
| `webhook_inbox` | `provider` + `event_id` único, payload, recebido em, processado em, erro (idempotência) |
| `guardian_consents` | autorização do responsável para compras de menores e limite mensal |
| `b2b_accounts` / `b2b_contracts` | conta da marca/celebridade, CNPJ, plano, DPA aceito, licença de marca |
| `sponsored_placements` | slot patrocinado, período, superfície (Explorador, Provador, Desafio), rótulo obrigatório |
| `performance_events` | clique "Ver na loja", cupom validado, com a marca cobrada e o preço unitário |
| `creator_fund_periods` | mês, receita líquida, %, valor do fundo, sobra (consumido pelo RF48) |

### 9.4 Direitos de acesso (entitlements) e cotas de IA

- `EntitlementService.resolve(userId)` devolve plano, recursos e cotas restantes. O resultado fica em cache curto
  (Redis/memória) e é invalidado por webhook.
- **Mudança no `AiEngine`:** hoje a cota vem de `spec.dailyQuotaPerUser()` (fixa por capacidade). Passa a vir de
  `AiQuotaPolicy.limitFor(userId, capability)`: cota mensal do plano → créditos de IA → teto diário antiabuso do
  catálogo (mantido).
- **Mudança no `AiBudget`:** o teto por usuário (`AI_USER_DAILY_BUDGET_USD`, hoje US$ 0,50/dia) vira mensal e depende
  do plano (US$ 0,30 / 2,50 / 5,00). Estourado, o motor usa o modelo leve e, depois, o local, como já faz.
- **Modelo por plano:** o `AiCatalog` ganha a escolha do modelo por plano (Free → Gemini/Haiku; Plus → Sonnet 5.5;
  Pro "Análise profunda" → Opus 5.5), com prompt caching no Copilot e Batch API para DNA e insights.
- O `ai_inference_log` (RF24.CA16) já grava o custo real. Ele vira o painel de **custo de IA por plano**, o KPI mais
  importante do negócio.
- Frontend: `GET /api/me/entitlements` alimenta `useEntitlements()`. O paywall aparece **depois** do uso (ex.: "Você
  usou suas 5 composições do mês"), nunca antes de funções grátis.

### 9.5 Webhooks

1. Receber em `/api/billing/webhooks/{provider}`, validar a assinatura/token do provedor e gravar em `webhook_inbox`
   (`event_id` único). Responder 200 rápido.
2. Processar de forma assíncrona e idempotente: pagamento confirmado → ativa/renova a assinatura ou entrega o item;
   pagamento vencido → `PAST_DUE`; reembolso/chargeback → revoga; autorização de Pix Automático
   criada/cancelada → atualiza o método.
3. Publicar eventos de domínio (`SubscriptionActivated`, `PurchaseCompleted`, `PurchaseRefunded`) com o mesmo padrão
   `@TransactionalEventListener(AFTER_COMMIT)` usado nos cupons (RF38).
4. Conciliação diária com a API do provedor para pegar webhooks perdidos.

### 9.6 Régua de cobrança (dunning)

| Dia | Cartão | Pix Automático |
|---|---|---|
| D0 | cobrança; se falhar → `PAST_DUE`, e-mail + aviso no app | débito agendado; se falhar, o banco tenta de novo conforme a regra do BCB |
| D+1, D+3, D+5 | novas tentativas | novo Pix avulso (QR code) por e-mail |
| D+7 | fim do período de carência: volta ao Free (`EXPIRED`) | idem |
| sempre | **nada é apagado**: peças, looks, quarto e itens comprados ficam; só voltam as cotas do Free | idem |

### 9.7 Cancelamento, reembolso e CDC

- **Direito de arrependimento (CDC art. 49):** 7 dias a partir da contratação, com devolução integral, pelo mesmo
  canal da compra (Decreto 7.962/2013). Vale para a primeira assinatura, o teste que virou cobrança e as
  microtransações (item ou créditos revogados).
- **Renovações:** avisar por e-mail 7 dias antes da renovação anual. **Política recomendada** (mais generosa que o
  mínimo legal discutível): reembolso integral se o pedido vier em até 7 dias depois da renovação anual.
- **Cancelar em dois toques** em `/conta/assinatura`, sem exigir contato humano. O acesso continua até o fim do
  período pago.
- Compras pela App Store/Google Play seguem a política de reembolso da loja. O app mostra o caminho.
- Atualizar os [Termos de Uso v1](../legal/TERMOS_DE_USO_v1.md) §12 ("Compras e assinaturas futuras") com os **termos
  comerciais** (preço, renovação, cancelamento, reembolso, menores) antes do lançamento.

---

## 10. A empresa: estrutura legal, tributos e documentos

### 10.1 Forma jurídica

| Opção | Serve? | Observação |
|---|---|---|
| **MEI** | **Não** | desenvolvimento de software (CNAE 6201-5/01, 6202-3/00) e serviços de aplicação não estão na lista taxativa do MEI |
| **SLU** (Sociedade Limitada Unipessoal) | **Sim, recomendada se houver um único dono** | responsabilidade limitada ao capital, sem sócio obrigatório, pode optar pelo Simples |
| **LTDA com sócios** | **Sim, se o projeto continuar com colegas do TCC** | exige acordo de sócios (vesting, saída, propriedade intelectual) |
| Inova Simples (LC 167/2019, Marco Legal das Startups LC 182/2021) | opcional | rito simplificado para startups. Avaliar com o contador se compensa frente a uma SLU comum |

**Atenção à propriedade intelectual:** o código e o design nasceram num **TCC em equipe** (o board do Trello cita mais
de um autor). Antes de faturar, é preciso um **termo de cessão de direitos** dos coautores para a empresa (ou a
entrada deles como sócios) e conferir o regulamento de propriedade intelectual da instituição de ensino.

### 10.2 Regime tributário

- **Simples Nacional**, buscando o **Anexo III** pelo **Fator R ≥ 28%** (folha de pagamento, incluindo pró-labore, de
  pelo menos 28% da receita dos últimos 12 meses). Abaixo disso, o Anexo V começa em 15,5%. No início, com receita
  baixa, um pró-labore modesto já garante o Fator R.
- **ISS** e **PIS/COFINS** são recolhidos **dentro do DAS** no Simples (sem guia separada).
- **Reforma tributária:** em 2026, CBS (0,9%) e IBS (0,1%) estão em teste e o **Simples ficou fora do ano-teste**
  (LC 214/2025, art. 348). PIS e COFINS são extintos em 31/12/2026 e a CBS passa a valer em 2027. O IBS substitui
  ICMS e ISS aos poucos até 2033. Rever o preço com o contador no fim de 2026 (de 1º a 30/09/2026 já houve a janela
  de opção por recolher IBS/CBS fora do DAS no 1º semestre de 2027).
- **Nota fiscal:** NFS-e para cada assinatura, item e contrato B2B, emitida automaticamente pelo provedor de pagamento
  ou por um emissor integrado.
- **Enquadramento do serviço:** assinatura de app e itens digitais (item 1.03/1.05/1.09 da lista do ISS) e
  publicidade/patrocínio B2B (item 17.x) podem ter tratamento diferente. **Confirmar com o contador.**

### 10.3 CNAEs sugeridos (confirmar com o contador)

| CNAE | Descrição | Uso |
|---|---|---|
| **6311-9/00** (principal) | Tratamento de dados, provedores de serviços de aplicação e serviços de hospedagem na internet | assinatura do app (SaaS). Fontes divergem sobre o Fator R neste CNAE: confirmar |
| 6203-1/00 | Desenvolvimento e licenciamento de programas de computador não customizáveis | alternativa/secundário para licença de uso |
| 6319-4/00 | Portais, provedores de conteúdo e outros serviços de informação na internet | conteúdo e itens digitais |
| 7319-0/02 ou 7311-4/00 | Promoção de vendas / agências de publicidade | patrocínio, ambientes de marca, desafios patrocinados |
| 7490-1/04 | Intermediação e agenciamento de serviços e negócios | afiliação e, na fase 2, venda de itens de marcas (marketplace) |

### 10.4 Documentos e cadastros

1. Contrato social (SLU/LTDA), CNPJ pela REDESIM, inscrição municipal, alvará/dispensa (atividade de baixo risco em
   endereço residencial ou coworking).
2. Opção pelo Simples Nacional (no prazo de abertura), certificado digital e-CNPJ, conta PJ.
3. Contador (custo estimado de R$ 300 a R$ 600/mês para Simples de serviços digitais).
4. **Registro da marca no INPI** (classes 9, 35, 41 e 42). "FashionAI" é um nome descritivo e comum: fazer busca de
   anterioridade **antes** de investir em marca. Ter um nome alternativo pronto.
5. Contas de desenvolvedor Apple (Small Business Program) e Google Play quando houver app nativo.

### 10.5 Termos, privacidade e encarregado (DPO)

- Atualizar os **Termos de Uso** e a **Política de Privacidade** com: termos comerciais, política de reembolso, regras
  de itens digitais (não transferíveis, sem valor monetário), regras do Fundo de Criadores (RF48), política de
  conteúdo patrocinado e o capítulo de **menores** (ECA Digital: supervisão parental, sem perfilamento para
  publicidade, sem loot box).
- **Contrato B2B** com DPA (acordo de tratamento de dados), licença de marca e regras de anonimização.
- **Encarregado (DPO):** a Resolução CD/ANPD nº 2/2022 dispensa o encarregado para agentes de pequeno porte (desde que
  haja um canal de atendimento ao titular). **Porém** a dispensa não vale para quem faz tratamento de **alto risco**,
  e o FashionAI trata **dado biométrico** (rosto no Meu Avatar 3D, RF40.CA07) e **dados de adolescentes**.
  Recomendação: **nomear um encarregado** (o próprio fundador, com capacitação, ou um serviço terceirizado; custo
  estimado de R$ 300 a R$ 800/mês) e fazer um **RIPD** (relatório de impacto) para avatar, provador e menores.

---

## 11. Roadmap de lançamento e KPIs

### 11.1 Fases

| Fase | Quando | Entregas |
|---|---|---|
| **0. Preparação** | 2 meses antes | abrir a empresa e a conta PJ; cessão de direitos do TCC; contrato com o provedor de pagamento; atualizar termos/privacidade; nomear o encarregado; painel de custo de IA por usuário (a partir do `ai_inference_log`); trocar modelos por capacidade (Sonnet/Haiku/Gemini + cache) e **medir** o custo real do Free |
| **1. MVP pago** | meses 1–3 | Plus mensal/anual + Estudante; teste de 7 dias; `EntitlementService` e `AiQuotaPolicy`; checkout web com Pix Automático e cartão; webhooks, régua, reembolso de 7 dias; pacotes de créditos de IA; **3 a 5 marcas parceiras de lançamento** (Vitrine grátis por 3 meses em troca de depoimento e dados) |
| **2. Monetização completa** | meses 4–6 | Pro (painel do criador, prova 2D, 3D sob flag); microtransações cosméticas (Quarto "Atelier", ambientes do provador, molduras FLAIR) com carrinho; compras de menores com autorização do responsável; planos B2B Vitrine/Studio self-service; cobrança por desempenho (clique e cupom validado) |
| **3. Escala** | meses 7–12 | Fundo de Criadores (RF48) em beta para adultos com KYC; Passe de Temporada FLAIR; Maison e Celebridade Pro; Modo Consultoria; app nativo (IAP ou link para a web); testes A/B de preço; preparar a fase 2 do marketplace (§5.5) |

### 11.2 KPIs e metas (metas são estimativas para o cenário base)

| Grupo | KPI | Meta |
|---|---|---|
| Aquisição | usuários ativos/mês (MAU); % orgânico | 14 mil no mês 12; ≥ 75% orgânico |
| Ativação | % que cadastra 5+ peças e cria 1 look na 1ª semana | ≥ 40% |
| Retenção | D1 / D7 / D30 | 40% / 20% / 10% |
| Monetização B2C | conversão a pagante (MAU → pagante); teste → pago | ≥ 3%; ≥ 25% |
| | ARPPU; % anual | ≥ R$ 21; ≥ 35% |
| | churn mensal (mensais / combinado) | ≤ 8% / ≤ 6% |
| Custo | **custo de IA por MAU Free / por pagante** | ≤ US$ 0,05 / ≤ 20% do ARPPU |
| | margem bruta | ≥ 60% |
| Eficiência | LTV/CAC; payback do CAC | ≥ 3; ≤ 12 meses |
| B2B | marcas pagantes; receita retida (NRR); CTR "Ver na loja" depois de prova; cupons validados/mês | 4 no mês 12; ≥ 100%; ≥ 8%; crescente |
| Microtransações | % de MAU comprando no mês; tíquete médio | ≥ 1,5%; ≥ R$ 12 |
| Confiança | taxa de reembolso; chargeback; reclamações | < 3%; < 0,5%; resposta em ≤ 5 dias úteis |
| Fundo | % da receita líquida B2C destinada; R$ por 1.000 pontos; % de pedidos devolvidos por falta de fundo | 10%; publicado todo mês; < 20% |

---

## 12. Riscos e decisões em aberto

### 12.1 Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| **Custo de IA** acima do previsto (uso, preço, câmbio) | alto: sozinho impede o equilíbrio (§7.3) | teto por plano no `AiBudget`, modelo por plano, cache, Batch, processamento local, painel diário; preço em reais revisto todo ano |
| Conversão abaixo de 2% | alto | paywall depois do valor, teste grátis, anual com âncora mensal, plano Estudante; reforçar o B2B |
| **ECA Digital / CDC / LGPD** (menores, biometria, publicidade) | alto | nada aleatório pago, compras de menores com o responsável, sem anúncio de terceiros, RIPD, revisão jurídica antes do lançamento |
| Enquadramento jurídico do **Fundo de Criadores** (tributação, natureza do pagamento, prevenção à lavagem de dinheiro) | médio-alto | KYC, teto por CPF, Pix para a mesma titularidade, parecer jurídico e contábil antes do RF48 entrar em produção |
| **Propriedade intelectual** do TCC (coautores, instituição) | alto, pode travar a empresa | cessão de direitos ou sociedade antes de faturar |
| **Marca "FashionAI"** já registrada por terceiros | médio | busca no INPI agora; nome alternativo |
| Uso de **marcas e logos** de terceiros no provador e no catálogo | médio | temas "inspirados" sem identidade visual (como hoje); ambiente oficial só com licença (vira produto B2B); respeitar robots.txt e fontes oficiais (RF47) |
| Perder a **neutralidade** (patrocínio contaminando busca e Copilot) | médio: corrói a confiança | regra do §4.1 em código e testes: resultado orgânico nunca usa `sponsored_placements` |
| Dependência de um provedor (Anthropic, Google, FASHN, Railway) | médio | o motor do RF24 já tem alternativa e fallback local por capacidade |
| Regras das lojas de apps mudarem de novo | médio | web primeiro; lojas como canal secundário |
| Fraude (cartão roubado, contas para farmar pontos e resgatar) | médio | antifraude do provedor, KYC no resgate, idempotência e tetos do `fai_points_ledger` |

### 12.2 Decisões para o fundador

| # | Decisão | Recomendação deste estudo |
|---|---|---|
| D1 | Preços do Plus e do Pro | R$ 19,90 e R$ 39,90 por mês (R$ 179 e R$ 359 por ano); Estudante R$ 11,90; rever após 3 meses com teste A/B (ex.: Plus a R$ 14,90 × R$ 19,90) |
| D2 | Preço direto em reais × moeda premium | **preço direto em reais**; Paetês só como plano B (§5.4) |
| D3 | % do Fundo de Criadores | **10% da receita líquida B2C** (assinaturas + microtransações), como no RF48 D1; revisão trimestral; teto de 15% |
| D4 | Provedor de pagamento | **Asaas** no MVP, atrás de `PaymentGatewayPort` |
| D5 | Web × app nativo | **web primeiro** (PWA); nativo na fase 3 |
| D6 | Teste grátis | 7 dias no Plus e no Pro |
| D7 | Forma jurídica e sócios | SLU se for sozinho; LTDA com acordo de sócios se os colegas do TCC continuarem |
| D8 | Anúncios de terceiros | **não** |
| D9 | Compras de menores | desligadas por padrão; responsável autoriza, com limite de R$ 50/mês |
| D10 | Marcas parceiras de lançamento | 3 a 5 marcas com o Vitrine grátis por 3 meses |
| D11 | Captação | definir se o caixa de ~R$ 275 mil (base) virá de recursos próprios, editais de fomento (ex.: programas de inovação estaduais e federais e incubadora da universidade) ou investidor-anjo |
| D12 | Modo Consultoria (Pro) | validar com 10 stylists antes de construir |

---

## Fontes

Consultadas em 04/10/2026. Os valores podem mudar e precisam ser conferidos no momento da contratação.

**Concorrentes**
- Whering, preços 2026: [PutTogether — Whering vs PutTogether 2026](https://www.puttogether.world/guides/digital-closet/whering-vs-puttogether-2026), [GetWardrobe vs Whering](https://getwardrobe.com/compare/whering/), [Stylebook vs Whering (Eleven April)](https://elevenapril.com/blog/stylebook-vs-whering)
- Acloset: [App Store — Acloset](https://apps.apple.com/us/app/acloset-ai-fashion-assistant/id1542311809), [GetWardrobe vs Acloset](https://getwardrobe.com/compare/acloset/), [Nouva — alternativas ao Acloset 2026](https://www.nouva.app/blog/best-acloset-alternatives-2026)
- Indyx: [Indyx — How it works](https://www.myindyx.com/how-it-works), [Indyx vs Stylebook](https://www.myindyx.com/versus/indyx-vs-stylebook), [Style Within Grace — review do Indyx](https://stylewithingrace.com/indyx-app-review-lookbook/)
- Stylebook: [Best Wardrobe Apps 2026 (Indyx)](https://www.myindyx.com/blog/the-best-wardrobe-apps), [Wardrowbe — 11 apps testados](https://wardrowbe.com/blog/best-wardrobe-apps-2026/)

**IA e infraestrutura**
- [Anthropic — preços da API (tabela oficial)](https://platform.claude.com/docs/en/about-claude/pricing)
- [Railway — planos](https://docs.railway.com/pricing/plans), [Railway Pricing 2026 (BudgetForge)](https://www.budgetforge.dev/tools/railway-pricing-2026)
- [Vercel Pricing 2026 (CostBench)](https://costbench.com/software/developer-tools/vercel/)
- Custos por chamada de Gemini, FASHN, Meshy, Photoroom, Stability e Replicate: `fai-application/src/main/java/br/com/fashionai/application/ai/AiCatalog.java` (estimativas do projeto, set/2026)

**Lojas de apps**
- [Apple — mudanças no iOS no Brasil (jun/2026)](https://www.apple.com/newsroom/2026/06/apple-announces-changes-to-ios-in-brazil/), [MacRumors — mudanças da App Store no Brasil](https://www.macrumors.com/2026/06/18/apple-announces-ios-app-store-changes-in-brazil/), [Mobile Time — Apple anuncia mudanças após acordo com o CADE](https://www.mobiletime.com.br/noticias/18/06/2026/apple-anuncia-mudancas/), [Tecnoblog — alíquotas da Apple no Brasil](https://tecnoblog.net/noticias/apple-ainda-podera-cobrar-taxas-no-brasil-veja-aliquotas/), [FunnelFox — taxas da App Store 2026](https://blog.funnelfox.com/apple-app-store-fees-2026-eu-dma/)
- [Apple — Small Business Program](https://developer.apple.com/app-store/small-business-program/), [RevenueCat — taxas da App Store](https://www.revenuecat.com/blog/engineering/small-business-program)
- [RevenueCat — taxa reduzida de 15% no Google Play](https://www.revenuecat.com/docs/platform-resources/google-platform-resources/15-reduced-service-fee), [Android Developers Blog — mar/2026](https://android-developers.googleblog.com/2026/03/a-new-era-for-choice-and-openness.html)

**Pagamentos**
- [Asaas — preços e taxas](https://www.asaas.com/precos-e-taxas), [Asaas — blog de taxas](https://blog.asaas.com/taxas-asaas/)
- [Stripe — preços](https://stripe.com/pricing), [Stripe — meios de pagamento locais](https://stripe.com/pricing/local-payment-methods)
- [Kataly — ranking de taxas de gateways 2026](https://www.kataly.com.br/blog/ranking-taxas-gateways-pagamento-2026-benchmark), [Mind Group — comparativo de gateways 2026](https://mindconsulting.com.br/2026/07/gateways-pagamento-online-brasil-comparativo-2026/), [Pix Automático para SaaS (SystemForge)](https://forjadesistemas.com.br/blog/pix-automatico-recorrencia-saas-proprio-2026/)
- Pix Automático: [Celcoin — como funciona em 2026](https://celcoin.com.br/articles/pix-automatico-banco-central/), [Mattos Filho — lançamento pelo BCB](https://www.mattosfilho.com.br/unico/bcb-divulga-pix-automatico/), [Forbes Brasil](https://forbes.com.br/forbes-money/2025/06/pix-automatico-como-funciona-a-nova-modalidade-de-pagamento/)

**Benchmarks de assinatura e mídia**
- [RevenueCat — State of Subscription Apps 2026](https://www.revenuecat.com/state-of-subscription-apps), [RevenueCat — tendências e benchmarks 2026](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026), [RevenueCat — State of Subscription Apps 2025](https://www.revenuecat.com/state-of-subscription-apps-2025)
- Spotify no Brasil: [CNN Brasil — preços do Spotify](https://www.cnnbrasil.com.br/economia/money/negocios/tem-spotify-veja-quanto-custara-assinatura-no-brasil-apos-aumento-no-preco/), [Spotify Premium Brasil](https://www.spotify.com/br-pt/premium/)
- CPM da Meta no Brasil: [Superads — CPM do Facebook no Brasil](https://www.superads.ai/facebook-ads-costs/cpm-cost-per-mille/brazil), [Adligator — CPM por país 2026](https://adligator.com/blog/meta-ads-cpm-by-country-benchmarks)
- Câmbio: [InfoMoney — dólar em 28/09/2026](https://www.infomoney.com.br/mercados/dolar-hoje-abertura-fechamento-comercial-turismo-28092026/), [Investidor10 — cotação do dólar](https://investidor10.com.br/moedas/usd/)

**Legislação, tributos e regulação**
- [Lei 15.211/2025 — ECA Digital (Planalto)](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm), [Rádio Senado — ECA Digital proíbe caixa de recompensa](https://www12.senado.leg.br/radio/1/noticia/2026/03/27/eca-digital-proibe-rolagem-infinita-e-caixa-de-recompensa-em-games-infantojuvenis), [Conjur — impactos do ECA Digital nos jogos](https://www.conjur.com.br/2025-out-22/impactos-do-eca-digital-no-segmento-de-jogos-eletronicos/), [Demarest — cartilha ECA Digital](https://www.demarest.com.br/wp-content/uploads/2026/03/Cartilha-ECA-Digital_V2.pdf)
- [CDC — Lei 8.078/1990 (Planalto)](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm), [Decreto 7.962/2013 — comércio eletrônico](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm), [LGPD — Lei 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm)
- [Resolução CD/ANPD nº 2/2022 (LegisWeb)](https://www.legisweb.com.br/legislacao/?id=426801), [Migalhas — a resolução e as startups](https://www.migalhas.com.br/depeso/367429/resolucao-cd-anpd-2-22-um-diferenciado-olhar-da-lgpd-para-as-startups)
- Moeda eletrônica × moeda virtual: [Comunicado BCB nº 31.379/2017 (LegisWeb)](https://www.legisweb.com.br/legislacao/?id=352560), [Lei 12.865/2013 (Planalto)](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12865.htm)
- MEI e CNAEs de software: [Contabilidade.com — desenvolvedor pode ser MEI?](https://contabilidade.com/blog/desenvolvedor-pode-ser-mei-em-2026-veja-como-abrir-cnpj-escolher-o-cnae-ideal-e-pagar-menos-impostos/), [Agilize — CNAE 6201-5/01](https://agilize.com.br/artigos/cnae-6201501-o-que-e/), [Meu Contador Online — CNAE para SaaS](https://www.meucontadoronline.com.br/blog/cnae-software-servico-saas-guia-completo/), [Contabilidade.com — CNAE 6311-9/00](https://contabilidade.com/blog/cnae-6311900-tratamento-de-dados-provedores-de-servicos-de-aplicacao-e-hospedagem-na-internet-simples-nacional-fator-r-e-abertura-de-empresa/)
- Simples Nacional: [Contabilizei — Anexo III 2026](https://www.contabilizei.com.br/contabilidade-online/anexo-3-simples-nacional/), [Contabilizei — Anexo V 2026](https://www.contabilizei.com.br/contabilidade-online/anexo-5-simples-nacional/), [Contabilizei — Fator R](https://www.contabilizei.com.br/contabilidade-online/fator-r-simples-nacional/)
- Reforma tributária: [e-Auditoria — DAS em 2026 com IBS e CBS](https://www.e-auditoria.com.br/blog/das-no-simples-nacional-2026-o-que-muda-com-ibs-e-cbs/), [Fenacon — fase de testes em 2026](https://fenacon.org.br/reforma-tributaria/reforma-tributaria-entra-em-fase-de-testes-em-2026/)

---

*Modelo de projeção: planilha simplificada em Python (premissas do §7.1; imposto calculado faixa a faixa do Anexo III
sobre a RBT12; Fundo de Criadores sobre a receita líquida B2C). Para reproduzir ou ajustar, troque as premissas e recalcule.
A próxima versão deste estudo pode virar uma planilha em `docs/planilhas/`.*
