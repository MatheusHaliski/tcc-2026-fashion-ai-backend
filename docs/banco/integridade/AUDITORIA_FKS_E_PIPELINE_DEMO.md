# Integridade referencial por domínio + Demo/Test Data Pipeline — auditoria e diff proposto

> **Status: PROPOSTA — nada aplicado ao schema.** Este documento é o portão pedido antes de implementar
> ("apresente a auditoria das FKs atuais e o diff proposto"). Depois da aprovação, o diff vira migrations
> versionadas (Flyway) e o pipeline em `scripts/demo/`.

Fonte da auditoria: `INFORMATION_SCHEMA` de um MySQL 9.4 migrado pelo próprio Flyway da API (V1–V27 desta branch;
a V28 da branch de produção só adiciona `wardrobe_items.is_ai_generated_image`, sem FK). Lista completa e
legível por máquina: [`fks_atuais.tsv`](fks_atuais.tsv) (gerada; mesma fonte desta tabela).

## 1. Resumo

| | Quantidade |
|---|---|
| Tabelas | 79 |
| FKs existentes | 89 (18 CASCADE · 66 NO ACTION · 5 SET NULL) |
| KEEP (já corretas) | 26 |
| CHANGE_TO_CASCADE | 55 |
| CHANGE_TO_SET_NULL | 5 (todas com necessidade real, ver §3) |
| REVIEW (decisão sua) | 3 (promoções e selos, §4) |
| Colunas `*_id` sem FK | 65 — 20 viram FK nova (§5), 9 são polimórficas e não podem ter FK, o resto é id externo/lógico |

`RESTRICT*` = `NO ACTION`, que no InnoDB tem exatamente o efeito de `RESTRICT` (checagem imediata). Por isso as
relações com o domínio global (**marcas, modelos de desafio, catálogo de móveis**) ficam **KEEP**: já bloqueiam.

### O que a auditoria mostrou que muda o desenho

1. **Não existem `catalog_products`, `product_variants`, `catalog_images`, `catalog_sources` neste schema.** O
   domínio global hoje é: `brands` (marcas, semeadas pela V3/V12), `room_catalog` (móveis do Meu Quarto, por SKU),
   `challenge_templates`, `seals` (selos). A regra "global → RESTRICT" foi aplicada a eles; o domínio de catálogo
   de produtos fica para quando o *Catalog Ingestion Pipeline* existir (as FKs dele já nascem com a política).
2. **Não existe tabela `posts`, `likes` nem `profiles` separada.** Post = look/peça publicado (`schemes`/
   `wardrobe_items` com visibilidade pública, projetado no feed do Cassandra); curtida = `reactions`; perfil = a
   própria `users` + `brand_profiles` / `celebrity_profiles` (extensões da conta).
3. **A exclusão de conta real é anonimização (LGPD), não `DELETE`.** `AccountService.purgeScheduledDeletions`
   troca nome/e-mail, arquiva peças/looks, apaga fotos do storage e marca `status = DELETED`. As cascatas
   propostas **não mudam esse fluxo**; elas valem para `DELETE FROM users` — hoje usado só pelo reset do
   universo demo — e impedem que um `DELETE` manual deixe órfãos.
4. **`users.test_account` já existe** (V22): contas `e2e_*` somem da busca e do dashboard para quem não é de
   teste. `account_origin` substitui o booleano sem redundância (ele vira coluna gerada, §6).
5. **Dados de uma conta não estão só no MySQL**: feed e notificações no Cassandra, busca no OpenSearch, mídia no
   storage, e nome/e-mail/bio **cifrados** (AES-GCM com `DATA_ENCRYPTION_KEY`). E o MySQL de produção não tem
   acesso público (rede privada, por segurança). Consequência no pipeline: §7.
6. **Relações polimórficas** (`comments.target_id`, `reactions.target_id`, `saved_items.target_id`,
   `shares.target_id`, `notifications.resource_id`, `moderation_queue.target_id`, `coupon_rights.source_id`,
   `photos.source_entity_id`, `item_embeddings.entity_id`) não podem ter FK: a limpeza delas é explícita
   (aplicação/reset) e o `verify` procura órfãos.

