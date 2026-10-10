-- Importação incremental: buscas por identificadores de produto/variante não devem varrer o acervo.
CREATE INDEX idx_catalog_products_ean ON catalog_products(ean);
CREATE INDEX idx_catalog_products_upc ON catalog_products(upc);
CREATE INDEX idx_catalog_variants_gtin ON catalog_variants(gtin);
CREATE INDEX idx_catalog_variants_sku ON catalog_variants(sku);
CREATE INDEX idx_catalog_variants_code ON catalog_variants(variant_code);
