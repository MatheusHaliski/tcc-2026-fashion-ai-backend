# RF48 — FAI Points: resgate em dinheiro e doações entre usuários

**Data:** 2026-10-04 · **Status:** proposta para validação do fundador, do jurídico e da contabilidade · **Numeração:** Trello (próximo número livre depois do RF47).
**Depende de:** RF30 (FAI Points, níveis e loja; no código **RF35**), RF41 (FAI Points em todos os jogos e criações), RF42 (Look do dia), RF33 (Passarela 3D), RF2/RF3 (2FA, conta, LGPD).
**Documento irmão:** [RF41_v2_Concessao_FAI_Points_Todos_RFs.md](RF41_v2_Concessao_FAI_Points_Todos_RFs.md), que define *quais* ações rendem pontos e quais são **sacáveis**.
**Diagramas:** `docs/diagramas/RF48/` (atividades, classes, componentes, máquina de estados do resgate, sequência da doação).

> **Aviso.** Os pontos regulatórios abaixo foram pesquisados em fontes públicas em 2026-10-04 e servem para orientar o
> desenho do produto. **Nenhum deles substitui parecer jurídico ou contábil.** Cada item marcado ⚖️ deve ser
> **validado com jurídico** antes de entrar em produção.

---

## 1. Pedido do fundador (texto original)

> "Conceder o direito de trocar FAI points por dinheiro (moeda local do país). Introduzir transações financeiras dentro
> do app, onde o usuário vai poder trocar Fashion AI points por dinheiro local, seguindo regras de uso do app sobre
> criação de peças e looks, jogabilidade dos modos FLAIR & desafios, provador, espelho, loja virtual & meu quarto.
> Adicionar, dentro da sub aba look do dia, a possibilidade de doar FAI points para o usuário por livre espontânea
> vontade, porque gostou do look da pessoa. Futuramente replicada no provador, espelho, meu quarto e jogos FLAIR:
> transação de FAI points entre usuários diferentes, e não a premiação do sistema ao usuário."

O RF48 tem duas partes independentes:

| Parte | O que é | Quem paga o valor | Fase |
|---|---|---|---|
| **A. Doação P2P ("Apoiar com FAI Points")** | Um usuário transfere parte do **próprio saldo** a outro, porque gostou do look. Não é prêmio do sistema. | O doador (sai do saldo dele) | F1 (Look do dia), F4 (Provador, Espelho, Meu Quarto, FLAIR) |
| **B. Resgate em dinheiro** | O usuário converte pontos **sacáveis e maturados** em moeda local, recebida por PIX em conta própria, via parceiro licenciado. | O **Fundo de Criadores** (% fixo da receita líquida) | F2 (piloto BR), F3 (outros países) |

## 2. Objetivo

1. Reconhecer financeiramente quem **cria valor real** no FashionAI (catálogo, looks de qualidade, peças resgatadas,
   desafios por mérito), sem transformar o app em cassino, banco ou fábrica de contas falsas.
2. Dar à comunidade um gesto social de apoio ("gostei do seu look") que tenha peso, mais forte que uma curtida.
3. Manter a economia de pontos **sempre lastreada**: o app nunca promete mais dinheiro do que o fundo tem.

## 3. Escopo

**Dentro:** doação de pontos na sub-aba Look do dia (e no look do dia de outra pessoa, ver §8.1); carteira com saldos
por situação; extrato; cadastro de conta de recebimento com KYC via parceiro; solicitação, revisão e pagamento de
resgates por PIX; Fundo de Criadores mensal com taxa de conversão variável; antifraude; telas de administração;
notificações; auditoria; i18n pt-BR/en/es.

**Fora (nesta versão):** compra de FAI Points com dinheiro (continua proibida — RF35.CA08); transferência de FLAIR Coins
ou de moeda premium; resgate para menores de 18 anos; doações entre contas de **Marca**; saque em criptoativos;
saque para conta de terceiros; pagamento em outros países antes da F3.

## 4. Glossário

| Termo | Definição |
|---|---|
| **FAI Points (pts)** | Pontos ganhos pelo uso (RF30/RF41). Nunca são vendidos. |
| **Moeda premium** | Moeda paga (se existir no plano de negócio), separada dos pontos. **Nunca** vira ponto nem dinheiro e **nunca** é transferível. |
| **Bucket** | "Bolso" do saldo no ledger: `EARNED_STANDARD` (ganho não sacável), `EARNED_CASHABLE` (ganho sacável), `DONATION_RECEIVED` (recebido em doação). |
| **Regra sacável (`cashable`)** | Flag por `action_code` em `fai_points_rules`: o crédito daquela regra cai em `EARNED_CASHABLE`. |
| **Em maturação** | Crédito ainda não disponível (`mature_at` no futuro). Pode ser estornado por fraude sem afetar o saldo disponível. |
| **Disponível** | Crédito maturado; pode ser gasto na loja, doado ou (se sacável) resgatado. |
| **Reservado** | Pontos travados por um pedido de resgate ainda não liquidado. |
| **Doação / transferência P2P** | Movimento de pontos de um usuário a outro, gravado como **duas linhas** do ledger com o mesmo `transfer_id`. |
| **Resgate (payout)** | Conversão de pontos sacáveis em moeda local, paga pelo parceiro de pagamento. |
| **Fundo de Criadores** | Valor mensal = % fixo da receita líquida (assinaturas + microtransações) reservado para resgates. |
| **Taxa de conversão do mês** | R$ por ponto, = fundo ÷ pontos elegíveis solicitados, limitada por piso e teto (§7). |
| **KYC** | *Know Your Customer*: verificação de identidade (nome, CPF, data de nascimento, prova de vida) feita pelo parceiro. |
| **PSP / parceiro licenciado** | Instituição de pagamento ou banco autorizado pelo Banco Central que executa o PIX e guarda o dinheiro. O FashionAI nunca guarda dinheiro de cliente. |
| **Par** | Combinação ordenada doador → recebedor. |

## 5. Situação atual (código, 2026-10-04)

| Ponto | Onde | Implicação para o RF48 |
|---|---|---|
| Pontos nunca vendidos | `01-especificacao-meu-quarto.md` §5.1 e RF35.CA08; `FaiPointsService.account()` devolve `faiPoints.fai_points_nao_sao_vendidos` | Mantido. O RF48 **acrescenta** um caminho de saída (resgate) e não cria caminho de entrada pago. O texto da nota muda para "FAI Points não são vendidos; podem ser resgatados conforme o Programa de Criadores". |
| Tabelas | `V5__meu_guarda_roupa.sql`: `fai_points_rules(action_code PK, points, daily_cap, weekly_cap, once_per_ref, active, description)`, `fai_points_ledger(id, user_id, delta, action_code, ref_type, ref_id VARCHAR(120), idempotency_key VARCHAR(240) UNIQUE, counts_lifetime, created_at)` (ampliações em `V7`) | Não há coluna de saldo: saldo = `SUM(delta)` (`FaiPointsLedgerEntryRepository.balance`). Append-only só por convenção. O RF48 mantém esse modelo e acrescenta colunas (§9). |
| Concessão | `FaiPointsService.award()` — conta e insere **sem trava** (os tetos diários podem ser furados por duas chamadas simultâneas) | Para pontos sacáveis isso vira dinheiro: o RF48 exige trava (§9.4). |
| Débito | `FaiPointsService.buy()` — trava a linha do usuário (`lockOwner`, `PESSIMISTIC_WRITE`) e depois o item | Padrão reaproveitado para doações e resgates; em doação, travar **os dois usuários em ordem de id**. |
| Gasto | Só a loja do quarto (`SHOP_PURCHASE`, `counts_lifetime = false`) | Doação enviada e resgate também são débitos sem efeito no vitalício. |
| Antiabuso existente | tetos, idempotência, autointeração excluída (`WardrobeEventListeners.onInteraction`), bloqueio (`Guard.blocked`), `Guard.requireCanCreate` (e-mail verificado, conta não suspensa) — **não usado** por `award()` | Faltam idade de conta, velocidade/anomalia, denúncias, KYC, ajustes e estornos de admin. Tudo isso entra no RF48 (§11). |
| Look do dia | `DailyLook` (`daily_looks`, único por usuário+data, `source` MANUAL/AUTOPILOTO/COPILOT/VISTA_ME/SMART_MIRROR), sempre um `Scheme`. Endpoints só em `/api/me/...` | A aba `daily` (`components/lookbook-tabs.tsx`, `DailyTab`) só aparece no **próprio** perfil (`ov.self`). Outras pessoas veem looks do dia pela Passarela 3D (`ShowcaseService.runway`, `GET /api/explorer/runway`, `components/showcase/runway-panel.tsx`), que leva a `/schemes/{id}`. É preciso expor o look do dia de terceiros (§8.1). |
| Usuário | `country CHAR(2)`, `birthDate` cifrado e opcional (13+ só no cadastro), `phone` cifrado, `emailVerified`, `twoFactorEnabled`, `status`, `profileType` PESSOAL/MARCA/CELEBRIDADE | **Não há** CPF, KYC, PIX, dados de pagamento ou fiscais. Vão para tabelas próprias (`payout_accounts`), nunca para `users`. |
| Notificações | `NotificationService.notify(...)`, `NotificationType` (SECURITY/SOCIAL/ACHIEVEMENT/SYSTEM) | Novos tipos em §12.3. |
| Auditoria | `Audit.log` + `AuditActions`; gravação em `REQUIRES_NEW` | Novas ações em §12.4. |
| Admin | `AdminController` `/api/admin` (usuários, moderação, auditoria); telas em `app/(site)/(app)/admin/{dashboard,moderation,system,users}` | Não há ferramentas de pontos. Novas telas em §12.2. |