## 2. Auditoria completa das FKs atuais

Ordenada pela tabela referenciada (`users` primeiro). Em **negrito**, o que muda.

| # | Tabela.coluna | → Referência | ON DELETE hoje | ON UPDATE | Classe | Ação | Proposta | Por quê |
|---|---|---|---|---|---|---|---|---|
| 1 | `acervo_groups.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | grupos do acervo da pessoa |
| 2 | `brand_profiles.owner_user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | perfil de marca é extensão da conta |
| 3 | `celebrity_profiles.owner_user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | perfil de celebridade é extensão da conta |
| 4 | `comments.author_user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | política atual: comentário sai com a conta (purga real já anonimiza) |
| 5 | `coupon_rights.owner_user_id` | `users` | CASCADE | NO ACTION | OWNERSHIP | KEEP | CASCADE | já cascata (dado da pessoa) |
| 6 | `coupon_rights.user_id` | `users` | CASCADE | NO ACTION | OWNERSHIP | KEEP | CASCADE | já cascata (dado da pessoa) |
| 7 | `daily_looks.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | look do dia da pessoa |
| 8 | `data_export_requests.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | pedido LGPD da própria pessoa |
| 9 | `dna_schemes.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | DNA de estilo da pessoa |
| 10 | `fai_points_ledger.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | extrato de pontos da pessoa (não é dinheiro) |
| 11 | `flair_coin_entries.user_id` | `users` | CASCADE | NO ACTION | OWNERSHIP | KEEP | CASCADE | já cascata (dado da pessoa) |
| 12 | `flair_combinations.brand_user_id` | `users` | CASCADE | NO ACTION | OWNERSHIP | KEEP | CASCADE | já cascata (dado da pessoa) |
| 13 | `flair_match_entries.user_id` (nulo) | `users` | CASCADE | NO ACTION | OWNERSHIP | KEEP | CASCADE | já cascata (dado da pessoa) |
| 14 | `flair_matches.created_by_user_id` | `users` | CASCADE | NO ACTION | OWNERSHIP | KEEP | CASCADE | já cascata (dado da pessoa) |
| 15 | `flair_mode_states.user_id` | `users` | CASCADE | NO ACTION | OWNERSHIP | KEEP | CASCADE | já cascata (dado da pessoa) |
| 16 | `flair_profiles.user_id` | `users` | CASCADE | NO ACTION | OWNERSHIP | KEEP | CASCADE | já cascata (dado da pessoa) |
| 17 | `flair_redemptions.user_id` | `users` | CASCADE | NO ACTION | OWNERSHIP | KEEP | CASCADE | já cascata (dado da pessoa) |
| 18 | `flair_team_members.user_id` | `users` | CASCADE | NO ACTION | OWNERSHIP | KEEP | CASCADE | já cascata (dado da pessoa) |
| 19 | `flair_teams.owner_user_id` | `users` | CASCADE | NO ACTION | OWNERSHIP | KEEP | CASCADE | já cascata (dado da pessoa) |
| 20 | `flair_territories.owner_user_id` (nulo) | `users` | SET NULL | NO ACTION | OWNERSHIP | KEEP | SET NULL | item global/território sobrevive sem o criador |
| 21 | `flair_trophies.user_id` | `users` | CASCADE | NO ACTION | OWNERSHIP | KEEP | CASCADE | já cascata (dado da pessoa) |
| 22 | `follows.follower_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | relação bidirecional: sumiu uma ponta, some a relação (as duas FKs iguais) |
| 23 | `follows.following_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | relação bidirecional: sumiu uma ponta, some a relação (as duas FKs iguais) |
| 24 | `hype_score_metrics.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | métrica do look da pessoa |
| 25 | `inventory_score_snapshots.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | histórico da pessoa |
| 26 | `mirror_states.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | estado do espelho da pessoa |
| 27 | `notifications.actor_user_id` (nulo) | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | notificação sem destinatário/autor não faz sentido |
| 28 | `notifications.recipient_user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | notificação sem destinatário/autor não faz sentido |
| 29 | `photos.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | foto enviada pela pessoa (objeto no storage sai antes, pela aplicação) |
| 30 | `pipeline_jobs.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | job de processamento da pessoa |
| 31 | `promotion_redemptions.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | resgate feito pela pessoa |
| 32 | `ranking_opt_ins.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | opt-in da pessoa |
| 33 | `reactions.actor_user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | curtida/reação da pessoa |
| 34 | `refresh_tokens.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | sessão da pessoa |
| 35 | `room_catalog.creator_user_id` (nulo) | `users` | SET NULL | NO ACTION | GLOBAL_DOMAIN | KEEP | SET NULL | item global/território sobrevive sem o criador |
| 36 | `room_inventory.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | inventário do quarto da pessoa |
| 37 | `room_layouts.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | layout do quarto da pessoa |
| 38 | `room_storage_map.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | mapa do quarto da pessoa |
| 39 | `saved_items.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | salvos da pessoa |
| 40 | `scheme_groupings.owner_user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | agrupamentos da pessoa |
| 41 | `schemes.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | look pertence à pessoa |
| 42 | `seal_bonds.requested_by_user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | vínculo entre selo e look: sumiu qualquer das contas, some o vínculo |
| 43 | `seal_bonds.target_owner_user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | vínculo entre selo e look: sumiu qualquer das contas, some o vínculo |
| 44 | `seals.owner_user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | selo é da conta de marca/celebridade |
| 45 | `shares.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | compartilhamento feito pela pessoa |
| 46 | `style_dna.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | DNA da pessoa |
| 47 | `style_dna_versions.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | versões do DNA da pessoa |
| 48 | `user_achievements.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | conquista da pessoa |
| 49 | `user_avatars_3d.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | avatar 3D (biométrico) da pessoa |
| 50 | `user_consents.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | consentimento da pessoa |
| 51 | `user_preferences.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | preferências da pessoa |
| 52 | `verification_codes.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | código da pessoa |
| 53 | `wardrobe_items.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | peça do guarda-roupa pertence à pessoa |
| 54 | `week_plans.user_id` | `users` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | plano semanal da pessoa |
| 55 | `piece_usage_diary.wardrobe_item_id` | `wardrobe_items` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | diário de uso da peça |
| 56 | `room_storage_map.wardrobe_item_id` | `wardrobe_items` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | posição da peça no quarto |
| 57 | `scheme_items.wardrobe_item_id` | `wardrobe_items` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | item de look sem a peça não existe (o look perde o item) |
| 58 | `wardrobe_availability_log.wardrobe_item_id` | `wardrobe_items` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | histórico da peça |
| 59 | `daily_looks.scheme_id` | `schemes` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | look do dia aponta para um look da pessoa |
| 60 | `dna_scheme_items.scheme_id` | `schemes` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | item do DNA aponta para o look |
| 61 | `flair_match_entries.scheme_id` (nulo) | `schemes` | SET NULL | NO ACTION | REFERENCE | KEEP | SET NULL |  |
| 62 | `flair_redemptions.scheme_id` (nulo) | `schemes` | SET NULL | NO ACTION | REFERENCE | KEEP | SET NULL |  |
| 63 | `hype_score_metrics.scheme_id` | `schemes` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | métrica do look |
| 64 | `scheme_items.scheme_id` | `schemes` | CASCADE | NO ACTION | OWNERSHIP | KEEP | CASCADE | item é parte do look |
| 65 | `schemes.original_scheme_id` (nulo) | `schemes` | RESTRICT* | NO ACTION | REFERENCE | **CHANGE_TO_SET_NULL** | SET NULL | remix de outra pessoa sobrevive ao original (hoje BLOQUEIA apagar o original) |
| 66 | `seal_bonds.scheme_id` | `schemes` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | vínculo do selo com o look |
| 67 | `week_plan_days.scheme_id` (nulo) | `schemes` | RESTRICT* | NO ACTION | REFERENCE | **CHANGE_TO_SET_NULL** | SET NULL | o dia do plano continua, só sem look |
| 68 | `brands.brand_profile_id` (nulo) | `brand_profiles` | RESTRICT* | NO ACTION | GLOBAL_DOMAIN | **CHANGE_TO_SET_NULL** | SET NULL | marca global continua existindo sem a conta oficial (único SET NULL novo com necessidade real) |
| 69 | `wardrobe_items.brand_profile_id` (nulo) | `brand_profiles` | RESTRICT* | NO ACTION | REFERENCE | **CHANGE_TO_SET_NULL** | SET NULL | peça de outra pessoa marcada com a conta da marca continua existindo |
| 70 | `wardrobe_items.brand_id` (nulo) | `brands` | RESTRICT* | NO ACTION | GLOBAL_DOMAIN | KEEP | RESTRICT | catálogo global protegido (NO ACTION = RESTRICT no InnoDB) |
| 71 | `challenge_events.instance_id` | `challenge_instances` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | evento é parte da instância do desafio |
| 72 | `challenge_notes.instance_id` | `challenge_instances` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | anotação é parte da instância |
| 73 | `challenge_participants.instance_id` | `challenge_instances` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | participação é parte da instância |
| 74 | `challenge_votes.instance_id` | `challenge_instances` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | voto é parte da instância |
| 75 | `challenge_instances.template_code` | `challenge_templates` | RESTRICT* | NO ACTION | GLOBAL_DOMAIN | KEEP | RESTRICT | modelo global protegido |
| 76 | `daily_looks.materialized_from_id` (nulo) | `daily_looks` | RESTRICT* | NO ACTION | REFERENCE | **CHANGE_TO_SET_NULL** | SET NULL | auto-referência opcional: o look do dia materializado continua válido |
| 77 | `hype_score_metrics.daily_look_id` | `daily_looks` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | métrica do look do dia |
| 78 | `dna_scheme_items.dna_scheme_id` | `dna_schemes` | CASCADE | NO ACTION | OWNERSHIP | KEEP | CASCADE | item do DNA |
| 79 | `flair_redemptions.combination_id` | `flair_combinations` | CASCADE | NO ACTION | OWNERSHIP | KEEP | CASCADE |  |
| 80 | `flair_match_entries.match_id` | `flair_matches` | CASCADE | NO ACTION | OWNERSHIP | KEEP | CASCADE |  |
| 81 | `flair_team_members.team_id` | `flair_teams` | CASCADE | NO ACTION | OWNERSHIP | KEEP | CASCADE |  |
| 82 | `promotion_redemptions.promotion_id` | `promotions` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | resgate é filho da promoção |
| 83 | `room_inventory.sku` | `room_catalog` | RESTRICT* | NO ACTION | GLOBAL_DOMAIN | KEEP | RESTRICT | catálogo global de móveis protegido enquanto alguém possui o item |
| 84 | `promotion_redemptions.seal_bond_id` | `seal_bonds` | RESTRICT* | NO ACTION | OWNERSHIP | **REVIEW** | CASCADE | resgate de promoção nascida do vínculo |
| 85 | `promotions.seal_bond_id` (nulo) | `seal_bonds` | RESTRICT* | NO ACTION | REFERENCE | **REVIEW** | SET NULL | promoção continua sob o selo se o vínculo de origem sumir |
| 86 | `promotions.seal_id` (nulo) | `seals` | RESTRICT* | NO ACTION | OWNERSHIP | **REVIEW** | CASCADE | promoção é do selo |
| 87 | `room_catalog.seal_id` (nulo) | `seals` | SET NULL | NO ACTION | REFERENCE | KEEP | SET NULL |  |
| 88 | `seal_bonds.seal_id` (nulo) | `seals` | RESTRICT* | NO ACTION | OWNERSHIP | **CHANGE_TO_CASCADE** | CASCADE | vínculo pertence ao selo |
| 89 | `week_plan_days.week_plan_id` | `week_plans` | CASCADE | NO ACTION | OWNERSHIP | KEEP | CASCADE |  |

