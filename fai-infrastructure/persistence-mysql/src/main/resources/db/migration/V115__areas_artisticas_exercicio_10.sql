-- Exercício 10 (área artística principal da celebridade): tabela de opções areas_artisticas e FK opcional em
-- celebrity_profiles (docs/banco-de-dados/solucoes/10-area-artistica.md). A lista livre celebrity_profiles.areas_json
-- fica como está: nenhuma área da lista vira "principal" sozinha, e perfil legado continua com a FK nula.
-- Idempotente como a V112: no Railway a tabela, as linhas, a coluna e a FK são criadas à mão antes do deploy, com o SQL de
-- docs/banco-de-dados/solucoes/sql/railway/10-area-artistica.sql; aqui cada passo confere o que já existe e só cria o
-- que falta, com os mesmos nomes. Linhas existentes não são alteradas.
-- FK RESTRICT nos dois sentidos: área em uso não é apagada (é desativada, ativo = FALSE) e o perfil nunca some junto.

CREATE TABLE IF NOT EXISTS areas_artisticas (
    id CHAR(36) NOT NULL PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL,
    nome VARCHAR(80) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT uq_areas_artisticas_codigo UNIQUE (codigo)
);

-- tabela criada à mão sem uma das colunas que a entidade AreaArtistica lê (precedente: V107/V110, sem ativo)
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'areas_artisticas' AND COLUMN_NAME = 'ativo') = 0,
    'ALTER TABLE areas_artisticas ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'areas_artisticas' AND COLUMN_NAME = 'created_at') = 0,
    'ALTER TABLE areas_artisticas ADD COLUMN created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'areas_artisticas' AND COLUMN_NAME = 'updated_at') = 0,
    'ALTER TABLE areas_artisticas ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'areas_artisticas' AND COLUMN_NAME = 'created_by') = 0,
    'ALTER TABLE areas_artisticas ADD COLUMN created_by VARCHAR(80) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'areas_artisticas' AND COLUMN_NAME = 'last_modified_by') = 0,
    'ALTER TABLE areas_artisticas ADD COLUMN last_modified_by VARCHAR(80) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sementes uma a uma, pelo código (não dependem do UNIQUE): o que já existe fica como está, com o id e o nome de antes
INSERT INTO areas_artisticas (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'MUSICA', 'Música', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM areas_artisticas WHERE codigo = 'MUSICA');
INSERT INTO areas_artisticas (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'CINEMA', 'Cinema', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM areas_artisticas WHERE codigo = 'CINEMA');
INSERT INTO areas_artisticas (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'MODA', 'Moda', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM areas_artisticas WHERE codigo = 'MODA');
INSERT INTO areas_artisticas (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'TELEVISAO', 'Televisão', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM areas_artisticas WHERE codigo = 'TELEVISAO');
INSERT INTO areas_artisticas (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'TEATRO', 'Teatro', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM areas_artisticas WHERE codigo = 'TEATRO');
INSERT INTO areas_artisticas (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'DANCA', 'Dança', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM areas_artisticas WHERE codigo = 'DANCA');

-- tabela criada à mão sem índice único em codigo: cria o uq_areas_artisticas_codigo, desde que não haja código repetido
-- (repetido só existe se foi cadastrado à mão duas vezes; a conferência do doc mostra quantas linhas há por código)
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.STATISTICS s WHERE s.TABLE_SCHEMA = DATABASE() AND s.TABLE_NAME = 'areas_artisticas'
            AND s.NON_UNIQUE = 0 AND s.COLUMN_NAME = 'codigo' AND s.SEQ_IN_INDEX = 1
            AND NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS o WHERE o.TABLE_SCHEMA = s.TABLE_SCHEMA
                AND o.TABLE_NAME = s.TABLE_NAME AND o.INDEX_NAME = s.INDEX_NAME AND o.SEQ_IN_INDEX > 1)) = 0
        AND (SELECT COUNT(*) FROM (SELECT codigo FROM areas_artisticas GROUP BY codigo HAVING COUNT(*) > 1) AS repetidos) = 0,
    'ALTER TABLE areas_artisticas ADD CONSTRAINT uq_areas_artisticas_codigo UNIQUE (codigo)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- a coluna da FK segue o charset e a collation de areas_artisticas.id (FK de texto com collations diferentes: erro 3780)
SET @charset_area = (SELECT CHARACTER_SET_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'areas_artisticas' AND COLUMN_NAME = 'id');
SET @collation_area = (SELECT COLLATION_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'areas_artisticas' AND COLUMN_NAME = 'id');
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'celebrity_profiles' AND COLUMN_NAME = 'area_artistica_principal_id') = 0,
    CONCAT('ALTER TABLE celebrity_profiles ADD COLUMN area_artistica_principal_id CHAR(36) CHARACTER SET ', @charset_area, ' COLLATE ', @collation_area, ' NULL'),
    'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
-- coluna criada à mão com outra collation e ainda sem a FK: passa a seguir areas_artisticas.id (só guarda UUIDs)
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'celebrity_profiles' AND COLUMN_NAME = 'area_artistica_principal_id' AND COLLATION_NAME = @collation_area) = 0
        AND (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'celebrity_profiles' AND COLUMN_NAME = 'area_artistica_principal_id' AND REFERENCED_TABLE_NAME IS NOT NULL) = 0,
    CONCAT('ALTER TABLE celebrity_profiles MODIFY area_artistica_principal_id CHAR(36) CHARACTER SET ', @charset_area, ' COLLATE ', @collation_area, ' NULL'),
    'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'celebrity_profiles' AND COLUMN_NAME = 'area_artistica_principal_id' AND REFERENCED_TABLE_NAME = 'areas_artisticas') = 0,
    'ALTER TABLE celebrity_profiles ADD CONSTRAINT fk_celebrity_area_principal FOREIGN KEY (area_artistica_principal_id) REFERENCES areas_artisticas (id) ON DELETE RESTRICT ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
