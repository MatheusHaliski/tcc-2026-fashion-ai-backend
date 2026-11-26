-- Exercício 16 (CBC: cenário preferido): a preferência é de cada pessoa em cada Desafio de Montagem e nunca reescreve o
-- desafio (flair_challenges.scenario continua sendo o cenário oficial). Três tabelas
-- (docs/banco-de-dados/solucoes/16-preferencia-cbc.md):
--   cbc_scenarios            opções de cenário (código = o mesmo texto de flair_challenges.scenario);
--   cbc_challenge_scenarios  quais cenários cada desafio permite;
--   cbc_preferences          a escolha da pessoa (uma por pessoa e desafio), com FK COMPOSTA para a tabela acima: só dá
--                            para preferir um cenário permitido naquele desafio.
-- Idempotente como a V119/V120: no Railway as tabelas são criadas à mão
-- (docs/banco-de-dados/solucoes/sql/railway/16-preferencia-cbc.sql); aqui cada passo confere o que já existe e só cria
-- o que falta, com os mesmos nomes. As colunas de FK seguem o charset e a collation da coluna referenciada.

CREATE TABLE IF NOT EXISTS cbc_scenarios (
    id CHAR(36) NOT NULL PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL,
    nome VARCHAR(80) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT uq_cbc_scenarios_codigo UNIQUE (codigo)
);

-- tabela criada à mão sem uma das colunas que a entidade CbcScenario lê
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cbc_scenarios' AND COLUMN_NAME = 'ativo') = 0,
    'ALTER TABLE cbc_scenarios ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cbc_scenarios' AND COLUMN_NAME = 'created_at') = 0,
    'ALTER TABLE cbc_scenarios ADD COLUMN created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cbc_scenarios' AND COLUMN_NAME = 'updated_at') = 0,
    'ALTER TABLE cbc_scenarios ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cbc_scenarios' AND COLUMN_NAME = 'created_by') = 0,
    'ALTER TABLE cbc_scenarios ADD COLUMN created_by VARCHAR(80) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cbc_scenarios' AND COLUMN_NAME = 'last_modified_by') = 0,
    'ALTER TABLE cbc_scenarios ADD COLUMN last_modified_by VARCHAR(80) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sementes uma a uma, pelo código: os cenários que a tela sabe desenhar (lib/flair/cenas/catalogo.ts) e o "livre"
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'armario', 'Armário', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM cbc_scenarios WHERE codigo = 'armario');
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'brecho', 'Brechó', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM cbc_scenarios WHERE codigo = 'brecho');
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'carnaval', 'Carnaval', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM cbc_scenarios WHERE codigo = 'carnaval');
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'casamento', 'Casamento', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM cbc_scenarios WHERE codigo = 'casamento');
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'desfile', 'Desfile', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM cbc_scenarios WHERE codigo = 'desfile');
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'estagio', 'Estágio', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM cbc_scenarios WHERE codigo = 'estagio');
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'festival', 'Festival', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM cbc_scenarios WHERE codigo = 'festival');
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'gala', 'Gala', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM cbc_scenarios WHERE codigo = 'gala');
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'halloween', 'Halloween', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM cbc_scenarios WHERE codigo = 'halloween');
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'ipanema', 'Ipanema', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM cbc_scenarios WHERE codigo = 'ipanema');
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'livre', 'Livre', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM cbc_scenarios WHERE codigo = 'livre');
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'paris', 'Paris', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM cbc_scenarios WHERE codigo = 'paris');
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'popup', 'Pop-up', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM cbc_scenarios WHERE codigo = 'popup');
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'primavera', 'Primavera', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM cbc_scenarios WHERE codigo = 'primavera');
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'semana', 'Semana de moda', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM cbc_scenarios WHERE codigo = 'semana');
INSERT INTO cbc_scenarios (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'serra', 'Serra', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM cbc_scenarios WHERE codigo = 'serra');

-- tabela criada à mão sem índice único em codigo: cria o uq_cbc_scenarios_codigo, desde que não haja código repetido
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.STATISTICS s WHERE s.TABLE_SCHEMA = DATABASE() AND s.TABLE_NAME = 'cbc_scenarios'
            AND s.NON_UNIQUE = 0 AND s.COLUMN_NAME = 'codigo' AND s.SEQ_IN_INDEX = 1
            AND NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS o WHERE o.TABLE_SCHEMA = s.TABLE_SCHEMA
                AND o.TABLE_NAME = s.TABLE_NAME AND o.INDEX_NAME = s.INDEX_NAME AND o.SEQ_IN_INDEX > 1)) = 0
        AND (SELECT COUNT(*) FROM (SELECT codigo FROM cbc_scenarios GROUP BY codigo HAVING COUNT(*) > 1) AS repetidos) = 0,
    'ALTER TABLE cbc_scenarios ADD CONSTRAINT uq_cbc_scenarios_codigo UNIQUE (codigo)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- charset e collation das colunas referenciadas (FK de texto com collations diferentes: erro 3780)
