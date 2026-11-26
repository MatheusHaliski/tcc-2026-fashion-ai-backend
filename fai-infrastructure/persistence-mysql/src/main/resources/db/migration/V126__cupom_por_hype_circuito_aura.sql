-- Circuito Aura, fase 1 (cupom por Hype — docs/aura/CIRCUITO_AURA.md): a oferta de cupom (promoção de selo ou combinação
-- FLAIR) pode exigir uma faixa mínima de Hype do card, e o cupom emitido guarda a faixa do card na hora da emissão
-- (queda de faixa depois não revoga o cupom). CHECKs: só os seis códigos de faixa do HypeLevel ou NULL.
-- Idempotente como as V119–V121: no Railway as colunas e os CHECKs são criados à mão
-- (docs/banco-de-dados/solucoes/sql/railway/126-cupom-por-hype.sql); aqui cada passo confere o que já existe e só cria o
-- que falta, com os mesmos nomes. Nada é preenchido: oferta antiga fica sem exigência (NULL) e cupom antigo sem registro.
-- Esta migração não toca em nenhuma tabela de Hype: nada aqui grava sinal nem muda nota.

-- ofertas: faixa mínima; cupons emitidos: faixa na emissão
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'promotions' AND COLUMN_NAME = 'min_hype_level') = 0,
    'ALTER TABLE promotions ADD COLUMN min_hype_level VARCHAR(20) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flair_combinations' AND COLUMN_NAME = 'min_hype_level') = 0,
    'ALTER TABLE flair_combinations ADD COLUMN min_hype_level VARCHAR(20) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'promotion_redemptions' AND COLUMN_NAME = 'hype_level_snapshot') = 0,
    'ALTER TABLE promotion_redemptions ADD COLUMN hype_level_snapshot VARCHAR(20) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flair_redemptions' AND COLUMN_NAME = 'hype_level_snapshot') = 0,
    'ALTER TABLE flair_redemptions ADD COLUMN hype_level_snapshot VARCHAR(20) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- só códigos de faixa válidos; reconhece pelo conteúdo um CHECK já criado à mão com outro nome
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS tc JOIN information_schema.CHECK_CONSTRAINTS cc
            ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
            WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'promotions' AND tc.CONSTRAINT_TYPE = 'CHECK'
            AND (tc.CONSTRAINT_NAME = 'ck_promotion_min_hype' OR cc.CHECK_CLAUSE LIKE '%min_hype_level%')) = 0,
    'ALTER TABLE promotions ADD CONSTRAINT ck_promotion_min_hype CHECK (min_hype_level IS NULL OR min_hype_level IN (''LOW_SIGNAL'',''NICHE'',''RELEVANT'',''HOT'',''TRENDING'',''VIRAL''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS tc JOIN information_schema.CHECK_CONSTRAINTS cc
            ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
            WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'flair_combinations' AND tc.CONSTRAINT_TYPE = 'CHECK'
            AND (tc.CONSTRAINT_NAME = 'ck_flair_min_hype' OR cc.CHECK_CLAUSE LIKE '%min_hype_level%')) = 0,
    'ALTER TABLE flair_combinations ADD CONSTRAINT ck_flair_min_hype CHECK (min_hype_level IS NULL OR min_hype_level IN (''LOW_SIGNAL'',''NICHE'',''RELEVANT'',''HOT'',''TRENDING'',''VIRAL''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS tc JOIN information_schema.CHECK_CONSTRAINTS cc
            ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
            WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'promotion_redemptions' AND tc.CONSTRAINT_TYPE = 'CHECK'
            AND (tc.CONSTRAINT_NAME = 'ck_pr_hype_snapshot' OR cc.CHECK_CLAUSE LIKE '%hype_level_snapshot%')) = 0,
    'ALTER TABLE promotion_redemptions ADD CONSTRAINT ck_pr_hype_snapshot CHECK (hype_level_snapshot IS NULL OR hype_level_snapshot IN (''LOW_SIGNAL'',''NICHE'',''RELEVANT'',''HOT'',''TRENDING'',''VIRAL''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS tc JOIN information_schema.CHECK_CONSTRAINTS cc
            ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
            WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'flair_redemptions' AND tc.CONSTRAINT_TYPE = 'CHECK'
            AND (tc.CONSTRAINT_NAME = 'ck_fr_hype_snapshot' OR cc.CHECK_CLAUSE LIKE '%hype_level_snapshot%')) = 0,
    'ALTER TABLE flair_redemptions ADD CONSTRAINT ck_fr_hype_snapshot CHECK (hype_level_snapshot IS NULL OR hype_level_snapshot IN (''LOW_SIGNAL'',''NICHE'',''RELEVANT'',''HOT'',''TRENDING'',''VIRAL''))', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
