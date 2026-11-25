-- Exercício 06 (estação preferida do look): tabela de opções estacoes, cuja chave é o mesmo texto que o enum Season já
-- grava (SPRING, SUMMER, AUTUMN, WINTER), e FKs aditivas nas três colunas que guardam a estação: schemes.season,
-- moments.season e dna_schemes.seasonal_theme (docs/banco-de-dados/solucoes/06-estacao-look.md). Nenhuma coluna nova
-- nas tabelas do app, nenhum dado convertido: NULL continua valendo "sem estação".
-- Idempotente como a V110: no Railway a tabela, as linhas e as FKs foram criadas à mão com o SQL do exercício; aqui cada
-- passo confere o que já existe e só cria o que falta, com os mesmos nomes. Linhas existentes não são alteradas.
-- FK RESTRICT nos dois sentidos: estação em uso não é apagada nem tem o código trocado; sai de uso com ativo = FALSE.
-- FK de texto exige o mesmo charset e collation dos dois lados (erro 3780): codigo segue os de schemes.season.
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

-- tabela criada à mão sem uma das colunas que as sementes gravam (precedente: V107/V110, sem ativo)
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'estacoes' AND COLUMN_NAME = 'ativo') = 0,
    'ALTER TABLE estacoes ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT TRUE', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'estacoes' AND COLUMN_NAME = 'ordem') = 0,
    'ALTER TABLE estacoes ADD COLUMN ordem INT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'estacoes' AND COLUMN_NAME = 'created_at') = 0,
    'ALTER TABLE estacoes ADD COLUMN created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'estacoes' AND COLUMN_NAME = 'updated_at') = 0,
    'ALTER TABLE estacoes ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- tabela criada à mão com outra collation e ainda sem nenhuma FK apontando para ela: codigo passa a seguir schemes.season
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'estacoes' AND COLUMN_NAME = 'codigo' AND COLLATION_NAME = @collation_estacao) = 0
        AND (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'estacoes') = 0,
    CONCAT('ALTER TABLE estacoes MODIFY codigo VARCHAR(10) CHARACTER SET ', @charset_estacao, ' COLLATE ', @collation_estacao, ' NOT NULL'), 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sementes uma a uma: código já cadastrado (inclusive à mão, com outro nome, outra ordem ou desativado) fica como está
INSERT INTO estacoes (codigo, nome, ordem, ativo, created_at, updated_at)
SELECT 'SPRING', 'Primavera', 1, TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM estacoes WHERE codigo = 'SPRING');
INSERT INTO estacoes (codigo, nome, ordem, ativo, created_at, updated_at)
SELECT 'SUMMER', 'Verão', 2, TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM estacoes WHERE codigo = 'SUMMER');
INSERT INTO estacoes (codigo, nome, ordem, ativo, created_at, updated_at)
SELECT 'AUTUMN', 'Outono', 3, TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM estacoes WHERE codigo = 'AUTUMN');
INSERT INTO estacoes (codigo, nome, ordem, ativo, created_at, updated_at)
SELECT 'WINTER', 'Inverno', 4, TRUE, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6) FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM estacoes WHERE codigo = 'WINTER');

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schemes' AND COLUMN_NAME = 'season' AND REFERENCED_TABLE_NAME = 'estacoes') = 0,
    'ALTER TABLE schemes ADD CONSTRAINT fk_schemes_estacao FOREIGN KEY (season) REFERENCES estacoes (codigo) ON DELETE RESTRICT ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'moments' AND COLUMN_NAME = 'season' AND REFERENCED_TABLE_NAME = 'estacoes') = 0,
    'ALTER TABLE moments ADD CONSTRAINT fk_moments_estacao FOREIGN KEY (season) REFERENCES estacoes (codigo) ON DELETE RESTRICT ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dna_schemes' AND COLUMN_NAME = 'seasonal_theme' AND REFERENCED_TABLE_NAME = 'estacoes') = 0,
    'ALTER TABLE dna_schemes ADD CONSTRAINT fk_dna_schemes_estacao FOREIGN KEY (seasonal_theme) REFERENCES estacoes (codigo) ON DELETE RESTRICT ON UPDATE RESTRICT', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
