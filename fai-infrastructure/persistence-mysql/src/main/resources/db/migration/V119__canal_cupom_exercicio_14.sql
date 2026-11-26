-- Exercício 14 (canal de utilização do cupom): tabela de opções canais_cupom e FK opcional nas duas ofertas de cupom
-- (promotions = promoção de selo; flair_combinations = combinação FLAIR) e nos cupons emitidos de cada uma
-- (promotion_redemptions, flair_redemptions), que guardam também o código do canal na hora da emissão
-- (docs/banco-de-dados/solucoes/14-canal-cupom.md). coupon_rights não recebe canal: é o direito de resgatar, não o cupom.
-- Idempotente como a V111/V112: no Railway os objetos são criados à mão com o SQL do exercício
-- (docs/banco-de-dados/solucoes/sql/railway/14-canal-cupom.sql); aqui cada passo confere o que já existe e só cria o que
-- falta, com os mesmos nomes. Linhas existentes não são alteradas: oferta e cupom antigos ficam sem canal (não informado).
-- FK RESTRICT nos dois sentidos: um canal em uso não é apagado (é desativado, ativo = FALSE).

CREATE TABLE IF NOT EXISTS canais_cupom (
    id CHAR(36) NOT NULL PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL,
    nome VARCHAR(80) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT uq_canais_cupom_codigo UNIQUE (codigo)
);

-- tabela criada à mão sem uma das colunas que a entidade CanalCupom lê
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'canais_cupom' AND COLUMN_NAME = 'ativo') = 0,
    'ALTER TABLE canais_cupom ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'canais_cupom' AND COLUMN_NAME = 'created_at') = 0,
    'ALTER TABLE canais_cupom ADD COLUMN created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'canais_cupom' AND COLUMN_NAME = 'updated_at') = 0,
    'ALTER TABLE canais_cupom ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'canais_cupom' AND COLUMN_NAME = 'created_by') = 0,
    'ALTER TABLE canais_cupom ADD COLUMN created_by VARCHAR(80) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'canais_cupom' AND COLUMN_NAME = 'last_modified_by') = 0,
    'ALTER TABLE canais_cupom ADD COLUMN last_modified_by VARCHAR(80) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sementes uma a uma, pelo código: o que já existe fica como está, com o id e o nome de antes
INSERT INTO canais_cupom (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'LOJA_FISICA', 'Loja física', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canais_cupom WHERE codigo = 'LOJA_FISICA');
INSERT INTO canais_cupom (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'ECOMMERCE', 'E-commerce', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canais_cupom WHERE codigo = 'ECOMMERCE');
INSERT INTO canais_cupom (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'AMBOS', 'Ambos', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM canais_cupom WHERE codigo = 'AMBOS');

-- tabela criada à mão sem índice único em codigo: cria o uq_canais_cupom_codigo, desde que não haja código repetido
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.STATISTICS s WHERE s.TABLE_SCHEMA = DATABASE() AND s.TABLE_NAME = 'canais_cupom'
            AND s.NON_UNIQUE = 0 AND s.COLUMN_NAME = 'codigo' AND s.SEQ_IN_INDEX = 1
            AND NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS o WHERE o.TABLE_SCHEMA = s.TABLE_SCHEMA
                AND o.TABLE_NAME = s.TABLE_NAME AND o.INDEX_NAME = s.INDEX_NAME AND o.SEQ_IN_INDEX > 1)) = 0
        AND (SELECT COUNT(*) FROM (SELECT codigo FROM canais_cupom GROUP BY codigo HAVING COUNT(*) > 1) AS repetidos) = 0,
    'ALTER TABLE canais_cupom ADD CONSTRAINT uq_canais_cupom_codigo UNIQUE (codigo)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- as colunas de FK seguem o charset e a collation de canais_cupom.id (FK de texto com collations diferentes: erro 3780)
SET @charset_canal = (SELECT CHARACTER_SET_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'canais_cupom' AND COLUMN_NAME = 'id');
SET @collation_canal = (SELECT COLLATION_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'canais_cupom' AND COLUMN_NAME = 'id');

-- ofertas
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'promotions' AND COLUMN_NAME = 'canal_cupom_id') = 0,
    CONCAT('ALTER TABLE promotions ADD COLUMN canal_cupom_id CHAR(36) CHARACTER SET ', @charset_canal, ' COLLATE ', @collation_canal, ' NULL'), 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
