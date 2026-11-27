-- Exercício 15 (valor mínimo de compra do cupom): a combinação FLAIR já tem flair_combinations.min_purchase; aqui entram
-- a moeda contratada dela, o mínimo e a moeda da promoção de selo, e a cópia (snapshot) dos dois em cada cupom emitido
-- (docs/banco-de-dados/solucoes/15-minimo-compra.md). CHECKs: mínimo nunca negativo (NULL = sem mínimo / sem registro).
-- Idempotente como a V119: no Railway as colunas e os CHECKs são criados à mão
-- (docs/banco-de-dados/solucoes/sql/railway/15-minimo-compra.sql); aqui cada passo confere o que já existe e só cria o que
-- falta, com os mesmos nomes. Nada é preenchido: oferta antiga fica sem moeda e cupom antigo fica sem snapshot.
-- Se existir min_purchase negativo em flair_combinations, o CHECK falha com o erro 3819 e a migração para: o valor é
-- revisado por quem responde pelos dados, não é trocado por zero aqui.

-- ofertas
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'promotions' AND COLUMN_NAME = 'min_purchase') = 0,
    'ALTER TABLE promotions ADD COLUMN min_purchase DECIMAL(10,2) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'promotions' AND COLUMN_NAME = 'min_purchase_currency') = 0,
    'ALTER TABLE promotions ADD COLUMN min_purchase_currency CHAR(3) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flair_combinations' AND COLUMN_NAME = 'min_purchase_currency') = 0,
    'ALTER TABLE flair_combinations ADD COLUMN min_purchase_currency CHAR(3) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- cupons emitidos: condição da hora da emissão
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'promotion_redemptions' AND COLUMN_NAME = 'min_purchase_snapshot') = 0,
    'ALTER TABLE promotion_redemptions ADD COLUMN min_purchase_snapshot DECIMAL(10,2) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'promotion_redemptions' AND COLUMN_NAME = 'min_purchase_currency_snapshot') = 0,
    'ALTER TABLE promotion_redemptions ADD COLUMN min_purchase_currency_snapshot CHAR(3) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flair_redemptions' AND COLUMN_NAME = 'min_purchase_snapshot') = 0,
    'ALTER TABLE flair_redemptions ADD COLUMN min_purchase_snapshot DECIMAL(10,2) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flair_redemptions' AND COLUMN_NAME = 'min_purchase_currency_snapshot') = 0,
    'ALTER TABLE flair_redemptions ADD COLUMN min_purchase_currency_snapshot CHAR(3) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- mínimo nunca negativo; reconhece pelo conteúdo um CHECK já criado à mão com outro nome
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS tc JOIN information_schema.CHECK_CONSTRAINTS cc
            ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
            WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'flair_combinations' AND tc.CONSTRAINT_TYPE = 'CHECK'
            AND (tc.CONSTRAINT_NAME = 'ck_flair_min_purchase' OR cc.CHECK_CLAUSE LIKE '%min_purchase%')) = 0,
    'ALTER TABLE flair_combinations ADD CONSTRAINT ck_flair_min_purchase CHECK (min_purchase IS NULL OR min_purchase >= 0)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS tc JOIN information_schema.CHECK_CONSTRAINTS cc
            ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
            WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'promotions' AND tc.CONSTRAINT_TYPE = 'CHECK'
            AND (tc.CONSTRAINT_NAME = 'ck_promotion_min_purchase' OR cc.CHECK_CLAUSE LIKE '%min_purchase%')) = 0,
    'ALTER TABLE promotions ADD CONSTRAINT ck_promotion_min_purchase CHECK (min_purchase IS NULL OR min_purchase >= 0)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS tc JOIN information_schema.CHECK_CONSTRAINTS cc
            ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
            WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'promotion_redemptions' AND tc.CONSTRAINT_TYPE = 'CHECK'
            AND (tc.CONSTRAINT_NAME = 'ck_pr_min_snapshot' OR cc.CHECK_CLAUSE LIKE '%min_purchase_snapshot%')) = 0,
    'ALTER TABLE promotion_redemptions ADD CONSTRAINT ck_pr_min_snapshot CHECK (min_purchase_snapshot IS NULL OR min_purchase_snapshot >= 0)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS tc JOIN information_schema.CHECK_CONSTRAINTS cc
            ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
            WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'flair_redemptions' AND tc.CONSTRAINT_TYPE = 'CHECK'
            AND (tc.CONSTRAINT_NAME = 'ck_fr_min_snapshot' OR cc.CHECK_CLAUSE LIKE '%min_purchase_snapshot%')) = 0,
    'ALTER TABLE flair_redemptions ADD CONSTRAINT ck_fr_min_snapshot CHECK (min_purchase_snapshot IS NULL OR min_purchase_snapshot >= 0)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
