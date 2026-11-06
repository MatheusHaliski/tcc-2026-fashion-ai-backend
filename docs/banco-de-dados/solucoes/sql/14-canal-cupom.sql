-- MATERIAL DIDÁTICO: NÃO EXECUTADO. Não é migration pronta para produção.
-- Leia ../14-canal-cupom.md e 00-inspecao-integridade.sql antes de adaptar.
-- DDL apenas em MySQL 8 de teste; verificar objetos/constraints e versão Flyway livre.
-- @owner_id, @piece_id etc. são parâmetros a preencher no laboratório, não autorização.

CREATE TABLE `canais_cupom` (
  id CHAR(36) NOT NULL PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(80) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
) ENGINE=InnoDB;
INSERT INTO `canais_cupom` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'LOJA_FISICA','Loja física',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `canais_cupom` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'ECOMMERCE','E-commerce',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `canais_cupom` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'AMBOS','Ambos',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));

ALTER TABLE promotions ADD COLUMN canal_cupom_id CHAR(36) NULL;
ALTER TABLE promotions ADD CONSTRAINT fk_promotions_canal_cupom
  FOREIGN KEY(canal_cupom_id) REFERENCES canais_cupom(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE flair_combinations ADD COLUMN canal_cupom_id CHAR(36) NULL;
ALTER TABLE flair_combinations ADD CONSTRAINT fk_flair_combinations_canal_cupom
  FOREIGN KEY(canal_cupom_id) REFERENCES canais_cupom(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE promotion_redemptions ADD COLUMN canal_cupom_id CHAR(36) NULL;
ALTER TABLE promotion_redemptions ADD CONSTRAINT fk_promotion_redemptions_canal_cupom
  FOREIGN KEY(canal_cupom_id) REFERENCES canais_cupom(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE flair_redemptions ADD COLUMN canal_cupom_id CHAR(36) NULL;
ALTER TABLE flair_redemptions ADD CONSTRAINT fk_flair_redemptions_canal_cupom
  FOREIGN KEY(canal_cupom_id) REFERENCES canais_cupom(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE promotion_redemptions ADD COLUMN canal_codigo_snapshot VARCHAR(40) NULL;
ALTER TABLE flair_redemptions ADD COLUMN canal_codigo_snapshot VARCHAR(40) NULL;
-- Sem backfill por URL da loja: ela não prova canal do cupom emitido anteriormente.
