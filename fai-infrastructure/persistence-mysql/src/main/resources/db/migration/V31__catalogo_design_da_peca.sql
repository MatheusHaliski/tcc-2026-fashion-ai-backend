-- RF47 · Características únicas da peça no catálogo: a descrição oficial do produto e o design estruturado lido dela
-- (estampa, posição/tamanho do logo, lados, cores da peça × cores da estampa). É o que separa, por exemplo, duas
-- camisetas da mesma marca e do mesmo tipo quando a pessoa descreve a peça por texto na busca catalogada.
-- design_json: {"pattern":"ALLOVER_LOGO|SINGLE_LOGO|STRIPES|…","logoPlacement":"ALLOVER|CENTER_CHEST|…","logoSize":"LARGE|SMALL",
--               "sides":["FRONT","BACK"],"baseColors":["gray"],"printColors":["black"]}  (vocabulário: catalog/normalization.json → design)
ALTER TABLE catalog_products
  ADD COLUMN description TEXT NULL AFTER collection,
  ADD COLUMN design_json JSON NULL AFTER description;
