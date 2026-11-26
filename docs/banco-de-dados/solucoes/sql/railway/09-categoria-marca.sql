-- Exercício 09 — SQL para rodar à mão no Railway (MySQL 9.7), ANTES do deploy que leva a migração V114.
-- Mesmos nomes de tabela, coluna, UNIQUE e FK de V114__categorias_marca_exercicio_09.sql: depois deste SQL a migração não muda nada.
-- Rode um bloco por vez, com o cliente em utf8mb4 (os nomes têm acento). Não reexecute um bloco que já passou.

-- 0) Conferência, só leitura. Esperado: banco fashionai; a tabela e a coluna ainda não existem (0 linhas nas duas
--    consultas do meio). O texto/lista legados (fashion_category) só são mostrados: este exercício não os converte.
SELECT DATABASE() AS banco;
SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categorias_marca';
SELECT COLUMN_NAME FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'brand_profiles' AND COLUMN_NAME = 'categoria_marca_id';
SELECT b.fashion_category AS valor_legado, COUNT(*) AS perfis FROM brand_profiles b GROUP BY b.fashion_category ORDER BY perfis DESC;

-- 1) Tabela de opções.
CREATE TABLE categorias_marca (
    id CHAR(36) NOT NULL PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL,
    nome VARCHAR(80) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80) NULL,
    last_modified_by VARCHAR(80) NULL,
    CONSTRAINT uq_categorias_marca_codigo UNIQUE (codigo)
);

-- 2) Opções iniciais (uma linha por código).
INSERT INTO categorias_marca (id, codigo, nome, ativo, created_at, updated_at)
VALUES (UUID(), 'CASUAL', 'Casual', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO categorias_marca (id, codigo, nome, ativo, created_at, updated_at)
VALUES (UUID(), 'ESPORTIVA', 'Esportiva', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO categorias_marca (id, codigo, nome, ativo, created_at, updated_at)
VALUES (UUID(), 'LUXO', 'Luxo', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO categorias_marca (id, codigo, nome, ativo, created_at, updated_at)
VALUES (UUID(), 'STREETWEAR', 'Streetwear', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO categorias_marca (id, codigo, nome, ativo, created_at, updated_at)
VALUES (UUID(), 'ALFAIATARIA', 'Alfaiataria', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));
INSERT INTO categorias_marca (id, codigo, nome, ativo, created_at, updated_at)
VALUES (UUID(), 'SUSTENTAVEL', 'Moda sustentável', TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6));

-- 3) Coluna opcional no perfil. NULL = não informada; nenhum perfil existente é alterado.
ALTER TABLE brand_profiles ADD COLUMN categoria_marca_id CHAR(36) NULL;

-- 4) Conferência antes da FK, só leitura: as duas linhas precisam mostrar a MESMA collation.
--    Se forem diferentes, NÃO rode o passo 5 (o MySQL responderia com o erro 3780): a migração V114 alinha a coluna
--    pela collation de categorias_marca.id e cria a FK no deploy.
SELECT TABLE_NAME, COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND ((TABLE_NAME = 'categorias_marca' AND COLUMN_NAME = 'id') OR (TABLE_NAME = 'brand_profiles' AND COLUMN_NAME = 'categoria_marca_id'));

-- 5) FK: opção em uso não é apagada nem tem o id trocado (RESTRICT); para tirar de uso, ativo = FALSE.
ALTER TABLE brand_profiles ADD CONSTRAINT fk_brand_profiles_categoria_marca
    FOREIGN KEY (categoria_marca_id) REFERENCES categorias_marca (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- 6) Conferência final, só leitura: 6 opções (1 linha por código) e a FK com RESTRICT / RESTRICT.
SELECT codigo, nome, ativo FROM categorias_marca ORDER BY codigo;
SELECT CONSTRAINT_NAME, DELETE_RULE, UPDATE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_brand_profiles_categoria_marca';
