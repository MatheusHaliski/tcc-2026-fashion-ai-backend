-- MATERIAL DIDÁTICO: NÃO EXECUTADO. Não é migration pronta para produção.
-- Leia ../11-prazo-selo.md e 00-inspecao-integridade.sql antes de adaptar.
-- DDL apenas em MySQL 8 de teste; verificar objetos/constraints e versão Flyway livre.
-- @owner_id, @piece_id etc. são parâmetros a preencher no laboratório, não autorização.

SHOW CREATE TABLE seals;
SELECT id,available_from,available_until FROM seals
WHERE available_from IS NOT NULL AND available_until IS NOT NULL
  AND available_until<available_from;
-- Opcional, apenas se ainda não houver CHECK equivalente e a consulta acima vier vazia:
ALTER TABLE seals ADD CONSTRAINT ck_seals_availability_order
  CHECK(available_from IS NULL OR available_until IS NULL OR available_until>=available_from);
SELECT id,name,available_from,available_until,
  CASE WHEN available_from>CURRENT_TIMESTAMP(6) THEN 'AGENDADO'
       WHEN available_until<CURRENT_TIMESTAMP(6) THEN 'ENCERRADO'
       ELSE 'DISPONIVEL_NO_PERIODO' END AS periodo
FROM seals WHERE id=@seal_id;
