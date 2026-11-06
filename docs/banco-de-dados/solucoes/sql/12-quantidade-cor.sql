-- MATERIAL DIDÁTICO: NÃO EXECUTADO. Não é migration pronta para produção.
-- Leia ../12-quantidade-cor.md e 00-inspecao-integridade.sql antes de adaptar.
-- DDL apenas em MySQL 8 de teste; verificar objetos/constraints e versão Flyway livre.
-- @owner_id, @piece_id etc. são parâmetros a preencher no laboratório, não autorização.

SELECT id,JSON_EXTRACT(background_config_json,'$.policy') AS policy FROM seals WHERE id=@seal_id;
SELECT s.id,r.quantifier,r.minimum_count,r.color FROM seals s
JOIN JSON_TABLE(COALESCE(JSON_EXTRACT(s.background_config_json,'$.policy.rules'),JSON_ARRAY()),
  '$[*]' COLUMNS(quantifier VARCHAR(20) PATH '$.quantifier',
                minimum_count INT PATH '$.count',color VARCHAR(80) PATH '$.color')) AS r ON TRUE
WHERE s.id=@seal_id;
-- Não há alteração de schema para count/color; validar e salvar via service existente.
