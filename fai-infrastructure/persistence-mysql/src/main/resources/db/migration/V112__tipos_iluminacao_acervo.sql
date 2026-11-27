-- Exercício 07 (tipo de iluminação e temperatura), aplicado ao ACERVO: o quarto 3D saiu do app, e a luz passa a ser do
-- ambiente do acervo (acervo_ambientes), que é o que a cena "Meu espaço" desenha. Tabela de opções tipos_iluminacao,
-- FK opcional e temperatura de cor (kelvin) opcional no ambiente (docs/banco-de-dados/solucoes/07-iluminacao-quarto.md).
-- Idempotente como a V110: no Railway a tabela, as linhas, as colunas, a FK e o CHECK foram criados à mão com o SQL do
-- exercício; aqui cada passo confere o que já existe e só cria o que falta, com os mesmos nomes. Linhas existentes não são
-- alteradas. Ambiente legado (sem FK nem kelvin) continua com a luz padrão da cena.
-- FK RESTRICT nos dois sentidos: um tipo em uso não é apagado (é desativado, ativo = FALSE) e o ambiente nunca some junto.

CREATE TABLE IF NOT EXISTS tipos_iluminacao (
    id CHAR(36) NOT NULL PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL,
    nome VARCHAR(80) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT uq_tipos_iluminacao_codigo UNIQUE (codigo)
);

-- tabela criada à mão sem uma das colunas que a entidade TipoIluminacao lê (precedente: V107/V110, sem ativo)
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tipos_iluminacao' AND COLUMN_NAME = 'ativo') = 0,
    'ALTER TABLE tipos_iluminacao ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tipos_iluminacao' AND COLUMN_NAME = 'created_at') = 0,
    'ALTER TABLE tipos_iluminacao ADD COLUMN created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tipos_iluminacao' AND COLUMN_NAME = 'updated_at') = 0,
    'ALTER TABLE tipos_iluminacao ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tipos_iluminacao' AND COLUMN_NAME = 'created_by') = 0,
    'ALTER TABLE tipos_iluminacao ADD COLUMN created_by VARCHAR(80) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tipos_iluminacao' AND COLUMN_NAME = 'last_modified_by') = 0,
    'ALTER TABLE tipos_iluminacao ADD COLUMN last_modified_by VARCHAR(80) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sementes uma a uma, pelo código (não dependem do UNIQUE): o que já existe fica como está, com o id e o nome de antes
INSERT INTO tipos_iluminacao (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'QUENTE', 'Luz quente', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM tipos_iluminacao WHERE codigo = 'QUENTE');
INSERT INTO tipos_iluminacao (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'NEUTRA', 'Luz neutra', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM tipos_iluminacao WHERE codigo = 'NEUTRA');
INSERT INTO tipos_iluminacao (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'FRIA', 'Luz fria', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM tipos_iluminacao WHERE codigo = 'FRIA');
INSERT INTO tipos_iluminacao (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), 'NATURAL', 'Luz natural', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM tipos_iluminacao WHERE codigo = 'NATURAL');

-- tabela criada à mão sem índice único em codigo: cria o uq_tipos_iluminacao_codigo, desde que não haja código repetido
-- (repetido só existe se foi cadastrado à mão duas vezes; a conferência do doc mostra quantas linhas há por código)
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.STATISTICS s WHERE s.TABLE_SCHEMA = DATABASE() AND s.TABLE_NAME = 'tipos_iluminacao'
            AND s.NON_UNIQUE = 0 AND s.COLUMN_NAME = 'codigo' AND s.SEQ_IN_INDEX = 1
            AND NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS o WHERE o.TABLE_SCHEMA = s.TABLE_SCHEMA
                AND o.TABLE_NAME = s.TABLE_NAME AND o.INDEX_NAME = s.INDEX_NAME AND o.SEQ_IN_INDEX > 1)) = 0
        AND (SELECT COUNT(*) FROM (SELECT codigo FROM tipos_iluminacao GROUP BY codigo HAVING COUNT(*) > 1) AS repetidos) = 0,
    'ALTER TABLE tipos_iluminacao ADD CONSTRAINT uq_tipos_iluminacao_codigo UNIQUE (codigo)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- a coluna da FK segue o charset e a collation de tipos_iluminacao.id (FK de texto com collations diferentes: erro 3780)
SET @charset_tipo = (SELECT CHARACTER_SET_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tipos_iluminacao' AND COLUMN_NAME = 'id');
SET @collation_tipo = (SELECT COLLATION_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tipos_iluminacao' AND COLUMN_NAME = 'id');
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'acervo_ambientes' AND COLUMN_NAME = 'tipo_iluminacao_id') = 0,
    CONCAT('ALTER TABLE acervo_ambientes ADD COLUMN tipo_iluminacao_id CHAR(36) CHARACTER SET ', @charset_tipo, ' COLLATE ', @collation_tipo, ' NULL'),
    'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
-- coluna criada à mão com outra collation e ainda sem a FK: passa a seguir tipos_iluminacao.id (só guarda UUIDs)
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'acervo_ambientes' AND COLUMN_NAME = 'tipo_iluminacao_id' AND COLLATION_NAME = @collation_tipo) = 0
        AND (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'acervo_ambientes' AND COLUMN_NAME = 'tipo_iluminacao_id' AND REFERENCED_TABLE_NAME IS NOT NULL) = 0,
    CONCAT('ALTER TABLE acervo_ambientes MODIFY tipo_iluminacao_id CHAR(36) CHARACTER SET ', @charset_tipo, ' COLLATE ', @collation_tipo, ' NULL'),
    'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'acervo_ambientes' AND COLUMN_NAME = 'temperatura_kelvin') = 0,
    'ALTER TABLE acervo_ambientes ADD COLUMN temperatura_kelvin INT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'acervo_ambientes' AND COLUMN_NAME = 'tipo_iluminacao_id' AND REFERENCED_TABLE_NAME = 'tipos_iluminacao') = 0,
    'ALTER TABLE acervo_ambientes ADD CONSTRAINT fk_acervo_ambientes_tipo_iluminacao FOREIGN KEY (tipo_iluminacao_id) REFERENCES tipos_iluminacao (id) ON DELETE RESTRICT ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
-- faixa de temperatura de cor aceita (a mesma regra do serviço): 2700 K (quente) a 6500 K (luz do dia); NULL = não informada.
-- Reconhece pelo conteúdo um CHECK já criado à mão com outro nome (ex.: o automático acervo_ambientes_chk_1).
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS tc JOIN information_schema.CHECK_CONSTRAINTS cc
            ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
            WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'acervo_ambientes' AND tc.CONSTRAINT_TYPE = 'CHECK'
            AND (tc.CONSTRAINT_NAME = 'ck_acervo_ambientes_kelvin' OR cc.CHECK_CLAUSE LIKE '%temperatura_kelvin%')) = 0,
    'ALTER TABLE acervo_ambientes ADD CONSTRAINT ck_acervo_ambientes_kelvin CHECK (temperatura_kelvin IS NULL OR temperatura_kelvin BETWEEN 2700 AND 6500)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
