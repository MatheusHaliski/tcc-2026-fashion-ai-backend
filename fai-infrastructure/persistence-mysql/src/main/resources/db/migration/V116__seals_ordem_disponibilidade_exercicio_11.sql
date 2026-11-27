-- Exercício 11 (prazo de disponibilidade do selo): as colunas seals.available_from e seals.available_until já existem
-- (V2/V20) e o serviço já recusa fim antes do início (SealFormWriter, 400 PERIODO_INVALIDO). Esta migração só acrescenta
-- a mesma regra no banco, como CHECK (docs/banco-de-dados/solucoes/11-prazo-selo.md): início ou fim nulos continuam
-- valendo ("imediato" / "sem fim"), e fim igual ao início é aceito, como no serviço.
-- Idempotente: reconhece o CHECK pelo nome ou pelo conteúdo (criado à mão no Railway com
-- docs/banco-de-dados/solucoes/sql/railway/11-prazo-selo.sql, mesmo sem nome) e não cria um segundo.
-- Selo legado com o período invertido faria o ALTER falhar (erro 3819) e derrubaria o deploy; por isso o CHECK só é
-- criado quando não há nenhum. Havendo, a migração passa sem criar: o diagnóstico de
-- docs/banco-de-dados/MIGRACOES_DOS_EXERCICIOS.md lista os selos, quem responde pelos dados corrige e o CHECK é criado à
-- mão com o SQL do exercício. Nenhuma data é alterada aqui.

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS tc JOIN information_schema.CHECK_CONSTRAINTS cc
            ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
            WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'seals' AND tc.CONSTRAINT_TYPE = 'CHECK'
            AND (tc.CONSTRAINT_NAME = 'ck_seals_availability_order'
                OR (cc.CHECK_CLAUSE LIKE '%available_from%' AND cc.CHECK_CLAUSE LIKE '%available_until%'))) = 0
        AND (SELECT COUNT(*) FROM seals WHERE available_from IS NOT NULL AND available_until IS NOT NULL AND available_until < available_from) = 0,
    'ALTER TABLE seals ADD CONSTRAINT ck_seals_availability_order CHECK (available_from IS NULL OR available_until IS NULL OR available_until >= available_from)', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