## 6. Regras de negócio

### 6.1 Princípios da economia

- **RN48.01 — Pontos só se ganham.** Não existe compra de FAI Points, nem conversão de moeda premium, FLAIR Coins,
  cupons ou dinheiro em pontos. Itens pagos usam preço em BRL ou moeda premium própria, que nunca vira ponto nem
  dinheiro e nunca é transferível.
- **RN48.02 — Lastro.** Todo real pago em resgate sai do **Fundo de Criadores** do mês. A taxa de conversão é calculada
  depois de conhecer o fundo, de modo que o passivo em dinheiro nunca passa do fundo (§7).
- **RN48.03 — Nada de custódia.** O FashionAI **não guarda dinheiro de usuário** e não oferece "saldo em reais". O
  dinheiro só existe no momento do pagamento, executado pelo parceiro licenciado, do caixa da empresa para a conta PIX do
  titular. ⚖️
- **RN48.04 — Pontos não são moeda.** O Termo do Programa diz que pontos não têm valor monetário fixo, não rendem juros,
  não são propriedade do usuário fora do app, expiram conforme a regra e podem ser estornados em caso de fraude. ⚖️

### 6.2 Buckets, maturação e sacabilidade

- **RN48.05 — Bucket por crédito.** Crédito de regra com `cashable = true` cai em `EARNED_CASHABLE`; demais regras em
  `EARNED_STANDARD`; doação recebida em `DONATION_RECEIVED`.
- **RN48.06 — Maturação.** Créditos `EARNED_CASHABLE` amadurecem em **30 dias**; `DONATION_RECEIVED` em **14 dias**
  (configurável 7–14); `EARNED_STANDARD` ficam disponíveis na hora (comportamento atual, a loja continua igual).
- **RN48.07 — Estorno antes da maturação.** Fraude confirmada gera uma linha de estorno (`delta` negativo,
  `reverses_entry_id`) no mesmo bucket. Nunca se apaga nem se edita uma linha.
- **RN48.08 — Ordem de débito.**
  - Compra na loja: `EARNED_STANDARD` → `DONATION_RECEIVED` → `EARNED_CASHABLE` (preserva o que vale dinheiro).
  - Doação enviada: `EARNED_STANDARD` → `EARNED_CASHABLE`. **Pontos recebidos em doação não podem ser doados de novo**
    (corta cadeias de repasse e "lavagem" entre contas).
  - Resgate: `EARNED_CASHABLE` e, se a decisão D5 permitir, `DONATION_RECEIVED` limitado a 30% do pedido.
  - Um débito que cruza buckets grava **uma linha por bucket**, todas com o mesmo `operation_id`.
- **RN48.09 — Doação de pontos sacáveis.** Quando o doador usa `EARNED_CASHABLE`, o recebedor recebe em
  `DONATION_RECEIVED` (nunca em `EARNED_CASHABLE`). Assim, o pedágio de 14 dias e os limites de doação valem sempre.
- **RN48.10 — Vitalício e níveis.** Doação recebida **não conta** para pontos vitalícios (`counts_lifetime = false`):
  nível não se compra com contas-satélite. Doação enviada e resgate não reduzem o vitalício (como a compra hoje).
- **RN48.11 — Rankings.** Doações não entram no Inventory Score, na Passarela 3D, em Destaques nem em rankings. Na
  Passarela, o contador público mostra no máximo "apoiado por N pessoas" (pessoas distintas, não pontos).
- **RN48.12 — Expiração.** Pontos `DONATION_RECEIVED` não usados em 12 meses expiram (linha `EXPIRY`). Pontos ganhos não
  expiram enquanto a conta estiver ativa (decisão D9).

### 6.3 Doação P2P ("Apoiar com FAI Points")

- **RN48.13 — Elegibilidade do doador:** conta `ACTIVE`, e-mail verificado, idade de conta ≥ **30 dias**, maior de 18 anos
  com data de nascimento informada (F1) e, na F2, idade confirmada pelo KYC ou por verificação de idade confiável; perfil
  `PESSOAL` ou `CELEBRIDADE` (decisão D7); carteira não congelada; sem bloqueio entre as partes.
- **RN48.14 — Elegibilidade do recebedor:** conta `ACTIVE`, maior de 18 anos, perfil `PESSOAL` ou `CELEBRIDADE`, não
  optou por "não receber apoios" (configuração em Preferências, ligada por padrão), carteira não congelada, look do dia
  visível para o doador (visibilidade do esquema + não bloqueado + perfil não privado sem follow aceito).
- **RN48.15 — Proibições:** doar para si; doar entre contas bloqueadas (qualquer direção); doar para contas de Marca;
  doar a menor de 18 anos ou a partir de conta de menor; condicionar doação a resultado de jogo ou desafio.
- **RN48.16 — Valores:** atalhos **5, 10, 25, 50** pts e valor livre entre 5 e o limite do dia; inteiros; máximo
  **20% do saldo disponível** do doador por doação.
- **RN48.17 — Limites (valores iniciais, configuráveis):**

  | Limite | Valor |
  |---|---|
  | Doador por dia | 200 pts e 10 doações |
  | Doador por mês | 1.500 pts |
  | Recebedor por dia (somando todos os doadores) | 500 pts |
  | Recebedor por mês | 5.000 pts |
  | Mesmo par (doador → recebedor) | 1 doação por look e no máximo 1 a cada 24 h; até 300 pts/mês |
  | 2FA obrigatório | doação ≥ 100 pts ou soma do dia ≥ 200 pts |

- **RN48.18 — Mensagem fechada.** Mensagem opcional de uma lista fixa e traduzida (sem texto livre): "Amei o look!",
  "Que combinação!", "Inspirador", "Cores perfeitas", "Quero copiar", "Arrasou". Texto livre abriria canal de assédio e
  contato fora do app.
- **RN48.19 — Confirmação.** Folha de confirmação com destinatário, valor, saldo depois da doação, aviso "doação é
  definitiva" e botão de confirmar. A chamada leva `Idempotency-Key`; repetir a chamada devolve o mesmo recibo.
- **RN48.20 — Definitiva.** Doação não pode ser desfeita pelo doador. Só o admin (ou o motor de risco) estorna, em caso
  de fraude, dentro da maturação. Se o recebedor já gastou, o estorno pode deixar o bucket `DONATION_RECEIVED` negativo,
  e a dívida é abatida de créditos futuros.
- **RN48.21 — Não gera pontos.** Doar ou receber doação **não** pontua nenhuma regra (sem "ganhe 1 pt por apoiar"),
  para não criar circuito de doações recíprocas.
- **RN48.22 — Visibilidade.** O doador vê a doação no extrato; o recebedor recebe notificação `POINTS_RECEIVED` com
  nome do doador (ou "alguém" se o doador escolheu doar anonimamente — o admin sempre vê). Valores individuais não são
  públicos.

### 6.4 Resgate em dinheiro

- **RN48.23 — Elegibilidade:** maior de 18 anos; país `BR` (F2); conta de recebimento com KYC `APPROVED` no parceiro;
  2FA ativo; idade de conta ≥ 60 dias; sem flag de risco aberta de severidade alta; e-mail verificado; aceite do Termo
  do Programa de Criadores (versão registrada).
- **RN48.24 — Titularidade.** A chave PIX deve pertencer ao **mesmo CPF** do titular verificado (o parceiro confirma
  pelo DICT/consulta de chave). Não há saque para terceiros. Troca de chave PIX bloqueia resgates por **72 h** e exige 2FA.
- **RN48.25 — Valores:** mínimo equivalente a **R$ 20,00** pela taxa estimada; máximo **1 pedido por mês** na F2 e teto
  de **R$ 500,00/mês** por CPF no piloto (subindo nas fases seguintes). Um CPF = uma conta de recebimento.
- **RN48.26 — Janela mensal.** Pedidos entre o dia 1 e o último dia do mês **M** entram no fechamento do mês M. Ao
  pedir, os pontos saem de "disponível" e vão para "reservado" (linha `PAYOUT_RESERVE`). O fechamento acontece até o dia
  5 de M+1; o pagamento até o dia 15 de M+1.
- **RN48.27 — Taxa.** O valor em reais só é conhecido no fechamento. A tela mostra uma **estimativa** (taxa do mês
  anterior), com o aviso "o valor final depende do Fundo de Criadores do mês". ⚖️ (CDC — informação clara)
- **RN48.28 — Rateio quando falta fundo.** Se a taxa calculada ficar abaixo do piso, paga-se pelo piso até esgotar o
  fundo em ordem de chegada; os pedidos não atendidos voltam para "disponível" (estorno da reserva) com aviso, e podem
  ser repetidos no mês seguinte.
- **RN48.29 — Revisão.** Todo pedido passa por `UNDER_REVIEW` automático (regras de risco). Pedido acima de R$ 200,00,
  de conta com menos de 90 dias ou com sinal de risco vai para revisão manual.
