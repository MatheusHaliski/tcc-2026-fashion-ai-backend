# Circuito Aura — proposta de produto

> Nasceu como "Circuito Hype" e foi ampliado para todas as modalidades de Aura. Documentos de apoio:
> `docs/design/AURA_FAMILIAS_E_RECOMPENSAS.md` (divisão funcional acordada), `docs/design/AURA_LICENCAS_ESTADO.md`
> (estado das licenças Metamorfose), `docs/hype/HYPESCORE_ARCHITECTURE.md` (o cálculo do Hype).

## 1. Problema

O card de peça/look tem hoje seis famílias de Aura (`lib/aura-fashion.ts`: Comum, Electro, Splash, Hype, Metamorfose,
mais a Aura Impersonation) e, no caso do Hype, uma engrenagem inteira: nota, seis faixas (`LOW_SIGNAL`, `NICHE`,
`RELEVANT`, `HOT`, `TRENDING`, `VIRAL`), selos automáticos de Hype, campanhas de Hype dos emissores
(`SealHypeOffersService`), faixas dentro dos jogos FLAIR (`Flair3dHype`) e aviso de marco (`HypeMilestoneNotifier`).

Só que as pontas não se encontram:

- subir de faixa **não destrava nada concreto**;
- cupons e promoções **ignoram o Hype**;
- o card **não diz para que serve** o Hype dele;
- as outras Auras são só aparência: nenhuma conversa com jogos, desafios, cupons ou selos, e a Metamorfose —
  pensada como recompensa — ainda não é concedida por nada além da loja do emissor.

## 2. Princípio (não pode ser quebrado)

**O Hype é conquistado só pela comunidade.** Jogos, cupons, desafios, selos e Auras **leem** o Hype e nunca escrevem:
nada no circuito grava sinal em `hype_signal_daily`, publica evento de sinal ou altera a nota. O circuito dá *serventia*
ao Hype, não um atalho para ele.

O mesmo vale ao contrário para as Auras de expressão: escolher uma Aura bonita não dá Hype.

## 3. O papel de cada Aura no circuito card → jogos → desafios → cupons/promoções → selos

| Família | O que significa | Como entra no circuito |
|---|---|---|
| **Hype** | Relevância conquistada pela comunidade. É a **chave**. | A faixa do card destrava: cupom com Hype mínimo, campanha de selo do emissor, faixa de jogo no FLAIR, FAI Points de marco e (fase 2) a recompensa visível. |
| **Metamorfose** | A **recompensa visível**: borda dinâmica/arte exclusiva. É o que a pessoa *ganha*. | Direito de arte concedido por um marco de Hype, por uma promoção de selo/cupom, por um resultado de FLAIR ou comprado com FAI Points. O direito fica preso ao card elegível; recompensa condicionada à faixa é retirada quando a faixa cai. |
| **Comum, Electro, Splash** | **Expressão escolhida pelo dono**: composições em vídeo na área artística do card. | Não medem nada e não dão Hype. Conjuntos curados (coleções de composições) são destravados por progresso: nível de FAI XP, desafios concluídos, temporadas. |
| **Impersonation** | Aura **licenciada pelo emissor** (marca/celebridade). | Só existe com licença/consentimento do emissor; entra no circuito como benefício de selo ou de campanha do próprio emissor, nunca por faixa de Hype sozinha. |

## 4. Os cinco elos

1. **"O que este card destrava"** — painel no card (na análise do Hype) que mostra o que a faixa atual já libera e o que
   vem na próxima, com quantos pontos faltam.
2. **Cupom por Hype** — faixa mínima de Hype numa promoção de selo e numa combinação FLAIR.
3. **Marco que vale algo** — o aviso de marco diz o que foi destravado, abre o card já no painel e credita FAI Points
   uma única vez por marco.