## 3. Os 5 `SET NULL` novos (só onde o filho continua válido sem o pai)

| FK | Por que não CASCADE nem RESTRICT |
|---|---|
| `brands.brand_profile_id` | `brands` é catálogo global. Apagar a conta oficial de uma marca não pode apagar a marca (RESTRICT bloquearia a exclusão da conta; CASCADE apagaria o catálogo). |
| `wardrobe_items.brand_profile_id` | Peça de **outra pessoa** marcada com a conta da marca continua sendo dela. |
| `schemes.original_scheme_id` | Remix feito por outra pessoa sobrevive ao original. **Hoje isso BLOQUEIA** apagar um look que alguém remixou. |
| `week_plan_days.scheme_id` | O dia do plano semanal continua existindo, vazio. |
| `daily_looks.materialized_from_id` | Auto-referência opcional; o look do dia materializado continua válido. |

Mais um `SET NULL` em FK nova (§5): `ai_inference_log.user_id` — o custo de IA já gasto continua contando no teto
global diário (`AiBudget`), mesmo que a conta suma.

## 4. REVIEW — decisão sua (promoções e selos)

| FK | Proposta padrão | Alternativa |
|---|---|---|
| `promotions.seal_id` | **CASCADE** — a promoção é do selo; selo apagado, promoção some. | RESTRICT: só apaga o selo depois de encerrar as promoções. |
| `promotions.seal_bond_id` | **SET NULL** — a promoção nasceu de um vínculo selo↔look, mas continua valendo sob o selo se o look for apagado. | CASCADE: promoção morre com o vínculo. |
| `promotion_redemptions.seal_bond_id` | **CASCADE** — resgate atrelado ao vínculo. | SET NULL (exige tornar a coluna anulável). |