- **RN48.30 — Tributos e informes.** O FashionAI retém e recolhe o que a legislação exigir pela natureza do pagamento
  (§13.4) e emite informe de rendimentos anual. O valor líquido aparece no recibo. ⚖️
- **RN48.31 — Falha e devolução.** Se o PIX falhar (chave inválida, conta encerrada), o pedido vai para `FAILED` e os
  pontos voltam para "disponível" após 24 h, salvo suspeita de fraude.
- **RN48.32 — Estorno pós-pagamento.** Fraude descoberta depois do pagamento: pedido `REVERSED`, carteira congelada, a
  dívida é registrada e cobrada por compensação de créditos futuros ou pelas vias legais. Não há "chargeback" de PIX
  pelo app (o MED do PIX é do parceiro).

### 6.5 Fontes de pontos e sacabilidade (regras de uso do app)

O fundador pediu que o resgate siga as regras de uso de cada área. A tabela resume a política; o detalhe por regra está
no RF41 v2.

| Área | Exemplos de regra | Sacável? | Por quê |
|---|---|---|---|
| Criação de peças (RF4/RF47) | `CATALOG_PIONEER`, `CATALOG_CORRECTION_ACCEPTED`, `PIECE_FIRST_WORN`, `PIECE_VERSATILE` | **Sim**, após curadoria ou uso real | Melhora o catálogo e o uso real do guarda-roupa |
| Criação de peças (volume) | `PIECE_CATALOGED`, `PIECE_COMPLETED`, `PIECE_3D` | Não | Volume bruto é fácil de inflar; 3D custa dinheiro à empresa |
| Criação de looks (RF5/RF42) | `LOOK_QUALITY`, `FORGOTTEN_RESCUED`, `LOOK_WORN_LOVED`, `REMIX_RECEIVED` | **Sim** | Qualidade medida e validação por terceiros |
| Looks (volume) e social leve | `SCHEME_CREATED` (base), `LIKE_RECEIVED`, `COMMENT_RECEIVED` | Não | Curtida e comentário são fáceis de fabricar |
| FLAIR (RF37) | `GAME_PLAYED`, `GAME_WON`, `FLAIR_QUEST` | **Não** | Há aleatoriedade de cartas: sacar dinheiro de resultado com sorte aproxima de sorteio/aposta (§13.2–13.3) |
| Desafios (RF32) | `CHALLENGE_COMPLETED` | **Sim**, só sem inscrição paga e com julgamento por mérito (votação ou critério objetivo) | Concurso de habilidade, sem custo de entrada |
| Provador (RF18) | `TRYON_SAVED_TO_LOOK` | Não | Ação de consumo |
| Espelho / Vista-me (RF28) | `VISTA_ME_DAILY_LOOK` | Não | Engajamento; o look criado já pontua pela criação |
| Loja virtual / Meu Quarto (RF27, RF30, RF44) | `ROOM_ORGANIZED`, compras | Não | A loja é **ralo** de pontos; vendas de itens por marcas não geram pontos ao vendedor |
| Conquistas (RF29) | `ACHIEVEMENT` | Não | Bônus únicos, previsíveis |
| Doações recebidas (RF48) | bucket `DONATION_RECEIVED` | Parcial (D5) | Limitado e com maturação maior |

## 7. Fundo de Criadores e taxa de conversão

### 7.1 Fórmula

```
fundo_M          = receita_líquida_M × pct_fundo                     (assinaturas + microtransações, já sem impostos, taxas de loja e estornos)
pontos_pedidos_M = Σ pontos de pedidos aprovados no mês M
taxa_bruta       = fundo_M ÷ pontos_pedidos_M
taxa_M           = clamp(taxa_bruta, piso, teto)
pago_M           = min(fundo_M, pontos_pedidos_M × taxa_M)
sobra_M          = fundo_M − pago_M                                  (vai para a reserva do fundo, soma no mês seguinte)
```

- Se `taxa_bruta > teto`: paga-se pelo teto e a sobra fica na **reserva** (amortece meses fracos).
- Se `taxa_bruta < piso`: paga-se pelo piso, por ordem de chegada, até `fundo_M + reserva_utilizável`; os pedidos que
  não couberem voltam para "disponível" (RN48.28). O passivo nunca ultrapassa o fundo.
- A taxa é publicada no fechamento (tela "Carteira" e histórico de taxas), com fundo, pontos pedidos e taxa aplicada.

### 7.2 Exemplo resolvido (valores ilustrativos)

| Item | Valor |
|---|---|
| Receita líquida de outubro | R$ 200.000,00 |
| `pct_fundo` | 10% → **fundo = R$ 20.000,00** |
| Reserva acumulada | R$ 3.000,00 |
| Piso / teto | R$ 0,002 / R$ 0,010 por ponto (R$ 2 a R$ 10 por mil pontos) |
| Pontos solicitados e aprovados | 4.000.000 pts |
| Taxa bruta | 20.000 ÷ 4.000.000 = **R$ 0,005/pt** (entre piso e teto → aplicada) |
| Total pago | 4.000.000 × 0,005 = R$ 20.000,00; reserva continua R$ 3.000,00 |
| Usuária com 6.000 pts pedidos | 6.000 × 0,005 = **R$ 30,00** brutos (menos retenções, se houver) |

**Mês fraco:** fundo R$ 6.000 e 4.000.000 pts pedidos → taxa bruta R$ 0,0015 < piso. Paga-se a R$ 0,002 até
R$ 6.000 + R$ 3.000 de reserva = R$ 9.000 → 4.500.000 pts cabem, então todos (4.000.000 pts = R$ 8.000) são pagos e a
reserva cai para R$ 1.000. Se a reserva não bastasse, os últimos pedidos voltariam para o saldo.

**Mês forte:** fundo R$ 50.000 e 4.000.000 pts → taxa bruta R$ 0,0125 > teto. Paga-se R$ 0,010 → R$ 40.000; R$ 10.000
vão para a reserva.

### 7.3 Por que taxa variável

Uma taxa fixa (ex.: 1.000 pts = R$ 10) cria um passivo que cresce com o engajamento, não com a receita, e premia fraude
em escala. A taxa variável alinha o pagamento à receita, reduz o retorno de contas falsas e torna o programa
sustentável. O piso dá previsibilidade mínima; o teto evita que poucos meses ótimos criem expectativas impossíveis.

## 8. Fluxos

### 8.1 Ver o look do dia de outra pessoa (pré-requisito da doação)

Hoje a aba `daily` é só do dono. Proposta (as duas entradas convivem):

1. **Novo endpoint** `GET /api/users/{id}/daily-look?date=YYYY-MM-DD` (padrão hoje, no fuso `America/Sao_Paulo`):
   devolve o look do dia **se** o esquema for visível ao solicitante (mesmas regras de `/api/profiles/{id}`), o dono não
   saiu da Passarela/optou por privacidade e não há bloqueio. Resposta: `{ date, dailyLookId, source, scheme: SchemeView,
   supporters: { count }, canSupport, supportBlockReason? }`. Sem dados de feedback privado (ADOREI etc.) nem Hype Score.
2. **Aba `daily` pública** em `LookbookTabs` quando `!ov.self`: mostra o look do dia de hoje e dos últimos 7 dias
   públicos, com o botão "Apoiar com FAI Points".
3. **Passarela 3D** (`runway-panel.tsx`) e **página do esquema** (`/schemes/{id}`) mostram o mesmo botão quando o esquema
   é o look do dia de alguém em data recente (até 7 dias) — o contexto da doação é sempre um `DailyLook`.

### 8.2 Doação (F1)

1. Usuária A abre o look do dia de B e toca **Apoiar com FAI Points**.
2. O app chama `GET /api/points/transfers/quote?receiverId=B&contextId={dailyLookId}`: devolve limites restantes,
   saldo doável (só `EARNED_STANDARD` + `EARNED_CASHABLE` disponíveis), se exige 2FA e motivo de bloqueio, se houver.
3. A escolhe 5/10/25/50 ou valor livre, opcionalmente uma mensagem da lista e "doar anonimamente".
4. Folha de confirmação (RN48.19); se exigir 2FA, pede o código.
5. `POST /api/points/transfers` com `Idempotency-Key`. No servidor, em **uma transação**:
   1. trava `users` de A e B em ordem crescente de id (`SELECT … FOR UPDATE`) — evita deadlock entre A→B e B→A;
   2. revalida elegibilidade, bloqueio, limites (contando em `points_transfers` sob a trava), saldo por bucket;
   3. roda o motor de risco síncrono (regras baratas: idade de conta, velocidade, par recíproco, dispositivo comum);
      `BLOCK` → 409; `REVIEW` → a doação é gravada, mas a maturação só corre depois da revisão;
   4. insere `points_transfers` (status `COMPLETED` ou `HELD`) e as linhas do ledger: débito(s) de A nos buckets
      (RN48.08) e crédito de B em `DONATION_RECEIVED` com `mature_at = now + 14 d`, todas com o mesmo `transfer_id`;
   5. grava auditoria `PONTOS_DOACAO_ENVIADA`.
6. Depois do commit: notificação `POINTS_RECEIVED` para B; recibo para A (tela + extrato).

### 8.3 Resgate (F2)

1. Usuária abre **Pontos → Carteira → Resgatar**. Se não tem conta de recebimento, inicia o KYC: aceita o Termo do
   Programa, informa CPF e chave PIX; o app cria a conta no parceiro e abre o fluxo de verificação dele (documento +
   selfie/prova de vida). O parceiro avisa por webhook: `APPROVED`/`REJECTED`.
