-- Exercício 10 — SQL para rodar à mão no Railway (MySQL 9.7), ANTES do deploy que leva a migração V115.
-- Mesmos nomes de tabela, coluna, UNIQUE e FK de V115__areas_artisticas_exercicio_10.sql: depois deste SQL a migração não muda nada.
-- Rode um bloco por vez, com o cliente em utf8mb4 (os nomes têm acento). Não reexecute um bloco que já passou.

-- 0) Conferência, só leitura. Esperado: banco fashionai; a tabela e a coluna ainda não existem (0 linhas nas duas
--    consultas do meio). O texto/lista legados (areas_json) só são mostrados: este exercício não os converte.
SELECT DATABASE() AS banco;
SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'areas_artisticas';
SELECT COLUMN_NAME FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'celebrity_profiles' AND COLUMN_NAME = 'area_artistica_principal_id';
SELECT c.areas_json AS valor_legado, COUNT(*) AS perfis FROM celebrity_profiles c GROUP BY c.areas_json ORDER BY perfis DESC;

-- 1) Tabela de opções.
CREATE TABLE areas_artisticas (
    id CHAR(36) NOT NULL PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL,
    nome VARCHAR(80) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT uq_areas_artisticas_codigo UNIQUE (codigo)
);

-- 2) Opções iniciais (uma linha por código).
INSERT INTO areas_artisticas (id, codigo, nome, ativo, created_at, updated_at)
VALUES (UUID(), 'MUSICA', 'Música', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO areas_artisticas (id, codigo, nome, ativo, created_at, updated_at)
VALUES (UUID(), 'CINEMA', 'Cinema', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO areas_artisticas (id, codigo, nome, ativo, created_at, updated_at)
VALUES (UUID(), 'MODA', 'Moda', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO areas_artisticas (id, codigo, nome, ativo, created_at, updated_at)
VALUES (UUID(), 'TELEVISAO', 'Televisão', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO areas_artisticas (id, codigo, nome, ativo, created_at, updated_at)
VALUES (UUID(), 'TEATRO', 'Teatro', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO areas_artisticas (id, codigo, nome, ativo, created_at, updated_at)
VALUES (UUID(), 'DANCA', 'Dança', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));

-- 3) Coluna opcional no perfil. NULL = não informada; nenhum perfil existente é alterado.
ALTER TABLE celebrity_profiles ADD COLUMN area_artistica_principal_id CHAR(36) NULL;

-- 4) Conferência antes da FK, só leitura: as duas linhas precisam mostrar a MESMA collation.
--    Se forem diferentes, NÃO rode o passo 5 (o MySQL responderia com o erro 3780): a migração V115 alinha a coluna
--    pela collation de areas_artisticas.id e cria a FK no deploy.
SELECT TABLE_NAME, COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND ((TABLE_NAME = 'areas_artisticas' AND COLUMN_NAME = 'id') OR (TABLE_NAME = 'celebrity_profiles' AND COLUMN_NAME = 'area_artistica_principal_id'));

-- 5) FK: opção em uso não é apagada nem tem o id trocado (RESTRICT); para tirar de uso, ativo = FALSE.
ALTER TABLE celebrity_profiles ADD CONSTRAINT fk_celebrity_area_principal
    FOREIGN KEY (area_artistica_principal_id) REFERENCES areas_artisticas (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- 6) Conferência final, só leitura: 6 opções (1 linha por código) e a FK com RESTRICT / RESTRICT.
SELECT codigo, nome, ativo FROM areas_artisticas ORDER BY codigo;
SELECT CONSTRAINT_NAME, DELETE_RULE, UPDATE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_celebrity_area_principal';
