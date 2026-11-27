-- MATERIAL DIDÁTICO: NÃO EXECUTADO. Não é migration pronta para produção.
-- Leia ../02-conservacao.md e 00-inspecao-integridade.sql antes de adaptar.
-- DDL apenas em MySQL 8 de teste; verificar objetos/constraints e versão Flyway livre.
-- @owner_id, @piece_id etc. são parâmetros a preencher no laboratório, não autorização.

SHOW CREATE TABLE `EstadoConservacao`;
SHOW CREATE TABLE wardrobe_items;
SELECT id,codigo,nome,ativo FROM `EstadoConservacao` ORDER BY nome;
SELECT w.id,w.item_condition,w.estado_de_conservacao,e.codigo,e.nome
FROM wardrobe_items w LEFT JOIN `EstadoConservacao` e ON e.id=w.estado_de_conservacao
WHERE w.id=@piece_id AND w.user_id=@owner_id;
-- Alternativa administrativa em laboratório: desativar, sem remover referências.
UPDATE `EstadoConservacao` SET ativo=FALSE,updated_at=CURRENT_TIMESTAMP(6) WHERE id=@option_id;
