-- Nível térmico do look (Leve, Moderado, Intenso): tabela de opções + FK opcional em schemes
-- (docs/banco-de-dados/solucoes/04-nivel-termico.md; entidades NivelTermico e Scheme.nivelTermico).
-- Idempotente como a V108: em produção a tabela e parte dos registros podem ter sido criados à mão; aqui só entra o que falta.
-- FK RESTRICT nos dois sentidos (decisão do exercício 04): apagar um nível usado por um look falha; a opção que sai de uso
-- é desativada (ativo = FALSE), e os looks antigos continuam lendo o nível deles. Sem CASCADE: retirar um nível nunca
-- apaga looks. A coluna é nullable: look legado fica sem nível.

CREATE TABLE IF NOT EXISTS niveis_termicos (
    id CHAR(36) PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL UNIQUE,
    nome VARCHAR(80) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL
);

-- tabela criada à mão sem a coluna ativo: a entidade NivelTermico lê essa coluna
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'niveis_termicos' AND COLUMN_NAME = 'ativo') = 0,
    'ALTER TABLE niveis_termicos ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT INTO niveis_termicos (id, codigo, nome, ativo, created_at, updated_at)
SELECT UUID(), o.codigo, o.nome, TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)
FROM (
    SELECT 'LEVE' AS codigo, 'Leve' AS nome
    UNION ALL SELECT 'MODERADO', 'Moderado'
    UNION ALL SELECT 'INTENSO', 'Intenso'
) AS o
WHERE NOT EXISTS (SELECT 1 FROM niveis_termicos n WHERE n.codigo = o.codigo);

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schemes' AND COLUMN_NAME = 'nivel_termico_id') = 0,
    'ALTER TABLE schemes ADD COLUMN nivel_termico_id CHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schemes' AND COLUMN_NAME = 'nivel_termico_id' AND REFERENCED_TABLE_NAME = 'niveis_termicos') = 0,
    'ALTER TABLE schemes ADD CONSTRAINT fk_schemes_nivel_termico FOREIGN KEY (nivel_termico_id) REFERENCES niveis_termicos(id) ON DELETE RESTRICT ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