Sem resposta, aplico a proposta padrão.

## 5. FKs novas (referências que hoje não têm constraint)

Hoje, `DELETE FROM users` deixaria órfãos nestas tabelas. A migration **conta os órfãos antes** e **aborta** se
houver algum (não apaga nada sozinha); a limpeza, se necessária, vira uma migration própria, revisada.

| Nova FK | ON DELETE |
|---|---|
| `challenge_events.user_id`, `challenge_notes.user_id`, `challenge_participants.user_id`, `challenge_votes.voter_user_id` → `users` | CASCADE |
| `challenge_votes.entry_scheme_id` → `schemes` | CASCADE |
| `item_embeddings.user_id`, `moderation_queue.user_id`, `ranking_positions.user_id` → `users` | CASCADE |
| `piece_usage_diary.user_id`, `wardrobe_availability_log.user_id` → `users` | CASCADE |
| `processing_jobs_log.user_id`, `render_jobs_log.user_id` → `users` | CASCADE |
| `processing_jobs_log.pipeline_job_id`, `render_jobs_log.pipeline_job_id`, `quality_scores.pipeline_job_id` → `pipeline_jobs` | CASCADE |
| `render_jobs_log.scheme_id` → `schemes` | CASCADE |
| `promotions.owner_user_id`, `promotion_redemptions.issuer_user_id` → `users` | CASCADE |
| `comments.parent_comment_id` → `comments` (respostas da thread) | CASCADE |
| `ai_inference_log.user_id` → `users` | SET NULL |