SET @cs_desafio = (SELECT CONCAT(CHARACTER_SET_NAME, ' COLLATE ', COLLATION_NAME) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flair_challenges' AND COLUMN_NAME = 'id');
SET @cs_cenario = (SELECT CONCAT(CHARACTER_SET_NAME, ' COLLATE ', COLLATION_NAME) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cbc_scenarios' AND COLUMN_NAME = 'id');
SET @cs_usuario = (SELECT CONCAT(CHARACTER_SET_NAME, ' COLLATE ', COLLATION_NAME) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id');

-- cenários permitidos em cada desafio
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cbc_challenge_scenarios') = 0,
    CONCAT('CREATE TABLE IF NOT EXISTS cbc_challenge_scenarios (challenge_id CHAR(36) CHARACTER SET ', @cs_desafio, ' NOT NULL, scenario_id CHAR(36) CHARACTER SET ', @cs_cenario,
        ' NOT NULL, PRIMARY KEY (challenge_id, scenario_id))'), 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'cbc_challenge_scenarios'
            AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = 'fk_ccs_challenge') = 0
        AND (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cbc_challenge_scenarios'
            AND COLUMN_NAME = 'challenge_id' AND REFERENCED_TABLE_NAME = 'flair_challenges') = 0,
    'ALTER TABLE cbc_challenge_scenarios ADD CONSTRAINT fk_ccs_challenge FOREIGN KEY (challenge_id) REFERENCES flair_challenges (id) ON DELETE CASCADE ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'cbc_challenge_scenarios'
            AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = 'fk_ccs_scenario') = 0
        AND (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cbc_challenge_scenarios'
            AND COLUMN_NAME = 'scenario_id' AND REFERENCED_TABLE_NAME = 'cbc_scenarios') = 0,
    'ALTER TABLE cbc_challenge_scenarios ADD CONSTRAINT fk_ccs_scenario FOREIGN KEY (scenario_id) REFERENCES cbc_scenarios (id) ON DELETE RESTRICT ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- cada desafio existente permite o seu cenário oficial e o "livre" (cena neutra); o que já estiver associado fica como está
INSERT INTO cbc_challenge_scenarios (challenge_id, scenario_id)
SELECT c.id, s.id FROM flair_challenges c JOIN cbc_scenarios s ON CAST(s.codigo AS BINARY) = CAST(c.scenario AS BINARY)
WHERE NOT EXISTS (SELECT 1 FROM cbc_challenge_scenarios x WHERE x.challenge_id = c.id AND x.scenario_id = s.id);
INSERT INTO cbc_challenge_scenarios (challenge_id, scenario_id)
SELECT c.id, s.id FROM flair_challenges c JOIN cbc_scenarios s ON s.codigo = 'livre'
WHERE NOT EXISTS (SELECT 1 FROM cbc_challenge_scenarios x WHERE x.challenge_id = c.id AND x.scenario_id = s.id);

-- preferência da pessoa no desafio
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cbc_preferences') = 0,
    CONCAT('CREATE TABLE IF NOT EXISTS cbc_preferences (user_id CHAR(36) CHARACTER SET ', @cs_usuario, ' NOT NULL, challenge_id CHAR(36) CHARACTER SET ', @cs_desafio,
        ' NOT NULL, scenario_id CHAR(36) CHARACTER SET ', @cs_cenario, ' NOT NULL, updated_at DATETIME(6) NOT NULL, PRIMARY KEY (user_id, challenge_id))'), 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'cbc_preferences'
            AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = 'fk_cbcp_user') = 0
        AND (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cbc_preferences'
            AND COLUMN_NAME = 'user_id' AND REFERENCED_TABLE_NAME = 'users') = 0,
    'ALTER TABLE cbc_preferences ADD CONSTRAINT fk_cbcp_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'cbc_preferences'
            AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = 'fk_cbcp_allowed') = 0
        AND (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cbc_preferences'
            AND COLUMN_NAME = 'scenario_id' AND REFERENCED_TABLE_NAME = 'cbc_challenge_scenarios') = 0,
    'ALTER TABLE cbc_preferences ADD CONSTRAINT fk_cbcp_allowed FOREIGN KEY (challenge_id, scenario_id) REFERENCES cbc_challenge_scenarios (challenge_id, scenario_id) ON DELETE RESTRICT ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