-- coluna criada à mão com outra collation e ainda sem a FK: passa a seguir canais_cupom.id (só guarda UUIDs)
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'promotions' AND COLUMN_NAME = 'canal_cupom_id' AND COLLATION_NAME = @collation_canal) = 0
        AND (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'promotions' AND COLUMN_NAME = 'canal_cupom_id' AND REFERENCED_TABLE_NAME IS NOT NULL) = 0,
    CONCAT('ALTER TABLE promotions MODIFY canal_cupom_id CHAR(36) CHARACTER SET ', @charset_canal, ' COLLATE ', @collation_canal, ' NULL'),
    'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'promotions' AND COLUMN_NAME = 'canal_cupom_id' AND REFERENCED_TABLE_NAME = 'canais_cupom') = 0,
    'ALTER TABLE promotions ADD CONSTRAINT fk_promotions_canal_cupom FOREIGN KEY (canal_cupom_id) REFERENCES canais_cupom (id) ON DELETE RESTRICT ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flair_combinations' AND COLUMN_NAME = 'canal_cupom_id') = 0,
    CONCAT('ALTER TABLE flair_combinations ADD COLUMN canal_cupom_id CHAR(36) CHARACTER SET ', @charset_canal, ' COLLATE ', @collation_canal, ' NULL'), 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
-- coluna criada à mão com outra collation e ainda sem a FK: passa a seguir canais_cupom.id (só guarda UUIDs)
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flair_combinations' AND COLUMN_NAME = 'canal_cupom_id' AND COLLATION_NAME = @collation_canal) = 0
        AND (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flair_combinations' AND COLUMN_NAME = 'canal_cupom_id' AND REFERENCED_TABLE_NAME IS NOT NULL) = 0,
    CONCAT('ALTER TABLE flair_combinations MODIFY canal_cupom_id CHAR(36) CHARACTER SET ', @charset_canal, ' COLLATE ', @collation_canal, ' NULL'),
    'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flair_combinations' AND COLUMN_NAME = 'canal_cupom_id' AND REFERENCED_TABLE_NAME = 'canais_cupom') = 0,
    'ALTER TABLE flair_combinations ADD CONSTRAINT fk_flair_combinations_canal_cupom FOREIGN KEY (canal_cupom_id) REFERENCES canais_cupom (id) ON DELETE RESTRICT ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- cupons emitidos: FK e o código do canal na hora da emissão (sem backfill: a URL da loja não prova o canal de um cupom antigo)
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'promotion_redemptions' AND COLUMN_NAME = 'canal_cupom_id') = 0,
    CONCAT('ALTER TABLE promotion_redemptions ADD COLUMN canal_cupom_id CHAR(36) CHARACTER SET ', @charset_canal, ' COLLATE ', @collation_canal, ' NULL'), 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
-- coluna criada à mão com outra collation e ainda sem a FK: passa a seguir canais_cupom.id (só guarda UUIDs)
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'promotion_redemptions' AND COLUMN_NAME = 'canal_cupom_id' AND COLLATION_NAME = @collation_canal) = 0
        AND (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'promotion_redemptions' AND COLUMN_NAME = 'canal_cupom_id' AND REFERENCED_TABLE_NAME IS NOT NULL) = 0,
    CONCAT('ALTER TABLE promotion_redemptions MODIFY canal_cupom_id CHAR(36) CHARACTER SET ', @charset_canal, ' COLLATE ', @collation_canal, ' NULL'),
    'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'promotion_redemptions' AND COLUMN_NAME = 'canal_cupom_id' AND REFERENCED_TABLE_NAME = 'canais_cupom') = 0,
    'ALTER TABLE promotion_redemptions ADD CONSTRAINT fk_promotion_redemptions_canal_cupom FOREIGN KEY (canal_cupom_id) REFERENCES canais_cupom (id) ON DELETE RESTRICT ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'promotion_redemptions' AND COLUMN_NAME = 'canal_codigo_snapshot') = 0,
    'ALTER TABLE promotion_redemptions ADD COLUMN canal_codigo_snapshot VARCHAR(40) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flair_redemptions' AND COLUMN_NAME = 'canal_cupom_id') = 0,
    CONCAT('ALTER TABLE flair_redemptions ADD COLUMN canal_cupom_id CHAR(36) CHARACTER SET ', @charset_canal, ' COLLATE ', @collation_canal, ' NULL'), 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
-- coluna criada à mão com outra collation e ainda sem a FK: passa a seguir canais_cupom.id (só guarda UUIDs)
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flair_redemptions' AND COLUMN_NAME = 'canal_cupom_id' AND COLLATION_NAME = @collation_canal) = 0
        AND (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flair_redemptions' AND COLUMN_NAME = 'canal_cupom_id' AND REFERENCED_TABLE_NAME IS NOT NULL) = 0,
    CONCAT('ALTER TABLE flair_redemptions MODIFY canal_cupom_id CHAR(36) CHARACTER SET ', @charset_canal, ' COLLATE ', @collation_canal, ' NULL'),
    'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flair_redemptions' AND COLUMN_NAME = 'canal_cupom_id' AND REFERENCED_TABLE_NAME = 'canais_cupom') = 0,
    'ALTER TABLE flair_redemptions ADD CONSTRAINT fk_flair_redemptions_canal_cupom FOREIGN KEY (canal_cupom_id) REFERENCES canais_cupom (id) ON DELETE RESTRICT ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flair_redemptions' AND COLUMN_NAME = 'canal_codigo_snapshot') = 0,
    'ALTER TABLE flair_redemptions ADD COLUMN canal_codigo_snapshot VARCHAR(40) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
