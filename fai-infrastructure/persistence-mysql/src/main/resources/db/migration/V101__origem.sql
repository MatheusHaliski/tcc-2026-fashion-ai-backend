CREATE TABLE origem (
  id CHAR(36) PRIMARY KEY,
  codigo VARCHAR(30) NOT NULL ENUM('ADQUIRIDA', 'HERDADA', 'TROCADA'),
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
);

INSERT INTO origem (id, codigo, created_at, updated_at) VALUES
(UUID(), 'ADQUIRIDA',  NOW(6), NOW(6)),
(UUID(), 'HERDADA', NOW(6), NOW(6)),
(UUID(), 'TROCADA', NOW(6), NOW(6));

-- já prepara o relacionamento (etapa 3): coluna nova numa tabela existente + FK
ALTER TABLE wardrobe_items ADD COLUMN origem_id CHAR(36) NULL,
  ADD CONSTRAINT fk_wardrobe_items_origem FOREIGN KEY (origem_id)
  REFERENCES origem(id) ON DELETE SET NULL ON UPDATE CASCADE;