-- MATERIAL DIDÁTICO: NÃO EXECUTADO. Não é migration pronta para produção.
-- Leia ../07-iluminacao-quarto.md e 00-inspecao-integridade.sql antes de adaptar.
-- DDL apenas em MySQL 8 de teste; verificar objetos/constraints e versão Flyway livre.
-- @owner_id, @piece_id etc. são parâmetros a preencher no laboratório, não autorização.

CREATE TABLE `tipos_iluminacao` (
  id CHAR(36) NOT NULL PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(80) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
) ENGINE=InnoDB;
INSERT INTO `tipos_iluminacao` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'AMBIENTE','Ambiente',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `tipos_iluminacao` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'DIRECIONADA','Direcionada',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `tipos_iluminacao` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'DIFUSA','Difusa',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));

ALTER TABLE room_layouts ADD COLUMN tipo_iluminacao_id CHAR(36) NULL,
  ADD COLUMN temperatura_kelvin INT NULL;
ALTER TABLE room_layouts ADD CONSTRAINT fk_room_layout_tipo_iluminacao
  FOREIGN KEY(tipo_iluminacao_id) REFERENCES tipos_iluminacao(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT ck_room_layout_kelvin
  CHECK(temperatura_kelvin IS NULL OR temperatura_kelvin BETWEEN 2700 AND 6500);
SELECT user_id,tipo_iluminacao_id,temperatura_kelvin,modules_json
FROM room_layouts WHERE user_id=@owner_id;
