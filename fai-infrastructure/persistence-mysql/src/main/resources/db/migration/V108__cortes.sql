-- Corte da peça (Regular, Slim, Oversized...): tabela de opções + FK em wardrobe_items.
-- Idempotente: em produção a tabela e parte dos registros podem ter sido criados à mão; aqui só entra o que falta.
-- FK no padrão da V99/V100: ON DELETE SET NULL (a peça continua sem corte) e ON UPDATE CASCADE.

CREATE TABLE IF NOT EXISTS cortes (
    id CHAR(36) PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nome VARCHAR(80) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL
);

-- tabela criada à mão sem a coluna ativo: a entidade Corte lê essa coluna
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cortes' AND COLUMN_NAME = 'ativo') = 0,
    'ALTER TABLE cortes ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT INTO cortes (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), o.codigo, o.nome, TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)
FROM (
    SELECT 'REGULAR' AS codigo, 'Regular' AS nome
    UNION ALL SELECT 'SLIM', 'Slim (ajustado)'
    UNION ALL SELECT 'RETO', 'Reto'
    UNION ALL SELECT 'OVERSIZED', 'Oversized'
    UNION ALL SELECT 'CROPPED', 'Cropped (curto)'
    UNION ALL SELECT 'SKINNY', 'Skinny'
    UNION ALL SELECT 'WIDE_LEG', 'Wide leg / Pantalona'
    UNION ALL SELECT 'FLARE', 'Flare (boca de sino)'
    UNION ALL SELECT 'MOM', 'Mom'
    UNION ALL SELECT 'BOYFRIEND', 'Boyfriend'
    UNION ALL SELECT 'EVASE', 'Evasê'
    UNION ALL SELECT 'GODE', 'Godê'
    UNION ALL SELECT 'SEREIA', 'Sereia'
    UNION ALL SELECT 'TUBINHO', 'Tubinho'
    UNION ALL SELECT 'ENVELOPE', 'Envelope (transpassado)'
    UNION ALL SELECT 'JOGGER', 'Jogger'
) AS o
WHERE NOT EXISTS (SELECT 1 FROM cortes c WHERE c.codigo = o.codigo);

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wardrobe_items' AND COLUMN_NAME = 'corte_id') = 0,
    'ALTER TABLE wardrobe_items ADD COLUMN corte_id CHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wardrobe_items' AND COLUMN_NAME = 'corte_id' AND REFERENCED_TABLE_NAME = 'cortes') = 0,
    'ALTER TABLE wardrobe_items ADD CONSTRAINT fk_wardrobe_items_corte FOREIGN KEY (corte_id) REFERENCES cortes(id) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
