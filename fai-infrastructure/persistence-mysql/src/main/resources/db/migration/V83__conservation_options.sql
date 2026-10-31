-- Reuse V77's existing FK/table; do not create a second conservation relation.
-- No backfill from item_condition: GOOD may have been a code default.
ALTER TABLE `EstadoConservacao` ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT TRUE;

INSERT INTO `EstadoConservacao` (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), options.codigo, options.nome, TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)
FROM (
    SELECT 'NOVA' AS codigo, 'Nova' AS nome
    UNION ALL SELECT 'EXCELENTE', 'Excelente'
    UNION ALL SELECT 'BOA', 'Boa'
    UNION ALL SELECT 'DESGASTADA', 'Desgastada'
    UNION ALL SELECT 'DANIFICADA', 'Danificada'
) AS options
WHERE NOT EXISTS (SELECT 1 FROM `EstadoConservacao` existing WHERE existing.codigo = options.codigo);
