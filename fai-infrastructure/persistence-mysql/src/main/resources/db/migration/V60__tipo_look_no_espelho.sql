-- Defesa: opções de Tipo de look mantidas em uma tabela e referenciadas pelo Espelho e pelo look salvo.
-- Idempotente: o MySQL não reverte DDL, então uma tentativa anterior interrompida pode ter deixado objetos para trás.
CREATE TABLE IF NOT EXISTS TipoLook (
    id CHAR(36) PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nome VARCHAR(80) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL
);

INSERT IGNORE INTO TipoLook (id, codigo, nome, created_at, updated_at) VALUES
    ('56000000-0000-4000-8000-000000000001', 'FEMININO', 'Feminino', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)),
    ('56000000-0000-4000-8000-000000000002', 'MASCULINO', 'Masculino', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)),
    ('56000000-0000-4000-8000-000000000003', 'UNISEX', 'Unisex', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));

-- NULL preserva looks anteriores à funcionalidade sem atribuir um tipo que o usuário não escolheu.
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mirror_states' AND COLUMN_NAME = 'tipo_look_id') = 0,
    'ALTER TABLE mirror_states ADD COLUMN tipo_look_id CHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mirror_states' AND CONSTRAINT_NAME = 'fk_mirror_tipo_look') = 0,
    'ALTER TABLE mirror_states ADD CONSTRAINT fk_mirror_tipo_look FOREIGN KEY (tipo_look_id) REFERENCES TipoLook(id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schemes' AND COLUMN_NAME = 'tipo_look_id') = 0,
    'ALTER TABLE schemes ADD COLUMN tipo_look_id CHAR(36) NULL', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schemes' AND CONSTRAINT_NAME = 'fk_scheme_tipo_look') = 0,
    'ALTER TABLE schemes ADD CONSTRAINT fk_scheme_tipo_look FOREIGN KEY (tipo_look_id) REFERENCES TipoLook(id)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
