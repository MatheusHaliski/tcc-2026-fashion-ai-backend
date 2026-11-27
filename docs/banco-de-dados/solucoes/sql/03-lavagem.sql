-- MATERIAL DIDÁTICO: NÃO EXECUTADO. Não é migration pronta para produção.
-- Leia ../03-lavagem.md e 00-inspecao-integridade.sql antes de adaptar.
-- DDL apenas em MySQL 8 de teste; verificar objetos/constraints e versão Flyway livre.
-- @owner_id, @piece_id etc. são parâmetros a preencher no laboratório, não autorização.

SHOW CREATE TABLE `TipoLavagem`;
SELECT id,codigo,nome FROM `TipoLavagem` ORDER BY nome;
SELECT w.id,w.tipo_lavagem_id,t.codigo,t.nome,w.care_instructions
FROM wardrobe_items w LEFT JOIN `TipoLavagem` t ON t.id=w.tipo_lavagem_id
WHERE w.id=@piece_id AND w.user_id=@owner_id;
-- Não é necessária outra coluna nem outra FK para concluir a escrita. A V77 já as prevê.
