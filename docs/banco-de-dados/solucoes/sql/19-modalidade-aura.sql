-- MATERIAL DIDÁTICO: NÃO EXECUTADO. Não é migration pronta para produção.
-- Leia ../19-modalidade-aura.md e 00-inspecao-integridade.sql antes de adaptar.
-- DDL apenas em MySQL 8 de teste; verificar objetos/constraints e versão Flyway livre.
-- @owner_id, @piece_id etc. são parâmetros a preencher no laboratório, não autorização.

SELECT id,user_id,
  JSON_EXTRACT(background_config_json,'$.aura.variantId') AS variant_id,
  JSON_EXTRACT(background_config_json,'$.aura.format') AS formato
FROM wardrobe_items WHERE id=@piece_id AND user_id=@owner_id;
SELECT id FROM wardrobe_items
WHERE JSON_EXTRACT(background_config_json,'$.aura.format') IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(background_config_json,'$.aura.format')) NOT IN ('IMAGEM_UNICA','MOSAICO');
-- Sem ALTER; a API deve validar e salvar a configuração inteira necessária. Não escrever artes licenciadas por SQL.
