-- MATERIAL DIDÁTICO: NÃO EXECUTADO. Não é migration pronta para produção.
-- Leia ../08-nome-modulo.md e 00-inspecao-integridade.sql antes de adaptar.
-- DDL apenas em MySQL 8 de teste; verificar objetos/constraints e versão Flyway livre.
-- @owner_id, @piece_id etc. são parâmetros a preencher no laboratório, não autorização.

SHOW CREATE TABLE room_layouts;
SHOW CREATE TABLE room_storage_map;
SELECT user_id,drawer_labels_json,modules_json FROM room_layouts WHERE user_id=@owner_id;
SELECT wardrobe_item_id,address FROM room_storage_map
WHERE user_id=@owner_id AND wardrobe_item_id=@piece_id;
-- Exemplo didático somente para gaveta1; a API deve realizar a validação/autorização.
UPDATE room_layouts
SET drawer_labels_json=JSON_SET(COALESCE(drawer_labels_json,JSON_OBJECT()),'$."1"','Camisas'),
    updated_at=CURRENT_TIMESTAMP(6)
WHERE user_id=@owner_id;
-- Nome genérico: alterar label do módulo localizado pelo id no service; não usar índice fixo do array JSON.
