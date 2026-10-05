# RF53 — HypeScore v2: Hype analítico de peças e looks (verso dos cards, Histórico, Em alta, Guarda-roupa e Copilot)

**Numeração.** Esta implementação foi originalmente identificada como RF49 (cartão
[YP4B9hfa](https://trello.com/c/YP4B9hfa)). Como a documentação atual também usa RF49–RF52 para outros requisitos,
ela aparece aqui como **RF53**; confirme a numeração final no Trello. O RF48 permanece reservado às propostas de
resgate e doações de FAI Points ([RF48_FAI_Points_Resgate_e_Doacoes.md](RF48_FAI_Points_Resgate_e_Doacoes.md)).
Este documento registra **o que foi implementado**. A arquitetura completa está em
[`docs/hype/HYPESCORE_ARCHITECTURE.md`](../hype/HYPESCORE_ARCHITECTURE.md), e a auditoria com a proposta de navegação
que motivou a entrega, em [`docs/hype/01-AUDITORIA_E_PROPOSTA_IA.md`](../hype/01-AUDITORIA_E_PROPOSTA_IA.md).

> **HypeScore = f(entidade, comportamento, contexto, tempo).** O Hype não responde "esta peça é boa?". Responde "qual
> é a relevância atual desta peça ou deste look no FashionAI, e como ela está mudando?". Ele fica sempre separado da
> **compatibilidade pessoal** com o DNA de estilo.

---

## 1. Entrega

| Área | O que mudou |
|---|---|
| **Cálculo** | 9 dimensões de 0 a 100: popularidade, engajamento (normalizado pelo alcance), tendência, velocidade da tendência, novidade, longevidade, raridade, originalidade e, só em looks, influência. Pesos centralizados (`HypeScoreConfig`), decaimento temporal (meia-vida de 7 dias), níveis LOW_SIGNAL…VIRAL sempre com texto, seta ↑↓→ pela direção calculada, momentum (emergente, subindo, estável, esfriando, clássico) e motivos explicáveis |
| **Sinais** | eventos de domínio (curtir, comentar, salvar, favoritar, compartilhar, remixar, visualizar, vestir, peça em look, look do dia) → agregado diário com antimanipulação |
| **Snapshots** | job a cada 6 h (e manual pelo admin) grava o estado atual e o histórico diário, sempre com `algorithm_version = HYPE_V2` |
| **Cards** | `FashionCard`: frente visual e social com Hype compacto; verso "Hype analytics" pelo botão ↻ (teclado, foco, `inert`, movimento reduzido); "Ver análise completa" abre um drawer com gráfico, dimensões, explicação e "Hype × seu estilo" |
| **Navegação** | domínios Guarda-roupa, Looks, Descobrir, Perfil e Jogar; "aba muda o contexto, filtro restringe os dados"; o Lookbook perdeu a aba de cupons (`?tab=cupons` redireciona para `/coupons`), ganhou **Insights** e os Salvos viraram um segmento (looks / peças) |
| **Histórico** | página `/history` com as abas Linha do tempo, Estilo, Uso, **Hype** (subidas, quedas, redescobertas, looks emergentes e novas tendências) e Insights |
| **Guarda-roupa** | ordenar por maior/menor Hype, maior crescimento, mais/menos usada, mais rara e mais tempo sem uso; filtro por nível mínimo. Corrigiu um bug: a tela enviava `mais_usadas`/`nome`/`preco`, que o backend ignorava (os nomes antigos continuam aceitos como alias) |
| **Descobrir** | aba **Em alta** no Explorador: ranking com Hoje / 7 / 30 dias e recortes por categoria, estilo e ocasião, só com conteúdo público |
| **Copilot** | responde perguntas sobre Hype sem recomendar só o que está em alta; modos **Seguro / Descoberta / Experimental**; seções Recomendações, Descoberta, Experimentar, Redescoberta e Insights; cada look mostra os scores (compatibilidade, Hype, novidade, reuso) |
| **Convivência com o v1 (RF6)** | o `HypeScoreService` v1 continua dono das colunas `hype_score` das entidades e do painel do Look do Dia. O v2 grava só nas tabelas novas, e o job "hype" do admin roda as duas versões |

## 2. Servidor

**Banco** (Flyway `V31__hype_score_v2.sql`, com backfill dos dados que já existiam):
`hype_signal_daily` (sinais por entidade, tipo e dia), `hype_scores` (estado atual por versão do algoritmo) e
`hype_score_snapshots` (um por entidade, versão e dia).

**API** (`HypeController`):

| Método | Rota | Regra |
|---|---|---|
| GET | `/api/hype/summaries?type=&ids=` | lote de até 100 ids para os cards; item que quem vê não pode ver fica fora da resposta |
| GET | `/api/hype/pieces/{id}` · `/api/hype/looks/{id}` | detalhe: dimensões, motivos e compatibilidade com o DNA (separada) |
| GET | `/api/hype/pieces/{id}/history` · `/api/hype/looks/{id}/history` | série diária (`days`, padrão 90) |
| GET | `/api/hype/trending` | `type`, `window` (1/7/30), `category`, `style`, `occasion`, `limit`; só `public_eligible`; com cache por geração |
| GET | `/api/me/hype/wardrobe` | destaques do próprio guarda-roupa (topo, maior crescimento, clássico, rara, esquecida, look mais remixado, redescobertas) |
| GET | `/api/me/hype/movers` | subidas e quedas pela direção calculada, redescobertas, looks emergentes e novas tendências |
| POST | `/api/admin/hype/snapshots` | recálculo manual (admin) |
| GET | `/api/me/closet?sort=&hypeLevel=` | ordenações e filtro de Hype no guarda-roupa |
| GET | `/api/hype/method` | método v1 + configuração ativa do v2 |

**Privacidade:** item privado de outra pessoa → 404 / fora do lote; o ranking e as estatísticas só leem a população
pública elegível (item público, perfil não privado, moderação aprovada, conta não-teste).
**Antimanipulação** (`HypeIntegrityPolicy`): interação do próprio dono não conta (o uso conta); 1 sinal por pessoa,
entidade, tipo e dia; conta com menos de 7 dias pesa 0,5; visitante sem conta não conta; patrocínio nunca entra.

## 3. Critérios de aceite

| CA | Regra | Situação |
|---|---|---|
| RF53.CA01 | card de peça e de look com frente (Hype compacto) e verso "Hype analytics"; só o botão ↻ vira, um card por vez, sem virar ao tocar na foto ou no curtir | pronto (`components/fashion-card.tsx`, `piece-card.tsx`, `scheme-card.tsx`) |
| RF53.CA02 | o giro funciona por teclado e toque, move o foco e respeita `prefers-reduced-motion` | pronto |
| RF53.CA03 | estados CARREGANDO, HYPE NÃO CALCULADO, DADOS INSUFICIENTES, HYPE DISPONÍVEL, HYPE DESATUALIZADO e ERRO; "sem dado" nunca aparece como 0 | pronto (`lib/hype/model.ts`, `HypeStateNotice`) |
| RF53.CA04 | HypeScore com 9 dimensões normalizadas, pesos centralizados e decaimento temporal | pronto (`HypeCalculator`, `HypeScoreConfig`) |
| RF53.CA05 | nível sempre com texto e seta ↑/↓/→ pela direção calculada (−1,9 pts dentro da faixa estável é "estável") | pronto |
| RF53.CA06 | snapshots diários com `algorithmVersion` e histórico no drawer | pronto |
| RF53.CA07 | explicação humana dos motivos ("apresenta forte crescimento de salvamentos"), nunca juízo de qualidade | pronto (`lib/hype/explain.ts`) |
| RF53.CA08 | tendência ≠ popularidade e Hype ≠ compatibilidade com o DNA, sempre exibidos separados | pronto |
| RF53.CA09 | guarda-roupa ordena por Hype, crescimento, uso, raridade e tempo sem uso, e filtra por nível mínimo | pronto |
| RF53.CA10 | Histórico › Hype e Lookbook › Insights mostram subidas, quedas, redescobertas e destaques do próprio guarda-roupa | pronto |
| RF53.CA11 | Explorador › Em alta com Hoje / 7 / 30 dias e recortes por categoria, estilo e ocasião | pronto |
| RF53.CA12 | Copilot responde perguntas sobre Hype, nunca recomenda só pelo Hype e oferece os modos Seguro, Descoberta e Experimental | pronto |
| RF53.CA13 | item privado nunca entra em ranking nem em estatística pública, e terceiros não leem o Hype dele | pronto |
| RF53.CA14 | sinais filtrados contra autointeração, repetição, conta nova e visitante; patrocínio nunca pesa | pronto (extensões previstas: reputação, cadência de bots, grafo de contas, IP/dispositivo) |
| RF53.CA15 | navegação por domínios sem remover funcionalidades: rotas antigas continuam por alias ou redirecionamento | pronto |

## 4. Testes

48 testes no servidor: `HypeCalculatorTest` (19), `RecommendationScoringTest` (6), `HypeScoreConfigTest` (5),
`HypeIntegrityPolicyTest` (4), `HypeSnapshotRulesTest` (4), `HypeQueryPrivacyTest` (3), `StyleCompatibilityTest` (3),
`HypeSignalSeriesTest` (2) e `CopilotHypeIntentTest` (2). No frontend: `components/hype/hype-card.test.tsx` (17) e
`lib/hype/model.test.ts` (9).
Também passou um teste de ponta a ponta com MySQL 8.4 e o backend rodando localmente: sinais, autocurtida ignorada,
salvar → desfazer → salvar contado uma vez, peso de conta nova, job, resumos, 404 de privado, histórico, Em alta,
insights, subidas/quedas, ordenações do guarda-roupa e intenções de Hype do Copilot.

## 5. Diagramas

`docs/diagramas/RF53/`: atividades, sequência, componentes, máquina de estados (estado do Hype de uma peça ou look) e
classes. Os diagramas dos RF afetados também foram atualizados: RF6 (Lookbook), RF10 (Copilot), RF19 (interações →
sinais), RF26 (Em alta), RF31 (ordenações e filtro de Hype), RF42 (look do dia → LOOK_WORN), além dos globais
`fashionai-classes-v4` e `fashionai-componentes-v4`.

## 6. Limites conhecidos e próximos passos

- Os demais consumidores do v1 (painel do Look do Dia, FLAIR, Explorador antigo) ainda leem o v1; migrar para o v2
  com o mesmo `algorithmVersion` é o próximo passo (§11 da arquitetura).
- A normalização por percentil precisa de população pública ≥ 5; abaixo disso usa curva absoluta (ambiente de TCC).
- Extensões antimanipulação listadas no CA14 estão como ponto de extensão, não implementadas.

🔗 **Dependência:** RF5, RF6 (v1), RF8, RF10, RF13 (DNA), RF19, RF26, RF31, RF42.