4. **Meta de Hype em desafios** — desafio cujo objetivo é levar um card a uma faixa (lido, nunca empurrado). *(fase 2)*
5. **Hype no resultado da partida** — o resultado do FLAIR mostra a faixa com que cada carta jogou e o que ela rendeu.
   *(fase 2)*

## 5. Salvaguardas

- **Só Hype público e atualizado conta.** Mesmas checagens já usadas pelos selos de Hype: `public_eligible` e a
  atualização de `SealHypeLookups.freshHype` (status `AVAILABLE`, versão atual do algoritmo, dentro de
  `staleAfterHours`). Card privado ou só para seguidores tem "Hype pessoal": vê a própria faixa, mas não destrava cupom,
  selo nem faixa de jogo.
- **Queda de faixa não revoga cupom já emitido.** O cupom guarda a faixa da emissão (`hype_level_snapshot`); a leitura
  do cupom usa o que foi gravado nele.
- **Recompensa condicionada à faixa é diferente de cupom.** A arte Metamorfose ganha por faixa de Hype é retirada de
  Minhas Artes e desaplicada quando a faixa cai (regra acordada em `AURA_FAMILIAS_E_RECOMPENSAS.md`); por isso a
  concessão só entra junto com a revogação (fase 2).
- **Pontos de marco uma vez só.** O dedupe de `hype_milestones` já garante "primeira vez"; o crédito usa ainda uma chave
  idempotente por card e marco no extrato de FAI Points.
- **Sem dados não é zero.** `INSUFFICIENT_DATA` e `NOT_CALCULATED` nunca aparecem como nota zero nem geram "faltam N
  pontos".
- **Uma régua só.** Os limiares vêm do `HypeScoreConfig`; nenhuma segunda escala fixa no código.

## 6. Fases

### Fase 1 — entregue neste PR (família Hype implementada; as demais especificadas)

**Elo 1 — painel e modelo de leitura**

- `AuraUnlocks` (puro, `fai-application/.../application/aura`): estado do Hype, itens destravados (`unlocked`), próximos
  (`next`) e `nextLevel {level, missingPoints}`. Cada item: `kind` (`COUPON`, `SEAL_CAMPAIGN`, `FLAIR_BAND`,
  `MILESTONE_POINTS`, `AURA_REWARD`), `family`, `title`, `detail`, `href`, `requiredLevel`, `met`.
- `GET /api/hype/{type}/{id}/unlocks` (`AuraUnlocksController` → `AuraUnlocksService`), com a mesma visibilidade das
  rotas de Hype. Fontes: faixa no FLAIR e campanhas de selo (`AuraUnlockSources`), cupons com Hype mínimo
  (`CouponHypeOffers`) e pontos de marco (`HypeMilestoneUnlocks`, só para o dono), via `AuraUnlockProvider`.
- O modelo já é genérico: `family` em cada item e o tipo `AURA_REWARD` existem e são renderizados; na fase 1 nenhuma
  fonte produz `AURA_REWARD` (ver fase 2, item 1).
- Front: bloco "O que este card destrava" no resumo da análise do Hype (`components/hype/aura-unlocks-panel.tsx`,
  dentro de `hype-analytics-drawer.tsx`).

**Elo 2 — cupom por Hype**

- Flyway V126: `min_hype_level` em `promotions` e `flair_combinations`; `hype_level_snapshot` em
  `promotion_redemptions` e `flair_redemptions`; CHECKs com os seis códigos de faixa. DDL manual para o Railway em
  `docs/banco-de-dados/solucoes/sql/railway/126-cupom-por-hype.sql`.
- `CouponHypeRules` (regra pura) e `CouponHypeGate` (lê o Hype público e atualizado): faixa inválida → 400
  `FAIXA_HYPE_INVALIDA`; card abaixo da faixa → 409 `HYPE_INSUFICIENTE` e nada é emitido; oferta antiga (NULL) segue
  como sempre. Promoção de selo: vale o card que carrega o vínculo do selo. Combinação FLAIR: valem as cartas da
  combinação.
