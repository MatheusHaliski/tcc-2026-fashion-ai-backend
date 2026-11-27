-- MATERIAL DIDÁTICO: NÃO EXECUTADO. Não é migration pronta para produção.
-- Leia ../04-nivel-termico.md e 00-inspecao-integridade.sql antes de adaptar.
-- DDL apenas em MySQL 8 de teste; verificar objetos/constraints e versão Flyway livre.
-- @owner_id, @piece_id etc. são parâmetros a preencher no laboratório, não autorização.

CREATE TABLE `niveis_termicos` (
  id CHAR(36) NOT NULL PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(80) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
) ENGINE=InnoDB;
INSERT INTO `niveis_termicos` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'LEVE','Leve',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `niveis_termicos` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'MODERADO','Moderado',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `niveis_termicos` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'INTENSO','Intenso',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));

ALTER TABLE schemes ADD COLUMN nivel_termico_id CHAR(36) NULL;
ALTER TABLE schemes ADD CONSTRAINT fk_schemes_nivel_termico
  FOREIGN KEY (nivel_termico_id) REFERENCES niveis_termicos(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
SELECT s.id,n.codigo,n.nome FROM schemes s
LEFT JOIN niveis_termicos n ON n.id=s.nivel_termico_id WHERE s.id=@scheme_id;