**Ficam sem FK, por natureza**: as 9 colunas polimórficas do §1 (item 6), ids de sistemas externos
(`pipeline_jobs.external_job_id`, `correlation_id`, `fai_points_ledger.ref_id`), ids de configuração
(`*_background_id`, `room_catalog.mold_id`) e agrupamentos lógicos (`grouping_id`, `hype_group_id`,
`refresh_tokens.family_id`). Elas entram no `verify` (procura de órfãos).

## 6. Diff proposto — schema

### 6.1 `V29__integridade_referencial_por_dominio` (migration Java do Flyway)

Uma migration Java porque o MySQL não tem `DROP FOREIGN KEY IF EXISTS` nem laço em SQL puro, e os nomes das
constraints **não são presumidos**: são lidos do `INFORMATION_SCHEMA` (algumas vieram de `CONSTRAINT fk_...`,
outras foram geradas pelo MySQL).

```java
// fai-infrastructure/persistence-mysql/src/main/java/db/migration/V29__integridade_referencial_por_dominio.java
public class V29__integridade_referencial_por_dominio extends BaseJavaMigration {
    record Fk(String table, String column, String refTable, String onDelete) {}

    static final List<Fk> POLICY = List.of(               // gerada de docs/banco/integridade/fks_atuais.tsv
        new Fk("wardrobe_items", "user_id", "users", "CASCADE"),
        new Fk("schemes", "original_scheme_id", "schemes", "SET NULL"),
        new Fk("brands", "brand_profile_id", "brand_profiles", "SET NULL"),
        // ... 55 CASCADE + 5 SET NULL + 3 REVIEW + 20 novas (§5)
    );

    @Override public void migrate(Context ctx) throws Exception {
        Connection c = ctx.getConnection();
        for (Fk fk : POLICY) {
            Optional<Existing> cur = existing(c, fk);               // INFORMATION_SCHEMA: nome real + regra atual
            if (cur.isPresent() && cur.get().deleteRule().equals(fk.onDelete())) continue;   // idempotente
            long orphans = orphans(c, fk);                          // LEFT JOIN ... WHERE pai IS NULL
            if (orphans > 0) throw new FlywayException(fk + ": " + orphans + " órfãos — nada foi alterado nesta FK");
            if ("SET NULL".equals(fk.onDelete()) && !nullable(c, fk)) throw new FlywayException(fk + ": coluna NOT NULL");
            // uma única ALTER por FK: a tabela nunca fica sem a constraint entre dois comandos;
            // o índice da coluna é preservado (o MySQL só remove a FK, não o índice que ela usa)
            exec(c, "ALTER TABLE `" + fk.table() + "` "
                    + cur.map(e -> "DROP FOREIGN KEY `" + e.name() + "`, ").orElse("")
                    + "ADD CONSTRAINT `" + name(fk) + "` FOREIGN KEY (`" + fk.column() + "`) REFERENCES `"
                    + fk.refTable() + "` (`id`) ON DELETE " + fk.onDelete() + " ON UPDATE RESTRICT");
        }
    }
}
```

- **Idempotente**: DDL no MySQL não é transacional; se cair no meio, rodar de novo continua de onde parou
  (FK já na regra certa é pulada).
- **Falha segura**: órfão ou coluna incompatível → aborta antes de tocar naquela FK, com a contagem no erro.
- **Sem `FOREIGN_KEY_CHECKS = 0`** em nenhum ponto.
- Teste de contrato: a lista `POLICY` é comparada com o `fks_atuais.tsv` (nada de FK esquecida ou divergente).

### 6.2 `V30__origem_da_conta_e_fixtures.sql`

```sql
ALTER TABLE users
  ADD COLUMN account_origin VARCHAR(20) NOT NULL DEFAULT 'REAL',
  ADD COLUMN fixture_key    VARCHAR(80) NULL,
  ADD CONSTRAINT ck_users_account_origin CHECK (account_origin IN ('REAL','TEST_SEED','DEMO','SYSTEM')),
  ADD CONSTRAINT ux_users_fixture_key UNIQUE (fixture_key);
