-- MATERIAL DIDÁTICO: NÃO EXECUTADO. Não é migration pronta para produção.
-- Leia ../09-categoria-marca.md e 00-inspecao-integridade.sql antes de adaptar.
-- DDL apenas em MySQL 8 de teste; verificar objetos/constraints e versão Flyway livre.
-- @owner_id, @piece_id etc. são parâmetros a preencher no laboratório, não autorização.

CREATE TABLE `categorias_marca` (
  id CHAR(36) NOT NULL PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(80) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
) ENGINE=InnoDB;
INSERT INTO `categorias_marca` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'CASUAL','Casual',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `categorias_marca` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'ESPORTIVA','Esportiva',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `categorias_marca` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'LUXO','Luxo',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));

ALTER TABLE brand_profiles ADD COLUMN categoria_marca_id CHAR(36) NULL;
ALTER TABLE brand_profiles ADD CONSTRAINT fk_brand_profiles_categoria_marca
  FOREIGN KEY(categoria_marca_id) REFERENCES categorias_marca(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
SELECT b.id,b.fashion_category,c.codigo,c.nome FROM brand_profiles b
LEFT JOIN categorias_marca c ON c.id=b.categoria_marca_id WHERE b.owner_user_id=@owner_id;
