-- MATERIAL DIDÁTICO: NÃO EXECUTADO. Não é migration pronta para produção.
-- Leia ../15-minimo-compra.md e 00-inspecao-integridade.sql antes de adaptar.
-- DDL apenas em MySQL 8 de teste; verificar objetos/constraints e versão Flyway livre.
-- @owner_id, @piece_id etc. são parâmetros a preencher no laboratório, não autorização.

SELECT id,min_purchase FROM flair_combinations WHERE min_purchase<0;
ALTER TABLE promotions ADD COLUMN min_purchase DECIMAL(10,2) NULL,
  ADD COLUMN min_purchase_currency CHAR(3) NULL;
ALTER TABLE flair_combinations ADD COLUMN min_purchase_currency CHAR(3) NULL;
ALTER TABLE promotion_redemptions ADD COLUMN min_purchase_snapshot DECIMAL(10,2) NULL,
  ADD COLUMN min_purchase_currency_snapshot CHAR(3) NULL;
ALTER TABLE flair_redemptions ADD COLUMN min_purchase_snapshot DECIMAL(10,2) NULL,
  ADD COLUMN min_purchase_currency_snapshot CHAR(3) NULL;
-- Após revisar negativos legados e conferir CHECKs existentes:
ALTER TABLE flair_combinations ADD CONSTRAINT ck_flair_min_purchase
  CHECK(min_purchase IS NULL OR min_purchase>=0);
ALTER TABLE promotions ADD CONSTRAINT ck_promotion_min_purchase
  CHECK(min_purchase IS NULL OR min_purchase>=0);
ALTER TABLE promotion_redemptions ADD CONSTRAINT ck_pr_min_snapshot
  CHECK(min_purchase_snapshot IS NULL OR min_purchase_snapshot>=0);
ALTER TABLE flair_redemptions ADD CONSTRAINT ck_fr_min_snapshot
  CHECK(min_purchase_snapshot IS NULL OR min_purchase_snapshot>=0);
-- Não preencher snapshots/moedas antigos a partir da oferta atual sem evidência histórica.