2. Com KYC aprovado, escolhe a quantidade (mín. equivalente a R$ 20). Confirma com 2FA.
3. `POST /api/me/payout-requests`: trava o usuário, verifica saldo sacável maturado, grava `payout_requests`
   (`REQUESTED`) e a linha `PAYOUT_RESERVE` (débito do bucket).
4. Motor de risco → `UNDER_REVIEW` (automático ou fila manual).
5. Fechamento mensal (job `CreatorFundCloseJob`, admin confirma): calcula a taxa (§7), muda pedidos para `APPROVED`
   com `amount_brl` e retenções, ou devolve os que não couberem.
6. Job de pagamento envia ao parceiro (`PayoutPort.pay`, idempotente por `payout_request.id`); webhook do parceiro →
   `PAID` (com id end-to-end do PIX) ou `FAILED`.
7. Notificações a cada mudança de estado; recibo e informe de rendimentos.

Máquina de estados do pedido (ver `RF48-maquinadeestados-resgate.puml`):

```
REQUESTED → UNDER_REVIEW → APPROVED → PROCESSING → PAID → (REVERSED)
     │            │            │           └→ FAILED (pontos voltam)
     │            └→ REJECTED (pontos voltam, salvo fraude: confiscados por estorno)
     └→ CANCELLED (pelo usuário, só antes do fechamento)
UNDER_REVIEW → DEFERRED (não coube no fundo; pontos voltam)
```

## 9. Modelo de dados (proposta de migração `V33__fai_points_resgate_doacoes.sql`)

> A última migração do repositório é a V32. Os nomes seguem o padrão das tabelas de V5 (sem superclasse JPA para
> ledgers; `CHAR(36)` para UUID; `DATETIME(6)`).

```sql
-- 1) Regras: sacabilidade e maturação por regra
ALTER TABLE fai_points_rules
  ADD COLUMN cashable BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN maturation_days INT NOT NULL DEFAULT 0;

-- 2) Ledger: bucket, maturação, contraparte, vínculos (continua append-only)
ALTER TABLE fai_points_ledger
  ADD COLUMN bucket VARCHAR(20) NOT NULL DEFAULT 'EARNED_STANDARD',   -- EARNED_STANDARD | EARNED_CASHABLE | DONATION_RECEIVED
  ADD COLUMN mature_at DATETIME(6) NULL,                               -- NULL = disponível na hora
  ADD COLUMN counterparty_user_id CHAR(36) NULL,
  ADD COLUMN transfer_id CHAR(36) NULL,
  ADD COLUMN payout_request_id CHAR(36) NULL,
  ADD COLUMN operation_id CHAR(36) NULL,                               -- agrupa as linhas de um débito que cruza buckets
  ADD COLUMN reverses_entry_id CHAR(36) NULL;                          -- estorno aponta a linha original
CREATE INDEX idx_points_bucket ON fai_points_ledger(user_id, bucket, mature_at);
CREATE INDEX idx_points_transfer ON fai_points_ledger(transfer_id);
CREATE INDEX idx_points_payout ON fai_points_ledger(payout_request_id);

-- 3) Doações P2P
CREATE TABLE points_transfers (
  id CHAR(36) PRIMARY KEY,
  sender_user_id CHAR(36) NOT NULL,
  receiver_user_id CHAR(36) NOT NULL,
  amount INT NOT NULL CHECK (amount > 0),
  context_type VARCHAR(20) NOT NULL,           -- DAILY_LOOK (F1) | TRYON | MIRROR | ROOM | FLAIR (F4)
  context_id CHAR(36) NOT NULL,                -- daily_looks.id etc.
  message_code VARCHAR(30) NULL,               -- lista fechada (RN48.18)
  anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(12) NOT NULL,                 -- COMPLETED | HELD | REVERSED
  risk_score INT NULL,
  idempotency_key VARCHAR(120) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  reversed_at DATETIME(6) NULL,
  reversed_by CHAR(36) NULL,
  reversal_reason VARCHAR(200) NULL,
  CONSTRAINT fk_pt_sender FOREIGN KEY (sender_user_id) REFERENCES users(id),
  CONSTRAINT fk_pt_receiver FOREIGN KEY (receiver_user_id) REFERENCES users(id),
  CONSTRAINT uq_pt_idem UNIQUE (sender_user_id, idempotency_key),
  CONSTRAINT uq_pt_once_per_context UNIQUE (sender_user_id, context_type, context_id),
  CONSTRAINT ck_pt_not_self CHECK (sender_user_id <> receiver_user_id)
);
CREATE INDEX idx_pt_sender ON points_transfers(sender_user_id, created_at);
CREATE INDEX idx_pt_receiver ON points_transfers(receiver_user_id, created_at);
CREATE INDEX idx_pt_pair ON points_transfers(sender_user_id, receiver_user_id, created_at);

-- 4) Conta de recebimento (KYC no parceiro). Nada disso vai para `users`.
CREATE TABLE payout_accounts (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL UNIQUE,
  country CHAR(2) NOT NULL,
  provider VARCHAR(30) NOT NULL,               -- ex.: ASAAS, MERCADO_PAGO, PAGARME, STRIPE
  provider_account_ref VARCHAR(120) NULL,
  kyc_status VARCHAR(16) NOT NULL,             -- NOT_STARTED | PENDING | APPROVED | REJECTED | EXPIRED
  kyc_checked_at DATETIME(6) NULL,
  legal_name_enc VARCHAR(512) NULL,            -- AES-GCM (AesGcmStringConverter)
  cpf_enc VARCHAR(256) NULL,                   -- AES-GCM
  cpf_hash CHAR(64) NULL UNIQUE,               -- HMAC-SHA256 com pepper: 1 CPF = 1 conta, sem expor o CPF
  birth_date_enc VARCHAR(256) NULL,
  pix_key_type VARCHAR(10) NULL,               -- CPF | EMAIL | PHONE | EVP
  pix_key_enc VARCHAR(512) NULL,
  pix_key_hash CHAR(64) NULL,
  pix_key_changed_at DATETIME(6) NULL,
  terms_version VARCHAR(20) NULL,
  terms_accepted_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_pa_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 5) Pedidos de resgate
CREATE TABLE payout_requests (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  payout_account_id CHAR(36) NOT NULL,
  period_month CHAR(7) NOT NULL,               -- 'YYYY-MM'
  points INT NOT NULL CHECK (points > 0),
  points_from_donations INT NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'BRL',
  rate DECIMAL(12,6) NULL,                     -- moeda por ponto, fixada no fechamento
  amount_gross DECIMAL(12,2) NULL,
  tax_withheld DECIMAL(12,2) NULL,
  fee DECIMAL(12,2) NULL,
  amount_net DECIMAL(12,2) NULL,
  status VARCHAR(14) NOT NULL,                 -- REQUESTED | UNDER_REVIEW | APPROVED | PROCESSING | PAID | REJECTED | DEFERRED | FAILED | CANCELLED | REVERSED
  review_mode VARCHAR(8) NULL,                 -- AUTO | MANUAL
  reviewed_by CHAR(36) NULL,
  reject_reason VARCHAR(200) NULL,
  provider_payout_ref VARCHAR(120) NULL,       -- id do parceiro / end-to-end PIX
  idempotency_key VARCHAR(120) NOT NULL,
  requested_at DATETIME(6) NOT NULL,
  paid_at DATETIME(6) NULL,
  updated_at DATETIME(6) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT fk_pr_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_pr_account FOREIGN KEY (payout_account_id) REFERENCES payout_accounts(id),
  CONSTRAINT uq_pr_idem UNIQUE (user_id, idempotency_key)
);
CREATE INDEX idx_pr_status ON payout_requests(status, period_month);
CREATE INDEX idx_pr_user ON payout_requests(user_id, requested_at);

-- 6) Fundo de Criadores por mês e país
CREATE TABLE creator_fund_periods (
  id CHAR(36) PRIMARY KEY,
  period_month CHAR(7) NOT NULL,
  country CHAR(2) NOT NULL,
  currency CHAR(3) NOT NULL,
  net_revenue DECIMAL(14,2) NOT NULL,
  fund_pct DECIMAL(5,2) NOT NULL,
  fund_amount DECIMAL(14,2) NOT NULL,
  reserve_in DECIMAL(14,2) NOT NULL DEFAULT 0,
  points_requested BIGINT NULL,
  rate_raw DECIMAL(12,6) NULL,
  rate_floor DECIMAL(12,6) NOT NULL,
  rate_ceiling DECIMAL(12,6) NOT NULL,
  rate_applied DECIMAL(12,6) NULL,
  amount_paid DECIMAL(14,2) NULL,
  reserve_out DECIMAL(14,2) NULL,
  status VARCHAR(10) NOT NULL,                 -- OPEN | CLOSING | CLOSED
  closed_by CHAR(36) NULL,
  closed_at DATETIME(6) NULL,
  CONSTRAINT uq_cfp UNIQUE (period_month, country)
);

-- 7) Sinais de risco e congelamento
CREATE TABLE risk_flags (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  related_user_id CHAR(36) NULL,
  kind VARCHAR(30) NOT NULL,                   -- RECIPROCAL_DONATIONS | DONATION_RING | PAIR_CONCENTRATION | SHARED_DEVICE | SHARED_IP | VELOCITY | NEW_ACCOUNT_BURST | LIKE_FARM | PIX_KEY_REUSED | KYC_MISMATCH | REPORT
  severity VARCHAR(6) NOT NULL,                -- LOW | MEDIUM | HIGH
  score INT NOT NULL,
  evidence_json JSON NULL,
  status VARCHAR(10) NOT NULL,                 -- OPEN | CONFIRMED | DISMISSED
  created_at DATETIME(6) NOT NULL,
  resolved_by CHAR(36) NULL,
  resolved_at DATETIME(6) NULL,
  CONSTRAINT fk_rf_user FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_rf_open ON risk_flags(status, severity, created_at);

CREATE TABLE points_wallet_status (
  user_id CHAR(36) PRIMARY KEY,
  frozen BOOLEAN NOT NULL DEFAULT FALSE,
  frozen_reason VARCHAR(200) NULL,
  frozen_by CHAR(36) NULL,
  frozen_at DATETIME(6) NULL,
  receive_support BOOLEAN NOT NULL DEFAULT TRUE,   -- RN48.14: "receber apoios"
  CONSTRAINT fk_pws_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 8) Regras sacáveis (resumo; a lista completa está no RF41 v2)
UPDATE fai_points_rules SET cashable = TRUE, maturation_days = 30
 WHERE action_code IN ('FORGOTTEN_RESCUED','REMIX_RECEIVED','CHALLENGE_COMPLETED');
-- novas ações de débito/sistema (points = 0: valor sempre vem do chamador)
INSERT INTO fai_points_rules (action_code, points, daily_cap, weekly_cap, once_per_ref, description) VALUES
('POINTS_TRANSFER_OUT',0,NULL,NULL,FALSE,'Doação enviada (RF48)'),
('POINTS_TRANSFER_IN',0,NULL,NULL,FALSE,'Doação recebida (RF48)'),
('PAYOUT_RESERVE',0,NULL,NULL,FALSE,'Pontos reservados para resgate (RF48)'),
('PAYOUT_RELEASE',0,NULL,NULL,FALSE,'Reserva de resgate devolvida (RF48)'),
('REVERSAL',0,NULL,NULL,FALSE,'Estorno por fraude (RF48)'),
('ADMIN_ADJUSTMENT',0,NULL,NULL,FALSE,'Ajuste manual auditado (RF48)'),
('EXPIRY',0,NULL,NULL,FALSE,'Expiração de pontos recebidos em doação (RF48)');
```