UPDATE users SET account_origin = 'TEST_SEED' WHERE test_account = TRUE;        -- contas e2e_* de hoje

-- test_account deixa de ser gravado: vira coluna GERADA a partir da origem (sem redundância, consultas e
-- índice atuais continuam funcionando)
ALTER TABLE users DROP INDEX ix_users_test_account, DROP COLUMN test_account;
ALTER TABLE users ADD COLUMN test_account BOOLEAN
  GENERATED ALWAYS AS (account_origin IN ('TEST_SEED','DEMO')) STORED;
CREATE INDEX ix_users_test_account ON users (test_account);
CREATE INDEX ix_users_account_origin ON users (account_origin);

ALTER TABLE brands
  ADD COLUMN catalog_origin VARCHAR(20) NOT NULL DEFAULT 'REAL',
  ADD COLUMN fixture_key    VARCHAR(80) NULL,
  ADD CONSTRAINT ck_brands_catalog_origin CHECK (catalog_origin IN ('REAL','SEED','DEMO')),
  ADD CONSTRAINT ux_brands_fixture_key UNIQUE (fixture_key);
```

Código: `User.accountOrigin` (enum `AccountOrigin`) e `fixtureKey`; `testAccount` passa a ser só leitura
(`insertable = false, updatable = false`); o cadastro com prefixo `e2e_` grava `TEST_SEED`; a regra da busca
("conteúdo de teste só para quem também é de teste") passa a olhar a origem em vez do prefixo do username.

## 7. Diff proposto — Demo/Test Data Pipeline

### 7.1 Onde o pipeline roda (adaptação à arquitetura real)

Um seed em Python com SQL direto **não serve** neste projeto: precisaria (a) duplicar a criptografia AES-GCM dos
campos pessoais, o hash do e-mail e o Argon2 das senhas; (b) alcançar um MySQL que, em produção, só existe na rede
privada do Railway; e (c) deixaria feed (Cassandra) e busca (OpenSearch) sem os dados — ou com órfãos no reset.

Proposta: **o núcleo roda dentro da API** (`fai-application/.../demo/DemoDataService`), usando as mesmas entidades,
conversores, portas de feed/busca e o mesmo `PasswordEncoder`; os comandos pedidos ficam em `scripts/demo/` como
CLIs finas que chamam endpoints de administração:

| Comando | Endpoint (ADMIN + dev gate + trava de ambiente) |
|---|---|
| `python scripts/demo/seed_demo_environment.py [--profile=frontend\|full]` | `POST /api/admin/demo/seed?profile=` |
| `python scripts/demo/verify_demo_environment.py` | `GET /api/admin/demo/verify` |
| `python scripts/demo/reset_demo_environment.py --dry-run` | `POST /api/admin/demo/reset?dryRun=true` → plano + `planHash` |
| `python scripts/demo/reset_demo_environment.py` | `POST /api/admin/demo/reset?confirm=<planHash>` (faz o dry-run, mostra, pede confirmação e só executa se o plano não mudou) |
| `python scripts/demo/reset_demo_catalog.py [--dry-run]` | `POST /api/admin/demo/catalog/reset` (só `brands.catalog_origin = 'DEMO'` sem referências) |

Os `seed_demo_users.py`, `seed_demo_brands.py`, `seed_demo_social_graph.py` etc. viram etapas (`--only=users,brands`)
do mesmo comando, para a ordem nunca depender de quem chama. Fixtures versionadas em
`fai-application/src/main/resources/demo/fixtures/{users,brands,wardrobes,schemes,posts,social_graph}.json`
(revisadas junto com o código; o endpoint não aceita fixture vinda de fora).

### 7.2 Regras

- **Chave**: `fixture_key` imutável (`USER_EMPTY`, `USER_PUBLIC`, `USER_PRIVATE`, `USER_HEAVY`, `USER_MARKETPLACE`,
  `BRAND_EMPTY`, `BRAND_FULL`, `BRAND_VERIFIED`, `CELEBRITY_EMPTY_01`, `CELEBRITY_FULL_01`, `CREATOR_BASIC`,
  `CREATOR_POPULAR`); nome e e-mail podem mudar sem duplicar nada.
- **Idempotência**: `findByFixtureKey → atualiza | cria`; filhos (peças, looks...) também têm chave determinística
  (`USER_HEAVY#piece-0137`), guardada no `fixture_key` da linha ou derivada em UUID v5 — rodar N vezes dá o mesmo estado.
