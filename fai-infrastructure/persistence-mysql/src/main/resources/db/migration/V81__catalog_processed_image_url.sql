-- Total frame processado fora da API (packshot: a peça sozinha, sem pessoa e sem fundo, num quadro 3:4).
-- Idempotente: o lote de packshot pode ter criado a coluna antes do deploy (ALTER TABLE ... ADD COLUMN processed_image_url TEXT).
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'catalog_images' AND COLUMN_NAME = 'processed_image_url') = 0,
    'ALTER TABLE catalog_images ADD COLUMN processed_image_url TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