### 9.1 Saldos derivados

```sql
-- disponível por bucket
SELECT bucket, SUM(delta) FROM fai_points_ledger
 WHERE user_id = :u AND (mature_at IS NULL OR mature_at <= NOW(6)) GROUP BY bucket;
-- em maturação (só créditos futuros)
SELECT bucket, SUM(delta) FROM fai_points_ledger
 WHERE user_id = :u AND mature_at > NOW(6) GROUP BY bucket;
-- reservado
SELECT SUM(-delta) FROM fai_points_ledger l JOIN payout_requests p ON p.id = l.payout_request_id
 WHERE l.user_id = :u AND l.action_code = 'PAYOUT_RESERVE' AND p.status IN ('REQUESTED','UNDER_REVIEW','APPROVED','PROCESSING');
```

O saldo total atual (`balance`) continua igual (soma de tudo) para a loja; a loja passa a usar "disponível" (soma dos
buckets maturados), que para quem só tem `EARNED_STANDARD` dá o mesmo número. `lifetime` não muda.

### 9.2 Partidas dobradas

Cada doação grava ≥ 2 linhas com o mesmo `transfer_id` cuja soma é **zero**: `-N` em A (um ou dois buckets) e `+N` em B
(`DONATION_RECEIVED`). Um teste de integridade diário (`SELECT transfer_id, SUM(delta) … GROUP BY transfer_id HAVING
SUM(delta) <> 0`) deve voltar vazio. Resgate: `-N` em A (`PAYOUT_RESERVE`); se devolvido, `+N` (`PAYOUT_RELEASE`); se
pago, nada mais no ledger — a saída é registrada em `payout_requests`.

### 9.3 Append-only de verdade

Recomenda-se revogar `UPDATE`/`DELETE` em `fai_points_ledger` do usuário da aplicação (grant MySQL) ou, no mínimo,
`BEFORE UPDATE/DELETE` *trigger* que lança erro. Correções = linhas novas (`REVERSAL`, `ADMIN_ADJUSTMENT`).

### 9.4 Concorrência

- `award()` passa a travar a linha do usuário (`lockOwner`) **somente** quando a regra é `cashable` (custo baixo, pois
  essas regras têm teto pequeno) — fecha a corrida conta-depois-insere dos tetos diários.
- Doação: trava os dois usuários em ordem de UUID. Resgate: trava o usuário; fechamento trava a linha de
  `creator_fund_periods` do mês.

### 9.5 Entidades e portas (hexagonal)

- `fai-domain`: `PointsTransfer`, `PayoutAccount`, `PayoutRequest`, `CreatorFundPeriod`, `RiskFlag`,
  `PointsWalletStatus`; enums `PointsBucket`, `TransferStatus`, `TransferContext`, `PayoutStatus`, `KycStatus`,
  `RiskKind`, `RiskSeverity`; repositórios Spring Data.
- `fai-application`: `PointsWalletService` (saldos e extrato), `PointsTransferService` (doação), `PayoutService`
  (KYC, pedido, fechamento, pagamento), `CreatorFundService`, `PointsRiskEngine`; porta `PayoutProviderPort`
  (`createAccount`, `startKyc`, `verifyPixKey`, `pay`, `parseWebhook`).
- `fai-infrastructure`: adaptador do parceiro escolhido (`payout-<parceiro>`), verificação de assinatura de webhook,
  migração V33.
- `fai-web`: `PointsWalletController`, `PointsTransferController`, `PayoutController`, `PayoutWebhookController`,
  `AdminPointsController`.

## 10. API

| Método e rota | Quem | Descrição |
|---|---|---|
| `GET /api/users/{id}/daily-look?date=` | qualquer (anônimo vê só público) | Look do dia de outra pessoa (§8.1), com `canSupport` |
| `GET /api/me/points/wallet` | dono | `{ available: {standard, cashable, donation}, maturing: {...}, reserved, lifetime, level, nextMaturations[], limits, payoutEligibility, estimatedRate }` |
| `GET /api/me/points/statement?bucket=&type=&page=` | dono | Extrato paginado (ganhos, gastos, doações, resgates, estornos) |
| `GET /api/points/transfers/quote?receiverId=&contextType=&contextId=` | logado | Pré-checagem: limites restantes, saldo doável, `requires2fa`, `blockReason` |
| `POST /api/points/transfers` | logado | Corpo `{ receiverId, amount, contextType, contextId, messageCode?, anonymous?, twoFactorCode? }`, cabeçalho `Idempotency-Key`. 201 com recibo `{ transferId, amount, receiver, balanceAfter, createdAt }` |
| `GET /api/me/points/transfers?direction=sent\|received&page=` | dono | Doações enviadas/recebidas |
| `PUT /api/me/points/preferences` | dono | `{ receiveSupport }` |
| `GET /api/me/payout-account` · `POST` · `DELETE` | dono | Status do KYC; iniciar (`{ cpf, pixKeyType, pixKey, termsVersion }` → `{ kycUrl }`); encerrar |
| `PUT /api/me/payout-account/pix-key` | dono + 2FA | Troca de chave (bloqueio de 72 h) |
| `POST /api/me/payout-requests` | dono + 2FA | `{ points }` + `Idempotency-Key` → `REQUESTED` |
| `GET /api/me/payout-requests` · `POST /{id}/cancel` | dono | Histórico; cancelar antes do fechamento |
| `GET /api/points/creator-fund/rates` | público | Histórico de taxas publicadas (transparência) |
| `POST /api/webhooks/payouts/{provider}` | parceiro | KYC e pagamento; assinatura HMAC obrigatória, idempotente por id do evento |
| `GET /api/admin/points/payouts?status=&period=` | ADMIN | Fila de resgates |
| `POST /api/admin/points/payouts/{id}/approve` · `/reject` | ADMIN (4 olhos acima de R$ 200) | Revisão manual |
| `GET /api/admin/points/risk-flags?status=&severity=` · `POST /{id}/confirm` · `/dismiss` | ADMIN | Fila de risco |
| `POST /api/admin/points/users/{id}/freeze` · `/unfreeze` | ADMIN | Congelar carteira (doar, receber, resgatar) |
| `POST /api/admin/points/transfers/{id}/reverse` | ADMIN | Estorno de doação (motivo obrigatório) |
| `POST /api/admin/points/adjustments` | ADMIN (4 olhos) | Ajuste manual `{ userId, delta, bucket, reason }` |
| `GET /api/admin/points/fund-periods` · `POST /{month}/close` | ADMIN financeiro | Informar receita líquida, simular e fechar o mês |
| `GET /api/admin/points/users/{id}/graph` | ADMIN | Grafo de doações do usuário (pares, anéis) |

