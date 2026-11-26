-- Exercício 09 (categoria principal da marca): tabela de opções categorias_marca e FK opcional em brand_profiles
-- (docs/banco-de-dados/solucoes/09-categoria-marca.md). brand_profiles é o perfil institucional; a tabela brands (marcas do
-- catálogo) não muda. O texto livre antigo brand_profiles.fashion_category fica como está: nenhum valor é convertido em
-- categoria, e perfil legado continua com a FK nula ("não informada").
-- Idempotente como a V112: no Railway a tabela, as linhas, a coluna e a FK são criadas à mão antes do deploy, com o SQL de
-- docs/banco-de-dados/solucoes/sql/railway/09-categoria-marca.sql; aqui cada passo confere o que já existe e só cria o
-- que falta, com os mesmos nomes. Linhas existentes não são alteradas.
-- FK RESTRICT nos dois sentidos: categoria em uso não é apagada (é desativada, ativo = FALSE) e o perfil nunca some junto.

CREATE TABLE IF NOT EXISTS categorias_marca (
    id CHAR(36) NOT NULL PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL,
    nome VARCHAR(80) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT uq_categorias_marca_codigo UNIQUE (codigo)
);

-- tabela criada à mão sem uma das colunas que a entidade CategoriaMarca lê (precedente: V107/V110, sem ativo)
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categorias_marca' AND COLUMN_NAME = 'ativo') = 0,
    'ALTER TABLE categorias_marca ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categorias_marca' AND COLUMN_NAME = 'created_at') = 0,
    'ALTER TABLE categorias_marca ADD COLUMN created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categorias_marca' AND COLUMN_NAME = 'updated_at') = 0,
    'ALTER TABLE categorias_marca ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categorias_marca' AND COLUMN_NAME = 'created_by') = 0,
    'ALTER TABLE categorias_marca ADD COLUMN created_by VARCHAR(80) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categorias_marca' AND COLUMN_NAME = 'last_modified_by') = 0,
    'ALTER TABLE categorias_marca ADD COLUMN last_modified_by VARCHAR(80) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sementes uma a uma, pelo código (não dependem do UNIQUE): o que já existe fica como está, com o id e o nome de antes
INSERT INTO categorias_marca (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'CASUAL', 'Casual', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM categorias_marca WHERE codigo = 'CASUAL');
INSERT INTO categorias_marca (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'ESPORTIVA', 'Esportiva', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM categorias_marca WHERE codigo = 'ESPORTIVA');
INSERT INTO categorias_marca (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'LUXO', 'Luxo', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM categorias_marca WHERE codigo = 'LUXO');
INSERT INTO categorias_marca (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'STREETWEAR', 'Streetwear', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM categorias_marca WHERE codigo = 'STREETWEAR');
INSERT INTO categorias_marca (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'ALFAIATARIA', 'Alfaiataria', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM categorias_marca WHERE codigo = 'ALFAIATARIA');
INSERT INTO categorias_marca (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'SUSTENTAVEL', 'Moda sustentável', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM categorias_marca WHERE codigo = 'SUSTENTAVEL');

-- tabela criada à mão sem índice único em codigo: cria o uq_categorias_marca_codigo, desde que não haja código repetido
-- (repetido só existe se foi cadastrado à mão duas vezes; a conferência do doc mostra quantas linhas há por código)
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.STATISTICS s WHERE s.TABLE_SCHEMA = DATABASE() AND s.TABLE_NAME = 'categorias_marca'
            AND s.NON_UNIQUE = 0 AND s.COLUMN_NAME = 'codigo' AND s.SEQ_IN_INDEX = 1
            AND NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS o WHERE o.TABLE_SCHEMA = s.TABLE_SCHEMA
                AND o.TABLE_NAME = s.TABLE_NAME AND o.INDEX_NAME = s.INDEX_NAME AND o.SEQ_IN_INDEX > 1)) = 0
        AND (SELECT COUNT(*) FROM (SELECT codigo FROM categorias_marca GROUP BY codigo HAVING COUNT(*) > 1) AS repetidos) = 0,
    'ALTER TABLE categorias_marca ADD CONSTRAINT uq_categorias_marca_codigo UNIQUE (codigo)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- a coluna da FK segue o charset e a collation de categorias_marca.id (FK de texto com collations diferentes: erro 3780)
SET @charset_categoria = (SELECT CHARACTER_SET_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categorias_marca' AND COLUMN_NAME = 'id');
SET @collation_categoria = (SELECT COLLATION_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categorias_marca' AND COLUMN_NAME = 'id');
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'brand_profiles' AND COLUMN_NAME = 'categoria_marca_id') = 0,
    CONCAT('ALTER TABLE brand_profiles ADD COLUMN categoria_marca_id CHAR(36) CHARACTER SET ', @charset_categoria, ' COLLATE ', @collation_categoria, ' NULL'),
    'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
-- coluna criada à mão com outra collation e ainda sem a FK: passa a seguir categorias_marca.id (só guarda UUIDs)
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'brand_profiles' AND COLUMN_NAME = 'categoria_marca_id' AND COLLATION_NAME = @collation_categoria) = 0
        AND (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'brand_profiles' AND COLUMN_NAME = 'categoria_marca_id' AND REFERENCED_TABLE_NAME IS NOT NULL) = 0,
    CONCAT('ALTER TABLE brand_profiles MODIFY categoria_marca_id CHAR(36) CHARACTER SET ', @charset_categoria, ' COLLATE ', @collation_categoria, ' NULL'),
    'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'brand_profiles' AND COLUMN_NAME = 'categoria_marca_id' AND REFERENCED_TABLE_NAME = 'categorias_marca') = 0,
    'ALTER TABLE brand_profiles ADD CONSTRAINT fk_brand_profiles_categoria_marca FOREIGN KEY (categoria_marca_id) REFERENCES categorias_marca (id) ON DELETE RESTRICT ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
