-- MATERIAL DIDÁTICO: NÃO EXECUTADO. Não é migration pronta para produção.
-- Leia ../20-sku-cor.md e 00-inspecao-integridade.sql antes de adaptar.
-- DDL apenas em MySQL 8 de teste; verificar objetos/constraints e versão Flyway livre.
-- @owner_id, @piece_id etc. são parâmetros a preencher no laboratório, não autorização.

SHOW CREATE TABLE catalog_products;
SHOW CREATE TABLE catalog_variants;
SHOW CREATE TABLE wardrobe_items;
-- SKU de variante e cor exigidos no MESMO registro v:
SELECT p.id AS product_id,v.id AS variant_id,v.sku,v.color
FROM catalog_products p JOIN catalog_variants v ON v.product_id=p.id
WHERE LOWER(v.sku)=LOWER(@sku) AND v.color=@color;
-- SKU não é globalmente único; limitar também por produto/marca quando necessário.
SELECT w.id,w.catalog_product_id,w.catalog_variant_id,v.sku,v.color
FROM wardrobe_items w JOIN catalog_variants v ON v.id=w.catalog_variant_id
WHERE w.id=@piece_id AND w.user_id=@owner_id;
SELECT w.id FROM wardrobe_items w JOIN catalog_variants v ON v.id=w.catalog_variant_id
WHERE w.catalog_product_id IS NULL OR w.catalog_product_id<>v.product_id;
