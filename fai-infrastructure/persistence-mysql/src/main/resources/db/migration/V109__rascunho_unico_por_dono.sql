-- Rascunho de peça (pipeline_jobs) único por dono e ligado a no máximo UMA peça.
-- 1) (id, user_id) vira chave única: toda busca de rascunho é feita pelo par, então o id de um rascunho nunca resolve
--    para outra pessoa.
-- 2) wardrobe_items.draft_id guarda o rascunho que virou a peça, com índice ÚNICO: o banco recusa uma segunda peça do
--    mesmo rascunho (dois envios simultâneos, ou o id reaproveitado por outra conta).
-- Idempotente: cada passo confere antes se a coluna/índice/FK já existe.

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pipeline_jobs' AND INDEX_NAME = 'uq_pipeline_jobs_id_user') = 0,
    'ALTER TABLE pipeline_jobs ADD CONSTRAINT uq_pipeline_jobs_id_user UNIQUE (id, user_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wardrobe_items' AND COLUMN_NAME = 'draft_id') = 0,
    'ALTER TABLE wardrobe_items ADD COLUMN draft_id CHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- peças já criadas por rascunho: o job guarda a peça em input_resource_id (target_type PIECE); só quando há um único
-- rascunho por peça e o dono é o mesmo
UPDATE wardrobe_items w
JOIN (SELECT input_resource_id AS piece_id, MIN(id) AS draft_id, user_id FROM pipeline_jobs
      WHERE target_type = 'PIECE' AND input_resource_id IS NOT NULL
      GROUP BY input_resource_id, user_id HAVING COUNT(*) = 1) d
  ON d.piece_id = w.id AND d.user_id = w.user_id
SET w.draft_id = d.draft_id
WHERE w.draft_id IS NULL;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wardrobe_items' AND INDEX_NAME = 'uq_wardrobe_items_draft') = 0,
    'ALTER TABLE wardrobe_items ADD CONSTRAINT uq_wardrobe_items_draft UNIQUE (draft_id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wardrobe_items' AND COLUMN_NAME = 'draft_id' AND REFERENCED_TABLE_NAME = 'pipeline_jobs') = 0,
    'ALTER TABLE wardrobe_items ADD CONSTRAINT fk_wardrobe_items_draft FOREIGN KEY (draft_id) REFERENCES pipeline_jobs(id) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
