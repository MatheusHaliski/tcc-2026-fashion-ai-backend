-- Origem de uma peça (adquirida, herdada, trocada). A migração é idempotente porque parte disso pode já existir
-- dependendo do ambiente/branch.

CREATE TABLE IF NOT EXISTS origem (
  id CHAR(36) PRIMARY KEY,
  codigo ENUM('ADQUIRIDA', 'HERDADA', 'TROCADA') NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL,
  UNIQUE KEY uk_origem_codigo (codigo)
);

INSERT INTO origem (id, codigo, created_at, updated_at)
SELECT UUID(), o.codigo, NOW(6), NOW(6)
FROM (
  SELECT 'ADQUIRIDA' AS codigo
  UNION ALL SELECT 'HERDADA'
  UNION ALL SELECT 'TROCADA'
) AS o
WHERE NOT EXISTS (SELECT 1 FROM origem x WHERE x.codigo = o.codigo);

-- Já prepara o relacionamento (etapa 3): coluna nova numa tabela existente + FK.
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wardrobe_items' AND COLUMN_NAME = 'origem_id') = 0,
  'ALTER TABLE wardrobe_items ADD COLUMN origem_id CHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wardrobe_items' AND COLUMN_NAME = 'origem_id' AND REFERENCED_TABLE_NAME = 'origem') = 0,
  'ALTER TABLE wardrobe_items ADD CONSTRAINT fk_wardrobe_items_origem FOREIGN KEY (origem_id) REFERENCES origem(id) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