Erros (padrão `ApiException`): `409 SALDO_INSUFICIENTE`, `409 LIMITE_DOACAO_DIA`, `409 LIMITE_RECEBEDOR`,
`409 COOLDOWN_PAR`, `409 DOACAO_PROPRIA`, `403 BLOQUEADO`, `403 MENOR_DE_IDADE`, `403 CONTA_NOVA`, `403 CARTEIRA_CONGELADA`,
`428 DOIS_FATORES_OBRIGATORIO`, `409 KYC_PENDENTE`, `409 ABAIXO_DO_MINIMO`, `409 JANELA_FECHADA`, `422 CHAVE_PIX_TITULAR`.

## 11. Antifraude

| Ameaça | Controle |
|---|---|
| Contas-satélite doando para a conta principal | Idade ≥ 30 dias para doar; 18+; teto por recebedor; doação recebida não conta no vitalício nem em ranking; KYC por CPF no resgate; `cpf_hash` único; sinais de dispositivo/IP comuns entre doador e recebedor (`SHARED_DEVICE`, `SHARED_IP`) |
| Doações recíprocas (A↔B) e anéis (A→B→C→A) | Recebido não pode ser redoado (RN48.08); job diário procura ciclos de até 4 nós e pares com > 60% das doações recebidas vindas de ≤ 3 doadores (`PAIR_CONCENTRATION`); flag `RECIPROCAL_DONATIONS` quando A→B e B→A em 7 dias |
| Farm de curtidas/comentários | `LIKE_RECEIVED` e `COMMENT_RECEIVED` não sacáveis; teto agregado social (RF41 v2); só contam interações de contas com ≥ 7 dias |
| Corrida nos tetos | Trava em `award()` para regras sacáveis (§9.4) |
| Velocidade anômala | Z-score diário de pontos sacáveis por usuário vs. coorte; > 3σ → `VELOCITY` e maturação suspensa |
| Rajada de contas novas | Muitas contas novas interagindo com o mesmo alvo em 24 h → `NEW_ACCOUNT_BURST` |
| Roubo de conta para drenar pontos | 2FA acima do limiar; troca de chave PIX bloqueia 72 h; notificação de segurança em todo resgate e troca de chave; nova sessão em dispositivo novo bloqueia doações por 24 h |
| Lavagem / fracionamento | Limites mensais por CPF; resgate só para chave do mesmo CPF; relatório de operações atípicas ao responsável de PLD do parceiro (§13.5) |
| Assédio / aliciamento de menores | Doações só entre adultos; sem texto livre; recebedor pode desligar apoios; denúncia de doação (`REPORT`) |
| Erro ou abuso interno | Ajuste e aprovação acima de R$ 200 com dupla aprovação; tudo auditado; ledger sem UPDATE/DELETE |

**Denúncias (novo, mínimo):** botão "Denunciar" no recibo de doação recebida e no perfil; cria `risk_flags(kind =
REPORT)` e entra na fila de moderação existente.

**Pontuação de risco:** soma ponderada dos sinais (0–100). < 40 segue; 40–69 `REVIEW` (doação `HELD`, resgate manual);
≥ 70 `BLOCK` e congelamento preventivo com revisão em até 72 h.

## 12. Telas, notificações, auditoria e i18n

### 12.1 Usuário

- **Look do dia (perfil de outra pessoa / Passarela / esquema):** botão **Apoiar com FAI Points** (ícone de coração
  com moeda); contador "apoiado por N pessoas"; desabilitado com dica quando `canSupport = false`.
- **Folha "Apoiar":** atalhos 5/10/25/50, campo livre, chips de mensagem, opção anônima, resumo e confirmar; passo de
  2FA quando exigido; **recibo** com id, data, valor e saldo.
- **Pontos → nova aba Carteira** (`app/(site)/(app)/points/page.tsx` ganha abas *Visão geral · Carteira · Regras*):
  - cartões "Disponível" (com divisão padrão / sacável / recebido), "Em maturação" (com próximas datas) e "Reservado";
  - botão **Resgatar** (F2) com estimativa em reais e aviso de taxa variável;
  - **Histórico** filtrável (ganhos, compras, doações, resgates, estornos);
  - **Conta de recebimento** (status do KYC, chave PIX mascarada `***.123.456-**`, trocar chave, Termo);
  - **Taxas publicadas** do Fundo de Criadores.
- **Preferências:** "Receber apoios em FAI Points" (liga/desliga).

### 12.2 Administração (`app/(site)/(app)/admin/points/`)

- **Fila de resgates** (status, valor, risco, idade da conta, KYC, ação aprovar/recusar com motivo).
- **Risco** (flags abertas, grafo de doações do usuário, evidências, confirmar/descartar).
- **Usuário** (carteira por bucket, congelar/descongelar, estornar doação, ajuste manual).
- **Fundo de Criadores** (informar receita líquida, simular taxa, fechar mês, exportar relatório contábil CSV).

### 12.3 Notificações (`NotificationType`)

| Tipo | Categoria | Quando |
|---|---|---|
| `POINTS_RECEIVED` | SOCIAL | Doação recebida ("@ana apoiou seu look com 25 FAI Points — Amei o look!") |
| `POINTS_DONATION_REVERSED` | SYSTEM | Doação estornada (para os dois lados) |
| `POINTS_MATURED` | SYSTEM | Resumo semanal: pontos que ficaram disponíveis (opcional) |
| `PAYOUT_STATUS` | SYSTEM | Pedido mudou de estado (aprovado, pago, recusado, devolvido) |
| `KYC_STATUS` | SECURITY | KYC aprovado/recusado; chave PIX alterada |
| `WALLET_FROZEN` | SECURITY | Carteira congelada/descongelada |

### 12.4 Auditoria (`AuditActions`)

`PONTOS_DOACAO_ENVIADA`, `PONTOS_DOACAO_RETIDA`, `PONTOS_DOACAO_ESTORNADA`, `PONTOS_CARTEIRA_CONGELADA`,
`PONTOS_CARTEIRA_DESCONGELADA`, `PONTOS_AJUSTE_ADMIN`, `KYC_INICIADO`, `KYC_APROVADO`, `KYC_RECUSADO`,
`CHAVE_PIX_ALTERADA`, `RESGATE_SOLICITADO`, `RESGATE_CANCELADO`, `RESGATE_APROVADO`, `RESGATE_RECUSADO`,
`RESGATE_ADIADO`, `RESGATE_PAGO`, `RESGATE_FALHOU`, `RESGATE_ESTORNADO`, `FUNDO_CRIADORES_FECHADO`,
`RISCO_SINAL_CONFIRMADO`, `RISCO_SINAL_DESCARTADO`. Nunca gravar CPF, chave PIX ou nome civil em claro no `audit_log`
(usar hash/mascara).

### 12.5 i18n

Chaves novas em `lib/i18n/messages/{pt-BR,en,es}.json` (frontend) e `fai-application/src/main/resources/i18n/messages*.properties`
(backend), por exemplo: `points.wallet.available`, `points.wallet.maturing`, `points.wallet.reserved`,
`points.support.button` ("Apoiar com FAI Points" / "Support with FAI Points" / "Apoyar con FAI Points"),
`points.support.final` ("A doação é definitiva" / "Support is final" / "El apoyo es definitivo"),
`points.support.message.AMEI` …, `points.payout.estimate`, `points.payout.variableRate`, `points.payout.kyc.pending`,
`pointsRule.POINTS_TRANSFER_IN` etc., e a nova nota `faiPoints.fai_points_nao_sao_vendidos` ajustada (§5). Valores em
moeda formatados por `Intl.NumberFormat(locale, { style: "currency", currency })`.

## 13. Conformidade (Brasil) ⚖️

> Tudo nesta seção deve ser **validado com jurídico e contabilidade**. As referências são para orientar a conversa.

### 13.1 Arranjos e instituições de pagamento — Lei 12.865/2013

A lei criou as categorias de arranjo e instituição de pagamento, sob regulação do CMN e do Banco Central, e define
conta de pagamento como conta em nome do usuário usada para transações de pagamento. Se o FashionAI mantivesse "saldo em
reais" do usuário ou movimentasse dinheiro entre usuários, poderia ser enquadrado como instituição de pagamento.
**Desenho adotado:** (a) pontos não são dinheiro nem conta de pagamento; (b) não há transferência de dinheiro entre
usuários — doações são só de pontos; (c) o resgate é um pagamento da empresa ao usuário, executado por **parceiro
autorizado pelo BCB** (consultar a lista oficial antes de contratar); (d) o FashionAI não guarda recursos de terceiros.
Avaliar com jurídico se a doação de pontos que depois podem ser resgatados caracteriza arranjo de pagamento — por isso a
política conservadora da RN48.09 e da decisão D5.

### 13.2 Promoções comerciais e prêmios — Lei 5.768/1971 (SPA/Ministério da Fazenda)

A distribuição gratuita de prêmios a título de propaganda, por sorteio, vale-brinde, concurso ou operação assemelhada,
depende de autorização do Ministério da Fazenda (hoje Secretaria de Prêmios e Apostas), e a lei **não permite a
distribuição ou conversão de prêmios em dinheiro** (regulamentação: Decreto 70.951/1972 e Portaria SEAE/ME 7.638/2022).
Consequências para o RF48:
- O resgate **não** deve ser desenhado nem comunicado como "prêmio" de promoção comercial. O enquadramento proposto é um
  **Programa de Criadores**: remuneração variável pela criação e licença de conteúdo (looks, correções de catálogo,
  dados de uso) que gera receita à plataforma, paga a partir de participação na receita (o Fundo).
