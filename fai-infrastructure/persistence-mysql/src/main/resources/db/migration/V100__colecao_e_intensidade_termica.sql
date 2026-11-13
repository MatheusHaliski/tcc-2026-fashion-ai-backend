-- Coleção e intensidade térmica, escolhidas na peça (wardrobe_items) e no look (schemes).
-- Idempotente: em produção parte disso foi criada à mão (tabelas, registros, colunas e FKs); aqui só entra o que falta.
-- As FKs seguem a regra da V99: ON DELETE SET NULL (a peça/look continua sem a opção) e ON UPDATE CASCADE.

CREATE TABLE IF NOT EXISTS colecao (
    id CHAR(36) PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nome VARCHAR(80) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL
);

CREATE TABLE IF NOT EXISTS intensidade_termica (
    id CHAR(36) PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nome VARCHAR(80) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL
);

INSERT INTO colecao (id, codigo, nome, created_at, updated_at)
SELECT UUID(), o.codigo, o.nome, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)
FROM (
    SELECT 'VERAO' AS codigo, 'Verão' AS nome
    UNION ALL SELECT 'INVERNO', 'Inverno'
    UNION ALL SELECT 'FESTA', 'Festa'
) AS o
WHERE NOT EXISTS (SELECT 1 FROM colecao c WHERE c.codigo = o.codigo);

INSERT INTO intensidade_termica (id, codigo, nome, created_at, updated_at)
SELECT UUID(), o.codigo, o.nome, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)
FROM (
    SELECT 'LEVE' AS codigo, 'Leve (dias quentes)' AS nome
    UNION ALL SELECT 'MODERADA', 'Moderada (meia-estação)'
    UNION ALL SELECT 'ALTA', 'Alta (dias frios)'
) AS o
WHERE NOT EXISTS (SELECT 1 FROM intensidade_termica i WHERE i.codigo = o.codigo);

-- ---------------------------------------------------------------- peça (wardrobe_items)
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wardrobe_items' AND COLUMN_NAME = 'colecao_id') = 0,
    'ALTER TABLE wardrobe_items ADD COLUMN colecao_id CHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wardrobe_items' AND COLUMN_NAME = 'colecao_id' AND REFERENCED_TABLE_NAME = 'colecao') = 0,
    'ALTER TABLE wardrobe_items ADD CONSTRAINT fk_wardrobe_items_colecao FOREIGN KEY (colecao_id) REFERENCES colecao(id) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wardrobe_items' AND COLUMN_NAME = 'intensidade_termica_id') = 0,
    'ALTER TABLE wardrobe_items ADD COLUMN intensidade_termica_id CHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wardrobe_items' AND COLUMN_NAME = 'intensidade_termica_id' AND REFERENCED_TABLE_NAME = 'intensidade_termica') = 0,
    'ALTER TABLE wardrobe_items ADD CONSTRAINT fk_wardrobe_items_intensidade_termica FOREIGN KEY (intensidade_termica_id) REFERENCES intensidade_termica(id) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------- look (schemes)
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schemes' AND COLUMN_NAME = 'colecao_id') = 0,
    'ALTER TABLE schemes ADD COLUMN colecao_id CHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schemes' AND COLUMN_NAME = 'colecao_id' AND REFERENCED_TABLE_NAME = 'colecao') = 0,
    'ALTER TABLE schemes ADD CONSTRAINT fk_schemes_colecao FOREIGN KEY (colecao_id) REFERENCES colecao(id) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schemes' AND COLUMN_NAME = 'intensidade_termica_id') = 0,
    'ALTER TABLE schemes ADD COLUMN intensidade_termica_id CHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schemes' AND COLUMN_NAME = 'intensidade_termica_id' AND REFERENCED_TABLE_NAME = 'intensidade_termica') = 0,
    'ALTER TABLE schemes ADD CONSTRAINT fk_schemes_intensidade_termica FOREIGN KEY (intensidade_termica_id) REFERENCES intensidade_termica(id) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
