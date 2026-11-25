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

-- código já cadastrado (inclusive à mão, com outro id, outro nome ou desativado) fica como está
INSERT INTO tipos_iluminacao (id, codigo, nome, ativo, created_at, updated_at) VALUES
    (UUID(), 'QUENTE', 'Luz quente', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)),
    (UUID(), 'NEUTRA', 'Luz neutra', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)),
    (UUID(), 'FRIA', 'Luz fria', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)),
    (UUID(), 'NATURAL', 'Luz natural', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))
ON DUPLICATE KEY UPDATE codigo = codigo;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'acervo_ambientes' AND COLUMN_NAME = 'tipo_iluminacao_id') = 0,
    'ALTER TABLE acervo_ambientes ADD COLUMN tipo_iluminacao_id CHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'acervo_ambientes' AND COLUMN_NAME = 'temperatura_kelvin') = 0,
    'ALTER TABLE acervo_ambientes ADD COLUMN temperatura_kelvin INT NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'acervo_ambientes' AND COLUMN_NAME = 'tipo_iluminacao_id' AND REFERENCED_TABLE_NAME = 'tipos_iluminacao') = 0,
    'ALTER TABLE acervo_ambientes ADD CONSTRAINT fk_acervo_ambientes_tipo_iluminacao FOREIGN KEY (tipo_iluminacao_id) REFERENCES tipos_iluminacao (id) ON DELETE RESTRICT ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
-- faixa de temperatura de cor aceita (a mesma regra do serviço): 2700 K (quente) a 6500 K (luz do dia); NULL = não informada
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'acervo_ambientes' AND CONSTRAINT_NAME = 'ck_acervo_ambientes_kelvin') = 0,
    'ALTER TABLE acervo_ambientes ADD CONSTRAINT ck_acervo_ambientes_kelvin CHECK (temperatura_kelvin IS NULL OR temperatura_kelvin BETWEEN 2700 AND 6500)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