- **Nada de sorte no que vira dinheiro:** pontos de FLAIR (cartas aleatórias), sorteios ou recompensas aleatórias ficam
  `cashable = false`. Desafios só são sacáveis quando o resultado depende de mérito (votação, critério objetivo).
- Campanhas com prêmio (ex.: "melhor look da semana ganha vale-compra de marca parceira") seguem rito próprio de
  promoção comercial ou concurso cultural, separado do RF48.

### 13.3 Apostas de quota fixa — Lei 14.790/2023

A lei regula apostas de quota fixa (eventos esportivos reais ou eventos virtuais de jogos on-line, com prêmio definido
por fator multiplicador do valor apostado), sob autorização da SPA. Para nada no FashionAI parecer aposta:
- não há **entrada paga** em jogo ou desafio que renda pontos sacáveis;
- não é possível **apostar pontos** em resultado de partida, duelo, desafio ou votação (nenhum "pote", nenhuma
  multiplicação de valor colocado em risco);
- doações não podem ser condicionadas a resultado;
- FLAIR Coins e moeda premium nunca convertem em pontos ou dinheiro;
- nenhuma caixa de recompensa paga (ver 13.7).

### 13.4 Tributos

Depende do enquadramento definido com contabilidade:
- **Prêmio em dinheiro** (concurso/sorteio): IRRF de 30% exclusivo na fonte (Lei 4.506/1964, art. 14); prêmio em bens e
  serviços: 20% (Lei 8.981/1995, art. 63). Enquadramento **desaconselhado** pelo conflito com 13.2.
- **Remuneração de pessoa física por serviço/licença** (enquadramento proposto): rendimento tributável, com retenção pela
  tabela progressiva quando paga por pessoa jurídica; a partir de 2026 vale a isenção de até R$ 5.000,00/mês da Lei
  15.270/2025 (redutor). Verificar incidência de INSS como contribuinte individual e obrigações acessórias (EFD-Reinf,
  informe de rendimentos anual ao usuário).
- Se o pagamento vier de fonte no exterior ou de pessoa física: carnê-leão pelo próprio usuário.
- O app mostra bruto, retenções e líquido no recibo e disponibiliza o informe anual na Carteira.

### 13.5 Prevenção à lavagem de dinheiro — Lei 9.613/1998

O art. 9º lista as pessoas obrigadas (entre elas quem capta, intermedeia ou aplica recursos de terceiros), que devem
manter cadastro, registros e comunicar operações suspeitas ao COAF. O parceiro de pagamento é pessoa obrigada; o
FashionAI deve: fazer KYC (via parceiro), guardar registros de resgates por pelo menos 5 anos, ter política de PLD/FT
simples (limites, monitoramento, responsável interno), compartilhar alertas com o parceiro e cooperar com pedidos de
autoridade. Avaliar com jurídico se a própria plataforma passa a ser obrigada.

### 13.6 LGPD (Lei 13.709/2018)

- CPF, nome civil, data de nascimento e chave PIX são dados pessoais; documentos e selfie de KYC (biometria) são
  **sensíveis** — devem ficar **no parceiro**, não no FashionAI.
- Bases legais: execução de contrato (Programa de Criadores), cumprimento de obrigação legal/regulatória (tributos, PLD)
  e prevenção à fraude. Não usar consentimento como base para o KYC.
- Minimização: guardar só `cpf_enc` + `cpf_hash`, `pix_key_enc` + `pix_key_hash`, status e referências do parceiro.
  Cifra AES-GCM existente (`AesGcmStringConverter`), hash com HMAC e *pepper* fora do banco.
- Retenção: registros financeiros pelos prazos legais (fiscal/PLD) mesmo após exclusão da conta (RF3 precisa tratar essa
  exceção no fluxo de exclusão e na exportação de dados).
- Atualizar RIPD (relatório de impacto), aviso de privacidade e contrato de operador com o parceiro.

### 13.7 Crianças e adolescentes — ECA Digital (Lei 15.211/2025) e ECA

A Lei 15.211/2025 (em vigor desde 17/03/2026) vale para serviços digitais direcionados a crianças e adolescentes ou de
acesso provável por eles, exige mecanismos confiáveis de verificação de idade, configurações mais protetivas por padrão
e ferramentas para responsáveis, e o art. 20 veda caixas de recompensa (loot boxes) em jogos desse público. O
FashionAI aceita contas a partir de 13 anos, então:
- **doação P2P e resgate somente 18+** na v1 (transferência de valor de adulto para menor é vetor de aliciamento);
- a idade autodeclarada não basta para o resgate: o KYC confirma a data de nascimento; para doação na F1, exigir data de
  nascimento informada ≥ 18 e, assim que houver, verificação de idade confiável;
- contas de 13–17 não veem o botão "Apoiar" nem a aba Carteira de resgate, e não podem receber doações;
- nenhuma mecânica aleatória paga no app.

### 13.8 CDC (Lei 8.078/1990)

Informação clara e prévia: taxa variável e não garantida, prazos, limites, retenções, critérios de recusa e de estorno,
expiração. Termo do Programa versionado, com aviso prévio de mudanças de regra (sugestão: 30 dias) e sem alteração
retroativa de pontos já maturados. Canal de contestação de recusa/estorno com prazo de resposta.

## 14. Critérios de aceite

| ID | Dado que | Quando | Então |
|---|---|---|---|
| RF48.CA01 | A (adulto, conta ≥ 30 dias, e-mail verificado) vê o look do dia público de B (adulto) | toca "Apoiar", escolhe 10 pts e confirma | A perde 10 pts disponíveis, B ganha 10 pts em `DONATION_RECEIVED` em maturação, há um `points_transfers` e duas linhas no ledger com o mesmo `transfer_id` somando zero, B recebe `POINTS_RECEIVED` e A vê o recibo |
| RF48.CA02 | a mesma requisição de doação é enviada duas vezes com a mesma `Idempotency-Key` | o servidor processa | só uma doação é gravada e as duas respostas trazem o mesmo `transferId` |
| RF48.CA03 | A tenta doar para si mesma, para conta bloqueada (qualquer direção), para Marca ou para menor | confirma | 403/409 com o motivo e nada é gravado |
| RF48.CA04 | A já doou 200 pts hoje | tenta doar mais | 409 `LIMITE_DOACAO_DIA`; o mesmo vale para limite mensal, do recebedor, do par e 20% do saldo |
| RF48.CA05 | A já apoiou o look do dia X de B | tenta apoiar X de novo | 409 `COOLDOWN_PAR` |
| RF48.CA06 | doação ≥ 100 pts e A tem 2FA | confirma sem código | 428 `DOIS_FATORES_OBRIGATORIO`; com código válido a doação passa. Sem 2FA ativo, o app orienta a ativar |
| RF48.CA07 | A tem saldo só em `DONATION_RECEIVED` | tenta doar | 409 `SALDO_INSUFICIENTE` com explicação "pontos recebidos não podem ser doados de novo" |
| RF48.CA08 | A e B doam um ao outro ao mesmo tempo | as duas transações correm | ambas terminam sem deadlock (trava em ordem de id) e os saldos ficam corretos |
| RF48.CA09 | B recebeu doações | consulta Inventory Score, Passarela, rankings e nível | nenhum desses valores muda por causa das doações |
| RF48.CA10 | admin confirma fraude numa doação em maturação | estorna | linhas de estorno são gravadas, a doação fica `REVERSED`, as duas partes são notificadas e a auditoria registra quem e por quê |
| RF48.CA11 | usuário menor de 18 | abre o look do dia de alguém ou a Carteira | não vê "Apoiar" nem "Resgatar" |
| RF48.CA12 | usuária 18+ com KYC aprovado, 2FA e 6.000 pts sacáveis maturados | pede resgate de 6.000 pts | o pedido fica `REQUESTED`, 6.000 pts saem de disponível para reservado e a tela mostra a estimativa com aviso de taxa variável |
| RF48.CA13 | pontos sacáveis ainda em maturação | usuária tenta resgatar | só o maturado é oferecido; o restante aparece com a data de liberação |
| RF48.CA14 | chave PIX de outro CPF | usuária cadastra | 422 `CHAVE_PIX_TITULAR` |
| RF48.CA15 | fechamento do mês com fundo R$ 20.000 e 4.000.000 pts pedidos, piso 0,002 e teto 0,010 | admin fecha | taxa aplicada = 0,005, todos os pedidos aprovados recebem `rate`, bruto, retenção e líquido; total pago ≤ fundo + reserva |
| RF48.CA16 | fundo insuficiente mesmo pelo piso | admin fecha | os pedidos que não cabem ficam `DEFERRED`, os pontos voltam para disponível e o usuário é notificado |
| RF48.CA17 | parceiro devolve falha do PIX | webhook chega | pedido `FAILED`, pontos devolvidos depois de 24 h, notificação enviada; webhook repetido não duplica efeito |
| RF48.CA18 | webhook sem assinatura válida | chega ao endpoint | 401 e nada muda |
| RF48.CA19 | usuária troca a chave PIX | tenta resgatar em seguida | bloqueado por 72 h, com notificação de segurança |
| RF48.CA20 | qualquer movimento de pontos | consulta o banco | nenhuma linha do ledger foi alterada ou apagada; a verificação de partidas dobradas volta vazia |
| RF48.CA21 | carteira congelada | usuária tenta doar, receber ou resgatar | 403 `CARTEIRA_CONGELADA`; ganhar pontos por uso continua funcionando (não sacáveis ficam disponíveis, sacáveis ficam em maturação até a revisão) |
| RF48.CA22 | a plataforma | oferece pontos | continua não havendo compra de FAI Points; moeda premium e FLAIR Coins não convertem nem transferem (RF35.CA08 mantido) |
| RF48.CA23 | idioma en ou es | usuário abre Carteira e "Apoiar" | todos os textos, mensagens fechadas e valores em moeda aparecem traduzidos e formatados |