- **Determinismo**: `new Random(2026)` por persona; nada de `now()` nos dados (datas relativas a uma âncora fixa).
- **Ordem**: marcas demo → contas → perfis de marca/celebridade → referências de catálogo → peças → looks →
  publicação (feed) → follows → reações → comentários → salvos → notificações.
- **Transação**: uma por execução no MySQL (`@Transactional`, rollback total em erro). Feed e busca são
  atualizados **depois do commit** (idempotentes; o `verify` aponta o que faltar e o seed reaplica).
- **E-mails**: `@example.test` (TLD reservado pela RFC 2606/6761), conta já verificada; e o adaptador de e-mail
  passa a **recusar** domínios reservados (`.test`, `.example`, `.invalid`, `example.com/net/org`) — nunca sai e-mail.
- **Senha das contas demo**: uma só, de `FASHIONAI_DEMO_PASSWORD` (gerada no Railway); nunca no repositório.
- **Marcas e celebridades fictícias**: "Maison Demo", "Atelier Exemplo", "Celebrity Demo 01"… — nada de
  `BRAND_NIKE_DEMO`: conta demo com nome de marca real seria confundível com conta oficial. Peças podem citar
  marcas reais do catálogo global (`brand_id`), que é só referência.
- **Visibilidade**: contas demo são `account_origin = DEMO` → `test_account = TRUE` → continuam invisíveis para
  contas reais na busca/vitrine/dashboard (regra da V22), visíveis entre si.