- Carteira: `GET /api/me/coupons/hype-locked` (`CouponHypeController` → `CouponHypeOffers.locked`) lista as ofertas em
  que só falta a faixa (selo ou deck em ordem, dentro do limite por pessoa).
- Front: campo "Hype mínimo do card" nos dois formulários de oferta (`components/coupons/coupon-hype.tsx`); na
  carteira, a seção "Travados pelo Hype" com a faixa que falta e a atual do card; no cupom emitido e no voucher FLAIR,
  a faixa registrada na emissão; na vitrine do emissor, o botão "Travado pelo Hype" com o motivo.

**Elo 3 — marco que vale algo**

- `HypeMilestoneRewards`: depois do dedupe do `HypeMilestoneNotifier`, credita FAI Points uma vez por card e marco
  (valores em configuração `fai.hype.milestone-points.{hot,trending,viral}`: 20, 50, 120; regra `HYPE_MILESTONE` do
  extrato criada pela V126 com valor 0, chave idempotente `<dono>:HYPE_MILESTONE:<tipo>:<id>:<marco>`). Falha no
  crédito nunca derruba o aviso. O texto do resumo saiu do notificador para `HypeMilestoneDigest` (extração com o
  `HypeMilestoneTest` como caracterização). O aviso diz o que foi destravado e o link abre o card
  com o painel em foco (`?destrava=<id>`). Card privado: os pontos vão para o dono e o texto continua dizendo que é Hype
  pessoal. Nada disso publica sinal de Hype.

### Fase 2 — especificada, por família

**Metamorfose**

1. **Direito de arte por marco de Hype** (primeiro item da fase 2). A infraestrutura de direitos existe em parte —
   `AtelierRewardGrant` categoria `auraSignature`, lida por `MetamorphoseInventoryService` — mas faltam três peças sem
   as quais a concessão não é segura: (a) o direito não é preso ao card elegível (`require` confere só o dono);
   (b) não há revogação quando a faixa cai, exigida pela regra acordada; (c) não há cadastro de qual arte cada marco
   concede, e as 20 ofertas Metamorfose seguem inativas à espera de curadoria. Entregar: vínculo direito↔card,
   revogação por queda, cadastro marco→arte, e a fonte `AURA_REWARD` do painel.
2. Licença do emissor associada à promoção de selo/cupom: a oferta concede a arte ao card contemplado.
3. Arte por resultado de FLAIR e compra por participante com FAI Points (débito no extrato).
4. Aplicar/remover/reaplicar só no card contemplado; Minhas Artes distinguindo licença do emissor e direito do card.

**Hype**

5. Meta de Hype em desafios (elo 4): desafio lê a faixa do card inscrito; concluir não dá Hype.
6. Hype no resultado da partida (elo 5): faixa com que cada carta jogou, bônus rendido e o próximo destrave.
7. Painel do emissor: quantos cupons com Hype mínimo ficaram travados/destravados por faixa.

**Comum, Electro e Splash**

8. Conjuntos curados destravados por progresso (nível de FAI XP, desafios, temporada) como itens `AURA_REWARD` das
   famílias `COMMON`/`ELECTRO`/`SPLASH` no painel. Continuam sem medir nada e sem dar Hype.

**Impersonation**

9. Licença do emissor como benefício de selo/campanha: item `AURA_REWARD` da família `IMPERSONATION`, sempre com
   consentimento do emissor e nunca liberado só por faixa de Hype.

## 7. Estado por família

| Família | Fase 1 | Fase 2 |
|---|---|---|
| Hype | **implementada** (elos 1, 2 e 3) | elos 4 e 5, painel do emissor |
| Metamorfose | só especificada (modelo e painel já aceitam `AURA_REWARD`) | concessão, vínculo ao card, revogação |
| Comum / Electro / Splash | só especificadas | conjuntos curados por progresso |
| Impersonation | só especificada | licença como benefício de selo/campanha |
