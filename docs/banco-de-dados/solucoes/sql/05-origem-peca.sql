-- MATERIAL DIDÁTICO: NÃO EXECUTADO. Não é migration pronta para produção.
-- Leia ../05-origem-peca.md e 00-inspecao-integridade.sql antes de adaptar.
-- DDL apenas em MySQL 8 de teste; verificar objetos/constraints e versão Flyway livre.
-- @owner_id, @piece_id etc. são parâmetros a preencher no laboratório, não autorização.

SELECT piece_origin,COUNT(*) AS quantidade FROM wardrobe_items GROUP BY piece_origin;
SELECT id,user_id,piece_origin FROM wardrobe_items
WHERE id=@piece_id AND user_id=@owner_id;
-- DML didático para banco de teste; a aplicação deve usar o service autorizado.
UPDATE wardrobe_items SET piece_origin='HERDADA',updated_at=CURRENT_TIMESTAMP(6)
WHERE id=@piece_id AND user_id=@owner_id;
-- Não adicionar CHECK de três valores antes de tratar GARIMPADA e todos os legados encontrados.
