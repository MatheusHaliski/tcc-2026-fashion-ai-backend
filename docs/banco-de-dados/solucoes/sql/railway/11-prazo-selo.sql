-- Exercício 11 — SQL para rodar à mão no Railway (MySQL 9.7), ANTES do deploy que leva a migração V116.
-- Mesmo nome de CHECK de V116__seals_ordem_disponibilidade_exercicio_11.sql: depois deste SQL a migração não muda nada.
-- Nenhuma tabela nem coluna nova: seals.available_from e seals.available_until já existem.

-- 0) Conferência, só leitura. Esperado: banco fashionai e nenhum CHECK de disponibilidade ainda.
SELECT DATABASE() AS banco;
SELECT tc.CONSTRAINT_NAME, cc.CHECK_CLAUSE FROM information_schema.TABLE_CONSTRAINTS tc
  JOIN information_schema.CHECK_CONSTRAINTS cc
    ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
 WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'seals' AND tc.CONSTRAINT_TYPE = 'CHECK';

-- 1) Diagnóstico, só leitura: selos com o fim ANTES do início. Precisa voltar VAZIO.
--    Se voltar alguma linha, NÃO rode o passo 2 (o MySQL responderia com o erro 3819): decida com quem responde pelos
--    dados qual data corrigir em cada selo, pela tela de edição do selo, e só então crie o CHECK.
SELECT id, name, status, available_from, available_until FROM seals
 WHERE available_from IS NOT NULL AND available_until IS NOT NULL AND available_until < available_from;

-- 2) A regra no banco: início ou fim vazios continuam valendo; fim igual ao início é aceito.
ALTER TABLE seals ADD CONSTRAINT ck_seals_availability_order
    CHECK (available_from IS NULL OR available_until IS NULL OR available_until >= available_from);

-- 3) Conferência final, só leitura: o CHECK e a situação de cada selo com período.
SELECT tc.CONSTRAINT_NAME, cc.CHECK_CLAUSE FROM information_schema.TABLE_CONSTRAINTS tc
  JOIN information_schema.CHECK_CONSTRAINTS cc
    ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
 WHERE tc.CONSTRAINT_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'seals' AND tc.CONSTRAINT_NAME = 'ck_seals_availability_order';
SELECT id, name, available_from, available_until,
       CASE WHEN available_from > CURRENT_TIMESTAMP(6) THEN 'AGENDADO'
            WHEN available_until <= CURRENT_TIMESTAMP(6) THEN 'ENCERRADO'
            ELSE 'NO_PERIODO' END AS periodo
  FROM seals WHERE available_from IS NOT NULL OR available_until IS NOT NULL ORDER BY available_from;