## 15. Métricas

| Métrica | Meta inicial / uso |
|---|---|
| % de looks do dia públicos com ≥ 1 apoio | engajamento social da F1 |
| Doadores únicos / semana e pontos doados / doador | saúde da função |
| Concentração: % das doações recebidas vindas dos 3 maiores doadores de cada recebedor | antifraude (alerta > 60%) |
| Taxa de estorno de doações e de resgates | < 1% |
| Tempo médio de revisão manual | < 48 h |
| Taxa de conversão publicada × piso/teto | sustentabilidade do fundo |
| Fundo pago / receita líquida | = `pct_fundo` (nunca acima) |
| Pontos sacáveis emitidos / mês vs. pontos resgatados | inflação da economia |
| % de KYC aprovados, tempo do KYC | fricção do piloto |
| Retenção D30/D90 de criadores que resgataram vs. que não resgataram | valor do programa |
| Denúncias por 1.000 doações | segurança |

## 16. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Enquadramento regulatório (pagamento, promoção, aposta) | Alto | Parecer jurídico antes da F2; desenho sem custódia, sem sorte, sem entrada paga; piloto pequeno |
| Fraude em escala com contas falsas | Alto | Taxa variável, maturação, KYC, limites, motor de risco, revisão manual |
| Expectativa de "salário" frustrada | Médio | Comunicação honesta: é reconhecimento, não renda; taxa publicada; exemplos realistas |
| Custos do parceiro (KYC por usuário, tarifa de PIX) | Médio | Mínimo de R$ 20, 1 resgate/mês, KYC só quando o usuário pede o primeiro resgate |
| Assédio via doações | Médio | Mensagens fechadas, opção de não receber, denúncia, 18+ |
| Inflação de pontos derrubando a taxa | Médio | Regras sacáveis com qualidade e tetos (RF41 v2); sinks na loja |
| Exclusão de conta x retenção legal | Baixo | Exceção documentada no RF3 |

## 17. Plano de fases

| Fase | Conteúdo | Pré-requisitos | Saída |
|---|---|---|---|
| **F1 — Doações sem saque** | Look do dia de terceiros (§8.1); "Apoiar" com pontos; buckets e maturação no ledger; limites; antifraude básico; admin estorno/congelar; notificações; i18n | V33 parcial (regras `cashable`, ledger, `points_transfers`, `risk_flags`, `points_wallet_status`) | Métricas de uso e de fraude por 60 dias |
| **F2 — KYC + saque piloto BR** | Parceiro licenciado, KYC, PIX para chave do mesmo CPF, Fundo de Criadores, fechamento mensal, limites baixos (R$ 500/mês), convite a ~200 criadores | Parecer jurídico e contábil; contrato com parceiro; Termo do Programa; RIPD | Decisão de abrir para todos no BR |
| **F3 — Outros países e moedas** | `creator_fund_periods` por país, parceiro por região, KYC/tributos locais, câmbio | Análise por país | — |
| **F4 — Doações em outros contextos** | Provador (prova salva/look), Espelho (look do Vista-me publicado), Meu Quarto (visita ao quarto público), FLAIR (look da partida, **nunca** atrelado a resultado) | F1 estável | `context_type` novos, mesmas regras |

## 18. Decisões em aberto para o fundador

| # | Decisão | Proposta |
|---|---|---|
| D1 | `pct_fundo` (% da receita líquida) | 10% no piloto, revisão trimestral |
| D2 | Piso e teto da taxa | R$ 0,002 e R$ 0,010 por ponto |
| D3 | Mínimo e teto do resgate | R$ 20 mínimo; R$ 500/mês por CPF no piloto |
| D4 | Maturação | 30 dias para ganhos sacáveis; 14 dias para doações |
| D5 | Doação recebida é sacável? | Sim, até 30% de cada pedido e só após 14 dias (alternativa conservadora: não sacável na F2) |
| D6 | Quais regras são sacáveis | Lista do RF41 v2 (criação com qualidade, curadoria de catálogo, remixes, desafios por mérito; **não** FLAIR, curtidas, comentários, 3D, conquistas) |
| D7 | Celebridades podem doar/receber? Marcas? | Celebridade sim (perfil verificado); Marca não (atividade comercial) |
| D8 | Países após o BR | Começar por países com PIX-like e parceiro único (ex.: México/SPEI, Colômbia) — depende do parceiro |
| D9 | Expiração de pontos ganhos | Sem expiração com conta ativa; 24 meses de inatividade expira (com aviso) |
| D10 | Doação anônima | Permitir (o admin sempre vê) |
| D11 | Alternativa ao dinheiro | Oferecer também vale-compra de marcas parceiras (pode ter melhor margem; enquadramento à parte) |
| D12 | Enquadramento tributário | Remuneração de criador (não prêmio) — confirmar com contabilidade |

## 19. Fontes consultadas (2026-10-04)

- Lei 12.865/2013 — arranjos e instituições de pagamento: [Planalto](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12865.htm) · [Câmara](https://www2.camara.leg.br/legin/fed/lei/2013/lei-12865-9-outubro-2013-777235-publicacaooriginal-141416-pl.html) · [BCB — IPs e modelos de negócio](https://www.bcb.gov.br/conteudo/relatorioinflacao/EstudosEspeciais/EE088_Instituicoes_de_pagamento_e_seus_modelos_de_negocio.pdf)
- Consulta de instituições autorizadas: [BCB — relação de instituições em funcionamento](https://www.bcb.gov.br/estabilidadefinanceira/relacao_instituicoes_funcionamento) · [Dados abertos BCB](https://dadosabertos.bcb.gov.br/dataset/relacao-de-instituicoes-em-funcionamento-no-pais)
- Lei 9.613/1998 — PLD/FT: [texto (BCB)](https://www.bcb.gov.br/pre/leisedecretos/port/lei9613.pdf) · [COAF — deveres das pessoas obrigadas (2025)](https://www.gov.br/coaf/pt-br/assuntos/informacoes-as-pessoas-obrigadas/avisos-e-alertas/alertas-e-orientacoes-do-coaf/Disposicoes%20Gerais%20para%20cumprimento%20efetivo%20dos%20deveres%20de%20PLD-FTP%20-%20agosto%202025)
- Lei 5.768/1971 — distribuição gratuita de prêmios: [Câmara (norma atualizada)](https://www2.camara.leg.br/legin/fed/lei/1970-1979/lei-5768-20-dezembro-1971-357812-normaatualizada-pl.html) · [Planalto](http://www.planalto.gov.br/ccivil_03/leis/l5768.htm) · [Decreto 70.951/1972](http://www.planalto.gov.br/ccivil_03/decreto/antigos/d70951.htm) · [Portaria SEAE/ME 7.638/2022](https://www.normaslegais.com.br/legislacao/portaria-seae-me-7638-2022.htm) · [Ministério da Fazenda — promoções comerciais](https://www.gov.br/fazenda/pt-br/composicao/orgaos/secretaria-de-premios-e-apostas/legislacao/promocoes-comerciais)
- Lei 14.790/2023 — apostas de quota fixa: [Planalto](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14790.htm) · [Câmara](https://www2.camara.leg.br/legin/fed/lei/2023/lei-14790-29-dezembro-2023-795206-norma-pl.html)
- Lei 15.211/2025 — ECA Digital: [Planalto](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm) · [Machado Meyer](https://www.machadomeyer.com.br/pt/inteligencia-juridica/publicacoes-ij/direito-digital/lei-15-211-25-protecao-para-criancas-e-adolescentes-no-ambiente-digital) · [Rádio Senado — loot boxes](https://www12.senado.leg.br/radio/1/noticia/2026/03/27/eca-digital-proibe-rolagem-infinita-e-caixa-de-recompensa-em-games-infantojuvenis) · [Conjur — impacto em jogos](https://www.conjur.com.br/2025-out-22/impactos-do-eca-digital-no-segmento-de-jogos-eletronicos/)
- Tributação de prêmios: [Lei 4.506/1964, art. 14](https://modeloinicial.com.br/lei/L-4506-1964/lei-4506/art-14) · [Lei 8.981/1995, art. 63](https://modeloinicial.com.br/lei/L-8981-1995/lei-8981/art-63) · [Portal Tributário — IRF sobre prêmios](https://www.portaltributario.com.br/guia/irf_sorteios.html)
- Lei 15.270/2025 — isenção de IR até R$ 5.000/mês: [Conjur](https://conjur.com.br/2025-dez-04/lei-15-270-2025-dividendos-e-simples-nacional/) · [Garcia Cont — efeito no RPA](https://garciacont.com.br/artigos/isencao-irrf-2026-lei-15270-o-que-muda-no-rpa)
