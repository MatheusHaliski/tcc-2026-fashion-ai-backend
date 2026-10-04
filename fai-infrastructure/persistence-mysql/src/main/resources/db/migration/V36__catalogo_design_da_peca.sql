-- Renumerada de V31 para V33 e depois para V36: duas migrations chegaram ao main como V31 (esta e
-- V31__politica_verificacao_emissor) e as duas correções (#117 e #119) renumeraram cada uma para V33 — o Flyway recusa
-- versões repetidas e a API não subia. Nenhum ambiente publicado tinha aplicado V31+ (deploy em V30); V34/V35 não
-- dependem destas colunas.
-- RF47 · Características únicas da peça no catálogo: a descrição oficial do produto e o design estruturado lido dela
-- (estampa, posição/tamanho do logo, lados, cores da peça × cores da estampa). É o que separa, por exemplo, duas
-- camisetas da mesma marca e do mesmo tipo quando a pessoa descreve a peça por texto na busca catalogada.
-- design_json: {"pattern":"ALLOVER_LOGO|SINGLE_LOGO|STRIPES|…","logoPlacement":"ALLOVER|CENTER_CHEST|…","logoSize":"LARGE|SMALL",
--               "sides":["FRONT","BACK"],"baseColors":["gray"],"printColors":["black"]}  (vocabulário: catalog/normalization.json → design)
ALTER TABLE catalog_products
  ADD COLUMN description TEXT NULL AFTER collection,
  ADD COLUMN design_json JSON NULL AFTER description;
