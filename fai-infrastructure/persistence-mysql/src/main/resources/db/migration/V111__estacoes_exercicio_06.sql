-- Exercício 06 (estação preferida do look): tabela de opções estacoes, cuja chave é o mesmo texto que o enum Season já
-- grava (SPRING, SUMMER, AUTUMN, WINTER), e FKs aditivas nas três colunas que guardam a estação: schemes.season,
-- moments.season e dna_schemes.seasonal_theme (docs/banco-de-dados/solucoes/06-estacao-look.md). Nenhuma coluna nova,
-- nenhum dado convertido: NULL continua valendo "sem estação".
-- Idempotente como a V110: no Railway a tabela, as linhas e as FKs foram criadas à mão com o SQL do exercício; aqui cada
-- passo confere o que já existe e só cria o que falta, com os mesmos nomes. Linhas existentes não são alteradas.
-- FK RESTRICT nos dois sentidos: estação em uso não é apagada nem tem o código trocado; sai de uso com ativo = FALSE.
-- FK de texto exige o mesmo charset e collation dos dois lados (erro 3780): codigo copia os de schemes.season.
-- Valor legado fora dos 4 códigos faz o ALTER da FK falhar (erro 1452) e a migração parar sem inventar estação: corrigir
-- o valor com o diagnóstico de docs/banco-de-dados/MIGRACOES_DOS_EXERCICIOS.md e subir de novo.

SET @charset_estacao = (SELECT CHARACTER_SET_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schemes' AND COLUMN_NAME = 'season');
SET @collation_estacao = (SELECT COLLATION_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schemes' AND COLUMN_NAME = 'season');
SET @ddl = CONCAT('CREATE TABLE IF NOT EXISTS estacoes (',
    'codigo VARCHAR(10) CHARACTER SET ', @charset_estacao, ' COLLATE ', @collation_estacao, ' NOT NULL PRIMARY KEY, ',
    'nome VARCHAR(40) NOT NULL, ',
    'ordem INT NOT NULL, ',
    'ativo BOOLEAN NOT NULL DEFAULT TRUE, ',
    'created_at DATETIME(6) NOT NULL, ',
    'updated_at DATETIME(6) NOT NULL, ',
    'created_by VARCHAR(80) NULL, ',
    'last_modified_by VARCHAR(80) NULL)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- código já cadastrado (inclusive à mão, com outro nome ou desativado) fica como está
INSERT INTO estacoes (codigo, nome, ordem, ativo, created_at, updated_at) VALUES
    ('SPRING', 'Primavera', 1, TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)),
    ('SUMMER', 'Verão', 2, TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)),
    ('AUTUMN', 'Outono', 3, TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)),
    ('WINTER', 'Inverno', 4, TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))
ON DUPLICATE KEY UPDATE codigo = codigo;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schemes' AND COLUMN_NAME = 'season' AND REFERENCED_TABLE_NAME = 'estacoes') = 0,
    'ALTER TABLE schemes ADD CONSTRAINT fk_schemes_estacao FOREIGN KEY (season) REFERENCES estacoes (codigo) ON DELETE RESTRICT ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'moments' AND COLUMN_NAME = 'season' AND REFERENCED_TABLE_NAME = 'estacoes') = 0,
    'ALTER TABLE moments ADD CONSTRAINT fk_moments_estacao FOREIGN KEY (season) REFERENCES estacoes (codigo) ON DELETE RESTRICT ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dna_schemes' AND COLUMN_NAME = 'seasonal_theme' AND REFERENCED_TABLE_NAME = 'estacoes') = 0,
    'ALTER TABLE dna_schemes ADD CONSTRAINT fk_dna_schemes_estacao FOREIGN KEY (seasonal_theme) REFERENCES estacoes (codigo) ON DELETE RESTRICT ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
