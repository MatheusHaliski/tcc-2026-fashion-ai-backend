-- Compatível com as tabelas/FKs já cadastradas manualmente. Não cria opções nem
-- converte o enum/texto legado em referência: essa correspondência não é presumida.
CREATE TABLE IF NOT EXISTS `EstadoConservacao` (
    id CHAR(36) PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nome VARCHAR(80) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL
);

CREATE TABLE IF NOT EXISTS `TipoLavagem` (
    id CHAR(36) PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nome VARCHAR(80) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL
);

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wardrobe_items' AND COLUMN_NAME = 'estado_de_conservacao') = 0,
    'ALTER TABLE wardrobe_items ADD COLUMN estado_de_conservacao CHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wardrobe_items' AND COLUMN_NAME = 'tipo_lavagem_id') = 0,
    'ALTER TABLE wardrobe_items ADD COLUMN tipo_lavagem_id CHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Detectar por coluna e destino também preserva uma FK válida com outro nome.
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wardrobe_items' AND COLUMN_NAME = 'estado_de_conservacao' AND REFERENCED_TABLE_NAME = 'EstadoConservacao' AND REFERENCED_COLUMN_NAME = 'id') = 0,
    'ALTER TABLE wardrobe_items ADD CONSTRAINT fk_wardrobe_items_estado_conservacao FOREIGN KEY (estado_de_conservacao) REFERENCES `EstadoConservacao`(id) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wardrobe_items' AND COLUMN_NAME = 'tipo_lavagem_id' AND REFERENCED_TABLE_NAME = 'TipoLavagem' AND REFERENCED_COLUMN_NAME = 'id') = 0,
    'ALTER TABLE wardrobe_items ADD CONSTRAINT fk_wardrobe_items_tipo_lavagem FOREIGN KEY (tipo_lavagem_id) REFERENCES `TipoLavagem`(id) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
