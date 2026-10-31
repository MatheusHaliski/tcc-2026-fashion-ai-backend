# Módulo 10 — momentos, selos, marcas, celebridades, cupons: lote SEAL-PROMOTION-RULES-001

Base: `bcaee73` (main após PR #416). Branch: `gof/10-selos`. `git status --short` limpo antes do lote.
Prompt: `prompts_zip/10_momentos_selos_marcas_celebridades_cupons.md`. Primeiro lote temático do domínio 10.

## Mapeamento real do fluxo de promoções de selo

`app/(site)/(app)/brands/[slug]/page.tsx` (client; `api.get /api/users/{ownerId}/promotions`, `api.post|put
/api/promotions[/{id}]`, `api.put /api/promotions/{id}/status`, `api.post /api/promotions/{id}/redemptions`) e
`components/coupons/brand-coupons-tab` → chamadas diretas à API (não há BFF para promoções; `app/bff` só tem `auth` e
`metrics`)
→ `SealController` (`fai-web`): `POST /api/admin/coupons`, `POST /api/promotions`, `PUT /api/promotions/{id}`,
`PUT /api/promotions/{id}/status`, `GET /api/users/{ownerId}/promotions`, `POST /api/promotions/{id}/redemptions`
→ `SealService` (`@Transactional`: `createPromotion`, `createAdminPromotion`, `updatePromotion`, `setPromotionStatus`,
`promotionsOf`, `redeem`, `eligiblePromotions`) → **`PromotionRules`** (novo, puro)
→ `PromotionRepository` (`findForRedeem` com `PESSIMISTIC_WRITE`), `PromotionRedemptionRepository`, `SealBondRepository`,
`SealRepository`, `UserRepository` → entidades `Promotion`, `PromotionRedemption`, `SealBond`, `Seal` → `Map` de visão.

Consumidores indiretos: `CouponService` (RF38 — `eligiblePromotions`, `redeem`, painel "Meus cupons promocionais" usa
`unavailable` e `httpsOnly`), `InstitutionalService` (aba `PROMOCOES` → `promotionsOf`), `FlairService` (domínio 09,
usa `SealService.storeUrl`, **não alterado**).

## Problema concreto e decisão

`SealService` (2150 linhas, congelado no baseline) misturava, no bloco de promoções, regras puras com I/O e transação:
`applyPromotion` validava tipo por perfil, desconto 1–90, período, limite por pessoa e selo exigido no meio de lookups
de usuário/selo/parceira; `unavailable` (janela `startsAt/expiresAt`, cota, selo ativo), `eligibleBond` (vínculo
aprovado e não vencido do selo exigido), o consentimento da parceira e o prefixo do código do cupom liam
`Instant.now()` ou ficavam inline no `redeem`. Essas regras não eram testáveis com relógio fixo nem isoladamente.

Decisão: **extrair função/classe pura** `PromotionRules` (package-private, final, métodos estáticos, sem Spring,
repositório nem relógio global — o instante é parâmetro). O serviço continua dono de `@Transactional`, autorização
(`Guard`), consultas, bloqueio pessimista da promoção no resgate, laço de unicidade do código, incremento da cota e
auditoria. A ordem das checagens do formulário foi mantida exatamente (tipo ausente → perfil consultado → tipo por perfil
→ título → desconto → selo ativo → período → parceira → link), por isso `requireType` e `requireTypeFor` são separados.

`SealService.storeUrl`, `SealService.httpsOnly` (públicos) e `SealService.unavailable` (package-private) viraram
delegadores de uma linha para não quebrar `FlairService` (09) nem chamadores externos. `CouponService` (mesmo
domínio e pacote) passou a chamar `PromotionRules` diretamente.

### Padrões avaliados e não aplicados neste lote

- **State (status da promoção/cupom):** `PromotionStatus` tem 4 valores e a única transição automática é
  `AVAILABLE → REDEEMED` ao esgotar a cota; o status exibido do cupom (`EMITIDO/USADO/EXPIRADO`) é derivação de dois
  campos. Uma máquina de estados adicionaria classes sem eliminar condicionais.
- **Chain of Responsibility (elegibilidade/formulário):** as regras são poucas, curtas e de curto-circuito com ordem
  fixa; funções nomeadas chamadas em sequência são mais claras que elos. (No domínio 02 a chain se justificou por
  acumular 19 erros num `LinkedHashMap` ordenado; aqui cada falha interrompe.)
- **Strategy (política por emissor marca × celebridade):** a variação é um conjunto de tipos permitidos e o selo
  exigido (`BRAND_SEAL`/`PREMIUM_SEAL`); um booleano + constante bastam.
- **Builder (políticas de selo):** fora deste lote (`applySeal`/`draft` envolvem IA e Hype); não tocado.
- **Facade (resgate):** `SealService`/`CouponService` já são as fachadas transacionais; outra camada seria indireção.
- **Adapter (comércio externo):** não há integração externa de checkout; o link da loja é só validado (`httpsOnly`).
- **Singleton:** nenhum manual; beans Spring.

## Verificação (executada)

| Etapa | Comando | Resultado |
|---|---|---|
| Caracterização **antes** da extração: `SealPromotionCharacterizationTest` (11 testes pelo `SealService` real com repositórios em memória: códigos e ordem de recusa do formulário, normalização de limite/selo exigido/visibilidade/link, consentimento da parceira com vínculo vencido e válido, selo inativo, `httpsOnly`/`storeUrl`, motivos e ordem de indisponibilidade com fim exato = expirado, elegibilidade por selo/vínculo vencido/emissor suspenso, recusa sem vínculo e com selo revogado, prefixo `ESTREXLOJA-`/`MAISO-`, limite por pessoa, cota 2 esgotando → `REDEEMED` → terceiro resgate recusado, vitrine do perfil) + testes existentes | `mvn -B -o -pl fai-application -Dtest='SealPromotionCharacterizationTest,CouponServiceTest,FlairService*Test,Seal*Test' test` | 154 testes, 0 falhas |
| Depois da extração + `PromotionRulesTest` (7 testes com relógio fixo `2026-10-31T23:59:59Z`: tipos por perfil, desconto 1/90/0/91, período igual/nulo/invertido, limite, links, janela com início inclusivo e fim exclusivo, estoque 1 usado, vínculo vencido no instante exato, consentimento, prefixos) | mesmo comando + `PromotionRulesTest` | 161 testes, 0 falhas |
| Compilação de `fai-web` + testes web que usam `SealService` | `mvn -B -o -pl fai-web -am -Dtest='...' test`; `mvn -B -o -pl fai-web -Dtest='SealFormPayloadTest,SealCopilotRoutesTest' test` | BUILD SUCCESS; 4 testes, 0 falhas |
| Catraca de linhas | `python /home/user/tcc-2026-fashion-ai-backend/scripts/refactoring/line_ratchet.py` | 0 violações nos arquivos tocados; `SealService` pede APERTAR 2150 → 2097. As 8 violações listadas são de arquivos de outros lotes (worktree em `bcaee73`, anterior às reduções da principal) |

Logs: `evidence/10-seal-promotion-baseline.log`, `10-seal-promotion-after.log`, `10-seal-promotion-web.log`.

Sem banco, servidor, navegador, rede, pagamento, GPU ou contas reais. A suíte completa não foi rodada (máquina
compartilhada); só os testes do domínio e consumidores diretos.

## Métricas

| Arquivo | Antes | Depois |
|---|---|---|
| `SealService.java` (congelado) | 2150 linhas | 2097 (−53; −2,5 %) |
| `CouponService.java` (congelado) | 463 | 463 (4 chamadas trocadas para `PromotionRules`) |
| `PromotionRules.java` (novo) | — | 153 |
| Runtime combinado | 2613 | 2713 (+100: javadoc, assinaturas e delegadores) |
| Tokens de ramificação (if/for/catch/?/&&/\|\|, contagem lexical) | 396 | 375 + 22 = 397 |
| Testes novos | — | `SealPromotionCharacterizationTest` 293 linhas, `PromotionRulesTest` 143 |

O ganho é coesão e testabilidade com relógio controlado das regras de oferta, além de reduzir o arquivo congelado.

## Contratos preservados

URLs, métodos, `PromotionForm`, códigos `TIPO_OBRIGATORIO`/`TIPO_INVALIDO`/`DESCONTO_INVALIDO`/`SELO_INATIVO`/
`PERIODO_INVALIDO`/`PARCEIRA_INVALIDA`/`PARCERIA_NAO_AUTORIZADA`/`LINK_INVALIDO`/`PROMOCAO_INDISPONIVEL`/`SELO_INVALIDO`/
`LIMITE_POR_USUARIO`, chaves e mensagens i18n (`Msg` não alterado), ordem das checagens, janela `startsAt` inclusiva e
`expiresAt` exclusiva em `Instant` (UTC), cota/estoque e transição para `REDEEMED`, limite por pessoa, bloqueio
pessimista do resgate, formato do código (`Hashing.promoCode`) e laço de unicidade, `@Transactional` de todos os
métodos, chaves dos `Map` de visão. Sem mudança de DTO, schema, migration, configuração, Hype (08) ou FLAIR (09).

## Riscos e pendências do domínio 10

- **Unicidade do código do cupom:** o laço em `SealService.redeem` consulta `promotions.findByCode` (tabela de
  promoções), não `redemptions.findByCode`; a colisão real só é barrada pela constraint do banco (se existir). Mantido
  como está (fora do escopo "sem mudança de comportamento"); merece lote próprio com teste de colisão.
- **Status no frontend:** `brands/[slug]/page.tsx` oferece `DRAFT/ACTIVE/PAUSED/ENDED` no select de status, mas o enum
  `PromotionStatus` é `AVAILABLE/REDEEMED/EXPIRED/REVOKED`; o `PUT /api/promotions/{id}/status` com esses valores tende a
  falhar na desserialização. Não alterado; registrar para lote de frontend.
- Concorrência real (estoque 1 com dois requests simultâneos) depende do `PESSIMISTIC_WRITE` de `findForRedeem` e só é
  verificável com banco; os testes cobrem a regra sequencial.
- `SealService` segue PARTIAL (2097 linhas): revisão/revogação de vínculos, sugestões por IA e Hype ainda no mesmo bean.
  `CouponService` (463), `IssuerReviewService` (602), `PhysicalStoreService` (370) e `MomentService` (1902) não foram
  tocados neste lote.