### 7.3 Reset seguro

1. Plano: ids com `account_origin IN ('TEST_SEED','DEMO')`; contagens por tabela (o dry-run do pedido).
2. **Trava**: `realUsersToDelete` precisa ser 0 (conta de novo dentro da transação, com `FOR UPDATE`); se não, ABORT.
3. Remove, em SQL explícito, as linhas **polimórficas** que apontam para conteúdo demo (reações, comentários,
   salvos, compartilhamentos, notificações, moderação).
4. `DELETE FROM users WHERE account_origin IN ('TEST_SEED','DEMO')` → as cascatas do §6.1 limpam o resto.
5. Commit; depois: feed (partições do Cassandra das contas demo), busca (documentos das peças/looks demo) e
   objetos de mídia demo (as fixtures usam imagens estáticas de `/assets`, então normalmente nenhum).
6. **Mantém** `brands` e `room_catalog` (log `[KEEP]`); catálogo demo só com o comando separado.

### 7.4 Trava de produção

Desligado por padrão: `FASHIONAI_DEMO_ENABLED=false`. Em ambiente de produção (`RAILWAY_ENVIRONMENT_NAME` ou
`APP_ENV` = `production`) exige **também** `FASHIONAI_DEMO_ALLOW_PRODUCTION=true`, e o log de auditoria
registra quem rodou o quê.

### 7.5 Testes automatizados (MySQL real via Testcontainers, migrado pelo Flyway)

| Teste | Esperado |
|---|---|
| A — seed duas vezes | mesmas contagens, zero duplicatas (`fixture_key` único) |
| B — apagar `USER_PUBLIC` | peças, looks, reações, follows, salvos, notificações, perfis somem (cascata) |
| C — apagar `brands` com peças | bloqueado (erro 1451) |
| D — apagar item de `room_catalog` possuído | bloqueado |
| E — reset | 0 contas demo; contas reais, marcas e catálogo intactos |
| F — contrato | `POLICY` da V29 = `fks_atuais.tsv`; nenhuma FK nova sem política |

## 8. Decisões que preciso de você

1. **Aprovar** o diff de FKs (§2–§5) e as 3 linhas REVIEW (§4) — sem resposta, vale a proposta padrão.
2. **Onde rodar o ambiente demo.** No Railway só existe o ambiente `production` (é ele que o fai-network.com
   usa, atrás do dev gate). Recomendo criar um ambiente **staging** no Railway (cópia dos serviços, banco
   próprio) e deixar o demo desligado em `production`. A alternativa é liberar em `production` com
   `FASHIONAI_DEMO_ALLOW_PRODUCTION=true` — funciona porque contas demo já ficam invisíveis para contas reais,
   mas mistura os dois universos no mesmo banco.
3. **Comentários de conta apagada**: CASCADE (proposto, igual ao pedido). Para preservar threads no futuro,
   anonimizar autor — fica fora agora.
