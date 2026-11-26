-- Circuito Aura, fase 1 — cupom por Hype. SQL simples para rodar À MÃO no console do Railway (MySQL 9.7), no banco da
-- API. Os nomes são os mesmos da migração V126__cupom_por_hype_circuito_aura.sql, que depois não muda nada. Rode uma
-- vez, de cima para baixo. Comando já executado dá aviso (1060 coluna existe, 3822 CHECK repetido): pule e siga.
-- Nenhum comando daqui toca nas tabelas de Hype (hype_scores, hype_signal_daily, hype_milestones).

-- 1) Diagnóstico (só leitura). As duas primeiras consultas mostram o que já existe (vazio = nada criado ainda).
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME IN ('min_hype_level', 'hype_level_snapshot') ORDER BY 1, 2;
SELECT tc.TABLE_NAME, tc.CONSTRAINT_NAME, cc.CHECK_CLAUSE FROM information_schema.TABLE_CONSTRAINTS tc
 JOIN information_schema.CHECK_CONSTRAINTS cc ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
 WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.CONSTRAINT_TYPE = 'CHECK'
   AND tc.TABLE_NAME IN ('promotions', 'flair_combinations', 'promotion_redemptions', 'flair_redemptions');
--    Tamanho das quatro tabelas (as colunas entram como NULL; em MySQL 8+/9 o ADD COLUMN é instantâneo).
SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('promotions', 'flair_combinations', 'promotion_redemptions', 'flair_redemptions');

-- 2) Ofertas: faixa mínima de Hype do card (NULL = oferta sem exigência; é o caso de todas as ofertas atuais).
ALTER TABLE promotions ADD COLUMN min_hype_level VARCHAR(20) NULL;
ALTER TABLE flair_combinations ADD COLUMN min_hype_level VARCHAR(20) NULL;

-- 3) Cupons emitidos: faixa do card na hora da emissão. Os cupons antigos ficam sem registro (NULL), de propósito.
ALTER TABLE promotion_redemptions ADD COLUMN hype_level_snapshot VARCHAR(20) NULL;
ALTER TABLE flair_redemptions ADD COLUMN hype_level_snapshot VARCHAR(20) NULL;

-- 4) Só os seis códigos de faixa (NULL continua aceito).
ALTER TABLE promotions ADD CONSTRAINT ck_promotion_min_hype CHECK (min_hype_level IS NULL OR min_hype_level IN ('LOW_SIGNAL','NICHE','RELEVANT','HOT','TRENDING','VIRAL'));
ALTER TABLE flair_combinations ADD CONSTRAINT ck_flair_min_hype CHECK (min_hype_level IS NULL OR min_hype_level IN ('LOW_SIGNAL','NICHE','RELEVANT','HOT','TRENDING','VIRAL'));
ALTER TABLE promotion_redemptions ADD CONSTRAINT ck_pr_hype_snapshot CHECK (hype_level_snapshot IS NULL OR hype_level_snapshot IN ('LOW_SIGNAL','NICHE','RELEVANT','HOT','TRENDING','VIRAL'));
ALTER TABLE flair_redemptions ADD CONSTRAINT ck_fr_hype_snapshot CHECK (hype_level_snapshot IS NULL OR hype_level_snapshot IN ('LOW_SIGNAL','NICHE','RELEVANT','HOT','TRENDING','VIRAL'));

-- 5) Conferência final (só leitura): 4 colunas VARCHAR(20) anuláveis e 4 CHECKs.
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME IN ('min_hype_level', 'hype_level_snapshot') ORDER BY 1, 2;
SELECT tc.TABLE_NAME, tc.CONSTRAINT_NAME, cc.CHECK_CLAUSE FROM information_schema.TABLE_CONSTRAINTS tc
 JOIN information_schema.CHECK_CONSTRAINTS cc ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
 WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.CONSTRAINT_NAME IN ('ck_promotion_min_hype', 'ck_flair_min_hype', 'ck_pr_hype_snapshot', 'ck_fr_hype_snapshot');
