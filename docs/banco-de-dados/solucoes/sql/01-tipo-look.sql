-- MATERIAL DIDÁTICO: NÃO EXECUTADO. Não é migration pronta para produção.
-- Leia ../01-tipo-look.md e 00-inspecao-integridade.sql antes de adaptar.
-- DDL apenas em MySQL 8 de teste; verificar objetos/constraints e versão Flyway livre.
-- @owner_id, @piece_id etc. são parâmetros a preencher no laboratório, não autorização.

SHOW CREATE TABLE TipoLook;
SELECT id,codigo,nome FROM TipoLook ORDER BY nome;
SELECT s.id,s.tipo_look_id,t.codigo,t.nome
FROM schemes s LEFT JOIN TipoLook t ON t.id=s.tipo_look_id
WHERE s.id=@scheme_id;
SELECT m.user_id,m.tipo_look_id FROM mirror_states m WHERE m.user_id=@owner_id;
