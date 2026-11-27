-- MATERIAL DIDÁTICO: NÃO EXECUTADO. Não é migration pronta para produção.
-- Leia ../10-area-artistica.md e 00-inspecao-integridade.sql antes de adaptar.
-- DDL apenas em MySQL 8 de teste; verificar objetos/constraints e versão Flyway livre.
-- @owner_id, @piece_id etc. são parâmetros a preencher no laboratório, não autorização.

CREATE TABLE `areas_artisticas` (
  id CHAR(36) NOT NULL PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(80) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
) ENGINE=InnoDB;
INSERT INTO `areas_artisticas` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'MUSICA','Música',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `areas_artisticas` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'CINEMA','Cinema',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `areas_artisticas` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'MODA','Moda',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));

ALTER TABLE celebrity_profiles ADD COLUMN area_artistica_principal_id CHAR(36) NULL;
ALTER TABLE celebrity_profiles ADD CONSTRAINT fk_celebrity_area_principal
  FOREIGN KEY(area_artistica_principal_id) REFERENCES areas_artisticas(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
SELECT c.id,c.areas_json,a.codigo,a.nome FROM celebrity_profiles c
LEFT JOIN areas_artisticas a ON a.id=c.area_artistica_principal_id WHERE c.owner_user_id=@owner_id;
