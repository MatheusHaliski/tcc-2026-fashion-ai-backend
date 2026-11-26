-- Exercício 15 — valor mínimo de compra do cupom. SQL simples para rodar À MÃO no console do Railway (MySQL 9.7),
-- no banco da API. Os nomes são os mesmos da migração V120__minimo_compra_cupom_exercicio_15.sql, que depois não muda
-- nada. Rode uma vez, de cima para baixo. Comando já executado dá aviso (1060 coluna existe, 3822 CHECK repetido):
-- pule e siga.

-- 1) Diagnóstico (só leitura). A primeira consulta precisa voltar VAZIA: um mínimo negativo antigo faz o CHECK do
--    passo 4 falhar com o erro 3819. Se voltar linha, revise o valor com a loja antes; não troque por zero sem conferir.
SELECT id, name, min_purchase FROM flair_combinations WHERE min_purchase < 0;
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME LIKE 'min_purchase%' ORDER BY 1, 2;
SELECT tc.TABLE_NAME, tc.CONSTRAINT_NAME, cc.CHECK_CLAUSE FROM information_schema.TABLE_CONSTRAINTS tc
 JOIN information_schema.CHECK_CONSTRAINTS cc ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
 WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.CONSTRAINT_TYPE = 'CHECK'
   AND tc.TABLE_NAME IN ('promotions', 'flair_combinations', 'promotion_redemptions', 'flair_redemptions');

-- 2) Ofertas: mínimo e moeda da promoção de selo; moeda da combinação FLAIR (o mínimo dela já existe).
ALTER TABLE promotions ADD COLUMN min_purchase DECIMAL(10,2) NULL;
ALTER TABLE promotions ADD COLUMN min_purchase_currency CHAR(3) NULL;
ALTER TABLE flair_combinations ADD COLUMN min_purchase_currency CHAR(3) NULL;

-- 3) Cupons emitidos: mínimo e moeda da hora da emissão. Os cupons antigos ficam sem registro (NULL), de propósito.
ALTER TABLE promotion_redemptions ADD COLUMN min_purchase_snapshot DECIMAL(10,2) NULL;
ALTER TABLE promotion_redemptions ADD COLUMN min_purchase_currency_snapshot CHAR(3) NULL;
ALTER TABLE flair_redemptions ADD COLUMN min_purchase_snapshot DECIMAL(10,2) NULL;
ALTER TABLE flair_redemptions ADD COLUMN min_purchase_currency_snapshot CHAR(3) NULL;

-- 4) Mínimo nunca negativo (NULL continua aceito).
ALTER TABLE flair_combinations ADD CONSTRAINT ck_flair_min_purchase CHECK (min_purchase IS NULL OR min_purchase >= 0);
ALTER TABLE promotions ADD CONSTRAINT ck_promotion_min_purchase CHECK (min_purchase IS NULL OR min_purchase >= 0);
ALTER TABLE promotion_redemptions ADD CONSTRAINT ck_pr_min_snapshot CHECK (min_purchase_snapshot IS NULL OR min_purchase_snapshot >= 0);
ALTER TABLE flair_redemptions ADD CONSTRAINT ck_fr_min_snapshot CHECK (min_purchase_snapshot IS NULL OR min_purchase_snapshot >= 0);

-- 5) Conferência final (só leitura): 8 colunas min_purchase% (a de flair_combinations já existia) e 4 CHECKs.
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME LIKE 'min_purchase%' ORDER BY 1, 2;
SELECT tc.TABLE_NAME, tc.CONSTRAINT_NAME, cc.CHECK_CLAUSE FROM information_schema.TABLE_CONSTRAINTS tc
 JOIN information_schema.CHECK_CONSTRAINTS cc ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
 WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.CONSTRAINT_NAME IN ('ck_flair_min_purchase', 'ck_promotion_min_purchase', 'ck_pr_min_snapshot', 'ck_fr_min_snapshot');
