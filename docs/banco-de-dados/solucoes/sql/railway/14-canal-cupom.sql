-- Exercício 14 — canal de utilização do cupom. SQL simples para rodar À MÃO no console do Railway (MySQL 9.7),
-- no banco da API. Os nomes são os mesmos da migração V119__canal_cupom_exercicio_14.sql, que depois não muda nada.
-- Rode uma vez, de cima para baixo. Se um comando já foi executado, o MySQL avisa (1050 tabela existe, 1060 coluna
-- existe, 1826 FK repetida, 1062 código repetido): pule esse comando e siga.

-- 1) Conferência (só leitura): banco certo, última migração e o que já existe.
SELECT DATABASE() AS banco;
SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 3;
SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND (TABLE_NAME = 'canais_cupom' OR COLUMN_NAME IN ('canal_cupom_id', 'canal_codigo_snapshot'))
 ORDER BY TABLE_NAME, ORDINAL_POSITION;
-- A collation de canais_cupom.id precisa ser a mesma das colunas canal_cupom_id (erro 3780 se não for). A tabela nova
-- nasce com a collation padrão do banco; compare com a das tabelas do app:
SELECT @@collation_database AS padrao_do_banco;
SELECT TABLE_NAME, TABLE_COLLATION FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('promotions', 'flair_combinations', 'promotion_redemptions', 'flair_redemptions');

-- 2) Tabela de opções.
CREATE TABLE canais_cupom (
    id CHAR(36) NOT NULL PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL,
    nome VARCHAR(80) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT uq_canais_cupom_codigo UNIQUE (codigo)
);

INSERT INTO canais_cupom (id, codigo, nome, ativo, created_at, updated_at)
VALUES (UUID(), 'LOJA_FISICA', 'Loja física', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO canais_cupom (id, codigo, nome, ativo, created_at, updated_at)
VALUES (UUID(), 'ECOMMERCE', 'E-commerce', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO canais_cupom (id, codigo, nome, ativo, created_at, updated_at)
VALUES (UUID(), 'AMBOS', 'Ambos', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));

-- 3) Ofertas: promoção de selo e combinação FLAIR. Coluna nova e nula: nenhuma linha existente bloqueia a FK.
ALTER TABLE promotions ADD COLUMN canal_cupom_id CHAR(36) NULL;
ALTER TABLE promotions ADD CONSTRAINT fk_promotions_canal_cupom
  FOREIGN KEY (canal_cupom_id) REFERENCES canais_cupom (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE flair_combinations ADD COLUMN canal_cupom_id CHAR(36) NULL;
ALTER TABLE flair_combinations ADD CONSTRAINT fk_flair_combinations_canal_cupom
  FOREIGN KEY (canal_cupom_id) REFERENCES canais_cupom (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- 4) Cupons emitidos: FK e o código do canal na hora da emissão. Sem preencher os antigos: ficam "não informado".
ALTER TABLE promotion_redemptions ADD COLUMN canal_cupom_id CHAR(36) NULL;
ALTER TABLE promotion_redemptions ADD CONSTRAINT fk_promotion_redemptions_canal_cupom
  FOREIGN KEY (canal_cupom_id) REFERENCES canais_cupom (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE promotion_redemptions ADD COLUMN canal_codigo_snapshot VARCHAR(40) NULL;
ALTER TABLE flair_redemptions ADD COLUMN canal_cupom_id CHAR(36) NULL;
ALTER TABLE flair_redemptions ADD CONSTRAINT fk_flair_redemptions_canal_cupom
  FOREIGN KEY (canal_cupom_id) REFERENCES canais_cupom (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE flair_redemptions ADD COLUMN canal_codigo_snapshot VARCHAR(40) NULL;

-- 5) Conferência final (só leitura): 3 canais, 4 FKs RESTRICT/RESTRICT e 2 colunas de snapshot.
SELECT codigo, nome, ativo FROM canais_cupom ORDER BY codigo;
SELECT CONSTRAINT_NAME, TABLE_NAME, DELETE_RULE, UPDATE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'canais_cupom' ORDER BY 1;
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'canal_codigo_snapshot' ORDER BY 1;
